// SCORPION SC-8, the eight-section tail and the stinger module (spec §5), posed from kin.js tailAt().
//   root mount   fixed: J1 yaw stage (vertical can) on the rear-frame turntable flange (body.js, top y = root.y - 0.09)
//   yaw carrier  turns with J1 yaw: a fork carrying the J1 pitch drum on the root point
//   links 1..6, end mount   one rigid body each, k = 1..7, running pts[k-1] -> pts[k]: output clevis on the joint
//                behind, black skeleton spine, white armour shells (one per section, never across a joint), and the
//                big drum of the next joint J(k+1) at pts[k]: orange outer ring, dark face, bolt circle, steel hub,
//                motor / reducer / bearing / encoder inside. Sizes taper from TAIL.width / TAIL.height.
//   stinger      J8 small pitch joint at pts[7] -> flange, sensor bay (dark glass window, orange bulb ring),
//                detachable tip shell with the black curved needle.
//   cable carrier  a chain of small dark carrier links over the drums on the outer (top) side of the curl.
// Each drum size is built once; the tail is not repeated, so link bodies are baked one by one for draw calls and
// J1 stays live (parts.actuator) for jointCut and the axial explode.
import * as THREE from 'three';
import {actuator, armorPanel, bolts, boltCircle, rbox, tag} from './parts.js';
import {TAIL} from './kin.js';
import {ORDER, UP, bake, cyl, frame, instance, lever, marker, part, ring, xcyl, zActuator, zcyl} from './legs.js';

const V3 = THREE.Vector3;
const box = (x0, x1, y0, y1, z0, z1, r = 0.004) => rbox(x1 - x0, y1 - y0, z1 - z0, r).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// drum of joint J(j+1) at pts[j]: radius from the section height there, length across from the width
export const drumOf = (j) => {
  const h = TAIL.height[Math.min(8, j + 1)];
  const w = TAIL.width[Math.min(8, j + 1)];
  return {r: Math.max(0.034, h * 0.5), len: w * 0.92};
};
const LENS = [...TAIL.seg, TAIL.sting];

/** a link body k (1..7) along +x from J(k) at the origin to J(k+1) at x = len; z = the pitch axis */
function linkBody(M, k) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => g.add(part(M, geo, mat, ud));
  const len = LENS[k - 1];
  const a = drumOf(k - 1); // the drum behind (its output flange drives this link)
  const b = drumOf(k); // the drum this link carries at its far end
  const h = TAIL.height[k] * 0.78;
  const w = TAIL.width[k];
  // output clevis plates on both faces of the drum behind
  // output arms: slim plates from the output hub of the drum behind to the spine, so the drum face stays visible
  const zf = a.len / 2 + a.len * 0.085 + 0.008;
  // (output adapter disc bolted to the flange; the link spine is keyed to it inside the drum face)
  for (const s of [1, -1]) add(zcyl(a.r * 0.4, 0.008, 0, 0, s * (zf - 0.004), 32), 'steel');
  // the drum ahead, clamped in the link's far end; axis z
  const act = zActuator({...b, reducer: k < 4 ? 'harmonic' : 'planetary', M, x: len});
  g.add(act);
  // the reference drum: wide orange rim bands at both edges of the housing, a black face inside them, a steel hub
  // boss and the bolt circle (the official drum face reads black, not steel)
  for (const s of [1, -1]) add(ring(b.r * 1.05, b.r * 0.955, b.len * 0.16, 44).rotateX(Math.PI / 2).translate(len, 0, s * b.len * 0.34), 'orange');
  for (const s of [1, -1]) {
    add(ring(b.r * 0.995, b.r * 0.26, 0.012, 44).rotateX(Math.PI / 2).translate(len, 0, s * (b.len / 2 + 0.01)), 'dark');
    add(cyl(b.r * 0.22, 0.012, 28).rotateX(Math.PI / 2).translate(len, 0, s * (b.len / 2 + 0.021)), 'steel');
  }
  // black skeleton spine between the drums
  const x0 = a.r * 0.75;
  const x1 = len - b.r * 0.85;
  if (x1 > x0) {
    add(box(x0 - 0.01, x1 + 0.01, -h * 0.32, h * 0.32, -w * 0.32, w * 0.32, 0.004), 'dark');
    // white armour shells on the two flanks and the top (outer side of the curl is local +y), one per section
    const al = Math.max(0.04, x1 - x0 + 0.02);
    for (const s of [1, -1]) {
      const p = armorPanel(al, 0.012, h, {M, mat: 'white', seams: al > 0.09 ? 2 : 1, bolts: true, arch: 0.005, stripe: false});
      p.rotation.x = (s * Math.PI) / 2;
      p.position.set((x0 + x1) / 2, 0, s * (w / 2 - 0.004));
      g.add(p);
    }
    const top = armorPanel(al - 0.01, 0.012, w * 0.86, {M, mat: 'white', seams: 1, bolts: true, arch: 0.006});
    top.position.set((x0 + x1) / 2, h / 2 + 0.002, 0);
    g.add(top);
    // alternating sections carry a thin orange stripe on the outer flank (reference s001/s007)
    if (k % 2 === 0) for (const s of [1, -1]) g.add(part(M, box(x0 - 0.004, x1 + 0.004, h * 0.2, h * 0.27, s * (w / 2 + 0.002) - 0.0025, s * (w / 2 + 0.002) + 0.0025, 0.001), 'orange'));
    add(box(x0, x1, -h / 2 - 0.006, -h * 0.32, -w * 0.28, w * 0.28, 0.003), 'graphite'); // belly plate
  }
  // drum bolts round the rim of each black face (the bolt circle the reference shows on every drum face)
  const fb = [];
  for (const s of [1, -1]) for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2;
    fb.push({p: [len + Math.cos(t) * b.r * 0.78, Math.sin(t) * b.r * 0.78, s * (b.len / 2 + 0.017)], n: [0, 0, s]});
  }
  g.add(bolts(fb, {M, r: Math.max(0.0028, b.r * 0.045), head: true, mat: 'steel'}));
  return {g, act};
}

/** root mount: J1 yaw stage on the turntable flange; frame origin = J1 point (TAIL.root), world axes */
function rootMount(M) {
  const g = new THREE.Group();
  const yaw = actuator({r: 0.075, len: 0.05, reducer: 'harmonic', cutPhi: -Math.PI / 2, M});
  yaw.position.y = -0.125;
  g.add(yaw);
  g.add(part(M, cyl(0.084, 0.008, 44).translate(0, -0.146, 0), 'steel'));
  g.add(bolts(boltCircle(0.079, 10, -0.141, 0.2), {M, r: 0.0042, head: true, mat: 'steel'}));
  return {g, yaw};
}
/** yaw carrier: plate on the yaw output + two cheeks clasping the J1 pitch drum (axis z, centred on the origin) */
function yawCarrier(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => g.add(part(M, geo, mat));
  const j1 = drumOf(0);
  const top = -0.125 + 0.025 + 0.05 * 0.085 + 0.006;
  add(cyl(0.07, 0.012, 40).translate(0, top, 0), 'graphite');
  const zf = j1.len / 2 + j1.len * 0.085 + 0.012;
  for (const s of [1, -1]) {
    add(box(-0.05, 0.05, top, 0.0, s * zf - 0.008, s * zf + 0.008, 0.004), 'graphite');
    add(zcyl(0.05, 0.016, 0, 0, s * zf, 32), 'graphite');
  }
  add(box(-0.075, -0.05, top, 0.04, -zf, zf, 0.004), 'steel'); // pitch hard-stop block (mechanical limit)
  const p = zActuator({...j1, reducer: 'harmonic', M});
  g.add(p);
  add(ring(j1.r * 1.04, j1.r * 0.97, j1.len * 0.14, 44).rotateX(Math.PI / 2), 'orange');
  return {g, act: p};
}
/** stinger module along +x from J8 at the origin: flange, sensor bay, bulb, detachable tip and the curved needle */
function stingerBody(M) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => g.add(part(M, geo, mat, ud));
  const j8 = drumOf(7);
  const zf = j8.len / 2 + j8.len * 0.085 + 0.007;
  for (const s of [1, -1]) add(lever(0, j8.r * 0.8, 0.05, 0.03, 0.01).translate(0, 0, s * zf), 'graphite');
  add(xcyl(0.036, 0.045, 0.058, 32), 'steel'); // tail-end mounting flange
  const fb = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    fb.push({p: [0.058, Math.cos(t) * 0.028, Math.sin(t) * 0.028], n: [1, 0, 0]});
  }
  g.add(bolts(fb, {M, r: 0.0032, head: true, mat: 'graphite'}));
  // sensor bay: white bulb with an orange ring and a dark glass window band
  const bulb = new THREE.LatheGeometry([[0, 0], [0.036, 0.002], [0.052, 0.03], [0.056, 0.06], [0.05, 0.09], [0.036, 0.11], [0.026, 0.12]].map(([r, y]) => new THREE.Vector2(r, y)), 36);
  add(bulb.clone().rotateZ(-Math.PI / 2).translate(0.058, 0, 0), 'white');
  add(ring(0.058, 0.04, 0.018, 40).rotateZ(-Math.PI / 2).translate(0.085, 0, 0), 'orange');
  add(ring(0.0575, 0.045, 0.02, 40).rotateZ(-Math.PI / 2).translate(0.125, 0, 0), 'smoke');
  add(xcyl(0.02, 0.07, 0.15, 16), 'copper', {internal: true}); // sensor cartridge (probe / contact detector)
  add(xcyl(0.01, 0.06, 0.18, 10), 'steel', {internal: true}); // tip retaining rod
  // detachable tip: orange collar, then the black needle curving down (toward local -y, under the curl)
  add(xcyl(0.03, 0.172, 0.19, 32, 0.026), 'white');
  const path = new THREE.QuadraticBezierCurve3(new V3(0.19, 0, 0), new V3(0.27, 0, 0), new V3(0.31, -0.09, 0));
  const N = 24;
  const pts = [];
  for (let i = 0; i <= N; i++) pts.push(path.getPoint(i / N));
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 1, 16, false);
  // taper the tube radius from 0.024 to a point
  const pa = tube.attributes.position;
  const c = new V3();
  for (let i = 0; i < pa.count; i++) {
    const seg = Math.floor(i / 17);
    const u = seg / N;
    path.getPoint(u, c);
    const r = 0.024 * Math.pow(1 - u, 0.85) + 0.0008;
    pa.setXYZ(i, c.x + (pa.getX(i) - c.x) * r, c.y + (pa.getY(i) - c.y) * r, c.z + (pa.getZ(i) - c.z) * r);
  }
  tube.computeVertexNormals();
  add(tube, 'dark');
  return g;
}
/** cable-carrier link: a small dark open box with side plates, frame x along the chain */
const carrierGeo = () => box(-0.0055, 0.0055, -0.003, 0.003, -0.0095, 0.0095, 0.0012);

// ------------------------------------------------------------ the builder
/**
 * buildTail(M) -> {group, update(kinTail, pose), anchors, assemblies: {tail, stinger}, joints: {tailJ1, tailJ1Yaw}}
 *   group lives in the torso frame; kinTail = tailAt(strike, stow, yaw).
 *   anchors: tailJ1, tailMid (J4 drum), tailJ2..tailJ8, tailSec0..tailSec8 (section mid points), sting (needle tip),
 *   stingFlange, stingBay (sensor bay), stingTip (detachable tip collar), tailCable.
 */
export function buildTail(M) {
  const group = new THREE.Group();
  group.name = 'tail';
  const anchors = {};
  const tailA = new THREE.Group();
  tailA.name = 'tail';
  const stingA = new THREE.Group();
  stingA.name = 'stinger';
  group.add(tailA, stingA);
  const [rx, ry] = TAIL.root;
  const yawG = new THREE.Group(); // rotates by the root yaw about +y at the root point; the chain lives inside it
  yawG.position.set(rx, ry, 0);
  const mount = rootMount(M);
  mount.g.position.set(rx, ry, 0);
  tailA.add(mount.g);
  const carrier = yawCarrier(M);
  yawG.add(carrier.g);
  tailA.add(yawG);
  const bodies = [];
  for (let k = 1; k <= 7; k++) {
    const {g} = linkBody(M, k);
    const b = new THREE.Group();
    b.name = `tail.sec${k}`;
    instance(M, bake(g), b);
    yawG.add(b);
    bodies.push(b);
    anchors[`tailJ${k + 1}`] = marker(b, LENS[k - 1], 0, drumOf(k).len / 2 + 0.01);
    anchors[`tailSec${k}`] = marker(b, LENS[k - 1] / 2, 0, TAIL.width[k] / 2);
  }
  anchors.tailSec0 = marker(mount.g, 0, -0.09, 0.09);
  // stinger: its own assembly, but it rides the same yaw; a separate yaw group inside the stinger assembly
  const yawS = new THREE.Group();
  yawS.position.set(rx, ry, 0);
  stingA.add(yawS);
  const sting = new THREE.Group();
  sting.name = 'stinger.module';
  instance(M, bake(stingerBody(M)), sting);
  yawS.add(sting);
  anchors.tailSec8 = marker(sting, 0.1, 0, 0.06);
  anchors.stingFlange = marker(sting, 0.055, 0, 0.04);
  anchors.stingBay = marker(sting, 0.12, 0, 0.058);
  anchors.stingTip = marker(sting, 0.18, 0, 0.03);
  anchors.sting = marker(sting, 0.31, -0.09, 0);
  anchors.tailJ1 = marker(carrier.g, 0, 0, drumOf(0).len / 2 + 0.03);
  anchors.tailMid = anchors.tailJ4;
  // cable carrier: links over the top of every drum (local +y of the curl), placed per frame along the chain
  const NC = 46;
  const cg = carrierGeo();
  const cim = new THREE.InstancedMesh(cg, M.dark, NC);
  cim.castShadow = cim.receiveShadow = true;
  cim.userData = {mat: 'dark', internal: false};
  yawG.add(cim);
  anchors.tailCable = marker(yawG, 0, 0, 0);
  tag(tailA, {sys: 'tail', order: ORDER.tail, explode: [-0.42, 0.28, 0], cut: false});
  tag(stingA, {sys: 'stinger', order: ORDER.tail, explode: [-0.62, 0.5, 0], cut: false});

  const mx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new V3(1, 1, 1);
  const Z = new V3(0, 0, 1);
  const p = new V3();
  const d = new V3();
  /** kinTail = tailAt(strike, stow, yaw) */
  function update(T) {
    const yaw = T.yaw || 0;
    yawG.rotation.y = yaw;
    yawS.rotation.y = yaw;
    mount.yaw.rotation.y = 0;
    carrier.g.rotation.set(0, 0, 0);
    // J1 drum's output turns with link 1 (pitch); the carrier itself only yaws
    const loc = (k) => new V3(T.pts[k][0] - rx, T.pts[k][1] - ry, 0);
    for (let k = 1; k <= 7; k++) frame(bodies[k - 1], loc(k - 1), d.subVectors(loc(k), loc(k - 1)), Z);
    frame(sting, loc(7), d.subVectors(loc(8), loc(7)), Z);
    // the carrier rides over the drums: offset each chain point along the curl normal by the drum radius
    const path = [];
    for (let k = 0; k <= 7; k++) {
      const a = k === 0 ? T.ang[0] : (T.ang[k - 1] + T.ang[Math.min(7, k)]) / 2;
      const r = Math.max(drumOf(k).r * 1.06, TAIL.height[Math.min(8, k + 1)] * 0.39 + 0.012) + 0.004;
      path.push(new V3(T.pts[k][0] - rx - Math.sin(a) * r, T.pts[k][1] - ry + Math.cos(a) * r, 0));
    }
    const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
    for (let i = 0; i < NC; i++) {
      const u = (i + 0.5) / NC;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, d);
      q.setFromUnitVectors(new V3(1, 0, 0), d);
      cim.setMatrixAt(i, mx.compose(p, q, one));
    }
    cim.instanceMatrix.needsUpdate = true;
    cim.computeBoundingSphere();
    group.updateMatrixWorld(true);
  }
  return {group, update, anchors, assemblies: {tail: tailA, stinger: stingA}, joints: {tailJ1: carrier.act, tailJ1Yaw: mount.yaw}};
}