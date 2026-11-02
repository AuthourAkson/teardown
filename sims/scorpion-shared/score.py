"""Score for the SCORPION SC-8 console film: a cool minor bed (Am9 / Fmaj7 / Dm9 / Esus, 92 bpm) at one level, a
soft metal tick on every touchdown of leg L1, a click on every operator press, a servo whirr under each claw grip with
a clamp knock when it shuts, a whoosh and a hit for each tail strike, an air rush when the armour lifts.

    python run_sfx.py sims/scorpion-shared/score.py

Times mirror scorpion-shared/show.js (SCRIPT, GRIP_DUR, the strike curve) and kin.js (STRIDE, DUTY, the L1 phase).
"""

import math
import os

from sfx.score_kit import airy, bed, chords, hz, motor, thud
from sfx.synth import click, impact, whoosh

TIMELINE = "../scorpion-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "scorpion-score.wav")
TARGET_LUFS = -14.0
SEED = 8

CHORDS = chords("Am9:A2 E3 G3 B3 C4/A1", "Fmaj7:F2 C3 E3 A3/F1", "Dm9:D2 A2 C3 E3 F3/D1", "Esus:E2 A2 B2 D3/E1")
MOTIF = [(0.5, hz("E5")), (1.5, hz("C5")), (2.5, hz("B4"))]

# operator presses (SCRIPT events with a button) and their actions
PRESSES = (4.2, 8.6, 12.8, 14.0, 16.0, 18.0, 19.4, 21.6, 23.6, 26.8, 30.4, 31.6)
GRIPS = (14.0, 16.0)
STRIKES = (19.4, 21.6)
STRIKE_DUR = 1.6
XRAY, EXPLODE, REASSEMBLE = 23.6, 26.8, 30.4

# the walk: speed keyframes from SCRIPT, eased over 1.2 s (1.1 s for the drag), PHI = integral of v / STRIDE
SPEEDS = [(0.0, 0.35, 1.2), (8.6, 0.18, 1.2), (12.8, 0.0, 1.2), (31.6, 0.9, 1.1)]
STRIDE, DUTY, L1_PHASE, PHI0 = 0.3, 0.58, 0.12, 0.13


def smoother(x):
    u = min(1.0, max(0.0, x))
    return u * u * u * (u * (u * 6 - 15) + 10)


def speed_at(t):
    v = SPEEDS[0][1]
    for t0, target, dur in SPEEDS[1:]:
        if t >= t0:
            v += (target - v) * smoother((t - t0) / dur)
    return v


def touchdowns(dur, dt=1 / 240):
    """L1 lands where its phase wraps from swing back to stance (p crosses 0)."""
    out, phi, t, prev = [], PHI0, -2.0, None
    while t <= dur:
        if t >= 0:
            k = math.floor(phi + L1_PHASE)
            if prev is not None and k != prev:
                out.append(t)
            prev = k
        phi += speed_at(t + dt / 2) / STRIDE * dt
        t += dt
    return out


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 92, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(2,), hats=8, swing=0.0, keys_vel=0.62, keys_lp=3600)
    mix.put_stereo(0, left, right, 0.11)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.04)

    for t in touchdowns(dur):
        if t < dur - 0.4:
            mix.put(t, thud(180, 0.02, 0.12), 0.05)
            mix.put(t, click(5200, 0.008), 0.012)
    for t in PRESSES:
        mix.put(t, click(2400, 0.025), 0.055)
    for t in GRIPS:
        mix.put(t, motor(0.45, 300, 1600), 0.03)  # opening
        mix.put(t + 0.85, thud(120, 0.05, 0.3), 0.07)  # the fingers shut (gripShape close at 0.42..0.6 of 2.0 s)
        mix.put(t + 0.85, click(1500, 0.03), 0.04)
        mix.put(t + 2.7, motor(0.6, 260, 1300), 0.022)  # release
    for t in STRIKES:
        mix.put(t, motor(0.48, 180, 900), 0.022)  # cocking back
        mix.put(t + 0.42, whoosh(0.3, 600, 3400, 0.6), 0.06)
        mix.put(t + 0.67, impact(0.9), 0.05)
    mix.put(XRAY, airy(1.2, 900, 2600, 0.6), 0.03)
    mix.put(EXPLODE, whoosh(1.4, 300, 1800, 0.5), 0.05)
    mix.put(REASSEMBLE, whoosh(1.3, 1600, 400, 0.5), 0.04)
    mix.put(REASSEMBLE + 1.25, thud(110, 0.06, 0.35), 0.06)
