/* Kenapa laut berwarna biru? — a custom video, one continuous take on a lab bench (the free set kind "lab-bench", set.json): a glass tank of clear water
   under a lamp. The white light splits into colours as it enters, the water absorbs the red first, the blue stays and is scattered back to an eye; a depth
   ruler shows 50 m and 200 m, a beaker of murky water shows why the coast turns green. Shapes checked: a tank is a rectangular glass box, a beaker a
   cylinder with a flat base, white light is a mix of colours in the order red, orange, yellow, green, blue. The camera and every time come from plan.ts. */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, G3, IsoBlock, IsoCloud, IsoLamp, ISO, Label, Mascot, Motes, OnPlane, Pill, Polys, HOT2, RED, THEMES, TopText, WHITE, YELLOW,
  block, bobPx, circlePts, cylinder, flicker, isoAt, layerTransform, ptsAttr, riseAt, springAt, easeInOut, planeYZ, blinkClosed,
  StoryVideo, type P2, type P3, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { BEAKER, CARD, COLOURS, DEPTH, ENDS, LAMP, O, RULER, TANK, U, UNIT_M, makePlan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const W = (p: P3): P2 => isoAt(p, U, O);
const STRIP_X = [-0.9, -0.45, 0, 0.45, 0.9] as const;
const STRIP_FILL = [RED, HOT2, YELLOW, ISO.leaf[1], ISO.water[0]] as const;   // red, orange, yellow, green, blue (light blue so it reads on the water)
const AXX = [1, 0, 0] as const, AYY = [0, 1, 0] as const;
const topOf = (z: number) => ptsAttr([W([TANK.x0, TANK.y0, z]), W([TANK.x1, TANK.y0, z]), W([TANK.x1, TANK.y1, z]), W([TANK.x0, TANK.y1, z])]);

/** The depth shading of the water: bands that get darker the deeper they are (opacity = how much the red is gone), on the two faces that look at the viewer. */
const Shade: React.FC<{ k: number }> = ({ k }) => (
  <g>
    {Array.from({ length: 6 }, (_, j) => {
      const z1 = TANK.water - (j * DEPTH) / 6, z0 = TANK.water - ((j + 1) * DEPTH) / 6, op = k * (0.04 + 0.075 * j);
      return (
        <g key={j} opacity={op}>
          <g transform={`matrix(${0.866 * U} ${0.5 * U} 0 ${-U} ${-0.866 * U * TANK.y1 + O[0]} ${0.5 * U * TANK.y1 + O[1]})`}><rect x={TANK.x0} y={z0} width={TANK.x1 - TANK.x0} height={z1 - z0} fill={ISO.water[2]} /></g>
          <g transform={planeYZ(TANK.x1, U, O)}><rect x={TANK.y0} y={z0} width={TANK.y1 - TANK.y0} height={z1 - z0} fill={ISO.water[2]} /></g>
        </g>
      );
    })}
  </g>
);

const Picture: React.FC<{ story: StoryT; clock: number }> = ({ story: s, clock }) => {
  const P = React.useMemo(() => makePlan(s), [s]);
  const lw = P.loopWeight(clock), t = clock * (1 - lw);                 // the idles settle as the loop comes home: the last frame is the first
  const cam = P.cam(clock);
  const wall = THEMES[s.theme ?? "mint"].wall;
  const bulbBase = W([LAMP.x, LAMP.y, 0]);
  const lampU = U * LAMP.scale;
  const bulb = isoAt([0, 0, 1.46], lampU, bulbBase);
  const hit = W([0, 0, TANK.water]);
  const splitK = clamp01((clock - (P.m.cahaya + 0.9)) / 1.0) * (1 - clamp01((clock - P.m.outro) / 0.6));
  const sc = P.scatter(clock), eyeK = P.toEye(clock), mir = P.mirror(clock), rul = P.ruler(clock), murk = P.murk(clock), shade = P.shade(clock);
  const eye: P2 = [840, 520];
  const eyeFrom = P.screen(clock, [0.6, 0, TANK.water]);
  const lens = (k: number) => 1 - blinkClosed(t, 4.2, k) * 0.9;
  const rippleR = (k: number) => 0.25 + 0.9 * ((t / 3 + k) % 1);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <rect width={1080} height={1920} fill={wall} />
      {/* far layer (parallax 0.3): the brand background behind the bench */}
      <g transform={layerTransform(cam, 0.3)}><g transform="translate(540 960) scale(2.6) translate(-540 -960)"><Brand clock={t} spot={{ x: 540, y: 560 }} /></g></g>
      <g transform={layerTransform(cam, 1)}>
        {/* the bench: a slab that runs past the frame on both sides */}
        <IsoBlock a={[-9, -9, -0.7]} b={[9, 9, 0]} u={U} o={O} tones={ISO.floor} />
        <IsoBlock a={[-9, -9, 0]} b={[9, -8.7, 0.9]} u={U} o={O} tones={ISO.wall} />

        {/* the lamp (reused: the same thing, a lab lamp), its light and the white beam to the water */}
        <IsoLamp u={lampU} o={bulbBase} t={t} on={1} shade={ISO.metal} />
        <g opacity={1}>
          <line x1={bulb[0] + 14} y1={bulb[1] + 12} x2={hit[0]} y2={hit[1]} stroke={YELLOW} strokeWidth={26 * flicker(t, 0.2, 0.08)} strokeLinecap="round" opacity={0.28} />
          <line x1={bulb[0] + 14} y1={bulb[1] + 12} x2={hit[0]} y2={hit[1]} stroke={WHITE} strokeWidth={12} strokeLinecap="round" />
        </g>

        {/* the tank: base, water, glass rim */}
        <IsoBlock a={[TANK.x0 - 0.1, TANK.y0 - 0.1, 0]} b={[TANK.x1 + 0.1, TANK.y1 + 0.1, TANK.base]} u={U} o={O} tones={ISO.metal} />
        <g opacity={0.94}><Polys polys={block([TANK.x0, TANK.y0, TANK.base], [TANK.x1, TANK.y1, TANK.water], U, O)} tones={ISO.water} /></g>
        <Shade k={shade} />
        {/* the surface: ripples that never stop, and the places where the light enters */}
        <polygon points={topOf(TANK.water)} fill="none" stroke={WHITE} strokeWidth={4} strokeLinejoin="round" opacity={0.9} />
        {[0, 0.5].map((k) => <polyline key={k} points={ptsAttr(circlePts(0.2, 0.1, rippleR(k), 36).map(([x, y]) => W([Math.max(TANK.x0 + 0.05, Math.min(TANK.x1 - 0.05, x)), Math.max(TANK.y0 + 0.05, Math.min(TANK.y1 - 0.05, y)), TANK.water])))} fill="none" stroke={WHITE} strokeWidth={3} opacity={0.55 * (1 - ((t / 3 + k) % 1))} />)}
        {/* white light splits at the surface into five colours */}
        {COLOURS.map((c, i) => <line key={c} x1={hit[0]} y1={hit[1]} x2={W([STRIP_X[i], TANK.y1, TANK.water])[0]} y2={W([STRIP_X[i], TANK.y1, TANK.water])[1]} stroke={STRIP_FILL[i]} strokeWidth={9} strokeLinecap="round" opacity={splitK} />)}
        {/* the coloured strips going down the front glass; each colour is absorbed down to its own depth */}
        <OnPlane y={TANK.y1} u={U} o={O}>
          {COLOURS.map((c, i) => {
            const len = P.strip(i, clock);
            if (len < 0.02) return null;
            const fade = i === 0 ? 1 - 0.35 * clamp01((len - ENDS[0]) / 2.4) : 1;
            return <rect key={c} x={STRIP_X[i] - 0.15} y={TANK.water - len} width={0.3} height={len} fill={STRIP_FILL[i]} stroke={WHITE} strokeWidth={0.025} opacity={0.92 * fade * (0.9 + 0.1 * Math.sin(t * 5 + i))} />;
          })}
          {/* blue scattered back: small drops fly sideways and up from the blue strip */}
          {Array.from({ length: 10 }, (_, j) => {
            const k = riseAt(t, j / 10), dir = j % 2 ? 1 : -1, x = STRIP_X[4] + dir * 0.18 + dir * k * 0.9 * (j % 3 === 0 ? 1 : 0.6) - (dir > 0 ? 0 : 1.7) * 0 , z = TANK.water - 3.1 + (j % 5) * 0.55 + k * 0.6;
            return <circle key={j} cx={x} cy={z} r={0.06} fill={ISO.water[0]} stroke={WHITE} strokeWidth={0.02} opacity={sc * Math.sin(Math.PI * k)} />;
          })}
          {/* bubbles that rise in the tank */}
          {Array.from({ length: 5 }, (_, j) => { const k = riseAt(t, j / 5); return <circle key={j} cx={-1.25 + j * 0.12 + 0.05 * Math.sin(t * 2 + j)} cy={TANK.base + 0.2 + k * (DEPTH - 0.4)} r={0.045} fill="none" stroke={WHITE} strokeWidth={0.02} opacity={0.7} />; })}
        </OnPlane>
        {/* the glass: edges and a highlight */}
        <polyline points={ptsAttr([W([TANK.x0, TANK.y1, TANK.base]), W([TANK.x0, TANK.y1, TANK.water])])} fill="none" stroke={WHITE} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
        <polyline points={ptsAttr([W([TANK.x1, TANK.y1, TANK.base]), W([TANK.x1, TANK.y1, TANK.water])])} fill="none" stroke={WHITE} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
        <polyline points={ptsAttr([W([TANK.x0 + 0.12, TANK.y1, 0.6]), W([TANK.x0 + 0.12, TANK.y1, 2.2])])} fill="none" stroke={WHITE} strokeWidth={7} strokeLinecap="round" opacity={0.35} />

        {/* the depth scale beside the tank: marks every 50 m, 0 at the surface */}
        <g opacity={rul} transform={`translate(0 ${(1 - rul) * 30})`}>
          <IsoBlock a={[RULER.x, -0.2, TANK.base]} b={[RULER.x + 0.2, 0.2, TANK.water + 0.15]} u={U} o={O} tones={ISO.plastic} />
          <OnPlane y={0.2} u={U} o={O}>
            {[0, 1, 2, 3, 4].map((j) => <rect key={j} x={RULER.x} y={TANK.water - (j * 50) / UNIT_M - 0.02} width={j % 2 === 0 ? 0.2 : 0.12} height={0.04} fill={BLACK} />)}
          </OnPlane>
        </g>

        {/* the cloud (a sky piece: the sea is not only a mirror of it) and the bounce arrow */}
        {mir > 0.01 && <g opacity={mir}>
          <IsoCloud u={U * 0.5} o={[hit[0] - 150, hit[1] - 330]} cx={0} cy={0} cz={0} phase={t / 6} />
          <polyline points={ptsAttr([[hit[0] - 120, hit[1] - 260], hit, [hit[0] + 150, hit[1] - 250]])} fill="none" stroke={G3} strokeWidth={6} strokeDasharray="14 12" strokeLinecap="round" strokeLinejoin="round" />
        </g>}

        {/* dressing at real scale: a white tile with colour chips (a pool floor), cut by the frame */}
        <IsoBlock a={[CARD.x0, CARD.y0, 0]} b={[CARD.x1, CARD.y1, 0.1]} u={U} o={O} tones={ISO.plastic} />
        {[[CARD.x0 + 0.2, RED], [CARD.x0 + 0.65, YELLOW], [CARD.x0 + 1.1, ISO.water[1]]].map(([x, c], i) => <IsoBlock key={i} a={[x as number, CARD.y0 + 0.3, 0.1]} b={[(x as number) + 0.3, CARD.y0 + 0.65, 0.16]} u={U} o={O} tones={[c as string, c as string, c as string]} />)}

        {/* the beaker: a cylinder with a sand floor; its water turns green and cloudy as sediment stirs */}
        <g>
          <g opacity={0.95}><Polys polys={cylinder([BEAKER.x, BEAKER.y, 0.02], [BEAKER.x, BEAKER.y, BEAKER.h * 0.82], BEAKER.r, BEAKER.r, AXX, AYY, U, O)} tones={ISO.water} /></g>
          <g opacity={murk * 0.85}><Polys polys={cylinder([BEAKER.x, BEAKER.y, 0.02], [BEAKER.x, BEAKER.y, BEAKER.h * 0.82], BEAKER.r, BEAKER.r, AXX, AYY, U, O)} tones={ISO.leaf} /></g>
          <Polys polys={cylinder([BEAKER.x, BEAKER.y, 0.02], [BEAKER.x, BEAKER.y, 0.2], BEAKER.r, BEAKER.r, AXX, AYY, U, O)} tones={ISO.sand} />
          <polyline points={ptsAttr(circlePts(BEAKER.x, BEAKER.y, BEAKER.r, 32).map(([x, y]) => W([x, y, BEAKER.h * 0.82])))} fill="none" stroke={WHITE} strokeWidth={5} opacity={0.9} />
          {Array.from({ length: 9 }, (_, j) => {
            const k = riseAt(t, j / 9, 6), a = j * 2.4 + t * 0.9, r = 0.1 + 0.35 * ((j * 37) % 10) / 10;
            const p = W([BEAKER.x + r * Math.cos(a), BEAKER.y + r * Math.sin(a), 0.25 + k * BEAKER.h * 0.5]);
            return <circle key={j} cx={p[0]} cy={p[1]} r={5 + (j % 3)} fill={ISO.soil[1]} opacity={murk * 0.9 * Math.sin(Math.PI * k)} />;
          })}
        </g>
      </g>
      {/* the near layer: loose dust in the light */}
      <g transform={layerTransform(cam, 1.3)}><Motes t={t} color={WHITE} opacity={0.35} n={14} /></g>

      {/* the eye (a loose piece): the blue that comes back arrives here */}
      {eyeK > 0.01 && <g opacity={eyeK} transform={`translate(${eye[0]} ${eye[1] + bobPx(t, 0.1, 6)})`}>
        <ellipse cx={0} cy={0} rx={96} ry={62 * lens(0)} fill={WHITE} stroke={BLACK} strokeWidth={8} />
        <circle cx={-10} cy={0} r={40 * Math.max(0.2, lens(0))} fill={ISO.water[1]} />
        <circle cx={-10} cy={0} r={18 * Math.max(0.2, lens(0))} fill={BLACK} />
        <circle cx={-24} cy={-14} r={8} fill={WHITE} />
      </g>}
      {eyeK > 0.01 && Array.from({ length: 7 }, (_, j) => {
        const k = riseAt(t, j / 7, 2.4), x = eyeFrom[0] + (eye[0] - 110 - eyeFrom[0]) * k, y = eyeFrom[1] + (eye[1] + 8 - eyeFrom[1]) * k - 90 * Math.sin(Math.PI * k);
        return <circle key={j} cx={x} cy={y} r={11} fill={ISO.water[0]} stroke={WHITE} strokeWidth={3} opacity={eyeK * Math.sin(Math.PI * k)} />;
      })}

      {/* labels on the parts (they follow the camera) */}
      {P.labels.map((l) => {
        if (clock < l.from - 0.05 || clock > l.to + 0.4) return null;
        const p = P.screen(clock, l.at);
        const x = Math.max(300, Math.min(780, p[0])), y = Math.max(420, Math.min(1380, p[1]));
        return <g key={l.id} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={x} y={y} fs={46} t={clock} start={l.from} /></g>;
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
          <g transform={`translate(540 720) scale(${Math.max(0, p) * out}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} squash={0.18 * (1 - p)} /></g>
          <g opacity={out}><Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} /></g>
        </g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
