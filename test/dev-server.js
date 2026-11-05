'use strict';
/*
 * Local preview that serves the site the way GitHub Pages does:
 * folders → index.html, /about → /about/, anything missing → 404.html (status 404).
 *
 *   node test/dev-server.js                          → http://localhost:4280
 *
 * To see your Pinterest boards locally, first run:  node scripts/sync-boards.js
 * (it writes app/data/boards.json, which is not committed).
 *
 * Optional: ROOT=<folder> serves another folder, BASE=/sketch-hour serves it under a sub-path
 * like a project site (pair it with a copy prefixed by scripts/prefix-base.js).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..', 'app'));
const BASE = (process.env.BASE || '').replace(/\/+$/, '');
const PORT = Number(process.env.PORT) || 4280;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'
};

function serve(res, file, status) {
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const notFound = () => serve(res, path.join(ROOT, '404.html'), 404);
  let rel;
  try { rel = decodeURIComponent(u.pathname); } catch { return notFound(); }
  if (BASE) {
    if (rel === BASE) { res.writeHead(301, { Location: BASE + '/' }); return res.end(); }
    if (!rel.startsWith(BASE + '/')) return notFound();
    rel = rel.slice(BASE.length);
  }
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT)) return notFound();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!rel.endsWith('/')) { res.writeHead(301, { Location: BASE + rel + '/' + u.search }); return res.end(); }
    const index = path.join(file, 'index.html');
    return fs.existsSync(index) ? serve(res, index, 200) : notFound();
  }
  return fs.existsSync(file) ? serve(res, file, 200) : notFound();
}).listen(PORT, () => console.log(`Sketch Hour preview: http://localhost:${PORT}${BASE}/`));
