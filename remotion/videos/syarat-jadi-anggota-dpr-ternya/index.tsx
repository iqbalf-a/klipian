/* Syarat jadi anggota DPR ternyata cuma lulus SMA? — a custom video, look 2d (B28): a flat front view, no iso projection. One continuous take along the notice board
   of a candidate registration office (a new set kind "registration-board-front", set.json): the hero is the SMA diploma pinned in the middle of the board; at one
   scale (plan.ts) the sheet of the election law and an ID card hang to its left, the Paket C diploma to its right; under the board runs the desk where the candidates'
   folders land, and at the desk's left end stands the ballot box. Two tones per part (base and shade), light from the top left, no outlines except the tick marks and
   the signature line. The camera and every time come from plan.ts. */
import React from "react";
import {
  loopClock, BLACK, CaptionLayer, FONT_BOLD, FONT_MONO, G1, G2, G3, G4, ISO, Motes, NumberLabel, SourceChip, THEMES, TipCard, TopText, WHITE, YELLOW,
  StoryVideo, easeInOut, layerTransform, pulse01, springAt, swayDeg, toScreen,
  type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { BOARD, BOX, CLOCK, DESK_Y, FOLDERS, IJAZAH, KTP, LAW, PAKET, WINDOW, makePlan } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const SKY = THEMES.sky;
const WOOD = ISO.soil, FELT = ISO.wall;
const mono = { fontFamily: FONT_MONO, fontWeight: 500 } as const;
const bold = { fontFamily: FONT_BOLD, fontWeight: 700 } as const;

/** The set: the wall with its stripes, a window and a clock high on it, the notice board, the desk. Everything bleeds past the frame. */
const Office: React.FC<{ clock: number }> = ({ clock }) => {
  const sec = 6 * (Math.floor(clock) + Math.min(1, (clock % 1) / 0.15));
  return (
    <g>
      <rect x={-5200} y={-3800} width={10400} height={DESK_Y + 3800} fill={SKY.wall} />
      {Array.from({ length: 42 }, (_, i) => <rect key={i} x={-5100 + i * 240} y={-3800} width={8} height={DESK_Y + 3800} fill={SKY.ring} opacity={0.6} />)}
      {/* the window, high on the left */}
      <rect x={WINDOW.x0 - 24} y={WINDOW.y0 - 24} width={WINDOW.w + 48} height={WINDOW.h + 48} rx={10} fill={WHITE} />
      <rect x={WINDOW.x0 - 24} y={WINDOW.y0 + WINDOW.h + 4} width={WINDOW.w + 48} height={20} rx={8} fill={G4} />
      <rect x={WINDOW.x0} y={WINDOW.y0} width={WINDOW.w} height={WINDOW.h} fill={SKY.ring} />
      <polygon points={`${WINDOW.x0 + 40},${WINDOW.y0 + WINDOW.h} ${WINDOW.x0 + 200},${WINDOW.y0} ${WINDOW.x0 + 280},${WINDOW.y0} ${WINDOW.x0 + 120},${WINDOW.y0 + WINDOW.h}`} fill={WHITE} opacity={0.25 + 0.2 * pulse01(clock, 0, 4)} />
      <rect x={WINDOW.x0 + WINDOW.w / 2 - 9} y={WINDOW.y0} width={18} height={WINDOW.h} fill={WHITE} />
      <rect x={WINDOW.x0} y={WINDOW.y0 + WINDOW.h / 2 - 9} width={WINDOW.w} height={18} fill={WHITE} />
      {/* the wall clock: the second hand ticks */}
      <circle cx={CLOCK.x} cy={CLOCK.y} r={CLOCK.r} fill={G1} /><circle cx={CLOCK.x} cy={CLOCK.y} r={CLOCK.r - 20} fill={WHITE} />
      <circle cx={CLOCK.x + 14} cy={CLOCK.y + 14} r={CLOCK.r - 44} fill={G4} opacity={0.5} />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={CLOCK.x - 4} y={CLOCK.y - CLOCK.r + 30} width={8} height={i % 3 === 0 ? 26 : 14} fill={G3} transform={`rotate(${i * 30} ${CLOCK.x} ${CLOCK.y})`} />)}
      <rect x={CLOCK.x - 6} y={CLOCK.y - 70} width={12} height={78} rx={6} fill={G1} transform={`rotate(-58 ${CLOCK.x} ${CLOCK.y})`} />
      <rect x={CLOCK.x - 5} y={CLOCK.y - 100} width={10} height={108} rx={5} fill={G1} transform={`rotate(52 ${CLOCK.x} ${CLOCK.y})`} />
      <rect x={CLOCK.x - 2.5} y={CLOCK.y - 108} width={5} height={130} rx={2} fill={G2} transform={`rotate(${sec} ${CLOCK.x} ${CLOCK.y})`} />
      <circle cx={CLOCK.x} cy={CLOCK.y} r={11} fill={G1} />
      {/* the notice board: a wooden frame, a felt face, the frame's shade on the felt */}
      <rect x={BOARD.x0 - 30} y={BOARD.y0 - 30} width={BOARD.x1 - BOARD.x0 + 60} height={BOARD.y1 - BOARD.y0 + 60} rx={16} fill={WOOD[1]} />
      <rect x={BOARD.x0 - 30} y={BOARD.y1 + 10} width={BOARD.x1 - BOARD.x0 + 60} height={20} rx={10} fill={WOOD[2]} />
      <rect x={BOARD.x0} y={BOARD.y0} width={BOARD.x1 - BOARD.x0} height={BOARD.y1 - BOARD.y0} fill={FELT[1]} />
      <rect x={BOARD.x0} y={BOARD.y0} width={BOARD.x1 - BOARD.x0} height={16} fill={FELT[2]} />
      <rect x={BOARD.x0} y={BOARD.y0} width={12} height={BOARD.y1 - BOARD.y0} fill={FELT[2]} />
      {Array.from({ length: 13 }, (_, i) => <circle key={i} cx={BOARD.x0 + 90 + i * 200} cy={BOARD.y1 - 36} r={7} fill={FELT[2]} />)}
      {/* the desk: a top slab, a front with panels */}
      <rect x={-5200} y={DESK_Y + 46} width={10400} height={2600} fill={WOOD[1]} />
      {Array.from({ length: 14 }, (_, i) => <rect key={i} x={-4700 + i * 700} y={DESK_Y + 120} width={600} height={2400} rx={12} fill={WOOD[2]} opacity={0.45} />)}
      <rect x={-5200} y={DESK_Y} width={10400} height={46} fill={WOOD[0]} />
      <rect x={-5200} y={DESK_Y + 34} width={10400} height={12} fill={WOOD[2]} />
    </g>
  );
};

const Pins: React.FC<{ w: number }> = ({ w }) => <g>{[22, w - 22].map((x) => <g key={x}><circle cx={x} cy={22} r={11} fill={G2} /><circle cx={x - 3} cy={19} r={4} fill={G4} /></g>)}</g>;

/** A diploma: a landscape sheet with a border, an emblem at the top centre, a photo at the lower left, the signature and the seal at the lower right. */
const Diploma: React.FC<{ at: { x0: number; y0: number; w: number; h: number }; band: readonly [string, string, string]; kind: string; clock: number; phase: number; shine: number }> = ({ at, band, kind, clock, phase, shine }) => (
  <g transform={`translate(${at.x0 + at.w / 2} ${at.y0}) rotate(${swayDeg(clock, phase, 0.4, 3)}) translate(${-at.w / 2} 0)`}>
    <rect width={at.w} height={at.h} rx={8} fill={WHITE} /><rect y={at.h - 14} width={at.w} height={14} rx={7} fill={G4} />
    <rect x={26} y={44} width={at.w - 52} height={8} fill={band[1]} /><rect x={26} y={at.h - 42} width={at.w - 52} height={8} fill={band[2]} />
    <rect x={26} y={44} width={8} height={at.h - 78} fill={band[1]} /><rect x={at.w - 34} y={44} width={8} height={at.h - 78} fill={band[2]} />
    <circle cx={at.w / 2} cy={104} r={34} fill={band[1]} /><circle cx={at.w / 2 - 5} cy={99} r={20} fill={band[0]} />
    <text x={at.w / 2} y={196} fontSize={50} fill={G1} textAnchor="middle" style={bold}>IJAZAH</text>
    <text x={at.w / 2} y={238} fontSize={26} fill={band[2]} textAnchor="middle" style={mono}>{kind}</text>
    {[0, 1, 2, 3].map((i) => <rect key={i} x={230} y={274 + i * 34} width={[390, 340, 370, 250][i]} height={12} rx={6} fill={G3} />)}
    <rect x={70} y={290} width={96} height={128} rx={6} fill={G3} /><circle cx={118} cy={338} r={24} fill={G2} /><rect x={86} y={368} width={64} height={50} rx={22} fill={G2} />
    <circle cx={500} cy={418} r={44} fill={band[1]} opacity={0.3 + 0.35 * shine} /><circle cx={500} cy={418} r={28} fill={WHITE} opacity={0.55} />
    <path d="M 470 428 q 18 -36 34 -4 q 14 26 30 -10 q 12 -22 26 6 q 10 16 34 -6" fill="none" stroke={G1} strokeWidth={5} strokeLinecap="round" />
    <Pins w={at.w} />
  </g>
);

/** The sheet of the election law: its heading and the list of requirements a to h; `n` rows are ticked, `mark` (0..1) is the highlighter over the education row. */
const LawSheet: React.FC<{ clock: number; t: number; since: number; n: number; a: number; mark: number }> = ({ clock, t, since, n, a, mark }) => (
  <g transform={`translate(${LAW.x0 + LAW.w / 2} ${LAW.y0}) rotate(${swayDeg(clock, 0.1, 0.4, 4)}) translate(${-LAW.w / 2} 0)`}>
    <rect width={LAW.w} height={LAW.h} rx={8} fill={WHITE} /><rect y={LAW.h - 14} width={LAW.w} height={14} rx={7} fill={G4} />
    <text x={40} y={84} fontSize={24} fill={G2} style={mono}>UNDANG-UNDANG PEMILU</text>
    <text x={40} y={148} fontSize={58} fill={G1} style={bold}>Pasal 240</text>
    <rect x={40} y={176} width={LAW.w - 80} height={8} fill={ISO.stone[1]} />
    {Array.from({ length: LAW.rows }, (_, i) => {
      const y = LAW.rowY - LAW.y0 + i * LAW.pitch, key = i === LAW.key, p = i < n ? springAt(t, since + i * 0.32) : 0;
      return (
        <g key={i}>
          {key && <rect x={78} y={y - 12} width={(LAW.w - 150) * mark} height={40} rx={8} fill={YELLOW} opacity={0.9} />}
          <text x={40} y={y + 22} fontSize={28} fill={G2} style={mono}>{"abcdefgh"[i]}</text>
          {key ? <text x={88} y={y + 20} fontSize={23} fill={G1} style={mono}>paling rendah tamat SMA</text>
            : <rect x={88} y={y + 4} width={[300, 250, 320, 270, 0, 290, 240, 310][i]} height={14} rx={7} fill={G3} />}
          <g transform={`translate(${LAW.w - 52} ${y + 12}) scale(${p})`} opacity={a}>
            <path d="M -14 0 l 10 11 l 20 -24" fill="none" stroke={G1} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      );
    })}
    <Pins w={LAW.w} />
  </g>
);

/** The ID card: a header, text lines on the left, the photo on the right. */
const IdCard: React.FC<{ clock: number }> = ({ clock }) => (
  <g transform={`translate(${KTP.x0} ${KTP.y0})`}>
    <rect width={KTP.w} height={KTP.h} rx={10} fill={ISO.plastic[0]} /><rect y={KTP.h - 10} width={KTP.w} height={10} rx={5} fill={ISO.plastic[2]} />
    <rect width={KTP.w} height={28} rx={10} fill={ISO.stone[1]} /><rect y={18} width={KTP.w} height={10} fill={ISO.stone[1]} />
    <text x={12} y={20} fontSize={11} fill={WHITE} style={mono}>KARTU TANDA PENDUDUK</text>
    {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={14} y={42 + i * 14} width={[104, 84, 96, 70, 90][i]} height={6} rx={3} fill={G3} />)}
    <rect x={140} y={38} width={48} height={62} rx={4} fill={G3} /><circle cx={164} cy={60} r={11} fill={G2} /><rect x={148} y={74} width={32} height={26} rx={11} fill={G2} />
    <polygon points="20,127 60,0 84,0 44,127" fill={WHITE} opacity={0.12 + 0.3 * pulse01(clock, 1, 3)} />
    <rect x={KTP.w / 2 - 16} y={-14} width={32} height={30} rx={6} fill={G2} /><rect x={KTP.w / 2 - 9} y={-8} width={18} height={14} rx={4} fill={G4} />
  </g>
);

/** The candidates' folders that land on the desk under the Paket C diploma (the side view of a pile), and the stamp that comes down on it. */
const Folders: React.FC<{ n: number; a: number; t: number; since: number; press: number }> = ({ n, a, t, since, press }) => {
  const top = DESK_Y - n * FOLDERS.h;
  return (
    <g opacity={a}>
      {Array.from({ length: n }, (_, i) => {
        const p = springAt(t, since + i * 0.4), y = DESK_Y - (i + 1) * FOLDERS.h;
        return (
          <g key={i} transform={`translate(${(i % 2) * 14} ${-(1 - p) * 160})`} opacity={clamp01(p * 3)}>
            <rect x={FOLDERS.x0} y={y} width={FOLDERS.w} height={FOLDERS.h - 3} rx={6} fill={ISO.stone[0]} /><rect x={FOLDERS.x0} y={y + FOLDERS.h - 12} width={FOLDERS.w} height={9} rx={4} fill={ISO.stone[2]} />
            <rect x={FOLDERS.x0 + FOLDERS.w - 150} y={y + 7} width={110} height={10} rx={5} fill={WHITE} />
          </g>
        );
      })}
      {press > 0.001 && (
        <g transform={`translate(${FOLDERS.x0 + FOLDERS.w - 90} ${top - 190 * (1 - press)})`} opacity={clamp01(press * 4)}>
          <rect x={-70} y={-34} width={140} height={34} rx={8} fill={G1} /><rect x={-70} y={-12} width={140} height={12} rx={6} fill={G2} />
          <rect x={-22} y={-120} width={44} height={90} rx={12} fill={WOOD[1]} /><rect x={6} y={-120} width={16} height={90} rx={8} fill={WOOD[2]} />
          <circle cx={0} cy={-136} r={38} fill={WOOD[1]} /><circle cx={-10} cy={-146} r={16} fill={WOOD[0]} />
        </g>
      )}
    </g>
  );
};

/** The ballot box: an upright white box with the slot in its lid, a clear window in its front and a seal that swings; `drop` (0..1, -1 for none) is a ballot falling in. */
const BallotBox: React.FC<{ clock: number; drop: number }> = ({ clock, drop }) => {
  const w = BOX.x1 - BOX.x0, cx = (BOX.x0 + BOX.x1) / 2;
  return (
    <g>
      {drop >= 0 && (
        <g clipPath="url(#slot)">
          <g transform={`translate(${cx} ${BOX.y0 - 230 + drop * 360}) rotate(${(1 - drop) * 9}) scale(0.6)`} opacity={clamp01(drop * 6)}>
            <rect x={-130} y={-170} width={260} height={340} rx={8} fill={WHITE} /><rect x={-130} y={-4} width={260} height={8} fill={G4} />
            {[0, 1, 2].map((i) => <rect key={i} x={-90} y={-130 + i * 34} width={[180, 140, 160][i]} height={12} rx={6} fill={G3} />)}
          </g>
        </g>
      )}
      <rect x={BOX.x0} y={BOX.y0 + 130} width={w} height={BOX.y1 - BOX.y0 - 130} fill={ISO.plastic[1]} />
      <rect x={BOX.x1 - 96} y={BOX.y0 + 130} width={96} height={BOX.y1 - BOX.y0 - 130} fill={ISO.plastic[2]} />
      <rect x={BOX.x0 - 22} y={BOX.y0} width={w + 44} height={130} rx={12} fill={ISO.plastic[0]} /><rect x={BOX.x0 - 22} y={BOX.y0 + 108} width={w + 44} height={22} rx={10} fill={ISO.plastic[2]} />
      <rect x={cx - 190} y={BOX.y0} width={380} height={26} rx={10} fill={G1} />
      <text x={cx - 20} y={BOX.y0 + 300} fontSize={72} fill={G2} textAnchor="middle" style={mono}>KOTAK SUARA</text>
      <rect x={BOX.x0 + 130} y={BOX.y0 + 400} width={w - 300} height={760} rx={14} fill={G3} />
      <rect x={BOX.x0 + 150} y={BOX.y0 + 420} width={w - 340} height={720} rx={8} fill={SKY.ring} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={BOX.x0 + 190 + i * 120} y={BOX.y0 + 960 + (i % 2) * 40} width={230} height={150} rx={6} fill={WHITE} transform={`rotate(${[-8, 6, -4, 9][i]} ${BOX.x0 + 300 + i * 120} ${BOX.y0 + 1040})`} />)}
      <polygon points={`${BOX.x0 + 190},${BOX.y0 + 1140} ${BOX.x0 + 420},${BOX.y0 + 420} ${BOX.x0 + 520},${BOX.y0 + 420} ${BOX.x0 + 290},${BOX.y0 + 1140}`} fill={WHITE} opacity={0.2 + 0.2 * pulse01(clock, 0, 3)} />
      <g transform={`translate(${BOX.x1 - 150} ${BOX.y0 + 130}) rotate(${swayDeg(clock, 0.2, 5, 2.5)})`}>
        <rect x={-5} y={0} width={10} height={70} fill={G2} /><rect x={-34} y={64} width={68} height={92} rx={10} fill={G1} /><rect x={-20} y={84} width={40} height={10} rx={5} fill={G3} />
      </g>
    </g>
  );
};

const Picture: React.FC<{ story: StoryT; clock: number }> = ({ story: s, clock }) => {
  const P = makePlan(s), m = P.m;
  const amb = loopClock(clock, P.total);                         // B29: the ambient motion runs on the loop clock
  const cam = P.cam(clock);
  const tk = P.ticks(clock), fo = P.folders(clock);
  const gone = (at: number) => 1 - easeInOut(clamp01((clock - at) / 0.35));
  const press = clamp01(1 - Math.abs(clock - m.serang - 5.65) / 0.45);
  const badge = springAt(clock, m.sma + 4.6) * gone(m.outro);
  const equal = springAt(clock, m.paketc + 1.7) * gone(m.paketc + 4.2);
  const fakta = springAt(clock, m.fakta + 1.7) * gone(m.umur - 0.3);
  const shine = (a: number) => clamp01(1 - Math.abs(clock - a) / 0.5);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <defs><clipPath id="slot"><rect x={BOX.x0 - 200} y={-4000} width={BOX.x1 - BOX.x0 + 400} height={4000 + BOX.y0 + 14} /></clipPath></defs>
      <g transform={layerTransform(cam, 1)}>
        <Office clock={amb} />
        <LawSheet clock={amb} t={clock} since={m.aturan + 1.9} n={tk.n} a={tk.a} mark={P.mark(clock)} />
        <IdCard clock={amb} />
        <Diploma at={PAKET} band={ISO.leaf} kind="PAKET C" clock={amb} phase={0.3} shine={shine(m.paketc + 7.0)} />
        <Diploma at={IJAZAH} band={ISO.stone} kind="SEKOLAH MENENGAH ATAS" clock={amb} phase={0} shine={Math.max(shine(2.7), shine(m.fakta + 5.6), shine(m.sma + 5.6))} />
        {/* the tick badge on the diploma, the equals sign between the two diplomas, the verdict stamp under the diploma */}
        <g transform={`translate(${IJAZAH.x0 + IJAZAH.w - 36} ${IJAZAH.y0 + 36}) scale(${badge})`}>
          <circle r={56} fill={YELLOW} /><path d="M -24 2 l 17 19 l 32 -40" fill="none" stroke={BLACK} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g transform={`translate(${(IJAZAH.x0 + IJAZAH.w + PAKET.x0) / 2} ${IJAZAH.y0 + IJAZAH.h / 2}) scale(${equal})`}>
          <circle r={64} fill={YELLOW} /><rect x={-30} y={-22} width={60} height={14} rx={7} fill={BLACK} /><rect x={-30} y={8} width={60} height={14} rx={7} fill={BLACK} />
        </g>
        <g transform={`translate(540 1225) rotate(-5) scale(${fakta})`}>
          <rect x={-190} y={-62} width={380} height={124} rx={22} fill={YELLOW} /><text x={0} y={30} fontSize={86} fill={BLACK} textAnchor="middle" style={bold}>FAKTA</text>
        </g>
        <Folders n={fo.n} a={fo.a} t={clock} since={m.serang + 1.6} press={press} />
        <BallotBox clock={amb} drop={P.drop(clock)} />
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
      <SourceChip x={540} y={600} text="UU 7/2017 Pasal 240" t={clock} start={m.fakta + 4.4} end={m.umur - 0.2} align="middle" />
      {/* the two conditions over the set */}
      {[{ n: 1, title: "Kader partai politik", at: 3.1 }, { n: 2, title: "Dipilih lewat pemilu", at: 4.9 }].map((c) => (
        <TipCard key={c.n} x={110} y={c.n === 1 ? 1150 : 1310} w={810} n={c.n} title={c.title} t={clock} start={m.tips + c.at} end={m.outro} />
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
        return <g><StingMark slug="syarat-jadi-anggota-dpr-ternya" t={t} p={p} out={out} /></g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
