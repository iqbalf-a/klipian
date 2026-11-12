/* Rp14,69 miliar itu sebanyak apa? — a custom video, look 2d (B28): a flat front view, no iso projection. One continuous take in a general store (a new set kind
   "general-store-front", set.json): the hero is the pile of money on the counter (147 bricks of Rp100 juta, 6 wide and 5 high in front) under a board with the total;
   the things it is compared with stand around it at one scale (plan.ts): a shelf of phones, a scooter cut by the frame, jerrycans of petrol, a wall calendar, and
   twelve pay envelopes that land on the counter. Two tones per part (base and shade), light from the top left, no outlines except the fender arc of the scooter and
   the pressed X of the jerrycan. The camera and every time come from plan.ts. */
import React from "react";
import {
  loopClock, CaptionLayer, FONT_MONO, G1, G2, G3, G4, ISO, Motes, NumberLabel, THEMES, TipCard, TopText, WHITE,
  StoryVideo, easeInOut, layerTransform, pulse01, springAt, swayDeg, toScreen,
  type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { BOARD, BRICK, CAL, CANS, COUNT, COUNTER, ENV, FLOOR_Y, K, PILE, SCOOTER, SHELF, makePlan } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const CREAM = THEMES.cream;
const WOOD = ISO.soil, NOTE = ISO.leaf, CAN = ISO.stone, BODY = ISO.stone;
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const mono = { fontFamily: FONT_MONO, fontWeight: 500 } as const;

/** The set: the wall with its stripes, the floor, the counter. Everything bleeds past the frame. */
const Store: React.FC = () => (
  <g>
    <rect x={-4200} y={-3800} width={9400} height={FLOOR_Y + 3800} fill={CREAM.wall} />
    {Array.from({ length: 38 }, (_, i) => <rect key={i} x={-4100 + i * 240} y={-3800} width={8} height={FLOOR_Y + 3800} fill={CREAM.ring} opacity={0.6} />)}
    <rect x={-4200} y={FLOOR_Y - 70} width={9400} height={70} fill={CREAM.ring} />
    <rect x={-4200} y={FLOOR_Y} width={9400} height={2600} fill={CREAM.floor} />
    <rect x={-4200} y={FLOOR_Y} width={9400} height={16} fill={CREAM.floorEdge} />
    {Array.from({ length: 36 }, (_, i) => <rect key={i} x={-4000 + i * 260} y={FLOOR_Y + 110} width={8} height={2600} fill={CREAM.floorEdge} opacity={0.5} />)}
    {/* the counter: a top slab, a front with panels, a darker end */}
    <rect x={COUNTER.x0} y={COUNTER.y + 40} width={COUNTER.x1 - COUNTER.x0} height={FLOOR_Y - COUNTER.y - 40} fill={WOOD[1]} />
    <rect x={COUNTER.x1 - 46} y={COUNTER.y + 40} width={46} height={FLOOR_Y - COUNTER.y - 40} fill={WOOD[2]} />
    {[0, 1, 2].map((i) => <rect key={i} x={COUNTER.x0 + 50 + i * 330} y={COUNTER.y + 90} width={280} height={FLOOR_Y - COUNTER.y - 150} rx={10} fill={WOOD[2]} opacity={0.45} />)}
    <rect x={COUNTER.x0 - 24} y={COUNTER.y} width={COUNTER.x1 - COUNTER.x0 + 48} height={40} rx={8} fill={WOOD[0]} />
    <rect x={COUNTER.x0 - 24} y={COUNTER.y + 28} width={COUNTER.x1 - COUNTER.x0 + 48} height={12} rx={6} fill={WOOD[2]} />
  </g>
);

/** The board over the pile: a wooden frame, a dark face, the total in mono. */
const Board: React.FC<{ clock: number; shine: number }> = ({ clock, shine }) => (
  <g>
    <rect x={BOARD.x0 - 20} y={BOARD.y0 - 20} width={BOARD.x1 - BOARD.x0 + 40} height={BOARD.y1 - BOARD.y0 + 40} rx={18} fill={WOOD[1]} />
    <rect x={BOARD.x0 - 20} y={BOARD.y1 + 4} width={BOARD.x1 - BOARD.x0 + 40} height={16} rx={8} fill={WOOD[2]} />
    <rect x={BOARD.x0} y={BOARD.y0} width={BOARD.x1 - BOARD.x0} height={BOARD.y1 - BOARD.y0} rx={8} fill={G1} />
    <rect x={BOARD.x0} y={BOARD.y0} width={90} height={BOARD.y1 - BOARD.y0} rx={8} fill={G2} opacity={0.3 + 0.25 * shine} />
    <text x={BOARD.x0 + 36} y={BOARD.y0 + 52} fontSize={30} fill={G3} style={mono}>TOTAL</text>
    <circle cx={BOARD.x1 - 44} cy={BOARD.y0 + 42} r={9} fill={WHITE} opacity={0.35 + 0.65 * pulse01(clock, 0, 1.2)} />
    <text x={(BOARD.x0 + BOARD.x1) / 2} y={BOARD.y1 - 38} fontSize={66} fill={WHITE} textAnchor="middle" style={mono}>Rp14.696.955.002</text>
  </g>
);

/** The hero: the pile of money. Each brick is 1000 notes with a paper band; one loose note lies on top. `tags` is how far each of the 8 paper slips has landed. */
const Pile: React.FC<{ clock: number; tags: number[] }> = ({ clock, tags }) => (
  <g>
    {Array.from({ length: BRICK.rows * BRICK.cols }, (_, k) => {
      const c = k % BRICK.cols, r = Math.floor(k / BRICK.cols), x = PILE.x0 + c * BRICK.w, y = PILE.y0 + r * BRICK.h;
      return (
        <g key={k}>
          <rect x={x + 2} y={y + 2} width={BRICK.w - 4} height={BRICK.h - 4} rx={5} fill={NOTE[1]} />
          <rect x={x + 2} y={y + 2} width={BRICK.w - 4} height={12} rx={5} fill={NOTE[0]} />
          <rect x={x + 2} y={y + BRICK.h - 18} width={BRICK.w - 4} height={16} rx={5} fill={NOTE[2]} />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={x + 8} y={y + 22 + i * 10} width={BRICK.w - 16} height={2.5} fill={NOTE[2]} opacity={0.5} />)}
          <rect x={x + BRICK.w / 2 - 17} y={y + 2} width={34} height={BRICK.h - 4} fill={WHITE} />
          <rect x={x + BRICK.w / 2 + 7} y={y + 2} width={10} height={BRICK.h - 4} fill={G4} />
        </g>
      );
    })}
    {/* the loose note on top: it lifts a little in the air of the store */}
    <g transform={`translate(${PILE.x1 - 118} ${PILE.y0}) rotate(${-7 + swayDeg(clock, 0.2, 2.5, 3)}) scale(${K})`}>
      <polygon points="0,0 150,-8 150,-20 0,-12" fill={NOTE[0]} /><polygon points="0,0 150,-8 150,-3 0,5" fill={NOTE[2]} />
    </g>
    {/* the 8 slips of the 8 packages, on the top two rows */}
    {tags.map((p, i) => {
      if (p <= 0.001) return null;
      const x = PILE.x0 + ((i % 4) + 1) * BRICK.w + 86, y = PILE.y0 + Math.floor(i / 4) * BRICK.h + 26;
      return (
        <g key={i} transform={`translate(${x} ${y}) scale(${p * K}) rotate(${i % 2 ? 5 : -5})`}>
          <rect x={-26} y={-22} width={52} height={62} rx={6} fill={WHITE} /><rect x={-26} y={28} width={52} height={12} rx={6} fill={G4} />
          <rect x={-16} y={-10} width={32} height={5} fill={G3} /><rect x={-16} y={2} width={32} height={5} fill={G3} /><rect x={-16} y={14} width={20} height={5} fill={G3} />
        </g>
      );
    })}
  </g>
);

/** The shelf of phones: three boards that run past the frame, phones standing front-on; `lit` (0..1) lights their screens in a wave. */
const Phones: React.FC<{ clock: number; lit: number }> = ({ clock, lit }) => {
  const cols = Math.floor((SHELF.x1 - SHELF.x0 - 30) / SHELF.step), ph = SHELF.h * K;
  return (
    <g>
      {SHELF.rows.map((y, r) => (
        <g key={r}>
          <rect x={SHELF.x0 - 20} y={y + ph} width={SHELF.x1 - SHELF.x0 + 20} height={16} fill={WOOD[0]} />
          <rect x={SHELF.x0 - 20} y={y + ph + 16} width={SHELF.x1 - SHELF.x0 + 20} height={10} fill={WOOD[2]} />
          {Array.from({ length: cols }, (_, i) => {
            const px = SHELF.x0 + 30 + i * SHELF.step, x = 0, order = (i * 3 + r) / (cols * 3), on = clamp01((lit - order) * 12);
            const glint = pulse01(clock, (i * 0.37 + r * 0.9) % 3, 3);
            return (
              <g key={i} transform={`translate(${px} ${y}) scale(${K})`}>
                <rect x={x} y={0} width={SHELF.w} height={SHELF.h} rx={14} fill={G1} />
                <rect x={x + 6} y={6} width={SHELF.w - 12} height={SHELF.h - 12} rx={9} fill={G2} />
                <rect x={x + 6} y={6} width={SHELF.w - 12} height={SHELF.h - 12} rx={9} fill={G4} opacity={on} />
                <rect x={x + 14} y={26} width={SHELF.w - 28} height={8} rx={4} fill={G3} opacity={on} />
                <rect x={x + 14} y={42} width={SHELF.w - 44} height={8} rx={4} fill={G3} opacity={on} />
                <rect x={x + SHELF.w / 2 - 12} y={11} width={24} height={8} rx={4} fill={G1} />
                <polygon points={`${x + 10},${60} ${x + 30},${60} ${x + 16},${SHELF.h - 10} ${x + 8},${SHELF.h - 10}`} fill={WHITE} opacity={0.1 + 0.22 * glint} />
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
};

/** The jerrycans on the floor, right of the counter: a flat-sided can, a pressed X, a cap and a handle. */
const Cans: React.FC<{ hop: number }> = ({ hop }) => (
  <g>
    {CANS.xs.map((x, i) => {
      const top = -CANS.h, lift = i === 1 ? -14 * hop : 0;
      return (
        <g key={i} transform={`translate(${x} ${FLOOR_Y + lift}) scale(${K})`}>
          <rect x={150} y={top - 46} width={130} height={16} rx={8} fill={CAN[2]} />
          {[0, 1].map((k) => <rect key={k} x={150 + k * 114} y={top - 46} width={16} height={50} fill={CAN[2]} />)}
          <rect x={36} y={top - 44} width={72} height={50} rx={10} fill={G1} />
          <rect x={0} y={top} width={CANS.w} height={CANS.h} rx={30} fill={CAN[1]} />
          <rect x={CANS.w - 70} y={top} width={70} height={CANS.h} rx={30} fill={CAN[2]} />
          <rect x={0} y={top} width={CANS.w} height={26} rx={13} fill={CAN[0]} />
          <line x1={60} y1={top + 90} x2={CANS.w - 100} y2={top + CANS.h - 80} stroke={CAN[0]} strokeWidth={16} strokeLinecap="round" />
          <line x1={CANS.w - 100} y1={top + 90} x2={60} y2={top + CANS.h - 80} stroke={CAN[0]} strokeWidth={16} strokeLinecap="round" />
        </g>
      );
    })}
  </g>
);

const Wheel: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
  <g>
    <circle cx={cx} cy={cy} r={SCOOTER.r} fill={G1} /><circle cx={cx} cy={cy} r={150} fill={ISO.metal[1]} />
    <circle cx={cx + 40} cy={cy + 40} r={96} fill={ISO.metal[2]} opacity={0.6} /><circle cx={cx} cy={cy} r={46} fill={G2} />
  </g>
);

/** The scooter, side view, facing right, parked left of the counter: the front wheel and the leg shield show in the wide shot, the rest is cut by the frame. */
const Scooter: React.FC<{ clock: number; flash: number }> = ({ clock, flash }) => {
  const wy = FLOOR_Y - SCOOTER.r, f = SCOOTER.front, r = SCOOTER.rear;
  return (
    <g transform={`translate(${SCOOTER.at} ${FLOOR_Y}) scale(${K}) translate(${-f} ${-FLOOR_Y})`}>
      <Wheel cx={r} cy={wy} /><Wheel cx={f} cy={wy} />
      <polygon points={`${f - 200},700 ${f - 150},700 ${f + 25},${wy} ${f - 25},${wy}`} fill={ISO.metal[2]} />
      <path d={`M ${f - 265.6} ${wy - 71.2} A 275 275 0 0 1 ${f + 238.2} ${wy - 137.5}`} fill="none" stroke={BODY[1]} strokeWidth={46} strokeLinecap="round" />
      <polygon points={`${r - 280},1010 ${f - 760},1000 ${f - 630},1330 ${r + 380},1400 ${r - 180},1250`} fill={BODY[1]} />
      <polygon points={`${r - 180},1250 ${f - 630},1330 ${r + 380},1400`} fill={BODY[2]} />
      <rect x={r - 240} y={900} width={890} height={110} rx={50} fill={ISO.dark[1]} /><rect x={r - 220} y={980} width={850} height={30} rx={15} fill={G1} />
      <rect x={f - 760} y={1330} width={420} height={70} rx={20} fill={BODY[2]} />
      <polygon points={`${f - 380},1400 ${f - 280},1400 ${f - 140},640 ${f - 260},640`} fill={BODY[1]} />
      <polygon points={`${f - 320},1400 ${f - 280},1400 ${f - 140},640 ${f - 180},640`} fill={BODY[2]} />
      <polygon points={`${f - 300},520 ${f - 100},560 ${f - 80},700 ${f - 280},700`} fill={BODY[0]} />
      <ellipse cx={f - 112} cy={636} rx={34} ry={52} fill={G4} />
      <ellipse cx={f - 112} cy={636} rx={34 + 30 * flash} ry={52 + 30 * flash} fill={WHITE} opacity={Math.min(1, 0.35 + 0.3 * pulse01(clock, 0, 2) + 0.3 * flash)} />
      <rect x={f - 400} y={540} width={150} height={36} rx={18} fill={G1} />
      <rect x={f - 250} y={500} width={14} height={60} fill={G2} /><ellipse cx={f - 262} cy={500} rx={52} ry={32} fill={ISO.dark[1]} /><ellipse cx={f - 254} cy={496} rx={36} ry={20} fill={G3} />
    </g>
  );
};

/** The wall calendar: a sheet with a header band and a month grid; in the hari beat the top sheet flips again and again. */
const Calendar: React.FC<{ clock: number; flip: number }> = ({ clock, flip }) => {
  const w = CAL.w, h = CAL.h;
  return (
    <g transform={`translate(${CAL.x0} ${CAL.y0}) scale(${K})`}>
      <rect x={w / 2 - 8} y={-40} width={16} height={46} fill={G2} />
      <rect width={w} height={h} rx={10} fill={WHITE} /><rect y={h - 16} width={w} height={16} rx={8} fill={G4} />
      <rect width={w} height={76} rx={10} fill={ISO.stone[1]} /><rect y={60} width={w} height={16} fill={ISO.stone[2]} />
      {Array.from({ length: 35 }, (_, i) => <rect key={i} x={22 + (i % 7) * 32} y={104 + Math.floor(i / 7) * 48} width={22} height={30} rx={5} fill={i % 7 === 6 ? G3 : G4} />)}
      {flip > 0 && <g transform={`translate(0 76) scale(1 ${1 - flip})`}><rect width={w} height={h - 76} fill={G4} /><rect y={h - 100} width={w} height={24} fill={G3} /></g>}
      <g transform={`translate(${w} ${h}) rotate(${swayDeg(clock, 0.4, 3, 6)})`}><polygon points="0,0 -46,0 0,-46" fill={G3} /></g>
    </g>
  );
};

/** The twelve pay envelopes that land on the counter, left of the pile (the side view of a stack). */
const Envelopes: React.FC<{ n: number; a: number; t: number; since: number }> = ({ n, a, t, since }) => (
  <g opacity={a}>
    {Array.from({ length: n }, (_, i) => {
      const p = springAt(t, since + i * 0.3), y = COUNTER.y - (i + 1) * ENV.h;
      return (
        <g key={i} transform={`translate(${(i % 2) * 8} ${-(1 - p) * 120})`} opacity={clamp01(p * 3)}>
          <rect x={ENV.x0} y={y} width={ENV.w} height={ENV.h - 2} rx={4} fill={WOOD[0]} /><rect x={ENV.x0} y={y + ENV.h - 7} width={ENV.w} height={5} rx={2} fill={WOOD[2]} />
          <rect x={ENV.x0 + ENV.w - 44} y={y + 3} width={30} height={6} rx={3} fill={WHITE} />
        </g>
      );
    })}
  </g>
);

const Picture: React.FC<{ story: StoryT; clock: number }> = ({ story: s, clock }) => {
  const P = makePlan(s), m = P.m;
  const amb = loopClock(clock, P.total);                         // B29: the ambient motion runs on the loop clock
  const cam = P.cam(clock);
  const env = P.envelopes(clock);
  const slips = Array.from({ length: 8 }, (_, i) => springAt(clock, m.asal + 1.8 + i * 0.22) * (1 - easeInOut(clamp01((clock - m.iphone + 0.3) / 0.3))));
  const shine = clock >= m.asal && clock < m.iphone ? pulse01(clock, 0, 1.6) : 0;
  const flash = clamp01(1 - Math.abs(clock - m.motor - 2.9) / 0.35);
  const hop = clamp01(1 - Math.abs(clock - m.bensin - 2.9) / 0.3);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <g transform={layerTransform(cam, 1)}>
        <Store />
        <Calendar clock={amb} flip={P.flip(clock)} />
        <Board clock={amb} shine={shine} />
        <Phones clock={amb} lit={P.lit(clock)} />
        <Cans hop={hop} />
        <Scooter clock={amb} flash={flash} />
        <Pile clock={amb} tags={slips} />
        <Envelopes n={env.n} a={env.a} t={clock} since={m.gaji + 2.2} />
      </g>
      {/* the near layer: dust that drifts up, it touches nothing */}
      <g transform={layerTransform(cam, 1.25)}>
        <Motes t={amb} color={WHITE} opacity={0.35} n={12} />
      </g>
      {/* the pill labels: a leader from the object to a pill inside the safe frame; a counter rolls up to its number */}
      {P.tags.map((g) => {
        if (clock < g.from - 0.05 || clock > g.to + 0.4) return null;
        const a = toScreen(cam, g.at);
        const text = g.count ? `${fmt(g.count.to * P.roll(g, clock))} ${g.count.unit}` : g.text;
        return <NumberLabel key={g.id} text={text} x={g.box[0]} y={g.box[1]} ax={Math.max(40, Math.min(1040, a[0]))} ay={Math.max(340, Math.min(1440, a[1]))} fs={g.fs} t={clock} start={g.from} end={g.to} />;
      })}
      {/* the recap over the set */}
      {[{ n: 1, title: `${COUNT.iphone} iPhone, ${COUNT.motor} motor`, at: 1.7 }, { n: 2, title: `Gaji ${COUNT.orang} orang setahun`, at: 4.0 }].map((c) => (
        <TipCard key={c.n} x={110} y={c.n === 1 ? 1215 : 1385} w={810} n={c.n} title={c.title} t={clock} start={m.tips + c.at} end={m.outro} />
      ))}
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
        return <g><StingMark slug="rp14-69-miliar-itu-sebanyak-ap" t={t} p={p} out={out} /></g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
