'use strict';
/*
 * A stand-in for Pinterest, used by the tests. It answers the same URLs the API
 * calls, with the response shapes this app expects. Passing these tests proves the
 * app's own logic, not that real Pinterest still answers this way.
 */
const zlib = require('zlib');

/** Tiny solid-colour PNG, so the image relay has real bytes to pass through. */
function png(r, g, b, w = 60, h = 80) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  }
  const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = buf => { let c = 0xffffffff; for (const v of buf) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const COLORS = [[200, 90, 80], [90, 150, 210], [120, 180, 110], [220, 180, 90], [150, 110, 200]];
const PINS = Array.from({ length: 7 }, (_, i) => ({
  id: String(1000 + i),
  type: 'pin',
  grid_title: `Head study ${i + 1}`,
  images: {
    '236x': { url: `https://i.pinimg.com/236x/aa/bb/cc/head${i}.png`, width: 236, height: 314 },
    orig: { url: `https://i.pinimg.com/originals/aa/bb/cc/head${i}.png`, width: 600, height: 800 }
  }
}));

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

const calls = [];
/** Replacement for global fetch. Options: rssOnly (the widget feed fails), missing (true, or a list of board slugs that 404), down (Pinterest unreachable). */
function makeFetch(opts = {}) {
  return async function fakeFetch(url, init = {}) {
    const u = new URL(String(url));
    calls.push(u.pathname);
    if (u.hostname === 'i.pinimg.com') {
      const m = u.pathname.match(/head(\d+)\.png$/);
      if (!m) return new Response('nope', { status: 404 });
      const c = COLORS[Number(m[1]) % COLORS.length];
      return new Response(png(c[0], c[1], c[2]), { status: 200, headers: { 'content-type': 'image/png' } });
    }
    if (u.hostname === 'pin.it') {
      const r = new Response('', { status: 200 });
      Object.defineProperty(r, 'url', { value: 'https://se.pinterest.com/example-artist/head-studies/' });
      return r;
    }
    const isMissing = slug => opts.missing === true || (Array.isArray(opts.missing) && opts.missing.includes(slug));
    if ((u.hostname === 'www.pinterest.com' || u.hostname === 'widgets.pinterest.com') && opts.down) throw new TypeError('fetch failed');
    if (u.hostname === 'widgets.pinterest.com' && u.pathname.startsWith('/v3/pidgets/boards/')) {
      if (opts.rssOnly) return new Response('blocked', { status: 403 });
      const slug = u.pathname.split('/')[5];
      if (isMissing(slug)) return json({ status: 'failure', message: 'not found', data: null }, 404);
      // like the real feed: 564px and 237px sizes, a board pin count larger than what it returns, and the odd broken entry
      const pins = PINS.map(p => ({
        id: p.id, description: p.grid_title,
        images: { '237x': { url: p.images['236x'].url.replace('/236x/', '/237x/'), width: 237, height: 316 }, '564x': { url: p.images['236x'].url.replace('/236x/', '/564x/'), width: 564, height: 752 } }
      }));
      pins.push({ id: PINS[0].id, images: pins[0].images }, { id: '9999', images: {} });
      return json({ status: 'success', data: { board: { id: '555', name: 'Head studies', pin_count: PINS.length + 3 }, pins } });
    }
    if (u.hostname === 'www.pinterest.com' && u.pathname.endsWith('.rss')) {
      if (isMissing(u.pathname.split('/')[2].replace(/\.rss$/, ''))) return new Response('not found', { status: 404 });
      const items = PINS.slice(0, 3).map(p => `<item><title>${p.grid_title}</title><link>https://www.pinterest.com/pin/${p.id}/</link><description><![CDATA[<a href="/pin/${p.id}/"><img src="${p.images['236x'].url}"></a>]]></description></item>`).join('');
      return new Response(`<?xml version="1.0"?><rss><channel><title>Head studies</title>${items}</channel></rss>`, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
    }
    return new Response('unexpected host in test: ' + u.hostname, { status: 599 });
  };
}

module.exports = { makeFetch, calls, PINS, png };
