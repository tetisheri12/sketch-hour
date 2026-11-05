'use strict';

/** An error whose message is safe to show to the user. */
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** fetch with a timeout, so a slow Pinterest can't hang the sync. */
async function fetchT(url, opts = {}, ms = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ac.signal }));
  } catch (e) {
    if (e && e.name === 'AbortError') throw httpError(504, 'Pinterest took too long to answer. Try again.');
    throw httpError(502, "Couldn't reach Pinterest. Try again in a moment.");
  } finally {
    clearTimeout(t);
  }
}

/** Pick the largest image from a Pinterest `images` map ({"474x": {url,width,height}, "orig": {...}}). */
function bestImage(images) {
  if (!images || typeof images !== 'object') return null;
  if (images.orig && images.orig.url) return images.orig;
  if (images.originals && images.originals.url) return images.originals;
  let best = null;
  for (const v of Object.values(images)) {
    if (v && typeof v.url === 'string' && (!best || (v.width || 0) > (best.width || 0))) best = v;
  }
  return best;
}

function cleanText(s, max = 140) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

module.exports = { httpError, UA, fetchT, bestImage, cleanText };
