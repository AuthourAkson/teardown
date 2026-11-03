"""Score for the SCORPION SC-8 console film (50 s): a cool minor bed (Am9 / Fmaj7 / Dm9 / Esus, 92 bpm) at one
level that thins out in the still scenes, and accents on what the machine does, never on what it keeps doing:
a soft metal tick on each touchdown of leg L1 while the robot walks, a click on every operator press, a servo whirr
as L1 lifts and a knock when it is set down, a lead-screw whirr under the claw grip with a clamp knock when the finger
shuts, a short servo sweep for the tail yaw, a cock-back whirr, whoosh and hit at each strike's contact, an air rush
as the armour lifts, a whoosh out for the teardown and back in for the reassembly.

    python run_sfx.py sims/scorpion-shared/score.py

Every time is read from scorpion-film/timeline.json, which sims/scorpion-film/beats.mjs writes from show.js and
kin.js (SCRIPT, the grip shape, the strike contact, the L1 touchdowns of the tabulated gait).
"""

import os

from sfx.score_kit import airy, bed, chords, hz, motor, thud
from sfx.synth import click, impact, whoosh

TIMELINE = "../scorpion-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "scorpion-score.wav")
TARGET_LUFS = -14.0
SEED = 8

CHORDS = chords("Am9:A2 E3 G3 B3 C4/A1", "Fmaj7:F2 C3 E3 A3/F1", "Dm9:D2 A2 C3 E3 F3/D1", "Esus:E2 A2 B2 D3/E1")
MOTIF = [(0.5, hz("E5")), (1.5, hz("C5")), (2.5, hz("B4"))]


def gain_curve(n, sr, points):
    """Piecewise-linear gain over the film: points = [(t, g), ...] sorted by t."""
    out = [0.0] * n
    j = 0
    for k in range(n):
        t = k / sr
        while j < len(points) - 2 and t > points[j + 1][0]:
            j += 1
        (t0, g0), (t1, g1) = points[j], points[j + 1]
        u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
        out[k] = g0 + (g1 - g0) * u
    return out


def score(mix, tl):
    dur = tl["duration"]
    sr = 48000
    left, right, low, drums = bed(dur, 92, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(2,), hats=8, swing=0.0, keys_vel=0.62, keys_lp=3600)
    # the drums sit out from the first halt to the final advance and come back with it; the keys stay
    m = {e["mode"]: e["t"] for e in tl["modes"]}
    halt = m.get("STANDING · FRONT", 4.0)
    adv = m.get("ADVANCE", 45.0)
    g = gain_curve(len(drums), sr, [(0, 1), (halt, 1), (halt + 1.2, 0.15), (adv - 0.6, 0.15), (adv + 0.4, 1.1), (dur, 1.1)])
    drums = [x * g[k] for k, x in enumerate(drums)]
    mix.put_stereo(0, left, right, 0.11)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.045)

    # L1 touchdowns while walking (the lifted leg's own set-down gets its knock below)
    lower = tl.get("lower") or []
    for e in tl["touchL1"]:
        t, v = e["t"], e["v"]
        if t > dur - 0.4 or v < 0.05:
            continue
        lv = 0.035 + 0.03 * min(1.0, v / 0.9)
        mix.put(t, thud(180, 0.02, 0.12), lv)
        mix.put(t, click(5200, 0.008), 0.012)
    for t in tl["presses"]:
        mix.put(t, click(2400, 0.025), 0.055)

    for t in tl.get("lift", []):
        mix.put(t, motor(0.9, 240, 1300), 0.024)
    for t in tl.get("jointCut", []):
        mix.put(t, airy(0.8, 1800, 700, 0.5), 0.022)
    for t in lower:
        mix.put(t + 0.9, thud(140, 0.04, 0.25), 0.05)

    for gp in tl["grips"]:
        mix.put(gp["open"], motor(0.9, 300, 1600), 0.026)  # the lead screw winds the finger open
        mix.put(gp["shut"] - 0.5, motor(0.5, 330, 1700), 0.026)  # and back shut
        mix.put(gp["shut"], thud(120, 0.05, 0.3), 0.07)
        mix.put(gp["shut"], click(1500, 0.03), 0.04)
        mix.put(gp["clamp"], thud(80, 0.08, 0.35), 0.05)

    for sw in tl.get("sweeps", []):
        mix.put(sw["t"], motor(sw["end"] - sw["t"], 170, 800, wobble=9), 0.012)

    for s in tl["strikes"]:
        c = s["contact"]
        mix.put(s["t"], motor(0.4, 180, 900), 0.022)  # cocking back
        mix.put(c - 0.26, whoosh(0.3, 600, 3400, 0.6), 0.06)
        mix.put(c, impact(0.9), 0.06)

    for t in tl.get("armour", []):
        mix.put(t, airy(1.4, 700, 2400, 0.6), 0.03)
    for t in tl.get("explode", []):
        mix.put(t, whoosh(1.6, 300, 1800, 0.5), 0.05)
    for t in tl.get("reassemble", []):
        mix.put(t, whoosh(1.2, 1600, 400, 0.5), 0.04)
        mix.put(t + 1.3, thud(110, 0.06, 0.35), 0.06)
