// SCORPION SC-8, the eight legs (spec §3), plus the small limb kit claws.js and tail.js share.
// One leg is five rigid bodies, each posed from kin.js legIK output (nothing keyframed):
//   mount  hip mount flange bolted to the side beam + the hip-yaw actuator (vertical axis) in a saddle bracket
//   coxa   top / bottom forks on the yaw output and bearing boss, a bridge, the hip-pitch actuator housing
//   femur  output clevis plate on the hip-pitch flange, ribbed hollow link with white armour, knee actuator housing
//   tibia  output clevis plate on the knee flange, ribbed link, foot module (passive compliance drum: elastomer pack
//          + load cell + contact switch), black needle with an orange collar, ball socket
//   pad    rubber contact pad on the ball joint, kept level by its passive pitch (kin `ankle`)
// Every actuator comes from parts.actuator(): dark housing, orange ring, flange, bolt circle, and the motor, reducer,
// crossed-roller bearing and encoder inside (internal:true). For efficiency each body is built once as a template
// with the parts.js builders and baked into one merged geometry per material, shared by all eight legs; leg L1
// (leg0) keeps its hip-pitch and knee actuators live so the jointCut window and the axial explode can open them.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {actuator, bolts, boltCircle, rbox, ribbedLink, tag} from './parts.js';
import {LEG, LEGS} from './kin.js';

const V3 = THREE.Vector3;
export const UP = new V3(0, 1, 0);
/** exploded-view stage of each limb assembly (robot.js EXPLODE_STAGES): tail 3, claws 4, legs 5, internals 7 */
export const ORDER = {tail: 3, claw: 4, leg: 5, internals: 7};

// ------------------------------------------------------------ limb kit: geometry
export const cyl = (r, h, seg = 32, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg);
/** an axis-z cylinder (joint pin, disc) centred on (x, y, z) */
export const zcyl = (r, h, x = 0, y = 0, z = 0, seg = 32) => cyl(r, h, seg).rotateX(Math.PI / 2).translate(x, y, z);
/** an axis-x cylinder / cone from x0 to x1 (r at x0, r1 at x1) */
export const xcyl = (r, x0, x1, seg = 24, r1 = r) => new THREE.CylinderGeometry(r1, r, x1 - x0, seg).rotateZ(-Math.PI / 2).translate((x0 + x1) / 2, 0, 0);
/** a ring about +y with chamfered outer edges */
export const ring = (rO, rI, h, seg = 40) => {
  const c = Math.min(h * 0.18, (rO - rI) * 0.25);
  const p = [[rI, -h / 2], [rO - c, -h / 2], [rO, -h / 2 + c], [rO, h / 2 - c], [rO - c, h / 2], [rI, h / 2], [rI, -h / 2]];
  return new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b)), seg);
};
/** a flat plate in the xy plane (thickness t along z): a stadium from (x0,0) radius r0 to (x1,0) radius r1 */
export function lever(x0, r0, x1, r1, t, z = 0) {
  const s = new THREE.Shape();
  const a = Math.asin(Math.max(-0.95, Math.min(0.95, (r0 - r1) / Math.max(1e-6, x1 - x0))));
  s.absarc(x0, 0, r0, Math.PI / 2 + a, Math.PI * 1.5 - a, false);
  s.absarc(x1, 0, r1, -Math.PI / 2 - a, Math.PI / 2 + a, false);
  const g = new THREE.ExtrudeGeometry(s, {depth: t, bevelEnabled: true, bevelThickness: t * 0.18, bevelSize: t * 0.18, bevelSegments: 1, curveSegments: 14});
  return g.translate(0, 0, z - t / 2);
}
/** merge geometries of any kind (indexed or not) into one, keeping position / normal / uv */
export const merge = (list) =>
  mergeGeometries(
    list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g.clone();
      n.clearGroups();
      for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
      if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      return n;
    }),
    false,
  );
/** a mesh with the contract flags */
export function part(M, g, mat, ud = {}) {
  const m = new THREE.Mesh(g, M[mat]);
  m.castShadow = m.receiveShadow = true;
  m.userData = {mat, internal: false, ...ud};
  return m;
}

// ------------------------------------------------------------ limb kit: bake a template into shared buffers
// materials collapse to a small set so a body costs few draw calls: alu -> steel, ivory -> white; inside a housing
// everything reads as copper (windings, encoder, rollers), steel (rotor, shaft, gears, bearing) or graphite.
const EXT = {alu: 'steel', ivory: 'white', smoke: 'dark', core: 'orange'};
const INT = {alu: 'steel', orange: 'copper', dark: 'graphite', rubber: 'graphite', ivory: 'graphite', white: 'graphite', smoke: 'graphite', core: 'copper'};
const _mi = new THREE.Matrix4();
const _mr = new THREE.Matrix4();
const _mk = new THREE.Matrix4();
/** template Group -> [{geometry, mat, internal}] merged per material, in the template root's frame */
export function bake(root, skip = null) {
  root.updateMatrixWorld(true);
  _mi.copy(root.matrixWorld).invert();
  const B = new Map();
  root.traverse((o) => {
    if (!o.isMesh || (skip && skip(o))) return;
    const internal = !!o.userData.internal;
    const raw = o.userData.mat || 'graphite';
    const mat = (internal ? INT[raw] : EXT[raw]) || raw;
    const key = `${mat}|${internal}`;
    if (!B.has(key)) B.set(key, {mat, internal, list: []});
    _mr.multiplyMatrices(_mi, o.matrixWorld);
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, _mk);
        B.get(key).list.push(o.geometry.clone().applyMatrix4(_mk.premultiply(_mr)));
      }
    } else B.get(key).list.push(o.geometry.clone().applyMatrix4(_mr));
  });
  return [...B.values()].map(({mat, internal, list}) => {
    const geometry = merge(list);
    geometry.computeBoundingSphere();
    return {geometry, mat, internal};
  });
}
const BAKED = new Map();
/** bake once per key; make() returns the template root */
export const baked = (key, make, skip = null) => {
  if (!BAKED.has(key)) BAKED.set(key, bake(make(), skip));
  return BAKED.get(key);
};
/** one mesh per baked bucket, added to parent; returns the meshes */
export const instance = (M, list, parent, ud = {}) =>
  list.map((b) => {
    const m = part(M, b.geometry, b.mat, {...ud, internal: b.internal});
    parent.add(m);
    return m;
  });

// ------------------------------------------------------------ limb kit: placing rigid bodies
const _x = new V3();
const _y = new V3();
const _z = new V3();
const _b = new THREE.Matrix4();
/** pose obj at origin o, +x along dir, +z as close to zHint as possible (right-handed basis) */
export function frame(obj, o, dir, zHint) {
  _x.copy(dir).normalize();
  _z.copy(zHint).addScaledVector(_x, -zHint.dot(_x));
  if (_z.lengthSq() < 1e-10) _z.set(0, 0, 1);
  _z.normalize();
  _y.crossVectors(_z, _x);
  _b.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_b);
  obj.position.copy(o);
  return obj;
}
/** pose obj at origin o, +x along dir, +y as close to yHint as possible (right-handed basis) */
export function frameY(obj, o, dir, yHint) {
  _x.copy(dir).normalize();
  _y.copy(yHint).addScaledVector(_x, -yHint.dot(_x));
  if (_y.lengthSq() < 1e-10) _y.set(0, 1, 0);
  _y.normalize();
  _z.crossVectors(_x, _y);
  _b.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_b);
  obj.position.copy(o);
  return obj;
}
/** a plan-view outline [[x, z], ...] extruded over y0..y1 with a rounded edge (a chela shell, a finger blade) */
export function planSlab(pts, y0, y1, bevel = 0.004) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const t = y1 - y0;
  const b = Math.min(bevel, t * 0.4);
  const g = new THREE.ExtrudeGeometry(s, {depth: t - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 8});
  return g.rotateX(-Math.PI / 2).translate(0, y0 + b, 0);
}
/** an empty marker for callouts */
export const marker = (parent, x = 0, y = 0, z = 0) => {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};
/** an actuator laid with its axis along +z (output face +z) at (x, y, z); window toward local +y when cutUp */
export function zActuator(o) {
  // parts.actuator's window faces +z (sin phi, 0, cos phi) in its own frame; after rotateX(+90deg) that is
  // (sin phi, -cos phi, 0), so phi = PI puts the window on the link frame's +y side
  const a = actuator({...o, cutPhi: o.cutPhi ?? Math.PI});
  a.rotation.x = Math.PI / 2;
  a.position.set(o.x || 0, o.y || 0, o.z || 0);
  return a;
}
/**
 * A passive drum (no motor): dark lathed can, axis +z, orange ring, steel hub caps; inside, internal:true, the
 * elastomer compliance pack, the load-cell disc and the contact switch. For the foot module and the stinger tip.
 */
export function passiveDrum(M, r, len, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  const at = (gg) => gg.rotateX(Math.PI / 2).translate(x, y, z);
  g.add(part(M, at(ring(r, r * 0.3, len, 36)), 'dark'));
  g.add(part(M, at(ring(r * 1.04, r * 0.97, len * 0.14, 36)), 'orange'));
  for (const s of [1, -1]) g.add(part(M, at(cyl(r * 0.42, 0.006, 24).translate(0, (s * len) / 2, 0)), 'steel'));
  g.add(part(M, at(ring(r * 0.88, r * 0.45, len * 0.5, 24)), 'rubber', {internal: true})); // elastomer pack
  g.add(part(M, at(cyl(r * 0.4, len * 0.16, 20).translate(0, len * 0.2, 0)), 'steel', {internal: true})); // load cell
  g.add(part(M, rbox(r * 0.4, r * 0.3, len * 0.3, 0.002).translate(x + r * 0.55, y, z), 'copper', {internal: true})); // switch
  return g;
}

// ------------------------------------------------------------ legs: sizes (m)
// v9 look: elegant arthropod legs. A compact coxa with the hip-pitch drum, a sculpted tapered ivory femur shell
// (one lofted shell, fuller near the hip, a thin groove, a dark tendon cable along the top) over a graphite core, a
// knee drum sandwiched by ivory cheek plates, a slender tapering tibia shell with two panel lines, a small ankle
// drum and a short tarsus ending in a dark curved claw tip whose point is the IK foot point.
export const LEGGEO = {
  hipYaw: {r: 0.05, len: 0.09}, // vertical axis, on the hip mount
  hipPitch: {r: 0.05, len: 0.096}, // at the coxa end, axis across the leg plane
  knee: {r: 0.039, len: 0.084}, // v9.1: 15% slimmer, sleeved by the femur / tibia cheeks, thin orange seam
  ankle: {r: 0.022, len: 0.044, at: LEG.tibia - 0.118}, // passive ankle drum on the tibia (m from the knee)
  femur: {h: 0.104, w: 0.09, r: 0.017}, // peak lofted shell section (height y, width z)
  tibia: {h: 0.07, w: 0.066, endH: 0.036, endW: 0.034, r: 0.015}, // section at the knee; tapers to endH x endW
  needle: [LEG.tibia - 0.075, LEG.tibia], // tarsus claw from / to (m from the knee); the point is the foot point
};
const G = LEGGEO;
/** hip axis -> contact face of the hip pad on the side beam (m, inward); body.js puts the pad face there */
export const MOUNT_BACK = 0.065;

/** a lathed ring arc about +y (chamfered), phi range like THREE.LatheGeometry */
const ringArc = (rO, rI, h, seg, phi0, phiL) => {
  const c = Math.min(h * 0.18, (rO - rI) * 0.3);
  const p = [[rI, -h / 2], [rO - c, -h / 2], [rO, -h / 2 + c], [rO, h / 2 - c], [rO - c, h / 2], [rI, h / 2], [rI, -h / 2]];
  return new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b)), seg, phi0, phiL);
};
/**
 * the reference drum's broad orange band, added to a parts.actuator() group (actuator frame, axis +y): split like the
 * housing into a 270-degree body and a 90-degree window piece, the window piece joins act.cut so jointCut moves it too
 */
function drumBand(M, a, cutPhi, thin = false) {
  const {r, len} = a.act;
  const w0 = cutPhi - Math.PI / 4;
  const h = thin ? len * 0.075 : len * 0.22;
  const y = thin ? len * 0.3 : len * 0.21;
  const rO = thin ? r * 1.025 : r * 1.05;
  const body = part(M, ringArc(rO, r * 0.96, h, 34, w0 + Math.PI / 2, Math.PI * 1.5).translate(0, y, 0), 'orange');
  const win = part(M, ringArc(rO, r * 0.96, h, 12, w0, Math.PI / 2).translate(0, y, 0), 'orange');
  win.userData.shell = 'cut';
  win.userData.cutDir = [Math.sin(cutPhi), 0, Math.cos(cutPhi)];
  a.add(body, win);
  a.act.cut.push(win);
  return a;
}
/** a joint drum laid along +z (output +z) with the broad orange band; window toward the link frame's +y */
const zDrum = (o) => drumBand(o.M, zActuator(o), Math.PI, !!o.thin);
/** an ivory sleeve arc round a z-axis drum at (x, 0), lathe angles phi0..phi0+phiL (270 deg = -x, 90 deg = +x) */
const drumSleeve = (a, x, phi0, phiL, k = 1) =>
  ringArc(a.r * 1.13 * k, a.r * 1.0, a.len * 0.78, 20, phi0, phiL).rotateX(Math.PI / 2).translate(x, 0, -a.len * 0.06);

// ------------------------------------------------------------ lofted shells (superellipse sections along x)
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** section from stations [[x, halfHeight, halfWidth], ...] with a cosine blend */
function stations(P, n = 2.5) {
  return (x) => {
    if (x <= P[0][0]) return {h: P[0][1], w: P[0][2], n};
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, h0, w0] = P[i];
      const [x1, h1, w1] = P[i + 1];
      if (x <= x1) {
        const t = (1 - Math.cos((Math.PI * (x - x0)) / (x1 - x0))) / 2;
        return {h: h0 + (h1 - h0) * t, w: w0 + (w1 - w0) * t, n};
      }
    }
    const L = P[P.length - 1];
    return {h: L[1], w: L[2], n};
  };
}
/** superellipse section point [y, z] at phi (0 = +y, 90 deg = +z), scale k */
function sePt(s, phi, k = 1) {
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  const e = 2 / s.n;
  return [s.h * k * Math.sign(c) * Math.abs(c) ** e, s.w * k * Math.sign(sn) * Math.abs(sn) ** e];
}
/** a lofted shell piece x0..x1, phi0..phi0+phiL, scale k (indexed, smooth normals, outward faces) */
function loft(S, x0, x1, phi0 = 0, phiL = TAU, k = 1, nx = 16, nphi = 36) {
  const np = Math.max(2, Math.round((nphi * phiL) / TAU));
  const pos = [];
  const idx = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    const s = S(x);
    for (let j = 0; j <= np; j++) {
      const [y, z] = sePt(s, phi0 + (phiL * j) / np, k);
      pos.push(x, y, z);
    }
  }
  const W = np + 1;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < np; j++) {
      const a = i * W + j;
      idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
/** a point on the shell surface at (x, phi) lifted e along the normal, with that normal */
function onShell(S, x, phi, k = 1, e = 0.0004) {
  const s = S(x);
  const [y, z] = sePt(s, phi, k);
  const [y1, z1] = sePt(s, phi + 0.002, k);
  const n = new V3(0, z1 - z, -(y1 - y)).normalize();
  return {p: [x, y + n.y * e, z + n.z * e], n: n.toArray()};
}
/** a tapered round tube along the polyline pts [[x, y, z], ...], radius rad(t) */
function taperTube(pts, rad, n = 24, seg = 14) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal');
  const frames = curve.computeFrenetFrames(n, false);
  const pos = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = rad(t);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU;
      pos.push(p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r, p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r, p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j;
      const b = i * seg + ((j + 1) % seg);
      idx.push(a, b, a + seg, b, b + seg, a + seg);
    }
  const c0 = pos.length / 3;
  const P0 = curve.getPointAt(0);
  pos.push(P0.x, P0.y, P0.z);
  for (let j = 0; j < seg; j++) idx.push(c0, (j + 1) % seg, j);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
/** a slim internal skeleton (ribbed graphite link + steel end blocks) inside a shell, internal:true for x-ray */
function skeleton(root, x0, len, h, w, M) {
  const k = ribbedLink(len, h, w, {M, armor: false});
  k.position.x = x0;
  k.traverse((m) => m.isMesh && (m.userData.internal = true));
  root.add(k);
}
/** the face offset of a drum's output flange (as parts.actuator lays it out) */
const flangeZ = (a) => a.len / 2 + a.len * 0.085 + 0.004;
/**
 * an ivory link shell x0..x1 over a graphite core: ivory over the top and both flanks, graphite keel underneath,
 * dark groove bands at the fractions in grooves, bolt dots beside them. Returns the section function.
 */
function limbShell(add, root, M, S, x0, x1, grooves, dots = true) {
  const L = x1 - x0;
  const top = [-128 * DEG, 256 * DEG];
  const cuts = grooves.map((f) => x0 + L * f);
  const xs = [x0, ...cuts, x1];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i] + (i ? 0.0016 : 0);
    const b = xs[i + 1] - (i < xs.length - 2 ? 0.0016 : 0);
    add(loft(S, a, b, ...top, 1, Math.max(4, Math.round(((b - a) / L) * 30)), 44), 'white');
  }
  add(loft(S, x0, x1, 0, TAU, 0.9, 24, 32), 'graphite'); // core / keel, shows under the shell and in the grooves
  const bl = [];
  if (dots) for (const x of cuts) for (const s of [-1, 1]) for (const a of [50, 110]) bl.push({...onShell(S, x + s * 0.011, s * a * DEG), r: 0.003});
  if (bl.length) root.add(bolts(bl, {M, r: 0.003}));
}
/** the static hip mount, frame: x outward, y up. Mounting flange + saddle + the hip-yaw drum. */
function tmplMount(M, feature) {
  const root = new THREE.Group();
  const yaw = drumBand(M, actuator({...G.hipYaw, reducer: 'harmonic', cutPhi: Math.PI / 2, M}), Math.PI / 2);
  root.add(yaw);
  const add = (g, mat, internal = false) => root.add(part(M, g, mat, {internal}));
  // mounting flange: a steel plate (contact face at x = -MOUNT_BACK) bolted to the side-beam hip pad, a graphite
  // back plate, and top / bottom arms that clamp the yaw housing
  const xb = -MOUNT_BACK;
  add(rbox(0.012, 0.13, 0.1, 0.004).translate(xb + 0.006, 0, 0), 'steel');
  add(boxFrom(xb + 0.012, -G.hipYaw.r + 0.002, -0.052, 0.052, -0.036, 0.036), 'graphite');
  const hb = [];
  for (const yy of [-0.052, 0.052]) for (const zz of [-0.038, 0.038]) hb.push({p: [xb + 0.012, yy, zz], n: [1, 0, 0]});
  root.add(bolts(hb, {r: 0.005, mat: 'steel', head: true, M}));
  const yl = G.hipYaw.len / 2;
  add(lever(xb + 0.012, 0.036, 0, G.hipYaw.r * 0.98, 0.01).rotateX(Math.PI / 2).translate(0, -yl - 0.006, 0), 'graphite'); // bottom arm
  for (const s of [1, -1]) add(boxFrom(xb + 0.012, -0.018, -0.062, -yl - 0.01, s * 0.026 - 0.0035, s * 0.026 + 0.0035, 0.002), 'graphite'); // gussets
  // hard-stop lugs (mechanical yaw limit) on the bottom arm
  for (const s of [1, -1]) add(rbox(0.012, 0.014, 0.012, 0.003).translate(-0.024, -yl + 0.002, s * 0.04), 'steel');
  return {root, feat: feature ? yaw : null};
}

/** the coxa, frame: x along the leg's yaw heading, y up, z across. White top cap on the yaw flange, hip-pitch drum. */
function tmplCoxa(M, feature) {
  const root = new THREE.Group();
  const add = (g, mat) => root.add(part(M, g, mat));
  const top = G.hipYaw.len / 2 + G.hipYaw.len * 0.085 + 0.006;
  // top cap: a white rounded plate bolted to the yaw output flange, running out over the hip-pitch drum; a dark
  // saddle under it clamps the drum housing
  add(lever(0, G.hipYaw.r * 0.86, LEG.coxa, 0.036, 0.014).rotateX(Math.PI / 2).translate(0, top + 0.002, 0), 'white');
  add(boxFrom(LEG.coxa - 0.03, LEG.coxa + 0.03, G.hipPitch.r * 0.8, top - 0.004, -0.036, 0.036, 0.006), 'graphite');
  root.add(bolts(boltCircleY(0.03, 6, top + 0.0095), {r: 0.0036, mat: 'rubber', M}));
  root.add(bolts([[LEG.coxa - 0.016, top + 0.0095, -0.016], [LEG.coxa - 0.016, top + 0.0095, 0.016]], {r: 0.0034, mat: 'rubber', M}));
  // the hip-pitch drum, axis z, output +z; its window faces up
  const hp = zDrum({...G.hipPitch, reducer: 'harmonic', M, x: LEG.coxa});
  hp.name = 'hipPitch';
  root.add(hp);
  // bearing stub on the back face (the femur turns on it)
  add(zcyl(0.017, 0.012, LEG.coxa, 0, -(G.hipPitch.len / 2 + 0.005), 24), 'steel');
  return {root, feat: feature ? hp : null};
}
const boxFrom = (x0, x1, y0, y1, z0, z1, r = 0.004) => rbox(x1 - x0, y1 - y0, z1 - z0, r).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const boltCircleY = (r, n, y) => boltCircle(r, n, y, Math.PI / n);

/** the femur, frame: origin at the hip-pitch axis, x toward the knee. Lofted ivory shell, tendon, knee drum + cheek. */
function tmplFemur(M, feature) {
  const root = new THREE.Group();
  const add = (g, mat, ud = {}) => root.add(part(M, g, mat, ud));
  const {h, w} = G.femur;
  const F = LEG.femur;
  const x0 = 0.026;
  const x1 = F - 0.026;
  const S = stations([[x0, 0.028, 0.028], [0.09, h * 0.48, w * 0.47], [0.16, h * 0.5, w * 0.48], [0.3, h * 0.38, w * 0.4], [x1, 0.027, 0.027]]);
  limbShell(add, root, M, S, x0, x1, [0.62]);
  // clevis on the hip-pitch output flange (+z): an ivory plate from the drum hub into the shell flank
  const zc = flangeZ(G.hipPitch) + 0.004;
  add(lever(0, G.hipPitch.r * 0.82, 0.11, 0.03, 0.008, zc), 'white');
  add(cyl(G.hipPitch.r * 0.5, 0.004, 32).rotateX(Math.PI / 2).translate(0, 0, zc + 0.005), 'graphite');
  root.add(bolts(boltCircle(G.hipPitch.r * 0.6, 6, 0, 0).map((b) => ({p: [b.p[0], b.p[2], zc + 0.0045], n: [0, 0, 1]})), {M, r: 0.0028, head: true, mat: 'steel'}));
  // dark tendon cable along the top flank (hip -> knee), held by three graphite clips
  const tp = [];
  for (const x of [0.06, 0.12, 0.2, 0.28, 0.34]) tp.push(onShell(S, x, 24 * DEG, 1, 0.006).p);
  add(taperTube(tp, () => 0.0052, 30, 10), 'dark');
  const clips = [];
  for (const x of [0.11, 0.2, 0.29]) {
    const q = onShell(S, x, 24 * DEG, 1, 0.006);
    clips.push(rbox(0.012, 0.014, 0.014, 0.003).lookAt(new V3(...q.n)).translate(...q.p));
  }
  add(merge(clips), 'graphite');
  skeleton(root, x0 + 0.03, x1 - x0 - 0.06, 0.04, 0.036, M);
  // knee drum, axis z (output +z drives the tibia); an ivory cheek plate on the back face (-z) sleeves it
  const kn = zDrum({...G.knee, reducer: 'harmonic', M, x: F, thin: true});
  kn.name = 'knee';
  root.add(kn);
  add(zcyl(0.016, 0.012, F, 0, -(G.knee.len / 2 + 0.005), 24), 'steel');
  const zb = -(G.knee.len / 2 + 0.015);
  add(lever(F - 0.1, 0.028, F, G.knee.r * 0.92, 0.008, zb), 'white');
  // the femur shell's cheeks sleeve the drum on the hip side (clear of the jointCut window on top)
  add(drumSleeve(G.knee, F, 228 * DEG, 84 * DEG), 'white');
  add(cyl(0.018, 0.004, 24).rotateX(Math.PI / 2).translate(F, 0, zb - 0.005), 'steel');
  return {root, feat: feature ? kn : null};
}

/** the tibia, frame: origin at the knee axis, x toward the foot. Slender lofted shell, ankle drum, tarsus claw. */
function tmplTibia(M) {
  const root = new THREE.Group();
  const add = (g, mat, internal = false) => root.add(part(M, g, mat, {internal}));
  const {h, w, endH, endW} = G.tibia;
  const A = G.ankle;
  const x0 = 0.024;
  const x1 = A.at - A.r * 0.4;
  const S = stations([[x0, 0.026, 0.026], [0.07, h * 0.52, w * 0.52], [0.2, h * 0.46, w * 0.46], [x1 - 0.09, endH * 0.6, endW * 0.6], [x1, endH * 0.42, endW * 0.42]], 2.4);
  limbShell((g, m) => add(g, m), root, M, S, x0, x1, [0.3, 0.74]);
  // clevis on the knee output flange (+z)
  const zc = flangeZ(G.knee) + 0.004;
  add(lever(0, G.knee.r * 0.82, 0.1, 0.026, 0.008, zc), 'white');
  add(cyl(G.knee.r * 0.5, 0.004, 32).rotateX(Math.PI / 2).translate(0, 0, zc + 0.005), 'graphite');
  root.add(bolts(boltCircle(G.knee.r * 0.6, 6, 0, 0).map((b) => ({p: [b.p[0], b.p[2], zc + 0.0045], n: [0, 0, 1]})), {M, r: 0.0026, head: true, mat: 'steel'}));
  add(drumSleeve(G.knee, 0, 52 * DEG, 76 * DEG, 1.04), 'white'); // tibia cheeks sleeve the knee on the foot side
  // one small orange accent on the outer flank below the knee
  add(loft(S, 0.11, 0.124, 70 * DEG, 40 * DEG, 1.006, 2, 120), 'orange');
  skeleton(root, x0 + 0.03, x1 - x0 - 0.07, 0.03, 0.028, M);
  // ankle: a small passive drum (elastomer pack + load cell + contact switch inside)
  root.add(passiveDrum(M, A.r, A.len, A.at, 0, 0));
  // tarsus: a short graphite segment with an orange collar, then the dark curved claw tip ending on the foot point
  const T = LEG.tibia;
  const [n0] = G.needle;
  add(xcyl(0.0125, A.at + A.r * 0.7, n0 + 0.006, 20, 0.0105), 'graphite');
  add(xcyl(0.0135, n0 - 0.004, n0 + 0.006, 24), 'orange');
  add(taperTube([[n0 + 0.004, 0, 0], [n0 + 0.03, 0.007, 0], [T - 0.022, 0.0075, 0], [T, 0, 0]], (t) => 0.0115 * (1 - t) + 0.0016, 24, 14), 'dark');
  // two short graphite spurs at the tibia-tarsus joint (scorpion leg spurs), pointing distally and out
  const spurs = [];
  for (const s of [1, -1]) {
    const d = new V3(0.86, -0.2, s * 0.47).normalize();
    const c = new THREE.ConeGeometry(0.0042, 0.026, 10).translate(0, 0.013, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d));
    spurs.push(c.translate(A.at - 0.012, -0.006, s * (A.len / 2 - 0.004)));
  }
  add(merge(spurs), 'graphite');
  add(xcyl(0.003, x0 + 0.03, A.at, 8), 'copper', true); // sensor lead down to the ankle
  return {root, feat: null};
}

/** the foot tip, frame: origin on the foot point, y up, x along the leg heading. Rubber tip + pressure film. */
function tmplPad(M) {
  const root = new THREE.Group();
  const add = (g, mat, internal = false) => root.add(part(M, g, mat, {internal}));
  add(new THREE.SphereGeometry(0.0034, 14, 10).translate(0, 0.0034, 0), 'rubber');
  add(cyl(0.0024, 0.0012, 12).translate(0, 0.0038, 0), 'copper', true); // pressure sensor film
  return {root, feat: null};
}

// ------------------------------------------------------------ legs: the builder
/**
 * buildLegs(M) -> {group, update(kinLegs, pose), anchors, assemblies, joints}
 *   group       all eight legs, in the robot root frame (kin leg poses already include the body bob)
 *   assemblies  {leg0..leg7}: one Group per leg (identity when assembled); robot.js offsets it for the explode
 *   joints      {hipL1, kneeL1, hipYawL1}: live parts.actuator() Groups of leg 0 for jointCut and the axial explode
 *   anchors     hipL1 kneeL1 footL1 (+ hip<ID> knee<ID> foot<ID> for every leg, e.g. hipR3)
 * update(kinLegs = legsAt(PHI, lift)) poses the five rigid bodies of every leg.
 */
export function buildLegs(M) {
  const group = new THREE.Group();
  group.name = 'legs';
  const assemblies = {};
  const anchors = {};
  const joints = {};
  // shared buffers for legs 1..7, built once
  const T = {
    // legs 1..7 keep their internals too (x-ray shows all eight), merged into one copper + one steel + one graphite
    // buffer per body, so they cost three extra draw calls each
    mount: baked('leg.mount', () => tmplMount(M).root),
    coxa: baked('leg.coxa', () => tmplCoxa(M).root),
    femur: baked('leg.femur', () => tmplFemur(M).root),
    tibia: baked('leg.tibia', () => tmplTibia(M).root),
    pad: baked('leg.pad', () => tmplPad(M).root),
  };
  const legs = LEGS.map((L, i) => {
    const sys = `leg${i}`;
    const A = new THREE.Group();
    A.name = sys;
    const B = {};
    for (const k of ['mount', 'coxa', 'femur', 'tibia', 'pad']) {
      B[k] = new THREE.Group();
      B[k].name = `${sys}.${k}`;
      A.add(B[k]);
    }
    if (i === 0) {
      // L1 stays live: its actuators open for jointCut and fly apart axially in the teardown
      const mo = tmplMount(M, true);
      const co = tmplCoxa(M, true);
      const fe = tmplFemur(M, true);
      B.mount.add(mo.root);
      B.coxa.add(co.root);
      B.femur.add(fe.root);
      B.tibia.add(tmplTibia(M).root);
      B.pad.add(tmplPad(M).root);
      joints.hipYawL1 = mo.feat;
      joints.hipL1 = co.feat;
      joints.kneeL1 = fe.feat;
    } else for (const k in B) instance(M, T[k], B[k]);
    anchors[`hip${L.id}`] = marker(B.coxa, LEG.coxa, 0, G.hipPitch.len / 2 + 0.01);
    anchors[`knee${L.id}`] = marker(B.femur, LEG.femur, 0, G.knee.len / 2 + 0.01);
    anchors[`foot${L.id}`] = marker(B.tibia, LEG.tibia, 0, 0);
    tag(A, {sys, order: ORDER.leg, explode: [L.hip[0] * 0.6, 0.05, L.side * 0.45], cut: false});
    group.add(A);
    assemblies[sys] = A;
    return {L, B};
  });
  anchors.hipL1 = anchors.hipL1 || anchors[`hip${LEGS[0].id}`];
  anchors.kneeL1 = anchors[`knee${LEGS[0].id}`];
  anchors.footL1 = anchors[`foot${LEGS[0].id}`];

  const v = (p) => new V3(p[0], p[1], p[2]);
  const dir = new V3();
  const n = new V3();
  const u = new V3();
  const side = new V3();
  const back = new V3();
  /** kinLegs: legsAt(PHI, lift) output ({legs: [...]}) or the legs array itself */
  function update(kinLegs) {
    const arr = Array.isArray(kinLegs) ? kinLegs : kinLegs.legs;
    arr.forEach((l, i) => {
      const {L, B} = legs[i];
      const hip = v(l.hip);
      const c = v(l.coxaEnd);
      const k = v(l.kneeP);
      const f = v(l.footP);
      u.set(l.ux, 0, l.uz).normalize();
      n.set(-l.uz, 0, l.ux).normalize(); // joint axis: horizontal, across the leg plane
      side.set(0, 0, L.side);
      back.set(-L.side, 0, 0);
      frame(B.mount, hip, side, back);
      frame(B.coxa, hip, u, n);
      frame(B.femur, c, dir.subVectors(k, c), n);
      frame(B.tibia, k, dir.subVectors(f, k), n);
      frame(B.pad, f, u, n);
    });
    group.updateMatrixWorld(true);
  }
  return {group, update, anchors, assemblies, joints};
}
