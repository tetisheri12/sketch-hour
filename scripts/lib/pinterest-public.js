'use strict';
/*
 * Reads a PUBLIC Pinterest board from its link. Used by scripts/sync-boards.js in the deploy
 * workflow and by the board API (api/).
 *
 * This is not an official API. It reads the feed behind Pinterest's embeddable board widget
 * (the newest 50 pins) and falls back to the board's RSS feed (the newest 25 or so).
 * Pinterest's own web-app endpoints (BoardResource/BoardFeedResource), which this file used
 * before, answer 403 since autumn 2026, so they aren't called any more. Pinterest can change
 * the remaining feeds at any time; when it does, this file is the only thing to fix.
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

const NOT_FOUND = "Pinterest couldn't find that board. Check the link and make sure the board isn't secret.";

/**
 * Pinterest's embed widget feed: the board's name, pin count and newest pins (50 at most).
 * It is what Pinterest's own board widget for other websites loads.
 */
async function viaWidget(b, maxPins) {
  const r = await fetchT(`https://widgets.pinterest.com/v3/pidgets/boards/${encodeURIComponent(b.username)}/${encodeURIComponent(b.slug)}/pins/`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' }
  });
  if (r.status === 404) throw httpError(404, NOT_FOUND);
  if (!r.ok) throw httpError(502, `Pinterest answered with status ${r.status}.`);
  const j = await r.json().catch(() => null);
  const d = j && j.data;
  if (!d || !Array.isArray(d.pins)) throw httpError(502, 'Pinterest sent an answer this app does not understand.');
  const pins = [];
  const seen = new Set();
  for (const p of d.pins) {
    if (!p || !p.id || seen.has(String(p.id))) continue;
    const img = bestImage(p.images);
    if (!img || typeof img.url !== 'string' || !/^https:\/\/i\.pinimg\.com\//.test(img.url)) continue;
    seen.add(String(p.id));
    pins.push({
      id: String(p.id),
      image: img.url.replace(/\/\d+x\d*(?:_RS)?\//, '/736x/'),   // the widget's largest size is 564px wide
      w: img.width || 0,
      h: img.height || 0,
      title: cleanText(p.description || p.title || ''),
      link: `https://www.pinterest.com/pin/${encodeURIComponent(String(p.id))}/`
    });
  }
  const bd = d.board || {};
  const count = Number(bd.pin_count) || pins.length;
  const partial = count > pins.length;
  return {
    method: 'public',
    via: 'widget',
    board: { id: String(bd.id || ''), name: cleanText(bd.name || b.slug, 80), url: b.url, owner: b.username, count },
    pins: pins.slice(0, maxPins),
    partial,
    note: partial ? `Pinterest only shares the newest ${pins.length} pins of a board.` : ''
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
  if (r.status === 404) throw httpError(404, NOT_FOUND);
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
    note: 'Pinterest only shared the newest pins of this board.'
  };
}

/** Widget feed first; if it fails or comes back empty, the RSS feed. */
async function fetchPublicBoard(input, { maxPins = 1000 } = {}) {
  const b = await parseBoardUrl(input);
  let first;
  try {
    const res = await viaWidget(b, maxPins);
    if (res.pins.length || res.board.count === 0) return res;
    first = httpError(502, 'Pinterest returned the board without its pins.');
  } catch (e) {
    first = e;
  }
  let rss = null;
  try {
    rss = await viaRss(b);
  } catch (e) {
    if (e.status === 404) throw e;   // both feeds agree, or the widget failed for another reason: the board isn't there
  }
  if (rss && rss.pins.length) {
    rss.pins = rss.pins.slice(0, maxPins);
    return rss;
  }
  if (first && first.status === 404 && rss) return rss;   // an empty but existing board
  throw first;
}

module.exports = { fetchPublicBoard, parseBoardUrl, viaWidget, viaRss };
