'use strict';
// Run: node --test test/sync.test.js   (no install needed; uses a fake Pinterest)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeFetch } = require('./fake-pinterest');
const { fetchPublicBoard } = require('../scripts/lib/pinterest-public');
const { syncBoards, readConfig } = require('../scripts/sync-boards');
const { prefix } = require('../scripts/prefix-base');

const BOARD = 'https://www.pinterest.com/example-artist/head-studies/';

test('board link: pages through the feed and skips anything that is not a pin', async () => {
  global.fetch = makeFetch();
  const d = await fetchPublicBoard('https://se.pinterest.com/example-artist/head-studies/');
  assert.equal(d.via, 'board');
  assert.equal(d.board.name, 'Head studies');
  assert.equal(d.pins.length, 7);
  assert.match(d.pins[0].image, /\/originals\//);
  assert.equal(d.pins[0].link, 'https://www.pinterest.com/pin/1000/');
});

test('board link: falls back to RSS when the JSON endpoints are blocked', async () => {
  global.fetch = makeFetch({ rssOnly: true });
  const d = await fetchPublicBoard('pinterest.com/example-artist/head-studies');
  assert.equal(d.via, 'rss');
  assert.equal(d.pins.length, 3);
  assert.match(d.pins[0].image, /\/736x\//);
});

test('board link: rejects links that are not boards, resolves pin.it short links', async () => {
  global.fetch = makeFetch();
  for (const bad of ['https://www.pinterest.com/pin/123/', 'https://example.com/a/b/', 'https://www.pinterest.com/example-artist/', '']) {
    await assert.rejects(fetchPublicBoard(bad), e => e.status === 400, bad);
  }
  const d = await fetchPublicBoard('https://pin.it/abc123');
  assert.equal(d.pins.length, 7);
});

test('sync: writes every board it can fetch, with a stable id', async () => {
  global.fetch = makeFetch();
  const r = await syncBoards([{ url: BOARD, name: 'My heads' }], null);
  assert.equal(r.boards.length, 1);
  const b = r.boards[0];
  assert.equal(b.id, 'pb-555');
  assert.equal(b.name, 'My heads');
  assert.equal(b.source, BOARD);
  assert.equal(b.pins.length, 7);
  assert.ok(b.syncedAt > 0);
});

test('sync: keeps the live copy of a board Pinterest will not return today', async () => {
  global.fetch = makeFetch();
  const live = await syncBoards([{ url: BOARD }], null);
  global.fetch = makeFetch({ down: true });
  const r = await syncBoards([{ url: BOARD }, { url: 'https://www.pinterest.com/example-artist/new-board/' }], live);
  assert.equal(r.boards.length, 1, 'kept the old board, could not add the new one');
  assert.equal(r.boards[0].syncedAt, live.boards[0].syncedAt);
});

test('sync: a deleted board is dropped when there is no earlier copy', async () => {
  global.fetch = makeFetch({ missing: ['gone'] });
  const r = await syncBoards([{ url: 'https://www.pinterest.com/example-artist/gone/' }, { url: BOARD }], null);
  assert.deepEqual(r.boards.map(b => b.id), ['pb-555']);
});

test('config: accepts plain links or objects, and explains mistakes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-'));
  const ok = path.join(dir, 'ok.json');
  fs.writeFileSync(ok, JSON.stringify({ boards: [BOARD, { url: BOARD, name: 'x' }] }));
  assert.equal(readConfig(ok).length, 2);
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ boards: [{ name: 'no link' }] }));
  assert.throws(() => readConfig(bad), /has no "url"/);
});

test('base path: prefixes root links for a project site, leaves the rest alone', () => {
  const html = '<a href="/">x</a><link href="/assets/s.css"><script src="/assets/app.js"></script><a href="https://x.y/">e</a><a href="#top">t</a><a href="mailto:a@b.c">m</a><img src="//cdn.x/i.png">';
  const out = prefix(html, '/sketch-hour');
  assert.match(out, /href="\/sketch-hour\/"/);
  assert.match(out, /href="\/sketch-hour\/assets\/s\.css"/);
  assert.match(out, /src="\/sketch-hour\/assets\/app\.js"/);
  assert.match(out, /href="https:\/\/x\.y\/"/);
  assert.match(out, /href="#top"/);
  assert.match(out, /src="\/\/cdn\.x\/i\.png"/);
  assert.equal(prefix(html, ''), html);
});
