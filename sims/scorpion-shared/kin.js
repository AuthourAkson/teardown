// SCORPION SC-8, the math. Metres, radians, no three.js. Dimensions from the SC-8 sheets (pic/蝎子三视图.png,
// pic/蝎子机械原理图.png): 2180 long, 1530 wide, 1280 high, 420 kg, 8 three-segment legs, 2 claws, 7 tail
// segments and a stinger. One gait phase PHI poses all eight legs; one curl value poses the tail; one grip value
// opens the claws. Every readout on the console comes from the functions below.
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
export const LEG = {coxa: 0.11, femur: 0.36, tibia: 0.46};
export const PAIRS = [
  {x: 0.26, z: 0.21, yaw: 38},
  {x: 0.09, z: 0.23, yaw: 12},
  {x: -0.08, z: 0.23, yaw: -14},
  {x: -0.25, z: 0.21, yaw: -40},
];
export const FOOT_R = 0.55; // neutral foot distance from the hip, on the ground
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
export function footAt(i, PHI) {
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

/** Every leg at gait phase PHI: poses, stance flags, and the vertical load each planted foot carries. */
export function legsAt(PHI) {
  const bob = bobAt(PHI);
  const out = LEGS.map((_, i) => {
    const f = footAt(i, PHI);
    return {...legIK(i, f.pos, bob), stance: f.stance, p: f.p, foot: f.pos};
  });
  const n = out.filter((l) => l.stance).length || 1;
  const w = (SPEC.mass * G) / n;
  for (const l of out) {
    l.load = l.stance ? w : 0;
    // femur joint torque: the foot's vertical load times its horizontal reach from the femur pivot
    const reach = Math.hypot(l.footP[0] - l.coxaEnd[0], l.footP[2] - l.coxaEnd[2]);
    l.torque = l.load * reach; // N·m
  }
  return {legs: out, bob, down: out.filter((l) => l.stance).length};
}

// ------------------------------------------------------------ tail: 7 segments + stinger, pitched in the xy plane
export const TAIL = {
  root: [BODY.back, 0.55], // x, y of the tail root
  seg: [0.18, 0.18, 0.17, 0.16, 0.155, 0.145, 0.135],
  sting: 0.27,
  // rest pitch of each joint (relative bend, degrees): the tail rises behind and curls forward over the back
  rest: [138, -22, -24, -26, -28, -30, -32, -40],
  // strike: every joint bends further toward the front, the stinger drives down at the target
  strike: [-34, -8, -6, -2, 4, 10, 18, 40],
  // stow: flatter, lower curl for the low walk
  stow: [8, 4, 2, 0, -2, -4, -4, 0],
};

/**
 * Tail joints for curl state: s = strike amount 0..1 (0 rest, 1 full strike), w = stow 0..1.
 * Returns points [[x, y], ...] from the root through every joint to the stinger tip, and the absolute angle of each
 * segment.
 */
export function tailAt(s, w = 0) {
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
  return {pts, ang, tip: pts[pts.length - 1]};
}
export const TAIL_LEN = TAIL.seg.reduce((a, b) => a + b, 0) + TAIL.sting;

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
  arm: 0.27,
  fore: 0.27,
  palm: 0.2,
  finger: 0.25,
  gapMax: 34, // degrees the movable finger opens
  gripMax: 6.2, // kN at full close, the panel's GRIP FORCE scale
};

/** One claw's points (side +1 left / -1 right) for open 0..1 and reach 0..1 (folded in to stretched out). */
export function clawAt(side, open, reach = 0) {
  const [sx, sy, sz] = CLAW.shoulder;
  const S = [sx, sy, sz * side];
  const yaw = (24 - 10 * reach) * D2R * side; // splay out from the midline
  const ux = Math.cos(yaw);
  const uz = Math.sin(yaw);
  const pa = (14 - 6 * reach) * D2R; // arm climbs from the shoulder
  const pf = (-12 + 6 * reach) * D2R; // forearm runs down and forward
  const E = [S[0] + ux * CLAW.arm * Math.cos(pa), S[1] + CLAW.arm * Math.sin(pa), S[2] + uz * CLAW.arm * Math.cos(pa)];
  const yaw2 = (-30 + 14 * reach) * D2R * side; // the forearm turns back in toward the front
  const vx = Math.cos(yaw2);
  const vz = Math.sin(yaw2);
  const W = [E[0] + vx * CLAW.fore * Math.cos(pf), E[1] + CLAW.fore * Math.sin(pf), E[2] + vz * CLAW.fore * Math.cos(pf)];
  const yaw3 = (-14 + 6 * reach) * D2R * side;
  const gap = CLAW.gapMax * open * D2R;
  return {S, E, W, yaw: yaw, yaw2, yaw3, pa, pf, gap};
}

/** Grip force when the fingers are closed on nothing: a spring preload; under load the panel reads the model value. */
export const gripForce = (open, squeeze) => CLAW.gripMax * (1 - open) * (0.15 + 0.85 * squeeze);
