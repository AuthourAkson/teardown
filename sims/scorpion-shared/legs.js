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
import {actuator, armorPanel, bolts, boltCircle, rbox, ribbedLink, tag} from './parts.js';
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
export const LEGGEO = {
  hipYaw: {r: 0.06, len: 0.104}, // vertical axis, on the hip mount
  hipPitch: {r: 0.065, len: 0.118}, // at the coxa end, axis across the leg plane
  knee: {r: 0.057, len: 0.112},
  ankle: {r: 0.038, len: 0.084, at: LEG.tibia - 0.138}, // passive foot module along the tibia (m from the knee)
  femur: {h: 0.094, w: 0.098},
  tibia: {h: 0.082, w: 0.086},
  needle: [LEG.tibia - 0.108, LEG.tibia - 0.012], // needle from / to (m from the knee); the ball joint at its tip
};
const G = LEGGEO;
const t8 = 0.012; // fork plate thickness
/** hip axis -> contact face of the hip pad on the side beam (m, inward); body.js puts the pad face there */
export const MOUNT_BACK = 0.065;

/** the static hip mount, frame: x outward, y up. Mounting flange + saddle + the hip-yaw actuator. */
function tmplMount(M, feature) {
  const root = new THREE.Group();
  const yaw = actuator({...G.hipYaw, reducer: 'harmonic', cutPhi: Math.PI / 2, M});
  root.add(yaw);
  const add = (g, mat, internal = false) => root.add(part(M, g, mat, {internal}));
  // mounting flange: a steel plate (contact face at x = -MOUNT_BACK) bolted to the side-beam hip pad, a graphite
  // C-bracket with top and bottom arms out to the actuator (the yaw housing is clamped between them)
  const xb = -MOUNT_BACK;
  add(rbox(0.012, 0.15, 0.11, 0.004).translate(xb + 0.006, 0, 0), 'steel');
  add(boxFrom(xb + 0.012, -0.043, -0.06, 0.06, -0.04, 0.04), 'graphite');
  const hb = [];
  for (const yy of [-0.06, 0.06]) for (const zz of [-0.043, 0.043]) hb.push({p: [xb + 0.012, yy, zz], n: [1, 0, 0]});
  root.add(bolts(hb, {r: 0.0055, mat: 'steel', head: true, M}));
  const yl = G.hipYaw.len / 2;
  add(lever(xb + 0.012, 0.04, 0, G.hipYaw.r * 0.98, 0.012).rotateX(Math.PI / 2).translate(0, -yl - 0.007, 0), 'graphite'); // bottom arm
  for (const s of [1, -1]) add(boxFrom(xb + 0.012, -0.012, -0.075, -yl - 0.012, s * 0.03 - 0.004, s * 0.03 + 0.004, 0.002), 'steel'); // gussets
  // hard-stop lugs (mechanical yaw limit) on the bottom arm
  for (const s of [1, -1]) add(rbox(0.014, 0.018, 0.014, 0.003).translate(-0.02, -yl + 0.004, s * 0.046), 'steel');
  return {root, feat: feature ? yaw : null};
}

/** the coxa, frame: x along the leg's yaw heading, y up, z across. Top plate on the yaw flange, web, hip-pitch can. */
function tmplCoxa(M, feature) {
  const root = new THREE.Group();
  const add = (g, mat) => root.add(part(M, g, mat));
  const top = G.hipYaw.len / 2 + G.hipYaw.len * 0.085 + 0.006;
  // top plate: bolted to the yaw output flange, runs out over the hip-pitch housing; a saddle clamps the housing
  add(lever(0, G.hipYaw.r * 0.9, LEG.coxa, 0.042, 0.012).rotateX(Math.PI / 2).translate(0, top, 0), 'graphite');
  add(boxFrom(LEG.coxa - 0.036, LEG.coxa + 0.036, G.hipPitch.r * 0.78, top, -0.042, 0.042), 'graphite');
  add(boxFrom(LEG.coxa - 0.03, LEG.coxa + 0.03, top + 0.006, top + 0.016, -0.03, 0.03, 0.003), 'steel'); // clamp cap
  root.add(bolts(boltCircleY(0.03, 6, top + 0.006), {r: 0.004, mat: 'steel', head: true, M}));
  root.add(bolts([[LEG.coxa - 0.02, top + 0.016, -0.018], [LEG.coxa + 0.02, top + 0.016, -0.018], [LEG.coxa - 0.02, top + 0.016, 0.018], [LEG.coxa + 0.02, top + 0.016, 0.018]], {r: 0.0035, mat: 'dark', M}));
  // the hip-pitch actuator, axis z, output +z; its window faces up
  const hp = zActuator({...G.hipPitch, reducer: 'harmonic', M, x: LEG.coxa});
  hp.name = 'hipPitch';
  root.add(hp);
  // bearing stub on the back face (the femur's second fork turns on it)
  add(zcyl(0.02, 0.016, LEG.coxa, 0, -(G.hipPitch.len / 2 + 0.006), 24), 'steel');
  return {root, feat: feature ? hp : null};
}
const boxFrom = (x0, x1, y0, y1, z0, z1, r = 0.004) => rbox(x1 - x0, y1 - y0, z1 - z0, r).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const boltCircleY = (r, n, y) => boltCircle(r, n, y, Math.PI / n);

/** two fork plates (z = ±zf) around a joint at the origin, joined by a spacer at x = xs; frame x along the link */
function fork(add, r0, r1, x1, zf, h) {
  // the plate bolts to the output flange only (r0 ~ flange), so the dark can and its orange ring stay visible
  for (const s of [1, -1]) add(lever(0, r0 * 0.62, x1, r1 * 0.8, t8, s * zf), 'graphite');
  add(boxFrom(x1 - 0.016, x1 + 0.012, -h * 0.4, h * 0.4, -zf, zf), 'graphite');
}

/** the femur, frame: origin at the hip-pitch axis, x toward the knee. Fork, ribbed armoured link, knee can. */
function tmplFemur(M, feature) {
  const root = new THREE.Group();
  const add = (g, mat) => root.add(part(M, g, mat));
  const {h, w} = G.femur;
  const zf = G.hipPitch.len / 2 + G.hipPitch.len * 0.085 + t8 / 2 + 0.002;
  fork(add, G.hipPitch.r * 0.82, h * 0.48, 0.09, zf, h);
  const x0 = 0.1;
  const x1 = LEG.femur - G.knee.r * 0.75;
  const link = ribbedLink(x1 - x0, h, w, {mat: 'white', M});
  link.position.x = x0;
  root.add(link);
  const pan = armorPanel(x1 - x0 - 0.03, 0.012, w * 0.92, {M, mat: 'white', seams: 2, bolts: true, arch: 0.004});
  pan.position.set((x0 + x1) / 2 + 0.005, h / 2 + 0.004, 0);
  root.add(pan);
  const bot = armorPanel(x1 - x0 - 0.05, 0.01, w * 0.8, {M, mat: 'white', seams: 1, bolts: true});
  bot.rotation.x = Math.PI;
  bot.position.set((x0 + x1) / 2, -h / 2 - 0.003, 0);
  root.add(bot);
  // knee housing saddle: the link's end block wraps into the can
  add(boxFrom(x1 - 0.02, x1 + 0.012, -h * 0.42, h * 0.42, -w * 0.47, w * 0.47), 'graphite');
  const kn = zActuator({...G.knee, reducer: 'harmonic', M, x: LEG.femur});
  kn.name = 'knee';
  root.add(kn);
  add(zcyl(0.018, 0.016, LEG.femur, 0, -(G.knee.len / 2 + 0.006), 24), 'steel');
  return {root, feat: feature ? kn : null};
}

/** the tibia, frame: origin at the knee axis, x toward the foot. Fork, link, foot module, needle, ball. */
function tmplTibia(M) {
  const root = new THREE.Group();
  const add = (g, mat, internal = false) => root.add(part(M, g, mat, {internal}));
  const {h, w} = G.tibia;
  const zf = G.knee.len / 2 + G.knee.len * 0.085 + t8 / 2 + 0.002;
  fork(add, G.knee.r * 0.82, h * 0.5, 0.09, zf, h);
  const x0 = 0.1;
  const x1 = G.ankle.at - G.ankle.r * 0.6;
  const link = ribbedLink(x1 - x0, h, w, {mat: 'white', M});
  link.position.x = x0;
  root.add(link);
  const pan = armorPanel(x1 - x0 - 0.03, 0.012, w * 0.92, {M, mat: 'white', seams: 2, bolts: true, vents: {n: 3, len: 0.05, at: [-0.35, 0]}, arch: 0.004});
  pan.position.set((x0 + x1) / 2, h / 2 + 0.004, 0);
  root.add(pan);
  // foot module: compliance drum with load cell, then the needle with its orange collar and the ball socket
  const A = G.ankle;
  root.add(passiveDrum(M, A.r, A.len, A.at, 0, 0));
  add(xcyl(0.016, A.at + 0.01, G.needle[0] + 0.004, 20), 'graphite');
  add(xcyl(0.023, G.needle[0] - 0.004, G.needle[0] + 0.01, 28), 'orange');
  add(xcyl(0.019, G.needle[0] + 0.01, G.needle[1], 24, 0.0055), 'dark');
  add(new THREE.SphereGeometry(0.0095, 16, 10).translate(G.needle[1] + 0.002, 0, 0), 'steel');
  add(xcyl(0.004, A.at, G.needle[0], 8), 'copper', true); // sensor lead down to the pad
  return {root, feat: null};
}

/** the foot pad, frame: origin on the foot point, y up, x along the leg heading. Stays level (passive pitch). */
function tmplPad(M) {
  const root = new THREE.Group();
  const add = (g, mat, internal = false) => root.add(part(M, g, mat, {internal}));
  add(cyl(0.024, 0.009, 28, 0.021).translate(0, 0.0045, 0), 'rubber');
  add(cyl(0.017, 0.007, 24, 0.012).translate(0, 0.012, 0), 'graphite');
  add(cyl(0.014, 0.002, 20).translate(0, 0.006, 0), 'copper', true); // pressure sensor film
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
    anchors[`foot${L.id}`] = marker(B.tibia, G.ankle.at, 0, 0);
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