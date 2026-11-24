/* Kenapa kaget kayak jatuh pas mau tidur — look 2d (B28): a brain seen from the side (cerebrum with folds, cerebellum with its stripes, brainstem: B56, a whole organ) floats
   over a bed seen from the side at night (set kind "night-bed-side", see set.json). No person is drawn (B43): the sleeper is a lump under a blanket, a pillow beside it.
   Real shapes (B27.16): a brain seen from the side is a wide dome with the cerebellum tucked under the back and the stem going down; a bed in profile has a headboard,
   a frame on legs, a mattress, a pillow and a blanket that makes a hump. The story: the muscles relax (a gauge sinks, the hump sinks), seven in ten people know the
   jolt (ten icons, seven with a mark), the popular guess (unproven): the brain reads the sudden loss of tone as a fall, shows an alarm, zaps the muscles, the bed jolts.
   Two tones per part (base and shade, light from the top left), no outlines, palette tokens only. The world is one group moved by the camera (plan.ts camAt); the gauge,
   the icons, the cards and the hook text are on the screen. Ambient motion (breath, stars, steam, the brain's slow pulse) runs on the loop clock (B29). The last frame is
   the first frame (the loop). */
import React from "react";
import {
  loopClock, BLACK, BLUSH, CaptionLayer, FONT_BOLD, G1, G2, G3, G4, RED, SAFE, StoryVideo, THEMES, TopText, WHITE, YELLOW, YELLOW_D,
  clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { BUBBLE, CARDS, CUP, GAUGE, ICONS, PILL, ZAP, brainAt, camAt, joltAt, muscleAt, setAt } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { rileks: "SAAT MAU TIDUR", umum: "NAMANYA", dugaan: "DUGAANNYA", pemicu: "PEMICU" };
const SKY = THEMES.sky;
const BLANKET = THEMES.peach.ring, BLANKET_D = THEMES.peach.floorEdge, WALL = SKY.ring;
const BOLD = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const bold = (w = 700) => ({ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: w }) as const;

/* ---------- the brain, side view, 800 px wide and about 560 high around (0,0); the face of the cut is the left, the back of the head the right ---------- */
const Brain: React.FC<{ amb: number; alarm: number }> = ({ amb, alarm }) => {
  const folds = [
    "M -300 -40 C -250 -120 -170 -110 -140 -50 C -110 10 -50 -10 -30 -80",
    "M -120 -200 C -80 -150 -20 -170 10 -120 C 40 -70 110 -90 130 -150",
    "M 60 -230 C 110 -190 190 -200 230 -150 C 270 -100 330 -120 340 -60",
    "M -330 60 C -260 20 -200 70 -140 40 C -90 15 -30 60 30 20",
    "M 100 -20 C 160 -60 220 -20 270 -50 C 310 -70 340 -30 350 10",
    "M 70 70 C 130 30 190 80 250 60",
    "M -200 -170 C -240 -130 -250 -90 -230 -60",
  ];
  return (
    <g>
      {/* the stem and the cerebellum sit behind and under the cerebrum */}
      <path d="M 70 150 C 60 210 70 270 95 300 C 125 306 150 300 160 280 C 150 230 150 190 140 150 Z" fill={BLUSH} />
      <path d="M 70 150 C 60 210 70 270 95 300 C 105 300 112 298 118 294 C 100 250 100 200 110 150 Z" fill={RED} opacity={0.3} />
      <ellipse cx={235} cy={170} rx={135} ry={78} fill={BLUSH} />
      <ellipse cx={235} cy={170} rx={135} ry={78} fill={RED} opacity={0.22} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M ${130 + i * 14} ${185 + i * 12} C ${200} ${150 + i * 16} ${300} ${150 + i * 16} ${345 - i * 8} ${185 + i * 8}`} stroke={BLUSH} strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.9} />)}
      {/* the cerebrum: a wide dome, flat under, with the dent where the temporal lobe sits */}
      <path d="M -385 25 C -405 -170 -250 -285 -40 -268 C 150 -285 345 -235 378 -60 C 400 62 335 132 255 148 C 200 168 125 146 62 170 C 5 186 -62 168 -130 150 C -265 160 -372 120 -385 25 Z" fill={BLUSH} />
      <path d="M -385 25 C -372 120 -265 160 -130 150 C -62 168 5 186 62 170 C 125 146 200 168 255 148 C 300 138 340 112 362 70 C 300 120 210 112 120 120 C 30 126 -60 120 -150 112 C -270 100 -370 80 -385 25 Z" fill={RED} opacity={0.3} />
      <path d="M -330 -90 C -300 -200 -190 -250 -60 -245 C -150 -230 -250 -180 -310 -60 Z" fill={WHITE} opacity={0.22} />
      {folds.map((d, i) => <path key={i} d={d} stroke={RED} strokeWidth={12} strokeLinecap="round" fill="none" opacity={0.42} />)}
      {/* a slow pulse of light along the dome, on the loop clock */}
      <ellipse cx={-60 + Math.sin(amb * Math.PI * 2 * 2) * 40} cy={-130} rx={70} ry={26} fill={WHITE} opacity={0.14} />
      {alarm > 0.01 && <ellipse cx={0} cy={-20} rx={420} ry={300} fill={RED} opacity={0.22 * alarm} />}
    </g>
  );
};

/* ---------- the room: a night bedroom seen from the side ---------- */
const FLOOR = 1500;
const STARS: [number, number, number][] = [[130, 585, 5], [250, 630, 4], [390, 580, 6], [180, 760, 4], [330, 830, 5], [440, 690, 4]];

const Room: React.FC<{ clock: number; amb: number; muscle: number; jolt: number }> = ({ clock, amb, muscle, jolt }) => {
  const breath = Math.sin(amb * Math.PI * 2 * 10) * 5 * muscle;          // 10 breaths in 40 s
  const top = 1150 + (1 - muscle) * 20 - jolt * 0.9 + breath;
  const lift = jolt * 0.5;
  const tw = (i: number) => 0.5 + 0.5 * Math.sin(amb * Math.PI * 2 * 12 + i * 1.7);
  const wob = joltAt(clock + 0) > 0 ? Math.sin((clock - 27) * 38) * Math.min(1, joltAt(clock) / 8) * 5 : 0;
  const cupIn = springAt(clock, CUP.a, true);
  return (
    <g>
      {/* the wall and the floor */}
      <rect x={-1200} y={-1200} width={3600} height={FLOOR + 1200} fill={WALL} />
      <rect x={-1200} y={FLOOR} width={3600} height={1500} fill={G1} />
      <rect x={-1200} y={FLOOR - 8} width={3600} height={10} fill={G3} opacity={0.45} />
      {/* the window (far left, clear of the brain): a frame, a dark glass, a crescent moon, stars that twinkle, a sill */}
      <g transform="translate(-230 0)">
      <rect x={80} y={500} width={310} height={400} rx={14} fill={G3} />
      <rect x={100} y={520} width={270} height={360} rx={8} fill={G1} />
      {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={WHITE} opacity={0.4 + 0.5 * tw(i)} />)}
      <circle cx={250} cy={700} r={70} fill={YELLOW} />
      <circle cx={282} cy={680} r={64} fill={G1} />
      <rect x={233} y={520} width={8} height={360} fill={G3} />
      <rect x={100} y={690} width={270} height={8} fill={G3} />
      <rect x={60} y={896} width={350} height={22} rx={8} fill={G3} />
      <rect x={60} y={908} width={350} height={10} rx={5} fill={G2} />
      </g>
      {/* the bed: headboard, frame on legs, mattress */}
      <rect x={30} y={1040} width={56} height={360} rx={20} fill={G3} />
      <rect x={30} y={1040} width={22} height={360} rx={11} fill={WHITE} opacity={0.25} />
      <rect x={50} y={1388} width={800} height={50} rx={10} fill={G3} />
      <rect x={50} y={1420} width={800} height={18} rx={9} fill={G2} />
      <rect x={72} y={1436} width={36} height={FLOOR - 1436} fill={G3} /><rect x={792} y={1436} width={36} height={FLOOR - 1436} fill={G3} />
      <rect x={84} y={1300} width={750} height={92} rx={34} fill={WHITE} />
      <rect x={84} y={1356} width={750} height={36} rx={18} fill={G4} />
      {/* the pillow */}
      <g transform={`translate(0 ${-lift * 0.5})`}>
        <path d="M 110 1296 C 100 1240 160 1200 250 1204 C 330 1200 380 1240 372 1296 Z" fill={WHITE} />
        <path d="M 120 1296 C 130 1270 170 1262 250 1266 C 320 1262 360 1272 372 1296 Z" fill={G4} />
      </g>
      {/* the sleeper: a lump under the blanket; the hump sinks as the muscles let go and hops on the jolt */}
      <g transform={`translate(0 ${-lift})`}>
        <path d={`M 330 1300 C 340 ${top + 60} 430 ${top} 560 ${top} C 690 ${top} 790 ${top + 70} 826 1300 Z`} fill={BLANKET} />
        <path d={`M 330 1300 C 335 1270 380 1262 450 1270 C 600 1282 760 1262 826 1300 Z`} fill={BLANKET_D} />
        <path d={`M 470 ${top + 20} C 520 ${top + 70} 640 ${top + 70} 700 ${top + 25}`} stroke={BLANKET_D} strokeWidth={10} strokeLinecap="round" fill="none" />
        <path d={`M 400 ${top + 78} C 480 ${top + 112} 640 ${top + 118} 770 ${top + 80}`} stroke={BLANKET_D} strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.8} />
        <g opacity={0.9}>{[0, 1, 2].map((i) => <rect key={i} x={560 + i * 54} y={top + 20 + (i % 2) * 8} width={28} height={28} rx={8} fill={WHITE} opacity={0.5} />)}</g>
      </g>
      {/* little jolt lines when the bed hops */}
      {jolt > 2 && [0, 1, 2, 3].map((i) => <rect key={i} x={430 + i * 110} y={top - 50 - lift * 0.4} width={10} height={44 + i * 6} rx={5} fill={YELLOW} opacity={Math.min(1, jolt / 20)} transform={`rotate(${(i - 1.5) * 12} ${435 + i * 110} ${top - 28})`} />)}
      {/* the nightstand with a lamp (it wobbles on the jolt) and the cup of coffee */}
      <rect x={880} y={1330} width={190} height={170} rx={12} fill={G3} />
      <rect x={880} y={1330} width={190} height={28} rx={10} fill={G4} />
      <rect x={900} y={1380} width={150} height={90} rx={8} fill={G2} /><rect x={966} y={1396} width={18} height={14} rx={7} fill={G3} />
      <g transform={`rotate(${wob} 945 1330)`}>
        <rect x={938} y={1230} width={14} height={104} fill={G2} />
        <path d="M 892 1236 L 998 1236 L 975 1170 L 915 1170 Z" fill={YELLOW} />
        <path d="M 892 1236 L 998 1236 L 990 1212 L 900 1212 Z" fill={YELLOW_D} opacity={0.55} />
      </g>
      {cupIn > 0.01 && (
        <g transform={`translate(1020 1330) scale(${cupIn}) translate(-1020 -1330)`}>
          <path d="M 990 1262 L 1050 1262 L 1044 1326 L 996 1326 Z" fill={WHITE} />
          <path d="M 990 1262 L 1050 1262 L 1048 1280 L 992 1280 Z" fill={G4} />
          <path d="M 1050 1274 C 1074 1274 1074 1306 1048 1306" stroke={WHITE} strokeWidth={9} fill="none" />
          {[0, 1].map((i) => <path key={i} d={`M ${1008 + i * 22} 1250 C ${1000 + i * 22 + Math.sin(amb * Math.PI * 2 * 12 + i) * 7} 1230 ${1020 + i * 22} 1214 ${1010 + i * 22} 1192`} stroke={G4} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.65} />)}
        </g>
      )}
    </g>
  );
};

/* ---------- screen pieces ---------- */
const Gauge: React.FC<{ clock: number }> = ({ clock }) => {
  const o = Math.max(win(clock, GAUGE.a, GAUGE.b, 0.4), win(clock, GAUGE.a2, GAUGE.b2, 0.4));
  if (o <= 0) return null;
  const p = muscleAt(clock);
  return (
    <g opacity={o}>
      <rect x={490} y={345} width={440} height={90} rx={32} fill={WHITE} />
      <text x={520} y={405} fontSize={40} fill={BLACK} style={BOLD}>tenaga otot</text>
      <rect x={750} y={373} width={150} height={34} rx={17} fill={G4} />
      <rect x={750} y={373} width={Math.max(8, 150 * p)} height={34} rx={17} fill={p < 0.12 ? RED : YELLOW} />
    </g>
  );
};

/** Ten small beds with a hump; seven carry a yellow jolt bolt (60 to 70 %). */
const Icons: React.FC<{ clock: number }> = ({ clock }) => {
  const o = 1 - clamp01((clock - ICONS.out) / 0.4);
  if (clock < ICONS.a || o <= 0) return null;
  return (
    <g opacity={o}>
      <rect x={540} y={450} width={390} height={290} rx={44} fill={WHITE} />
      {Array.from({ length: 10 }, (_, i) => {
        const p = Math.max(0, springAt(clock, ICONS.a + i * ICONS.step, true)), cx = 595 + (i % 5) * 74, cy = 530 + Math.floor(i / 5) * 90, hit = i < 7;
        return (
          <g key={i} transform={`translate(${cx} ${cy}) scale(${p * 0.56}) translate(${-cx} ${-cy})`}>
            <rect x={cx - 62} y={cy + 24} width={124} height={22} rx={9} fill={G3} />
            <path d={`M ${cx - 50} ${cy + 24} C ${cx - 48} ${cy - 12} ${cx + 20} ${cy - 16} ${cx + 52} ${cy + 24} Z`} fill={BLANKET} />
            <path d={`M ${cx - 50} ${cy + 24} C ${cx - 48} ${cy + 8} ${cx + 20} ${cy + 6} ${cx + 52} ${cy + 24} Z`} fill={BLANKET_D} />
            {hit && <path d={`M ${cx + 6} ${cy - 42} L ${cx - 10} ${cy - 12} L ${cx + 4} ${cy - 12} L ${cx - 6} ${cy + 12} L ${cx + 20} ${cy - 22} L ${cx + 6} ${cy - 22} Z`} fill={YELLOW} transform={`translate(0 -6)`} />}
          </g>
        );
      })}
      {clock >= PILL.a && (
        <g transform={`translate(735 ${700}) scale(${Math.max(0, springAt(clock, PILL.a, true))}) translate(-735 -700)`}>
          <rect x={595} y={668} width={280} height={60} rx={30} fill={YELLOW} />
          <text x={735} y={710} fontSize={38} fill={BLACK} textAnchor="middle" style={BOLD}>60-70 % orang</text>
        </g>
      )}
    </g>
  );
};

/** The brain's alarm bubble in the world: "JATUH?!" in a red card with a tail to the brain. */
const Bubble: React.FC<{ clock: number; b: { x: number; y: number; s: number } }> = ({ clock, b }) => {
  const p = springAt(clock, BUBBLE.a, true), o = 1 - clamp01((clock - BUBBLE.b) / 0.4);
  if (clock < BUBBLE.a || o <= 0) return null;
  const x = b.x - 225, y = b.y - 250;
  return (
    <g opacity={o} transform={`translate(${x} ${y}) scale(${Math.max(0, p)}) translate(${-x} ${-y})`}>
      <path d={`M ${x + 60} ${y + 40} L ${x + 190} ${y + 170} L ${x + 150} ${y + 40} Z`} fill={RED} />
      <rect x={x - 190} y={y - 55} width={380} height={110} rx={40} fill={RED} />
      <text x={x} y={y + 25} fontSize={72} fill={WHITE} textAnchor="middle" style={bold(800)}>JATUH?!</text>
    </g>
  );
};

/** The zigzag the brain sends down to the blanket (a signal that runs from the stem to the hump), and the red pulses around the brain at the alarm. */
const Zap: React.FC<{ clock: number; b: { x: number; y: number; s: number }; top: number }> = ({ clock, b, top }) => {
  if (clock < ZAP.a || clock > ZAP.b + 0.3) return null;
  const u = clamp01((clock - ZAP.a) / 0.35), o = 1 - clamp01((clock - ZAP.b) / 0.3);
  const x0 = b.x + 30, y0 = b.y + 180 * b.s * 2, x1 = 560, y1 = top - 10;
  const pts = Array.from({ length: 7 }, (_, i) => { const k = i / 6; return [x0 + (x1 - x0) * k + (i % 2 ? 36 : -36) * (i > 0 && i < 6 ? 1 : 0), y0 + (y1 - y0) * k] as const; });
  const full = "M " + pts.map((p) => `${p[0]} ${p[1]}`).join(" L ");
  const dash = 1400;
  return <path d={full} stroke={YELLOW} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={o} strokeDasharray={dash} strokeDashoffset={dash * (1 - u)} />;
};

const Card: React.FC<{ y: number; title: string; sub: string; a: number; out: number; clock: number }> = ({ y, title, sub, a, out, clock }) => {
  const p = springAt(clock, a, true), o = 1 - clamp01((clock - out) / 0.4);
  if (clock < a || o <= 0) return null;
  return (
    <g transform={`translate(540 ${y + 105}) scale(${Math.max(0, p)}) translate(-540 ${-(y + 105)})`} opacity={o}>
      <rect x={470} y={y} width={SAFE.right - 470} height={210} rx={44} fill={WHITE} />
      <rect x={470} y={y + 34} width={14} height={142} rx={7} fill={YELLOW} />
      <text x={534} y={y + 96} fontSize={58} fill={BLACK} style={bold(700)}>{title}</text>
      <text x={534} y={y + 164} fontSize={40} fill={G1} style={bold(600)}>{sub}</text>
    </g>
  );
};

/** The hook claim at frame 0: a black box per line, the key word yellow, in the top third; the last 0.5 s of the outro brings it back (B41: the loop). */
const HookText: React.FC<{ clock: number }> = ({ clock }) => {
  const o = clock > 20 ? clamp01((clock - 39.4) / 0.4) : 1 - clamp01((clock - 2.7) / 0.3);
  if (o <= 0) return null;
  const lines: [string, boolean][] = [["Otakmu kira", false], ["kamu jatuh", true]];
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

const Scene = ({ beat, t, clock, story }: SceneProps) => {
  const amb = loopClock(clock, story.beats.reduce((a, b) => a + b.dur, 0), 40) / 40;   // 0..1 over the loop
  const cam = camAt(clock), br = brainAt(clock), set = setAt(clock), muscle = muscleAt(clock), jolt = joltAt(clock);
  const sting = beat.kind === "sting", outro = beat.kind === "outro", hook = beat.kind === "hook";
  const tx = `translate(${W / 2} ${H / 2}) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`;
  const top = 1150 + (1 - muscle) * 20 - jolt * 0.9 - jolt * 0.5;
  const alarm = win(clock, BUBBLE.a - 0.2, BUBBLE.b, 0.3) * (0.6 + 0.4 * Math.sin(clock * 14));
  const pulse = 1 + 0.015 * Math.sin(amb * Math.PI * 2 * 20);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill={G4} />
      <g transform={tx}>
        <g opacity={set}><Room clock={clock} amb={amb} muscle={muscle} jolt={jolt} /></g>
        <g transform={`translate(${br.x} ${br.y - jolt * 0.3}) scale(${br.s * pulse})`}><Brain amb={amb} alarm={alarm} /></g>
        {alarm > 0.01 && [0, 1].map((i) => <circle key={i} cx={br.x} cy={br.y} r={(300 + ((clock * 150 + i * 150) % 300)) * br.s * 1.1} fill={RED} opacity={0.12 * alarm} />)}
        <Bubble clock={clock} b={br} />
        <Zap clock={clock} b={br} top={top} />
      </g>
      <Gauge clock={clock} />
      <Icons clock={clock} />
      <Card y={450} title="Kafein, stres" sub="sering disebut ahli" a={CARDS[0].a} out={CARDS[0].out} clock={clock} />
      <Card y={690} title="Kurang tidur" sub="olahraga berat malam" a={CARDS[1].a} out={CARDS[1].out} clock={clock} />
      {(hook || outro) && <HookText clock={clock} />}
      {sting && <StingMark slug="kenapa-kaget-kayak-jatuh-pas-m" t={t} clock={clock} />}
      {!hook && !sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {!hook && !sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
