// SCORPION SC-8, the two manipulator claws (spec §4), posed from kin.js clawAt().
// Rigid bodies per claw:
//   base   claw-yaw actuator (vertical axis) on the front-frame flange, below the shoulder point S
//   yoke   turns with the yaw output: base plate + cheek, carries the claw-pitch actuator centred on S (axis level)
//   arm    S -> E: clevis on the pitch output, ribbed armoured link
//   elbow  drum at E, axis normal to the arm / forearm plane
//   fore   E -> W: bigger ribbed link, orange ring band
//   wrist  drum at W, axis normal to the forearm / chela plane
//   chela  the big fixed jaw: a layered white armour shell (10 panel groups over a black skeleton: seams, bolt holes,
//          service hatches, vent slits, two orange accents) with an orange wrist ring, an open drive bay on top
//          (PMSM motor -> planetary 10:1 -> Tr20x4 lead screw -> bronze nut on a guide rail -> push link -> crank pin on
//          the movable finger, single pivot), an exposed black jaw hinge with a steel pivot cap, and long black pincer
//          fingers curving in toward each other with orange serrated grip pads.
//   nut, link, finger  the three moving parts of the drive, placed from the same nut / link / finger relation as
//          kin.js clawDrive(), so the console's numbers and the parts agree.
// Geometry is authored for the LEFT claw in the chela frame (x along kin `d`, y up, z outward); the right claw is a
// mirror (scale.z = -1 on every body), so both share every buffer.
import * as THREE from 'three';
import {actuator, armorPanel, bolts, boltCircle, rbox, ribbedLink, tag} from './parts.js';
import {CLAW, CLAW_DRIVE} from './kin.js';
import {ORDER, UP, baked, cyl, frame, frameY, instance, lever, marker, merge, part, planSlab, ring, xcyl, zActuator, zcyl} from './legs.js';

const V3 = THREE.Vector3;
export const CLAWGEO = {
  yaw: {r: 0.055, len: 0.07}, // base yaw can, centred 0.105 below S (flange top at S.y - 0.14)
  pitch: {r: 0.046, len: 0.09}, // base pitch can, centred on S
  elbow: {r: 0.045, len: 0.088},
  wrist: {r: 0.05, len: 0.1},
  arm: {h: 0.085, w: 0.085},
  fore: {h: 0.1, w: 0.1},
  // the chela: ~0.40 m long (shell + fingers: x 0.06..0.44), ~0.19 m tall (y +-0.095), ~0.18 m across (z +-0.088).
  // The jaw hinge sits near the centreline (z -0.03); the lead screw runs at z = pivot.z + CLAW_DRIVE.offset = +0.05,
  // so the open bay on the outer half shows the screw / nut / link from above.
  pivot: [0.272, -0.03], // movable finger pivot in the chela frame (x, z)
  screwY: 0, // screw axis height; the push link runs above it at linkY
  linkY: 0.026,
  motor: [0.03, 0.075, 0.023], // x0, x1, r
  gear: [0.075, 0.095, 0.021],
  screw: [0.095, 0.215],
};
const C = CLAWGEO;
const D = CLAW_DRIVE;
// the chela (palm + fingers) is the signature scorpion claw: the reference claws are visibly bigger than the kin grip
// envelope, so the whole chela assembly is modelled 20% larger; the arm / forearm stay on the kin skeleton
const CH = 1.2;
const box = (x0, x1, y0, y1, z0, z1, r = 0.004) => rbox(x1 - x0, y1 - y0, z1 - z0, r).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** nut pin u (m, along the screw from the pivot) and link angle for finger opening gap, as kin.js clawDrive */
export function nutU(gap, ch = 1) {
  const px = -D.crank * ch * Math.sin(gap);
  const py = D.crank * ch * Math.cos(gap);
  const dv = py - D.offset * ch;
  const u = px - Math.sqrt((D.link * ch) ** 2 - dv * dv);
  return {u, ang: Math.atan2(dv, px - u)};
}

/**
 * Serrated grip pad outline in the plan plane (x, z): a strip along the cutting edge `edge` (polyline [[x, z], ...])
 * with saw teeth on the jaw-facing side and a plain backing on the other. dir = +1: the edge faces +z; dir = -1: -z.
 */
function serratedPad(edge, {n = 6, depth = 0.012, tooth = 0.004, dir = 1, shift = 0.004} = {}) {
  const at = (u) => {
    const k = Math.min(edge.length - 2, Math.floor(u));
    const t = u - k;
    return [edge[k][0] + (edge[k + 1][0] - edge[k][0]) * t, edge[k][1] + (edge[k + 1][1] - edge[k][1]) * t];
  };
  const out = [];
  const inn = [];
  for (let i = 0; i <= n; i++) {
    const [x, z] = at((i / n) * (edge.length - 1));
    out.push([x, z + dir * (shift + (i % 2 ? 0 : tooth))]);
  }
  for (let i = n; i >= 0; i--) {
    const [x, z] = at((i / n) * (edge.length - 1));
    inn.push([x - tooth * 0.3, z + dir * (shift - depth)]);
  }
  return out.concat(inn);
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
  const zs = pz + D.offset; // screw axis z
  const bx = (x0, x1, y0, y1, z0, z1, r = 0.004, mat = 'dark') => add(box(x0, x1, y0, y1, z0, z1, r), mat);
  const panel = (l, h, w, opts, x, y, z, rot) => {
    const p = armorPanel(l, h, w, {M, mat: 'white', ...opts});
    if (rot) p.rotation.set(rot[0], rot[1], rot[2]);
    p.position.set(x, y, z);
    g.add(p);
    return p;
  };
  // ---- wrist: slimmed dark neck behind a smaller orange ring, so more graphite skeleton shows at the wrist neck
  const fy = C.wrist.len / 2 + 0.012;
  for (const s of [1, -1]) add(lever(0, C.wrist.r * 0.5, 0.07, 0.034, 0.01).rotateX(Math.PI / 2).translate(0, s * fy, 0), 'graphite');
  add(xcyl(0.052, 0.04, 0.078, 28), 'graphite'); // neck: turns with the wrist output into the shell
  add(ring(0.073, 0.059, 0.011, 40).rotateZ(Math.PI / 2).translate(0.056, 0, 0), 'orange'); // orange wrist ring band
  add(ring(0.076, 0.069, 0.007, 40).rotateZ(Math.PI / 2).translate(0.045, 0, 0), 'steel'); // clamp ring behind it
  add(ring(0.057, 0.049, 0.008, 36).rotateZ(Math.PI / 2).translate(0.04, 0, 0), 'dark'); // exposed neck collar
  // ---- white armour: 10 panel groups over the black skeleton, 4 mm seams, black bolt holes, 2 orange accents.
  // the palm is deepened (y ~0.205) and widened (z ~0.187) for a heavy power claw.
  // 1 inner top shell (2 tiles) over the spine, now stopping short of the jaw hinge so the black hinge block reads
  panel(0.19, 0.016, 0.072, {seams: 2, bolts: 3, arch: 0.007, boltR: 0.0038}, 0.173, 0.085, -0.056);
  // thin orange accent on the rear half of the shell
  bx(0.1, 0.156, 0.0995, 0.1035, -0.062, -0.052, 0.002, 'orange');
  // 2 layered top plate (2 tiles) overlapping the front half of the shell
  panel(0.09, 0.012, 0.058, {seams: 2, bolts: 2, arch: 0.004, boltR: 0.0035}, 0.212, 0.0965, -0.05);
  // second thin orange accent on the layered plate
  bx(0.188, 0.236, 0.1025, 0.1055, -0.066, -0.056, 0.002, 'orange');
  // 3 rear shoulder plate over the shell / cowl seam
  panel(0.06, 0.012, 0.05, {seams: 1, bolts: 2, arch: 0.004, boltR: 0.0035}, 0.103, 0.0975, -0.048);
  // 4 inner flank wall (2 tiles)
  panel(0.226, 0.014, 0.182, {seams: 2, bolts: 3, arch: 0.006, boltR: 0.0036}, 0.185, -0.008, -0.0865, [-Math.PI / 2, 0, 0]);
  // 5 belly shell (2 tiles), black bolt holes on the underside
  panel(0.225, 0.014, 0.178, {seams: 2, bolts: 2, arch: 0.005, boltR: 0.0036}, 0.19, -0.095, -0.004, [Math.PI, 0, 0]);
  // 6 outer flank wall under the drive bay (2 tiles, 2 vent slits)
  panel(0.2, 0.014, 0.118, {seams: 2, bolts: 2, arch: 0.004, boltR: 0.0036, vents: {n: 2, len: 0.05, at: [0.35, 0]}}, 0.18, -0.044, 0.0865, [Math.PI / 2, 0, 0]);
  // 7 jaw-side cheek plate closing the front-outer corner
  add(planSlab([[0.272, 0.072], [0.3, 0.072], [0.304, 0.086], [0.276, 0.086]], -0.1, 0.045, 0.008), 'white');
  // 8 chin plate under the jaw nose
  panel(0.055, 0.012, 0.05, {seams: 1, bolts: 2, arch: 0.003, boltR: 0.0034}, 0.318, -0.099, -0.058, [Math.PI, 0, 0]);
  // 9 rear cowl over the wrist end of the bay (with black bolt holes)
  add(planSlab([[0.066, 0.042], [0.088, 0.047], [0.092, 0.08], [0.072, 0.08]], 0.03, 0.072, 0.012), 'white');
  g.add(bolts([{p: [0.07, 0.0725, 0.05]}, {p: [0.092, 0.0725, 0.047]}, {p: [0.066, 0.0725, 0.08]}, {p: [0.096, 0.0725, 0.072]}], {M, r: 0.0038}));
  // 10 front jaw shell: the fixed jaw's white nose, upper and lower plates with a 4 mm seam between them
  add(planSlab([[0.314, -0.0815], [0.338, -0.076], [0.348, -0.064], [0.348, -0.05], [0.338, -0.043], [0.322, -0.046], [0.314, -0.053]], -0.092, -0.006, 0.012), 'white');
  add(planSlab([[0.318, -0.0775], [0.338, -0.072], [0.346, -0.062], [0.344, -0.05], [0.336, -0.045], [0.324, -0.048], [0.318, -0.057]], -0.002, 0.076, 0.014), 'white');
  g.add(bolts([{p: [0.325, 0.0765, -0.062]}, {p: [0.35, 0.0765, -0.054]}, {p: [0.325, 0.0765, -0.044]}, {p: [0.35, 0.0765, -0.038]}], {M, r: 0.0038}));
  // ---- service covers: bolt-on hatch plates on both flanks (reference service access)
  add(box(0.131, 0.179, -0.068, -0.032, 0.0905, 0.094, 0.004), 'white');
  g.add(bolts([{p: [0.138, -0.06, 0.0942]}, {p: [0.172, -0.06, 0.0942]}, {p: [0.138, -0.04, 0.0942]}, {p: [0.172, -0.04, 0.0942]}], {M, r: 0.0026}));
  bx(0.15, 0.16, -0.054, -0.048, 0.094, 0.0952, 0.0012, 'dark'); // latch slot
  add(box(0.11, 0.152, -0.08, -0.048, -0.094, -0.0905, 0.004), 'white');
  g.add(bolts([{p: [0.116, -0.072, -0.0942]}, {p: [0.146, -0.072, -0.0942]}, {p: [0.116, -0.056, -0.0942]}, {p: [0.146, -0.056, -0.0942]}], {M, r: 0.0026}));
  // ---- black skeleton: the bay frame, the slanted ribs over the open bay, the exposed jaw hinge
  bx(0.094, 0.108, -0.062, 0.07, -0.026, 0.078, 0.003); // rear bulkhead (behind the bay)
  bx(0.252, 0.268, -0.062, 0.074, -0.026, 0.078, 0.004); // front bulkhead
  bx(0.108, 0.268, 0.045, 0.065, -0.026, -0.012, 0.003); // inner top rail
  bx(0.108, 0.268, 0.01, 0.055, 0.078, 0.0935, 0.003, 'graphite'); // outer lip (top of the outer flank)
  bx(0.108, 0.268, -0.064, -0.05, -0.026, 0.078, 0.004, 'graphite'); // bay floor
  bx(0.108, 0.268, -0.064, 0.045, -0.028, -0.014, 0.003, 'graphite'); // inner bay wall
  for (const x of [0.165, 0.205, 0.245]) add(new THREE.BoxGeometry(0.008, 0.011, 0.112).rotateX(0.24).translate(x, 0.048, 0.031), 'dark'); // slanted skeleton ribs
  // exposed jaw hinge: black hinge block + steel pivot cap above the white knuckle (the shell stops short of it)
  bx(0.25, 0.288, 0.072, 0.081, -0.058, 0.02, 0.01); // hinge plate
  add(cyl(0.021, 0.008, 28).translate(px, 0.0855, pz), 'graphite'); // bearing boss
  add(cyl(0.01, 0.01, 20).translate(px, 0.0925, pz), 'steel'); // pivot pin cap
  g.add(bolts(boltCircle(0.016, 6, 0.0825, 0.3), {M, r: 0.0028, head: true, mat: 'steel'}));
  bx(0.268, 0.308, -0.056, 0.022, -0.072, 0.052, 0.004); // pivot bracket under the knuckle
  // pivot pin with big bosses through the knuckle
  add(cyl(0.011, 0.14, 20).translate(px, 0, pz), 'steel');
  for (const s of [1, -1]) add(cyl(0.029, 0.012, 28).translate(px, s * 0.055, pz), 'graphite');
  for (const s of [1, -1]) bx(px - 0.052, px + 0.03, s * 0.049 - 0.007, s * 0.049 + 0.007, pz - 0.046, pz + 0.03, 0.003, 'graphite');
  // ---- the fixed fingertip: long black fang curving in toward the movable finger, sharp 3-D tip, orange serrated pad
  add(planSlab([[0.3, -0.082], [0.34, -0.076], [0.38, -0.062], [0.404, -0.044], [0.412, -0.03], [0.408, -0.014], [0.39, -0.018], [0.36, -0.03], [0.32, -0.048], [0.3, -0.054]], -0.036, 0.036, 0.008), 'dark');
  add(planSlab([[0.378, -0.028], [0.42, -0.016], [0.452, -0.006], [0.446, 0.0], [0.416, -0.008], [0.378, -0.02]], -0.011, 0.011, 0.002), 'dark');
  add(planSlab(serratedPad([[0.3, -0.054], [0.34, -0.046], [0.38, -0.028], [0.412, -0.01], [0.432, 0.002]], {n: 9, depth: 0.011, tooth: 0.004, dir: 1, shift: 0.004}), -0.015, 0.015, 0.003), 'orange');
  // ---- drive: motor, planetary, coupling, bearing blocks, screw, guide rail (screw / rail are static parts)
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
  add(cyl(0.024, 0.04, 28), 'steel'); // hub ring on the pivot
  // movable jaw: long black sickle whose sharp tip arcs in toward the fixed fang, orange serrated grip pad along the
  // facing inner edge, white knuckle shell kept low over the root so the black hinge block reads above it
  const blade = [[-0.02, 0.052], [0.04, 0.047], [0.1, 0.041], [0.15, 0.036], [0.18, 0.033], [0.186, 0.026], [0.18, 0.018], [0.15, 0.012], [0.1, 0.006], [0.05, -0.004], [-0.02, -0.012]];
  add(planSlab(blade, -0.032, 0.032, 0.008), 'dark');
  add(planSlab([[0.15, 0.03], [0.186, 0.029], [0.202, 0.026], [0.194, 0.021], [0.15, 0.015]], -0.011, 0.011, 0.002), 'dark'); // sharp sickle tip
  add(planSlab([[-0.02, -0.026], [0.06, -0.03], [0.088, 0.018], [0.07, 0.062], [0.02, 0.074], [-0.02, 0.062]], 0.006, 0.07, 0.012), 'white');
  add(planSlab(serratedPad([[0.05, -0.004], [0.1, 0.006], [0.15, 0.012], [0.19, 0.019]], {n: 8, depth: 0.011, tooth: 0.004, dir: -1, shift: 0.004}), -0.014, 0.014, 0.003), 'orange');
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
    // the chela shell + fingers + drive mechanism are scaled together so they stay mechanically coherent
    for (const k of ['chela', 'nut', 'link', 'finger']) B[k].scale.setScalar(CH);
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
    anchors[`clawTip${s}`] = marker(B.finger, 0.2, 0, 0.02);
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
      const px = C.pivot[0] * CH;
      const pz = C.pivot[1] * CH;
      const gap = P.gap;
      const {u, ang} = nutU(gap, CH);
      for (const k of ['nut', 'link', 'finger']) {
        B[k].position.copy(B.chela.position);
        B[k].quaternion.copy(B.chela.quaternion);
      }
      const q = B.chela.quaternion;
      const off = (x, y, z) => new V3(x, y, z).applyQuaternion(q).add(W);
      B.finger.position.copy(off(px, 0, pz));
      B.finger.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(UP, -gap));
      B.nut.position.copy(off(px + u, C.linkY * CH, pz + D.offset * CH));
      B.link.position.copy(B.nut.position);
      B.link.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(UP, -ang));
    });
    group.updateMatrixWorld(true);
  }
  return {group, update, anchors, assemblies, joints};
}
