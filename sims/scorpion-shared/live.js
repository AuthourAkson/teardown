// SC-8 live page: the same robot, stage and console in real time. Every click becomes an event in a list the show
// functions read (opsAt, viewAt), so the visitor drives exactly what the film shows. Orbit with a drag, zoom with the
// wheel, keys 1-3 views, L/C/T isolate, X x-ray, E explode, G grip, S strike, arrows the speed. Left alone for 25 s
// the page plays the film's script on a loop, pointer and all.
import {runSim} from '../kit/runtime.js';
import {STRIDE} from './kin.js';
import {ACTIONS, createConsole, DISPLAY, ISO, VIEWS} from './console.js';
import {DURATION, SCRIPT, SPEED_MAX, makeConsoleFrame, makeCursor, opsAt, strikeAt, toCam, viewAt, viewList} from './show.js';
import {createStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const CSS = `
html,body{background:#f1efea}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{cursor:grab}#gl.drag{cursor:grabbing}
.vb{pointer-events:auto;cursor:pointer}
.vb:hover{border-color:#2a2b2f!important}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.chip{position:absolute;left:800px;top:96px;transform:translateX(-50%);height:22px;padding:0 12px;display:flex;align-items:center;gap:7px;border:1px solid rgba(60,58,52,.2);border-radius:11px;background:rgba(250,249,246,.94);font:700 9px Inter,sans-serif;letter-spacing:1.3px;color:#2a2b2f;cursor:pointer;pointer-events:auto;white-space:nowrap}
.chip i{width:7px;height:7px;border-radius:50%;background:#ee5a24}
`;

export const DEFAULTS = {duration: 3600, fps: 60, theme: 'light', hud: {enabled: false, title: 'SC-8', subtitle: ''}, director: {enabled: false}, watermark: ''};

export function runLive() {
  runSim(DEFAULTS, async ({canvas}) => {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const app = document.getElementById('app');
    const st = createStage({canvas});
    const ui = createConsole(app);
    ui.setLegend('DRAG TO ORBIT · WHEEL TO ZOOM · KEYS 1-3 L C T X E G S ← →  · 25 S IDLE STARTS THE TOUR');

    let scale = 1;
    const fit = () => {
      scale = Math.min(innerWidth / W, innerHeight / H);
      app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
      st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, 2));
    };
    addEventListener('resize', fit);
    fit();

    // ------------------------------------------------------------ state: the visitor's own event list
    let T = 0;
    let EV = [{t: 0, view: 'hero', speed: 0.35}];
    let lastInput = -1e9;
    const tour = {on: true, t0: 0};
    const off = {az: 0, el: 0, k: 1};
    let phi = 0.13;
    let X = 0;
    const phiHist = [];
    const cursorTour = makeCursor(ui, SCRIPT);
    const listTour = viewList(SCRIPT);
    const frameConsole = makeConsoleFrame(ui, st);
    let ring = {t: -9, x: 0, y: 0};
    const state = {iso: '', xray: 0, explode: 0, speed: 0.35, view: 'hero'};

    const chip = document.createElement('div');
    chip.className = 'chip';
    ui.root.appendChild(chip);
    const takeOver = () => {
      lastInput = T;
      if (!tour.on) return;
      tour.on = false;
      // carry the tour's current state into the visitor's list so nothing jumps
      const c = (T - tour.t0) % DURATION;
      const o = opsAt(SCRIPT, c);
      const v = listTour.filter(([t]) => t <= c).pop()[1];
      Object.assign(state, {iso: o.iso.leg > 0.5 ? 'leg' : o.iso.claw > 0.5 ? 'claw' : o.iso.tail > 0.5 ? 'tail' : '', xray: o.xray > 0.5 ? 1 : 0, explode: o.explode > 0.5 ? 1 : 0, speed: o.speed, view: v});
      EV = [{t: T - 5, view: v, speed: o.speed, iso: state.iso, xray: state.xray, explode: state.explode}];
    };
    const startTour = () => {
      tour.on = true;
      tour.t0 = T;
      Object.assign(off, {az: 0, el: 0, k: 1});
    };
    const push = (e, key) => {
      takeOver();
      const NAMES = {hero: 'VIEW › HERO', side: 'VIEW › SIDE', top: 'VIEW › TOP', leg: 'ISOLATE › LEG L1', claw: 'ISOLATE › CLAW L', tail: 'ISOLATE › TAIL', xray: 'DISPLAY › X-RAY', explode: 'DISPLAY › EXPLODED', grip: 'CLAW › GRIP CYCLE', strike: 'TAIL › STRIKE'};
      EV.push({t: T, ...(key ? {say: `${NAMES[key]}${state[key] === 0 || (ISO.includes(key) && !state.iso) ? ' · OFF' : ''}`} : {}), ...e});
      if (key) {
        const r = ui.btn[key].getBoundingClientRect();
        const a = app.getBoundingClientRect();
        ring = {t: T, x: (r.left + r.width / 2 - a.left) / scale, y: (r.top + r.height / 2 - a.top) / scale};
      }
    };
    chip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (tour.on) takeOver();
      else startTour();
    });

    const VIEW_OF = {leg: 'leg', claw: 'claw', tail: 'tail'};
    for (const k of VIEWS)
      ui.btn[k].addEventListener('click', () => {
        state.view = k;
        Object.assign(off, {az: 0, el: 0, k: 1});
        push({view: k}, k);
      });
    for (const k of ISO)
      ui.btn[k].addEventListener('click', () => {
        state.iso = state.iso === k ? '' : k;
        state.view = state.iso ? VIEW_OF[k] : 'hero';
        if (state.iso) state.xray = 0;
        Object.assign(off, {az: 0, el: 0, k: 1});
        push({iso: state.iso, view: state.view, xray: state.xray}, k);
      });
    for (const k of DISPLAY)
      ui.btn[k].addEventListener('click', () => {
        state[k] = state[k] ? 0 : 1;
        const e = {[k]: state[k]};
        if (state[k]) {
          const other = k === 'xray' ? 'explode' : 'xray';
          state[other] = 0;
          e[other] = 0;
          state.iso = '';
          e.iso = '';
          state.view = k === 'xray' ? 'core' : 'top';
          e.view = state.view;
        }
        push(e, k);
      });
    for (const k of ACTIONS)
      ui.btn[k].addEventListener('click', () => {
        if (k === 'grip' && state.speed > 0.02) {
          state.speed = 0;
          push({speed: 0});
        }
        push({[k]: 1}, k);
      });
    {
      const [x0, y] = ui.knobAt(0);
      const [x1] = ui.knobAt(SPEED_MAX);
      const hit = document.createElement('div');
      hit.className = 'hit';
      Object.assign(hit.style, {left: `${x0 - 12}px`, top: `${y - 13}px`, width: `${x1 - x0 + 24}px`, height: '26px'});
      ui.root.appendChild(hit);
      const onMove = (e) => {
        const a = app.getBoundingClientRect();
        const x = (e.clientX - a.left) / scale;
        state.speed = clamp(((x - x0) / (x1 - x0)) * SPEED_MAX, 0, SPEED_MAX);
        EV.push({t: T, speed: state.speed, drag: 0.25});
        lastInput = T;
      };
      hit.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        takeOver();
        hit.setPointerCapture(e.pointerId);
        const up = () => {
          removeEventListener('pointermove', onMove);
          removeEventListener('pointerup', up);
        };
        addEventListener('pointermove', onMove);
        addEventListener('pointerup', up);
        onMove(e);
      });
    }
    addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      const map = {1: 'hero', 2: 'side', 3: 'top', l: 'leg', c: 'claw', t: 'tail', x: 'xray', e: 'explode', g: 'grip', s: 'strike'};
      if (map[k]) ui.btn[map[k]].click();
      else if (k === 'arrowright' || k === 'arrowleft') {
        takeOver();
        state.speed = clamp(state.speed + (k === 'arrowright' ? 0.1 : -0.1), 0, SPEED_MAX);
        EV.push({t: T, speed: state.speed});
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
      off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -8, 60);
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

    // ------------------------------------------------------------ one frame
    let last = performance.now();
    return {
      resize: fit,
      render() {
        const now = performance.now();
        const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = now;
        T += dt;
        if (!tour.on && T - lastInput > IDLE) startTour();
        const tc = tour.on ? (T - tour.t0) % DURATION : T;
        const ev = tour.on ? SCRIPT : EV;
        const list = tour.on ? listTour : viewList(EV);
        const o = opsAt(ev, tc);
        // the walk integrates in real time from the eased speed, so a takeover never jumps the legs
        phi += (o.speed / STRIDE) * dt;
        X += o.speed * dt;
        phiHist.push([T, phi]);
        while (phiHist.length > 2 && phiHist[0][0] < T - 3.2) phiHist.shift();
        const phiAt = (t) => {
          const tt = T - (tc - t);
          if (tt >= T) return phi;
          let i = phiHist.length - 1;
          while (i > 0 && phiHist[i - 1][0] > tt) i--;
          if (i === 0) return phiHist[0][1] - (phiHist[0][0] - tt) * (o.speed / STRIDE);
          const [ta, pa] = phiHist[i - 1];
          const [tb, pb] = phiHist[i];
          return pa + (pb - pa) * ((tt - ta) / (tb - ta || 1));
        };
        const cam = viewAt(list, tc);
        cam.az += off.az;
        cam.el = clamp(cam.el + off.el, -8, 80);
        cam.d *= off.k;
        const L = st.frame({X, PHI: phi, ...o}, toCam(cam));
        let cursor;
        if (tour.on) cursor = cursorTour(tc);
        else {
          const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
          cursor = {x: -99, y: -99, press: false, drag: false, ring: rk, ringX: ring.x, ringY: ring.y};
        }
        frameConsole(tc, o, L, {phiAt, strikeAt: (t) => strikeAt(ev, t), EV: ev, list, duration: tour.on ? DURATION : Math.max(DURATION, tc + 1)}, cursor);
        chip.innerHTML = tour.on ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : `<i style="background:#2a2b2f"></i>MANUAL · TOUR IN ${Math.max(0, Math.ceil(IDLE - (T - lastInput)))} S`;
        return {};
      },
    };
  });
}
