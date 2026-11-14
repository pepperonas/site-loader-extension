'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadContent } = require('./harness');

const B = 'https://example.com/dir/page.html';

test('toAbsolute löst relativ zur Basis auf, Ungültiges ergibt null', () => {
  const { api } = loadContent();
  assert.equal(api.toAbsolute('img/a.png', B), 'https://example.com/dir/img/a.png');
  assert.equal(api.toAbsolute('/x.css'), 'https://example.com/x.css', 'ohne Basis: Seiten-URL');
  assert.equal(api.toAbsolute('//cdn.example/x.js', B), 'https://cdn.example/x.js');
  assert.equal(api.toAbsolute('http://[kaputt', B), null);
});

test('simpleHash ist stabil, positiv und base36', () => {
  const { api } = loadContent();
  assert.equal(api.simpleHash('abc'), api.simpleHash('abc'));
  assert.notEqual(api.simpleHash('abc'), api.simpleHash('abd'));
  assert.match(api.simpleHash('x'.repeat(5000)), /^[0-9a-z]+$/);
  assert.equal(api.simpleHash(''), '0');
});

test('urlToFilename: Pfad bereinigt, Query als Hash, Länge begrenzt', () => {
  const { api } = loadContent();
  assert.equal(api.urlToFilename('https://e.com/img/a b.png'), 'img/a_20b.png');
  assert.equal(api.urlToFilename('https://e.com/'), 'index');
  const q1 = api.urlToFilename('https://e.com/a.png?v=1'), q2 = api.urlToFilename('https://e.com/a.png?v=2');
  assert.ok(q1.startsWith('a.png_') && q1 !== q2, `${q1} / ${q2}`);
  const long = api.urlToFilename('https://e.com/' + 'x'.repeat(300));
  assert.ok(long.length < 100, String(long.length));
  assert.ok(!/\.\.\//.test(api.urlToFilename('https://e.com/a/%2e%2e/%2e%2e/etc')), 'kein Pfad-Ausbruch');
});

test('getMimeExtension: Parameter ignoriert, Unbekanntes leer', () => {
  const { api } = loadContent();
  assert.equal(api.getMimeExtension('image/png; charset=binary'), '.png');
  assert.equal(api.getMimeExtension('font/woff2'), '.woff2');
  assert.equal(api.getMimeExtension('application/x-unbekannt'), '');
  assert.equal(api.getMimeExtension(''), '');
  assert.equal(api.getMimeExtension(undefined), '');
});

test('uniqueAssetPath: gleiche URL -> gleicher Pfad, Kollision -> Hash vor der Endung', () => {
  const { api } = loadContent();
  assert.equal(api.uniqueAssetPath('assets/a.png', 'https://x/a.png'), 'assets/a.png');
  assert.equal(api.uniqueAssetPath('assets/a.png', 'https://x/a.png'), 'assets/a.png');
  const other = api.uniqueAssetPath('assets/a.png', 'https://y/a.png');
  assert.match(other, /^assets\/a_[0-9a-z]+\.png$/);
  assert.match(api.uniqueAssetPath('assets/a.png', 'https://z/a.png'), /^assets\/a_[0-9a-z]+\.png$/);
  assert.notEqual(api.uniqueAssetPath('assets/a.png', 'https://z/a.png'), other);
});

test('registerZipAsset: Endung aus dem Content-Type, Dedup je URL', () => {
  const { api } = loadContent();
  const zip = new Map();
  const p1 = api.registerZipAsset(zip, 'https://e.com/logo', 'assets/', { data: 'QQ==', contentType: 'image/svg+xml' });
  assert.equal(p1, 'assets/logo.svg');
  assert.equal(api.registerZipAsset(zip, 'https://e.com/logo', 'assets/', { data: 'XX' }), p1);
  assert.equal(zip.size, 1);
  assert.equal(zip.get('https://e.com/logo').base64, 'QQ==');
  api.registerZipAsset(zip, 'https://e.com/s.css', 'css/', { text: 'a{}', data: 'a{}', contentType: 'text/css' });
  assert.equal(zip.get('https://e.com/s.css').text, 'a{}');
});

test('parseSrcset: Breiten-/Dichte-Angaben, Kommas in URLs', () => {
  const { api } = loadContent();
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseSrcset('a.jpg 1x, b.jpg 2x'))),
    [{ url: 'a.jpg', descriptor: '1x' }, { url: 'b.jpg', descriptor: '2x' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseSrcset('img.php?w=1,2 300w,img.php?w=3,4 600w'))),
    [{ url: 'img.php?w=1,2', descriptor: '300w' }, { url: 'img.php?w=3,4', descriptor: '600w' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseSrcset('  '))), []);
});

test('parseSrcset: Eintrag ohne Deskriptor (erlaubt, bedeutet 1x)', () => {
  const { api } = loadContent();
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseSrcset('a.jpg, b.jpg 2x'))),
    [{ url: 'a.jpg', descriptor: '' }, { url: 'b.jpg', descriptor: '2x' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseSrcset('a.jpg'))), [{ url: 'a.jpg', descriptor: '' }]);
});

test('processCSS (HTML-Modus): url() wird zur Data-URI, relativ zur CSS-Datei', async () => {
  const { api, requests } = loadContent({ files: {
    'https://example.com/css/font.woff2': { data: 'data:font/woff2;base64,AAA', contentType: 'font/woff2' },
  } });
  const out = await api.processCSS("@font-face{src:url('font.woff2')} b{background:url(data:x)}",
    'https://example.com/css/site.css', 'html', new Map());
  assert.equal(out, "@font-face{src:url('data:font/woff2;base64,AAA')} b{background:url(data:x)}");
  assert.deepEqual(requests, ['https://example.com/css/font.woff2'], 'data:-URLs werden nicht geladen');
});

test('processCSS (ZIP-Modus): url() zeigt auf die Asset-Datei', async () => {
  const { api } = loadContent({ files: { 'https://example.com/i/bg.png': { data: 'QQ==', contentType: 'image/png' } } });
  const zip = new Map();
  const out = await api.processCSS('a{background:url("/i/bg.png")}', B, 'zip', zip);
  assert.equal(out, 'a{background:url("assets/i/bg.png")}');
  assert.equal(zip.get('https://example.com/i/bg.png').path, 'assets/i/bg.png');
});

test('processCSS: @import wird eingesetzt (mit media), Zyklen und Doppelte entfallen', async () => {
  const { api, requests } = loadContent({ files: {
    'https://example.com/a.css': { data: '@import "b.css"; .a{}' },
    'https://example.com/b.css': { data: '@import url(a.css); .b{}' },
  } });
  const out = await api.processCSS('@import url("a.css") print; @import "b.css"; .root{}', 'https://example.com/', 'html', new Map());
  assert.equal(out, '@media print {  .b{} .a{} }  .root{}');
  assert.deepEqual(requests, ['https://example.com/a.css', 'https://example.com/b.css'], 'jede Datei genau einmal');
});

test('processCSS: Fragment-Verweise wie url(#filter) bleiben unangetastet', async () => {
  const { api, requests } = loadContent({ files: { [B]: { data: 'data:text/html;base64,SEITE' } } });
  const css = '.x{filter:url(#blur)} .y{mask:url("#m")}';
  assert.equal(await api.processCSS(css, B, 'html', new Map()), css);
  assert.deepEqual(requests, []);
});

test('processCSS: $-Zeichen im eingesetzten Inhalt werden nicht als Ersetzungsmuster gelesen', async () => {
  const { api } = loadContent({ files: { 'https://example.com/a.css': { data: ".p::after{content:\"$' $& $$\"}" } } });
  const out = await api.processCSS('@import "a.css";', 'https://example.com/', 'html', new Map());
  assert.equal(out, ".p::after{content:\"$' $& $$\"}");
});

test('bgFetchBatch: dedupliziert, filtert data:/blob:, fragt Gecachtes nicht erneut', async () => {
  const f = 'https://example.com/a.png';
  const { api, requests } = loadContent({ files: { [f]: { data: 'X' } } });
  const r = await api.bgFetchBatch([f, f, 'data:x', 'blob:y', 'a.png'.replace('a', '/dir/../a')], 'base64');
  assert.equal(r[f].data, 'X');
  assert.deepEqual(requests, [f]);
  await api.bgFetchBatch([f], 'base64');
  assert.deepEqual(requests, [f], 'Cache greift');
});
