// Writes timeline.json from the film's own functions, so score.py reads every time from the timeline and never types
// one: the scene beats and operator presses from SCRIPT, the claw shut and clamp from the grip shape, the strike
// contact from kin.js, and every touchdown of leg L1 from the tabulated gait (film.js phiAt + the settle of the speed).
//   node sims/scorpion-film/beats.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as K from '../scorpion-shared/kin.js';
import {CONTACT_U, DURATION, GRIP_DUR, SCRIPT, SWEEP_DUR, opsAt, settleOf} from '../scorpion-shared/show.js';
import {phiAt} from '../scorpion-shared/film.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const r3 = (x) => Math.round(x * 1000) / 1000;
const at = (pred) => SCRIPT.filter(pred).map((e) => r3(e.t));

// L1 touchdowns: stance goes false -> true (the gait, or the lifted leg set back down)
const touch = [];
{
  let prev = null;
  for (let t = 0; t <= DURATION; t += 1 / 240) {
    const o = opsAt(SCRIPT, t);
    const sw = !K.footAt(0, phiAt(t), settleOf(o.speed)).stance || o.lift > 0.05;
    if (prev === true && !sw) touch.push({t: r3(t), v: r3(o.speed)});
    prev = sw;
  }
}
// grip: the finger shuts and the squeeze starts (gripShape in show.js: close 1.5..2.05, squeeze 1.9..2.3 of 3.4 s)
const grips = at((e) => e.grip).map((t) => ({t, open: t, shut: r3(t + 2.0), clamp: r3(t + 2.25), release: r3(t + GRIP_DUR)}));
const strikes = at((e) => e.strike).map((t) => ({t, contact: r3(t + CONTACT_U), end: r3(t + K.STRIKE_DUR)}));
const tl = {
  duration: DURATION,
  beats: at((e) => e.mode && e.t > 0),
  modes: SCRIPT.filter((e) => e.mode).map((e) => ({t: r3(e.t), mode: e.mode})),
  presses: at((e) => e.btn && e.t > 0),
  grips,
  strikes,
  sweeps: at((e) => e.sweep).map((t) => ({t, end: r3(t + SWEEP_DUR)})),
  lift: at((e) => e.lift === 1),
  lower: at((e) => e.lift === 0 && e.t > 0).slice(0, 1),
  jointCut: at((e) => e.jointCut === 1),
  armour: at((e) => e.open1 === 1),
  explode: at((e) => e.explode === 1),
  reassemble: at((e) => e.explode === 0 && e.t > 0),
  turntable: at((e) => e.turn === 1),
  speeds: SCRIPT.filter((e) => e.speed !== undefined).map((e) => ({t: r3(e.t), v: e.speed})),
  touchL1: touch,
  impactN: K.STINGER?.impact ?? K.SPEC.strike,
};
fs.writeFileSync(path.join(HERE, 'timeline.json'), JSON.stringify(tl, null, 1) + '\n', 'utf8');
console.log(`timeline.json: ${tl.beats.length} beats, ${tl.presses.length} presses, ${touch.length} L1 touchdowns, strikes ${strikes.map((s) => s.contact).join(' ')}`);
