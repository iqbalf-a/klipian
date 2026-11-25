/* Nasi di rice cooker warm seharian bisa basi? — look 2d (B28): a rice cooker cut open in front view (the shell, the inner bowl with rice, the heating plate, the sensor, the
   closed lid with its vent: B39, every part real) stands on a counter against a cream tiled wall (set kind "counter-rice-section", see set.json). The explainers are a rounded
   card with a magnified rice grain and its spores (never a disc, B35) and a thermometer. The story: the spores survive the cooking, they sleep while the rice stays above 60 °C,
   they wake and make toxin when it falls into the warm zone (5 to 60 °C), and reheating does not remove the toxin, nor does the rice look different. Real shapes (B27.16):
   a rice cooker has a domed lid with a steam vent, a metal bowl on a heating plate with a thermostat button, a lamp and a lever on the front; a rice grain is a long oval with a
   shallow groove; a bacterium rod is a short capsule. Two tones per part (base and shade, light from the top left), no outlines but highlight rings, palette tokens only.
   Ambient motion (steam, glow, breath, towel) runs on the loop now (B29). The last frame is the first frame (the loop). */
import React from "react";
import {
  loopClock, BLACK, CaptionLayer, FONT_BOLD, FONT_MONO, G1, G2, G3, G4, HOT1, HOT2, METAL, PLASTER, RED, SAFE, StoryVideo, THEMES, TopText, WHITE, YELLOW,
  clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { WIDTHS } from "../../src/fontMetrics.ts";
import storyJson from "./story.json";
import {
  CARD, CRACK, DOUBLE, DROPS, FLAME, PILLS, RACUN_CARDS, SPLIT, STAMP, THERMO, TIP_CARDS, camAt, degAt, heatAt, lampAt, setAt,
} from "./plan.ts";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920, TAU = Math.PI * 2;
const KICKER: Record<string, string> = { spora: "SOAL SPORA", panas: "SAAT MASIH PANAS", turun: "SAAT SUHU TURUN", racun: "RACUNNYA", tips: "JADI" };
const WALL = THEMES.cream.wall, TILE = THEMES.cream.ring, GROUT = THEMES.cream.floorEdge;
const bold = (w = 700) => ({ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: w }) as const;
const mono = { fontFamily: `"${FONT_MONO}", monospace`, fontWeight: 500 } as const;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const textW = (s: string, fs: number) => [...s].reduce((a, c) => a + (WIDTHS[c] ?? 0.572), 0) * fs;

/* ---------- the rice: a mass with white grains, made once ---------- */
const hw = (y: number) => 332 - (y + 150) / 3;                       // half width of the inner bowl at height y
const mound = (x: number) => -92 - 58 * (1 - Math.min(1, (x / 300) ** 2));
const GRAINS: { x: number; y: number; r: number }[] = (() => {
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 900 && out.length < 190; i++) {
    const x = (rnd() * 2 - 1) * 320, y = -150 + rnd() * 316;
    if (Math.abs(x) < hw(y) - 26 && y > mound(x) + 10 && y < 150) out.push({ x, y, r: (rnd() - 0.5) * 150 });
  }
  return out;
})();

/** One rice grain: a long oval with a shallow groove and a shade on its lower side. */
const Grain: React.FC<{ x: number; y: number; r: number; k?: number }> = ({ x, y, r, k = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${k})`}>
    <ellipse cx={2} cy={2} rx={15} ry={6.4} fill={G3} opacity={0.55} />
    <ellipse cx={0} cy={0} rx={15} ry={6.4} fill={WHITE} />
    <path d="M -9 0.4 C -3 -1 4 -1 10 0.4" stroke={G3} strokeWidth={1.6} strokeLinecap="round" fill="none" />
  </g>
);

/* ---------- the rice cooker, cut open in front view, 780 px wide and 630 high around (0,0) ---------- */
const Cooker: React.FC<{ amb: number; heat: number; lamp: number }> = ({ amb, heat, lamp }) => {
  const glow = 0.55 + 0.45 * Math.sin(amb * TAU * 20);
  const steam = (i: number) => {
    const u = (amb * 20 + i / 3) % 1, x0 = -6 + i * 6, y0 = -344 - u * 120;
    return <path key={i} d={`M ${x0} -344 C ${x0 + 16 * Math.sin(u * 5 + i)} ${-344 - u * 45} ${x0 - 16 * Math.sin(u * 5 + i)} ${-344 - u * 85} ${x0} ${y0}`} stroke={WHITE} strokeWidth={14 - i * 2} strokeLinecap="round" fill="none" opacity={0.7 * Math.sin(Math.PI * u)} />;
  };
  return (
    <g>
      {/* feet and the shell's cut walls */}
      <rect x={-320} y={296} width={90} height={24} rx={9} fill={G2} /><rect x={230} y={296} width={90} height={24} rx={9} fill={G2} />
      <rect x={-380} y={-150} width={760} height={450} rx={44} fill={G2} />
      <rect x={-380} y={-150} width={42} height={450} rx={20} fill={WHITE} /><rect x={338} y={-150} width={42} height={450} rx={20} fill={WHITE} />
      <rect x={-338} y={-150} width={10} height={380} fill={G4} /><rect x={328} y={-150} width={10} height={380} fill={G3} />
      <rect x={-380} y={228} width={760} height={72} rx={30} fill={WHITE} />
      <rect x={-352} y={284} width={704} height={16} rx={8} fill={G4} />
      {/* the front panel: the warm lamp and the lever */}
      <circle cx={-290} cy={262} r={14} fill={lamp > 0.5 ? HOT2 : G3} />
      {lamp > 0.5 && <circle cx={-290} cy={262} r={24 + 5 * glow} fill={HOT2} opacity={0.22} />}
      <rect x={-210} y={252} width={86} height={22} rx={11} fill={G3} /><rect x={lamp > 0.5 ? -168 : -210} y={248} width={44} height={30} rx={13} fill={G1} />
      {/* the heating plate with its coil, the sensor button and its spring */}
      <rect x={-250} y={188} width={500} height={34} rx={12} fill={METAL} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <rect key={i} x={-226 + i * 54} y={202} width={34} height={7} rx={3} fill={G2} opacity={0.7} />)}
      <rect x={-250} y={188} width={500} height={34} rx={12} fill={HOT1} opacity={0.75 * heat * glow} />
      <rect x={-250} y={216} width={500} height={10} rx={5} fill={G2} opacity={0.4} />
      <rect x={-26} y={150} width={52} height={40} rx={10} fill={METAL} /><rect x={-26} y={176} width={52} height={14} rx={7} fill={G2} opacity={0.5} />
      <path d="M -14 150 L 14 142 L -14 134 L 14 126 L -14 118" stroke={G2} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* the inner bowl: a metal wall, a light lining, a rim */}
      <path d={`M -332 -150 L 332 -150 L ${hw(150)} 150 Q ${hw(150) - 12} 172 ${hw(150) - 44} 172 L ${-hw(150) + 44} 172 Q ${-hw(150) + 12} 172 ${-hw(150)} 150 Z`} fill={G3} />
      <path d={`M -318 -150 L 318 -150 L ${hw(150) - 14} 150 Q ${hw(150) - 24} 158 ${hw(150) - 50} 158 L ${-hw(150) + 50} 158 Q ${-hw(150) + 24} 158 ${-hw(150) + 14} 150 Z`} fill={G4} />
      <path d={`M 332 -150 L ${hw(150)} 150 Q ${hw(150) - 12} 172 ${hw(150) - 44} 172 L ${hw(150) - 70} 172 L 300 -150 Z`} fill={G2} opacity={0.22} />
      <rect x={-356} y={-160} width={712} height={16} rx={8} fill={METAL} />
      {/* the rice: the mass, the mound, the grains */}
      <path d={`M ${-hw(150) + 18} 154 L ${-hw(-92) + 14} -92 C -280 -150 -120 -156 0 -152 C 120 -156 280 -150 ${hw(-92) - 14} -92 L ${hw(150) - 18} 154 Z`} fill={G4} />
      {GRAINS.map((g, i) => <Grain key={i} x={g.x} y={g.y} r={g.r} k={1.35} />)}
      {/* the lid: a hollow dome with a steam vent on top */}
      <path d="M -392 -150 C -392 -300 -200 -312 0 -312 C 200 -312 392 -300 392 -150 Z" fill={WHITE} />
      <path d="M -350 -166 C -350 -272 -190 -284 0 -284 C 190 -284 350 -272 350 -166 Z" fill={G4} />
      <path d="M -392 -150 C -392 -170 -380 -186 -366 -196 L -350 -166 L -350 -150 Z" fill={G3} opacity={0.5} />
      <path d="M -330 -200 C -300 -260 -190 -296 -60 -300 C -170 -280 -270 -250 -312 -190 Z" fill={WHITE} opacity={0.5} />
      <rect x={-380} y={-170} width={760} height={20} rx={8} fill={METAL} />
      <rect x={-36} y={-344} width={72} height={46} rx={14} fill={G3} /><rect x={-36} y={-344} width={30} height={46} rx={14} fill={WHITE} opacity={0.45} />
      <rect x={-14} y={-326} width={28} height={8} rx={4} fill={G2} />
      {[0, 1, 2].map(steam)}
    </g>
  );
};

/* ---------- the set: a cream tiled wall, a counter, a sack of rice, a rail with a ladle, a paddle and a towel ---------- */
const COUNTER_Y = 1320;
const Set: React.FC<{ amb: number }> = ({ amb }) => {
  const sway = Math.sin(amb * TAU * 8) * 2.2;
  return (
    <g>
      <rect x={-1400} y={-1400} width={3800} height={COUNTER_Y + 1400} fill={WALL} />
      {/* the tile band: tiles with grout lines */}
      <rect x={-1400} y={560} width={3800} height={COUNTER_Y - 560} fill={TILE} />
      {Array.from({ length: 60 }, (_, i) => <rect key={`v${i}`} x={-1400 + i * 64} y={560} width={3} height={COUNTER_Y - 560} fill={GROUT} opacity={0.7} />)}
      {Array.from({ length: 13 }, (_, i) => <rect key={`h${i}`} x={-1400} y={560 + i * 64} width={3800} height={3} fill={GROUT} opacity={0.7} />)}
      <rect x={-1400} y={552} width={3800} height={12} fill={GROUT} />
      {/* the rail with a ladle, a rice paddle and a towel */}
      <rect x={-60} y={494} width={290} height={12} rx={6} fill={G2} />
      {[-40, 210].map((x) => <circle key={x} cx={x} cy={500} r={11} fill={G1} />)}
      <g transform={`translate(10 506) rotate(${sway * 0.5})`}>
        <rect x={-5} y={0} width={10} height={196} rx={5} fill={G2} />
        <path d="M -36 196 C -36 270 36 270 36 196 Z" fill={METAL} /><path d="M 0 196 C 0 262 36 262 36 196 Z" fill={G3} />
      </g>
      <g transform={`translate(82 506) rotate(${-sway * 0.6})`}>
        <rect x={-6} y={0} width={12} height={150} rx={6} fill={PLASTER} /><rect x={-6} y={0} width={5} height={150} rx={3} fill={WHITE} opacity={0.5} />
        <path d="M -34 150 C -34 130 34 130 34 150 L 30 250 C 28 262 -28 262 -30 250 Z" fill={WHITE} /><path d="M 0 140 L 34 150 L 30 250 C 28 262 10 262 0 258 Z" fill={G4} />
      </g>
      <g transform={`translate(158 506) rotate(${sway})`}>
        <rect x={-48} y={0} width={96} height={190} rx={8} fill={HOT2} />
        <rect x={-48} y={0} width={96} height={190} rx={8} fill={WHITE} opacity={0.25} />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={-48} y={34 + i * 38} width={96} height={12} fill={WHITE} opacity={0.65} />)}
        <path d="M 48 0 L 48 190 L 30 190 L 30 0 Z" fill={G1} opacity={0.12} />
      </g>
      {/* the counter slab and its front with two drawer fronts */}
      <rect x={-1400} y={COUNTER_Y} width={3800} height={64} fill={PLASTER} />
      <rect x={-1400} y={COUNTER_Y} width={3800} height={14} fill={WHITE} opacity={0.5} />
      <rect x={-1400} y={COUNTER_Y + 50} width={3800} height={14} fill={GROUT} />
      <rect x={-1400} y={COUNTER_Y + 64} width={3800} height={1000} fill={G3} />
      {[-120, 660].map((x) => (
        <g key={x}>
          <rect x={x} y={COUNTER_Y + 100} width={680} height={260} rx={18} fill={G4} />
          <rect x={x} y={COUNTER_Y + 100} width={680} height={20} rx={10} fill={WHITE} opacity={0.6} />
          <rect x={x + 250} y={COUNTER_Y + 160} width={180} height={18} rx={9} fill={G2} />
        </g>
      ))}
      {/* the sack of rice, cut by the left edge, with its tied neck */}
      <g>
        <path d={`M -200 ${COUNTER_Y} C -216 1180 -204 1090 -180 1010 L 40 1010 C 70 1100 60 1200 52 ${COUNTER_Y} Z`} fill={PLASTER} />
        <path d={`M -40 ${COUNTER_Y} C -30 1200 -40 1100 -30 1010 L 40 1010 C 70 1100 60 1200 52 ${COUNTER_Y} Z`} fill={GROUT} opacity={0.55} />
        <path d="M -180 1010 C -150 960 -40 960 0 1010 Z" fill={PLASTER} /><path d="M -70 982 C -40 958 -10 960 0 1010 L -40 1010 Z" fill={GROUT} opacity={0.5} />
        <rect x={-120} y={1002} width={114} height={16} rx={8} fill={G2} />
        <text x={-70} y={1190} fontSize={64} fill={G1} textAnchor="middle" style={bold(800)}>BERAS</text>
        <rect x={-150} y={1214} width={160} height={8} rx={4} fill={G1} opacity={0.5} />
      </g>
    </g>
  );
};

/* ---------- a spore: a dark shell, a light body, a core; it cracks open into a rod in "turun" ---------- */
const Spore: React.FC<{ x: number; y: number; now: number; i: number; amb: number }> = ({ x, y, now, i, amb }) => {
  const c0 = CRACK + i * 0.25, open = clamp01((now - c0) / 0.6);
  const rods = now >= SPLIT ? (now >= DOUBLE ? 4 : 2) : (open > 0 ? 1 : 0);
  const wob = Math.sin(amb * TAU * 12 + i * 2) * 2;
  const rod = (k: number, n: number) => {
    const born = k === 0 ? c0 + 0.3 : k === 1 ? SPLIT + i * 0.1 : DOUBLE + i * 0.1 + (k - 2) * 0.1;
    const g = Math.max(0, springAt(now, born, true));
    const ang = [-8, 14, -26, 30][k] + Math.sin(amb * TAU * 16 + k * 1.3 + i) * 5;
    const dx = [0, 0, -8, 10][k], dy = (n > 1 && k < 2 ? (k % 2 ? 22 : -22) : 0) + (k >= 2 ? (k === 2 ? -48 : 48) : 0);
    return <g key={k} transform={`translate(${dx} ${dy}) rotate(${ang}) scale(${g})`}><rect x={-34} y={-11} width={68} height={22} rx={11} fill={RED} /><rect x={-34} y={-11} width={68} height={9} rx={5} fill={WHITE} opacity={0.3} /></g>;
  };
  return (
    <g transform={`translate(${x} ${y + wob})`}>
      {open < 0.05 ? (
        <g>
          <ellipse cx={0} cy={0} rx={38} ry={25} fill={G2} />
          <ellipse cx={-4} cy={-3} rx={29} ry={17} fill={G3} />
          {[-14, 0, 14].map((rx) => <path key={rx} d={`M ${rx} -14 C ${rx + 4} -5 ${rx + 4} 5 ${rx} 14`} stroke={G2} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.7} />)}
        </g>
      ) : (
        <g>
          <g transform={`translate(${-open * 14} ${-open * 6}) rotate(${-open * 22})`}><path d="M -38 0 A 38 25 0 0 1 38 0 Z" fill={G2} /></g>
          <g transform={`translate(${open * 14} ${open * 6}) rotate(${open * 22})`}><path d="M -38 0 A 38 25 0 0 0 38 0 Z" fill={G2} /></g>
          {Array.from({ length: rods }, (_, k) => rod(k, rods))}
        </g>
      )}
    </g>
  );
};

/** The magnified card: a rounded card (B35: never a disc) with one big rice grain, three spores, a flame in spora and a "racun" tag with drops in turun. */
const Callout: React.FC<{ now: number; amb: number }> = ({ now, amb }) => {
  const p = springAt(now, CARD.a, true), out = 1 - clamp01((now - CARD.b) / 0.35);
  if (now < CARD.a || out <= 0) return null;
  const cx = 730, cy = 470, flame = win(now, FLAME.a, FLAME.b, 0.3), fu = clamp01((now - FLAME.a) / 1.4);
  const fx = -230 + 130 * fu + Math.sin(now * 20) * 3, fl = 1 + 0.12 * Math.sin(now * 24);
  const hit = clamp01((now - (FLAME.a + 1.3)) / 0.5) * (1 - clamp01((now - FLAME.b) / 0.4));
  const drops = clamp01((now - DROPS) / 0.4);
  return (
    <g opacity={out}>
      {/* the leader to a grain of the rice in the bowl, with a ring on that grain */}
      <path d="M 494 646 L 372 896" stroke={YELLOW} strokeWidth={6} strokeLinecap="round" opacity={clamp01(p)} />
      <circle cx={360} cy={906} r={24} fill="none" stroke={YELLOW} strokeWidth={6} opacity={clamp01(p)} />
      <g transform={`translate(${cx} ${cy}) scale(${Math.max(0, p) * 1.1}) translate(${-cx} ${-cy})`}>
        <rect x={cx - 215} y={cy - 160} width={430} height={320} rx={46} fill={WHITE} />
        <rect x={cx - 215} y={cy + 100} width={430} height={60} rx={30} fill={G4} />
        <rect x={cx - 192} y={cy - 138} width={384} height={276} rx={32} fill={G4} />
        <text x={cx - 172} y={cy - 104} fontSize={26} fill={G2} style={mono}>DIPERBESAR</text>
        {/* the grain, large */}
        <g transform={`translate(${cx} ${cy + 10}) rotate(-8)`}>
          <ellipse cx={4} cy={8} rx={164} ry={72} fill={G3} opacity={0.6} />
          <ellipse cx={0} cy={0} rx={164} ry={72} fill={WHITE} />
          <path d="M -120 4 C -50 -8 50 -8 124 4" stroke={G3} strokeWidth={7} strokeLinecap="round" fill="none" />
          <path d="M -140 -28 C -110 -52 -40 -62 20 -60" stroke={WHITE} strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.6} />
        </g>
        {[[-84, 4], [10, 22], [96, -2]].map(([x, y], i) => <Spore key={i} x={cx + x} y={cy + y} now={now} i={i} amb={amb} />)}
        {/* the flame of cooking hits the spores and they stay shut: a shield ring, not a change */}
        {flame > 0.01 && (
          <g opacity={flame}>
            <g transform={`translate(${cx + fx} ${cy - 40}) scale(${fl})`}>
              <path d="M 0 -64 C 30 -30 52 -8 40 28 C 30 52 -30 52 -40 28 C -52 -8 -22 -36 0 -64 Z" fill={HOT2} />
              <path d="M 0 -22 C 16 -4 26 8 18 30 C 10 42 -10 42 -18 30 C -26 8 -10 -8 0 -22 Z" fill={YELLOW} />
            </g>
            {hit > 0 && [0, 1].map((k) => <ellipse key={k} cx={cx + 10} cy={cy + 10} rx={150 + ((now * 90 + k * 45) % 90)} ry={70 + ((now * 40 + k * 20) % 40)} fill="none" stroke={G3} strokeWidth={5} opacity={hit * (1 - ((now * 90 + k * 45) % 90) / 90) * 0.9} />)}
          </g>
        )}
        {drops > 0 && [0, 1, 2, 3, 4].map((k) => {
          const u = (now - DROPS - k * 0.18) % 1.5, ok = now > DROPS + k * 0.18, y = cy + 40 + clamp01(u / 1.5) * 90;
          return ok && <path key={k} d={`M ${cx - 150 + k * 74} ${y - 22} C ${cx - 132 + k * 74} ${y} ${cx - 130 + k * 74} ${y + 16} ${cx - 150 + k * 74} ${y + 16} C ${cx - 170 + k * 74} ${y + 16} ${cx - 168 + k * 74} ${y} ${cx - 150 + k * 74} ${y - 22} Z`} fill={HOT2} opacity={0.95 * Math.min(1, drops)} />;
        })}
        {drops > 0 && (
          <g transform={`translate(${cx + 110} ${cy - 118}) scale(${Math.max(0, springAt(now, DROPS, true))}) translate(${-(cx + 110)} ${-(cy - 118)})`}>
            <rect x={cx + 40} y={cy - 148} width={140} height={54} rx={27} fill={RED} />
            <text x={cx + 110} y={cy - 110} fontSize={36} fill={WHITE} textAnchor="middle" style={bold(700)}>racun</text>
          </g>
        )}
      </g>
    </g>
  );
};

/* ---------- the thermometer: a glass tube, red mercury and a bulb, ticks, the 60 line and the 5 to 60 band ---------- */
const TX = 925, TY0 = 1256, DEGPX = 4.8;
const degY = (d: number) => TY0 - d * DEGPX;
const Thermo: React.FC<{ now: number }> = ({ now }) => {
  const on = win(now, THERMO.a, THERMO.out, 0.4), on2 = win(now, THERMO.again, THERMO.out2, 0.4);
  const o = Math.max(on, on2);
  if (o <= 0.01) return null;
  const d = degAt(now), top = degY(d);
  const band = win(now, PILLS.cold.a - 0.4, PILLS.cold.b, 0.4);
  const pop = (a: number, b: number) => win(now, a, b, 0.25);
  const pillA = pop(PILLS.hot.a, PILLS.hot.b), pillB = pop(PILLS.cold.a, PILLS.cold.b), pillC = pop(PILLS.tip.a, PILLS.tip.b);
  const txt = pillB > 0.01 ? "5–60 °C" : "60 °C";
  const pa = Math.max(pillA, pillB, pillC);
  const pc = pillB > 0.01 ? RED : YELLOW, pt = pillB > 0.01 ? WHITE : BLACK;
  return (
    <g opacity={o}>
      {band > 0.01 && <rect x={TX - 56} y={degY(60)} width={112} height={degY(5) - degY(60)} rx={10} fill={HOT2} opacity={0.3 * band} />}
      <rect x={TX - 26} y={degY(100)} width={52} height={TY0 - degY(100) + 18} rx={26} fill={WHITE} />
      <circle cx={TX} cy={TY0 + 40} r={50} fill={WHITE} />
      <rect x={TX - 14} y={degY(100) + 12} width={10} height={TY0 - degY(100) - 6} rx={5} fill={G4} />
      {[0, 20, 40, 60, 80, 100].map((v) => <rect key={v} x={TX + 30} y={degY(v) - 2} width={v === 60 ? 34 : 22} height={v === 60 ? 6 : 4} rx={2} fill={v === 60 ? YELLOW : G2} />)}
      <circle cx={TX} cy={TY0 + 40} r={38} fill={RED} />
      <rect x={TX - 11} y={top} width={22} height={TY0 + 20 - top} rx={11} fill={RED} />
      <circle cx={TX - 12} cy={TY0 + 28} r={9} fill={WHITE} opacity={0.4} />
      <rect x={TX - 56} y={degY(60) - 2.5} width={112} height={5} rx={2.5} fill={YELLOW} />
      {pa > 0.01 && (
        <g transform={`translate(${TX} 690) scale(${Math.max(0, pa)}) translate(${-TX} -690)`}>
          <rect x={TX - textW(txt, 44) / 2 - 28} y={654} width={textW(txt, 44) + 56} height={70} rx={35} fill={pc} />
          <text x={TX} y={703} fontSize={44} fill={pt} textAnchor="middle" style={bold(800)}>{txt}</text>
        </g>
      )}
    </g>
  );
};

/** A small bowl of rice seen from the side (the "tampak normal" card). */
const RiceBowl: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M -110 0 C -90 -86 -30 -126 0 -126 C 30 -126 90 -86 110 0 Z" fill={G4} />
    {[[-60, -34, -20], [-20, -64, 14], [24, -74, -30], [62, -34, 18], [4, -30, 6], [-36, -12, 28], [44, -10, -8], [-6, -92, 24], [76, -18, 30], [-84, -14, -4]].map(([gx, gy, r], i) => <Grain key={i} x={gx} y={gy} r={r} k={1.15} />)}
    <path d="M -128 -4 L 128 -4 C 124 56 70 84 0 84 C -70 84 -124 56 -128 -4 Z" fill={G2} />
    <path d="M -128 -4 L -20 -4 C -30 70 -60 84 -80 80 C -110 66 -124 40 -128 -4 Z" fill={G3} opacity={0.7} />
    <rect x={-130} y={-12} width={260} height={14} rx={7} fill={METAL} />
  </g>
);

/** The two cards of racun: reheated rice still carries the toxin; the rice looks the same. */
const ResultCards: React.FC<{ now: number; amb: number }> = ({ now, amb }) => {
  const card = (k: number, x: number, w: number, title: string, sub: string, body: React.ReactNode) => {
    const a = RACUN_CARDS[k].a, out = 1 - clamp01((now - RACUN_CARDS[k].out) / 0.4), p = springAt(now, a, true);
    if (now < a || out <= 0) return null;
    const y = 1110, h = 370;
    return (
      <g key={k} opacity={out} transform={`translate(${x + w / 2} ${y + h / 2}) scale(${Math.max(0, p)}) translate(${-(x + w / 2)} ${-(y + h / 2)})`}>
        <rect x={x} y={y} width={w} height={h} rx={44} fill={WHITE} />
        <rect x={x + 26} y={y + 26} width={w - 52} height={206} rx={30} fill={G4} />
        {body}
        <text x={x + w / 2} y={y + 284} fontSize={44} fill={BLACK} textAnchor="middle" style={bold(800)}>{title}</text>
        <text x={x + w / 2} y={y + 332} fontSize={34} fill={G1} textAnchor="middle" style={bold(600)}>{sub}</text>
      </g>
    );
  };
  const left = 60 + 205, right = 540 + 195;
  const fl = 1 + 0.1 * Math.sin(now * 22);
  return (
    <g>
      {card(0, 60, 410, "Dipanaskan ulang", "racun tetap ada", (
        <g>
          <g transform={`translate(${left - 20} 1262) scale(0.92)`}>
            <RiceBowl x={0} y={0} />
            {[[-40, -52], [16, -30], [48, -62]].map(([dx, dy], i) => <path key={i} d={`M ${dx} ${dy - 20} C ${dx + 16} ${dy} ${dx + 18} ${dy + 14} ${dx} ${dy + 14} C ${dx - 18} ${dy + 14} ${dx - 16} ${dy} ${dx} ${dy - 20} Z`} fill={RED} />)}
          </g>
          <g transform={`translate(${left + 120} 1230) scale(${0.8 * fl})`}>
            <path d="M 0 -64 C 30 -30 52 -8 40 28 C 30 52 -30 52 -40 28 C -52 -8 -22 -36 0 -64 Z" fill={HOT2} />
            <path d="M 0 -22 C 16 -4 26 8 18 30 C 10 42 -10 42 -18 30 C -26 8 -10 -8 0 -22 Z" fill={YELLOW} />
          </g>
        </g>
      ))}
      {card(1, 500, 430, "Tampak normal", "rasa dan bau sama", (
        <g>
          <g transform={`translate(${right} 1268) scale(0.92)`}><RiceBowl x={0} y={0} /></g>
          {[0, 1].map((i) => <path key={i} d={`M ${right - 20 + i * 40} 1140 C ${right - 32 + i * 40 + Math.sin(amb * TAU * 12 + i) * 6} 1132 ${right - 8 + i * 40} 1126 ${right - 20 + i * 40} 1118`} stroke={WHITE} strokeWidth={9} strokeLinecap="round" fill="none" />)}
        </g>
      ))}
    </g>
  );
};

/** The verdict stamp of a myth check: SEBAGIAN is a grey pill (B9). */
const Stamp: React.FC<{ now: number }> = ({ now }) => {
  const o = 1 - clamp01((now - STAMP.b) / 0.4), p = springAt(now, STAMP.a, false);
  if (now < STAMP.a || o <= 0) return null;
  return (
    <g opacity={o} transform={`translate(540 478) rotate(-4) scale(${Math.max(0, p)}) translate(-540 -478)`}>
      <rect x={340} y={436} width={400} height={86} rx={43} fill={G2} />
      <text x={540} y={497} fontSize={60} fill={WHITE} textAnchor="middle" style={bold(800)}>SEBAGIAN</text>
    </g>
  );
};

const TipCard: React.FC<{ y: number; title: string; sub: string; k: number; now: number }> = ({ y, title, sub, k, now }) => {
  const a = TIP_CARDS[k].a, p = springAt(now, a, true), o = 1 - clamp01((now - TIP_CARDS[k].out) / 0.4);
  if (now < a || o <= 0) return null;
  return (
    <g transform={`translate(540 ${y + 80}) scale(${Math.max(0, p)}) translate(-540 ${-(y + 80)})`} opacity={o}>
      <rect x={SAFE.left} y={y} width={SAFE.right - SAFE.left} height={160} rx={44} fill={WHITE} />
      <rect x={SAFE.left + 30} y={y + 30} width={14} height={100} rx={7} fill={YELLOW} />
      <text x={SAFE.left + 74} y={y + 80} fontSize={54} fill={BLACK} style={bold(800)}>{title}</text>
      <text x={SAFE.left + 74} y={y + 130} fontSize={38} fill={G1} style={bold(600)}>{sub}</text>
    </g>
  );
};

/** The hook claim at frame 0: a black box per line, the key word yellow, in the top third; the last 0.5 s of the outro brings it back (B41: the loop). */
const HookText: React.FC<{ now: number }> = ({ now }) => {
  const o = now > 20 ? clamp01((now - 39.4) / 0.4) : 1 - clamp01((now - 2.7) / 0.3);
  if (o <= 0) return null;
  const fs = 124;
  const lines: [string, boolean][][] = [[["Hangat belum", false]], [["tentu ", false], ["aman", true]]];
  return (
    <g opacity={o}>
      {lines.map((segs, i) => {
        const full = segs.map((s) => s[0]).join(""), w = textW(full, fs);
        let x = SAFE.left + 36;
        return (
          <g key={i}>
            <rect x={SAFE.left} y={190 + i * 172} width={w + 72} height={150} rx={28} fill={BLACK} />
            {segs.map(([s, key]) => { const tx = x; x += textW(s, fs); return <text key={s} x={tx} y={190 + i * 172 + 112} fontSize={fs} fill={key ? YELLOW : WHITE} style={bold(800)}>{s}</text>; })}
          </g>
        );
      })}
    </g>
  );
};

const Scene = ({ beat, t, clock: now, story }: SceneProps) => {
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const amb = loopClock(now, total, 40) / 40;                       // 0..1 over the loop
  const cam = camAt(now), set = setAt(now), heat = heatAt(now), lamp = lampAt(now);
  const sting = beat.kind === "sting", outro = beat.kind === "outro", hook = beat.kind === "hook";
  const tx = `translate(${W / 2} ${H / 2}) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill={HOT2} />
      <g transform={tx}>
        <g opacity={set}><Set amb={amb} /></g>
        <g transform="translate(480 1000)"><Cooker amb={amb} heat={heat} lamp={lamp} /></g>
        <Callout now={now} amb={amb} />
        <Thermo now={now} />
      </g>
      <Stamp now={now} />
      <ResultCards now={now} amb={amb} />
      <TipCard y={1120} title="Tetap di atas 60 °C" sub="kalau mau disimpan hangat" k={0} now={now} />
      <TipCard y={1300} title="Atau dinginkan cepat" sub="lalu simpan di bawah 5 °C" k={1} now={now} />
      {(hook || outro) && <HookText now={now} />}
      {!hook && !sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {!hook && !sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
