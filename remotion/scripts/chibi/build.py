"""Build the Chibi base character (side view) from ian's turnaround sheet.

Input:  remotion/docs/chibi/chibi-boy-turnaround.png (figure 2 = side view, facing right).
Output: remotion/src/chibi/art.ts   (pieces: layered smooth paths in sheet px, pivots, draw order)
        remotion/docs/chibi/svg/*.svg (one file per piece, editable in Figma/Inkscape)

Each piece is drawn as its full silhouette in the piece's base colour first, then its tone regions on top, so there are no
gaps inside a piece. Limbs are cut at the joints with a round cap, so they overlap cleanly at every angle. Hidden areas
(the shirt under the arm and sleeve, the shorts under the hand, the limbs inside sleeve and shorts) are filled in.
Run: .venv/Scripts/python.exe remotion/scripts/chibi/build.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SHEET = ROOT / "remotion/docs/chibi/chibi-boy-turnaround.png"
OUT_TS = ROOT / "remotion/src/chibi/art.ts"
OUT_SVG = ROOT / "remotion/docs/chibi/svg"
OUT_JSON = ROOT / "remotion/docs/chibi/svg/pieces.json"

CROP = (405, 140, 746, 860)          # x0, y0, x1, y1 of figure 2 in the sheet
UP = 4                               # work at 4x for smooth contours

# colour classes sampled from the sheet (k-means centres)
CLASSES = {
    "bg": (249, 249, 247), "hair": (52, 48, 49), "dark": (38, 34, 35), "skin": (252, 200, 163), "skinS": (241, 171, 137),
    "shorts": (61, 58, 58), "shirt": (253, 205, 89), "shirtS": (241, 177, 49), "sock": (237, 231, 225), "sockS": (213, 208, 204),
    "blush": (240, 150, 140), "mouth": (197, 91, 73), "white": (255, 255, 255),
}
NAMES = list(CLASSES)
IDX = {n: i for i, n in enumerate(NAMES)}

# joints in figure-2 px (crop coordinates)
PIV = {
    "neck": (178, 306), "shoulder": (166, 348), "elbow": (168, 455), "hip": (172, 512),
    "knee": (170, 598), "ankle": (171, 652),
}
ARM_R = 31.5     # half the arm width
LEG_R = 37.0     # half the leg width
CUFF_X = (124, 226)  # the shorts leg opening (side view, crop px)


def labels(rgb: np.ndarray) -> np.ndarray:
    cv = np.array([CLASSES[n] for n in NAMES], dtype=np.int32)
    d = ((rgb[:, :, None, :].astype(np.int32) - cv[None, None]) ** 2).sum(3)
    return d.argmin(2)


def disc(shape, c, r):
    m = np.zeros(shape, np.uint8)
    cv2.circle(m, (int(round(c[0] * UP)), int(round(c[1] * UP))), int(round(r * UP)), 1, -1)
    return m.astype(bool)


def rect(shape, x0, y0, x1, y1):
    m = np.zeros(shape, bool)
    m[int(y0 * UP):int(y1 * UP), int(x0 * UP):int(x1 * UP)] = True
    return m


def capsule(shape, a, b, r):
    m = np.zeros(shape, np.uint8)
    cv2.line(m, (int(a[0] * UP), int(a[1] * UP)), (int(b[0] * UP), int(b[1] * UP)), 1, int(2 * r * UP))
    cv2.circle(m, (int(a[0] * UP), int(a[1] * UP)), int(r * UP), 1, -1)
    cv2.circle(m, (int(b[0] * UP), int(b[1] * UP)), int(r * UP), 1, -1)
    return m.astype(bool)


def biggest(m: np.ndarray) -> np.ndarray:
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    if n <= 1:
        return m
    k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return lab == k


def fill_from(L: np.ndarray, hole: np.ndarray, allowed: list[str]) -> np.ndarray:
    """Give every pixel of `hole` the class of the nearest pixel whose class is in `allowed` (outside the hole)."""
    src = np.isin(L, [IDX[a] for a in allowed]) & ~hole
    dist, lab = cv2.distanceTransformWithLabels((~src).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.where(src)
    idx_of = np.zeros(lab.max() + 1, np.int64)
    idx_of[lab[ys, xs]] = np.arange(len(ys))
    out = L.copy()
    hy, hx = np.where(hole)
    near = idx_of[lab[hy, hx]]
    out[hy, hx] = L[ys[near], xs[near]]
    return out


def smooth_path(cnt: np.ndarray) -> str:
    pts = cnt[:, 0, :].astype(np.float64)
    if len(pts) < 8:
        return ""
    k = 7
    ker = np.ones(k) / k
    xs = np.convolve(np.r_[pts[-k:, 0], pts[:, 0], pts[:k, 0]], ker, "same")[k:-k]
    ys = np.convolve(np.r_[pts[-k:, 1], pts[:, 1], pts[:k, 1]], ker, "same")[k:-k]
    sm = np.stack([xs, ys], 1).astype(np.float32).reshape(-1, 1, 2)
    ap = cv2.approxPolyDP(sm, 1.2, True)[:, 0, :] / UP
    n = len(ap)
    if n < 3:
        return ""
    # closed Catmull-Rom -> cubic Bezier
    d = f"M{ap[0][0]:.1f} {ap[0][1]:.1f}"
    for i in range(n):
        p0, p1, p2, p3 = ap[(i - 1) % n], ap[i], ap[(i + 1) % n], ap[(i + 2) % n]
        c1 = p1 + (p2 - p0) / 6
        c2 = p2 - (p3 - p1) / 6
        d += f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return d + "Z"


def mask_path(m: np.ndarray) -> str:
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    parts = [smooth_path(c) for c in cnts if cv2.contourArea(c) > 6 * UP * UP]
    return "".join(p for p in parts if p)


def hexc(n: str) -> str:
    r, g, b = CLASSES[n]
    return f"#{r:02x}{g:02x}{b:02x}"


def piece(L: np.ndarray, sil: np.ndarray, base: str, tones: list[str], grow: int = 2, rim: int = 1) -> dict:
    """rim: drop tone pixels thinner than this (sheet px), e.g. the anti-aliased skin-coloured edge around the hair."""
    sil = biggest(sil) if sil.any() else sil
    sil_g = cv2.dilate(sil.astype(np.uint8), np.ones((grow * 2 + 1, grow * 2 + 1), np.uint8)).astype(bool)
    layers = [{"fill": hexc(base), "d": mask_path(sil_g)}]
    k = np.ones((rim * UP * 2 + 1,) * 2, np.uint8) if rim else None
    for t in tones:
        m = sil & (L == IDX[t])
        if k is not None:
            m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, k)
            m = cv2.dilate(m, np.ones((5, 5), np.uint8)).astype(bool) & sil_g  # grow back over the seam
        if m.sum() > 20 * UP * UP:
            layers.append({"fill": hexc(t), "d": mask_path(m)})
    return {"layers": [l for l in layers if l["d"]]}


def main() -> int:
    img = np.array(Image.open(SHEET).convert("RGB"))
    x0, y0, x1, y1 = CROP
    F = img[y0:y1, x0:x1]
    F = cv2.resize(F, (F.shape[1] * UP, F.shape[0] * UP), interpolation=cv2.INTER_CUBIC)
    L = labels(F)
    sh = L.shape
    fg = L != IDX["bg"]
    Y = np.arange(sh[0])[:, None] / UP + np.zeros(sh)
    X = np.arange(sh[1])[None, :] / UP + np.zeros(sh)

    is_ = lambda *ns: np.isin(L, [IDX[n] for n in ns])
    shirtish = is_("shirt", "shirtS")
    skinish = is_("skin", "skinS")

    # --- arm: the visible skin below the sleeve, as one connected shape
    arm_vis = biggest(skinish & (Y > 398) & (Y < 520) & (X > 128) & (X < 210))
    # --- sleeve: the light shirt block over the shoulder
    sleeve = biggest(is_("shirt") & (Y > 308) & (Y < 412) & (X > 124) & (X < 210))
    # --- hand over the shorts
    hand = arm_vis & (Y > 466)

    # --- torso (shirt) silhouette with the sleeve and arm filled in
    torso_sil = biggest((shirtish | arm_vis | sleeve) & (Y > 298) & (Y < 476))
    hole = (arm_vis | sleeve) & torso_sil
    Lt = fill_from(L, hole, ["shirtS"])
    torso = piece(Lt, torso_sil, "shirtS", ["shirt"])

    # --- shorts with the hand filled in; split into the seat (pelvis) and the cuff (on the thigh)
    shorts_sil = biggest((is_("shorts", "dark", "hair") | hand) & (Y > 462) & (Y < 562) & (X > 105) & (X < 250))
    Ls = fill_from(L, hand & shorts_sil, ["shorts"])
    Ls[shorts_sil & ~np.isin(Ls, [IDX["shorts"], IDX["dark"], IDX["hair"]])] = IDX["shorts"]
    Ls[shorts_sil & (Ls == IDX["hair"])] = IDX["dark"]
    # the shorts leg is a tube around the thigh (CUFF_X); the seat keeps the rest (waist, and the bottom behind the leg)
    seat_sil = shorts_sil & ((Y < 532) | (X < CUFF_X[0]))
    # the leg of the shorts: the hem part plus a disc at the hip (hidden under the seat when standing), flat hem kept
    cuff_sil = (shorts_sil & (Y >= 505)) | (disc(sh, PIV["hip"], LEG_R + 8) & (Y <= PIV["hip"][1] + LEG_R))
    seat = piece(Ls, seat_sil, "shorts", ["dark"])
    cuff_sil = cuff_sil & (X >= CUFF_X[0]) & (X < CUFF_X[1])
    cuff = piece(Ls, cuff_sil, "shorts", ["dark"])

    # --- head: everything above the collar that is not shirt. Built layer by layer: skin, shade, cheeks, mouth, the hair
    # mass (grown over the anti-aliased skin-coloured rim around it), its dark shade, then the eye (white, pupil, highlight).
    head_sil = biggest(fg & ~shirtish & (Y < 314))
    U8 = lambda m: m.astype(np.uint8)
    k = lambda r: np.ones((int(r * UP) * 2 + 1,) * 2, np.uint8)
    opn = lambda m, r: cv2.morphologyEx(U8(m), cv2.MORPH_OPEN, k(r)).astype(bool)
    darkish = head_sil & is_("hair", "dark")
    n, lab, st, _ = cv2.connectedComponentsWithStats(U8(darkish), 8)
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    hair = cv2.morphologyEx(U8(lab == big), cv2.MORPH_CLOSE, k(2))
    hair = cv2.dilate(hair, k(1.2)).astype(bool) & head_sil
    small_dark = darkish & (lab != big) & (lab > 0)          # pupil, brow, lashes
    blush = opn(head_sil & is_("blush"), 1)
    if blush.any():                                           # cheeks are clean ellipses
        cnt = max(cv2.findContours(U8(blush), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
        blush = np.zeros(sh, np.uint8); cv2.ellipse(blush, cv2.fitEllipse(cnt), 1, -1); blush = blush.astype(bool)
    white = head_sil & is_("white") & ~hair
    nw, lw, sw, _ = cv2.connectedComponentsWithStats(U8(white), 8)
    hi = np.isin(lw, [i for i in range(1, nw) if sw[i, cv2.CC_STAT_AREA] < 60 * UP * UP]) & (Y > 200)
    layers = [("skin", cv2.dilate(U8(head_sil), k(0.5)).astype(bool)), ("skinS", opn(head_sil & is_("skinS"), 2) & ~hair),
              ("blush", blush), ("mouth", opn(head_sil & is_("mouth"), 0.75)), ("hair", hair),
              ("dark", opn(head_sil & is_("dark") & hair & (Y < 300), 1.5)),
              ("white", cv2.dilate(U8(white & ~hi), k(0.5)).astype(bool) & ~hair), ("dark", small_dark), ("white", hi)]
    head = {"layers": [{"fill": hexc(c), "d": mask_path(m)} for c, m in layers if m.sum() > 4 * UP * UP]}
    head["layers"] = [l for l in head["layers"] if l["d"]]

    neck = {"layers": [{"fill": hexc("skinS"), "d": mask_path(rect(sh, 152, 290, 204, 330))}]}

    # --- arm pieces (upper: shoulder..elbow, forearm: elbow..hand), filled up into the sleeve
    upper_sil = (arm_vis & (Y <= PIV["elbow"][1])) | capsule(sh, PIV["shoulder"], PIV["elbow"], ARM_R)
    upper_sil &= (X > 128) & (X < 210)
    La = L.copy()
    La[upper_sil & ~skinish] = IDX["skin"]
    upper = piece(La, upper_sil, "skin", ["skinS"])
    fore_sil = (arm_vis & (Y >= PIV["elbow"][1] - 4)) | disc(sh, PIV["elbow"], ARM_R)
    fore = piece(La, fore_sil, "skin", ["skinS"])
    sleeve_p = piece(L, sleeve, "shirt", [])

    # --- leg pieces
    leg_vis = biggest((skinish | is_("sock", "sockS")) & (Y > 548) & (Y < 664) & (X > 125) & (X < 215))
    thigh_sil = (leg_vis & (Y <= PIV["knee"][1])) | capsule(sh, PIV["hip"], PIV["knee"], LEG_R)
    thigh_sil &= (X > 125) & (X < 215)
    Ll = L.copy()
    Ll[thigh_sil & ~skinish] = IDX["skin"]
    thigh = piece(Ll, thigh_sil, "skin", ["skinS"])
    shin_sil = (leg_vis & (Y >= PIV["knee"][1] - 4)) | disc(sh, PIV["knee"], LEG_R)
    shin = piece(Ll, shin_sil, "skin", ["skinS", "sock", "sockS"])

    shoe_sil = biggest(is_("dark", "hair", "shorts") & (Y > 640) & (Y < 712) & (X > 110) & (X < 260))
    shoe = piece(L, shoe_sil, "dark", ["hair"])

    pieces = {"neck": neck, "torso": torso, "seat": seat, "head": head, "upperArm": upper, "sleeve": sleeve_p, "foreArm": fore,
              "thigh": thigh, "cuff": cuff, "shin": shin, "shoe": shoe}
    OUT_SVG.mkdir(parents=True, exist_ok=True)
    W, H = x1 - x0, y1 - y0
    for name, p in pieces.items():
        body = "".join(f'<path fill="{l["fill"]}" d="{l["d"]}"/>' for l in p["layers"])
        (OUT_SVG / f"{name}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">{body}</svg>\n', encoding="utf-8")
    data = {"size": [W, H], "ground": 706, "pivots": PIV, "pieces": pieces}
    OUT_JSON.write_text(json.dumps(data), encoding="utf-8")
    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text("/* Generated by scripts/chibi/build.py from docs/chibi/chibi-boy-turnaround.png (figure 2, side view). Do not edit; edit the\n"
                      "   SVGs in docs/chibi/svg or the script and rebuild. Coordinates are sheet px of the side figure. */\n"
                      f"export const CHIBI_ART = {json.dumps(data)} as const;\n", encoding="utf-8")
    print("pieces:", {k: len(v["layers"]) for k, v in pieces.items()})
    return 0


if __name__ == "__main__":
    sys.exit(main())
