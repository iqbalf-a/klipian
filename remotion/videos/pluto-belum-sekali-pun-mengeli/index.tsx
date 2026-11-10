/* Pluto belum sekali pun mengelilingi Matahari sejak ditemukan — a custom video, look 2d (B28): a flat front view, no iso projection. One continuous take on the wall of a
   lecture hall (a new set kind "orbit-chart-hall", set.json): the hero is a big orbit chart with the Sun at a focus, Pluto's long ellipse, Neptune's ring and a year ruler at its foot;
   the dressing is a framed pair of telescope plates (a dot jumps between them: the blink comparison that found Pluto), a small telescope and a potted plant.
   Shapes checked (Wikipedia: Pluto; Live Science): Pluto's orbit is an ellipse (eccentricity 0.2488) with the Sun at a focus, its closest point lies inside Neptune's ring.
   Two tones per part (base and shade), light from the top left, no outlines except the chart's orbit lines. The camera and every time come from plan.ts. */
import React from "react";
import {
  loopClock, CaptionLayer, G1, G2, G3, ISO, Label, Motes, THEMES, TipCard, TopText, WHITE, YELLOW,
  StoryVideo, easeInOut, layerTransform, pulse01, springAt, swayDeg, toScreen,
  type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { BOARD, DISC_YEAR, END_YEAR, FLOOR_Y, FOCUS, NEP_R, RULER, INSIDE, arcPoints, makePlan, neptuneAt, plutoAt, rulerX } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const MINT = THEMES.mint;
const WOOD = ISO.sand;
const hash = (i: number) => { const x = Math.sin(i * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
const pts = (p: readonly (readonly [number, number])[]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");

/** The set: wall, wainscot, floor, the chart's frame and face, a tray, the dressing. Everything bleeds past the frame. */
const Hall: React.FC<{ clock: number }> = ({ clock }) => {
  const { x0, x1, y0, y1 } = BOARD;
  const stars = Array.from({ length: 34 }, (_, i) => ({ x: x0 + 30 + hash(i) * (x1 - x0 - 60), y: y0 + 30 + hash(i + 50) * (y1 - y0 - 150), r: 2 + hash(i + 9) * 2.6 }));
  return (
    <g>
      <rect x={-3600} y={-3800} width={8200} height={FLOOR_Y + 3800} fill={MINT.wall} />
      {Array.from({ length: 30 }, (_, i) => <rect key={i} x={-3300 + i * 240} y={-3800} width={8} height={FLOOR_Y + 3800} fill={MINT.ring} opacity={0.5} />)}
      <rect x={-3600} y={FLOOR_Y - 260} width={8200} height={260} fill={MINT.ring} />
      <rect x={-3600} y={FLOOR_Y - 270} width={8200} height={14} fill={MINT.floorEdge} />
      <rect x={-3600} y={FLOOR_Y} width={8200} height={2200} fill={MINT.floor} />
      <rect x={-3600} y={FLOOR_Y} width={8200} height={16} fill={MINT.floorEdge} />
      {Array.from({ length: 40 }, (_, i) => <rect key={i} x={-2400 + i * 260} y={FLOOR_Y + 90} width={8} height={2200} fill={MINT.floorEdge} opacity={0.55} />)}
      {/* the chart: a wooden frame, a near-black face, a lighter glare band, stars, a tray */}
      <rect x={x0 - 34} y={y0 - 34} width={x1 - x0 + 68} height={y1 - y0 + 68} rx={22} fill={WOOD[1]} />
      <polygon points={pts([[x0 - 34, y1 + 34 - 22], [x1 + 34, y1 + 34 - 22], [x1 + 34, y1 + 34], [x0 - 34, y1 + 34]])} fill={WOOD[2]} />
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={10} fill={G1} />
      <polygon points={pts([[x0 + 80, y0], [x0 + 220, y0], [x0 + 20, y1], [x0, y1], [x0, y0 + 160]])} fill={G2} opacity={0.35} />
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r * (0.75 + 0.5 * pulse01(clock, hash(i) * 3, 2 + hash(i + 3) * 2))} fill={WHITE} opacity={0.7} />)}
      <rect x={x0 - 60} y={y1 + 34} width={x1 - x0 + 120} height={26} rx={8} fill={WOOD[0]} />
      <rect x={x0 - 60} y={y1 + 54} width={x1 - x0 + 120} height={12} rx={6} fill={WOOD[2]} />
      {[0, 1, 2].map((i) => <rect key={i} x={x0 + 120 + i * 270} y={y1 + 18} width={70 - i * 10} height={12} rx={6} fill={i === 1 ? G3 : WHITE} />)}
    </g>
  );
};

/** The framed pair of plates: two photographs of the same stars; one dot jumps between them (the blink comparison). */
const Plates: React.FC<{ clock: number }> = ({ clock }) => {
  const jump = Math.floor(clock * 1.6) % 2;
  return (
    <g transform="translate(-380 700)">
      <rect x={0} y={0} width={330} height={250} rx={12} fill={WOOD[1]} />
      <polygon points={pts([[0, 232], [330, 232], [330, 250], [0, 250]])} fill={WOOD[2]} />
      {[0, 1].map((k) => (
        <g key={k} transform={`translate(${16 + k * 150} 20)`}>
          <rect width={136} height={190} fill={G1} />
          <rect width={42} height={190} fill={G2} opacity={0.3} />
          {[[20, 30], [90, 50], [50, 110], [105, 150], [24, 160], [70, 28]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.4 + (i % 3)} fill={WHITE} opacity={0.85} />)}
          <circle cx={k === 0 ? 76 : 98} cy={k === 0 ? 96 : 90} r={7} fill={WOOD[0]} opacity={jump === k || k === 1 ? 1 : 0.9} />
        </g>
      ))}
      <path d="M 166 120 L 176 112 L 176 128 Z" fill={WHITE} opacity={0.85 + 0.15 * Math.sin(clock * 6)} />
    </g>
  );
};

/** A small telescope on a tripod, front view: a tube, a mount, three legs. */
const Telescope: React.FC<{ clock: number }> = ({ clock }) => (
  <g transform={`translate(1230 ${FLOOR_Y})`}>
    <polygon points="0,-300 14,-300 80,0 62,0" fill={G2} /><polygon points="-14,-300 0,-300 -62,0 -80,0" fill={G3} /><polygon points="-5,-300 5,-300 8,0 -8,0" fill={G2} />
    <rect x={-34} y={-320} width={68} height={34} rx={10} fill={G2} />
    <g transform={`translate(0 -318) rotate(${-34 + swayDeg(clock, 0, 1.2, 5)})`}>
      <rect x={-40} y={-230} width={80} height={230} rx={12} fill={ISO.metal[1]} />
      <rect x={6} y={-230} width={34} height={230} rx={12} fill={ISO.metal[2]} />
      <rect x={-46} y={-250} width={92} height={36} rx={10} fill={ISO.metal[0]} />
      <ellipse cx={0} cy={-250} rx={36} ry={9} fill={ISO.water[1]} />
      <rect x={-12} y={-30} width={24} height={50} rx={8} fill={G1} />
    </g>
  </g>
);

const Plant: React.FC<{ clock: number }> = ({ clock }) => (
  <g transform={`translate(-520 ${FLOOR_Y})`}>
    <polygon points="0,0 -10,-150 150,-150 140,0" fill={MINT.floorEdge} /><polygon points="100,0 100,-150 150,-150 140,0" fill={ISO.soil[2]} />
    <g transform={`translate(70 -150) rotate(${swayDeg(clock, 0.1, 3.5, 4.2)})`}>
      <path d="M 0 0 C -60 -50 -80 -150 -50 -230 C -10 -170 10 -80 0 0 Z" fill={ISO.leaf[1]} />
      <path d="M 0 0 C 50 -60 90 -120 110 -190 C 50 -170 10 -90 0 0 Z" fill={ISO.leaf[0]} />
      <path d="M 0 0 C 10 -90 30 -170 20 -260 C -10 -190 -14 -90 0 0 Z" fill={ISO.leaf[2]} />
    </g>
  </g>
);

/** One little planet: a disc in two tones. */
const Ball: React.FC<{ x: number; y: number; r: number; tone: readonly [string, string, string] }> = ({ x, y, r, tone }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={tone[1]} />
    <circle cx={x + r * 0.28} cy={y + r * 0.28} r={r * 0.72} fill={tone[2]} opacity={0.7} />
    <circle cx={x - r * 0.28} cy={y - r * 0.28} r={r * 0.5} fill={tone[0]} />
  </g>
);

const Picture: React.FC<{ story: StoryT; clock: number; t: number; beatId: string }> = ({ story: s, clock }) => {
  const amb = loopClock(clock, s.beats.reduce((a, b) => a + b.dur, 0));   // B29: the ambient motion runs on the loop clock
  const P = makePlan(s), m = P.m;
  const cam = P.cam(clock);
  const yr = P.year(clock), tr = P.trail(clock);
  const pl = plutoAt(yr), nep = neptuneAt(yr);
  const full = arcPoints(DISC_YEAR, END_YEAR, 120);
  const inside = arcPoints(INSIDE[0], INSIDE[1], 40);
  const lit = clock >= m.neptunus + 0.8 && clock < m.tips;
  const hookPulse = clock < m.temu + 4 ? pulse01(clock, 0, 1.2) : 0;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <g transform={layerTransform(cam, 1)}>
        <Hall clock={amb} />
        <Plates clock={amb} />
        <Telescope clock={amb} />
        <Plant clock={amb} />
        {/* Neptune's ring, centred on the Sun */}
        <circle cx={FOCUS.x} cy={FOCUS.y} r={NEP_R} fill="none" stroke={ISO.water[0]} strokeWidth={4} strokeDasharray="14 12" opacity={0.85} />
        {/* Pluto's whole orbit: a faint dashed ellipse (it is an ellipse, the Sun is at a focus, not at its centre) */}
        <polyline points={full} fill="none" stroke={WHITE} strokeWidth={4} strokeDasharray="6 14" strokeLinecap="round" opacity={0.5} />
        {/* the swept part of the orbit */}
        {tr.a > 0.02 && tr.to > tr.from + 0.05 && <polyline points={arcPoints(tr.from, tr.to, Math.max(6, Math.round((tr.to - tr.from) / 2)))} fill="none" stroke={YELLOW} strokeWidth={10} strokeLinecap="round" opacity={tr.a} />}
        {lit && <polyline points={inside} fill="none" stroke={ISO.water[0]} strokeWidth={14} strokeLinecap="round" opacity={0.35 + 0.25 * pulse01(clock, 0, 1.4)} />}
        {/* the Sun at the focus */}
        <circle cx={FOCUS.x} cy={FOCUS.y} r={54 + 5 * pulse01(clock, 0, 2.4)} fill={ISO.sun[1]} opacity={0.28} />
        <Ball x={FOCUS.x} y={FOCUS.y} r={34} tone={ISO.sun} />
        {/* Neptune and Pluto */}
        <Ball x={nep[0]} y={nep[1]} r={17} tone={ISO.water} />
        {hookPulse > 0 && <circle cx={pl[0]} cy={pl[1]} r={34 + 14 * hookPulse} fill="none" stroke={WHITE} strokeWidth={5} opacity={0.8 - 0.5 * hookPulse} />}
        <Ball x={pl[0]} y={pl[1]} r={20} tone={ISO.sand} />
        {/* the year ruler at the foot of the chart: 1930 to 2178, a half-way tick, the year now */}
        <g>
          <rect x={RULER.x0 - 8} y={RULER.y - 5} width={RULER.x1 - RULER.x0 + 16} height={10} rx={5} fill={G3} />
          {Array.from({ length: 11 }, (_, i) => <rect key={i} x={RULER.x0 + ((RULER.x1 - RULER.x0) * i) / 10 - 3} y={RULER.y - (i % 5 === 0 ? 26 : 16)} width={6} height={i % 5 === 0 ? 26 : 16} fill={G3} />)}
          <rect x={RULER.x0 - 8} y={RULER.y - 5} width={Math.max(0, rulerX(yr) - RULER.x0 + 8)} height={10} rx={5} fill={YELLOW} opacity={yr > DISC_YEAR + 0.1 ? 1 : 0} />
          <g transform={`translate(${rulerX(yr)} ${RULER.y + 14})`}><polygon points="0,0 -16,26 16,26" fill={YELLOW} /><polygon points="0,0 16,26 4,26" fill={ISO.sun[2]} opacity={0.7} /></g>
          {clock >= m.jalan + 5.0 && clock < m.neptunus && <rect x={rulerX(DISC_YEAR + 123.97) - 4} y={RULER.y - 40} width={8} height={40} fill={WHITE} />}
        </g>
      </g>
      {/* the near layer: dust that drifts up, it touches nothing */}
      <g transform={layerTransform(cam, 1.25)}>
        <Motes t={amb} color={WHITE} opacity={0.3} n={10} />
      </g>
      {/* labels on the parts (they follow the camera, kept inside the safe frame) */}
      {P.labels.map((l) => {
        if (clock < l.from - 0.05 || clock > l.to + 0.4) return null;
        const p = toScreen(cam, l.at);
        const x = Math.max(260, Math.min(820, p[0])), y = Math.max(420, Math.min(1380, p[1]));
        return <g key={l.id} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={x} y={y} fs={l.fs} color="white" onDark t={clock} start={l.from} /></g>;
      })}
      {/* the tips over the set */}
      {[{ n: 1, title: "Setahun Pluto: ±248 tahun Bumi", at: 1.6 }, { n: 2, title: "Putaran pertama selesai: 2178", at: 5.0 }].map((c) => (
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
          <StingMark slug="pluto-belum-sekali-pun-mengeli" t={t} p={p} out={out} />
        </g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
