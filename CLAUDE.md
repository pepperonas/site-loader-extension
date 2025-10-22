# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome/Chromium browser extension that downloads the current webpage as a single, self-contained HTML file with all resources (images, CSS, fonts) embedded as Base64 data URIs. The extension is localized in German.

**Extension Name**: Website als HTML herunterladen
**Manifest Version**: 3 (modern Chrome extension API)
**Version**: 1.0

## Project Structure

```
site-loader-extension/
├── manifest.json       # Extension configuration (Manifest V3)
├── popup.html         # Extension popup UI (300px width)
├── popup.js           # UI logic and message handling
├── content.js         # Page processing and resource embedding
└── icon*.png          # Extension icons (16px, 48px, 128px)
```

## Core Architecture

### Two-Script Communication Model

The extension uses Chrome's message passing system between two isolated contexts:

1. **Popup Script** (`popup.js`):
   - Runs in extension popup context
   - Handles UI state (button, status messages)
   - Sends `downloadPage` message to content script
   - Implements fallback injection if content script not loaded

2. **Content Script** (`content.js`):
   - Runs in webpage context with DOM access
   - Clones entire document
   - Embeds all external resources as Base64
   - Triggers browser download with sanitized filename

### Resource Embedding Pipeline

The content script processes resources in this order:

1. **CSS Stylesheets** (`embedStyles`):
   - Fetches external `<link rel="stylesheet">` files
   - Parses CSS for `url()` references (fonts, background images)
   - Converts nested resources to Base64
   - Replaces `<link>` tags with inline `<style>` tags
   - Processes existing inline `<style>` tags similarly

2. **Images** (`embedImages`):
   - Finds all `<img src="...">` tags
   - Skips already Base64-encoded images (`data:` URLs)
   - Converts to absolute URLs relative to page location
   - Replaces `src` with Base64 data URI

3. **SVG Files** (`embedSVGs`):
   - Processes `<img src="*.svg">` tags
   - Processes `<object data="*.svg">` tags
   - Converts SVG files to Base64 data URIs
   - Handles query parameters in SVG URLs

4. **Background Images** (`embedBackgroundImages`):
   - Scans inline `style` attributes for `url()` patterns
   - Converts background images to Base64
   - Updates style attributes in-place

5. **Favicons** (`embedFavicons`):
   - Finds all `<link rel="icon">`, `rel="shortcut icon"`, etc.
   - Converts icon files to Base64
   - Preserves icon in downloaded HTML for complete branding

6. **JavaScript Files** (`embedScripts`):
   - Fetches external `<script src="...">` files
   - Converts to inline `<script>` tags with embedded code
   - Preserves all script attributes (async, defer, type, etc.)
   - **Security note**: Enables interactivity but downloads executable code

### Error Handling Strategy

- **Non-blocking failures**: Resource loading errors are logged but don't stop the process
- **CORS handling**: Cross-origin resources may fail silently (browser security)
- **Async message response**: Uses `return true` in message listener to keep channel open

## Chrome Extension APIs Used

### Required Permissions (manifest.json)
- `activeTab`: Access current tab's content
- `scripting`: Dynamic content script injection
- `downloads`: Trigger file downloads (via blob URLs)

### Key API Patterns

**Content Script Injection with Fallback**:
```javascript
// Try sending message first
chrome.tabs.sendMessage(tab.id, { action: 'downloadPage' }, (response) => {
  if (chrome.runtime.lastError) {
    // Content script not loaded - inject manually
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).then(() => {
      // Retry message
      chrome.tabs.sendMessage(tab.id, { action: 'downloadPage' });
    });
  }
});
```

This pattern handles edge cases where the content script hasn't loaded yet (e.g., extension just installed, page already open).

## Development Workflow

### Testing the Extension

1. **Load in Chrome**:
   ```bash
   # Navigate to chrome://extensions/
   # Enable "Developer mode" (top right)
   # Click "Load unpacked"
   # Select this directory
   ```

2. **Test on a webpage**:
   - Click the extension icon in toolbar
   - Click "Website als HTML speichern"
   - Check Downloads folder for generated HTML file

3. **View logs**:
   - **Popup logs**: Right-click extension icon → Inspect popup
   - **Content script logs**: F12 on webpage → Console tab

### Making Changes

**Popup UI modifications** (popup.html, popup.js):
- Changes visible immediately on next popup open

**Content script changes** (content.js):
- Must reload extension at chrome://extensions/
- Must refresh target webpage

**Manifest changes** (manifest.json):
- Must reload extension at chrome://extensions/

### Common Issues

**"Fehler beim Laden der Ressource" warnings**:
- Normal for CORS-protected resources
- Extension continues with available resources

**Empty or broken downloaded HTML**:
- Check browser console for JavaScript errors
- Verify page is not blocking script execution
- Some sites with CSP headers may prevent resource fetching

**Extension icon not clickable on certain pages**:
- Chrome Web Store pages block extension execution
- System pages (chrome://, chrome-extension://) are restricted

## Technical Details

### Filename Generation
```javascript
const pageTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
const timestamp = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
const filename = `${pageTitle}_${timestamp}.html`;
```

### Resource Conversion Flow
```
External URL → fetch() → Blob → FileReader → Base64 Data URI
```

### Document Cloning Strategy
```javascript
// Deep clone preserves structure but creates isolated DOM
const clone = document.documentElement.cloneNode(true);
const doc = document.implementation.createHTMLDocument();
doc.documentElement.replaceWith(clone);
```

This creates a manipulable copy without affecting the live page.

## Localization

All user-facing text is in German:
- Button labels: "Website als HTML speichern"
- Status messages: "Website wird verarbeitet...", "Erfolgreich heruntergeladen!"
- Error prefix: "Fehler: "

To add English support, extract strings to a separate module or use Chrome's i18n API.

## Manifest V3 Migration Notes

This extension uses Manifest V3 (current standard). Key differences from V2:
- `chrome.scripting.executeScript()` instead of `chrome.tabs.executeScript()`
- Service workers instead of background pages (not used in this extension)
- `action` instead of `browser_action`

## Limitations

**Cannot embed**:
- Video/audio elements (would create massive files, not implemented)
- Canvas content (dynamically rendered, cannot be serialized)
- WebGL content (3D graphics, runtime-dependent)
- iFrame content (separate documents, security restrictions)
- Web fonts with CORS restrictions (cross-origin policy)

**JavaScript considerations**:
- **Now embedded**: External scripts are downloaded and inlined
- **Offline functionality**: API calls, WebSockets will fail offline
- **Security**: Only download trusted websites - malicious JS will be embedded
- **Dynamic content**: Scripts expecting network access may throw errors

**File size concerns**:
- Large images significantly increase HTML file size
- JavaScript libraries can add significant size (React, jQuery, etc.)
- Base64 encoding adds ~33% overhead to all resources
- Browser may limit blob URL size (Chrome: ~500MB, Firefox: ~800MB)
