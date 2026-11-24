/* Bunyi krek jari: bukan tulang patah — look 2d (B28): a flat view of one index finger over the keys of an upright piano (set kind "piano-fallboard-front", see set.json).
   Real shapes (B27.16): a finger is three bones (proximal, middle, distal phalanx) in three capsules turning about two joints; the middle joint is two bone ends, each with a
   cap of cartilage, held in a capsule of synovial fluid (a blue film). Pulled, the ends let go all at once, the pressure of the fluid falls, the gas dissolved in it
   gathers and opens one cavity at the moment of the crack (Kawchuk 2015: a cavity forms, no bubble collapses). Two tones per part (base and shade, light from the top
   left), no outlines, palette tokens only. The world is one group moved by the camera (plan.ts camAt); labels, the gauge, the tip cards and the hook text are on the
   screen. Ambient motion (the record on the wall, the sway of the finger) runs on the loop clock (B29). The last frame is the first frame (the loop). */
import React from "react";
import {
  loopClock, BLACK, CaptionLayer, FONT_BOLD, G1, G2, G3, G4, Arrow, SAFE, SKIN_A, SKIN_B, RED, StoryVideo, THEMES, TopText, WHITE, YELLOW,
  YELLOW_D, clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { CARDS, CRACK, GATHER, J, LABELS, PRESSURE, PULL, camAt, dipAt, gapAt, pipAt, pressAt, setAt, winAt } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { cairan: "ISI SENDI", tarik: "DITARIK", rongga: "JAWABANNYA", tips: "FAKTA" };
const CR = THEMES.cream;
const FLUID = THEMES.sky.ring, FLUID_D = THEMES.sky.floorEdge;   // the film of synovial fluid and the cartilage caps
const WIN = { rx: 175, ry: 120 };

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const outBack = (u: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
/** A world point on the screen at the camera c. */
const toScreen = (c: { x: number; y: number; z: number }, x: number, y: number): [number, number] => [W / 2 + (x - c.x) * c.z, H / 2 + (y - c.y) * c.z];

/* ---------- the set: wall, a record on the wall, a sheet on the stand, the dark fallboard, the keys, the keyslip, the pedals, the floor ---------- */
const FLOOR_Y = 2090;
const KEY_W = 129;                                         // a white key is 2.35 cm wide at 55 px a cm
const Staff: React.FC<{ y0: number }> = ({ y0 }) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={-340} y={y0 + i * 14} width={1060} height={2.6} fill={G4} />)}
    <rect x={-340} y={y0} width={3} height={56} fill={G3} />
    {Array.from({ length: 11 }, (_, k) => {
      const x = -280 + k * 92 + rnd(y0 + k) * 20, line = Math.floor(rnd(y0 * 3 + k * 7) * 7), y = y0 + 56 - line * 7;
      return (
        <g key={k}>
          <ellipse cx={x} cy={y} rx={11} ry={8} fill={G3} transform={`rotate(-20 ${x} ${y})`} />
          <rect x={x + 9} y={y - 46} width={2.6} height={46} fill={G3} />
        </g>
      );
    })}
  </g>
);

const Piano: React.FC<{ amb: number }> = ({ amb }) => {
  const keys = Array.from({ length: 22 }, (_, i) => i - 8);
  const black = [0, 1, 3, 4, 5];                            // a black key sits after the white keys C D F G A of every seven
  return (
    <g>
      <rect x={-1200} y={-900} width={4200} height={FLOOR_Y + 900} fill={CR.wall} />
      {/* the record on the wall turns once in 40 s (the loop clock) */}
      <g transform={`translate(950 520) rotate(${(amb / 40) * 360})`}>
        <circle r={116} fill={G1} />
        <circle r={86} fill={G2} opacity={0.5} /><circle r={62} fill={G1} opacity={0.6} />
        <path d="M -100 -40 A 108 108 0 0 1 -40 -100" fill="none" stroke={G3} strokeWidth={7} strokeLinecap="round" opacity={0.7} />
        <circle r={38} fill={YELLOW} /><circle r={7} fill={CR.wall} />
      </g>
      {/* the sheet on the stand: A4 at 55 px a cm, cut by the frame at the top */}
      <rect x={-387} y={-700} width={1155} height={1700} fill={WHITE} />
      <rect x={742} y={-700} width={26} height={1700} fill={G4} />
      {[120, 330, 540, 750].map((y) => <Staff key={y} y0={y} />)}
      {/* the music desk, the dark fallboard with its plate, the keys and the keyslip */}
      <rect x={-900} y={1000} width={2400} height={42} rx={8} fill={G2} />
      <rect x={-900} y={1000} width={2400} height={12} fill={G3} opacity={0.7} />
      <rect x={-900} y={1040} width={2400} height={345} fill={G1} />
      <rect x={-900} y={1040} width={2400} height={10} fill={G2} opacity={0.8} />
      <rect x={560} y={1090} width={330} height={44} rx={10} fill={YELLOW_D} /><rect x={560} y={1090} width={330} height={14} rx={7} fill={YELLOW} opacity={0.6} />
      <rect x={-900} y={1380} width={2400} height={200} fill={G4} />
      {keys.map((i) => <rect key={i} x={-1000 + i * KEY_W + KEY_W - 1.5} y={1380} width={3} height={200} fill={G3} />)}
      <rect x={-900} y={1540} width={2400} height={40} fill={G3} opacity={0.5} />
      {keys.filter((i) => black.includes(((i % 7) + 7) % 7)).map((i) => (
        <g key={i}>
          <rect x={-1000 + i * KEY_W + KEY_W - 37} y={1380} width={74} height={120} rx={8} fill={G1} />
          <rect x={-1000 + i * KEY_W + KEY_W - 37} y={1380} width={16} height={120} rx={8} fill={G2} opacity={0.7} />
        </g>
      ))}
      <rect x={-900} y={1580} width={2400} height={70} fill={G2} />
      <rect x={-900} y={1580} width={2400} height={12} fill={G1} opacity={0.5} />
      <rect x={-900} y={1650} width={2400} height={FLOOR_Y - 1650} fill={G1} />
      {[0, 1, 2].map((k) => (
        <g key={k}><rect x={200 + k * 90} y={1990} width={62} height={100} rx={8} fill={YELLOW_D} /><rect x={200 + k * 90} y={1990} width={62} height={22} rx={8} fill={YELLOW} opacity={0.7} /></g>
      ))}
      <rect x={-1200} y={FLOOR_Y} width={4200} height={1900} fill={CR.floor} />
      <rect x={-1200} y={FLOOR_Y} width={4200} height={16} fill={CR.floorEdge} />
    </g>
  );
};

/* ---------- the finger: a hand from the frame's left edge, an index finger of three capsules ---------- */
const T = 94, R = 47;
const Finger: React.FC<{ pip: number; dip: number }> = ({ pip, dip }) => {
  const rect = (x: number, w: number, k: string) => (
    <g key={k}>
      <rect x={x} y={J.y - R} width={w} height={T} rx={R} fill={SKIN_A} />
      <rect x={x + 8} y={J.y + 10} width={w - 16} height={R - 12} rx={18} fill={SKIN_B} opacity={0.5} />
    </g>
  );
  return (
    <g>
      {/* the thumb, behind the palm, pointing forward and down */}
      <g transform="rotate(16 -40 1350)"><rect x={-60} y={1305} width={300} height={84} rx={42} fill={SKIN_B} /><rect x={-60} y={1305} width={300} height={40} rx={20} fill={SKIN_A} opacity={0.6} /></g>
      {/* the back of the hand and the palm, from the frame's edge to the knuckle */}
      <path d="M -900 1120 L -200 1150 C -20 1160 60 1190 130 1203 L 130 1297 C 40 1312 -60 1335 -200 1362 L -900 1400 Z" fill={SKIN_A} />
      <path d="M -900 1400 L -200 1362 C -60 1335 40 1312 130 1297 L 130 1262 C 50 1286 -60 1312 -200 1330 L -900 1360 Z" fill={SKIN_B} opacity={0.5} />
      <circle cx={130} cy={1225} r={44} fill={SKIN_A} />
      <rect x={-900} y={1100} width={460} height={330} fill={G2} /><rect x={-460} y={1100} width={26} height={330} fill={G1} opacity={0.6} />
      {/* the distal and the middle phalanx turn about the last joint and the middle joint */}
      <g transform={`rotate(${pip} ${J.x} ${J.y})`}>
        <g transform={`rotate(${dip} 520 ${J.y})`}>
          {rect(473, 204, "dist")}
          <rect x={578} y={J.y - R + 8} width={72} height={26} rx={12} fill={WHITE} opacity={0.9} />
          <rect x={578} y={J.y - R + 22} width={72} height={12} rx={6} fill={SKIN_B} opacity={0.35} />
          <path d="M 505 1207 L 508 1218 M 520 1205 L 520 1217 M 535 1207 L 532 1218" stroke={SKIN_B} strokeWidth={4} strokeLinecap="round" />
        </g>
        {rect(333, 234, "mid")}
        <path d="M 365 1207 L 368 1219 M 380 1205 L 380 1218 M 395 1207 L 392 1219" stroke={SKIN_B} strokeWidth={4} strokeLinecap="round" />
      </g>
      {rect(83, 344, "prox")}
    </g>
  );
};

/** What the window shows: the two bone ends in their caps, the fluid between them, the gas dots, the cavity. */
const Inside: React.FC<{ pip: number; gap: number; press: number; clock: number; amb: number }> = ({ pip, gap, press, clock, amb }) => {
  const g = gap / 2;
  const gather = clamp01((clock - GATHER.a) / (GATHER.b - GATHER.a)), dots = clamp01((clock - GATHER.a + 1.2) / 1.2) * (1 - clamp01((clock - 28.4) / 0.4));
  const cu = clamp01((clock - CRACK) / 0.28), cav = clock < CRACK ? 0 : Math.max(0, outBack(cu)) * (1 - clamp01((clock - 28.3) / 0.4));
  const flash = clamp01(1 - (clock - CRACK) / 0.35) * (clock >= CRACK ? 1 : 0);
  const e = gather * gather * (3 - 2 * gather);
  return (
    <g>
      <rect x={J.x - 210} y={J.y - 130} width={420} height={260} fill={SKIN_A} />
      <rect x={J.x - 210} y={J.y - 130} width={420} height={260} fill={RED} opacity={0.22} />
      <rect x={J.x - 210} y={J.y + 60} width={420} height={70} fill={SKIN_B} opacity={0.35} />
      <path d={`M ${J.x - 210} ${J.y - 92} L ${J.x + 210} ${J.y - 92} M ${J.x - 210} ${J.y + 96} L ${J.x + 210} ${J.y + 96}`} stroke={G4} strokeWidth={6} opacity={0.55} />
      {/* the capsule of the joint holds the film of fluid; the fluid goes paler where its pressure falls */}
      <rect x={J.x - 92} y={J.y - 78} width={184} height={156} rx={52} fill={FLUID} />
      <rect x={J.x - 92} y={J.y - 78} width={184} height={156} rx={52} fill={WHITE} opacity={0.5 * (1 - press)} />
      <rect x={J.x - 92} y={J.y - 78} width={184} height={156} rx={52} fill="none" stroke={SKIN_B} strokeWidth={5} />
      {/* the proximal bone: a shaft that ends in a rounded head under a cap of cartilage */}
      <rect x={J.x - 260} y={J.y - 21} width={260 - g - 20} height={42} rx={7} fill={WHITE} />
      <rect x={J.x - 260} y={J.y + 6} width={260 - g - 20} height={15} rx={6} fill={G4} />
      <ellipse cx={J.x - g - 6} cy={J.y} rx={37} ry={48} fill={FLUID_D} />
      <ellipse cx={J.x - g - 12} cy={J.y} rx={30} ry={40} fill={WHITE} />
      {/* the middle bone turns with the finger: a cup at its base under a cap, then the shaft */}
      <g transform={`rotate(${pip} ${J.x} ${J.y})`}>
        <rect x={J.x + g + 20} y={J.y - 19} width={250} height={38} rx={7} fill={WHITE} />
        <rect x={J.x + g + 20} y={J.y + 5} width={250} height={14} rx={6} fill={G4} />
        <ellipse cx={J.x + g + 4} cy={J.y} rx={31} ry={42} fill={FLUID_D} />
        <ellipse cx={J.x + g + 10} cy={J.y} rx={25} ry={35} fill={WHITE} />
      </g>
      {/* the gas that was dissolved in the fluid comes out as dots, gathers to the middle and opens as one cavity on the crack */}
      {dots > 0 && Array.from({ length: 16 }, (_, i) => {
        const bx = J.x + (rnd(i * 3) - 0.5) * 130 + 4 * Math.sin(amb * 2 + i), by = J.y + (rnd(i * 5 + 1) - 0.5) * 150 + 4 * Math.cos(amb * 2.3 + i);
        return <circle key={i} cx={lerp(bx, J.x, e)} cy={lerp(by, J.y, e)} r={lerp(3 + rnd(i) * 3, 2, e)} fill={WHITE} opacity={0.9 * dots * (1 - cav)} />;
      })}
      {cav > 0 && (
        <g>
          <ellipse cx={J.x} cy={J.y} rx={15 * cav} ry={56 * cav} fill={WHITE} />
          <ellipse cx={J.x} cy={J.y} rx={15 * cav} ry={56 * cav} fill="none" stroke={G3} strokeWidth={3.5} />
          <path d={`M ${J.x - 6} ${J.y - 30 * cav} Q ${J.x - 8} ${J.y - 10 * cav} ${J.x - 5} ${J.y + 6 * cav}`} stroke={G4} strokeWidth={4} strokeLinecap="round" fill="none" />
        </g>
      )}
      {flash > 0 && <circle cx={J.x} cy={J.y} r={50 + (1 - flash) * 150} fill={WHITE} opacity={0.85 * flash} />}
    </g>
  );
};

/** Three sound arcs: round the window on the crack, and a hint of them round the bent joint in the hook (so the thumbnail already says "krek"). */
const SoundArcs: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const tt = clock - CRACK;
  const hook = clock < 3.3 ? clamp01(1 - (clock - 2.7) / 0.6) : clock > 38.8 ? clamp01((clock - 38.8) / 0.4) : 0;
    return (
    <g>
      {hook > 0 && [0, 1, 2].map((k) => {
        const r = 84 + k * 34, o = hook * (1 - k * 0.2);
        return <path key={k} d={`M ${J.x + 20 + r * Math.cos(-1.35)} ${1200 + r * Math.sin(-1.35)} A ${r} ${r} 0 0 1 ${J.x + 20 + r * Math.cos(-0.45)} ${1200 + r * Math.sin(-0.45)}`} fill="none" stroke={YELLOW_D} strokeWidth={9} strokeLinecap="round" opacity={o} />;
      })}
      {tt > 0 && tt < 0.9 && [0, 1, 2].map((k) => {
        const u = clamp01((tt - k * 0.1) / 0.6);
        return u > 0 ? <ellipse key={k} cx={J.x} cy={J.y} rx={WIN.rx + 24 + u * 110} ry={WIN.ry + 24 + u * 80} fill="none" stroke={YELLOW_D} strokeWidth={9} strokeDasharray="90 70" opacity={1 - u} /> : null;
      })}
    </g>
  );
};

const World: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const set = setAt(clock), w = winAt(clock), open = Math.max(0.001, w);
  const sway = 0.8 * Math.sin((2 * Math.PI * amb) / 5);                   // a live finger never holds perfectly still; 40 s is a whole number of periods (the loop)
  const pip = pipAt(clock) + sway, dip = dipAt(clock) + sway * 0.6, gap = gapAt(clock), press = pressAt(clock);
  const jit = clock >= CRACK && clock < CRACK + 0.4 ? 4 * Math.sin((clock - CRACK) * 70) * (1 - (clock - CRACK) / 0.4) : 0;
  const pull = win(clock, PULL.a, PULL.b, 0.4);
  const clipId = "kr-win";
  return (
    <g>
      <rect x={-1200} y={-900} width={4200} height={4000} fill={CR.wall} />
      <g opacity={set} transform={`translate(0 ${60 * (1 - set)})`}>{set > 0.001 && <Piano amb={amb} />}</g>
      <g transform={`translate(0 ${jit})`}>
        <Finger pip={pip} dip={dip} />
        {pull > 0 && <g opacity={pull}><Arrow x={695} y={1205} x2={760} y2={1205} color="black" w={13} draw={clamp01((clock - PULL.a) / 0.5)} /></g>}
        <g transform={`translate(${J.x} ${J.y}) scale(${open}) translate(${-J.x} ${-J.y})`} opacity={w > 0.001 ? 1 : 0}>
          <ellipse cx={J.x} cy={J.y} rx={WIN.rx + 10} ry={WIN.ry + 10} fill={SKIN_B} />
          <clipPath id={clipId}><ellipse cx={J.x} cy={J.y} rx={WIN.rx} ry={WIN.ry} /></clipPath>
          <g clipPath={`url(#${clipId})`}><Inside pip={pip} gap={gap} press={press} clock={clock} amb={amb} /></g>
        </g>
        <SoundArcs clock={clock} amb={amb} />
      </g>
    </g>
  );
};

/* ---------- the screen layer: hook text, labels, the pressure gauge, tip cards ---------- */
const HookText: React.FC<{ clock: number }> = ({ clock }) => {
  const o = clock > 20 ? clamp01((clock - 39.5) / 0.5) : 1 - clamp01((clock - 2.7) / 0.3);   // frame 0 has it, the last 0.5 s of the outro brings it back (B41: the loop)
  const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 800 } as const;
  const lines = ["Bukan tulang", "patah. Itu", "gelembung."];
  if (o <= 0) return null;
  return <g opacity={o}>{lines.map((ln, i) => <text key={ln} x={SAFE.left + 20} y={300 + i * 128 + (i > 0 ? 16 : 0)} fontSize={122} fill={BLACK} style={bold}>{ln}</text>)}</g>;
};

const ScreenLabel: React.FC<{ l: (typeof LABELS)[number]; clock: number; cam: { x: number; y: number; z: number } }> = ({ l, clock, cam }) => {
  if (clock < l.from || clock > l.to + 0.3) return null;
  const o = clamp01((clock - l.from) / 0.25) * (1 - clamp01((clock - l.to) / 0.3));
  const [px, py] = l.at ? toScreen(cam, l.at[0], l.at[1]) : [0, 0];
  const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
  const wide = l.text.length * 54 * 0.52;
  const sx = l.x + (px > l.x ? Math.min(40, wide / 3) : -Math.min(40, wide / 3));
  const chip = wide + 56;
  return (
    <g opacity={o}>
      {l.at && <path d={`M ${sx} ${l.y + 40} L ${px} ${py - 10}`} stroke={YELLOW} strokeWidth={7} strokeLinecap="round" />}
      {l.at && <circle cx={px} cy={py} r={11} fill={YELLOW} stroke={BLACK} strokeWidth={3} />}
      <rect x={l.x - chip / 2} y={l.y - 52} width={chip} height={90} rx={28} fill={WHITE} />
      <text x={l.x} y={l.y + 10} fontSize={54} fill={BLACK} textAnchor="middle" style={bold}>{l.text}</text>
    </g>
  );
};

/** The pressure of the fluid as a gauge on the left: full at rest, it drops when the surfaces let go. */
const Gauge: React.FC<{ clock: number }> = ({ clock }) => {
  const o = win(clock, PRESSURE.a, PRESSURE.b, 0.4);
  if (o <= 0) return null;
  const p = pressAt(clock), bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
  return (
    <g opacity={o}>
      <rect x={SAFE.left + 6} y={700} width={76} height={330} rx={26} fill={WHITE} />
      <rect x={SAFE.left + 16} y={710 + 310 * (1 - p)} width={56} height={310 * p} rx={18} fill={YELLOW} />
      <rect x={SAFE.left - 6} y={606} width={176} height={72} rx={24} fill={WHITE} /><text x={SAFE.left + 82} y={658} fontSize={42} fill={BLACK} textAnchor="middle" style={bold}>tekanan</text>
    </g>
  );
};

const Card: React.FC<{ y: number; title: string; sub: string; a: number; out: number; clock: number }> = ({ y, title, sub, a, out, clock }) => {
  const p = springAt(clock, a, true), o = 1 - clamp01((clock - out) / 0.4);
  if (clock < a || o <= 0) return null;
  return (
    <g transform={`translate(540 ${y + 105}) scale(${Math.max(0, p)}) translate(-540 ${-(y + 105)})`} opacity={o}>
      <rect x={SAFE.left} y={y} width={SAFE.right - SAFE.left} height={210} rx={44} fill={WHITE} />
      <rect x={SAFE.left} y={y + 34} width={14} height={142} rx={7} fill={YELLOW} />
      <text x={SAFE.left + 64} y={y + 96} fontSize={70} fill={BLACK} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>{title}</text>
      <text x={SAFE.left + 64} y={y + 164} fontSize={50} fill={G1} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 600 }}>{sub}</text>
    </g>
  );
};

const Scene = ({ beat, t, clock, story }: SceneProps) => {
  const amb = loopClock(clock, story.beats.reduce((a, b) => a + b.dur, 0), 40);   // B29: the ambient motion runs on the loop clock (a 40 s video)
  const cam = camAt(clock), sting = beat.kind === "sting", outro = beat.kind === "outro", hook = beat.kind === "hook";
  const tx = `translate(${W / 2} ${H / 2}) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <g transform={tx}><World clock={clock} amb={amb} /></g>
      {LABELS.map((l) => <ScreenLabel key={l.text + l.from} l={l} clock={clock} cam={cam} />)}
      <Gauge clock={clock} />
      <Card y={450} title="20 menit" sub="sendi butuh jeda" a={CARDS[0].a} out={CARDS[0].out} clock={clock} />
      <Card y={690} title="Harvard Health" sub="kemungkinan tak naikkan risiko" a={CARDS[1].a} out={CARDS[1].out} clock={clock} />
      {(hook || outro) && <HookText clock={clock} />}
      {sting && <StingMark slug="bunyi-krek-saat-jari-ditekuk-i" t={t} clock={clock} />}
      {!hook && !sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {/* no caption in the hook: the hook text already says the same words, and frame 0 then matches the last frame (the loop) */}
      {!hook && !sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
