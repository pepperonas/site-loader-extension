'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground } = require('./harness');

const plain = x => JSON.parse(JSON.stringify(x));   // Objekte aus dem vm-Realm

const resp = (body, { status = 200, type = 'text/plain' } = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: k => (k === 'content-type' ? type : null) },
  blob: async () => new Blob([body]),
});

test('fetchResource (text) liefert Text und Content-Type, ohne Cookies', async () => {
  let init;
  const { ctx } = loadBackground(async (url, i) => { init = i; return resp('a{}', { type: 'text/css' }); });
  assert.deepEqual(plain(await ctx.fetchResource('https://e.com/a.css', 'text')), { success: true, data: 'a{}', contentType: 'text/css' });
  assert.equal(init.credentials, 'omit');
});

test('fetchResource (arrayBuffer) kodiert auch große Binärdaten korrekt als Base64', async () => {
  const bytes = new Uint8Array(100000).map((_, i) => (i * 7919) % 256);   // > 32-KB-Chunk-Grenze
  const { ctx } = loadBackground(async () => resp(bytes, { type: 'image/png' }));
  const r = await ctx.fetchResource('https://e.com/x.png', 'arrayBuffer');
  assert.equal(r.success, true);
  assert.equal(r.size, 100000);
  assert.equal(r.data, Buffer.from(bytes).toString('base64'));
});

test('fetchResource meldet HTTP-Fehler und Netzwerkfehler statt zu werfen', async () => {
  const { ctx } = loadBackground(async () => resp('', { status: 404 }));
  assert.deepEqual(plain(await ctx.fetchResource('https://e.com/x', 'text')), { success: false, error: 'HTTP 404' });
  const { ctx: c2 } = loadBackground(async () => { throw new Error('offline'); });
  assert.deepEqual(plain(await c2.fetchResource('https://e.com/x', 'text')), { success: false, error: 'offline' });
});

test('fetchBatch: alle URLs beantwortet, höchstens 6 gleichzeitig', async () => {
  let active = 0, peak = 0;
  const { ctx } = loadBackground(async url => {
    active++; peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 2));
    active--;
    return resp(url);
  });
  const urls = Array.from({ length: 20 }, (_, i) => `https://e.com/${i}`);
  const r = await ctx.fetchBatch(urls, 'text');
  assert.equal(Object.keys(r).length, 20);
  for (const u of urls) assert.equal(r[u].data, u);
  assert.ok(peak <= 6 && peak > 1, `peak ${peak}`);
  assert.deepEqual(plain(await ctx.fetchBatch([], 'text')), {});
});

test('Nachrichten fetchResource/fetchBatch antworten asynchron', async () => {
  const { listeners } = loadBackground(async () => resp('ok'));
  const answer = msg => new Promise(res => assert.equal(listeners[0](msg, {}, res), true));
  assert.equal((await answer({ action: 'fetchResource', url: 'https://e.com/', responseType: 'text' })).data, 'ok');
  assert.equal((await answer({ action: 'fetchBatch', urls: ['https://e.com/'], responseType: 'text' }))['https://e.com/'].data, 'ok');
});
