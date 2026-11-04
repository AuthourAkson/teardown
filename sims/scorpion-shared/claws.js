// SCORPION SC-8, the two manipulator claws (spec §4), posed from kin.js clawAt().
// Rigid bodies per claw:
//   base   claw-yaw actuator (vertical axis) on the front-frame flange, below the shoulder point S
//   yoke   turns with the yaw output: base plate + cheek, carries the claw-pitch actuator centred on S (axis level)
//   arm    S -> E: clevis on the pitch output, fork bridge, sculpted ivory shell over a graphite core
//   elbow  drum at E, axis normal to the arm / forearm plane, broad orange band
//   fore   E -> W: sculpted ivory shell between the elbow and wrist drums
//   wrist  drum at W, axis normal to the forearm / chela plane
//   chela  a big bulbous ivory palm (three panels, dark grooves) with a glass window in a smoke bezel over the drive
//          (PMSM motor -> planetary 10:1 -> Tr20x4 lead screw -> bronze nut on a guide rail -> push link -> crank pin on
//          the movable finger, single pivot), a gear train inside, a black hinge drum with an orange band at the pivot,
//          a graphite jaw collar and a long curved black fixed finger with an orange serrated grip.
//   nut, link, finger  the three moving parts of the drive, placed from the same nut / link / finger relation as
//          kin.js clawDrive(), so the console's numbers and the parts agree.
// Geometry is authored for the LEFT claw in the chela frame (x along kin `d`, y up, z outward); the right claw is a
// mirror (scale.z = -1 on every body), so both share every buffer.
import * as THREE from 'three';
import {actuator, bolts, boltCircle, rbox, tag} from './parts.js';
import {CLAW, CLAW_DRIVE} from './kin.js';
import {ORDER, UP, baked, cyl, frame, frameY, instance, lever, marker, merge, part, xcyl, zActuator, zcyl} from './legs.js';

const V3 = THREE.Vector3;
export const CLAWGEO = {
  yaw: {r: 0.055, len: 0.07}, // base yaw can, centred 0.105 below S (flange top at S.y - 0.14)
  pitch: {r: 0.046, len: 0.09}, // base pitch can, centred on S
  elbow: {r: 0.045, len: 0.088},
  wrist: {r: 0.05, len: 0.1},
  arm: {h: 0.104, w: 0.09}, // sculpted ivory limb shells, peak section (height y, width z)
  fore: {h: 0.106, w: 0.094},
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
// envelope, so the whole chela assembly is modelled 10% larger; the arm / forearm stay on the kin skeleton
// (1.2 with the 0.25 m forearm put the closed tip at x 1474 mm, 67 mm past the 2180 length)
const CH = 1.2; // v9: large, threatening chelae
const box = (x0, x1, y0, y1, z0, z1, r = 0.004) => rbox(x1 - x0, y1 - y0, z1 - z0, r).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** nut pin u (m, along the screw from the pivot) and link angle for finger opening gap, as kin.js clawDrive */
export function nutU(gap, ch = 1) {
  const px = -D.crank * ch * Math.sin(gap);
  const py = D.crank * ch * Math.cos(gap);
  const dv = py - D.offset * ch;
  const u = px - Math.sqrt((D.link * ch) ** 2 - dv * dv);
  return {u, ang: Math.atan2(dv, px - u)};
}

// ------------------------------------------------------------ shell kit: soft superellipse shells (v9 look)
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** a section profile along x from stations [[x, halfHeight, halfWidth], ...] (cosine blend), exponent n */
function stations(P, n = 2.6) {
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
/** superellipse section point [y, z] at angle phi (0 = +y top, 90 deg = +z outer), scale k */
function sePt(s, phi, k = 1) {
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  const e = 2 / s.n;
  return [s.h * k * Math.sign(c) * Math.abs(c) ** e, s.w * k * Math.sign(sn) * Math.abs(sn) ** e];
}
/** a smooth shell piece over x0..x1, phi0..phi0+phiL of the section S(x), scale k. Indexed, smooth normals. */
function seShell(S, x0, x1, phi0, phiL, k = 1, nx = 14, nphi = 40) {
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
      // (i,j) -> (i,j+1) -> (i+1,j) faces outward (x cross phi-tangent points inward)
      idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
/** a flat end cap (fan) of the section at x, facing +x (front) or -x */
function seCap(S, x, k = 1, front = true, n = 40) {
  const s = S(x);
  const pos = [x, 0, 0];
  const idx = [];
  for (let j = 0; j <= n; j++) {
    const [y, z] = sePt(s, Math.PI + (TAU * j) / n, k);
    pos.push(x, y, z);
  }
  for (let j = 1; j <= n; j++) front ? idx.push(0, j + 1, j) : idx.push(0, j, j + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
/** a bolt dot on the shell surface at (x, phi) */
function seDot(S, x, phi, k = 1, r = 0.0038) {
  const s = S(x);
  const [y, z] = sePt(s, phi, k);
  const [y1, z1] = sePt(s, phi + 0.002, k);
  const n = new V3(0, z1 - z, -(y1 - y)).normalize();
  return {p: [x, y + n.y * 0.0004, z + n.z * 0.0004], n: n.toArray(), r};
}
/** a lathed band about +y (orange joint ring); axis set by the caller */
const band = (rO, rI, h, seg = 40, phi0 = 0, phiL = TAU) => {
  const c = Math.min(h * 0.18, (rO - rI) * 0.3);
  const p = [[rI, -h / 2], [rO - c, -h / 2], [rO, -h / 2 + c], [rO, h / 2 - c], [rO - c, h / 2], [rI, h / 2], [rI, -h / 2]];
  return new THREE.LatheGeometry(p.map(([u, w]) => new THREE.Vector2(u, w)), seg, phi0, phiL);
};
/**
 * a tapered curved finger: an elliptical tube swept along the plan curve pts [[x, z], ...] (y = 0), radius
 * rad(t) (t 0..1 root -> tip), height = rad * sy. Returns {geo, at(t) -> {p, n, r}} (n = the +side normal in plan).
 */
function taperTube(pts, rad, sy = 1.2, n = 28, seg = 16) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new V3(x, 0, z)), false, 'centripetal');
  const pos = [];
  const idx = [];
  const at = (t) => {
    const p = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    return {p, n: new V3(-T.z, 0, T.x).normalize(), r: rad(t)};
  };
  for (let i = 0; i <= n; i++) {
    const {p, n: N, r} = at(i / n);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU;
      pos.push(p.x + N.x * Math.cos(a) * r, p.y + Math.sin(a) * r * sy, p.z + N.z * Math.cos(a) * r);
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j;
      const b = i * seg + ((j + 1) % seg);
      idx.push(a, a + seg, b, b, a + seg, b + seg);
    }
  // root cap (the tip ring is already a near point)
  const c0 = pos.length / 3;
  const P0 = at(0).p;
  pos.push(P0.x, P0.y, P0.z);
  for (let j = 0; j < seg; j++) idx.push(c0, j, (j + 1) % seg);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return {geo, at};
}
/** orange serrated grip pad along a finger's inner edge (side = +1 / -1 of the tube's plan normal): strip + teeth */
function gripPad(F, side, t0, t1, n = 9) {
  const strip = [];
  const teeth = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const {p, n: N, r} = F.at(t);
    const e = p.clone().addScaledVector(N, side * r * 0.86);
    strip.push(new THREE.SphereGeometry(1, 10, 6).scale(0.011, r * 0.55, 0.0045).translate(e.x, e.y, e.z));
    if (i < n) {
      const tooth = new THREE.ConeGeometry(0.0048, 0.009, 3).scale(1, 1, 2.2).rotateZ(-Math.PI / 2); // flat saw tooth, points +x
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), N.clone().multiplyScalar(side));
      const tp = e.clone().addScaledVector(N, side * 0.004);
      teeth.push(tooth.applyQuaternion(q).translate(tp.x, tp.y, tp.z));
    }
  }
  return merge(strip.concat(teeth));
}
/** a spur gear, axis z, centred on (x, y, z) */
function spurGear(r, teeth, t, x, y, z) {
  const s = new THREE.Shape();
  const ri = r * 0.86;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * TAU;
    const a1 = ((i + 1) / (teeth * 2)) * TAU;
    const rr = i % 2 ? ri : r;
    if (i === 0) s.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    else s.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    s.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.25, 0, TAU, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, {depth: t, bevelEnabled: false, curveSegments: 4}).translate(x, y, z - t / 2);
}

// ------------------------------------------------------------ chela templates (chela frame, left claw)
// v9 chela: a big bulbous ivory palm (soft superellipse section, swelling to 0.21 x 0.24 m after CH), three shell
// panels split by thin dark grooves over a graphite liner, a glass window with a smoke bezel on the top-outer
// quarter over the lead-screw drive, a graphite jaw collar, a black hinge drum with an orange band at the finger
// pivot, and two long curved black fingers with orange serrated grips.
const PALM = stations([[0.012, 0.046, 0.05], [0.05, 0.072, 0.08], [0.1, 0.09, 0.102], [0.165, 0.096, 0.11], [0.235, 0.09, 0.102], [0.28, 0.077, 0.089], [0.312, 0.064, 0.076], [0.345, 0.052, 0.062]], 2.6);
const SEG = [[0.012, 0.096], [0.099, 0.236], [0.239, 0.312]];
const WINX = [0.102, 0.233];
const WINP = [8 * DEG, 74 * DEG]; // phi0, phiL: the top-outer quarter, over the screw at z = +0.05
const RING = [Math.PI, TAU];

function chelaBody(M) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => {
    const m = part(M, geo, mat, ud);
    g.add(m);
    return m;
  };
  const [px, pz] = C.pivot;
  const zs = pz + D.offset; // screw axis z
  // ---- wrist: fork plates on the wrist can, graphite neck, orange wrist ring at the palm root
  const fy = C.wrist.len / 2 + 0.012;
  for (const s of [1, -1]) add(lever(0, C.wrist.r * 0.5, 0.07, 0.034, 0.01).rotateX(Math.PI / 2).translate(0, s * fy, 0), 'graphite');
  add(xcyl(0.05, 0.0, 0.03, 32), 'graphite');
  add(band(0.055, 0.044, 0.012, 48).rotateZ(Math.PI / 2).translate(0.022, 0, 0), 'orange');
  // ---- palm: ivory panels over a dark liner (the grooves and the window interior read dark)
  const wEnd = WINP[0] + WINP[1];
  const solidB = [wEnd, TAU - WINP[1]];
  add(seShell(PALM, SEG[0][0], SEG[0][1], ...RING, 1, 10, 56), 'ivory');
  add(seShell(PALM, SEG[1][0], SEG[1][1], ...solidB, 1, 16, 56), 'ivory');
  add(seShell(PALM, SEG[2][0], SEG[2][1], ...RING, 1, 8, 56), 'ivory');
  add(seShell(PALM, SEG[0][0] - 0.002, SEG[1][0] + 0.002, ...RING, 0.965, 6, 40), 'dark');
  add(seShell(PALM, SEG[1][0], SEG[1][1], ...solidB, 0.965, 10, 40), 'dark');
  add(seShell(PALM, SEG[1][1] - 0.002, SEG[2][1] + 0.003, ...RING, 0.965, 6, 40), 'dark');
  add(seCap(PALM, SEG[0][0], 0.98, false), 'dark');
  // window: ivory sill pieces fill the panel between the window and the grooves, glass pane, smoke bezel
  add(seShell(PALM, SEG[1][0], WINX[0], WINP[0], WINP[1], 1, 1, 20), 'ivory');
  add(seShell(PALM, WINX[1], SEG[1][1], WINP[0], WINP[1], 1, 1, 20), 'ivory');
  add(seShell(PALM, WINX[0], WINX[1], ...WINP, 0.985, 12, 24), 'glass');
  const bz = [];
  for (const ph of [WINP[0], wEnd]) bz.push(seShell(PALM, WINX[0] - 0.004, WINX[1] + 0.004, ph - 2.2 * DEG, 4.4 * DEG, 1.006, 12, 120));
  for (const x of WINX) bz.push(seShell(PALM, x - 0.004, x + 0.004, WINP[0] - 2.2 * DEG, WINP[1] + 4.4 * DEG, 1.006, 1, 40));
  add(merge(bz), 'smoke');
  // one short orange warning stripe on the outer flank of the rear panel, a dark groove along the lower flank
  add(seShell(PALM, 0.032, 0.088, 100 * DEG, 9 * DEG, 1.005, 6, 200), 'orange');
  add(seShell(PALM, 0.02, 0.305, 128 * DEG, 1.6 * DEG, 1.004, 20, 400), 'dark');
  add(seShell(PALM, 0.02, 0.305, 232 * DEG, 1.6 * DEG, 1.004, 20, 400), 'dark');
  // ---- bolt dots along the grooves (none on the window)
  const bl = [];
  for (const x of [0.088, 0.108, 0.226, 0.25, 0.3])
    for (const a of [-40, -80, 110, 150, 210, 250, 300]) bl.push(seDot(PALM, x, a * DEG));
  for (const a of [96, 112]) bl.push(seDot(PALM, 0.02, a * DEG));
  g.add(bolts(bl, {M, r: 0.0038}));
  // ---- jaw collar: graphite sleeve out of the front panel, dark front face where the fingers leave
  add(seShell(PALM, SEG[2][1] - 0.006, 0.345, ...RING, 0.88, 4, 48), 'graphite');
  add(seCap(PALM, 0.345, 0.88, true), 'graphite');
  // ---- hinge: black drum caps with an orange band and a steel hub on both faces at the finger pivot
  const yh = PALM(px).h;
  for (const s of [1, -1]) {
    add(cyl(0.046, 0.05, 44).translate(px, s * (yh - 0.012), pz), 'dark');
    add(band(0.0478, 0.04, 0.012, 48).translate(px, s * (yh + 0.004), pz), 'orange');
    add(cyl(0.028, 0.006, 36).translate(px, s * (yh + 0.016), pz), 'graphite');
    add(cyl(0.012, 0.008, 20).translate(px, s * (yh + 0.02), pz), 'steel');
  }
  g.add(bolts(boltCircle(0.036, 8, yh + 0.0132, 0.3).map((b) => ({...b, p: [b.p[0] + px, b.p[1], b.p[2] + pz]})), {M, r: 0.003, head: true, mat: 'steel'}));
  add(cyl(0.011, 2 * yh, 20).translate(px, 0, pz), 'steel', {internal: true}); // pivot pin
  // ---- the fixed finger: long curved black finger, out then in to meet the movable tip, orange serrated grip
  const FX = [[0.29, -0.058], [0.355, -0.097], [0.425, -0.106], [0.486, -0.082], [0.526, -0.04]];
  const F = taperTube(FX, (t) => 0.004 + 0.03 * Math.pow(1 - t, 0.75), 1.4, 32, 18);
  add(F.geo, 'dark');
  add(gripPad(F, 1, 0.16, 0.86, 10), 'orange');
  // ---- 4-gear train behind the inner window (motor pinion -> idlers -> screw spur), dark gears on steel shafts
  const gz = -0.072;
  [[0.112, 0.016, 12], [0.141, 0.013, 10], [0.168, 0.016, 12], [0.198, 0.013, 10]].forEach(([x, r, n], i) => {
    add(spurGear(r, n, 0.008, x, (i % 2 ? 0.01 : -0.006), gz), i % 2 ? 'graphite' : 'dark');
    add(zcyl(0.0035, 0.024, x, i % 2 ? 0.01 : -0.006, gz + 0.006, 10), 'steel');
  });
  add(box(0.1, 0.212, -0.04, -0.03, -0.088, -0.05, 0.002), 'graphite'); // gear plate
  // ---- drive: motor, planetary, coupling, bearing blocks, screw, guide rail (seen through the top window)
  const [m0, m1, mr] = C.motor;
  const yz = (geo) => geo.translate(0, C.screwY, zs);
  add(yz(xcyl(mr, m0, m1, 28)), 'dark');
  add(yz(xcyl(mr * 1.08, m1 - 0.016, m1 - 0.006, 28)), 'orange');
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
  // motor internals (internal:true): stator, rotor
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
const FINGER = [[0, 0.006], [0.068, 0.037], [0.14, 0.045], [0.2, 0.023], [0.246, -0.014]];
function fingerPart(M) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => g.add(part(M, geo, mat, ud));
  // crank plate from the pivot to the crank pin (on the drive side, at the link height)
  add(lever(0, 0.022, D.crank, 0.014, 0.012).rotateX(Math.PI / 2).rotateY(-Math.PI / 2).translate(0, C.linkY, 0), 'graphite');
  add(cyl(0.024, 0.04, 28), 'steel'); // hub ring on the pivot
  // long curved black finger, deep at the root, arcing in to a point that meets the fixed finger's tip
  const F = taperTube(FINGER, (t) => 0.004 + 0.029 * Math.pow(1 - t, 0.75), 1.4, 32, 18);
  add(F.geo, 'dark');
  add(new THREE.SphereGeometry(1, 28, 18).scale(0.038, 0.046, 0.038).translate(0.008, 0, 0.006), 'dark'); // root knuckle
  add(gripPad(F, -1, 0.18, 0.86, 9), 'orange');
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
/** fork + sculpted ivory shell link from a joint at the origin to x = len; frame z = the root joint axis */
function linkBody(M, len, sz, rootAct, endR) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => g.add(part(M, geo, mat, ud));
  const {h} = sz;
  const zf = rootAct.len / 2 + rootAct.len * 0.085 + 0.007;
  for (const s of [1, -1]) add(lever(0, rootAct.r * 0.5, 0.085, h * 0.34, 0.01).translate(0, 0, s * zf), 'graphite');
  add(rbox(0.032, h * 0.5, 2 * zf + 0.01, 0.006).translate(0.084, 0, 0), 'graphite'); // fork bridge
  add(xcyl(0.024, 0.06, 0.11, 24), 'graphite'); // output neck into the shell
  limbShell(g, M, 0.098, len - endR * 0.86, sz);
  return g;
}
/** sculpted ivory limb shell x0..x1 (peak section h x w, fuller toward the root), one groove, bolt dots, graphite core */
function limbShell(g, M, x0, x1, {h, w}) {
  const add = (geo, mat, ud) => g.add(part(M, geo, mat, ud));
  const L = x1 - x0;
  const S = stations([[x0, h * 0.36, w * 0.36], [x0 + L * 0.18, h * 0.5, w * 0.5], [x0 + L * 0.45, h * 0.52, w * 0.5], [x0 + L * 0.85, h * 0.43, w * 0.42], [x1, h * 0.36, w * 0.36]], 2.5);
  const sA = x0 + L * 0.58;
  add(seShell(S, x0, sA - 0.0015, ...RING, 1, 14, 48), 'ivory');
  add(seShell(S, sA + 0.0015, x1, ...RING, 1, 10, 48), 'ivory');
  add(seShell(S, sA - 0.004, sA + 0.004, ...RING, 0.96, 1, 40), 'dark');
  add(seCap(S, x0, 1, false), 'graphite');
  add(seCap(S, x1, 1, true), 'graphite');
  // dark groove along both flanks
  for (const ph of [80, 280]) add(seShell(S, x0 + 0.012, x1 - 0.012, ph * DEG, 1.6 * DEG, 1.004, 14, 400), 'dark');
  const dots = [];
  for (const x of [sA - 0.012, sA + 0.012]) for (const a of [-50, 50, 130, 230]) dots.push(seDot(S, x, a * DEG, 1, 0.0034));
  for (const a of [-30, 30]) dots.push(seDot(S, x0 + 0.012, a * DEG, 1, 0.0034));
  g.add(bolts(dots, {M, r: 0.0034}));
  add(rbox(L - 0.02, h * 0.42, w * 0.42, 0.004).translate((x0 + x1) / 2, 0, 0), 'graphite', {internal: true}); // core beam
}
/** a broad orange band round a y-axis joint drum (elbow / wrist), placed at x */
const drumRing = (a, x = 0) => band(a.r * 1.05, a.r * 0.96, a.len * 0.3, 40).translate(x, a.len * 0.17, 0);
/** arm: S -> E, frame origin S, z = pitch axis; the elbow can is part of the forearm */
const armPart = (M) => linkBody(M, CLAW.arm, C.arm, C.pitch, C.elbow.r);
/** forearm: E -> W, frame origin E, y up-ish; carries the elbow can (axis y at its origin) and the wrist can at W */
function forePart(M) {
  const g = new THREE.Group();
  const el = actuator({...C.elbow, reducer: 'harmonic', M});
  g.add(el);
  g.add(part(M, drumRing(C.elbow), 'orange'));
  const x0 = C.elbow.r * 0.8;
  const x1 = CLAW.fore - C.wrist.r * 0.8;
  g.add(part(M, xcyl(0.022, C.elbow.r * 0.6, x0 + 0.02, 24), 'graphite'));
  g.add(part(M, xcyl(0.022, x1 - 0.02, CLAW.fore - C.wrist.r * 0.6, 24), 'graphite'));
  limbShell(g, M, x0, x1, C.fore);
  const wr = actuator({...C.wrist, reducer: 'planetary', M});
  wr.position.x = CLAW.fore;
  g.add(wr);
  g.add(part(M, drumRing(C.wrist, CLAW.fore), 'orange'));
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
    anchors[`clawTip${s}`] = marker(B.finger, FINGER[FINGER.length - 1][0], 0, FINGER[FINGER.length - 1][1]);
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
