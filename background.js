/**
 * Background Service Worker
 *
 * Handles CORS-free resource fetching and message relay between popup and content script.
 * The service worker has no CORS restrictions, so it can fetch any URL.
 */

// Fetch a resource and return as base64 or arrayBuffer
async function fetchResource(url, responseType = 'base64') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'force-cache'
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const blob = await response.blob();

    if (responseType === 'text') {
      const text = await blob.text();
      return { success: true, data: text, contentType };
    }

    if (responseType === 'arrayBuffer') {
      const buffer = await blob.arrayBuffer();
      // Convert ArrayBuffer to base64 in chunks to avoid call stack issues
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 32768;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      const base64 = btoa(binary);
      return { success: true, data: base64, contentType, size: bytes.length };
    }

    // Default: base64 data URI
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ success: true, data: reader.result, contentType });
      reader.onerror = () => resolve({ success: false, error: 'FileReader failed' });
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout after 15s' };
    }
    return { success: false, error: error.message };
  }
}

// Batch fetch multiple resources
async function fetchBatch(urls, responseType = 'base64') {
  const results = {};
  const CONCURRENCY = 6;
  let index = 0;

  async function worker() {
    while (index < urls.length) {
      const currentIndex = index++;
      const url = urls[currentIndex];
      results[url] = await fetchResource(url, responseType);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchResource') {
    fetchResource(message.url, message.responseType || 'base64')
      .then(sendResponse);
    return true;
  }

  if (message.action === 'fetchBatch') {
    fetchBatch(message.urls, message.responseType || 'base64')
      .then(sendResponse);
    return true;
  }

  // Relay messages from popup to content script
  if (message.action === 'downloadPage') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ success: false, error: 'Kein aktiver Tab gefunden' });
        return;
      }
      const tab = tabs[0];

      // First try sending directly
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded — inject it + JSZip, then retry
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['lib/jszip.min.js']
          }).then(() => {
            return chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
          }).then(() => {
            // Small delay for script initialization
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, message, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ success: false, error: 'Content Script konnte nicht geladen werden' });
                } else {
                  sendResponse(retryResponse);
                }
              });
            }, 100);
          }).catch((err) => {
            sendResponse({ success: false, error: err.message });
          });
        } else {
          sendResponse(response);
        }
      });
    });
    return true;
  }

  // Forward progress messages from content script to popup
  if (message.action === 'progress' && sender.tab) {
    // Only relay messages from content scripts (sender.tab exists),
    // not from extension pages, to prevent infinite relay loops
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup might be closed, ignore
    });
  }
});

// Inject content scripts when extension is installed/updated on existing tabs
chrome.runtime.onInstalled.addListener(() => {
  // No automatic injection — we inject on demand
});
