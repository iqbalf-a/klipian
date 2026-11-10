/* Cara kerja sedotan menyedot minuman — a custom video, look 2d (B28): a flat side view, no iso projection. One continuous take at a cafe table
   (a new set kind "drink-table-side", set.json): the hero is a glass of drink with a straw and a cartoon blob's mouth on it; the dressing is a window, a napkin
   holder, a plant and a plate. Shapes checked (Wikipedia: Drinking straw, Suction, Atmospheric pressure): the straw is a thin straight tube and the drink is
   pushed up it by the air pressing on the surface (not pulled); the real water limit is about 10.3 m, drawn as a very tall tube with a break mark.
   Two tones per part (base and shade), light from the top left, no outlines. The camera and every time come from plan.ts. */
import React from "react";
import {
  Arrow, BLACK, BLUSH, CaptionLayer, G1, G2, G3, G4, ISO, Label, Motes, SKIN_B, THEMES, TipCard, TopText, WHITE,
  StoryVideo, blinkClosed, bobPx, easeInOut, easeOut, layerTransform, pulse01, riseAt, springAt, swayDeg, toScreen,
  type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { COL, GLASS, MOUTH, STRAW, makePlan } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const pts = (p: readonly (readonly [number, number])[]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
const PEACH = THEMES.peach;
const WALL: readonly [string, string, string] = ISO.stone;       // the wall: grey, so the empty brand tones never fill the frame
const WOOD = ISO.sand;
const DRINK = ISO.brain;                                          // a pink drink: soft, not the red of danger
const LEAF = ISO.leaf;
const TABLE_Y = GLASS.base;

const xl = (y: number) => lerp(GLASS.xl0 + GLASS.wall, GLASS.xl1 + GLASS.wall, (y - GLASS.top) / (GLASS.base - GLASS.top));
const xr = (y: number) => lerp(GLASS.xr0 - GLASS.wall, GLASS.xr1 - GLASS.wall, (y - GLASS.top) / (GLASS.base - GLASS.top));
const strawAt = (s: number): [number, number] => [lerp(STRAW.s0[0], STRAW.s1[0], s), lerp(STRAW.s0[1], STRAW.s1[1], s)];
const SD = (() => { const dx = STRAW.s1[0] - STRAW.s0[0], dy = STRAW.s1[1] - STRAW.s0[1], l = Math.hypot(dx, dy); return { n: [-dy / l, dx / l] as [number, number], len: l }; })();
const strip = (s0: number, s1: number, hw: number): string => {
  const a = strawAt(s0), b = strawAt(s1), n = SD.n;
  return pts([[a[0] + n[0] * hw, a[1] + n[1] * hw], [b[0] + n[0] * hw, b[1] + n[1] * hw], [b[0] - n[0] * hw, b[1] - n[1] * hw], [a[0] - n[0] * hw, a[1] - n[1] * hw]]);
};
const hash = (i: number) => { const x = Math.sin(i * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };

/** The set: wall, lower panel, window, table, floor. Everything bleeds past the frame. */
const Room: React.FC<{ clock: number }> = ({ clock }) => (
  <g>
    <rect x={-3200} y={-3800} width={7600} height={TABLE_Y + 3800} fill={WALL[0]} />
    <rect x={-3200} y={1130} width={7600} height={TABLE_Y - 1130} fill={WALL[1]} />
    <rect x={-3200} y={1124} width={7600} height={14} fill={WALL[2]} />
    {Array.from({ length: 26 }, (_, i) => <rect key={i} x={-1400 + i * 120} y={1138} width={6} height={TABLE_Y - 1138} fill={WALL[2]} opacity={0.55} />)}
    {/* the window: a corner of its casing, cut by the frame */}
    <rect x={-140} y={540} width={380} height={520} fill={WHITE} />
    <rect x={-116} y={564} width={332} height={472} fill={ISO.water[0]} opacity={0.4} />
    <rect x={-116} y={564} width={332} height={472} fill={WHITE} opacity={0.18 + 0.1 * pulse01(clock, 0, 6)} />
    <rect x={-126} y={792} width={352} height={20} fill={G4} />
    <rect x={44} y={564} width={20} height={472} fill={G4} />
    <rect x={-160} y={1040} width={420} height={30} fill={G3} />
    <rect x={-160} y={1040} width={420} height={12} fill={G4} />
    {/* the table: top, front face, apron; the floor below */}
    <rect x={-3200} y={TABLE_Y} width={7600} height={10} fill={WOOD[0]} />
    <rect x={-3200} y={TABLE_Y + 10} width={7600} height={70} fill={WOOD[1]} />
    <rect x={-3200} y={TABLE_Y + 80} width={7600} height={150} fill={WOOD[2]} />
    <rect x={-3200} y={TABLE_Y + 230} width={7600} height={2200} fill={PEACH.floor} />
    <rect x={-3200} y={TABLE_Y + 230} width={7600} height={16} fill={PEACH.floorEdge} />
    <rect x={-3200} y={TABLE_Y + 246} width={7600} height={90} fill={PEACH.floorEdge} opacity={0.5} />
    {Array.from({ length: 40 }, (_, i) => <rect key={i} x={-2000 + i * 260} y={TABLE_Y + 336} width={8} height={2100} fill={PEACH.floorEdge} opacity={0.55} />)}
    {[2060, 2400].map((y) => <rect key={y} x={-3200} y={y} width={7600} height={8} fill={PEACH.floorEdge} opacity={0.55} />)}
    {[[-300, -190], [1260, 1370]].map(([a, b], i) => <g key={i}><rect x={a} y={TABLE_Y + 230} width={b - a} height={260} fill={WOOD[1]} /><rect x={a + (b - a) * 0.6} y={TABLE_Y + 230} width={(b - a) * 0.4} height={260} fill={WOOD[2]} /></g>)}
  </g>
);

/** The dressing on the table: a napkin holder (left), a plant (right of the glass) and a plate with a cookie. */
const Dressing: React.FC<{ clock: number }> = ({ clock }) => {
  const sw = swayDeg(clock, 0.1, 3.5, 4.2);
  return (
    <g>
      {/* napkin holder: 7 cm tall, two tones, napkins fan out of the top */}
      <polygon points={pts([[110, TABLE_Y], [110, 1255], [250, 1255], [250, TABLE_Y]])} fill={G4} />
      <polygon points={pts([[250, 1255], [292, 1275], [292, TABLE_Y - 12], [250, TABLE_Y]])} fill={G3} />
      <polygon points={pts([[110, 1255], [250, 1255], [292, 1275], [152, 1275]])} fill={WHITE} />
      {[0, 1, 2].map((i) => <polygon key={i} points={pts([[130 + i * 36, 1255], [150 + i * 36, 1195 + i * 6], [176 + i * 36, 1255]])} fill={i % 2 ? G4 : WHITE} />)}
      <rect x={130} y={1360} width={100} height={8} fill={G3} />
      {/* the plant: a pot (5 cm) and leaves that sway */}
      <polygon points={pts([[780, TABLE_Y], [770, 1330], [900, 1330], [890, TABLE_Y]])} fill={PEACH.floorEdge} />
      <polygon points={pts([[860, TABLE_Y], [860, 1330], [900, 1330], [890, TABLE_Y]])} fill={ISO.soil[2]} />
      <g transform={`translate(835 1330) rotate(${sw})`}>
        <path d="M 0 0 C -60 -50 -80 -130 -50 -200 C -10 -150 10 -70 0 0 Z" fill={LEAF[1]} />
        <path d="M 0 0 C 50 -60 90 -110 110 -170 C 50 -150 10 -80 0 0 Z" fill={LEAF[0]} />
        <path d="M 0 0 C 10 -80 30 -150 20 -230 C -10 -170 -14 -80 0 0 Z" fill={LEAF[2]} />
      </g>
      {/* the plate (17 cm) and a cookie (7 cm) */}
      <rect x={960} y={TABLE_Y - 14} width={600} height={14} rx={7} fill={G4} />
      <rect x={1010} y={TABLE_Y - 24} width={500} height={10} rx={5} fill={G3} />
      <path d="M 1130 1476 A 125 125 0 0 1 1380 1476 Z" fill={WOOD[1]} />
      <path d="M 1280 1476 A 125 125 0 0 1 1380 1476 L 1340 1476 Z" fill={WOOD[2]} opacity={0.7} />
      {[[1190, 1420], [1260, 1385], [1320, 1440]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={11} fill={ISO.soil[2]} />)}
    </g>
  );
};

/** The drinker: a round cartoon blob (a parody, not a real person) facing left, behind the table. Big head, one big eye, a leaf sprout on top, a round body. */
const Person: React.FC<{ clock: number; suck: number }> = ({ clock, suck }) => {
  const blink = blinkClosed(clock, 3.6, 0.2);
  const sway = swayDeg(clock, 0.3, 6, 3.4);
  const HC = { x: 1010, y: 640, r: 340 };                       // the head: its left edge is where the straw goes in
  return (
    <g>
      <defs><clipPath id="blobBody"><rect x={300} y={-200} width={2200} height={TABLE_Y + 200} /></clipPath></defs>
      {/* the body: a big round belly behind the table, two tones */}
      <g clipPath="url(#blobBody)">
        <circle cx={1120} cy={1420} r={520} fill={ISO.water[1]} />
        <path d="M 1340 940 A 520 520 0 0 1 1640 1420 A 520 520 0 0 1 1120 1940 A 640 640 0 0 0 1340 940 Z" fill={ISO.water[2]} opacity={0.7} />
        <ellipse cx={1010} cy={1180} rx={190} ry={70} fill={ISO.water[0]} opacity={0.5} />
      </g>
      {/* the sprout on top: three leaves that sway */}
      <g transform={`translate(1010 305) rotate(${sway})`}>
        <path d="M 0 0 C -50 -40 -70 -110 -40 -170 C 0 -120 10 -60 0 0 Z" fill={LEAF[1]} />
        <path d="M 0 0 C 40 -60 80 -90 110 -150 C 50 -140 10 -70 0 0 Z" fill={LEAF[0]} />
        <path d="M 0 0 C 8 -70 24 -130 14 -200 C -14 -140 -16 -70 0 0 Z" fill={LEAF[2]} />
      </g>
      {/* the head: a circle in two tones (a crescent of shade on the right and under) */}
      <circle cx={HC.x} cy={HC.y} r={HC.r} fill={ISO.water[0]} />
      <path d={`M ${HC.x + 150} ${HC.y - 300} A ${HC.r} ${HC.r} 0 0 1 ${HC.x + 60} ${HC.y + 335} A ${HC.r + 40} ${HC.r + 60} 0 0 0 ${HC.x + 150} ${HC.y - 300} Z`} fill={ISO.water[1]} opacity={0.85} />
      {/* the big eye looks down at the glass; a thick brow above it */}
      <ellipse cx={830} cy={520} rx={78} ry={Math.max(4, 84 * (1 - blink))} fill={WHITE} />
      <ellipse cx={806} cy={548} rx={34} ry={Math.max(3, 38 * (1 - blink))} fill={G1} />
      <circle cx={796} cy={534} r={10} fill={WHITE} opacity={1 - blink} />
      <path d="M 750 425 Q 830 380 910 430" fill="none" stroke={G1} strokeWidth={16} strokeLinecap="round" />
      {/* the cheek: a round blush that dents in while the mouth sucks */}
      <circle cx={880} cy={738} r={62 - 14 * suck} fill={BLUSH} opacity={0.75 - 0.3 * suck} />
      <ellipse cx={880} cy={738} rx={18 + 56 * suck} ry={26 + 70 * suck} fill={ISO.water[2]} opacity={0.65 * suck} />
      <path d="M 840 690 Q 800 720 840 770" fill="none" stroke={ISO.water[2]} strokeWidth={8} strokeLinecap="round" opacity={suck} />
    </g>
  );
};

/** The lips over the straw's tip: the straw enters between them. */
const Lips: React.FC<{ suck: number }> = ({ suck }) => (
  <g>
    <ellipse cx={MOUTH.x + 6 - 4 * suck} cy={MOUTH.y} rx={26 - 3 * suck} ry={34 - 4 * suck} fill={BLUSH} />
    <ellipse cx={MOUTH.x + 12 - 4 * suck} cy={MOUTH.y + 10} rx={12} ry={16} fill={SKIN_B} opacity={0.55} />
  </g>
);

const Glass: React.FC<{ clock: number; surf: number; strawLevel: number; suck: number; airOn: number }> = ({ clock, surf, strawLevel, suck, airOn }) => {
  const { top, base, floorIn } = GLASS;
  const wob = (x: number) => 3 * Math.sin(clock * 2.2 + x * 0.04);
  const surfPath = `M ${xl(surf) - 1} ${surf + wob(0)} ` + Array.from({ length: 13 }, (_, i) => { const x = lerp(xl(surf), xr(surf), (i + 1) / 13); return `L ${x} ${surf + wob(x)}`; }).join(" ");
  const sl = clamp01((STRAW.s0[1] - strawLevel) / SD.len * (SD.len / (STRAW.s0[1] - STRAW.s1[1])));
  const nStraw = Math.round(8 * (1 - 0.75 * suck));
  return (
    <g>
      {/* the glass behind the drink: a tint and the thick base */}
      <polygon points={pts([[GLASS.xl0, top], [GLASS.xr0, top], [GLASS.xr1, base], [GLASS.xl1, base]])} fill={WHITE} opacity={0.3} />
      {/* the drink: base tone, a darker strip on the right, a lighter surface line */}
      <polygon points={pts([[xl(surf), surf], [xr(surf), surf], [xr(floorIn), floorIn], [xl(floorIn), floorIn]])} fill={DRINK[1]} />
      <polygon points={pts([[lerp(xl(surf), xr(surf), 0.78), surf], [xr(surf), surf], [xr(floorIn), floorIn], [lerp(xl(floorIn), xr(floorIn), 0.78), floorIn]])} fill={DRINK[2]} opacity={0.75} />
      <path d={surfPath} fill="none" stroke={DRINK[0]} strokeWidth={8} strokeLinecap="round" />
      {/* two ice cubes bob at the surface, small bubbles rise in the drink */}
      {[[0.3, 0.4], [0.62, 0.9]].map(([k, ph], i) => <rect key={i} x={lerp(xl(surf), xr(surf), k) - 26} y={surf - 6 + bobPx(clock, ph, 5, 2.6)} width={52} height={52} rx={9} fill={WHITE} opacity={0.5} transform={`rotate(${swayDeg(clock, ph, 8, 5)} ${lerp(xl(surf), xr(surf), k)} ${surf + 20})`} />)}
      {[0.1, 0.35, 0.6, 0.8].map((k0, i) => { const k = riseAt(clock, k0, 3.4); const y = lerp(floorIn - 20, surf + 20, k); return <circle key={i} cx={lerp(xl(y), xr(y), 0.2 + 0.18 * i) + 8 * Math.sin(clock * 2 + i)} cy={y} r={5 + i % 2 * 2} fill={WHITE} opacity={0.6 * Math.sin(Math.PI * k)} />; })}
      {/* the straw: translucent tube, the drink inside it, stripes */}
      <polygon points={strip(0, 1, STRAW.hw)} fill={WHITE} opacity={0.55} />
      <polygon points={strip(0, sl, STRAW.hw - 3)} fill={DRINK[1]} />
      <polygon points={(() => { const a = strawAt(0), b = strawAt(sl), n = SD.n; return pts([[a[0] + n[0] * 3, a[1] + n[1] * 3], [b[0] + n[0] * 3, b[1] + n[1] * 3], [b[0] + n[0] * (STRAW.hw - 3), b[1] + n[1] * (STRAW.hw - 3)], [a[0] + n[0] * (STRAW.hw - 3), a[1] + n[1] * (STRAW.hw - 3)]]); })()} fill={DRINK[2]} opacity={0.7} />
      {[0.12, 0.3, 0.48, 0.66, 0.84].map((s, i) => <polygon key={i} points={strip(s, s + 0.04, STRAW.hw)} fill={ISO.water[0]} opacity={0.8} />)}
      <polygon points={strip(0, 1, 4)} fill={WHITE} opacity={0.5} transform={`translate(${-STRAW.hw + 7} 0)`} />
      {/* the air in the straw above the drink: few dots, fewer while the mouth sucks (low pressure) */}
      {Array.from({ length: 8 }, (_, k) => {
        if (k >= nStraw) return null;
        const s = lerp(sl + 0.04, 0.95, (k + 0.5) / 8);
        const p = strawAt(s);
        return <circle key={k} cx={p[0] + SD.n[0] * 7 * Math.sin(clock * 3 + k * 2)} cy={p[1] + SD.n[1] * 7 * Math.sin(clock * 3 + k * 2) + 5 * Math.sin(clock * 2.4 + k)} r={4.5} fill={G2} opacity={0.75} />;
      })}
      {/* the air in the glass above the drink: many dots (high pressure) */}
      {Array.from({ length: 16 }, (_, i) => {
        const y = lerp(top + 14, surf - 16, hash(i + 3)), x = lerp(xl(y) + 14, xr(y) - 14, hash(i + 40));
        if (Math.abs(x - strawAt((STRAW.s0[1] - y) / (STRAW.s0[1] - STRAW.s1[1]))[0]) < 26) return null;
        return <circle key={i} cx={x + 9 * Math.sin(clock * 2.6 + i)} cy={y + 8 * Math.sin(clock * 2.1 + i * 1.7)} r={5} fill={G2} opacity={0.35 + 0.45 * airOn} />;
      })}
      {/* the glass in front: wall edges, the thick base, a highlight, the rim */}
      <polygon points={pts([[GLASS.xl0, top], [xl(top), top], [xl(base), base - GLASS.wall], [GLASS.xl1, base]])} fill={WHITE} opacity={0.6} />
      <polygon points={pts([[xr(top), top], [GLASS.xr0, top], [GLASS.xr1, base], [xr(base), base - GLASS.wall]])} fill={G4} opacity={0.75} />
      <polygon points={pts([[GLASS.xl1, base - GLASS.wall], [GLASS.xr1, base - GLASS.wall], [GLASS.xr1, base], [GLASS.xl1, base]])} fill={G3} opacity={0.85} />
      <rect x={GLASS.xl0 + 34} y={top + 40} width={10} height={170} rx={5} fill={WHITE} opacity={0.8} />
      <rect x={GLASS.xl0 + 34} y={top + 230} width={10} height={36} rx={5} fill={WHITE} opacity={0.6} />
      <rect x={GLASS.xl0 - 6} y={top - 8} width={GLASS.xr0 - GLASS.xl0 + 12} height={10} rx={5} fill={G4} />
      <rect x={GLASS.xl0 - 6} y={top - 8} width={(GLASS.xr0 - GLASS.xl0 + 12) * 0.6} height={5} rx={2.5} fill={WHITE} />
    </g>
  );
};

/** The very tall tube of the batas beat: standing in a tub of water, the water climbing to about 10.3 m; a break mark hides the middle (not to scale). */
const Column: React.FC<{ g: number; water: number; clock: number }> = ({ g, water, clock }) => {
  if (g < 0.01) return null;
  const x = COL.x, top = lerp(COL.base - 300, COL.top, g), base = COL.base, hw = 24;
  const wTop = lerp(base - 120, COL.top + 90, water);
  const brk = 400;
  return (
    <g>
      {/* the tub */}
      <rect x={x - 300} y={base - 200} width={600} height={200} fill={G4} />
      <rect x={x + 150} y={base - 200} width={150} height={200} fill={G3} />
      <rect x={x - 288} y={base - 160} width={576} height={160} fill={ISO.water[1]} />
      <rect x={x + 130} y={base - 160} width={158} height={160} fill={ISO.water[2]} opacity={0.7} />
      <rect x={x - 300} y={base - 210} width={600} height={14} rx={7} fill={WHITE} />
      {/* the tube: a top part and a bottom part with the break between them */}
      {[[top, brk - 40], [brk + 40, base - 20]].map(([a, b], i) => (
        <g key={i}>
          <rect x={x - hw} y={a} width={hw * 2} height={b - a} fill={WHITE} opacity={0.6} />
          <rect x={x + hw - 10} y={a} width={10} height={b - a} fill={G3} opacity={0.5} />
          <rect x={x - hw + 5} y={Math.max(a, wTop)} width={hw * 2 - 10} height={Math.max(0, b - Math.max(a, wTop))} fill={ISO.water[1]} />
          <rect x={x + hw - 16} y={Math.max(a, wTop)} width={8} height={Math.max(0, b - Math.max(a, wTop))} fill={ISO.water[2]} opacity={0.7} />
        </g>
      ))}
      {top < brk - 40 && <g>
        <polygon points={pts([[x - hw - 12, brk - 40], [x + hw + 12, brk - 54], [x + hw + 12, brk - 24], [x - hw - 12, brk - 10]])} fill={G4} />
        <polygon points={pts([[x - hw - 12, brk + 10], [x + hw + 12, brk + 24], [x + hw + 12, brk + 54], [x - hw - 12, brk + 40]])} fill={G4} />
      </g>}
      {/* a pulse of water drops in the tube while it climbs */}
      {water > 0.02 && water < 0.98 && [0, 1, 2, 3].map((i) => { const k = riseAt(clock, i / 4, 1.2); const y = lerp(base - 160, wTop, k); return y > brk - 40 && y < brk + 40 ? null : <circle key={i} cx={x} cy={y} r={7} fill={WHITE} opacity={0.7 * Math.sin(Math.PI * k)} />; })}
      {/* the top mark: a dashed line at the 10.3 m level */}
      {water > 0.9 && <g><line x1={x - 160} y1={COL.top + 90} x2={x + 160} y2={COL.top + 90} stroke={BLACK} strokeWidth={6} strokeDasharray="26 16" strokeDashoffset={-clock * 40} /><Arrow x={x + 90} y={COL.top - 90} x2={x + 90} y2={COL.top + 70} color="black" w={10} draw={1} /></g>}
    </g>
  );
};

const Picture: React.FC<{ story: StoryT; clock: number; t: number; beatId: string }> = ({ story: s, clock }) => {
  const P = makePlan(s), m = P.m;
  const cam = P.cam(clock);
  const suck = P.suck(clock), rise = P.rise(clock);
  const surf = P.glassLevel(clock), sLevel = P.strawLevel(clock);
  const airOn = Math.max(clamp01((clock - (m.udara + 0.4)) / 0.6) * (1 - clamp01((clock - (m.dorong + 9)) / 0.6)), 0) * 0.85 + 0.15 * pulse01(clock, 0, 3);
  const arrows = (from: number, dur = 0.5) => easeOut(clamp01((clock - from) / dur));
  const down = arrows(m.udara + 0.8) * (1 - clamp01((clock - (m.batas - 0.4)) / 0.4));
  const downB = clock >= m.hasil + 1.4 ? arrows(m.hasil + 1.4) * (1 - clamp01((clock - (m.tips + 0.2)) / 0.4)) : 0;
  const downAll = Math.max(down, downB);
  const upA = arrows(m.dorong + 1.0) * (1 - clamp01((clock - (m.dorong + 5.4)) / 0.4));
  const crossP = arrows(m.hasil + 3.4) * (1 - clamp01((clock - (m.tips + 0.2)) / 0.4));
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <g transform={layerTransform(cam, 1)}>
        <Room clock={clock} />
        <Person clock={clock} suck={suck} />
        <Dressing clock={clock} />
        <Column g={P.col(clock)} water={P.colWater(clock)} clock={clock} />
        <Glass clock={clock} surf={surf} strawLevel={sLevel} suck={suck} airOn={airOn} />
        <Lips suck={suck} />
        {/* the air all around the glass: dots that jiggle (the pressure of the room) */}
        {Array.from({ length: 22 }, (_, i) => {
          const x = lerp(260, 640, hash(i + 9)), y = lerp(720, 990, hash(i + 70));
          if (Math.abs(x - strawAt((STRAW.s0[1] - y) / (STRAW.s0[1] - STRAW.s1[1]))[0]) < 40) return null;
          return <circle key={i} cx={x + 10 * Math.sin(clock * 2.3 + i)} cy={y + 9 * Math.sin(clock * 1.9 + i * 2)} r={5} fill={G2} opacity={0.2 + 0.55 * airOn} />;
        })}
        {/* the push of the air on the drink: arrows down onto the surface (udara, dorong, hasil beats) */}
        {downAll > 0.01 && [[452, 940], [630, 940]].map(([x, y], i) => <Arrow key={i} x={x} y={y - 40 * (1 - downAll)} x2={x} y2={surf - 16} color="black" w={14} draw={downAll} />)}
        {/* the push inside the straw: yellow arrows up the straw while the drink climbs */}
        {upA > 0.01 && rise < 0.98 && [0.35, 0.6].map((s, i) => { const a = strawAt(s - 0.1), b = strawAt(s + 0.1); return <Arrow key={i} x={a[0] - 56} y={a[1]} x2={b[0] - 56} y2={b[1]} color="yellow" w={12} draw={upA * (0.6 + 0.4 * pulse01(clock, i * 0.3, 1.2))} />; })}
        {/* the mouth does not pull: a faint grey arrow up from the glass with a black cross over it (hasil beat) */}
        {crossP > 0.01 && <g opacity={crossP}>
          <Arrow x={300} y={1190} x2={300} y2={1040} color="black" w={16} draw={1} />
          <g stroke={BLACK} strokeWidth={14} strokeLinecap="round"><line x1={250} y1={1075} x2={350} y2={1155} /><line x1={350} y1={1075} x2={250} y2={1155} /></g>
        </g>}
      </g>
      {/* the near layer: dust that drifts up, it touches nothing */}
      <g transform={layerTransform(cam, 1.25)}>
        <Motes t={clock} color={WHITE} opacity={0.35} n={12} />
      </g>
      {/* labels on the parts (they follow the camera, kept inside the safe frame) */}
      {P.labels.map((l) => {
        if (clock < l.from - 0.05 || clock > l.to + 0.4) return null;
        const p = toScreen(cam, l.at);
        const x = Math.max(260, Math.min(820, p[0])), y = Math.max(420, Math.min(1380, p[1]));
        return <g key={l.id} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={x} y={y} fs={l.fs} t={clock} start={l.from} /></g>;
      })}
      {/* the tips over the set */}
      {[{ n: 1, title: "Mulut turunkan tekanan", at: 1.2 }, { n: 2, title: "Udara luar mendorong", at: 4.4 }].map((c) => (
        <TipCard key={c.n} x={110} y={c.n === 1 ? 1225 : 1365} w={810} n={c.n} title={c.title} t={clock} start={m.tips + c.at} end={m.outro} />
      ))}
    </svg>
  );
};

const Scene = ({ beat, t, clock, story: s }: SceneProps) => (
  <div style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }}>
    <Picture story={s} clock={clock} t={t} beatId={beat.id} />
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText kicker={beat.kicker} headline={beat.headline ?? beat.text} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(t, 0), out = 1 - easeInOut(clamp01((t - 0.75) / 0.25));
        return <g>
          <StingMark slug="cara-kerja-sedotan-menyedot-mi" t={t} p={p} out={out} />
        </g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
