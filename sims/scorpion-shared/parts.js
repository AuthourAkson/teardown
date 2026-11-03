// SCORPION SC-8, the part kit every geometry file builds from: the material set, a joint actuator (dark can, orange
// ring, output flange with its bolt circle, and the motor / reducer / bearing / encoder inside), white armour panels
// split into tiles with seams, black bolt holes and vent slots, grilles, ribbed hollow links with armour shells,
// cables, and place() to lay a link from one point to another. Bolts, seams and slots are instanced or merged so a
// panel costs two or three draw calls however many holes it has.
//
// Conventions (CONTRACT.md): metres; an actuator's axis is +y, centred on the origin; a link runs along +x from the
// origin; a panel's outer face points +y. Every mesh gets userData.mat (key into the material set) and
// userData.internal; the caller tags sys / order / explode / cut with tag().
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const Y = new V3(0, 1, 0);

/** merge any mix of indexed / non-indexed geometries: everything goes non-indexed with position + normal only */
export function merge(list) {
  const geos = list.filter(Boolean).map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', g.attributes.position);
    out.setAttribute('normal', g.attributes.normal);
    return out;
  });
  return geos.length === 1 ? geos[0] : mergeGeometries(geos);
}
let CUR = null; // the material set the builders use unless opts.M is given

// ------------------------------------------------------------ exploded view stages (reverse assembly order)
export const EXPLODE_STAGES = [
  {order: 1, cn: '装甲拆除', en: 'ARMOUR OFF'},
  {order: 2, cn: '传感头', en: 'SENSOR HEAD'},
  {order: 3, cn: '尾刺与尾节', en: 'STINGER & TAIL'},
  {order: 4, cn: '机械钳', en: 'CLAWS'},
  {order: 5, cn: '机械腿', en: 'LEGS'},
  {order: 6, cn: '舱内模块', en: 'BAY MODULES'},
  {order: 7, cn: '关节内部', en: 'ACTUATOR INTERNALS'},
];
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** how far stage `order` has run (0..1) at overall explode e (0..1); order 0 (chassis) never moves */
export function explodeAt(e, order) {
  if (!order || !(e > 0)) return 0;
  const n = EXPLODE_STAGES.length;
  return smooth((e * n - (order - 1)) / 0.85);
}

// ------------------------------------------------------------ materials
export function makeMaterials() {
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({color, roughness: 0.48, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.45, ...o});
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.2, ...o});
  const M = {
    ivory: phys('#f3f1eb', {roughness: 0.38}),
    white: phys('#f6f5f1', {roughness: 0.35}),
    // reference colour shares (show, cmp/report.txt): mid-grey frame, near-black only for rubber / needles / stinger
    dark: std('#333740', {roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide}),
    graphite: std('#7c7f86', {roughness: 0.55, metalness: 0.4, envMapIntensity: 0.7}),
    steel: std('#a2a7ae', {roughness: 0.42, metalness: 0.85, envMapIntensity: 0.6}),
    alu: std('#c9ccd1', {roughness: 0.45, metalness: 0.7, envMapIntensity: 0.55}),
    orange: std('#ee5a24', {roughness: 0.45, metalness: 0.05}),
    rubber: std('#18181a', {roughness: 0.9, metalness: 0}),
    glass: new THREE.MeshPhysicalMaterial({color: '#e8eef2', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4, clearcoat: 1}),
    smoke: new THREE.MeshPhysicalMaterial({color: '#0d0f12', roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2}),
    copper: std('#b8733a', {roughness: 0.35, metalness: 0.9, envMapIntensity: 0.6}),
    core: std('#ee5a24', {emissive: '#ee5a24', emissiveIntensity: 0.55, roughness: 0.4}),
    lamp: std('#fffaf0', {emissive: '#fff4e0', emissiveIntensity: 0.8, roughness: 0.3, metalness: 0}),
  };
  CUR = M;
  return M;
}
const mats = (o) => o?.M || CUR || makeMaterials();

/** a mesh with the contract's flags; mat is a key into the material set */
export function mesh(geo, mat, o = {}) {
  const M = mats(o);
  const m = new THREE.Mesh(geo, M[mat]);
  m.castShadow = m.receiveShadow = true;
  m.userData = {mat, internal: !!o.internal, ...(o.ud || {})};
  return m;
}

/** tag every mesh under obj with the system fields (sys, order, explode, cut, internal) without touching mat */
export function tag(obj, ud) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const keep = {mat: o.userData.mat, internal: o.userData.internal || !!ud.internal, axial: o.userData.axial, shell: o.userData.shell};
    o.userData = {sys: 'chassis', order: 0, explode: [0, 0, 0], cut: true, ...o.userData, ...ud, ...keep};
    if (o.userData.axial === undefined) delete o.userData.axial;
    if (o.userData.shell === undefined) delete o.userData.shell;
  });
  return obj;
}

// ------------------------------------------------------------ geometry helpers
export const rbox = (l, h, w, r = 0.01, seg = 2) => new RoundedBoxGeometry(l, h, w, seg, Math.max(0.0005, Math.min(r, l / 2.05, h / 2.05, w / 2.05)));
const cyl = (r, h, seg = 32, open = false) => new THREE.CylinderGeometry(r, r, h, seg, 1, open);
/** a lathed ring (axis +y): profile [[r, y], ...] closed; phi range for half shells */
const lathe = (prof, seg = 40, phi0 = 0, phiL = Math.PI * 2) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg, phi0, phiL);
const tube = (rO, rI, h, seg = 40, phi0 = 0, phiL = Math.PI * 2) =>
  lathe([[rI, -h / 2], [rO - h * 0.12, -h / 2], [rO, -h / 2 + h * 0.12], [rO, h / 2 - h * 0.12], [rO - h * 0.12, h / 2], [rI, h / 2], [rI, -h / 2]], seg, phi0, phiL);

/** bolt holes / bolt heads as one InstancedMesh. list: [{p:[x,y,z], n:[x,y,z]?, r?}] or [[x,y,z], ...]; n defaults +y */
export function bolts(list, o = {}) {
  const r0 = o.r ?? 0.0055;
  const geo = o.head ? new THREE.CylinderGeometry(r0, r0, r0 * 0.9, 6).translate(0, r0 * 0.3, 0) : cyl(r0, r0 * 0.6, 10).translate(0, 0.0004, 0);
  const im = new THREE.InstancedMesh(geo, mats(o)[o.mat || 'rubber'], Math.max(1, list.length));
  im.count = list.length;
  const q = new THREE.Quaternion();
  const mx = new THREE.Matrix4();
  const n = new V3();
  const s = new V3();
  list.forEach((b, i) => {
    const p = Array.isArray(b) ? b : b.p;
    n.set(...(b.n || [0, 1, 0])).normalize();
    q.setFromUnitVectors(Y, n);
    const k = (b.r ?? r0) / r0;
    s.set(k, k, k);
    mx.compose(new V3(...p), q, s);
    im.setMatrixAt(i, mx);
  });
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = false;
  im.receiveShadow = true;
  im.userData = {mat: o.mat || 'rubber', internal: !!o.internal};
  return im;
}
/** points on a bolt circle of radius r in the plane y = y0, normal +y (or -y with down) */
export const boltCircle = (r, n, y0 = 0, a0 = 0, down = false) =>
  Array.from({length: n}, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    return {p: [Math.cos(a) * r, y0, Math.sin(a) * r], n: [0, down ? -1 : 1, 0]};
  });

// ------------------------------------------------------------ actuator
const ACT_GEO = new Map(); // geometry cache: every actuator of the same size shares its buffers
const cached = (key, make) => {
  if (!ACT_GEO.has(key)) ACT_GEO.set(key, make());
  return ACT_GEO.get(key);
};
/**
 * A rotary joint actuator, axis +y, centred on the origin, output side +y. Outside: a dark housing cup with
 * chamfered rims, an orange ring round its output end, a steel output flange with a bolt circle and a hub. Inside
 * (internal:true, each with userData.axial = its offset along +y in the joint's own exploded view, in metres):
 * encoder disc + read head, PMSM stator (copper) and rotor (steel), shaft, harmonic reducer (circular spline,
 * flexspline cup, elliptical wave generator) or planetary set, crossed-roller bearing.
 * The housing is two lathed pieces: a 270° body and a 90° window piece (userData.shell = 'cut') facing +z (or opts.cutPhi);
 * robot.js lifts the window piece away for jointCut so the internals read through the gap.
 * Returns a Group with .act = {r, len, top, bottom, flange, cut: [meshes], inner: [meshes]}.
 */
export function actuator({r = 0.05, len = 0.1, ring = true, reducer = 'harmonic', cutPhi = 0, M} = {}) {
  const g = new THREE.Group();
  const o = {M};
  const h = len;
  const t = Math.max(0.004, r * 0.09); // wall
  const c = Math.min(r * 0.14, h * 0.12); // rim chamfer
  const k = `${r.toFixed(4)}|${h.toFixed(4)}|${reducer}`;
  const cup = [
    [r * 0.28, -h / 2],
    [r - c, -h / 2],
    [r, -h / 2 + c],
    [r, h / 2 - c * 0.6],
    [r - c * 0.6, h / 2],
    [r - t, h / 2],
    [r - t, -h / 2 + t],
    [r * 0.28, -h / 2 + t],
    [r * 0.28, -h / 2],
  ];
  const w0 = cutPhi - Math.PI / 4;
  const body = mesh(cached(k + 'b', () => lathe(cup, 40, w0 + Math.PI / 2, Math.PI * 1.5)), 'dark', o);
  const win = mesh(cached(k + 'w', () => lathe(cup, 14, w0, Math.PI / 2)), 'dark', o);
  win.userData.shell = 'cut';
  win.userData.cutDir = [Math.sin(cutPhi), 0, Math.cos(cutPhi)];
  // back cap: encoder cover, dark, with a small steel boss
  const back = mesh(cached(k + 'bk', () => cyl(r * 0.3, t * 1.6, 24).translate(0, -h / 2 - t * 0.3, 0)), 'graphite', o);
  g.add(body, win, back);
  // orange ring round the output end (the reference drum's rim)
  let band = null;
  const cut = [win];
  if (ring) {
    // thin rim band (official orange share ~4 %: rings are the only orange on the machine)
    band = mesh(cached(k + 'r', () => tube(r * 1.04, r * 0.97, h * 0.14, 34, w0 + Math.PI / 2, Math.PI * 1.5).translate(0, h * 0.35, 0)), 'orange', o);
    const bw = mesh(cached(k + 'rw', () => tube(r * 1.04, r * 0.97, h * 0.14, 12, w0, Math.PI / 2).translate(0, h * 0.35, 0)), 'orange', o);
    bw.userData.shell = 'cut';
    bw.userData.cutDir = win.userData.cutDir;
    g.add(band, bw);
    cut.push(bw);
  }
  // output flange: steel disc, raised hub, bolt circle
  // the reference drum face is dark with a steel hub; the orange rim band is added below
  const fl = mesh(cached(k + 'f', () => tube(r * 0.84, r * 0.2, Math.max(0.006, h * 0.09), 40).translate(0, h / 2 + h * 0.035, 0)), 'graphite', o);
  const hub = mesh(cached(k + 'h', () => cyl(r * 0.24, h * 0.12, 24).translate(0, h / 2 + h * 0.05, 0)), 'steel', o);
  fl.userData.axial = h * 1.6;
  hub.userData.axial = h * 1.6;
  const fb = bolts(boltCircle(r * 0.62, 8, h / 2 + h * 0.08, Math.PI / 8), {r: Math.max(0.0028, r * 0.07), mat: 'dark', M});
  fb.userData.axial = h * 1.6;
  g.add(fl, hub, fb);

  // ---------------- internals
  const inner = [];
  const add = (geo, mat, axial) => {
    const m = mesh(geo, mat, {M, internal: true});
    m.userData.axial = axial;
    g.add(m);
    inner.push(m);
    return m;
  };
  const ri = r - t * 1.3;
  const y = (u) => -h / 2 + u * h; // 0 back .. 1 output
  add(cached(k + 'enc', () => cyl(ri * 0.62, h * 0.025, 32).translate(0, y(0.1), 0)), 'copper', -h * 1.9); // encoder disc
  add(cached(k + 'eh', () => rbox(ri * 0.22, h * 0.06, ri * 0.18, 0.002).translate(ri * 0.62, y(0.14), 0)), 'graphite', -h * 1.9); // read head
  add(cached(k + 'st', () => tube(ri * 0.98, ri * 0.62, h * 0.34, 36).translate(0, y(0.36), 0)), 'copper', -h * 0.9); // stator windings
  add(cached(k + 'sl', () => tube(ri, ri * 0.9, h * 0.38, 36).translate(0, y(0.36), 0)), 'graphite', -h * 0.9); // stator lamination sleeve
  add(cached(k + 'ro', () => cyl(ri * 0.56, h * 0.3, 28).translate(0, y(0.36), 0)), 'steel', -h * 0.4); // rotor + magnets
  add(cached(k + 'sh', () => cyl(r * 0.1, h * 0.92, 14).translate(0, y(0.5), 0)), 'steel', -h * 0.4); // shaft
  if (reducer === 'planetary') {
    add(cached(k + 'pr', () => tube(ri * 0.95, ri * 0.8, h * 0.16, 36).translate(0, y(0.68), 0)), 'steel', h * 0.35); // ring gear
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      add(cached(k + 'pp' + i, () => cyl(ri * 0.26, h * 0.14, 16).translate(Math.cos(a) * ri * 0.52, y(0.68), Math.sin(a) * ri * 0.52)), 'alu', h * 0.35);
    }
  } else {
    add(cached(k + 'cs', () => tube(ri * 0.96, ri * 0.78, h * 0.14, 40).translate(0, y(0.66), 0)), 'steel', h * 0.35); // circular spline
    add(cached(k + 'fs', () => tube(ri * 0.77, ri * 0.66, h * 0.2, 40).translate(0, y(0.63), 0)), 'alu', h * 0.6); // flexspline
    add(cached(k + 'wg', () => cyl(ri * 0.6, h * 0.1, 32).scale(1, 1, 0.82).translate(0, y(0.66), 0)), 'graphite', h * 0.85); // wave generator
  }
  add(cached(k + 'xb', () => tube(ri * 0.99, ri * 0.72, h * 0.12, 40).translate(0, y(0.86), 0)), 'steel', h * 1.15); // crossed-roller bearing
  add(cached(k + 'xr', () => new THREE.TorusGeometry(ri * 0.855, h * 0.03, 6, 40).rotateX(Math.PI / 2).translate(0, y(0.86), 0)), 'steel', h * 1.15); // roller race

  g.act = {r, len, top: h / 2 + h * 0.08, bottom: -h / 2, flange: fl, band, cut, inner, body};
  g.userData.actuator = true;
  return g;
}

// ------------------------------------------------------------ armour panel
/**
 * A white armour panel: l along x, thickness h along y, width w along z, outer face +y, centred on the origin.
 * opts.seams: tiles along x (number) or [nx, nz]; the tiles are separate rounded plates 3.5 mm apart, so the
 *   graphite under them shows through the seams. opts.bolts: true = a hole near every tile corner, or a number per
 *   tile edge. opts.vents: number of dark slots in the middle tile (or {n, len, at: [u, v]}). opts.radius: edge
 *   radius. opts.arch: crown height (m) over the width, curving the panel round x like a carapace plate;
 *   opts.archX the same over the length. opts.mat: 'ivory' | 'white'. opts.stripe: orange accent strip on top.
 * Returns a Group with .panel = {l, h, w, top(x, z)} (outer surface height at x, z).
 */
export function armorPanel(l, h, w, opts = {}) {
  const {M, mat = 'ivory', arch = 0, archX = 0, radius = Math.min(0.012, h * 0.45), gap = 0.0035} = opts;
  const g = new THREE.Group();
  const [nx, nz] = Array.isArray(opts.seams) ? opts.seams : [opts.seams || 1, 1];
  const bend = (x, z) => -arch * (2 * z / w) ** 2 - archX * (2 * x / l) ** 2;
  const bendGeo = (geo) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + bend(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    return geo;
  };
  const tiles = [];
  const tl = (l - gap * (nx - 1)) / nx;
  const tw = (w - gap * (nz - 1)) / nz;
  const seg = arch || archX ? 4 : 1;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const cx = -l / 2 + tl / 2 + i * (tl + gap);
      const cz = -w / 2 + tw / 2 + j * (tw + gap);
      const t = new RoundedBoxGeometry(tl, h, tw, seg, Math.min(radius, tl / 2.1, tw / 2.1, h / 2.1));
      tiles.push(t.translate(cx, 0, cz));
    }
  const plate = mesh(bendGeo(merge(tiles)), mat, {M});
  g.add(plate);
  // under-plate: graphite backing seen through the seams
  if (nx * nz > 1) {
    const under = mesh(bendGeo(rbox(l - 0.004, h * 0.5, w - 0.004, 0.002, 1).translate(0, -h * 0.3, 0)), 'graphite', {M});
    g.add(under);
  }
  const top = (x, z) => h / 2 + bend(x, z);
  const nrm = (x, z) => {
    const e = 0.002;
    return new V3(-(bend(x + e, z) - bend(x - e, z)) / (2 * e), 1, -(bend(x, z + e) - bend(x, z - e)) / (2 * e)).normalize().toArray();
  };
  // bolt holes near the tile corners (and along long edges when bolts is a number)
  if (opts.bolts) {
    const per = opts.bolts === true ? 2 : Math.max(2, opts.bolts);
    const list = [];
    const inset = Math.min(0.016, tl * 0.18, tw * 0.18);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const x0 = -l / 2 + i * (tl + gap) + inset;
        const x1 = x0 + tl - 2 * inset;
        const z0 = -w / 2 + j * (tw + gap) + inset;
        const z1 = z0 + tw - 2 * inset;
        for (let a = 0; a < per; a++) {
          const x = per === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * a) / (per - 1);
          for (const z of [z0, z1]) list.push({p: [x, top(x, z), z], n: nrm(x, z)});
        }
      }
    g.add(bolts(list, {M, r: opts.boltR ?? Math.min(0.0055, h * 0.5)}));
  }
  // vent slots: dark rounded bars sunk into the middle tile
  if (opts.vents) {
    const v = typeof opts.vents === 'number' ? {n: opts.vents} : opts.vents;
    const n = v.n;
    const sl = v.len ?? tl * 0.55;
    const [u0, v0] = v.at || [0, 0];
    const pitch = Math.min(0.016, (tw * 0.7) / n);
    const slots = [];
    for (let s = 0; s < n; s++) {
      const z = v0 * w / 2 + (s - (n - 1) / 2) * pitch;
      const x = u0 * l / 2;
      const geo = rbox(sl, h * 0.5, pitch * 0.45, pitch * 0.2, 1).translate(x, top(x, z) - h * 0.18, z);
      slots.push(geo);
    }
    g.add(mesh(merge(slots), 'rubber', {M}));
  }
  if (opts.stripe) {
    const s = opts.stripe === true ? {len: tl * 0.7, w: Math.min(0.018, tw * 0.12)} : opts.stripe;
    const at = s.at || [0, 0];
    const x = at[0] * l / 2;
    const z = at[1] * w / 2;
    g.add(mesh(bendGeo(rbox(s.len, h * 0.3, s.w, s.w * 0.4, 1).translate(x, h / 2 + h * 0.06, z)), 'graphite', {M}));
  }
  g.panel = {l, h, w, top};
  return g;
}

// ------------------------------------------------------------ grille
/** a vent grille facing +y: frame w (x) by h (z), n dark slats across it, a graphite back. Two draw calls. */
export function grille(w, h, n = 8, opts = {}) {
  const {M, t = 0.008} = opts;
  const g = new THREE.Group();
  const f = 0.006;
  const frame = [
    rbox(w, t, f, 0.002, 1).translate(0, 0, h / 2 - f / 2),
    rbox(w, t, f, 0.002, 1).translate(0, 0, -h / 2 + f / 2),
    rbox(f, t, h, 0.002, 1).translate(w / 2 - f / 2, 0, 0),
    rbox(f, t, h, 0.002, 1).translate(-w / 2 + f / 2, 0, 0),
  ];
  const pitch = (w - 2 * f) / n;
  for (let i = 0; i < n; i++) frame.push(new THREE.BoxGeometry(pitch * 0.38, t * 0.8, h - 2 * f).rotateZ(0.5).translate(-w / 2 + f + pitch * (i + 0.5), 0, 0));
  g.add(mesh(merge(frame), opts.mat || 'graphite', {M}));
  g.add(mesh(new THREE.BoxGeometry(w - 2 * f, t * 0.3, h - 2 * f).translate(0, -t * 0.45, 0), 'rubber', {M}));
  return g;
}

// ------------------------------------------------------------ ribbed link
/**
 * A hollow box link from x = 0 to x = len, height h (y), width w (z): graphite side rails top and bottom, transverse
 * ribs every ~45 mm, a steel end block each end, a cable channel inside (internal), and two white armour half
 * shells (the z faces, 70% of the length, seams + bolts + an orange stripe) leaving the dark frame visible at the
 * ends and along the top and bottom edges. opts.armor=false for a bare link. Returns Group with .link = {len,h,w}.
 */
export function ribbedLink(len, h, w, opts = {}) {
  const {M, armor = true, mat = 'ivory', stripe = false} = opts;
  const g = new THREE.Group();
  const t = Math.max(0.006, h * 0.12);
  const frame = [
    rbox(len, t, w * 0.86, t * 0.4, 1).translate(len / 2, h / 2 - t / 2, 0),
    rbox(len, t, w * 0.86, t * 0.4, 1).translate(len / 2, -h / 2 + t / 2, 0),
    new THREE.BoxGeometry(len * 0.92, h - 2 * t, t * 0.6).translate(len / 2, 0, 0), // web
  ];
  const nr = Math.max(2, Math.round(len / 0.045));
  for (let i = 1; i < nr; i++) frame.push(new THREE.BoxGeometry(t * 0.55, h - 2 * t, w * 0.8).translate((len * i) / nr, 0, 0));
  g.add(mesh(merge(frame), 'graphite', {M}));
  const ends = [rbox(t * 1.6, h * 0.92, w * 0.9, t * 0.3, 1).translate(t * 0.8, 0, 0), rbox(t * 1.6, h * 0.92, w * 0.9, t * 0.3, 1).translate(len - t * 0.8, 0, 0)];
  g.add(mesh(merge(ends), 'steel', {M}));
  g.add(mesh(cyl(Math.min(h, w) * 0.12, len * 0.9, 10).rotateZ(Math.PI / 2).translate(len / 2, 0, 0), 'rubber', {M, internal: true}));
  if (armor) {
    const al = len * 0.72;
    const ah = h * 0.86;
    const th = Math.max(0.006, w * 0.09);
    for (const s of [1, -1]) {
      const p = armorPanel(al, th, ah, {M, mat, seams: al > 0.16 ? 2 : 1, bolts: true, arch: th * 1.1, stripe: stripe && s > 0 ? {len: al * 0.4, w: Math.min(0.014, ah * 0.1), at: [0.2, 0]} : false, boltR: Math.min(0.0045, th * 0.5)});
      p.rotation.x = s * Math.PI / 2;
      p.position.set(len / 2, 0, s * (w / 2 - th * 0.15));
      p.traverse((m) => m.isMesh && (m.userData.shell = 'armor'));
      g.add(p);
    }
  }
  g.link = {len, h, w};
  return g;
}

// ------------------------------------------------------------ cable
/** a flexible cable along points ([[x,y,z]] or Vector3), radius r; .setPoints(points) rebuilds it in place */
export function cable(points, r = 0.008, opts = {}) {
  const {M, mat = 'dark', radial = 8} = opts;
  const make = (pts) => {
    const vs = pts.map((p) => (p.isVector3 ? p.clone() : new V3(...p)));
    const curve = new THREE.CatmullRomCurve3(vs, false, 'centripetal');
    return new THREE.TubeGeometry(curve, Math.max(8, vs.length * 8), r, radial, false);
  };
  const m = mesh(make(points), mat, {M});
  m.setPoints = (pts) => {
    m.geometry.dispose();
    m.geometry = make(pts);
    return m;
  };
  return m;
}

// ------------------------------------------------------------ place
const _x = new V3();
const _y = new V3();
const _z = new V3();
const _m = new THREE.Matrix4();
/**
 * Orient obj so its +x runs from a to b with its +y as close to `up` as possible (default world +y), positioned at a.
 * With opts.mid the object is centred between a and b instead. Returns the distance a→b.
 */
export function place(obj, a, b, up = Y, opts = {}) {
  const A = a.isVector3 ? a : new V3(...a);
  const B = b.isVector3 ? b : new V3(...b);
  const U = up.isVector3 ? up : new V3(...up);
  _x.subVectors(B, A);
  const d = _x.length();
  if (d < 1e-9) return 0;
  _x.divideScalar(d);
  _z.crossVectors(_x, U);
  if (_z.lengthSq() < 1e-9) _z.crossVectors(_x, Math.abs(_x.y) < 0.9 ? Y : new V3(0, 0, 1));
  _z.normalize();
  _y.crossVectors(_z, _x);
  _m.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_m);
  if (opts.mid) obj.position.lerpVectors(A, B, 0.5);
  else obj.position.copy(A);
  return d;
}
