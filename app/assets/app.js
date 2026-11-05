(() => {
'use strict';

/* ============ helpers ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k of Object.keys(props)) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function icon(name) {
  const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('class', 'i'); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVGNS, 'use'); u.setAttribute('href', '#i-' + name); s.appendChild(u); return s;
}
function setIcon(btn, name) { const u = btn.querySelector('use'); if (u) u.setAttribute('href', '#i-' + name); }
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const pad = n => String(n).padStart(2, '0');
function clock(sec) {
  sec = Math.max(0, Math.ceil(sec - 1e-6));
  const hh = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return hh ? `${hh}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function dlabel(s) { s = Math.round(s); if (s < 60) return s + 's'; if (s % 60 === 0) return (s / 60) + 'm'; return Math.floor(s / 60) + 'm ' + (s % 60) + 's'; }
function minsTxt(sec) { const m = sec / 60; return m < 10 ? String(Math.round(m * 10) / 10) : String(Math.round(m)); }
function fmtBytes(b) {
  if (!b) return '0 MB';
  if (b < 1048576) return Math.max(1, Math.round(b / 1024)) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
  return (b / 1073741824).toFixed(1) + ' GB';
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const wait = ms => new Promise(r => setTimeout(r, ms));
function once(el, ok) {
  return new Promise(res => {
    const done = () => { el.removeEventListener(ok, done); el.removeEventListener('error', done); res(); };
    el.addEventListener(ok, done); el.addEventListener('error', done);
  });
}
function safeLink(u) {
  try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : ''; } catch { return ''; }
}
function isTyping(t) {
  const tag = (t && t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable);
}

let toastT = 0;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3600);
}
function ask(msg, okLabel) {
  return new Promise(res => {
    const m = $('#modal'), ok = $('#modalOk'), cancel = $('#modalCancel');
    $('#modalMsg').textContent = msg; ok.textContent = okLabel || 'Delete';
    m.hidden = false; ok.focus();
    const done = v => { m.hidden = true; ok.onclick = cancel.onclick = m.onkeydown = null; res(v); };
    ok.onclick = () => done(true); cancel.onclick = () => done(false);
    m.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
  });
}

/* ============ sound + wake lock ============ */
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
function tone(freq, start, dur, vol, type) {
  const a = AC; if (!a) return;
  try {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + start;
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch {}
}
const sfx = {
  tick() { tone(1320, 0, 0.06, 0.07, 'triangle'); },
  change() { tone(880, 0, 0.18, 0.16); tone(1318.5, 0.14, 0.34, 0.16); },
  done() { tone(784, 0, 0.22, 0.16); tone(988, 0.18, 0.22, 0.16); tone(1318.5, 0.36, 0.55, 0.16); }
};
let wake = null;
async function keepAwake(on) {
  try {
    if (on) {
      if (!wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
    } else if (wake) { await wake.release(); wake = null; }
  } catch { wake = null; }
}

/* ============ state ============ */
const SYS = [
  { id: 'poses', name: 'Poses', sys: true, hint: 'Gesture and figure references, Pinterest pins.' },
  { id: 'film', name: 'Film scenes', sys: true, hint: 'FilmGrab stills and your own frame grabs.' },
  { id: 'places', name: 'Places', sys: true, hint: 'Street View screenshots for perspective studies.' }
];
const S = {
  mode: 'connecting',
  boards: [],
  refs: new Map(),
  pending: new Map(),
  meta: { log: [], pins: [], learn: { done: {}, secs: {} } },
  samples: { poses: [], film: [], places: [] },
  samplesReady: false,
  published: [],
  view: 'practice',
  libBoard: LS.get('sketchhour.lib', 'poses')
};
const localUrl = new Map();
let readyResolve; const ready = new Promise(r => { readyResolve = r; });

function boards() { return SYS.concat(S.published, S.boards.filter(b => !b.pinterest).sort((a, b) => (a.created || 0) - (b.created || 0))); }
function boardName(id) { const b = boards().find(x => x.id === id); return b ? b.name : 'Poses'; }
function realRefs(board) {
  const pb = pinBoardOf(board);
  if (pb) return pinRefs(pb);
  const out = [];
  for (const r of S.refs.values()) if (r.board === board) out.push(r);
  for (const r of S.pending.values()) if (r.board === board && !S.refs.has(r.id)) out.push(r);
  return out.sort((a, b) => (b.created || 0) - (a.created || 0));
}
function savedCount(board) {
  const pb = pinBoardOf(board);
  if (pb) return (pb.pins || []).length;
  let n = 0; for (const r of S.refs.values()) if (r.board === board) n++; return n;
}
function poolFor(board) { const real = realRefs(board).filter(r => !r.pending); return real.length ? real : (S.samples[board] || []); }
function srcOf(r) { return r.url || localUrl.get(r.id) || (r.asset ? '/_blob/' + r.asset : ''); }
function setStatus(kind, text) { const s = $('#status'); s.dataset.kind = kind; $('#statusText').textContent = text; }

/* ============ storage: browser (IndexedDB) ============ */
const IDB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open('sketch-hour', 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('refs')) d.createObjectStore('refs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('boards')) d.createObjectStore('boards', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    });
  },
  run(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  all(s) { return this.run(s, 'readonly', st => st.getAll()); },
  get(s, k) { return this.run(s, 'readonly', st => st.get(k)); },
  put(s, v) { return this.run(s, 'readwrite', st => st.put(v)); },
  del(s, k) { return this.run(s, 'readwrite', st => st.delete(k)); }
};
const Local = {
  async start() {
    try {
      await IDB.open();
      const refs = await IDB.all('refs');
      for (const r of refs) {
        const rest = Object.assign({}, r); delete rest.blob;
        if (r.blob) localUrl.set(r.id, URL.createObjectURL(r.blob));
        S.refs.set(r.id, rest);
      }
      S.boards = await IDB.all('boards');
      const m = await IDB.get('meta', 'state');
      if (m) S.meta = { log: m.log || [], pins: m.pins || [], learn: Object.assign({ done: {}, secs: {} }, m.learn || {}) };
      S.mode = 'local'; setStatus('ok', 'Saved in this browser');
    } catch {
      S.mode = 'memory'; setStatus('warn', 'Not saved · storage blocked here');
    }
    renderAll(); renderLog();
  },
  async addRef(id, rec, blob) {
    if (S.mode === 'local') await IDB.put('refs', Object.assign({ id, blob }, rec));
    if (!localUrl.has(id)) localUrl.set(id, URL.createObjectURL(blob));
    S.refs.set(id, Object.assign({ id }, rec)); S.pending.delete(id);
  },
  async updateRef(id, patch) {
    const r = S.refs.get(id); if (!r) return;
    Object.assign(r, patch);
    if (S.mode === 'local') { const full = await IDB.get('refs', id); if (full) await IDB.put('refs', Object.assign(full, patch)); }
  },
  async deleteRef(r) {
    S.refs.delete(r.id);
    if (S.mode === 'local') await IDB.del('refs', r.id);
    const u = localUrl.get(r.id); if (u) { URL.revokeObjectURL(u); localUrl.delete(r.id); }
  },
  async putBoard(b) {
    const i = S.boards.findIndex(x => x.id === b.id);
    if (i >= 0) S.boards[i] = b; else S.boards.push(b);
    if (S.mode === 'local') await IDB.put('boards', b);
  },
  async delBoard(id) { S.boards = S.boards.filter(b => b.id !== id); if (S.mode === 'local') await IDB.del('boards', id); },
  async saveMeta() { if (S.mode === 'local') await IDB.put('meta', { k: 'state', log: S.meta.log.slice(-400), pins: S.meta.pins, learn: S.meta.learn }); }
};

const Store = () => Local;
let metaChain = Promise.resolve();
function persistMeta() { metaChain = metaChain.then(() => Store().saveMeta()).catch(e => toast(errText(e))); }
function scheduleUsage() {}

/* ============ Pinterest boards published with the site ============ */
/* The deploy workflow syncs the boards in boards.json into data/boards.json. They're read-only here. */
const BASE = (() => {
  try {
    const src = document.currentScript && document.currentScript.src;
    if (src) return src.replace(/assets\/app\.js(?:[?#].*)?$/, '');
  } catch {}
  return new URL('../', location.href).href;
})();
function isPinBoard(b) { return !!(b && b.pinterest); }
function pinBoardOf(id) { return S.published.find(b => b.id === id) || null; }
const pinRefCache = new Map();
function pinRefs(b) {
  const c = pinRefCache.get(b.id);
  if (c && c.at === b.pinterest.syncedAt) return c.refs;
  const refs = (b.pins || []).map((p, i) => ({
    id: 'pin-' + b.id + '-' + p.id, board: b.id, kind: /\.gif(\?|$)/i.test(p.image) ? 'gif' : 'image',
    url: p.image, remote: true, w: p.w || 0, h: p.h || 0, note: p.title || '', link: p.link || '', created: -i
  }));
  pinRefCache.set(b.id, { at: b.pinterest.syncedAt, refs });
  return refs;
}
function setImg(el, r) { el.src = srcOf(r); }
async function loadPublished() {
  try {
    const r = await fetch(BASE + 'data/boards.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const j = await r.json();
    S.published = (Array.isArray(j.boards) ? j.boards : [])
      .filter(b => b && typeof b.id === 'string' && Array.isArray(b.pins))
      .map(b => ({
        id: b.id, name: String(b.name || 'Pinterest board').slice(0, 80),
        pinterest: { url: safeLink(b.url || ''), via: b.via || '', count: b.count || b.pins.length, partial: !!b.partial, syncedAt: Number(b.syncedAt) || 0 },
        pins: b.pins.filter(p => p && typeof p.image === 'string' && /^https:\/\//.test(p.image)).map(p => ({
          id: String(p.id), image: p.image, w: Number(p.w) || 0, h: Number(p.h) || 0,
          title: String(p.title || '').slice(0, 140), link: safeLink(p.link || '')
        }))
      }));
  } catch { /* no published boards; everything else still works */ }
}
function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function renderPublished() {
  const list = S.published;
  $('#pubList').replaceChildren(...list.map(b => h('li', null,
    h('span', { class: 'nm' }, b.name),
    h('span', { class: 'meta' }, `${b.pins.length} pins${b.pinterest.syncedAt ? ' · updated ' + ago(b.pinterest.syncedAt) : ''}${b.pinterest.via === 'rss' ? ' · recent pins only' : ''}`),
    h('span', { class: 'acts' },
      h('button', { type: 'button', class: 'btn sm', onclick: () => { S.libBoard = b.id; LS.set('sketchhour.lib', b.id); location.hash = '#library'; renderAll(); } }, 'View'),
      b.pinterest.url ? h('a', { class: 'xbtn', href: b.pinterest.url, target: '_blank', rel: 'noopener', 'aria-label': `Open ${b.name} on Pinterest` }, icon('ext')) : null))));
  $('#pubEmpty').hidden = list.length > 0;
}
function errText(e) {
  const c = e && e.code;
  const map = {
    too_large: 'That file is over 20 MB. Trim the clip or export a smaller image.',
    unsupported_type: "That file type can't be stored. Use JPG, PNG, WebP, GIF, MP4 or WebM.",
    quota_or_state: 'Library storage is full. Delete some references to make room.',
    quota_exceeded: 'Library storage is full. Delete some references to make room.',
    rate_limited: 'Too many uploads at once. Wait a moment, then add the rest.',
    resource_exhausted: 'Too many changes at once. Wait a moment and try again.',
    decode: "This image couldn't be read. Save it as JPG or PNG and try again."
  };
  return map[c] || "Couldn't save that. Check your connection and try again.";
}

/* ============ adding references ============ */
function loadImg(src, cors) { return new Promise((res, rej) => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function mediaDims(file) {
  const u = URL.createObjectURL(file);
  if (/^video\//.test(file.type)) {
    return new Promise(res => {
      const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = () => { res({ w: v.videoWidth, h: v.videoHeight }); URL.revokeObjectURL(u); };
      v.onerror = () => { res({ w: 0, h: 0 }); URL.revokeObjectURL(u); };
      v.src = u;
    });
  }
  return loadImg(u).then(i => { URL.revokeObjectURL(u); return { w: i.naturalWidth, h: i.naturalHeight }; }).catch(() => ({ w: 0, h: 0 }));
}
async function prepareMedia(file) {
  const MB = 1048576;
  if (file.type === 'image/gif' || /^video\//.test(file.type)) {
    if (file.size > 20 * MB) throw { code: 'too_large' };
    const d = await mediaDims(file);
    return { blob: file, type: file.type, w: d.w, h: d.h };
  }
  let src;
  try { src = await createImageBitmap(file); }
  catch { try { src = await loadImg(URL.createObjectURL(file)); } catch { throw { code: 'decode' }; } }
  const w = src.width || src.naturalWidth, hh = src.height || src.naturalHeight;
  const long = Math.max(w, hh), max = 2400;
  const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (long <= max && file.size <= 3 * MB && okType) return { blob: file, type: file.type, w, h: hh };
  const k = Math.min(1, max / long), cw = Math.round(w * k), ch = Math.round(hh * k);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, cw, ch); x.drawImage(src, 0, 0, cw, ch);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  if (!blob) throw { code: 'decode' };
  return { blob, type: 'image/jpeg', w: cw, h: ch };
}
const kindOf = t => (t === 'image/gif' ? 'gif' : /^video\//.test(t) ? 'video' : 'image');
let addQ = Promise.resolve();
function addFiles(files, o) {
  o = o || {};
  const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || /^video\/(mp4|webm)$/.test(f.type));
  if (!list.length) { toast('Add images, GIFs, or MP4/WebM clips.'); return 0; }
  let board = o.board || S.libBoard;
  if (pinBoardOf(board)) { board = 'poses'; toast('Synced Pinterest boards only hold pins, so this went to Poses.'); }
  list.forEach((f, n) => {
    const id = 'r' + uid();
    const rec = { board, kind: kindOf(f.type), source: o.source || 'upload', link: safeLink(o.link || ''), note: (o.note || '').slice(0, 140), created: Date.now() + n };
    localUrl.set(id, URL.createObjectURL(f));
    S.pending.set(id, Object.assign({ id, pending: true }, rec));
    addQ = addQ.then(() => persistOne(id, rec, f));
  });
  renderAll();
  toast(list.length === 1 ? `Adding to ${boardName(board)}…` : `Adding ${list.length} references to ${boardName(board)}…`);
  return list.length;
}
async function persistOne(id, rec, file) {
  try {
    await ready;
    const p = await prepareMedia(file);
    rec.w = p.w || 0; rec.h = p.h || 0; rec.type = p.type;
    await Store().addRef(id, rec, p.blob, p.type);
  } catch (e) {
    S.pending.delete(id);
    const u = localUrl.get(id); if (u) URL.revokeObjectURL(u); localUrl.delete(id);
    toast(errText(e));
  }
  renderAll(); scheduleUsage();
}
function handlePaste(cd, o) {
  if (!cd) return;
  const files = [];
  for (const it of Array.from(cd.items || [])) if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); }
  if (!files.length && cd.files && cd.files.length) files.push(...Array.from(cd.files));
  let link = o.link || '';
  const html = cd.getData ? cd.getData('text/html') : '';
  if (!link && html) { const m = html.match(/<img[^>]+src=["']([^"']+)["']/i); if (m && /^https:\/\//.test(m[1])) link = m[1]; }
  if (files.length) { addFiles(files, Object.assign({}, o, { link })); if (o.after) o.after(); return; }
  const text = ((cd.getData && cd.getData('text/plain')) || '').trim();
  if (/^https?:\/\//.test(text)) {
    if (o.onUrl && o.onUrl(text)) return;
    toast("This page can't download images from other sites. Copy the image itself (right-click → Copy image) and paste again.");
    return;
  }
  toast('Nothing to add. Copy an image or take a screenshot first, then paste.');
}

/* ============ practice setup ============ */
const DURS = [30, 45, 60, 120, 180, 300, 600];
const COUNTS = [5, 10, 20, 30, 0];
const CLASSES = {
  w15: { name: 'Warm-up', plan: [[10, 30], [5, 60], [1, 300]] },
  c30: { name: 'Short class', plan: [[10, 30], [5, 60], [2, 120], [1, 300], ['break', 60], [1, 600]] },
  c60: { name: 'Full class', plan: [[10, 30], [5, 60], [5, 120], [2, 300], ['break', 300], [1, 600], [1, 900]] }
};
const CFG = Object.assign({ boards: ['poses'], mode: 'fixed', dur: 60, count: 10, cls: 'c30', shuffle: true, gray: false, flips: false, grid: false, sound: true }, LS.get('sketchhour.cfg', {}));
if (!CLASSES[CFG.cls]) CFG.cls = 'c30';
function saveCfg() { LS.set('sketchhour.cfg', CFG); }
function expandClass(cls) {
  const out = [];
  for (const [n, d] of CLASSES[cls].plan) {
    if (n === 'break') out.push({ t: 'break', dur: d });
    else for (let i = 0; i < n; i++) out.push({ t: 'pose', dur: d });
  }
  return out;
}
function recipe(cls) { return CLASSES[cls].plan.map(([n, d]) => (n === 'break' ? `break ${dlabel(d)}` : `${n}×${dlabel(d)}`)).join(' · '); }
const planSecs = plan => plan.reduce((a, e) => a + e.dur, 0);
function pool() {
  const seen = new Set(), out = [];
  for (const b of CFG.boards) for (const r of poolFor(b)) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  return out;
}
function buildPlan() {
  if (CFG.mode === 'class') return expandClass(CFG.cls);
  const n = CFG.count || Math.max(1, pool().length);
  return Array.from({ length: n }, () => ({ t: 'pose', dur: CFG.dur }));
}

function renderPractice() {
  const all = boards();
  if (S.loaded) {
    // only prune choices once saved boards have loaded, or a reload would drop synced boards
    CFG.boards = CFG.boards.filter(id => all.some(b => b.id === id));
    if (!CFG.boards.length) CFG.boards = ['poses'];
  }
  $('#srcChips').replaceChildren(...all.map(b => {
    const n = savedCount(b.id);
    const smp = !n ? (S.samples[b.id] || []).length : 0;
    const on = CFG.boards.includes(b.id);
    return h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(on),
      onclick: () => {
        if (on) { if (CFG.boards.length > 1) CFG.boards = CFG.boards.filter(x => x !== b.id); }
        else CFG.boards = CFG.boards.concat(b.id);
        saveCfg(); renderPractice();
      }
    }, b.name, h('span', { class: 'ct' }, n ? String(n) : smp ? `${smp} samples` : '0'));
  }));
  $$('#modeSeg button').forEach(bt => bt.setAttribute('aria-pressed', String(bt.dataset.mode === CFG.mode)));
  $('#fixedOpts').hidden = CFG.mode !== 'fixed';
  $('#classOpts').hidden = CFG.mode !== 'class';
  $('#durChips').replaceChildren(...DURS.map(d => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(CFG.dur === d),
    onclick: () => { CFG.dur = d; saveCfg(); renderPractice(); }
  }, dlabel(d))));
  const cust = $('#durCustom');
  if (document.activeElement !== cust) cust.value = DURS.includes(CFG.dur) ? '' : String(Math.round(CFG.dur / 60 * 100) / 100);
  $('#countChips').replaceChildren(...COUNTS.map(c => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(CFG.count === c),
    onclick: () => { CFG.count = c; saveCfg(); renderPractice(); }
  }, c ? String(c) : 'All')));
  $('#classPresets').replaceChildren(...Object.keys(CLASSES).map(k => h('button', {
    type: 'button', class: 'preset', 'aria-pressed': String(CFG.cls === k),
    onclick: () => { CFG.cls = k; saveCfg(); renderPractice(); }
  }, h('b', null, CLASSES[k].name + ' ', h('em', null, `${Math.round(planSecs(expandClass(k)) / 60)} min`)), h('small', null, recipe(k)))));

  const plan = buildPlan(), tot = planSecs(plan);
  let blocks = [];
  if (CFG.mode === 'class') {
    for (const e of plan) {
      const last = blocks[blocks.length - 1];
      if (last && last.t === e.t && last.dur === e.dur) last.n++; else blocks.push({ t: e.t, dur: e.dur, n: 1 });
    }
  } else if (plan.length <= 40) blocks = plan.map(e => ({ t: 'pose', dur: e.dur, n: 1, bare: true }));
  else blocks = [{ t: 'pose', dur: CFG.dur, n: plan.length }];
  $('#strip').replaceChildren(...blocks.map(b => {
    const lv = b.t === 'break' ? 'brk' : b.dur <= 45 ? 'l1' : b.dur <= 120 ? 'l2' : b.dur <= 300 ? 'l3' : 'l4';
    const label = b.bare ? '' : b.t === 'break' ? 'break' : b.n > 1 ? `${b.n}×${dlabel(b.dur)}` : dlabel(b.dur);
    return h('div', { class: 'blk ' + lv, style: `flex-grow:${b.n * b.dur}` }, label);
  }));
  const poses = plan.filter(e => e.t === 'pose').length;
  const avail = pool().length;
  const usingSamples = CFG.boards.every(id => !savedCount(id));
  $('#stripMeta').textContent = `${poses} poses · ${minsTxt(tot)} min total · ${avail} ${usingSamples ? 'sample ' : ''}reference${avail === 1 ? '' : 's'} in rotation`;
  $('#optShuffle').checked = CFG.shuffle; $('#optGray').checked = CFG.gray; $('#optFlips').checked = CFG.flips;
  $('#optGrid').checked = CFG.grid; $('#optSound').checked = CFG.sound;
  let hint = '';
  if (!avail) hint = S.samplesReady ? 'These boards are empty. Add references in Library or Sources.' : 'Preparing sample references…';
  else if (avail < poses) hint = `References repeat after ${avail}.`;
  else if (usingSamples) hint = 'Using sample mannequins until you add your own.';
  $('#startHint').textContent = hint;
  $('#startBtn').disabled = !avail;
}

/* ============ practice log ============ */
function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
function when(t) {
  const d = new Date(t), now = new Date();
  const hm = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Today ' + hm;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday ' + hm;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
function logEntry(e) {
  e.at = Date.now();
  if (e.track) { const L = S.meta.learn; L.secs[e.track] = (L.secs[e.track] || 0) + (e.secs || 0); }
  S.meta.log.push(e);
  if (S.meta.log.length > 400) S.meta.log = S.meta.log.slice(-400);
  persistMeta(); renderLog();
}
function renderLog() {
  const log = S.meta.log;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return d; });
  const mins = days.map(d => { const a = d.getTime(), b = a + 86400000; return log.filter(e => e.at >= a && e.at < b).reduce((s, e) => s + (e.secs || 0), 0) / 60; });
  const weekStart = days[0].getTime();
  $('#kWeek').textContent = String(Math.round(mins.reduce((a, b) => a + b, 0)));
  $('#kPoses').textContent = String(log.filter(e => e.at >= weekStart).reduce((s, e) => s + (e.poses || 0), 0));
  const set = new Set(log.map(e => dayKey(e.at)));
  let streak = 0; const d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  $('#kStreak').textContent = String(streak);
  const top = Math.max(30, Math.ceil(Math.max(...mins) / 15) * 15);
  $('#weekBars').replaceChildren(...days.map((dd, i) => {
    const m = mins[i];
    return h('div', { class: 'wk' + (i === 6 ? ' today' : ''), title: `${Math.round(m)} min` },
      h('span', { class: 'v' }, m >= 1 ? String(Math.round(m)) : ''),
      h('div', { class: 'col' }, h('div', { class: 'bar', style: `height:${m > 0 ? Math.max(2, m / top * 100) : 0}%` })),
      h('span', { class: 'd' }, dd.toLocaleDateString(undefined, { weekday: 'narrow' })));
  }));
  const rec = log.slice(-6).reverse();
  $('#recent').replaceChildren(...rec.map(e => h('li', null,
    h('span', { class: 'w' }, e.label || (e.kind === 'timer' ? 'Timer' : 'Session')),
    h('span', { class: 'd' }, e.kind === 'session' ? `${e.poses || 0} poses · ${minsTxt(e.secs || 0)} min drawn` : `${minsTxt(e.secs || 0)} min${e.rounds > 1 ? ` · ${e.rounds} rounds` : ''}`),
    h('time', null, when(e.at)))));
  $('#logEmpty').hidden = rec.length > 0;
}

/* ============ library ============ */
const cardCache = new Map();
function buildCard(r) {
  const b = h('button', { type: 'button', class: 'ref' });
  const src = srcOf(r);
  let m;
  if (r.kind === 'video') m = h('video', { muted: true, playsinline: true, preload: 'metadata', src: src + (/^(blob|data):/.test(src) ? '' : '#t=0.1') });
  else { m = h('img', { alt: r.note || 'Reference', loading: 'lazy', decoding: 'async' }); setImg(m, r); }
  if (r.w && r.h) m.style.aspectRatio = r.w + ' / ' + r.h;
  const badges = h('span', { class: 'badges' });
  if (r.kind === 'gif') badges.append(h('span', { class: 'badge' }, 'GIF'));
  if (r.kind === 'video') badges.append(h('span', { class: 'badge' }, 'Clip'));
  if (r.sample) badges.append(h('span', { class: 'badge' }, 'Sample'));
  b.append(m, badges, h('span', { class: 'cap' }));
  return b;
}
function refCard(r, list, idx) {
  let n = cardCache.get(r.id);
  if (!n) { n = buildCard(r); cardCache.set(r.id, n); }
  n.classList.toggle('pending', !!r.pending);
  const cap = n.querySelector('.cap'); cap.textContent = r.note || ''; cap.hidden = !r.note;
  n.setAttribute('aria-label', (r.note || 'Reference') + (r.pending ? ', saving' : ''));
  n.onclick = () => openViewer(list, idx);
  return n;
}
let boardFormMode = null;
function renderLibrary() {
  const all = boards();
  if (!all.some(b => b.id === S.libBoard) && S.loaded) S.libBoard = 'poses';
  const cur = all.find(b => b.id === S.libBoard) || all[0];
  const pinb = isPinBoard(cur);
  $('#boardTabs').replaceChildren(...all.map(b => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(b.id === S.libBoard),
    title: isPinBoard(b) ? 'Synced from Pinterest' : null,
    onclick: () => { S.libBoard = b.id; LS.set('sketchhour.lib', b.id); boardFormMode = null; $('#boardForm').hidden = true; renderLibrary(); }
  }, b.name, h('span', { class: 'ct' }, isPinBoard(b) ? `${realRefs(b.id).length} pins` : String(realRefs(b.id).length)))),
  h('button', { type: 'button', class: 'chip add', onclick: () => openBoardForm('new') }, icon('plus'), 'New board'));
  const tools = $('#boardTools');
  if (pinb) {
    const pi = cur.pinterest;
    tools.replaceChildren(
      h('span', null, `Synced from Pinterest · ${cur.pins.length} pins${pi.syncedAt ? ' · updated ' + ago(pi.syncedAt) : ''}`),
      pi.url ? h('a', { class: 'linkish', href: pi.url, target: '_blank', rel: 'noopener' }, 'Open on Pinterest ↗') : null);
  } else if (cur.sys) tools.replaceChildren(h('span', null, cur.hint));
  else tools.replaceChildren(
    h('button', { type: 'button', class: 'linkish', onclick: () => openBoardForm('rename') }, 'Rename board'),
    h('button', { type: 'button', class: 'linkish', onclick: deleteCurrentBoard }, 'Delete board'));
  $('#drop').hidden = pinb; $('#libAdd').hidden = pinb;
  const real = realRefs(S.libBoard);
  const smp = pinb ? [] : (S.samples[S.libBoard] || []);
  const items = real.length ? real : smp;
  const note = $('#sampleNote');
  if (!real.length) {
    note.hidden = false;
    note.textContent = pinb
      ? 'This board has no image pins yet. It updates once a day.'
      : smp.length
        ? 'These are generated sample references so you can try a session right away. Add your own and they step aside.'
        : 'This board is empty. Drop files above, or paste an image with Ctrl+V.';
  } else note.hidden = true;
  const live = new Set(items.map(r => r.id));
  for (const id of Array.from(cardCache.keys())) if (!live.has(id) && !id.startsWith('s-')) cardCache.delete(id);
  $('#grid').replaceChildren(...items.map((r, i) => refCard(r, items, i)));
}
function openBoardForm(mode) {
  boardFormMode = mode;
  const f = $('#boardForm'), inp = $('#boardNameIn');
  f.hidden = false;
  $('#boardFormOk').textContent = mode === 'new' ? 'Create board' : 'Rename';
  inp.value = mode === 'rename' ? boardName(S.libBoard) : '';
  inp.focus();
}
async function submitBoardForm(e) {
  e.preventDefault();
  const name = $('#boardNameIn').value.trim().slice(0, 40);
  if (!name) { toast('Give the board a name.'); return; }
  await ready;
  try {
    if (boardFormMode === 'new') {
      const b = { id: 'b' + uid(), name, created: Date.now() };
      await Store().putBoard(b); S.libBoard = b.id; LS.set('sketchhour.lib', b.id);
      if (!S.boards.some(x => x.id === b.id)) S.boards.push(b);
      toast(`Created ${name}.`);
    } else {
      const b = S.boards.find(x => x.id === S.libBoard);
      if (b) { const nb = Object.assign({}, b, { name }); await Store().putBoard(nb); Object.assign(b, { name }); toast('Board renamed.'); }
    }
  } catch (err) { toast(errText(err)); }
  $('#boardForm').hidden = true; boardFormMode = null; renderAll();
}
async function deleteCurrentBoard() {
  const pb = pinBoardOf(S.libBoard);
  if (pb) return;
  const id = S.libBoard, name = boardName(id), refs = realRefs(id).filter(r => !r.pending);
  const ok = await ask(refs.length ? `Delete “${name}” and its ${refs.length} reference${refs.length === 1 ? '' : 's'}? This can't be undone.` : `Delete “${name}”?`, 'Delete board');
  if (!ok) return;
  try {
    for (const r of refs) await Store().deleteRef(r);
    await Store().delBoard(id);
    S.boards = S.boards.filter(b => b.id !== id);
  } catch (e) { toast(errText(e)); }
  S.libBoard = 'poses'; LS.set('sketchhour.lib', 'poses');
  renderAll(); scheduleUsage(); toast(`Deleted ${name}.`);
}

/* ============ sources ============ */
function boardOptions(sel, value) {
  const own = boards().filter(b => !isPinBoard(b));
  const keep = value || sel.value;
  sel.replaceChildren(...own.map(b => h('option', { value: b.id }, b.name)));
  sel.value = own.some(b => b.id === keep) ? keep : 'poses';
}
function renderSources() {
  boardOptions($('#pinBoard'), $('#pinBoard').value || LS.get('sketchhour.pinBoard', 'poses'));
  renderPublished();
}
const PIN_SEARCHES = ['gesture drawing poses', 'dynamic pose reference', 'head angles reference', 'hand pose reference', 'foreshortening pose', 'sitting pose reference', 'dramatic lighting portrait'];

/* ============ session player ============ */
const P = { active: false };
function startSession() {
  const base = pool();
  if (!base.length) { toast('Add references to the selected boards first.'); return; }
  runSession(base, buildPlan(), {
    shuffle: CFG.shuffle, flips: CFG.flips, gray: CFG.gray, grid: CFG.grid, sound: CFG.sound,
    label: CFG.mode === 'class' ? CLASSES[CFG.cls].name : `${dlabel(CFG.dur)} poses`
  });
}
function runSession(base, plan, o) {
  let deck = o.shuffle ? shuffle(base.slice()) : base.slice(), k = 0;
  let poseNo = 0;
  for (const e of plan) {
    if (e.t !== 'pose') continue;
    if (k >= deck.length) { deck = o.shuffle ? shuffle(base.slice()) : base.slice(); k = 0; }
    e.ref = deck[k++]; e.flip = o.flips && Math.random() < 0.5; e.no = ++poseNo;
  }
  Object.assign(P, {
    active: true, done: false, plan, i: 0, left: plan[0].dur, running: true, last: performance.now(),
    spent: new Array(plan.length).fill(0), poses: poseNo, gray: !!o.gray, mirror: false, grid: !!o.grid, sound: o.sound !== false,
    label: o.label, lastSec: -1, learn: o.learn || null, again: o.again || null
  });
  if (P.sound) audio();
  const pl = $('#player'); pl.hidden = false; pl.classList.remove('idle', 'paused', 'warn');
  document.body.classList.add('locked');
  $('#plEnd').hidden = true;
  showEntry(); syncPlayerButtons(); keepAwake(true); startLoop(); poke();
  $('#plPause').focus();
}
function showEntry() {
  const e = P.plan[P.i];
  P.left = e.dur; P.lastSec = -1;
  const brk = e.t === 'break';
  $('#plBreak').hidden = !brk; $('#plFrame').hidden = brk;
  $('#plDur').textContent = brk ? 'break' : dlabel(e.dur);
  if (brk) {
    const nx = P.plan.slice(P.i + 1).find(x => x.t === 'pose');
    $('#plBreakNext').textContent = nx ? `Next: ${dlabel(nx.dur)} pose` : '';
    $('#plCount').textContent = 'Break';
    $('#plNote').textContent = '';
    $('#plVid').pause();
  } else {
    $('#plCount').textContent = `Pose ${e.no} of ${P.poses}`;
    $('#plNote').textContent = e.ref.note || boardName(e.ref.board);
    setStageMedia(e.ref);
    const nx = P.plan.slice(P.i + 1).find(x => x.t === 'pose');
    if (nx && nx.ref.kind !== 'video') { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = srcOf(nx.ref); }
  }
  applyPlayerLooks(); drawPlayerClock();
}
function setStageMedia(ref) {
  const img = $('#plImg'), vid = $('#plVid'), src = srcOf(ref);
  if (ref.kind === 'video') {
    img.hidden = true; img.removeAttribute('src');
    vid.hidden = false; if (vid.getAttribute('src') !== src) vid.src = src;
    if (P.running) vid.play().catch(() => {});
  } else {
    vid.pause(); vid.hidden = true; vid.removeAttribute('src');
    img.hidden = false; setImg(img, ref);
  }
}
function applyPlayerLooks() {
  const e = P.plan[P.i]; if (!e) return;
  const flip = !!(e.flip) !== P.mirror;
  for (const m of [$('#plImg'), $('#plVid')]) { m.classList.toggle('gray', P.gray); m.classList.toggle('mir', flip); }
  $('#plGrid').hidden = !P.grid || e.t === 'break';
  placePlGrid();
}
function placePlGrid() {
  const g = $('#plGrid'); if (g.hidden) return;
  const fr = $('#plFrame'), img = $('#plImg'), vid = $('#plVid');
  const m = !img.hidden ? img : vid;
  const nw = m.naturalWidth || m.videoWidth, nh = m.naturalHeight || m.videoHeight;
  if (!nw || !nh) return;
  const W = fr.clientWidth, H = fr.clientHeight, k = Math.min(W / nw, H / nh), w = nw * k, hh = nh * k;
  g.style.left = (W - w) / 2 + 'px'; g.style.top = (H - hh) / 2 + 'px'; g.style.width = w + 'px'; g.style.height = hh + 'px';
}
function drawPlayerClock() {
  const e = P.plan[P.i]; if (!e) return;
  const txt = clock(P.left);
  if (e.t === 'break') $('#plBreakT').textContent = txt;
  $('#plClock').textContent = txt;
  $('#plBar').style.transform = `scaleX(${Math.max(0, Math.min(1, P.left / e.dur))})`;
  $('#player').classList.toggle('warn', e.t === 'pose' && e.dur >= 30 && P.left <= 10);
}
function tickPlayer(now) {
  if (!P.active || P.done) { P.last = now; return; }
  const dt = (now - P.last) / 1000; P.last = now;
  if (!P.running) return;
  const e = P.plan[P.i];
  P.left -= dt; if (e.t === 'pose') P.spent[P.i] += dt;
  const sec = Math.ceil(P.left);
  if (sec !== P.lastSec) { P.lastSec = sec; if (P.sound && e.t === 'pose' && e.dur >= 20 && sec >= 1 && sec <= 3) sfx.tick(); }
  if (P.left <= 0) { if (P.sound) sfx.change(); advance(1); return; }
  drawPlayerClock();
}
function advance(dir) {
  if (dir > 0) {
    if (P.i + 1 >= P.plan.length) { finishSession(true); return; }
    P.i++;
  } else {
    let j = P.i - 1;
    while (j >= 0 && P.plan[j].t !== 'pose') j--;
    if (j >= 0) P.i = j;
  }
  showEntry(); poke();
}
function setPaused(p) {
  P.running = !p; P.last = performance.now();
  $('#player').classList.toggle('paused', p); $('#plPaused').hidden = !p;
  const vid = $('#plVid'); if (!vid.hidden) { if (p) vid.pause(); else vid.play().catch(() => {}); }
  syncPlayerButtons(); poke();
}
function syncPlayerButtons() {
  setIcon($('#plPause'), P.running ? 'pause' : 'play');
  $('#plPause').setAttribute('aria-label', P.running ? 'Pause (Space)' : 'Resume (Space)');
  $('#plGray').setAttribute('aria-pressed', String(P.gray));
  $('#plFlip').setAttribute('aria-pressed', String(P.mirror));
  $('#plGridBtn').setAttribute('aria-pressed', String(P.grid));
  $('#plSound').setAttribute('aria-pressed', String(P.sound));
  setIcon($('#plSound'), P.sound ? 'sound' : 'mute');
}
function mediaThumb(r) {
  if (r.kind === 'video') return h('video', { muted: true, playsinline: true, preload: 'metadata', src: srcOf(r) });
  const im = h('img', { alt: r.note || '', loading: 'lazy' }); setImg(im, r); return im;
}
function finishSession(completed) {
  P.done = true; P.running = false;
  $('#plVid').pause();
  const drawn = [];
  P.plan.forEach((e, i) => { if (e.t === 'pose' && P.spent[i] >= 5) drawn.push({ ref: e.ref, s: P.spent[i] }); });
  const secs = drawn.reduce((a, x) => a + x.s, 0);
  if (secs >= 30) logEntry(Object.assign({ kind: 'session', label: P.label, secs: Math.round(secs), poses: drawn.length }, lnTag(P.learn)));
  const planned = P.plan.reduce((a, e) => a + (e.t === 'pose' ? e.dur : 0), 0);
  const learnDone = !!(completed && P.learn && secs >= planned * 0.5);
  if (learnDone) lnSetDone(P.learn.ex, true);
  $('#plDone').textContent = P.learn ? 'Back to the unit' : 'Back to setup';
  $('#plEndKicker').textContent = learnDone ? P.label + ' · exercise done' : P.label;
  $('#plEndTitle').textContent = completed ? 'Session complete' : 'Session ended';
  $('#plStats').replaceChildren(
    h('div', null, h('b', null, String(drawn.length)), h('span', null, 'Poses drawn')),
    h('div', null, h('b', null, clock(secs)), h('span', null, 'Time drawing')),
    h('div', null, h('b', null, secs >= 30 ? 'Logged' : '—'), h('span', null, 'Practice log')));
  $('#plThumbs').replaceChildren(...drawn.slice(0, 60).map(x => h('figure', null, mediaThumb(x.ref), h('figcaption', null, clock(x.s)))));
  $('#plEnd').hidden = false; $('#player').classList.remove('idle', 'warn');
  keepAwake(T.running);
  $('#plAgain').focus();
}
function closePlayer() {
  P.active = false; P.done = true;
  const vid = $('#plVid'); vid.pause(); vid.removeAttribute('src');
  $('#player').hidden = true; document.body.classList.remove('locked');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  keepAwake(T.running);
  renderLog();
}
let idleT = 0;
function poke() {
  const p = $('#player'); p.classList.remove('idle'); clearTimeout(idleT);
  idleT = setTimeout(() => { if (P.active && P.running && $('#plEnd').hidden) p.classList.add('idle'); }, 2600);
}

/* ============ timer ============ */
const T = Object.assign({ total: 300, left: 300, rounds: 1, round: 1, rest: 0, resting: false, running: false, last: 0, label: '', sound: true, spent: 0, lastSec: -1 }, (() => {
  const s = LS.get('sketchhour.timer', {}); const total = s.total || 300;
  return { total, left: total, rounds: s.rounds || 1, rest: s.rest || 0, sound: s.sound !== false };
})());
const T_PRESETS = [60, 120, 300, 600, 900, 1200, 1800, 2700, 3600];
function saveTimer() { LS.set('sketchhour.timer', { total: T.total, rounds: T.rounds, rest: T.rest, sound: T.sound }); }
function tSet(sec, label, learn) {
  T.running = false; T.resting = false; T.learn = learn || null;
  T.total = Math.max(5, Math.round(sec)); T.left = T.total; T.round = 1; T.spent = 0; T.label = label || '';
  saveTimer(); renderTimer();
}
function tToggle() {
  if (T.sound) audio();
  if (!T.running) {
    if (T.left <= 0) { T.left = T.total; T.round = 1; T.spent = 0; T.resting = false; }
    T.running = true; T.last = performance.now(); keepAwake(true); startLoop();
  } else T.running = false;
  renderTimer();
}
function tReset() {
  if (T.spent >= 60) logEntry(Object.assign({ kind: 'timer', label: T.label || 'Timer', secs: Math.round(T.spent), rounds: T.round }, lnTag(T.learn)));
  T.running = false; T.resting = false; T.left = T.total; T.round = 1; T.spent = 0;
  keepAwake(P.active && !P.done); renderTimer();
}
function tickTimer(now) {
  if (!T.running) { T.last = now; return; }
  const dt = (now - T.last) / 1000; T.last = now;
  T.left -= dt; if (!T.resting) T.spent += dt;
  const sec = Math.ceil(T.left);
  if (sec !== T.lastSec) {
    T.lastSec = sec;
    if (T.sound && !T.resting && T.total >= 30 && sec >= 1 && sec <= 3) sfx.tick();
    renderTimerClock();
  } else renderTimerBar();
  if (T.left > 0) return;
  if (T.resting) { T.resting = false; T.round++; T.left = T.total; if (T.sound) sfx.change(); }
  else if (T.round < T.rounds) {
    if (T.sound) sfx.change();
    if (T.rest > 0) { T.resting = true; T.left = T.rest; } else { T.round++; T.left = T.total; }
  } else {
    if (T.sound) sfx.done();
    T.running = false; T.left = 0;
    logEntry(Object.assign({ kind: 'timer', label: T.label || 'Timer', secs: Math.round(T.spent), rounds: T.rounds }, lnTag(T.learn)));
    T.spent = 0; keepAwake(P.active && !P.done);
    if (T.learn) { lnSetDone(T.learn.ex, true); toast(`${T.label} finished. Exercise marked done.`); }
    else toast(T.label ? `${T.label} finished.` : 'Timer finished.');
  }
  renderTimer();
}
function renderTimerBar() {
  const base = T.resting ? T.rest : T.total;
  $('#tBar').style.transform = `scaleX(${base ? Math.max(0, Math.min(1, T.left / base)) : 0})`;
}
function renderTimerClock() {
  const d = clock(Math.max(0, T.left));
  const dg = $('#tDigits'); dg.textContent = d; dg.classList.toggle('rest', T.resting);
  const active = T.running || (T.left > 0 && T.left < T.total);
  $('#vwStudyT').textContent = active ? d : '';
  const sc = $('#stClock');
  if (sc) sc.textContent = T.label === 'Composition study' && active ? d : clock(ST.drawDur);
  renderTimerBar();
}
function renderTimer() {
  renderTimerClock();
  let lab;
  if (T.resting) lab = `Rest · round ${T.round + 1} of ${T.rounds} next`;
  else {
    const state = T.running ? 'Running' : T.left <= 0 ? 'Done' : T.left < T.total ? 'Paused' : 'Ready';
    lab = (T.label ? T.label + ' · ' : '') + (T.rounds > 1 ? `Round ${T.round} of ${T.rounds} · ${state}` : state);
  }
  $('#tLabel').textContent = lab;
  const sb = $('#tStart');
  sb.querySelector('span').textContent = T.running ? 'Pause' : (T.left > 0 && T.left < T.total) ? 'Resume' : 'Start';
  setIcon(sb, T.running ? 'pause' : 'play');
  $$('#tPresets .chip').forEach(c => c.setAttribute('aria-pressed', String(Number(c.dataset.sec) === T.total)));
  const mi = $('#tMin'), se = $('#tSec');
  if (document.activeElement !== mi) mi.value = String(Math.floor(T.total / 60));
  if (document.activeElement !== se) se.value = pad(T.total % 60);
  mi.disabled = se.disabled = T.running;
  $('#tRounds').value = String(T.rounds); $('#tRest').value = String(T.rest); $('#tSound').checked = T.sound;
  const vb = $('#vwStudyBtn');
  setIcon(vb, T.running ? 'pause' : 'timer');
  vb.setAttribute('aria-label', T.running ? 'Pause study timer' : 'Start study timer');
  vb.setAttribute('aria-pressed', String(T.running));
  const sd = $('#stDrawStart');
  if (sd) {
    const ours = T.label === 'Composition study';
    sd.querySelector('span').textContent = ours && T.running ? 'Pause' : ours && T.left > 0 && T.left < T.total ? 'Resume' : 'Start drawing';
    setIcon(sd, ours && T.running ? 'pause' : 'play');
  }
}
function startStudy(sec, label) {
  tSet(sec, label);
  location.hash = '#timer';
  tToggle();
}

/* shared loop for player + timer */
let loopT = 0;
function startLoop() { if (!loopT) loopT = setInterval(tickAll, 100); }
function tickAll() {
  const now = performance.now();
  tickPlayer(now); tickTimer(now);
  if ((!P.active || P.done) && !T.running) { clearInterval(loopT); loopT = 0; }
}

/* ============ reference viewer ============ */
const V = { list: [], i: 0, z: 1, x: 0, y: 0, fw: 0, fh: 0, nw: 1, nh: 1, flip: false, gray: false, vals: 0, thr: null, lum: null, grid: false, frames: null, fi: 0, fplay: false, fdur: 100, speed: 1, fps: 24 };
let vTok = 0, gifTimer = 0;
const SPEEDS = [1, 0.5, 0.25];
function openViewer(list, i) {
  V.list = list.slice(); V.i = i;
  $('#viewer').hidden = false; document.body.classList.add('locked');
  loadViewer(); $('#vwClose').focus();
}
function closeViewer() {
  vTok++; stopGif();
  const v = $('#vwVid'); v.pause(); v.removeAttribute('src');
  $('#viewer').hidden = true; $('#vwEdit').hidden = true;
  if (!(P.active && !P.done)) document.body.classList.remove('locked');
}
function stopGif() {
  clearTimeout(gifTimer); gifTimer = 0; V.fplay = false;
  if (V.frames) { try { V.frames.dec.close(); } catch {} V.frames = null; }
}
async function loadViewer() {
  const tok = ++vTok;
  stopGif();
  const r = V.list[V.i]; if (!r) { closeViewer(); return; }
  V.vals = 0; V.lum = null; V.thr = null; V.z = 1; V.x = 0; V.y = 0;
  $('#vwEdit').hidden = true;
  $('#vwTitle').textContent = `${r.setName || boardName(r.board)} · ${V.i + 1} of ${V.list.length}`;
  $('#vwNote').textContent = r.note || (r.sample ? 'Generated sample reference' : 'No note');
  const link = $('#vwLink'), safe = safeLink(r.link || '');
  link.hidden = !safe; if (safe) link.href = safe;
  const img = $('#vwImg'), vid = $('#vwVid'), cv = $('#vwCanvas'), src = srcOf(r);
  cv.hidden = true;
  if (r.kind === 'video') {
    img.hidden = true; img.removeAttribute('src');
    vid.hidden = false; vid.playbackRate = V.speed;
    vid.src = src; await once(vid, 'loadedmetadata'); if (tok !== vTok) return;
    V.nw = vid.videoWidth || r.w || 1280; V.nh = vid.videoHeight || r.h || 720;
    vid.playbackRate = V.speed; vid.play().catch(() => {});
  } else {
    vid.pause(); vid.hidden = true; vid.removeAttribute('src');
    img.hidden = false; setImg(img, r);
    try { await img.decode(); }
    catch {
      if (img.dataset.proxy) {
        if (!img.dataset.tried) { img.dataset.tried = '1'; img.src = img.dataset.proxy; }
        try { await img.decode(); } catch {}
      }
    }
    if (tok !== vTok) return;
    V.nw = img.naturalWidth || r.w || 800; V.nh = img.naturalHeight || r.h || 600;
  }
  $('#vwFrames').hidden = r.kind === 'image';
  $('#vwValues').disabled = r.kind !== 'image';
  $('#vwOwn').hidden = !!(r.sample || r.remote || r.cur);
  $('#vwPrevRef').hidden = $('#vwNextRef').hidden = V.list.length < 2;
  layoutViewer(); applyViewerLooks(); renderValues(); updFrameUI();
}
function layoutViewer() {
  const st = $('#vwStage'), W = st.clientWidth, H = st.clientHeight;
  const k = Math.min((W - 32) / V.nw, (H - 150) / V.nh);
  V.fw = V.nw * Math.max(0.05, k); V.fh = V.nh * Math.max(0.05, k);
  placePan();
}
function placePan() {
  const st = $('#vwStage'), W = st.clientWidth, H = st.clientHeight;
  const w = V.fw * V.z, hh = V.fh * V.z, p = $('#vwPan');
  p.style.width = w + 'px'; p.style.height = hh + 'px';
  p.style.left = (W / 2 + V.x - w / 2) + 'px'; p.style.top = (H / 2 + V.y - hh / 2) + 'px';
  $('#vwZoom').textContent = Math.abs(V.z - 1) < 0.01 ? 'Fit' : Math.round(V.z * 100) + '%';
}
function zoomAt(f, mx, my) {
  const st = $('#vwStage'), W = st.clientWidth, H = st.clientHeight;
  if (mx == null) { mx = W / 2; my = H / 2; }
  const z2 = Math.min(12, Math.max(0.25, V.z * f));
  const w = V.fw * V.z, hh = V.fh * V.z, left = W / 2 + V.x - w / 2, top = H / 2 + V.y - hh / 2;
  const u = (mx - left) / w, v = (my - top) / hh, w2 = V.fw * z2, h2 = V.fh * z2;
  V.x = mx - W / 2 + w2 / 2 - u * w2; V.y = my - H / 2 + h2 / 2 - v * h2; V.z = z2;
  placePan();
}
function fitView() { V.z = 1; V.x = 0; V.y = 0; placePan(); }
function applyViewerLooks() {
  for (const m of [$('#vwImg'), $('#vwVid'), $('#vwCanvas')]) { m.classList.toggle('gray', V.gray); m.classList.toggle('mir', V.flip); }
  $('#vwGrid').hidden = !V.grid;
  $('#vwFlip').setAttribute('aria-pressed', String(V.flip));
  $('#vwGray').setAttribute('aria-pressed', String(V.gray));
  $('#vwGridBtn').setAttribute('aria-pressed', String(V.grid));
  $('#vwValues').setAttribute('aria-pressed', String(V.vals > 0));
  $('#vwValuesLbl').textContent = V.vals === 2 ? 'Notan' : V.vals === 3 ? '3 values' : V.vals === 5 ? '5 values' : 'Values';
}
async function renderValues() {
  const img = $('#vwImg'), cv = $('#vwCanvas'), r = V.list[V.i];
  $('#vwThrWrap').hidden = V.vals !== 2;
  if (!V.vals || !r || r.kind !== 'image') { if (!V.frames) cv.hidden = true; if (r && r.kind === 'image') img.hidden = false; return; }
  if (!V.lum) {
    const tok = vTok;
    let source = img;
    if (r.remote) {
      // pin images come from Pinterest; reading their pixels needs Pinterest to allow it (CORS)
      try { source = await loadImg(r.url, true); } catch { source = null; }
      if (tok !== vTok) return;
      if (!source) { toast("This image's website doesn't allow value studies on it. Copy the image and paste it into a board to study its values."); V.vals = 0; applyViewerLooks(); renderValues(); return; }
    }
    const max = 1400, k = Math.min(1, max / Math.max(V.nw, V.nh));
    const w = Math.max(1, Math.round(V.nw * k)), hh = Math.max(1, Math.round(V.nh * k));
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    const x = c.getContext('2d', { willReadFrequently: true });
    let d;
    try { x.drawImage(source, 0, 0, w, hh); d = x.getImageData(0, 0, w, hh).data; }
    catch { toast("Value view isn't available for this image."); V.vals = 0; applyViewerLooks(); renderValues(); return; }
    const L = new Float32Array(w * hh); let sum = 0, mn = 255, mx = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      L[j] = l; sum += l; if (l < mn) mn = l; if (l > mx) mx = l;
    }
    V.lum = { L, w, h: hh, mn, mx };
    if (V.thr == null) V.thr = Math.round(sum / (w * hh));
    $('#vwThr').value = String(V.thr);
  }
  const { L, w, h: hh, mn, mx } = V.lum;
  cv.width = w; cv.height = hh;
  const x = cv.getContext('2d'), out = x.createImageData(w, hh), o = out.data;
  const tones = V.vals === 2 ? [26, 238] : V.vals === 3 ? [26, 128, 238] : [20, 72, 128, 186, 242];
  const span = Math.max(1, mx - mn);
  for (let j = 0; j < L.length; j++) {
    let t;
    if (V.vals === 2) t = L[j] < V.thr ? tones[0] : tones[1];
    else t = tones[Math.min(V.vals - 1, Math.floor((L[j] - mn) / span * V.vals))];
    const p = j * 4; o[p] = o[p + 1] = o[p + 2] = t; o[p + 3] = 255;
  }
  x.putImageData(out, 0, 0);
  cv.hidden = false; img.hidden = true;
}
function cycleValues() {
  const r = V.list[V.i]; if (!r || r.kind !== 'image') return;
  V.vals = V.vals === 0 ? 2 : V.vals === 2 ? 3 : V.vals === 3 ? 5 : 0;
  applyViewerLooks(); renderValues();
}
async function ensureGif() {
  if (V.frames) return true;
  if (!('ImageDecoder' in window)) { toast('Frame stepping for GIFs needs Chrome or Edge. Clips step frame by frame in every browser.'); return false; }
  const r = V.list[V.i], tok = vTok;
  try {
    const res = await fetch(srcOf(r), r.remote ? { mode: 'cors', referrerPolicy: 'no-referrer' } : undefined);
    if (!res.ok) throw new Error('gif');
    const buf = await res.arrayBuffer();
    if (tok !== vTok) return false;
    const dec = new ImageDecoder({ data: buf, type: 'image/gif' });
    await dec.tracks.ready;
    if (dec.completed) await dec.completed.catch(() => {});
    const n = dec.tracks.selectedTrack.frameCount || 1;
    V.frames = { dec, n }; V.fi = 0;
    $('#vwImg').hidden = true; $('#vwCanvas').hidden = false;
    await drawFrame(0);
    return true;
  } catch { toast(r.remote ? "Pinterest doesn't allow frame stepping on this GIF. Copy it into a board to step through it." : "Couldn't read this GIF's frames."); return false; }
}
async function drawFrame(i) {
  const f = V.frames; if (!f) return;
  i = ((i % f.n) + f.n) % f.n; V.fi = i;
  try {
    const res = await f.dec.decode({ frameIndex: i });
    const im = res.image, cv = $('#vwCanvas');
    cv.width = im.displayWidth; cv.height = im.displayHeight;
    cv.getContext('2d').drawImage(im, 0, 0);
    V.fdur = (im.duration || 100000) / 1000; im.close();
  } catch {}
  updFrameUI();
}
async function gifLoop() {
  if (!V.fplay || !V.frames) return;
  await drawFrame(V.fi + 1);
  gifTimer = setTimeout(gifLoop, Math.max(20, V.fdur / V.speed));
}
function frameStep(dir) {
  const r = V.list[V.i]; if (!r) return;
  if (r.kind === 'video') {
    const v = $('#vwVid'); v.pause();
    const f = Math.floor(v.currentTime * V.fps + 1e-4) + dir;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, (f + 0.5) / V.fps));
    updFrameUI();
  } else if (r.kind === 'gif') {
    ensureGif().then(ok => { if (!ok) return; V.fplay = false; clearTimeout(gifTimer); drawFrame(V.fi + dir); });
  }
}
function framePlay() {
  const r = V.list[V.i]; if (!r) return;
  if (r.kind === 'video') { const v = $('#vwVid'); if (v.paused) v.play().catch(() => {}); else v.pause(); updFrameUI(); return; }
  if (r.kind !== 'gif') return;
  if (!V.frames) { ensureGif().then(ok => { if (ok) { V.fplay = false; updFrameUI(); } }); return; }
  V.fplay = !V.fplay; clearTimeout(gifTimer);
  if (V.fplay) gifLoop();
  updFrameUI();
}
function updFrameUI() {
  const r = V.list[V.i]; if (!r || r.kind === 'image') return;
  let playing, label;
  if (r.kind === 'video') {
    const v = $('#vwVid'); playing = !v.paused;
    const total = v.duration ? Math.round(v.duration * V.fps) : 0;
    label = `${Math.floor((v.currentTime || 0) * V.fps + 1e-4) + 1}${total ? '/' + total : ''}`;
  } else {
    playing = V.frames ? V.fplay : true;
    label = V.frames ? `${V.fi + 1}/${V.frames.n}` : 'GIF';
  }
  setIcon($('#vwFPlay'), playing ? 'pause' : 'play');
  $('#vwFrameNo').textContent = label;
  const sp = V.speed;
  $('#vwSpeed').textContent = sp === 1 ? '1×' : sp === 0.5 ? '½×' : '¼×';
}
function viewerStep(d) {
  if (V.list.length < 2) return;
  V.i = (V.i + d + V.list.length) % V.list.length;
  loadViewer();
}
function openEdit() {
  const r = V.list[V.i]; if (!r || r.sample || r.remote) return;
  $('#vwNoteIn').value = r.note || ''; $('#vwLinkIn').value = r.link || '';
  boardOptions($('#vwBoardSel'), r.board);
  $('#vwEdit').hidden = false; $('#vwNoteIn').focus();
}
async function saveEdit(e) {
  e.preventDefault();
  const r = V.list[V.i]; if (!r) return;
  const patch = { note: $('#vwNoteIn').value.trim().slice(0, 140), link: safeLink($('#vwLinkIn').value.trim()), board: $('#vwBoardSel').value };
  if (r.pending) { toast('Still saving this one. Try again in a moment.'); return; }
  try { await Store().updateRef(r.id, patch); Object.assign(r, patch); toast('Saved.'); }
  catch (err) { toast(errText(err)); return; }
  $('#vwEdit').hidden = true;
  $('#vwNote').textContent = r.note || 'No note';
  $('#vwTitle').textContent = `${r.setName || boardName(r.board)} · ${V.i + 1} of ${V.list.length}`;
  const link = $('#vwLink'); link.hidden = !r.link; if (r.link) link.href = r.link;
  renderAll();
}
async function deleteViewed() {
  const r = V.list[V.i]; if (!r || r.sample || r.remote) return;
  if (r.pending) { toast('Still saving this one. Try again in a moment.'); return; }
  const ok = await ask('Delete this reference? This can’t be undone.', 'Delete');
  if (!ok) return;
  try { await Store().deleteRef(r); } catch (e) { toast(errText(e)); return; }
  cardCache.delete(r.id);
  V.list.splice(V.i, 1);
  renderAll(); scheduleUsage(); toast('Reference deleted.');
  if (!V.list.length) { closeViewer(); return; }
  if (V.i >= V.list.length) V.i = 0;
  loadViewer();
}

/* ============ frame grabber (own video files) ============ */
const FG = { fps: 24, url: '' };
function fgTC() {
  const v = $('#fgVid'), t = v.currentTime || 0, fpsR = Math.round(FG.fps);
  const f = Math.floor(t * FG.fps + 1e-4) % fpsR, s = Math.floor(t);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}:${pad(f)}`;
}
function fgUpdate() {
  const v = $('#fgVid');
  $('#fgTC').textContent = fgTC();
  if (v.duration && document.activeElement !== $('#fgSeek')) $('#fgSeek').value = String(Math.round(v.currentTime / v.duration * 1000));
  setIcon($('#fgPlay'), v.paused ? 'play' : 'pause');
}
function fgFrame(dir) {
  const v = $('#fgVid'); if (!v.duration) return; v.pause();
  const f = Math.floor(v.currentTime * FG.fps + 1e-4) + dir;
  v.currentTime = Math.max(0, Math.min(v.duration, (f + 0.5) / FG.fps));
}
async function fgGrab() {
  const v = $('#fgVid'); if (!v.videoWidth) { toast('Open a video file first.'); return; }
  v.pause();
  const k = Math.min(1, 2400 / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) { toast("Couldn't grab this frame."); return; }
  const title = ($('#filmTitle').value || '').trim(), tc = fgTC();
  addFiles([new File([blob], 'frame.jpg', { type: 'image/jpeg' })], { board: 'film', source: 'frame', note: (title ? title + ' · ' : '') + tc });
  $('#fgStrip').prepend(h('img', { src: URL.createObjectURL(blob), alt: `Frame at ${tc}` }));
}

/* ============ generated sample references ============ */
const POSES = [
  { n: 'contrapposto', t: 174, h: 186, sw: .75, ra: [12, 6], la: [-38, 52], rl: [-4, 2], ll: [14, 4] },
  { n: 'reach', t: 184, h: 196, sw: .8, ra: [164, 174], la: [150, 168], rl: [2, 0], ll: [-8, -2] },
  { n: 'run', t: 162, h: 166, sw: .5, ra: [-48, 96], la: [44, 158], rl: [62, 6], ll: [-28, -82] },
  { n: 'crouch', t: 148, h: 160, sw: .55, ra: [22, 84], la: [34, 74], rl: [100, -12], ll: [92, -20] },
  { n: 'seated', t: 172, h: 176, sw: .6, ra: [58, 118], la: [-22, -14], rl: [118, 12], ll: [93, 89] },
  { n: 'throw', t: 194, h: 168, sw: .7, ra: [-132, -168], la: [62, 84], rl: [-22, -8], ll: [30, 4] },
  { n: 'bend', t: 108, h: 104, sw: .5, ra: [6, 0], la: [-4, -2], rl: [2, 0], ll: [-8, -4] },
  { n: 'lunge', t: 180, h: 184, sw: .6, ra: [28, 64], la: [16, 70], rl: [84, 2], ll: [-46, -78] },
  { n: 'leap', t: 172, h: 164, sw: .85, ra: [118, 138], la: [-116, -136], rl: [86, 98], ll: [-96, -104], air: .9 },
  { n: 'arabesque', t: 126, h: 118, sw: .6, ra: [116, 122], la: [-112, -100], rl: [-100, -94], ll: [0, 0] },
  { n: 'kneel', t: 182, h: 176, sw: .6, ra: [14, 128], la: [-10, 2], rl: [86, 0], ll: [0, -88] },
  { n: 'recline', t: -104, h: -112, sw: .5, ra: [6, -84], la: [64, 98], rl: [96, 90], ll: [88, 94] }
].map(p => Object.assign({ f: 1 }, p));
const WALK = { n: 'walk', t: 178, h: 182, sw: .55, ra: [-16, -8], la: [18, 34], rl: [20, 6], ll: [-18, -34], f: 1 };
function mirrorPose(p) {
  const m = a => -a;
  return Object.assign({}, p, { t: m(p.t), h: m(p.h), ra: p.ra.map(m), la: p.la.map(m), rl: p.rl.map(m), ll: p.ll.map(m), f: -p.f });
}
const dirv = a => { const r = a * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; };
const addv = (a, b, k) => [a[0] + b[0] * (k == null ? 1 : k), a[1] + b[1] * (k == null ? 1 : k)];
function rig(p) {
  const td = dirv(p.t), hd = dirv(p.h);
  const pel = [0, 0], neck = addv(pel, td, 2.5), chest = addv(pel, td, 1.62), head = addv(neck, hd, 0.78);
  const nv = [-td[1] * p.f, td[0] * p.f];
  const sh = addv(neck, td, -0.22), hp = addv(pel, td, -0.1);
  const shN = addv(sh, nv, p.sw * 0.45), shF = addv(sh, nv, -p.sw * 0.45);
  const hpN = addv(hp, nv, 0.2), hpF = addv(hp, nv, -0.2);
  const limb = (o, a, l1, b, l2) => { const m = addv(o, dirv(a), l1); return [o, m, addv(m, dirv(b), l2)]; };
  const armN = limb(shN, p.ra[0], 1.42, p.ra[1], 1.25), armF = limb(shF, p.la[0], 1.42, p.la[1], 1.25);
  const legN = limb(hpN, p.rl[0], 1.9, p.rl[1], 1.85), legF = limb(hpF, p.ll[0], 1.9, p.ll[1], 1.85);
  return {
    td, hd, pel, neck, chest, head, shN, shF, armN, armF, legN, legF, f: p.f,
    handN: addv(armN[2], dirv(p.ra[1]), 0.3), handF: addv(armF[2], dirv(p.la[1]), 0.3),
    footN: addv(legN[2], [p.f * 0.3, 0.06]), footF: addv(legF[2], [p.f * 0.3, 0.06])
  };
}
function rigBox(R) {
  const pts = [R.pel, [R.pel[0], R.pel[1] + 0.45], R.neck, R.chest, R.head, ...R.armN, ...R.armF, ...R.legN, ...R.legF, R.handN, R.handF, R.footN, R.footF];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  return { x0: x0 - 0.55, x1: x1 + 0.55, y0: y0 - 0.6, y1: y1 + 0.16 };
}
const WOOD = { l: '#f1d8b6', b: '#d5af87', d: '#a67a51', j: '#8a6342', o: 'rgba(84,54,28,.55)' };
const WOODF = { l: '#dbbf9b', b: '#bd976f', d: '#8b6443', j: '#73513a', o: 'rgba(70,44,22,.55)' };
function paintFig(x, R, s, ox, oy, sil) {
  const P2 = q => [ox + q[0] * s, oy + q[1] * s];
  const L = [-0.55, -0.83];
  const lw = Math.max(1, s * 0.022);
  const shade = (gx0, gy0, gx1, gy1, C, radial, r0, r1) => {
    if (sil) { x.fillStyle = sil; x.fill(); return; }
    const g = radial ? x.createRadialGradient(gx0, gy0, r0, gx1, gy1, r1) : x.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, C.l); g.addColorStop(0.5, C.b); g.addColorStop(1, C.d);
    x.fillStyle = g; x.fill(); x.lineWidth = lw; x.strokeStyle = C.o; x.stroke();
  };
  const cap = (a, b, w1, w2, C) => {
    a = P2(a); b = P2(b); w1 *= s; w2 *= s;
    let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const n = [-dy, dx], ang = Math.atan2(n[1], n[0]);
    x.beginPath();
    x.moveTo(a[0] + n[0] * w1, a[1] + n[1] * w1); x.lineTo(b[0] + n[0] * w2, b[1] + n[1] * w2);
    x.arc(b[0], b[1], w2, ang, ang - Math.PI, true);
    x.lineTo(a[0] - n[0] * w1, a[1] - n[1] * w1);
    x.arc(a[0], a[1], w1, ang + Math.PI, ang, true);
    x.closePath();
    let nn = n; if (n[0] * L[0] + n[1] * L[1] < 0) nn = [-n[0], -n[1]];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w = Math.max(w1, w2);
    shade(m[0] + nn[0] * w, m[1] + nn[1] * w, m[0] - nn[0] * w, m[1] - nn[1] * w, C);
  };
  const ell = (c, rx, ry, rot, C) => {
    c = P2(c); rx *= s; ry *= s;
    x.beginPath(); x.ellipse(c[0], c[1], rx, ry, rot, 0, Math.PI * 2);
    shade(c[0] - rx * 0.35, c[1] - ry * 0.4, c[0], c[1], C, true, Math.min(rx, ry) * 0.1, Math.max(rx, ry) * 1.15);
  };
  const joint = (c, r, C) => { if (sil) return; c = P2(c); x.beginPath(); x.arc(c[0], c[1], r * s, 0, Math.PI * 2); x.fillStyle = C.j; x.fill(); };
  const rotOf = v => Math.atan2(v[1], v[0]) - Math.PI / 2;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const leg = (Lg, foot, C) => { cap(Lg[0], Lg[1], .29, .2, C); cap(Lg[1], Lg[2], .2, .13, C); ell(foot, .3, .12, 0, C); joint(Lg[1], .11, C); joint(Lg[0], .14, C); };
  const arm = (A, hand, C) => { cap(A[0], A[1], .19, .15, C); cap(A[1], A[2], .15, .11, C); ell(hand, .12, .19, rotOf(sub(A[2], A[1])), C); joint(A[1], .085, C); joint(A[0], .13, C); };
  leg(R.legF, R.footF, WOODF); arm(R.armF, R.handF, WOODF);
  ell(R.pel, .5, .42, rotOf(R.td), WOOD);
  cap(R.pel, R.chest, .33, .4, WOOD);
  ell(R.chest, .55, .78, rotOf(R.td), WOOD);
  cap(addv(R.neck, R.td, -0.25), addv(R.neck, R.hd, 0.22), .12, .12, WOOD);
  ell(R.head, .38, .5, rotOf(R.hd), WOOD);
  if (!sil) {
    const hc = P2(R.head);
    x.beginPath(); x.ellipse(hc[0], hc[1], .2 * s, .47 * s, rotOf(R.hd), -Math.PI / 2, Math.PI / 2, R.f < 0);
    x.lineWidth = lw; x.strokeStyle = WOOD.o; x.stroke();
  }
  leg(R.legN, R.footN, WOOD); arm(R.armN, R.handN, WOOD);
}
function mkCanvas(w, hh) { const c = document.createElement('canvas'); c.width = w; c.height = hh; return [c, c.getContext('2d')]; }
function poseCard(p, i) {
  const W = 720, H = 900, [c, x] = mkCanvas(W, H);
  const hue = [210, 196, 26, 214, 200, 32][i % 6];
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${hue},9%,88%)`); g.addColorStop(0.62, `hsl(${hue},8%,80%)`); g.addColorStop(1, `hsl(${hue},8%,67%)`);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const v = x.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.22)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  const R = rig(p), bb = rigBox(R);
  const s = Math.min(H * 0.76 / (bb.y1 - bb.y0), W * 0.84 / (bb.x1 - bb.x0));
  const floorY = H * 0.91, ox = W / 2 - (bb.x0 + bb.x1) / 2 * s, oy = floorY - bb.y1 * s - (p.air || 0) * s;
  const fx = ox + (R.footN[0] + R.footF[0]) / 2 * s;
  x.save(); x.filter = 'blur(7px)'; x.fillStyle = p.air ? 'rgba(20,22,26,.12)' : 'rgba(20,22,26,.24)';
  x.beginPath(); x.ellipse(fx, floorY + 2, Math.max(60, (bb.x1 - bb.x0) * s * 0.36), 13, 0, 0, Math.PI * 2); x.fill(); x.restore();
  paintFig(x, R, s, ox, oy, null);
  return c;
}
function silAt(x, pose, cx, footY, height, color) {
  const R = rig(pose), bb = rigBox(R), s = height / (bb.y1 - bb.y0);
  paintFig(x, R, s, cx - (bb.x0 + bb.x1) / 2 * s, footY - bb.y1 * s, color);
}
function letterbox(x, W, H) { const bar = Math.round((H - W / 2.39) / 2); x.fillStyle = '#000'; x.fillRect(0, 0, W, bar); x.fillRect(0, H - bar, W, bar); }
function camera(W, H, o) {
  const c = Math.cos(o.yaw || 0), s = Math.sin(o.yaw || 0), eye = o.eye == null ? 1.6 : o.eye, hor = o.hor, f = o.f;
  return (X, Y, Z) => { const xc = c * X - s * Z, zc = s * X + c * Z; if (zc < 0.05) return null; return [W / 2 + f * xc / zc, hor - f * (Y - eye) / zc, zc]; };
}
const rgb = a => `rgb(${a.map(v => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`;
const mixA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const scaleA = (a, k) => a.map(v => v * k);
function quad(x, pts, fill) {
  if (pts.some(p => !p)) return;
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.closePath(); x.fillStyle = Array.isArray(fill) ? rgb(fill) : fill; x.fill();
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const FACADES = [[198, 182, 162], [178, 152, 128], [212, 202, 188], [152, 142, 134], [190, 166, 142], [207, 188, 172], [162, 172, 178], [222, 212, 198], [176, 128, 106]];
const LIGHT = [0.62, 0.78];
function drawBox(x, cam, b, sky) {
  const faces = [];
  if (b.z0 > 0) faces.push({ n: [0, -1], o: [b.x0, b.z0], u: [1, 0], len: b.x1 - b.x0 });
  if (b.x0 > 0) faces.push({ n: [-1, 0], o: [b.x0, b.z0], u: [0, 1], len: b.z1 - b.z0 });
  if (b.x1 < 0) faces.push({ n: [1, 0], o: [b.x1, b.z0], u: [0, 1], len: b.z1 - b.z0 });
  const dist = Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), haze = Math.min(0.7, dist / 230);
  for (const F of faces) {
    const lit = 0.56 + 0.44 * Math.max(0, -(F.n[0] * LIGHT[0] + F.n[1] * LIGHT[1]));
    const p = (a, y) => cam(F.o[0] + F.u[0] * a, y, F.o[1] + F.u[1] * a);
    const base = mixA(scaleA(b.col, lit), sky, haze);
    quad(x, [p(0, 0), p(F.len, 0), p(F.len, b.h), p(0, b.h)], base);
    const glass = mixA(scaleA([54, 68, 82], 0.6 + lit * 0.4), sky, haze * 0.9), glassHi = mixA([168, 190, 208], sky, haze);
    for (let y = 2.4; y + 1.6 < b.h - 0.7; y += 3.1) {
      for (let a = 0.9; a + 1.2 < F.len - 0.5; a += 2.5) {
        const hi = (Math.floor(a * 7 + y * 13 + Math.abs(b.x0) * 3) % 5) === 0;
        quad(x, [p(a, y), p(a + 1.2, y), p(a + 1.2, y + 1.6), p(a, y + 1.6)], hi ? glassHi : glass);
      }
    }
    quad(x, [p(0, b.h - 0.4), p(F.len, b.h - 0.4), p(F.len, b.h), p(0, b.h)], scaleA(base, 0.8));
  }
}
function skyGround(x, W, H, hor, top, horiz, g0, g1) {
  let g = x.createLinearGradient(0, 0, 0, hor); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(horiz));
  x.fillStyle = g; x.fillRect(0, 0, W, hor + 1);
  g = x.createLinearGradient(0, hor, 0, H); g.addColorStop(0, rgb(g0)); g.addColorStop(1, rgb(g1));
  x.fillStyle = g; x.fillRect(0, hor, W, H - hor);
}
function streetScene(v) {
  const W = 1200, H = 800, [c, x] = mkCanvas(W, H), r = rng(v.seed);
  const hor = H * v.hor, cam = camera(W, H, { f: W * 0.6, eye: 1.6, hor });
  const sky = [222, 231, 238];
  skyGround(x, W, H, hor, [126, 164, 198], sky, [150, 150, 146], [112, 112, 110]);
  quad(x, [cam(-v.road, 0, 0.6), cam(v.road, 0, 0.6), cam(v.road, 0, 400), cam(-v.road, 0, 400)], [92, 95, 99]);
  quad(x, [cam(-v.side, 0, 0.6), cam(-v.road, 0, 0.6), cam(-v.road, 0, 400), cam(-v.side, 0, 400)], [174, 170, 162]);
  quad(x, [cam(v.road, 0, 0.6), cam(v.side, 0, 0.6), cam(v.side, 0, 400), cam(v.road, 0, 400)], [174, 170, 162]);
  for (let z = 2; z < 260; z += 9) quad(x, [cam(-0.09, 0, z), cam(0.09, 0, z), cam(0.09, 0, z + 4.5), cam(-0.09, 0, z + 4.5)], mixA([232, 230, 222], sky, Math.min(0.6, z / 260)));
  const boxes = [];
  for (const side of [-1, 1]) {
    let z = 3;
    while (z < 240) {
      const len = 8 + r() * 14, hgt = v.hmin + r() * (v.hmax - v.hmin), col = FACADES[Math.floor(r() * FACADES.length)];
      boxes.push(side < 0 ? { x0: -v.side - 14, x1: -v.side, z0: z, z1: z + len, h: hgt, col } : { x0: v.side, x1: v.side + 14, z0: z, z1: z + len, h: hgt, col });
      z += len + (r() < 0.25 ? 3 : 0);
    }
  }
  boxes.sort((a, b) => b.z0 - a.z0).forEach(b => drawBox(x, cam, b, sky));
  for (let z = 7; z < 130; z += 15) for (const sx of [-v.road - 0.6, v.road + 0.6]) {
    const a = cam(sx, 0, z), b = cam(sx, 5.2, z); if (!a || !b) continue;
    x.strokeStyle = rgb(mixA([46, 50, 54], sky, Math.min(0.6, z / 200))); x.lineWidth = Math.max(1, W * 0.6 * 0.14 / z);
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
  }
  return c;
}
function cornerScene(v) {
  const W = 1200, H = 800, [c, x] = mkCanvas(W, H);
  const hor = H * v.hor, cam = camera(W, H, { f: W * 0.66, yaw: v.yaw, eye: v.eye || 1.6, hor });
  const sky = [226, 232, 236];
  skyGround(x, W, H, hor, [110, 150, 190], sky, [166, 164, 158], [120, 118, 114]);
  const m = v.yaw < 0 ? -1 : 1;
  for (let k = 0; k < 14; k++) {
    const xa = m * (-4 + k * 1.3), xb = xa + m * 0.65;
    quad(x, [cam(Math.min(xa, xb), 0, 8), cam(Math.max(xa, xb), 0, 8), cam(Math.max(xa, xb), 0, 12), cam(Math.min(xa, xb), 0, 12)], [214, 212, 204]);
  }
  quad(x, [cam(-60, 0, 14.6), cam(90, 0, 14.6), cam(90, 0, 15), cam(-60, 0, 15)], [200, 198, 190]);
  v.boxes.slice().sort((a, b) => Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) - Math.hypot((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2)).forEach(b => drawBox(x, cam, b, sky));
  return c;
}
function filmDoor() {
  const W = 1280, H = 720, [c, x] = mkCanvas(W, H), fy = H * 0.76;
  let g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#0f1216'); g.addColorStop(0.6, '#1d2127'); g.addColorStop(1, '#0d0f12');
  x.fillStyle = g; x.fillRect(0, 0, W, fy); x.fillStyle = '#0a0b0d'; x.fillRect(0, fy, W, H - fy);
  const d0 = 720, d1 = 868, dt = 168;
  const glow = x.createRadialGradient((d0 + d1) / 2, (dt + fy) / 2, 40, (d0 + d1) / 2, (dt + fy) / 2, 420);
  glow.addColorStop(0, 'rgba(242,166,90,.28)'); glow.addColorStop(1, 'rgba(242,166,90,0)'); x.fillStyle = glow; x.fillRect(0, 0, W, H);
  g = x.createLinearGradient(0, dt, 0, fy); g.addColorStop(0, '#ffe8c2'); g.addColorStop(1, '#f2a65a'); x.fillStyle = g; x.fillRect(d0, dt, d1 - d0, fy - dt);
  g = x.createLinearGradient(0, fy, 0, H); g.addColorStop(0, 'rgba(242,166,90,.55)'); g.addColorStop(1, 'rgba(242,166,90,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(d0, fy); x.lineTo(d1, fy); x.lineTo(d1 + 300, H); x.lineTo(d0 - 180, H); x.closePath(); x.fill();
  const cx = (d0 + d1) / 2 + 6;
  x.fillStyle = 'rgba(6,7,9,.9)'; x.beginPath(); x.moveTo(cx - 16, fy); x.lineTo(cx + 18, fy); x.lineTo(cx + 70, H); x.lineTo(cx - 44, H); x.closePath(); x.fill();
  silAt(x, POSES[0], cx, fy + 2, (fy - dt) * 0.86, '#07080a');
  letterbox(x, W, H); return c;
}
function filmLamp() {
  const W = 1280, H = 720, [c, x] = mkCanvas(W, H), gy = H * 0.72, r = rng(7);
  let g = x.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, '#060a11'); g.addColorStop(1, '#101a26'); x.fillStyle = g; x.fillRect(0, 0, W, gy);
  for (let i = 0; i < 70; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,196,120,.55)' : 'rgba(170,200,230,.35)'; x.fillRect(r() * W, gy - 40 - r() * 170, 3 + r() * 5, 3 + r() * 6); }
  x.fillStyle = '#0a0f15'; x.fillRect(0, gy, W, H - gy);
  const lx = 520, ly = 214;
  x.save(); x.globalCompositeOperation = 'lighter';
  g = x.createLinearGradient(0, ly, 0, gy); g.addColorStop(0, 'rgba(255,214,150,.42)'); g.addColorStop(1, 'rgba(255,214,150,.06)');
  x.fillStyle = g; x.beginPath(); x.moveTo(lx - 10, ly); x.lineTo(lx + 10, ly); x.lineTo(lx + 150, gy); x.lineTo(lx - 150, gy); x.closePath(); x.fill();
  const pool = x.createRadialGradient(lx, gy + 10, 10, lx, gy + 10, 230); pool.addColorStop(0, 'rgba(255,210,150,.35)'); pool.addColorStop(1, 'rgba(255,210,150,0)');
  x.fillStyle = pool; x.fillRect(0, gy - 60, W, H - gy + 60);
  g = x.createLinearGradient(0, gy, 0, H); g.addColorStop(0, 'rgba(255,214,150,.22)'); g.addColorStop(1, 'rgba(255,214,150,0)');
  x.fillStyle = g; x.fillRect(lx - 7, gy, 14, H - gy);
  x.restore();
  x.fillStyle = '#1b222b'; x.fillRect(lx - 3, ly - 10, 6, gy - ly + 10); x.fillRect(lx - 16, ly - 14, 32, 7);
  x.fillStyle = '#ffe2b0'; x.fillRect(lx - 11, ly - 7, 22, 4);
  silAt(x, WALK, lx + 52, gy + 4, 236, '#05070a');
  letterbox(x, W, H); return c;
}
function filmHorizon() {
  const W = 1280, H = 720, [c, x] = mkCanvas(W, H), hy = 449;
  let g = x.createLinearGradient(0, 92, 0, hy); g.addColorStop(0, '#1c2642'); g.addColorStop(0.5, '#6e4659'); g.addColorStop(0.82, '#e08d5a'); g.addColorStop(1, '#f6c47c');
  x.fillStyle = g; x.fillRect(0, 0, W, hy);
  const sun = x.createRadialGradient(900, hy - 16, 4, 900, hy - 16, 160); sun.addColorStop(0, 'rgba(255,236,190,1)'); sun.addColorStop(0.15, 'rgba(255,220,160,.8)'); sun.addColorStop(1, 'rgba(255,200,140,0)');
  x.fillStyle = sun; x.fillRect(0, 0, W, hy);
  x.fillStyle = '#2b1e1d'; x.beginPath(); x.moveTo(0, hy); for (let px = 0; px <= W; px += 40) x.lineTo(px, hy - 6 - 10 * Math.sin(px / 140) - 6 * Math.sin(px / 47)); x.lineTo(W, hy); x.closePath(); x.fill();
  g = x.createLinearGradient(0, hy, 0, H); g.addColorStop(0, '#4a3226'); g.addColorStop(1, '#120d0b'); x.fillStyle = g; x.fillRect(0, hy, W, H - hy);
  const fx = W / 3, fyy = hy + 52;
  x.fillStyle = 'rgba(8,6,6,.75)'; x.beginPath(); x.moveTo(fx - 4, fyy); x.lineTo(fx + 6, fyy); x.lineTo(fx - 330, fyy + 26); x.lineTo(fx - 352, fyy + 20); x.closePath(); x.fill();
  silAt(x, WALK, fx, fyy, 118, '#0b0807');
  letterbox(x, W, H); return c;
}
function filmCorridor() {
  const W = 1280, H = 720, [c, x] = mkCanvas(W, H), f = W * 0.55, cam = camera(W, H, { f, eye: 1.6, hor: H * 0.5 });
  x.fillStyle = '#0d1414'; x.fillRect(0, 0, W, H);
  const end = [214, 238, 232];
  for (let z = 0.6; z < 40; z += 1.3) {
    const z2 = Math.min(40, z + 1.3), k = Math.pow(z / 40, 1.6) * 0.55;
    quad(x, [cam(-1.6, 0, z), cam(1.6, 0, z), cam(1.6, 0, z2), cam(-1.6, 0, z2)], mixA([36, 46, 48], end, k));
    quad(x, [cam(-1.6, 2.8, z), cam(1.6, 2.8, z), cam(1.6, 2.8, z2), cam(-1.6, 2.8, z2)], mixA([30, 38, 40], end, k * 0.8));
    quad(x, [cam(-1.6, 0, z), cam(-1.6, 0, z2), cam(-1.6, 2.8, z2), cam(-1.6, 2.8, z)], mixA([58, 76, 78], end, k));
    quad(x, [cam(1.6, 0, z), cam(1.6, 0, z2), cam(1.6, 2.8, z2), cam(1.6, 2.8, z)], mixA([50, 66, 68], end, k));
  }
  quad(x, [cam(-1.6, 0, 40), cam(1.6, 0, 40), cam(1.6, 2.8, 40), cam(-1.6, 2.8, 40)], end);
  for (let z = 3; z < 40; z += 5) for (const sx of [-1.6, 1.6]) {
    const za = z, zb = z + 0.95, col = mixA([28, 36, 38], end, Math.pow(z / 40, 1.6) * 0.5);
    quad(x, [cam(sx, 0, za), cam(sx, 0, zb), cam(sx, 2.1, zb), cam(sx, 2.1, za)], col);
  }
  for (let z = 2; z < 40; z += 4) {
    quad(x, [cam(-0.35, 2.79, z), cam(0.35, 2.79, z), cam(0.35, 2.79, z + 1.2), cam(-0.35, 2.79, z + 1.2)], [236, 252, 246]);
    x.globalAlpha = 0.18; quad(x, [cam(-0.35, 0.01, z), cam(0.35, 0.01, z), cam(0.35, 0.01, z + 1.2), cam(-0.35, 0.01, z + 1.2)], [236, 252, 246]); x.globalAlpha = 1;
  }
  const feet = cam(0, 0, 14);
  silAt(x, mirrorPose(POSES[0]), feet[0], feet[1], f * 1.8 / 14, '#040707');
  letterbox(x, W, H); return c;
}
const STREETS = [
  { seed: 11, hor: 0.5, road: 3.6, side: 6, hmin: 9, hmax: 26, note: 'one-point street' },
  { seed: 29, hor: 0.56, road: 2.4, side: 4.2, hmin: 12, hmax: 30, note: 'one-point, narrow street' }
];
const CORNERS = [
  { yaw: 0.6, hor: 0.6, note: 'two-point corner', boxes: [
    { x0: 10, x1: 26, z0: 16, z1: 30, h: 24, col: FACADES[2] }, { x0: 27, x1: 40, z0: 16, z1: 26, h: 11, col: FACADES[4] },
    { x0: -14, x1: 8, z0: 34, z1: 50, h: 16, col: FACADES[6] }, { x0: 30, x1: 44, z0: 62, z1: 76, h: 58, col: FACADES[3] }] },
  { yaw: -0.52, hor: 0.7, eye: 1.2, note: 'two-point, low angle', boxes: [
    { x0: -24, x1: -9, z0: 15, z1: 29, h: 30, col: FACADES[8] }, { x0: -40, x1: -25, z0: 15, z1: 25, h: 14, col: FACADES[0] },
    { x0: -6, x1: 12, z0: 36, z1: 52, h: 20, col: FACADES[5] }, { x0: -46, x1: -32, z0: 58, z1: 70, h: 46, col: FACADES[7] }] }
];
async function genSamples() {
  const tick = () => wait(0);
  const toUrl = c => new Promise(r => { try { c.toBlob(b => r(b ? URL.createObjectURL(b) : c.toDataURL('image/jpeg', 0.85)), 'image/jpeg', 0.86); } catch { r(''); } });
  const mk = async (board, id, c, note) => ({ id, board, kind: 'image', sample: true, url: await toUrl(c), w: c.width, h: c.height, note });
  try {
    const poses = [];
    for (let i = 0; i < POSES.length; i++) {
      const p = (i % 3 === 1) ? mirrorPose(POSES[i]) : POSES[i];
      poses.push(await mk('poses', 's-p' + i, poseCard(p, i), `Sample mannequin · ${POSES[i].n}`));
      if (i % 3 === 2) await tick();
    }
    S.samples.poses = poses; S.samplesReady = true; renderAll();
    const film = [];
    film.push(await mk('film', 's-f0', filmDoor(), 'Sample frame · backlit doorway')); await tick();
    film.push(await mk('film', 's-f1', filmLamp(), 'Sample frame · night street lamp')); await tick();
    film.push(await mk('film', 's-f2', filmHorizon(), 'Sample frame · dusk horizon')); await tick();
    film.push(await mk('film', 's-f3', filmCorridor(), 'Sample frame · corridor')); await tick();
    S.samples.film = film; renderAll();
    const places = [];
    for (let i = 0; i < STREETS.length; i++) { places.push(await mk('places', 's-l' + i, streetScene(STREETS[i]), 'Sample · ' + STREETS[i].note)); await tick(); }
    for (let i = 0; i < CORNERS.length; i++) { places.push(await mk('places', 's-c' + i, cornerScene(CORNERS[i]), 'Sample · ' + CORNERS[i].note)); await tick(); }
    S.samples.places = places;
  } catch (e) { /* samples are optional */ }
  S.samplesReady = true; renderAll();
}

/* ============ studio: composition checker + sketch comparison ============ */
const PHI = (1 + Math.sqrt(5)) / 2;
const ST_RATIOS = [
  { id: 'free', label: 'Free' }, { id: 'orig', label: 'Original' },
  { id: '1:1', r: 1 }, { id: '4:5', r: 4 / 5 }, { id: '3:4', r: 3 / 4 }, { id: '2:3', r: 2 / 3 },
  { id: '9:16', r: 9 / 16 }, { id: 'a4', r: 1 / Math.SQRT2, label: 'A4' }, { id: 'cine', r: 1 / 2.39 }
];
const ST_GUIDES = [
  ['thirds', 'Thirds'], ['phi', 'Golden grid'], ['spiral', 'Golden spiral'], ['diag', 'Diagonals'],
  ['tri', 'Golden triangles'], ['armature', 'Dynamic symmetry'], ['center', 'Center'], ['grid', 'Grid']
];
const ST_TONES = [['light', 'Light'], ['dark', 'Dark'], ['accent', 'Accent']];
const ST_COLORS = [['red', 'Red', '#e5383b'], ['blue', 'Blue', '#2f6fde'], ['green', 'Green', '#1f9d55'], ['black', 'Black', '#141414']];
const ST_VIEWS = [['lines', 'Lines'], ['multiply', 'Pencil'], ['photo', 'Photo']];
const ST_DURS = [300, 600, 900, 1800];

const ST = Object.assign({
  mode: 'compose', ref: null, refName: '', frame: null, ratio: 'orig', landscape: false,
  guides: ['thirds'], gridN: 4, flipH: false, flipV: false, tone: 'light', border: 'black',
  fixed: false, crop: null, drawDur: 900,
  sketch: null, sketchOrig: null, sketchVer: 0, layers: null, layersKey: '', straightened: false,
  xf: { s: 1, r: 0, tx: 0, ty: 0 }, cmpKey: '',
  view: 'lines', opacity: 0.9, strength: 50, lineColor: 'red', refFade: 1,
  peek: false, flicker: false, flickOn: true, align: null, corners: null,
  L: null, drag: null,
  look: { gray: false, mirror: false, steps: 0, split: 0, bright: 0, contrast: 0, blur: 0 }, lookBlocked: false, refVer: 0, cropVer: 0
}, (() => {
  const s = LS.get('sketchhour.studio', {});
  const keep = {};
  for (const k of ['guides', 'gridN', 'tone', 'border', 'view', 'opacity', 'strength', 'lineColor', 'drawDur']) if (s[k] != null) keep[k] = s[k];
  return keep;
})());
let stGuides = new Set(Array.isArray(ST.guides) ? ST.guides : ['thirds']);
function stSave() {
  LS.set('sketchhour.studio', { guides: [...stGuides], gridN: ST.gridN, tone: ST.tone, border: ST.border, view: ST.view, opacity: ST.opacity, strength: ST.strength, lineColor: ST.lineColor, drawDur: ST.drawDur });
}

/* ---------- loading ---------- */
function stCanvas(w, hh) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(hh)); return c; }
async function stLoadRef(src, name, remote) {
  ST.learn = null;
  let img = null, clean = true;
  try {
    if (src instanceof Blob) img = await loadImg(URL.createObjectURL(src));
    else if (remote) { try { img = await loadImg(src, true); } catch { img = await loadImg(src); clean = false; } }
    else img = await loadImg(src);
  } catch { img = null; }
  if (!img || !img.naturalWidth) { toast("That image couldn't be opened. Try a JPG, PNG or WebP."); return; }
  ST.ref = { img, w: img.naturalWidth, h: img.naturalHeight, clean };
  ST.refName = (name || 'Reference').slice(0, 80);
  ST.refVer++; ST.lookBlocked = false;
  ST.fixed = false; ST.crop = null; ST.align = null; ST.corners = null;
  ST.ratio = 'orig'; ST.landscape = ST.ref.w > ST.ref.h;
  ST.frame = { x: 0, y: 0, w: ST.ref.w, h: ST.ref.h };
  ST.cmpKey = '';
  stRender();
}
async function stLoadSketch(file) {
  let src = null;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { try { src = await loadImg(URL.createObjectURL(file)); } catch { src = null; } }
  if (!src) { toast("That photo couldn't be opened. Try a JPG or PNG."); return; }
  const w = src.width || src.naturalWidth, hh = src.height || src.naturalHeight, k = Math.min(1, 2000 / Math.max(w, hh));
  const c = stCanvas(w * k, hh * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  ST.sketchOrig = c; ST.sketch = c; ST.sketchVer++; ST.straightened = false;
  ST.align = null; ST.corners = null; ST.peek = false;
  stFitSketch();
  stRender();
  toast('Sketch added. Line it up by dragging, or use Straighten and Two points.');
}
function stHandleFile(file) {
  if (!file || !/^image\//.test(file.type)) { toast('Use an image file: JPG, PNG, WebP or GIF.'); return; }
  if (ST.mode === 'compare' && ST.ref) stLoadSketch(file);
  else stLoadRef(file, file.name.replace(/\.[^.]+$/, ''));
}
function stSample() {
  const pick = ST.mode === 'compare' ? (S.samples.poses[7] || S.samples.poses[0]) : (S.samples.places[2] || S.samples.poses[0]);
  if (!pick) { toast('Samples are still being drawn. Try again in a moment.'); return; }
  stLoadRef(pick.url, pick.note);
}
function stFromViewer(mode) {
  const r = V.list[V.i]; if (!r) return;
  if (r.kind === 'video') { toast('The Studio works with still images.'); return; }
  closeViewer();
  ST.mode = mode;
  location.hash = '#studio';
  stLoadRef(srcOf(r), r.note || boardName(r.board), !!r.remote);
}

/* ---------- frame ---------- */
function stAspect() {
  if (ST.ratio === 'free') return null;
  if (ST.ratio === 'orig') return ST.ref.w / ST.ref.h;
  const r = ST_RATIOS.find(x => x.id === ST.ratio).r;
  return ST.landscape ? 1 / r : r;
}
function stRatioLabel(o) {
  if (o.id === 'free' || o.id === 'orig') return o.label;
  if (o.id === 'a4') return ST.landscape ? 'A4 landscape' : 'A4';
  if (o.id === 'cine') return ST.landscape ? '2.39:1' : '1:2.39';
  const [a, b] = o.id.split(':');
  return ST.landscape && a !== b ? `${b}:${a}` : o.id;
}
function stClampFrame(f) {
  const W = ST.ref.w, H = ST.ref.h;
  f.w = Math.min(f.w, W); f.h = Math.min(f.h, H);
  f.x = Math.max(0, Math.min(W - f.w, f.x)); f.y = Math.max(0, Math.min(H - f.h, f.y));
  return f;
}
function stReshape() {
  const f = ST.frame, a = stAspect(), W = ST.ref.w, H = ST.ref.h;
  if (!a) return;
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  let w = Math.sqrt(f.w * f.h * a), hh = w / a;
  if (w > W) { w = W; hh = w / a; }
  if (hh > H) { hh = H; w = hh * a; }
  ST.frame = stClampFrame({ x: cx - w / 2, y: cy - hh / 2, w, h: hh });
}
function stLargest() {
  const W = ST.ref.w, H = ST.ref.h, a = stAspect();
  let w = W, hh = H;
  if (a) { if (W / H > a) { hh = H; w = H * a; } else { w = W; hh = W / a; } }
  const f = ST.frame || { x: 0, y: 0, w: W, h: H };
  ST.frame = stClampFrame({ x: f.x + f.w / 2 - w / 2, y: f.y + f.h / 2 - hh / 2, w, h: hh });
}
function stScaleFrame(fac) {
  const f = ST.frame, a = stAspect() || f.w / f.h, min = 0.04 * Math.min(ST.ref.w, ST.ref.h);
  let w = Math.max(min, f.w * fac), hh = w / a;
  if (hh < min) { hh = min; w = hh * a; }
  if (w > ST.ref.w) { w = ST.ref.w; hh = w / a; }
  if (hh > ST.ref.h) { hh = ST.ref.h; w = hh * a; }
  ST.frame = stClampFrame({ x: f.x + f.w / 2 - w / 2, y: f.y + f.h / 2 - hh / 2, w, h: hh });
}

/* ---------- geometry for guides ---------- */
function stFoot(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy); return [ax + t * dx, ay + t * dy]; }
function stRay(cx, cy, nx, ny, w, hh) {
  let t = Infinity;
  if (nx > 1e-9) t = Math.min(t, (w - cx) / nx); else if (nx < -1e-9) t = Math.min(t, -cx / nx);
  if (ny > 1e-9) t = Math.min(t, (hh - cy) / ny); else if (ny < -1e-9) t = Math.min(t, -cy / ny);
  return [cx + t * nx, cy + t * ny];
}
function stSpiral(ctx, withSquares) {
  let x = 0, y = 0, w = PHI, hh = 1;
  for (let i = 0; i < 12; i++) {
    const s = Math.min(w, hh), k = i % 4;
    if (withSquares) {
      if (k === 0) { ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + hh); }
      else if (k === 1) { ctx.moveTo(x, y + s); ctx.lineTo(x + w, y + s); }
      else if (k === 2) { ctx.moveTo(x + w - s, y); ctx.lineTo(x + w - s, y + hh); }
      else { ctx.moveTo(x, y + hh - s); ctx.lineTo(x + w, y + hh - s); }
    } else {
      if (i === 0) ctx.moveTo(x, y + s);
      if (k === 0) ctx.arc(x + s, y + s, s, Math.PI, 1.5 * Math.PI);
      else if (k === 1) ctx.arc(x, y + s, s, 1.5 * Math.PI, 2 * Math.PI);
      else if (k === 2) ctx.arc(x + w - s, y, s, 0, 0.5 * Math.PI);
      else ctx.arc(x + s, y + hh - s, s, 0.5 * Math.PI, Math.PI);
    }
    if (k === 0) { x += s; w -= s; } else if (k === 1) { y += s; hh -= s; } else if (k === 2) { w -= s; } else { hh -= s; }
  }
}
function stToneColors() {
  if (ST.tone === 'dark') return ['rgba(255,255,255,.55)', '#141414'];
  if (ST.tone === 'accent') {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--lavender-grey').trim() || '#8d9cb7';
    return ['rgba(0,0,0,.6)', c];
  }
  return ['rgba(0,0,0,.55)', '#ffffff'];
}
/* Draws the selected guides inside the rectangle (x, y, w, h). lw scales line widths for exports. */
function stDrawGuides(ctx, x, y, w, hh, lw) {
  lw = lw || 1;
  const [halo, col] = stToneColors();
  const stroke = (build, alpha, flips) => {
    ctx.save();
    ctx.translate(x, y);
    if (flips) {
      if (ST.flipH) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      if (ST.flipV) { ctx.translate(0, hh); ctx.scale(1, -1); }
    }
    ctx.beginPath();
    build();
    ctx.restore();
    ctx.globalAlpha = alpha || 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 3 * lw; ctx.strokeStyle = halo; ctx.stroke();
    ctx.lineWidth = 1.25 * lw; ctx.strokeStyle = col; ctx.stroke();
    ctx.globalAlpha = 1;
  };
  const lines = fr => { for (const f of fr) { ctx.moveTo(f * w, 0); ctx.lineTo(f * w, hh); ctx.moveTo(0, f * hh); ctx.lineTo(w, f * hh); } };
  if (stGuides.has('thirds')) stroke(() => lines([1 / 3, 2 / 3]));
  if (stGuides.has('phi')) stroke(() => lines([1 - 1 / PHI, 1 / PHI]));
  if (stGuides.has('center')) stroke(() => lines([0.5]));
  if (stGuides.has('grid')) { const n = ST.gridN; stroke(() => lines(Array.from({ length: n - 1 }, (_, i) => (i + 1) / n)), 0.85); }
  if (stGuides.has('diag')) stroke(() => { ctx.moveTo(0, 0); ctx.lineTo(w, hh); ctx.moveTo(w, 0); ctx.lineTo(0, hh); });
  if (stGuides.has('tri')) stroke(() => {
    ctx.moveTo(0, hh); ctx.lineTo(w, 0);
    const a = stFoot(0, 0, 0, hh, w, 0), b = stFoot(w, hh, 0, hh, w, 0);
    ctx.moveTo(0, 0); ctx.lineTo(a[0], a[1]); ctx.moveTo(w, hh); ctx.lineTo(b[0], b[1]);
  }, 1, true);
  if (stGuides.has('armature')) stroke(() => {
    ctx.moveTo(0, 0); ctx.lineTo(w, hh); ctx.moveTo(w, 0); ctx.lineTo(0, hh);
    const ends = [[w, 0, -hh, w], [0, hh, hh, -w], [0, 0, hh, w], [w, hh, -hh, -w]];
    for (const [cx, cy, nx, ny] of ends) { const e = stRay(cx, cy, nx, ny, w, hh); ctx.moveTo(cx, cy); ctx.lineTo(e[0], e[1]); }
  });
  if (stGuides.has('spiral')) {
    const unit = build => () => {
      if (w >= hh) ctx.scale(w / PHI, hh);
      else { ctx.scale(w, hh / PHI); ctx.transform(0, 1, 1, 0, 0, 0); }
      build();
    };
    stroke(unit(() => stSpiral(ctx, true)), 0.45, true);
    stroke(unit(() => stSpiral(ctx, false)), 1, true);
  }
}

/* ---------- drawing ---------- */
function stFit(w, hh) {
  const st = $('#stStage'), W = st.clientWidth, H = st.clientHeight, pad = W < 500 ? 12 : 24;
  const k = Math.max(0.0001, Math.min((W - pad * 2) / w, (H - pad * 2) / hh));
  return { k, ox: (W - w * k) / 2, oy: (H - hh * k) / 2, W, H };
}
function stCmpRef() {
  if (!ST.ref) return null;
  return ST.fixed && ST.crop
    ? { img: ST.crop, w: ST.crop.width, h: ST.crop.height, tag: 'crop' + ST.cropVer }
    : { img: ST.ref.img, w: ST.ref.w, h: ST.ref.h, tag: 'ref' + ST.refVer };
}

/* ---------- values: grayscale, value groups, brightness, contrast, squint ---------- */
const stLookCache = new Map();
function stLookActive() { const l = ST.look; return !!(l.gray || l.steps || l.bright || l.contrast || l.blur); }
function stDispLong() {
  const st = $('#stStage'), dpr = Math.min(2, window.devicePixelRatio || 1);
  return Math.min(2000, Math.ceil(Math.max(st.clientWidth, st.clientHeight) * dpr / 200) * 200 || 1600);
}
function stBoxBlur(d, w, hh, r) {
  const tmp = new Uint8ClampedArray(d.length), div = 2 * r + 1;
  for (let y = 0; y < hh; y++) {
    const row = y * w * 4;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += d[row + Math.min(w - 1, Math.max(0, k)) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[row + x * 4 + c] = sum / div;
        sum += d[row + Math.min(w - 1, x + r + 1) * 4 + c] - d[row + Math.max(0, x - r) * 4 + c];
      }
    }
  }
  for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += tmp[(Math.min(hh - 1, Math.max(0, k)) * w + x) * 4 + c];
    for (let y = 0; y < hh; y++) {
      d[(y * w + x) * 4 + c] = sum / div;
      sum += tmp[(Math.min(hh - 1, y + r + 1) * w + x) * 4 + c] - tmp[(Math.max(0, y - r) * w + x) * 4 + c];
    }
  }
}
/* Returns the source drawn with the current value settings, at most maxLong pixels on its long side. */
function stLookSrc(src, w, hh, tag, maxLong) {
  if (!stLookActive() || ST.lookBlocked) return src;
  const l = ST.look, key = [tag, maxLong, l.gray, l.steps, l.split, l.bright, l.contrast, l.blur].join('|');
  if (stLookCache.has(key)) return stLookCache.get(key);
  const k = Math.min(1, maxLong / Math.max(w, hh)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(hh * k));
  const c = stCanvas(cw, ch), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, cw, ch);
  let img;
  try { img = x.getImageData(0, 0, cw, ch); }
  catch {
    ST.lookBlocked = true;
    toast("Pinterest doesn't let this pin's values be changed here. Mirror still works; copy the pin into one of your boards to use the rest.");
    return src;
  }
  const d = img.data;
  if (l.blur > 0) { const r = Math.max(1, Math.round(l.blur / 100 * 0.022 * Math.max(cw, ch))); stBoxBlur(d, cw, ch, r); stBoxBlur(d, cw, ch, r); }
  const cf = l.contrast >= 0 ? 1 + l.contrast / 25 : 1 + l.contrast / 62.5, bo = l.bright * 1.3;
  const adj = v => (v - 128) * cf + 128 + bo;
  const N = l.steps, tones = { 2: [24, 236], 3: [24, 128, 236], 5: [18, 70, 128, 186, 242] }[N];
  let lo = 0, hi = 255;
  if (tones) {
    const hist = new Uint32Array(256), n = cw * ch;
    for (let i = 0; i < d.length; i += 4) { const v = adj(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); hist[v < 0 ? 0 : v > 255 ? 255 : v | 0]++; }
    let acc = 0; lo = -1;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (lo < 0 && acc >= n * 0.01) lo = i; if (acc >= n * 0.99) { hi = i; break; } }
    if (hi - lo < 8) { lo = 0; hi = 255; }
  }
  const gray = l.gray || !!tones, sh = l.split / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = adj(d[i]), g = adj(d[i + 1]), b = adj(d[i + 2]);
    if (gray) {
      let v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (tones) { let t = Math.floor(((v - lo) / (hi - lo) - sh) * N); v = tones[t < 0 ? 0 : t >= N ? N - 1 : t]; }
      r = g = b = v;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  x.putImageData(img, 0, 0);
  stLookCache.set(key, c);
  while (stLookCache.size > 4) stLookCache.delete(stLookCache.keys().next().value);
  return c;
}
function stFitSketch() {
  const ref = stCmpRef(), sk = ST.sketch;
  if (!ref || !sk) return;
  const s = Math.min(ref.w / sk.width, ref.h / sk.height);
  ST.xf = { s, r: 0, tx: (ref.w - sk.width * s) / 2, ty: (ref.h - sk.height * s) / 2 };
  ST.cmpKey = ref.w + 'x' + ref.h;
}
let stRaf = 0;
function stDraw() {
  if (stRaf) return;
  stRaf = requestAnimationFrame(() => { stRaf = 0; stPaint(); });
}
function stPaint() {
  const stage = $('#stStage'), c = $('#stCanvas');
  if (!stage || stage.offsetParent === null) return;
  const W = stage.clientWidth, H = stage.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!W || !H) return;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ST.look.mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.imageSmoothingQuality = 'high';
  if (!ST.ref) return;
  if (ST.mode === 'compose') stPaintCompose(ctx); else stPaintCompare(ctx);
}
function stHandle(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.stroke();
}
function stFrameHandles() {
  const f = ST.frame, L = ST.L;
  const x0 = L.ox + f.x * L.k, y0 = L.oy + f.y * L.k, x1 = x0 + f.w * L.k, y1 = y0 + f.h * L.k, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  const hs = [['nw', x0, y0, -1, -1], ['ne', x1, y0, 1, -1], ['se', x1, y1, 1, 1], ['sw', x0, y1, -1, 1]];
  if (!stAspect()) hs.push(['n', xm, y0, 0, -1], ['e', x1, ym, 1, 0], ['s', xm, y1, 0, 1], ['w', x0, ym, -1, 0]);
  return { hs, x0, y0, x1, y1 };
}
function stPaintCompose(ctx) {
  if (ST.fixed && ST.crop) {
    const c = ST.crop, L = stFit(c.width, c.height); ST.L = L;
    ctx.drawImage(stLookSrc(c, c.width, c.height, 'crop' + ST.cropVer, stDispLong()), L.ox, L.oy, c.width * L.k, c.height * L.k);
    stDrawGuides(ctx, L.ox, L.oy, c.width * L.k, c.height * L.k, 1);
    return;
  }
  const R = ST.ref, L = stFit(R.w, R.h); ST.L = L;
  const iw = R.w * L.k, ih = R.h * L.k;
  ctx.drawImage(stLookSrc(R.img, R.w, R.h, 'ref' + ST.refVer, stDispLong()), L.ox, L.oy, iw, ih);
  const { hs, x0, y0, x1, y1 } = stFrameHandles();
  // one shape with a hole, slightly larger than the image, so no seams show at the edges
  ctx.fillStyle = ST.border === 'black' ? '#000000' : 'rgba(0,0,0,.62)';
  ctx.beginPath(); ctx.rect(L.ox - 1, L.oy - 1, iw + 2, ih + 2); ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.fill('evenodd');
  stDrawGuides(ctx, x0, y0, x1 - x0, y1 - y0, 1);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  for (const [, hx, hy] of hs) stHandle(ctx, hx, hy, 6);
}
function stLayers() {
  const sk = ST.sketch, key = [ST.sketchVer, ST.strength, ST.lineColor].join('|');
  if (ST.layers && ST.layersKey === key) return ST.layers;
  const w = sk.width, hh = sk.height, d = sk.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, hh).data;
  const Lum = new Float32Array(w * hh);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) Lum[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  // paper brightness: the brightest value in each 24 px block, spread a little, then interpolated
  const B = 24, bw = Math.ceil(w / B), bh = Math.ceil(hh / B), bmax = new Float32Array(bw * bh);
  for (let y = 0; y < hh; y++) { const r = (y / B | 0) * bw, row = y * w; for (let x = 0; x < w; x++) { const v = Lum[row + x], bi = r + (x / B | 0); if (v > bmax[bi]) bmax[bi] = v; } }
  const bg = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let m = 0;
    for (let yy = Math.max(0, by - 1); yy <= Math.min(bh - 1, by + 1); yy++) for (let xx = Math.max(0, bx - 1); xx <= Math.min(bw - 1, bx + 1); xx++) m = Math.max(m, bmax[yy * bw + xx]);
    bg[by * bw + bx] = Math.max(m, 24);
  }
  // blocks much darker than the paper (a table, a shadow beyond the sheet) can't hold pencil lines
  const sortedMax = Array.from(bmax).sort((x, y) => x - y), paperLevel = sortedMax[Math.floor(sortedMax.length * 0.9)] || 255;
  const t = ST.strength / 100, hi = 0.62 + 0.3 * t, lo = hi - 0.35;
  const hex = (ST_COLORS.find(c => c[0] === ST.lineColor) || ST_COLORS[0])[2];
  const cr = parseInt(hex.slice(1, 3), 16), cg = parseInt(hex.slice(3, 5), 16), cb = parseInt(hex.slice(5, 7), 16);
  const lines = stCanvas(w, hh), gray = stCanvas(w, hh);
  const li = lines.getContext('2d').createImageData(w, hh), gi = gray.getContext('2d').createImageData(w, hh), lo8 = li.data, go8 = gi.data;
  for (let y = 0; y < hh; y++) {
    let fy = (y + 0.5) / B - 0.5; if (fy < 0) fy = 0; const y0 = Math.min(bh - 1, fy | 0), y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      let fx = (x + 0.5) / B - 0.5; if (fx < 0) fx = 0; const x0 = Math.min(bw - 1, fx | 0), x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0;
      const b = (bg[y0 * bw + x0] * (1 - tx) + bg[y0 * bw + x1] * tx) * (1 - ty) + (bg[y1 * bw + x0] * (1 - tx) + bg[y1 * bw + x1] * tx) * ty;
      const j = y * w + x, n = Math.min(1, Lum[j] / b), p = j * 4;
      let a = (hi - n) / (hi - lo); a = a < 0 ? 0 : a > 1 ? 1 : a;
      if (bmax[(y / B | 0) * bw + (x / B | 0)] < 0.55 * paperLevel) a = 0;
      lo8[p] = cr; lo8[p + 1] = cg; lo8[p + 2] = cb; lo8[p + 3] = a * 255;
      const g = 255 * (1 - a * (1 - n));
      go8[p] = go8[p + 1] = go8[p + 2] = g; go8[p + 3] = 255;
    }
  }
  lines.getContext('2d').putImageData(li, 0, 0); gray.getContext('2d').putImageData(gi, 0, 0);
  ST.layers = { lines, gray }; ST.layersKey = key;
  return ST.layers;
}
function stPaintSketchLayer(ctx, ref, L, forExport) {
  const { s, r, tx, ty } = ST.xf;
  ctx.save();
  // lines and pencil views stay inside the reference, where the comparison means something
  if (ST.view !== 'photo') { ctx.beginPath(); ctx.rect(L.ox, L.oy, ref.w * L.k, ref.h * L.k); ctx.clip(); }
  ctx.translate(L.ox, L.oy); ctx.scale(L.k, L.k); ctx.translate(tx, ty); ctx.rotate(r); ctx.scale(s, s);
  ctx.globalAlpha = ST.opacity;
  if (ST.view === 'lines') ctx.drawImage(stLayers().lines, 0, 0);
  else if (ST.view === 'multiply') { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(stLayers().gray, 0, 0); }
  else ctx.drawImage(ST.sketch, 0, 0);
  ctx.restore();
}
function stPaintRef(ctx, ref, L, maxLong) {
  const w = ref.w * L.k, hh = ref.h * L.k;
  if (ST.refFade < 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(L.ox, L.oy, w, hh); ctx.globalAlpha = ST.refFade; }
  ctx.drawImage(stLookSrc(ref.img, ref.w, ref.h, ref.tag, maxLong || stDispLong()), L.ox, L.oy, w, hh);
  ctx.globalAlpha = 1;
}
function stMarker(ctx, x, y, n) {
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = '#e5383b'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = '600 12px ' + getComputedStyle(document.body).fontFamily;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(x, y + 0.5); if (ST.look.mirror) ctx.scale(-1, 1); ctx.fillText(String(n), 0, 0); ctx.restore();
}
function stPaintCompare(ctx) {
  const ref = stCmpRef();
  if (ST.sketch && ST.cmpKey !== ref.w + 'x' + ref.h) stFitSketch();
  if (ST.corners) {
    const sk = ST.sketchOrig, L = stFit(sk.width, sk.height); ST.L = L;
    ctx.drawImage(sk, L.ox, L.oy, sk.width * L.k, sk.height * L.k);
    const P = ST.corners.map(([x, y]) => [L.ox + x * L.k, L.oy + y * L.k]);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.rect(L.ox, L.oy, sk.width * L.k, sk.height * L.k);
    ctx.moveTo(P[0][0], P[0][1]); for (let i = 3; i >= 0; i--) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath();
    ctx.fill('evenodd');
    ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    for (const [x, y] of P) stHandle(ctx, x, y, 9);
    return;
  }
  if (ST.align && ST.align.step >= 2) {
    const sk = ST.sketch, L = stFit(sk.width, sk.height); ST.L = L;
    ctx.drawImage(sk, L.ox, L.oy, sk.width * L.k, sk.height * L.k);
    ST.align.sk.forEach(([x, y], i) => stMarker(ctx, L.ox + x * L.k, L.oy + y * L.k, i + 1));
    return;
  }
  const L = stFit(ref.w, ref.h); ST.L = L;
  stPaintRef(ctx, ref, L);
  if (ST.align) { ST.align.ref.forEach(([x, y], i) => stMarker(ctx, L.ox + x * L.k, L.oy + y * L.k, i + 1)); return; }
  const hidden = ST.peek || (ST.flicker && !ST.flickOn);
  if (ST.sketch && !hidden) stPaintSketchLayer(ctx, ref, L);
}

/* ---------- straighten: 4 corners → rectangle with the reference's proportions ---------- */
function stSolve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
}
function stHomography(src, dst) { // maps src points to dst points
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i], [x, y] = dst[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  return stSolve(A, b);
}
function stOrderCorners(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4, cy = pts.reduce((s, p) => s + p[1], 0) / 4;
  const sorted = pts.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let tl = 0; sorted.forEach((p, i) => { if (p[0] + p[1] < sorted[tl][0] + sorted[tl][1]) tl = i; });
  return sorted.slice(tl).concat(sorted.slice(0, tl));
}
async function stApplyCorners() {
  const ref = stCmpRef(), sk = ST.sketchOrig, q = stOrderCorners(ST.corners);
  const edge = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const span = Math.max(edge(q[0], q[1]), edge(q[3], q[2]), edge(q[0], q[3]), edge(q[1], q[2]));
  const aspect = ref.w / ref.h, long = Math.min(2000, Math.max(400, span));
  const W = Math.round(aspect >= 1 ? long : long * aspect), H = Math.round(aspect >= 1 ? long / aspect : long);
  const Hm = stHomography([[0, 0], [W, 0], [W, H], [0, H]], q);
  if (!Hm) { toast('Those corners are too close together. Spread them out and try again.'); return; }
  stHint('Straightening…');
  await new Promise(r => setTimeout(r, 30));
  const sw = sk.width, sh = sk.height, sd = sk.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
  const out = stCanvas(W, H), oc = out.getContext('2d'), od = oc.createImageData(W, H), o = od.data;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = Hm;
  for (let v = 0; v < H; v++) {
    const vv = v + 0.5;
    for (let u = 0; u < W; u++) {
      const uu = u + 0.5, den = h6 * uu + h7 * vv + 1;
      let x = (h0 * uu + h1 * vv + h2) / den - 0.5, y = (h3 * uu + h4 * vv + h5) / den - 0.5;
      if (x < 0) x = 0; else if (x > sw - 1) x = sw - 1;
      if (y < 0) y = 0; else if (y > sh - 1) y = sh - 1;
      const x0 = x | 0, y0 = y | 0, x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), fx = x - x0, fy = y - y0;
      const p00 = (y0 * sw + x0) * 4, p10 = (y0 * sw + x1) * 4, p01 = (y1 * sw + x0) * 4, p11 = (y1 * sw + x1) * 4, p = (v * W + u) * 4;
      for (let c = 0; c < 3; c++) o[p + c] = (sd[p00 + c] * (1 - fx) + sd[p10 + c] * fx) * (1 - fy) + (sd[p01 + c] * (1 - fx) + sd[p11 + c] * fx) * fy;
      o[p + 3] = 255;
    }
  }
  oc.putImageData(od, 0, 0);
  ST.sketch = out; ST.sketchVer++; ST.straightened = true; ST.corners = null;
  stFitSketch();
  stRender();
  toast('Straightened to the reference’s proportions.');
}

/* ---------- two-point alignment ---------- */
function stFinishAlign() {
  const [r1, r2] = ST.align.ref, [s1, s2] = ST.align.sk;
  const vr = [r2[0] - r1[0], r2[1] - r1[1]], vs = [s2[0] - s1[0], s2[1] - s1[1]];
  const ls = Math.hypot(vs[0], vs[1]);
  if (ls < 4) { toast('Pick two points further apart on your sketch.'); ST.align.sk = []; ST.align.step = 2; stRender(); return; }
  const s = Math.hypot(vr[0], vr[1]) / ls, r = Math.atan2(vr[1], vr[0]) - Math.atan2(vs[1], vs[0]);
  const c = Math.cos(r), si = Math.sin(r);
  ST.xf = { s, r, tx: r1[0] - s * (c * s1[0] - si * s1[1]), ty: r1[1] - s * (si * s1[0] + c * s1[1]) };
  ST.align = null;
  stRender();
  toast('Lined up on your two points.');
}

/* ---------- export ---------- */
function stDownload(canvas, name) {
  try {
    canvas.toBlob(b => {
      if (!b) { toast("Couldn't create the image."); return; }
      const u = URL.createObjectURL(b), a = h('a', { href: u, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    }, 'image/jpeg', 0.92);
  } catch {
    toast("Pinterest doesn't allow saving this pin from another site. Copy it into one of your boards first.");
  }
}
function stCompositionExport(withGuides) {
  const c = ST.crop, out = stCanvas(c.width, c.height), x = out.getContext('2d');
  x.drawImage(withGuides ? stLookSrc(c, c.width, c.height, 'crop' + ST.cropVer, Math.max(c.width, c.height)) : c, 0, 0, c.width, c.height);
  if (withGuides) stDrawGuides(x, 0, 0, c.width, c.height, Math.max(1, c.width / 700));
  return out;
}
function stCompareExport() {
  const ref = stCmpRef(), k = Math.min(1, 2400 / Math.max(ref.w, ref.h));
  const out = stCanvas(ref.w * k, ref.h * k), x = out.getContext('2d');
  const L = { k, ox: 0, oy: 0 };
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, out.width, out.height);
  stPaintRef(x, ref, L, Math.max(out.width, out.height));
  if (ST.sketch) stPaintSketchLayer(x, ref, L, true);
  return out;
}
function stSaveToLibrary() {
  if (!ST.crop) return;
  const board = $('#stSaveBoard').value, label = stRatioLabel(ST_RATIOS.find(o => o.id === ST.ratio));
  try {
    ST.crop.toBlob(b => {
      if (!b) { toast("Couldn't save the composition."); return; }
      addFiles([new File([b], 'composition.jpg', { type: 'image/jpeg' })], { board, source: 'studio', note: `Composition ${label} · ${ST.refName}`.slice(0, 140) });
    }, 'image/jpeg', 0.92);
  } catch {
    toast("Pinterest doesn't allow saving this pin from another site. Copy it into one of your boards first.");
  }
}

/* ---------- panel ---------- */
function stReadout() {
  const f = ST.frame; if (!f || !ST.ref) return;
  const lab = ST.ratio === 'free' ? `${(f.w / f.h).toFixed(2)}:1` : stRatioLabel(ST_RATIOS.find(o => o.id === ST.ratio));
  $('#stReadout').textContent = `${lab} · ${Math.round(f.w)} × ${Math.round(f.h)} px · ${Math.round(100 * f.w * f.h / (ST.ref.w * ST.ref.h))}% of the image`;
}
function stHint(text) { const el = $('#stHint'); el.textContent = text || ''; el.hidden = !text; }
function stPressed(sel, attr, val) { $$(sel).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === val))); }
function stRender() {
  const has = !!ST.ref, compose = ST.mode === 'compose';
  stPressed('#stModeSeg button', 'mode', ST.mode);
  $('#stEmpty').hidden = has;
  $('#stRefName').textContent = has ? ST.refName : '';
  $('#stRefBtnLabel').textContent = has ? 'New reference' : 'Upload reference';
  $('#stNoRef').hidden = has;
  $('#stComposeBox').hidden = !has || !compose;
  $('#stCompareBox').hidden = !has || compose;
  if (has && compose) {
    const fixed = ST.fixed && !!ST.crop;
    for (const el of $$('.st-edit')) el.hidden = fixed;
    for (const el of $$('.st-fixed')) el.hidden = !fixed;
    $('#stComposeTitle').textContent = fixed ? 'Draw it' : 'Compose';
    $('#stComposeLead').textContent = fixed
      ? 'Your composition is fixed. Keep the guides you want while you draw, and start the timer.'
      : 'Drag the frame and its corners to try different crops. Everything outside the frame turns black.';
    $('#stRatios').replaceChildren(...ST_RATIOS.map(o => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(ST.ratio === o.id),
      onclick: () => { ST.ratio = o.id; if (o.id === 'orig') ST.landscape = ST.ref.w > ST.ref.h; stReshape(); stRender(); }
    }, stRatioLabel(o))));
    $('#stOrient').textContent = ST.landscape ? 'Make it portrait' : 'Make it landscape';
    $('#stOrient').disabled = ST.ratio === 'free' || ST.ratio === 'orig' || ST.ratio === '1:1';
    $$('#stBorderSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.b === ST.border)));
    stReadout();
    $('#stDurs').replaceChildren(...ST_DURS.map(sec => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(ST.drawDur === sec),
      onclick: () => { ST.drawDur = sec; stSave(); stRender(); renderTimer(); }
    }, dlabel(sec))));
    boardOptions($('#stSaveBoard'), $('#stSaveBoard').value || 'poses');
  }
  $('#stGuides').replaceChildren(...ST_GUIDES.map(([id, label]) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(stGuides.has(id)),
    onclick: () => { if (stGuides.has(id)) stGuides.delete(id); else stGuides.add(id); stSave(); stRender(); }
  }, label)));
  $('#stGridRow').hidden = !stGuides.has('grid');
  $('#stGridN').textContent = `${ST.gridN} × ${ST.gridN}`;
  $('#stFlipRow').hidden = !(stGuides.has('spiral') || stGuides.has('tri'));
  $$('#stFlipRow button').forEach(b => b.setAttribute('aria-pressed', String(b.id === 'stFlipH' ? ST.flipH : ST.flipV)));
  $('#stTones').replaceChildren(...ST_TONES.map(([id, label]) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(ST.tone === id), onclick: () => { ST.tone = id; stSave(); stRender(); }
  }, label)));
  if (has && !compose) {
    const sk = !!ST.sketch;
    $('#stCmpAgainst').textContent = ST.fixed && ST.crop
      ? 'Your sketch is laid over your fixed composition.'
      : 'Your sketch is laid over the whole reference. Fix a composition first to compare against the crop.';
    $('#stCmpTools').hidden = !sk;
    $('#stSketchBtnLabel').textContent = sk ? 'New photo' : 'Upload a photo';
    $('#stCornersBar').hidden = !ST.corners;
    $('#stAlignBar').hidden = !ST.align;
    $('#stLineupBtns').hidden = !!(ST.corners || ST.align);
    $('#stUnstraighten').hidden = !ST.straightened;
    stPressed('#stViewSeg button', 'v', ST.view);
    $('#stStrengthRow').hidden = ST.view === 'photo';
    $('#stColorRow').hidden = ST.view !== 'lines';
    $('#stLineColors').replaceChildren(...ST_COLORS.map(([id, label, hex]) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(ST.lineColor === id), onclick: () => { ST.lineColor = id; stSave(); stRender(); }
    }, h('span', { class: 'st-dot', style: `background:${hex}` }), label)));
    $('#stOpacity').value = String(Math.round(ST.opacity * 100)); $('#stOpacityV').textContent = Math.round(ST.opacity * 100) + '%';
    $('#stStrength').value = String(ST.strength); $('#stStrengthV').textContent = String(ST.strength);
    $('#stRefFade').value = String(Math.round(ST.refFade * 100)); $('#stRefFadeV').textContent = Math.round(ST.refFade * 100) + '%';
    const deg = Math.round(ST.xf.r * 1800 / Math.PI) / 10;
    $('#stRot').value = String(Math.max(-45, Math.min(45, deg))); $('#stRotV').textContent = deg + '°';
    $('#stFlicker').checked = ST.flicker;
  }
  $('#stTools').hidden = !has;
  if (!has) $('#stValues').hidden = true;
  const lk = ST.look;
  $('#stGrayBtn').setAttribute('aria-pressed', String(lk.gray));
  $('#stMirrorBtn').setAttribute('aria-pressed', String(lk.mirror));
  $('#stValuesBtn').setAttribute('aria-pressed', String(!$('#stValues').hidden || lk.steps > 0 || !!lk.bright || !!lk.contrast || !!lk.blur));
  $('#stValuesBtn').setAttribute('aria-expanded', String(!$('#stValues').hidden));
  $$('#stStepsSeg button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.s) === lk.steps)));
  $('#stSplitRow').hidden = !lk.steps;
  for (const [id, key] of [['stSplit', 'split'], ['stBright', 'bright'], ['stContrast', 'contrast'], ['stBlur', 'blur']]) {
    $('#' + id).value = String(lk[key]); $('#' + id + 'V').textContent = String(lk[key]);
  }
  let hint = '';
  if (has && !compose) {
    if (ST.corners) hint = 'Drag the four dots onto the corners of your drawing area, then press Apply.';
    else if (ST.align) hint = ['1 of 4 · Click a clear point on the reference, like the top of the head.',
      '2 of 4 · Click a second point far from the first, like a heel.',
      '3 of 4 · Click the same first point on your sketch.',
      '4 of 4 · Click the same second point on your sketch.'][ST.align.step];
    else if (!ST.sketch) hint = 'Upload or paste a photo of your sketch to lay it over the reference.';
  }
  stHint(hint);
  stCursor('');
  stDraw();
  renderTimer();
}
function stCursor(c) { const s = $('#stStage'); if (s) s.style.cursor = c || (ST.mode === 'compare' && ST.align ? 'crosshair' : ''); }

/* ---------- pointer + keyboard ---------- */
function stLocal(e) {
  const r = $('#stStage').getBoundingClientRect(), x = e.clientX - r.left;
  return { x: ST.look.mirror ? r.width - x : x, y: e.clientY - r.top };
}
function stToImg(p) { const L = ST.L; return [(p.x - L.ox) / L.k, (p.y - L.oy) / L.k]; }
function stHitFrame(p, touch) {
  const { hs, x0, y0, x1, y1 } = stFrameHandles(), rad = touch ? 22 : 12;
  for (const [id, hx, hy, sx, sy] of hs) if (Math.hypot(p.x - hx, p.y - hy) <= rad) return { kind: 'resize', id, sx, sy };
  if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return { kind: 'move' };
  return null;
}
const ST_CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
function stResize(d, p) {
  const f0 = d.f0, a = stAspect(), W = ST.ref.w, H = ST.ref.h, min = 0.04 * Math.min(W, H);
  const [px, py] = stToImg(p);
  let x = f0.x, y = f0.y, w = f0.w, hh = f0.h;
  const ax = d.sx < 0 ? f0.x + f0.w : f0.x, ay = d.sy < 0 ? f0.y + f0.h : f0.y;
  if (d.sx) w = Math.max(min, Math.min(d.sx < 0 ? ax : W - ax, d.sx * (px - ax)));
  if (d.sy) hh = Math.max(min, Math.min(d.sy < 0 ? ay : H - ay, d.sy * (py - ay)));
  if (a && d.sx && d.sy) {
    if (w / hh > a) w = hh * a; else hh = w / a;
    const maxW = d.sx < 0 ? ax : W - ax, maxH = d.sy < 0 ? ay : H - ay;
    if (w > maxW) { w = maxW; hh = w / a; }
    if (hh > maxH) { hh = maxH; w = hh * a; }
  }
  if (d.sx) x = d.sx < 0 ? ax - w : ax;
  if (d.sy) y = d.sy < 0 ? ay - hh : ay;
  ST.frame = stClampFrame({ x, y, w, h: hh });
}
function stRotateAbout(px, py, dr) {
  const c = Math.cos(dr), s = Math.sin(dr), { tx, ty } = ST.xf;
  ST.xf.tx = px + c * (tx - px) - s * (ty - py);
  ST.xf.ty = py + s * (tx - px) + c * (ty - py);
  ST.xf.r += dr;
}
function stScaleAbout(px, py, f) {
  ST.xf.tx = px + f * (ST.xf.tx - px); ST.xf.ty = py + f * (ST.xf.ty - py); ST.xf.s *= f;
}
function stBindStudio() {
  const stage = $('#stStage'), ptrs = new Map();
  let pinch = null;
  if ('ResizeObserver' in window) new ResizeObserver(() => stDraw()).observe(stage);
  stage.addEventListener('pointerdown', e => {
    if (!ST.ref || !ST.L || e.target.closest('button, label, a, input, .st-values, .st-tools')) return;
    stage.setPointerCapture(e.pointerId);
    const p = stLocal(e);
    ptrs.set(e.pointerId, p);
    const touch = e.pointerType !== 'mouse';
    if (ST.mode === 'compose' && !ST.fixed) {
      const hit = stHitFrame(p, touch);
      ST.drag = hit ? Object.assign(hit, { p0: p, f0: Object.assign({}, ST.frame) }) : null;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; ST.drag = null; }
      return;
    }
    if (ST.mode !== 'compare') return;
    if (ST.corners) {
      const L = ST.L; let best = -1, bd = touch ? 30 : 18;
      ST.corners.forEach(([x, y], i) => { const dd = Math.hypot(p.x - (L.ox + x * L.k), p.y - (L.oy + y * L.k)); if (dd < bd) { bd = dd; best = i; } });
      ST.drag = best >= 0 ? { kind: 'corner', i: best } : null;
      return;
    }
    if (ST.align) {
      const [ix, iy] = stToImg(p), step = ST.align.step;
      const lim = step < 2 ? stCmpRef() : { w: ST.sketch.width, h: ST.sketch.height };
      if (ix < 0 || iy < 0 || ix > lim.w || iy > lim.h) return;
      if (step < 2) ST.align.ref.push([ix, iy]); else ST.align.sk.push([ix, iy]);
      ST.align.step++;
      if (ST.align.step >= 4) stFinishAlign(); else stRender();
      return;
    }
    if (!ST.sketch) return;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      ST.drag = null;
    } else ST.drag = { kind: 'sketch', last: p };
    stage.style.cursor = 'grabbing';
  });
  stage.addEventListener('pointermove', e => {
    if (!ST.ref) return;
    const p = stLocal(e);
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (ST.mode === 'compose' && !ST.fixed) { stScaleFrame(d / pinch.d); pinch.d = d; stReadout(); stDraw(); return; }
      if (ST.mode === 'compare' && ST.sketch && !ST.align && !ST.corners) {
        const L = ST.L, ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const cx = (mx - L.ox) / L.k, cy = (my - L.oy) / L.k;
        ST.xf.tx += (mx - pinch.mx) / L.k; ST.xf.ty += (my - pinch.my) / L.k;
        stScaleAbout(cx, cy, d / pinch.d); stRotateAbout(cx, cy, ang - pinch.ang);
        Object.assign(pinch, { d, ang, mx, my });
        stDraw(); return;
      }
    }
    const d = ST.drag;
    if (!d) {
      if (e.pointerType === 'mouse' && ST.mode === 'compose' && !ST.fixed && ST.L) {
        const hit = stHitFrame(p, false);
        stage.style.cursor = hit ? (hit.kind === 'move' ? 'move' : ST_CURSORS[hit.id]) : '';
      } else if (e.pointerType === 'mouse' && ST.mode === 'compare' && ST.sketch && !ST.align && !ST.corners) stage.style.cursor = 'grab';
      return;
    }
    if (d.kind === 'move') {
      const L = ST.L;
      ST.frame = stClampFrame(Object.assign({}, d.f0, { x: d.f0.x + (p.x - d.p0.x) / L.k, y: d.f0.y + (p.y - d.p0.y) / L.k }));
      stReadout(); stDraw();
    } else if (d.kind === 'resize') { stResize(d, p); stReadout(); stDraw(); }
    else if (d.kind === 'corner') {
      const [ix, iy] = stToImg(p), sk = ST.sketchOrig;
      ST.corners[d.i] = [Math.max(0, Math.min(sk.width, ix)), Math.max(0, Math.min(sk.height, iy))];
      stDraw();
    } else if (d.kind === 'sketch') {
      const L = ST.L;
      ST.xf.tx += (p.x - d.last.x) / L.k; ST.xf.ty += (p.y - d.last.y) / L.k; d.last = p;
      stDraw();
    }
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ST.drag && ST.drag.kind === 'sketch') stRender();
    ST.drag = null;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => {
    if (!ST.ref || e.target.closest('.st-values, .st-tools')) return;
    const p = stLocal(e), f = Math.exp(-e.deltaY * 0.0015);
    if (ST.mode === 'compose' && !ST.fixed) { e.preventDefault(); stScaleFrame(f); stReadout(); stDraw(); }
    else if (ST.mode === 'compare' && ST.sketch && !ST.align && !ST.corners) {
      e.preventDefault();
      const [cx, cy] = stToImg(p);
      if (e.shiftKey) stRotateAbout(cx, cy, -e.deltaY * 0.002); else stScaleAbout(cx, cy, f);
      stDraw(); clearTimeout(stWheelT); stWheelT = setTimeout(stRender, 200);
    }
  }, { passive: false });
  stage.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); stage.classList.add('over'); } });
  stage.addEventListener('dragleave', () => stage.classList.remove('over'));
  stage.addEventListener('drop', e => {
    stage.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault(); e.stopPropagation();
    stHandleFile(f);
  });

  // panel controls
  $$('#stModeSeg button').forEach(b => b.addEventListener('click', () => { ST.mode = b.dataset.mode; ST.align = null; ST.corners = null; stRender(); }));
  $('#stRefFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) stLoadRef(f, f.name.replace(/\.[^.]+$/, '')); });
  $('#stSample').addEventListener('click', stSample);
  $('#stOrient').addEventListener('click', () => { ST.landscape = !ST.landscape; stReshape(); stRender(); });
  $('#stFill').addEventListener('click', () => { stLargest(); stRender(); });
  $$('#stBorderSeg button').forEach(b => b.addEventListener('click', () => { ST.border = b.dataset.b; stSave(); stRender(); }));
  $('#stGridMinus').addEventListener('click', () => { ST.gridN = Math.max(2, ST.gridN - 1); stSave(); stRender(); });
  $('#stGridPlus').addEventListener('click', () => { ST.gridN = Math.min(12, ST.gridN + 1); stSave(); stRender(); });
  $('#stFlipH').addEventListener('click', () => { ST.flipH = !ST.flipH; stRender(); });
  $('#stFlipV').addEventListener('click', () => { ST.flipV = !ST.flipV; stRender(); });
  $('#stFix').addEventListener('click', () => {
    const R = ST.ref, f = ST.frame, k = Math.min(1, 2400 / Math.max(f.w, f.h));
    const c = stCanvas(f.w * k, f.h * k);
    c.getContext('2d').drawImage(R.img, f.x, f.y, f.w, f.h, 0, 0, c.width, c.height);
    ST.crop = c; ST.fixed = true; ST.cmpKey = ''; ST.cropVer++;
    stRender();
  });
  $('#stUnfix').addEventListener('click', () => { ST.fixed = false; ST.crop = null; ST.cmpKey = ''; stRender(); });
  $('#stDrawStart').addEventListener('click', () => {
    const ours = T.label === 'Composition study';
    if (ours && (T.running || (T.left > 0 && T.left < T.total))) { tToggle(); return; }
    tSet(ST.drawDur, 'Composition study', ST.learn); tToggle();
  });
  $('#stSaveBtn').addEventListener('click', stSaveToLibrary);
  $('#stDownload').addEventListener('click', () => stDownload(stCompositionExport(true), 'composition-with-guides.jpg'));
  $('#stDownloadPlain').addEventListener('click', () => stDownload(stCompositionExport(false), 'composition.jpg'));
  $('#stToCompare').addEventListener('click', () => { ST.mode = 'compare'; stRender(); });
  $('#stSketchFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) stLoadSketch(f); });
  $('#stCorners').addEventListener('click', () => {
    const sk = ST.sketchOrig, mx = sk.width * 0.1, my = sk.height * 0.1;
    ST.corners = [[mx, my], [sk.width - mx, my], [sk.width - mx, sk.height - my], [mx, sk.height - my]];
    ST.align = null; stRender();
  });
  $('#stCornersApply').addEventListener('click', stApplyCorners);
  $('#stCornersCancel').addEventListener('click', () => { ST.corners = null; stRender(); });
  $('#stUnstraighten').addEventListener('click', () => { ST.sketch = ST.sketchOrig; ST.sketchVer++; ST.straightened = false; stFitSketch(); stRender(); });
  $('#stTwoPts').addEventListener('click', () => { ST.align = { step: 0, ref: [], sk: [] }; ST.corners = null; stRender(); });
  $('#stAlignCancel').addEventListener('click', () => { ST.align = null; stRender(); });
  $('#stFitSk').addEventListener('click', () => { stFitSketch(); stRender(); });
  $$('#stViewSeg button').forEach(b => b.addEventListener('click', () => { ST.view = b.dataset.v; stSave(); stRender(); }));
  $('#stOpacity').addEventListener('input', e => { ST.opacity = Number(e.target.value) / 100; $('#stOpacityV').textContent = e.target.value + '%'; stDraw(); });
  $('#stOpacity').addEventListener('change', stSave);
  let strengthT = 0;
  $('#stStrength').addEventListener('input', e => { ST.strength = Number(e.target.value); $('#stStrengthV').textContent = e.target.value; clearTimeout(strengthT); strengthT = setTimeout(() => { stSave(); stDraw(); }, 120); });
  $('#stRefFade').addEventListener('input', e => { ST.refFade = Number(e.target.value) / 100; $('#stRefFadeV').textContent = e.target.value + '%'; stDraw(); });
  $('#stRot').addEventListener('input', e => {
    const ref = stCmpRef(); if (!ref) return;
    stRotateAbout(ref.w / 2, ref.h / 2, Number(e.target.value) * Math.PI / 180 - ST.xf.r);
    $('#stRotV').textContent = e.target.value + '°'; stDraw();
  });
  const peek = on => { ST.peek = on; stDraw(); };
  const pk = $('#stPeek');
  pk.addEventListener('pointerdown', e => { e.preventDefault(); peek(true); });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) pk.addEventListener(t, () => peek(false));
  let flickT = 0;
  $('#stFlicker').addEventListener('change', e => {
    ST.flicker = e.target.checked; clearInterval(flickT); ST.flickOn = true;
    if (ST.flicker) flickT = setInterval(() => { if (S.view !== 'studio' || !ST.flicker) return; ST.flickOn = !ST.flickOn; stDraw(); }, 550);
    stDraw();
  });
  $('#stGrayBtn').addEventListener('click', () => { ST.look.gray = !ST.look.gray; stRender(); });
  $('#stMirrorBtn').addEventListener('click', () => { ST.look.mirror = !ST.look.mirror; stRender(); });
  $('#stValuesBtn').addEventListener('click', () => { $('#stValues').hidden = !$('#stValues').hidden; stRender(); });
  $('#stValuesClose').addEventListener('click', () => { $('#stValues').hidden = true; stRender(); });
  $$('#stStepsSeg button').forEach(b => b.addEventListener('click', () => { ST.look.steps = Number(b.dataset.s); stRender(); }));
  let lookT = 0;
  for (const [id, key] of [['stSplit', 'split'], ['stBright', 'bright'], ['stContrast', 'contrast'], ['stBlur', 'blur']]) {
    $('#' + id).addEventListener('input', e => {
      ST.look[key] = Number(e.target.value); $('#' + id + 'V').textContent = e.target.value;
      clearTimeout(lookT); lookT = setTimeout(stDraw, 60);
    });
  }
  $('#stLookReset').addEventListener('click', () => { Object.assign(ST.look, { gray: false, steps: 0, split: 0, bright: 0, contrast: 0, blur: 0 }); stRender(); });
  $('#stCmpDownload').addEventListener('click', () => stDownload(stCompareExport(), 'sketch-check.jpg'));
  $('#stSketchClear').addEventListener('click', () => { ST.sketch = ST.sketchOrig = null; ST.layers = null; ST.corners = ST.align = null; stRender(); });
  document.addEventListener('keyup', e => { if (e.code === 'Space' && ST.peek && S.view === 'studio') peek(false); });
}
let stWheelT = 0;
/* Studio keys; returns true when the key was used. */
function stKey(e) {
  if (!ST.ref) return false;
  const k = e.key;
  if (k === 'Escape' && (ST.align || ST.corners)) { ST.align = null; ST.corners = null; stRender(); return true; }
  const lk = k.toLowerCase(), dir = ST.look.mirror ? -1 : 1;
  if (lk === 'g') { $('#stGrayBtn').click(); return true; }
  if (lk === 'f') { $('#stMirrorBtn').click(); return true; }
  if (lk === 'v') { ST.look.steps = { 0: 2, 2: 3, 3: 5, 5: 0 }[ST.look.steps]; stRender(); return true; }
  if (ST.mode === 'compose' && !ST.fixed) {
    const step = (e.shiftKey ? 0.05 : 0.01), f = ST.frame;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (mv) { ST.frame = stClampFrame(Object.assign({}, f, { x: f.x + dir * mv[0] * step * ST.ref.w, y: f.y + mv[1] * step * ST.ref.h })); stRender(); return true; }
    if (k === '+' || k === '=') { stScaleFrame(1.05); stRender(); return true; }
    if (k === '-') { stScaleFrame(1 / 1.05); stRender(); return true; }
    if (k === 'Enter') { $('#stFix').click(); return true; }
    return false;
  }
  if (ST.mode === 'compare' && ST.sketch && !ST.align && !ST.corners) {
    const ref = stCmpRef(), L = ST.L || { k: 1 }, px = (e.shiftKey ? 10 : 1) / L.k;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (mv) { ST.xf.tx += dir * mv[0] * px; ST.xf.ty += mv[1] * px; stDraw(); return true; }
    if (k === '+' || k === '=') { stScaleAbout(ref.w / 2, ref.h / 2, e.shiftKey ? 1.05 : 1.01); stRender(); return true; }
    if (k === '-') { stScaleAbout(ref.w / 2, ref.h / 2, 1 / (e.shiftKey ? 1.05 : 1.01)); stRender(); return true; }
    if (k === '[' || k === ']') { stRotateAbout(ref.w / 2, ref.h / 2, (k === '[' ? -1 : 1) * (e.shiftKey ? 2 : 0.5) * Math.PI / 180); stRender(); return true; }
    if (e.code === 'Space') { if (!e.repeat) { ST.peek = true; stDraw(); } return true; }
  }
  return false;
}


/* ============ learn: curriculum and progress ============ */
/* The curriculum lives in assets/curriculum.json (built by tools/build_curriculum.py).
   Progress is kept in this browser: checked exercises in S.meta.learn.done, practice seconds per track in S.meta.learn.secs. */
const AIC_IIIF = 'https://www.artic.edu/iiif/2/';
const CUR = { data: null, loading: null, units: new Map(), ex: new Map(), term: new Map(), order: [], refs: new Map() };
const LN = { mode: LS.get('sketchhour.learnMode', 'path'), shown: '' };
function loadCurriculum() {
  if (CUR.data) return Promise.resolve(CUR.data);
  if (!CUR.loading) {
    CUR.loading = fetch(BASE + 'assets/curriculum.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('missing'))))
      .then(j => {
        for (const t of j.tracks) for (const u of t.units) { u.track = t; CUR.units.set(u.id, u); for (const e of u.ex) { e.unit = u; CUR.ex.set(e.id, e); } }
        j.path.forEach((ids, i) => ids.forEach(id => CUR.term.set(id, i + 1)));
        CUR.order = j.path.flat();
        CUR.data = j; return j;
      })
      .catch(e => { CUR.loading = null; throw e; });
  }
  return CUR.loading;
}
function setRefs(id) {
  let c = CUR.refs.get(id); if (c) return c;
  const s = CUR.data && CUR.data.sets[id]; if (!s) return [];
  c = s.items.map((it, i) => it.aic ? {
    id: `cur-${id}-${i}`, kind: 'image', cur: true, remote: true, setName: s.name, w: it.w, h: it.h,
    url: `${AIC_IIIF}${it.aic}/full/843,/0/default.jpg`, thumb: `${AIC_IIIF}${it.aic}/full/200,/0/default.jpg`,
    note: `${it.title} — ${it.artist}${it.date ? ', ' + it.date : ''}`, link: 'https://www.artic.edu/artworks/' + it.id
  } : {
    id: `cur-${id}-${i}`, kind: 'image', cur: true, setName: s.name, w: it.w, h: it.h,
    url: BASE + it.src, thumb: BASE + it.src, note: s.name
  });
  CUR.refs.set(id, c); return c;
}
function lnTag(l) { return l ? { track: l.track, unit: l.unit, ex: l.ex } : {}; }
function lnIsDone(id) { return !!S.meta.learn.done[id]; }
function lnSetDone(id, on) {
  const d = S.meta.learn.done;
  if (on) d[id] = d[id] || Date.now(); else delete d[id];
  persistMeta(); renderLearn();
}
function unitProg(u) { const n = u.ex.length, d = u.ex.filter(e => lnIsDone(e.id)).length; return { d, n, done: d === n }; }
function trackProg(t) { let d = 0, n = 0; for (const u of t.units) { const p = unitProg(u); d += p.d; n += p.n; } return { d, n }; }
function trackMins(id) { return (S.meta.learn.secs[id] || 0) / 60; }
function nextUnit() { for (const id of CUR.order) { const u = CUR.units.get(id); if (!unitProg(u).done) return u; } return null; }
function unitLabel(u) { return `${u.track.name} ${u.level} · ${u.title}`; }
function planText(plan) { return plan.map(([n, d]) => `${n} × ${dlabel(d)}`).join(' + '); }
function exMeta(e) {
  if (e.t === 'session') { const m = e.plan.reduce((a, [n, d]) => a + n * d, 0) / 60; return `${CUR.data.sets[e.set].name} · ${planText(e.plan)} · ${minsTxt(m * 60)} min${e.gray ? ' · grayscale' : ''}`; }
  if (e.t === 'board') { const m = e.plan.reduce((a, [n, d]) => a + n * d, 0) / 60; return `Your ${boardName(e.board)} board · ${planText(e.plan)} · ${minsTxt(m * 60)} min`; }
  if (e.t === 'study') return `${CUR.data.sets[e.set].name} · one reference · ${e.min} min study timer`;
  if (e.t === 'studio') return `Studio · ${CUR.data.sets[e.set].name} · ${e.min} min${e.values ? ` · ${e.values} values` : ''}`;
  return `Timer · ${e.min} min · no reference`;
}
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
async function lnStart(e) {
  const u = e.unit, learn = { track: u.track.id, unit: u.id, ex: e.id };
  const label = `${u.track.name} ${u.level}: ${u.title}`;
  if (e.t === 'session' || e.t === 'board') {
    const base = e.t === 'board' ? poolFor(e.board) : setRefs(e.set);
    if (!base.length) { toast(`Your ${boardName(e.board)} board is empty. Add references in Library or Sources first.`); return; }
    const plan = [];
    for (const [n, d] of e.plan) for (let i = 0; i < n; i++) plan.push({ t: 'pose', dur: d });
    runSession(base, plan, { label, shuffle: true, flips: false, gray: !!e.gray, grid: false, sound: CFG.sound, learn, again: () => lnStart(e) });
  } else if (e.t === 'study') {
    const list = setRefs(e.set);
    openViewer(list, Math.floor(Math.random() * list.length));
    tSet(e.min * 60, label, learn); tToggle();
  } else if (e.t === 'studio') {
    const r = pick(setRefs(e.set));
    ST.mode = 'compose'; location.hash = '#studio';
    await stLoadRef(srcOf(r), r.note, !!r.remote);
    ST.learn = learn; ST.drawDur = e.min * 60;
    if (e.values) { ST.look.steps = e.values; if ($('#stValues').hidden) $('#stValuesBtn').click(); }
    stRender(); renderTimer();
    toast(e.values ? `Values are set to ${e.values}. Find the composition, fix it, then press Start drawing.` : 'Find the composition, fix it, then press Start drawing.');
  } else {
    tSet(e.min * 60, label, learn); location.hash = '#timer'; tToggle();
  }
}

function renderLearn() {
  if (S.view !== 'learn') return;
  if (!CUR.data) {
    $('#lnPath').replaceChildren(h('p', { class: 'empty' }, 'Loading the curriculum…'));
    loadCurriculum().then(renderLearn, () => $('#lnPath').replaceChildren(h('p', { class: 'empty' }, "The curriculum couldn't be loaded. Check your connection and reload the page.")));
    return;
  }
  const id = (location.hash.split('/')[1] || '');
  const u = CUR.units.get(id);
  $('#lnOverview').hidden = !!u; $('#lnUnit').hidden = !u;
  if (u) renderUnit(u); else renderOverview();
  if (LN.shown !== id) { LN.shown = id; window.scrollTo(0, 0); }
}
function unitButton(u, withTrack) {
  const p = unitProg(u);
  return h('button', { type: 'button', class: 'ln-u' + (p.done ? ' done' : ''), onclick: () => { location.hash = '#learn/' + u.id; } },
    h('small', null, withTrack ? `${u.track.name} · Level ${u.level}` : `Level ${u.level}`),
    h('b', null, u.title),
    h('span', { class: 'ln-dots', 'aria-label': `${p.d} of ${p.n} exercises done` }, ...u.ex.map(e => h('i', { class: lnIsDone(e.id) ? 'on' : '' }))));
}
function renderOverview() {
  const d = CUR.data, nx = nextUnit();
  $$('#lnModeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === LN.mode)));
  // next up
  const next = $('#lnNext');
  if (nx) {
    const p = unitProg(nx), term = CUR.term.get(nx.id);
    next.replaceChildren(
      h('span', { class: 'lbl' }, p.d ? `Continue · Term ${term} of ${d.path.length}` : `Next up · Term ${term} of ${d.path.length}`),
      h('h3', null, unitLabel(nx)),
      h('p', null, nx.goal),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => { location.hash = '#learn/' + nx.id; } }, icon('play'), p.d ? 'Continue' : 'Open unit'),
        h('span', { class: 'muted' }, `${p.d} of ${p.n} exercises done`)),
      (() => { const e = nx.ex.find(x => x.set); return e ? h('div', { class: 'ln-peek', 'aria-hidden': 'true' }, ...setRefs(e.set).slice(0, 8).map(r => h('img', { src: r.thumb, alt: '', loading: 'lazy', width: Math.round(96 * r.w / r.h), height: 96 }))) : null; })());
  } else {
    next.replaceChildren(h('span', { class: 'lbl' }, 'Curriculum complete'), h('h3', null, 'Every unit is done.'),
      h('p', null, 'Go round again with longer poses, or pick any track to keep practicing.'));
  }
  // progress
  let exD = 0, exN = 0, uD = 0, secs = 0;
  for (const t of d.tracks) { const p = trackProg(t); exD += p.d; exN += p.n; uD += t.units.filter(u => unitProg(u).done).length; secs += S.meta.learn.secs[t.id] || 0; }
  $('#lnKEx').textContent = `${exD}/${exN}`; $('#lnKUnits').textContent = `${uD}/${CUR.units.size}`; $('#lnKMin').textContent = String(Math.round(secs / 60));
  $('#lnSkills').replaceChildren(...d.tracks.map(t => {
    const p = trackProg(t);
    return h('li', { title: `${p.d} of ${p.n} exercises` }, h('span', null, t.name),
      h('span', { class: 'ln-bar' }, h('i', { style: `width:${p.n ? (p.d / p.n * 100).toFixed(1) : 0}%` })),
      h('span', null, `${Math.round(trackMins(t.id))} min`));
  }));
  // path / tracks
  const nowTerm = nx ? CUR.term.get(nx.id) : 0;
  $('#lnPath').hidden = LN.mode !== 'path'; $('#lnTracks').hidden = LN.mode !== 'tracks';
  if (LN.mode === 'path') {
    $('#lnPath').replaceChildren(...d.path.map((ids, i) => h('section', { class: 'ln-term' + (i + 1 === nowTerm ? ' now' : '') },
      h('span', { class: 'lbl' }, `Term ${i + 1}`),
      h('div', { class: 'ln-term-units' }, ...ids.map(id => unitButton(CUR.units.get(id), true))))));
  } else {
    $('#lnTracks').replaceChildren(...d.tracks.map(t => {
      const p = trackProg(t);
      return h('section', { class: 'card ln-track' },
        h('h3', null, t.name), h('p', { class: 'muted' }, t.blurb),
        h('span', { class: 'ln-bar' }, h('i', { style: `width:${p.n ? (p.d / p.n * 100).toFixed(1) : 0}%` })),
        h('span', { class: 'meta' }, `${p.d} of ${p.n} exercises · ${Math.round(trackMins(t.id))} min practiced`),
        h('ol', { class: 'ln-levels' }, ...t.units.map(u => {
          const up = unitProg(u);
          return h('li', null, h('button', { type: 'button', onclick: () => { location.hash = '#learn/' + u.id; } },
            h('span', { class: 'n' }, String(u.level)), h('span', null, u.title),
            h('span', { class: 'ln-state' + (up.done ? ' done' : '') }, up.done ? 'Done' : `${up.d}/${up.n}`)));
        })));
    }));
  }
  $('#lnFoot').textContent = `${d.pace} Rendered references are made by Sketch Hour; museum references are public-domain works from the Art Institute of Chicago. Progress is saved in this browser.`;
}
function renderUnit(u) {
  const d = CUR.data, term = CUR.term.get(u.id), i = CUR.order.indexOf(u.id);
  const prev = CUR.units.get(CUR.order[i - 1]), next = CUR.units.get(CUR.order[i + 1]);
  const p = unitProg(u);
  const sets = [...new Set(u.ex.filter(e => e.set).map(e => e.set))];
  $('#lnUnit').replaceChildren(
    h('button', { type: 'button', class: 'linkish ln-back', onclick: () => { location.hash = '#learn'; } }, '← All units'),
    h('header', { class: 'ln-unit-head' },
      h('span', { class: 'lbl' }, `${u.track.name} · Level ${u.level} of ${u.track.units.length} · Term ${term}`),
      h('h2', null, u.title),
      h('p', null, u.goal)),
    h('section', null, h('div', { class: 'lbl', style: 'margin-bottom:8px' }, 'Look for'), h('ul', { class: 'ln-look' }, ...u.look.map(x => h('li', null, x)))),
    h('section', null,
      h('div', { class: 'lbl', style: 'margin-bottom:8px' }, `Exercises · ${p.d} of ${p.n} done`),
      h('ol', { class: 'ln-exs' }, ...u.ex.map(e => {
        const done = lnIsDone(e.id);
        const cb = h('input', { type: 'checkbox', 'aria-label': `Mark “${e.title}” done` });
        cb.checked = done; cb.addEventListener('change', () => lnSetDone(e.id, cb.checked));
        return h('li', { class: 'ln-ex' + (done ? ' done' : '') }, cb,
          h('div', null, h('b', null, e.title), h('span', { class: 'how' }, e.how), h('span', { class: 'meta' }, exMeta(e))),
          h('button', { type: 'button', class: 'btn' + (done ? '' : ' primary'), onclick: () => lnStart(e) }, icon('play'), done ? 'Again' : 'Start'));
      }))),
    sets.length ? h('section', { class: 'ln-refs' }, h('div', { class: 'lbl' }, 'References in this unit'), ...sets.map(sid => {
      const s = d.sets[sid], list = setRefs(sid);
      return h('div', { class: 'ln-set' },
        h('div', { class: 'ln-set-head' }, h('b', null, s.name), h('span', { class: 'ln-credit' }, `${list.length} images · ${s.credit}`)),
        h('div', { class: 'ln-strip' }, ...list.slice(0, 24).map((r, k) => h('button', { type: 'button', title: r.note, onclick: () => openViewer(list, k) },
          h('img', { src: r.thumb, alt: r.note, loading: 'lazy', width: Math.round(120 * r.w / r.h), height: 120 })))));
    })) : null,
    h('nav', { class: 'ln-nav' },
      prev ? h('button', { type: 'button', class: 'btn', onclick: () => { location.hash = '#learn/' + prev.id; } }, '← ' + unitLabel(prev)) : h('span'),
      next ? h('button', { type: 'button', class: 'btn', onclick: () => { location.hash = '#learn/' + next.id; } }, unitLabel(next) + ' →') : h('span')));
}

/* ============ routing + render ============ */
const VIEWS = ['practice', 'learn', 'library', 'timer', 'sources', 'studio'];
function route() {
  const v = (location.hash || '').slice(1).split('/')[0];
  const next = VIEWS.includes(v) ? v : 'practice';
  const changed = next !== S.view; S.view = next;
  for (const n of VIEWS) $('#v-' + n).hidden = n !== S.view;
  $$('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.view === S.view ? 'page' : 'false'));
  if (changed) window.scrollTo(0, 0);
  if (S.view === 'studio') stRender();
  if (S.view === 'learn') renderLearn();
}
let rq = 0;
function renderAll() {
  if (rq) return;
  rq = requestAnimationFrame(() => { rq = 0; renderPractice(); renderLibrary(); renderSources(); renderLearn(); });
}

/* ============ events ============ */
function bind() {
  window.addEventListener('hashchange', route);
  // practice
  $$('#modeSeg button').forEach(b => b.addEventListener('click', () => { CFG.mode = b.dataset.mode; saveCfg(); renderPractice(); }));
  $('#durCustom').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (v > 0) { CFG.dur = Math.max(10, Math.round(v * 60)); saveCfg(); renderPractice(); }
  });
  [['optShuffle', 'shuffle'], ['optGray', 'gray'], ['optFlips', 'flips'], ['optGrid', 'grid'], ['optSound', 'sound']].forEach(([id, k]) =>
    $('#' + id).addEventListener('change', e => { CFG[k] = e.target.checked; saveCfg(); }));
  $('#startBtn').addEventListener('click', startSession);
  // learn
  $$('#lnModeSeg button').forEach(b => b.addEventListener('click', () => { LN.mode = b.dataset.m; LS.set('sketchhour.learnMode', LN.mode); renderLearn(); }));
  // library
  $('#fileIn').addEventListener('change', e => { addFiles(e.target.files, { board: S.libBoard }); e.target.value = ''; });
  $('#libPractice').addEventListener('click', () => { CFG.boards = [S.libBoard]; saveCfg(); location.hash = '#practice'; renderPractice(); });
  $('#boardForm').addEventListener('submit', submitBoardForm);
  $('#boardFormCancel').addEventListener('click', () => { $('#boardForm').hidden = true; boardFormMode = null; });
  const lib = $('#v-library'), drop = $('#drop');
  const draggy = e => { const t = Array.from(e.dataTransfer ? e.dataTransfer.types : []); return t.includes('Files') || t.includes('text/uri-list'); };
  ['dragenter', 'dragover'].forEach(t => lib.addEventListener(t, e => { if (draggy(e)) { e.preventDefault(); drop.classList.add('over'); } }));
  lib.addEventListener('dragleave', e => { if (!lib.contains(e.relatedTarget)) drop.classList.remove('over'); });
  lib.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('over');
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length) addFiles(dt.files, { board: S.libBoard });
    else if (dt.getData('text/uri-list') || dt.getData('text/plain')) toast("Images dragged from another site can't be downloaded here. Right-click the image → Copy image, then paste.");
  });
  window.addEventListener('dragover', e => { if (draggy(e)) e.preventDefault(); });
  window.addEventListener('drop', e => { if (!lib.contains(e.target)) e.preventDefault(); });
  // global paste: adds to the current library board
  document.addEventListener('paste', e => {
    if (isTyping(e.target) || P.active || !$('#viewer').hidden) return;
    if (S.view === 'studio') {
      const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
      const it = items.find(i => i.kind === 'file' && /^image\//.test(i.type));
      if (it) { e.preventDefault(); stHandleFile(it.getAsFile()); }
      else toast('Nothing to paste. Copy an image or take a screenshot first.');
      return;
    }
    const board = S.view === 'library' ? S.libBoard : S.libBoard;
    handlePaste(e.clipboardData, { board });
  });
  // sources: pinterest
  const pinBoard = $('#pinBoard');
  pinBoard.addEventListener('change', () => LS.set('sketchhour.pinBoard', pinBoard.value));
  const bindPaste = (el, opts) => {
    el.addEventListener('paste', e => { e.preventDefault(); e.stopPropagation(); handlePaste(e.clipboardData, opts()); el.value = ''; });
    el.addEventListener('input', () => { el.value = ''; });
    el.addEventListener('dragover', e => e.preventDefault());
    el.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files; if (f && f.length) addFiles(f, opts()); else toast("Drag in files from your computer, or copy the image and paste it."); });
  };
  bindPaste($('#pinPaste'), () => ({
    board: pinBoard.value, source: 'pinterest', link: $('#pinLink').value.trim(),
    after: () => { $('#pinLink').value = ''; },
    onUrl: u => { if (/pinterest\.|pin\.it/.test(u)) { $('#pinLink').value = u; toast('Pin link noted. Now copy the image itself and paste it.'); return true; } return false; }
  }));
  $('#pinQuick').replaceChildren(...PIN_SEARCHES.map(q => h('a', { href: 'https://www.pinterest.com/search/pins/?q=' + encodeURIComponent(q), target: '_blank', rel: 'noopener' }, q)));
  // sources: film
  const filmGo = $('#filmGo');
  const setFilmLink = () => { const q = $('#filmQ').value.trim(); filmGo.href = q ? 'https://film-grab.com/?s=' + encodeURIComponent(q) : 'https://film-grab.com/'; };
  $('#filmQ').addEventListener('input', () => { setFilmLink(); if (!$('#filmTitle').value) $('#filmTitle').placeholder = $('#filmQ').value || 'e.g. In the Mood for Love'; });
  $('#filmSearch').addEventListener('submit', e => { e.preventDefault(); setFilmLink(); filmGo.click(); });
  bindPaste($('#filmPaste'), () => ({ board: 'film', source: 'filmgrab', note: ($('#filmTitle').value.trim() || $('#filmQ').value.trim()) }));
  // frame grabber
  const fv = $('#fgVid');
  $('#fgFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (FG.url) URL.revokeObjectURL(FG.url);
    FG.url = URL.createObjectURL(f); fv.src = FG.url; $('#fg').hidden = false;
    if (!$('#filmTitle').value) $('#filmTitle').value = f.name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ').slice(0, 80);
    e.target.value = '';
  });
  ['timeupdate', 'seeked', 'play', 'pause', 'loadedmetadata'].forEach(t => fv.addEventListener(t, fgUpdate));
  $('#fgSeek').addEventListener('input', e => { if (fv.duration) fv.currentTime = fv.duration * Number(e.target.value) / 1000; });
  $('#fgPlay').addEventListener('click', () => { if (fv.paused) fv.play().catch(() => {}); else fv.pause(); });
  $('#fgBackF').addEventListener('click', () => fgFrame(-1));
  $('#fgFwdF').addEventListener('click', () => fgFrame(1));
  $('#fgBack1').addEventListener('click', () => { fv.pause(); fv.currentTime = Math.max(0, fv.currentTime - 1); });
  $('#fgFwd1').addEventListener('click', () => { fv.pause(); fv.currentTime = Math.min(fv.duration || 0, fv.currentTime + 1); });
  $('#fgFps').addEventListener('change', e => { FG.fps = Number(e.target.value); fgUpdate(); });
  $('#fgGrab').addEventListener('click', fgGrab);
  // sources: places
  $$('[data-study]').forEach(b => b.addEventListener('click', () => {
    const name = $('#placeName').value.trim();
    startStudy(Number(b.dataset.study), name ? `Study: ${name}` : 'Perspective study');
  }));
  bindPaste($('#placePaste'), () => ({ board: 'places', source: 'mapcrunch', note: $('#placeName').value.trim() }));

  // timer
  $('#tPresets').replaceChildren(...T_PRESETS.map(s => h('button', { type: 'button', class: 'chip', 'data-sec': String(s), onclick: () => tSet(s) }, dlabel(s))));
  $('#tStart').addEventListener('click', tToggle);
  $('#tReset').addEventListener('click', tReset);
  $('#tPlus').addEventListener('click', () => { T.left += 60; if (!T.running && T.left > T.total) { T.total = T.left; saveTimer(); } renderTimer(); });
  const custom = () => { const m = Math.max(0, parseInt($('#tMin').value, 10) || 0), s = Math.min(59, Math.max(0, parseInt($('#tSec').value, 10) || 0)); if (m * 60 + s >= 5) tSet(m * 60 + s); };
  $('#tMin').addEventListener('change', custom); $('#tSec').addEventListener('change', custom);
  $('#tRounds').addEventListener('change', e => { T.rounds = Number(e.target.value); if (T.round > T.rounds) T.round = T.rounds; saveTimer(); renderTimer(); });
  $('#tRest').addEventListener('change', e => { T.rest = Number(e.target.value); saveTimer(); renderTimer(); });
  $('#tSound').addEventListener('change', e => { T.sound = e.target.checked; saveTimer(); });

  // player
  const pl = $('#player');
  pl.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') poke(); });
  $('#plFrame').addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') { if (pl.classList.contains('idle')) poke(); else if (P.running) pl.classList.add('idle'); } });
  $('#plPause').addEventListener('click', () => setPaused(P.running));
  $('#plNext').addEventListener('click', () => advance(1));
  $('#plPrev').addEventListener('click', () => advance(-1));
  $('#plSkipBreak').addEventListener('click', () => advance(1));
  $('#plGray').addEventListener('click', () => { P.gray = !P.gray; applyPlayerLooks(); syncPlayerButtons(); });
  $('#plFlip').addEventListener('click', () => { P.mirror = !P.mirror; applyPlayerLooks(); syncPlayerButtons(); });
  $('#plGridBtn').addEventListener('click', () => { P.grid = !P.grid; applyPlayerLooks(); syncPlayerButtons(); });
  $('#plSound').addEventListener('click', () => { P.sound = !P.sound; if (P.sound) audio(); syncPlayerButtons(); });
  const fsBtn = $('#plFs');
  if (!document.fullscreenEnabled) fsBtn.hidden = true;
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else pl.requestFullscreen().catch(() => toast("Fullscreen isn't available here."));
  });
  $('#plEndBtn').addEventListener('click', () => finishSession(false));
  $('#plAgain').addEventListener('click', () => { const again = P.again; closePlayer(); (again || startSession)(); });
  $('#plDone').addEventListener('click', () => { const l = P.learn; closePlayer(); location.hash = l ? '#learn/' + l.unit : '#practice'; });
  $('#plImg').addEventListener('load', placePlGrid);
  $('#plVid').addEventListener('loadedmetadata', placePlGrid);

  // viewer
  const st = $('#vwStage'), ptrs = new Map(); let pinch = null;
  st.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    st.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = Array.from(ptrs.values()); pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; }
  });
  st.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) { V.x += e.clientX - p.x; V.y += e.clientY - p.y; placePan(); }
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2 && pinch) {
      const [a, b] = Array.from(ptrs.values()), d = Math.hypot(a.x - b.x, a.y - b.y), rc = st.getBoundingClientRect();
      zoomAt(d / pinch.d, (a.x + b.x) / 2 - rc.left, (a.y + b.y) / 2 - rc.top); pinch.d = d;
    }
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  st.addEventListener('wheel', e => { e.preventDefault(); const rc = st.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rc.left, e.clientY - rc.top); }, { passive: false });
  st.addEventListener('dblclick', e => { if (e.target.closest('button')) return; if (V.z > 1.01) fitView(); else { const rc = st.getBoundingClientRect(); zoomAt(2.5, e.clientX - rc.left, e.clientY - rc.top); } });
  $('#vwClose').addEventListener('click', closeViewer);
  $('#vwPrevRef').addEventListener('click', () => viewerStep(-1));
  $('#vwNextRef').addEventListener('click', () => viewerStep(1));
  $('#vwZin').addEventListener('click', () => zoomAt(1.4));
  $('#vwZout').addEventListener('click', () => zoomAt(1 / 1.4));
  $('#vwZoom').addEventListener('click', fitView);
  $('#vwFlip').addEventListener('click', () => { V.flip = !V.flip; applyViewerLooks(); });
  $('#vwGray').addEventListener('click', () => { V.gray = !V.gray; applyViewerLooks(); });
  $('#vwGridBtn').addEventListener('click', () => { V.grid = !V.grid; applyViewerLooks(); });
  $('#vwValues').addEventListener('click', cycleValues);
  $('#vwThr').addEventListener('input', e => { V.thr = Number(e.target.value); renderValues(); });
  $('#vwFPrev').addEventListener('click', () => frameStep(-1));
  $('#vwFNext').addEventListener('click', () => frameStep(1));
  $('#vwFPlay').addEventListener('click', framePlay);
  $('#vwSpeed').addEventListener('click', () => { V.speed = SPEEDS[(SPEEDS.indexOf(V.speed) + 1) % SPEEDS.length]; $('#vwVid').playbackRate = V.speed; updFrameUI(); });
  ['timeupdate', 'seeked', 'play', 'pause'].forEach(t => $('#vwVid').addEventListener(t, updFrameUI));
  $('#vwEditBtn').addEventListener('click', () => { if ($('#vwEdit').hidden) openEdit(); else $('#vwEdit').hidden = true; });
  $('#vwEditCancel').addEventListener('click', () => { $('#vwEdit').hidden = true; });
  $('#vwEdit').addEventListener('submit', saveEdit);
  $('#vwDel').addEventListener('click', deleteViewed);
  $('#vwCompose').addEventListener('click', () => stFromViewer('compose'));
  $('#vwCompare').addEventListener('click', () => stFromViewer('compare'));
  stBindStudio();
  $('#vwStudyBtn').addEventListener('click', () => {
    if (T.running) { tToggle(); return; }
    const r = V.list[V.i];
    if (T.left > 0 && T.left < T.total && (T.label || '').startsWith('Study')) { tToggle(); return; }
    tSet(Number($('#vwStudyDur').value), 'Study' + (r && r.note ? ': ' + r.note.slice(0, 40) : ''));
    tToggle();
  });

  // keyboard
  document.addEventListener('keydown', e => {
    if (!$('#modal').hidden) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (P.active && !$('#player').hidden) {
      if (!$('#plEnd').hidden) {
        if (e.key === 'Escape') { e.preventDefault(); closePlayer(); }
        return;
      }
      const k = e.key.toLowerCase();
      if (e.code === 'Space') { e.preventDefault(); setPaused(P.running); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); advance(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
      else if (k === 'g') $('#plGray').click();
      else if (k === 'f') $('#plFlip').click();
      else if (k === 't') $('#plGridBtn').click();
      else if (k === 's') $('#plSound').click();
      else if (e.key === 'Escape' && !document.fullscreenElement) { e.preventDefault(); finishSession(false); }
      poke();
      return;
    }
    if (!$('#viewer').hidden) {
      if (isTyping(e.target)) { if (e.key === 'Escape') { $('#vwEdit').hidden = true; } return; }
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') { e.preventDefault(); if (!$('#vwEdit').hidden) $('#vwEdit').hidden = true; else closeViewer(); }
      else if (e.key === 'ArrowRight') viewerStep(1);
      else if (e.key === 'ArrowLeft') viewerStep(-1);
      else if (k === 'f') $('#vwFlip').click();
      else if (k === 'g') $('#vwGray').click();
      else if (k === 't') $('#vwGridBtn').click();
      else if (k === 'v') cycleValues();
      else if (e.key === '+' || e.key === '=') zoomAt(1.4);
      else if (e.key === '-') zoomAt(1 / 1.4);
      else if (e.key === '0') fitView();
      else if (e.key === ',') frameStep(-1);
      else if (e.key === '.') frameStep(1);
      else if (e.code === 'Space') { e.preventDefault(); framePlay(); }
      return;
    }
    if (S.view === 'studio' && !isTyping(e.target)) {
      if (stKey(e)) e.preventDefault();
      return;
    }
    if (S.view === 'timer' && !isTyping(e.target)) {
      if (e.code === 'Space') { e.preventDefault(); tToggle(); }
      else if (e.key.toLowerCase() === 'r') tReset();
    }
  });
  window.addEventListener('resize', () => {
    if (!$('#viewer').hidden) { const z = V.z; layoutViewer(); V.z = z; placePan(); }
    if (P.active) placePlGrid();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ((P.active && !P.done && P.running) || T.running)) keepAwake(true);
  });
}

/* ============ start ============ */
async function init() {
  bind(); route(); renderAll(); renderTimer(); renderLog();
  genSamples();
  await Promise.all([Local.start(), loadPublished()]);
  S.loaded = true;
  renderAll();
  readyResolve();
}
init();
})();
