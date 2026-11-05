// node run.js <jobs-module> <outdir>  — renders every job to <outdir>/<name>.webp
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
(async () => {
  const jobs = require(path.resolve(process.argv[2]));
  const out = path.resolve(process.argv[3]);
  const only = process.argv[4] ? new RegExp(process.argv[4]) : null;
  fs.mkdirSync(out, { recursive: true });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage();
  page.on('pageerror', e => console.error('PAGE', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(`http://localhost:${port}/render.html`);
  await page.waitForFunction(() => window.sceneReady === true);
  let n = 0;
  for (const job of jobs) {
    if (only && !only.test(job.name)) continue;
    const url = await page.evaluate(j => window.renderJob(j), job);
    fs.mkdirSync(path.dirname(path.join(out, job.name)), { recursive: true });
    fs.writeFileSync(path.join(out, job.name + '.webp'), Buffer.from(url.split(',')[1], 'base64'));
    n++;
  }
  console.log('rendered', n);
  await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
