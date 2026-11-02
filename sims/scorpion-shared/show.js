// SC-8 operator state as a pure function of an event list and t. The film plays SCRIPT; the live page appends
// events as the visitor clicks and runs the very same functions, so both show the same machine.
import {CLAW, LEGS, STRIDE, STRIKE_DUR, footAt, gripForce, strikeCurve, tailAt} from './kin.js';

export const DURATION = 35;
export const SCRIPT = [
  {t: 0, view: 'hero', speed: 0.35, say: 'BOOT · TETRAPOD GAIT · 0.35 m/s'},
  {t: 4.2, view: 'side', btn: 'side', say: 'VIEW › SIDE'},
  {t: 8.6, iso: 'leg', view: 'leg', speed: 0.18, btn: 'leg', say: 'ISOLATE › LEG L1 · 3 JOINTS'},
  {t: 12.8, iso: 'claw', view: 'claw', speed: 0, btn: 'claw', say: 'ISOLATE › CLAW L · HALT'},
  {t: 14.0, grip: 1, btn: 'grip', say: 'CLAW › GRIP CYCLE'},
  {t: 16.0, grip: 1, btn: 'grip', say: 'CLAW › GRIP CYCLE'},
  {t: 18.0, iso: 'tail', view: 'tail', btn: 'tail', say: 'ISOLATE › TAIL · 7 SEGMENTS'},
  {t: 19.4, strike: 1, btn: 'strike', say: 'TAIL › STRIKE'},
  {t: 21.6, strike: 1, btn: 'strike', say: 'TAIL › STRIKE'},
  {t: 23.6, iso: '', xray: 1, view: 'core', btn: 'xray', say: 'DISPLAY › X-RAY ARMOUR'},
  {t: 26.8, xray: 0, explode: 1, view: 'top', btn: 'explode', say: 'DISPLAY › EXPLODED VIEW'},
  {t: 30.4, explode: 0, view: 'hero', btn: 'hero', say: 'VIEW › HERO · REASSEMBLE'},
  {t: 31.6, speed: 0.9, drag: 1.1, btn: 'speed', say: 'DRIVE › 0.90 m/s'},
];
export const SPEED_MAX = 1.2;

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// eased hold-and-move: each event with the key pulls the value toward its target over dur seconds
const evAt = (EV, key, t, init, dur, target = (e) => e[key]) => {
  let v = init;
  for (const e of EV) if (e[key] !== undefined && e.t <= t) v += (target(e) - v) * ss(e.t, e.t + (e.drag ?? dur), t);
  return v;
};
export const speedAt = (EV, t) => evAt(EV, 'speed', t, EV[0].speed ?? 0, 1.2);

// claw grip cycle: open wide, snap shut, hold, settle back
export const GRIP_DUR = 2.0;
const gripShape = (u) => ({
  open: Math.max(0, 0.32 + 0.68 * ss(0, 0.35, u) - ss(0.42, 0.6, u) + 0.32 * ss(1.35, 2.0, u)),
  squeeze: ss(0.5, 0.62, u) * (1 - ss(1.25, 1.5, u)),
  reach: 0.7 * ss(0, 0.4, u) * (1 - ss(1.3, 2.0, u)),
});
const lastWin = (EV, key, t, dur) => {
  let u = -1;
  for (const e of EV) if (e[key] && t >= e.t && t < e.t + dur) u = t - e.t;
  return u;
};
export const strikeAt = (EV, t) => {
  let s = 0.025 * Math.sin(0.8 * t);
  for (const e of EV) if (e.strike) s += strikeCurve(t - e.t);
  return s;
};

export function opsAt(EV, t) {
  const iso = {};
  for (const k of ['leg', 'claw', 'tail']) iso[k] = evAt(EV, 'iso', t, 0, 0.7, (e) => (e.iso === k ? 1 : 0));
  const gripU = lastWin(EV, 'grip', t, GRIP_DUR);
  const g = gripU >= 0 ? gripShape(gripU) : {open: 0.32 + 0.04 * Math.sin(1.4 * t), squeeze: 0, reach: 0};
  return {
    speed: speedAt(EV, t),
    iso,
    xray: evAt(EV, 'xray', t, 0, 1.0),
    explode: evAt(EV, 'explode', t, 0, 1.5),
    ...g,
    gripU,
    strike: strikeAt(EV, t),
    strikeU: lastWin(EV, 'strike', t, STRIKE_DUR),
  };
}

// ------------------------------------------------------------ views: target relative to the body, degrees
export const VIEW_FN = {
  hero: (u) => ({tx: 0.2, ty: 0.62, tz: 0, az: 323 + 1.1 * u, el: 15, d: 5.6, sx: 0, sy: -40}),
  side: (u) => ({tx: 0.25, ty: 0.66, tz: 0, az: 268 - 0.7 * u, el: 7, d: 5.4, sx: 0, sy: -40}),
  leg: (u) => ({tx: 0.48, ty: 0.3, tz: 0.48, az: 302 + 0.8 * u, el: 9, d: 2.5, sx: 0, sy: -40}),
  claw: (u) => ({tx: 0.95, ty: 0.42, tz: 0.22, az: 26 + 1.0 * u, el: 20, d: 2.2, sx: 0, sy: -40}),
  tail: (u) => ({tx: -0.4, ty: 0.9, tz: 0, az: 252 - 0.8 * u, el: 6, d: 3.6, sx: 0, sy: -40}),
  core: (u) => ({tx: -0.05, ty: 0.62, tz: 0, az: 332 + 1.2 * u, el: 30, d: 4.6, sx: 0, sy: -40}),
  top: (u) => ({tx: 0.1, ty: 0.45, tz: 0, az: 300 + 2.2 * u, el: 55, d: 7.6, sx: 0, sy: -40}),
};
const lerpDeg = (a, b, k) => a + ((((b - a + 540) % 360) - 180) * k);
export const viewList = (EV) => EV.filter((e) => e.view).map((e) => [e.t, e.view]);
export function viewAt(list, t) {
  let i = 0;
  while (i < list.length - 1 && list[i + 1][0] <= t) i++;
  const cur = VIEW_FN[list[i][1]](t - list[i][0]);
  if (i === 0) return cur;
  const prev = VIEW_FN[list[i - 1][1]](t - list[i - 1][0]);
  const k = ss(list[i][0], list[i][0] + 1.8, t);
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? lerpDeg(prev.az, cur.az, k) : prev[key] + (cur[key] - prev[key]) * k;
  // a wide swing backs off a little so the camera never brushes the tail
  const swing = Math.min(1, Math.abs(((cur.az - prev.az + 540) % 360) - 180) / 90);
  o.d += 0.9 * swing * Math.sin(Math.PI * k);
  o.el += 6 * swing * Math.sin(Math.PI * k);
  return o;
}
export const toCam = (c) => ({...c, az: (c.az * Math.PI) / 180, el: (c.el * Math.PI) / 180});
export const viewNow = (list, t) => {
  let i = 0;
  while (i < list.length - 1 && list[i + 1][0] <= t) i++;
  return {view: list[i][1], since: t - list[i][0], prev: i ? list[i - 1][1] : null};
};

// ------------------------------------------------------------ the operator's pointer
const REST = [[760, 640], [900, 620], [680, 600], [820, 660]];
export function makeCursor(ui, EV) {
  const ev = EV.filter((e) => e.t > 0 && e.btn).map((e) => ({t: e.t, spot: e.btn === 'speed' ? ui.knobAt(speedAt(EV, e.t)) : ui.spots[e.btn], drag: e.drag || 0}));
  const WP = [[0, 820, 640]];
  ev.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot]);
    if (e.drag) {
      for (let k = 0; k <= 10; k++) {
        const tt = e.t + (k / 10) * e.drag;
        WP.push([tt + 0.02, ...ui.knobAt(speedAt(EV, tt))]);
      }
    } else WP.push([e.t + 0.24, ...e.spot]);
    WP.push([e.t + e.drag + 1.5, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const lin = t1 - t0 < 0.2;
    const k = lin ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = lin ? 0 : Math.sin(Math.PI * k) * Math.min(26, len * 0.07);
    let press = false;
    let drag = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of ev) {
      if (t >= e.t - 0.07 && t < e.t + Math.max(0.09, e.drag + 0.1)) press = true;
      if (e.drag && t >= e.t && t < e.t + e.drag + 0.1) drag = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, drag, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ console data for a frame
const CALLS = {
  hero: [['sting', '机械尾刺', 'TAIL STINGER · 1200 N'], ['armor', '主体装甲', 'COMPOSITE ARMOUR'], ['claw', '大型机械钳', 'CLAW · 6.2 kN'], ['footL1', '多关节足', '8 LEGS · 3 JOINTS EACH']],
  side: [['sting', '机械尾刺', 'TAIL STINGER · 1200 N'], ['armor', '主体装甲', 'COMPOSITE ARMOUR'], ['claw', '大型机械钳', 'CLAW · 6.2 kN'], ['footL1', '多关节足', '8 LEGS · 3 JOINTS EACH']],
  leg: [['femurJ', '股节关节', 'FEMUR'], ['knee', '胫节关节', 'KNEE'], ['footL1', '足尖', 'FOOT']],
  claw: [['claw', '钳爪执行器', 'GRIP'], ['clawTip', '多级传动', 'OPENING']],
  tail: [['sting', '尾刺执行器', 'TIP SPEED'], ['tailDrive', '尾部驱动组', '7 SEGMENTS · 8 SERVOS']],
  core: [['core', '动力核心', 'POWER CORE · 8 h'], ['ccu', '中央控制单元', 'CENTRAL CONTROL UNIT'], ['tailDrive', '尾部驱动组', 'TAIL DRIVE']],
  top: [['armor', '主体装甲', 'ARMOUR · LIFTED'], ['claw', '大型机械钳', 'CLAW ASSEMBLY'], ['sting', '尾刺执行器', 'TAIL ASSEMBLY'], ['footL1', '足部执行器', 'LEG MODULE × 8']],
};
const fmtT = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export function makeConsoleFrame(ui, st) {
  // src: {phiAt(t), strikeAt(t), EV, list (views), duration}
  return (t, o, L, src, cursor) => {
    const {phiAt, EV, list} = src;
    const PHI = phiAt(t);
    const gait = LEGS.map((_, i) => {
      const runs = [];
      let a = -1;
      for (let c = 0; c <= 120; c++) {
        const on = footAt(i, phiAt(t - 3 + (c / 120) * 3)).stance;
        if (on && a < 0) a = c / 120;
        if ((!on || c === 120) && a >= 0) {
          runs.push([a, c / 120]);
          a = -1;
        }
      }
      return runs;
    });
    const l1 = L.legs[0];
    const T = tailAt(o.strike);
    const T2 = tailAt(src.strikeAt(t + 1 / 120));
    const T0 = tailAt(src.strikeAt(t - 1 / 120));
    const tipV = Math.hypot(T2.tip[0] - T0.tip[0], T2.tip[1] - T0.tip[1]) * 60;
    const hist = Array.from({length: 81}, (_, i) => tailAt(src.strikeAt(t - 4 + i * 0.05)).tip[1]);
    const u = o.strikeU;
    const k = u / STRIKE_DUR;
    const tailState = u < 0 ? 'ARMED' : k < 0.3 ? 'COCK' : k < 0.42 ? 'STRIKE' : k < 0.62 ? 'HOLD' : 'RETURN';
    const g = o.gripU;
    const clawState = g < 0 ? 'IDLE' : g < 0.42 ? 'OPEN' : g < 0.6 ? 'CLOSE' : g < 1.35 ? 'HOLD' : 'RELEASE';
    const kN = gripForce(o.open, o.squeeze);
    const deg = CLAW.gapMax * o.open;
    const mode = o.explode > 0.5 ? 'EXPLODED' : o.xray > 0.5 ? 'X-RAY' : u >= 0 ? 'STRIKING' : g >= 0 ? 'GRIPPING' : o.speed > 0.02 ? 'WALKING' : 'STANDING';

    // callouts: this view's after it settles, the previous view's fading out
    const vn = viewNow(list, t);
    const live = {femurJ: `FEMUR ${((l1.femur * 180) / Math.PI).toFixed(0)}°`, knee: `KNEE ${((l1.knee * 180) / Math.PI).toFixed(0)}°`, footL1: l1.stance ? 'FOOT · PLANTED' : 'FOOT · SWING', claw: `GRIP ${kN.toFixed(1)} kN`, clawTip: `OPENING ${deg.toFixed(0)}°`};
    if (vn.view === 'tail') live.sting = `TIP SPEED ${tipV.toFixed(1)} m/s`;
    const calls = [];
    const put = (view, op) => {
      if (op < 0.02) return;
      for (const [a, name, sub] of CALLS[view] || []) {
        const at = st.project(st.robot.anchorAt(a));
        if (!at || at[0] < 340 || at[0] > 1260 || at[1] < 80 || at[1] > 700) continue;
        const dx = at[0] < 800 ? -80 : 80;
        let dy = at[1] > 400 ? 56 : -62;
        if (ui.covered(at[0] + dx * 2.4, at[1] + dy)) dy = -dy;
        if (ui.covered(at[0] + dx * 2.4, at[1] + dy)) continue;
        calls.push({at, dx, dy, name, sub: (view === vn.view && live[a]) || sub, o: op});
      }
    };
    put(vn.view, ss(1.1, 1.7, vn.since));
    if (vn.prev && vn.since < 0.35) put(vn.prev, 1 - vn.since / 0.35);

    const past = EV.filter((e) => e.t <= t && e.say);
    ui.update({
      t,
      progress: t / src.duration,
      speed: o.speed,
      freq: o.speed / STRIDE,
      phase: ((PHI % 1) + 1) % 1,
      feetDown: L.down,
      mode,
      gait,
      stance: L.legs.map((l) => l.stance),
      torque: L.legs.map((l) => l.torque),
      l1: {yaw: (l1.yaw * 180) / Math.PI, femur: (l1.femur * 180) / Math.PI, knee: (l1.knee * 180) / Math.PI},
      tail: {tipV, pitch: (T.ang[T.ang.length - 1] * 180) / Math.PI, state: tailState, hist, height: T.tip[1]},
      claw: {deg, kN, state: clawState},
      on: {
        hero: vn.view === 'hero', side: vn.view === 'side', top: vn.view === 'top',
        leg: o.iso.leg > 0.5, claw: o.iso.claw > 0.5, tail: o.iso.tail > 0.5,
        xray: o.xray > 0.5, explode: o.explode > 0.5, grip: g >= 0, strike: u >= 0,
      },
      log: past.slice(-4).map((e) => ({time: fmtT(e.t), text: e.say, fresh: t - e.t < 1.2})),
      now: past.length ? past[past.length - 1].say : '',
      ticks: EV.filter((e) => e.btn).map((e) => e.t / src.duration),
      clock: fmtT(t),
      calls,
      cursor,
    });
  };
}
