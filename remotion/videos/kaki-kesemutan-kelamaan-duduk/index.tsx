/* Kesemutan? Sarafmu kejepit — look 2d (B28): a flat SIDE view of a seated leg at a bus-stop bench (set kind "bus-stop-bench", see set.json). Real shapes (B27.16):
   a leg seen from the side is a thigh lying on the seat, a round knee, a shin that tapers to a narrow ankle and a foot that points forward; the sciatic nerve runs
   down the back of the thigh, next to the vessel, with the thigh bone above them. The thigh has a window (a rounded oval, a lip of skin all round) that shows them.
   Two tones per part (base and shade, light from the top left), no outlines, palette tokens only. The world is one group moved by the camera (plan.ts camAt); the
   labels, the tip cards and the hook text are drawn on the screen. Ambient motion (the cloud, the leaves, the blood cells, the needles) runs on the loop clock (B29). */
import React from "react";
import {
  loopClock, BLACK, BLUSH, CaptionLayer, FONT_BOLD, G1, G2, G3, G4, Arrow, RED, SAFE, SKIN_A, SKIN_B, StoryVideo, THEMES, TopText, WHITE, YELLOW,
  YELLOW_D, clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { CARDS, FIRE, LABELS, THICK, WEIGHT, WIGGLE, camAt, liftAt, prickAt, sqAt, winAt } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { saraf: "SARAF", duduk: "DUDUK", berdiri: "BERDIRI", jepit: "JAWABANNYA", tips: "TIPS" };
const MINT = THEMES.mint;
const GROUND = 1690;                                       // the pavement (world y), where the sole rests
const SEAT = 1160;                                         // the top of the seat plank
const KNEE = { x: 690, y: 1075, r: 85 };                   // the pivot of the thigh
const WIN = { x: 452, y: 1075, rx: 140, ry: 66 };          // the window on the thigh


const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const sway = (t: number, p: number, a: number) => a * Math.sin((2 * Math.PI * t) / p);
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** A world point on the screen at the camera c. */
const toScreen = (c: { x: number; y: number; z: number }, x: number, y: number): [number, number] => [W / 2 + (x - c.x) * c.z, H / 2 + (y - c.y) * c.z];

/** The nerve and the vessel run along the thigh with a gentle wave. */
const lineAt = (y0: number, x: number, ph: number) => y0 + 5 * Math.sin((x - 300) / 38 + ph);
const polyline = (y0: number, ph: number) => {
  const pts: string[] = [];
  for (let x = 296; x <= 612; x += 8) pts.push(`${x} ${lineAt(y0, x, ph).toFixed(1)}`);
  return `M ${pts.join(" L ")}`;
};

/* ---------- the set: sky, far hills and tree, pavement, bench, sign pole ---------- */
const Far: React.FC<{ amb: number }> = ({ amb }) => {
  const busX = -500 + 2400 * ((amb / 40) % 1);                           // one pass in 40 s: the loop clock, off the frame at both ends
  return (
    <g>
      <path d="M -900 1560 C -600 1470 -300 1500 0 1540 C 250 1575 420 1480 700 1500 C 950 1520 1150 1450 1500 1520 C 1700 1550 1900 1500 2100 1540 L 2100 1700 L -900 1700 Z" fill={MINT.ring} />
      <path d="M -900 1620 C -500 1560 -200 1590 100 1610 C 400 1630 700 1560 1000 1590 C 1300 1620 1600 1570 2100 1610 L 2100 1700 L -900 1700 Z" fill={MINT.floorEdge} opacity={0.75} />
      <rect x={-900} y={1558} width={3000} height={16} fill={G3} opacity={0.6} />
      <g transform={`translate(${busX} 1560)`}>
        {/* a far bus crossing behind the bench once in 40 s: a long body, a window band, two wheels */}
        <rect x={-150} y={-96} width={300} height={90} rx={18} fill={G3} />
        <rect x={-150} y={-30} width={300} height={24} rx={8} fill={G2} />
        {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={-126 + k * 50} y={-82} width={38} height={34} rx={6} fill={G4} />)}
        <circle cx={-90} cy={-4} r={22} fill={G1} /><circle cx={90} cy={-4} r={22} fill={G1} />
        <circle cx={-90} cy={-4} r={9} fill={G3} /><circle cx={90} cy={-4} r={9} fill={G3} />
      </g>
      {/* a round tree: a trunk and a crown, the crown's lower half in the shade tone */}
      <path d="M 228 1626 L 236 1400 L 264 1400 L 272 1626 Z" fill={G2} />
      <path d="M 250 1470 L 214 1420 M 252 1450 L 296 1400" stroke={G2} strokeWidth={14} strokeLinecap="round" />
      <g transform={`rotate(${sway(amb, 5, 1.2)} 250 1440)`}>
        <ellipse cx={250} cy={1350} rx={170} ry={110} fill={MINT.floorEdge} />
        <circle cx={160} cy={1380} r={72} fill={MINT.floorEdge} /><circle cx={340} cy={1385} r={66} fill={MINT.floorEdge} />
        <path d="M 80 1360 Q 250 1470 420 1360 Q 380 1445 250 1460 Q 120 1445 80 1360 Z" fill={MINT.ring} opacity={0.9} />
        <circle cx={200} cy={1310} r={30} fill={MINT.floor} opacity={0.8} />
      </g>
    </g>
  );
};

const Pavement: React.FC = () => (
  <g>
    <rect x={-900} y={GROUND} width={3000} height={900} fill={MINT.floor} />
    <rect x={-900} y={GROUND} width={3000} height={18} fill={MINT.floorEdge} />
    <rect x={-900} y={GROUND + 150} width={3000} height={10} fill={MINT.floorEdge} opacity={0.5} />
  </g>
);

/** A bench seen from the side: a seat plank on two end frames, one near and one far. */
const Bench: React.FC = () => (
  <g>
    <rect x={-120} y={SEAT + 36} width={30} height={GROUND - SEAT - 36} rx={8} fill={G3} />
    <rect x={500} y={SEAT + 36} width={36} height={GROUND - SEAT - 36} rx={8} fill={G2} />
    <rect x={500} y={SEAT + 36} width={14} height={GROUND - SEAT - 36} rx={7} fill={G1} opacity={0.55} />
    <rect x={-420} y={SEAT} width={1180} height={44} rx={16} fill={G3} />
    <rect x={-420} y={SEAT + 26} width={1180} height={18} rx={9} fill={G2} />
    <rect x={-420} y={SEAT + 1} width={1180} height={9} rx={4} fill={G4} opacity={0.8} />
    <rect x={-120} y={SEAT + 44} width={640} height={16} fill={G2} />
  </g>
);

/** A bus-stop sign on a pole (a white disc with a small bus in it); the frame cuts the disc. */
const Sign: React.FC = () => (
  <g>
    <rect x={1030} y={700} width={20} height={GROUND - 700} rx={8} fill={G2} />
    <rect x={1030} y={700} width={8} height={GROUND - 700} rx={4} fill={G1} opacity={0.5} />
    <circle cx={1040} cy={650} r={78} fill={G2} />
    <circle cx={1040} cy={650} r={62} fill={WHITE} />
    <rect x={1004} y={626} width={72} height={40} rx={9} fill={G2} />
    <rect x={1012} y={634} width={26} height={14} rx={3} fill={G4} /><rect x={1044} y={634} width={26} height={14} rx={3} fill={G4} />
    <circle cx={1018} cy={670} r={7} fill={G1} /><circle cx={1062} cy={670} r={7} fill={G1} />
  </g>
);

/* ---------- the leg ---------- */
const Shin: React.FC<{ thick: number; wig: number }> = ({ thick, wig }) => (
  <g>
    {/* the shin: wide under the knee, a calf on the back (left), narrow at the ankle */}
    <path d="M 625 1110 C 590 1250 628 1450 665 1592 L 755 1592 C 768 1450 792 1250 775 1078 Z" fill={SKIN_A} />
    <path d="M 625 1110 C 590 1250 628 1450 665 1592 L 700 1592 C 664 1450 640 1250 662 1110 Z" fill={SKIN_B} opacity={0.55} />
    {/* the foot: heel, arch, ball and toes, pointing forward; it turns about the ankle when it wiggles */}
    <g transform={`rotate(${wig} 660 1688)`}>
      <path d="M 662 1586 L 758 1586 C 788 1618 806 1640 896 1650 C 968 1656 988 1672 982 1690 L 642 1690 C 630 1650 640 1610 662 1586 Z" fill={SKIN_A} />
      <path d="M 642 1690 C 630 1650 640 1610 662 1586 L 690 1586 C 668 1620 662 1650 672 1690 Z" fill={SKIN_B} opacity={0.55} />
      <path d="M 700 1690 C 760 1672 880 1676 982 1690 Z" fill={SKIN_B} opacity={0.6} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={918 + i * 17} y={1664 + i * 4} width={5} height={22 - i * 3} rx={2.5} fill={SKIN_B} opacity={0.8} />)}
      <rect x={958} y={1668} width={18} height={11} rx={5} fill={WHITE} opacity={0.65} />
    </g>
    {thick > 0 && <g opacity={0.4 * thick}>
      <path d="M 625 1110 C 590 1250 628 1450 665 1592 L 755 1592 C 768 1450 792 1250 775 1078 Z" fill={G3} />
      <path d="M 662 1586 L 758 1586 C 788 1618 806 1640 896 1650 C 968 1656 988 1672 982 1690 L 642 1690 C 630 1650 640 1610 662 1586 Z" fill={G3} />
    </g>}
  </g>
);

/** The window's content: bone, muscle, the vessel with its blood cells and the nerve with its signals. `sq` is the squeeze (0..1), `fire` the sparks. */
const Inside: React.FC<{ sq: number; fire: number; clock: number }> = ({ sq, fire, clock }) => {
  const flow = 1 - sq;
  const nerveW = lerp(24, 8, sq), vesW = lerp(18, 5, sq);
  const blood = [0, 1, 2, 3, 4, 5];
  const pulses = [0, 1, 2];
  const sparks = [0, 1, 2, 3, 4, 5];
  const tick = Math.floor(clock * 14);
  return (
    <g>
      <rect x={290} y={1000} width={340} height={150} fill={SKIN_A} />
      <rect x={290} y={1000} width={340} height={150} fill={RED} opacity={0.3} />
      <rect x={290} y={1100} width={340} height={50} fill={SKIN_B} opacity={0.35} />
      {/* the thigh bone: a shaft that ends in a rounded knob toward the knee */}
      <path d="M 290 1024 L 520 1020 C 560 1016 590 1008 604 1030 C 612 1050 592 1064 562 1052 L 290 1046 Z" fill={WHITE} />
      <path d="M 290 1038 L 556 1046 C 586 1056 606 1048 604 1032 C 600 1058 580 1062 560 1052 L 290 1046 Z" fill={G4} />
      {/* the vessel: a red tube that narrows when it is squeezed, blood cells run along it */}
      <path d={polyline(1086, 0.8)} fill="none" stroke={RED} strokeWidth={vesW} strokeLinecap="round" opacity={lerp(1, 0.55, sq)} />
      <path d={polyline(1086 - vesW * 0.22, 0.8)} fill="none" stroke={BLUSH} strokeWidth={Math.max(2, vesW * 0.28)} strokeLinecap="round" opacity={0.7 * flow} />
      {blood.map((i) => {
        const u = (((clock * 0.35) + i / blood.length) % 1), x = 612 - u * 316;
        return <circle key={i} cx={x} cy={lineAt(1086, x, 0.8)} r={lerp(6, 3, sq)} fill={WHITE} opacity={0.9 * flow} />;
      })}
      {/* the nerve: a cream-yellow cord, grey and thin when it is pinched */}
      <path d={polyline(1114, 0)} fill="none" stroke={G3} strokeWidth={nerveW} strokeLinecap="round" />
      <path d={polyline(1114, 0)} fill="none" stroke={YELLOW} strokeWidth={nerveW} strokeLinecap="round" opacity={1 - sq} />
      <path d={polyline(1114 - nerveW * 0.2, 0)} fill="none" stroke={WHITE} strokeWidth={Math.max(2, nerveW * 0.22)} strokeLinecap="round" opacity={0.55 * (1 - sq)} />
      {/* the signal runs toward the brain (to the left) while the nerve is free */}
      {pulses.map((i) => {
        const u = (((clock * 0.8) + i / pulses.length) % 1), x = 612 - u * 316, a = clamp01(1 - sq * 2.2);
        return <g key={i} opacity={a}><circle cx={x} cy={lineAt(1114, x, 0)} r={13} fill={YELLOW} opacity={0.45} /><circle cx={x} cy={lineAt(1114, x, 0)} r={7} fill={WHITE} /></g>;
      })}
      {/* once the pressure is gone the nerve fires by itself, at random places */}
      {fire > 0 && sparks.map((i) => {
        const x = 330 + rnd(tick * 7 + i * 3) * 260, y = 1096 + rnd(tick * 5 + i * 11) * 34, a = rnd(tick * 3 + i * 17) * 360;
        return <g key={i} opacity={fire * (rnd(tick + i) > 0.25 ? 1 : 0.2)} transform={`translate(${x} ${y}) rotate(${a})`}>
          <path d="M -13 0 L -4 -5 L 2 4 L 13 0" fill="none" stroke={YELLOW} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </g>;
      })}
    </g>
  );
};

/** The needles of pins and needles around the shin and the foot. */
const Needles: React.FC<{ amt: number; clock: number }> = ({ amt, clock }) => {
  const tick = clock < 0.5 || clock > 39.2 ? 0 : Math.floor(clock * 9);   // the same needles at the first and the last frame (the loop)
  return (
    <g>
      {Array.from({ length: 14 }, (_, k) => {
        const foot = k % 2 === 0, x = foot ? 640 + rnd(tick + k * 7) * 360 : 610 + rnd(tick + k * 5) * 190, y = foot ? 1600 + rnd(tick * 3 + k) * 80 : 1300 + rnd(tick + k * 9) * 260;
        const on = rnd(tick * 2 + k * 13) < amt, a = (rnd(tick + k * 19) - 0.5) * 140;
        return on ? <g key={k} transform={`translate(${x} ${y}) rotate(${a})`}>
          <path d="M 0 -20 L 5 0 L 0 20 L -5 0 Z" fill={YELLOW} />
          <path d="M 0 -20 L 5 0 L 0 20 Z" fill={YELLOW_D} />
        </g> : null;
      })}
    </g>
  );
};

const World: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const c = camAt(clock), lift = liftAt(clock), sq = sqAt(clock), w = winAt(clock);
  const fire = win(clock, FIRE.a, FIRE.b, 0.25);
  const weight = win(clock, WEIGHT.a, WEIGHT.b, 0.4), thick = win(clock, THICK.a, THICK.b, 0.8);
  const wig = -win(clock, WIGGLE.a, WIGGLE.b, 0.3) * 10 * (1 - Math.cos(((clock - WIGGLE.a) * 2 * Math.PI) / 1.1)) / 2;
  const press = 5 * sq;                                        // the leg sinks into the seat when it is squeezed hard
  const par = `translate(${(c.x - 540) * 0.65} ${(c.y - 1180) * 0.65})`;
  const clipId = "kk-win";
  const open = Math.max(0.001, w);
  return (
    <g>
      <rect x={-1200} y={-900} width={4200} height={GROUND + 920} fill={MINT.wall} />
      <g transform={par}><Far amb={amb} /></g>
      <Pavement />
      <Sign />
      <Bench />
      <Shin thick={thick} wig={wig} />
      {/* the thigh, hinged at the knee: it lifts off the seat when the person gets up */}
      <g transform={`translate(0 ${press}) rotate(${-27 * lift} ${KNEE.x} ${KNEE.y})`}>
        <path d={`M -140 990 L ${KNEE.x} 990 A ${KNEE.r} ${KNEE.r} 0 0 1 ${KNEE.x} ${SEAT} L -140 ${SEAT} Z`} fill={SKIN_A} />
        <rect x={-140} y={SEAT - 34} width={KNEE.x + 140} height={34} fill={SKIN_B} opacity={0.45} />
        <circle cx={KNEE.x + 30} cy={KNEE.y + 6} r={46} fill={SKIN_B} opacity={0.3} />
        {/* the shorts: grey, hemmed with a darker band */}
        <path d={`M -140 980 L 300 980 Q 312 980 312 992 L 312 ${SEAT - 8} Q 312 ${SEAT + 2} 300 ${SEAT + 2} L -140 ${SEAT + 2} Z`} fill={G2} />
        <path d={`M 286 980 L 300 980 Q 312 980 312 992 L 312 ${SEAT - 8} Q 312 ${SEAT + 2} 300 ${SEAT + 2} L 286 ${SEAT + 2} Z`} fill={G1} opacity={0.6} />
        <path d="M 60 1010 Q 120 1060 70 1140 M 190 1000 Q 240 1070 200 1150" fill="none" stroke={G1} strokeWidth={8} strokeLinecap="round" opacity={0.3} />
        {/* the window: a lip of skin in the shade tone, then the inside, scaled open by the plan */}
        <g transform={`translate(${WIN.x} ${WIN.y}) scale(${open}) translate(${-WIN.x} ${-WIN.y})`} opacity={w > 0.001 ? 1 : 0}>
          <ellipse cx={WIN.x} cy={WIN.y} rx={WIN.rx + 9} ry={WIN.ry + 9} fill={SKIN_B} />
          <clipPath id={clipId}><ellipse cx={WIN.x} cy={WIN.y} rx={WIN.rx} ry={WIN.ry} /></clipPath>
          <g clipPath={`url(#${clipId})`}><Inside sq={sq} fire={fire} clock={clock} /></g>
        </g>
      </g>
      {/* the weight of the body: arrows press down on the thigh */}
      {weight > 0 && <g opacity={weight}>
        {[200, 360, 520].map((x, i) => <Arrow key={x} x={x} y={820} x2={x} y2={968} color="black" w={13} draw={clamp01((clock - WEIGHT.a - 0.3 - i * 0.25) / 0.5)} />)}
      </g>}
      <Needles amt={prickAt(clock)} clock={clock} />
    </g>
  );
};

/* ---------- the screen layer: hook text, labels, tip cards ---------- */
const HookText: React.FC<{ clock: number }> = ({ clock }) => {
  const o = clock > 20 ? clamp01((clock - 39.5) / 0.5) : 1 - clamp01((clock - 2.7) / 0.3);   // frame 0 has it, the last 0.5 s of the outro brings it back (B41: the loop)
  const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 800 } as const;
  const lines = ["Kesemutan?", "Sarafmu", "kejepit."];
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
  return (
    <g opacity={o}>
      {l.at && <path d={`M ${sx} ${l.y + 24} L ${px} ${py - 10}`} stroke={BLACK} strokeWidth={5} strokeLinecap="round" />}
      {l.at && <circle cx={px} cy={py} r={9} fill={BLACK} />}
      <text x={l.x} y={l.y} fontSize={54} fill={BLACK} textAnchor="middle" style={bold}>{l.text}</text>
    </g>
  );
};

const Card: React.FC<{ y: number; title: string; sub: string; a: number; out: number; clock: number }> = ({ y, title, sub, a, out, clock }) => {
  const p = springAt(clock, a, true), o = 1 - clamp01((clock - out) / 0.4);
  if (clock < a || o <= 0) return null;
  return (
    <g transform={`translate(540 ${y + 105}) scale(${Math.max(0, p)}) translate(-540 ${-(y + 105)})`} opacity={o}>
      {/* full safe width and phone-readable sizes: the sub line was a 38 px mono that read as fine print */}
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
      <Card y={450} title="Ganti posisi" sub="gerakkan kakimu" a={CARDS[0].a} out={CARDS[0].out} clock={clock} />
      <Card y={690} title="Sering tanpa sebab?" sub="periksa ke dokter" a={CARDS[1].a} out={CARDS[1].out} clock={clock} />
      {(hook || outro) && <HookText clock={clock} />}
      {sting && <StingMark slug="kaki-kesemutan-kelamaan-duduk" t={t} clock={clock} />}
      {!hook && !sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {/* no caption in the hook: the hook text already says the same words, and frame 0 then matches the last frame (the loop) */}
      {!hook && !sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
