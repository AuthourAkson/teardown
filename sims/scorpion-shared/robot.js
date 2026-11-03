// SCORPION SC-8, the assembly (lead-owned). Built the way the machine would be built: the central body from
// body.js, eight legs from legs.js, the two claws from claws.js and the eight-section tail from tail.js, all
// posed from kin.js through one pose object, so the film, the live page and the console never disagree.
//   parts    every shadow-casting mesh with userData {sys, mat, internal, order, explode, cut}
//   units    the explode stage of every group (body units, each leg, each claw, tail + stinger), reverse assembly
//            order from parts.EXPLODE_STAGES, plus the axial explode of the live actuators' internals
//   section  pose.cut slides one clipping plane through the body shell only (limbs stay whole); the AO pass gets the
//            same plane (SKILL.md trap)
//   jointCut opens the featured actuators (L1 hip yaw / hip pitch / knee, claw L yaw / pitch, tail J1)
//   ghosts   pose.iso / pose.xray swap the other assemblies to pale glass; the focus part keeps its colour
import * as THREE from 'three';
import {CLAW, LEGS, TAIL, BODY, clawAt, legsAt, tailAt} from './kin.js';
import {EXPLODE_STAGES, explodeAt, makeMaterials} from './parts.js';
import {buildBody} from './body.js';
import {buildLegs} from './legs.js';
import {buildClaws} from './claws.js';
import {buildTail} from './tail.js';

const V3 = THREE.Vector3;
// kept for older consumers (the live page used the old robot shape); the film reads anchors through anchorAt()
export const COL = {white: '#f6f5f1', dark: '#232428', orange: '#ee5a24', steel: '#a2a7ae'};
export const FOCUS = {leg: 'leg0', claw: 'clawL', tail: 'tail'};
const BODY_SYS = new Set(['chassis', 'armor', 'power', 'control', 'drive', 'thermal', 'sensor']);
const GHOST_TINT = '#cbc7bf';
const CUT_FULL = 0.62; // plane constant at cut = 0: behind the body, nothing clipped
const CUT_ZERO = -0.085; // plane constant at cut = 1: keeps the robot's right half of the body

export function buildRobot() {
  const root = new THREE.Group();
  root.name = 'sc8';
  const torso = new THREE.Group();
  torso.name = 'torso';
  root.add(torso);

  const M = makeMaterials();
  const body = buildBody(M);
  const legs = buildLegs(M);
  const claws = buildClaws(M);
  const tail = buildTail(M);
  torso.add(body.group, claws.group, tail.group);
  root.add(legs.group);

  // ------------------------------------------------------------ section plane: body shell and bays only
  const plane = new THREE.Plane(new V3(0, 0, -1), CUT_FULL);
  const clipPlanes = [plane];
  const clipped = (mat) => {
    mat.clippingPlanes = clipPlanes;
    mat.clipShadows = true;
    mat.needsUpdate = true;
    return mat;
  };
  const clipMats = {};
  for (const k in M) clipMats[k] = clipped(M[k].clone());

  // ------------------------------------------------------------ ghost materials (isolate / x-ray)
  const ghostSet = (tint) => {
    const g = {};
    for (const k in M) {
      const c = M[k].clone();
      c.transparent = true;
      c.depthWrite = false;
      c.clippingPlanes = null;
      if (tint) {
        c.color.set(tint);
        if (c.emissive) c.emissive.set('#000000');
        if (c.emissiveIntensity !== undefined) c.emissiveIntensity = 0;
      }
      g[k] = c;
    }
    return g;
  };
  const GI = ghostSet(GHOST_TINT);
  const GX = ghostSet(null);

  // ------------------------------------------------------------ collect meshes, units, actuators
  const parts = [];
  root.traverse((o) => {
    if (o.isMesh) parts.push(o);
  });
  const recs = parts.map((m) => {
    const sys = m.userData.sys || 'chassis';
    return {m, key: m.userData.mat || 'graphite', sys, body: BODY_SYS.has(sys)};
  });

  // explode units: body units from body.js, each limb assembly from its own tag() stamp
  const unitOf = (group, fallbackOrder) => {
    let explode = null;
    let order = fallbackOrder;
    group.traverse((o) => {
      if (explode) return;
      if (o.isMesh && Array.isArray(o.userData.explode)) {
        explode = o.userData.explode;
        if (typeof o.userData.order === 'number') order = o.userData.order;
      }
    });
    return {g: group, e: explode || [0, 0, 0], order};
  };
  const units = [];
  for (const u of body.units || []) units.push({g: u.group, e: u.explode || [0, 0, 0], order: u.order || 0});
  for (const g of Object.values(legs.assemblies || {})) units.push(unitOf(g, 5));
  for (const g of Object.values(claws.assemblies || {})) units.push(unitOf(g, 4));
  for (const g of Object.values(tail.assemblies || {})) units.push(unitOf(g, 3));

  // the live actuators' internals slide out axially on explode stage 7
  const axial = [];
  root.traverse((o) => {
    if (o.isMesh && o.userData.axial !== undefined) axial.push({m: o, y0: o.position.y, k: o.userData.axial});
  });

  // jointCut: the quarter-shell windows of the featured actuators slide out along their own cut direction
  const jointActs = [
    legs.joints && legs.joints.hipYawL1,
    legs.joints && legs.joints.hipL1,
    legs.joints && legs.joints.kneeL1,
    claws.joints && claws.joints.clawLYaw,
    claws.joints && claws.joints.clawL,
    tail.joints && tail.joints.tailJ1,
  ].filter(Boolean);
  const windows = [];
  for (const g of jointActs) {
    const A = g.act;
    if (!A || !Array.isArray(A.cut)) continue;
    for (const m of A.cut) {
      windows.push({m, p0: m.position.clone(), dir: new V3(...(m.userData.cutDir || [0, 0, 1])), r: A.r});
    }
  }

  // ------------------------------------------------------------ anchors
  const anchors = Object.assign({}, tail.anchors || {}, claws.anchors || {}, legs.anchors || {}, body.anchors || {});
  const wp = new V3();
  const anchorAt = (k) => (anchors[k] ? anchors[k].getWorldPosition(wp).toArray() : null);

  const isoFocus = (iso) => {
    const f = new Set();
    if ((iso.leg || 0) > 0.01) f.add('leg0');
    if ((iso.claw || 0) > 0.01) f.add('clawL');
    if ((iso.tail || 0) > 0.01) {
      f.add('tail');
      f.add('stinger');
    }
    return f;
  };

  /**
   * pose: {X, PHI, settle, lift, strike, stow, tailYaw, open, reach, squeeze, iso:{leg,claw,tail}, xray,
   *        explode, cut, jointCut}
   */
  function update(pose = {}) {
    const X = pose.X || 0;
    const PHI = pose.PHI || 0;
    const settle = pose.settle || 0;
    const lift = pose.lift || 0;
    const strike = pose.strike || 0;
    const stow = pose.stow || 0;
    const tailYaw = pose.tailYaw || 0;
    const open = pose.open === undefined ? 0.18 : pose.open;
    const reach = pose.reach || 0;
    const explode = pose.explode || 0;
    const cut = pose.cut || 0;
    const jointCut = pose.jointCut || 0;
    const xray = pose.xray || 0;
    const iso = pose.iso || {};

    root.position.set(X, 0, 0);
    const L = legsAt(PHI, lift, settle);
    torso.position.y = L.bob;
    legs.update(L);
    claws.update({L: clawAt(1, open, reach), R: clawAt(-1, open, reach)});
    tail.update(tailAt(strike, stow, tailYaw));
    if (body.update) body.update(pose);

    // reverse-assembly explode
    for (const u of units) {
      const a = explodeAt(explode, u.order);
      u.g.position.set(u.e[0] * a, u.e[1] * a, u.e[2] * a);
    }
    const a7 = explodeAt(explode, 7);
    for (const s of axial) s.m.position.y = s.y0 + s.k * a7;

    // section plane through the body
    plane.constant = CUT_FULL + (CUT_ZERO - CUT_FULL) * Math.min(1, Math.max(0, cut));

    // featured actuator windows
    for (const w of windows) w.m.position.copy(w.p0).addScaledVector(w.dir, w.r * 1.35 * jointCut);

    // isolate / x-ray ghosts
    const focus = isoFocus(iso);
    const isoAmt = Math.max(iso.leg || 0, iso.claw || 0, iso.tail || 0);
    const giOp = 1 - 0.88 * isoAmt;
    const gxOp = 1 - 0.86 * xray;
    for (const k in GI) GI[k].opacity = giOp;
    for (const k in GX) GX[k].opacity = gxOp;
    for (const r of recs) {
      const gi = isoAmt > 0.01 && !focus.has(r.sys) ? isoAmt : 0;
      const gx = xray > 0.01 && r.sys === 'armor' ? xray : 0;
      const g = Math.max(gi, gx);
      if (g < 0.01) r.m.material = r.body ? clipMats[r.key] : M[r.key];
      else r.m.material = gx >= gi ? GX[r.key] : GI[r.key];
      r.m.castShadow = g < 0.5;
    }

    root.updateMatrixWorld(true);
    return L;
  }

  return {root, update, anchorAt, parts, materials: M, clipPlanes, EXPLODE_STAGES, FOCUS};
}
