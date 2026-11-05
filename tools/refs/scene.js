// Reference renderer for Sketch Hour: builds a scene from a job description and returns a WebP data URL.
import * as THREE from './node_modules/three/build/three.module.js';

const D = Math.PI / 180;
let renderer = null;
function getRenderer(w, h) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);
  }
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  return renderer;
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------------------------------------------------------- materials */
const mat = (color, rough = 0.62, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra));
function shadowy(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

/* ---------------------------------------------------------------- mannequin */
// Figure faces +Z, character's left is +X, 1 unit = 1 m, about 1.78 m tall.
function capsuleBetween(len, r0, r1, m) {
  // a tapered limb hanging along -Y from the joint, with rounded ends
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 28, 1, true), m);
  body.position.y = -len / 2; g.add(body);
  const c0 = new THREE.Mesh(new THREE.SphereGeometry(r0, 24, 16), m); g.add(c0);
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 24, 16), m); c1.position.y = -len; g.add(c1);
  return g;
}
function ellipsoid(rx, ry, rz, m) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), m); s.scale.set(rx, ry, rz); return s; }

function buildMannequin(tone = 'wood') {
  const wood = tone === 'gray' ? mat(0xbdbab4, 0.7) : mat(0xd2ad84, 0.58);
  const joint = tone === 'gray' ? mat(0x8f8b85, 0.6) : mat(0x9b7652, 0.5);
  const J = {};
  const grp = (name, parent, x, y, z, order = 'YXZ') => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.order = order; parent.add(g); J[name] = g; return g; };
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; J.root = root;
  // pelvis
  const pelvis = grp('pelvis', root, 0, 0, 0);
  const pm = ellipsoid(0.165, 0.11, 0.115, wood); pm.position.y = -0.01; pelvis.add(pm);
  // waist + abdomen
  const waist = grp('waist', pelvis, 0, 0.08, 0);
  waist.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), joint), {}));
  const ab = ellipsoid(0.12, 0.075, 0.095, wood); ab.position.y = 0.07; waist.add(ab);
  // chest
  const chest = grp('chest', waist, 0, 0.14, 0);
  const cm = ellipsoid(0.17, 0.2, 0.115, wood); cm.position.y = 0.14; chest.add(cm);
  // neck + head
  const neck = grp('neck', chest, 0, 0.32, 0.0);
  const nm = capsuleBetween(0.09, 0.042, 0.045, wood); nm.rotation.x = Math.PI; neck.add(nm);
  const head = grp('head', neck, 0, 0.1, 0.005);
  const hm = ellipsoid(0.09, 0.118, 0.105, wood); hm.position.set(0, 0.1, 0.0); head.add(hm);
  const jaw = ellipsoid(0.07, 0.07, 0.075, wood); jaw.position.set(0, 0.045, 0.03); head.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 4), wood); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.085, 0.112); head.add(nose);
  // arms
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const sh = grp('shoulder' + side, chest, s * 0.2, 0.27, -0.005, 'ZXY');
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), joint));
    sh.add(capsuleBetween(0.27, 0.048, 0.04, wood));
    const el = grp('elbow' + side, sh, 0, -0.29, 0, 'ZXY');
    el.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 18, 12), joint));
    el.add(capsuleBetween(0.24, 0.037, 0.028, wood));
    const wr = grp('wrist' + side, el, 0, -0.255, 0, 'ZXY');
    wr.add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), joint));
    const hand = ellipsoid(0.026, 0.085, 0.048, wood); hand.position.y = -0.08; wr.add(hand);
    const thumb = ellipsoid(0.014, 0.036, 0.014, wood); thumb.position.set(0, -0.055, 0.045); thumb.rotation.x = -0.5; wr.add(thumb);
  }
  // legs
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const hip = grp('hip' + side, pelvis, s * 0.092, -0.06, 0, 'ZXY');
    hip.add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 14), joint));
    hip.add(capsuleBetween(0.4, 0.075, 0.052, wood));
    const kn = grp('knee' + side, hip, 0, -0.425, 0, 'ZXY');
    kn.add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 12), joint));
    kn.add(capsuleBetween(0.38, 0.052, 0.036, wood));
    const an = grp('ankle' + side, kn, 0, -0.405, 0, 'ZXY');
    an.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), joint));
    const foot = ellipsoid(0.042, 0.035, 0.125, wood); foot.position.set(0, -0.045, 0.06); an.add(foot);
  }
  return { root, J };
}

// Pose: degrees, semantic. Missing values are 0.
function applyPose(J, p) {
  const g = (k, d = 0) => (p[k] == null ? d : p[k]) * D;
  J.root.rotation.set(g('lean'), g('turn'), -g('tilt'));
  J.pelvis.rotation.set(0, 0, 0);
  J.waist.rotation.set(g('bend') * 0.45, g('twist') * 0.45, -g('side') * 0.45);
  J.chest.rotation.set(g('bend') * 0.55, g('twist') * 0.55, -g('side') * 0.55);
  J.neck.rotation.set(g('nod') * 0.4, g('look') * 0.4, -g('htilt') * 0.4);
  J.head.rotation.set(g('nod') * 0.6, g('look') * 0.6, -g('htilt') * 0.6);
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const a = p['arm' + side] || [0, 0, 0, 0];          // [forward raise, out, twist, elbow bend]
    const l = p['leg' + side] || [0, 0, 0, 0, 0];       // [forward raise, out, twist, knee bend, foot point]
    J['shoulder' + side].rotation.set(-a[0] * D, s * (a[2] || 0) * D, s * (a[1] + 6) * D);
    J['elbow' + side].rotation.set(-(a[3] || 0) * D, 0, 0);
    J['wrist' + side].rotation.set(-(a[4] || 0) * D, 0, s * (a[5] || 0) * D);
    J['hip' + side].rotation.set(-l[0] * D, s * (l[2] || 0) * D, s * (l[1] + 2) * D);
    J['knee' + side].rotation.set((l[3] || 0) * D, 0, 0);
    J['ankle' + side].rotation.set((l[4] || 0) * D, 0, 0);
  }
}

/* ---------------------------------------------------------------- head form */
function surfPoint(c, r, u, v) { // point on ellipsoid; u = around (0 = front), v = up angle
  return new THREE.Vector3(c.x + r.x * Math.sin(u) * Math.cos(v), c.y + r.y * Math.sin(v), c.z + r.z * Math.cos(u) * Math.cos(v));
}
function tubeThrough(pts, rad, m) {
  const runs = [[]];
  for (let i = 0; i < pts.length; i++) { if (i && pts[i].distanceTo(pts[i - 1]) > 0.07) runs.push([]); runs[runs.length - 1].push(pts[i]); }
  if (runs.length > 1) { const g = new THREE.Group(); for (const r of runs) if (r.length > 3) g.add(tubeThrough(r, rad, m)); return g; }
  const curve = new THREE.CatmullRomCurve3(pts, false);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 4), rad, 8, false), m);
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / (2 * sy * sy));
// One sculpted surface: a ball for the cranium with flat sides, a jaw that narrows to the chin,
// brow ridge, eye sockets, nose, cheekbones and the barrel of the mouth.
function sculptHeadGeometry() {
  const geo = new THREE.SphereGeometry(1, 160, 120);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;
    const front = sstep(-0.1, 0.6, z);              // 0 at the back, 1 on the face
    // cranium proportions
    x *= 0.74; y *= 0.92; z *= 0.88;
    // flat side planes
    const ax = Math.abs(x), lim = 0.62;
    if (ax > lim * 0.85) x = Math.sign(x) * (lim * 0.85 + (ax - lim * 0.85) * 0.45);
    // the face hangs below the ball: stretch the lower front downward and narrow the jaw
    if (y < 0) {
      const low = sstep(0, -0.9, y);
      y -= 0.42 * low * (0.35 + 0.65 * front);
      x *= 1 - 0.38 * low * (0.5 + 0.5 * front);
      z = z + 0.06 * low * front;
      // back of the jaw tucks in toward the neck
      z -= 0.18 * low * (1 - front);
    }
    // features, pushed along the face direction (z) with gaussian bumps
    const fy = y, fx = x;
    let dz = 0;
    dz += 0.07 * bump(fx, fy - 0.08, 0.36, 0.06) * front;                      // brow ridge
    dz -= 0.075 * (bump(fx - 0.24, fy + 0.06, 0.1, 0.07) + bump(fx + 0.24, fy + 0.06, 0.1, 0.07)) * front; // eye sockets
    dz += 0.2 * bump(fx, fy + 0.3, 0.055, 0.16) * sstep(0.05, -0.42, fy) * front;  // nose bridge to tip
    dz += 0.06 * bump(fx, fy + 0.46, 0.09, 0.05) * front;                      // nose base
    dz += 0.045 * (bump(fx - 0.36, fy + 0.22, 0.09, 0.08) + bump(fx + 0.36, fy + 0.22, 0.09, 0.08)) * front; // cheekbones
    dz += 0.07 * bump(fx, fy + 0.66, 0.2, 0.12) * front;                       // mouth barrel
    dz += 0.05 * bump(fx, fy + 0.93, 0.13, 0.07) * front;                      // chin
    dz -= 0.03 * bump(fx, fy + 0.8, 0.12, 0.035) * front;                      // under the lip
    z += dz;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}
function buildHead(opts = {}) {
  const skin = opts.material || mat(0xd8cdbd, 0.7);
  const g = new THREE.Group();
  const head = new THREE.Mesh(sculptHeadGeometry(), skin); head.scale.setScalar(0.62); g.add(head);
  for (const s of [1, -1]) {
    const ear = ellipsoid(0.035, 0.13, 0.08, skin); ear.position.set(s * 0.395, -0.06, -0.06); ear.rotation.set(0.2, s * 0.35, 0); g.add(ear);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.8, 48), skin); neck.position.set(0, -0.72, -0.12); neck.rotation.x = 0.22; g.add(neck);
  if (opts.lines) {
    const lm = new THREE.MeshBasicMaterial({ color: opts.lineColor || 0x8a2a22 });
    const lw = 0.0065;
    // trace lines on the actual surface by ray casting toward the head
    const ray = new THREE.Raycaster(); g.updateMatrixWorld(true);
    const onSurf = (from, dir) => { ray.set(from, dir.normalize()); const hit = ray.intersectObject(head, false)[0]; return hit ? hit.point.add(hit.face.normal.clone().transformDirection(head.matrixWorld).multiplyScalar(0.004)) : null; };
    const center = [];
    for (let a = -1.0; a <= 3.0; a += 0.035) { // from under the chin, up the face, over the top to the back
      const o = new THREE.Vector3(0, -0.1 + 3 * Math.sin(a), 3 * Math.cos(a));
      const p = onSurf(o, new THREE.Vector3(0, -0.1, 0).sub(o)); if (p) center.push(p);
    }
    if (center.length > 3) g.add(tubeThrough(center, lw, lm));
    const brow = [];
    for (let u = -1.55; u <= 1.55; u += 0.05) { const dir = new THREE.Vector3(-Math.sin(u), 0, -Math.cos(u)); const p = onSurf(new THREE.Vector3(Math.sin(u) * 3, 0.05, Math.cos(u) * 3), dir); if (p) brow.push(p); }
    if (brow.length > 3) g.add(tubeThrough(brow, lw, lm));
    for (const s of [1, -1]) {
      const ring = [];
      for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.1) { const p = onSurf(new THREE.Vector3(s * 3, 0.07 + 0.22 * Math.sin(t), -0.05 + 0.25 * Math.cos(t)), new THREE.Vector3(-s, 0, 0)); if (p) ring.push(p); }
      if (ring.length > 3) g.add(tubeThrough(ring, lw, lm));
    }
    // nose line and chin line across the face
    for (const yy of [-0.3, -0.62]) {
      const ln = []; for (let u = -0.9; u <= 0.9; u += 0.05) { const dir = new THREE.Vector3(-Math.sin(u), 0, -Math.cos(u)); const p = onSurf(new THREE.Vector3(Math.sin(u) * 3, yy, Math.cos(u) * 3), dir); if (p) ln.push(p); }
      if (ln.length > 3) g.add(tubeThrough(ln, lw * 0.8, lm));
    }
  }
  return g;
}
function buildHeadOld(opts = {}) {
  const skin = opts.material || mat(0xd8cdbd, 0.7);
  const g = new THREE.Group();
  const C = new THREE.Vector3(0, 0.12, -0.04), R = new THREE.Vector3(0.5, 0.56, 0.6);
  const cran = ellipsoid(R.x, R.y, R.z, skin); cran.position.copy(C); g.add(cran);
  // flatten the sides: side planes as flattened discs make the box-ish read
  for (const s of [1, -1]) {
    const side = ellipsoid(0.06, 0.34, 0.38, skin); side.position.set(s * 0.455, 0.06, -0.03); g.add(side);
    const ear = ellipsoid(0.05, 0.15, 0.09, skin); ear.position.set(s * 0.5, -0.12, -0.1); ear.rotation.x = 0.15; g.add(ear);
    const cheek = ellipsoid(0.13, 0.11, 0.12, skin); cheek.position.set(s * 0.25, -0.2, 0.36); g.add(cheek);
    const socket = ellipsoid(0.13, 0.075, 0.06, mat(0xbfb3a3, 0.8)); socket.position.set(s * 0.19, -0.03, 0.47); g.add(socket);
  }
  // face block, brow, nose, mouth barrel, jaw, chin
  const brow = ellipsoid(0.4, 0.075, 0.13, skin); brow.position.set(0, 0.06, 0.44); g.add(brow);
  const face = ellipsoid(0.33, 0.38, 0.32, skin); face.position.set(0, -0.28, 0.26); g.add(face);
  const noseShape = new THREE.Shape(); noseShape.moveTo(0, 0.3); noseShape.lineTo(0.085, -0.02); noseShape.lineTo(-0.085, -0.02); noseShape.lineTo(0, 0.3);
  const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  const nose = new THREE.Mesh(noseGeo, skin); nose.position.set(0, -0.3, 0.5); nose.rotation.x = 0.12; g.add(nose);
  const muzzle = ellipsoid(0.2, 0.13, 0.15, skin); muzzle.position.set(0, -0.48, 0.42); g.add(muzzle);
  const jawShape = new THREE.Shape();
  jawShape.moveTo(-0.36, 0.05); jawShape.lineTo(0.36, 0.05); jawShape.lineTo(0.3, -0.33); jawShape.quadraticCurveTo(0.17, -0.5, 0, -0.52); jawShape.quadraticCurveTo(-0.17, -0.5, -0.3, -0.33); jawShape.lineTo(-0.36, 0.05);
  const jawGeo = new THREE.ExtrudeGeometry(jawShape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4, curveSegments: 12 });
  const jaw = new THREE.Mesh(jawGeo, skin); jaw.position.set(0, -0.28, -0.12); g.add(jaw);
  const chin = ellipsoid(0.12, 0.08, 0.08, skin); chin.position.set(0, -0.78, 0.4); g.add(chin);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 40), skin); neck.position.set(0, -0.95, -0.12); neck.rotation.x = 0.18; g.add(neck);
  if (opts.lines) {
    const lm = new THREE.MeshBasicMaterial({ color: opts.lineColor || 0x7a2420 });
    const lw = 0.008;
    const Rl = R.clone().multiplyScalar(1.004);
    // center line over the cranium, then down the face
    const center = [];
    for (let v = -0.15; v <= 1.45; v += 0.05) center.push(surfPoint(C, Rl, 0, v));
    g.add(tubeThrough(center.reverse(), lw, lm));
    g.add(tubeThrough([new THREE.Vector3(0, 0.06, 0.575), new THREE.Vector3(0, -0.12, 0.6), new THREE.Vector3(0, -0.3, 0.66), new THREE.Vector3(0, -0.53, 0.58), new THREE.Vector3(0, -0.72, 0.49), new THREE.Vector3(0, -0.86, 0.43)], lw, lm));
    // brow line around the head
    const browPts = []; for (let u = -1.7; u <= 1.7; u += 0.06) browPts.push(surfPoint(C, Rl, u, -0.05));
    g.add(tubeThrough(browPts, lw, lm));
    // side circles (where the ball is cut flat)
    for (const s of [1, -1]) {
      const ring = []; for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.12) ring.push(new THREE.Vector3(s * 0.5, 0.06 + 0.3 * Math.sin(t), -0.04 + 0.33 * Math.cos(t)));
      g.add(tubeThrough(ring, lw, lm));
    }
  }
  return g;
}

/* ---------------------------------------------------------------- shared scene bits */
function studio(scene, o = {}) {
  scene.background = new THREE.Color(o.bg ?? 0xe9e5de);
  const hemi = new THREE.HemisphereLight(o.sky ?? 0xffffff, o.groundCol ?? 0x8a8378, o.fill ?? 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight(o.keyCol ?? 0xffffff, o.key ?? 2.6);
  const kd = o.keyDir || [-2.2, 3.4, 2.6];
  key.position.set(kd[0], kd[1], kd[2]);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; const ext = o.shadowExt || 2.4; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.1; sc.far = 20;
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key); scene.add(key.target);
  if (o.ground !== false) {
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(o.groundColor ?? 0xcfc9bf, 0.95));
    gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; scene.add(gr);
  }
  return { key, hemi };
}
function aimCamera(cam, target, az, el, dist) {
  cam.position.set(target.x + dist * Math.sin(az * D) * Math.cos(el * D), target.y + dist * Math.sin(el * D), target.z + dist * Math.cos(az * D) * Math.cos(el * D));
  cam.lookAt(target);
}
function fitDistance(box, cam, az, el, margin) {
  // move camera back until the bounding box fills the frame with margin
  const center = box.getCenter(new THREE.Vector3());
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  let lo = 0.3, hi = 60;
  for (let i = 0; i < 40; i++) {
    const d = (lo + hi) / 2; aimCamera(cam, center, az, el, d); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let ok = true;
    for (const c of corners) { const p = c.clone().project(cam); if (Math.abs(p.x) > 1 - margin || Math.abs(p.y) > 1 - margin || p.z > 1) { ok = false; break; } }
    if (ok) hi = d; else lo = d;
  }
  aimCamera(cam, center, az, el, hi);
  return center;
}

/* ---------------------------------------------------------------- jobs */
function figureJob(scene, cam, job) {
  const { root, J } = buildMannequin(job.tone);
  applyPose(J, job.pose);
  root.position.set(0, 1.0, 0);
  if (job.pose.y) root.position.y += job.pose.y;
  scene.add(shadowy(root));
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  if (!job.pose.air) root.position.y -= box.min.y; else root.position.y -= box.min.y - job.pose.air;
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  if (job.pose.prop === 'stool') {
    const pelvisBox = new THREE.Box3().setFromObject(J.pelvis.children[0]);
    const top = pelvisBox.min.y + 0.01, c = pelvisBox.getCenter(new THREE.Vector3());
    const stool = new THREE.Mesh(new THREE.BoxGeometry(0.42, top, 0.38), mat(0xa39d94, 0.85)); stool.position.set(c.x, top / 2, c.z - 0.04); scene.add(shadowy(stool));
    box.union(new THREE.Box3().setFromObject(stool));
  }
  if (job.pose.prop === 'block') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), mat(0x8c8782, 0.8)); b.position.set(job.pose.blockX || 0.3, 0.125, job.pose.blockZ || 0.15); scene.add(shadowy(b));
  }
  studio(scene, { keyDir: job.keyDir || [-2.4, 3.6, 2.4], bg: job.bg ?? 0xe7e3dc, groundColor: 0xd2ccc2 });
  cam.fov = job.fov || 30; cam.updateProjectionMatrix();
  const c = fitDistance(box, cam, job.az || 0, job.el || 6, job.margin ?? 0.12);
  if (cam.position.y < 0.18) { cam.position.y = 0.18; cam.lookAt(c); }
  if (job.lookUp) { cam.lookAt(c.x, c.y + job.lookUp, c.z); }
}

function headJob(scene, cam, job) {
  const head = buildHead({ lines: job.lines, material: mat(job.skin ?? 0xd9cebf, 0.72) });
  head.rotation.order = 'YXZ';
  head.rotation.set(job.pitch * D, job.yaw * D, job.roll * D);
  head.position.y = 1.0;
  scene.add(shadowy(head));
  const L = studio(scene, { keyDir: job.keyDir || [-2.2, 2.6, 3], bg: job.bg ?? 0xe4e0d8, ground: false, fill: job.fill ?? 0.6, key: job.key ?? 2.4, shadowExt: 1.6 });
  L.key.target.position.set(0, 1, 0);
  cam.fov = 24; cam.updateProjectionMatrix();
  aimCamera(cam, new THREE.Vector3(0, 0.88, 0), 0, job.camEl || 0, 4.7);
}

function primitive(kind, m) {
  switch (kind) {
    case 'sphere': return new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 40), m);
    case 'cube': return new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), m);
    case 'cylinder': return new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 64), m);
    case 'cone': return new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.0, 64), m);
    case 'egg': { const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 40), m); e.scale.set(0.78, 1, 0.78); return e; }
    case 'torus': { const t = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.15, 40, 80), m); t.rotation.x = -Math.PI / 2; return t; }
    case 'prism': { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 6), m); return p; }
    case 'pyramid': return new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 4), m);
  }
}
function placeOnGround(o, x, z, ry = 0) {
  o.rotation.y += ry; o.position.set(x, 0, z); o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o); o.position.y -= b.min.y; return o;
}

function formsJob(scene, cam, job) {
  const m = mat(job.color ?? 0xd8d4cc, 0.75);
  const o = primitive(job.shape, m);
  if (job.shape === 'cube' || job.shape === 'prism' || job.shape === 'pyramid') o.rotation.y = (job.rot ?? 30) * D;
  if (job.lay) o.rotation.z = Math.PI / 2;
  scene.add(shadowy(placeOnGround(o, 0, 0)));
  studio(scene, { keyDir: job.keyDir, bg: job.bg ?? 0xdcd8d0, groundColor: job.groundColor ?? 0xc9c3b8, fill: job.fill ?? 0.7, key: job.key ?? 2.6, shadowExt: 2.5 });
  cam.fov = 30; cam.updateProjectionMatrix();
  aimCamera(cam, new THREE.Vector3(job.lookX ?? 0.25, 0.4, 0), job.az ?? 0, job.el ?? 16, 5.2);
}

function stillLifeJob(scene, cam, job) {
  const r = rng(job.seed);
  const tones = [0xf2efe9, 0xb9b3a9, 0x6e6860, 0x3a3631, 0xe0d9cc];
  // a cloth-like base slab and a back wall for cast shadows
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 2.0), mat(job.cloth ?? 0xd6cfc3, 0.95)); slab.position.set(0, 0.03, 0); scene.add(shadowy(slab));
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), mat(job.wall ?? 0xb9b2a6, 0.95)); wall.position.set(0, 3, -1.15); wall.receiveShadow = true; scene.add(wall);
  const kinds = ['sphere', 'cube', 'cylinder', 'cone', 'egg', 'prism', 'torus', 'pyramid'];
  const n = 3 + Math.floor(r() * 2);
  const spots = [[-1.0, -0.2], [-0.25, 0.3], [0.55, -0.3], [1.05, 0.35]].sort(() => r() - 0.5);
  for (let i = 0; i < n; i++) {
    const k = kinds[Math.floor(r() * kinds.length)];
    const o = primitive(k, mat(tones[Math.floor(r() * tones.length)], 0.7));
    const s = 0.42 + r() * 0.3; o.scale.multiplyScalar(s);
    if (k === 'cylinder' && r() < 0.35) o.rotation.z = Math.PI / 2;
    const [x, z] = spots[i];
    placeOnGround(o, x, z, r() * Math.PI); o.position.y += 0.06; scene.add(shadowy(o));
  }
  studio(scene, { keyDir: job.keyDir || [-3, 3.2, 2], bg: 0x9f988c, ground: false, fill: job.fill ?? 0.5, key: job.key ?? 3.0, shadowExt: 3 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mat(0x8f887d, 0.95)); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001; floor.receiveShadow = true; scene.add(floor);
  cam.fov = 34; cam.updateProjectionMatrix();
  aimCamera(cam, new THREE.Vector3(0, 0.3, 0), job.az ?? 0, job.el ?? 20, 4.1);
}

function edgeBox(w, h, d, m, lineColor = 0x2a2622) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  g.add(new THREE.Mesh(geo, m));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: lineColor })));
  return g;
}
function perspBoxesJob(scene, cam, job) {
  const r = rng(job.seed);
  const n = job.n || 5;
  const centroid = new THREE.Vector3();
  const palette = [0xe8e2d6, 0xd9cfbd, 0xcfc8bd, 0xe2dbd0];
  for (let i = 0; i < n; i++) {
    const w = 0.9 + r() * 1.4, h = 0.6 + r() * 1.6, d = 0.9 + r() * 1.4;
    const b = edgeBox(w, h, d, mat(palette[i % palette.length], 0.85));
    const ang = job.mode === 'one' ? 0 : job.mode === 'two' ? (job.rot ?? 35) : (r() * 90);
    b.rotation.y = ang * D;
    if (job.float && r() < 0.5) b.rotation.x = (r() - 0.5) * 0.9;
    const x = (i - (n - 1) / 2) * 2.3 + (r() - 0.5) * 0.5, z = 1 - r() * 4;
    b.position.set(x, job.float ? (job.mode === 'three' && job.up ? 2.2 + r() * 2.6 : 0.6 + r() * 2.2) : h / 2, z);
    scene.add(shadowy(b)); centroid.add(b.position);
  }
  centroid.divideScalar(n);
  studio(scene, { keyDir: [-3, 5, 3], bg: 0xe8e4dc, groundColor: 0xd8d2c8, fill: 0.7, key: 1.8, shadowExt: 8 });
  // a faint floor grid helps the eye find the vanishing points
  const grid = new THREE.GridHelper(40, 40, 0xb5ada1, 0xc5beb3); grid.position.y = 0.002; scene.add(grid);
  cam.fov = job.fov || 50; cam.updateProjectionMatrix();
  const eye = job.eye ?? 1.5;
  cam.position.set(job.camX || 0, eye, 7.5);
  if (job.mode === 'three') { cam.position.set(job.camX || 0, eye, job.up ? 6.0 : 7.0); cam.lookAt(centroid); }
  else cam.lookAt(job.camX || 0, eye, -6);
}

function cylindersJob(scene, cam, job) {
  const r = rng(job.seed);
  const m = mat(0xe6dfd2, 0.8), lineM = new THREE.LineBasicMaterial({ color: 0x2a2622 });
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const rad = 0.35 + r() * 0.45, h = 0.6 + r() * 1.5;
    const g = new THREE.Group();
    const kind = r();
    let geo;
    if (kind < 0.55) geo = new THREE.CylinderGeometry(rad, rad, h, 72, 1);
    else if (kind < 0.8) geo = new THREE.CylinderGeometry(rad * 0.6, rad, h, 72, 1);
    else geo = new THREE.TorusGeometry(rad, 0.08, 24, 72);
    g.add(new THREE.Mesh(geo, m));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), lineM));
    const lay = r() < 0.35;
    if (lay) g.rotation.z = Math.PI / 2;
    if (kind >= 0.8) g.rotation.x = -Math.PI / 2 + (r() - 0.5) * 1.2;
    g.rotation.y = r() * Math.PI;
    const x = (i - (n - 1) / 2) * 1.5 + (r() - 0.5) * 0.4, z = -r() * 3.2;
    g.position.set(x, 0, z); g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g); g.position.y -= b.min.y;
    if (job.float) g.position.y += 0.3 + r() * 1.8;
    scene.add(shadowy(g));
  }
  studio(scene, { keyDir: [-3, 5, 3], bg: 0xe8e4dc, groundColor: 0xd8d2c8, fill: 0.7, key: 1.8, shadowExt: 8 });
  const grid = new THREE.GridHelper(40, 40, 0xb5ada1, 0xc5beb3); grid.position.y = 0.002; scene.add(grid);
  cam.fov = 48; cam.updateProjectionMatrix();
  cam.position.set(0, job.eye ?? 2.2, 5.6); cam.lookAt(0, (job.eye ?? 2.2) * 0.4, -1.5);
}

function roomJob(scene, cam, job) {
  const r = rng(job.seed);
  const W = 6 + r() * 3, Dp = 7 + r() * 4, H = 2.8 + r() * 0.6;
  const wallM = mat(job.wall ?? 0xe3ddd2, 0.95, { side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, Dp), wallM); room.position.set(0, H / 2, -Dp / 2 + 1.2); room.receiveShadow = true; scene.add(room);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, Dp)), new THREE.LineBasicMaterial({ color: 0x8c857a })); edges.position.copy(room.position); scene.add(edges);
  // floor boards
  const floorTex = mat(0xb79c7c, 0.9); const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), floorTex); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.001, room.position.z); fl.receiveShadow = true; scene.add(fl);
  for (let x = -W / 2; x <= W / 2; x += 0.35) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.002, Dp), mat(0x8e7458)); l.position.set(x, 0.003, room.position.z); scene.add(l); }
  // window on the back wall and a door on a side wall
  const backZ = room.position.z - Dp / 2 + 0.01;
  const win = edgeBox(1.6, 1.3, 0.04, new THREE.MeshBasicMaterial({ color: 0xf4f1ea }), 0x5a5249); win.position.set((r() - 0.5) * 2, 1.6, backZ); scene.add(win);
  const door = edgeBox(0.04, 2.1, 0.95, mat(0x8a6f55, 0.8), 0x3a3029); door.position.set(-W / 2 + 0.03, 1.05, room.position.z + (r() - 0.2) * 2); scene.add(door);
  // furniture as boxes
  const furn = [[1.6, 0.75, 0.9], [0.5, 0.9, 0.5], [0.5, 0.9, 0.5], [2.0, 0.85, 0.9], [0.9, 1.8, 0.4], [1.2, 0.45, 0.6]];
  const nF = 3 + Math.floor(r() * 3);
  for (let i = 0; i < nF; i++) {
    const [w, h, d] = furn[Math.floor(r() * furn.length)];
    const b = edgeBox(w, h, d, mat([0x9c8a73, 0xb8ab97, 0x6f6458, 0xcfc3b0][i % 4], 0.85));
    b.rotation.y = job.angled ? (r() - 0.5) * 1.2 : 0;
    b.position.set((r() - 0.5) * (W - 2), h / 2, room.position.z + (r() - 0.5) * (Dp - 3));
    scene.add(shadowy(b));
  }
  scene.background = new THREE.Color(0xe3ddd2);
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x7a6c5c, 1.1));
  const sun = new THREE.PointLight(0xfff1dd, 14, 0, 2); sun.position.set(0, H - 0.6, room.position.z + 1); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
  cam.fov = 62; cam.updateProjectionMatrix();
  const eye = job.eye ?? 1.55;
  const camX = job.oneP ? 0 : (r() - 0.5) * 2;
  cam.position.set(camX, eye, 1.0);
  if (job.oneP) cam.lookAt(camX, eye, -10); else cam.lookAt(camX + (r() < 0.5 ? -3 : 3), eye, -6);
}

function streetJob(scene, cam, job) {
  const r = rng(job.seed);
  scene.background = new THREE.Color(0xc9d6df);
  scene.fog = new THREE.Fog(0xc9d6df, 30, 140);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 300), mat(0x6f6c68, 0.95)); road.rotation.x = -Math.PI / 2; road.position.z = -120; road.receiveShadow = true; scene.add(road);
  for (const s of [1, -1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 300), mat(0xb3ada4, 0.95)); walk.position.set(s * 6.5, 0.075, -120); walk.receiveShadow = true; scene.add(walk);
  }
  for (let z = 2; z > -200; z -= 6) { const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2.5), mat(0xe8e4d8)); dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.01, z); scene.add(dash); }
  const facades = [0xc9b9a3, 0xb39a83, 0xd6cdbf, 0x9c938c, 0xbea688, 0xcfbcac, 0xa7b0b4, 0xddd3c4, 0xb08372];
  for (const s of [1, -1]) {
    let z = 4;
    while (z > -180) {
      const w = 7 + r() * 8, h = 7 + r() * 18, d = 10 + r() * 6;
      const col = facades[Math.floor(r() * facades.length)];
      const b = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), mat(col, 0.9)); b.position.set(s * (8 + d / 2), h / 2, z - w / 2); scene.add(shadowy(b));
      // windows as dark insets on the street side
      const rows = Math.floor((h - 2) / 3), cols = Math.max(1, Math.floor(w / 2.4));
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const wnd = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), mat(0x39424a, 0.4));
        wnd.position.set(s * 8 - s * 0.02, 2.8 + i * 3, z - (j + 0.5) * (w / cols)); wnd.rotation.y = -s * Math.PI / 2; scene.add(wnd);
      }
      z -= w + (r() < 0.2 ? 6 : 0);
    }
  }
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x6d665c, 1.2));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); sun.position.set(job.sunX ?? 30, 40, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.far = 200; scene.add(sun);
  cam.fov = 58; cam.updateProjectionMatrix();
  const eye = job.eye ?? 1.6;
  cam.position.set(job.camX ?? 1.5, eye, 6);
  cam.lookAt((job.camX ?? 1.5) + (job.turn ?? 0), eye + (job.up ?? 0), -20);
}

function colorJob(scene, cam, job) {
  const r = rng(job.seed);
  const cols = [0xc23b2e, 0x2f5fa8, 0xe2b13c, 0x3f8a4f, 0xefe9de, 0x7b4a8c, 0xd97a3a];
  const kinds = ['sphere', 'cube', 'cylinder', 'cone', 'egg', 'torus'];
  const n = 3 + Math.floor(r() * 2);
  const spots = [[-0.95, -0.1], [0.05, 0.4], [0.9, -0.15], [-0.15, -0.6]].sort(() => r() - 0.5);
  for (let i = 0; i < n; i++) {
    const o = primitive(kinds[Math.floor(r() * kinds.length)], mat(cols[Math.floor(r() * cols.length)], 0.6));
    o.scale.multiplyScalar(0.5 + r() * 0.3);
    placeOnGround(o, spots[i][0], spots[i][1], r() * Math.PI); scene.add(shadowy(o));
  }
  const warm = job.warm !== false;
  scene.background = new THREE.Color(job.bg ?? (warm ? 0x8aa0b8 : 0x6b5d70));
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat(job.floor ?? 0xcfc6b8, 0.9)); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; scene.add(gr);
  scene.add(new THREE.HemisphereLight(warm ? 0x7fa6d9 : 0xffc58a, warm ? 0x6b5a45 : 0x4b4458, 0.9));
  const key = new THREE.DirectionalLight(warm ? 0xffc27a : 0xbcd6ff, 3.2); key.position.set(...(job.keyDir || [-3, 2.4, 2])); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; key.shadow.radius = 3; scene.add(key);
  cam.fov = 34; cam.updateProjectionMatrix();
  aimCamera(cam, new THREE.Vector3(0, 0.28, 0), job.az ?? 0, job.el ?? 22, 3.7);
}

const JOBS = { figure: figureJob, head: headJob, forms: formsJob, still: stillLifeJob, boxes: perspBoxesJob, cyl: cylindersJob, room: roomJob, street: streetJob, color: colorJob };

window.renderJob = async (job) => {
  const w = job.w || 1200, h = job.h || 1500;
  const r = getRenderer(w, h);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, w / h, 0.05, 400);
  JOBS[job.type](scene, cam, job);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/webp', job.q || 0.8);
  scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
  return url;
};
window.sceneReady = true;
