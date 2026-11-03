// SCORPION SC-8, the central body (spec §2, §6, §7.1): the load-bearing frame, the five bays and their modules, the
// sensor head, the harness and the three-layer armour. Built from code in metres, body frame (x forward, y up, z left),
// every interface number read from kin.js so the limbs bolt on where the math puts them:
//   frame    central spine beam (box section, lightening holes) on posts over four cross beams, two side beams with
//            eight steel hip pads (outer face |hip.z| - 0.065), a front frame with two claw outriggers and their
//            yaw flanges (top at CLAW.shoulder.y - 0.14), a rear frame with the tail deck, gussets and the J1
//            turntable flange (top at TAIL.root.y - 0.15), the equipment tray hung under the side beams
//   bays     power (8 battery modules, BMS, busbars) on the tray, PDU (contactors, fuse, pre-charge, DC bus, isolated
//            aux supply) behind it, thermal (pump, reservoir, radiator, fans, cold plates, copper loop), drive (servo
//            drive cards on a cold plate, aux controller, leg connectors), control (computer, motion controller,
//            comms) under the glass canopy, sensor bay (IMU on isolators, positioning module, perception unit)
//   head     sensor head between the claw bases: stereo pair, depth camera, lidar puck, IR module, lamps, smoked glass
//   armour   layer 1 white tergite plates / glass canopy / belly / rear quarters (seams, bolt holes, vents, service
//            covers), layer 2 rubber isolators on standoffs, layer 3 the armour hoops on the frame
// Static parts are merged per material inside each explode unit, so the whole body is a few hundred draw calls.
import * as THREE from 'three';
import {BODY, CLAW, LEGS, TAIL} from './kin.js';
import {armorPanel, bolts, boltCircle, cable, grille, merge, mesh, rbox, tag} from './parts.js';

const V3 = THREE.Vector3;
const R = BODY.ride; // 0.42, hip line
const PAD_BACK = 0.065; // hip pad outer face sits this far inside the hip point (legs.js MOUNT_BACK)
const BEAM_Z = 0.115; // side beam centre line
const BEAM_W = 0.04;
const BEAM_H = 0.09;
const TRAY_Y = 0.268; // tray plate centre
const DECK_Y = 0.437; // mid deck plates on the cross beams
const SPINE_Y = 0.5125; // central beam centre (0.49..0.535)
const FRONT_X = 0.43; // front frame
const REAR_X = -0.4; // rear frame
const CROSS_X = [0.34, 0.115, -0.12, -0.355];
const FLANGE_TOP_CLAW = CLAW.shoulder[1] - 0.14;
const FLANGE_TOP_TAIL = TAIL.root[1] - 0.15;

const _E = new THREE.Euler();
const _M = new THREE.Matrix4();
const rot = (g, r) => (r ? g.applyMatrix4(_M.makeRotationFromEuler(_E.set(r[0] || 0, r[1] || 0, r[2] || 0))) : g);
const cylAxis = (r, h, axis, seg, r2 = r) => {
  const g = new THREE.CylinderGeometry(r2, r, h, seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
};
const ringAxis = (rO, rI, h, axis, seg = 40) => {
  const c = Math.min(h * 0.2, (rO - rI) * 0.25);
  const p = [[rI, -h / 2], [rO - c, -h / 2], [rO, -h / 2 + c], [rO, h / 2 - c], [rO - c, h / 2], [rI, h / 2], [rI, -h / 2]];
  const g = new THREE.LatheGeometry(p.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
};
/** a flat plate from a 2D outline in the xy plane, thickness t along z, centred on z */
const plate2 = (pts, t, z) => {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(s, {depth: t, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1}).translate(0, 0, z - t / 2);
};

/**
 * An explode unit: one Group (at the body origin, so explode is a plain offset) collecting static geometry per
 * material, bolt holes and bolt heads; flush() turns each material bucket into one mesh and stamps the CONTRACT tags.
 */
function makeUnit(M, parent, ud) {
  const group = new THREE.Group();
  group.name = ud.name || ud.sys;
  parent.add(group);
  const geos = new Map();
  const holes = [];
  const heads = [];
  const u = {
    group,
    ud,
    add(mat, geo) {
      if (!geos.has(mat)) geos.set(mat, []);
      geos.get(mat).push(geo);
      return geo;
    },
    box(mat, l, h, w, x, y, z, r = 0.004, rr) {
      return u.add(mat, rot(rbox(l, h, w, r, 1), rr).translate(x, y, z));
    },
    cyl(mat, r, h, x, y, z, axis = 'y', seg = 24, r2 = r) {
      return u.add(mat, cylAxis(r, h, axis, seg, r2).translate(x, y, z));
    },
    ring(mat, rO, rI, h, x, y, z, axis = 'y', seg = 40) {
      return u.add(mat, ringAxis(rO, rI, h, axis, seg).translate(x, y, z));
    },
    hole(p, n = [0, 1, 0], r) {
      holes.push({p, n, r});
    },
    head(p, n = [0, 1, 0], r) {
      heads.push({p, n, r});
    },
    obj(o) {
      group.add(o);
      return o;
    },
    marker(x, y, z) {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      group.add(o);
      return o;
    },
    flush() {
      for (const [mat, list] of geos) group.add(mesh(merge(list), mat, {M}));
      if (holes.length) group.add(bolts(holes, {M, r: 0.0045}));
      if (heads.length) group.add(bolts(heads, {M, r: 0.0042, head: true, mat: 'steel'}));
      tag(group, {sys: ud.sys, order: ud.order, explode: ud.explode, cut: ud.cut, internal: !!ud.internal});
      group.userData.unit = {order: ud.order, explode: ud.explode};
      return group;
    },
  };
  return u;
}

// ------------------------------------------------------------ buildBody helpers
/** a flat plate with circular lightening holes: outline l x h in the xy plane, thickness t along z, centred */
function holedPlate(l, h, t, holes) {
  const s = new THREE.Shape();
  s.moveTo(-l / 2, -h / 2);
  s.lineTo(l / 2, -h / 2);
  s.lineTo(l / 2, h / 2);
  s.lineTo(-l / 2, h / 2);
  s.closePath();
  for (const [x, y, r] of holes) {
    const p = new THREE.Path();
    p.absarc(x, y, r, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  return new THREE.ExtrudeGeometry(s, {depth: t, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1, curveSegments: 14}).translate(0, 0, -t / 2);
}
const _va = new V3();
const _vb = new V3();
const _vx = new V3();
const _vy = new V3();
const _vz = new V3();
/** a round tube through a list of 3D points */
function tubeGeo(points, r, seg = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p.clone() : new V3(...p))), false, 'centripetal');
  return new THREE.TubeGeometry(curve, Math.max(10, points.length * 6), r, seg, false);
}
/** a rounded-box strut from a to b, h tall and w wide, local +x along a->b, up hint +y */
function strutGeo(a, b, h, w, r = 0.004, up = [0, 1, 0]) {
  _va.set(...a);
  _vb.set(...b);
  _vx.subVectors(_vb, _va);
  const len = _vx.length();
  _vx.normalize();
  _vy.set(...up);
  _vz.crossVectors(_vx, _vy);
  if (_vz.lengthSq() < 1e-8) {
    _vy.set(1, 0, 0);
    _vz.crossVectors(_vx, _vy);
  }
  _vz.normalize();
  _vy.crossVectors(_vz, _vx).normalize();
  const g = rbox(len, h, w, r, 1);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(_vx.clone(), _vy.clone(), _vz.clone()));
  g.translate((_va.x + _vb.x) / 2, (_va.y + _vb.y) / 2, (_va.z + _vb.z) / 2);
  return g;
}
/** an elliptical arch rib in the yz plane at x: (zHalf, y0) over (0, apex) to (-zHalf, y0), a round tube */
function archGeo(x, zHalf, y0, apex, r = 0.013, segs = 9) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const ang = -Math.PI / 2 + (i / segs) * Math.PI;
    pts.push(new V3(x, y0 + (apex - y0) * Math.cos(ang), zHalf * Math.sin(ang)));
  }
  return tubeGeo(pts, r, 6);
}
/** a half-torus rib over the y axis (canopy hoop) at x, scaled to a dome */
function canopyRib(x, ry, rz, thickness, y0) {
  const g = new THREE.TorusGeometry(1, thickness, 6, 22, Math.PI);
  g.rotateY(Math.PI / 2);
  g.scale(1, ry, rz);
  return g.translate(x, y0, 0);
}
const lerp = (t, a, b) => a + (b - a) * t;
/** a piecewise linear profile: pts = [[x, value], ...] ascending in x */
const profile = (pts) => (x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) return lerp((x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]), pts[i - 1][1], pts[i][1]);
  }
  return pts[pts.length - 1][1];
};

/**
 * buildBody(M) -> {group, units, anchors, update(pose)} (CONTRACT.md, "Integration addendum").
 * group    body frame origin (x forward, y up, z left), ground y = 0; every visible mesh is in exactly one unit
 * units    explode units, direct children of group: chassis 0, armour 1, sensor head 2, the five bay modules 6
 * anchors  armor sensor head power control drive thermal (Object3D markers on the part each one names)
 * update   no body-internal animation yet (the canopy, bays and head move with their explode units only)
 */
export function buildBody(M) {
  const group = new THREE.Group();
  group.name = 'body';
  const units = [];
  const anchors = {};
  const unit = (name, sys, order, explode, opts = {}) => {
    const u = makeUnit(M, group, {name, sys, order, explode, cut: opts.cut !== false, internal: !!opts.internal});
    units.push({group: u.group, order, explode});
    return u;
  };
  // explode units: the chassis stays, the three armour layers lift, the head flies forward, the modules splay out
  const U = {
    chassis: unit('chassis', 'chassis', 0, [0, 0, 0]),
    armour: unit('armour', 'armor', 1, [0, 0.48, 0]),
    head: unit('head', 'sensor', 2, [0.42, 0.24, 0], {cut: false}),
    power: unit('power', 'power', 6, [0.0, 0.34, -0.5]),
    control: unit('control', 'control', 6, [0.0, 0.52, 0.42]),
    drive: unit('drive', 'drive', 6, [-0.34, 0.3, -0.44]),
    thermal: unit('thermal', 'thermal', 6, [-0.46, 0.36, 0.34]),
    sensor: unit('sensor', 'sensor', 6, [0.46, 0.32, 0.38]),
  };
  // carapace silhouette: half width and top height of the plate shell along x (body frame, metres)
  // hwAt: the hoops (layer 3) on the frame; shellAt: the white plates (layer 1), cantilevered past the hoops to the
  // reference's ~700 mm carapace width, edge kept at y >= 0.53 so the legs (max 0.525 inside |z| 0.34) pass under
  const hwAt = profile([[-0.54, 0.175], [-0.42, 0.205], [-0.25, 0.228], [-0.05, 0.242], [0.15, 0.238], [0.32, 0.222], [0.44, 0.2], [0.56, 0.155]]);
  const shellAt = profile([[-0.54, 0.22], [-0.42, 0.285], [-0.25, 0.325], [-0.05, 0.338], [0.15, 0.335], [0.3, 0.305], [0.38, 0.26], [0.44, 0.215], [0.56, 0.16]]);
  const topAt = profile([[-0.54, 0.548], [-0.42, 0.575], [-0.2, 0.596], [0.0, 0.604], [0.2, 0.598], [0.32, 0.586], [0.44, 0.572], [0.56, 0.55]]);

  // ========================================================== chassis (explode order 0)
  const c = U.chassis;
  // central load-bearing spine beam: a box section with lightening holes in its webs, on posts over the cross beams
  const SPX0 = REAR_X;
  const SPX1 = FRONT_X;
  const SPL = SPX1 - SPX0;
  const SPCX = (SPX0 + SPX1) / 2;
  const SPW = 0.17;
  const SPY0 = 0.49;
  const SPY1 = 0.535;
  const SPCY = (SPY0 + SPY1) / 2;
  const webHoles = [-0.3, -0.15, 0, 0.15, 0.3].map((x) => [x, 0, 0.0115]);
  for (const s of [1, -1]) c.add('graphite', holedPlate(SPL, SPY1 - SPY0, 0.006, webHoles).translate(SPCX, SPCY, s * (SPW / 2 - 0.003)));
  c.box('graphite', SPL, 0.007, SPW, SPCX, SPY1 - 0.0035, 0, 0.002);
  c.box('graphite', SPL, 0.007, SPW, SPCX, SPY0 + 0.0035, 0, 0.002);
  for (const x of [SPX0 + 0.006, SPX1 - 0.006]) c.box('steel', 0.012, SPY1 - SPY0, SPW, x, SPCY, 0, 0.002);
  for (const x of [-0.33, -0.17, 0.0, 0.17, 0.33]) for (const s of [1, -1]) c.hole([x, SPY1 - 0.001, s * 0.062], [0, 1, 0], 0.005);
  for (const x of CROSS_X) for (const s of [1, -1]) c.box('graphite', 0.03, 0.052, 0.03, x, 0.4665, s * 0.058, 0.004);

  // side beams: I-section, the eight steel hip pads bolt onto them (pad outer face at |hip.z| - 0.065, legs.js MOUNT_BACK)
  for (const s of [1, -1]) {
    const z = s * BEAM_Z;
    c.box('dark', 0.85, 0.012, 0.04, 0.005, R + BEAM_H / 2 - 0.006, z, 0.003);
    c.box('dark', 0.85, 0.012, 0.04, 0.005, R - BEAM_H / 2 + 0.006, z, 0.003);
    c.box('dark', 0.85, BEAM_H - 0.024, 0.008, 0.005, R, z, 0.002);
    for (const x of [-0.36, -0.18, 0, 0.18, 0.36]) c.hole([x, R, s * (BEAM_Z + BEAM_W / 2 - 0.001)], [0, 0, s], 0.005);
  }
  for (const L of LEGS) {
    const s = Math.sign(L.hip[2]);
    const face = Math.abs(L.hip[2]) - PAD_BACK; // outer face of the pad, where legs.js MOUNT_BACK starts
    const inner = face - 0.012;
    c.box('steel', 0.085, 0.1, 0.012, L.hip[0], L.hip[1], s * (face - 0.006), 0.004);
    const gap = Math.max(0.002, inner - (BEAM_Z + BEAM_W / 2));
    c.box('graphite', 0.07, 0.075, gap, L.hip[0], L.hip[1], s * (inner - gap / 2), 0.003);
    for (const dx of [-0.026, 0.026]) for (const dy of [-0.032, 0.032]) c.hole([L.hip[0] + dx, L.hip[1] + dy, s * (face - 0.001)], [0, 0, s], 0.0042);
  }

  // four cross beams + the mid deck plates between them
  for (const x of CROSS_X) {
    c.box('graphite', 0.05, 0.056, 0.26, x, 0.408, 0, 0.006);
    c.box('steel', 0.06, 0.012, 0.27, x, 0.418, 0, 0.003);
    for (const s of [1, -1]) c.hole([x, 0.418, s * 0.131], [0, 0, s], 0.005);
  }
  for (const [x0, x1] of [[-0.4, -0.1], [-0.06, 0.32], [0.33, 0.425]]) c.box('graphite', x1 - x0, 0.012, 0.27, (x0 + x1) / 2, DECK_Y, 0, 0.004);
  // bulkheads between the bays (lightened plates with cable pass-throughs)
  for (const x of [-0.395, -0.08, 0.325]) {
    c.add('graphite', holedPlate(0.27, 0.12, 0.01, [[-0.09, -0.025, 0.02], [0, -0.025, 0.02], [0.09, -0.025, 0.02], [-0.06, 0.035, 0.013], [0.06, 0.035, 0.013]]).rotateY(Math.PI / 2).translate(x, 0.503, 0));
  }
  // equipment tray hung under the side beams (battery tray level, TRAY_Y centre)
  c.box('alu', 0.72, 0.012, 0.29, -0.04, TRAY_Y, 0, 0.004);
  for (const s of [1, -1]) {
    c.box('graphite', 0.72, 0.018, 0.012, -0.04, TRAY_Y + 0.015, s * 0.139, 0.003);
    for (const x of [-0.32, 0.24]) c.box('graphite', 0.04, 0.098, 0.014, x, 0.324, s * 0.136, 0.003);
  }
  for (const x of [-0.34, 0.26]) for (const s of [1, -1]) c.hole([x, TRAY_Y - 0.007, s * 0.12], [0, -1, 0], 0.005);
  for (const s of [1, -1]) c.box('alu', 0.42, 0.016, 0.024, 0.14, 0.281, s * 0.067, 0.003); // battery rails

  // front frame: narrow central beam (clears both claw yaw cans), lower bridge and the two claw outrigger flanges
  c.box('dark', 0.06, 0.11, 0.2, FRONT_X, 0.355, 0, 0.008);
  c.box('steel', 0.07, 0.014, 0.21, FRONT_X, 0.412, 0, 0.003);
  c.box('dark', 0.05, 0.026, 0.3, 0.435, 0.285, 0, 0.005);
  for (const s of [1, -1]) {
    const fx = CLAW.shoulder[0];
    const fz = CLAW.shoulder[2] * s;
    const top = FLANGE_TOP_CLAW; // flange top = CLAW.shoulder.y - 0.14, claws.js mountPart yaw can sits on it
    c.box('steel', 0.13, 0.02, 0.13, fx, top - 0.01, fz, 0.006);
    c.box('graphite', 0.09, 0.016, 0.07, fx - 0.02, 0.288, fz, 0.003);
    c.add('dark', strutGeo([FRONT_X + 0.005, 0.32, s * 0.095], [fx - 0.005, 0.279, s * 0.15], 0.036, 0.045, 0.004));
    c.add('dark', strutGeo([0.435, 0.296, s * 0.135], [fx + 0.02, 0.288, s * 0.158], 0.02, 0.05, 0.003));
    for (const [dx, dz] of [[-0.04, 0], [0.04, 0], [0, -0.04], [0, 0.04]]) c.hole([fx + dx, top - 0.0195, fz + dz], [0, -1, 0], 0.0045);
  }
  // rear frame: cross member, gussets, tail deck and the J1 turntable flange (top = TAIL.root.y - 0.15)
  c.box('dark', 0.06, 0.13, 0.24, REAR_X, 0.4, 0, 0.008);
  c.box('steel', 0.07, 0.014, 0.25, REAR_X, 0.462, 0, 0.003);
  for (const s of [1, -1]) {
    c.add('dark', strutGeo([REAR_X + 0.02, 0.383, s * 0.105], [-0.497, 0.335, s * 0.1], 0.032, 0.05, 0.004));
    c.add('dark', strutGeo([REAR_X - 0.02, 0.36, s * 0.09], [-0.47, 0.334, s * 0.09], 0.03, 0.05, 0.004));
  }
  c.box('dark', 0.15, 0.014, 0.28, -0.465, 0.333, 0, 0.004);
  c.cyl('steel', 0.086, 0.014, TAIL.root[0], FLANGE_TOP_TAIL - 0.007, 0, 'y', 48);
  c.ring('steel', 0.092, 0.084, 0.008, TAIL.root[0], FLANGE_TOP_TAIL - 0.018, 0, 'y', 48);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    c.hole([TAIL.root[0] + Math.cos(ang) * 0.079, FLANGE_TOP_TAIL - 0.001, Math.sin(ang) * 0.079], [0, 1, 0], 0.0042);
  }
  for (const s of [1, -1]) c.hole([-0.45, FLANGE_TOP_TAIL - 0.001, s * 0.11], [0, 1, 0], 0.005);
  // deck spars tying the front and rear frames back into the spine
  for (const s of [1, -1]) {
    c.add('graphite', strutGeo([FRONT_X - 0.02, 0.42, s * 0.08], [FRONT_X + 0.01, 0.49, s * 0.055], 0.026, 0.04, 0.003));
    c.add('graphite', strutGeo([REAR_X + 0.02, 0.43, s * 0.08], [REAR_X + 0.01, 0.49, s * 0.055], 0.026, 0.04, 0.003));
  }
  // the main harness along the spine
  c.obj(cable([[-0.36, 0.502, 0.115], [-0.2, 0.5, 0.125], [0, 0.499, 0.125], [0.2, 0.494, 0.12], [0.33, 0.474, 0.06], [0.31, 0.45, 0.03]], 0.009, {M, mat: 'dark'}));
  c.obj(cable([[-0.2, 0.48, -0.11], [-0.05, 0.47, -0.125], [0.12, 0.462, -0.115], [0.29, 0.452, -0.07]], 0.007, {M, mat: 'dark'}));
  c.hole([FRONT_X, 0.412, 0.06], [0, 1, 0], 0.004);
  c.hole([FRONT_X, 0.412, -0.06], [0, 1, 0], 0.004);

  // ========================================================== armour, three layers (explode order 1)
  const a = U.armour;
  // layer 3: six arched hoops on the frame, they carry the plates through standoffs and rubber isolators
  for (const x of [0.38, 0.24, 0.08, -0.08, -0.24, -0.4, -0.51]) {
    const hz = hwAt(x) - 0.022;
    const y0 = topAt(x) - 0.105;
    const apex = topAt(x) - 0.052;
    a.add('graphite', archGeo(x, hz, y0, apex, 0.011, 9));
    for (const s of [1, -1]) {
      a.add('graphite', strutGeo([x, 0.478, s * 0.118], [x, y0 + 0.002, s * hz], 0.026, 0.02, 0.004));
      a.box('steel', 0.04, 0.026, 0.04, x, 0.473, s * BEAM_Z, 0.004);
      a.hole([x, 0.486, s * BEAM_Z], [0, 1, 0], 0.004);
    }
    a.hole([x, topAt(x) - 0.031, 0], [0, 1, 0], 0.004);
  }
  // layer 2: rubber isolators on steel standoffs under every plate
  const isolator = (x, y, z) => {
    a.cyl('rubber', 0.011, 0.014, x, y, z);
    a.cyl('steel', 0.007, 0.024, x, y - 0.019, z);
  };
  // layer 1: white tergite carapace. Every plate is a curved shell (arch across the body, crown along x) with
  // tile seams, black bolt holes, vents and a few orange accents; the front cowl closes over the sensor bay.
  const plate = (x0, x1, opts = {}) => {
    const xm = (x0 + x1) / 2;
    const l = Math.abs(x1 - x0) + 0.008;
    const w = 2 * shellAt(xm) - 0.006;
    const top = topAt(xm);
    const ARCH = Math.max(0.03, Math.min(0.1, top - 0.008 - 0.535)); // edge droop, edge stays above y 0.535
    const p = armorPanel(l, 0.016, w, {M, mat: opts.mat || 'ivory', seams: opts.seams || [3, 2], bolts: opts.bolts ?? true, vents: opts.vents, stripe: opts.stripe, arch: ARCH, archX: 0.012, radius: 0.007});
    p.position.set(xm, top - 0.008, 0);
    a.obj(p);
    // isolators between the shell and the hoops, following the dome droop at their z
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const z = sz * w * 0.26;
      const drop = ARCH * (2 * z / w) ** 2;
      isolator(xm + sx * l * 0.3, top - 0.016 - drop - 0.007, z);
    }
    return p;
  };
  // sensor bay cowl in front of the canopy, then six tergites back to the tail root
  plate(0.31, 0.425, {seams: [1, 2], vents: {n: 3, len: 0.05, at: [0, 0]}});
  const BACK0 = 0.04;
  const BACK1 = -0.53;
  const NPLATE = 6;
  const step = (BACK0 - BACK1) / NPLATE;
  for (let i = 0; i < NPLATE; i++) {
    plate(BACK0 - i * step, BACK0 - (i + 1) * step, {
      seams: [2, 2],
      vents: i === 3 ? {n: 4, len: 0.05, at: [0.05, 0]} : undefined,
    });
  }
  // the two flanks of the canopy carry the shell out to its full width either side of the glass bubble
  for (const s of [1, -1]) {
    const xm = 0.175;
    const top = topAt(xm);
    const w = shellAt(xm) - 0.128;
    const p = armorPanel(0.278, 0.014, w, {M, mat: 'ivory', seams: [2, 2], bolts: true, arch: 0.006, radius: 0.006, vents: {n: 3, len: 0.035, at: [0.05, 0]}});
    p.rotation.x = s * 0.34;
    p.position.set(xm, top - 0.036, s * (0.128 + w / 2 - 0.004));
    a.obj(p);
  }
  // rear quarters either side of the tail root, and the rear face panels
  for (const s of [1, -1]) {
    const p = armorPanel(0.17, 0.014, 0.1, {M, mat: 'ivory', seams: [2, 1], bolts: true, arch: 0.008, radius: 0.005, vents: {n: 3, len: 0.03, at: [0.1, 0]}});
    p.rotation.z = Math.PI / 2;
    p.position.set(-0.518, 0.44, s * 0.16);
    a.obj(p);
  }
  // belly plate with two vent grilles
  const belly = armorPanel(0.7, 0.012, 0.25, {M, mat: 'dark', seams: [3, 1], bolts: true, radius: 0.005});
  belly.position.set(-0.04, 0.235, 0);
  a.obj(belly);
  for (const s of [1, -1]) a.box('dark', 0.7, 0.03, 0.012, -0.04, 0.25, s * 0.13, 0.003);
  for (const x of [0.02, -0.2]) {
    const g = grille(0.18, 0.1, 9, {M});
    g.rotation.x = Math.PI;
    g.position.set(x, 0.226, 0);
    a.obj(g);
  }
  // dark flank skirts below the side beams close the under-tray bays but stay clear of the eight hip pads
  for (const s of [1, -1]) {
    a.box('dark', 0.66, 0.108, 0.012, -0.06, 0.326, s * 0.137, 0.005);
    for (const x of [-0.34, -0.17, 0.0, 0.17, 0.3]) a.hole([x, 0.34, s * 0.1435], [0, 0, s], 0.004);
    const hatch = armorPanel(0.15, 0.012, 0.055, {M, mat: 'dark', seams: [2, 1], bolts: true, radius: 0.004});
    hatch.rotation.x = (s * Math.PI) / 2;
    hatch.position.set(-0.13, 0.328, s * 0.1445);
    a.obj(hatch);
    const g = grille(0.09, 0.055, 7, {M});
    g.rotation.x = (s * Math.PI) / 2;
    g.position.set(-0.31, 0.33, s * 0.146);
    a.obj(g);
  }
  // service covers on the tergites, and the shoulder accent strips
  for (const x of [-0.12, -0.34]) {
    const p = armorPanel(0.06, 0.012, 0.05, {M, mat: 'white', seams: [1, 1], bolts: true, radius: 0.004});
    p.position.set(x, topAt(x) - 0.005, 0.05);
    a.obj(p);
  }
  // glass carapace canopy over the control bay: smoked-glass dome in a graphite frame with steel hinges
  const dome = new THREE.SphereGeometry(1, 30, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(0.135, 0.06, 0.128);
  a.add('glass', dome.translate(0.175, 0.57, 0));
  for (const x of [0.1, 0.175, 0.25]) a.add('dark', canopyRib(x, 0.058, 0.126, 0.011, 0.57));
  for (const s of [1, -1]) a.box('dark', 0.27, 0.012, 0.016, 0.175, 0.57, s * 0.13, 0.003);
  for (const x of [0.045, 0.31]) a.box('dark', 0.018, 0.014, 0.27, x, 0.57, 0, 0.003);
  for (const s of [1, -1]) {
    a.box('steel', 0.03, 0.03, 0.024, 0.315, 0.573, s * 0.09, 0.003);
    a.cyl('steel', 0.008, 0.07, 0.315, 0.573, 0, 'x');
  }
  // canopy frame isolators down onto the hoops
  for (const x of [0.09, 0.26]) for (const s of [1, -1]) isolator(x, 0.556, s * 0.115);
  anchors.armor = a.marker(-0.2, topAt(-0.2) + 0.008, 0.03);


  // ========================================================== sensor head (explode order 2)
  // sits between the two claw bases, on the front frame, top at ~0.59 m so the struck stinger clears it
  const h = U.head;
  const HX = 0.488; // housing centre, front face at 0.548
  h.box('steel', 0.11, 0.01, 0.13, 0.465, 0.423, 0, 0.003); // base flange on the front frame
  for (const sx of [-0.038, 0.038]) for (const sz of [-0.045, 0.045]) h.hole([0.465 + sx, 0.429, sz], [0, 1, 0], 0.004);
  h.box('graphite', 0.09, 0.026, 0.1, 0.465, 0.44, 0, 0.004); // neck
  h.box('ivory', 0.12, 0.11, 0.2, HX, 0.505, 0, 0.022); // main housing (rounded, reference bulb)
  // smoked glass visor across the front, with the optics recessed behind it
  h.box('smoke', 0.012, 0.095, 0.17, 0.552, 0.505, 0, 0.008);
  h.box('graphite', 0.03, 0.012, 0.19, 0.545, 0.56, 0, 0.004); // visor top rail
  h.box('graphite', 0.03, 0.012, 0.19, 0.545, 0.45, 0, 0.004); // visor bottom rail
  // stereo camera pair
  for (const s of [1, -1]) {
    h.cyl('dark', 0.019, 0.02, 0.545, 0.528, s * 0.045, 'x', 24);
    h.cyl('steel', 0.021, 0.007, 0.556, 0.528, s * 0.045, 'x', 24);
    h.cyl('smoke', 0.0135, 0.004, 0.5575, 0.528, s * 0.045, 'x', 24);
  }
  // depth camera below, IR module and the two lamps
  h.box('dark', 0.05, 0.036, 0.06, 0.534, 0.475, 0, 0.006);
  for (const s of [1, -1]) h.cyl('smoke', 0.0075, 0.004, 0.555, 0.475, s * 0.013, 'x', 16);
  h.cyl('dark', 0.014, 0.012, 0.552, 0.508, 0, 'x', 20);
  h.ring('copper', 0.016, 0.01, 0.008, 0.556, 0.508, 0, 'x', 20);
  h.cyl('smoke', 0.008, 0.004, 0.5575, 0.508, 0, 'x', 16);
  for (const s of [1, -1]) h.cyl('lamp', 0.008, 0.008, 0.552, 0.543, s * 0.075, 'x', 16);
  // lateral optics pods (the reference's two big side eyes), clamped to the housing cheeks
  for (const s of [1, -1]) {
    h.add('smoke', new THREE.SphereGeometry(0.03, 20, 14).translate(0.5, 0.51, s * 0.105));
    h.add('steel', new THREE.TorusGeometry(0.031, 0.005, 8, 26).translate(0.5, 0.51, s * 0.107));
    h.box('graphite', 0.05, 0.03, 0.02, 0.5, 0.51, s * 0.085, 0.004);
    h.hole([0.5, 0.53, s * 0.088], [0, 1, 0], 0.004);
  }
  // lidar puck on top with a steel band and a smoked window (head top ~0.59 m)
  h.cyl('graphite', 0.044, 0.028, 0.475, 0.574, 0, 'y', 32);
  h.ring('steel', 0.047, 0.042, 0.008, 0.475, 0.58, 0, 'y', 32);
  h.cyl('steel', 0.046, 0.006, 0.475, 0.561, 0, 'y', 32);
  h.cyl('smoke', 0.032, 0.004, 0.475, 0.588, 0, 'y', 32);
  h.cyl('dark', 0.02, 0.004, 0.475, 0.589, 0, 'y', 24);
  // top service panel with bolts and label strips, side cover plates
  h.box('white', 0.07, 0.008, 0.12, 0.48, 0.561, 0, 0.004);
  for (const sx of [-0.025, 0.025]) for (const sz of [-0.045, 0.045]) h.hole([0.48 + sx, 0.565, sz], [0, 1, 0], 0.0035);
  for (const s of [1, -1]) {
    h.box('white', 0.05, 0.008, 0.012, 0.505, 0.5605, s * 0.055, 0.002);
    h.box('white', 0.07, 0.06, 0.008, 0.49, 0.505, s * 0.102, 0.004);
    h.hole([0.49, 0.53, s * 0.107], [0, 0, s], 0.0035);
    h.hole([0.49, 0.48, s * 0.107], [0, 0, s], 0.0035);
  }
  // harness stub from the head down to the sensor bay bulkhead
  h.obj(cable([[0.45, 0.452, 0.06], [0.437, 0.448, 0.085], [0.42, 0.452, 0.1], [0.4, 0.46, 0.1]], 0.006, {M, mat: 'dark'}));
  anchors.sensor = h.marker(0.558, 0.505, 0);
  anchors.head = h.marker(0.475, 0.592, 0);


  // ========================================================== bay modules (explode order 6)
  // power bay: eight battery modules on the tray, BMS and copper busbars, under the deck
  const p = U.power;
  for (let i = 0; i < 4; i++) {
    for (const s of [1, -1]) {
      const x = 0.02 + i * 0.08;
      const z = s * 0.067;
      p.box('dark', 0.074, 0.104, 0.118, x, 0.336, z, 0.008);
      p.box('graphite', 0.068, 0.012, 0.11, x, 0.394, z, 0.003);
      p.box('white', 0.076, 0.01, 0.048, x, 0.352, z, 0.002);
      p.box('white', 0.026, 0.002, 0.05, x, 0.401, z, 0.001);
      p.cyl('steel', 0.008, 0.012, x - 0.022, 0.407, z, 'y', 16);
      p.cyl('copper', 0.007, 0.012, x + 0.022, 0.407, z, 'y', 16);
      p.box('graphite', 0.015, 0.05, 0.02, x + 0.045, 0.32, z + 0.012, 0.003); // module handle
    }
  }
  for (const z of [-0.04, 0, 0.04]) p.box('copper', 0.36, 0.008, 0.016, 0.14, 0.42, z, 0.002);
  for (const x of [0.0, 0.28]) for (const z of [-0.04, 0.04]) p.cyl('steel', 0.006, 0.02, x, 0.41, z, 'y', 12);
  p.box('graphite', 0.045, 0.08, 0.12, 0.305, 0.372, 0, 0.006); // BMS
  p.box('white', 0.03, 0.002, 0.08, 0.305, 0.413, 0.02, 0.001);
  p.box('dark', 0.02, 0.02, 0.03, 0.328, 0.39, -0.03, 0.003);
  p.box('white', 0.047, 0.006, 0.04, 0.305, 0.34, 0.045, 0.002);
  for (const z of [-0.045, 0.045]) p.hole([0.315, 0.412, z], [0, 1, 0], 0.0035);
  p.obj(cable([[0.29, 0.415, 0.03], [0.2, 0.424, 0.02], [0.08, 0.424, 0.0], [-0.02, 0.42, -0.02], [-0.1, 0.412, -0.03]], 0.008, {M, mat: 'dark'}));
  anchors.power = p.marker(0.305, 0.41, 0);

  // control bay: computer, motion controller, comms and the IMU on isolators, under the glass canopy
  const q = U.control;
  q.box('graphite', 0.12, 0.042, 0.14, 0.185, 0.464, 0.015, 0.006); // computer chassis
  for (let i = 0; i < 5; i++) q.box('alu', 0.1, 0.01, 0.008, 0.185, 0.49, -0.045 + i * 0.03, 0.002); // heatsink fins
  for (const z of [-0.02, 0.02, 0.06]) q.box('dark', 0.018, 0.018, 0.016, 0.128, 0.462, z, 0.003); // rear connectors
  q.box('white', 0.05, 0.006, 0.008, 0.2, 0.487, 0.09, 0.002);
  for (const sx of [-0.045, 0.045]) for (const sz of [-0.055, 0.06]) q.hole([0.185 + sx, 0.486, 0.015 + sz], [0, 1, 0], 0.0035);
  q.box('graphite', 0.08, 0.038, 0.1, 0.07, 0.462, 0.045, 0.006); // motion controller
  q.box('white', 0.05, 0.006, 0.01, 0.07, 0.483, 0.045, 0.002);
  for (const z of [0.02, 0.05, 0.08]) q.box('dark', 0.014, 0.014, 0.012, 0.032, 0.46, z, 0.002);
  q.box('dark', 0.06, 0.03, 0.07, 0.055, 0.458, -0.06, 0.005); // comms module
  q.cyl('steel', 0.008, 0.014, 0.03, 0.465, -0.06, 'x', 14);
  q.box('white', 0.03, 0.002, 0.05, 0.055, 0.474, -0.06, 0.001);
  // IMU on three rubber isolators
  for (const [ix, iz] of [[-0.012, -0.012], [0.012, -0.012], [0, 0.014]]) q.cyl('rubber', 0.007, 0.014, 0.235 + ix, 0.45, -0.07 + iz, 'y', 12);
  q.box('alu', 0.032, 0.032, 0.032, 0.235, 0.473, -0.07, 0.004);
  q.box('dark', 0.026, 0.006, 0.026, 0.235, 0.492, -0.07, 0.002);
  q.cyl('copper', 0.005, 0.01, 0.255, 0.473, -0.07, 'x', 10);
  q.obj(cable([[0.13, 0.462, -0.02], [0.1, 0.452, -0.04], [0.07, 0.462, -0.045], [0.04, 0.466, -0.05]], 0.005, {M, mat: 'dark'}));
  q.hole([0.185, 0.486, 0.015], [0, 1, 0], 0.004);
  anchors.control = q.marker(0.185, 0.5, 0.015);


  // drive bay: eight servo drive cards on a cold plate above the deck, PDU (contactors, fuse, pre-charge,
  // DC bus, isolated aux supply) and the eight leg connectors below it
  const d = U.drive;
  d.box('alu', 0.28, 0.018, 0.27, -0.205, 0.452, 0, 0.004); // cold plate
  d.obj(cable([[-0.33, 0.456, -0.11], [-0.2, 0.452, -0.12], [-0.07, 0.454, -0.1], [-0.06, 0.46, -0.06]], 0.006, {M, mat: 'copper'}));
  for (const s of [1, -1]) {
    d.box('steel', 0.26, 0.01, 0.02, -0.205, 0.462, s * 0.065, 0.002);
    for (let i = 0; i < 4; i++) {
      const x = -0.31 + i * 0.065;
      const z = s * 0.065;
      d.box('dark', 0.055, 0.062, 0.012, x, 0.496, z, 0.003); // servo drive card
      d.box('alu', 0.045, 0.048, 0.007, x, 0.496, z + s * 0.011, 0.002); // heatsink on the cold plate side
      for (let f = 0; f < 3; f++) d.box('alu', 0.005, 0.045, 0.014, x - 0.016 + f * 0.016, 0.498, z + s * 0.016, 0.001);
      d.box('steel', 0.014, 0.016, 0.014, x + 0.017, 0.523, z, 0.002); // capacitor cap
      d.box('steel', 0.048, 0.008, 0.016, x, 0.531, z, 0.002); // connector strip
      d.hole([x, 0.531, z], [0, 1, 0], 0.003);
    }
  }
  d.box('graphite', 0.015, 0.03, 0.24, -0.062, 0.47, 0, 0.003); // card cage front rail
  // PDU below the deck
  d.box('graphite', 0.06, 0.09, 0.08, -0.26, 0.35, 0.06, 0.006); // main contactor
  d.box('steel', 0.05, 0.012, 0.06, -0.26, 0.401, 0.06, 0.003);
  d.box('graphite', 0.04, 0.07, 0.06, -0.33, 0.34, 0.06, 0.005); // pre-charge contactor + resistor
  d.box('steel', 0.03, 0.01, 0.04, -0.33, 0.379, 0.06, 0.002);
  d.cyl('steel', 0.018, 0.09, -0.3, 0.32, -0.05, 'x', 20); // main fuse
  d.cyl('white', 0.019, 0.02, -0.3, 0.32, -0.05, 'x', 20);
  d.box('graphite', 0.08, 0.07, 0.1, -0.245, 0.345, -0.06, 0.006); // isolated aux supply
  d.box('white', 0.03, 0.002, 0.06, -0.245, 0.381, -0.06, 0.001);
  d.box('white', 0.082, 0.006, 0.03, -0.245, 0.31, -0.06, 0.002);
  for (const z of [-0.035, 0.035]) {
    d.box('copper', 0.14, 0.01, 0.018, -0.3, 0.424, z, 0.002); // DC bus bars
    for (const x of [-0.36, -0.25]) d.cyl('steel', 0.006, 0.024, x, 0.41, z, 'y', 12);
  }
  for (const z of [-0.05, 0.0, 0.05]) d.obj(cable([[-0.2, 0.43, z], [-0.12, 0.435, z * 0.6], [-0.05, 0.44, 0]], 0.005, {M, mat: 'dark'}));
  // leg connector panel, eight circular connectors
  d.box('steel', 0.018, 0.1, 0.22, -0.378, 0.36, 0, 0.003);
  for (let r = 0; r < 4; r++) {
    for (const s of [1, -1]) {
      const y = 0.312 + r * 0.032;
      const z = s * 0.062;
      d.cyl('steel', 0.012, 0.02, -0.383, y, z, 'x', 16);
      d.cyl('dark', 0.007, 0.012, -0.39, y, z, 'x', 12);
      d.hole([-0.386, y, z], [-1, 0, 0], 0.003);
    }
  }
  anchors.drive = d.marker(-0.31, 0.534, 0.065);

  // thermal bay: pump, reservoir, cold plates, copper loop and the radiator with its two fans at the back
  const t = U.thermal;
  // radiator core + alu fins
  t.box('graphite', 0.026, 0.085, 0.22, -0.355, 0.5025, 0, 0.004);
  for (let i = 0; i < 12; i++) t.box('alu', 0.018, 0.078, 0.005, -0.357, 0.5025, -0.1 + i * 0.0182, 0.001);
  t.box('steel', 0.03, 0.014, 0.23, -0.355, 0.545, 0, 0.003);
  t.box('steel', 0.03, 0.014, 0.23, -0.355, 0.462, 0, 0.003);
  for (const s of [1, -1]) {
    t.add('graphite', strutGeo([-0.355, 0.462, s * 0.095], [-0.32, 0.443, s * 0.075], 0.02, 0.03, 0.003));
    // fan: dark ring, steel band, steel hub and five blades, blowing out of the back
    const fx = -0.372;
    t.cyl('dark', 0.045, 0.014, fx, 0.5025, s * 0.058, 'x', 28);
    t.ring('steel', 0.047, 0.042, 0.006, fx - 0.004, 0.5025, s * 0.058, 'x', 28);
    t.cyl('steel', 0.014, 0.016, fx, 0.5025, s * 0.058, 'x', 16);
    for (let b = 0; b < 5; b++) {
      const g = rbox(0.006, 0.032, 0.009, 0.002, 1);
      g.translate(0, 0.021, 0).rotateX((b / 5) * Math.PI * 2);
      g.translate(fx, 0.5025, s * 0.058);
      t.add('dark', g);
    }
  }
  // pump and reservoir under the deck
  t.box('steel', 0.12, 0.012, 0.16, -0.1, 0.283, 0.06, 0.003);
  t.cyl('dark', 0.03, 0.06, -0.1, 0.31, 0.09, 'x', 24);
  t.ring('steel', 0.032, 0.028, 0.008, -0.075, 0.31, 0.09, 'x', 24);
  t.cyl('steel', 0.012, 0.02, -0.1, 0.31, 0.055, 'y', 14);
  t.cyl('steel', 0.012, 0.02, -0.1, 0.31, 0.125, 'y', 14);
  t.box('graphite', 0.03, 0.06, 0.03, -0.1, 0.295, 0.155, 0.003);
  t.box('alu', 0.1, 0.072, 0.11, -0.17, 0.32, -0.06, 0.006); // reservoir
  t.box('smoke', 0.07, 0.02, 0.006, -0.17, 0.322, -0.003, 0.001); // level window
  t.cyl('steel', 0.012, 0.02, -0.17, 0.362, -0.06, 'y', 14);
  // two thermal cold plates on a manifold
  for (let i = 0; i < 2; i++) {
    t.box('alu', 0.12, 0.012, 0.2, -0.14, 0.418 - i * 0.03, 0, 0.003);
    t.box('copper', 0.1, 0.006, 0.17, -0.14, 0.425 - i * 0.03, 0, 0.002);
  }
  // copper loop: pump -> radiator -> cold plates -> reservoir
  t.obj(cable([[-0.1, 0.31, 0.125], [-0.13, 0.36, 0.14], [-0.22, 0.44, 0.13], [-0.3, 0.49, 0.1], [-0.33, 0.5, 0.06]], 0.006, {M, mat: 'copper'}));
  t.obj(cable([[-0.17, 0.36, -0.11], [-0.22, 0.43, -0.12], [-0.3, 0.48, -0.09], [-0.335, 0.5, -0.05], [-0.35, 0.512, -0.02]], 0.006, {M, mat: 'copper'}));
  t.obj(cable([[-0.14, 0.44, 0.08], [-0.2, 0.45, 0.1], [-0.3, 0.47, 0.08]], 0.006, {M, mat: 'copper'}));
  anchors.thermal = t.marker(-0.355, 0.52, 0.06);


  // sensor bay: perception unit, positioning module and the camera driver board in the front bay
  const sb = U.sensor;
  sb.box('graphite', 0.048, 0.095, 0.14, 0.394, 0.4925, 0, 0.006); // perception unit
  for (let i = 0; i < 5; i++) sb.box('alu', 0.04, 0.008, 0.01, 0.394, 0.542, -0.05 + i * 0.025, 0.001);
  sb.box('white', 0.05, 0.006, 0.012, 0.394, 0.5, 0.072, 0.002);
  for (const z of [-0.04, 0.04]) sb.box('steel', 0.02, 0.018, 0.016, 0.37, 0.47, z, 0.003);
  sb.box('graphite', 0.046, 0.032, 0.11, 0.345, 0.46, 0, 0.005); // positioning module
  sb.box('white', 0.03, 0.002, 0.06, 0.345, 0.477, 0.02, 0.001);
  sb.cyl('steel', 0.008, 0.012, 0.325, 0.462, 0.04, 'x', 14);
  sb.box('dark', 0.05, 0.008, 0.09, 0.345, 0.487, 0, 0.002); // camera / lidar driver board
  for (const x of [0.33, 0.36]) for (const z of [-0.03, 0.03]) sb.cyl('steel', 0.005, 0.02, x, 0.478, z, 'y', 10);
  for (const z of [-0.025, 0.025]) sb.box('copper', 0.01, 0.006, 0.012, 0.36, 0.492, z, 0.001);
  sb.obj(cable([[0.4, 0.5, 0.06], [0.407, 0.5, 0.04], [0.4, 0.48, 0.02], [0.37, 0.49, 0.0]], 0.005, {M, mat: 'dark'}));
  sb.hole([0.394, 0.542, 0], [0, 1, 0], 0.004);
  sb.hole([0.345, 0.478, -0.05], [0, 1, 0], 0.0035);
  sb.hole([0.345, 0.478, 0.05], [0, 1, 0], 0.0035);

  // ---------------------------------------------------------- merge, bolt and tag every unit
  for (const key of ['chassis', 'armour', 'head', 'power', 'control', 'drive', 'thermal', 'sensor']) U[key].flush();
  // CONTRACT: every mesh casts and receives shadows (parts.js bolts come in with castShadow off)
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  // per-frame body-internal animation hook: the body is rigid, explode / ghosts / section cut are robot.js's job
  function update(pose) {}
  group.userData.parts = {hipPads: LEGS.length, units: units.length};
  return {group, units, anchors, update};
}

