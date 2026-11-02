// SCORPION SC-8, the geometry. White armour panels, black joint drums with an orange band, dark claw fingers and
// stinger, after pic/蝎子三视图.png. Everything is built from code; update(pose) places every part from kin.js, so
// the pose on screen is exactly the one the panels read.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {BODY, CLAW, LEG, LEGS, TAIL, clawAt, legsAt, tailAt} from './kin.js';

const V = THREE.Vector3;
const Y = new V(0, 1, 0);
export const COL = {white: '#f1f0ec', dark: '#2a2b2f', orange: '#ee5a24', steel: '#8b8f96'};

// how far each assembly flies out in the exploded view (metres, body frame)
const EXPLODE = {armor: [0, 0.5, 0], core: [0, 0.16, 0], chassis: [0, 0, 0], tail: [-0.42, 0.28, 0], clawL: [0.42, 0.06, 0.3], clawR: [0.42, 0.06, -0.3]};
LEGS.forEach((L, i) => (EXPLODE[`leg${i}`] = [L.hip[0] * 0.6, 0.04, L.side * 0.42]));
// which assembly stays solid when one is isolated
export const FOCUS = {leg: 'leg0', claw: 'clawL', tail: 'tail'};

export function buildRobot() {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);
  const M = {
    white: new THREE.MeshPhysicalMaterial({color: COL.white, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5}),
    dark: new THREE.MeshStandardMaterial({color: COL.dark, roughness: 0.55, metalness: 0.25}),
    orange: new THREE.MeshStandardMaterial({color: COL.orange, roughness: 0.45, metalness: 0.05}),
    steel: new THREE.MeshStandardMaterial({color: COL.steel, roughness: 0.45, metalness: 0.8, envMapIntensity: 0.6}),
    core: new THREE.MeshStandardMaterial({color: COL.orange, emissive: COL.orange, emissiveIntensity: 0.55, roughness: 0.4}),
  };
  const ghostSet = (tint) => {
    const g = {};
    for (const k in M) {
      g[k] = M[k].clone();
      g[k].transparent = true;
      g[k].depthWrite = false;
      if (tint) {
        g[k].color.set(tint);
        if (g[k].emissive) g[k].emissive.set('#000000');
      }
    }
    return g;
  };
  const GI = ghostSet('#cbc7bf'); // isolate: one pale grey so the focus part is the only colour
  const GX = ghostSet(); // x-ray of the armour

  const C = {};
  for (const k of Object.keys(EXPLODE)) {
    C[k] = new THREE.Group();
    (k.startsWith('leg') ? root : torso).add(C[k]);
  }
  const parts = [];
  const add = (geo, mat, group) => {
    const m = new THREE.Mesh(geo, M[mat]);
    m.castShadow = m.receiveShadow = true;
    m.userData = {group, mat};
    C[group].add(m);
    parts.push(m);
    return m;
  };
  const box = (l, h, w, r = 0.02) => new RoundedBoxGeometry(l, h, w, 3, Math.min(r, h / 2.2, w / 2.2, l / 2.2));
  const drum = (r, h) => new THREE.CylinderGeometry(r, r, h, 28);
  const cone = (r, len) => new THREE.ConeGeometry(r, len, 20).translate(0, len / 2, 0);
  const q = new THREE.Quaternion();
  const joint = (r, h, group, band = true) => {
    const ms = [add(drum(r, h), 'dark', group), add(drum(r * 0.42, h * 1.1), 'steel', group)];
    if (band) ms.push(add(drum(r * 1.07, h * 0.3), 'orange', group));
    return (p, axis) => {
      q.setFromUnitVectors(Y, axis);
      for (const m of ms) {
        m.position.copy(p);
        m.quaternion.copy(q);
      }
      return ms[0];
    };
  };
  const mB = new THREE.Matrix4();
  const bx = new V();
  const by = new V();
  const bz = new V();
  const link = (len, h, w, mat, group, r) => {
    const m = add(box(len, h, w, r), mat, group);
    const f = (a, b, n, off = 0) => {
      bx.subVectors(b, a).normalize();
      bz.copy(n).addScaledVector(bx, -n.dot(bx)).normalize();
      by.crossVectors(bz, bx);
      mB.makeBasis(bx, by, bz);
      m.quaternion.setFromRotationMatrix(mB);
      m.position.lerpVectors(a, b, 0.5).addScaledVector(by, off);
      return m;
    };
    f.mesh = m;
    return f;
  };
  const point = (geo, mat, group) => {
    const m = add(geo, mat, group);
    return (p, dir) => {
      m.position.copy(p);
      m.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
      return m;
    };
  };

  // ------------------------------------------------------------ chassis, internals, armour
  const R = BODY.ride;
  add(box(1.0, 0.16, 0.34, 0.04), 'dark', 'chassis').position.set(-0.01, R, 0);
  for (const s of [1, -1]) add(box(0.68, 0.06, 0.05, 0.02), 'steel', 'chassis').position.set(0.0, R, 0.2 * s);
  LEGS.forEach((L) => joint(0.06, 0.13, 'chassis')(new V(...L.hip), Y));

  const coreMesh = add(drum(0.075, 0.34), 'core', 'core');
  coreMesh.rotation.z = Math.PI / 2;
  coreMesh.position.set(-0.06, R + 0.1, 0);
  for (const dx of [-0.2, 0.08]) {
    const m = add(drum(0.09, 0.03), 'steel', 'core');
    m.rotation.z = Math.PI / 2;
    m.position.set(dx, R + 0.1, 0);
  }
  const ccu = add(box(0.2, 0.06, 0.2, 0.015), 'dark', 'core');
  ccu.position.set(0.25, R + 0.11, 0);
  add(box(0.05, 0.02, 0.12, 0.008), 'orange', 'core').position.set(0.25, R + 0.145, 0);
  for (const s of [1, -1]) add(box(0.22, 0.07, 0.07, 0.015), 'steel', 'core').position.set(-0.34, R + 0.09, 0.08 * s);

  const plates = [];
  {
    const head = add(box(0.26, 0.1, 0.42, 0.04), 'white', 'armor');
    head.position.set(0.39, R + 0.12, 0);
    head.rotation.z = -0.14;
    plates.push(head);
    for (const s of [1, -1]) {
      add(new THREE.SphereGeometry(0.028, 18, 12), 'dark', 'armor').position.set(0.52, R + 0.1, 0.07 * s);
      const e = add(drum(0.034, 0.012), 'orange', 'armor');
      e.rotation.z = Math.PI / 2;
      e.position.set(0.512, R + 0.1, 0.07 * s);
    }
    const N = 6;
    for (let i = 0; i < N; i++) {
      const x = 0.2 - i * 0.135;
      const w = 0.5 - i * 0.035;
      const y = R + 0.15 + 0.025 * Math.cos((i / (N - 1)) * Math.PI - 0.6);
      const top = add(box(0.13, 0.05, w * 0.62, 0.02), 'white', 'armor');
      top.position.set(x, y, 0);
      plates.push(top);
      for (const s of [1, -1]) {
        const sk = add(box(0.13, 0.04, w * 0.24, 0.015), 'white', 'armor');
        sk.position.set(x, y - 0.045, s * w * 0.38);
        sk.rotation.x = s * 0.55;
      }
      if (i === 1 || i === 3) add(box(0.135, 0.012, 0.05, 0.005), 'orange', 'armor').position.set(x, y + 0.03, 0);
    }
  }

  // ------------------------------------------------------------ tail: 7 segments and the stinger
  const tail = [];
  TAIL.seg.forEach((len, j) => {
    const k = j / (TAIL.seg.length - 1);
    const h = 0.13 - 0.04 * k;
    const w = 0.15 - 0.05 * k;
    tail.push({j: joint(0.072 - 0.022 * k, w * 1.18, 'tail'), l: link(len * 0.72, h, w, 'white', 'tail', 0.025)});
  });
  const stingJ = joint(0.045, 0.12, 'tail');
  const bulb = link(0.13, 0.11, 0.11, 'white', 'tail', 0.035);
  const collar = point(new THREE.CylinderGeometry(0.05, 0.045, 0.05, 20).translate(0, 0.025, 0), 'orange', 'tail');
  const spike = point(cone(0.042, 0.17), 'dark', 'tail');

  // ------------------------------------------------------------ claws
  const claws = [1, -1].map((side) => {
    const g = side > 0 ? 'clawL' : 'clawR';
    return {
      side,
      sJ: joint(0.06, 0.11, g),
      arm: link(CLAW.arm * 0.8, 0.1, 0.1, 'white', g, 0.03),
      eJ: joint(0.055, 0.12, g),
      fore: link(CLAW.fore * 0.82, 0.13, 0.13, 'white', g, 0.04),
      wJ: joint(0.058, 0.13, g),
      palm: link(CLAW.palm, 0.17, 0.15, 'white', g, 0.05),
      band: link(0.04, 0.175, 0.155, 'orange', g, 0.01),
      fixed: point(cone(0.05, CLAW.finger), 'dark', g),
      move: point(cone(0.045, CLAW.finger * 0.92), 'dark', g),
      hinge: joint(0.03, 0.1, g, false),
    };
  });

  // ------------------------------------------------------------ legs
  const legs = LEGS.map((_, i) => {
    const g = `leg${i}`;
    return {
      coxa: link(LEG.coxa * 0.9, 0.06, 0.07, 'dark', g, 0.02),
      fJ: joint(0.05, 0.1, g),
      femur: link(LEG.femur * 0.8, 0.075, 0.08, 'white', g, 0.025),
      kJ: joint(0.046, 0.1, g),
      tibia: link(LEG.tibia * 0.72, 0.065, 0.068, 'white', g, 0.022),
      aJ: joint(0.034, 0.08, g),
      tip: point(cone(0.026, 0.08), 'dark', g),
    };
  });

  const anchors = {};
  const tv = (p, z = 0) => new V(p[0], p[1], z);
  const v3 = (p) => new V(p[0], p[1], p[2]);

  /** pose: {X, PHI, strike, stow, open, reach, iso: {leg, claw, tail}, xray, explode} */
  function update(pose) {
    const {PHI = 0, strike = 0, stow = 0, open = 0.3, reach = 0, xray = 0, explode = 0} = pose;
    const iso = pose.iso || {};
    root.position.set(pose.X || 0, 0, 0);
    const L = legsAt(PHI);
    torso.position.y = L.bob;
    for (const k in C) {
      const e = EXPLODE[k];
      C[k].position.set(e[0] * explode, e[1] * explode, e[2] * explode);
    }

    // tail
    const T = tailAt(strike, stow);
    const Z = new V(0, 0, 1);
    tail.forEach((s, j) => {
      const a = tv(T.pts[j]);
      const b = tv(T.pts[j + 1]);
      const jm = s.j(a, Z);
      s.l(a, b, Z);
      if (j === 0) anchors.tailDrive = jm;
      if (j === 3) anchors.tailMid = s.l.mesh;
    });
    {
      const a = tv(T.pts[7]);
      const b = tv(T.pts[8]);
      stingJ(a, Z);
      const d = b.clone().sub(a).normalize();
      const m = a.clone().addScaledVector(d, 0.1);
      bulb(a, m, Z);
      collar(m, d);
      // the spike hooks under: its axis turns 35 deg past the segment
      const hook = d.clone().applyAxisAngle(Z, -0.6);
      anchors.sting = spike(m.clone().addScaledVector(d, 0.04), hook);
    }

    // claws
    for (const c of claws) {
      const P = clawAt(c.side, open, reach);
      const S = v3(P.S);
      const E = v3(P.E);
      const W = v3(P.W);
      const up = new V(0, 1, 0);
      c.sJ(S, up);
      c.arm(S, E, up);
      c.eJ(E, up);
      c.fore(E, W, up);
      c.wJ(W, up);
      const d = new V(Math.cos(P.yaw3), -0.08, Math.sin(P.yaw3)).normalize();
      const Pm = W.clone().addScaledVector(d, 0.04);
      const Pe = W.clone().addScaledVector(d, CLAW.palm + 0.03);
      const palm = c.palm(Pm, Pe, up);
      c.band(Pm.clone().addScaledVector(d, 0.03), Pm.clone().addScaledVector(d, 0.07), up);
      const out = new V().crossVectors(up, d).multiplyScalar(-c.side); // toward the outside of this claw
      const base = Pe.clone().addScaledVector(out, -0.03);
      c.fixed(base, d.clone().addScaledVector(out, -0.12));
      const hingeP = Pe.clone().addScaledVector(out, 0.04);
      c.hinge(hingeP, up);
      const md = d.clone().applyAxisAngle(up, c.side * -P.gap).addScaledVector(out, 0.1);
      const mv = c.move(hingeP, md);
      if (c.side > 0) {
        anchors.claw = palm;
        anchors.clawTip = mv;
      }
    }

    // legs
    L.legs.forEach((l, i) => {
      const s = legs[i];
      const hip = v3(l.hip);
      const c = v3(l.coxaEnd);
      const k = v3(l.kneeP);
      const f = v3(l.footP);
      const n = new V(-l.uz, 0, l.ux).normalize();
      s.coxa(hip, c, Y.clone().cross(n).lengthSq() > 0 ? n : Y);
      const fm = s.fJ(c, n);
      s.femur(c, k, n);
      const km = s.kJ(k, n);
      const a = k.clone().lerp(f, 0.86);
      s.tibia(k, a, n);
      s.aJ(a, n);
      s.tip(a, f.clone().sub(a));
      if (i === 0) {
        anchors.knee = km;
        anchors.femurJ = fm;
        anchors.footL1 = s.tibia.mesh;
      }
    });
    anchors.armor = plates[3];
    anchors.core = coreMesh;
    anchors.ccu = ccu;

    // isolate and x-ray: everything outside the focus turns to glass
    const isoAmt = Math.max(iso.leg || 0, iso.claw || 0, iso.tail || 0);
    const focus = new Set(Object.entries(FOCUS).filter(([k]) => (iso[k] || 0) > 0.01).map(([, g]) => g));
    for (const k in GI) GI[k].opacity = 1 - 0.88 * isoAmt;
    for (const k in GX) GX[k].opacity = 1 - 0.86 * xray;
    for (const m of parts) {
      const {group, mat} = m.userData;
      const gi = focus.has(group) ? 0 : isoAmt;
      const gx = group === 'armor' ? xray : 0;
      const g = Math.max(gi, gx);
      m.material = g < 0.01 ? M[mat] : gx >= gi ? GX[mat] : GI[mat];
      m.castShadow = g < 0.5;
    }
    root.updateMatrixWorld(true);
    return L;
  }

  const wp = new V();
  const anchorAt = (k) => (anchors[k] ? anchors[k].getWorldPosition(wp).toArray() : null);
  return {root, update, anchorAt, parts, materials: M};
}
