'use strict';
// Querbezüge zwischen Manifest, Release-Workflow und Dateien im Repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, read } = require('./harness');

const manifest = JSON.parse(read('manifest.json'));
const release = read('.github/workflows/release.yml');

// Alles, was die Extension zur Laufzeit lädt.
const runtimeFiles = [
  manifest.background.service_worker, manifest.action.default_popup,
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
  'popup.js', 'content.js',
  ...[...read('background.js').matchAll(/files:\s*\[\s*'([^']+)'/g)].map(m => m[1]),
];

test('Alle zur Laufzeit geladenen Dateien existieren', () => {
  for (const f of new Set(runtimeFiles)) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
});

test('Release-ZIP enthält alle Laufzeit-Dateien', () => {
  const zipBlock = release.slice(release.indexOf('zip -r'), release.indexOf('-x "*.git*"'));
  for (const f of new Set(runtimeFiles)) {
    const dir = f.includes('/') ? f.split('/')[0] + '/' : null;
    assert.ok(zipBlock.includes(f) || (dir && zipBlock.includes(dir)), `${f} fehlt im Release-ZIP`);
  }
});

test('Test-Naht ist im Browser wirkungslos (nur bei gesetztem Haken)', () => {
  assert.match(read('content.js'), /if \(typeof window\.__siteLoaderTestHook === 'function'\)/);
});
