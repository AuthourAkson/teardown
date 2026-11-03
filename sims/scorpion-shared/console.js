// SC-8 console: the official SC-8 field-simulator layout (orange logo block, title, DRIVE LOAD bar, SIM ID /
// RUNTIME / STATUS / OPERATOR cells; GAIT, TAIL STRIKE, LEG SERVOS on the left; CLAW GRIP, ASSEMBLIES, DISPLAY,
// SUBSYSTEMS on the right; OPERATION LOG with the play button below; the big orange OPERATION MODE label) over the
// full-bleed ivory stage, plus the CAD layer: orbit arcs, crosshairs, dimension lines and callouts. Fixed
// 1600 x 900 CSS layout; update(s) redraws every live part from the frame's state only.
export const C = {
  ink: '#18191c',
  dark: '#2a2b2f',
  mute: '#8d8a83',
  faint: '#d9d5cc',
  line: 'rgba(40,38,34,.13)',
  paper: 'rgba(251,250,247,.93)',
  accent: '#ee5a24',
  green: '#2f9e5b',
  cad: 'rgba(60,58,54,.22)',
};
const MONO = `'JetBrains Mono',ui-monospace,monospace`;
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none;font-family:${MONO}}
.ui *{box-sizing:border-box}
.ab{position:absolute}
.pn{position:absolute;background:${C.paper};border:1px solid rgba(40,38,34,.07);border-radius:5px;box-shadow:0 1px 2px rgba(40,34,26,.05),0 6px 18px rgba(40,34,26,.05)}
.hd{position:absolute;font:700 10.5px ${MONO};letter-spacing:2.2px;color:${C.ink};white-space:nowrap;padding-left:12px}
.hd:before{content:'';position:absolute;left:0;top:-1px;width:3px;height:13px;background:${C.accent};border-radius:1px}
.no{position:absolute;font:500 9.5px ${MONO};letter-spacing:1px;color:${C.mute}}
.lb{font:500 8.5px ${MONO};letter-spacing:2px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.vl{font:600 11.5px ${MONO};letter-spacing:1px;color:${C.ink};white-space:nowrap}
.big{font:600 33px Inter,sans-serif;letter-spacing:-.8px;line-height:1;color:${C.ink};white-space:nowrap}
.big small{font:500 13px Inter,sans-serif;letter-spacing:.3px;color:${C.mute};margin-left:3px}
.vb{position:absolute;height:22px;padding:0 8px;display:flex;align-items:center;justify-content:center;font:700 9px ${MONO};letter-spacing:1.6px;border:1px solid rgba(40,38,34,.2);border-radius:3px;background:#fdfcfa;color:${C.dark};white-space:nowrap}
.vb.on{background:${C.accent};border-color:${C.accent};color:#fff}
.bdg{position:absolute;height:14px;padding:0 5px;display:flex;align-items:center;font:700 7.5px ${MONO};letter-spacing:1px;border-radius:2px;color:#fff;background:${C.green};white-space:nowrap}
.call{position:absolute;white-space:nowrap;padding:4px 8px 4px 20px;background:rgba(251,250,247,.82);border-radius:2px}
.call:before{content:'';position:absolute;left:7px;top:8px;width:7px;height:7px;background:${C.accent}}
.call b{display:block;font:700 11.5px ${MONO};letter-spacing:1.6px;color:${C.ink}}
.call span{display:block;font:500 9px ${MONO};letter-spacing:1.3px;color:${C.mute};margin-top:2px}
.dim{position:absolute;transform:translate(-50%,-50%);font:700 17px ${MONO};letter-spacing:1px;color:${C.ink};background:rgba(251,250,247,.9);padding:1px 7px;border:1px solid rgba(40,38,34,.25);border-radius:2px;white-space:nowrap}
.dim i{font-style:normal;font-size:9.5px;color:${C.mute};margin-left:5px;letter-spacing:1.5px}
.tg{position:absolute;display:flex;align-items:center;gap:6px;white-space:nowrap}
.tg b{width:19px;height:19px;border-radius:50%;display:grid;place-items:center;font:700 9px ${MONO};color:#fff;background:${C.ink};box-shadow:0 0 0 2px rgba(251,250,247,.95)}
.tg span{font:700 10.5px ${MONO};letter-spacing:1.2px;color:${C.ink};background:rgba(251,250,247,.86);padding:2px 6px;border-radius:2px}
.tg span i{font-style:normal;font-weight:500;font-size:9px;color:${C.mute};margin-left:6px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
.ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:1.8px solid ${C.accent};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
// leg rows in the console's order (L1..L4, R1..R4) as indices into kin's LEGS (L1 R1 L2 R2 ...)
export const LEG_ROWS = [0, 2, 4, 6, 1, 3, 5, 7];
export const LEG_NAMES = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
export const ASSEMBLIES = [['hero', 'HERO'], ['claw', 'CLAW L'], ['tail', 'TAIL'], ['leg', 'LEG L1'], ['carapace', 'CARAPACE'], ['stinger', 'STINGER'], ['strike', 'STRIKE']];
export const DISPLAY = [['front', 'FRONT'], ['side', 'SIDE'], ['top', 'TOP'], ['labels', 'LABELS'], ['section', 'SECTION'], ['explode', 'EXPLODED'], ['turntable', 'TURNTABLE'], ['trace', 'GAIT TRACE'], ['balance', 'BALANCE']];
// the panel boxes, so callouts never land under one
const BOX = {
  gait: [24, 107, 284, 220],
  tail: [24, 347, 284, 144],
  legs: [24, 505, 284, 226],
  claw: [1292, 106, 284, 184],
  asm: [1292, 316, 284, 102],
  disp: [1292, 430, 284, 132],
  sys: [1292, 574, 284, 250],
  log: [323, 758, 921, 96],
};
const LOGO = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<ellipse cx="20" cy="24" rx="5.5" ry="7"/><path d="M20 17 C20 9 27 5 31 9 C34 12 31 16 28 15"/><path d="M28 15 l3 -1"/>
<path d="M15 21 l-7 -3 M15 25 l-8 0 M15.5 28.5 l-7 3.5 M25 21 l7 -3 M25 25 l8 0 M24.5 28.5 l7 3.5"/>
<path d="M16 31 C12 35 8 34 8 31 M24 31 C28 35 32 34 32 31"/></svg>`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h, parent = ui) => {
    const n = el(h);
    parent.appendChild(n);
    return n;
  };
  const panel = ([x, y, w, h], title, no) => {
    add(`<div class="pn" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="hd" style="left:${x + 13}px;top:${y + 13}px">${title}</div>`);
    add(`<div class="no" style="right:${1600 - x - w + 13}px;top:${y + 14}px">${no}</div>`);
  };
  const ab = (x, y, inner, extra = '') => add(`<div class="ab" style="left:${x}px;top:${y}px;${extra}">${inner}</div>`);

  // ------------------------------------------------------------ CAD layer (under the panels)
  const cadSvg = add(`<svg class="ab" style="left:0;top:0;overflow:visible" width="1600" height="900"></svg>`);
  {
    // orange + grid over the machine, the viewport's dashed frame marks
    let h = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 14; c++) {
      const x = 631 + c * 24.5;
      const y = 86 + r * 21.5;
      h += `<path d="M${x - 4} ${y}h8M${x} ${y - 4}v8" stroke="${C.accent}" stroke-width="1" opacity=".75"/>`;
    }
    h += `<path d="M340 138h56M340 138v58" stroke="${C.cad}" stroke-dasharray="3 3" fill="none"/>`;
    h += `<path d="M1172 722h56M1228 722v-54" stroke="${C.accent}" stroke-opacity=".55" stroke-dasharray="3 3" fill="none"/>`;
    add(`<svg class="ab" style="left:0;top:0" width="1600" height="900">${h}</svg>`);
  }
  ab(340, 120, `<span class="lb" style="letter-spacing:2.6px">MODEL SC-8 · REV B</span>`);
  const isoTxt = ab(0, 120, `<span class="lb" style="letter-spacing:2.6px"></span>`, 'right:372px;left:auto;text-align:right').firstElementChild;

  // ------------------------------------------------------------ header
  add(`<div class="ab" style="left:0;top:0;width:157px;height:86px;background:${C.accent};display:flex;align-items:center;gap:12px;padding-left:22px">${LOGO}<span style="font:600 14px ${MONO};letter-spacing:3px;color:#fff">SC-8</span></div>`);
  ab(178, 20, `<span class="lb" style="font-size:9px;letter-spacing:3px">ROBOTIC SCORPION · ARMOURED GROUND UNIT</span>`);
  ab(177, 31, `<span style="font:600 32px Inter,sans-serif;letter-spacing:-.6px;color:${C.ink}">Scorpion SC-8 <span style="color:${C.accent};font-weight:400">/</span></span>`);
  ab(178, 73, `<span class="lb" style="font-size:10.5px;letter-spacing:3.4px;color:${C.dark}">OCTOPOD WALKER / FIELD SIMULATOR</span>`);
  // drive load
  ab(686, 21, `<span class="lb">DRIVE LOAD</span>`);
  const loadPct = ab(0, 20, `<span class="vl" style="font-size:10px"></span>`, 'right:582px;left:auto').firstElementChild;
  const NSEG = 56;
  const segs = add(`<div class="ab" style="left:686px;top:37px;width:332px;height:13px;display:flex;gap:2px">${'<i style="flex:1;background:#e7e3db"></i>'.repeat(NSEG)}</div>`).children;
  ab(686, 56, `<div style="width:332px;display:flex;justify-content:space-between"><span class="lb" style="font-size:7.5px">IDLE</span><span class="lb" style="font-size:7.5px">CRUISE</span><span class="lb" style="font-size:7.5px">MAX</span></div>`);
  const cells = {};
  [['simid', 'SIM ID', 1064], ['clock', 'RUNTIME', 1180], ['status', 'STATUS', 1296], ['op', 'OPERATOR', 1412]].forEach(([k, label, x], i) => {
    if (i) add(`<div class="ab" style="left:${x - 12}px;top:20px;width:1px;height:42px;background:${C.line}"></div>`);
    ab(x, 21, `<span class="lb">${label}</span>`);
    cells[k] = ab(x, 40, `<span class="vl" style="font-size:12px;letter-spacing:1.4px"></span>`).firstElementChild;
  });
  cells.simid.textContent = 'SC8-0420';
  cells.op.textContent = 'BAY 2 · M.V.';
  const statusDot = add(`<i style="position:absolute;left:1296px;top:45px;width:6px;height:6px;border-radius:50%;background:${C.green}"></i>`);
  cells.status.parentElement.style.left = '1308px';

  // ------------------------------------------------------------ footer
  ab(26, 861, `<span class="lb" style="font-size:9px;letter-spacing:3px">FIELD SIMULATOR &nbsp;·&nbsp; PROCEDURAL MODEL &nbsp;·&nbsp; 8 LEGS &nbsp;·&nbsp; 2 CLAWS &nbsp;·&nbsp; 8 TAIL SECTIONS</span>`);
  ab(0, 861, `<span class="lb" style="font-size:9px;letter-spacing:3px">SC-8 SCORPION · OCTOPOD PLATFORM <span style="color:${C.accent};letter-spacing:1px">//////</span></span>`, 'right:30px;left:auto');

  // ------------------------------------------------------------ left: GAIT
  const [gx, gy, gw] = BOX.gait;
  panel(BOX.gait, 'GAIT', '01');
  const hz = ab(gx + 13, gy + 33, `<span class="big"></span>`).firstElementChild;
  const mms = ab(0, gy + 36, `<span class="big" style="font-size:24px"></span>`, `right:${1600 - gx - gw + 13}px;left:auto`).firstElementChild;
  ab(gx + 13, gy + 70, `<span class="lb">STRIDE RATE</span>`);
  ab(0, gy + 70, `<span class="lb">MM/S</span>`, `right:${1600 - gx - gw + 13}px;left:auto`);
  const GC = {x: gx + 13, y: gy + 88, w: gw - 26, h: 94};
  const gaitSvg = add(`<svg class="ab" style="left:${GC.x}px;top:${GC.y}px" width="${GC.w}" height="${GC.h}"></svg>`);
  add(`<div class="ab" style="left:${gx + 13}px;top:${gy + 189}px;width:${gw - 26}px;height:1px;background:${C.line}"></div>`);
  ab(gx + 13, gy + 199, `<span class="lb">PATTERN</span>`);
  const pattern = ab(gx + 74, gy + 197, `<span class="vl"></span>`).firstElementChild;
  const duty = ab(0, gy + 199, `<span class="lb"></span>`, `right:${1600 - gx - gw + 13}px;left:auto`).firstElementChild;

  // ------------------------------------------------------------ left: TAIL STRIKE
  const [tx, ty, tw] = BOX.tail;
  panel(BOX.tail, 'TAIL STRIKE', '02');
  const tdeg = ab(tx + 13, ty + 33, `<span class="big"></span>`).firstElementChild;
  ab(tx + 13, ty + 70, `<span class="lb">STRIKE ANGLE</span>`);
  const gauge = add(`<svg class="ab" style="left:${tx + 150}px;top:${ty + 12}px" width="112" height="70"></svg>`);
  add(`<div class="ab" style="left:${tx + 13}px;top:${ty + 86}px;width:${tw - 26}px;height:1px;background:${C.line}"></div>`);
  const tlabs = [];
  const tcells = [['VELOCITY', 0], ['TORQUE J1', 88], ['STINGER', 176]].map(([k, dx]) => {
    tlabs.push(ab(tx + 13 + dx, ty + 98, `<span class="lb">${k}</span>`).firstElementChild);
    return ab(tx + 13 + dx, ty + 116, `<span class="vl" style="font-size:12px"></span>`).firstElementChild;
  });

  // ------------------------------------------------------------ left: LEG SERVOS
  const [lx, ly, lw] = BOX.legs;
  panel(BOX.legs, 'LEG SERVOS', '03');
  ab(lx + 13, ly + 36, `<span class="lb">LOAD PER LEG · KNEE TORQUE</span>`);
  const legBadge = add(`<div class="bdg" style="right:${1600 - lx - lw + 13}px;top:${ly + 33}px"></div>`);
  const legRows = LEG_NAMES.map((n, r) => {
    const y = ly + 58 + r * 21;
    ab(lx + 13, y, `<span class="vl" style="font-size:10.5px">${n}</span>`);
    add(`<div class="ab" style="left:${lx + 41}px;top:${y + 5}px;width:166px;height:4px;border-radius:2px;background:#ebe8e1"></div>`);
    const bar = add(`<div class="ab" style="left:${lx + 41}px;top:${y + 5}px;height:4px;border-radius:2px;background:${C.dark}"></div>`);
    const v = ab(0, y, `<span class="vl" style="font-size:10.5px"></span>`, `right:${1600 - lx - lw + 13}px;left:auto`).firstElementChild;
    return {bar, v};
  });

  // ------------------------------------------------------------ right: CLAW GRIP
  const [cx, cy, cw] = BOX.claw;
  const R = (x0, w0) => `right:${1600 - x0 - w0 + 13}px;left:auto`;
  panel(BOX.claw, 'CLAW GRIP', '04');
  const grip = ab(cx + 13, cy + 33, `<span class="big"></span>`).firstElementChild;
  ab(cx + 13, cy + 70, `<span class="lb">GRIP FORCE</span>`);
  const spark = add(`<svg class="ab" style="left:${cx + 138}px;top:${cy + 38}px" width="134" height="36"></svg>`);
  const clawRows = ['CLAW L', 'CLAW R'].map((n, i) => {
    const y = cy + 92 + i * 24;
    ab(cx + 13, y, `<span class="lb">${n}</span>`);
    add(`<div class="ab" style="left:${cx + 70}px;top:${y + 3}px;width:138px;height:5px;border-radius:3px;background:#ebe8e1"></div>`);
    const bar = add(`<div class="ab" style="left:${cx + 70}px;top:${y + 3}px;height:5px;border-radius:3px;background:${C.dark}"></div>`);
    const v = ab(0, y - 1, `<span class="vl"></span>`, R(cx, cw)).firstElementChild;
    return {bar, v};
  });
  add(`<div class="ab" style="left:${cx + 13}px;top:${cy + 145}px;width:${cw - 26}px;height:1px;background:${C.line}"></div>`);
  ab(cx + 13, cy + 158, `<span class="lb">MODE</span>`);
  const cmode = ab(cx + 58, cy + 156, `<span class="vl"></span>`).firstElementChild;
  ab(cx + 150, cy + 158, `<span class="lb">APERTURE</span>`);
  const aper = ab(0, cy + 156, `<span class="vl"></span>`, R(cx, cw)).firstElementChild;

  // ------------------------------------------------------------ right: ASSEMBLIES, DISPLAY
  const btn = {};
  const buttons = (box, list, y0) => {
    const [x, y, w] = box;
    let bx = x + 13;
    let by = y + y0;
    for (const [k, label] of list) {
      const bw = Math.round(label.length * 7.4 + 20);
      if (bx + bw > x + w - 12) {
        bx = x + 13;
        by += 30;
      }
      btn[k] = add(`<div class="vb" style="left:${bx}px;top:${by}px;width:${bw}px">${label}</div>`);
      bx += bw + 6;
    }
  };
  panel(BOX.asm, 'ASSEMBLIES', '05');
  buttons(BOX.asm, ASSEMBLIES, 38);
  panel(BOX.disp, 'DISPLAY', '06');
  buttons(BOX.disp, DISPLAY, 38);

  // ------------------------------------------------------------ right: SUBSYSTEMS (the nine systems of the spec)
  const [sx, sy, sw] = BOX.sys;
  panel(BOX.sys, 'SUBSYSTEMS', '07');
  const sysBox = add(`<div class="ab" style="left:${sx}px;top:${sy + 34}px;width:${sw}px;height:${BOX.sys[3] - 38}px"></div>`);
  let sysRows = [];
  const setSystems = (list) => {
    sysBox.innerHTML = '';
    sysRows = list.map((s, i) => {
      const y = i * 25.2;
      const row = add(`<div class="ab" style="left:0;top:${y}px;width:${sw}px;height:24px">
        <i class="ab" data-r="mark" style="left:2px;top:1px;width:2px;height:20px;background:${C.accent};display:none"></i>
        <span class="lb ab" style="left:13px;top:2px;font-size:8.5px;letter-spacing:1px">${s.id}</span>
        <span class="vl ab" data-r="name" style="left:38px;top:0;font-size:9.5px;letter-spacing:1.4px">${s.name}</span>
        <span class="lb ab" style="left:38px;top:13px;font-size:7px;letter-spacing:1.3px">${s.sub}</span>
        <span class="bdg" data-r="b" style="right:13px;top:4px"></span></div>`, sysBox);
      return {row, name: row.querySelector('[data-r=name]'), mark: row.querySelector('[data-r=mark]'), b: row.querySelector('[data-r=b]'), sys: s.sys};
    });
  };

  // ------------------------------------------------------------ bottom: OPERATION LOG
  const [ox, oy, ow] = BOX.log;
  panel(BOX.log, 'OPERATION LOG', '08');
  add(`<div class="ab" style="left:${ox + 15}px;top:${oy + 36}px;width:44px;height:44px;border-radius:50%;background:${C.accent};display:grid;place-items:center;box-shadow:0 2px 6px rgba(238,90,36,.35)"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="2" width="3" height="10" fill="#fff"/><rect x="8.5" y="2" width="3" height="10" fill="#fff"/></svg></div>`);
  ab(ox + 75, oy + 31, `<span class="lb">DEPLOY</span>`);
  ab(0, oy + 31, `<span class="lb">RECALL</span>`, R(ox, ow + 6));
  const nowTxt = add(`<div class="ab" style="left:${ox + 75}px;width:${ow - 150}px;top:${oy + 29}px;text-align:center;font:700 10px ${MONO};letter-spacing:2.2px;color:${C.accent}"></div>`);
  const TL = {x: ox + 76, y: oy + 57, w: ow - 96};
  add(`<div class="ab" style="left:${TL.x}px;top:${TL.y}px;width:${TL.w}px;height:2px;background:#e4e0d8"></div>`);
  const tlFill = add(`<div class="ab" style="left:${TL.x}px;top:${TL.y}px;height:2px;background:${C.accent}"></div>`);
  const tlTicks = add(`<svg class="ab" style="left:${TL.x}px;top:${TL.y - 7}px;overflow:visible" width="${TL.w}" height="16"></svg>`);
  const tlHead = add(`<div class="ab" style="top:${TL.y - 6}px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;border:2px solid ${C.accent}"></div>`);
  const tlClock = ab(ox + 75, oy + 74, `<span class="lb" style="font-size:9px"></span>`).firstElementChild;
  const nActs = ab(0, oy + 74, `<span class="lb" style="font-size:9px"></span>`, R(ox, ow + 6)).firstElementChild;

  // ------------------------------------------------------------ OPERATION MODE, lower left of the viewport
  ab(340, 654, `<span class="lb" style="font-size:9.5px;letter-spacing:2.6px">OPERATION MODE</span>`);
  const modeTxt = add(`<div class="ab" style="left:338px;top:667px;font:600 30px Inter,sans-serif;letter-spacing:-.2px;color:${C.accent};white-space:nowrap"></div>`);
  const modeSub = ab(340, 704, `<span class="lb" style="font-size:9.5px;letter-spacing:2.4px"></span>`).firstElementChild;

  // ------------------------------------------------------------ overlays: dimension lines, callouts, the pointer
  const overSvg = add(`<svg class="ab" style="left:0;top:0;overflow:visible" width="1600" height="900"></svg>`);
  const overBox = add(`<div class="ab" style="left:0;top:0;width:1600px;height:900px"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M5 3 L5 27 L11.5 21 L16 31 L20 29.5 L15.5 19.5 L24 19.5 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div>`);
  // tiny hint for the live page, empty in the film
  const hint = ab(0, 108, `<span class="lb" style="font-size:8px;letter-spacing:1.6px"></span>`, 'right:372px;left:auto').firstElementChild;

  const centre = (n) => {
    const r = n.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const k = a.width / 1600 || 1;
    return [(r.left - a.left + r.width / 2) / k, (r.top - a.top + r.height / 2) / k];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const PANELS = Object.values(BOX).map(([x, y, w, h]) => [x, y, x + w, y + h]).concat([[0, 0, 1600, 92], [330, 640, 640, 720]]);
  const covered = (x, y, pad = 8) => x < 40 || x > 1560 || y < 96 || y > 845 || PANELS.some(([a, b, c, d]) => x > a - pad && x < c + pad && y > b - pad && y < d + pad);
  const boxHit = (x0, y0, x1, y1) => PANELS.some(([a, b, c, d]) => x1 > a - 6 && x0 < c + 6 && y1 > b - 6 && y0 < d + 6);

  const pointer = (c) => {
    cur.style.display = c.x < -50 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 4).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.86 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String((c.ring * 0.85).toFixed(3));
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const f1 = (v) => v.toFixed(1);
  const path = (pts, close) => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join('') + (close ? 'Z' : '');
  const lastTxt = {};
  const setT = (n, key, v) => {
    if (lastTxt[key] !== v) {
      n.textContent = v;
      lastTxt[key] = v;
    }
  };
  const setH = (n, key, v) => {
    if (lastTxt[key] !== v) {
      n.innerHTML = v;
      lastTxt[key] = v;
    }
  };

  function update(s) {
    // header
    setT(cells.clock, 'clock', s.clock);
    setT(cells.status, 'status', s.status);
    statusDot.style.background = s.statusHot ? C.accent : C.green;
    setT(loadPct, 'load', `${Math.round(s.load * 100)}%`);
    const lit = Math.round(s.load * NSEG);
    for (let i = 0; i < NSEG; i++) segs[i].style.background = i < lit ? C.ink : '#e7e3db';
    setT(isoTxt, 'iso', s.isoTxt);
    setT(hint, 'hint', s.hint || '');

    // GAIT
    setH(hz, 'hz', `${s.gait.hz.toFixed(1)}<small>HZ</small>`);
    setT(mms, 'mms', `${Math.round(s.gait.mms)}`);
    setT(pattern, 'pat', s.gait.pattern);
    setT(duty, 'duty', s.gait.duty);
    {
      const x0 = 18;
      const W = GC.w - x0;
      let h = '';
      s.gait.rows.forEach((runs, r) => {
        const y = 4 + r * 9.6;
        h += `<text x="0" y="${y + 4.6}" font-size="6.5" fill="${C.mute}" font-family="JetBrains Mono">${LEG_NAMES[r]}</text>`;
        h += `<rect x="${x0}" y="${y}" width="${W}" height="4.4" fill="${C.dark}"/>`;
        for (const [a, b] of runs) h += `<rect x="${f1(x0 + a * W)}" y="${y}" width="${f1(Math.max(0.6, (b - a) * W))}" height="4.4" fill="${C.accent}"/>`;
      });
      h += `<line x1="${GC.w - 0.5}" x2="${GC.w - 0.5}" y1="0" y2="${4 + 8 * 9.6}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="2 1.5"/>`;
      h += `<text x="${x0}" y="${GC.h - 2}" font-size="6" fill="${C.mute}" font-family="JetBrains Mono">-3.0 S</text><text x="${GC.w}" y="${GC.h - 2}" font-size="6" text-anchor="end" fill="${C.mute}" font-family="JetBrains Mono">NOW · ORANGE = SWING</text>`;
      gaitSvg.innerHTML = h;
    }

    // TAIL STRIKE
    setH(tdeg, 'tdeg', `${Math.round(s.tail.deg)}<small style="vertical-align:top;margin-left:1px">°</small>`);
    {
      const cxg = 56;
      const cyg = 56;
      const r = 44;
      const a0 = Math.PI;
      const arc = (k, rr) => {
        const a = a0 + Math.PI * k;
        return [cxg + Math.cos(a) * rr, cyg + Math.sin(a) * rr];
      };
      const k = Math.min(1, Math.max(0, s.tail.gauge));
      const p0 = arc(0, r);
      const p1 = arc(k, r);
      let h = `<path d="M${f1(arc(0, r)[0])} ${f1(arc(0, r)[1])} A${r} ${r} 0 0 1 ${f1(arc(1, r)[0])} ${f1(arc(1, r)[1])}" fill="none" stroke="#e4e0d8" stroke-width="5"/>`;
      if (k > 0.005) h += `<path d="M${f1(p0[0])} ${f1(p0[1])} A${r} ${r} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}" fill="none" stroke="${s.tail.hot ? C.accent : C.ink}" stroke-width="5"/>`;
      for (let i = 0; i <= 6; i++) {
        const a = arc(i / 6, r - 9);
        const b = arc(i / 6, r - 13);
        h += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${C.mute}" stroke-width=".8"/>`;
      }
      const n = arc(k, r - 16);
      h += `<line x1="${cxg}" y1="${cyg}" x2="${f1(n[0])}" y2="${f1(n[1])}" stroke="${C.accent}" stroke-width="2" stroke-linecap="round"/><circle cx="${cxg}" cy="${cyg}" r="3" fill="${C.accent}"/>`;
      gauge.innerHTML = h;
    }
    s.tail.cells.forEach((v, i) => setT(tcells[i], `tc${i}`, v));
    if (s.tail.labels) s.tail.labels.forEach((v, i) => setT(tlabs[i], `tl${i}`, v));
    tcells[2].style.color = s.tail.hot ? C.accent : '';

    // LEG SERVOS
    setT(legBadge, 'lbdg', s.legBadge.text);
    legBadge.style.background = s.legBadge.hot ? C.accent : C.green;
    s.legs.forEach((l, r) => {
      legRows[r].bar.style.width = `${(166 * Math.min(1, Math.max(0, l.k))).toFixed(1)}px`;
      legRows[r].bar.style.background = l.hot ? C.accent : C.dark;
      setT(legRows[r].v, `lv${r}`, l.txt);
      legRows[r].v.style.color = l.dim ? C.mute : l.hot ? C.accent : C.ink;
    });

    // CLAW GRIP
    setH(grip, 'grip', `${s.claw.big ?? Math.round(s.claw.N)}<small>${s.claw.unit ?? 'N'}</small>`);
    {
      const W = 134;
      const H = 36;
      const mx = Math.max(200, ...s.claw.hist) * 1.08;
      const pts = s.claw.hist.map((v, i) => [(i / (s.claw.hist.length - 1)) * (W - 4), H - 3 - (v / mx) * (H - 8)]);
      const last = pts[pts.length - 1];
      spark.innerHTML = `<line x1="0" x2="${W}" y1="${H - 3}" y2="${H - 3}" stroke="#e4e0d8"/><path d="${path(pts)}" fill="none" stroke="${C.accent}" stroke-width="1.3"/><circle cx="${f1(last[0])}" cy="${f1(last[1])}" r="2.6" fill="${C.accent}"/>`;
    }
    s.claw.rows.forEach((c, i) => {
      clawRows[i].bar.style.width = `${(138 * Math.min(1, c.k)).toFixed(1)}px`;
      clawRows[i].bar.style.background = c.hot ? C.accent : C.dark;
      setT(clawRows[i].v, `cv${i}`, c.txt);
      clawRows[i].v.style.color = c.hot ? C.accent : C.ink;
    });
    setT(cmode, 'cmode', s.claw.mode);
    setT(aper, 'aper', s.claw.aper);

    // buttons
    for (const [k, n] of Object.entries(btn)) {
      const on = !!s.on[k];
      if (n.classList.contains('on') !== on) n.classList.toggle('on', on);
    }

    // SUBSYSTEMS
    if (s.systems) {
      if (sysRows.length !== s.systems.length) setSystems(s.systems);
      s.systems.forEach((v, i) => {
        const r = sysRows[i];
        setT(r.b, `sb${i}`, v.badge);
        r.b.style.background = v.hot ? C.accent : C.green;
        r.name.style.color = v.focus ? C.accent : C.ink;
        r.mark.style.display = v.focus ? 'block' : 'none';
      });
    }

    // OPERATION LOG and MODE
    setT(nowTxt, 'now', s.now);
    const px = Math.min(1, Math.max(0, s.progress)) * TL.w;
    tlFill.style.width = `${f1(px)}px`;
    tlHead.style.left = `${f1(TL.x + px)}px`;
    setH(tlTicks, 'ticks', s.ticks.map((k) => `<line x1="${f1(k * TL.w)}" x2="${f1(k * TL.w)}" y1="1" y2="13" stroke="#8d8a83" stroke-width="1"/>`).join(''));
    setT(tlClock, 'tlc', s.tlClock);
    setT(nActs, 'acts', `${s.actions} OPERATOR ACTIONS`);
    setT(modeTxt, 'mode', s.mode);
    setT(modeSub, 'msub', s.modeSub);
    modeTxt.style.opacity = modeSub.style.opacity = String(s.modeO ?? 1);

    // CAD layer: thin arcs and crosshairs from the scene (screen paths), drawn under the panels
    {
      let h = '';
      for (const p of s.cad || []) {
        if (p.o < 0.02) continue;
        h += `<path d="${p.d}" fill="none" stroke="${p.accent ? C.accent : '#3c3a36'}" stroke-opacity="${(p.o * (p.accent ? 0.6 : 0.24)).toFixed(3)}" stroke-width="${p.w || 1}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ''}/>`;
      }
      for (const m of s.marks || []) {
        if (m.o < 0.02) continue;
        h += `<g opacity="${(m.o * 0.5).toFixed(3)}" stroke="#3c3a36" fill="none"><circle cx="${f1(m.x)}" cy="${f1(m.y)}" r="${m.r || 6}"/><path d="M${f1(m.x - 11)} ${f1(m.y)}h22M${f1(m.x)} ${f1(m.y - 11)}v22" stroke-width=".8"/></g>`;
      }
      setH(cadSvg, 'cad', h);
    }

    // overlays: support polygon + CoG, dimension lines, callouts
    let lh = '';
    let bh = '';
    if (s.balance && s.balance.o > 0.02) {
      const B = s.balance;
      lh += `<g opacity="${B.o.toFixed(3)}"><path d="${path(B.poly, true)}" fill="rgba(238,90,36,.08)" stroke="${C.accent}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
      for (const p of B.feet) lh += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="4.5" fill="${C.ink}" stroke="#fff" stroke-width="1.2"/>`;
      if (B.cog) {
        const [x, y] = B.cog;
        lh += `<circle cx="${f1(x)}" cy="${f1(y)}" r="11" fill="#fff" stroke="${C.ink}" stroke-width="1.4"/><path d="M${f1(x)} ${f1(y - 11)}A11 11 0 0 1 ${f1(x + 11)} ${f1(y)}L${f1(x)} ${f1(y)}Z M${f1(x)} ${f1(y + 11)}A11 11 0 0 1 ${f1(x - 11)} ${f1(y)}L${f1(x)} ${f1(y)}Z" fill="${C.ink}"/>`;
        if (B.near) lh += `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(B.near[0])}" y2="${f1(B.near[1])}" stroke="${C.accent}" stroke-width="1.4"/>`;
        bh += `<div class="call" style="left:${f1(x + 22)}px;top:${f1(y - 50)}px;opacity:${B.o.toFixed(3)}"><b>CENTRE OF MASS</b><span>${B.txt}</span></div>`;
      }
      lh += '</g>';
    }
    for (const d of s.dims || []) {
      if (d.o < 0.02) continue;
      const [ax, ay] = d.a;
      const [bx, by] = d.b;
      const [nx, ny] = d.n; // unit normal toward the dimension line, px
      const off = d.off;
      const A = [ax + nx * off, ay + ny * off];
      const Bp = [bx + nx * off, by + ny * off];
      const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) || 1;
      const ux = (Bp[0] - A[0]) / len;
      const uy = (Bp[1] - A[1]) / len;
      const ar = (P, sgn) => `M${f1(P[0])} ${f1(P[1])}l${f1(sgn * (ux * 9 - uy * 3.2))} ${f1(sgn * (uy * 9 + ux * 3.2))}M${f1(P[0])} ${f1(P[1])}l${f1(sgn * (ux * 9 + uy * 3.2))} ${f1(sgn * (uy * 9 - ux * 3.2))}`;
      const reveal = Math.min(1, d.o * 1.4);
      const mid = [(A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2];
      const hA = [mid[0] + (A[0] - mid[0]) * reveal, mid[1] + (A[1] - mid[1]) * reveal];
      const hB = [mid[0] + (Bp[0] - mid[0]) * reveal, mid[1] + (Bp[1] - mid[1]) * reveal];
      lh += `<g opacity="${d.o.toFixed(3)}" stroke="${C.ink}" fill="none" stroke-width="1"><path d="M${f1(ax + nx * 6)} ${f1(ay + ny * 6)}L${f1(A[0] + nx * 8)} ${f1(A[1] + ny * 8)}M${f1(bx + nx * 6)} ${f1(by + ny * 6)}L${f1(Bp[0] + nx * 8)} ${f1(Bp[1] + ny * 8)}" stroke-dasharray="3 3" stroke-opacity=".6"/>`;
      lh += `<path d="M${f1(hA[0])} ${f1(hA[1])}L${f1(hB[0])} ${f1(hB[1])}" stroke-width="1.2"/>${reveal > 0.98 ? `<path d="${ar(A, 1)}${ar(Bp, -1)}" stroke-width="1.2"/>` : ''}</g>`;
      bh += `<div class="dim" style="left:${f1(mid[0] + nx * 1)}px;top:${f1(mid[1] + ny * 1)}px;opacity:${d.o.toFixed(3)}">${d.text}<i>${d.sub || 'MM'}</i></div>`;
    }
    for (const c of s.calls || []) {
      if (c.o < 0.02) continue;
      const [ax, ay] = c.at;
      const left = c.lx < ax;
      const ex = c.lx + (left ? 6 : -6);
      lh += `<g opacity="${c.o.toFixed(3)}"><path d="M${f1(ax)} ${f1(ay)}L${f1(ex)} ${f1(c.ly)}" stroke="${C.ink}" stroke-opacity=".55" stroke-width="1" fill="none"/><circle cx="${f1(ax)}" cy="${f1(ay)}" r="3" fill="${C.accent}" stroke="#fff" stroke-width="1"/></g>`;
      bh += `<div class="call" style="left:${f1(c.lx)}px;top:${f1(c.ly - 11)}px;opacity:${c.o.toFixed(3)};${left ? 'transform:translateX(-100%);' : ''}"><b>${c.name}</b><span>${c.sub}</span></div>`;
    }
    for (const b of s.bars || []) {
      if (b.o < 0.02) continue;
      lh += `<g opacity="${b.o.toFixed(3)}"><rect x="${f1(b.x)}" y="${f1(b.y - 3)}" width="${f1(b.w)}" height="6" fill="#e7e3db"/><rect x="${f1(b.x)}" y="${f1(b.y - 3)}" width="${f1(b.w * Math.min(1, b.k))}" height="6" fill="${b.hot ? C.accent : C.ink}"/></g>`;
      if (b.txt) bh += `<div class="call" style="left:${f1(b.x + b.w + 6)}px;top:${f1(b.y - 11)}px;opacity:${b.o.toFixed(3)};padding:3px 7px"><b style="font-size:10.5px">${b.txt}</b></div>`;
    }
    for (const g of s.tags || []) {
      if (g.o < 0.02) continue;
      lh += `<g opacity="${g.o.toFixed(3)}"><line x1="${f1(g.at[0])}" y1="${f1(g.at[1])}" x2="${f1(g.x)}" y2="${f1(g.y)}" stroke="${C.ink}" stroke-opacity=".55" stroke-width="1"/><circle cx="${f1(g.at[0])}" cy="${f1(g.at[1])}" r="2.6" fill="${C.accent}"/></g>`;
      bh += `<div class="tg" style="left:${f1(g.x)}px;top:${f1(g.y)}px;opacity:${g.o.toFixed(3)};transform:translate(${g.right ? '-9px' : 'calc(-100% + 9px)'},-50%);flex-direction:${g.right ? 'row' : 'row-reverse'}"><b>${g.k}</b><span>${g.name}<i>${g.sub}</i></span></div>`;
    }
    setH(overSvg, 'over', lh);
    setH(overBox, 'overb', bh);
    pointer(s.cursor);
  }

  return {spots, btn, covered, boxHit, root: ui, update, pointer, setSystems, TL};
}
