// SCORPION SC-8, the eight-section tail and the stinger module (spec §5), posed from kin.js tailAt().
//   root mount   fixed: J1 yaw stage (vertical can) on the rear-frame turntable flange (body.js, top y = root.y - 0.09)
//   yaw carrier  turns with J1 yaw: a fork carrying the J1 pitch drum on the root point
//   links 1..6, end mount   one rigid body each, k = 1..7, running pts[k-1] -> pts[k]: output clevis on the joint
//                behind, black skeleton spine, white armour shells (one per section, never across a joint), and the
//                big drum of the next joint J(k+1) at pts[k]: orange outer ring, dark face, bolt circle, steel hub,
//                motor / reducer / bearing / encoder inside. Sizes taper from TAIL.width / TAIL.height.
//   stinger      J8 small pitch joint at pts[7] -> flange, sensor bay (dark glass window, orange bulb ring),
//                detachable tip shell with the black curved needle.
//   armour       per link: arched white shells over the top and both flanks (superellipse section, split into tiles
//                by thin seams, black bolt dots), a crescent knuckle cap over the joint behind (concentric with the
//                pitch axis, so it never opens while the joint bends), and at every joint a side disc on both flanks:
//                orange outer rim, dark face, steel hub, bolt circle. The black skeleton only shows in the seams.
//   cable carrier  a chain of small dark carrier links tucked under the top shells (internal: shows in x-ray only).
// Each drum size is built once; the tail is not repeated, so link bodies are baked one by one for draw calls and
// J1 stays live (parts.actuator) for jointCut and the axial explode.
import * as THREE from 'three';
import {actuator, bolts, boltCircle, rbox, tag} from './parts.js';
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

// ------------------------------------------------------------ armour geometry
// superellipse section point (horizontal = z, vertical = y), exponent 3: a rounded, capsule-like box section
const SE = 3;
const sePt = (a, b, f) => {
  const c = Math.cos(f);
  const s = Math.sin(f);
  return [a * Math.sign(c) * Math.abs(c) ** (2 / SE), b * Math.sign(s) * Math.abs(s) ** (2 / SE)];
};
/**
 * one arched shell tile: section between angles f0..f1 of the superellipse (half sizes a across, b up), wall t,
 * running along +x from x0 to x1. Returns the geometry and bolt-dot positions near its four corners.
 */
function shellTile(a, b, t, f0, f1, x0, x1, boltR) {
  const s = new THREE.Shape();
  const N = Math.max(4, Math.ceil(((f1 - f0) / Math.PI) * 28));
  for (let i = 0; i <= N; i++) {
    const [u, v] = sePt(a, b, f0 + ((f1 - f0) * i) / N);
    i ? s.lineTo(u, v) : s.moveTo(u, v);
  }
  for (let i = N; i >= 0; i--) {
    const [u, v] = sePt(a - t, b - t, f0 + ((f1 - f0) * i) / N);
    s.lineTo(u, v);
  }
  const bv = Math.min(0.0022, t * 0.3);
  const geo = new THREE.ExtrudeGeometry(s, {depth: Math.max(0.004, x1 - x0 - 2 * bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.7, bevelSegments: 2, curveSegments: 4});
  // extrude axis z -> x (rotateY +90deg maps shape x to world -z, extrude depth to world +x)
  geo.rotateY(Math.PI / 2).translate(x0 + bv, 0, 0);
  const dots = [];
  if (boltR) {
    const df = Math.min(0.12, (f1 - f0) * 0.2);
    const ins = Math.min(0.014, (x1 - x0) * 0.2);
    for (const f of [f0 + df, f1 - df])
      for (const x of [x0 + ins, x1 - ins]) {
        const [u, v] = sePt(a + bv * 0.7, b + bv * 0.7, f);
        const e = 1e-3;
        const p = sePt(a, b, f - e);
        const q = sePt(a, b, f + e);
        const tx = q[0] - p[0];
        const ty = q[1] - p[1];
        const l = Math.hypot(tx, ty) || 1;
        // outward shape normal (ty, -tx)/l; shape (u, v) -> world (y = v, z = -u)
        const n = [0, -tx / l, -ty / l];
        dots.push({p: [x, v + n[1] * 0.0003, -u + n[2] * 0.0003], n});
      }
  }
  return {geo, dots};
}
/** crescent knuckle cap: a cylinder band about z through the origin, radius r0..r0+t, angles f0..f1, |z| <= hw */
function knuckleCap(r0, t, f0, f1, hw) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r0 + t, f0, f1, false);
  s.absarc(0, 0, r0, f1, f0, true);
  const bv = Math.min(0.002, t * 0.3);
  const geo = new THREE.ExtrudeGeometry(s, {depth: 2 * hw - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.7, bevelSegments: 2, curveSegments: 28});
  return geo.translate(0, 0, -hw + bv);
}
/** the official side disc at a joint, axis z, on the flank z = zc (outward sign s): orange rim, dark face, steel hub */
function sideDisc(add, M, g, r, x, zc, s) {
  const th = Math.max(0.01, r * 0.16);
  add(ring(r, r * 0.8, th, 48).rotateX(Math.PI / 2).translate(x, 0, zc + (s * th) / 2), 'orange');
  add(cyl(r * 0.82, th * 0.8, 44).rotateX(Math.PI / 2).translate(x, 0, zc + (s * th * 0.4)), 'dark');
  add(cyl(r * 0.3, th * 0.7, 32, r * 0.24).rotateX((s * Math.PI) / 2).translate(x, 0, zc + s * (th * 0.8 + th * 0.3)), 'steel');
  const fb = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 + Math.PI / 8;
    fb.push({p: [x + Math.cos(t) * r * 0.57, Math.sin(t) * r * 0.57, zc + s * th * 0.8], n: [0, 0, s]});
  }
  g.add(bolts(fb, {M, r: Math.max(0.003, r * 0.055), head: true, mat: 'steel'}));
  return th;
}
// section half sizes of the shells around link k (outer surface), and the side-disc radius of joint J(j+1)
const shellA = (k) => TAIL.width[k] * 0.56;
const shellB = (k) => TAIL.height[k] * 0.56;
const SHELL_T = 0.008;
export const discOf = (j) => TAIL.height[Math.max(1, j)] * 0.37;
// tiles round the section (angles from +z across the top to -z): left flank, top, right flank; seams 0.05 rad
const TILES = [[-0.95, 0.98], [1.03, Math.PI - 1.03], [Math.PI - 0.98, Math.PI + 0.95]];

/** a link body k (1..7) along +x from J(k) at the origin to J(k+1) at x = len; z = the pitch axis */
function linkBody(M, k) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => g.add(part(M, geo, mat, ud));
  const len = LENS[k - 1];
  const a = drumOf(k - 1); // the drum behind (its output flange drives this link)
  const b = drumOf(k); // the drum this link carries at its far end
  const h = TAIL.height[k];
  const w = TAIL.width[k];
  const A = shellA(k);
  const B = shellB(k);
  // output adapter discs bolted to the flange of the drum behind; the spine is keyed to them inside the drum face
  const zf = a.len / 2 + a.len * 0.085 + 0.008;
  for (const s of [1, -1]) add(zcyl(a.r * 0.4, 0.008, 0, 0, s * (zf - 0.004), 32), 'steel');
  // the drum ahead, clamped in the link's far end; axis z (motor / reducer / bearing / encoder inside)
  const act = zActuator({...b, reducer: k < 4 ? 'harmonic' : 'planetary', M, x: len});
  g.add(act);
  // narrow black skeleton spine between the drums (shows only through the seams and from below)
  const x0 = a.r * 0.6;
  const x1 = len - b.r * 0.7;
  if (x1 > x0) add(box(x0 - 0.01, x1 + 0.01, -h * 0.26, h * 0.3, -w * 0.3, w * 0.3, 0.004), 'dark');
  add(box(Math.max(0.01, x0 - 0.02), len - 0.01, -h * 0.34, -h * 0.24, -w * 0.24, w * 0.24, 0.003), 'graphite'); // belly keel
  // white arched shells over the top and both flanks, two plates along the link, three tiles round the section
  const xs0 = k === 1 ? Math.min(0.075, len * 0.4) : 0.012;
  const xs1 = len - 0.012;
  const nP = len > 0.15 ? 2 : 1;
  const gap = 0.005;
  const pl = (xs1 - xs0 - gap * (nP - 1)) / nP;
  const dots = [];
  for (let i = 0; i < nP; i++) {
    const p0 = xs0 + i * (pl + gap);
    // the rear plate of each pair stands 3 mm proud: the overlapping crescent-plate look of the reference
    const o = i === 0 && nP > 1 ? 0.003 : 0;
    for (const [f0, f1] of TILES) {
      const {geo, dots: d} = shellTile(A + o, B + o, SHELL_T, f0, f1, p0, p0 + pl, true);
      add(geo, 'white');
      dots.push(...d);
    }
  }
  // belly plate under the curl (inner side), shorter so the inner side keeps clearance when the joints close up
  const bl0 = xs0 + Math.min(0.02, len * 0.1);
  const bl1 = xs1 - Math.min(0.03, len * 0.15);
  if (bl1 - bl0 > 0.03) {
    const {geo, dots: d} = shellTile(A - 0.004, B - 0.004, SHELL_T, Math.PI + 1.0, 2 * Math.PI - 1.0, bl0, bl1, true);
    add(geo, 'white');
    dots.push(...d);
  }
  // thin orange accent strip along the top seam of every other section (the reference's thin orange stripes)
  if (k % 2 === 0 || k === 7) {
    const sw = 0.006;
    for (const s of [1, -1]) {
      const fz = s > 0 ? 1.0 : Math.PI - 1.0;
      const [u, v] = sePt(A - SHELL_T * 0.5, B - SHELL_T * 0.5, fz);
      add(box(xs0 + 0.006, xs1 - 0.006, v - sw / 2, v + sw / 2, -u - sw / 2, -u + sw / 2, 0.0015), 'orange');
    }
  }
  // crescent knuckle cap over the joint behind (J(k)), concentric with its axis; covers the top gap up to ~50 deg bend
  if (k >= 2) {
    const Ap = shellA(k - 1);
    const Bp = shellB(k - 1);
    const r0 = Bp + 0.004;
    add(knuckleCap(r0, 0.007, (64 * Math.PI) / 180, (156 * Math.PI) / 180, Ap + 0.003), 'white');
    for (const z of [-Ap * 0.6, 0, Ap * 0.6]) {
      const t = (110 * Math.PI) / 180;
      dots.push({p: [Math.cos(t) * (r0 + 0.0072), Math.sin(t) * (r0 + 0.0072), z], n: [Math.cos(t), Math.sin(t), 0]});
    }
  }
  g.add(bolts(dots, {M, r: Math.max(0.0028, h * 0.017)}));
  // the side discs of joint J(k+1) on both flanks, just outside the shells
  const rd = discOf(k);
  for (const s of [1, -1]) sideDisc(add, M, g, rd, len, s * (A + 0.004), s);
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
  // the J1 side discs, outside the cheeks (same language as every other tail joint)
  for (const s of [1, -1]) sideDisc((geo, mat) => add(geo, mat), M, g, discOf(0), 0, s * (zf + 0.009), s);
  return {g, act: p};
}
// stinger blade: cubic centre line in the module frame (x along the module, hooking to local -y, under the curl).
// ~0.425 m along the curve; sized so the blade keeps >= 12 mm over the carapace top (y 0.63 m) at full strike, where
// kin puts J8 at (0.051, 0.89) pitched -44 deg.
const BLADE = [[0.165, 0], [0.36, 0.06], [0.36, 0.02], [0.14, -0.2]];
/** stinger module along +x from J8 at the origin: flange, sensor bay, bulb, detachable tip and the curved blade */
function stingerBody(M) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => g.add(part(M, geo, mat, ud));
  const j8 = drumOf(7);
  const zf = j8.len / 2 + j8.len * 0.085 + 0.007;
  for (const s of [1, -1]) add(lever(0, j8.r * 0.8, 0.05, 0.03, 0.01).translate(0, 0, s * zf), 'graphite');
  add(xcyl(0.036, 0.012, 0.03, 32), 'steel'); // tail-end mounting flange
  const fb = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    fb.push({p: [0.03, Math.cos(t) * 0.028, Math.sin(t) * 0.028], n: [1, 0, 0]});
  }
  g.add(bolts(fb, {M, r: 0.0032, head: true, mat: 'graphite'}));
  // sensor bay: a thick white bulb (as thick as the end section), an orange band, a dark glass window band
  const prof = [[0, 0], [0.046, 0.002], [0.062, 0.025], [0.07, 0.055], [0.068, 0.085], [0.06, 0.11], [0.05, 0.13], [0.042, 0.142], [0, 0.142]];
  add(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 44).rotateZ(-Math.PI / 2).translate(0.026, 0, 0), 'white');
  add(ring(0.0715, 0.05, 0.016, 48).rotateZ(-Math.PI / 2).translate(0.06, 0, 0), 'orange');
  add(ring(0.0705, 0.05, 0.014, 48).rotateZ(-Math.PI / 2).translate(0.1, 0, 0), 'smoke');
  // bolt dots round the bulb shoulder
  const bd = [];
  for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2;
    bd.push({p: [0.122, Math.cos(t) * 0.064, Math.sin(t) * 0.064], n: [0.25, Math.cos(t), Math.sin(t)]});
  }
  g.add(bolts(bd, {M, r: 0.0034}));
  add(xcyl(0.02, 0.04, 0.15, 16), 'copper', {internal: true}); // sensor cartridge (probe / contact detector)
  add(xcyl(0.01, 0.05, 0.19, 10), 'steel', {internal: true}); // tip retaining rod
  // detachable tip: white socket ring (the glowing orange collar is added live, see buildTail)
  add(xcyl(0.046, 0.164, 0.178, 40, 0.04), 'white');
  return g;
}
/** the long glossy black blade: a tube along BLADE tapering from r0 to a point */
function bladeGeo(r0 = 0.04) {
  const P = BLADE.map(([x, y]) => new V3(x, y, 0));
  const path = new THREE.CubicBezierCurve3(...P);
  const N = 48;
  const R = 24;
  const tube = new THREE.TubeGeometry(path, N, 1, R, false);
  const pa = tube.attributes.position;
  const c = new V3();
  for (let i = 0; i < pa.count; i++) {
    const u = Math.floor(i / (R + 1)) / N;
    path.getPoint(u, c);
    const r = r0 * Math.pow(1 - u, 0.7) + 0.0005;
    pa.setXYZ(i, c.x + (pa.getX(i) - c.x) * r, c.y + (pa.getY(i) - c.y) * r, c.z + (pa.getZ(i) - c.z) * r);
  }
  tube.computeVertexNormals();
  return tube;
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
  // live (unbaked) so they keep their own materials: glowing orange collar, glossy black blade
  sting.add(part(M, ring(0.05, 0.034, 0.02, 48).rotateZ(-Math.PI / 2).translate(0.168, 0, 0), 'core'));
  sting.add(part(M, xcyl(0.037, 0.15, 0.17, 32, 0.036), 'smoke'));
  sting.add(part(M, bladeGeo(), 'smoke'));
  yawS.add(sting);
  anchors.tailSec8 = marker(sting, 0.1, 0, 0.06);
  anchors.stingFlange = marker(sting, 0.055, 0, 0.04);
  anchors.stingBay = marker(sting, 0.1, 0, 0.07);
  anchors.stingTip = marker(sting, 0.17, 0, 0.05);
  anchors.sting = marker(sting, BLADE[3][0], BLADE[3][1], 0);
  anchors.tailJ1 = marker(carrier.g, 0, 0, drumOf(0).len / 2 + 0.03);
  anchors.tailMid = anchors.tailJ4;
  // cable carrier: links tucked under the top shells (local +y of the curl), placed per frame along the chain
  const NC = 46;
  const cg = carrierGeo();
  const cim = new THREE.InstancedMesh(cg, M.dark, NC);
  cim.castShadow = cim.receiveShadow = true;
  cim.userData = {mat: 'dark', internal: true};
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
    // the carrier rides just over the drums, under the top shells: offset each chain point along the curl normal
    const path = [];
    for (let k = 0; k <= 7; k++) {
      const a = k === 0 ? T.ang[0] : (T.ang[k - 1] + T.ang[Math.min(7, k)]) / 2;
      const r = Math.min(drumOf(k).r + 0.005, shellB(Math.min(7, k + 1)) - SHELL_T - 0.004);
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