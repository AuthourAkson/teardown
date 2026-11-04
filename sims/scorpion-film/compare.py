"""Numeric comparison of the SC-8 film against the official reference frames.

    D:\\Python310\\python.exe sims/scorpion-film/compare.py [ours.mp4 | frames-dir] [--tag before]

Official: teardown-out/ref-official/s001..s026.png (1 fps). Ours: frames at each SCRIPT beat (+1.2 s), extracted
with ffmpeg from the mp4, or a capture.mjs frames folder (000.png...) with --times.
Per frame, inside the viewport (the area between the console columns, above the log):
  machine mask = pixels whose colour differs from the paper (median of the viewport's outer band) by > THR,
  bbox, fill of viewport width/height, centroid (normalised 0..1 in the viewport),
  colour shares of the mask: orange (near #ee5a24), white (bright panels), dark (L < 70).
Console: header/left/right/bottom regions vs the official crops: mean abs diff, edge density, text-band rows.
Writes teardown-out/cmp/report[-tag].txt and metrics[-tag].json.
"""

import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "teardown-out", "cmp")
REF = os.path.join(ROOT, "teardown-out", "ref-official")
FFMPEG = os.environ.get("FFMPEG", r"D:\ffmpeg\bin\ffmpeg.exe")
W, H = 1600, 900
VP = (320, 100, 1280, 740)  # x0, y0, x1, y1 of the viewport, same on both (columns 24..308 and 1292..1576)
THR = 38.0
ORANGE = np.array([238, 90, 36], float)
# console regions on the 1600x900 frame
REGIONS = {"header": (0, 0, 1600, 100), "left": (0, 100, 320, 740), "right": (1280, 100, 1600, 830), "bottom": (320, 740, 1280, 900)}
# our scenes: name, time at which the scene has settled
SCENES = [("scuttle", 2.0), ("front", 5.6), ("side", 8.6), ("top", 11.5), ("leg", 16.5), ("claw", 21.5), ("tail", 26.5),
          ("stinger", 30.8), ("carapace", 34.5), ("teardown", 40.0), ("standing", 44.6), ("advance", 47.0)]


def load(p):
    im = Image.open(p).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im, float)


def machine(a):
    x0, y0, x1, y1 = VP
    v = a[y0:y1, x0:x1]
    band = np.concatenate([v[:12].reshape(-1, 3), v[-12:].reshape(-1, 3), v[:, :12].reshape(-1, 3), v[:, -12:].reshape(-1, 3)])
    paper = np.median(band, axis=0)
    d = np.sqrt(((v - paper) ** 2).sum(-1))
    # two-stage mask: a core at d > 32, then flood-fill to d > 20 so white panels near the paper are caught
    # when they border a darker edge or shadow. Calibrated so the official's median area stays ~29.8 %.
    core = d > 32
    nc = sum(np.roll(np.roll(core, i, 0), j, 1) for i in (-1, 0, 1) for j in (-1, 0, 1))
    core = core & (nc >= 5)
    ext = d > 20
    m = core.copy()
    for _ in range(3):
        has = sum(np.roll(np.roll(m, i, 0), j, 1) for i in (-1, 0, 1) for j in (-1, 0, 1)) > 0
        m = m | (ext & has)
    r = {"paper": [round(float(c)) for c in paper], "px": int(m.sum())}
    if m.sum() < 200:
        return r | {"fillW": 0, "fillH": 0, "cx": None, "cy": None, "orange": 0, "white": 0, "dark": 0, "area": 0}
    ys, xs = np.nonzero(m)
    # robust bbox: 1st..99th percentile
    bx0, bx1 = np.percentile(xs, [1, 99])
    by0, by1 = np.percentile(ys, [1, 99])
    px = v[m]
    L = px.mean(-1)
    org = np.sqrt(((px - ORANGE) ** 2).sum(-1)) < 70
    white = (L > 225) & (px.max(-1) - px.min(-1) < 25)
    dark = L < 70
    vw, vh = x1 - x0, y1 - y0
    return r | {
        "fillW": round(100 * (bx1 - bx0) / vw, 1), "fillH": round(100 * (by1 - by0) / vh, 1),
        "cx": round(float(xs.mean()) / vw, 3), "cy": round(float(ys.mean()) / vh, 3),
        "area": round(100 * m.sum() / (vw * vh), 1),
        "orange": round(100 * org.mean(), 1), "white": round(100 * white.mean(), 1), "dark": round(100 * dark.mean(), 1),
        "meanL": round(float(L.mean()), 1),
    }


def edges(g):
    gx = np.abs(np.diff(g, axis=1))[:-1]
    gy = np.abs(np.diff(g, axis=0))[:, :-1]
    return (np.maximum(gx, gy) > 40)


def bands(g, x=False):
    """Text bands: rows (or columns) whose edge density is above 3 %, as [start, end] runs."""
    e = edges(g)
    prof = e.mean(axis=0 if x else 1)
    on = prof > 0.03
    runs, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if not v and s is not None:
            if i - s >= 3:
                runs.append([s, i])
            s = None
    if s is not None:
        runs.append([s, len(on)])
    return runs


def console(a, b):
    out = {}
    for k, (x0, y0, x1, y1) in REGIONS.items():
        ga = a[y0:y1, x0:x1].mean(-1)
        gb = b[y0:y1, x0:x1].mean(-1)
        out[k] = {"mad": round(float(np.abs(ga - gb).mean()), 1), "edgeOurs": round(100 * float(edges(ga).mean()), 2),
                  "edgeRef": round(100 * float(edges(gb).mean()), 2), "meanOurs": round(float(ga.mean()), 1), "meanRef": round(float(gb.mean()), 1),
                  "bandsOurs": bands(ga), "bandsRef": bands(gb)}
    return out


def ours_frames(src, tag):
    d = os.path.join(OUT, "ours-" + tag)
    os.makedirs(d, exist_ok=True)
    paths = []
    for name, t in SCENES:
        p = os.path.join(d, f"{name}.png")
        if os.path.isdir(src):
            continue
        subprocess.run([FFMPEG, "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", "-vf", f"scale={W}:{H}", p], check=True)
        paths.append((name, t, p))
    if os.path.isdir(src):
        files = sorted(f for f in os.listdir(src) if f.endswith(".png"))
        paths = [(SCENES[i][0], SCENES[i][1], os.path.join(src, f)) for i, f in enumerate(files[: len(SCENES)])]
    return paths


def fmt(m):
    if m.get("cx") is None:
        return "   (empty)"
    return f"{m['fillW']:5.1f} {m['fillH']:5.1f} {m['area']:5.1f}  ({m['cx']:.2f},{m['cy']:.2f})  {m['orange']:4.1f} {m['white']:5.1f} {m['dark']:5.1f}  L{m['meanL']:5.1f}"


def main():
    args = sys.argv[1:]
    tag = "now"
    if "--tag" in args:
        i = args.index("--tag")
        tag = args[i + 1]
        del args[i:i + 2]
    src = args[0] if args else os.path.join(ROOT, "teardown-out", "scorpion-sc8-film.mp4")
    os.makedirs(OUT, exist_ok=True)
    refs = sorted(f for f in os.listdir(REF) if f.startswith("s") and f.endswith(".png"))
    R = [(f, machine(load(os.path.join(REF, f)))) for f in refs]
    O = [(n, t, machine(load(p)), p) for n, t, p in ours_frames(src, tag)]

    def stats(rows):
        rows = [m for m in rows if m.get("cx") is not None]
        return {k: round(float(np.median([m[k] for m in rows])), 3) for k in ("fillW", "fillH", "area", "cx", "cy", "orange", "white", "dark", "meanL")}

    sr = stats([m for _, m in R])
    so = stats([m for _, _, m, _ in O])
    ref_paper = np.median([m["paper"] for _, m in R], axis=0).round().tolist()
    our_paper = np.median([m["paper"] for _, _, m, _ in O], axis=0).round().tolist()
    # console: compare our settled scene frames against the official frame of matching index (both are full frames)
    cons = {}
    a0 = load(O[len(O) // 2][3])
    b0 = load(os.path.join(REF, refs[len(refs) // 2]))
    cons = console(a0, b0)

    L = []
    L.append(f"SC-8 film vs official  (tag {tag}; viewport x{VP[0]}-{VP[2]} y{VP[1]}-{VP[3]}; mask |rgb - paper| > {THR})")
    L.append(f"paper  official {ref_paper}   ours {our_paper}")
    L.append("")
    L.append("columns: fillW% fillH% area%  (centroid x,y in viewport)  orange% white% dark%  mean L   (colour shares are of the machine mask)")
    L.append("")
    L.append("OFFICIAL (1 fps)")
    for f, m in R:
        L.append(f"  {f:10s} {fmt(m)}")
    L.append("")
    L.append("OURS (scene beats)")
    for n, t, m, _ in O:
        L.append(f"  {n:10s} {t:5.1f}s {fmt(m)}")
    L.append("")
    L.append("MEDIAN  official " + json.dumps(sr))
    L.append("MEDIAN  ours     " + json.dumps(so))
    L.append("GAP (ours - official) " + json.dumps({k: round(so[k] - sr[k], 3) for k in sr}))
    L.append("")
    L.append("CONSOLE (mid frame vs mid frame): mean abs diff, edge density %, mean grey, text bands (rows)")
    for k, c in cons.items():
        L.append(f"  {k:7s} MAD {c['mad']:5.1f}  edge ours {c['edgeOurs']:5.2f} ref {c['edgeRef']:5.2f}  grey ours {c['meanOurs']:5.1f} ref {c['meanRef']:5.1f}")
        L.append(f"          bands ours {c['bandsOurs'][:14]}")
        L.append(f"          bands ref  {c['bandsRef'][:14]}")
    txt = "\n".join(L) + "\n"
    with open(os.path.join(OUT, f"report-{tag}.txt"), "w", encoding="utf-8") as fh:
        fh.write(txt)
    if tag in ("now", "before", "after"):
        with open(os.path.join(OUT, "report.txt"), "w", encoding="utf-8") as fh:
            fh.write(txt)
    with open(os.path.join(OUT, f"metrics-{tag}.json"), "w", encoding="utf-8") as fh:
        json.dump({"official": R, "ours": [(n, t, m) for n, t, m, _ in O], "median": {"official": sr, "ours": so}, "console": cons}, fh, indent=1)
    print(txt)


if __name__ == "__main__":
    main()
