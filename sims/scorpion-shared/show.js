// SC-8 operator state as a pure function of an event list and t. The film plays SCRIPT (the 50 s table in
// CONTRACT.md); the live page appends the visitor's clicks to its own list and runs the same functions, so both
// show the same machine. Everything the console reads comes from kin.js through here.
import * as K from './kin.js';
import {LEG_ROWS} from './console.js';

const {LEGS, STRIDE, STRIKE_DUR, footAt, strikeCurve, tailAt, CLAW, D2R} = K;

export const DURATION = 50;
// btn = the console control the operator presses at t (the cursor goes there); say = the line in the operation log
export const SCRIPT = [
  {t: 0, mode: 'SCUTTLE', view: 'hero', speed: 0.35, trace: 1, labels: 1, say: 'INBOUND · SCUTTLE · 8 LEGS'},
  {t: 4, mode: 'STANDING · FRONT', view: 'front', speed: 0, trace: 0, labels: 0, dims: 'front', btn: 'front', say: 'VIEW · FRONT'},
  {t: 7, mode: 'SIDE', view: 'side', dims: 'side', btn: 'side', say: 'VIEW · SIDE · 8 TAIL SECTIONS'},
  {t: 10, mode: 'TOP · BALANCE', view: 'top', speed: 0.15, dims: '', btn: 'top', say: 'VIEW · TOP'},
  {t: 10.9, balance: 1, btn: 'balance', say: 'BALANCE · COG + SUPPORT'},
  {t: 14, mode: 'LEG L1 LIFT', view: 'leg', speed: 0, balance: 0, iso: 'leg', btn: 'leg', say: 'ISOLATE · LEG L1'},
  {t: 14.7, lift: 1},
  {t: 15.9, jointCut: 1, labels: 1, btn: 'section', say: 'SECTION · HIP + KNEE ACTUATORS'},
  {t: 19, mode: 'CLAW L OPEN', view: 'claw', iso: 'claw', lift: 0, btn: 'claw', say: 'ISOLATE · CLAW L'},
  {t: 20.2, grip: 1, say: 'GRIP · LEAD SCREW DRIVE'},
  {t: 24, mode: 'TAIL APART', view: 'tail', iso: 'tail', btn: 'tail', say: 'ISOLATE · TAIL · J1–J8'},
  {t: 24.9, sweep: 1, say: 'TAIL · YAW SWEEP ±25°'},
  {t: 29, mode: 'STINGER', view: 'sting', btn: 'stinger', say: 'ISOLATE · STINGER MODULE'},
  {t: 30, strike: 1, btn: 'strike', say: 'STRIKE · ARMED'},
  {t: 32, mode: 'CARAPACE OPEN', view: 'carapace', iso: '', jointCut: 0, open1: 1, cut: 1, btn: 'carapace', say: 'CARAPACE · 3 LAYERS · SECTION'},
  {t: 37, mode: 'TEARDOWN', view: 'teardown', cut: 0, explode: 1, labels: 0, btn: 'explode', say: 'EXPLODED · ASSEMBLY ORDER'},
  {t: 37.8, turn: 1, btn: 'turntable', say: 'TURNTABLE ON'},
  {t: 43, mode: 'STANDING', view: 'hero2', explode: 0, open1: 0, turn: 0, dur: 1.3, btn: 'hero', say: 'REASSEMBLE · STANDING'},
  {t: 45, mode: 'ADVANCE', view: 'advance', speed: 0.9, trace: 1, say: 'DRIVE · ADVANCE 0.90 M/S'},
  {t: 47.5, strike: 1, btn: 'strike', say: 'STRIKE · ARMED'},
];
export const BEATS = SCRIPT.filter((e) => e.t > 0).map((e) => e.t);

// ------------------------------------------------------------ easing (SKILL.md taste numbers)
const bezier = (x1, y1, x2, y2) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const X = (u) => ((ax * u + bx) * u + cx) * u;
  const dX = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const d = dX(u);
      if (Math.abs(d) < 1e-6) break;
      u -= (X(u) - x) / d;
    }
    u = Math.min(1, Math.max(0, u));
    return ((ay * u + by) * u + cy) * u;
  };
};
export const E = {inOut: bezier(0.65, 0, 0.35, 1), enter: bezier(0.16, 1, 0.3, 1), exit: bezier(0.6, 0, 0.9, 0.35)};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ss = (a, b, t) => E.inOut(clamp((t - a) / (b - a)));
const smooth = (a, b, t) => {
  const u = clamp((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};

// a value that every event carrying `key` pulls toward its target over dur seconds (state-to-state ease)
const evAt = (EV, key, t, init, dur, target = (e) => e[key]) => {
  let v = init;
  for (const e of EV) if (e[key] !== undefined && e.t <= t) v += (target(e) - v) * ss(e.t, e.t + (e.dur ?? dur), t);
  return v;
};
const lastOf = (EV, key, t) => {
  let r = null;
  for (const e of EV) if (e[key] !== undefined && e.t <= t) r = e;
  return r;
};
export const speedAt = (EV, t) => evAt(EV, 'speed', t, EV[0].speed ?? 0, 1.3);

// ------------------------------------------------------------ actions with their own shape
// claw grip: open the movable finger, hold, drive it shut onto the target, squeeze, hold (3.4 s)
export const GRIP_DUR = 3.4;
const gripShape = (u) => {
  const open = 0.18 + 0.82 * ss(0, 0.9, u) - 0.9 * ss(1.5, 2.05, u);
  return {open: Math.max(0.08, open), squeeze: ss(1.9, 2.3, u), reach: 0.55 * ss(0, 1.0, u) * (1 - 0.4 * ss(2.2, 3.4, u))};
};
const winOf = (EV, key, t, dur) => {
  let u = -1;
  for (const e of EV) if (e[key] && t >= e.t && t < e.t + dur) u = t - e.t;
  return u;
};
export const strikeAt = (EV, t) => {
  let s = 0.02 * Math.sin(0.7 * t);
  for (const e of EV) if (e.strike) s += strikeCurve(t - e.t);
  return s;
};
// tail yaw sweep: +25°, -25°, back to 0 over 4 s
export const SWEEP_DUR = 4;
export const tailYawAt = (EV, t) => {
  const u = winOf(EV, 'sweep', t, SWEEP_DUR);
  if (u < 0) return 0;
  const k = u / SWEEP_DUR;
  return 25 * D2R * Math.sin(2 * Math.PI * k) * smooth(0, 0.08, k) * (1 - smooth(0.92, 1, k));
};
// the armour's first explode stage: carapace open lifts only the armour layers (stage 1 of EXPLODE_STAGES)
export const ARMOUR_STAGE = 0.16;

export function opsAt(EV, t) {
  const iso = {};
  for (const k of ['leg', 'claw', 'tail']) iso[k] = evAt(EV, 'iso', t, 0, 0.8, (e) => (e.iso === k ? 1 : 0));
  const gU = winOf(EV, 'grip', t, GRIP_DUR + 30);
  const lastGrip = lastOf(EV, 'grip', t);
  let g = {open: 0.18 + 0.02 * Math.sin(1.3 * t), squeeze: 0, reach: 0};
  if (gU >= 0 && lastGrip) g = gripShape(Math.min(gU, GRIP_DUR));
  // after the claw scene the claw relaxes back to its rest pose
  const relax = ss(24, 25, t) * (EV === SCRIPT ? 1 : 0);
  g = {open: g.open + (0.18 - g.open) * relax, squeeze: g.squeeze * (1 - relax), reach: g.reach * (1 - relax)};
  const explodeTo = evAt(EV, 'explode', t, 0, 2.6);
  const armour = evAt(EV, 'open1', t, 0, 1.6) * ARMOUR_STAGE;
  return {
    speed: speedAt(EV, t),
    iso,
    lift: evAt(EV, 'lift', t, 0, 1.1),
    jointCut: evAt(EV, 'jointCut', t, 0, 1.0),
    cut: evAt(EV, 'cut', t, 0, 1.4),
    explode: Math.max(explodeTo, armour * (1 - explodeTo)),
    xray: 0,
    ...g,
    gripU: gU >= 0 && gU < GRIP_DUR ? gU : -1,
    strike: strikeAt(EV, t),
    strikeU: winOf(EV, 'strike', t, STRIKE_DUR),
    tailYaw: tailYawAt(EV, t),
    turn: evAt(EV, 'turn', t, 0, 1.2),
    trace: evAt(EV, 'trace', t, EV[0].trace ?? 0, 0.6),
    labels: evAt(EV, 'labels', t, EV[0].labels ?? 0, 0.5),
    balance: evAt(EV, 'balance', t, 0, 0.6),
    dims: lastOf(EV, 'dims', t),
    mode: lastOf(EV, 'mode', t)?.mode ?? 'STANDING',
  };
}

// turntable: degrees turned since the turntable came on (tabulated by the caller for the film; integral of turn)
export const TURN_RATE = 26; // deg/s at full turntable

// ------------------------------------------------------------ views: target in the body frame (x relative to X), deg
// az 0 looks from the front (+x), 270 from the robot's left side (+z) with the claws to the right of the screen
// Camera numbers were measured headlessly on the frozen model (teardown-out/tune2.mjs, dbgcam-style:
// st.frame + the pixbounds dark-pixel rule) to hit the CONTRACT layout: machine 62-70% of frame height,
// whole silhouette inside the safe canvas, close-ups clear of the OPERATION MODE label.
export const VIEW_FN = {
  hero: (u) => ({tx: 0.3, ty: 0.56, tz: 0.02, az: 318 + 1.1 * u, el: 15, d: 5.07, sx: 27, sy: 41}),
  front: (u) => ({tx: 0.32, ty: 0.64, tz: 0, az: 0 + 0.25 * u, el: 3, d: 4.64, sx: -2, sy: -15}),
  side: (u) => ({tx: 0.32, ty: 0.64, tz: 0, az: 270 - 0.2 * u, el: 3, d: 5.12, sx: 139, sy: -10}),
  top: (u) => ({tx: 0.1, ty: 0.05, tz: 0, az: 270 + 0.5 * u, el: 80, d: 5.71, sx: -14, sy: 13}),
  // high angle so the jointCut windows that open upward on the L1 hip + knee read face-on
  leg: (u) => ({tx: 0.52, ty: 0.36, tz: 0.48, az: 310.65 + 0.9 * u, el: 40, d: 3.1, sx: 6, sy: -24}), // v9: framed for the longer leg (lifted foot stays in frame)
  // whole claw inside the panels, chela drive centred
  claw: (u) => ({tx: 1.185, ty: 0.438, tz: 0.118, az: 301.8 + 0.8 * u, el: 24, d: 2.44, sx: 312, sy: 128}),
  // near side view: drum faces (graphite flange / steel hub) show, tail fills the frame like official s007
  tail: (u) => ({tx: -0.489, ty: 1.056, tz: 0, az: 268.9 - 0.6 * u, el: 10, d: 3.47, sx: -172, sy: -154}),
  sting: (u) => ({tx: 0.015, ty: 0.806, tz: 0, az: 237.5 + 1.0 * u, el: 12, d: 3.6, sx: 54, sy: -52}),
  carapace: (u) => ({tx: 0.02, ty: 0.52, tz: 0, az: 324.65 + 0.9 * u, el: 35, d: 6.25, sx: -18, sy: 3}),
  teardown: (u) => ({tx: 0.12, ty: 0.72, tz: 0, az: 318, el: 22, d: 8.12, sx: -29, sy: 8}),
  hero2: (u) => ({tx: 0.3, ty: 0.56, tz: 0, az: 326 + 0.8 * u, el: 15, d: 5.25, sx: 37, sy: 30}),
  advance: (u) => ({tx: 0.3, ty: 0.62, tz: 0, az: 336 + 0.6 * u, el: 10, d: 4.81, sx: 29, sy: 2}),
};
export const VIEW_TRANS = 1.0;
// the close-ups cut in faster than the full-body states (official reads fast; beats hold 3-4 s)
const VIEW_TRANS_SHORT = {leg: 0.8, claw: 0.8, tail: 0.8, sting: 0.8};
const lerpDeg = (a, b, k) => a + ((((b - a + 540) % 360) - 180) * k);
export const viewList = (EV) => EV.filter((e) => e.view).map((e) => [e.t, e.view]);
export function viewNow(list, t) {
  let i = 0;
  while (i < list.length - 1 && list[i + 1][0] <= t) i++;
  return {view: list[i][1], since: t - list[i][0], prev: i ? list[i - 1][1] : null, i};
}
export function viewAt(list, t) {
  const {i} = viewNow(list, t);
  const cur = VIEW_FN[list[i][1]](t - list[i][0]);
  if (i === 0) return cur;
  const prev = VIEW_FN[list[i - 1][1]](t - list[i - 1][0]);
  const k = ss(list[i][0], list[i][0] + (VIEW_TRANS_SHORT[list[i][1]] ?? VIEW_TRANS), t);
  if (k >= 1) return cur;
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? lerpDeg(prev.az, cur.az, k) : prev[key] + (cur[key] - prev[key]) * k;
  // a wide swing backs off so the camera never brushes the tail
  const swing = Math.min(1, Math.abs(((cur.az - prev.az + 540) % 360) - 180) / 90);
  o.d += Math.max(0, Math.max(prev.d, cur.d) * (1 + 0.15 * swing) - o.d) * Math.sin(Math.PI * k);
  return o;
}
export const toCam = (c) => ({...c, d: c.d * 0.94, az: c.az * D2R, el: c.el * D2R});

// ------------------------------------------------------------ the operator's pointer
const REST = [[820, 600], [940, 560], [700, 610], [860, 640], [1000, 600]];
export function makeCursor(ui, EV) {
  const ev = EV.filter((e) => e.t > 0 && e.btn && ui.spots[e.btn]).map((e) => ({t: e.t, spot: ui.spots[e.btn]}));
  const WP = [[0, 840, 620]];
  ev.forEach((e, i) => {
    const next = ev[i + 1];
    WP.push([e.t - 0.18, ...e.spot]);
    WP.push([e.t + 0.22, ...e.spot]);
    // between two close presses the pointer goes straight on; otherwise it rests off the panels
    if (!next || next.t - e.t > 2.2) WP.push([e.t + 1.4, ...REST[i % REST.length]]);
    else WP.push([Math.max(e.t + 0.3, next.t - 0.75), ...e.spot]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = t1 - t0 < 0.05 ? 1 : ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(28, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of ev) {
      if (t >= e.t - 0.06 && t < e.t + 0.1) press = true;
      if (t >= e.t && t < e.t + 0.6) {
        ring = 1 - (t - e.t) / 0.6;
        [rx, ry] = e.spot;
      }
    }
    const nx = len ? -(y1 - y0) / len : 0;
    const ny = len ? (x1 - x0) / len : 0;
    return {x: x0 + (x1 - x0) * k + nx * bow, y: y0 + (y1 - y0) * k + ny * bow, press, drag: false, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ the console state for one frame
// the nine systems of spec §1; kin.js SYSTEMS (when present) supplies ids and names, this table the sub lines
const SYS_SUB = {
  chassis: 'SPINE BEAM · SIDE + CROSS BEAMS',
  leg: '8 LEGS · 3 ACTIVE + 1 PASSIVE',
  claw: '2 CHELAE · LEAD SCREW 10:1',
  tail: 'J1 2-DOF · J2–J7 PITCH',
  stinger: 'J8 · FLANGE · SENSOR BAY',
  power: '48 V PACK · DISTRIBUTION',
  control: 'CONTROLLER · STEREO · LIDAR',
  armor: '3 LAYERS · MODULAR PANELS',
  thermal: 'LIQUID LOOP · SERVICE HATCHES',
};
const SYS_FALLBACK = [
  ['01', 'CENTRAL CHASSIS', 'chassis'],
  ['02', 'EIGHT LEGS', 'leg'],
  ['03', 'DUAL CLAWS', 'claw'],
  ['04', 'SEGMENTED TAIL', 'tail'],
  ['05', 'STINGER MODULE', 'stinger'],
  ['06', 'MAIN POWER', 'power'],
  ['07', 'CONTROL + SENSORS', 'control'],
  ['08', 'ARMOUR', 'armor'],
  ['09', 'THERMAL + SERVICE', 'thermal'],
];
const sysKey = (sys) => (/^leg/.test(sys) ? 'leg' : /^claw/.test(sys) ? 'claw' : sys === 'sensor' ? 'control' : sys === 'drive' ? 'power' : sys);
export const SYSTEM_LIST = (() => {
  const src = Array.isArray(K.SYSTEMS) && K.SYSTEMS.length ? K.SYSTEMS.map((x, i) => [x.id ?? String(i + 1).padStart(2, '0'), (x.en || x.cn || '').toUpperCase(), sysKey(String(Array.isArray(x.sys) ? x.sys[0] : x.sys || ''))]) : SYS_FALLBACK;
  const SHORT = Object.fromEntries(SYS_FALLBACK.map(([, n, k]) => [k, n]));
  return src.map(([id, name, key], i) => ({id, name: SHORT[key] || name.replace(/\s*\(.*?\)/g, '').slice(0, 20), key: key || SYS_FALLBACK[i]?.[2], sub: SYS_SUB[key] || SYS_SUB[SYS_FALLBACK[i]?.[2]] || ''}));
})();

const W_TOTAL = K.SPEC.mass * K.G;
// impact force at the stinger tip during a strike: a 60 ms contact pulse at the curve's deepest point
export const IMPACT = K.STINGER?.impact ?? K.SPEC.strike;
export const HOLD_F = K.STINGER?.force ?? 0;
const U_CONTACT = (typeof K.impactAt === 'function' && K.impactAt()?.u) || (() => {
  let best = 0;
  let bv = -Infinity;
  for (let k = 0; k <= 400; k++) {
    const u = (k / 400) * STRIKE_DUR;
    const v = strikeCurve(u);
    if (v > bv) {
      bv = v;
      best = u;
    }
  }
  return best;
})();
export const impactF = (u) => (u < 0 ? 0 : IMPACT * Math.exp(-(((u - U_CONTACT) / 0.06) ** 2)));
export const CONTACT_U = U_CONTACT;
const R2D = 180 / Math.PI;
const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
export const fmtClock = (t) => '00:' + pad2(t / 60) + ':' + pad2(t % 60);
const fmtMS = (t) => pad2(t / 60) + ':' + pad2(t % 60);
const fmtN = (n) => (n >= 1000 ? (n / 1000).toFixed(2) + ' kN' : Math.round(n) + ' N');
export const SPEED_MAX = 1.2;
export const settleOf = (speed) => 1 - smooth(0.0, 0.08, speed);
const legsOf = (PHI, lift, settle) => K.legsAt(PHI, lift, settle);
const stingerPitch = (strike, yaw) => {
  const T = tailAt(strike, 0, yaw);
  return -T.ang[T.ang.length - 1] * R2D;
};
const hull = (P) => {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (const q of p.slice().reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};
const nearestOnPoly = (poly, c) => {
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const k = clamp(((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / (dx * dx + dz * dz || 1));
    const q = [a[0] + dx * k, a[1] + dz * k];
    const d = Math.hypot(q[0] - c[0], q[1] - c[1]);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return {q: best, d: bd};
};
// which scene a time is in: the last event that set a mode
const sceneOf = (EV, t) => lastOf(EV, 'mode', t);
const SCENE_KEY = {
  'SCUTTLE': 'hero', 'STANDING · FRONT': 'front', 'SIDE': 'side', 'TOP · BALANCE': 'top', 'LEG L1 LIFT': 'leg', 'CLAW L OPEN': 'claw',
  'TAIL APART': 'tail', 'STINGER': 'sting', 'CARAPACE OPEN': 'carapace', 'TEARDOWN': 'teardown', 'STANDING': 'stand', 'ADVANCE': 'advance',
};
const ISO_TXT = {hero: 'HERO', front: 'FRONT', side: 'SIDE', top: 'TOP', leg: 'LEG L1', claw: 'CLAW L', tail: 'TAIL', sting: 'STINGER', carapace: 'CARAPACE', teardown: 'ALL', stand: 'HERO', advance: 'HERO'};
const FOCUS_SYS = {leg: 'leg', claw: 'claw', tail: 'tail', sting: 'stinger', carapace: 'armor', top: 'chassis'};

const JOINT = (id) => (Array.isArray(K.JOINTS) ? K.JOINTS.find((j) => j.id === id || (j.en || '').toLowerCase().includes(id)) : null);
const KNEE_RATED = JOINT('knee')?.rated || 420;
const gripN = (o) => (K.gripForce ? K.gripForce(o.open, o.squeeze) : 0) * 1000 * smooth(0, 0.35, o.squeeze);

/**
 * src: {EV, duration, phiAt(t), xAt(t), list (viewList), env (THREE.Box3 of the shell at rest, body frame), live}
 * returns frame(t, o, cursor) -> pushes the whole console state for time t
 */
export function makeConsoleFrame(ui, st, src) {
  // src.EV and src.duration may change between frames (the live page's own event list)
  let EV = src.EV;
  let ticks = [];
  let nActs = 0;
  let seen = null;
  let seenN = -1;
  const env = src.env;
  const P = (p) => st.project(p);
  const W = (p) => st.toWorld(p);
  const fade = (t, a, b, inD = 0.6, outD = 0.35) => (t < a || t > b + outD ? 0 : t < a + inD ? E.enter((t - a) / inD) : t > b ? 1 - E.exit((t - b) / outD) : 1);
  const sceneSpan = (t) => {
    const ms = EV.filter((e) => e.mode);
    let i = 0;
    while (i < ms.length - 1 && ms[i + 1].t <= t) i++;
    return {a: ms[i].t, b: i < ms.length - 1 ? ms[i + 1].t : src.duration + 10, key: SCENE_KEY[ms[i].mode] || 'hero', mode: ms[i].mode};
  };
  // a screen dimension between two body-frame points, the normal pushed away from the machine's screen centre
  const dim = (a, b, off, text, o, c2) => {
    const A = P(W(a));
    const B = P(W(b));
    if (!A || !B) return null;
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const l = Math.hypot(dx, dy) || 1;
    let n = [-dy / l, dx / l];
    const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    if ((m[0] - c2[0]) * n[0] + (m[1] - c2[1]) * n[1] < 0) n = [-n[0], -n[1]];
    return {a: A, b: B, n, off, text, o};
  };
  // callouts: leader from the anchor to a label column beside the machine, de-overlapped per side
  const place = (items, o) => {
    const out = [];
    const sides = {l: [], r: []};
    for (const it of items) {
      const at = it.at3 ? P(it.at3) : null;
      if (!at || o < 0.02) continue;
      const side = it.side || (at[0] < 790 ? 'l' : 'r');
      sides[side].push({...it, at});
    }
    for (const k of ['l', 'r']) {
      const L = sides[k].sort((a, b) => a.at[1] - b.at[1]);
      let last = -1e9;
      for (const c of L) {
        let lx = c.at[0] + (k === 'l' ? -(c.dx ?? 110) : c.dx ?? 110);
        lx = k === 'r' ? Math.min(1000, Math.max(345, lx)) : Math.min(1000, Math.max(345 + 250, lx));
        let ly = Math.max(c.at[1] + (c.dy ?? -26), last + 40);
        ly = Math.min(632, Math.max(150, ly));
        last = ly;
        out.push({at: c.at, lx, ly, name: c.name, sub: c.sub, o: o * (c.o ?? 1)});
      }
    }
    return out;
  };
  const anchor = (k) => st.robot.anchorAt?.(k) || null;
  // one numbered tag per tail section, pushed to the outside of the curl, with its section size
  const tailTags = (p3, op, since, fn, joints) => {
    const S2 = p3.map((p) => P(W(p)));
    if (S2.some((q) => !q)) return [];
    const cxs = S2.reduce((a, q) => a + q[0], 0) / S2.length;
    const cys = S2.reduce((a, q) => a + q[1], 0) / S2.length;
    const en = K.TAIL.en || [];
    const out = [];
    for (let k = 0; k < 8; k++) {
      const a = S2[joints ? Math.max(0, k - 1) : k];
      const b = S2[k + 1];
      const m = joints ? S2[k] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      let n = [-dy / l, dx / l];
      if ((m[0] - cxs) * n[0] + (m[1] - cys) * n[1] < 0) n = [-n[0], -n[1]];
      const o2 = op * E.enter(clamp((since - k * 0.09) / 0.45));
      const lab = fn ? fn(k) : null;
      const R0 = joints ? 64 : 46;
      if (lab) {
        out.push({at: m, x: m[0] + n[0] * R0, y: m[1] + n[1] * R0, ...lab, o: o2, right: n[0] >= 0});
        continue;
      }
      out.push({at: m, x: m[0] + n[0] * R0, y: m[1] + n[1] * R0, k: 'S' + (k + 1), name: (en[k] || '').replace('END MOUNT', 'END').replace('ROOT MOUNT', 'ROOT').replace('STINGER', 'STING'), sub: Math.round((K.TAIL.width?.[k] || 0) * 1000) + '×' + Math.round((K.TAIL.height?.[k] || 0) * 1000), o: o2, right: n[0] >= 0});
    }
    return out;
  };
  const stages = Array.isArray(st.robot.EXPLODE_STAGES) ? st.robot.EXPLODE_STAGES : Array.isArray(src.stages) ? src.stages : null;

  return (t, o, cursor) => {
    EV = src.EV;
    if (EV !== seen || EV.length !== seenN || src.live) {
      seen = EV;
      seenN = EV.length;
      // the official console's timeline ticks are a uniform time grid, not the operator's presses
      const nTick = Math.max(2, Math.round(src.duration / 5));
      ticks = Array.from({ length: nTick - 1 }, (_, i) => (i + 1) / nTick);
      nActs = EV.filter((e) => e.btn).length;
    }
    const sc = sceneSpan(t);
    const PHI = src.phiAt(t);
    const X = src.xAt(t);
    const settle = settleOf(o.speed);
    const LG = legsOf(PHI, o.lift, settle);
    const legs = LG.legs;
    const T = tailAt(o.strike, 0, o.tailYaw);
    const c2 = P([X + 0.1, 0.55, 0]) || [800, 450];
    const s = {cursor, clock: fmtClock(t), hint: src.hint || ''};

    // ---------------- gait
    const freq = o.speed / STRIDE;
    const rows = LEG_ROWS.map(() => []);
    const NS = 72;
    const HIST = 3;
    for (let r = 0; r < 8; r++) {
      const i = LEG_ROWS[r];
      let run = null;
      for (let k = 0; k <= NS; k++) {
        const tp = t - HIST + (HIST * k) / NS;
        const op = tp >= 0 ? opsAt(EV, tp) : o;
        const sw = !footAt(i, src.phiAt(tp), settleOf(op.speed)).stance || (i === 0 && op.lift > 0.05);
        const u = k / NS;
        if (sw && !run) run = [u, u];
        if (sw) run[1] = u;
        if (!sw && run) {
          rows[r].push(run);
          run = null;
        }
      }
      if (run) rows[r].push(run);
    }
    const down = legs.filter((l) => l.stance).length;
    s.gait = {
      hz: freq,
      mms: o.speed * 1000,
      rows,
      pattern: o.lift > 0.05 ? 'LIFT · 7 FEET' : settle > 0.5 ? 'STANCE · ' + down + ' FEET' : 'ALT TETRAPOD',
      duty: 'DUTY ' + (settle > 0.5 ? 100 : Math.round(K.DUTY * 100)) + '%',
    };

    // ---------------- tail strike: J1 pitch, its rate, the J1 gravity torque
    const j1 = T.ang[0] * R2D;
    const dt = 1 / 60;
    const j1b = tailAt(strikeAt(EV, Math.max(0, t - dt)), 0, 0).ang[0] * R2D;
    const vel = Math.abs(j1 - j1b) / dt;
    const armed = o.strikeU >= 0;
    s.tail = {
      deg: j1,
      gauge: j1 / 180,
      hot: armed,
      cells: [Math.round(vel) + ' °/S', Math.round(T.torque[0]) + ' N·M', armed ? (o.strikeU >= U_CONTACT - 0.15 ? Math.round(impactF(o.strikeU)) + ' N' : 'ARMED') : 'LOCKED'],
      labels: ['VELOCITY', 'TORQUE J1', armed ? 'IMPACT' : 'STINGER'],
    };

    // ---------------- leg servos: knee torque against the rated torque
    const expl = o.explode > 0.5;
    s.legs = LEG_ROWS.map((i) => {
      const l = legs[i];
      const kt = l.kneeTorque ?? l.torque ?? 0;
      const k = kt / KNEE_RATED;
      if (expl) return {k: 0, txt: 'DETACHED', hot: false, dim: true};
      if (!l.stance) return {k: 0.02, txt: 'SWING', hot: i === 0 && o.lift > 0.05, dim: true};
      return {k, txt: Math.round(k * 100) + '%', hot: (sc.key === 'leg' && i === 0) || k > 0.6};
    });
    s.legBadge = expl ? {text: 'DETACHED', hot: true} : o.lift > 0.05 ? {text: 'L1 LIFT', hot: true} : settle > 0.5 ? {text: 'HOLDING', hot: false} : {text: 'STEPPING', hot: false};

    // ---------------- claw grip
    const N = gripN(o);
    const hist = [];
    for (let k = 0; k < 48; k++) hist.push(gripN(opsAt(EV, Math.max(0, t - 3 + (3 * k) / 47))));
    const gapL = K.CLAW.gapMax * o.open;
    const gapR = K.CLAW.gapMax * (EV === SCRIPT ? 0.18 + 0.02 * Math.sin(1.3 * t) : o.open);
    const gripping = o.gripU >= 0;
    const cmode = gripping ? (o.squeeze > 0.6 ? 'CLAMP' : o.gripU < 1.5 ? 'OPEN' : 'CLOSING') : o.squeeze > 0.3 ? 'HOLD' : 'IDLE';
    s.claw = {
      N,
      hist,
      rows: [
        {k: o.open, txt: Math.round(gapL) + '°', hot: gripping},
        {k: gapR / K.CLAW.gapMax, txt: Math.round(gapR) + '°', hot: false},
      ],
      mode: cmode,
      aper: Math.round(gapL) + '°',
    };

    if (N >= 1000) {
      s.claw.big = (N / 1000).toFixed(2);
      s.claw.unit = 'kN';
    } else {
      s.claw.big = String(Math.round(N));
      s.claw.unit = 'N';
    }

    // ---------------- buttons
    const vnow = viewNow(src.list, t).view;
    s.on = {
      hero: ['hero', 'stand', 'advance'].includes(sc.key),
      leg: sc.key === 'leg', claw: sc.key === 'claw', tail: sc.key === 'tail', stinger: sc.key === 'sting', carapace: sc.key === 'carapace',
      strike: armed,
      front: vnow === 'front', side: vnow === 'side', top: vnow === 'top',
      labels: o.labels > 0.5, section: o.jointCut > 0.5 || o.cut > 0.5, explode: o.explode > 0.5, turntable: o.turn > 0.5,
      trace: o.trace > 0.5, balance: o.balance > 0.5,
    };

    // ---------------- subsystems
    const focus = FOCUS_SYS[sc.key];
    const carOpen = sc.key === 'carapace';
    const badge = {
      chassis: 'LOADED',
      leg: o.lift > 0.05 ? 'L1 LIFT' : settle > 0.5 ? 'HOLDING' : 'STEPPING',
      claw: gripping ? cmode : 'CLOSED',
      tail: o.tailYaw !== 0 ? 'SWEEP' : 'RAISED',
      stinger: armed ? 'ARMED' : 'LOCKED',
      power: 'ONLINE',
      control: 'TRACKING',
      armor: carOpen ? 'OPEN' : 'SEALED',
      thermal: carOpen ? 'EXPOSED' : 'NOMINAL',
    };
    const hotKey = {leg: o.lift > 0.05, claw: gripping, tail: o.tailYaw !== 0, stinger: armed, armor: carOpen, thermal: carOpen, power: carOpen, control: carOpen};
    s.systems = SYSTEM_LIST.map((y) => ({
      id: y.id, name: y.name, sub: y.sub, sys: y.key,
      badge: expl ? 'DETACHED' : badge[y.key] || 'ONLINE',
      hot: expl || !!hotKey[y.key],
      focus: y.key === focus || (carOpen && ['power', 'control', 'thermal'].includes(y.key)),
    }));

    // ---------------- header, log, mode
    const meanKnee = legs.reduce((a, l) => a + (l.kneeTorque ?? 0), 0) / 8 / KNEE_RATED;
    s.load = clamp(0.08 + 0.5 * (o.speed / SPEED_MAX) + 0.6 * meanKnee + (armed ? 0.22 * Math.max(0, o.strike) : 0) + (gripping ? 0.12 * o.squeeze : 0) + (expl ? -0.1 : 0), 0.04, 1);
    s.status = sc.mode.split(' · ')[0];
    s.statusHot = !['SCUTTLE', 'STANDING', 'ADVANCE'].includes(s.status);
    s.isoTxt = 'ISOLATE · ' + (ISO_TXT[sc.key] || 'HERO');
    const lastSay = lastOf(EV, 'say', t);
    s.now = lastSay ? (lastSay.btn && lastSay.t > 0 ? 'OPERATOR · ' : '') + lastSay.say : '';
    s.progress = t / src.duration;
    s.ticks = ticks;
    s.tlClock = fmtMS(t) + ' / ' + fmtMS(src.duration);
    s.actions = nActs;
    s.mode = sc.mode;
    s.modeO = sc.a > 0 ? E.enter(clamp((t - sc.a) / 0.5)) : 1;
    // second line under the big OPERATION MODE label, like the official console (MM/S, aperture, tail angle, ...)
    const mmOf = (v) => String(Math.round(v * 1000));
    const MODE_SUB = {
      hero: () => Math.round(s.gait.mms) + ' MM/S · ' + s.gait.pattern,
      front: () => (env ? 'W ' + mmOf(env.max.z - env.min.z) + ' · H ' + mmOf(env.max.y - env.min.y) + ' MM' : ''),
      side: () => (env ? 'L ' + mmOf(env.max.x - env.min.x) + ' MM · 8 TAIL SECTIONS' : ''),
      top: () => 'COG + SUPPORT POLYGON',
      leg: () => 'LEG L1 · LIFT ' + Math.round(o.lift * 100) + '%',
      claw: () => 'CLAW L · ' + Math.round(gapL) + '° APERTURE',
      tail: () => 'TAIL YAW ' + Math.round(o.tailYaw * R2D) + '° · 8 SECTIONS',
      sting: () => 'TAIL ' + Math.round(s.tail.deg) + '° · ' + Math.round(vel) + ' °/S',
      carapace: () => 'CARAPACE · 3 LAYERS · SECTION',
      teardown: () => Math.round(o.explode * 100) + '% APART · ASSEMBLY ORDER',
      stand: () => 'REASSEMBLED · 8 FEET',
      advance: () => Math.round(s.gait.mms) + ' MM/S · STRIKE ARMED',
    };
    s.modeSub = (MODE_SUB[sc.key] || (() => ''))();

    // ---------------- CAD layer: ground rings and a vertical circle around the machine, crosshair marks
    const cad = [];
    const cpos = st.camera.position;
    const cdir = st.camera.getWorldDirection(new cpos.constructor());
    const ring = (fnPt, n, closed, extra) => {
      let d = '';
      let pen = false;
      for (let k = 0; k <= n; k++) {
        const w = fnPt(k / n);
        // points close to or behind the camera plane project to huge coordinates: lift the pen there
        if ((w[0] - cpos.x) * cdir.x + (w[1] - cpos.y) * cdir.y + (w[2] - cpos.z) * cdir.z < 0.8) {
          pen = false;
          continue;
        }
        const q = P(w);
        if (!q || q[1] < -400 || q[1] > 1300 || q[0] < -400 || q[0] > 2000) {
          pen = false;
          continue;
        }
        d += (pen ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
        pen = true;
      }
      if (d) cad.push({d, o: 1, ...extra});
    };
    const cx0 = X + 0.1;
    const cadO = sc.key === 'teardown' ? 0.6 : 1;
    ring((u) => [cx0 + 1.55 * Math.cos(2 * Math.PI * u), 0.002, 1.55 * Math.sin(2 * Math.PI * u)], 96, true, {dash: '5 5', o: cadO});
    ring((u) => [cx0 + 2.5 * Math.cos(2 * Math.PI * u), 0.002, 2.5 * Math.sin(2 * Math.PI * u)], 120, true, {o: cadO});
    {
      // a tall arc in a vertical plane turned 55° off the line of sight, so it always reads as an ellipse
      const cp = st.camera.position;
      const a = Math.atan2(cp.z, cp.x - cx0) + 55 * D2R;
      const ux = Math.cos(a);
      const uz = Math.sin(a);
      ring((u) => [cx0 + 1.9 * ux * Math.cos(Math.PI * u), 0.3 + 1.9 * Math.sin(Math.PI * u), 1.9 * uz * Math.cos(Math.PI * u)], 72, false, {o: cadO * 0.8});
    }
    const marks = [];
    for (const q of [[cx0, 0, 0], [cx0 + 1.55, 0, 0], [cx0 - 1.55, 0, 0], [cx0, 0, 1.55], [cx0, 0, -1.55]]) {
      const p = P(q);
      if (p) marks.push({x: p[0], y: p[1], o: cadO, r: 5});
    }
    // gait trace: every foot's path over the ground for the last 1.4 s
    if (o.trace > 0.02 && o.speed > 0.02) {
      for (const i of [0, 1, 2, 3, 4, 5, 6, 7]) {
        let d = '';
        for (let k = 0; k <= 28; k++) {
          const tp = t - 1.4 + (1.4 * k) / 28;
          const ph = src.phiAt(tp);
          const fp = K.footAt(i, ph).pos;
          const q = P([src.xAt(tp) + fp[0], fp[1], fp[2]]);
          if (q) d += (d ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
        }
        // L1 in the accent, the other seven in ink (official: one highlighted leg)
        cad.push(i === 0 ? {d, o: o.trace * 0.9, accent: true, w: 1.4} : {d, o: o.trace * 0.9, w: 1});
      }
    }
    s.cad = cad;
    s.marks = marks;

    // ---------------- dimension lines (from the shell's real bounding box at rest)
    const dims = [];
    if (env) {
      const [x0, y0, z0] = [env.min.x, env.min.y, env.min.z];
      const [x1, y1, z1] = [env.max.x, env.max.y, env.max.z];
      const mm = (v) => String(Math.round(v * 1000));
      // dimension lines belong to the FRONT and SIDE scenes, timed from the scene's start (film and live alike)
      const fF = sc.key === 'front' ? fade(t, sc.a + 0.5, sc.b - 0.4) : 0;
      const fS = sc.key === 'side' ? fade(t, sc.a + 0.5, sc.b - 0.4) : 0;
      if (fF > 0) {
        dims.push(dim([x1, y1, z1], [x1, y1, z0], 34, mm(z1 - z0), fF, c2));
        dims.push(dim([x1, 0, z0], [x1, y1, z0], 46, mm(y1 - y0), fF * E.enter(clamp((t - sc.a - 0.9) / 0.6)), c2));
      }
      if (fS > 0) {
        dims.push(dim([x0, y1, z1], [x1, y1, z1], 34, mm(x1 - x0), fS, c2));
        dims.push(dim([x1, 0, z1], [x1, y1, z1], 46, mm(y1 - y0), fS * E.enter(clamp((t - sc.a - 0.9) / 0.6)), c2));
      }
    }
    s.dims = dims.filter(Boolean);

    // ---------------- balance: support polygon of the planted feet, CoG and its margin
    if (o.balance > 0.02) {
      const planted = legs.filter((l) => l.stance).map((l) => [l.footP[0], l.footP[2]]);
      const poly = hull(planted);
      const cg = LG.cog || (K.cogAt ? K.cogAt({PHI}) : [0, 0.4, 0]);
      const near = poly.length >= 3 ? nearestOnPoly(poly, [cg[0], cg[2]]) : {q: [cg[0], cg[2]], d: 0};
      const sup = K.supportAt ? K.supportAt(PHI) : null;
      const margin = sup?.margin ?? near.d;
      const G2 = (p) => P(W([p[0], 0.003, p[1]]));
      s.balance = {
        o: o.balance,
        poly: poly.map(G2).filter(Boolean),
        feet: planted.map(G2).filter(Boolean),
        cog: G2([cg[0], cg[2]]),
        near: G2(near.q),
        txt: 'X ' + Math.round(cg[0] * 1000) + ' · Y ' + Math.round(cg[1] * 1000) + ' MM · MARGIN ' + Math.round(margin * 1000) + ' MM',
      };
    }

    // ---------------- callouts and bars per scene
    const calls = [];
    const bars = [];
    const lo = (a, b) => fade(t, sc.a + a, sc.b - b);
    const jt = (id) => JOINT(id);
    const jsub = (id, fb) => {
      const j = jt(id);
      return j && /^[\x20-\x7e·×]*$/.test(String(j.drive || '') + (j.transmission || '')) ? [j.drive, j.transmission].filter(Boolean).join(' · ').toUpperCase().slice(0, 34) : fb;
    };
    const A = (k, fb) => anchor(k) || (fb ? W(fb) : null);
    if (sc.key === 'leg') {
      const l = legs[0];
      const op = lo(1.9, 0.3) * o.labels;
      calls.push({at3: A('hipL1', l.hip), name: 'HIP · YAW + PITCH', sub: jsub('hip pitch', 'PMSM · HARMONIC 100:1') , side: 'r', dx: 150, dy: -60});
      calls.push({at3: A('kneeL1', l.kneeP), name: 'KNEE ACTUATOR', sub: Math.round(l.kneeTorque ?? 0) + ' N·M · ' + Math.round(l.knee * R2D) + '°', side: 'r', dx: 150, dy: -10});
      calls.push({at3: A('footL1', l.footP), name: 'FOOT · PASSIVE ANKLE', sub: 'PAD + PRESSURE SENSOR', side: 'r', dx: 140, dy: 20});
      calls.push({at3: A('hipL1', l.hip), name: 'MOTOR · REDUCER', sub: 'CROSSED-ROLLER BEARING · ENCODER', side: 'l', dx: 160, dy: 30});
      s.calls = place(calls, op);
    } else if (sc.key === 'claw') {
      const dr = K.clawAt ? K.clawAt(1, o.open, o.reach).drive : null;
      const op = lo(0.7, 0.3);
      const cl = K.clawAt(1, o.open, o.reach);
      const CD = K.CLAW_DRIVE || {};
      calls.push({at3: A('clawScrew', cl.W), name: 'LEAD SCREW Tr20×4', sub: dr ? 'NUT ' + (dr.nut * 1000).toFixed(1) + ' MM · ' + dr.screwRev.toFixed(1) + ' REV' : 'MOTOR · PLANETARY 10:1', side: 'l', dx: 150, dy: -40});
      calls.push({at3: A('clawTip', cl.tip), name: 'MOVABLE FINGER', sub: 'GAP ' + Math.round(K.CLAW.gapMax * o.open) + '° · ' + (N >= 1000 ? (N / 1000).toFixed(2) + ' KN' : Math.round(N) + ' N'), side: 'r', dx: 120, dy: -30});
      calls.push({at3: A('clawL', cl.S), name: 'BASE · YAW + PITCH', sub: 'MOTOR · PLANETARY ' + (CD.ratio || 10) + ':1', side: 'r', dx: 150, dy: 40});
      s.calls = place(calls, op);
    } else if (sc.key === 'tail' || sc.key === 'side') {
      const p3 = T.pts3 || T.pts.map(([x, y]) => [x, y, 0]);
      if (sc.key === 'tail') {
        const op = lo(0.6, 0.3);
        const tmax = Math.max(...T.torque);
        const rated = (j) => jt('j' + (j + 1))?.rated || tmax * 1.4;
        s.tags = tailTags(p3, op, t - sc.a - 0.6, (j) => ({k: 'J' + (j + 1), name: Math.round(T.torque[j]) + ' N·M', sub: Math.round((100 * T.torque[j]) / rated(j)) + '% RATED'}), true);
        void tmax;
      } else {
        const op = fade(t, sc.a + 0.9, sc.b - 0.2);
        s.tags = tailTags(p3, op, t - sc.a - 0.9);
      }
    } else if (sc.key === 'sting') {
      const op = lo(0.5, 0.3);
      const tip = T.pts3 ? T.pts3[T.pts3.length - 1] : [...T.tip, 0];
      const j8 = T.pts3 ? T.pts3[7] : [...T.pts[7], 0];
      calls.push({at3: A('sting', tip), name: 'STINGER · ' + Math.round(IMPACT) + ' N PEAK IMPACT', sub: 'HOLD ' + Math.round(HOLD_F) + ' N · PITCH ' + Math.round(stingerPitch(o.strike, o.tailYaw)) + '°', side: 'r', dx: 130, dy: 10});
      calls.push({at3: W(j8), name: 'J8 STINGER JOINT', sub: Math.round(T.torque[7]) + ' N·M · ' + jsub('j8', 'SERVO · HARMONIC'), side: 'r', dx: 150, dy: -50});
      s.calls = place(calls, op);
    } else if (sc.key === 'carapace') {
      const op = lo(2.2, 0.3);
      const bay = [['power', 'POWER BAY', '48 V PACK · BMS'], ['control', 'CONTROL BAY', 'MAIN CONTROLLER · IMU'], ['drive', 'DRIVE BAY', '8 LEG DRIVERS'], ['thermal', 'THERMAL BAY', 'PUMP · RADIATOR'], ['sensor', 'SENSOR HEAD', 'STEREO · DEPTH · LIDAR']];
      for (const [k, n, sub] of bay) {
        const a = anchor(k);
        if (a) calls.push({at3: a, name: n, sub, dx: 130});
      }
      calls.push({at3: A('armor', [0, 0.95, 0]), name: 'ARMOUR · 3 LAYERS', sub: 'PANELS · ISOLATORS · FRAME', side: 'r', dx: 150, dy: -70});
      s.calls = place(calls, op);
    } else if (sc.key === 'teardown') {
      const op = lo(1.4, 0.4);
      const list = stages || [{en: 'ARMOUR OFF'}, {en: 'SENSOR HEAD'}, {en: 'STINGER · TAIL'}, {en: 'CLAWS'}, {en: 'LEGS'}, {en: 'MODULES'}, {en: 'ACTUATOR INTERNALS'}];
      const at = ['armor', 'sensor', 'sting', 'clawL', 'footL1', 'power', 'hipL1'];
      list.slice(0, 7).forEach((g, i) => {
        const a = anchor(at[i]);
        if (a) calls.push({at3: a, name: String(i + 1).padStart(2, '0') + ' · ' + String(g.en || g.cn || '').toUpperCase(), sub: 'ASSEMBLY STAGE ' + (i + 1), dx: 120});
      });
      s.calls = place(calls, op);
    }
    if (!s.calls) s.calls = [];
    if (!s.tags) s.tags = [];
    s.bars = bars;
    ui.update(s);
    return s;
  };
}
