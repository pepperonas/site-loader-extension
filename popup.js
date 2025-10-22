document.getElementById('downloadBtn').addEventListener('click', async () => {
  const button = document.getElementById('downloadBtn');
  const status = document.getElementById('status');
  
  button.disabled = true;
  button.textContent = 'Wird heruntergeladen...';
  status.style.display = 'block';
  status.className = 'info';
  status.textContent = 'Website wird verarbeitet...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Sende Message direkt - Content Script wird via manifest.json geladen
    chrome.tabs.sendMessage(tab.id, { action: 'downloadPage' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content Script noch nicht geladen - injiziere es
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).then(() => {
          // Versuche erneut
          chrome.tabs.sendMessage(tab.id, { action: 'downloadPage' }, (response) => {
            handleResponse(response);
          });
        }).catch(error => {
          status.className = 'error';
          status.textContent = 'Fehler: ' + error.message;
          button.disabled = false;
          button.textContent = 'Website als HTML speichern';
        });
      } else {
        handleResponse(response);
      }
    });
    
  } catch (error) {
    status.className = 'error';
    status.textContent = 'Fehler: ' + error.message;
    button.disabled = false;
    button.textContent = 'Website als HTML speichern';
  }
  
  function handleResponse(response) {
    if (response && response.success) {
      status.className = 'success';
      status.textContent = 'Website erfolgreich heruntergeladen!';
      button.textContent = 'Erfolgreich!';
      setTimeout(() => {
        button.disabled = false;
        button.textContent = 'Website als HTML speichern';
      }, 2000);
    } else {
      status.className = 'error';
      status.textContent = 'Fehler: ' + (response?.error || 'Unbekannter Fehler');
      button.disabled = false;
      button.textContent = 'Website als HTML speichern';
    }
  }
});
