#!/usr/bin/env node
'use strict';
/*
 * Fetches the Pinterest boards listed in boards.json and writes app/data/boards.json,
 * which the site loads. The deploy workflow runs this before every deploy.
 *
 *   node scripts/sync-boards.js [--config boards.json] [--out app/data/boards.json] [--previous <url or file>]
 *
 * --previous points at the copy that is live now. If a board can't be fetched,
 * its last published copy is kept, so a bad day at Pinterest never empties the site.
 */
const fs = require('fs');
const path = require('path');
const { fetchPublicBoard, parseBoardUrl } = require('./lib/pinterest-public');

const MAX_PINS = 1000;
const inActions = !!process.env.GITHUB_ACTIONS;
const log = {
  info: m => console.log(m),
  warn: m => console.log(inActions ? `::warning::${m}` : `warning: ${m}`)
};

// From the board's address, so the id stays the same whichever Pinterest feed answered.
function boardKey(data, entryUrl) {
  let p = '';
  try { p = new URL(data.board.url || entryUrl).pathname; } catch { p = entryUrl; }
  return 'pb-' + p.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);
}

/** Reads boards.json. Accepts {"boards": ["url", {"url": "...", "name": "..."}]} */
function readConfig(file) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`Can't read ${file}: ${e.message}`); }
  const list = Array.isArray(raw) ? raw : raw.boards;
  if (!Array.isArray(list)) throw new Error(`${file} needs a "boards" list.`);
  return list.map((e, i) => {
    const entry = typeof e === 'string' ? { url: e } : Object.assign({}, e);
    if (!entry.url || typeof entry.url !== 'string') throw new Error(`Board ${i + 1} in ${file} has no "url".`);
    return entry;
  });
}

async function loadPrevious(src) {
  if (!src) return null;
  try {
    if (/^https?:\/\//.test(src)) {
      const r = await fetch(src, { headers: { 'Cache-Control': 'no-cache' } });
      if (!r.ok) return null;
      return await r.json();
    }
    return JSON.parse(fs.readFileSync(src, 'utf8'));
  } catch {
    return null;
  }
}

/** Fetches every board; on failure keeps the previous copy of that board when there is one. */
async function syncBoards(entries, previous) {
  const prevBoards = (previous && Array.isArray(previous.boards)) ? previous.boards : [];
  const out = [];
  const seen = new Set();
  for (const entry of entries) {
    const max = Math.min(Number(entry.maxPins) || MAX_PINS, MAX_PINS);
    try {
      await parseBoardUrl(entry.url);
      const data = await fetchPublicBoard(entry.url, { maxPins: max });
      const id = boardKey(data, entry.url);
      if (seen.has(id)) { log.warn(`"${entry.url}" is listed twice; skipped the second one.`); continue; }
      seen.add(id);
      const board = {
        id,
        source: entry.url,
        name: (entry.name || data.board.name || 'Pinterest board').slice(0, 80),
        url: data.board.url,
        owner: data.board.owner,
        count: data.board.count || data.pins.length,
        via: data.via,
        partial: !!data.partial,
        syncedAt: Date.now(),
        pins: data.pins
      };
      out.push(board);
      log.info(`Synced "${board.name}": ${board.pins.length} pins.`);
      if (data.partial) log.warn(`"${board.name}": Pinterest only shared the newest ${board.pins.length} of ${board.count} pins (${data.via} feed).`);
    } catch (e) {
      const prev = prevBoards.find(b => b.source === entry.url);
      if (prev && !seen.has(prev.id)) {
        seen.add(prev.id);
        out.push(prev);
        log.warn(`Couldn't sync ${entry.url} (${e.message}) Kept the copy from ${new Date(prev.syncedAt).toISOString().slice(0, 10)}.`);
      } else {
        log.warn(`Couldn't sync ${entry.url}: ${e.message}`);
      }
    }
  }
  return { updated: new Date().toISOString(), boards: out };
}

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

async function main() {
  const root = path.join(__dirname, '..');
  const config = arg('config', path.join(root, 'boards.json'));
  const outFile = arg('out', path.join(root, 'app', 'data', 'boards.json'));
  const entries = readConfig(config);
  const previous = await loadPrevious(arg('previous', ''));
  if (previous) log.info(`Loaded the live copy with ${(previous.boards || []).length} board(s).`);
  const result = await syncBoards(entries, previous);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result), 'utf8');
  const pins = result.boards.reduce((n, b) => n + b.pins.length, 0);
  log.info(`Wrote ${outFile}: ${result.boards.length} of ${entries.length} board(s), ${pins} pins.`);
}

if (require.main === module) {
  main().catch(e => { console.error(e.message || e); process.exit(1); });
}

module.exports = { syncBoards, readConfig, loadPrevious, boardKey };
