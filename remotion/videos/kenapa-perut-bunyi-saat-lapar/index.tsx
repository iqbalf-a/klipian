/* Kenapa perut bunyi saat lapar? — look 2d (B28), 100 s. A trip into the belly: a Chibi person (B43, the channel's cast) holds a growling belly on a plain background (the hook),
   a round x-ray lens opens on the belly and shows the stomach and the small intestine drawn whole and flat (B56), the camera zooms into the lens and on into the stomach (its inside:
   walls that squeeze, gas, fluid, a food lump, the exit), pushes through the exit into the small intestine (a tunnel whose rings narrow as the squeeze waves pass), and finally zooms
   back out of the lens to the person. No lift and no room: the only places are the outside (plain) and the inside of the organs, as the story says. No face on any object (B44).
   Real shapes (B27.16): the stomach is a J-shaped bag, the gullet enters at the top left, the exit (pylorus) is at the bottom right and leads to the small intestine, a long tube
   folded in rows; gas rises to the top of the stomach and fluid sits at the bottom. The story: the walls squeeze all the time (a wave runs along the tube, bubbles flow), food
   muffles the sound (the rings are small while a lump of food is inside), an empty gut is loud, after about two hours the hunger contractions start (more and stronger waves), so a
   noisy belly is only the contents moving. Two tones per part (base and shade, light from the top left), no outlines, palette tokens only. The camera is plan.ts camAt (the
   outside), the inside scenes zoom by their own keys; labels, bars, track, cards and the hook text are on the screen. Ambient motion runs on the loop clock (B29): every frequency is
   a whole number of cycles per video. The last frame is the first frame. */
import React from "react";
import {
  loopClock, blinkClosed, BLACK, BLUSH, CaptionLayer, FONT_BOLD, G1, G3, G4, PLASTER, RED, SAFE, SKIN_B, STEAM, StoryVideo, TopText, WHITE, YELLOW,
  clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import {
  BARS, BELLY, CARDS, FEET, FOOD, GUT_S, LABELS, LENS_R, PYLORUS, STOMACH_ZOOM, TRACK, TUNNEL_ZOOM, U,
  ampAt, camAt, lensAt, stomachAt, through, tremorAt, tunnelAt, waveAt, waveBAt,
} from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";
import { Chibi } from "../../src/components/Chibi.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { masuk: "MASUK", lambung: "LAMBUNG", kosong: "KALAU KOSONG", usus: "USUS HALUS", jam: "SEKITAR DUA JAM", keluar: "KELUAR", pesan: "JADI" };
const bold = (w = 700) => ({ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: w }) as const;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const TAU = Math.PI * 2;

/* ---------- the gut as seen in the x-ray lens: local units, centre (0,0), about 740 px wide and 800 high at scale 1 ---------- */
/* ---------- the gut: local units, centre (0,0), about 740 px wide and 800 high at scale 1 ---------- */
const STOMACH = "M -100 -250 C -200 -340 -340 -280 -340 -130 C -340 60 -230 200 -40 205 C 80 208 170 160 200 90 C 215 55 200 30 175 30 L 120 40 C 100 60 60 80 0 70 C -50 60 -60 -20 -50 -110 C -48 -170 -70 -215 -100 -250 Z";
const GULLET = "M -92 -345 C -90 -310 -100 -290 -98 -245";
const TUBE = "M 190 60 C 270 45 350 55 350 125 C 350 195 345 255 295 255 L -265 255 C -345 255 -345 320 -265 320 L 265 320 C 345 320 345 385 265 385 L -190 385";
/** The tube as a polyline (for the bubbles that flow along it): points and the running length. */
const TUBE_PTS: [number, number][] = [[190, 60], [300, 70], [350, 125], [335, 255], [0, 255], [-265, 255], [-340, 287], [-265, 320], [0, 320], [265, 320], [340, 352], [265, 385], [-190, 385]];
const TUBE_LEN = TUBE_PTS.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - TUBE_PTS[i][0], p[1] - TUBE_PTS[i][1]), 0);
function onTube(u: number): [number, number] {
  let d = (((u % 1) + 1) % 1) * TUBE_LEN;
  for (let i = 1; i < TUBE_PTS.length; i++) {
    const a = TUBE_PTS[i - 1], b = TUBE_PTS[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l) return [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l];
    d -= l;
  }
  return TUBE_PTS[TUBE_PTS.length - 1];
}
const CAV = "translate(-70 -20) scale(0.88) translate(70 20)";

const Gut: React.FC<{ amb: number; now: number; amp: number; wave: number; waveB: number }> = ({ amb, now, amp, wave, waveB }) => {
  const food = springAt(now, FOOD.a, true) * (1 - clamp01((now - FOOD.out0) / (FOOD.out1 - FOOD.out0)));
  const slide = clamp01((now - FOOD.out0) / (FOOD.out1 - FOOD.out0));
  const fx = -130 + 300 * slide, fy = 50 + 20 * slide;
  const wob = (k: number, ph: number) => Math.sin(amb * TAU * Math.round(k * 2.5) + ph);
  const fluid = "M -380 100 " + Array.from({ length: 30 }, (_, i) => { const x = -380 + i * 20; return `L ${x} ${100 + 5 * wob(5, x / 40)}`; }).join(" ") + " L 240 100 L 240 260 L -380 260 Z";
  const gas: [number, number, number][] = [[-215, -185, 30], [-160, -212, 24], [-255, -148, 22], [-195, -140, 16], [-135, -168, 14]];
  const squeeze = 1 + 0.012 * wave * wob(10, 0);
  return (
    <g transform={`scale(${squeeze})`}>
      {/* the sound rings: copies of the stomach outline that grow and fade; they are small while the stomach holds food */}
      {[0, 1, 2].map((i) => {
        const k = (amb * 40 + i / 3) % 1;
        return <path key={i} d={STOMACH} fill="none" stroke={BLACK} strokeWidth={6} strokeLinejoin="round" opacity={(1 - k) * 0.55 * Math.min(1, amp)} transform={`translate(-70 -20) scale(${1 + 0.33 * amp * k}) translate(70 20)`} />;
      })}
      {[0, 1, 2].map((i) => {
        const k = (amb * 80 + i / 3) % 1;
        return <path key={i} d={STOMACH} fill="none" stroke={RED} strokeWidth={6} strokeLinejoin="round" opacity={(1 - k) * 0.5 * waveB} transform={`translate(-70 -20) scale(${1 + 0.4 * k}) translate(70 20)`} />;
      })}
      {/* the small intestine: a shade, the tube, a highlight, then the squeeze waves that run along it */}
      <path d={TUBE} fill="none" stroke={RED} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} transform="translate(3 5)" />
      <path d={TUBE} fill="none" stroke={BLUSH} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" />
      <path d={TUBE} fill="none" stroke={WHITE} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={0.25} transform="translate(-4 -6)" />
      <path d={TUBE} fill="none" stroke={RED} strokeWidth={50} strokeLinecap="butt" pathLength={1000} strokeDasharray="70 230" strokeDashoffset={-amb * 10 * 300} opacity={0.4 * wave} />
      <path d={TUBE} fill="none" stroke={RED} strokeWidth={50} strokeLinecap="butt" pathLength={1000} strokeDasharray="60 140" strokeDashoffset={-amb * 20 * 200 - 70} opacity={0.4 * waveB} />
      {/* bubbles of gas and drops of fluid flowing along the tube */}
      {Array.from({ length: 7 }, (_, i) => {
        const [x, y] = onTube(amb * 8 + i / 7);
        return <g key={i}><circle cx={x} cy={y} r={11 + (i % 3) * 2} fill={i % 2 ? WHITE : STEAM} opacity={0.9} /><circle cx={x - 3} cy={y - 4} r={3} fill={WHITE} opacity={0.9} /></g>;
      })}
      {/* the gullet and the stomach wall (thick), then the pale cavity with its contents */}
      <path d={GULLET} fill="none" stroke={RED} strokeWidth={50} strokeLinecap="round" opacity={0.28} transform="translate(3 5)" />
      <path d={GULLET} fill="none" stroke={BLUSH} strokeWidth={46} strokeLinecap="round" />
      <path d={GULLET} fill="none" stroke={WHITE} strokeWidth={12} strokeLinecap="round" opacity={0.25} transform="translate(-6 0)" />
      <path d={STOMACH} fill={RED} opacity={0.28} transform="translate(5 7)" />
      <path d={STOMACH} fill={BLUSH} />
      <path d={STOMACH} fill="none" stroke={WHITE} strokeWidth={10} opacity={0.2} transform="translate(-5 -6) scale(0.99)" />
      <clipPath id="cav"><path d={STOMACH} transform={CAV} /></clipPath>
      <path d={STOMACH} fill={WHITE} opacity={0.6} transform={CAV} />
      <g clipPath="url(#cav)">
        <path d={fluid} fill={STEAM} opacity={0.9} />
        <path d="M -380 100 L 240 100 L 240 118 L -380 118 Z" fill={WHITE} opacity={0.25} />
        {["M -290 -60 C -285 -10 -262 40 -215 78", "M -300 10 C -285 60 -250 110 -190 140", "M -30 -100 C -22 -50 -26 0 -44 40", "M -20 -20 C -10 20 -4 40 20 55"].map((d, i) => <path key={i} d={d} stroke={RED} strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.2} />)}
        {gas.map(([x, y, r], i) => {
          const dy = 12 * wob(4 + i, i * 1.7), dx = 6 * wob(3 + i, i);
          return <g key={i}><circle cx={x + dx} cy={y + dy} r={r} fill={WHITE} /><circle cx={x + dx} cy={y + dy} r={r} fill={G3} opacity={0.18} /><circle cx={x + dx - r * 0.3} cy={y + dy - r * 0.3} r={r * 0.3} fill={WHITE} /></g>;
        })}
        {food > 0.01 && (
          <g transform={`translate(${fx} ${fy}) scale(${food}) rotate(${wob(4, 0) * 4})`}>
            <path d="M -92 8 C -100 -50 -40 -76 12 -70 C 70 -72 104 -30 92 14 C 84 52 30 66 -20 62 C -70 60 -88 40 -92 8 Z" fill={PLASTER} />
            <path d="M -92 8 C -88 40 -70 60 -20 62 C 30 66 84 52 92 14 C 60 34 0 40 -40 30 C -70 22 -88 12 -92 8 Z" fill={SKIN_B} opacity={0.55} />
            {[[-40, -20], [10, -34], [44, -6], [-14, 14], [-58, 10], [30, 28]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7} fill={SKIN_B} opacity={0.8} />)}
          </g>
        )}
      </g>
    </g>
  );
};

/* ---------- the person (the outside): the Chibi with a belly that rings; the x-ray lens on the belly shows the gut ---------- */
const Person: React.FC<{ now: number; amb: number; amp: number; wave: number; waveB: number }> = ({ now, amb, amp, wave, waveB }) => {
  const expr = now < 4.3 || now >= 96 ? "surprised" : now >= 83.6 ? "happy" : "calm";
  const open = now > 0.5 && now < 99.5 && blinkClosed(now, 3.1) > 0.3 ? 0.15 : 1;
  const breath = 1 + 0.006 * Math.sin(amb * TAU * 10);
  const lens = lensAt(now), r = LENS_R * lens;
  const rect = { x: BELLY.x - 0.62 * U, y: FEET.y - 1.57 * U, w: 1.24 * U, h: 1.05 * U };
  return (
    <g>
      <ellipse cx={FEET.x} cy={FEET.y + 10} rx={340} ry={28} fill={BLACK} opacity={0.16} />
      <g transform={`translate(${FEET.x} ${FEET.y})`}><Chibi u={U} expr={expr} pose="idle" shirt={STEAM} stripe={YELLOW} breath={breath} open={open} /></g>
      {/* the growl, drawn as rings that leave the belly; small when there is food inside */}
      {[0, 1, 2].map((i) => {
        const k = (amb * 20 + i / 3) % 1, s = 1 + 0.45 * amp * k;
        return <rect key={i} x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={0.34 * U} fill="none" stroke={BLACK} strokeWidth={7} opacity={(1 - k) * 0.5 * Math.min(1, amp)}
          transform={`translate(${BELLY.x} ${BELLY.y}) scale(${s}) translate(${-BELLY.x} ${-BELLY.y})`} />;
      })}
      {lens > 0.01 && (
        <g>
          <clipPath id="lens"><circle cx={BELLY.x} cy={BELLY.y} r={r} /></clipPath>
          <circle cx={BELLY.x} cy={BELLY.y} r={r} fill={WHITE} />
          <g clipPath="url(#lens)"><g transform={`translate(${BELLY.x} ${BELLY.y}) scale(${GUT_S})`}><Gut amb={amb} now={now} amp={amp} wave={wave} waveB={waveB} /></g></g>
          <circle cx={BELLY.x} cy={BELLY.y} r={r} fill="none" stroke={BLACK} strokeWidth={12} />
          <circle cx={BELLY.x} cy={BELLY.y} r={r - 10} fill="none" stroke={WHITE} strokeWidth={4} opacity={0.7} />
        </g>
      )}
    </g>
  );
};

/* ---------- inside the stomach (screen space, 1080 x 1920): walls that squeeze, gas, fluid, a food lump, the exit ---------- */
const gasBubble = (i: number, amb: number): [number, number, number] => {
  const k = (amb * 7 + i / 6) % 1;
  return [160 + ((i * 173) % 760) + 26 * Math.sin(amb * TAU * 25 + i * 1.9), 1250 - k * 1050, 22 + ((i * 11) % 5) * 7];
};
const FLUID_Y = 1250;
const StomachInside: React.FC<{ now: number; amb: number; amp: number; wave: number }> = ({ now, amb, amp, wave }) => {
  const food = springAt(now, FOOD.a, true) * (1 - clamp01((now - FOOD.out0) / (FOOD.out1 - FOOD.out0)));
  const slide = clamp01((now - FOOD.out0) / (FOOD.out1 - FOOD.out0));
  const fx = 470 + (PYLORUS.x - 470) * slide, fy = 1150 + (PYLORUS.y - 1150) * slide + 12 * Math.sin(amb * TAU * 25);
  const press = (ph: number) => (0.5 + 0.5 * Math.sin(amb * TAU * 25 + ph)) * Math.min(1, wave);
  const zs = through(STOMACH_ZOOM, now), kz = clamp01((zs - 1) / 6);
  const cx = 540 + (PYLORUS.x - 540) * kz, cy = 960 + (PYLORUS.y - 960) * kz;
  const fluid = `M -40 ${FLUID_Y} ` + Array.from({ length: 58 }, (_, i) => { const x = -40 + i * 20; return `L ${x} ${FLUID_Y + 9 * Math.sin(amb * TAU * 50 + x / 70)}`; }).join(" ") + " L 1140 2000 L -40 2000 Z";
  const folds = [330, 560, 800, 1040, 1290];
  return (
    <g transform={`translate(540 960) scale(${zs}) translate(${-cx} ${-cy})`}>
      <rect x={-200} y={-200} width={1480} height={2320} fill={BLUSH} />
      <ellipse cx={540} cy={900} rx={560} ry={760} fill={WHITE} opacity={0.14} />
      {folds.map((y, i) => {
        const dy = 10 * Math.sin(amb * TAU * 25 + i * 1.3);
        const d = `M -60 ${y + dy} C 220 ${y - 90 + dy} 420 ${y + 90 + dy} 640 ${y + dy} S 1000 ${y - 60 + dy} 1140 ${y + 30 + dy}`;
        return <g key={i}><path d={d} fill="none" stroke={RED} strokeWidth={54} strokeLinecap="round" opacity={0.2} /><path d={d} fill="none" stroke={WHITE} strokeWidth={12} strokeLinecap="round" opacity={0.2} transform="translate(-6 -22)" /></g>;
      })}
      {/* the pool of fluid with a lit surface, and the gas bubbles that rise out of it */}
      <path d={fluid} fill={STEAM} opacity={0.92} />
      <rect x={-40} y={FLUID_Y} width={1160} height={14} fill={WHITE} opacity={0.3} />
      {Array.from({ length: 6 }, (_, i) => {
        const [x, y, r] = gasBubble(i, amb);
        return <g key={i} opacity={Math.min(1, (FLUID_Y - y) / 60) * 0.95}><circle cx={x} cy={y} r={r} fill={WHITE} /><circle cx={x} cy={y} r={r} fill={G3} opacity={0.16} /><circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.28} fill={WHITE} /></g>;
      })}
      {/* the exit (the pylorus): a ring of muscle round a dark mouth */}
      <circle cx={PYLORUS.x} cy={PYLORUS.y} r={150} fill={RED} opacity={0.3} />
      <circle cx={PYLORUS.x} cy={PYLORUS.y} r={122} fill={BLUSH} />
      <circle cx={PYLORUS.x} cy={PYLORUS.y} r={122} fill="none" stroke={WHITE} strokeWidth={10} opacity={0.3} transform="translate(-6 -6)" />
      <circle cx={PYLORUS.x} cy={PYLORUS.y} r={84 + 12 * press(0)} fill={BLACK} opacity={0.88} />
      {/* the food lump: it sits in the fluid and is carried to the exit */}
      {food > 0.01 && (
        <g transform={`translate(${fx} ${fy}) scale(${food * 2.1}) rotate(${4 * Math.sin(amb * TAU * 25)})`}>
          <path d="M -92 8 C -100 -50 -40 -76 12 -70 C 70 -72 104 -30 92 14 C 84 52 30 66 -20 62 C -70 60 -88 40 -92 8 Z" fill={PLASTER} />
          <path d="M -92 8 C -88 40 -70 60 -20 62 C 30 66 84 52 92 14 C 60 34 0 40 -40 30 C -70 22 -88 12 -92 8 Z" fill={SKIN_B} opacity={0.55} />
          {[[-40, -20], [10, -34], [44, -6], [-14, 14], [-58, 10], [30, 28]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7} fill={SKIN_B} opacity={0.8} />)}
        </g>
      )}
      {/* the walls squeeze: two big lobes press in from the sides, one after the other */}
      <ellipse cx={-130 + 190 * press(0)} cy={930} rx={250} ry={820} fill={RED} opacity={0.3} />
      <ellipse cx={-150 + 190 * press(0)} cy={930} rx={240} ry={810} fill={BLUSH} />
      <ellipse cx={-98 + 190 * press(0)} cy={760} rx={46} ry={420} fill={WHITE} opacity={0.2} />
      <ellipse cx={1210 - 190 * press(Math.PI)} cy={930} rx={250} ry={820} fill={RED} opacity={0.3} />
      <ellipse cx={1230 - 190 * press(Math.PI)} cy={930} rx={240} ry={810} fill={BLUSH} />
      <ellipse cx={1178 - 190 * press(Math.PI)} cy={760} rx={46} ry={420} fill={WHITE} opacity={0.2} />
      {/* the sound: rings leave the middle, small while food muffles them */}
      {[0, 1, 2].map((i) => { const k = (amb * 40 + i / 3) % 1; return <circle key={i} cx={540} cy={900} r={110 + 760 * amp * k} fill="none" stroke={WHITE} strokeWidth={12} opacity={(1 - k) * 0.6 * Math.min(1, amp)} />; })}
    </g>
  );
};

/* ---------- inside the small intestine: a tunnel of rings that flow toward us; the squeeze waves narrow the rings they pass ---------- */
const VP = { x: 540, y: 930 };
const Tunnel: React.FC<{ now: number; amb: number; amp: number; wave: number; waveB: number }> = ({ now, amb, amp, wave, waveB }) => {
  const N = 15, zs = through(TUNNEL_ZOOM, now), phase = amb * 6;
  const dw = (amb * 20) % 1, dwB = (amb * 40) % 1;
  const rings = Array.from({ length: N }, (_, i) => (i / N + phase) % 1).sort((a, b) => b - a);   // the nearest (biggest) first, the far ones on top
  const squeeze = (d: number) => 1 - 0.3 * Math.min(1, wave) * Math.exp(-Math.pow((d - dw) / 0.1, 2)) - 0.22 * waveB * Math.exp(-Math.pow((d - dwB) / 0.08, 2));
  const sway = (d: number) => 26 * (1 - d) * Math.sin(amb * TAU * 10);
  const drops = Array.from({ length: 7 }, (_, i) => ({ d: (amb * 9 + i / 7) % 1, a: (i * 2.4) % TAU, r: 0.35 + 0.35 * ((i * 5) % 3) / 2 }));
  return (
    <g transform={`translate(${VP.x} ${VP.y}) scale(${zs}) translate(${-VP.x} ${-VP.y})`}>
      <rect x={-300} y={-300} width={1680} height={2520} fill={BLACK} />
      {rings.map((d, i) => {
        const s = (0.04 + 2.1 * Math.pow(d, 2.2)) * squeeze(d), rx = 540 * s, ry = 700 * s, cx = VP.x + sway(d), cy = VP.y + 16 * (1 - d) * Math.sin(amb * TAU * 5);
        return (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={BLUSH} />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={RED} opacity={0.12 + 0.2 * (i % 2)} />
            <ellipse cx={cx - 50 * s} cy={cy - 70 * s} rx={rx} ry={ry} fill="none" stroke={WHITE} strokeWidth={Math.max(1, 14 * s)} opacity={0.2} />
          </g>
        );
      })}
      <ellipse cx={VP.x} cy={VP.y} rx={26} ry={34} fill={BLACK} />
      {drops.map((p, i) => {
        const s = (0.04 + 2.1 * Math.pow(p.d, 2.2)) * squeeze(p.d), x = VP.x + sway(p.d) + Math.cos(p.a) * 540 * s * p.r, y = VP.y + Math.sin(p.a) * 700 * s * p.r, r = 60 * s + 4;
        return <g key={i} opacity={clamp01(p.d * 6)}><circle cx={x} cy={y} r={r} fill={i % 2 ? WHITE : STEAM} /><circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.28} fill={WHITE} /></g>;
      })}
      {[0, 1, 2].map((i) => { const k = (amb * 40 + i / 3) % 1; return <circle key={i} cx={VP.x} cy={VP.y} r={140 + 700 * amp * k} fill="none" stroke={WHITE} strokeWidth={10} opacity={(1 - k) * 0.4 * Math.min(1, amp)} />; })}
    </g>
  );
};

/* ---------- screen pieces ---------- */
/** Two labels with a leader line, to a gas bubble and to the fluid; they sit on the left wall of the stomach. */
const Labels: React.FC<{ now: number; amb: number }> = ({ now, amb }) => {
  const o = win(now, LABELS.gas, LABELS.out, 0.35);
  if (o <= 0) return null;
  const [gx, gy] = gasBubble(1, amb);
  const L = (lx: number, ly: number, px: number, py: number, text: string, a: number) => {
    const p = Math.max(0, springAt(now, a, true));
    return (
      <g transform={`translate(${lx} ${ly}) scale(${p}) translate(${-lx} ${-ly})`}>
        <line x1={lx + 62} y1={ly} x2={px} y2={py} stroke={BLACK} strokeWidth={5} strokeLinecap="round" />
        <circle cx={px} cy={py} r={9} fill={BLACK} />
        <rect x={lx - 75} y={ly - 34} width={150} height={68} rx={34} fill={WHITE} />
        <text x={lx} y={ly + 15} fontSize={42} fill={BLACK} textAnchor="middle" style={bold(700)}>{text}</text>
      </g>
    );
  };
  return <g opacity={o}>{L(SAFE.left + 85, 640, gx, gy, "gas", LABELS.gas)}{L(SAFE.left + 100, 1330, 460, FLUID_Y + 30, "cairan", LABELS.fluid)}</g>;
};

/** Two bars on the screen: the growl is quiet with food in the stomach and long when it is empty. */
const Bars: React.FC<{ now: number }> = ({ now }) => {
  const o = win(now, BARS.a1, BARS.out, 0.4);
  if (o <= 0) return null;
  const p1 = Math.max(0, springAt(now, BARS.a1, true)), p2 = clamp01((now - BARS.a2) / 0.6);
  return (
    <g opacity={o}>
      <rect x={SAFE.left} y={1190} width={SAFE.right - SAFE.left} height={270} rx={44} fill={WHITE} />
      <g transform={`translate(${SAFE.left + 30} 1260) scale(${p1}) translate(${-(SAFE.left + 30)} -1260)`}>
        <text x={SAFE.left + 36} y={1262} fontSize={40} fill={BLACK} style={bold(700)}>ada isi</text>
        <rect x={SAFE.left + 270} y={1232} width={500} height={42} rx={21} fill={G4} />
        <rect x={SAFE.left + 270} y={1232} width={110} height={42} rx={21} fill={G3} />
      </g>
      <text x={SAFE.left + 36} y={1388} fontSize={40} fill={BLACK} style={bold(700)}>kosong</text>
      <rect x={SAFE.left + 270} y={1358} width={500} height={42} rx={21} fill={G4} />
      <rect x={SAFE.left + 270} y={1358} width={Math.max(0.01, 500 * p2)} height={42} rx={21} fill={YELLOW} />
    </g>
  );
};

/** The 2-hour track (a bar that fills, not a now) and the pill of the hunger contractions. */
const Track: React.FC<{ now: number }> = ({ now }) => {
  const o = win(now, TRACK.a, TRACK.out, 0.4);
  if (o <= 0) return null;
  const f = clamp01((now - TRACK.fill0) / (TRACK.fill1 - TRACK.fill0)), pp = Math.max(0, springAt(now, TRACK.pill, true));
  return (
    <g opacity={o}>
      <rect x={SAFE.left} y={1190} width={SAFE.right - SAFE.left} height={190} rx={44} fill={WHITE} />
      <text x={SAFE.left + 40} y={1262} fontSize={44} fill={BLACK} style={bold(700)}>perut kosong</text>
      <text x={SAFE.right - 40} y={1262} fontSize={44} fill={BLACK} textAnchor="end" style={bold(800)}>2 jam</text>
      <rect x={SAFE.left + 40} y={1292} width={SAFE.right - SAFE.left - 80} height={44} rx={22} fill={G4} />
      <rect x={SAFE.left + 40} y={1292} width={Math.max(0.01, (SAFE.right - SAFE.left - 80) * f)} height={44} rx={22} fill={YELLOW} />
      <g transform={`translate(540 1450) scale(${pp}) translate(-540 -1450)`}>
        <rect x={SAFE.left + 90} y={1405} width={SAFE.right - SAFE.left - 180} height={90} rx={45} fill={RED} />
        <text x={540} y={1470} fontSize={50} fill={WHITE} textAnchor="middle" style={bold(800)}>kontraksi lapar</text>
      </g>
    </g>
  );
};

const Card: React.FC<{ y: number; title: string; sub: string; a: number; out: number; now: number }> = ({ y, title, sub, a, out, now }) => {
  const p = springAt(now, a, true), o = 1 - clamp01((now - out) / 0.4);
  if (now < a || o <= 0) return null;
  return (
    <g transform={`translate(540 ${y + 80}) scale(${Math.max(0, p)}) translate(-540 ${-(y + 80)})`} opacity={o}>
      <rect x={SAFE.left} y={y} width={SAFE.right - SAFE.left} height={160} rx={40} fill={WHITE} />
      <rect x={SAFE.left + 28} y={y + 28} width={14} height={104} rx={7} fill={YELLOW} />
      <text x={SAFE.left + 68} y={y + 78} fontSize={54} fill={BLACK} style={bold(700)}>{title}</text>
      <text x={SAFE.left + 68} y={y + 128} fontSize={38} fill={G1} style={bold(600)}>{sub}</text>
    </g>
  );
};

/** The hook claim at frame 0: a black box per line, the key words yellow, in the top third; the last 0.5 s of the outro brings it back (B41: the loop). */
const HookText: React.FC<{ now: number }> = ({ now }) => {
  const o = now > 20 ? clamp01((now - 99.4) / 0.4) : 1 - clamp01((now - 2.7) / 0.3);
  if (o <= 0) return null;
  const lines: [string, boolean][] = [["Bunyi perut", false], ["bukan lapar", true]];
  return (
    <g opacity={o}>
      {lines.map(([ln, key], i) => (
        <g key={ln}>
          <rect x={SAFE.left} y={250 + i * 168} width={ln.length * 70 + 70} height={148} rx={26} fill={BLACK} />
          <text x={SAFE.left + 35} y={250 + i * 168 + 112} fontSize={128} fill={key ? YELLOW : WHITE} style={bold(800)}>{ln}</text>
        </g>
      ))}
    </g>
  );
};

const Scene = (props: SceneProps) => {
  const { beat, t, story } = props, now = props.clock;
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const amb = loopClock(now, total, 100) / 100;                    // 0..1 over the loop
  const cam = camAt(now), st = stomachAt(now), tu = tunnelAt(now), amp = ampAt(now), wave = waveAt(now), waveB = waveBAt(now), sh = tremorAt(now);
  const sting = beat.kind === "sting", outro = beat.kind === "outro", hook = beat.kind === "hook";
  const tx = `translate(${W / 2} ${H / 2}) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill={G4} />
      <g transform={tx}><Person now={now} amb={amb} amp={amp} wave={wave} waveB={waveB} /></g>
      {st > 0.001 && <g opacity={st} transform={`translate(${sh} ${sh * 0.5})`}><StomachInside now={now} amb={amb} amp={amp} wave={wave} /></g>}
      {tu > 0.001 && <g opacity={tu} transform={`translate(${sh} ${sh * 0.5})`}><Tunnel now={now} amb={amb} amp={amp} wave={wave} waveB={waveB} /></g>}
      <Labels now={now} amb={amb} />
      <Bars now={now} />
      <Track now={now} />
      <Card y={1190} title="6 sampai 7 meter" sub="panjang usus halus" a={44.8} out={54.6} now={now} />
      <Card y={1190} title="Cuma isi bergeser" sub="gas dan cairan di perut" a={CARDS[0].a} out={CARDS[0].out} now={now} />
      <Card y={1370} title="Belum tentu lapar" sub="rasa lapar lebih andal" a={CARDS[1].a} out={CARDS[1].out} now={now} />
      {(hook || outro) && <HookText now={now} />}
      {sting && <StingMark slug="kenapa-perut-bunyi-saat-lapar" t={t} clock={now} />}
      {!hook && !sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {!hook && !sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
