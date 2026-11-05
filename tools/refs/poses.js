// Mannequin poses. Angles in degrees.
// root: lean (+ forward), turn, tilt (+ drops the left hip / leans to its left)
// spine: bend (+ forward), side (+ to its left), twist (+ chest turns to its left); head: nod (+ down), look (+ to its left), htilt
// arm: [raise forward, raise out, twist, elbow bend, wrist bend]; leg: [raise forward, out, twist, knee bend, toes point (+ down)]
// For a flat foot: point = raise - lean - knee.
const flat = (raise, lean, knee) => raise - lean - knee;
const P = {
  contrapposto: { tilt: 7, side: -12, armL: [4, 7, 0, 12], armR: [-4, 9, 0, 18], legR: [0, -7, 0, 0, 0], legL: [10, 3, -10, 24, 4], look: -12, htilt: 5 },
  hips: { armL: [-8, 40, -80, 100], armR: [-8, 40, -80, 100], legL: [0, 9, 0, 0, 0], legR: [0, 9, 0, 0, 0], look: 15 },
  walk: { bend: 4, twist: 6, armL: [-24, 6, 0, 18], armR: [26, 6, 0, 28], legL: [24, 1, 0, 8, -14], legR: [-22, 1, 0, 26, 18] },
  run: { lean: 14, bend: 6, armL: [-50, 10, 0, 95], armR: [55, 10, 0, 100], legL: [62, 0, 0, 95, 15], legR: [-28, 0, 0, 45, 30], air: 0.06 },
  reach: { side: -14, armL: [172, 14, 0, 6], armR: [18, 16, 0, 35], legL: [0, 4, 0, 0, 32], legR: [12, 8, 0, 22, 0], nod: -25, look: 10 },
  pickup: { lean: 38, bend: 48, nod: -35, armL: [85, 4, 0, 12], armR: [72, 10, 0, 25], legL: [38, 6, 0, 6, flat(38, 38, 6)], legR: [30, 8, 0, 14, flat(30, 38, 14)] },
  squat: { lean: 22, bend: 14, armL: [72, 14, 0, 30], armR: [68, 18, 0, 40], legL: [112, 18, 0, 132, flat(112, 22, 132)], legR: [112, 18, 0, 132, flat(112, 22, 132)] },
  kneel: { bend: 6, armL: [42, 8, 0, 45], armR: [8, 10, 0, 25], legL: [90, 6, 0, 90, 0], legR: [-12, 6, 0, 100, -55], look: -15 },
  sitUpright: { prop: 'stool', bend: 4, armL: [32, 8, 0, 55], armR: [30, 8, 0, 60], legL: [90, 9, 0, 92, -2], legR: [84, 6, 0, 78, 6], look: 20 },
  sitSlouch: { prop: 'stool', lean: 10, bend: 42, nod: 12, armL: [62, 12, 25, 112], armR: [58, 12, 25, 118], legL: [100, 16, 0, 104, flat(100, 10, 104)], legR: [104, 14, 0, 96, flat(104, 10, 96)] },
  floorLean: { lean: -28, bend: -4, armL: [-42, 18, 0, 0, -60], armR: [-40, 18, 0, 0, -60], legL: [62, 4, 0, 0, 20], legR: [96, 8, 0, 118, 10], look: 25 },
  sideLie: { tilt: 74, side: -18, armL: [92, 0, 0, 105], armR: [10, 20, 0, 30], legL: [30, 0, 0, 40, 10], legR: [12, -8, 0, 15, 10], look: -15, htilt: -40 },
  lunge: { lean: 12, bend: 4, armL: [40, 10, 0, 40], armR: [35, 10, 0, 50], legL: [80, 6, 0, 82, flat(80, 12, 82)], legR: [-40, 6, 0, 12, 20] },
  throw: { twist: -45, lean: 6, armR: [0, 92, 95, 95], armL: [70, 28, 0, 22], legL: [42, 10, 0, 22, 4], legR: [-18, 10, 0, 12, 10], look: 40 },
  kick: { lean: -16, bend: -6, armL: [25, 62, 0, 20], armR: [40, 55, 0, 30], legR: [82, 0, 0, 8, 35], legL: [-16, 0, 0, 6, flat(-16, -16, 6)] },
  jump: { bend: -12, armL: [160, -26, 0, 10], armR: [156, -30, 0, 12], legL: [28, 6, 0, 62, 40], legR: [10, 6, 0, 48, 45], air: 0.35, nod: -15 },
  lookBack: { twist: 50, look: 45, armL: [-22, 10, 0, 28], armR: [22, 10, 0, 32], legL: [14, 3, 0, 6, -6], legR: [-10, 3, 0, 18, 10] },
  push: { lean: 30, bend: 6, armL: [86, 6, 0, 14, -50], armR: [84, 6, 0, 16, -50], legL: [44, 6, 0, 42, flat(44, 30, 42)], legR: [-18, 6, 0, 4, 12], nod: -15 },
  pull: { lean: -24, bend: -6, armL: [56, 2, 0, 18], armR: [48, 4, 0, 40], legL: [8, 8, 0, 30, flat(8, -24, 30)], legR: [-34, 8, 0, 10, flat(-34, -24, 10)] },
  archer: { armL: [0, 90, 0, 0], armR: [0, 92, 20, 150], look: 75, legL: [0, 16, 0, 0, 0], legR: [0, 16, 0, 0, 0], twist: 8 },
  arabesque: { lean: 52, bend: -8, nod: -40, armL: [150, 18, 0, 6], armR: [36, 72, 0, 8], legL: [52, 0, 0, 4, flat(52, 52, 4)], legR: [-42, 0, 0, 4, 40] },
  fence: { lean: 10, armR: [92, 2, 0, 0], armL: [-15, 105, 60, 95], legR: [78, 4, 0, 80, flat(78, 10, 80)], legL: [-42, 8, 30, 14, 15], look: -10, twist: -15 },
  guard: { turn: 25, bend: 16, nod: 18, armL: [68, 16, -25, 132], armR: [56, 18, -25, 145], legL: [18, 10, 0, 22, -4], legR: [-12, 10, 0, 24, 14] },
  lift: { lean: 14, bend: 34, nod: -20, armL: [62, 14, 0, 30], armR: [62, 14, 0, 30], legL: [74, 14, 0, 82, flat(74, 14, 82)], legR: [74, 14, 0, 82, flat(74, 14, 82)] },
  crossLegs: { lean: -6, bend: 18, armL: [36, 10, 0, 50], armR: [36, 10, 0, 50], legL: [82, 48, 40, 140, 10], legR: [78, 46, 40, 142, 10] },
  backLie: { lean: -86, armL: [8, 55, 0, 12], armR: [0, 40, 0, 70], legL: [64, 4, 0, 112, flat(64, -86, 112) - 90], legR: [30, 4, 0, 30, 10], nod: 30 },
  climb: { lean: 6, armL: [172, 12, 0, 28], armR: [150, 22, 0, 62], legL: [92, 10, 0, 98, flat(92, 6, 98)], legR: [0, 5, 0, 10, 30], look: 20, nod: -25 },
  tired: { bend: 26, nod: 34, side: -5, armL: [6, 8, 0, 8], armR: [3, 8, 0, 12], legL: [0, 5, 0, 8, 0], legR: [6, 4, 0, 14, 0] },
  thinker: { prop: 'stool', lean: 8, bend: 44, nod: 16, armR: [72, 2, -35, 140], armL: [48, 10, 0, 62], legL: [92, 12, 0, 94, flat(92, 8, 94)], legR: [96, 10, 0, 100, flat(96, 8, 100)] },
  spin: { tilt: -6, armL: [88, 88, 0, 12], armR: [118, 40, 0, 34], legR: [42, 22, 35, 82, 40], legL: [0, -4, 0, 4, 20], look: 20 },
  crouch: { lean: 30, bend: 24, armL: [52, 16, 0, 64], armR: [44, 18, 0, 72], legL: [92, 12, 0, 118, flat(92, 30, 118)], legR: [58, 12, 0, 118, flat(58, 30, 118) - 20], nod: -20 },
  hugKnees: { lean: -18, bend: 30, nod: 22, armL: [72, 14, 0, 105], armR: [72, 14, 0, 105], legL: [128, 8, 0, 148, flat(128, -18, 148)], legR: [126, 8, 0, 146, flat(126, -18, 146)] },
  crawl: { lean: 88, bend: -6, nod: -55, armL: [88, 6, 0, 0, -80], armR: [70, 6, 0, 0, -80], legL: [90, 6, 0, 92, -60], legR: [72, 6, 0, 88, -60] },
  stretch: { side: -26, armL: [172, 28, 0, 14], armR: [-10, 34, -80, 100], legL: [0, 12, 0, 0, 0], legR: [0, 12, 0, 0, 0], htilt: -10 }
};
const LAND = new Set(['sideLie', 'backLie', 'crawl', 'arabesque', 'lunge', 'fence', 'floorLean', 'kick', 'pickup', 'push']);
const VIEWS = [[28, 6], [-38, 4], [150, 8], [-120, 6], [70, 5], [0, 4]];
const jobs = [];
let k = 0;
for (const [name, pose] of Object.entries(P)) {
  const land = LAND.has(name);
  const v1 = VIEWS[k % VIEWS.length], v2 = VIEWS[(k + 2) % VIEWS.length]; k++;
  for (const [i, [az, el]] of [v1, v2].entries()) {
    jobs.push({ name: `fig-${name}-${i + 1}`, type: 'figure', pose, az, el, w: land ? 1500 : 1150, h: land ? 1100 : 1500, keyDir: i ? [2.4, 3.6, 2.2] : [-2.4, 3.6, 2.4] });
  }
}
// foreshortening: high and low cameras, wider lens
const FS = ['contrapposto', 'walk', 'run', 'reach', 'squat', 'kneel', 'sitSlouch', 'floorLean', 'lunge', 'push', 'jump', 'backLie', 'crawl', 'guard', 'climb', 'thinker'];
FS.forEach((name, i) => {
  const pose = P[name];
  const high = i % 2 === 0;
  jobs.push({ name: `fs-${name}`, type: 'figure', pose, az: [20, -35, 60, -70, 140, -150][i % 6], el: high ? 52 : -14, fov: 52, margin: 0.08, w: 1300, h: 1300, keyDir: [-2.4, 3.6, 2.4] });
});
module.exports = jobs;
module.exports.P = P;
