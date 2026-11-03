// SCORPION SC-8, the console film (50 s, CONTRACT.md script): the robot on the ivory sheet under the SC-8 console.
// It scuttles, stands for its front / side / top views with the envelope dimension lines, balances over its support
// polygon, lifts and sections leg L1, opens claw L's lead-screw drive, lays out the tail's joint torques, strikes
// with the stinger, opens the carapace over its five bays, comes apart in assembly order and walks off.
// The drive speed is the one input of the walk: PHI = ∫ v / STRIDE dt and X = ∫ v dt, tabulated at load, and the
// turntable angle likewise, so render(t) is a pure function of t.
import {runSim} from '../kit/runtime.js';
import {STRIDE} from './kin.js';
import {createConsole} from './console.js';
import {DURATION, SCRIPT, TURN_RATE, makeConsoleFrame, makeCursor, opsAt, settleOf, speedAt, toCam, viewAt, viewList} from './show.js';
import {createStage} from './stage.js';

export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'SC-8', subtitle: ''}, director: {enabled: false}, watermark: ''};

// tabulated integrals from t = -2 so frame 0 already has its legs mid-stride
const T0 = -2;
const DT = 1 / 240;
const NT = Math.ceil((DURATION + 2 - T0) / DT);
const PH = new Float64Array(NT + 1);
const XS = new Float64Array(NT + 1);
const SPIN = new Float64Array(NT + 1);
{
  for (let i = 1; i <= NT; i++) {
    const t = T0 + (i - 0.5) * DT;
    const v = speedAt(SCRIPT, t);
    PH[i] = PH[i - 1] + (v / STRIDE) * DT;
    XS[i] = XS[i - 1] + v * DT;
    SPIN[i] = SPIN[i - 1] + (t > 0 ? opsAt(SCRIPT, t).turn : 0) * TURN_RATE * (Math.PI / 180) * DT;
  }
}
const look = (A, t) => {
  const u = Math.min(NT - 1e-6, Math.max(0, (t - T0) / DT));
  const i = Math.floor(u);
  return A[i] + (A[i + 1] - A[i]) * (u - i);
};
export const phiAt = (t) => look(PH, t) + 0.13;
export const xAt = (t) => look(XS, t) - look(XS, 0);
// the turntable returns to 0 by the shortest way when it stops (43 s), so the reassembled robot faces the camera
const spinRaw = (t) => look(SPIN, t);
export const spinAt = (t) => {
  const s = spinRaw(t);
  const s0 = spinRaw(43);
  const back = Math.round(s0 / (2 * Math.PI)) * 2 * Math.PI;
  if (t < 43) return s;
  const k = Math.min(1, Math.max(0, (t - 43) / 1.6));
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  return s0 + (back - s0) * e;
};

export const poseAt = (o, t) => ({
  X: xAt(t),
  PHI: phiAt(t),
  settle: settleOf(o.speed),
  lift: o.lift,
  strike: o.strike,
  stow: 0,
  tailYaw: o.tailYaw,
  open: o.open,
  reach: o.reach,
  squeeze: o.squeeze,
  iso: o.iso,
  xray: 0,
  explode: o.explode,
  cut: o.cut,
  jointCut: o.jointCut,
  t,
});

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    // the shell's envelope at rest, for the dimension lines
    st.robot.update(poseAt(opsAt(SCRIPT, 5), 5));
    st.robot.root.position.set(0, 0, 0);
    st.robot.root.rotation.y = 0;
    const env = st.envelope();
    const cursorAt = makeCursor(ui, SCRIPT);
    const list = viewList(SCRIPT);
    const frame = makeConsoleFrame(ui, st, {EV: SCRIPT, duration: DURATION, phiAt, xAt, list, env});
    window.SC8 = {st, env, opsAt, SCRIPT};
    return {
      resize,
      render(t) {
        const o = opsAt(SCRIPT, t);
        st.frame(poseAt(o, t), toCam(viewAt(list, t)), spinAt(t));
        frame(t, o, cursorAt(t));
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
