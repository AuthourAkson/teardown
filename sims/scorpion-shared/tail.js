// SCORPION SC-8 v9, the biomimetic tail (metasoma) and the stinger module, posed from kin.js tailAt().
// Reads as a natural scorpion metasoma: 7 smoothly tapering ivory ring-shell segments over graphite cores, each
// shell split into flank / dorsal panels by thin grooves (the graphite core shows in the grooves) with raised dorsal
// and lateral keel ridges; compact graphite joint drums with orange face rings sit recessed in the gaps between the
// segments; then a bulbous ivory vesicle (smoke windows, orange warning band, orange glowing collar) and a curved
// glossy black aculeus hooking forward and down.
//   root mount   fixed: J1 yaw stage (vertical can) on the rear-frame turntable flange (body.js, top y = root.y - 0.15)
//   yaw carrier  turns with J1 yaw: a fork carrying the J1 pitch drum on the root point
//   links k = 1..7  one rigid body each, pts[k-1] -> pts[k]; link k carries the drum of J(k+1) at its far end
//                (zActuator: motor / reducer / bearing / encoder inside, act.cut window for jointCut).
//   stinger      J8 clevis -> vesicle (sensor bay) -> aculeus.
//   cable carrier  small dark links inside the cores (internal: x-ray only).
// Link frame: +x along the link, z = pitch axis, +y = outer (dorsal) side of the curl, -y = inner (ventral) side.
import * as THREE from 'three';
import {actuator, bolts, boltCircle, rbox, tag} from './parts.js';
import {TAIL} from './kin.js';
import {ORDER, bake, cyl, frame, instance, lever, marker, part, ring, xcyl, zActuator, zcyl} from './legs.js';

const V3 = THREE.Vector3;
const PI = Math.PI;
const box = (x0, x1, y0, y1, z0, z1, r = 0.004) => rbox(x1 - x0, y1 - y0, z1 - z0, r).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const LENS = [...TAIL.seg, TAIL.sting];

// ------------------------------------------------------------ visual section sizes
// TAIL.width / height are the kin envelopes (with clearance); the visible shell tapers harder, like a real metasoma:
// about 0.21 m tall at link 1 down to about 0.14 m at the end mount.
const taper = (k) => 0.86 - 0.025 * k;
const visH = (k) => TAIL.height[Math.min(7, Math.max(1, k))] * taper(Math.min(7, Math.max(1, k)));
const visW = (k) => TAIL.width[Math.min(7, Math.max(1, k))] * taper(Math.min(7, Math.max(1, k)));
// compact joint drum of J(j+1) at pts[j], sized from the (smaller) link after the joint so it nests in both shells
export const drumOf = (j) => ({r: Math.max(0.026, visH(j + 1) * 0.25), len: Math.max(0.04, visW(j + 1) * 0.36)});
export const discOf = (j) => drumOf(j).r;
const WALL = 0.007;
const SEN = 2.6; // superellipse exponent of the section: a soft, cambered box

// superellipse point at angle f (from +z, through +y at f = PI/2): returns [y, z]
const se = (a, b, f) => {
  const c = Math.cos(f);
  const s = Math.sin(f);
  return [b * Math.sign(s) * Math.abs(s) ** (2 / SEN), a * Math.sign(c) * Math.abs(c) ** (2 / SEN)];
};

// ------------------------------------------------------------ loft: a closed 2D section swept along +x
/**
 * loft(sec, x0, x1, N): sec(u) -> closed loop [[y, z], ...] (same point count for every u), swept from x0 to x1 in N
 * slices, capped at both ends. Watertight, outward normals, smooth sides, flat caps.
 */
function loft(sec, x0, x1, N = 12, xmap = null) {
  const rings = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    let P = sec(u);
    let A = 0;
    for (let j = 0; j < P.length; j++) {
      const p = P[j];
      const q = P[(j + 1) % P.length];
      A += p[0] * q[1] - q[0] * p[1];
    }
    if (A < 0) P = P.slice().reverse();
    rings.push({x: xmap ? xmap(u) : x0 + (x1 - x0) * u, P});
  }
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
  const caps = [];
  for (const [r, sgn] of [[rings[0], -1], [rings[N], 1]]) {
    const v2 = r.P.map(([y, z]) => new THREE.Vector2(y, z));
    const tris = THREE.ShapeUtils.triangulateShape(v2, []);
    const cp = [];
    for (const t of tris) {
      let [a, b, c] = t.map((i) => r.P[i]);
      // normal x = (b - a) x (c - a) in (y, z): (by - ay)(cz - az) - (bz - az)(cy - ay)
      const nx = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (nx * sgn < 0) [b, c] = [c, b];
      for (const p of [a, b, c]) cp.push(r.x, p[0], p[1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    g.computeVertexNormals();
    caps.push(g);
  }
  return [side, ...caps];
}
/** crescent panel section between angles g0..g1: outer superellipse (a, b), wall t, n points per arc */
const crescent = (a, b, t, g0, g1, n = 10) => {
  const P = [];
  for (let i = 0; i <= n; i++) P.push(se(a, b, g0 + ((g1 - g0) * i) / n));
  for (let i = n; i >= 0; i--) P.push(se(a - t, b - t, g0 + ((g1 - g0) * i) / n));
  return P;
};
/** full closed superellipse section */
const solid = (a, b, n = 28) => Array.from({length: n}, (_, i) => se(a, b, (i / n) * 2 * PI));
/** outward unit normal of the superellipse (a, b) at angle f, as [y, z] */
const seN = (a, b, f) => {
  const p = se(a, b, f - 1e-3);
  const q = se(a, b, f + 1e-3);
  const ty = q[0] - p[0];
  const tz = q[1] - p[1];
  const l = Math.hypot(ty, tz) || 1;
  // loop runs +z -> +y (counter-clockwise in (z, y)): outward = (ty, tz) rotated: [tz, -ty]... pick the one pointing away
  let n = [-tz / l, ty / l];
  const m = se(a, b, f);
  if (n[0] * m[0] + n[1] * m[1] < 0) n = [-n[0], -n[1]];
  return n;
};

// panels round the section (angles from +z over the top to -z): flank, dorsal, flank. The flanks wrap under the
// belly and leave a narrow ventral slot where the graphite spine shows.
const PANELS = [[-1.05, 0.86], [0.92, PI - 0.92], [PI - 0.86, PI + 1.05]];
// keel ridges (carinae): dorsal pair and one lateral ridge per flank (angle, half angular width)
const KEELS = [[PI / 2 - 0.3, 0.045], [PI / 2 + 0.3, 0.045], [0.1, 0.04], [PI - 0.1, 0.04]];
const NECK = 0.82; // rear neck size, tucks inside the previous segment's sleeve
const FLARE = 1.07; // front sleeve size, slides over the next segment's neck and hides the drum
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// base half sizes [a, b] of the shell at the joint J(k) (k = 1..8; 8 = the end of the end mount)
const baseAt = (k) => (k <= 7 ? [visW(k) / 2, visH(k) / 2] : [(visW(7) * 0.94) / 2, (visH(7) * 0.94) / 2]);
// how far a sleeve reaches past its joint axis
const sleeveE = (k) => baseAt(k)[1] * 0.45;

// ------------------------------------------------------------ link body
/**
 * link body k (1..7) along +x from J(k) at the origin to J(k+1) at x = len: ONE continuous ivory shell per segment,
 * neck (tucked in the previous sleeve) -> barrel -> flared sleeve over the J(k+1) drum, split into three panels by
 * thin grooves, with keel ridges; graphite core and a thin ventral spine inside; orange seam band on the neck.
 */
function linkBody(M, k) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => {
    for (const gg of Array.isArray(geo) ? geo : [geo]) g.add(part(M, gg, mat, ud));
  };
  const len = LENS[k - 1];
  const dA = drumOf(k - 1);
  const dB = drumOf(k);
  const [a0, b0] = baseAt(k);
  const [a1, b1] = baseAt(k + 1);
  const last = k === 7;
  const xr = -b0 * 0.3; // rear rim of the neck (inside the previous sleeve)
  const xn = sleeveE(k) + 0.012; // the neck ends just outside the previous sleeve rim
  const xs0 = len - b1 * 0.55; // the sleeve flare starts here
  const xf = last ? len - dB.r * 1.25 : len + sleeveE(k + 1); // front rim
  const base = (x) => {
    const v = Math.min(1, Math.max(0, x / len));
    const bulge = 1 + 0.04 * Math.sin(PI * v);
    return [(a0 + (a1 - a0) * v) * bulge, (b0 + (b1 - b0) * v) * bulge];
  };
  const fac = (x) => {
    let m = NECK + (1 - NECK) * smooth((x - xn) / 0.03);
    if (!last) m *= 1 + (FLARE - 1) * smooth((x - xs0) / 0.025);
    const roll = 1 - 0.012 * (smooth((xr + 0.006 - x) / 0.006) + smooth((x - xf + 0.006) / 0.006));
    return m * roll;
  };
  const half = (x) => {
    const [a, b] = base(x);
    const m = fac(x);
    return [a * m, b * m];
  };
  // non-uniform slices: dense through the neck ramp and the sleeve flare
  const xs = [];
  const seg = (p, q, n) => {
    for (let i = 0; i < n; i++) xs.push(p + ((q - p) * i) / n);
  };
  seg(xr, xr + 0.006, 2);
  seg(xr + 0.006, xn, 3);
  seg(xn, xn + 0.03, 6);
  if (last) {
    seg(xn + 0.03, xf - 0.006, 10);
  } else {
    seg(xn + 0.03, xs0, 10);
    seg(xs0, xs0 + 0.025, 5);
    seg(xs0 + 0.025, xf - 0.006, 3);
  }
  seg(xf - 0.006, xf, 2);
  xs.push(xf);
  const N = xs.length - 1;
  const xm = (u) => xs[Math.round(u * N)];
  // ---- drum of J(k+1), carried at the far end, hidden in the sleeve
  const act = zActuator({...dB, reducer: k < 4 ? 'harmonic' : 'planetary', M, x: len});
  g.add(act);
  // ---- graphite core (slim, a spine beam inside the shell) reaching into both drums
  const cx0 = dA.r * 0.5;
  const cx1 = len - dB.r * 0.5;
  const cs = 0.55;
  add(loft((u) => {
    const [a, b] = base(cx0 + (cx1 - cx0) * u);
    return solid(a * cs, b * cs, 24);
  }, cx0, cx1, 6), 'graphite');
  // thin ventral spine: a slim graphite rib under the core, seen through the belly slot
  const [am, bm] = base(len / 2);
  const yc = -bm * cs;
  add(box(xn + 0.02, xs0 - 0.01, yc - 0.013, yc + 0.004, -0.0055, 0.0055, 0.0035), 'graphite');
  // ---- the continuous ivory shell (three panels), then the keel ridges on the barrel
  for (const [g0, g1] of PANELS)
    add(loft((u) => {
      const [a, b] = half(xm(u));
      return crescent(a, b, WALL, g0, g1, 12);
    }, xr, xf, N, xm), 'ivory');
  const kx0 = xn + 0.035;
  const kx1 = last ? xf - 0.012 : xs0 - 0.004;
  for (const [fk, hw] of KEELS)
    add(loft((u) => {
      const x = kx0 + (kx1 - kx0) * u;
      const [a, b] = half(x);
      const h = 0.0015 + 0.004 * Math.sin(PI * (0.06 + 0.88 * u));
      return crescent(a + h, b + h, WALL * 0.5 + h, fk - hw, fk + hw, 4);
    }, kx0, kx1, 8), 'ivory');
  // ---- orange seam band round the neck, showing just outside the previous sleeve rim
  {
    const xb0 = sleeveE(k) + 0.002;
    const xb1 = sleeveE(k) + 0.0095;
    add(loft((u) => {
      const [a, b] = base(xb0 + (xb1 - xb0) * u);
      return crescent(a * (NECK + 0.035), b * (NECK + 0.035), Math.min(a, b) * 0.035 + 0.0015, -PI / 2 + 0.001, (3 * PI) / 2 - 0.001, 36);
    }, xb0, xb1, 1), 'orange');
  }
  // ---- pivot bosses: graphite caps on the shell flanks at the J(k+1) axis (the pin runs through both shells)
  if (!last) {
    const [as] = half(len);
    for (const s of [1, -1]) {
      add(zcyl(dB.r * 0.42, 0.007, len, 0, s * (as + 0.0015), 28), 'graphite');
      add(zcyl(dB.r * 0.2, 0.004, len, 0, s * (as + 0.006), 20), 'steel');
    }
  } else {
    // end mount: the J8 wrist drum stays exposed; orange rings on its faces
    for (const s of [1, -1]) {
      const zf = s * (dB.len / 2 + (s > 0 ? dB.len * 0.09 : 0.003));
      add(ring(dB.r * 0.99, dB.r * 0.84, 0.005, 36).rotateX(PI / 2).translate(len, 0, zf), 'orange');
    }
  }
  // ---- bolt dots: a row round the sleeve rim, two per panel at the barrel start
  const dots = [];
  for (const [g0, g1] of PANELS) {
    const fm = (g0 + g1) / 2;
    const pts = last ? [[xf - 0.014, -0.25], [xf - 0.014, 0.25]] : [[xf - 0.012, -0.28], [xf - 0.012, 0], [xf - 0.012, 0.28]];
    pts.push([xn + 0.045, -0.2], [xn + 0.045, 0.2]);
    for (const [x, df] of pts) {
      const [a, b] = half(x);
      const fp = fm + df;
      const [y, z] = se(a, b, fp);
      const [ny, nz] = seN(a, b, fp);
      dots.push({p: [x, y + ny * 0.0004, z + nz * 0.0004], n: [0, ny, nz]});
    }
  }
  g.add(bolts(dots, {M, r: Math.max(0.0025, visH(k) * 0.012)}));
  return {g, act};
}

// ------------------------------------------------------------ root mount & yaw carrier
/** root mount: J1 yaw stage on the turntable flange; frame origin = J1 point (TAIL.root), world axes */
function rootMount(M) {
  const g = new THREE.Group();
  const yaw = actuator({r: 0.075, len: 0.05, reducer: 'harmonic', cutPhi: -PI / 2, M});
  yaw.position.y = -0.125;
  g.add(yaw);
  g.add(part(M, cyl(0.084, 0.008, 44).translate(0, -0.146, 0), 'steel'));
  g.add(bolts(boltCircle(0.079, 10, -0.141, 0.2), {M, r: 0.0042, head: true, mat: 'steel'}));
  return {g, yaw};
}
/** yaw carrier: plate on the yaw output + two graphite cheeks outside the link-1 neck, pinned on the J1 axis */
function yawCarrier(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => g.add(part(M, geo, mat));
  const j1 = drumOf(0);
  const top = -0.125 + 0.025 + 0.05 * 0.085 + 0.006;
  add(cyl(0.078, 0.012, 40).translate(0, top, 0), 'graphite');
  const [a1, b1] = baseAt(1);
  const zf = a1 * NECK + 0.012; // cheek mid plane, clear of the neck flank
  const rc = b1 * 0.62;
  for (const s of [1, -1]) {
    add(lever(0, rc, 0, rc, 0.01, s * zf), 'graphite');
    add(box(-rc * 0.9, rc * 0.9, top, -rc * 0.3, s * zf - 0.005, s * zf + 0.005, 0.003), 'graphite');
    add(zcyl(rc * 0.45, 0.006, 0, 0, s * (zf + 0.007), 24), 'steel');
  }
  add(box(-b1 - 0.026, -b1 - 0.012, top, top + 0.05, -zf * 0.55, zf * 0.55, 0.003), 'graphite'); // pitch hard-stop block
  const p = zActuator({...j1, reducer: 'harmonic', M});
  g.add(p);
  return {g, act: p};
}

// ------------------------------------------------------------ stinger: vesicle + aculeus
// vesicle lathe profile [radius, x] in the module frame (x from J8 along the module)
const VES = [[0, 0.03], [0.05, 0.03], [0.062, 0.045], [0.085, 0.07], [0.105, 0.1], [0.116, 0.135], [0.113, 0.168], [0.097, 0.2], [0.07, 0.228], [0.044, 0.252], [0.036, 0.26], [0, 0.262]];
const vesR = (x) => {
  for (let i = 1; i < VES.length; i++)
    if (x <= VES[i][1]) {
      const [r0, x0] = VES[i - 1];
      const [r1, x1] = VES[i];
      return r0 + ((r1 - r0) * (x - x0)) / Math.max(1e-6, x1 - x0);
    }
  return 0;
};
// aculeus centre line: leaves the vesicle along +x, hooks toward +y (forward when the stinger hangs down)
const BLADE = [[0.245, 0], [0.33, 0.0], [0.39, 0.018], [LENS[7], 0.07]];
function vesicleBody(M) {
  const g = new THREE.Group();
  const add = (geo, mat, ud) => g.add(part(M, geo, mat, ud));
  const j8 = drumOf(7);
  const zc = j8.len / 2 + j8.len * 0.09 + 0.012;
  // clevis cheeks from the J8 drum to the neck flange
  for (const s of [1, -1]) add(lever(0, j8.r * 1.05, 0.045, 0.034, 0.01, s * zc), 'graphite');
  add(xcyl(0.054, 0.012, 0.036, 32), 'graphite'); // neck flange (bridges the cheeks)
  for (const s of [1, -1]) add(ring(j8.r * 0.99, j8.r * 0.84, 0.006, 32).rotateX(PI / 2).translate(0, 0, s * (zc + 0.008)), 'orange');
  const fb = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * PI * 2 + PI / 8;
    fb.push({p: [0.024, Math.cos(t) * 0.044, Math.sin(t) * 0.044], n: [-1, 0, 0]});
  }
  g.add(bolts(fb, {M, r: 0.003, head: true, mat: 'steel'}));
  // bulbous ivory vesicle
  add(new THREE.LatheGeometry(VES.map(([r, x]) => new THREE.Vector2(r, x)), 48).rotateZ(-PI / 2), 'ivory');
  // thin orange warning band round the neck
  add(ring(vesR(0.058) + 0.003, vesR(0.058) - 0.012, 0.009, 44).rotateZ(-PI / 2).translate(0.058, 0, 0), 'orange');
  // dark panel groove round the shoulder (proud ring, no coplanar faces)
  add(ring(vesR(0.185) + 0.002, vesR(0.185) - 0.01, 0.004, 44).rotateZ(-PI / 2).translate(0.185, 0, 0), 'dark');
  // smoke sensor windows on both flanks (lens domes half sunk into the shell)
  for (const s of [1, -1]) add(rbox(0.05, 0.007, 0.012, 0.003).translate(0.14, 0.03, s * (vesR(0.14) - 0.004)), 'smoke');
  // a small dorsal window
  add(new THREE.SphereGeometry(1, 24, 12).scale(0.03, 0.012, 0.02).translate(0.13, vesR(0.13) - 0.003, 0), 'smoke');
  // bolt dots round the shoulder
  const bd = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * PI * 2 + PI / 8;
    const r = vesR(0.085);
    bd.push({p: [0.085, Math.cos(t) * (r + 0.0004), Math.sin(t) * (r + 0.0004)], n: [-0.3, Math.cos(t), Math.sin(t)]});
  }
  g.add(bolts(bd, {M, r: 0.003}));
  // internals: sensor cartridge + venom-probe rod
  add(xcyl(0.03, 0.06, 0.2, 16), 'copper', {internal: true});
  add(xcyl(0.012, 0.08, 0.27, 10), 'steel', {internal: true});
  return g;
}
/** aculeus: glossy black curved needle, a tube along BLADE tapering to a point */
function aculeus(r0 = 0.034) {
  const path = new THREE.CubicBezierCurve3(...BLADE.map(([x, y]) => new V3(x, y, 0)));
  const N = 40;
  const R = 20;
  const tube = new THREE.TubeGeometry(path, N, 1, R, false);
  const pa = tube.attributes.position;
  const c = new V3();
  for (let i = 0; i < pa.count; i++) {
    const u = Math.floor(i / (R + 1)) / N;
    path.getPoint(u, c);
    const r = r0 * Math.pow(1 - u, 0.8) + 0.0006;
    pa.setXYZ(i, c.x + (pa.getX(i) - c.x) * r, c.y + (pa.getY(i) - c.y) * r, c.z + (pa.getZ(i) - c.z) * r);
  }
  tube.computeVertexNormals();
  return tube;
}
/** cable-carrier link: a small dark open box, frame x along the chain */
const carrierGeo = () => box(-0.0055, 0.0055, -0.003, 0.003, -0.0095, 0.0095, 0.0012);

// ------------------------------------------------------------ the builder
/**
 * buildTail(M) -> {group, update(kinTail, pose), anchors, assemblies: {tail, stinger}, joints: {tailJ1, tailJ1Yaw}}
 *   group lives in the torso frame; kinTail = tailAt(strike, stow, yaw).
 *   anchors: tailJ1, tailMid (J4 drum), tailJ2..tailJ8, tailSec0..tailSec8 (section mid points), sting (needle tip),
 *   stingFlange, stingBay (sensor bay), stingTip (glowing tip collar), tailCable.
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
    anchors[`tailSec${k}`] = marker(b, LENS[k - 1] / 2, 0, visW(k) / 2);
  }
  anchors.tailSec0 = marker(mount.g, 0, -0.09, 0.09);
  // stinger: its own assembly riding the same yaw
  const yawS = new THREE.Group();
  yawS.position.set(rx, ry, 0);
  stingA.add(yawS);
  const sting = new THREE.Group();
  sting.name = 'stinger.module';
  instance(M, bake(vesicleBody(M)), sting);
  // live (unbaked) so they keep their own materials: glowing orange collar, glossy black aculeus
  sting.add(part(M, ring(0.047, 0.03, 0.012, 40).rotateZ(-PI / 2).translate(0.252, 0, 0), 'core'));
  sting.add(part(M, aculeus(), 'smoke'));
  yawS.add(sting);
  anchors.tailSec8 = marker(sting, 0.15, 0, vesR(0.15));
  anchors.stingFlange = marker(sting, 0.03, 0, 0.055);
  anchors.stingBay = marker(sting, 0.135, 0, vesR(0.135));
  anchors.stingTip = marker(sting, 0.252, 0, 0.047);
  anchors.sting = marker(sting, BLADE[3][0], BLADE[3][1], 0);
  anchors.tailJ1 = marker(carrier.g, 0, 0, drumOf(0).len / 2 + 0.04);
  anchors.tailMid = anchors.tailJ4;
  // cable carrier: links inside the cores (local +y of the curl), placed per frame along the chain
  const NC = 46;
  const cim = new THREE.InstancedMesh(carrierGeo(), M.dark, NC);
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
  const X = new V3(1, 0, 0);
  const p = new V3();
  const d = new V3();
  /** kinTail = tailAt(strike, stow, yaw) */
  function update(T) {
    const yaw = T.yaw || 0;
    yawG.rotation.y = yaw;
    yawS.rotation.y = yaw;
    mount.yaw.rotation.y = 0;
    carrier.g.rotation.set(0, 0, 0);
    const loc = (k) => new V3(T.pts[k][0] - rx, T.pts[k][1] - ry, 0);
    for (let k = 1; k <= 7; k++) frame(bodies[k - 1], loc(k - 1), d.subVectors(loc(k), loc(k - 1)), Z);
    frame(sting, loc(7), d.subVectors(loc(8), loc(7)), Z);
    // the carrier rides inside the cores, offset along the curl normal toward the dorsal side
    const path = [];
    for (let k = 0; k <= 7; k++) {
      const a = k === 0 ? T.ang[0] : (T.ang[k - 1] + T.ang[Math.min(7, k)]) / 2;
      const r = visH(Math.min(7, k + 1)) * 0.2;
      path.push(new V3(T.pts[k][0] - rx - Math.sin(a) * r, T.pts[k][1] - ry + Math.cos(a) * r, 0));
    }
    const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
    for (let i = 0; i < NC; i++) {
      const u = (i + 0.5) / NC;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, d);
      q.setFromUnitVectors(X, d);
      cim.setMatrixAt(i, mx.compose(p, q, one));
    }
    cim.instanceMatrix.needsUpdate = true;
    cim.computeBoundingSphere();
    group.updateMatrixWorld(true);
  }
  return {group, update, anchors, assemblies: {tail: tailA, stinger: stingA}, joints: {tailJ1: carrier.act, tailJ1Yaw: mount.yaw}};
}
