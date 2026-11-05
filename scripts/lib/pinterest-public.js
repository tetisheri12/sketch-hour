'use strict';
/*
 * Reads a PUBLIC Pinterest board from its link. Used by scripts/sync-boards.js in the deploy workflow.
 *
 * This is not an official API. It uses the JSON endpoints Pinterest's own web
 * app calls (BoardResource / BoardFeedResource), and falls back to the board's
 * RSS feed, which only lists the most recent pins. Pinterest can change either
 * at any time; when it does, this file is the only thing to fix.
 */
const { httpError, UA, fetchT, bestImage, cleanText } = require('./util');

const NOT_BOARD = new Set(['pin', 'search', 'ideas', 'today', 'settings', 'business', 'login', 'resource']);
const SUBPAGES = new Set(['_saved', '_created', 'pins', 'more_ideas', '_tools', 'organize']);

/** Turn whatever the user pasted into {username, slug, url}. Resolves pin.it short links. */
async function parseBoardUrl(input) {
  let s = String(input || '').trim();
  if (!s) throw httpError(400, 'Paste a Pinterest board link.');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { throw httpError(400, "That doesn't look like a link."); }

  if (/^(www\.)?pin\.it$/i.test(u.hostname)) {
    const r = await fetchT(u.href, { redirect: 'follow', headers: { 'User-Agent': UA } });
    try { u = new URL(r.url); } catch { throw httpError(400, "Couldn't open that short link."); }
  }
  if (!/(^|\.)pinterest\.[a-z.]{2,8}$/i.test(u.hostname)) {
    throw httpError(400, 'Use a Pinterest board link, like pinterest.com/username/board-name/.');
  }
  const parts = u.pathname.split('/').filter(Boolean).map(p => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  if (parts.length < 2 || NOT_BOARD.has(parts[0].toLowerCase()) || SUBPAGES.has(parts[1])) {
    throw httpError(400, 'That is not a board link. Open the board on Pinterest and copy its address: pinterest.com/username/board-name/.');
  }
  const [username, slug] = parts;
  if (!/^[^\s/?#]{1,100}$/u.test(username) || !/^[^\s/?#]{1,200}$/u.test(slug)) {
    throw httpError(400, 'That board link has an unexpected format.');
  }
  return {
    username,
    slug,
    path: `/${username}/${slug}/`,
    url: `https://www.pinterest.com/${encodeURIComponent(username)}/${encodeURIComponent(slug)}/`
  };
}

async function resource(name, sourceUrl, options) {
  const q = new URLSearchParams({
    source_url: sourceUrl,
    data: JSON.stringify({ options, context: {} }),
    _: String(Date.now())
  });
  const r = await fetchT(`https://www.pinterest.com/resource/${name}/get/?${q}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pinterest-AppState': 'active',
      'X-Pinterest-Source-Url': sourceUrl
    }
  });
  if (r.status === 404) throw httpError(404, "Pinterest couldn't find that board. Check the link and make sure the board isn't secret.");
  if (!r.ok) throw httpError(502, `Pinterest answered with status ${r.status}.`);
  const j = await r.json().catch(() => null);
  if (!j || !j.resource_response) throw httpError(502, 'Pinterest sent an answer this app does not understand.');
  return j.resource_response;
}

function normPin(p) {
  if (!p || !p.id) return null;
  if (p.type && p.type !== 'pin') return null; // skips ads, "more ideas" modules, stories
  const img = bestImage(p.images) || (p.image_large_url ? { url: p.image_large_url } : null);
  if (!img || !img.url) return null;
  return {
    id: String(p.id),
    image: img.url,
    w: img.width || 0,
    h: img.height || 0,
    title: cleanText(p.grid_title || p.title || p.description || p.auto_alt_text || ''),
    link: `https://www.pinterest.com/pin/${p.id}/`
  };
}

/** Full board via Pinterest's web JSON, paging with bookmarks. */
async function viaJson(b, maxPins) {
  const br = await resource('BoardResource', b.path, { username: b.username, slug: b.slug, field_set_key: 'detailed' });
  const bd = br.data;
  if (!bd || !bd.id) throw httpError(404, "Pinterest couldn't find that board. Check the link and make sure the board isn't secret.");

  const pins = [];
  const seen = new Set();
  let bookmark = null;
  for (let page = 0; page < 60 && pins.length < maxPins; page++) {
    const options = {
      board_id: String(bd.id),
      board_url: b.path,
      field_set_key: 'react_grid_pin',
      filter_section_pins: false,
      layout: 'default',
      page_size: 50,
      redux_normalize_feed: true
    };
    if (bookmark) options.bookmarks = [bookmark];
    const fr = await resource('BoardFeedResource', b.path, options);
    const items = Array.isArray(fr.data) ? fr.data : [];
    for (const raw of items) {
      const p = normPin(raw);
      if (p && !seen.has(p.id)) { seen.add(p.id); pins.push(p); }
    }
    bookmark = fr.bookmark;
    if (!bookmark || bookmark === '-end-' || items.length === 0) break;
  }
  return {
    method: 'public',
    via: 'board',
    board: { id: String(bd.id), name: cleanText(bd.name || b.slug, 80), url: b.url, owner: b.username, count: Number(bd.pin_count) || pins.length },
    pins: pins.slice(0, maxPins),
    partial: pins.length >= maxPins
  };
}

function xmlTag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return '';
  return m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
}
function decodeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Fallback: the board's RSS feed (recent pins only). */
async function viaRss(b) {
  const r = await fetchT(`https://www.pinterest.com/${encodeURIComponent(b.username)}/${encodeURIComponent(b.slug)}.rss`, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' }
  });
  if (r.status === 404) throw httpError(404, "Pinterest couldn't find that board. Check the link and make sure the board isn't secret.");
  if (!r.ok) throw httpError(502, `Pinterest answered with status ${r.status}.`);
  const xml = await r.text();
  const channel = xml.split('<item')[0];
  const name = cleanText(decodeXml(xmlTag(channel, 'title')) || b.slug, 80);
  const pins = [];
  const seen = new Set();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const link = decodeXml(xmlTag(it, 'link')).trim();
    const desc = decodeXml(xmlTag(it, 'description'));
    const src = (desc.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1];
    if (!src || !/^https:\/\/i\.pinimg\.com\//.test(src)) continue;
    const id = (link.match(/\/pin\/(\d+)/) || [])[1] || src;
    if (seen.has(id)) continue;
    seen.add(id);
    pins.push({
      id: String(id),
      image: src.replace(/\/\d+x\d*(?:_RS)?\//, '/736x/'),
      w: 0,
      h: 0,
      title: cleanText(decodeXml(xmlTag(it, 'title'))),
      link: link || `https://www.pinterest.com/pin/${id}/`
    });
  }
  return {
    method: 'public',
    via: 'rss',
    board: { id: '', name, url: b.url, owner: b.username, count: pins.length },
    pins,
    partial: true,
    note: 'Pinterest only shared the most recent pins of this board.'
  };
}

async function fetchPublicBoard(input, { maxPins = 1000 } = {}) {
  const b = await parseBoardUrl(input);
  try {
    const res = await viaJson(b, maxPins);
    if (res.pins.length || res.board.count === 0) return res;
    throw httpError(502, 'Pinterest returned the board without its pins.');
  } catch (e) {
    if (e.status === 404 || e.status === 400) throw e;
    let rss = null;
    try { rss = await viaRss(b); } catch { rss = null; }
    if (rss && rss.pins.length) return rss;
    throw e;
  }
}

module.exports = { fetchPublicBoard, parseBoardUrl, normPin, viaRss };
