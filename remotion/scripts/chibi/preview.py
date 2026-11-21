"""Quick preview of the Chibi rig with PIL (same maths as src/chibi/Chibi.tsx): poses next to the reference figure.
Run: .venv/Scripts/python.exe remotion/scripts/chibi/preview.py <out.png> [pose ...]"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
DATA = json.loads((ROOT / "remotion/docs/chibi/svg/pieces.json").read_text(encoding="utf-8"))
PIV = {k: tuple(v) for k, v in DATA["pivots"].items()}
SS = 3  # supersample

POSES = {
    "stand": {},
    "sit": {"thigh": -84, "knee": 84, "ankle": 0, "torso": 4, "shoulder": -28, "elbow": -38, "head": -3},
    "rise": {"thigh": -50, "knee": 50, "ankle": 0, "torso": 24, "shoulder": -10, "elbow": -20, "head": -12},
    "walkA": {"thigh": -25, "knee": 15, "farThigh": 22, "farKnee": 25, "shoulder": 22, "farShoulder": -22, "elbow": -10},
    "reach": {"shoulder": -80, "elbow": -10, "torso": 8},
}


def bez(d: str) -> list[list[tuple[float, float]]]:
    polys, cur, pos = [], [], (0.0, 0.0)
    for cmd, args in re.findall(r"([MCZ])([^MCZ]*)", d):
        v = [float(x) for x in args.replace(",", " ").split()]
        if cmd == "M":
            if cur:
                polys.append(cur)
            pos = (v[0], v[1]); cur = [pos]
        elif cmd == "C":
            for i in range(0, len(v), 6):
                p0, c1, c2, p3 = pos, (v[i], v[i + 1]), (v[i + 2], v[i + 3]), (v[i + 4], v[i + 5])
                for s in range(1, 7):
                    t = s / 6; u = 1 - t
                    cur.append((u**3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t**3 * p3[0],
                                u**3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t**3 * p3[1]))
                pos = p3
        elif cmd == "Z":
            if cur:
                polys.append(cur); cur = []
    if cur:
        polys.append(cur)
    return polys


SHAPES = {name: [(l["fill"], bez(l["d"])) for l in p["layers"]] for name, p in DATA["pieces"].items()}


def rot(about, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a); ox, oy = about
    return lambda p: (ox + (p[0] - ox) * c - (p[1] - oy) * s, oy + (p[0] - ox) * s + (p[1] - oy) * c)


def chain(*fs):
    def f(p):
        for g in reversed(fs):
            p = g(p)
        return p
    return f


def world(pose: dict, root=(0.0, 0.0)):
    """piece -> transform. Angles in degrees, clockwise on screen; 0 = the reference standing pose."""
    g = lambda k: pose.get(k, 0.0)
    T = lambda p: (p[0] + root[0], p[1] + root[1])
    torso = rot(PIV["hip"], g("torso"))
    head = rot(PIV["neck"], g("head"))
    def arm(sh, el):
        up = rot(PIV["shoulder"], sh); lo = rot(PIV["elbow"], el)
        return chain(T, torso, up), chain(T, torso, up, lo)
    def leg(th, kn, an):
        a = rot(PIV["hip"], th); b = rot(PIV["knee"], kn); c = rot(PIV["ankle"], an)
        return chain(T, a), chain(T, a, b), chain(T, a, b, c)
    up, lo = arm(g("shoulder"), g("elbow"))
    fup, flo = arm(pose.get("farShoulder", g("shoulder")), pose.get("farElbow", g("elbow")))
    th, sh, sho = leg(g("thigh"), g("knee"), g("ankle"))
    fth, fsh, fsho = leg(pose.get("farThigh", g("thigh")), pose.get("farKnee", g("knee")), pose.get("farAnkle", g("ankle")))
    far_dx = lambda f: (lambda p: (lambda q: (q[0] - 2, q[1]))(f(p)))
    return [
        ("upperArm", far_dx(fup), True), ("foreArm", far_dx(flo), True), ("sleeve", far_dx(fup), True),
        ("shin", far_dx(fsh), True), ("shoe", far_dx(fsho), True), ("thigh", far_dx(fth), True), ("cuff", far_dx(fth), True),
        ("neck", chain(T, torso), False), ("torso", chain(T, torso), False), ("seat", chain(T, torso), False),
        ("shin", sh, False), ("shoe", sho, False), ("thigh", th, False), ("cuff", th, False),
        ("head", chain(T, torso, head), False),
        ("upperArm", up, False), ("foreArm", lo, False), ("sleeve", up, False),
    ]


def dark(hexs: str, k=0.82) -> tuple[int, int, int]:
    r, g, b = int(hexs[1:3], 16), int(hexs[3:5], 16), int(hexs[5:7], 16)
    return (int(r * k), int(g * k), int(b * k))


def ankle_world(pose, root=(0.0, 0.0)):
    for name, f, far in world(pose, root):
        if name == "shoe" and not far:
            return f(PIV["ankle"])


def draw(pose: dict, W=470, H=760, seat=None):
    a = ankle_world(pose)
    root = (PIV["ankle"][0] - a[0] + 70, PIV["ankle"][1] - a[1])
    im = Image.new("RGB", (W * SS, H * SS), (249, 249, 247))
    dr = ImageDraw.Draw(im)
    if seat:
        x0, y0, x1 = seat
        dr.rectangle([x0 * SS, y0 * SS, x1 * SS, DATA["ground"] * SS], fill=(176, 120, 80))
    for name, f, far in world(pose, root):
        for fill, polys in SHAPES[name]:
            col = dark(fill) if far else tuple(int(fill[i:i + 2], 16) for i in (1, 3, 5))
            for poly in polys:
                dr.polygon([(f(p)[0] * SS, f(p)[1] * SS) for p in poly], fill=col)
    dr.line([0, DATA["ground"] * SS, W * SS, DATA["ground"] * SS], fill=(200, 200, 200), width=SS)
    return im.resize((W, H), Image.LANCZOS)


def main():
    out = sys.argv[1]
    names = sys.argv[2:] or ["stand", "sit", "rise"]
    ref = Image.open(ROOT / "remotion/docs/chibi/chibi-boy-turnaround.png").convert("RGB").crop((405, 140, 765, 900))
    tiles = [ref]
    for n in names:
        p = dict(POSES[n]); seat = None
        if n == "sit":
            a = ankle_world(p); dx, dy = PIV["ankle"][0] - a[0] + 70, PIV["ankle"][1] - a[1]
            hip = (PIV["hip"][0] + dx, PIV["hip"][1] + dy); knee_x = a[0] + dx
            seat = (hip[0] - 90, hip[1] + 30, knee_x - 30)
        tiles.append(draw(p, seat=seat))
    W = sum(t.width for t in tiles); H = max(t.height for t in tiles)
    sheet = Image.new("RGB", (W, H), (255, 255, 255)); x = 0
    for t in tiles:
        sheet.paste(t, (x, 0)); x += t.width
    sheet.save(out)


if __name__ == "__main__":
    main()
