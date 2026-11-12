'use strict';
/*
 * GET /api/board?url=<public Pinterest board link>
 * Answers with the board's name and pins, for the "Add a board" form in the app.
 *
 * The reading itself is scripts/lib/pinterest-public.js, the same code the daily sync uses.
 * This file adds what a public endpoint needs: only sketchhour.com may call it, a short cache
 * so the same board isn't fetched again and again, and a limit per visitor.
 */

const CACHE_MS = 15 * 60 * 1000;        // a board fetched in the last 15 minutes is answered from memory
const CACHE_MAX = 300;                  // boards kept in memory per instance
const WINDOW_MS = 10 * 60 * 1000;       // rate limit window
const PER_WINDOW = 30;                  // board requests per visitor per window
const MAX_PINS = 1000;

function makeHandler({ fetchPublicBoard, parseBoardUrl, allowedOrigins = [], now = () => Date.now() }) {
  const cache = new Map();   // board path -> { at, data }
  const hits = new Map();    // visitor -> { start, n }

  const allowed = new Set(allowedOrigins.map(o => o.trim().replace(/\/+$/, '').toLowerCase()).filter(Boolean));

  function visitor(headers) {
    const fwd = headers.get('x-forwarded-for') || '';
    const ip = fwd.split(',')[0].trim().replace(/:\d+$/, '');
    return ip || headers.get('x-client-ip') || 'unknown';
  }

  function limited(who) {
    const t = now();
    if (hits.size > 5000) for (const [k, v] of hits) if (t - v.start > WINDOW_MS) hits.delete(k);
    const h = hits.get(who);
    if (!h || t - h.start > WINDOW_MS) { hits.set(who, { start: t, n: 1 }); return false; }
    h.n += 1;
    return h.n > PER_WINDOW;
  }

  function remember(key, data) {
    cache.delete(key);
    cache.set(key, { at: now(), data });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }

  const reply = (status, body, extra = {}) => ({
    status,
    jsonBody: body,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, extra)
  });

  return async function handle(request, log = () => {}) {
    const origin = (request.headers.get('origin') || '').replace(/\/+$/, '').toLowerCase();
    if (allowed.size && !allowed.has(origin)) {
      return reply(403, { error: 'This service only answers Sketch Hour.' });
    }

    const link = (request.query.get('url') || '').trim();
    if (!link) return reply(400, { error: 'Paste a Pinterest board link.' });
    if (link.length > 400) return reply(400, { error: 'That link is too long to be a board link.' });

    let key;
    try {
      key = (await parseBoardUrl(link)).path.toLowerCase();
    } catch (e) {
      return reply(e.status || 400, { error: e.expose ? e.message : "That doesn't look like a Pinterest board link." });
    }

    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return reply(200, hit.data);

    if (limited(visitor(request.headers))) {
      return reply(429, { error: 'Too many boards in a short time. Wait a few minutes and try again.' }, { 'Retry-After': '300' });
    }

    try {
      const d = await fetchPublicBoard(link, { maxPins: MAX_PINS });
      const data = {
        board: { id: d.board.id || '', name: d.board.name, url: d.board.url, owner: d.board.owner, count: d.board.count },
        pins: d.pins,
        via: d.via,
        partial: !!d.partial,
        note: d.note || '',
        fetchedAt: now()
      };
      remember(key, data);
      return reply(200, data);
    } catch (e) {
      if (e && e.expose) return reply(e.status || 502, { error: e.message });
      log(`board fetch failed for ${key}: ${e && e.stack ? e.stack : e}`);
      return reply(502, { error: "Couldn't read that board from Pinterest right now. Try again in a moment." });
    }
  };
}

module.exports = { makeHandler, MAX_PINS };
