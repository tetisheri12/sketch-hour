// Every reference image Sketch Hour ships, grouped by set folder.
const poses = require('./poses.js');
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pad = n => String(n).padStart(2, '0');
const jobs = [];
let i = 0;
for (const j of poses.filter(j => j.name.startsWith('fig-'))) jobs.push(Object.assign({}, j, { name: 'fig-gesture/' + pad(++i) }));
i = 0;
for (const j of poses.filter(j => j.name.startsWith('fs-'))) jobs.push(Object.assign({}, j, { name: 'fig-foreshort/' + pad(++i) }));

// heads: turns and tilts
const r = rng(11);
const angles = [];
for (const yaw of [-80, -55, -30, -10, 10, 30, 55, 80]) for (const pitch of [-22, 0, 22]) angles.push([yaw, pitch]);
angles.sort(() => r() - 0.5);
angles.slice(0, 24).forEach(([yaw, pitch], k) => jobs.push({ name: 'head-lines/' + pad(k + 1), type: 'head', yaw: yaw + (r() - 0.5) * 8, pitch: pitch + (r() - 0.5) * 8, roll: (r() - 0.5) * 16, lines: true, w: 1100, h: 1350 }));
const r2 = rng(23);
for (let k = 0; k < 24; k++) jobs.push({ name: 'head-forms/' + pad(k + 1), type: 'head', yaw: (r2() - 0.5) * 170, pitch: (r2() - 0.5) * 55, roll: (r2() - 0.5) * 24, keyDir: [r2() < 0.5 ? -2.4 : 2.4, 2.4, 2.8], w: 1100, h: 1350 });
const LIGHTS = [
  { keyDir: [-3, 1.2, 1.2], fill: 0.18, key: 3.2, bg: 0x2b2927 },   // side light
  { keyDir: [-1.6, 3, 2], fill: 0.25, key: 3.0, bg: 0x3a3733 },     // classic 45 degrees
  { keyDir: [0.4, 3.4, 0.6], fill: 0.2, key: 3.2, bg: 0x2b2927 },   // top light
  { keyDir: [2.8, 0.8, -1.4], fill: 0.22, key: 3.4, bg: 0x1f1e1c }, // rim from behind
  { keyDir: [0.6, -2.2, 2.6], fill: 0.2, key: 2.8, bg: 0x2b2927 },  // from below
  { keyDir: [2.4, 1.6, 2.2], fill: 0.35, key: 2.6, bg: 0xb9b2a7 }   // soft light on a light ground
];
const r3 = rng(37);
for (let k = 0; k < 18; k++) jobs.push(Object.assign({ name: 'head-light/' + pad(k + 1), type: 'head', yaw: (r3() - 0.5) * 120, pitch: (r3() - 0.5) * 30, roll: (r3() - 0.5) * 10, w: 1100, h: 1350 }, LIGHTS[k % LIGHTS.length]));

// simple forms under one light
const SHAPES = ['sphere', 'cube', 'cylinder', 'cone', 'egg', 'torus', 'prism', 'pyramid'];
const FL = [[-3, 3, 1], [3, 2.2, 2.4], [-1, 4, -2]];
let n = 0;
for (const shape of SHAPES) FL.forEach((keyDir, li) => jobs.push({ name: 'forms-light/' + pad(++n), type: 'forms', shape, keyDir, rot: 20 + li * 15, lay: shape === 'cylinder' && li === 2, w: 1400, h: 1050 }));
// still lifes with light, middle and dark objects
const SL = [[-3, 3.2, 2], [3, 3, 1.6], [-2.2, 4, -0.6], [0.6, 3.2, 3]];
for (let k = 0; k < 16; k++) jobs.push({ name: 'still-life/' + pad(k + 1), type: 'still', seed: 100 + k, keyDir: SL[k % 4], az: [0, 18, -22, 8][k % 4], w: 1500, h: 1100 });

// perspective
n = 0;
for (let k = 0; k < 8; k++) jobs.push({ name: 'persp-boxes/' + pad(++n), type: 'boxes', seed: 200 + k, mode: 'one', eye: [1.2, 3.2, 0.6, 2.0][k % 4], float: k % 3 === 2, w: 1500, h: 1050 });
for (let k = 0; k < 8; k++) jobs.push({ name: 'persp-boxes/' + pad(++n), type: 'boxes', seed: 300 + k, mode: 'two', rot: 25 + k * 6, eye: [1.4, 3.4, 0.5, 2.2][k % 4], float: k % 3 === 1, w: 1500, h: 1050 });
for (let k = 0; k < 8; k++) jobs.push({ name: 'persp-boxes/' + pad(++n), type: 'boxes', seed: 400 + k, mode: 'three', up: k % 2 === 0, eye: k % 2 === 0 ? 0.8 : 7, float: k % 2 === 0, fov: 60, w: 1300, h: 1300 });
for (let k = 0; k < 12; k++) jobs.push({ name: 'persp-cyl/' + pad(k + 1), type: 'cyl', seed: 500 + k, eye: [2.2, 3.6, 1.0][k % 3], float: k % 4 === 3, w: 1500, h: 1050 });
n = 0;
for (let k = 0; k < 8; k++) jobs.push({ name: 'persp-scenes/' + pad(++n), type: 'room', seed: 600 + k, oneP: k < 4, angled: k % 2 === 1, eye: [1.55, 1.1, 1.7, 2.4][k % 4], w: 1500, h: 1050 });
for (let k = 0; k < 8; k++) jobs.push({ name: 'persp-scenes/' + pad(++n), type: 'street', seed: 700 + k, eye: [1.6, 1.6, 8, 0.6][k % 4], camX: [1.5, -3.5, 0, 4][k % 4], turn: [0, 6, -4, -9][k % 4], up: [0, 0, -1.5, 1.5][k % 4], sunX: k % 2 ? -30 : 30, w: 1500, h: 1050 });

// color: warm light and cool light
for (let k = 0; k < 16; k++) jobs.push({ name: 'color-forms/' + pad(k + 1), type: 'color', seed: 800 + k, warm: k < 8, keyDir: [[-3, 2.4, 2], [3, 2, 1.4], [-2, 3.2, -1], [1, 2.6, 3]][k % 4], w: 1500, h: 1100 });
module.exports = jobs;
