/* Kenapa perut bunyi saat lapar? — look 2d (B28): a stomach and its small intestine, drawn whole and flat from the front (B56: a whole organ), float in front of the closed
   doors of a lift car (set kind "elevator-car-front", see set.json). No person is drawn (B43). No face on any object (B44).
   Real shapes (B27.16): the stomach is a J-shaped bag, the gullet enters at the top left, the exit (pylorus) is at the bottom right and leads to the small intestine, a
   long tube folded in rows; gas rises to the top of the stomach and fluid sits at the bottom. The story: the walls squeeze all the time (a wave runs along the tube,
   bubbles flow), food muffles the sound (the rings are small while a lump of food is inside), an empty gut is loud, after about two hours the hunger contractions start
   (more and stronger waves, the rings rattle the lift), so a noisy belly is only the contents moving.
   Two tones per part (base and shade, light from the top left), no outlines, palette tokens only. The world is one group moved by the camera (plan.ts camAt); the labels,
   bars, track, pill, cards and the hook text are on the screen. Ambient motion (rings, waves, bubbles, fluid) runs on the loop now (B29). The last frame is the first frame. */
import React from "react";
import {
  loopClock, BLACK, BLUSH, CaptionLayer, FONT_BOLD, FONT_MONO, G1, G2, G3, G4, PLASTER, RED, SAFE, SKIN_B, STEAM, StoryVideo, TopText, WHITE, YELLOW, YELLOW_D,
  clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { BARS, CARDS, FOOD, LABELS, TREMOR, TRACK, ampAt, camAt, heroAt, setAt, tremorAt, waveAt, waveBAt } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { remas: "ISI PERUT", kosong: "KALAU KOSONG", jam: "SEKITAR DUA JAM", pesan: "JADI" };
const bold = (w = 700) => ({ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: w }) as const;
const mono = { fontFamily: `"${FONT_MONO}", monospace` } as const;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const TAU = Math.PI * 2;

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
  const wob = (k: number, ph: number) => Math.sin(amb * TAU * k + ph);
  const fluid = "M -380 100 " + Array.from({ length: 30 }, (_, i) => { const x = -380 + i * 20; return `L ${x} ${100 + 5 * wob(5, x / 40)}`; }).join(" ") + " L 240 100 L 240 260 L -380 260 Z";
  const gas: [number, number, number][] = [[-215, -185, 30], [-160, -212, 24], [-255, -148, 22], [-195, -140, 16], [-135, -168, 14]];
  const squeeze = 1 + 0.012 * wave * wob(10, 0);
  return (
    <g transform={`scale(${squeeze})`}>
      {/* the sound rings: copies of the stomach outline that grow and fade; they are small while the stomach holds food */}
      {[0, 1, 2].map((i) => {
        const k = (amb * 16 + i / 3) % 1;
        return <path key={i} d={STOMACH} fill="none" stroke={BLACK} strokeWidth={6} strokeLinejoin="round" opacity={(1 - k) * 0.55 * Math.min(1, amp)} transform={`translate(-70 -20) scale(${1 + 0.33 * amp * k}) translate(70 20)`} />;
      })}
      {[0, 1, 2].map((i) => {
        const k = (amb * 32 + i / 3) % 1;
        return <path key={i} d={STOMACH} fill="none" stroke={RED} strokeWidth={6} strokeLinejoin="round" opacity={(1 - k) * 0.5 * waveB} transform={`translate(-70 -20) scale(${1 + 0.4 * k}) translate(70 20)`} />;
      })}
      {/* the small intestine: a shade, the tube, a highlight, then the squeeze waves that run along it */}
      <path d={TUBE} fill="none" stroke={RED} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} transform="translate(3 5)" />
      <path d={TUBE} fill="none" stroke={BLUSH} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" />
      <path d={TUBE} fill="none" stroke={WHITE} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={0.25} transform="translate(-4 -6)" />
      <path d={TUBE} fill="none" stroke={RED} strokeWidth={50} strokeLinecap="butt" pathLength={1000} strokeDasharray="70 230" strokeDashoffset={-amb * 4 * 300} opacity={0.4 * wave} />
      <path d={TUBE} fill="none" stroke={RED} strokeWidth={50} strokeLinecap="butt" pathLength={1000} strokeDasharray="60 140" strokeDashoffset={-amb * 8 * 200 - 70} opacity={0.4 * waveB} />
      {/* bubbles of gas and drops of fluid flowing along the tube */}
      {Array.from({ length: 7 }, (_, i) => {
        const [x, y] = onTube(amb * 3 + i / 7);
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

/* ---------- the lift car: the door wall seen flat from the front (the world, 3600 px wide, floor at 1500) ---------- */
const FLOOR = 1500;
const Lift: React.FC<{ amb: number; now: number }> = ({ amb, now }) => {
  const sh = tremorAt(now);
  const blink = now >= TREMOR.a && now < TREMOR.b + 0.8 ? (Math.floor(now * 8) % 2 === 0) : true;
  const buttons: [number, number][] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [1005 + (i % 2) * 62, 640 + Math.floor(i / 2) * 78]);
  return (
    <g transform={`translate(${sh} ${0})`}>
      <rect x={-1200} y={-1200} width={3600} height={FLOOR + 1200} fill={G4} />
      {[-1000, -640, -280, 80, 920, 1300, 1660, 2020].map((x, i) => <rect key={i} x={x} y={-1200} width={6} height={FLOOR + 1200} fill={G3} opacity={0.7} />)}
      {[-1000, -280, 920, 1660].map((x, i) => <rect key={i} x={x + 14} y={-1200} width={44} height={FLOOR + 1200} fill={WHITE} opacity={0.35} />)}
      {/* the door frame and the two door leaves with a dark seam and brushed stripes */}
      <rect x={172} y={512} width={736} height={FLOOR - 512} rx={10} fill={G2} />
      <rect x={190} y={530} width={350} height={FLOOR - 530} fill={G3} />
      <rect x={540} y={530} width={350} height={FLOOR - 530} fill={G3} />
      <rect x={640} y={530} width={250} height={FLOOR - 530} fill={G2} opacity={0.18} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <rect key={i} x={200 + i * 36} y={530} width={6} height={FLOOR - 530} fill={G4} opacity={0.5} />)}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <rect key={i} x={560 + i * 32} y={530} width={6} height={FLOOR - 530} fill={G4} opacity={0.4} />)}
      <rect x={536} y={530} width={8} height={FLOOR - 530} fill={G1} />
      <rect x={190} y={530} width={350} height={20} fill={G2} opacity={0.4} />
      {/* the floor display above the doors: a dark rounded plate with a lit digit and two small arrows */}
      <rect x={430} y={430} width={220} height={66} rx={16} fill={G1} />
      <text x={540} y={482} fontSize={50} fill={blink ? YELLOW : YELLOW_D} opacity={blink ? 1 : 0.35} textAnchor="middle" style={{ ...bold(800), ...mono }}>7</text>
      <path d="M 466 470 L 480 448 L 494 470 Z" fill={YELLOW} opacity={0.9} />
      <path d="M 586 448 L 600 470 L 614 448 Z" fill={G2} />
      {/* the call panel on the right, cut by the frame: eight round buttons, a grille, an alarm button */}
      <rect x={960} y={430} width={300} height={900} rx={22} fill={G3} />
      <rect x={960} y={430} width={26} height={900} rx={12} fill={WHITE} opacity={0.4} />
      <rect x={990} y={470} width={200} height={120} rx={16} fill={G1} />
      {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={1015 + (i % 3) * 52} cy={505 + Math.floor(i / 3) * 52} r={9} fill={G2} opacity={0.9} />)}
      {buttons.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x + 30} cy={y + 24} r={27} fill={G2} />
          <circle cx={x + 30} cy={y + 22} r={23} fill={WHITE} />
          <circle cx={x + 30} cy={y + 22} r={23} fill={G3} opacity={0.35} />
          <circle cx={x + 24} cy={y + 15} r={7} fill={WHITE} opacity={0.8} />
        </g>
      ))}
      <circle cx={1065} cy={1030} r={36} fill={G2} />
      <circle cx={1065} cy={1027} r={31} fill={YELLOW} />
      <circle cx={1065} cy={1027} r={31} fill={YELLOW_D} opacity={0.25} />
      <path d="M 1050 1040 C 1052 1012 1078 1012 1080 1040 Z" fill={WHITE} opacity={0.85} />
      <rect x={1010} y={1100} width={170} height={150} rx={14} fill={G2} opacity={0.35} />
      {Array.from({ length: 24 }, (_, i) => <circle key={i} cx={1030 + (i % 6) * 26} cy={1122 + Math.floor(i / 6) * 28} r={5} fill={G1} opacity={0.75} />)}
      {/* the capacity plate on the left: a rounded steel plate with mono text */}
      <rect x={-130} y={760} width={250} height={130} rx={14} fill={G3} />
      <rect x={-130} y={760} width={250} height={20} rx={10} fill={WHITE} opacity={0.4} />
      <text x={-5} y={820} fontSize={34} fill={G1} textAnchor="middle" style={mono}>MAKS</text>
      <text x={-5} y={866} fontSize={34} fill={G1} textAnchor="middle" style={mono}>8 ORANG</text>
      {/* the threshold and the dark floor, bleeding past the frame */}
      <rect x={-1200} y={FLOOR - 26} width={3600} height={26} rx={6} fill={G2} />
      <rect x={-1200} y={FLOOR} width={3600} height={1500} fill={G1} />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={-1200 + i * 700} y={FLOOR + 40} width={6} height={1400} fill={G2} opacity={0.45} />)}
      <rect x={-1200} y={FLOOR + 6} width={3600} height={40} fill={G2} opacity={0.35} />
      <ellipse cx={540 + Math.sin(amb * TAU * 2) * 8} cy={FLOOR + 80} rx={320} ry={26} fill={BLACK} opacity={0.35} />
    </g>
  );
};

/* ---------- screen pieces ---------- */
/** Two labels with a leader line to the gas bubbles and the fluid; they sit on plain wall at the left of the stomach. */
const Labels: React.FC<{ now: number; h: { x: number; y: number; s: number } }> = ({ now, h }) => {
  const o = win(now, LABELS.gas, LABELS.out, 0.35);
  if (o <= 0) return null;
  const L = (lx: number, ly: number, px: number, py: number, text: string, a: number) => {
    const p = Math.max(0, springAt(now, a, true)), x0 = h.x + lx * h.s, y0 = h.y + ly * h.s, x1 = h.x + px * h.s, y1 = h.y + py * h.s;
    return (
      <g transform={`translate(${x0} ${y0}) scale(${p}) translate(${-x0} ${-y0})`}>
        <line x1={x0 + 62} y1={y0} x2={x1} y2={y1} stroke={BLACK} strokeWidth={5} strokeLinecap="round" />
        <circle cx={x1} cy={y1} r={9} fill={BLACK} />
        <rect x={x0 - 75} y={y0 - 34} width={150} height={68} rx={34} fill={WHITE} />
        <text x={x0} y={y0 + 15} fontSize={42} fill={BLACK} textAnchor="middle" style={bold(700)}>{text}</text>
      </g>
    );
  };
  return <g opacity={o}>{L(-345, -330, -230, -185, "gas", LABELS.gas)}{L(-405, 150, -120, 160, "cairan", LABELS.fluid)}</g>;
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
  const o = now > 20 ? clamp01((now - 39.4) / 0.4) : 1 - clamp01((now - 2.7) / 0.3);
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
  const amb = loopClock(now, story.beats.reduce((a, b) => a + b.dur, 0), 40) / 40;   // 0..1 over the loop
  const cam = camAt(now), h = heroAt(now), set = setAt(now);
  const sting = beat.kind === "sting", outro = beat.kind === "outro", hook = beat.kind === "hook";
  const tx = `translate(${W / 2} ${H / 2}) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`;
  const bob = 6 * Math.sin(amb * TAU * 5);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill={G4} />
      <g transform={tx}>
        <g opacity={set}><Lift amb={amb} now={now} /></g>
        <g transform={`translate(${h.x + tremorAt(now) * 0.6} ${h.y + bob}) scale(${h.s})`}><Gut amb={amb} now={now} amp={ampAt(now)} wave={waveAt(now)} waveB={waveBAt(now)} /></g>
        <Labels now={now} h={{ x: h.x, y: h.y + bob, s: h.s }} />
      </g>
      <Bars now={now} />
      <Track now={now} />
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
