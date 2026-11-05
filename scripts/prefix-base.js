#!/usr/bin/env node
'use strict';
/*
 * GitHub Pages serves a project site under /<repository>/, not at the domain root.
 * The pages link with root paths (href="/assets/...", href="/handbook/"), so before
 * deploying, the workflow prefixes them with the site's base path.
 *
 *   node scripts/prefix-base.js app /sketch-hour
 *
 * An empty base path (a custom domain, or a <user>.github.io repository) changes nothing.
 */
const fs = require('fs');
const path = require('path');

function prefix(html, base) {
  if (!base) return html;
  return html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${base}/`);
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (p.endsWith('.html')) files.push(p);
  }
  return files;
}

function main() {
  const dir = process.argv[2] || 'app';
  const base = (process.argv[3] || '').replace(/\/+$/, '');
  if (base && !/^\/[A-Za-z0-9._~\-/]*$/.test(base)) throw new Error(`Unexpected base path: ${base}`);
  const files = walk(dir);
  for (const f of files) fs.writeFileSync(f, prefix(fs.readFileSync(f, 'utf8'), base), 'utf8');
  console.log(base ? `Prefixed links in ${files.length} pages with ${base}` : 'Site is served from the domain root; links left as they are.');
}

if (require.main === module) main();

module.exports = { prefix };
