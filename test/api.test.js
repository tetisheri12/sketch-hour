'use strict';
// Run: node --test test/api.test.js   (uses the fake Pinterest; no Azure needed)
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { makeFetch, calls } = require('./fake-pinterest');
const { fetchPublicBoard, parseBoardUrl } = require('../scripts/lib/pinterest-public');
const { makeHandler } = require('../api/src/handler');

const SITE = 'https://sketchhour.com';
const BOARD = 'https://www.pinterest.com/example-artist/head-studies/';

function req(link, { origin = SITE, ip = '203.0.113.7' } = {}) {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  if (ip) headers.set('x-forwarded-for', ip + ':51234');
  const query = new URLSearchParams();
  if (link !== undefined) query.set('url', link);
  return { headers, query };
}
function handler(extra = {}) {
  return makeHandler(Object.assign({ fetchPublicBoard, parseBoardUrl, allowedOrigins: [SITE, 'http://localhost:4280'] }, extra));
}

test('api: answers a public board with its name and pins', async () => {
  global.fetch = makeFetch();
  const r = await handler()(req(BOARD));
  assert.equal(r.status, 200);
  assert.equal(r.jsonBody.board.name, 'Head studies');
  assert.equal(r.jsonBody.pins.length, 7);
  assert.equal(r.jsonBody.via, 'board');
  assert.ok(r.jsonBody.fetchedAt > 0);
  assert.match(r.headers['Content-Type'], /application\/json/);
});

test('api: only sketchhour.com (and the local preview) may call it', async () => {
  global.fetch = makeFetch();
  const h = handler();
  assert.equal((await h(req(BOARD, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await h(req(BOARD, { origin: '' }))).status, 403);
  assert.equal((await h(req(BOARD, { origin: 'http://localhost:4280' }))).status, 200);
  // with no list configured (local runs), anyone may call it
  assert.equal((await handler({ allowedOrigins: [''] })(req(BOARD, { origin: '' }))).status, 200);
});

test('api: explains bad links and missing boards', async () => {
  global.fetch = makeFetch({ missing: ['gone'] });
  const h = handler();
  let r = await h(req(undefined));
  assert.equal(r.status, 400); assert.match(r.jsonBody.error, /Paste a Pinterest board link/);
  r = await h(req('https://www.pinterest.com/pin/123/'));
  assert.equal(r.status, 400); assert.match(r.jsonBody.error, /not a board link/);
  r = await h(req('x'.repeat(500)));
  assert.equal(r.status, 400);
  r = await h(req('https://www.pinterest.com/example-artist/gone/'));
  assert.equal(r.status, 404); assert.match(r.jsonBody.error, /couldn't find that board/);
});

test('api: Pinterest being down gives a friendly 502, not a crash', async () => {
  global.fetch = makeFetch({ down: true });
  const r = await handler()(req(BOARD));
  assert.equal(r.status, 502);
  assert.ok(r.jsonBody.error.length > 10);
});

test('api: repeats within 15 minutes come from memory', async () => {
  global.fetch = makeFetch();
  let t = 1_000_000;
  const h = handler({ now: () => t });
  await h(req(BOARD));
  const before = calls.length;
  const again = await h(req('https://se.pinterest.com/example-artist/head-studies'));   // same board, other spelling
  assert.equal(again.status, 200);
  assert.equal(calls.length, before, 'no new Pinterest calls');
  t += 16 * 60 * 1000;
  await h(req(BOARD));
  assert.ok(calls.length > before, 'fetched again after 15 minutes');
});

test('api: one visitor can add 30 boards per 10 minutes', async () => {
  global.fetch = makeFetch();
  let t = 5_000_000;
  const h = handler({ now: () => t });
  for (let i = 0; i < 30; i++) {
    t += 16 * 60 * 1000 / 60;   // keep the cache from answering: different boards each time
    const r = await h(req(`https://www.pinterest.com/example-artist/board-${i}/`));
    assert.equal(r.status, 200, 'request ' + (i + 1));
  }
  const r = await h(req('https://www.pinterest.com/example-artist/board-30/'));
  assert.equal(r.status, 429);
  assert.equal(r.headers['Retry-After'], '300');
  const other = await h(req('https://www.pinterest.com/example-artist/board-31/', { ip: '198.51.100.9' }));
  assert.equal(other.status, 200, 'another visitor is not affected');
  t += 11 * 60 * 1000;
  assert.equal((await h(req('https://www.pinterest.com/example-artist/board-32/'))).status, 200, 'allowed again later');
});

test('api: the Azure Functions entry point registers GET /api/board', { skip: !hasFunctionsPackage() }, () => {
  const { app } = require(path.join(__dirname, '../api/node_modules/@azure/functions'));
  const seen = [];
  const orig = app.http;
  app.http = (name, opts) => seen.push({ name, opts });
  try {
    delete require.cache[require.resolve('../api/src/functions/board.js')];
    require('../api/src/functions/board.js');
  } finally { app.http = orig; }
  assert.equal(seen.length, 1);
  assert.equal(seen[0].opts.route, 'board');
  assert.deepEqual(seen[0].opts.methods, ['GET']);
  assert.equal(seen[0].opts.authLevel, 'anonymous');
});

function hasFunctionsPackage() {
  try { require.resolve(path.join(__dirname, '../api/node_modules/@azure/functions')); return true; } catch { return false; }
}
