/* Kenapa langit berwarna biru? — a custom video, one continuous take in an "air column" (the free set kind "air-column", set.json): a tall glass box of air on a
   plaza slab, the sun at its upper corner, a prism, gas molecules floating in the air, and a pedestal where an eye stands. White sunlight splits into colours,
   the air scatters the short blue waves far more than the long red ones, the blue reaches the eye from every part of the sky; at sunset the light crosses a long
   low layer of air and only the red is left. Shapes checked: a prism is a triangle extruded; a wave is a sine whose length is short for blue and long for red;
   the sun is a sphere seen as a disc; the air is drawn as a box of glass because the sky has no edge to draw. The camera and every time come from plan.ts. */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, G2, G4, HOT2, IsoBlock, IsoSun, ISO, Label, Motes, Polys, RED, THEMES, TopText, WHITE, YELLOW,
  block, bobPx, blinkClosed, extrudeXZ, isoAt, layerTransform, ptsAttr, riseAt, springAt, easeInOut,
  StoryVideo, type P2, type P3, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { AIR_LOW, COL, EYE, MOLECULES, O, PEDESTAL, PRISM, SUN_NOON, TARGET, U, ease, makePlan, molecule, w } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const VIOLET = mixRgb(ISO.water[2], RED, 0.55);
const SPREAD = [RED, HOT2, YELLOW, ISO.leaf[1], ISO.water[0]] as const;      // the five colours of the prism: red, orange, yellow, green, blue
const lerp2 = (a: P2, b: P2, k: number): P2 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const lerp3 = (a: P3, b: P3, k: number): P3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** The colour of the light after the fraction f of its way through the air at sunset: white, then orange, then red (dk = how far the sunset has come). */
const duskColour = (f: number, dk: number) => mixRgb(WHITE, mixRgb(mixRgb(WHITE, HOT2, Math.min(1, f * 2)), RED, Math.max(0, f * 2 - 1)), dk);
const wavePts = (c: P2, len: number, amp: number, wl: number, ph: number): string =>
  ptsAttr(Array.from({ length: 41 }, (_, i) => { const x = -len / 2 + (len * i) / 40; return [c[0] + x, c[1] + amp * Math.sin(((x / wl) + ph) * Math.PI * 2)] as P2; }));
const edge = (a: P3, b: P3) => ptsAttr([w(a), w(b)]);

const Picture: React.FC<{ story: StoryT; clock: number }> = ({ story: s, clock }) => {
  const P = React.useMemo(() => makePlan(s), [s]);
  const lw = P.loopWeight(clock), t = clock * (1 - lw);                 // the idles settle as the loop comes home: the last frame is the first
  const cam = P.cam(clock);
  const wall = THEMES[s.theme ?? "sky"].wall;
  const m = P.m;
  const sun3 = P.sun(clock), sunS = w(sun3), eyeS = w(EYE);
  const prismK = P.prism(clock), spreadK = P.spread(clock), splitK = P.split(clock), dusk = P.dusk(clock), tint = P.tint(clock);
  const prismP: P3 = [PRISM.x, 0, PRISM.z];
  const endBeam = lerp3(TARGET, prismP, prismK);
  const endS = w(endBeam);
  const noonHit = (j: number): P3 => lerp3(SUN_NOON, TARGET, 0.3 + j * 0.08);   // where the beam meets a gas molecule at noon
  const bounceK = P.bounce(clock), eyeK = P.eye(clock), toEye = P.toEye(clock), violetK = P.violet(clock), chipK = P.chip(clock);
  const blueNow = ease((clock - m.biru) / 1.0);
  const dropCol = mixRgb(G4, ISO.water[0], blueNow);
  const blink = 1 - blinkClosed(t, 4.2, 0) * 0.92;
  // the long low layer of air at sunset: its gas molecules
  const duskMol = (i: number): P3 => { const h = (n: number) => { const q = Math.sin(n * 91.7 + 17.3) * 43758.5453; return q - Math.floor(q); }; return [AIR_LOW.x0 + 0.6 + h(i + 3) * (AIR_LOW.x1 - AIR_LOW.x0 - 1.2), -0.7 + h(i + 29) * 1.4, 0.3 + h(i + 57) * 1.3]; };
  const mainSeg = (j: number) => {
    const a = lerp2(sunS, endS, j / 8), b = lerp2(sunS, endS, (j + 1) / 8), col = duskColour(j / 7, dusk);
    return { a, b, col };
  };
  const tiles: React.ReactNode[] = [];
  for (let i = -9; i < 9; i++) for (let j = -9; j < 9; j++) if ((i + j) % 2 === 0) tiles.push(<IsoBlock key={`${i}_${j}`} a={[i * 1.8, j * 1.8, 0]} b={[i * 1.8 + 1.8, j * 1.8 + 1.8, 0.03]} u={U} o={O} tones={ISO.plastic} />);

  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <rect width={1080} height={1920} fill={wall} />
      {/* far layer (parallax 0.3): the brand sky behind the set */}
      <g transform={layerTransform(cam, 0.3)}><g transform="translate(540 960) scale(2.6) translate(-540 -960)"><Brand clock={t} spot={{ x: 300, y: 520 }} /></g></g>
      <g transform={layerTransform(cam, 1)}>
        {/* the plaza: a slab that runs past the frame, with two-tone tiles */}
        <IsoBlock a={[-40, -40, -0.7]} b={[40, 40, 0]} u={U} o={O} tones={ISO.floor} />
        {tiles}
        {/* dressing at real scale: a bench and a lamp post (man-made things are boxes), cut by the frame */}
        <IsoBlock a={[3.6, 2.2, 0]} b={[3.8, 2.4, 0.4]} u={U} o={O} tones={ISO.metal} />
        <IsoBlock a={[5.2, 2.2, 0]} b={[5.4, 2.4, 0.4]} u={U} o={O} tones={ISO.metal} />
        <IsoBlock a={[3.5, 2.1, 0.4]} b={[5.5, 2.7, 0.55]} u={U} o={O} tones={ISO.brass} />
        <IsoBlock a={[3.5, 2.6, 0.55]} b={[5.5, 2.7, 1.1]} u={U} o={O} tones={ISO.brass} />
        <IsoBlock a={[-5.6, 2.0, 0]} b={[-5.4, 2.2, 3.4]} u={U} o={O} tones={ISO.dark} />
        <IsoBlock a={[-5.9, 1.8, 3.4]} b={[-5.1, 2.4, 3.8]} u={U} o={O} tones={ISO.metal} />
        <IsoBlock a={[PEDESTAL.a[0], PEDESTAL.a[1], PEDESTAL.a[2]]} b={[PEDESTAL.b[0], PEDESTAL.b[1], PEDESTAL.b[2]]} u={U} o={O} tones={ISO.metal} />

        {/* the long low layer of air the sunset light crosses */}
        {dusk > 0.01 && <g>
          <Polys polys={block([AIR_LOW.x0, AIR_LOW.y0, 0.03], [AIR_LOW.x1, AIR_LOW.y1, AIR_LOW.z1], U, O)} tones={ISO.water} opacity={0.3 * dusk} />
          <polyline points={ptsAttr([w([AIR_LOW.x0, AIR_LOW.y1, AIR_LOW.z1]), w([AIR_LOW.x1, AIR_LOW.y1, AIR_LOW.z1])])} fill="none" stroke={WHITE} strokeWidth={4} opacity={0.7 * dusk} />
        </g>}

        {/* the air column: a glass box whose tint turns blue as the blue is scattered */}
        <Polys polys={block([COL.x0, COL.y0, 0.03], [COL.x1, COL.y1, COL.z1], U, O)} tones={ISO.water} opacity={0.1 + 0.4 * tint} />
        <polyline points={ptsAttr([w([COL.x0, COL.y1, 0.03]), w([COL.x0, COL.y1, COL.z1])])} fill="none" stroke={WHITE} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
        <polyline points={ptsAttr([w([COL.x1, COL.y1, 0.03]), w([COL.x1, COL.y1, COL.z1])])} fill="none" stroke={WHITE} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
        <polyline points={ptsAttr([w([COL.x1, COL.y0, 0.03]), w([COL.x1, COL.y0, COL.z1])])} fill="none" stroke={WHITE} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
        <polygon points={ptsAttr([w([COL.x0, COL.y0, COL.z1]), w([COL.x1, COL.y0, COL.z1]), w([COL.x1, COL.y1, COL.z1]), w([COL.x0, COL.y1, COL.z1])])} fill="none" stroke={WHITE} strokeWidth={5} strokeLinejoin="round" opacity={0.9} />
        <polyline points={ptsAttr([w([COL.x0 + 0.12, COL.y1, 0.8]), w([COL.x0 + 0.12, COL.y1, 3.6])])} fill="none" stroke={WHITE} strokeWidth={8} strokeLinecap="round" opacity={0.3} />

        {/* the sun's beam: eight stretches, white at noon, reddening along the long way at sunset; it splits into blue and red in the biru beat */}
        <g opacity={1 - splitK * 0.85}>
          {Array.from({ length: 8 }, (_, j) => { const g = mainSeg(j); return (
            <g key={j}>
              <line x1={g.a[0]} y1={g.a[1]} x2={g.b[0]} y2={g.b[1]} stroke={g.col} strokeWidth={26} strokeLinecap="round" opacity={0.25} />
              <line x1={g.a[0]} y1={g.a[1]} x2={g.b[0]} y2={g.b[1]} stroke={g.col} strokeWidth={11} strokeLinecap="round" />
            </g>); })}
          <line x1={sunS[0]} y1={sunS[1]} x2={endS[0]} y2={endS[1]} stroke={WHITE} strokeWidth={4} strokeDasharray="12 28" strokeDashoffset={-t * 120} opacity={0.9 * (1 - dusk * 0.6)} />
        </g>
        {splitK > 0.01 && (() => {
          const o1: P3 = [0, 0, 0.14], o2: P3 = [0, 0, -0.14];
          const A = (o: P3) => w([SUN_NOON[0] + o[0], 0, SUN_NOON[2] + o[2]]), B = (o: P3) => w([TARGET[0], 0, TARGET[2] + o[2]]);
          return (
            <g opacity={splitK}>
              <line x1={A(o2)[0]} y1={A(o2)[1]} x2={B(o2)[0]} y2={B(o2)[1]} stroke={RED} strokeWidth={11} strokeLinecap="round" />
              <line x1={A(o2)[0]} y1={A(o2)[1]} x2={B(o2)[0]} y2={B(o2)[1]} stroke={WHITE} strokeWidth={3} strokeDasharray="10 30" strokeDashoffset={-t * 140} />
              {Array.from({ length: 6 }, (_, j) => { const a = lerp2(A(o1), B(o1), j / 6), b = lerp2(A(o1), B(o1), (j + 1) / 6); return <line key={j} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.water[1]} strokeWidth={11} strokeLinecap="round" opacity={1 - j * 0.16} />; })}
            </g>
          );
        })()}

        {/* the prism: the white beam goes in, five colours fan out and reach the ground */}
        {prismK > 0.01 && (() => {
          const c = w(prismP);
          return (
            <g>
              {SPREAD.map((col, i) => { const g = w([-0.3 + i * 0.55, 0, 0.12]); return <g key={i} opacity={spreadK}><line x1={c[0] + 14} y1={c[1] + 8} x2={g[0]} y2={g[1]} stroke={col} strokeWidth={9} strokeLinecap="round" /><line x1={c[0] + 14} y1={c[1] + 8} x2={g[0]} y2={g[1]} stroke={WHITE} strokeWidth={2.5} strokeDasharray="8 26" strokeDashoffset={-t * 110 - i * 9} /></g>; })}
              <g opacity={prismK} transform={`translate(${c[0]} ${c[1]}) scale(${0.6 + 0.4 * prismK}) translate(${-c[0]} ${-c[1]})`}>
                <Polys polys={extrudeXZ([[PRISM.x - PRISM.r, PRISM.z - PRISM.r * 0.8], [PRISM.x + PRISM.r, PRISM.z - PRISM.r * 0.8], [PRISM.x, PRISM.z + PRISM.r * 0.9]], -0.35, 0.35, U, O)} tones={ISO.plastic} opacity={0.85} />
              </g>
            </g>
          );
        })()}

        {/* gas molecules floating in the column (they bob all the time) */}
        {Array.from({ length: MOLECULES }, (_, i) => {
          const k = P.molecules(clock, i);
          if (k < 0.02) return null;
          const p: P3 = i < 8 ? [noonHit(i)[0], 0.1 * ((i % 3) - 1), noonHit(i)[2] + 0.12] : molecule(i);
          const c = w(p), r = (7 + (i % 3) * 2) * k, dy = bobPx(t, i * 0.37, 5);
          return <g key={i} opacity={Math.min(1, k * 1.4)}><circle cx={c[0]} cy={c[1] + dy} r={r + 2.5} fill={G2} /><circle cx={c[0]} cy={c[1] + dy} r={r} fill={G4} /><circle cx={c[0] - r * 0.3} cy={c[1] + dy - r * 0.3} r={r * 0.35} fill={WHITE} /></g>;
        })}
        {dusk > 0.01 && Array.from({ length: 14 }, (_, i) => { const c = w(duskMol(i)), r = 8 * dusk, dy = bobPx(t, i * 0.41, 5); return <g key={i} opacity={dusk}><circle cx={c[0]} cy={c[1] + dy} r={r + 2.5} fill={G2} /><circle cx={c[0]} cy={c[1] + dy} r={r} fill={G4} /></g>; })}

        {/* blue (and white, first) bouncing off the molecules the beam meets, in all directions */}
        {bounceK > 0.01 && Array.from({ length: 10 }, (_, j) => {
          const k = riseAt(t, j / 10, 1.8), a = j * 2.4 + 0.7, s0 = w(noonHit(j % 8)), reach = 120 + (j % 4) * 28;
          return <circle key={j} cx={s0[0] + Math.cos(a) * reach * k} cy={s0[1] + Math.sin(a) * reach * k} r={9} fill={dropCol} stroke={WHITE} strokeWidth={2.5} opacity={bounceK * Math.sin(Math.PI * k)} />;
        })}
        {/* sunset: the blue is thrown out of the long beam before it arrives */}
        {dusk > 0.01 && Array.from({ length: 12 }, (_, j) => {
          const k = riseAt(t, j / 12, 1.9), f = 0.08 + j * 0.07, s0 = lerp2(sunS, endS, f), a = (j % 2 ? -1 : 1) * (1.2 + (j % 3) * 0.3) - Math.PI / 2;
          return <circle key={j} cx={s0[0] + Math.cos(a) * 110 * k} cy={s0[1] + Math.sin(a) * 110 * k} r={8} fill={ISO.water[0]} stroke={WHITE} strokeWidth={2.5} opacity={dusk * (1 - f) * Math.sin(Math.PI * k)} />;
        })}

        {/* blue from every part of the sky to the eye (and violet, a little) */}
        {toEye > 0.01 && Array.from({ length: 16 }, (_, j) => {
          const k = riseAt(t, j / 16, 2.6), src = w(molecule(j + 8)), x = src[0] + (eyeS[0] - src[0]) * k, y = src[1] + (eyeS[1] - src[1]) * k - 40 * Math.sin(Math.PI * k);
          const isV = j % 3 === 0 && violetK > 0.01;
          return <circle key={j} cx={x} cy={y} r={isV ? 8 : 9} fill={isV ? VIOLET : ISO.water[0]} stroke={WHITE} strokeWidth={2.5} opacity={(isV ? violetK : toEye) * Math.sin(Math.PI * k)} />;
        })}

        {/* the eye on its pedestal (a loose piece): the blue arrives here */}
        {eyeK > 0.01 && <g opacity={eyeK} transform={`translate(${eyeS[0]} ${eyeS[1] + bobPx(t, 0.1, 4)})`}>
          <ellipse cx={0} cy={0} rx={56} ry={38 * blink} fill={WHITE} stroke={BLACK} strokeWidth={6} />
          <circle cx={-10} cy={-4} r={22 * Math.max(0.25, blink)} fill={ISO.water[1]} />
          <circle cx={-10} cy={-4} r={10 * Math.max(0.25, blink)} fill={BLACK} />
          <circle cx={-17} cy={-11} r={5} fill={WHITE} />
        </g>}
        {/* what the eye makes of blue + violet: blue with white */}
        {chipK > 0.01 && (() => { const c: P2 = [eyeS[0], eyeS[1] - 120 + bobPx(t, 0.3, 5)]; return (
          <g opacity={chipK} transform={`translate(${c[0]} ${c[1]}) scale(${0.7 + 0.3 * chipK})`}>
            <path d="M0 -34 A34 34 0 0 0 0 34 Z" fill={ISO.water[0]} /><path d="M0 -34 A34 34 0 0 1 0 34 Z" fill={WHITE} />
            <circle cx={0} cy={0} r={34} fill="none" stroke={BLACK} strokeWidth={5} />
          </g>); })()}

        {/* the waves: a short one for blue, a long one for red */}
        {P.waves(clock) > 0.01 && (() => { const cb = w([-1.4, 0, 1.5]), cr = w([-1.4, 0, 0.7]), ph = -t * 0.9; return (
          <g opacity={P.waves(clock)}>
            <polyline points={wavePts(cb, 190, 11, 30, ph)} fill="none" stroke={WHITE} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={wavePts(cb, 190, 11, 30, ph)} fill="none" stroke={ISO.water[1]} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={wavePts(cr, 190, 11, 95, ph * 0.4)} fill="none" stroke={WHITE} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={wavePts(cr, 190, 11, 95, ph * 0.4)} fill="none" stroke={RED} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          </g>); })()}

        {/* the sun (a sphere seen as a disc) */}
        <g transform={`translate(0 ${bobPx(t, 0.2, 5)})`}><IsoSun cx={sunS[0]} cy={sunS[1]} r={62} phase={t / 6} /></g>
        <polyline points={edge([COL.x0, COL.y1, 0.03], [COL.x1, COL.y1, 0.03])} fill="none" stroke={WHITE} strokeWidth={4} opacity={0.8} />
        <polyline points={ptsAttr([isoAt([COL.x1, COL.y1, 0.03], U, O), isoAt([COL.x1, COL.y0, 0.03], U, O)])} fill="none" stroke={WHITE} strokeWidth={4} opacity={0.8} />
      </g>
      {/* the near layer: loose dust in the light */}
      <g transform={layerTransform(cam, 1.3)}><Motes t={t} color={WHITE} opacity={0.3} n={12} /></g>

      {/* labels on the parts (they follow the camera) */}
      {P.labels.map((l) => {
        if (clock < l.from - 0.05 || clock > l.to + 0.4) return null;
        const p = P.screen(clock, l.at);
        const x = Math.max(300, Math.min(780, p[0])), y = Math.max(420, Math.min(1380, p[1]));
        return <g key={l.id} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={x} y={y} fs={44} t={clock} start={l.from} /></g>;
      })}
    </svg>
  );
};

const Scene = ({ beat, t, clock, story: s }: SceneProps) => (
  <div style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }}>
    <Picture story={s} clock={clock} />
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText kicker={beat.kicker} headline={beat.headline ?? beat.text} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(t, 0), out = 1 - easeInOut(clamp01((t - 0.75) / 0.25));
        return <g>
          <StingMark slug="kenapa-langit-berwarna-biru" t={t} p={p} out={out} />
        </g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
