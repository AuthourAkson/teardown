// SCORPION SC-8, the math. Metres, radians, no three.js. Dimensions from the SC-8 sheets (pic/蝎子三视图.png,
// pic/蝎子机械原理图.png): 2180 long, 1530 wide, 1280 high, 420 kg, 8 three-segment legs, 2 claws, an 8-section
// tail (root mount, 6 links, end mount) and a stinger. One gait phase PHI poses all eight legs; one curl value poses
// the tail; one grip value opens the claws. Every readout on the console comes from the functions below, and so do
// the mass budget, CoG, support polygon and the joint table (JOINTS) of the design document.
// Verified (temp script): envelope 2144 x 1435 x 1276 mm (x z y) over the gait, L1 lift, strike, stow, tail yaw
// +-25 deg and the claws fully open and stretched; IK never misses; at 0.35 m/s the CoG stays >= 271 mm inside the
// support polygon with 4..7 feet down.
//
// Frame: x forward (toward the claws), y up, z to the robot's left. Body origin on the ground under the hip line.

export const SPEC = {length: 2.18, width: 1.53, height: 1.28, mass: 420, vmax: 12, payload: 500, strike: 1200, endurance: 8};
export const G = 9.81;
export const D2R = Math.PI / 180;

// ------------------------------------------------------------ body
export const BODY = {
  ride: 0.42, // hip-line height over the ground at rest
  len: 1.02, // prosoma + mesosoma, front plate to tail root
  front: 0.5, // x of the front plate
  back: -0.52, // x of the tail root
  half: 0.24, // half width of the carapace at the hips
};

// ------------------------------------------------------------ legs: 4 pairs, coxa yaw + femur pitch + tibia pitch
// hips along the flanks; the foot's neutral spot fans out like the TOP VIEW: front pair forward, back pair rearward
// femur 0.36 / tibia 0.52: a crouched emperor-scorpion stance (official video) - knees arch just above the
// carapace instead of standing up like a spider's
export const LEG = {coxa: 0.11, femur: 0.36, tibia: 0.52};
export const PAIRS = [
  // emperor-scorpion splay (official video): front pair well forward, back pair well back, knees high and out
  {x: 0.26, z: 0.21, yaw: 46},
  {x: 0.09, z: 0.23, yaw: 15},
  {x: -0.08, z: 0.23, yaw: -17},
  {x: -0.25, z: 0.21, yaw: -45},
];
// neutral foot distance from the hip, on the ground. 0.5 plants the feet wide; with the outermost foot module (its
// passive drum is 36 mm across the leg) the overall width stays ~1.52 m through the gait, the L1 lift and the turn.
export const FOOT_R = 0.5;
export const LEGS = []; // 0..7: L1 R1 L2 R2 ... (side +1 left, -1 right)
PAIRS.forEach((p, i) => {
  for (const side of [1, -1]) {
    const yaw = p.yaw * D2R;
    LEGS.push({
      id: `${side > 0 ? 'L' : 'R'}${i + 1}`,
      pair: i,
      side,
      hip: [p.x, BODY.ride, p.z * side],
      home: [p.x + Math.sin(yaw) * FOOT_R, 0, side * (p.z + Math.cos(yaw) * FOOT_R)],
    });
  }
});

// alternating tetrapod: L1 R2 L3 R4 against R1 L2 R3 L4, with a small wave from back to front inside each group
export const DUTY = 0.58;
export const STRIDE = 0.3; // metres of body travel per gait cycle at any speed (frequency follows speed)
export const LIFT = 0.1;
const legPhase = (i) => {
  const {pair, side} = LEGS[i];
  const group = (pair + (side > 0 ? 0 : 1)) % 2;
  return group * 0.5 + (3 - pair) * 0.04;
};
export const PHASE = LEGS.map((_, i) => legPhase(i));

/**
 * Where a foot is in the body frame for gait phase PHI (cycles, any real number), and whether it is planted.
 * The body moves STRIDE / DUTY per cycle times DUTY... exactly STRIDE per cycle, so a planted foot moves backward
 * in the body frame by the same amount: no slip at any speed.
 */
export function footAt(i, PHI, settle = 0) {
  const f = footRaw(i, PHI);
  if (settle > 0 && !f.stance) {
    // halted: every swinging foot lowers straight down where it is and plants once it is half way
    f.pos[1] *= 1 - Math.min(1, settle);
    if (settle > 0.5) f.stance = true;
  }
  return f;
}
function footRaw(i, PHI) {
  const L = LEGS[i];
  const p = (((PHI + PHASE[i]) % 1) + 1) % 1;
  let dx;
  let y = 0;
  let stance;
  if (p < DUTY) {
    stance = true;
    dx = STRIDE * (0.5 - p / DUTY);
  } else {
    stance = false;
    const q = (p - DUTY) / (1 - DUTY);
    const s = q * q * (3 - 2 * q);
    dx = STRIDE * (-0.5 + s);
    y = LIFT * Math.sin(Math.PI * q);
  }
  return {pos: [L.home[0] + dx, y, L.home[2]], stance, p};
}

/** Body bob: the hip line dips a little while legs change over. */
export const bobAt = (PHI) => -0.012 * Math.cos(4 * Math.PI * PHI);

/** Leg IK. foot in body frame; returns joint angles and the joint points in body frame. */
export function legIK(i, foot, bob = 0) {
  const L = LEGS[i];
  const hip = [L.hip[0], L.hip[1] + bob, L.hip[2]];
  const dx = foot[0] - hip[0];
  const dz = foot[2] - hip[2];
  const yaw = Math.atan2(dx, dz * L.side); // 0 = straight out sideways, + toward the front
  const r = Math.hypot(dx, dz) - LEG.coxa;
  const h = foot[1] - hip[1]; // negative, the foot is below the hip
  const d = Math.min(LEG.femur + LEG.tibia - 1e-4, Math.hypot(r, h));
  // knee up: femur pitch above the line hip->foot
  const a1 = Math.atan2(h, r);
  const a2 = Math.acos((LEG.femur ** 2 + d * d - LEG.tibia ** 2) / (2 * LEG.femur * d));
  const femur = a1 + a2; // pitch of the femur over horizontal
  const kneeIn = Math.acos((LEG.femur ** 2 + LEG.tibia ** 2 - d * d) / (2 * LEG.femur * LEG.tibia));
  const tibia = femur - (Math.PI - kneeIn); // pitch of the tibia over horizontal
  const ux = Math.sin(yaw);
  const uz = Math.cos(yaw) * L.side;
  const c = [hip[0] + ux * LEG.coxa, hip[1], hip[2] + uz * LEG.coxa];
  const k = [c[0] + ux * LEG.femur * Math.cos(femur), c[1] + LEG.femur * Math.sin(femur), c[2] + uz * LEG.femur * Math.cos(femur)];
  const f = [k[0] + ux * LEG.tibia * Math.cos(tibia), k[1] + LEG.tibia * Math.sin(tibia), k[2] + uz * LEG.tibia * Math.cos(tibia)];
  return {yaw, femur, tibia, knee: Math.PI - kneeIn, hip, coxaEnd: c, kneeP: k, footP: f, ux, uz};
}

// L1 lift for the film's LEG L1 LIFT beat: the foot rises LIFT_L1.up and moves LIFT_L1.out outward / forward
export const LIFT_L1 = {up: 0.24, out: 0.06};

/**
 * Vertical foot forces that hold the whole weight W with the CoG at (cx, cz): sum f = W, sum f x = W cx,
 * sum f z = W cz, smallest sum f^2 (what a force-distributing controller does). Negative results are clipped and the
 * rest renormalised; with the CoG inside the support polygon (see supportAt) none go negative in the walk.
 */
function footForces(feet, W, cx, cz) {
  const n = feet.length;
  if (n === 0) return [];
  if (n < 3) return feet.map(() => W / n);
  // A A^T (3x3), rows of A: 1, x, z
  let s1 = 0, sx = 0, sz = 0, sxx = 0, sxz = 0, szz = 0;
  for (const [x, z] of feet) {
    s1 += 1; sx += x; sz += z; sxx += x * x; sxz += x * z; szz += z * z;
  }
  const M = [[s1, sx, sz], [sx, sxx, sxz], [sz, sxz, szz]];
  const b = [W, W * cx, W * cz];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-12) return feet.map(() => W / n);
  const lam = [0, 1, 2].map((c) => det(M.map((row, r) => row.map((v, k) => (k === c ? b[r] : v)))) / D);
  let f = feet.map(([x, z]) => Math.max(0, lam[0] + lam[1] * x + lam[2] * z));
  const sum = f.reduce((a, v) => a + v, 0) || 1;
  f = f.map((v) => (v * W) / sum);
  return f;
}

/**
 * Every leg at gait phase PHI: poses, stance flags, the vertical load each planted foot carries and the static joint
 * torques. lift 0..1 raises leg 0 (L1) clear of the ground (LIFT_L1); the other seven then carry the weight.
 *   load       N, vertical ground force on the foot (whole 420 kg shared by the planted feet about the CoG)
 *   torque     N·m, hip pitch torque (kept for the console; same value as hipTorque)
 *   hipTorque  N·m, hip pitch = load x horizontal reach femur pivot -> foot
 *   kneeTorque N·m, knee = load x horizontal reach knee -> foot
 *   ankle      rad, passive pad pitch relative to the tibia's normal, keeping the pad flat on the ground
 */
export function legsAt(PHI, lift = 0, settle = 0) {
  const bob = bobAt(PHI) * (1 - Math.min(1, settle));
  const out = LEGS.map((L, i) => {
    const f = footAt(i, PHI, settle);
    let pos = f.pos;
    let stance = f.stance;
    if (i === 0 && lift > 0) {
      const u = Math.min(1, lift);
      const e = u * u * (3 - 2 * u);
      const dx = Math.sin(PAIRS[0].yaw * D2R) * LIFT_L1.out;
      const dz = Math.cos(PAIRS[0].yaw * D2R) * LIFT_L1.out * L.side;
      pos = [pos[0] + dx * e, Math.max(pos[1], LIFT_L1.up * e), pos[2] + dz * e];
      if (u > 0.02) stance = false;
    }
    return {...legIK(i, pos, bob), stance, p: f.p, foot: pos};
  });
  const planted = out.filter((l) => l.stance);
  const cg = cogAt({legs: out, bob});
  const F = footForces(planted.map((l) => [l.footP[0], l.footP[2]]), SPEC.mass * G, cg[0], cg[2]);
  let k = 0;
  for (const l of out) {
    l.load = l.stance ? F[k++] : 0;
    const reach = Math.hypot(l.footP[0] - l.coxaEnd[0], l.footP[2] - l.coxaEnd[2]);
    const kreach = Math.hypot(l.footP[0] - l.kneeP[0], l.footP[2] - l.kneeP[2]);
    l.hipTorque = l.load * reach; // N·m
    l.kneeTorque = l.load * kreach; // N·m
    l.torque = l.hipTorque;
    l.ankle = -(l.tibia + Math.PI / 2); // 0 when the tibia stands vertical over a flat pad
  }
  return {legs: out, bob, down: planted.length, cog: cg};
}

// ------------------------------------------------------------ tail: spec §5.1, eight sections + stinger module
// Sections (index k):        0 root mount   1..6 links 1-6   7 end-effector mount   8 stinger module
// Joints (index j, at pts[j]): J1 root (2-DOF: yaw about +y, then pitch) at pts[0], J2..J7 pitch at pts[1..6],
//                             J8 stinger pitch at pts[7]. Link k runs pts[k-1] -> pts[k] (k = 1..8; 8 = stinger).
// The root mount is a fixed bracket bolted to the rear frame; it carries both J1 actuators.
export const TAIL = {
  // J1 sits 20 mm inside the rear frame (BODY.back = -0.52) on top of the root mount bracket
  root: [BODY.back + 0.02, 0.49], // x, y of J1
  seg: [0.18, 0.18, 0.17, 0.16, 0.155, 0.145, 0.135], // links 1-6 + end-effector mount (m)
  sting: 0.27, // stinger module, J8 to the tip (m)
  // rest pitch of each joint (relative bend, degrees): the tail rises behind and curls forward over the back.
  // the rear-most section stays 781 mm behind the hips through the wind-up, so the 2180 mm length holds; the top of
  // the curl stays under the 1280 mm height (1267 mm at the wind-up).
  // rounder, higher curl: reaches back to x -0.74 with the stinger hanging over the back at y ~0.83 (sheet side view)
  rest: [125, -20, -23, -26, -30, -32, -34, -46],
  // strike: every joint bends further toward the front, the stinger drives down at the target
  // the struck tip ends at (0.245, 0.703) m, above the head armour (top ~0.59 m)
  strike: [-18, -4, -2, -1, 1, 2, 4, 60],
  // stow: flatter, lower curl for the low walk (J1 drops, the curl closes)
  stow: [-6, 0, 2, 2, 0, -2, -4, 0],
  names: ['尾根连接座', '第一节尾部连杆', '第二节尾部连杆', '第三节尾部连杆', '第四节尾部连杆', '第五节尾部连杆', '第六节尾部连杆', '末端执行器安装节', '尾刺执行模块'],
  en: ['ROOT MOUNT', 'LINK 1', 'LINK 2', 'LINK 3', 'LINK 4', 'LINK 5', 'LINK 6', 'END MOUNT', 'STINGER'],
  // section envelope (m), root largest, tapering to the tip: width across (z), height in the tail plane
  width: [0.22, 0.18, 0.168, 0.155, 0.14, 0.125, 0.11, 0.095, 0.08],
  height: [0.24, 0.21, 0.2, 0.185, 0.17, 0.15, 0.13, 0.11, 0.088],
  // structural mass of each section (armour + link + flange), kg, at its mid point
  link: [5.0, 6.4, 5.6, 4.8, 4.0, 3.3, 2.7, 2.2, 3.0],
  // actuator mass carried by each section, kg: section 0 holds J1 yaw + pitch; section k (1..7) holds the actuator
  // of the next joint J(k+1) at its distal end pts[k]; the stinger carries none (tip sensors are in its link mass)
  act: [4.0, 4.0, 3.4, 2.8, 2.3, 1.9, 1.5, 1.1, 0],
};
TAIL.mass = TAIL.link.map((m, k) => m + TAIL.act[k]); // kg per section, sums to 58 kg
export const TAIL_LEN = TAIL.seg.reduce((a, b) => a + b, 0) + TAIL.sting;

/**
 * Tail for curl state s (strike 0..1, the wind-up goes to -0.28), stow w 0..1, root yaw (rad about +y).
 * pts: [[x, y], ...] J1, J2..J8, tip, in the tail's own vertical plane BEFORE yaw (z = 0). Consumers rotate the whole
 *   chain about the root point by `yaw` (three.js rotation.y = yaw: x' = x cos + z sin, z' = -x sin + z cos).
 * ang: absolute pitch of links 1-6, end mount, stinger (rad).
 * torque[j]: static gravity moment about pitch joint J(j+1) (j = 0..7, N·m, magnitude) from everything distal of it.
 * pts3: the same points in body frame after yaw, [x, y, z].
 */
export function tailAt(s, w = 0, yaw = 0) {
  let a = 0;
  let [x, y] = TAIL.root;
  const pts = [[x, y]];
  const ang = [];
  const lens = [...TAIL.seg, TAIL.sting];
  for (let j = 0; j < lens.length; j++) {
    a += (TAIL.rest[j] + TAIL.strike[j] * s + TAIL.stow[j] * w) * D2R;
    ang.push(a);
    x += Math.cos(a) * lens[j];
    y += Math.sin(a) * lens[j];
    pts.push([x, y]);
  }
  // gravity moment at each pitch joint: links at their mid points, carried actuators at the distal joint
  const torque = [];
  for (let j = 0; j < 8; j++) {
    const xj = pts[j][0];
    let m = 0;
    for (let k = j + 1; k <= 8; k++) {
      const xm = (pts[k - 1][0] + pts[k][0]) / 2;
      m += TAIL.link[k] * (xm - xj);
      if (k < 8) m += TAIL.act[k] * (pts[k][0] - xj);
    }
    torque.push(Math.abs(m * G));
  }
  const [rx] = TAIL.root;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const pts3 = pts.map(([px, py]) => [rx + (px - rx) * c, py, -(px - rx) * sn]);
  return {pts, ang, tip: pts[pts.length - 1], yaw, torque, pts3};
}

// strike profile over its 1.6 s: wind up (curl back), snap forward, hold, return
export const STRIKE_DUR = 1.6;
export function strikeCurve(u) {
  if (u <= 0 || u >= STRIKE_DUR) return 0;
  const k = u / STRIKE_DUR;
  if (k < 0.3) return -0.28 * Math.sin((Math.PI / 2) * (k / 0.3)); // cock back
  if (k < 0.42) {
    const q = (k - 0.3) / 0.12;
    return -0.28 + 1.28 * (1 - Math.pow(1 - q, 3)); // the snap
  }
  if (k < 0.62) return 1;
  const q = (k - 0.62) / 0.38;
  return 1 - q * q * (3 - 2 * q);
}

// ------------------------------------------------------------ claws: shoulder, arm, forearm, chela, finger
export const CLAW = {
  shoulder: [BODY.front - 0.04, 0.44, 0.17], // left; mirrored in z for the right
  // arm + forearm + chela sized so the fully stretched, open claw stays inside the 2180 mm length (tip x <= 1.363)
  arm: 0.25,
  fore: 0.21, // 0.25 with the 1.1x chela overran the 2180 length at the front
  palm: 0.18,
  finger: 0.225,
  gapMax: 34, // degrees the movable finger opens
  gripMax: 6.2, // kN at full close, the panel's GRIP FORCE scale
};

/** One claw's points (side +1 left / -1 right) for open 0..1 and reach 0..1 (folded in to stretched out). */
export function clawAt(side, open, reach = 0) {
  const [sx, sy, sz] = CLAW.shoulder;
  const S = [sx, sy, sz * side];
  // emperor pose (official video): chelae raised and held forward in front of the head, wrist y ~0.5 m
  const yaw = (30 - 6 * reach) * D2R * side; // splay out from the midline
  const ux = Math.cos(yaw);
  const uz = Math.sin(yaw);
  const pa = (20 - 6 * reach) * D2R; // arm (femur) climbs from the shoulder
  const pf = (-6 + 2 * reach) * D2R; // patella runs level and forward: the chela is held up in front of the head
  const E = [S[0] + ux * CLAW.arm * Math.cos(pa), S[1] + CLAW.arm * Math.sin(pa), S[2] + uz * CLAW.arm * Math.cos(pa)];
  const yaw2 = (-6 + 4 * reach) * D2R * side; // the forearm runs nearly straight ahead
  const vx = Math.cos(yaw2);
  const vz = Math.sin(yaw2);
  const W = [E[0] + vx * CLAW.fore * Math.cos(pf), E[1] + CLAW.fore * Math.sin(pf), E[2] + vz * CLAW.fore * Math.cos(pf)];
  const yaw3 = (-14 + 6 * reach) * D2R * side; // fingers forward and slightly inward
  const gap = CLAW.gapMax * open * D2R;
  // chela axis and the fixed finger tip (palm + 0.03 m hinge block + finger), as robot.js lays them out
  const dl = Math.hypot(1, 0.08);
  const d = [Math.cos(yaw3) / dl, -0.08 / dl, Math.sin(yaw3) / dl];
  const L = CLAW.palm + 0.03 + CLAW.finger;
  const tip = [W[0] + d[0] * L, W[1] + d[1] * L, W[2] + d[2] * L];
  return {S, E, W, yaw: yaw, yaw2, yaw3, pa, pf, gap, d, tip, drive: clawDrive(gap)};
}

// ------------------------------------------------------------ claw grip drive (spec §4.3, lead-screw option)
// motor -> planetary 10:1 -> Tr20x4 trapezoidal lead screw -> bronze nut -> push link -> movable finger (one pivot).
// Planar mechanism in the chela's own frame: u along the screw toward the finger tips, v toward the crank pin side,
// finger pivot at the origin. The crank pin sits on the finger at radius `crank`; at full close it is straight over
// the pivot (v = crank), the screw axis runs at v = `offset`, so the push link lies along the screw and has the
// longest lever exactly when the jaws clamp. The nut moves forward (+u) to close: the link is in compression.
export const CLAW_DRIVE = {
  // 1.0 kW servo on the 400 V bus: the 6.2 kN grip needs 868 N·m at the pivot = 1.80 N·m
  // at the motor; rated 3.18 N·m gives 1530 N·m closed (1.76 x, rule >= 1.5 x, see JOINTS);
  // the drive current limit caps the clamp at CLAW.gripMax (overload protection), the screw self-locks to hold it.
  motor: {type: 'PMSM 1.0 kW', rated: 3.18, peak: 9.55, rpm: 3000}, // N·m, N·m, rpm (motor shaft)
  ratio: 10, // planetary, single stage
  etaGear: 0.95,
  lead: 0.004, // m per screw turn (Tr20x4, single start)
  screwD: 0.02, // m nominal
  nutLen: 0.05, // m, bronze nut length (12.5 engaged turns)
  mu: 0.1, // bronze nut on steel screw, greased
  crank: 0.08, // m, pivot -> crank pin on the movable finger
  link: 0.11, // m, push link pin to pin
  offset: 0.08, // m, screw axis from the pivot line
  gripR: 0.14, // m, pivot -> centre of the grip pad where CLAW.gripMax is quoted
};
{
  const D = CLAW_DRIVE;
  const lam = Math.atan(D.lead / (Math.PI * D.screwD * 0.9)); // lead angle on the pitch diameter (~18 mm)
  const rho = Math.atan(D.mu / Math.cos(15 * D2R)); // friction angle, 30 deg trapezoidal flank
  D.leadAngle = lam / D2R; // deg
  D.frictionAngle = rho / D2R; // deg
  D.etaScrew = Math.tan(lam) / Math.tan(lam + rho);
  D.selfLocking = lam < rho; // the grip holds with the motor unpowered
  D.axialPeak = (2 * Math.PI * D.motor.peak * D.ratio * D.etaGear * D.etaScrew) / D.lead; // N on the nut
  D.axialRated = (2 * Math.PI * D.motor.rated * D.ratio * D.etaGear * D.etaScrew) / D.lead;
}

/** Nut position u (m) along the screw for finger opening angle gap (rad), and the link angle. */
function nutAt(gap) {
  const D = CLAW_DRIVE;
  const px = -D.crank * Math.sin(gap);
  const py = D.crank * Math.cos(gap);
  const dv = py - D.offset;
  const u = px - Math.sqrt(D.link * D.link - dv * dv);
  return {u, linkAng: Math.atan2(dv, px - u)};
}
const NUT0 = nutAt(0).u;

/**
 * Drive state for the finger opening angle gap (rad):
 *   nut      m, nut travel back from the closed position (0 closed .. stroke at CLAW.gapMax)
 *   screwRev turns of the lead screw from closed;  motorRev = 10 x screwRev
 *   linkAng  rad, push link angle to the screw axis
 *   finger   rad, movable finger opening (= gap)
 *   lever    m, effective lever = d(nut)/d(finger): pivot torque = nut force x lever
 *   pivotPeak N·m and gripPeak N at the grip pad, with the motor at its peak torque
 */
export function clawDrive(gap) {
  const D = CLAW_DRIVE;
  const a = nutAt(gap);
  const h = 1e-4;
  const lever = Math.abs((nutAt(gap + h).u - nutAt(gap - h).u) / (2 * h));
  const nut = NUT0 - a.u;
  const screwRev = nut / D.lead;
  const pivotPeak = D.axialPeak * lever;
  return {nut, screwRev, motorRev: screwRev * D.ratio, linkAng: a.linkAng, finger: gap, lever, pivotPeak, gripPeak: pivotPeak / D.gripR};
}
CLAW_DRIVE.stroke = clawDrive(CLAW.gapMax * D2R).nut; // m of nut travel, closed -> fully open
CLAW_DRIVE.strokeTime = (clawDrive(CLAW.gapMax * D2R).motorRev / CLAW_DRIVE.motor.rpm) * 60; // s, full open at rated speed

/** Grip force when the fingers are closed on nothing: a spring preload; under load the panel reads the model value. */
export const gripForce = (open, squeeze) => CLAW.gripMax * (1 - open) * (0.15 + 0.85 * squeeze);

// ------------------------------------------------------------ mass budget (spec §1: 420 kg) and centre of gravity
// Body-fixed items carry a fixed position (body frame at rest, bob added at run time). Limb items are lumped on
// their kinematic points, so cogAt follows the pose. The battery (68 kg, 16 % of the machine) sits on the
// equipment tray at y = 0.35 m, below the 0.42 m hip line, slightly forward to balance the tail.
const P = (id, cn, en, kg, pos, sys) => ({id, cn, en, kg, pos, sys});
export const MASS_BODY = [
  P('frame', '承载骨架（中央梁/侧梁/横梁/前后框架/设备托架）', 'CHASSIS FRAME', 55, [0.0, 0.42, 0], 'chassis'),
  P('armor', '外部装甲与缓冲隔离层', 'ARMOUR + ISOLATORS', 32, [-0.02, 0.53, 0], 'armor'),
  P('battery', '电池模组与 BMS（动力舱）', 'BATTERY + BMS', 68, [0.04, 0.35, 0], 'power'),
  P('pdu', '主接触器/预充/保险/直流母线/辅助电源', 'POWER DISTRIBUTION', 6, [-0.22, 0.37, 0], 'power'),
  P('control', '中央计算机/运动控制器/通信', 'CONTROL BAY', 6, [0.22, 0.46, 0], 'control'),
  P('drives', '伺服驱动器与辅助控制器（驱动舱）', 'SERVO DRIVES', 10, [-0.3, 0.43, 0], 'drive'),
  P('thermal', '液冷泵/冷板/散热器/风扇（散热舱）', 'THERMAL BAY', 11, [-0.12, 0.37, 0], 'thermal'),
  P('sensor', '前端传感头与 IMU（传感舱）', 'SENSOR HEAD + IMU', 7, [0.5, 0.5, 0], 'sensor'),
  P('harness', '主线束与连接器', 'HARNESS', 9, [0.0, 0.44, 0], 'power'),
];
// per leg, lumped on legIK points: hip mount + yaw + pitch actuators at the hip, links at their mid points
export const LEG_MASS = {hip: 7.8, femur: 2.4, knee: 2.9, tibia: 1.6, foot: 0.8}; // 15.5 kg
// per claw, lumped on clawAt points
export const CLAW_MASS = {base: 6.0, arm: 1.8, elbow: 2.2, fore: 2.0, wrist: 1.5, chela: 3.5}; // 17 kg
const sumv = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const mid = (a, b) => a.map((v, k) => (v + b[k]) / 2);

/** Point masses [[kg, [x,y,z]], ...] of the whole machine for a pose. */
function massPoints(pose = {}) {
  const legs = pose.legs || legsAt(pose.PHI || 0, pose.lift || 0, pose.settle || 0).legs;
  const bob = pose.bob !== undefined ? pose.bob : legs[0].hip[1] - BODY.ride;
  const pts = [];
  for (const m of MASS_BODY) pts.push([m.kg, [m.pos[0], m.pos[1] + bob, m.pos[2]]]);
  for (const l of legs) {
    pts.push([LEG_MASS.hip, l.hip]);
    pts.push([LEG_MASS.femur, mid(l.coxaEnd, l.kneeP)]);
    pts.push([LEG_MASS.knee, l.kneeP]);
    pts.push([LEG_MASS.tibia, mid(l.kneeP, l.footP)]);
    pts.push([LEG_MASS.foot, l.footP]);
  }
  for (const side of [1, -1]) {
    const c = clawAt(side, pose.open !== undefined ? pose.open : 0.3, pose.reach || 0);
    const up = (p) => [p[0], p[1] + bob, p[2]];
    const chela = c.W.map((v, k) => v + c.d[k] * 0.15);
    pts.push([CLAW_MASS.base, up(c.S)], [CLAW_MASS.arm, up(mid(c.S, c.E))], [CLAW_MASS.elbow, up(c.E)]);
    pts.push([CLAW_MASS.fore, up(mid(c.E, c.W))], [CLAW_MASS.wrist, up(c.W)], [CLAW_MASS.chela, up(chela)]);
  }
  const T = tailAt(pose.strike || 0, pose.stow || 0, pose.tailYaw || 0);
  for (let k = 0; k <= 8; k++) {
    // section 0 (root mount) sits on J1; section k spans pts3[k-1] -> pts3[k]
    const a = T.pts3[Math.max(0, k - 1)];
    const b = T.pts3[k];
    pts.push([TAIL.link[k], [ (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bob, (a[2] + b[2]) / 2]]);
    if (TAIL.act[k]) pts.push([TAIL.act[k], [b[0], b[1] + bob, b[2]]]);
  }
  return pts;
}

export const MASS = [
  ...MASS_BODY,
  {id: 'legs', cn: '八组机械腿（每条 15.5 kg）', en: 'LEGS x 8', kg: 8 * sumv(LEG_MASS), sys: 'leg'},
  {id: 'claws', cn: '双机械钳（每组 17 kg，含丝杠驱动）', en: 'CLAWS x 2', kg: 2 * sumv(CLAW_MASS), sys: 'claw'},
  {id: 'tail', cn: '尾根连接座 + 六节尾部连杆 + 末端安装节', en: 'TAIL (8 SECTIONS)', kg: TAIL.mass.slice(0, 8).reduce((a, b) => a + b, 0), sys: 'tail'},
  {id: 'stinger', cn: '尾刺执行模块', en: 'STINGER MODULE', kg: TAIL.mass[8], sys: 'stinger'},
];
{
  // limb positions in MASS = their own centre of mass at the standing pose (all feet down, tail at rest)
  const legs = legsAt(0, 0, 1).legs;
  const cm = (list) => {
    const m = list.reduce((a, [k]) => a + k, 0);
    return list.reduce((a, [k, p]) => a.map((v, i) => v + (k * p[i]) / m), [0, 0, 0]);
  };
  const all = massPoints({legs, bob: 0});
  const nb = MASS_BODY.length;
  const nl = 8 * 5;
  MASS.find((m) => m.id === 'legs').pos = cm(all.slice(nb, nb + nl));
  MASS.find((m) => m.id === 'claws').pos = cm(all.slice(nb + nl, nb + nl + 12));
  const tl = all.slice(nb + nl + 12);
  MASS.find((m) => m.id === 'stinger').pos = cm(tl.slice(-1));
  MASS.find((m) => m.id === 'tail').pos = cm(tl.slice(0, -1));
}
export const MASS_TOTAL = MASS.reduce((a, m) => a + m.kg, 0); // 420 kg

/**
 * Centre of gravity [x, y, z] (m, body frame) for pose {PHI, lift, settle, strike, stow, tailYaw, open, reach}
 * (or {legs, bob} from legsAt). legsAt's own .cog uses the tail at rest and claws at open 0.3.
 */
export function cogAt(pose = {}) {
  let m = 0;
  const c = [0, 0, 0];
  for (const [k, p] of massPoints(pose)) {
    m += k;
    for (let i = 0; i < 3; i++) c[i] += k * p[i];
  }
  return c.map((v) => v / m);
}

/** Convex hull of 2D points [[x, z], ...], counter-clockwise (monotone chain). */
function hull(P2) {
  const p = [...P2].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/**
 * Support polygon for gait phase PHI: poly = convex hull [[x, z], ...] of the planted feet (body frame, ground),
 * cog = [x, y, z], margin = signed distance (m) from the CoG ground projection to the nearest hull edge, positive
 * inside (static stability margin). pose adds strike / stow / tailYaw / open / reach to the CoG.
 */
export function supportAt(PHI, lift = 0, settle = 0, pose = {}) {
  const L = legsAt(PHI, lift, settle);
  const poly = hull(L.legs.filter((l) => l.stance).map((l) => [l.footP[0], l.footP[2]]));
  const cog = cogAt({...pose, legs: L.legs, bob: L.bob});
  const q = [cog[0], cog[2]];
  let margin = -Infinity;
  if (poly.length >= 3) {
    margin = Infinity;
    let inside = true;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ex = b[0] - a[0];
      const ez = b[1] - a[1];
      const len = Math.hypot(ex, ez);
      const sd = (ex * (q[1] - a[1]) - ez * (q[0] - a[0])) / len; // > 0 left of the CCW edge = inside
      if (sd < 0) inside = false;
      margin = Math.min(margin, Math.abs(sd));
    }
    if (!inside) margin = -margin;
  }
  return {poly, margin, cog, down: L.down};
}

// ------------------------------------------------------------ joint table (spec §3.2, §4, §5.2, §11-C)
// Peak static torques are computed here from the same functions that pose the parts: the gait at 0.35 m/s (any
// speed: STRIDE per cycle), the L1 lift, the halt, every tail curl from the strike wind-up to full stow, the claws
// from folded to full reach with a 15 kg payload in each chela. Horizontal (yaw) joints carry no static gravity
// moment, so they are sized for a 0.3 g horizontal load (turning, traction, sway) on the same levers.
// RULE: rated output torque >= 1.5 x computed peak static torque, rounded up to the next 10 N·m (the remaining
// margin covers dynamic loads, which the drive current limit and the torque feedback cap).
export const SAFETY = 1.5;
export const CLAW_PAYLOAD = 15; // kg held in each chela for the base / elbow / wrist sizing
const LAT = 0.3; // g, horizontal design load for yaw axes
const rated = (peak) => Math.max(10, Math.ceil((SAFETY * peak) / 10) * 10);
const peaks = (() => {
  const pk = {hipYaw: 0, hipPitch: 0, knee: 0, footLoad: 0, tail: Array(8).fill(0), tailYaw: 0, base: 0, elbow: 0, wrist: 0};
  for (let n = 0; n < 200; n++) {
    const PHI = n / 200;
    for (const [lift, settle] of [[0, 0], [1, 1], [0, 1]]) {
      for (const l of legsAt(PHI, lift, settle).legs) {
        pk.hipPitch = Math.max(pk.hipPitch, l.hipTorque);
        pk.knee = Math.max(pk.knee, l.kneeTorque);
        pk.hipYaw = Math.max(pk.hipYaw, LAT * l.load * Math.hypot(l.footP[0] - l.hip[0], l.footP[2] - l.hip[2]));
        pk.footLoad = Math.max(pk.footLoad, l.load);
      }
    }
  }
  for (let a = 0; a <= 32; a++) {
    for (const w of [0, 0.5, 1]) {
      const T = tailAt(-0.28 + (1.28 * a) / 32, w);
      T.torque.forEach((v, j) => (pk.tail[j] = Math.max(pk.tail[j], v)));
      // J1 yaw: 0.3 g sideways on every tail mass, lever = horizontal distance from the J1 axis
      let m = 0;
      for (let k = 1; k <= 8; k++) {
        m += TAIL.link[k] * Math.abs((T.pts[k - 1][0] + T.pts[k][0]) / 2 - TAIL.root[0]);
        if (k < 8) m += TAIL.act[k] * Math.abs(T.pts[k][0] - TAIL.root[0]);
      }
      pk.tailYaw = Math.max(pk.tailYaw, LAT * m * G);
    }
  }
  for (let r = 0; r <= 10; r++) {
    const c = clawAt(1, 0, r / 10);
    const chela = c.W.map((v, k) => v + c.d[k] * 0.15);
    const h = (p, o) => Math.hypot(p[0] - o[0], p[2] - o[2]);
    const mom = (o, list) => list.reduce((a, [kg, p]) => a + kg * G * h(p, o), 0);
    const load = [[CLAW_MASS.chela + CLAW_PAYLOAD, chela]];
    pk.wrist = Math.max(pk.wrist, mom(c.W, load));
    pk.elbow = Math.max(pk.elbow, mom(c.E, [...load, [CLAW_MASS.wrist, c.W], [CLAW_MASS.fore, mid(c.E, c.W)]]));
    pk.base = Math.max(pk.base, mom(c.S, [...load, [CLAW_MASS.wrist, c.W], [CLAW_MASS.fore, mid(c.E, c.W)], [CLAW_MASS.elbow, c.E], [CLAW_MASS.arm, mid(c.S, c.E)]]));
  }
  pk.grip = CLAW.gripMax * 1000 * CLAW_DRIVE.gripR; // N·m at the finger pivot for the 6.2 kN clamp
  return pk;
})();
export const PEAKS = peaks;

// rated is sized on the published (rounded) peak, so the table itself always shows rated >= 1.5 x peak
const J = (id, cn, en, count, dof, axis, drive, transmission, sensors, limit, peak, extra = {}) => ({id, cn, en, count, dof, axis, drive, transmission, sensors, limit, peak: Math.round(peak), rated: extra.rated || rated(Math.round(peak)), ...extra});
const ENC = '绝对式编码器 + 电机温度 + 相电流';
const tailDrv = (j) => (j < 3 ? '永磁同步伺服电机 + 制动器' : '永磁同步伺服电机');
export const JOINTS = [
  J('hipYaw', '髋部水平旋转', 'HIP YAW', 8, 1, '竖直轴 +y（侧梁安装法兰）', '永磁同步伺服电机', '谐波减速器 100:1 + 交叉滚子轴承', ENC, [-35, 35], peaks.hipYaw, {load: `0.3 g 水平牵引 × 足端水平半径`}),
  J('hipPitch', '髋部垂直摆动', 'HIP PITCH', 8, 1, '水平轴，垂直于腿平面', '永磁同步伺服电机 + 失电制动器', '行星 5:1 + 谐波 50:1 + 成对角接触轴承', ENC + ' + 扭矩传感器', [0, 120], peaks.hipPitch, {load: `足端最大竖向力 ${Math.round(peaks.footLoad)} N × 水平力臂`}),
  J('knee', '膝关节', 'KNEE', 8, 1, '水平轴，平行于髋俯仰轴', '永磁同步伺服电机 + 失电制动器', '谐波减速器 100:1 + 交叉滚子轴承', ENC, [60, 170], peaks.knee, {load: '足端竖向力 × 膝-足水平力臂'}),
  J('ankle', '足部被动摆动', 'ANKLE (PASSIVE)', 8, 1, '水平轴，平行于膝轴（另含 ±10° 侧摆）', '被动：扭簧回中 + 弹性体缓冲', '球铰 + 橡胶阻尼环', '足底压力传感器 + 接触开关 + 角度霍尔', [-40, 25], 0, {rated: 20, load: '扭簧回中力矩（被动，不承担主动扭矩）'}),
  J('clawYaw', '机械钳基座水平调整', 'CLAW BASE YAW', 2, 1, '竖直轴 +y（前端框架法兰）', '永磁同步伺服电机', '谐波减速器 100:1 + 交叉滚子轴承', ENC, [0, 55], LAT * peaks.base, {load: `0.3 g 水平 × 钳臂力臂（含 ${CLAW_PAYLOAD} kg 负载）`}),
  J('clawPitch', '机械钳基座上下摆动', 'CLAW BASE PITCH', 2, 1, '水平轴，横向 ±z', '永磁同步伺服电机 + 失电制动器', '行星 5:1 + 谐波 50:1 + 成对角接触轴承', ENC, [-25, 30], peaks.base, {load: `钳臂自重 + ${CLAW_PAYLOAD} kg 负载，全伸展`}),
  J('clawElbow', '机械钳肘关节（斜轴）', 'CLAW ELBOW', 2, 1, '斜轴（偏竖直 30°，同时产生前伸与下压）', '永磁同步伺服电机', '谐波减速器 80:1', ENC, [-60, 10], peaks.elbow, {load: `前臂 + 钳体 + ${CLAW_PAYLOAD} kg`}),
  J('clawWrist', '机械钳腕关节', 'CLAW WRIST', 2, 1, '近竖直轴', '永磁同步伺服电机', '谐波减速器 80:1', ENC, [-20, 10], peaks.wrist, {load: `钳体 + ${CLAW_PAYLOAD} kg`}),
  J('clawGrip', '活动钳爪开合', 'CLAW GRIP', 2, 1, '钳爪铰轴（垂直于钳体平面）', `伺服电机 ${CLAW_DRIVE.motor.type}`, `行星 ${CLAW_DRIVE.ratio}:1 → Tr20×4 梯形丝杠 → 青铜螺母 → 推杆 → 活动钳爪`, '电机编码器 + 钳爪绝对角度 + 螺母测力环（夹持力）+ 限位开关', [0, CLAW.gapMax], peaks.grip, {
    rated: Math.round(clawDrive(0).lever * CLAW_DRIVE.axialRated),
    load: `${CLAW.gripMax} kN 夹持力 @ ${CLAW_DRIVE.gripR * 1000} mm`,
  }),
  J('tailYaw', '尾根 J1 水平偏转', 'TAIL J1 YAW', 1, 1, '竖直轴 +y（后端框架尾根座）', '永磁同步伺服电机 + 失电制动器', '行星 4:1 + 谐波 50:1 + 交叉滚子轴承', ENC + ' + 扭矩传感器', [-30, 30], peaks.tailYaw, {load: '0.3 g 侧向 × 尾部水平力臂'}),
  ...[0, 1, 2, 3, 4, 5, 6].map((j) => J(j === 0 ? 'tailPitch' : `tailJ${j + 1}`, j === 0 ? '尾根 J1 垂直俯仰' : `尾部 J${j + 1} 俯仰`, j === 0 ? 'TAIL J1 PITCH' : `TAIL J${j + 1}`, 1, 1, '水平轴 ±z（尾平面法向）', tailDrv(j), j < 2 ? '行星 4:1 + 谐波 50:1 + 交叉滚子轴承' : '谐波减速器 100:1 + 交叉滚子轴承', ENC + (j < 2 ? ' + 扭矩传感器' : ''), [-45, 45].map((v, k) => (j === 0 ? [80, 140][k] : v)), peaks.tail[j], {load: `下游尾节自重静弯矩（扫描冲刺/收尾全行程）`})),
  J('stinger', '尾刺 J8 俯仰', 'TAIL J8 STINGER', 1, 1, '水平轴 ±z', '永磁同步伺服电机', '谐波减速器 80:1 + 扭矩限制滑差离合器', ENC + ' + 尖端接触/力传感器', [-75, 60], peaks.tail[7], {load: '尾刺模块自重；接触力由滑差离合器限制'}),
];

// spec §5.3: actuators nearer the root are never smaller than the ones distal of them. J2 can see a slightly larger
// static moment than J1 (the curl rises over J1, so part of the tail sits almost above it); J1 then takes J2's
// rating. It also carries the strike reaction and the 2-DOF root bending moment.
{
  const chain = ['tailPitch', 'tailJ2', 'tailJ3', 'tailJ4', 'tailJ5', 'tailJ6', 'tailJ7', 'stinger'].map((id) => JOINTS.find((j) => j.id === id));
  for (let k = chain.length - 2; k >= 0; k--) chain[k].rated = Math.max(chain[k].rated, chain[k + 1].rated);
}

// Stinger loads (spec §5.5 asks for them to be stated). Two different numbers:
//  STINGER.force  static hold / press force: at full strike the tail holds the gravity moment plus a steady tip
//                 force along the stinger axis on rated torque; the smallest (rated - gravity) / lever over J1..J8.
//  STINGER.impact peak dynamic impact force (the sheet's 1200 N, SPEC.strike): see impactAt below.
// (computed lazily, after the impact sizing below has set the final tail ratings)
const staticForce = () => {
  const T = tailAt(1);
  const a = T.ang[7];
  const d = [Math.cos(a), Math.sin(a)];
  const ids = ['tailPitch', 'tailJ2', 'tailJ3', 'tailJ4', 'tailJ5', 'tailJ6', 'tailJ7', 'stinger'];
  let force = Infinity;
  let limitJoint = '';
  ids.forEach((id, j) => {
    const r = [T.tip[0] - T.pts[j][0], T.tip[1] - T.pts[j][1]];
    const arm = Math.abs(r[0] * d[1] - r[1] * d[0]);
    const f = (JOINTS.find((x) => x.id === id).rated - T.torque[j]) / Math.max(arm, 1e-3);
    if (f < force) {
      force = f;
      limitJoint = id;
    }
  });
  return {force: Math.floor(force / 10) * 10, limitJoint, tipAngle: a / D2R}; // N, -, deg
};

// Impact model. The strike snap (strikeCurve) drives the tip into the target near the end of its travel. Contact
// starts at strike s = IMPACT.contactS (the tip still moving, 0.8 of the way through the snap) and the whole chain
// is brought to rest by the compliant tip: a spring-loaded tip sleeve on a polyurethane stack, IMPACT.stop of
// axial travel, linear spring, rebound damped. Assumptions:
//  - the target is rigid; all deceleration happens in the tip compliance (conservative for the force);
//  - the drives are torque-limited during contact, so the chain decelerates as one body on the strike path s:
//    effective mass at the tip m = sum(m_i |dp_i/ds|^2) / (dtip_axial/ds)^2 over every tail point mass;
//  - tip axial speed v = (dtip_axial/ds) * ds/dt from strikeCurve at contact;
//  - spring peak force F = m v^2 / stop (F = k x, 1/2 m v^2 = 1/2 k stop^2), time to peak = (pi/2) stop / v.
// The joint loads at peak (gravity + chain deceleration + tip force) are checked against the rated torques below.
// contact at s = 0.90 (tip at 1.01 m/s), 20 mm of tip compliance -> ~1200 N peak in ~31 ms
export const IMPACT = {contactS: 0.9, stop: 0.02, clutch: 10}; // -, m (tip compliance travel), N·m (J8 slip)

/** Lumped tail masses for s: [[kg, (pts) => [x, y]]] matching cogAt (links at mid, actuators at the distal joint). */
const TAIL_PTS = [];
for (let k = 1; k <= 8; k++) {
  TAIL_PTS.push([TAIL.link[k], (p) => [(p[k - 1][0] + p[k][0]) / 2, (p[k - 1][1] + p[k][1]) / 2]]);
  if (k < 8) TAIL_PTS.push([TAIL.act[k], (p) => p[k], k]);
}
const tailPtsDist = (j) => TAIL_PTS.map((m, i) => [m, i]).filter(([, i]) => Math.floor(i / 2) + 1 > j).map(([m]) => m);

/**
 * Impact at the tip for contact at strike amount s (default IMPACT.contactS) with compliance travel stop (m).
 * Returns {s, u (s into the strike), v (m/s axial tip speed), meff (kg), force (N peak), tPeak (s), impulse (N·s),
 * decel (m/s^2 at the tip at peak), torque[8] (N·m |load| at J1 pitch..J8 at peak force), ok (all <= rated)}.
 */
export function impactAt(s = IMPACT.contactS, stop = IMPACT.stop) {
  const h = 1e-3;
  const pA = tailAt(s - h).pts;
  const pB = tailAt(s + h).pts;
  const T = tailAt(s);
  const e = [Math.cos(T.ang[7]), Math.sin(T.ang[7])]; // stinger axis
  const g = ((pB[8][0] - pA[8][0]) * e[0] + (pB[8][1] - pA[8][1]) * e[1]) / (2 * h); // axial tip travel per unit s
  const vel = (m) => {
    const a = m[1](pA);
    const b = m[1](pB);
    return [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h)];
  };
  let ms = 0;
  for (const m of TAIL_PTS) {
    const w = vel(m);
    ms += m[0] * (w[0] * w[0] + w[1] * w[1]);
  }
  // time into the strike where strikeCurve reaches s on the snap, and ds/dt there
  let lo = 0.3 * STRIKE_DUR;
  let hi = 0.42 * STRIKE_DUR;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (strikeCurve(mid) < s) lo = mid;
    else hi = mid;
  }
  const u = (lo + hi) / 2;
  const sd = (strikeCurve(u + 1e-6) - strikeCurve(u - 1e-6)) / 2e-6;
  const meff = ms / (g * g);
  const v = g * sd;
  const force = (meff * v * v) / stop;
  const sdd = -force / (meff * g); // chain deceleration along s at peak compression (chain momentarily at rest)
  const torque = [];
  for (let j = 0; j < 8; j++) {
    const pj = T.pts[j];
    let M = 0;
    for (const m of tailPtsDist(j)) {
      const p = m[1](T.pts);
      const w = vel(m);
      const f = [m[0] * w[0] * sdd, m[0] * (w[1] * sdd + G)]; // inertia + gravity load the joint must hold
      M += (p[0] - pj[0]) * f[1] - (p[1] - pj[1]) * f[0];
    }
    M += (T.tip[0] - pj[0]) * (force * e[1]) - (T.tip[1] - pj[1]) * (force * e[0]); // target pushes back on the tip
    torque.push(Math.abs(M));
  }
  const ids = ['tailPitch', 'tailJ2', 'tailJ3', 'tailJ4', 'tailJ5', 'tailJ6', 'tailJ7', 'stinger'];
  const ok = torque.every((t, j) => t <= JOINTS.find((x) => x.id === ids[j]).rated) && torque[7] <= IMPACT.clutch;
  return {s, u, v, meff, force, tPeak: ((Math.PI / 2) * stop) / v, impulse: meff * v, decel: force / meff, torque, ok};
}

// Impact sizing: each tail pitch joint must also carry its load at the impact peak (a short dynamic load, sized
// at 1.0 x rated). rated = max(1.5 x static peak, impact peak), rounded up to 10 N·m, then root >= tip again.
// Each tail row gets `impact` (N·m at the 1200 N peak).
{
  const ids = ['tailPitch', 'tailJ2', 'tailJ3', 'tailJ4', 'tailJ5', 'tailJ6', 'tailJ7', 'stinger'];
  const chain = ids.map((id) => JOINTS.find((j) => j.id === id));
  impactAt().torque.forEach((t, j) => {
    chain[j].impact = Math.round(t);
    chain[j].rated = Math.max(chain[j].rated, Math.ceil(t / 10) * 10);
  });
  for (let k = chain.length - 2; k >= 0; k--) chain[k].rated = Math.max(chain[k].rated, chain[k + 1].rated);
}

const IMP = impactAt();
const STATIC = staticForce();
export const STINGER = {
  force: STATIC.force, // N, static hold / press force along the stinger at full strike
  limitJoint: STATIC.limitJoint, // joint that limits the static force
  impact: Math.round(IMP.force / 10) * 10, // N, peak dynamic impact force at the tip (= SPEC.strike)
  impactV: IMP.v, // m/s, tip speed at contact
  impactMass: IMP.meff, // kg, effective mass of the tail at the tip
  impactTime: IMP.tPeak, // s, contact to peak force
  stop: IMPACT.stop, // m, tip compliance travel
  clutch: IMPACT.clutch, // N·m, J8 slip clutch
  tipAngle: STATIC.tipAngle, // deg, stinger axis at full strike
  impactOk: IMP.ok, // joint loads at the impact peak stay within rating
};
// SPEC.strike stays the sheet's 1200 N: it is the peak impact force, and impactAt reproduces it (STINGER.impact).

// ------------------------------------------------------------ the nine systems of spec §1
export const SYSTEMS = [
  {id: '01', cn: '中央承载躯干', en: 'CENTRAL CHASSIS', sys: 'chassis', tags: ['chassis']},
  {id: '02', cn: '八组多自由度机械腿', en: 'EIGHT ARTICULATED LEGS', sys: 'leg', tags: LEGS.map((_, i) => `leg${i}`)},
  {id: '03', cn: '左右双机械钳', en: 'DUAL MANIPULATOR CLAWS', sys: 'claw', tags: ['clawL', 'clawR']},
  {id: '04', cn: '多节式机械尾巴', en: 'SEGMENTED ARTICULATED TAIL', sys: 'tail', tags: ['tail']},
  {id: '05', cn: '尾端执行机构', en: 'TERMINAL STINGER MODULE', sys: 'stinger', tags: ['stinger']},
  {id: '06', cn: '主动力系统', en: 'MAIN POWER SYSTEM', sys: 'power', tags: ['power', 'drive']},
  {id: '07', cn: '运动控制与传感系统', en: 'CONTROL & SENSOR SYSTEM', sys: 'control', tags: ['control', 'sensor']},
  {id: '08', cn: '装甲防护系统', en: 'ARMOR PROTECTION SYSTEM', sys: 'armor', tags: ['armor']},
  {id: '09', cn: '热管理与维护系统', en: 'THERMAL MANAGEMENT & SERVICE', sys: 'thermal', tags: ['thermal']},
];
