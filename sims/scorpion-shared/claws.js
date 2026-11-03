// SCORPION SC-8, the two manipulator claws (spec §4), posed from kin.js clawAt().
// Rigid bodies per claw:
//   base   claw-yaw actuator (vertical axis) on the front-frame flange, below the shoulder point S
//   yoke   turns with the yaw output: base plate + cheek, carries the claw-pitch actuator centred on S (axis level)
//   arm    S -> E: clevis on the pitch output, ribbed armoured link
//   elbow  drum at E, axis normal to the arm / forearm plane
//   fore   E -> W: bigger ribbed link, orange ring band
//   wrist  drum at W, axis normal to the forearm / chela plane
//   chela  big white fixed jaw body with a black inner skeleton and an open drive bay on the outer side:
//          PMSM motor -> planetary 10:1 -> Tr20x4 lead screw -> bronze nut on a guide rail -> push link -> crank pin
//          on the movable finger (single pivot). Fixed finger and movable finger: black tips, orange serrated pads.
//   nut, link, finger  the three moving parts of the drive, placed from the same nut / link / finger relation as
//          kin.js clawDrive(), so the console's numbers and the parts agree.
// Geometry is authored for the LEFT claw in the chela frame (x along kin `d`, y up, z outward); the right claw is a
// mirror (scale.z = -1 on every body), so both share every buffer.
import * as THREE from 'three';
import {actuator, armorPanel, bolts, boltCircle, rbox, ribbedLink, tag} from './parts.js';
import {CLAW, CLAW_DRIVE} from './kin.js';
import {ORDER, UP, baked, cyl, frame, frameY, instance, lever, marker, merge, part, planSlab, xcyl, zActuator, zcyl} from './legs.js';

const V3 = THREE.Vector3;
export const CLAWGEO = {
  yaw: {r: 0.055, len: 0.07}, // base yaw can, centred 0.105 below S (flange top at S.y - 0.14)
  pitch: {r: 0.046, len: 0.09}, // base pitch can, centred on S
  elbow: {r: 0.045, len: 0.088},
  wrist: {r: 0.05, len: 0.1},
  arm: {h: 0.085, w: 0.085},
  fore: {h: 0.1, w: 0.1},
  pivot: [0.28, -0.005], // movable finger pivot in the chela frame (x, z)
  screwY: 0, // screw axis height; the push link runs above it at linkY
  linkY: 0.026,
  motor: [0.03, 0.075, 0.023], // x0, x1, r
  gear: [0.075, 0.095, 0.021],
  screw: [0.095, 0.215],
};
const C = CLAWGEO;
const D = CLAW_DRIVE;
const box = (x0, x1, y0, y1, z0, z1, r = 0.004) => rbox(x1 - x0, y1 - y0, z1 - z0, r).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** nut pin u (m, along the screw from the pivot) and link angle for finger opening gap, as kin.js clawDrive */
export function nutU(gap) {
  const px = -D.crank * Math.sin(gap);
  const py = D.crank * Math.cos(gap);
  const dv = py - D.offset;
  const u = px - Math.sqrt(D.link * D.link - dv * dv);
  return {u, ang: Math.atan2(dv, px - u)};
}

// ------------------------------------------------------------ chela templates (chela frame, left claw)
function chelaBody(M) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => {
    const m = part(M, geo, mat, ud);
    g.add(m);
    return m;
  };
  const [px, pz] = C.pivot;
  const zs = pz + D.offset; // screw axis
  // wrist fork: top and bottom plates clasping the wrist drum
  const fy = C.wrist.len / 2 + 0.012;
  for (const s of [1, -1]) add(lever(0, C.wrist.r * 0.5, 0.07, 0.034, 0.01).rotateX(Math.PI / 2).translate(0, s * fy, 0), 'graphite');
  // the palm (sheet: a deep bulbous chela, ~0.4 m tall, ~0.45 m across in plan). Inner half: a big white block
  // with heavily rounded edges; below the drive bay a deep white belly; outer side a white wall. The drive bay
  // between them stays open from above (graphite skeleton ribs across it) so the lead-screw drive reads.
  const inner = [[0.07, -0.035], [0.09, -0.13], [0.15, -0.195], [0.23, -0.205], [0.29, -0.165], [0.325, -0.09], [0.32, -0.04], [0.3, -0.026], [0.07, -0.026]];
  add(planSlab(inner, -0.19, 0.19, 0.05), 'white');
  const belly = [[0.07, -0.03], [0.06, 0.08], [0.1, 0.19], [0.17, 0.235], [0.23, 0.22], [0.255, 0.15], [0.262, 0.05], [0.262, -0.03]];
  add(planSlab(belly, -0.2, -0.05, 0.045), 'white');
  add(planSlab([[0.09, 0.15], [0.13, 0.205], [0.2, 0.235], [0.25, 0.2], [0.255, 0.15], [0.2, 0.14], [0.12, 0.138]], -0.07, 0.15, 0.03), 'white');
  // dark seam bands between the shells (the reference's black inner skeleton showing at the joints)
  add(planSlab([[0.075, -0.03], [0.07, 0.06], [0.1, 0.17], [0.13, 0.14], [0.11, 0.06], [0.11, -0.03]], -0.06, -0.045, 0.004), 'dark');
  add(box(0.08, 0.26, -0.052, 0.052, -0.034, -0.022, 0.003), 'dark');
  // black inner skeleton over the open drive bay (z -0.026..0.138, y -0.05..0.15): top rails + cross ribs + posts
  add(box(0.08, 0.29, 0.13, 0.146, 0.12, 0.138, 0.003), 'dark'); // outer top rail
  add(box(0.08, 0.29, 0.13, 0.146, -0.03, -0.012, 0.003), 'dark'); // inner top rail
  for (const x of [0.13, 0.21]) add(box(x - 0.008, x + 0.008, 0.13, 0.146, -0.03, 0.138, 0.003), 'dark'); // cross ribs
  add(box(0.075, 0.092, -0.05, 0.146, -0.03, 0.138, 0.003), 'dark'); // rear bulkhead (motor mount side)
  // dark collar band at the wrist end of the palm
  add(box(0.06, 0.08, -0.2, 0.19, -0.15, 0.2, 0.006), 'dark');
  add(planSlab([[0.13, -0.15], [0.25, -0.15], [0.25, -0.138], [0.13, -0.138]], 0.186, 0.194, 0.002), 'steel');
  // bolt holes on the palm top and the outer wall
  const bl = [];
  for (const [x, z] of [[0.11, -0.06], [0.12, -0.12], [0.18, -0.165], [0.25, -0.16], [0.29, -0.1], [0.27, -0.05], [0.18, -0.05]]) bl.push({p: [x, 0.19, z]});
  for (const [x, z] of [[0.14, 0.19], [0.2, 0.21]]) bl.push({p: [x, 0.15, z]});
  g.add(bolts(bl, {M, r: 0.006}));
  // pivot pin with big bosses through the knuckle
  add(cyl(0.012, 0.21, 20).translate(px, 0, pz), 'steel');
  for (const s of [1, -1]) add(cyl(0.03, 0.014, 28).translate(px, s * 0.1, pz), 'graphite');
  for (const s of [1, -1]) add(box(px - 0.05, px + 0.012, s * 0.1 - 0.007, s * 0.1 + 0.007, pz - 0.04, pz + 0.024), 'graphite');
  // fixed finger: white root, black tip, rubber serrated grip pad
  const ff = [[0.3, -0.175], [0.36, -0.15], [0.41, -0.1], [0.446, -0.036], [0.44, -0.023], [0.36, -0.026], [0.3, -0.03]];
  add(planSlab(ff, -0.055, 0.055, 0.02), 'dark');
  add(planSlab([[0.29, -0.2], [0.345, -0.17], [0.355, -0.03], [0.29, -0.03]], -0.11, 0.11, 0.035), 'white');
  for (let i = 0; i < 7; i++) {
    const x = 0.355 + i * 0.012;
    add(box(x - 0.004, x + 0.004, -0.036, 0.036, -0.031, -0.021, 0.0015), 'rubber');
  }
  // drive: motor, planetary, coupling, bearing blocks, screw, guide rail (screw / rail are static parts)
  const [m0, m1, mr] = C.motor;
  const yz = (geo) => geo.translate(0, C.screwY, zs);
  add(yz(xcyl(mr, m0, m1, 28)), 'dark');
  add(yz(xcyl(mr * 1.08, m1 - 0.016, m1 - 0.006, 28)), 'steel');
  add(yz(xcyl(mr * 0.4, m0 - 0.008, m0, 16)), 'graphite'); // encoder cap
  add(yz(xcyl(C.gear[2], C.gear[0], C.gear[1], 28)), 'steel');
  add(yz(xcyl(0.012, C.gear[1], C.gear[1] + 0.008, 20)), 'alu');
  add(box(C.screw[0], C.screw[0] + 0.008, -0.044, 0.016, zs - 0.022, zs + 0.022), 'graphite'); // rear bearing block
  add(box(C.screw[1] - 0.004, C.screw[1] + 0.01, -0.044, 0.012, zs - 0.02, zs + 0.02), 'graphite'); // front bearing block
  add(yz(xcyl(0.0085, C.screw[0], C.screw[1] + 0.004, 16)), 'steel');
  const thr = [];
  for (let x = C.screw[0] + 0.01; x < C.screw[1] - 0.004; x += 0.004) thr.push(new THREE.TorusGeometry(0.0095, 0.0016, 4, 16).rotateY(Math.PI / 2).rotateZ(0.06).translate(x, C.screwY, zs));
  add(merge(thr), 'steel');
  add(box(C.screw[0] + 0.008, C.screw[1] - 0.004, -0.046, -0.036, zs - 0.014, zs + 0.014, 0.002), 'steel'); // guide rail
  // motor internals (internal:true): stator, rotor, planet gears
  add(yz(xcyl(mr * 0.85, m0 + 0.008, m1 - 0.01, 20)), 'copper', {internal: true});
  add(yz(xcyl(mr * 0.5, m0 + 0.006, m1 - 0.006, 16)), 'steel', {internal: true});
  return g;
}

/** the bronze nut, frame: origin on the nut pin (top lug), x along the screw */
function nutPart(M) {
  const g = new THREE.Group();
  const yS = C.screwY - C.linkY;
  g.add(part(M, rbox(0.036, 0.034, 0.036, 0.004).translate(0, yS, 0), 'copper'));
  g.add(part(M, rbox(0.03, 0.012, 0.03, 0.002).translate(0, yS - 0.03, 0), 'steel')); // carriage on the rail
  g.add(part(M, rbox(0.022, 0.016, 0.024, 0.003).translate(0, -0.008, 0), 'copper')); // pin lug
  g.add(part(M, zcyl(0.006, 0.03, 0, 0, 0, 12).rotateX(Math.PI / 2), 'steel')); // pin (vertical)
  return g;
}
/** the push link, frame: origin on the nut pin, x toward the crank pin */
function linkPart(M) {
  const g = new THREE.Group();
  g.add(part(M, lever(0, 0.012, D.link, 0.012, 0.01).rotateX(Math.PI / 2), 'graphite'));
  g.add(part(M, cyl(0.007, 0.022, 12).translate(D.link, 0, 0), 'steel'));
  return g;
}
/** the movable finger, frame: origin on the pivot, x along the closed finger, rotates about y by -gap */
function fingerPart(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => g.add(part(M, geo, mat));
  // crank plate from the pivot to the crank pin (on the drive side, at the link height)
  add(lever(0, 0.022, D.crank, 0.014, 0.012).rotateX(Math.PI / 2).rotateY(-Math.PI / 2).translate(0, C.linkY, 0), 'graphite');
  add(cyl(0.024, 0.04, 28).translate(0, 0, 0), 'steel'); // hub ring on the pivot
  // blade: white root shell, black tip
  // the movable finger is as deep as the fixed one: a curved black blade, a big white root shell over the knuckle
  const blade = [[-0.02, -0.012], [0.04, -0.016], [0.12, -0.014], [0.165, -0.022], [0.158, -0.004], [0.12, 0.05], [0.06, 0.1], [-0.02, 0.12]];
  add(planSlab(blade, -0.05, 0.05, 0.018), 'dark');
  add(planSlab([[-0.012, -0.016], [0.075, -0.019], [0.085, 0.1], [0.03, 0.14], [-0.012, 0.12]], -0.105, 0.105, 0.035), 'white');
  for (let i = 0; i < 6; i++) {
    const x = 0.085 + i * 0.012;
    add(rbox(0.008, 0.07, 0.01, 0.0015).translate(x, 0, -0.016 - i * 0.0004), 'rubber');
  }
  return g;
}

// ------------------------------------------------------------ arm templates
const fy = (a) => a.len / 2 + a.len * 0.085 + 0.012;
/** static base: yaw can on the front-frame flange. Frame: origin at S, world axes. */
function mountPart(M, feature) {
  const g = new THREE.Group();
  const yaw = actuator({...C.yaw, reducer: 'harmonic', cutPhi: 0, M});
  yaw.position.y = -0.105;
  g.add(yaw);
  g.add(part(M, cyl(C.yaw.r * 1.12, 0.008, 40).translate(0, -0.105 - C.yaw.len / 2 + 0.004, 0), 'steel')); // clamp ring
  g.add(bolts(boltCircle(C.yaw.r * 1.02, 8, -0.105 - C.yaw.len / 2 + 0.008, 0.2), {M, r: 0.004, head: true, mat: 'steel'}));
  return {root: g, feat: feature ? yaw : null};
}
/** yoke on the yaw output: plate + saddle, the pitch can centred on S (axis z). Frame: origin S, x heading. */
function yokePart(M, feature) {
  const g = new THREE.Group();
  const top = -0.105 + C.yaw.len / 2 + C.yaw.len * 0.085 + 0.006;
  g.add(part(M, lever(-0.02, C.yaw.r * 0.95, 0.03, 0.04, 0.012).rotateX(Math.PI / 2).translate(0, top, 0), 'graphite'));
  g.add(part(M, box(-0.04, 0.04, top, -C.pitch.r * 0.7, -0.034, 0.034), 'graphite'));
  g.add(part(M, box(-0.046, -0.03, top, 0.02, -0.03, 0.03, 0.003), 'steel')); // pitch hard stop
  g.add(bolts(boltCircle(0.034, 6, top + 0.006, 0.3), {M, r: 0.004, head: true, mat: 'steel'}));
  const p = zActuator({...C.pitch, reducer: 'harmonic', M});
  g.add(p);
  g.add(part(M, zcyl(0.02, 0.014, 0, 0, -(C.pitch.len / 2 + 0.006), 24), 'steel'));
  return {root: g, feat: feature ? p : null};
}
/** fork + ribbed armoured link from a joint at the origin to x = len; frame z = the root joint axis */
function linkBody(M, len, sz, rootAct, endR, stripe) {
  const g = new THREE.Group();
  const {h, w} = sz;
  const zf = rootAct.len / 2 + rootAct.len * 0.085 + 0.007;
  for (const s of [1, -1]) g.add(part(M, lever(0, rootAct.r * 0.5, 0.085, h * 0.38, 0.01).translate(0, 0, s * zf), 'graphite'));
  g.add(part(M, box(0.074, 0.095, -h * 0.4, h * 0.4, -zf, zf), 'graphite'));
  const x0 = 0.095;
  const x1 = len - endR * 0.7;
  const link = ribbedLink(x1 - x0, h, w, {M, mat: 'white', stripe});
  link.position.x = x0;
  g.add(link);
  const pan = armorPanel(x1 - x0 - 0.02, 0.012, w * 0.9, {M, mat: 'white', seams: 2, bolts: true, arch: 0.004});
  pan.position.set((x0 + x1) / 2, h / 2 + 0.004, 0);
  g.add(pan);
  return g;
}
/** arm: S -> E, frame origin S, z = pitch axis; the elbow can is part of the forearm */
const armPart = (M) => linkBody(M, CLAW.arm, C.arm, C.pitch, C.elbow.r, false);
/** forearm: E -> W, frame origin E, y up-ish; carries the elbow can (axis y at its origin) and the wrist can at W */
function forePart(M) {
  const g = new THREE.Group();
  const el = actuator({...C.elbow, reducer: 'harmonic', M});
  g.add(el);
  const x0 = C.elbow.r * 0.7;
  const x1 = CLAW.fore - C.wrist.r * 0.7;
  const link = ribbedLink(x1 - x0, C.fore.h, C.fore.w, {M, mat: 'white'});
  link.position.x = x0;
  g.add(link);
  const pan = armorPanel(x1 - x0 - 0.02, 0.014, C.fore.w * 0.92, {M, mat: 'white', seams: 2, bolts: true, vents: {n: 4, len: 0.05, at: [-0.4, 0]}, arch: 0.005});
  pan.position.set((x0 + x1) / 2, C.fore.h / 2 + 0.005, 0);
  g.add(pan);
  g.add(part(M, box(x1 - 0.04, x1 - 0.02, -C.fore.h / 2 - 0.006, C.fore.h / 2 + 0.012, -C.fore.w / 2 - 0.006, C.fore.w / 2 + 0.006, 0.004), 'graphite')); // ring band
  const wr = actuator({...C.wrist, reducer: 'planetary', M});
  wr.position.x = CLAW.fore;
  g.add(wr);
  return g;
}

// ------------------------------------------------------------ the builder
/**
 * buildClaws(M) -> {group, update(kinClaws, pose), anchors, assemblies: {clawL, clawR}, joints: {clawL, clawLYaw}}
 *   kinClaws = {L: clawAt(1, open, reach), R: clawAt(-1, open, reach)}; the group lives in the torso frame.
 *   anchors: clawL (base pitch can), clawTip (movable finger tip), clawScrew (lead screw middle), clawNut, clawMotor,
 *   clawPivot, clawLink, clawElbowL, clawWristL, plus clawR / clawTipR.
 */
export function buildClaws(M) {
  const group = new THREE.Group();
  group.name = 'claws';
  const assemblies = {};
  const anchors = {};
  const joints = {};
  const T = {
    mount: baked('claw.mount', () => mountPart(M).root),
    yoke: baked('claw.yoke', () => yokePart(M).root),
    arm: baked('claw.arm', () => armPart(M)),
    fore: baked('claw.fore', () => forePart(M)),
    chela: baked('claw.chela', () => chelaBody(M)),
    nut: baked('claw.nut', () => nutPart(M)),
    link: baked('claw.link', () => linkPart(M)),
    finger: baked('claw.finger', () => fingerPart(M)),
  };
  const claws = [1, -1].map((side) => {
    const sys = side > 0 ? 'clawL' : 'clawR';
    const A = new THREE.Group(); // the assembly (explode offset goes here)
    A.name = sys;
    const R = new THREE.Group(); // mirror for the right claw: every body is posed as a left claw
    R.scale.z = side;
    A.add(R);
    const B = {};
    for (const k of Object.keys(T)) {
      B[k] = new THREE.Group();
      B[k].name = `${sys}.${k}`;
      R.add(B[k]);
    }
    if (side > 0) {
      const mo = mountPart(M, true);
      const yo = yokePart(M, true);
      B.mount.add(mo.root);
      B.yoke.add(yo.root);
      joints.clawLYaw = mo.feat;
      joints.clawL = yo.feat;
      for (const k of ['arm', 'fore', 'chela', 'nut', 'link', 'finger']) instance(M, T[k], B[k]);
    } else for (const k in T) instance(M, T[k], B[k]);
    const s = side > 0 ? '' : 'R';
    const [px, pz] = C.pivot;
    anchors[side > 0 ? 'clawL' : 'clawR'] = marker(B.yoke, 0, 0, 0.06);
    anchors[`clawTip${s}`] = marker(B.finger, 0.16, 0, 0);
    anchors[`clawScrew${s}`] = marker(B.chela, (C.screw[0] + C.screw[1]) / 2, C.screwY, pz + D.offset);
    anchors[`clawMotor${s}`] = marker(B.chela, (C.motor[0] + C.motor[1]) / 2, 0, pz + D.offset);
    anchors[`clawPivot${s}`] = marker(B.chela, px, 0.06, pz);
    anchors[`clawNut${s}`] = marker(B.nut, 0, 0, 0);
    anchors[`clawLink${s}`] = marker(B.link, D.link / 2, 0, 0);
    anchors[`clawElbow${s || 'L'}`] = marker(B.fore, 0, 0, 0);
    anchors[`clawWrist${s || 'L'}`] = marker(B.fore, CLAW.fore, 0, 0);
    tag(A, {sys, order: ORDER.claw, explode: [0.42, 0.06, 0.3 * side], cut: false});
    group.add(A);
    assemblies[sys] = A;
    return {side, B};
  });

  const v = (p, side) => new V3(p[0], p[1], p[2] * side);
  const h = new V3();
  const n = new V3();
  const dd = new V3();
  const tmp = new V3();
  /** kinClaws: {L, R} clawAt() results (or [L, R]) */
  function update(kinClaws) {
    const list = Array.isArray(kinClaws) ? kinClaws : [kinClaws.L, kinClaws.R];
    claws.forEach(({side, B}, i) => {
      const P = list[i];
      if (!P) return;
      // posed as a left claw: mirror z of the right claw's points
      const S = v(P.S, side);
      const E = v(P.E, side);
      const W = v(P.W, side);
      const yaw = P.yaw * side;
      h.set(Math.cos(yaw), 0, Math.sin(yaw));
      n.set(-Math.sin(yaw), 0, Math.cos(yaw));
      B.mount.position.copy(S);
      frame(B.yoke, S, h, n);
      frame(B.arm, S, tmp.subVectors(E, S), n);
      frameY(B.fore, E, tmp.subVectors(W, E), UP);
      dd.set(P.d[0], P.d[1], P.d[2] * side);
      frameY(B.chela, W, dd, UP);
      // drive: finger about the pivot, nut on the screw, link between them (chela frame -> parented poses)
      const [px, pz] = C.pivot;
      const gap = P.gap;
      const {u, ang} = nutU(gap);
      for (const k of ['nut', 'link', 'finger']) {
        B[k].position.copy(B.chela.position);
        B[k].quaternion.copy(B.chela.quaternion);
      }
      const q = B.chela.quaternion;
      const off = (x, y, z) => new V3(x, y, z).applyQuaternion(q).add(W);
      B.finger.position.copy(off(px, 0, pz));
      B.finger.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(UP, -gap));
      B.nut.position.copy(off(px + u, C.linkY, pz + D.offset));
      B.link.position.copy(B.nut.position);
      B.link.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(UP, -ang));
    });
    group.updateMatrixWorld(true);
  }
  return {group, update, anchors, assemblies, joints};
}