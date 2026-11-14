'use strict';
// Lädt content.js bzw. background.js in einen vm-Kontext mit nachgebautem
// window/chrome/fetch. Kein Browser, keine Abhängigkeiten.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/**
 * content.js laden. `files` = { absoluteUrl: { data, contentType } } simuliert
 * die Antworten des Background-Workers (fehlt ein Eintrag -> Fehlschlag).
 */
function loadContent({ href = 'https://example.com/dir/page.html', files = {} } = {}) {
  const requests = [];
  const answer = url => (files[url] ? { success: true, ...files[url] } : { success: false, error: 'HTTP 404' });
  const chrome = {
    runtime: {
      getURL: () => '',
      onMessage: { addListener: () => {} },
      sendMessage: async msg => {
        if (msg.action === 'fetchResource') { requests.push(msg.url); return answer(msg.url); }
        if (msg.action === 'fetchBatch') {
          const out = {};
          for (const u of msg.urls) { requests.push(u); out[u] = answer(u); }
          return out;
        }
        return undefined;   // progress
      },
    },
  };
  let api;
  const window = { location: { href }, __siteLoaderTestHook: x => { api = x; } };
  const ctx = vm.createContext({ window, chrome, console: { warn() {}, error() {}, log() {} }, URL, Map, Set, Promise, Object, Array, Math, String });
  vm.runInContext(read('content.js'), ctx);
  return { api, requests };
}

/** background.js laden; `fetchImpl` ersetzt das globale fetch. */
function loadBackground(fetchImpl) {
  const listeners = [];
  const ctx = vm.createContext({
    chrome: { runtime: { onMessage: { addListener: f => listeners.push(f) }, onInstalled: { addListener() {} }, sendMessage: async () => {} } },
    fetch: fetchImpl, AbortController, setTimeout, clearTimeout, btoa, Uint8Array, String, Promise, Array, Math, Object,
  });
  vm.runInContext(read('background.js'), ctx);
  return { ctx, listeners };
}

module.exports = { ROOT, read, loadContent, loadBackground };
