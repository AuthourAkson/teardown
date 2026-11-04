// SCORPION SC-8 v9, the central body: load frame, five bay modules, sensor head and the armour, built in metres in
// the body frame (x forward, y up, z left); every interface number comes from kin.js.
// Silhouette: a teardrop in plan (widest at the shoulders, narrowing to the tail root). One sculpted prosoma shield
// (head + front legs) with a smoke-glass canopy, then six cambered tergite plates shrinking toward the rear; graphite
// hoops and a thin orange seam band show in the 12 mm gaps. Every shell is split into flank / dorsal / flank panels by
// thin grooves over a dark under-shell, with carina ridges. Faceted ivory sensor head with lamp eyes (median pair +
// lateral rows) and black chelicerae; ivory sternum plates under the belly; flank skirts hide the hip brackets.
//   chassis  spine beam, two side rails at the hip line, eight hip brackets + steel pads (outer face |hip.z| - 0.065),
//            cross ties, tray, shell standoffs, front frame with the two claw-yaw flanges (top CLAW.shoulder.y - 0.14)
//            and the head post, rear frame + deck with the tail J1 turntable flange (top TAIL.root.y - 0.15), bulkhead
//   bays     power (8 battery modules, BMS, busbars) on the tray; thermal (cold plate, pump, reservoir, radiator, fans,
//            copper loop); drive (8 servo cards on a cold plate, PDU, leg connector panel); control (computer, motion
//            controller, comms, IMU on isolators) under the canopy; sensor bay (perception unit) behind the head
// Clearances: armour above y 0.43 ends at x >= -0.29 (tail J1 sweep), shell rim over the hips at y >= 0.49, shield rim
// near the claw shoulders at y >= 0.505, head half width <= 0.095, crown < 0.64 (< 0.62 at x < -0.3).
// Static parts are merged per material inside each explode unit.
import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {BODY, CLAW, LEGS, TAIL} from './kin.js';
import {bolts, cable, merge, mesh, rbox, tag} from './parts.js';

const V3 = THREE.Vector3;
const PI = Math.PI;
const R = BODY.ride; // hip line
const PAD_BACK = 0.065; // hip pad outer face sits this far inside the hip point (legs.js MOUNT_BACK)
const BEAM_W = 0.04;
const BEAM_H = 0.09;
const FLANGE_TOP_CLAW = CLAW.shoulder[1] - 0.14;
const FLANGE_TOP_TAIL = TAIL.root[1] - 0.15;
const _E = new THREE.Euler();
const _M = new THREE.Matrix4();
const rot = (g, r) => (r ? g.applyMatrix4(_M.makeRotationFromEuler(_E.set(r[0] || 0, r[1] || 0, r[2] || 0))) : g);
const cylAxis = (r, h, axis, seg, r2 = r) => {
  const g = new THREE.CylinderGeometry(r2, r, h, seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
};
const ringAxis = (rO, rI, h, axis, seg = 40) => {
  const c = Math.min(h * 0.2, (rO - rI) * 0.25);
  const p = [[rI, -h / 2], [rO - c, -h / 2], [rO, -h / 2 + c], [rO, h / 2 - c], [rO - c, h / 2], [rI, h / 2], [rI, -h / 2]];
  const g = new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
};
/**
 * An explode unit: one Group (at the body origin, so explode is a plain offset) collecting static geometry per
 * material, bolt holes and bolt heads; flush() turns each material bucket into one mesh and stamps the CONTRACT tags.
 */
function makeUnit(M, parent, ud) {
  const group = new THREE.Group();
  group.name = ud.name || ud.sys;
  parent.add(group);
  const geos = new Map();
  const holes = [];
  const heads = [];
  const u = {
    group,
    ud,
    add(mat, geo) {
      if (!geos.has(mat)) geos.set(mat, []);
      geos.get(mat).push(geo);
      return geo;
    },
    box(mat, l, h, w, x, y, z, r = 0.004, rr) {
      return u.add(mat, rot(rbox(l, h, w, r, 1), rr).translate(x, y, z));
    },
    cyl(mat, r, h, x, y, z, axis = 'y', seg = 24, r2 = r) {
      return u.add(mat, cylAxis(r, h, axis, seg, r2).translate(x, y, z));
    },
    ring(mat, rO, rI, h, x, y, z, axis = 'y', seg = 40) {
      return u.add(mat, ringAxis(rO, rI, h, axis, seg).translate(x, y, z));
    },
    hole(p, n = [0, 1, 0], r) {
      holes.push({p, n, r});
    },
    head(p, n = [0, 1, 0], r) {
      heads.push({p, n, r});
    },
    obj(o) {
      group.add(o);
      return o;
    },
    marker(x, y, z) {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      group.add(o);
      return o;
    },
    flush() {
      for (const [mat, list] of geos) group.add(mesh(merge(list), mat, {M}));
      if (holes.length) group.add(bolts(holes, {M, r: 0.0045}));
      if (heads.length) group.add(bolts(heads, {M, r: 0.0042, head: true, mat: 'steel'}));
      tag(group, {sys: ud.sys, order: ud.order, explode: ud.explode, cut: ud.cut, internal: !!ud.internal});
      group.userData.unit = {order: ud.order, explode: ud.explode};
      return group;
    },
  };
  return u;
}
const _va = new V3();
const _vb = new V3();
const _vx = new V3();
const _vy = new V3();
const _vz = new V3();
/** a round tube through a list of 3D points */
function tubeGeo(points, r, seg = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p.clone() : new V3(...p))), false, 'centripetal');
  return new THREE.TubeGeometry(curve, Math.max(10, points.length * 6), r, seg, false);
}
/** a rounded-box strut from a to b, h tall and w wide, local +x along a->b, up hint +y */
function strutGeo(a, b, h, w, r = 0.004, up = [0, 1, 0]) {
  _va.set(...a);
  _vb.set(...b);
  _vx.subVectors(_vb, _va);
  const len = _vx.length();
  _vx.normalize();
  _vy.set(...up);
  _vz.crossVectors(_vx, _vy);
  if (_vz.lengthSq() < 1e-8) {
    _vy.set(1, 0, 0);
    _vz.crossVectors(_vx, _vy);
  }
  _vz.normalize();
  _vy.crossVectors(_vz, _vx).normalize();
  const g = rbox(len, h, w, r, 1);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(_vx.clone(), _vy.clone(), _vz.clone()));
  g.translate((_va.x + _vb.x) / 2, (_va.y + _vb.y) / 2, (_va.z + _vb.z) / 2);
  return g;
}
const lerp = (t, a, b) => a + (b - a) * t;
/** a piecewise linear profile: pts = [[x, value], ...] ascending in x */
const profile = (pts) => (x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) return lerp((x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]), pts[i - 1][1], pts[i][1]);
  }
  return pts[pts.length - 1][1];
};

// ------------------------------------------------------------ v9 shell geometry
const SEN = 2.4; // superellipse exponent of the carapace section
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seP = (a, b, f) => {
  const c = Math.cos(f);
  const s = Math.sin(f);
  return [b * Math.sign(s) * Math.abs(s) ** (2 / SEN), a * Math.sign(c) * Math.abs(c) ** (2 / SEN)];
};
// carapace plan half width, crown and section centre height along x (teardrop: widest at the shoulders)
const HW = profile([[-0.29, 0.152], [-0.24, 0.18], [-0.18, 0.212], [-0.12, 0.242], [-0.06, 0.266], [0.0, 0.284], [0.08, 0.296], [0.2, 0.3], [0.28, 0.282], [0.34, 0.245], [0.38, 0.2], [0.4, 0.165]]);
const TOP = profile([[-0.29, 0.574], [-0.2, 0.597], [-0.1, 0.617], [0.0, 0.629], [0.14, 0.636], [0.28, 0.628], [0.35, 0.612], [0.4, 0.596]]);
const YC = profile([[-0.29, 0.512], [0.22, 0.52], [0.4, 0.545]]);
const F0 = -0.16; // the shells wrap this far (rad) below the section equator
/** carapace section point at angle f (0 = +z flank, PI/2 = crown), offset d along the surface: [y, z] */
const secPt = (x, f, d = 0) => {
  const [dy, z] = seP(HW(x) + d, TOP(x) - YC(x) + d, f);
  return [YC(x) + dy, z];
};
/** outward surface normal [0, ny, nz] at (x, f) */
const secN = (x, f) => {
  const p = secPt(x, f - 1e-3);
  const q = secPt(x, f + 1e-3);
  let ny = q[1] - p[1];
  let nz = -(q[0] - p[0]);
  const m = secPt(x, f);
  if (ny * (m[0] - YC(x)) + nz * m[1] < 0) [ny, nz] = [-ny, -nz];
  const l = Math.hypot(ny, nz) || 1;
  return [0, ny / l, nz / l];
};
const crescentX = (x, d, t, g0, g1, n) => {
  const P = [];
  for (let i = 0; i <= n; i++) P.push(secPt(x, g0 + ((g1 - g0) * i) / n, d));
  for (let i = n; i >= 0; i--) P.push(secPt(x, g0 + ((g1 - g0) * i) / n, d - t));
  return P;
};
/** sweep closed (y, z) loops along ascending x: side + two caps, watertight */
function loftRings(rings) {
  for (const r of rings) {
    let A = 0;
    for (let j = 0; j < r.P.length; j++) {
      const p = r.P[j];
      const q = r.P[(j + 1) % r.P.length];
      A += p[0] * q[1] - q[0] * p[1];
    }
    if (A < 0) r.P = r.P.slice().reverse();
  }
  const N = rings.length - 1;
  const M = rings[0].P.length;
  const pos = [];
  const idx = [];
  for (const r of rings) for (const [y, z] of r.P) pos.push(r.x, y, z);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      const c = (i + 1) * M + j;
      const d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, b, c, b, d, c);
    }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  side.setIndex(idx);
  side.computeVertexNormals();
  const out = [side];
  for (const [r, sgn] of [[rings[0], -1], [rings[N], 1]]) {
    const tris = THREE.ShapeUtils.triangulateShape(r.P.map(([y, z]) => new THREE.Vector2(y, z)), []);
    const cp = [];
    for (const t of tris) {
      let [a, b, c] = t.map((i) => r.P[i]);
      const nx = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (nx * sgn < 0) [b, c] = [c, b];
      for (const p of [a, b, c]) cp.push(r.x, p[0], p[1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    g.computeVertexNormals();
    out.push(g);
  }
  return out;
}
/** a cambered carapace plate from x0 (rear) to x1 (front): rolled rims, optional shingle lip (rear raised) */
function shell(u, mat, x0, x1, o = {}) {
  const {d = 0, t = 0.012, g0 = F0, g1 = PI - F0, n = 30, lip = 0, roll = 0.004} = o;
  const L = x1 - x0;
  const e = Math.min(0.009, L / 4);
  const xs = [x0, x0 + e * 0.35, x0 + e];
  const k = Math.max(2, Math.round((L - 2 * e) / 0.02));
  for (let i = 1; i < k; i++) xs.push(x0 + e + ((L - 2 * e) * i) / k);
  xs.push(x1 - e, x1 - e * 0.35, x1);
  const rollAt = (x) => roll * (smooth01(1 - (x - x0) / e) ** 2 + smooth01(1 - (x1 - x) / e) ** 2);
  const dAt = (x) => d + lip * (0.5 - (x - x0) / L);
  for (const g of loftRings(xs.map((x) => ({x, P: crescentX(x, dAt(x) - rollAt(x), t, g0, g1, n)})))) u.add(mat, g);
}
// panel split angles: flank | dorsal | flank, with ~5 mm grooves
const SPLIT = [[F0, 0.98], [1.03, PI - 1.03], [PI - 0.98, PI - F0]];
const GAP = 0.012;

/**
 * buildBody(M) -> {group, units, anchors, update(pose)} (CONTRACT.md, "Integration addendum").
 * units    explode units, direct children of group: chassis 0, armour 1, sensor head 2, the five bay modules 6
 * anchors  armor sensor head power control drive thermal
 */
export function buildBody(M) {
  const group = new THREE.Group();
  group.name = 'body';
  const units = [];
  const anchors = {};
  const unit = (name, sys, order, explode, opts = {}) => {
    const u = makeUnit(M, group, {name, sys, order, explode, cut: opts.cut !== false, internal: !!opts.internal});
    units.push({group: u.group, order, explode});
    return u;
  };
  const U = {
    chassis: unit('chassis', 'chassis', 0, [0, 0, 0]),
    armour: unit('armour', 'armor', 1, [0, 0.48, 0]),
    head: unit('head', 'sensor', 2, [0.42, 0.24, 0], {cut: false}),
    power: unit('power', 'power', 6, [0.0, 0.34, -0.5]),
    control: unit('control', 'control', 6, [0.0, 0.52, 0.42]),
    drive: unit('drive', 'drive', 6, [-0.34, 0.3, -0.44]),
    thermal: unit('thermal', 'thermal', 6, [-0.46, 0.36, 0.34]),
    sensor: unit('sensor', 'sensor', 6, [0.46, 0.32, 0.38]),
  };
  const c = U.chassis;
  const a = U.armour;

  // ========================================================== chassis (explode order 0)
  const padZ = LEGS.map((L) => Math.abs(L.hip[2]) - PAD_BACK);
  const RZ = Math.min(...padZ) - 0.03; // side rail centre line
  const RAIL0 = -0.29;
  const RAIL1 = 0.37;
  for (const s of [1, -1]) c.box('graphite', RAIL1 - RAIL0, BEAM_H, BEAM_W, (RAIL0 + RAIL1) / 2, R, s * RZ, 0.006);
  c.box('graphite', 0.615, 0.04, 0.07, (0.38 - 0.235) / 2, 0.45, 0, 0.006); // spine beam x -0.235..0.38
  for (const x of [0.34, 0.19, -0.19]) c.box('dark', 0.03, 0.025, 2 * RZ - 0.03, x, 0.432, 0, 0.004); // cross ties
  // tray under the rails on four hangers
  c.box('graphite', 0.62, 0.012, 0.29, 0.03, 0.284, 0, 0.004);
  for (const x of [0.3, 0.1, -0.1, -0.26]) for (const s of [1, -1]) c.box('graphite', 0.02, 0.067, 0.02, x, 0.322, s * 0.145, 0.003);
  // hip brackets + steel hip pads, outer face at |hip.z| - PAD_BACK
  for (const L of LEGS) {
    const s = Math.sign(L.hip[2]);
    const zf = Math.abs(L.hip[2]) - PAD_BACK;
    const depth = zf - RZ + 0.01;
    c.box('graphite', 0.11, 0.12, depth, L.hip[0], R, s * (RZ + depth / 2 - 0.005), 0.008);
    c.box('steel', 0.12, 0.13, 0.012, L.hip[0], R, s * (zf - 0.006), 0.003);
    for (const dx of [-0.042, 0.042]) for (const dy of [-0.045, 0.045]) c.hole([L.hip[0] + dx, R + dy, s * zf], [0, 0, s], 0.004);
  }
  // shell standoffs on the rails, rubber isolators on top (armour layer 2)
  for (const x of [0.33, 0.2, 0.02, -0.19]) {
    for (const s of [1, -1]) {
      const z = s * RZ;
      const yTop = secPt(x, Math.acos(Math.min(1, RZ / HW(x))), -0.02)[0];
      c.box('graphite', 0.018, yTop - 0.445, 0.018, x, (yTop + 0.445) / 2, z, 0.003);
      c.cyl('rubber', 0.013, 0.008, x, yTop + 0.004, z, 'y', 16);
    }
  }
  // front frame: cross beam under the two claw-yaw flanges, inner struts from the rails, head post
  const CX = CLAW.shoulder[0];
  const CZ = Math.abs(CLAW.shoulder[2]);
  c.box('graphite', 0.05, 0.022, 2 * CZ + 0.1, CX, FLANGE_TOP_CLAW - 0.012 - 0.011, 0, 0.004);
  for (const s of [1, -1]) {
    c.cyl('steel', 0.068, 0.012, CX, FLANGE_TOP_CLAW - 0.006, s * CZ, 'y', 40); // claw-yaw flange, top = S.y - 0.14
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * PI * 2 + PI / 8;
      c.head([CX + Math.cos(t) * 0.058, FLANGE_TOP_CLAW, s * CZ + Math.sin(t) * 0.058], [0, 1, 0], 0.0038);
    }
    c.add('graphite', strutGeo([0.355, 0.4, s * 0.088], [CX, FLANGE_TOP_CLAW - 0.016, s * 0.088], 0.03, 0.026, 0.004));
    c.box('graphite', 0.03, 0.04, RZ - 0.088 + 0.02, 0.35, 0.4, s * (RZ + 0.088) / 2, 0.004);
  }
  c.box('graphite', 0.04, 0.12, 0.08, 0.41, 0.35, 0, 0.005); // head post, top 0.41
  // rear frame: deck on gussets with the tail J1 turntable flange (top = TAIL.root.y - 0.15)
  const TX = TAIL.root[0];
  c.box('graphite', 0.22, 0.026, 0.26, TX + 0.03, FLANGE_TOP_TAIL - 0.012 - 0.013, 0, 0.005);
  for (const s of [1, -1]) {
    c.add('graphite', strutGeo([RAIL0 + 0.01, 0.37, s * RZ], [TX + 0.06, FLANGE_TOP_TAIL - 0.016, s * 0.115], 0.03, 0.026, 0.004));
    c.add('graphite', strutGeo([RAIL0 + 0.01, 0.3, s * 0.14], [TX + 0.1, FLANGE_TOP_TAIL - 0.03, s * 0.12], 0.02, 0.02, 0.003));
  }
  c.ring('steel', 0.096, 0.03, 0.012, TX, FLANGE_TOP_TAIL - 0.006, 0, 'y', 48);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * PI * 2;
    c.head([TX + Math.cos(t) * 0.09, FLANGE_TOP_TAIL, Math.sin(t) * 0.09], [0, 1, 0], 0.0036);
  }
  // rear bulkhead closing the carapace, with vent slots
  {
    const P = [];
    for (let i = 0; i <= 30; i++) P.push(secPt(-0.286, F0 + ((PI - 2 * F0) * i) / 30, -0.013));
    for (const g of loftRings([{x: -0.289, P}, {x: -0.283, P: P.map((p) => p.slice())}])) c.add('graphite', g);
    for (const y of [0.507, 0.522, 0.537]) for (const s of [1, -1]) c.box('dark', 0.004, 0.007, 0.07, -0.2905, y, s * 0.05, 0.001);
  }

  // ========================================================== armour (explode order 1)
  // prosoma shield: dark under-shell, two flank panels, dorsal panel split around the smoke canopy, carinae
  const SH0 = 0.15;
  const SH1 = 0.4;
  shell(a, 'dark', SH0 + 0.004, SH1 - 0.004, {d: -0.011, t: 0.005, g0: F0 + 0.02, g1: PI - F0 - 0.02, roll: 0});
  shell(a, 'ivory', SH0, SH1, {g0: SPLIT[0][0], g1: SPLIT[0][1]});
  shell(a, 'ivory', SH0, SH1, {g0: SPLIT[2][0], g1: SPLIT[2][1]});
  shell(a, 'ivory', SH0, SH1, {g0: SPLIT[1][0], g1: SPLIT[1][1]});
  // raised median ridge (carina) running up to the sensor window
  shell(a, 'ivory', SH0 + 0.012, 0.262, {d: 0.006, t: 0.01, g0: PI / 2 - 0.06, g1: PI / 2 + 0.06, roll: 0.004});
  // sensor window: a small smoke-glass dome in a raised ivory bezel, a lens glowing under it
  {
    const WX = 0.305;
    const wy = TOP(WX) - 0.002;
    const tilt = Math.atan2(TOP(WX + 0.01) - TOP(WX - 0.01), 0.02);
    const place = (g) => g.rotateZ(tilt).translate(WX, wy, 0);
    a.add('ivory', place(ringAxis(0.05, 0.038, 0.012, 'y', 44).scale(1, 1, 0.72)));
    a.add('dark', place(cylAxis(0.039, 0.006, 'y', 36).scale(1, 1, 0.72)));
    a.add('smoke', place(new THREE.SphereGeometry(1, 32, 10, 0, PI * 2, 0, PI / 2).scale(0.039, 0.012, 0.028)));
    a.add('lamp', place(new THREE.SphereGeometry(0.006, 12, 8).translate(0.006, 0.004, 0)));
  }
  for (const [g0, g1] of [[0.46, 0.53], [PI - 0.53, PI - 0.46]]) shell(a, 'ivory', SH0 + 0.022, 0.37, {d: 0.004, t: 0.008, g0, g1, roll: 0.003});
  for (const x of [SH0 + 0.014, 0.386]) for (const ff of [0.12, 0.42, 0.78]) for (const fp of [ff, PI - ff]) {
    const [y, z] = secPt(x, fp, 0.0004);
    a.hole([x, y, z], secN(x, fp), 0.003);
  }
  for (const x of [SH0 + 0.024, 0.386]) for (const fp of [PI / 2 - 0.3, PI / 2 + 0.3]) {
    const [y, z] = secPt(x, fp, 0.0004);
    a.hole([x, y, z], secN(x, fp), 0.003);
  }
  // seven tergites shrinking toward the rear, 12 mm gaps with a graphite hoop and a thin orange seam band
  {
    const BASE = [0.064, 0.06, 0.056, 0.052, 0.048, 0.044, 0.04];
    const xStart = SH0 - GAP;
    const avail = xStart - -0.29 - (BASE.length - 1) * GAP;
    const k = avail / BASE.reduce((p, q) => p + q, 0);
    let xf = xStart;
    shell(a, 'dark', -0.287, xStart + GAP * 0.5, {d: -0.016, t: 0.005, g0: F0 + 0.03, g1: PI - F0 - 0.03, roll: 0});
    for (let i = 0; i < BASE.length; i++) {
      const xb = xf - BASE[i] * k;
      for (const [g0, g1] of SPLIT) shell(a, 'ivory', xb, xf, {g0, g1, lip: 0.016});
      for (const [g0, g1] of [[0.52, 0.58], [PI - 0.58, PI - 0.52], [PI / 2 - 0.035, PI / 2 + 0.035]])
        shell(a, 'ivory', xb + 0.006, xf - 0.006, {d: 0.003, t: 0.008, g0, g1, lip: 0.016, roll: 0.002});
      // the gap ahead of this plate: orange seam band at the plate rim, graphite hoop behind it
      shell(a, 'orange', xf + 0.0006, xf + 0.003, {d: -0.007, t: 0.006, roll: 0});
      shell(a, 'graphite', xf + 0.003, xf + 0.009, {d: -0.01, t: 0.014, g0: F0 - 0.04, g1: PI - F0 + 0.04, roll: 0});
      const xm = (xf + xb) / 2;
      for (const fp of [0.2, 0.72, PI / 2, PI - 0.72, PI - 0.2]) {
        const [y, z] = secPt(xm, fp, 0.0034 + (fp === PI / 2 ? 0.003 : 0));
        if (fp !== PI / 2) a.hole([xm, y, z], secN(xm, fp), 0.0028);
      }
      xf = xb - GAP;
    }
  }
  // flank fillers between the hip pads (hide the brackets) and a low skirt under the pads
  for (const s of [1, -1]) {
    const side = LEGS.filter((L) => Math.sign(L.hip[2]) === s).sort((p, q) => q.hip[0] - p.hip[0]);
    for (let i = 0; i < side.length - 1; i++) {
      const x0 = side[i].hip[0] - 0.068;
      const x1 = side[i + 1].hip[0] + 0.068;
      if (x0 - x1 < 0.02) continue;
      const zf = Math.min(Math.abs(side[i].hip[2]), Math.abs(side[i + 1].hip[2])) - PAD_BACK - 0.008;
      a.box('ivory', x0 - x1, 0.16, 0.01, (x0 + x1) / 2, 0.41, s * zf, 0.004);
      a.hole([(x0 + x1) / 2, 0.47, s * (zf + 0.0054)], [0, 0, s], 0.0028);
    }
    a.box('ivory', 0.64, 0.066, 0.01, 0.03, 0.302, s * 0.178, 0.005);
    a.box('graphite', 0.6, 0.004, 0.004, 0.03, 0.322, s * 0.1835, 0.001);
    for (const x of [0.26, 0.03, -0.2]) a.box('dark', 0.004, 0.04, 0.004, x, 0.298, s * 0.1835, 0.001);
    // rear quarter plates either side of the tail root (low, below the J1 carrier)
    a.box('ivory', 0.1, 0.05, 0.012, -0.345, 0.352, s * 0.142, 0.005, [s * 0.35, 0, 0]);
  }
  // belly: sternum plates under the tray, shrinking toward the rear
  {
    const ST = [[0.33, 0.215, 0.13], [0.203, 0.088, 0.128], [0.076, -0.039, 0.122], [-0.051, -0.161, 0.112], [-0.173, -0.275, 0.1]];
    for (const [x1, x0, hz] of ST) {
      a.box('ivory', x1 - x0, 0.01, 2 * hz, (x0 + x1) / 2, 0.271, 0, 0.004);
      for (const s of [1, -1]) a.hole([(x0 + x1) / 2, 0.2655, s * (hz - 0.015)], [0, -1, 0], 0.003);
    }
    a.box('graphite', 0.6, 0.006, 0.02, 0.03, 0.264, 0, 0.002); // median sternal rib
  }
  anchors.armor = a.marker(-0.15, TOP(-0.15) + 0.01, 0.03);

  // ========================================================== sensor head (explode order 2)
  const h = U.head;
  h.box('steel', 0.09, 0.008, 0.11, 0.41, 0.414, 0, 0.003);
  for (const sx of [-0.032, 0.032]) for (const sz of [-0.042, 0.042]) h.head([0.41 + sx, 0.418, sz], [0, 1, 0], 0.0035);
  h.box('graphite', 0.06, 0.04, 0.1, 0.41, 0.44, 0, 0.006); // neck
  // faceted ivory head: convex hull of superelliptic sections, wide under the shield rim, tapering to the brow
  {
    const SEC = [[0.37, 0.088, 0.418, 0.578], [0.42, 0.092, 0.42, 0.582], [0.47, 0.084, 0.428, 0.574], [0.515, 0.066, 0.438, 0.552], [0.55, 0.042, 0.452, 0.522]];
    const P = [];
    for (const [x, w, y0, y1] of SEC) {
      const yc = (y0 + y1) / 2;
      const hb = (y1 - y0) / 2;
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * PI * 2;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        P.push(new V3(x, yc + hb * Math.sign(s) * Math.abs(s) ** 0.7, w * Math.sign(c) * Math.abs(c) ** 0.7));
      }
    }
    P.push(new V3(0.566, 0.49, 0));
    h.add('ivory', new ConvexGeometry(P));
  }
  // median ocular tubercle: an ivory mound carrying the two main lamp eyes
  {
    const T = [];
    for (const [x, y, z] of [[0.44, 0.574, 0.034], [0.5, 0.566, 0.032], [0.468, 0.6, 0.022], [0.505, 0.592, 0.02], [0.52, 0.572, 0.012]]) T.push(new V3(x, y, z), new V3(x, y, -z));
    h.add('ivory', new ConvexGeometry(T));
  }
  for (const s of [1, -1]) {
    h.add('smoke', new THREE.SphereGeometry(0.0115, 20, 14).scale(1, 0.85, 1).translate(0.503, 0.587, s * 0.0155));
    h.add('lamp', new THREE.SphereGeometry(0.0062, 14, 10).translate(0.51, 0.589, s * 0.0155));
    // lateral eyes: three small lamps per side on a smoke strip at the front corner
    h.add('smoke', rbox(0.036, 0.012, 0.01, 0.003, 1).rotateY(s * 0.55).translate(0.535, 0.534, s * 0.056));
    for (let i = 0; i < 3; i++) {
      const u = i / 2;
      h.add('lamp', new THREE.SphereGeometry(0.0036, 8, 6).translate(0.521 + u * 0.026, 0.536, s * (0.065 - u * 0.016)));
    }
    // chelicerae: black two-segment jaws under the front edge
    const C = [[0.535, 0.462, 0.008], [0.535, 0.462, 0.04], [0.535, 0.43, 0.01], [0.535, 0.43, 0.038], [0.584, 0.456, 0.014], [0.584, 0.456, 0.034], [0.588, 0.434, 0.016], [0.588, 0.434, 0.032]];
    h.add('dark', new ConvexGeometry(C.map(([x, y, z]) => new V3(x, y, s * z))));
    h.add('dark', new THREE.ConeGeometry(0.0075, 0.042, 12).rotateZ(PI - 0.45).translate(0.596, 0.42, s * 0.024));
  }
  anchors.sensor = h.marker(0.51, 0.589, 0);
  anchors.head = h.marker(0.47, 0.585, 0);

  // ========================================================== bay modules (explode order 6)
  // power: eight battery modules on the tray, busbars, BMS
  const p = U.power;
  for (let i = 0; i < 4; i++)
    for (const s of [1, -1]) {
      const x = -0.12 + i * 0.08;
      const z = s * 0.066;
      p.box('dark', 0.072, 0.1, 0.112, x, 0.341, z, 0.008);
      p.box('graphite', 0.066, 0.01, 0.106, x, 0.396, z, 0.003);
      p.box('white', 0.04, 0.012, 0.002, x, 0.36, s * 0.1225, 0.0008);
      p.cyl('steel', 0.007, 0.008, x - 0.02, 0.405, z, 'y', 14);
      p.cyl('copper', 0.007, 0.008, x + 0.02, 0.405, z, 'y', 14);
    }
  for (const s of [1, -1]) p.box('copper', 0.28, 0.004, 0.012, 0.0, 0.411, s * 0.066, 0.001);
  p.box('graphite', 0.05, 0.08, 0.12, 0.215, 0.33, 0, 0.006); // BMS
  p.box('white', 0.03, 0.002, 0.07, 0.215, 0.371, 0, 0.001);
  p.obj(cable([[0.19, 0.36, 0.05], [0.16, 0.405, 0.066], [0.14, 0.412, 0.066]], 0.005, {M, mat: 'dark'}));
  anchors.power = p.marker(0.215, 0.375, 0);

  // thermal: cold plate over the batteries, pump + reservoir behind them, radiator and fans at the bulkhead
  const t = U.thermal;
  t.box('alu', 0.3, 0.006, 0.2, 0, 0.42, 0, 0.002);
  t.box('copper', 0.27, 0.004, 0.16, 0, 0.425, 0, 0.001);
  t.box('graphite', 0.022, 0.085, 0.2, -0.25, 0.488, 0, 0.004); // radiator core
  for (let i = 0; i < 10; i++) t.box('alu', 0.026, 0.078, 0.004, -0.25, 0.488, -0.09 + i * 0.02, 0.001);
  for (const s of [1, -1]) {
    const fx = -0.268;
    t.cyl('dark', 0.038, 0.012, fx, 0.488, s * 0.052, 'x', 28);
    t.ring('steel', 0.04, 0.035, 0.006, fx - 0.002, 0.488, s * 0.052, 'x', 28);
    t.cyl('steel', 0.012, 0.014, fx, 0.488, s * 0.052, 'x', 16);
  }
  t.box('steel', 0.1, 0.008, 0.22, -0.215, 0.294, 0, 0.002);
  t.cyl('dark', 0.028, 0.06, -0.215, 0.33, 0.07, 'x', 24); // pump
  t.ring('steel', 0.03, 0.026, 0.008, -0.19, 0.33, 0.07, 'x', 24);
  t.box('alu', 0.08, 0.065, 0.09, -0.215, 0.331, -0.07, 0.006); // reservoir
  t.box('smoke', 0.05, 0.018, 0.004, -0.215, 0.333, -0.1165, 0.001);
  t.obj(cable([[-0.215, 0.33, 0.1], [-0.235, 0.39, 0.125], [-0.25, 0.45, 0.105], [-0.25, 0.47, 0.08]], 0.006, {M, mat: 'copper'}));
  t.obj(cable([[-0.215, 0.364, -0.07], [-0.235, 0.41, -0.115], [-0.25, 0.46, -0.1], [-0.25, 0.47, -0.08]], 0.006, {M, mat: 'copper'}));
  t.obj(cable([[-0.15, 0.42, 0.09], [-0.2, 0.43, 0.105], [-0.245, 0.452, 0.098]], 0.005, {M, mat: 'copper'}));
  anchors.thermal = t.marker(-0.25, 0.535, 0.06);

  // drive: eight servo cards on a cold plate over the spine, PDU behind the batteries, leg connector panel
  const d = U.drive;
  d.box('alu', 0.21, 0.012, 0.22, -0.1, 0.476, 0, 0.003);
  for (const s of [1, -1])
    for (let i = 0; i < 4; i++) {
      const x = -0.18 + i * 0.05;
      const z = s * 0.06;
      d.box('dark', 0.042, 0.06, 0.01, x, 0.512, z, 0.003);
      d.box('alu', 0.036, 0.048, 0.006, x, 0.512, z + s * 0.008, 0.002);
      for (let fn = 0; fn < 3; fn++) d.box('alu', 0.004, 0.044, 0.01, x - 0.012 + fn * 0.012, 0.512, z + s * 0.015, 0.001);
      d.box('steel', 0.04, 0.008, 0.014, x, 0.546, z, 0.002);
      d.hole([x, 0.5502, z], [0, 1, 0], 0.003);
    }
  d.box('graphite', 0.012, 0.03, 0.16, 0.01, 0.497, 0, 0.003);
  d.box('graphite', 0.05, 0.05, 0.07, -0.225, 0.398, 0.075, 0.005); // main contactor
  d.box('steel', 0.04, 0.008, 0.05, -0.225, 0.427, 0.075, 0.002);
  d.cyl('steel', 0.014, 0.07, -0.225, 0.39, -0.075, 'x', 18); // main fuse
  for (const dx of [-0.037, 0.037]) d.cyl('white', 0.015, 0.006, -0.225 + dx, 0.39, -0.075, 'x', 18);
  for (const s of [1, -1]) d.box('copper', 0.08, 0.008, 0.014, -0.2, 0.42, s * 0.035, 0.002);
  d.box('steel', 0.012, 0.07, 0.2, -0.284, 0.33, 0, 0.003); // leg connector panel
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
    const z = -0.075 + k * 0.05;
    const y = 0.315 + r * 0.03;
    d.cyl('steel', 0.009, 0.012, -0.294, y, z, 'x', 16);
    d.hole([-0.3, y, z], [-1, 0, 0], 0.0028);
  }
  anchors.drive = d.marker(-0.105, 0.555, 0.06);

  // control: computer, motion controller, comms, IMU on isolators, under the canopy
  const q = U.control;
  for (const [x, z] of [[0.14, 0.025], [0.14, -0.025], [0.24, 0.025], [0.24, -0.025], [0.09, 0.025], [0.09, -0.025]]) q.cyl('steel', 0.005, 0.02, x, 0.48, z, 'y', 12);
  q.box('graphite', 0.13, 0.04, 0.13, 0.19, 0.51, 0, 0.006);
  for (let i = 0; i < 6; i++) q.box('alu', 0.11, 0.012, 0.005, 0.19, 0.536, -0.05 + i * 0.02, 0.001);
  q.box('graphite', 0.07, 0.03, 0.06, 0.09, 0.505, 0.035, 0.005); // motion controller
  q.box('dark', 0.05, 0.025, 0.05, 0.09, 0.5025, -0.035, 0.004); // comms
  q.cyl('steel', 0.006, 0.012, 0.062, 0.505, -0.035, 'x', 12);
  for (const [ix, iz] of [[-0.01, -0.01], [0.01, -0.01], [0, 0.012]]) q.cyl('rubber', 0.006, 0.02, 0.28 + ix, 0.48, iz, 'y', 12);
  q.box('alu', 0.03, 0.03, 0.03, 0.28, 0.505, 0, 0.004); // IMU
  q.obj(cable([[0.125, 0.505, 0.0], [0.11, 0.5, -0.02], [0.1, 0.505, -0.03]], 0.004, {M, mat: 'dark'}));
  anchors.control = q.marker(0.19, 0.545, 0);

  // sensor bay: perception unit and camera driver board behind the head
  const sb = U.sensor;
  sb.box('graphite', 0.05, 0.075, 0.12, 0.34, 0.5075, 0, 0.006);
  for (let i = 0; i < 4; i++) sb.box('alu', 0.04, 0.008, 0.008, 0.34, 0.549, -0.045 + i * 0.03, 0.001);
  sb.box('dark', 0.008, 0.06, 0.09, 0.369, 0.505, 0, 0.002);
  for (const z of [-0.03, 0.03]) sb.cyl('steel', 0.006, 0.01, 0.372, 0.49, z, 'x', 12);
  sb.obj(cable([[0.372, 0.49, 0.03], [0.385, 0.472, 0.045], [0.395, 0.455, 0.045]], 0.004, {M, mat: 'dark'}));

  // ---------------------------------------------------------- merge, bolt and tag every unit
  for (const key of ['chassis', 'armour', 'head', 'power', 'control', 'drive', 'thermal', 'sensor']) U[key].flush();
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  function update(pose) {}
  group.userData.parts = {hipPads: LEGS.length, units: units.length};
  return {group, units, anchors, update};
}