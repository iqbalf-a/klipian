/* The bedroom set (the "ngantuk pegang hp" video): a bed (frame, mattress, pillow, blanket), a phone lying on it with a lit, scrolling screen, and a pair of
   sleepy eyes whose lids droop or open. Flat tones from the ISO kit's neutral sets (plastic, dark, metal, brass, labPlastic), the skin tones and the tokens' black
   and white; never the nature tones. The bed and the phone are 2.5D blocks (the tone rule: light on top, mid on the lower left, dark on the lower right); the
   eyes are a flat mark. No outlines except the lid's crease and the brows, no gradients, no filters. */
import React from "react";
import { BLACK, BLUSH, G3, G4, ISO, SKIN_A, SKIN_B, WHITE } from "../tokens.ts";
import { block, isoAt, ptsAttr, type P2, type P3 } from "../iso.ts";
import { Polys } from "./Iso.tsx";
import { BED, PHONE } from "../bedroomGeometry.ts";

/** The bed: the frame, the mattress, the pillow at the back and the blanket over the front half. World units (x lower right, y lower left, z up), `u` px per unit. */
export const IsoBed: React.FC<{ u: number; o: P2 }> = ({ u, o }) => (
  <g>
    <Polys polys={block([-0.1, -0.1, -0.35], [3.1, 2.1, 0], u, o)} tones={ISO.brass} />
    <Polys polys={block(BED.a, BED.b, u, o)} tones={ISO.plastic} />
    <Polys polys={block([0.15, 0.3, 0.5], [0.95, 1.7, 0.82], u, o)} tones={ISO.wall} />
    <Polys polys={block([1.1, 0, 0.5], [3, 2, BED.top], u, o)} tones={ISO.labPlastic} />
  </g>
);

/** The phone lying on the blanket with its screen up. `on` (0..1) is how lit the screen is; `t` scrolls the lines on it; `lift` raises it off the blanket (world units).
    The glow is a pale ellipse round it. */
export const IsoPhone: React.FC<{ u: number; o: P2; on: number; t: number; lift?: number; scale?: number }> = ({ u, o, on, t, lift = 0, scale = 1 }) => {
  const id = React.useId().replace(/:/g, "");
  const [cx, cy, cz] = PHONE.c, hx = PHONE.hx * scale, hy = PHONE.hy * scale, z0 = cz + lift, z1 = z0 + PHONE.h;
  const screen: P3[] = [[cx - hx + 0.05, cy - hy + 0.05, z1 + 0.004], [cx + hx - 0.05, cy - hy + 0.05, z1 + 0.004], [cx + hx - 0.05, cy + hy - 0.05, z1 + 0.004], [cx - hx + 0.05, cy + hy - 0.05, z1 + 0.004]];
  const pts = screen.map((p) => isoAt(p, u, o)), centre = isoAt([cx, cy, z1], u, o);
  // the lines of a feed: rows across the screen that scroll along its length
  const rows = Array.from({ length: 7 }, (_, i) => {
    const f = (((i / 7 + t * 0.2) % 1) + 1) % 1, y = cy - hy + 0.05 + f * (2 * hy - 0.1), w = 0.12 + 0.12 * ((i * 5) % 3);
    return { y, w, fade: Math.min(1, f * 6, (1 - f) * 6) };
  });
  return (
    <g>
      {on > 0.01 && <ellipse cx={centre[0]} cy={centre[1] - u * 0.1} rx={u * 1.15} ry={u * 0.7} fill={WHITE} opacity={0.3 * on} />}
      <Polys polys={block([cx - hx, cy - hy, z0], [cx + hx, cy + hy, z1], u, o)} tones={ISO.dark} />
      <defs><clipPath id={`ph${id}`}><polygon points={ptsAttr(pts)} /></clipPath></defs>
      <polygon points={ptsAttr(pts)} fill={on > 0.5 ? WHITE : ISO.dark[2]} />
      <g clipPath={`url(#ph${id})`} opacity={on}>
        {rows.map((r, i) => {
          const a = isoAt([cx - hx + 0.09, r.y, z1 + 0.006], u, o), b = isoAt([cx - hx + 0.09 + r.w * scale, r.y, z1 + 0.006], u, o), c = isoAt([cx - hx + 0.09 + r.w * scale, r.y + 0.07, z1 + 0.006], u, o), d = isoAt([cx - hx + 0.09, r.y + 0.07, z1 + 0.006], u, o);
          return <polygon key={i} points={ptsAttr([a, b, c, d])} fill={i % 3 === 0 ? ISO.brass[0] : i % 3 === 1 ? G3 : G4} opacity={r.fade} />;
        })}
      </g>
    </g>
  );
};

/** A pair of eyes on a skin strip, centred (cx, cy), the strip `w` wide. `open` 0..1 is how far the lids are up (1 wide awake, 0 shut), `look` -1..1 turns the
    pupils up (-1) or down (1), `brow` 0..1 lifts the brows. */
export const SleepyEyes: React.FC<{ cx: number; cy: number; w: number; open: number; look?: number; brow?: number }> = ({ cx, cy, w, open, look = 0.3, brow = 0.3 }) => {
  const id = React.useId().replace(/:/g, "");
  const R = w * 0.19, ry = R * 0.8, cover = (1 - Math.max(0, Math.min(1, open))) * 2 * ry;
  return (
    <g>
      <rect x={cx - w / 2} y={cy - R * 1.5} width={w} height={R * 3} rx={R * 1.3} fill={SKIN_A} />
      {[-1, 1].map((s) => <circle key={`b${s}`} cx={cx + s * w * 0.4} cy={cy + R * 0.7} r={R * 0.34} fill={BLUSH} opacity={0.45} />)}
      {[-1, 1].map((s) => {
        const ex = cx + s * w * 0.24, eyeId = `eye${id}${s > 0 ? "r" : "l"}`, top = cy - ry, lidY = top + cover;
        return (
          <g key={s}>
            <defs><clipPath id={eyeId}><ellipse cx={ex} cy={cy} rx={R} ry={ry} /></clipPath></defs>
            <ellipse cx={ex} cy={cy} rx={R} ry={ry} fill={WHITE} />
            <g clipPath={`url(#${eyeId})`}>
              <circle cx={ex} cy={cy + look * R * 0.28} r={R * 0.46} fill={BLACK} />
              <circle cx={ex - R * 0.14} cy={cy + look * R * 0.28 - R * 0.16} r={R * 0.12} fill={WHITE} />
            </g>
            {/* the lid is the skin's own colour, wider than the eye, so no edge of the white shows round it */}
            {cover > 0.5 && <path d={`M ${ex - R - 4} ${top - 8} L ${ex + R + 4} ${top - 8} L ${ex + R + 4} ${lidY} Q ${ex} ${lidY + R * 0.3} ${ex - R - 4} ${lidY} Z`} fill={SKIN_A} />}
            {cover > 0.5 && <path d={`M ${ex - R} ${lidY} Q ${ex} ${lidY + R * 0.3} ${ex + R} ${lidY}`} fill="none" stroke={SKIN_B} strokeWidth={R * 0.1} strokeLinecap="round" />}
            <path d={`M ${ex - R * 0.9} ${top - R * (0.3 + 0.3 * brow) + s * R * 0.12 * (1 - brow)} Q ${ex} ${top - R * (0.62 + 0.3 * brow)} ${ex + R * 0.9} ${top - R * (0.3 + 0.3 * brow) - s * R * 0.12 * (1 - brow)}`} fill="none" stroke={BLACK} strokeWidth={R * 0.17} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
};
