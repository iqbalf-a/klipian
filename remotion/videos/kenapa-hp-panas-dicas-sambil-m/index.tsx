/* Kenapa HP panas dicas sambil main game — look 2d (B28): a phone seen flat from the front (a whole phone: body, screen, a plug and a cord, B56 does not apply: no body part).
   The set (kind "gaming-beanbag-corner", see set.json) is a corner of a room seen flat: a wall with a string of pennants and a hook with headphones, a floor with planks,
   a beanbag with a game controller on it, and a wooden crate that holds the phone on a stand. No person is drawn (B43). Real shapes (B27.16): a phone is a rounded slab about
   twice as long as it is wide (landscape here), a battery pack is a flat block made of cells with a nub, a chip is a square package with pins on four sides and a die in it.
   The story: the phone flips to show its inside; charging fills six cells and warms the battery; the game makes the chip work and warm; the two warms meet in one thin body
   that a thick case and a soft pad hold in; the sensors read it; the phone slows itself (screen dims, frames drop, charging slows); a long heat ages the cells; three tips.
   Two tones per part (base and shade, light from the top left), no outlines, palette tokens only. Three depth layers (B27.2): the far wall (parallax 0.5), the world with the
   phone, and a few dust motes in front (1.3). Ambient motion (the game scrolling, the heat waves, the pennants, the headphones, the dust) runs on the loop clock (B29).
   The last frame is the first frame (the loop). */
import React from "react";
import {
  loopClock, BLACK, CAVITY_SHADE, CaptionLayer, COFFEE, COFFEE_LIGHT, FONT_BOLD, G1, G2, G3, G4, HOT1, HOT2, METAL, PLASTER, RED, SAFE, StoryVideo, STEAM, THEMES,
  TopText, WHITE, YELLOW, clamp01, springAt, textWidth, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import {
  AGE, CELL_A, CELL_STEP, FLOW, GAUGE, LABELS, PAUSE, RESULT, RESULT_OUT, TIPS, TIPS_OUT,
  batHeatAt, camAt, caseAt, chipHeatAt, dimAt, flipAt, frontHeatAt, loadAt, padAt, setAt, tempAt, type Cam,
} from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920, TAU = Math.PI * 2;
const KICKER: Record<string, string> = { cas: "PENYEBAB 1", game: "PENYEBAB 2", numpuk: "DUA PANAS", sensor: "DI DALAM HP", hasil: "AKIBATNYA", umur: "UMUR BATERAI", tips: "BIAR TIDAK PANAS" };
const BOLD = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const bold = (w = 700) => ({ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: w }) as const;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const SKY = THEMES.sky, MINT = THEMES.mint, PEACH = THEMES.peach;
const FLOOR_Y = 1430;

/** A camera layer: parallax p moves the world p times as much as the camera (B27.2). */
const layerTx = (c: Cam, p: number) => `translate(${W / 2} ${H / 2}) scale(${1 + (c.z - 1) * p}) translate(${-(540 + (c.x - 540) * p)} ${-(960 + (c.y - 960) * p)})`;

/* ---------- the far layer: the wall, a string of pennants, a hook with headphones ---------- */
const FLAGS = [YELLOW, HOT1, MINT.ring, PEACH.floorEdge, WHITE, SKY.floorEdge];
const Wall: React.FC<{ amb: number }> = ({ amb }) => {
  const p = (u: number) => [(-100 + 1280 * u), 540 + 30 * 4 * u * (1 - u)] as const;
  return (
    <g>
      <rect x={-1400} y={-1400} width={4000} height={3600} fill={SKY.wall} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={-400 + i * 560} y={-1400} width={170} height={3200} fill={SKY.ring} opacity={0.45} transform={`skewX(-14)`} />)}
      <path d={`M -100 540 Q 540 600 1180 540`} stroke={G2} strokeWidth={5} fill="none" />
      {Array.from({ length: 10 }, (_, i) => {
        const [x, y] = p((i + 0.5) / 10), sw = Math.sin(amb * TAU * 12 + i * 0.9) * 3.5;
        return (
          <g key={i} transform={`rotate(${sw} ${x} ${y})`}>
            <path d={`M ${x - 36} ${y} L ${x + 36} ${y} L ${x} ${y + 84} Z`} fill={FLAGS[i % FLAGS.length]} />
            <path d={`M ${x + 36} ${y} L ${x} ${y + 84} L ${x + 8} ${y + 40} Z`} fill={G1} opacity={0.12} />
          </g>
        );
      })}
      <g transform={`rotate(${Math.sin(amb * TAU * 10) * 2.5} 40 700)`}>
        <rect x={34} y={690} width={12} height={42} rx={5} fill={METAL} />
        <path d="M -15 830 C -15 728 95 728 95 830" stroke={G1} strokeWidth={22} strokeLinecap="round" fill="none" />
        <path d="M -15 830 C -15 750 20 732 42 730" stroke={G2} strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.7} />
        {[-15, 95].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={848} rx={30} ry={50} fill={G1} />
            <ellipse cx={x + (x < 40 ? 8 : -8)} cy={848} rx={15} ry={32} fill={G2} />
          </g>
        ))}
      </g>
    </g>
  );
};

/* ---------- the world layer: floor, beanbag with a game controller, a wooden crate and the stand ---------- */
const Corner: React.FC = () => (
  <g>
    <rect x={-1400} y={FLOOR_Y} width={4000} height={1800} fill={PEACH.floor} />
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-1400} y={FLOOR_Y + 30 + i * 62 + i * i * 4} width={4000} height={5} fill={PEACH.floorEdge} opacity={0.6} />)}
    <rect x={-1400} y={FLOOR_Y - 40} width={4000} height={46} fill={SKY.floorEdge} />
    <rect x={-1400} y={FLOOR_Y - 40} width={4000} height={12} fill={WHITE} opacity={0.3} />
    {/* the beanbag: a saggy dome, cut by the left edge, with a seam and a shade side */}
    <path d="M -260 1432 C -300 1250 -140 1090 60 1090 C 230 1090 340 1230 304 1432 Z" fill={MINT.ring} />
    <path d="M 150 1108 C 300 1180 326 1330 304 1432 L 186 1432 C 236 1300 206 1190 150 1108 Z" fill={MINT.floorEdge} opacity={0.55} />
    <path d="M -130 1190 C -50 1240 40 1250 130 1196" stroke={MINT.floorEdge} strokeWidth={8} strokeLinecap="round" fill="none" />
    <path d="M -180 1150 C -130 1110 -60 1096 0 1094" stroke={WHITE} strokeWidth={14} strokeLinecap="round" fill="none" opacity={0.3} />
    {/* the game controller lying on the beanbag */}
    <g transform="translate(70 1056) rotate(-8)">
      <circle cx={-84} cy={22} r={48} fill={G1} /><circle cx={84} cy={22} r={48} fill={G1} />
      <rect x={-118} y={-46} width={236} height={92} rx={42} fill={G1} />
      <rect x={-118} y={-46} width={236} height={26} rx={13} fill={G2} opacity={0.45} />
      <rect x={-92} y={-12} width={44} height={12} rx={5} fill={WHITE} /><rect x={-76} y={-28} width={12} height={44} rx={5} fill={WHITE} />
      {[[70, -26, YELLOW], [86, -8, HOT2], [54, -8, STEAM], [70, 10, G3]].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r={9} fill={c as string} />)}
    </g>
    {/* the wooden crate that holds the phone: lid, slatted body, two posts */}
    <rect x={330} y={1222} width={420} height={FLOOR_Y - 1222} fill={COFFEE_LIGHT} />
    {[1262, 1322, 1382].map((y) => <rect key={y} x={330} y={y} width={420} height={14} fill={COFFEE} opacity={0.45} />)}
    <rect x={330} y={1222} width={34} height={FLOOR_Y - 1222} fill={COFFEE} opacity={0.4} /><rect x={716} y={1222} width={34} height={FLOOR_Y - 1222} fill={COFFEE} opacity={0.4} />
    <rect x={310} y={1190} width={460} height={34} rx={8} fill={PLASTER} />
    <rect x={310} y={1210} width={460} height={14} rx={7} fill={COFFEE_LIGHT} opacity={0.6} />
  </g>
);
const Stand: React.FC = () => (
  <g>
    <path d="M 452 1130 L 628 1130 L 668 1190 L 412 1190 Z" fill={G2} />
    <path d="M 452 1130 L 628 1130 L 636 1146 L 444 1146 Z" fill={G3} opacity={0.6} />
  </g>
);
/** The soft pad (a mattress slab with stitches) that slides in under the phone: it holds the heat in. */
const Pad: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0.01) return null;
  return (
    <g opacity={p} transform={`translate(${(1 - p) * 320} 0)`}>
      <rect x={300} y={1165} width={480} height={44} rx={22} fill={PEACH.floorEdge} />
      <rect x={300} y={1165} width={480} height={30} rx={15} fill={PEACH.ring} />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={350 + i * 90} y={1176} width={34} height={6} rx={3} fill={WHITE} opacity={0.7} />)}
    </g>
  );
};

/* ---------- the phone ---------- */
const wrapX = (x0: number, off: number) => ((((x0 - off) % 800) + 800) % 800) - 400;

const Front: React.FC<{ amb: number; dim: number; pause: number }> = ({ amb, dim, pause }) => {
  const a = dim > 0.3 ? Math.floor(amb * 240) / 240 : amb;           // frames drop: the picture moves in steps
  const off = a * 18 * 800, bob = Math.sin(a * TAU * 120) * 7;
  return (
    <g>
      <rect x={-400} y={-180} width={800} height={360} rx={56} fill={G1} />
      <rect x={-400} y={-180} width={800} height={20} rx={10} fill={G2} opacity={0.5} />
      <circle cx={-388} cy={0} r={7} fill={G2} />
      <clipPath id="scr"><rect x={-370} y={-150} width={740} height={300} rx={28} /></clipPath>
      <g clipPath="url(#scr)">
        <rect x={-380} y={-160} width={760} height={320} fill={STEAM} />
        <circle cx={250} cy={-90} r={34} fill={YELLOW} />
        <path d="M -380 70 C -300 -40 -200 -40 -120 70 Z" fill={G4} opacity={0.9} /><path d="M -60 70 C 40 -70 160 -50 230 70 Z" fill={G4} opacity={0.9} />
        <rect x={-380} y={70} width={760} height={90} fill={MINT.ring} /><rect x={-380} y={70} width={760} height={14} fill={MINT.floorEdge} />
        {[-400, -320, -240, -160, -80, 0, 80, 160, 240, 320].map((x) => <rect key={x} x={wrapX(x, off % 80)} y={112} width={44} height={8} rx={4} fill={MINT.floorEdge} />)}
        {[170, 480].map((x, i) => (
          <g key={x} transform={`translate(${wrapX(x, off)} 0)`}>
            <rect x={-26} y={20 + i * 8} width={52} height={50 - i * 8} fill={METAL} /><rect x={-34} y={12 + i * 8} width={68} height={20} rx={6} fill={G3} />
          </g>
        ))}
        {[40, 140, 640].map((x) => <circle key={x} cx={wrapX(x, off)} cy={-26 + (x % 3) * 8} r={13} fill={YELLOW} />)}
        <g transform={`translate(-170 ${bob})`}>
          <rect x={-24} y={20} width={14} height={34} rx={6} fill={G1} /><rect x={8} y={20} width={14} height={34} rx={6} fill={G1} transform={`translate(0 ${Math.sin(a * TAU * 240) * 4})`} />
          <rect x={-28} y={-34} width={56} height={62} rx={16} fill={WHITE} /><rect x={4} y={-34} width={24} height={62} rx={12} fill={G4} />
        </g>
        <rect x={-380} y={-160} width={760} height={320} fill={BLACK} opacity={dim * 0.5} />
        {pause > 0.01 && (
          <g opacity={pause}>
            <rect x={-380} y={-160} width={760} height={320} fill={BLACK} opacity={0.35} />
            <rect x={-44} y={-44} width={26} height={88} rx={8} fill={WHITE} /><rect x={18} y={-44} width={26} height={88} rx={8} fill={WHITE} />
          </g>
        )}
      </g>
    </g>
  );
};

const Cell: React.FC<{ i: number; clock: number }> = ({ i, clock }) => {
  const f = clamp01((clock - (CELL_A + i * CELL_STEP)) / 0.5);
  const age = i >= 4 ? clamp01((clock - (AGE.a + (5 - i) * AGE.step)) / 0.7) : 0;
  const x = -300 + i * 65;
  return (
    <g>
      <rect x={x} y={-88} width={55} height={176} rx={10} fill={G3} />
      <rect x={x} y={88 - 176 * f} width={55} height={176 * f} rx={10} fill={YELLOW} />
      <rect x={x} y={88 - 176 * f} width={20} height={176 * f} rx={10} fill={WHITE} opacity={0.3} />
      {age > 0 && <rect x={x} y={-88} width={55} height={176} rx={10} fill={G2} opacity={age} />}
    </g>
  );
};

const Inside: React.FC<{ amb: number; clock: number; bat: number; chip: number; load: number }> = ({ amb, clock, bat, chip, load }) => (
  <g>
    <rect x={-400} y={-180} width={800} height={360} rx={56} fill={G1} />
    <clipPath id="bodyClip"><rect x={-376} y={-154} width={752} height={308} rx={36} /></clipPath>
    <rect x={-376} y={-154} width={752} height={308} rx={36} fill={CAVITY_SHADE} />
    {["M 120 -30 L 168 -30", "M 120 30 L 168 30", "M 292 0 L 340 0 L 340 90", "M -320 -150 L -320 -128"].map((d) => <path key={d} d={d} stroke={G2} strokeWidth={6} fill="none" />)}
    <g clipPath="url(#bodyClip)">
      {/* the battery: a flat block of six cells with a nub */}
      <rect x={-320} y={-120} width={420} height={240} rx={24} fill={WHITE} />
      <rect x={-320} y={86} width={420} height={34} rx={17} fill={G4} />
      <rect x={100} y={-34} width={24} height={68} rx={9} fill={G3} />
      {[0, 1, 2, 3, 4, 5].map((i) => <Cell key={i} i={i} clock={clock} />)}
      {/* the chip: a square package, pins on four sides, a die with its work bars */}
      {[-40, -20, 0, 20, 40].map((d) => (
        <g key={d}>
          <rect x={d + 224} y={-76} width={12} height={18} rx={3} fill={METAL} /><rect x={d + 224} y={58} width={12} height={18} rx={3} fill={METAL} />
          <rect x={160} y={d - 6} width={18} height={12} rx={3} fill={METAL} /><rect x={282} y={d - 6} width={18} height={12} rx={3} fill={METAL} />
        </g>
      ))}
      <rect x={170} y={-62} width={120} height={124} rx={16} fill={G1} />
      <rect x={170} y={-62} width={120} height={26} rx={13} fill={G2} opacity={0.55} />
      <rect x={190} y={-40} width={80} height={80} rx={10} fill={METAL} />
      {[0, 1, 2, 3].map((i) => {
        const h = 10 + 56 * load * (0.5 + 0.5 * Math.sin(amb * TAU * (90 + i * 30) + i * 1.3));
        return <rect key={i} x={200 + i * 18} y={30 - h} width={12} height={h} rx={4} fill={G1} />;
      })}
      {/* the heat of each part: three soft rings */}
      {[[-110, 0, 150, bat], [230, 0, 100, chip]].map(([cx, cy, r, h], k) => [1, 1.4, 1.9].map((m, j) => <circle key={`${k}${j}`} cx={cx as number} cy={cy as number} r={(r as number) * m * (0.95 + 0.05 * Math.sin(amb * TAU * 60 + k))} fill={RED} opacity={(h as number) * 0.15} />))}
    </g>
  </g>
);

/** The heat that waves up off the phone: dashed red lines that climb; a thick case shortens them and glows around the body (the heat is held in). */
const Waves: React.FC<{ amb: number; heat: number; cas: number; ax: number }> = ({ amb, heat, cas, ax }) => {
  const o = heat * (1 - 0.75 * cas);
  return (
    <g>
      {o > 0.01 && [-270, -135, 0, 135, 270].map((x, i) => (
        <path key={x} d={`M ${x} ${-196 - cas * 34} q ${22 + (i % 2) * 8} -28 0 -56 q -22 -28 0 -56`} stroke={RED} strokeWidth={16} strokeLinecap="round" fill="none" strokeDasharray="40 34" strokeDashoffset={-amb * 60 * 74 - i * 22} opacity={o} />
      ))}
      {cas > 0.01 && <rect x={-400} y={-180} width={800} height={360} rx={56} fill="none" stroke={RED} strokeWidth={18} opacity={heat * cas * 0.55} transform={`scale(${ax} 1)`} />}
    </g>
  );
};

/** The thick case: a ring of rubber around the body with four corner bumps; it slides over the phone and (in the tips) comes off. */
const Case: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0.01) return null;
  return (
    <g opacity={p} transform={`scale(${1 + (1 - p) * 0.3})`}>
      <path fillRule="evenodd" fill={G2} d="M -372 -212 H 372 A 76 76 0 0 1 448 -136 V 136 A 76 76 0 0 1 372 212 H -372 A 76 76 0 0 1 -448 136 V -136 A 76 76 0 0 1 -372 -212 Z M -344 -180 H 344 A 56 56 0 0 1 400 -124 V 124 A 56 56 0 0 1 344 180 H -344 A 56 56 0 0 1 -400 124 V -124 A 56 56 0 0 1 -344 -180 Z" />
      <path fillRule="evenodd" fill={G3} opacity={0.35} d="M -372 -212 H 372 A 76 76 0 0 1 448 -136 L 436 -136 A 64 64 0 0 0 372 -200 H -372 A 64 64 0 0 0 -436 -136 L -448 -136 A 76 76 0 0 1 -372 -212 Z" />
      {[[-424, -188], [424, -188], [-424, 188], [424, 188]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={24} fill={G1} />)}
    </g>
  );
};

/** A label pill in the phone's own coordinates: it pops in at a and fades out at b. */
const Tag: React.FC<{ x: number; y: number; text: string; a: number; b: number; clock: number }> = ({ x, y, text, a, b, clock }) => {
  const o = win(clock, a, b, 0.25);
  if (o <= 0.01) return null;
  const w = textWidth(text, 36) + 48, p = Math.max(0, springAt(clock, a, true));
  return (
    <g opacity={o} transform={`translate(${x} ${y}) scale(${p}) translate(${-x} ${-y})`}>
      <rect x={x - w / 2} y={y - 31} width={w} height={62} rx={31} fill={WHITE} />
      <text x={x} y={y + 13} fontSize={36} fill={BLACK} textAnchor="middle" style={BOLD}>{text}</text>
    </g>
  );
};

/** A temperature pin: a ring on a part, grey while it is cool and red once it is hot, with a leader line up (or down) to its label. */
const Pin: React.FC<{ x: number; y: number; ly: number; heat: number; clock: number; amb: number; a: number; b: number }> = ({ x, y, ly, heat, clock, amb, a, b }) => {
  const o = win(clock, a, b, 0.25);
  if (o <= 0.01) return null;
  const p = Math.max(0, springAt(clock, a, true)), hot = heat > 0.55, pulse = 1 + 0.12 * Math.sin(amb * TAU * 120);
  return (
    <g opacity={o}>
      <path d={`M ${x} ${y} L ${x} ${ly}`} stroke={WHITE} strokeWidth={6} strokeLinecap="round" />
      <g transform={`translate(${x} ${y}) scale(${p * (hot ? pulse : 1)})`}>
        <circle r={30} fill={WHITE} /><circle r={20} fill={hot ? RED : G3} />
      </g>
    </g>
  );
};

/** The cord (not flipped): from the plug at the phone's right end, down out of the frame; yellow current dots run up it while the phone charges. */
const Cord: React.FC<{ ax: number; amb: number; flow: number }> = ({ ax, amb, flow }) => {
  const x0 = 400 * ax, pt = (u: number) => { const m = 1 - u; return [m * m * m * x0 + 3 * m * m * u * 560 + 3 * m * u * u * 560 + u * u * u * 560, 3 * m * m * u * 0 + 3 * m * u * u * 300 + u * u * u * 1200, 3 * m * m * u * 0] as const; };
  return (
    <g>
      <path d={`M ${x0} 0 C 560 0 560 300 560 1200`} stroke={G1} strokeWidth={20} strokeLinecap="round" fill="none" />
      <path d={`M ${x0} -6 C 556 -6 556 300 556 1200`} stroke={G2} strokeWidth={5} fill="none" opacity={0.6} />
      <rect x={x0 - 8} y={-17} width={40} height={34} rx={9} fill={METAL} />
      {flow > 0.01 && [0, 1, 2, 3, 4, 5].map((k) => { const u = 1 - ((amb * 15 + k / 6) % 1) * 0.95, [x, y] = pt(Math.max(0.02, u)); return <circle key={k} cx={x} cy={y} r={9} fill={YELLOW} opacity={flow} />; })}
    </g>
  );
};

/* ---------- screen pieces ---------- */
const Gauge: React.FC<{ clock: number }> = ({ clock }) => {
  const o = win(clock, GAUGE.a, GAUGE.b, 0.4);
  if (o <= 0.01) return null;
  const p = tempAt(clock);
  return (
    <g opacity={o}>
      <rect x={230} y={450} width={620} height={80} rx={34} fill={WHITE} />
      <text x={266} y={506} fontSize={40} fill={BLACK} style={BOLD}>suhu HP</text>
      <rect x={484} y={477} width={332} height={28} rx={14} fill={G4} />
      <rect x={484} y={477} width={Math.max(10, 332 * p)} height={28} rx={14} fill={p < 0.5 ? YELLOW : p < 0.8 ? HOT2 : RED} />
    </g>
  );
};

const Row: React.FC<{ y: number; title: string; a: number; out: number; clock: number; bar?: number }> = ({ y, title, a, out, clock, bar }) => {
  const p = springAt(clock, a, true), o = 1 - clamp01((clock - out) / 0.4);
  if (clock < a || o <= 0.01) return null;
  const v = bar === undefined ? 1 : 1 - (1 - bar) * clamp01((clock - a - 0.5) / 1.2) * (2 - clamp01((clock - a - 0.5) / 1.2));
  return (
    <g opacity={o} transform={`translate(505 ${y + 60}) scale(${Math.max(0, p)}) translate(-505 ${-(y + 60)})`}>
      <rect x={80} y={y} width={850} height={120} rx={40} fill={WHITE} />
      <rect x={104} y={y + 28} width={12} height={64} rx={6} fill={YELLOW} />
      <text x={142} y={y + 78} fontSize={50} fill={BLACK} style={bold(700)}>{title}</text>
      {bar !== undefined && (
        <g>
          <rect x={590} y={y + 46} width={300} height={28} rx={14} fill={G4} />
          <rect x={590} y={y + 46} width={Math.max(10, 300 * v)} height={28} rx={14} fill={v > 0.6 ? YELLOW : HOT2} />
        </g>
      )}
    </g>
  );
};

/** The hook claim at frame 0: a black box per line, the key words yellow, in the top third; the last 0.5 s of the outro brings it back (B41: the loop). */
const HookText: React.FC<{ clock: number }> = ({ clock }) => {
  const o = clock > 20 ? clamp01((clock - 59.5) / 0.5) : 1 - clamp01((clock - 2.7) / 0.3);
  if (o <= 0) return null;
  const lines: [string, boolean][] = [["HP-mu", false], ["melawan", false], ["dirinya sendiri", true]];
  return (
    <g opacity={o}>
      {lines.map(([ln, key], i) => (
        <g key={ln}>
          <rect x={SAFE.left} y={225 + i * 160} width={textWidth(ln, 120) + 60} height={140} rx={26} fill={BLACK} />
          <text x={SAFE.left + 30} y={225 + i * 160 + 105} fontSize={120} fill={key ? YELLOW : WHITE} style={bold(800)}>{ln}</text>
        </g>
      ))}
    </g>
  );
};

const Scene = ({ beat, t, clock, story }: SceneProps) => {
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const amb = loopClock(clock, total, 60) / 60;                       // 0..1 over the loop
  const cam = camAt(clock), set = setAt(clock), flip = flipAt(clock), cas = caseAt(clock), pad = padAt(clock), dim = dimAt(clock);
  const bat = batHeatAt(clock), chip = chipHeatAt(clock), front = frontHeatAt(clock), load = loadAt(clock);
  const sx = Math.cos(flip * Math.PI), ax = Math.max(0.02, Math.abs(sx)), inside = sx < 0;
  const heat = inside ? Math.max(bat, chip) * 0.75 : front;
  const flow = win(clock, FLOW.a, FLOW.b, 0.3);
  const pause = win(clock, PAUSE, 58.0, 0.4);
  const sting = beat.kind === "sting", outro = beat.kind === "outro", hook = beat.kind === "hook";
  const L = LABELS, TOPY = -224;
  const motes = [[120, 760, 5], [300, 1100, 6], [820, 840, 4], [960, 1180, 6], [560, 700, 4], [700, 1260, 5]];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill={HOT2} />
      <g opacity={set}><g transform={layerTx(cam, 0.5)}><Wall amb={amb} /></g></g>
      <g transform={layerTx(cam, 1)}>
        <g opacity={set}><Corner /><Stand /></g>
        <g opacity={set}><Pad p={pad} /></g>
        <g transform="translate(540 960)">
          <Cord ax={ax} amb={amb} flow={flow} />
          <g transform={`scale(${ax} 1)`}>{inside ? <Inside amb={amb} clock={clock} bat={bat} chip={chip} load={load} /> : <Front amb={amb} dim={dim} pause={pause} />}</g>
          <Waves amb={amb} heat={heat} cas={cas} ax={ax} />
          <g transform={`scale(${ax} 1)`}><Case p={cas} /></g>
          {/* the labels and the sensor pins sit on the phone, above its top edge or below it, never over the top text */}
          <Tag x={-110} y={TOPY} text="baterai" a={L.bat.a} b={L.bat.b} clock={clock} />
          <Tag x={230} y={TOPY} text="game berat" a={L.game.a} b={L.game.b} clock={clock} />
          <Tag x={0} y={-276} text="casing tebal" a={L.casing.a} b={L.casing.b} clock={clock} />
          <Tag x={0} y={274} text="kasur empuk" a={L.kasur.a} b={L.kasur.b} clock={clock} />
          <Tag x={-215} y={TOPY} text="baterai" a={L.pins.a} b={L.pins.b} clock={clock} />
          <Tag x={270} y={TOPY} text="chip" a={L.pins.a} b={L.pins.b} clock={clock} />
          <Tag x={330} y={222} text="bodi" a={L.pins.a} b={L.pins.b} clock={clock} />
          <Tag x={-110} y={TOPY} text="umur memendek" a={L.umur.a} b={L.umur.b} clock={clock} />
          {inside && (
            <g>
              <Pin x={-215} y={-88} ly={TOPY + 31} heat={bat} clock={clock} amb={amb} a={L.pins.a} b={L.pins.b} />
              <Pin x={270} y={-58} ly={TOPY + 31} heat={chip} clock={clock} amb={amb} a={L.pins.a} b={L.pins.b} />
              <Pin x={330} y={130} ly={222 - 31} heat={Math.max(bat, chip)} clock={clock} amb={amb} a={L.pins.a} b={L.pins.b} />
              {[[32.4, 34.6], [47.0, 49.6]].map(([a, b]) => {
                const o = win(clock, a, b, 0.3);
                return o > 0.01 ? <path key={a} d="M 230 -108 L 262 -62 L 198 -62 Z" fill={RED} opacity={o} transform={`translate(0 ${Math.sin(clock * 6) * 4})`} /> : null;
              })}
            </g>
          )}
        </g>
      </g>
      <g opacity={set} transform={layerTx(cam, 1.3)}>
        {motes.map(([x, y, r], i) => <circle key={i} cx={x + Math.sin(amb * TAU * 6 + i) * 18} cy={y + Math.cos(amb * TAU * 5 + i * 2) * 22} r={r} fill={WHITE} opacity={0.55} />)}
      </g>
      <Gauge clock={clock} />
      {RESULT.map((r, i) => <Row key={i} y={1010 + i * 140} title={["Layar redup", "Frame turun", "Cas melambat"][i]} a={r.a} out={RESULT_OUT} clock={clock} bar={r.to} />)}
      {TIPS.map((r, i) => <Row key={i} y={1010 + i * 140} title={["Lepas casing tebal", "Jangan cas di kasur", "Jeda game, biar dingin"][i]} a={r.a} out={TIPS_OUT} clock={clock} />)}
      {(hook || outro) && <HookText clock={clock} />}
      {sting && <StingMark slug="kenapa-hp-panas-dicas-sambil-m" t={t} clock={clock} />}
      {!hook && !sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {!hook && !sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
