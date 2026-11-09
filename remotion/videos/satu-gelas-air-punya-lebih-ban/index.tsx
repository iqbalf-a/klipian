/* Satu gelas air punya lebih banyak molekul daripada gelas di lautan — a custom video, look 2d (B28): a flat side view, no iso projection. One continuous
   take in a school lab (a new set kind "lab-bench-side", set.json): the hero is a glass of water full of H2O molecules; the dressing is a tiled wall, a shelf
   of jars, a clock and a globe poster; a tall tank of tiny glasses stands for the ocean and a balance compares the two counts.
   Shapes checked (Wikipedia: Properties of water, Water): a water molecule is bent (oxygen with two hydrogens about 104.5 degrees apart), the water in a glass is a tight crowd of them.
   Two tones per part (base and shade), light from the top left, no outlines. The camera and every time come from plan.ts. */
import React from "react";
import {
  loopClock, Arrow, CaptionLayer, G1, G2, G3, G4, ISO, Label, Mascot, Motes, Pill, THEMES, TipCard, TopText, WHITE,
  StoryVideo, bobPx, easeInOut, easeOut, layerTransform, springAt, swayDeg, toScreen,
  type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { BAL, GLASS, SPOON, SURF, TANK, makePlan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const pts = (p: readonly (readonly [number, number])[]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
const SKY = THEMES.sky;
const WALL: readonly [string, string, string] = ISO.stone;
const WOOD = ISO.sand;
const WATER = ISO.water;
const LEAF = ISO.leaf;
const BENCH_Y = GLASS.base;
const hash = (i: number) => { const x = Math.sin(i * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };

const xl = (y: number) => lerp(GLASS.xl0 + GLASS.wall, GLASS.xl1 + GLASS.wall, (y - GLASS.top) / (GLASS.base - GLASS.top));
const xr = (y: number) => lerp(GLASS.xr0 - GLASS.wall, GLASS.xr1 - GLASS.wall, (y - GLASS.top) / (GLASS.base - GLASS.top));

/** The set: tiled wall, shelf, clock, poster, bench, floor. Everything bleeds past the frame. */
const Lab: React.FC<{ clock: number }> = ({ clock }) => {
  const hand = (clock / 60) * 360 * 6, hour = hand / 12;
  return (
    <g>
      <rect x={-3600} y={-3800} width={8200} height={BENCH_Y + 3800} fill={WALL[0]} />
      {Array.from({ length: 52 }, (_, i) => <rect key={i} x={-3400 + i * 130} y={-3800} width={6} height={BENCH_Y + 3800} fill={WALL[1]} opacity={0.5} />)}
      {Array.from({ length: 24 }, (_, i) => <rect key={i} x={-3600} y={BENCH_Y - 130 * (i + 1)} width={8200} height={6} fill={WALL[1]} opacity={0.5} />)}
      <rect x={-3600} y={BENCH_Y - 300} width={8200} height={300} fill={WALL[1]} opacity={0.35} />
      {/* the shelf with jars, behind the glass */}
      <rect x={760} y={640} width={760} height={22} fill={WOOD[2]} />
      <rect x={760} y={640} width={760} height={9} fill={WOOD[0]} />
      {[[800, 90, 150], [920, 110, 110], [1060, 80, 170], [1180, 120, 130], [1330, 90, 100]].map(([x, w, h], i) => (
        <g key={i}>
          <rect x={x} y={640 - h} width={w} height={h} rx={14} fill={i % 2 ? WATER[0] : LEAF[0]} opacity={0.9} />
          <rect x={x + w * 0.62} y={640 - h} width={w * 0.38} height={h} rx={10} fill={i % 2 ? WATER[1] : LEAF[1]} opacity={0.75} />
          <rect x={x + 8} y={640 - h - 16} width={w - 16} height={18} rx={6} fill={G3} />
        </g>
      ))}
      {/* the wall clock: 12 cm across, the hands move */}
      <circle cx={-150} cy={560} r={210} fill={G4} />
      <circle cx={-150} cy={560} r={188} fill={WHITE} />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-155} y={382} width={10} height={i % 3 === 0 ? 38 : 20} fill={G2} transform={`rotate(${i * 30} -150 560)`} />)}
      <rect x={-158} y={452} width={16} height={112} rx={8} fill={G1} transform={`rotate(${hour} -150 560)`} />
      <rect x={-155} y={396} width={10} height={170} rx={5} fill={G2} transform={`rotate(${hand} -150 560)`} />
      <circle cx={-150} cy={560} r={14} fill={G1} />
      <g transform="translate(900 0)">{/* the globe poster: a flat globe, ocean blue with two land patches, a pale card behind */}
      <rect x={1760} y={300} width={620} height={720} fill={WHITE} />
      <rect x={2200} y={300} width={180} height={720} fill={G4} opacity={0.7} />
      <circle cx={2040} cy={640} r={230} fill={WATER[1]} />
      <path d="M 1900 560 C 1960 480 2050 500 2080 560 C 2100 620 2020 650 1990 720 C 1930 700 1880 640 1900 560 Z" fill={LEAF[1]} />
      <path d="M 2130 700 C 2190 660 2250 700 2240 760 C 2220 820 2150 820 2120 770 Z" fill={LEAF[2]} />
      <path d="M 2040 410 A 230 230 0 0 1 2270 640 A 230 230 0 0 1 2040 870 A 300 300 0 0 0 2040 410 Z" fill={WATER[2]} opacity={0.55} />
      <rect x={1800} y={900} width={540} height={14} fill={G3} /></g>
      {/* the bench: top, front face, drawers; the floor below */}
      <rect x={-3600} y={BENCH_Y} width={8200} height={12} fill={WOOD[0]} />
      <rect x={-3600} y={BENCH_Y + 12} width={8200} height={80} fill={WOOD[1]} />
      <rect x={-3600} y={BENCH_Y + 92} width={8200} height={380} fill={WOOD[2]} />
      {Array.from({ length: 20 }, (_, i) => <g key={i}><rect x={-2200 + i * 360} y={BENCH_Y + 130} width={8} height={330} fill={WOOD[1]} opacity={0.7} /><rect x={-2200 + i * 360 + 140} y={BENCH_Y + 180} width={80} height={14} rx={7} fill={G4} /></g>)}
      <rect x={-3600} y={BENCH_Y + 472} width={8200} height={2200} fill={SKY.floor} />
      <rect x={-3600} y={BENCH_Y + 472} width={8200} height={16} fill={SKY.floorEdge} />
      {Array.from({ length: 40 }, (_, i) => <rect key={i} x={-2400 + i * 260} y={BENCH_Y + 560} width={8} height={2200} fill={SKY.floorEdge} opacity={0.55} />)}
    </g>
  );
};

/** One water molecule: an oxygen and two hydrogens, bent at about 104.5 degrees (not a straight line). */
const Mol: React.FC<{ x: number; y: number; rot: number; s?: number }> = ({ x, y, rot, s = 1 }) => (
  <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${s})`}>
    {[-52.25, 52.25].map((a, i) => {
      const r = (a - 90) * Math.PI / 180;
      return <circle key={i} cx={Math.cos(r) * 17} cy={-Math.sin(r) * 17 * -1} r={6.5} fill={i ? G4 : WHITE} />;
    })}
    <circle cx={0} cy={0} r={11} fill={WATER[2]} />
    <circle cx={-3} cy={-3} r={5} fill={WATER[1]} />
  </g>
);

/** The glass of water: a tight crowd of molecules in the water, the glass in front. */
const Glass: React.FC<{ clock: number }> = ({ clock }) => {
  const { top, base, floorIn } = GLASS;
  const wob = (x: number) => 3 * Math.sin(clock * 2.199 + x * 0.04);
  const surfPath = `M ${xl(SURF) - 1} ${SURF + wob(0)} ` + Array.from({ length: 13 }, (_, i) => { const x = lerp(xl(SURF), xr(SURF), (i + 1) / 13); return `L ${x} ${SURF + wob(x)}`; }).join(" ");
  const mols: React.ReactNode[] = [];
  const rows = 11, cols = 8;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const y = lerp(SURF + 34, floorIn - 26, r / (rows - 1)), x0 = xl(y) + 22, x1 = xr(y) - 22;
    const k = r * cols + c, off = (r % 2) * 0.5 * ((x1 - x0) / (cols - 1));
    const x = lerp(x0, x1, c / (cols - 1)) + off * (c === cols - 1 ? 0 : 1) + 6 * Math.sin(clock * 2.409 + k) , yy = y + 6 * Math.sin(clock * 1.99 + k * 1.7);
    mols.push(<Mol key={k} x={x} y={yy} rot={(hash(k) * 360) + 40 * Math.sin(clock * 1.257 + k)} />);
  }
  return (
    <g>
      <polygon points={pts([[GLASS.xl0, top], [GLASS.xr0, top], [GLASS.xr1, base], [GLASS.xl1, base]])} fill={WHITE} opacity={0.3} />
      <polygon points={pts([[xl(SURF), SURF], [xr(SURF), SURF], [xr(floorIn), floorIn], [xl(floorIn), floorIn]])} fill={WATER[0]} opacity={0.9} />
      <polygon points={pts([[lerp(xl(SURF), xr(SURF), 0.78), SURF], [xr(SURF), SURF], [xr(floorIn), floorIn], [lerp(xl(floorIn), xr(floorIn), 0.78), floorIn]])} fill={WATER[1]} opacity={0.6} />
      <path d={surfPath} fill="none" stroke={WHITE} strokeWidth={8} strokeLinecap="round" />
      {mols}
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

/** A tiny drinking glass, 40 x 46, for the pattern that fills the tank and for the balance's pan. */
const MiniGlass: React.FC = () => (
  <g>
    <polygon points="6,6 34,6 31,42 9,42" fill={WHITE} opacity={0.75} />
    <polygon points="8,16 32,16 30,40 10,40" fill={WATER[0]} />
    <polygon points="22,16 32,16 30,40 20,40" fill={WATER[1]} opacity={0.8} />
    <rect x={5} y={4} width={30} height={4} rx={2} fill={G4} />
  </g>
);

/** The ocean's stand-in: a tall tank, water inside, rows of tiny glasses filling it from the bottom up. */
const Tank: React.FC<{ fill: number; clock: number }> = ({ fill, clock }) => {
  const w = TANK.x1 - TANK.x0, h = TANK.base - TANK.top;
  return (
    <g>
      <defs>
        <pattern id="miniGlass" x={TANK.x0} y={TANK.base} width={40} height={46} patternUnits="userSpaceOnUse"><MiniGlass /></pattern>
        <clipPath id="tankClip"><rect x={TANK.x0 + 20} y={TANK.base - 20 - (h - 40) * fill} width={w - 40} height={(h - 40) * fill + 1} /></clipPath>
      </defs>
      <rect x={TANK.x0} y={TANK.top} width={w} height={h} fill={WHITE} opacity={0.35} />
      <rect x={TANK.x0 + 20} y={TANK.top + 60} width={w - 40} height={h - 80} fill={WATER[0]} opacity={0.8} />
      <rect x={TANK.x1 - 220} y={TANK.top + 60} width={200} height={h - 80} fill={WATER[1]} opacity={0.55} />
      <g clipPath="url(#tankClip)"><rect x={TANK.x0 + 20} y={TANK.top} width={w - 40} height={h} fill="url(#miniGlass)" /></g>
      <rect x={TANK.x0 + 20} y={TANK.top + 60 + 3 * Math.sin(clock * 2)} width={w - 40} height={8} fill={WHITE} opacity={0.8} />
      <rect x={TANK.x0 - 12} y={TANK.top} width={32} height={h} fill={G4} />
      <rect x={TANK.x1 - 20} y={TANK.top} width={32} height={h} fill={G3} />
      <rect x={TANK.x0 - 12} y={TANK.base - 24} width={w + 24} height={24} fill={G3} />
      <rect x={TANK.x0 - 12} y={TANK.top - 10} width={w + 24} height={16} rx={8} fill={G4} />
      <rect x={TANK.x0 + 40} y={TANK.top + 80} width={14} height={h - 160} rx={7} fill={WHITE} opacity={0.6} />
    </g>
  );
};

/** The two-pan balance: a post, a beam that tilts, two pans on strings that stay level. Left: tiny glasses (the ocean's count); right: molecules (the glass's count). */
const Balance: React.FC<{ tilt: number; clock: number }> = ({ tilt, clock }) => {
  const a = tilt * Math.PI / 180, { x, pivotY, half, hang } = BAL;
  const L: [number, number] = [x - half * Math.cos(a), pivotY - half * Math.sin(a)], R: [number, number] = [x + half * Math.cos(a), pivotY + half * Math.sin(a)];
  const pan = (p: [number, number], k: number) => (
    <g>
      <line x1={p[0]} y1={p[1]} x2={p[0] - 110} y2={p[1] + hang} stroke={G2} strokeWidth={5} />
      <line x1={p[0]} y1={p[1]} x2={p[0] + 110} y2={p[1] + hang} stroke={G2} strokeWidth={5} />
      <path d={`M ${p[0] - 130} ${p[1] + hang} L ${p[0] + 130} ${p[1] + hang} Q ${p[0]} ${p[1] + hang + 70} ${p[0] - 130} ${p[1] + hang} Z`} fill={ISO.brass[1]} />
      <path d={`M ${p[0] + 20} ${p[1] + hang} L ${p[0] + 130} ${p[1] + hang} Q ${p[0] + 60} ${p[1] + hang + 52} ${p[0] + 20} ${p[1] + hang + 6} Z`} fill={ISO.brass[2]} opacity={0.8} />
      {k === 0
        ? <g transform={`translate(${p[0] - 76} ${p[1] + hang - 92}) scale(3.8 2)`}><MiniGlass /></g>
        : <g>{[0, 1, 2, 3, 4, 5].map((i) => <Mol key={i} x={p[0] - 80 + (i % 3) * 80 + 6 * Math.sin(clock * 2.409 + i)} y={p[1] + hang - 30 - Math.floor(i / 3) * 46 + 5 * Math.sin(clock * 1.99 + i)} rot={hash(i + 5) * 360 + 30 * Math.sin(clock * 1.047 + i)} s={1.5} />)}</g>}
    </g>
  );
  return (
    <g>
      <rect x={x - 130} y={BENCH_Y - 40} width={260} height={40} rx={14} fill={ISO.brass[2]} />
      <polygon points={pts([[x - 26, BENCH_Y - 40], [x + 26, BENCH_Y - 40], [x + 16, pivotY], [x - 16, pivotY]])} fill={ISO.brass[1]} />
      <polygon points={pts([[x + 6, BENCH_Y - 40], [x + 26, BENCH_Y - 40], [x + 16, pivotY], [x + 4, pivotY]])} fill={ISO.brass[2]} opacity={0.8} />
      {pan(L, 0)}{pan(R, 1)}
      <line x1={L[0]} y1={L[1]} x2={R[0]} y2={R[1]} stroke={ISO.brass[1]} strokeWidth={22} strokeLinecap="round" />
      <line x1={L[0]} y1={L[1] - 6} x2={R[0]} y2={R[1] - 6} stroke={ISO.brass[0]} strokeWidth={6} strokeLinecap="round" />
      <circle cx={x} cy={pivotY} r={26} fill={ISO.brass[2]} /><circle cx={x - 5} cy={pivotY - 5} r={10} fill={ISO.brass[0]} />
    </g>
  );
};

/** A teaspoon lying on the bench: the bowl full of water and molecules, the handle to the right. */
const Spoon: React.FC<{ clock: number }> = ({ clock }) => {
  const { x, y } = SPOON;
  return (
    <g>
      <polygon points={pts([[x + 70, y - 8], [x + 330, y - 14], [x + 330, y - 4], [x + 70, y]])} fill={ISO.metal[1]} />
      <polygon points={pts([[x + 70, y - 8], [x + 330, y - 14], [x + 330, y - 11], [x + 70, y - 5]])} fill={ISO.metal[0]} />
      <path d={`M ${x - 90} ${y - 16} L ${x + 90} ${y - 16} Q ${x + 70} ${y + 4} ${x} ${y + 4} Q ${x - 70} ${y + 4} ${x - 90} ${y - 16} Z`} fill={ISO.metal[1]} />
      <path d={`M ${x + 6} ${y - 16} L ${x + 90} ${y - 16} Q ${x + 70} ${y + 4} ${x} ${y + 4} Z`} fill={ISO.metal[2]} opacity={0.7} />
      <path d={`M ${x - 80} ${y - 14} L ${x + 80} ${y - 14} Q ${x + 60} ${y - 2} ${x} ${y - 2} Q ${x - 60} ${y - 2} ${x - 80} ${y - 14} Z`} fill={WATER[0]} />
      {[-48, -16, 16, 48].map((dx, i) => <Mol key={i} x={x + dx + 3 * Math.sin(clock * 2.513 + i)} y={y - 24 + 3 * Math.sin(clock * 1.99 + i * 2)} rot={hash(i + 20) * 360 + 30 * Math.sin(clock * 1.047 + i)} s={0.7} />)}
    </g>
  );
};

const Picture: React.FC<{ story: StoryT; clock: number; t: number; beatId: string }> = ({ story: s, clock }) => {
  const amb = loopClock(clock, s.beats.reduce((a, b) => a + b.dur, 0));   // B29: the ambient motion runs on the loop clock
  const P = makePlan(s), m = P.m;
  const cam = P.cam(clock);
  const chk = P.check(clock);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <g transform={layerTransform(cam, 1)}>
        <Lab clock={amb} />
        <Tank fill={P.tankFill(clock)} clock={amb} />
        <Balance tilt={P.tilt(clock)} clock={amb} />
        <Spoon clock={amb} />
        <Glass clock={amb} />
        {/* the check mark over the glass: a green disc that pops (hasil beat) */}
        {chk > 0.01 && <g transform={`translate(740 1020) scale(${chk}) rotate(${swayDeg(amb, 0, 4, 3)})`}>
          <circle r={74} fill={LEAF[1]} /><circle r={74} cx={10} cy={10} fill={LEAF[2]} opacity={0.5} />
          <path d="M -34 2 L -8 30 L 38 -26" fill="none" stroke={WHITE} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
        </g>}
        {/* a bubble of plant leaves on the bench, dressing at the far left: a small pot (5 cm) with swaying leaves */}
        <g transform={`translate(-60 ${BENCH_Y})`}>
          <polygon points="0,0 -10,-110 120,-110 110,0" fill={SKY.floorEdge} />
          <polygon points="80,0 80,-110 120,-110 110,0" fill={ISO.soil[2]} />
          <g transform={`translate(55 -110) rotate(${swayDeg(clock, 0.1, 3.5, 4.2)})`}>
            <path d="M 0 0 C -60 -50 -80 -130 -50 -200 C -10 -150 10 -70 0 0 Z" fill={LEAF[1]} />
            <path d="M 0 0 C 50 -60 90 -110 110 -170 C 50 -150 10 -80 0 0 Z" fill={LEAF[0]} />
            <path d="M 0 0 C 10 -80 30 -150 20 -230 C -10 -170 -14 -80 0 0 Z" fill={LEAF[2]} />
          </g>
        </g>
        {/* the push of "a lot": yellow arrows over the balance's heavy pan once it tilts */}
        {P.tilt(clock) > 6 && <Arrow x={BAL.x + BAL.half + 200} y={BAL.pivotY + 120} x2={BAL.x + BAL.half + 200} y2={BAL.pivotY + 360 + bobPx(clock, 0, 8, 1.4)} color="yellow" w={16} draw={easeOut(clamp01((P.tilt(clock) - 6) / 5))} />}
      </g>
      {/* the near layer: dust that drifts up, it touches nothing */}
      <g transform={layerTransform(cam, 1.25)}>
        <Motes t={amb} color={WHITE} opacity={0.35} n={12} />
      </g>
      {/* labels on the parts (they follow the camera, kept inside the safe frame) */}
      {P.labels.map((l) => {
        if (clock < l.from - 0.05 || clock > l.to + 0.4) return null;
        const p = toScreen(cam, l.at);
        const x = Math.max(260, Math.min(820, p[0])), y = Math.max(420, Math.min(1380, p[1]));
        return <g key={l.id} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={x} y={y} fs={l.fs} t={clock} start={l.from} /></g>;
      })}
      {/* the tips over the set */}
      {[{ n: 1, title: "Molekul kecil, jumlahnya raksasa", at: 1.2 }, { n: 2, title: "Pangkat 24 jauh di atas 21", at: 4.2 }].map((c) => (
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
          <g transform={`translate(540 720) scale(${Math.max(0, p) * out}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} squash={0.18 * (1 - p)} /></g>
          <g opacity={out}><Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} /></g>
        </g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
