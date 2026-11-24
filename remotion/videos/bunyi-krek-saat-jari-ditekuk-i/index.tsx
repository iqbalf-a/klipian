/* Bunyi krek jari: bukan tulang patah — look 2d (B28): the back of a left hand seen from above, lying on the keys of a piano seen from above (set kind
   "piano-fallboard-front", see set.json); a second hand pinches the tip of the index finger and pulls. B56 (a body part keeps a readable anatomical silhouette): the hand is
   whole, a palm with a thenar bulge, four fingers of their own length and width (the middle finger as long as the palm), a thumb with two bones, knuckle bumps and creases at
   every joint, a nail on every visible digit, a wrist and a sleeve; the pulling hand shows the index finger and the thumb of a hand that is cut by the frame.
   Real shapes (B27.16): a finger has three bones (the thumb two); the middle joint is two bone ends, each with a cap of cartilage, held in a capsule of synovial fluid
   (a blue film). Pulled, the ends let go all at once, the pressure of the fluid falls, the gas dissolved in it gathers and opens one cavity at the moment of the crack
   (Kawchuk 2015: a cavity forms, no bubble collapses). Two tones per part (base and shade, light from the top left), no outlines, palette tokens only. The world is one
   group moved by the camera (plan.ts camAt); labels, the gauge, the tip cards and the hook text are on the screen. Ambient motion (the record on the lid, the sway of the
   hand) runs on the loop clock (B29). The last frame is the first frame (the loop). */
import React from "react";
import {
  loopClock, BLACK, BLUSH, CaptionLayer, FONT_BOLD, G1, G2, G3, G4, SAFE, SKIN_A, SKIN_B, RED, StoryVideo, THEMES, TopText, WHITE, YELLOW,
  YELLOW_D, clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { CARDS, CRACK, GATHER, J, LABELS, PRESSURE, PULL, awayAt, camAt, gapAt, pressAt, pullAt, setAt, winAt } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { cairan: "ISI SENDI", tarik: "DITARIK", rongga: "JAWABANNYA", tips: "FAKTA" };
const CR = THEMES.cream;
const FLUID = THEMES.sky.ring, FLUID_D = THEMES.sky.floorEdge;   // the film of synovial fluid and the cartilage caps
const WIN = { rx: 155, ry: 175 };

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const outBack = (u: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
/** A world point on the screen at the camera c. */
const toScreen = (c: { x: number; y: number; z: number }, x: number, y: number): [number, number] => [W / 2 + (x - c.x) * c.z, H / 2 + (y - c.y) * c.z];

/* ---------- the set: the piano from above (a dark lid with a sheet, a pencil and a record, the fallboard, the keys, the keyslip, the floor) ---------- */
const KEYS_TOP = 1000, KEYS_END = 1825, KEY_W = 129;      // a white key is 2.35 cm wide and 15 cm long at 55 px a cm
const Staff: React.FC<{ y0: number }> = ({ y0 }) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={-260} y={y0 + i * 14} width={1120} height={2.6} fill={G4} />)}
    <rect x={-260} y={y0} width={3} height={56} fill={G3} />
    {Array.from({ length: 11 }, (_, k) => {
      const x = -200 + k * 98 + rnd(y0 + k) * 20, line = Math.floor(rnd(y0 * 3 + k * 7) * 7), y = y0 + 56 - line * 7;
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
  const keys = Array.from({ length: 12 }, (_, i) => i - 2);
  const black = [0, 1, 3, 4, 5];                            // a black key sits after the white keys C D F G A of every seven
  return (
    <g>
      {/* the dark lid, with a sheet lying on it, a pencil and a record that turns once in 40 s (the loop clock) */}
      <rect x={-1200} y={-1500} width={4200} height={KEYS_TOP - 134 + 1500} fill={G1} />
      <rect x={-1200} y={-300} width={4200} height={6} fill={G2} opacity={0.35} /><rect x={-1200} y={400} width={4200} height={6} fill={G2} opacity={0.35} />
      <g transform="rotate(-3 300 250)">
        <rect x={-280} y={-900} width={1160} height={1720} fill={WHITE} />
        <rect x={858} y={-900} width={22} height={1720} fill={G4} />
        {[-380, -170, 40, 250, 460, 670].map((y) => <Staff key={y} y0={y} />)}
      </g>
      <g transform={`translate(1000 -200) rotate(${(amb / 40) * 360})`}>
        <circle r={116} fill={G2} /><circle r={88} fill={G1} opacity={0.5} /><circle r={62} fill={G2} opacity={0.5} />
        <path d="M -100 -40 A 108 108 0 0 1 -40 -100" fill="none" stroke={G3} strokeWidth={7} strokeLinecap="round" opacity={0.7} />
        <circle r={38} fill={YELLOW} /><circle r={7} fill={G1} />
      </g>
      <g transform="translate(120 690) rotate(-18)">
        <rect x={-170} y={-12} width={330} height={24} fill={YELLOW} /><rect x={-170} y={4} width={330} height={8} fill={YELLOW_D} />
        <path d="M 160 -12 L 215 0 L 160 12 Z" fill={SKIN_A} /><path d="M 195 -4 L 215 0 L 195 4 Z" fill={G1} />
        <rect x={-200} y={-12} width={30} height={24} rx={6} fill={BLUSH} /><rect x={-176} y={-12} width={8} height={24} fill={G3} />
      </g>
      {/* the fallboard with its plate, then the keys: white strips with seams, black keys that stop two thirds of the way */}
      <rect x={-1200} y={KEYS_TOP - 134} width={4200} height={134} fill={G2} />
      <rect x={-1200} y={KEYS_TOP - 134} width={4200} height={12} fill={G3} opacity={0.6} />
      <rect x={470} y={KEYS_TOP - 96} width={300} height={44} rx={10} fill={YELLOW_D} /><rect x={470} y={KEYS_TOP - 96} width={300} height={14} rx={7} fill={YELLOW} opacity={0.6} />
      <rect x={-1200} y={KEYS_TOP} width={4200} height={KEYS_END - KEYS_TOP} fill={G4} />
      {keys.map((i) => <rect key={i} x={-300 + i * KEY_W + KEY_W - 1.5} y={KEYS_TOP} width={3} height={KEYS_END - KEYS_TOP} fill={G3} />)}
      <rect x={-1200} y={KEYS_END - 46} width={4200} height={46} fill={G3} opacity={0.5} />
      {keys.filter((i) => black.includes(((i % 7) + 7) % 7)).map((i) => (
        <g key={i}>
          <rect x={-300 + i * KEY_W + KEY_W - 37} y={KEYS_TOP} width={74} height={520} rx={8} fill={G1} />
          <rect x={-300 + i * KEY_W + KEY_W - 37} y={KEYS_TOP} width={16} height={520} rx={8} fill={G2} opacity={0.7} />
        </g>
      ))}
      <rect x={-1200} y={KEYS_END} width={4200} height={70} fill={G2} />
      <rect x={-1200} y={KEYS_END} width={4200} height={12} fill={G1} opacity={0.5} />
      <rect x={-1200} y={KEYS_END + 70} width={4200} height={2000} fill={CR.floor} />
      <rect x={-1200} y={KEYS_END + 70} width={4200} height={16} fill={CR.floorEdge} />
    </g>
  );
};

/* ---------- a digit: a finger or a thumb drawn pointing up from its base, as a smooth tapered shape with knuckle bumps, creases and a nail ---------- */
type DigitP = { id: string; x: number; y: number; ang?: number; w: number; lens: number[]; shift?: number };
/** `lens` are the lengths of the bones (base to tip); `shift` lengthens the digit between the first and the second bone (the pull). */
const Digit: React.FC<DigitP> = ({ id, x, y, ang = 0, w, lens, shift = 0 }) => {
  const total = lens.reduce((a, b) => a + b, 0) + shift;
  const joints: number[] = [];
  lens.reduce((acc, L, i) => { const d = acc + L + (i === 0 ? shift : 0); joints.push(d); return d; }, 0);
  const inner = joints.slice(0, -1);
  const half = (d: number) => (w * (1 - 0.2 * (d / total))) / 2 + inner.reduce((m, j) => Math.max(m, 5 * Math.exp(-(((d - j) / 22) ** 2))), 0);
  const tipR = half(total);
  const left: string[] = [], right: string[] = [];
  for (let d = 0; d <= total - tipR; d += 8) { left.push(`${(-half(d)).toFixed(1)} ${(-d).toFixed(1)}`); right.unshift(`${half(d).toFixed(1)} ${(-d).toFixed(1)}`); }
  const top = -(total - tipR);
  const path = `M ${left.join(" L ")} A ${tipR.toFixed(1)} ${tipR.toFixed(1)} 0 0 1 ${tipR.toFixed(1)} ${top.toFixed(1)} L ${right.join(" L ")} Z`;
  const nailW = tipR * 1.2, nailH = lens[lens.length - 1] * 0.5;
  return (
    <g transform={`translate(${x} ${y}) rotate(${ang})`}>
      <clipPath id={`dg-${id}`}><path d={path} /></clipPath>
      <path d={path} fill={SKIN_A} />
      <rect x={w * 0.12} y={-total - 10} width={w} height={total + 20} fill={SKIN_B} opacity={0.5} clipPath={`url(#dg-${id})`} />
      {inner.map((j, k) => [0, 1, 2].slice(0, k === 0 ? 3 : 2).map((m) => {
        const yy = -j + (m - 1) * 8, len = half(j) * (m === 1 ? 1.1 : 0.8);
        return <path key={`${k}-${m}`} d={`M ${-len / 2} ${yy} Q 0 ${yy - 4} ${len / 2} ${yy}`} fill="none" stroke={SKIN_B} strokeWidth={3.6} strokeLinecap="round" opacity={0.75} />;
      }))}
      <rect x={-nailW / 2} y={-total + 8} width={nailW} height={nailH} rx={nailW * 0.36} fill={WHITE} opacity={0.92} />
      <rect x={-nailW / 2} y={-total + 8 + nailH * 0.55} width={nailW} height={nailH * 0.45} rx={nailW * 0.3} fill={BLUSH} opacity={0.22} />
    </g>
  );
};

/** The back of a left hand, fingers up (thumb on the right): forearm and sleeve, palm and thenar, thumb, four fingers. The index finger is drawn out by `shift`. */
const HandBack: React.FC<{ shift: number }> = ({ shift }) => {
  const palm = "M 318 1275 C 300 1380 330 1560 400 1720 L 738 1720 C 760 1600 770 1480 712 1330 L 706 1240 Q 640 1190 560 1185 Q 460 1195 400 1215 Q 330 1235 318 1275 Z";
  const knuckles: [number, number, number][] = [[360, 1270, 80], [455, 1230, 92], [555, 1215, 98], [658, 1235, 94]];
  return (
    <g>
      {/* the forearm narrows to the wrist; the sleeve hides the rest */}
      <path d="M 396 1690 L 742 1690 L 770 2000 L 372 2000 Z" fill={SKIN_A} />
      <path d="M 660 1690 L 742 1690 L 770 2000 L 700 2000 Z" fill={SKIN_B} opacity={0.4} />
      <rect x={340} y={1810} width={470} height={260} rx={18} fill={G2} /><rect x={340} y={1810} width={470} height={22} rx={10} fill={G1} opacity={0.6} />
      <rect x={340} y={1840} width={90} height={230} fill={G1} opacity={0.18} />
      {/* the thumb has two bones and leans out from the thenar bulge */}
      <ellipse cx={742} cy={1470} rx={104} ry={170} transform="rotate(14 742 1470)" fill={SKIN_A} />
      <Digit id="thumb" x={790} y={1395} ang={19} w={118} lens={[188, 150]} />
      <ellipse cx={776} cy={1408} rx={74} ry={44} transform="rotate(19 776 1408)" fill={SKIN_A} />
      <path d={palm} fill={SKIN_A} />
      <path d="M 738 1720 C 760 1600 770 1480 712 1330 L 706 1240 L 640 1235 C 690 1320 700 1500 650 1720 Z" fill={SKIN_B} opacity={0.4} />
      {/* the four fingers, each its own length and width: the middle is as long as the palm */}
      <Digit id="pinky" x={360} y={1270} w={80} lens={[192, 110, 110]} />
      <Digit id="ring" x={455} y={1230} w={92} lens={[242, 143, 127]} />
      <Digit id="middle" x={555} y={1215} w={98} lens={[259, 154, 127]} />
      <Digit id="index" x={658} y={1235} w={94} lens={[236, 138, 121]} shift={shift} />
      {/* the knuckle bumps and the tendons running down the back of the hand */}
      {knuckles.map(([x, y, w]) => (
        <g key={x}>
          <ellipse cx={x} cy={y + 6} rx={w * 0.62} ry={36} fill={SKIN_A} />
          <ellipse cx={x} cy={y + 22} rx={w * 0.46} ry={w * 0.36} fill={WHITE} opacity={0.16} />
          <path d={`M ${x - 12} ${y + 56} Q ${x - 16} ${y + 120} ${x - 8} ${y + 190}`} fill="none" stroke={SKIN_B} strokeWidth={4} strokeLinecap="round" opacity={0.3} />
          <path d={`M ${x - w * 0.3} ${y + 10} q ${w * 0.3} 14 ${w * 0.6} 0 M ${x - w * 0.24} ${y + 26} q ${w * 0.24} 10 ${w * 0.48} 0`} fill="none" stroke={SKIN_B} strokeWidth={3.4} strokeLinecap="round" opacity={0.55} />
        </g>
      ))}
      <path d="M 410 1660 Q 560 1690 730 1660" fill="none" stroke={SKIN_B} strokeWidth={4} strokeLinecap="round" opacity={0.35} />
    </g>
  );
};

/** The pulling hand, cut by the frame: its index finger lies across the tip of the other index finger and its thumb meets it from below. It rises with the pull. */
const PullHand: React.FC = () => (
  <g>
    <Digit id="a-thumb" x={1081} y={960} ang={-76} w={104} lens={[210, 170]} />
    <Digit id="a-index" x={1135} y={790} ang={-90} w={94} lens={[236, 138, 121]} />
  </g>
);

/** What the window shows: the two bone ends in their caps, the fluid between them, the gas dots, the cavity. It is drawn along the finger (turned to point up). */
const Inside: React.FC<{ gap: number; press: number; clock: number; amb: number }> = ({ gap, press, clock, amb }) => {
  const g = gap / 2;
  const gather = clamp01((clock - GATHER.a) / (GATHER.b - GATHER.a)), dots = clamp01((clock - GATHER.a + 1.2) / 1.2) * (1 - clamp01((clock - 28.4) / 0.4));
  const cu = clamp01((clock - CRACK) / 0.28), cav = clock < CRACK ? 0 : Math.max(0, outBack(cu)) * (1 - clamp01((clock - 28.3) / 0.4));
  const flash = clamp01(1 - (clock - CRACK) / 0.35) * (clock >= CRACK ? 1 : 0);
  const e = gather * gather * (3 - 2 * gather);
  return (
    <g>
      <rect x={J.x - 210} y={J.y - 170} width={420} height={340} fill={SKIN_A} />
      <rect x={J.x - 210} y={J.y - 170} width={420} height={340} fill={RED} opacity={0.22} />
      <rect x={J.x - 210} y={J.y + 60} width={420} height={110} fill={SKIN_B} opacity={0.35} />
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
      {/* the middle bone: a cup at its base under a cap, then the shaft */}
      <rect x={J.x + g + 20} y={J.y - 19} width={250} height={38} rx={7} fill={WHITE} />
      <rect x={J.x + g + 20} y={J.y + 5} width={250} height={14} rx={6} fill={G4} />
      <ellipse cx={J.x + g + 4} cy={J.y} rx={31} ry={42} fill={FLUID_D} />
      <ellipse cx={J.x + g + 10} cy={J.y} rx={25} ry={35} fill={WHITE} />
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

/** Sound arcs: round the window on the crack, and three ticks beside the joint in the hook (so the thumbnail already says "krek"). */
const SoundArcs: React.FC<{ clock: number }> = ({ clock }) => {
  const tt = clock - CRACK;
  const hook = clock < 3.3 ? clamp01(1 - (clock - 2.7) / 0.6) : clock > 38.8 ? clamp01((clock - 38.8) / 0.4) : 0;
  return (
    <g>
      {hook > 0 && [-34, 0, 34].map((a) => {
        const r = (a * Math.PI) / 180;
        return <path key={a} d={`M ${J.x + 74 * Math.cos(r)} ${J.y + 74 * Math.sin(r)} L ${J.x + 124 * Math.cos(r)} ${J.y + 124 * Math.sin(r)}`} stroke={YELLOW} strokeWidth={11} strokeLinecap="round" opacity={hook} />;
      })}
      {tt > 0 && tt < 0.9 && [0, 1, 2].map((k) => {
        const u = clamp01((tt - k * 0.1) / 0.6);
        return u > 0 ? <ellipse key={k} cx={J.x} cy={J.y} rx={WIN.rx + 24 + u * 110} ry={WIN.ry + 24 + u * 80} fill="none" stroke={YELLOW} strokeWidth={9} strokeDasharray="90 70" opacity={1 - u} /> : null;
      })}
    </g>
  );
};

const World: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const set = setAt(clock), w = winAt(clock), open = Math.max(0.001, w);
  const gap = gapAt(clock), press = pressAt(clock);
  const shift = pullAt(clock) + (gap - 6);                                // how far the fingertip has been drawn out
  const sway = 0.6 * Math.sin((2 * Math.PI * amb) / 5) * Math.sin((Math.PI * clock) / 40);   // a live hand never holds perfectly still; the envelope is 0 at both ends, so the last frame is the first (the loop)
  const jit = clock >= CRACK && clock < CRACK + 0.4 ? 4 * Math.sin((clock - CRACK) * 70) * (1 - (clock - CRACK) / 0.4) : 0;
  const pull = win(clock, PULL.a, PULL.b, 0.4);
  const clipId = "kr-win";
  return (
    <g>
      <rect x={-1200} y={-1500} width={4200} height={5000} fill={CR.wall} />
      <g opacity={set} transform={`translate(0 ${60 * (1 - set)})`}>{set > 0.001 && <Piano amb={amb} />}</g>
      <g transform={`translate(${jit} 0)`}>
        <g transform={`rotate(${sway} 640 1800)`}><HandBack shift={shift} /></g>
        <g transform={`translate(${awayAt(clock)} ${-shift})`}><PullHand /></g>
        {pull > 0 && (
          <g opacity={pull} transform={`translate(0 ${-6 * Math.abs(Math.sin((clock - PULL.a) * 4))})`}>
            <rect x={J.x - 9} y={628} width={18} height={62} fill={YELLOW} /><path d={`M ${J.x - 34} 634 L ${J.x + 34} 634 L ${J.x} 574 Z`} fill={YELLOW} />
          </g>
        )}
        <g transform={`translate(${J.x} ${J.y}) scale(${open}) translate(${-J.x} ${-J.y})`} opacity={w > 0.001 ? 1 : 0}>
          <ellipse cx={J.x} cy={J.y} rx={WIN.rx + 10} ry={WIN.ry + 10} fill={SKIN_B} />
          <clipPath id={clipId}><ellipse cx={J.x} cy={J.y} rx={WIN.rx} ry={WIN.ry} /></clipPath>
          <g clipPath={`url(#${clipId})`}><g transform={`rotate(-90 ${J.x} ${J.y})`}><Inside gap={gap} press={press} clock={clock} amb={amb} /></g></g>
        </g>
        <SoundArcs clock={clock} />
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
  const fs = l.fs ?? 54, wide = l.text.length * fs * 0.52, chip = wide + fs * 1.04;
  return (
    <g opacity={o}>
      {l.at && <path d={`M ${l.x} ${l.y} L ${px} ${py}`} stroke={YELLOW} strokeWidth={7} strokeLinecap="round" />}
      {l.at && <circle cx={px} cy={py} r={11} fill={YELLOW} stroke={BLACK} strokeWidth={3} />}
      <rect x={l.x - chip / 2} y={l.y - fs * 0.96} width={chip} height={fs * 1.67} rx={fs * 0.52} fill={WHITE} />
      <text x={l.x} y={l.y + fs * 0.185} fontSize={fs} fill={BLACK} textAnchor="middle" style={bold}>{l.text}</text>
    </g>
  );
};

/** The pressure of the fluid as a gauge card in the free band under the top text (tarik beat only): full at rest, it drops when the surfaces let go. */
const Gauge: React.FC<{ clock: number }> = ({ clock }) => {
  const o = win(clock, PRESSURE.a, PRESSURE.b, 0.4);
  if (o <= 0) return null;
  const p = pressAt(clock), bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
  return (
    <g opacity={o}>
      <rect x={70} y={450} width={400} height={90} rx={32} fill={WHITE} />
      <text x={100} y={510} fontSize={40} fill={BLACK} style={bold}>tekanan</text>
      <rect x={270} y={478} width={170} height={34} rx={17} fill={G4} />
      <rect x={270} y={478} width={Math.max(8, 170 * p)} height={34} rx={17} fill={YELLOW} />
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
