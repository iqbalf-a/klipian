/* Kalau wakil presiden mundur, siapa penggantinya menurut UUD? — a custom video, look 2d (B28): a flat front view, no iso projection. One continuous take in a
   state hall (a new set kind "state-hall-front", set.json): the hero is the pair of high-backed chairs on the dais, the vice president's empty and marked with a
   card; around it stand a wall calendar of 60 days, a table with a ballot box and two envelopes, and a long table with the constitution on a stand, a checklist
   and a balance scale. No people and no faces: the rule is told with things. Two tones per part (base and shade), light from the top left, no outlines except the
   ticks of the checklist. The camera and every time come from plan.ts. */
import React from "react";
import {
  loopClock, CaptionLayer, FONT_MONO, G1, G2, G3, G4, ISO, Motes, NumberLabel, THEMES, TipCard, TopText, WHITE,
  StoryVideo, easeInOut, layerTransform, pulse01, springAt, swayDeg, toScreen,
  type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { BOOK, BOX, CAL, CHAIR, DAIS, ENV, FLOOR_Y, LIST, PLAQUE, SCALE, TABLE, TABLE2, makePlan } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const CREAM = THEMES.cream;
const WOOD = ISO.soil, CLOTH = ISO.stone, COVER = ISO.leaf, METAL = ISO.metal;
const mono = { fontFamily: FONT_MONO, fontWeight: 500 } as const;

/** A table seen from the front: a top slab, a front with panels, a darker end. */
const Table: React.FC<{ x0: number; x1: number; y: number; panels: number }> = ({ x0, x1, y, panels }) => {
  const pw = (x1 - x0 - 60) / panels;
  return (
    <g>
      <rect x={x0} y={y + 36} width={x1 - x0} height={FLOOR_Y - y - 36} fill={WOOD[1]} />
      <rect x={x1 - 40} y={y + 36} width={40} height={FLOOR_Y - y - 36} fill={WOOD[2]} />
      {Array.from({ length: panels }, (_, i) => <rect key={i} x={x0 + 40 + i * pw} y={y + 80} width={pw - 30} height={FLOOR_Y - y - 130} rx={10} fill={WOOD[2]} opacity={0.45} />)}
      <rect x={x0 - 20} y={y} width={x1 - x0 + 40} height={36} rx={8} fill={WOOD[0]} />
      <rect x={x0 - 20} y={y + 25} width={x1 - x0 + 40} height={11} rx={5} fill={WOOD[2]} />
    </g>
  );
};

/** The set: the wall with its tall panels, the floor, the dais, two hanging lamps that sway a little. Everything bleeds past the frame. */
const Hall: React.FC<{ clock: number }> = ({ clock }) => (
  <g>
    <rect x={-4200} y={-3800} width={10400} height={FLOOR_Y + 3800} fill={CREAM.wall} />
    {Array.from({ length: 30 }, (_, i) => <rect key={i} x={-4100 + i * 340} y={-3800} width={10} height={FLOOR_Y + 3800} fill={CREAM.ring} opacity={0.6} />)}
    <rect x={-4200} y={FLOOR_Y - 90} width={10400} height={90} fill={CREAM.ring} />
    <rect x={-4200} y={FLOOR_Y} width={10400} height={2600} fill={CREAM.floor} />
    <rect x={-4200} y={FLOOR_Y} width={10400} height={16} fill={CREAM.floorEdge} />
    {Array.from({ length: 40 }, (_, i) => <rect key={i} x={-4000 + i * 260} y={FLOOR_Y + 110} width={8} height={2600} fill={CREAM.floorEdge} opacity={0.5} />)}
    {/* the dais: a low step with a carpet strip */}
    <rect x={DAIS.x0} y={DAIS.y} width={DAIS.x1 - DAIS.x0} height={FLOOR_Y - DAIS.y} fill={WOOD[1]} />
    <rect x={DAIS.x0} y={DAIS.y} width={DAIS.x1 - DAIS.x0} height={18} fill={WOOD[0]} />
    <rect x={DAIS.x1 - 40} y={DAIS.y + 18} width={40} height={FLOOR_Y - DAIS.y - 18} fill={WOOD[2]} />
    <rect x={DAIS.x0 + 120} y={DAIS.y} width={DAIS.x1 - DAIS.x0 - 240} height={18} fill={CLOTH[1]} />
    {/* two hanging lamps */}
    {[360, 720].map((x, i) => (
      <g key={i} transform={`translate(${x} -3800) rotate(${swayDeg(clock, i * 0.5, 0.5, 5)})`}>
        <rect x={-3} y={0} width={6} height={3890} fill={G3} />
        <polygon points="-70,3950 70,3950 40,3885 -40,3885" fill={METAL[1]} /><polygon points="10,3950 70,3950 40,3885 20,3885" fill={METAL[2]} />
        <ellipse cx={0} cy={3952} rx={56} ry={12} fill={WHITE} opacity={0.55 + 0.3 * pulse01(clock, i * 0.5, 2.5)} />
      </g>
    ))}
  </g>
);

/** A high-backed chair seen from the front: a tall back with a cushion, a seat, two armrests, two legs. `card` (0..1) stands a "KOSONG" card on the seat. */
const Chair: React.FC<{ x: number; label: string; card?: number; mark?: number }> = ({ x, label, card = 0, mark = 0 }) => {
  const y0 = DAIS.y - CHAIR.h, w = CHAIR.w;
  return (
    <g>
      {/* the plaque on the wall above the chair */}
      <rect x={x + w / 2 - PLAQUE.w / 2} y={PLAQUE.y} width={PLAQUE.w} height={PLAQUE.h} rx={10} fill={G1} />
      <rect x={x + w / 2 - PLAQUE.w / 2} y={PLAQUE.y + PLAQUE.h - 12} width={PLAQUE.w} height={12} rx={6} fill={G2} />
      <text x={x + w / 2} y={PLAQUE.y + 44} fontSize={label.length > 10 ? 24 : 28} fill={WHITE} textAnchor="middle" style={mono}>{label}</text>
      {mark > 0 && <rect x={x - 26} y={y0 - 26} width={w + 52} height={CHAIR.h + 26} rx={40} fill={WHITE} opacity={0.5 * mark} />}
      <g transform={`translate(${x} ${y0})`}>
        <rect x={0} y={0} width={w} height={390} rx={36} fill={WOOD[1]} /><rect x={w - 44} y={20} width={44} height={370} rx={22} fill={WOOD[2]} />
        <rect x={34} y={34} width={w - 68} height={300} rx={22} fill={CLOTH[1]} /><rect x={34} y={34} width={w - 68} height={26} rx={13} fill={CLOTH[0]} />
        <rect x={w - 80} y={60} width={46} height={274} rx={20} fill={CLOTH[2]} opacity={0.6} />
        {/* the armrests */}
        <rect x={-22} y={300} width={50} height={110} rx={18} fill={WOOD[0]} /><rect x={w - 28} y={300} width={50} height={110} rx={18} fill={WOOD[2]} />
        {/* the seat */}
        <rect x={10} y={376} width={w - 20} height={64} rx={22} fill={CLOTH[0]} /><rect x={10} y={416} width={w - 20} height={24} rx={12} fill={CLOTH[2]} />
        <rect x={0} y={436} width={w} height={40} rx={10} fill={WOOD[1]} />
        <rect x={12} y={476} width={34} height={84} fill={WOOD[2]} /><rect x={w - 46} y={476} width={34} height={84} fill={WOOD[2]} />
        {/* the card on the empty seat: a folded tent card */}
        {card > 0.001 && (
          <g transform={`translate(${w / 2} 378) scale(${card})`}>
            <polygon points="-78,0 78,0 68,-74 -68,-74" fill={WHITE} /><polygon points="-78,0 78,0 74,-12 -74,-12" fill={G4} />
            <text x={0} y={-30} fontSize={30} fill={G1} textAnchor="middle" style={mono}>KOSONG</text>
          </g>
        )}
      </g>
    </g>
  );
};

/** The wall calendar of 60 days: a sheet with a header band and 60 cells; `n` of them are crossed. */
const Calendar: React.FC<{ clock: number; n: number }> = ({ clock, n }) => (
  <g transform={`translate(${CAL.x0} ${CAL.y0})`}>
    <rect x={CAL.w / 2 - 8} y={-44} width={16} height={50} fill={G2} />
    <rect width={CAL.w} height={CAL.h} rx={12} fill={WHITE} /><rect y={CAL.h - 18} width={CAL.w} height={18} rx={9} fill={G4} />
    <rect width={CAL.w} height={90} rx={12} fill={CLOTH[1]} /><rect y={72} width={CAL.w} height={18} fill={CLOTH[2]} />
    <text x={CAL.w / 2} y={52} fontSize={34} fill={WHITE} textAnchor="middle" style={mono}>60 HARI</text>
    {Array.from({ length: CAL.cols * CAL.rows }, (_, i) => {
      const x = 24 + (i % CAL.cols) * 36, y = 112 + Math.floor(i / CAL.cols) * 62, on = i < n;
      return <rect key={i} x={x} y={y} width={28} height={46} rx={6} fill={on ? G2 : G4} />;
    })}
    <g transform={`translate(${CAL.w} ${CAL.h}) rotate(${swayDeg(clock, 0.4, 3, 6)})`}><polygon points="0,0 -50,0 0,-50" fill={G3} /></g>
  </g>
);

/** The ballot box on its table (a box with a slot in the lid) and the two envelopes of the two candidates; the chosen one flies into the slot. */
const Ballot: React.FC<{ a: number[]; fly: number; hop: number }> = ({ a, fly, hop }) => (
  <g>
    <Table x0={TABLE.x0} x1={TABLE.x1} y={TABLE.y} panels={2} />
    <g transform={`translate(0 ${-10 * hop})`}>
      <rect x={BOX.x0} y={BOX.y0} width={BOX.w} height={BOX.h} rx={12} fill={METAL[1]} />
      <rect x={BOX.x0 + BOX.w - 46} y={BOX.y0} width={46} height={BOX.h} rx={12} fill={METAL[2]} />
      <rect x={BOX.x0 - 10} y={BOX.y0 - 6} width={BOX.w + 20} height={34} rx={10} fill={METAL[2]} />
      <rect x={BOX.x0 + 40} y={BOX.y0 + 4} width={BOX.w - 80} height={12} rx={6} fill={G1} />
      <rect x={BOX.x0 + 60} y={BOX.y0 + 90} width={80} height={56} rx={8} fill={WHITE} opacity={0.85} />
      <rect x={BOX.x0 + 74} y={BOX.y0 + 106} width={52} height={7} fill={G3} /><rect x={BOX.x0 + 74} y={BOX.y0 + 122} width={36} height={7} fill={G3} />
    </g>
    {ENV.xs.map((x, i) => {
      if (a[i] <= 0.001) return null;
      const chosen = i === 1, f = chosen ? fly : 0;                 // the second envelope is the one that goes in (which one says nothing: they are two blank candidates)
      const tx = x + f * (BOX.x0 + BOX.w / 2 - ENV.w / 2 - x), ty = ENV.y0 + f * (BOX.y0 - 70 - ENV.y0) - 150 * Math.sin(Math.PI * f) + (f > 0.92 ? (f - 0.92) * 900 : 0);
      return (
        <g key={i} transform={`translate(${tx + ENV.w / 2} ${ty + ENV.h}) scale(${a[i] * (1 - 0.35 * f)}) rotate(${(i ? 4 : -4) * (1 - f)})`} opacity={f > 0.92 ? clamp01(1 - (f - 0.92) * 12.5) : 1}>
          <rect x={-ENV.w / 2} y={-ENV.h} width={ENV.w} height={ENV.h} rx={8} fill={WHITE} />
          <polygon points={`${-ENV.w / 2},${-ENV.h} ${ENV.w / 2},${-ENV.h} 0,${-ENV.h + 40}`} fill={G4} />
          <rect x={-ENV.w / 2} y={-12} width={ENV.w} height={12} rx={6} fill={G4} />
          <text x={0} y={-16} fontSize={32} fill={G1} textAnchor="middle" style={mono}>{i + 1}</text>
        </g>
      );
    })}
  </g>
);

/** The constitution on its stand, the checklist beside it (three lines, three ticks) and a stack of law books under the list. */
const Books: React.FC<{ ticks: number[] }> = ({ ticks }) => (
  <g>
    <rect x={BOOK.x0 + 60} y={BOOK.y0 + BOOK.h - 6} width={50} height={TABLE2.y - BOOK.y0 - BOOK.h + 6} fill={WOOD[2]} />
    <rect x={BOOK.x0 - 16} y={BOOK.y0 + BOOK.h - 14} width={BOOK.w + 32} height={16} rx={8} fill={WOOD[0]} />
    <rect x={BOOK.x0} y={BOOK.y0} width={BOOK.w} height={BOOK.h} rx={10} fill={COVER[1]} />
    <rect x={BOOK.x0} y={BOOK.y0} width={26} height={BOOK.h} rx={10} fill={COVER[2]} />
    <rect x={BOOK.x0 + BOOK.w - 10} y={BOOK.y0 + 8} width={10} height={BOOK.h - 16} fill={WHITE} />
    <rect x={BOOK.x0 + 44} y={BOOK.y0 + 40} width={BOOK.w - 70} height={90} rx={8} fill={COVER[0]} />
    <text x={BOOK.x0 + BOOK.w / 2 + 10} y={BOOK.y0 + 82} fontSize={30} fill={WHITE} textAnchor="middle" style={mono}>UUD</text>
    <text x={BOOK.x0 + BOOK.w / 2 + 10} y={BOOK.y0 + 116} fontSize={26} fill={WHITE} textAnchor="middle" style={mono}>1945</text>
    {/* the stack of law books */}
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x={LIST.x0 - 10 + i * 8} y={TABLE2.y - 34 * (i + 1)} width={190 - i * 14} height={32} rx={6} fill={i === 1 ? CLOTH[1] : WOOD[1]} />
        <rect x={LIST.x0 - 10 + i * 8} y={TABLE2.y - 34 * (i + 1) + 22} width={190 - i * 14} height={10} rx={5} fill={i === 1 ? CLOTH[2] : WOOD[2]} />
      </g>
    ))}
    {/* the checklist: a sheet that leans on the stack */}
    <rect x={LIST.x0} y={LIST.y0} width={LIST.w} height={LIST.h} rx={10} fill={WHITE} /><rect x={LIST.x0} y={LIST.y0 + LIST.h - 12} width={LIST.w} height={12} rx={6} fill={G4} />
    {ticks.map((p, i) => {
      const y = LIST.y0 + 44 + i * 54;
      return (
        <g key={i}>
          <rect x={LIST.x0 + 62} y={y - 8} width={88} height={8} rx={4} fill={G3} /><rect x={LIST.x0 + 62} y={y + 8} width={58} height={8} rx={4} fill={G4} />
          <circle cx={LIST.x0 + 32} cy={y + 4} r={17} fill={G4} />
          {p > 0.001 && <g transform={`translate(${LIST.x0 + 32} ${y + 4}) scale(${p})`}><circle r={17} fill={G1} /><path d="M -8 0 L -2 7 L 9 -7" fill="none" stroke={WHITE} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /></g>}
        </g>
      );
    })}
  </g>
);

/** The balance scale: a post on a base, a beam on a pivot (`deg` degrees), two pans that hang level under the beam ends. */
const Scale: React.FC<{ deg: number }> = ({ deg }) => {
  const r = (deg * Math.PI) / 180, ends = [-1, 1].map((s) => [SCALE.x + s * SCALE.beam * Math.cos(r), SCALE.top + s * SCALE.beam * Math.sin(r)]);
  return (
    <g>
      <rect x={SCALE.x - 90} y={TABLE2.y - 26} width={180} height={26} rx={10} fill={METAL[1]} /><rect x={SCALE.x + 30} y={TABLE2.y - 26} width={60} height={26} rx={10} fill={METAL[2]} />
      <rect x={SCALE.x - 12} y={SCALE.top} width={24} height={TABLE2.y - SCALE.top - 20} fill={METAL[1]} /><rect x={SCALE.x + 2} y={SCALE.top} width={10} height={TABLE2.y - SCALE.top - 20} fill={METAL[2]} />
      {ends.map(([x, y], i) => (
        <g key={i}>
          <polygon points={`${x - 3},${y} ${x + 3},${y} ${x - 58},${y + SCALE.drop} ${x - 64},${y + SCALE.drop}`} fill={G3} />
          <polygon points={`${x - 3},${y} ${x + 3},${y} ${x + 64},${y + SCALE.drop} ${x + 58},${y + SCALE.drop}`} fill={G3} />
          <path d={`M ${x - 76} ${y + SCALE.drop} Q ${x} ${y + SCALE.drop + 64} ${x + 76} ${y + SCALE.drop} Z`} fill={METAL[1]} />
          <rect x={x - 80} y={y + SCALE.drop - 8} width={160} height={12} rx={6} fill={METAL[2]} />
        </g>
      ))}
      <g transform={`translate(${SCALE.x} ${SCALE.top}) rotate(${deg})`}><rect x={-SCALE.beam - 10} y={-9} width={SCALE.beam * 2 + 20} height={18} rx={9} fill={METAL[0]} /><rect x={-SCALE.beam - 10} y={2} width={SCALE.beam * 2 + 20} height={7} rx={3} fill={METAL[2]} /></g>
      <circle cx={SCALE.x} cy={SCALE.top} r={20} fill={G1} /><circle cx={SCALE.x - 5} cy={SCALE.top - 5} r={7} fill={G3} />
    </g>
  );
};

const Picture: React.FC<{ story: StoryT; clock: number }> = ({ story: s, clock }) => {
  const P = makePlan(s), m = P.m;
  const amb = loopClock(clock, P.total);                         // B29: the ambient motion runs on the loop clock
  const cam = P.cam(clock);
  const env = P.envelopes(clock);
  const hop = clamp01(1 - Math.abs(clock - m.dua - 5.85) / 0.25);
  const mark = pulse01(amb, 0, 2.5) * P.card(clock);             // the empty chair glows softly while its card stands
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <g transform={layerTransform(cam, 1)}>
        <Hall clock={amb} />
        <Calendar clock={amb} n={P.days(clock)} />
        <Chair x={CHAIR.pres} label="PRESIDEN" />
        <Chair x={CHAIR.vp} label="WAKIL PRESIDEN" card={P.card(clock)} mark={mark} />
        <Ballot a={env.a} fly={env.fly} hop={hop} />
        <Table x0={TABLE2.x0} x1={TABLE2.x1} y={TABLE2.y} panels={4} />
        <Books ticks={P.ticks(clock)} />
        <Scale deg={P.tilt(clock) + swayDeg(amb, 0.1, 0.6, 2.5)} />
      </g>
      {/* the near layer: dust that drifts up, it touches nothing */}
      <g transform={layerTransform(cam, 1.25)}>
        <Motes t={amb} color={WHITE} opacity={0.35} n={12} />
      </g>
      {/* the pill labels: a leader from the object to a pill inside the safe frame; a counter rolls up to its number */}
      {P.tags.map((g) => {
        if (clock < g.from - 0.05 || clock > g.to + 0.4) return null;
        const a = toScreen(cam, g.at);
        const text = g.count ? `${Math.round(g.count.to * P.roll(g, clock))} ${g.count.unit}` : g.text;
        return <NumberLabel key={g.id} text={text} x={g.box[0]} y={g.box[1]} ax={Math.max(40, Math.min(1040, a[0]))} ay={Math.max(340, Math.min(1440, a[1]))} fs={g.fs} t={clock} start={g.from} end={g.to} />;
      })}
      {/* the recap over the set */}
      {[{ n: 1, title: "Paling lambat 60 hari", at: 1.2 }, { n: 2, title: "2 calon, MPR pilih 1", at: 2.6 }].map((c) => (
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
        return <g><StingMark slug="kalau-wakil-presiden-mundur-ap" t={t} p={p} out={out} /></g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
