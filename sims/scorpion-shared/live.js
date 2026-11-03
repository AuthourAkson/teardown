// SC-8 as a page you drive: the film's console over the film's stage, run in real time. ASSEMBLIES isolate a part
// (HERO, LEG L1, CLAW L, TAIL, STINGER, CARAPACE) or fire STRIKE; DISPLAY switches views (FRONT, SIDE, TOP) and
// layers (LABELS, SECTION, EXPLODED, TURNTABLE, GAIT TRACE, BALANCE). Drag orbits, the wheel zooms, keys:
// 1/2/3 views, H L C T P O hero/leg/claw/tail/stinger/carapace, S strike, G grip, E explode, R turntable,
// B balance, ← → speed. Left alone it plays the film's script as an auto tour with the operator's pointer, looped;
// any click, drag, wheel or key hands control over, and 25 s of quiet hands it back.
// Every click becomes an event in the visitor's own list, read by the same opsAt / viewAt as the film, so the page
// can show nothing the film's functions do not. The walk integrates in real time from the eased speed.
import {warmComposer} from '../kit/warm.js';
import {STRIDE} from './kin.js';
import {createConsole} from './console.js';
import {DURATION, SCRIPT, SPEED_MAX, TURN_RATE, makeConsoleFrame, makeCursor, opsAt, settleOf, toCam, viewAt, viewList} from './show.js';
import {createStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const CSS = (top) => `
html,body{background:#f5f2ec;overflow:hidden;margin:0}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab;position:absolute;left:0;top:0;width:${W}px;height:${H}px}
#gl.drag{cursor:grabbing}
.vb{pointer-events:auto;cursor:pointer}
.vb:hover{filter:brightness(.94)}
.tourchip{position:absolute;left:800px;top:${top + 112}px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid rgba(40,40,44,.22);border-radius:11px;background:rgba(251,250,247,.94);color:#26272b;font:700 8.5px 'JetBrains Mono',monospace;letter-spacing:1.4px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#ee5a24}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8a8478;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

// what each ASSEMBLIES button sets: a mode label, a view, an isolate key and the layer state it implies
const ASM = {
  hero: {mode: 'SCUTTLE', view: 'hero', iso: '', lift: 0, jointCut: 0, cut: 0, open1: 0, explode: 0, labels: 0},
  leg: {mode: 'LEG L1 LIFT', view: 'leg', iso: 'leg', lift: 1, jointCut: 1, cut: 0, open1: 0, explode: 0, labels: 1, speed: 0},
  claw: {mode: 'CLAW L OPEN', view: 'claw', iso: 'claw', lift: 0, jointCut: 0, cut: 0, open1: 0, explode: 0, grip: 1, speed: 0},
  tail: {mode: 'TAIL APART', view: 'tail', iso: 'tail', lift: 0, jointCut: 0, cut: 0, open1: 0, explode: 0, sweep: 1, speed: 0},
  stinger: {mode: 'STINGER', view: 'sting', iso: 'tail', lift: 0, jointCut: 0, cut: 0, open1: 0, explode: 0, speed: 0},
  carapace: {mode: 'CARAPACE OPEN', view: 'carapace', iso: '', lift: 0, jointCut: 0, cut: 1, open1: 1, explode: 0, speed: 0},
};
const ASM_SAY = {hero: 'VIEW · HERO', leg: 'ISOLATE · LEG L1 · LIFT', claw: 'ISOLATE · CLAW L · GRIP', tail: 'ISOLATE · TAIL · SWEEP', stinger: 'ISOLATE · STINGER MODULE', carapace: 'CARAPACE · 3 LAYERS · SECTION'};
const VIEW_MODE = {front: 'STANDING · FRONT', side: 'SIDE', top: 'TOP · BALANCE'};

export function runLive() {
  const top = Number(document.body.dataset.top || 0);
  const style = document.createElement('style');
  style.textContent = CSS(top);
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);

  const st = createStage({canvas});
  const ui = createConsole(app);

  // ------------------------------------------------------------ quality tiers
  // the film's look; then half the MSAA and shadow map; then no AO, small shadows, no MSAA and the console redrawn
  // every other frame. Integrated GPUs settle within a couple of seconds, phones start on the last step.
  const TIERS = [
    {samples: 8, shadow: 4096, blur: 20, radius: 8, ao: 16, pr: 2},
    {samples: 4, shadow: 2048, blur: 10, radius: 5, ao: 8, pr: 1.5},
    {samples: 0, shadow: 1024, blur: 6, radius: 3, ao: 0, pr: 1.1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    void pr;
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  // the dimension lines measure the shell at rest once
  st.robot.update({X: 0, PHI: 0, settle: 1, lift: 0, strike: 0, stow: 0, tailYaw: 0, open: 0.18, reach: 0, iso: {}, xray: 0, explode: 0, cut: 0, jointCut: 0});
  st.robot.root.position.set(0, 0, 0);
  st.robot.root.rotation.y = 0;
  const env = st.envelope();

  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const turnNote = document.createElement('div');
  turnNote.className = 'turn';
  turnNote.textContent = 'Turn your phone sideways for the full console';
  document.body.appendChild(turnNote);

  // ------------------------------------------------------------ state
  let T = 0; // wall clock, s
  let tc = 0; // the clock the show functions read: tour time, or the visitor's own
  let lastInput = -1e9;
  const AP = {on: true, t0: 0, loop: 0};
  const off = {az: 0, el: 0, k: 1};
  // the visitor's events; t is on the wall clock, the console reads the last DURATION seconds of it
  let EV = [{t: 0, mode: 'SCUTTLE', view: 'hero', speed: 0.35, trace: 1, labels: 0}];
  const layers = {labels: 0, section: 0, explode: 0, turntable: 0, trace: 1, balance: 0};
  let speed = 0.35;
  let asm = 'hero';
  let phi = 0.13;
  let X = 0;
  let spin = 0;
  const hist = []; // [T, phi, X] for the console's last seconds
  const at = (t, k) => {
    if (!hist.length) return k === 1 ? phi : X;
    if (t <= hist[0][0]) return hist[0][k];
    const L = hist[hist.length - 1];
    if (t >= L[0]) return L[k];
    let lo = 0;
    let hi = hist.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (hist[m][0] <= t) lo = m;
      else hi = m;
    }
    const a = hist[lo];
    const b = hist[hi];
    return a[k] + (b[k] - a[k]) * ((t - a[0]) / (b[0] - a[0] || 1));
  };
  const tourCursor = makeCursor(ui, SCRIPT);
  const tourList = viewList(SCRIPT);
  // the film's phase and position for the tour, integrated here the same way film.js tabulates them
  const src = {EV: SCRIPT, duration: DURATION, list: tourList, env, live: true, phiAt: (t) => at(t, 1), xAt: (t) => at(t, 2)};
  const frameConsole = makeConsoleFrame(ui, st, src);
  let ring = {t: -9, x: 0, y: 0};
  const pulse = (key) => {
    const n = ui.btn[key];
    if (!n) return;
    const r = n.getBoundingClientRect();
    const [x, y] = toStage(r.left + r.width / 2, r.top + r.height / 2);
    ring = {t: T, x, y};
  };

  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    // carry the tour's state into the visitor's list so nothing jumps
    const o = opsAt(SCRIPT, tc);
    const scene = [...SCRIPT].reverse().find((e) => e.mode && e.t <= tc) || SCRIPT[0];
    const view = [...tourList].reverse().find(([t]) => t <= tc)?.[1] || 'hero';
    speed = o.speed;
    layers.labels = o.labels > 0.5 ? 1 : 0;
    layers.section = o.cut > 0.5 || o.jointCut > 0.5 ? 1 : 0;
    layers.explode = o.explode > 0.5 ? 1 : 0;
    layers.turntable = o.turn > 0.5 ? 1 : 0;
    layers.trace = o.trace > 0.5 ? 1 : 0;
    layers.balance = o.balance > 0.5 ? 1 : 0;
    const iso = o.iso.leg > 0.5 ? 'leg' : o.iso.claw > 0.5 ? 'claw' : o.iso.tail > 0.5 ? 'tail' : '';
    EV = [{t: T - 30, mode: scene.mode, view, speed, iso, lift: o.lift > 0.5 ? 1 : 0, jointCut: o.jointCut > 0.5 ? 1 : 0, cut: o.cut > 0.5 ? 1 : 0, open1: o.explode > 0.05 && o.explode < 0.3 ? 1 : 0, explode: layers.explode, turn: layers.turntable, trace: layers.trace, labels: layers.labels, balance: layers.balance, say: 'MANUAL CONTROL'}];
  };
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const push = (e, key) => {
    takeOver();
    // a press 1 s ago is the newest; old events past the console's window are folded into the first one
    EV.push({t: T, ...e, ...(key ? {btn: key} : {})});
    if (EV.length > 60) EV.splice(1, EV.length - 60);
    if (key) pulse(key);
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', () => takeOver());

  const pressAsm = (k) => {
    if (k === 'strike') {
      push({strike: 1, say: 'STRIKE · ARMED'}, 'strike');
      return;
    }
    const a = ASM[k];
    if (!a) return;
    asm = k;
    Object.assign(off, {az: 0, el: 0, k: 1});
    const e = {...a, say: ASM_SAY[k], turn: 0};
    if (a.speed !== undefined) speed = a.speed;
    else speed = speed || 0.35;
    e.speed = speed;
    layers.labels = a.labels ? 1 : layers.labels;
    layers.section = a.cut || a.jointCut ? 1 : 0;
    layers.explode = 0;
    layers.turntable = 0;
    e.labels = layers.labels;
    push(e, k);
  };
  const pressDisp = (k) => {
    if (VIEW_MODE[k]) {
      Object.assign(off, {az: 0, el: 0, k: 1});
      const e = {view: k, mode: VIEW_MODE[k], iso: '', lift: 0, say: 'VIEW · ' + k.toUpperCase()};
      if (k === 'top') {
        layers.balance = 1;
        e.balance = 1;
      }
      push(e, k);
      return;
    }
    layers[k] = layers[k] ? 0 : 1;
    const v = layers[k];
    const say = k.toUpperCase() + (v ? ' ON' : ' OFF');
    if (k === 'labels') push({labels: v, say}, k);
    else if (k === 'section') push(asm === 'leg' ? {jointCut: v, say} : {cut: v, say}, k);
    else if (k === 'explode') {
      const e = {explode: v, say: v ? 'EXPLODED · ASSEMBLY ORDER' : 'REASSEMBLE', mode: v ? 'TEARDOWN' : 'STANDING', view: v ? 'teardown' : 'hero2', iso: '', cut: 0, jointCut: 0, open1: 0, lift: 0, speed: 0};
      speed = 0;
      push(e, k);
    } else if (k === 'turntable') push({turn: v, say}, k);
    else if (k === 'trace') push({trace: v, say}, k);
    else if (k === 'balance') push({balance: v, say}, k);
  };
  for (const [k, n] of Object.entries(ui.btn)) {
    n.addEventListener('pointerdown', (e) => e.stopPropagation());
    n.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ASM[k] || k === 'strike') pressAsm(k);
      else pressDisp(k);
    });
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    const map = {1: 'front', 2: 'side', 3: 'top', h: 'hero', l: 'leg', c: 'claw', t: 'tail', p: 'stinger', o: 'carapace', s: 'strike', e: 'explode', r: 'turntable', b: 'balance', g: 'claw'};
    if (map[k]) {
      if (ASM[map[k]] || map[k] === 'strike') pressAsm(map[k]);
      else pressDisp(map[k]);
    } else if (k === 'arrowright' || k === 'arrowleft') {
      takeOver();
      speed = clamp(Math.round((speed + (k === 'arrowright' ? 0.1 : -0.1)) * 10) / 10, 0, SPEED_MAX);
      EV.push({t: T, speed, mode: speed > 0.5 ? 'ADVANCE' : speed > 0 ? 'SCUTTLE' : 'STANDING', say: 'DRIVE · ' + speed.toFixed(2) + ' M/S'});
    } else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    takeOver();
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -10, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.5, 2);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the frame
  src.phiAt = (t) => at(T - (tc - t), 1);
  src.xAt = (t) => at(T - (tc - t), 2);
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  let odd = false;
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    // quality steps down after a 0.5 s window slower than 45 fps (two in a row once the page has settled)
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.4) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    // the operator: the tour's script on a loop, or the visitor's list
    let cursor;
    let ev;
    let list;
    if (AP.on) {
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      AP.loop = loop;
      tc = c - loop * DURATION;
      ev = SCRIPT;
      list = tourList;
      cursor = tourCursor(tc);
      if (loop > 0 && tc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = tc / 0.8;
        const e = k * k * (3 - 2 * k);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * e, y: end.y + (cursor.y - end.y) * e};
      }
      src.duration = DURATION;
    } else {
      if (T - lastInput > IDLE) startTour();
      tc = T;
      ev = EV;
      list = viewList(EV);
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, drag: false, ring: rk, ringX: ring.x, ringY: ring.y};
      src.duration = Math.max(DURATION, T + 1);
    }
    src.EV = ev;
    src.list = list;
    const o = opsAt(ev, tc);

    // the walk: PHI and X integrate the eased speed in real time; the turntable eases home when it stops
    phi += (o.speed / STRIDE) * dt;
    X += o.speed * dt;
    if (o.turn > 0.01) spin += o.turn * TURN_RATE * D2R * dt;
    else {
      const home = Math.round(spin / (2 * Math.PI)) * 2 * Math.PI;
      spin += (home - spin) * (1 - Math.exp(-dt / 0.45));
    }
    hist.push([T, phi, X]);
    while (hist.length > 2 && hist[0][0] < T - 3.5) hist.shift();

    // the camera: the view's own move plus the visitor's orbit
    const cam = viewAt(list, tc);
    cam.az += off.az;
    cam.el = clamp(cam.el + off.el, -6, 84);
    cam.d *= off.k;
    const pose = {X, PHI: phi, settle: settleOf(o.speed), lift: o.lift, strike: o.strike, stow: 0, tailYaw: o.tailYaw, open: o.open, reach: o.reach, squeeze: o.squeeze, iso: o.iso, xray: 0, explode: o.explode, cut: o.cut, jointCut: o.jointCut, t: tc};
    st.frame(pose, toCam(cam), spin);

    // the console: every frame on a fast GPU, every other frame (the pointer every frame) on a slow one
    odd = !odd;
    if (tier > 1 && odd) ui.pointer(cursor);
    else frameConsole(tc, o, cursor);

    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild || !AP.on) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : '▶ RESUME TOUR · ' + Math.max(0, Math.ceil(IDLE - (T - lastInput))) + ' S';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  // every shader compiles at once before the first frame (kit/warm.js)
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {
    st,
    startTour,
    takeOver,
    get tier() {
      return tier;
    },
    get T() {
      return T;
    },
    get EV() {
      return EV;
    },
  };
}
