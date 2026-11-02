// SC-8 console: the reference sheets' paper look (warm white panels, ink type, one orange accent) as a fixed
// 1600 x 900 CSS layout over the full-bleed stage. update(s) redraws every live part from the frame's state.
import {LEGS, SPEC} from './kin.js';
import {SPEED_MAX} from './show.js';

export const C = {ink: '#1f2024', mute: '#85837d', faint: '#cfcbc2', line: 'rgba(60,58,52,.2)', paper: 'rgba(250,249,246,.9)', accent: '#ee5a24', dark: '#2a2b2f'};
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.paper};border:1px solid ${C.line};border-radius:6px;box-shadow:0 1px 6px rgba(40,36,30,.05)}
.hd{position:absolute;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;white-space:nowrap}
.hd i{font-style:normal;color:${C.accent};margin-right:7px}
.no{position:absolute;font:600 9px 'JetBrains Mono',monospace;color:${C.mute}}
.lb{font-size:9px;font-weight:600;letter-spacing:1.3px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.vl{font-size:12px;font-weight:600;white-space:nowrap}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.big{font-family:'JetBrains Mono',monospace;font-weight:700;letter-spacing:-.5px}
.vb{position:absolute;height:22px;padding:0 8px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:1.2px;border:1px solid ${C.line};border-radius:4px;background:#fbfaf8;color:${C.dark}}
.call{position:absolute;white-space:nowrap;background:rgba(250,249,246,.92);border:1px solid ${C.line};border-radius:4px;padding:5px 9px}
.call b{display:block;font-size:13px;font-weight:700;letter-spacing:.5px}
.call span{display:block;font:600 9.5px 'JetBrains Mono',monospace;letter-spacing:.6px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
.ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:1.8px solid ${C.accent};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
export const VIEWS = ['hero', 'side', 'top'];
export const ISO = ['leg', 'claw', 'tail'];
export const DISPLAY = ['xray', 'explode'];
export const ACTIONS = ['grip', 'strike'];

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, no, title) => {
    add(`<div class="pn" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="hd" style="left:${x + 14}px;top:${y + 12}px"><i>/</i>${title}</div>`);
    add(`<div class="no" style="left:${x + w - 26}px;top:${y + 13}px">${no}</div>`);
  };

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:24px;top:20px;width:66px;height:46px;background:${C.accent};border-radius:3px;display:grid;place-items:center;color:#fff;font:600 13px 'JetBrains Mono',monospace;letter-spacing:1px">SC-8</div>`);
  add(`<div style="position:absolute;left:104px;top:18px;font-size:9px;font-weight:600;letter-spacing:2px;color:${C.mute}">SCORPION ROBOT · MECHANICAL PRINCIPLE</div>`);
  add(`<div style="position:absolute;left:103px;top:30px;font-size:30px;font-weight:700;letter-spacing:-.3px;line-height:1">Scorpion SC-8 <span style="color:${C.accent}">/</span></div>`);
  add(`<div style="position:absolute;left:104px;top:64px;font-size:9px;font-weight:600;letter-spacing:3px;color:${C.dark}">OCTOPUS WALKER / HIGH MOBILITY UNIT</div>`);
  const top = [['DRIVE', 'speed'], ['MODE', 'mode'], ['FEET DOWN', 'feet'], ['GAIT', 'gaitname'], ['RUNTIME', 'clock']];
  top.forEach(([k, d], i) => {
    const x = 470 + i * 150;
    add(`<div style="position:absolute;left:${x}px;top:24px;width:136px;border-left:1px solid ${C.line};padding-left:12px"><div class="lb">${k}</div><div class="vl mono" data-k="${d}" style="font-size:15px;margin-top:4px"></div></div>`);
  });
  add(`<div class="lb mono" style="position:absolute;right:28px;top:26px;color:${C.dark};font-size:10px">◼◼◼◼◼◼◼ &nbsp;SC-8</div>`);
  add(`<div class="lb" style="position:absolute;right:28px;top:46px">2180 × 1530 × 1280 mm · 420 kg</div>`);

  // ------------------------------------------------------------ left: gait, legs
  const GP = {x: 24, y: 92, w: 300, h: 236};
  panel(GP.x, GP.y, GP.w, GP.h, '01', 'GAIT · TETRAPOD');
  add(`<div style="position:absolute;left:${GP.x + 14}px;top:${GP.y + 34}px;display:flex;gap:26px">
    <div><div class="big" data-k="hz" style="font-size:26px"></div><div class="lb">STRIDE RATE</div></div>
    <div><div class="big" data-k="ms" style="font-size:26px"></div><div class="lb">BODY SPEED</div></div></div>`);
  const gaitSvg = add(`<svg style="position:absolute;left:${GP.x + 14}px;top:${GP.y + 96}px" width="${GP.w - 28}" height="116"></svg>`);
  add(`<div class="lb" style="position:absolute;left:${GP.x + 14}px;top:${GP.y + GP.h - 16}px;font-size:8px">STANCE · LAST 3 S · DUTY 0.58 · STRIDE 300 mm</div>`);

  const LP = {x: 24, y: 340, w: 300, h: 380};
  panel(LP.x, LP.y, LP.w, LP.h, '02', 'LEG SERVOS · FEMUR TORQUE');
  const legRows = LEGS.map((L, i) => {
    const y = LP.y + 40 + i * 25;
    return add(`<div style="position:absolute;left:${LP.x + 14}px;top:${y}px;width:${LP.w - 28}px;height:18px;display:flex;align-items:center;gap:10px">
      <span class="mono" data-r="id" style="font-size:11px;font-weight:700;width:22px">${L.id}</span>
      <span style="flex:1;height:7px;background:rgba(60,58,52,.1);border-radius:2px;position:relative"><span data-r="bar" style="position:absolute;left:0;top:0;bottom:0;border-radius:2px"></span></span>
      <span class="mono" data-r="v" style="font-size:11px;font-weight:600;width:64px;text-align:right"></span></div>`);
  });
  add(`<div style="position:absolute;left:${LP.x + 14}px;top:${LP.y + 248}px;width:${LP.w - 28}px;border-top:1px dashed ${C.line}"></div>`);
  add(`<div class="lb" style="position:absolute;left:${LP.x + 14}px;top:${LP.y + 258}px;color:${C.dark}">LEG L1 · JOINT ANGLES</div>`);
  const jointRows = ['COXA YAW', 'FEMUR PITCH', 'KNEE BEND'].map((k, i) =>
    add(`<div style="position:absolute;left:${LP.x + 14}px;top:${LP.y + 280 + i * 26}px;width:${LP.w - 28}px;display:flex;justify-content:space-between;align-items:baseline"><span class="lb">${k}</span><span class="big" style="font-size:17px"></span></div>`).lastElementChild,
  );

  // ------------------------------------------------------------ right: claw, tail, controls
  const CP = {x: 1276, y: 92, w: 300, h: 168};
  panel(CP.x, CP.y, CP.w, CP.h, '03', 'CLAW GRIP · L');
  add(`<div style="position:absolute;left:${CP.x + 14}px;top:${CP.y + 34}px;display:flex;gap:26px">
    <div><div class="big" data-k="kn" style="font-size:26px"></div><div class="lb">GRIP FORCE</div></div>
    <div><div class="big" data-k="deg" style="font-size:26px"></div><div class="lb">OPENING</div></div></div>`);
  const gripBar = add(`<div style="position:absolute;left:${CP.x + 14}px;top:${CP.y + 100}px;width:${CP.w - 28}px;height:8px;background:rgba(60,58,52,.1);border-radius:2px"><div style="height:100%;background:${C.accent};border-radius:2px"></div></div>`).firstElementChild;
  add(`<div style="position:absolute;left:${CP.x + 14}px;top:${CP.y + 116}px;width:${CP.w - 28}px;display:flex;justify-content:space-between"><span class="lb">0</span><span class="lb">6.2 kN MAX · 500 kg PAYLOAD</span></div>`);
  add(`<div style="position:absolute;left:${CP.x + 14}px;top:${CP.y + 138}px;width:${CP.w - 28}px;display:flex;justify-content:space-between"><span class="lb">STATE</span><span class="vl mono" data-k="clawst"></span></div>`);

  const TP = {x: 1276, y: 272, w: 300, h: 200};
  panel(TP.x, TP.y, TP.w, TP.h, '04', 'TAIL STRIKE · 7 SEG');
  add(`<div style="position:absolute;left:${TP.x + 14}px;top:${TP.y + 34}px;display:flex;gap:26px">
    <div><div class="big" data-k="tipv" style="font-size:26px"></div><div class="lb">STINGER SPEED</div></div>
    <div><div class="big" data-k="tipn" style="font-size:26px"></div><div class="lb">STRIKE FORCE</div></div></div>`);
  const tailSvg = add(`<svg style="position:absolute;left:${TP.x + 14}px;top:${TP.y + 96}px" width="${TP.w - 28}" height="66"></svg>`);
  add(`<div style="position:absolute;left:${TP.x + 14}px;top:${TP.y + 172}px;width:${TP.w - 28}px;display:flex;justify-content:space-between"><span class="lb">STATE</span><span class="vl mono" data-k="tailst"></span></div>`);

  const BP = {x: 1276, y: 484, w: 300, h: 236};
  panel(BP.x, BP.y, BP.w, BP.h, '05', 'CONTROLS');
  const btn = {};
  const row = (label, keys, names, y, w) => {
    add(`<div class="lb" style="position:absolute;left:${BP.x + 14}px;top:${y - 14}px">${label}</div>`);
    keys.forEach((k, i) => {
      btn[k] = add(`<div class="vb" style="left:${BP.x + 14 + i * (w + 6)}px;top:${y}px;width:${w}px">${names[i]}</div>`);
    });
  };
  row('VIEW', VIEWS, ['HERO', 'SIDE', 'TOP'], BP.y + 50, 86);
  row('ISOLATE', ISO, ['LEG L1', 'CLAW', 'TAIL'], BP.y + 96, 86);
  row('DISPLAY · ACTION', [...DISPLAY, ...ACTIONS], ['X-RAY', 'EXPLODE', 'GRIP', 'STRIKE'], BP.y + 142, 63);
  const SL = {x: BP.x + 14, y: BP.y + 200, w: BP.w - 28};
  add(`<div class="lb" style="position:absolute;left:${SL.x}px;top:${SL.y - 22}px">DRIVE SPEED</div>`);
  const slVal = add(`<div class="vl mono" style="position:absolute;right:${1600 - SL.x - SL.w}px;top:${SL.y - 24}px;color:${C.accent}"></div>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y}px;width:${SL.w}px;height:4px;border-radius:2px;background:rgba(60,58,52,.15)"></div>`);
  const fill = add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y}px;height:4px;border-radius:2px;background:${C.accent}"></div>`);
  const knob = add(`<div style="position:absolute;top:${SL.y - 6}px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#fff;border:2px solid ${C.dark}"></div>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:${SL.y + 10}px;width:${SL.w}px;display:flex;justify-content:space-between"><span class="lb">0</span><span class="lb">${SPEED_MAX} m/s · DEMO RANGE (MAX ${SPEC.vmax} m/s)</span></div>`);

  // ------------------------------------------------------------ bottom: operation log and the tour's timeline
  const OP = {x: 24, y: 732, w: 1552, h: 148};
  panel(OP.x, OP.y, OP.w, OP.h, '06', 'OPERATION LOG');
  const now = add(`<div style="position:absolute;left:${OP.x + 360}px;top:${OP.y + 12}px;font-size:11px;font-weight:700;letter-spacing:1.4px;color:${C.accent}"></div>`);
  const logBox = add(`<div style="position:absolute;left:${OP.x + 14}px;top:${OP.y + 36}px;width:420px;display:flex;flex-direction:column;gap:6px"></div>`);
  const TL = {x: OP.x + 470, y: OP.y + 70, w: OP.w - 500};
  add(`<div style="position:absolute;left:${TL.x}px;top:${TL.y}px;width:${TL.w}px;height:4px;border-radius:2px;background:rgba(60,58,52,.12)"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:${TL.y}px;height:4px;border-radius:2px;background:${C.accent}"></div>`);
  const tlTicks = add(`<svg style="position:absolute;left:${TL.x}px;top:${TL.y - 10}px;overflow:visible" width="${TL.w}" height="24"></svg>`);
  const tlHead = add(`<div style="position:absolute;top:${TL.y - 5}px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;border:2px solid ${C.accent}"></div>`);
  add(`<div style="position:absolute;left:${TL.x}px;top:${TL.y + 24}px;width:${TL.w}px;display:flex;justify-content:space-between">${['HERO', 'SIDE', 'LEG', 'CLAW', 'TAIL', 'CORE', 'EXPLODE', 'DRIVE'].map((k) => `<span class="lb">${k}</span>`).join('')}</div>`);
  const legend = add(`<div class="lb" style="position:absolute;left:${TL.x}px;top:${OP.y + 118}px">AUTO TOUR · CLICK ANY CONTROL TO TAKE OVER · 25 S IDLE RESUMES</div>`);

  // ------------------------------------------------------------ overlays
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callBox = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="26" height="26" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#1d1a16" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);

  const K = {};
  for (const n of ui.querySelectorAll('[data-k]')) K[n.dataset.k] = n;
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  spots.speed = [SL.x, SL.y + 2];
  const knobAt = (v) => [SL.x + (Math.min(SPEED_MAX, Math.max(0, v)) / SPEED_MAX) * SL.w, SL.y + 2];
  const PANELS = [[24, 92, 324, 720], [1276, 92, 1576, 720], [24, 732, 1576, 880], [20, 14, 1580, 82]];
  const covered = (x, y) => PANELS.some(([a, b, c, d]) => x > a - 10 && x < c + 10 && y > b - 10 && y < d + 10);

  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  return {
    spots,
    btn,
    covered,
    knobAt,
    root: ui,
    setLegend: (txt) => (legend.textContent = txt),
    update(s) {
      K.speed.textContent = `${s.speed.toFixed(2)} m/s`;
      K.mode.textContent = s.mode;
      K.mode.style.color = s.mode === 'STANDING' || s.mode === 'WALKING' ? C.ink : C.accent;
      K.feet.textContent = `${s.feetDown} / 8`;
      K.gaitname.textContent = s.speed > 0.02 ? 'TETRAPOD' : 'HOLD';
      K.clock.textContent = s.clock;
      K.hz.innerHTML = `${s.freq.toFixed(2)}<span style="font-size:12px;color:${C.mute}"> Hz</span>`;
      K.ms.innerHTML = `${s.speed.toFixed(2)}<span style="font-size:12px;color:${C.mute}"> m/s</span>`;

      // gait chart: a row per leg, ink where the foot is planted, L1 in the accent
      {
        const W = 272;
        const x0 = 26;
        let h = '';
        s.gait.forEach((runs, i) => {
          const y = i * 14;
          h += `<text x="0" y="${y + 9}" font-size="9" font-weight="700" fill="${i === 0 ? C.accent : C.mute}" font-family="JetBrains Mono">${LEGS[i].id}</text><rect x="${x0}" y="${y + 1}" width="${W - x0}" height="9" fill="rgba(60,58,52,.06)"/>`;
          for (const [a, b] of runs) h += `<rect x="${(x0 + a * (W - x0)).toFixed(1)}" y="${y + 1}" width="${Math.max(0.8, (b - a) * (W - x0)).toFixed(1)}" height="9" fill="${i === 0 ? C.accent : C.dark}" opacity="${i === 0 ? 1 : 0.82}"/>`;
        });
        h += `<line x1="${W}" x2="${W}" y1="0" y2="112" stroke="${C.accent}" stroke-width="1.2"/>`;
        gaitSvg.innerHTML = h;
      }

      // leg servos: the femur torque of each leg, planted legs carry 420 kg between them
      const TMAX = 900;
      legRows.forEach((r, i) => {
        const v = s.torque[i];
        const bar = r.querySelector('[data-r=bar]');
        bar.style.width = `${Math.min(100, (v / TMAX) * 100).toFixed(1)}%`;
        bar.style.background = i === 0 ? C.accent : C.dark;
        r.querySelector('[data-r=v]').textContent = s.stance[i] ? `${v.toFixed(0)} N·m` : 'SWING';
        r.querySelector('[data-r=v]').style.color = s.stance[i] ? C.ink : C.mute;
      });
      jointRows[0].textContent = `${s.l1.yaw.toFixed(1)}°`;
      jointRows[1].textContent = `${s.l1.femur.toFixed(1)}°`;
      jointRows[2].textContent = `${s.l1.knee.toFixed(1)}°`;

      // claw
      K.kn.innerHTML = `${s.claw.kN.toFixed(1)}<span style="font-size:12px;color:${C.mute}"> kN</span>`;
      K.deg.innerHTML = `${s.claw.deg.toFixed(0)}<span style="font-size:12px;color:${C.mute}">°</span>`;
      gripBar.style.width = `${Math.min(100, (s.claw.kN / 6.2) * 100).toFixed(1)}%`;
      K.clawst.textContent = s.claw.state;
      K.clawst.style.color = s.claw.state === 'IDLE' ? C.ink : C.accent;

      // tail: stinger speed, the force it lands with, the tip's height over the last 4 s
      K.tipv.innerHTML = `${s.tail.tipV.toFixed(1)}<span style="font-size:12px;color:${C.mute}"> m/s</span>`;
      const hit = s.tail.state === 'STRIKE' || s.tail.state === 'HOLD';
      K.tipn.innerHTML = `${hit ? SPEC.strike : 0}<span style="font-size:12px;color:${C.mute}"> N</span>`;
      K.tipn.style.color = hit ? C.accent : C.ink;
      K.tailst.textContent = s.tail.state;
      K.tailst.style.color = s.tail.state === 'ARMED' ? C.ink : C.accent;
      {
        const W = 272;
        const Yh = (y) => 60 - ((y - 0.6) / 0.75) * 56;
        let p = '';
        s.tail.hist.forEach((y, i) => (p += `${i ? 'L' : 'M'}${((i / (s.tail.hist.length - 1)) * W).toFixed(1)} ${Yh(y).toFixed(1)}`));
        tailSvg.innerHTML = `<rect width="${W}" height="64" fill="rgba(60,58,52,.05)"/>${[0.8, 1.0, 1.2].map((v) => `<line x1="0" x2="${W}" y1="${Yh(v)}" y2="${Yh(v)}" stroke="${C.faint}" stroke-width=".6" stroke-dasharray="2 3"/>`).join('')}<path d="${p}" fill="none" stroke="${C.accent}" stroke-width="1.6"/><text x="3" y="10" font-size="8" fill="${C.mute}">STINGER HEIGHT · LAST 4 S</text>`;
      }

      // buttons
      for (const [k, n] of Object.entries(btn)) {
        const on = s.on[k];
        const isView = VIEWS.includes(k);
        n.style.background = on ? (isView ? C.dark : C.accent) : '#fbfaf8';
        n.style.color = on ? '#fff' : C.dark;
        n.style.borderColor = on ? 'transparent' : C.line;
      }
      const [kx] = knobAt(s.speed);
      knob.style.left = `${kx.toFixed(1)}px`;
      knob.style.borderColor = s.cursor.drag ? C.accent : C.dark;
      fill.style.width = `${(kx - SL.x).toFixed(1)}px`;
      slVal.textContent = `${s.speed.toFixed(2)} m/s`;

      // log and timeline
      now.textContent = s.now ? `OPERATOR › ${s.now}` : '';
      logBox.innerHTML = s.log.map((l) => `<div style="display:flex;gap:12px;font:600 11px 'JetBrains Mono',monospace;color:${l.fresh ? C.accent : C.ink}"><span style="color:${C.mute}">${l.time}</span>${l.text}</div>`).join('');
      const px = Math.min(1, Math.max(0, s.progress)) * TL.w;
      tlFill.style.width = `${px.toFixed(1)}px`;
      tlHead.style.left = `${(TL.x + px).toFixed(1)}px`;
      tlTicks.innerHTML = s.ticks.map((k) => `<line x1="${(k * TL.w).toFixed(1)}" x2="${(k * TL.w).toFixed(1)}" y1="4" y2="20" stroke="${k <= s.progress ? C.accent : C.faint}" stroke-width="1.2"/>`).join('');

      // callouts on the machine
      let lh = '';
      let ch = '';
      for (const c of s.calls) {
        const [ax, ay] = c.at;
        const lx = ax + c.dx;
        const ly = ay + c.dy;
        const ex = lx + (c.dx < 0 ? -24 : 24);
        lh += `<g opacity="${c.o.toFixed(2)}"><polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)} ${ex.toFixed(1)},${ly.toFixed(1)}" fill="none" stroke="${C.dark}" stroke-width="1"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3.2" fill="${C.accent}" stroke="#fff" stroke-width="1.2"/></g>`;
        ch += `<div class="call" style="left:${(ex + (c.dx < 0 ? -4 : 4)).toFixed(1)}px;top:${(ly - 19).toFixed(1)}px;opacity:${c.o.toFixed(2)};transform:translateX(${c.dx < 0 ? '-100%' : '0'});text-align:${c.dx < 0 ? 'right' : 'left'}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callBox.innerHTML = ch;
      pointer(s.cursor);
    },
  };
}
