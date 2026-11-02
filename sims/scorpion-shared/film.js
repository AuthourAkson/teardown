// SCORPION SC-8, the console film: the robot on the studio sheet under the SC-8 console. An operator walks it, opens
// one leg, one claw and the tail, x-rays the armour, explodes the assemblies and drives off. The drive speed is the
// one input of the walk: the gait phase PHI is its integral over STRIDE, tabulated at load, so render(t) is pure.
import {runSim} from '../kit/runtime.js';
import {STRIDE} from './kin.js';
import {createConsole} from './console.js';
import {DURATION, SCRIPT, makeConsoleFrame, makeCursor, opsAt, speedAt, strikeAt, toCam, viewAt, viewList} from './show.js';
import {createStage} from './stage.js';

export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'SC-8', subtitle: ''}, director: {enabled: false}, watermark: ''};

// PHI(t) = ∫ v / STRIDE dt and X(t) = ∫ v dt, tabulated from t = -2 so frame 0 already has its legs mid-stride
const T0 = -2;
const DT = 1 / 240;
const NT = Math.ceil((DURATION + 2 - T0) / DT);
const PH = new Float64Array(NT + 1);
const XS = new Float64Array(NT + 1);
for (let i = 1; i <= NT; i++) {
  const v = speedAt(SCRIPT, T0 + (i - 0.5) * DT);
  PH[i] = PH[i - 1] + (v / STRIDE) * DT;
  XS[i] = XS[i - 1] + v * DT;
}
const look = (A, t) => {
  const u = Math.min(NT - 1e-6, Math.max(0, (t - T0) / DT));
  const i = Math.floor(u);
  return A[i] + (A[i + 1] - A[i]) * (u - i);
};
export const phiAt = (t) => look(PH, t) + 0.13;
export const xAt = (t) => look(XS, t) - look(XS, 0);

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui, SCRIPT);
    const frame = makeConsoleFrame(ui, st);
    const list = viewList(SCRIPT);
    const src = {phiAt, strikeAt: (t) => strikeAt(SCRIPT, t), EV: SCRIPT, list, duration: DURATION};
    window.SC8 = st;
    return {
      resize,
      render(t) {
        const o = opsAt(SCRIPT, t);
        const L = st.frame({X: xAt(t), PHI: phiAt(t), ...o}, toCam(viewAt(list, t)));
        frame(t, o, L, src, cursorAt(t));
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
