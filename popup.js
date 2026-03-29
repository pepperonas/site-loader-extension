/**
 * Popup Script — Site Loader Extension v2.0
 *
 * Handles UI interaction, mode toggle, progress display,
 * and communication with background service worker.
 */

(function() {
  var button = document.getElementById('downloadBtn');
  var status = document.getElementById('status');
  var stats = document.getElementById('stats');
  var progressSection = document.getElementById('progressSection');
  var progressBar = document.getElementById('progressBar');
  var progressStage = document.getElementById('progressStage');
  var progressCount = document.getElementById('progressCount');
  var modeInfo = document.getElementById('modeInfo');

  var modeDescriptions = {
    zip: 'HTML + separate Asset-Dateien. Kleinere Dateien, vollständiger.',
    html: 'Alles in einer Datei (Base64). Einfach teilbar, aber größer.'
  };

  // ─── Mode Toggle ────────────────────────────────────────────

  var modeRadios = document.querySelectorAll('input[name="mode"]');
  for (var i = 0; i < modeRadios.length; i++) {
    modeRadios[i].addEventListener('change', function() {
      modeInfo.textContent = modeDescriptions[this.value] || '';
    });
  }

  function getSelectedMode() {
    var checked = document.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : 'zip';
  }

  // ─── Progress Listener ──────────────────────────────────────

  var stageLabels = {
    'start': 'Seite analysieren...',
    'styles': 'CSS laden...',
    'css-resources': 'CSS-Ressourcen...',
    'images': 'Bilder laden...',
    'srcset': 'Responsive Bilder...',
    'svgs': 'SVGs laden...',
    'backgrounds': 'Hintergrundbilder...',
    'computed-bg': 'CSS-Hintergründe...',
    'favicons': 'Favicons...',
    'scripts': 'JavaScript...',
    'media': 'Medien...',
    'preload': 'Preload-Ressourcen...',
    'generating': 'Datei erstellen...',
    'compressing': 'ZIP komprimieren...',
    'done': 'Fertig!'
  };

  chrome.runtime.onMessage.addListener(function(message) {
    if (message.action !== 'progress') return;

    progressSection.style.display = 'block';

    var label = stageLabels[message.stage] || message.detail || message.stage;
    progressStage.textContent = label;

    // Update progress bar
    if (message.total > 0) {
      var percent = Math.round(((message.loaded + message.failed) / message.total) * 100);
      progressBar.classList.remove('indeterminate');
      progressBar.style.width = Math.min(percent, 100) + '%';
    }

    // Update counter
    if (message.loaded > 0 || message.failed > 0) {
      var countText = message.loaded + ' geladen';
      if (message.failed > 0) {
        countText += ', ' + message.failed + ' fehlgeschlagen';
      }
      progressCount.textContent = countText;
    }

    // Compression progress
    if (message.stage === 'compressing' && message.detail) {
      progressStage.textContent = message.detail;
    }

    // Done
    if (message.stage === 'done') {
      progressBar.classList.remove('indeterminate');
      progressBar.style.width = '100%';
      progressStage.textContent = message.detail || 'Fertig!';
    }
  });

  // ─── Download Handler ───────────────────────────────────────

  button.addEventListener('click', async function() {
    button.disabled = true;
    button.textContent = 'Wird heruntergeladen...';
    status.style.display = 'none';
    stats.style.display = 'none';
    // Clear stats safely
    while (stats.firstChild) stats.removeChild(stats.firstChild);

    // Reset progress
    progressSection.style.display = 'block';
    progressBar.className = 'progress-bar indeterminate';
    progressBar.style.width = '';
    progressStage.textContent = 'Starte...';
    progressCount.textContent = '';

    var mode = getSelectedMode();

    try {
      // Send download request via background
      chrome.runtime.sendMessage(
        { action: 'downloadPage', mode: mode },
        function(response) {
          if (chrome.runtime.lastError) {
            showError(chrome.runtime.lastError.message);
            return;
          }
          handleResponse(response);
        }
      );
    } catch (error) {
      showError(error.message);
    }
  });

  function handleResponse(response) {
    if (response && response.success) {
      status.className = 'success';
      status.textContent = 'Erfolgreich: ' + response.filename;
      status.style.display = 'block';

      if (response.stats) {
        var s = response.stats;
        var parts = [];
        parts.push(s.loaded + ' Ressourcen geladen');
        if (s.failed > 0) {
          parts.push(s.failed + ' fehlgeschlagen');
        }
        if (s.assets) {
          parts.push(s.assets + ' Dateien im ZIP');
        }

        // Build stats safely using DOM methods
        while (stats.firstChild) stats.removeChild(stats.firstChild);
        for (var i = 0; i < parts.length; i++) {
          var span = document.createElement('span');
          span.textContent = parts[i];
          stats.appendChild(span);
        }
        stats.style.display = 'block';
      }

      button.textContent = 'Erfolgreich!';
      setTimeout(function() {
        button.disabled = false;
        button.textContent = 'Seite herunterladen';
      }, 2500);
    } else {
      showError(response ? response.error : 'Unbekannter Fehler');
    }
  }

  function showError(message) {
    status.className = 'error';
    status.textContent = 'Fehler: ' + message;
    status.style.display = 'block';
    button.disabled = false;
    button.textContent = 'Seite herunterladen';

    // Hide progress on error
    progressBar.classList.remove('indeterminate');
    progressBar.style.width = '100%';
    progressBar.style.background = '#ef4444';
  }
})();
