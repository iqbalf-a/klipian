/* Mata kedutan? Bukan pertanda — look 2d (B28): a flat FRONT view of one eye in a round wall mirror (set kind "mirror-wall-shelf", see set.json). Real shapes (B27.16):
   an eye seen from the front is an almond (corners pointed, the upper lid arched, the lower lid flatter), the iris a disc cut by both lids, the upper lid carries a
   crease and the lashes, the brow sits well above. The thin muscle that closes the lid (orbicularis oculi) runs in arcs around the eye; the facial nerve reaches it
   from the side (the temple). The upper lid has a window (a rounded oval, a lip of skin all round) that shows them.
   Two tones per part (base and shade, light from the top left), no outlines, palette tokens only. The world is one group moved by the camera (plan.ts camAt); the
   labels, the cards and the hook text are drawn on the screen. Ambient motion (the steam, the clock, the cloud, the drop) runs on the loop clock (B29). */
import React from "react";
import {
  loopClock, BLACK, BLUSH, CaptionLayer, COFFEE, COFFEE_LIGHT, FONT_BOLD, G1, G2, G3, G4, RED, SAFE, SKIN_A, SKIN_B, STEAM, StoryVideo, THEMES, TopText, WHITE,
  YELLOW, YELLOW_D, clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { CARDS, CHIPS, LABELS, MIRROR, STAMP, TRIGGERS, WIN, blinkAt, camAt, tiredAt, twitchAt, winAt } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { saraf: "KELOPAK", pemicu: "PEMICU", lama: "JAWABANNYA", tips: "TIPS" };
const PEACH = THEMES.peach;
const SHELF = 1650;                                        // the top of the shelf plank (world y)
const TAU = Math.PI * 2;

const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const sway = (t: number, p: number, a: number) => a * Math.sin((TAU * t) / p);
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const toScreen = (c: { x: number; y: number; z: number }, x: number, y: number): [number, number] => [W / 2 + (x - c.x) * c.z, H / 2 + (y - c.y) * c.z];
const bez = (p: [number, number][], u: number): [number, number] => {
  const m = 1 - u, k = [m * m * m, 3 * m * m * u, 3 * m * u * u, u * u * u];
  return [k[0] * p[0][0] + k[1] * p[1][0] + k[2] * p[2][0] + k[3] * p[3][0], k[0] * p[0][1] + k[1] * p[1][1] + k[2] * p[2][1] + k[3] * p[3][1]];
};

/* ---------- the set: the wall, a shelf with a clock and a mug ---------- */
const Wall: React.FC = () => (
  <g>
    <rect x={-1200} y={-900} width={4200} height={4200} fill={PEACH.wall} />
    {Array.from({ length: 12 }, (_, r) => Array.from({ length: 19 }, (_, c) => (
      <circle key={`${r}-${c}`} cx={-780 + c * 120 + (r % 2) * 60} cy={140 + r * 160} r={9} fill={PEACH.ring} />
    )))}
    <rect x={-1200} y={1900} width={4200} height={1400} fill={PEACH.floor} />
    <rect x={-1200} y={1900} width={4200} height={16} fill={PEACH.floorEdge} />
  </g>
);

const Shelf: React.FC<{ amb: number; coffee: number }> = ({ amb, coffee }) => {
  const sec = Math.floor(amb) * 9;                          // 9 degrees a second: 40 s is one turn, so the loop closes
  const steam = [0, 1, 2, 3].map((i) => {
    const x0 = 760 + i * 28, h = 70 + coffee * 70 + i * 6, ph = amb * 0.9 + i * 0.7;
    return <path key={i} d={`M ${x0} 1515 C ${x0 + 24 * Math.sin(ph)} ${1515 - h * 0.33} ${x0 - 24 * Math.sin(ph + 1)} ${1515 - h * 0.66} ${x0 + 10 * Math.sin(ph + 2)} ${1515 - h}`}
      fill="none" stroke={STEAM} strokeWidth={9 + coffee * 3} strokeLinecap="round" opacity={0.55 + 0.35 * coffee} />;
  });
  return (
    <g>
      <path d="M 450 1690 L 450 1760 L 520 1690 Z M 640 1690 L 710 1690 L 640 1760 Z" fill={G2} />
      <rect x={-600} y={SHELF} width={2400} height={44} rx={10} fill={G3} />
      <rect x={-600} y={SHELF} width={2400} height={12} rx={6} fill={G4} />
      <rect x={-600} y={SHELF + 32} width={2400} height={12} fill={G2} opacity={0.5} />
      {/* the alarm clock: two bells, a round face, two hands set at two o'clock (late) and a second hand that ticks */}
      <g>
        <ellipse cx={260} cy={SHELF - 2} rx={86} ry={9} fill={G2} opacity={0.3} />
        <rect x={190} y={SHELF - 34} width={16} height={34} rx={6} fill={G2} /><rect x={314} y={SHELF - 34} width={16} height={34} rx={6} fill={G2} />
        <circle cx={196} cy={1455} r={34} fill={G2} transform="rotate(-24 196 1455)" /><circle cx={324} cy={1455} r={34} fill={G2} transform="rotate(24 324 1455)" />
        <circle cx={260} cy={1560} r={96} fill={G2} /><circle cx={260} cy={1560} r={82} fill={WHITE} />
        <path d="M 260 1560 L 260 1478 A 82 82 0 0 0 190 1520 Z" fill={G4} opacity={0.7} />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={257} y={1484} width={6} height={i % 3 === 0 ? 20 : 11} rx={3} fill={G1} transform={`rotate(${i * 30} 260 1560)`} />)}
        <rect x={255} y={1502} width={10} height={60} rx={5} fill={G1} transform="rotate(60 260 1560)" />
        <rect x={257} y={1492} width={6} height={70} rx={3} fill={G1} />
        <rect x={258.5} y={1488} width={3} height={80} rx={1.5} fill={RED} transform={`rotate(${sec} 260 1560)`} />
        <circle cx={260} cy={1560} r={9} fill={G1} />
      </g>
      {/* the mug of coffee with its steam */}
      <g>
        <ellipse cx={790} cy={SHELF - 2} rx={76} ry={8} fill={G2} opacity={0.3} />
        <circle cx={858} cy={1590} r={34} fill="none" stroke={WHITE} strokeWidth={15} />
        <rect x={730} y={1520} width={120} height={SHELF - 1520} rx={18} fill={WHITE} />
        <rect x={730} y={1520} width={34} height={SHELF - 1520} rx={14} fill={G4} />
        <ellipse cx={790} cy={1522} rx={60} ry={13} fill={WHITE} /><ellipse cx={790} cy={1524} rx={50} ry={9} fill={COFFEE} />
        <rect x={744} y={1578} width={92} height={26} rx={6} fill={YELLOW} opacity={0.9} />
        {steam}
      </g>
    </g>
  );
};

/* ---------- the hero: a round mirror with one eye in it ---------- */
const topCurve = (d: number, up = 0) => `M 200 1150 C 330 ${1000 + d + up} 750 ${1000 + d + up} 880 1150`;

const Eye: React.FC<{ d: number; brow: number; look: number }> = ({ d, brow, look }) => {
  const sclera = `${topCurve(d)} C 750 1290 330 1290 200 1150 Z`;
  const cd = d * 0.5;
  return (
    <g>
      {/* the brow, well above the eye */}
      <path transform={`translate(0 ${brow})`} d="M 205 905 C 320 790 660 760 880 850 C 892 872 878 884 852 880 C 650 824 360 846 246 938 C 218 956 190 930 205 905 Z" fill={COFFEE} />
      {/* the white of the eye with the iris, cut by both lids */}
      <clipPath id="mk-eye"><path d={sclera} /></clipPath>
      <path d={sclera} fill={WHITE} />
      <g clipPath="url(#mk-eye)">
        <circle cx={540 + look} cy={1166} r={112} fill={COFFEE} />
        <circle cx={540 + look} cy={1166} r={84} fill={COFFEE_LIGHT} />
        <circle cx={540 + look} cy={1166} r={46} fill={BLACK} />
        <circle cx={506 + look} cy={1128} r={17} fill={WHITE} /><circle cx={582 + look} cy={1196} r={8} fill={WHITE} opacity={0.8} />
        {/* the shade the upper lid casts on the eye */}
        <path d={`${topCurve(d)} C 750 ${1052 + d} 330 ${1052 + d} 200 1150 Z`} fill={SKIN_B} opacity={0.34} />
      </g>
      {/* the lower lid: a soft shade line under the eye */}
      <path d="M 232 1182 C 350 1294 730 1294 850 1182 C 740 1322 340 1322 232 1182 Z" fill={SKIN_B} opacity={0.55} />
      {/* the upper lid: the crease above, the lash line on its edge, the lashes at the outer corner */}
      <path d={`M 215 1108 C 340 ${925 + cd} 740 ${925 + cd} 865 1108 C 740 ${944 + cd} 340 ${944 + cd} 215 1108 Z`} fill={SKIN_B} opacity={0.8} />
      <path d={`${topCurve(d, -2)} C 750 ${1000 + d - 24} 330 ${1000 + d - 24} 200 1150 Z`} fill={BLACK} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M ${842 + i * 12} ${1092 + i * 18 + d * 0.3} L ${886 + i * 18} ${1062 + i * 20 + d * 0.3} L ${858 + i * 12} ${1108 + i * 18 + d * 0.3} Z`} fill={BLACK} />)}
    </g>
  );
};

/** The window's content: the muscle in arcs around the eye, the nerve from the temple, the signals, and the sparks of a wrong signal. `tw` is the twitch (0..1). */
const Inside: React.FC<{ tw: number; clock: number }> = ({ tw, clock }) => {
  const arcs = [0, 1, 2, 3, 4, 5];
  const main: [number, number][] = [[840, 900], [770, 900], [724, 944], [664, 972]];
  const mainD = `M ${main[0][0]} ${main[0][1]} C ${main[1][0]} ${main[1][1]} ${main[2][0]} ${main[2][1]} ${main[3][0]} ${main[3][1]}`;
  const tick = Math.floor(clock * 14);
  const contract = tw * (0.5 + 0.5 * Math.sin(clock * 44));
  return (
    <g>
      <rect x={250} y={880} width={600} height={210} fill={SKIN_A} />
      <rect x={250} y={880} width={600} height={210} fill={RED} opacity={0.22} />
      <rect x={250} y={1040} width={600} height={50} fill={SKIN_B} opacity={0.3} />
      {arcs.map((i) => {
        const y = 936 + i * 24 + contract * 10;
        return <g key={i}>
          <path d={`M 236 ${y + 40} C 380 ${y - 36} 700 ${y - 36} 850 ${y + 40}`} fill="none" stroke={RED} strokeWidth={15 + contract * 7} strokeLinecap="round" opacity={0.62} />
          <path d={`M 252 ${y + 32} C 390 ${y - 42} 690 ${y - 42} 830 ${y + 32}`} fill="none" stroke={BLUSH} strokeWidth={4} strokeLinecap="round" opacity={0.75} />
        </g>;
      })}
      {/* the nerve: a cream-yellow cord from the temple (right) that splits into three twigs over the muscle */}
      <path d={mainD} fill="none" stroke={G3} strokeWidth={27} strokeLinecap="round" />
      <path d={mainD} fill="none" stroke={YELLOW} strokeWidth={21} strokeLinecap="round" />
      {["M 664 972 C 600 958 540 968 470 1000", "M 664 972 C 610 990 520 1006 430 1030", "M 664 972 C 620 956 580 930 500 944"].map((d, i) => (
        <g key={i}><path d={d} fill="none" stroke={G3} strokeWidth={11} strokeLinecap="round" /><path d={d} fill="none" stroke={YELLOW} strokeWidth={7} strokeLinecap="round" /></g>
      ))}
      {/* the signal runs along the nerve toward the muscle (to the left) */}
      {[0, 1, 2].map((i) => {
        const u = ((clock * 0.8) + i / 3) % 1, [x, y] = bez(main, u), a = 1 - tw * 0.8;
        return <g key={i} opacity={a}><circle cx={x} cy={y} r={14} fill={YELLOW} opacity={0.45} /><circle cx={x} cy={y} r={7} fill={WHITE} /></g>;
      })}
      {/* a wrong signal: sparks fly at random places over the twigs while the lid jumps */}
      {tw > 0.05 && [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const x = 420 + rnd(tick * 7 + i * 3) * 280, y = 920 + rnd(tick * 5 + i * 11) * 110, a = rnd(tick * 3 + i * 17) * 360;
        return <g key={i} opacity={tw * (rnd(tick + i) > 0.25 ? 1 : 0.2)} transform={`translate(${x} ${y}) rotate(${a})`}>
          <path d="M -14 0 L -4 -6 L 2 5 L 14 0" fill="none" stroke={YELLOW_D} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </g>;
      })}
    </g>
  );
};

const Mirror: React.FC<{ clock: number }> = ({ clock }) => {
  const tw = twitchAt(clock), blink = blinkAt(clock), tired = tiredAt(clock), w = winAt(clock);
  const jitter = tw * (0.5 + 0.5 * Math.sin(clock * 44));
  const d = jitter * 15 + tired * 36 + blink * 290;
  const look = sway(clock, 9, 5);
  const open = Math.max(0.001, w);
  return (
    <g>
      <circle cx={MIRROR.x + 14} cy={MIRROR.y + 20} r={MIRROR.r} fill={PEACH.floorEdge} opacity={0.6} />
      {/* the cord and the nail the mirror hangs on */}
      <g opacity={1 - w}>
        <path d="M 440 745 L 540 695 L 640 745" fill="none" stroke={G2} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={540} cy={695} r={14} fill={G1} />
      </g>
      <circle cx={MIRROR.x} cy={MIRROR.y} r={MIRROR.r} fill={G2} />
      <circle cx={MIRROR.x} cy={MIRROR.y} r={MIRROR.r - 14} fill={G3} />
      <clipPath id="mk-glass"><circle cx={MIRROR.x} cy={MIRROR.y} r={MIRROR.r - 30} /></clipPath>
      <g clipPath="url(#mk-glass)">
        <rect x={100} y={700} width={880} height={900} fill={SKIN_A} />
        {/* the nose side (left) in the shade tone, the cheek under the eye */}
        <path d="M 100 760 C 190 900 210 1040 150 1250 L 100 1250 Z" fill={SKIN_B} opacity={0.35} />
        <path d="M 150 1350 C 400 1480 720 1480 960 1330 L 960 1560 L 150 1560 Z" fill={SKIN_B} opacity={0.22} />
        <Eye d={d} brow={-tw * 3} look={look} />
        {/* the window on the upper lid */}
        <g transform={`translate(${WIN.x} ${WIN.y}) scale(${open}) translate(${-WIN.x} ${-WIN.y})`} opacity={w > 0.001 ? 1 : 0}>
          <ellipse cx={WIN.x} cy={WIN.y} rx={WIN.rx + 10} ry={WIN.ry + 10} fill={SKIN_B} />
          <clipPath id="mk-win"><ellipse cx={WIN.x} cy={WIN.y} rx={WIN.rx} ry={WIN.ry} /></clipPath>
          <g clipPath="url(#mk-win)"><Inside tw={tw} clock={clock} /></g>
        </g>
        {/* the sheen of the glass */}
        <path d="M 200 740 L 330 740 L 130 1080 L 100 1080 Z M 380 740 L 420 740 L 220 1080 L 190 1080 Z" fill={WHITE} opacity={0.16} />
      </g>
    </g>
  );
};

/* ---------- the triggers: a moon and zZ, a stress cloud, a dry drop (the coffee is the mug on the shelf) ---------- */
const Pop: React.FC<{ a: number; clock: number; out: number; x: number; y: number; children: React.ReactNode }> = ({ a, clock, out, x, y, children }) => {
  const p = clock < a ? 0 : springAt(clock, a, true), o = 1 - clamp01((clock - out) / 0.5);
  if (p <= 0 || o <= 0) return null;
  return <g opacity={o} transform={`translate(${x} ${y}) scale(${Math.max(0, p)}) translate(${-x} ${-y})`}>{children}</g>;
};
const Triggers: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 800 } as const;
  const out = TRIGGERS.out + 0.6;
  return (
    <g>
      <Pop a={TRIGGERS.tidur} out={out} clock={clock} x={110} y={1430}>
        <g transform={`translate(0 ${sway(amb, 4, 6)})`}>
          <circle cx={110} cy={1430} r={46} fill={YELLOW} /><circle cx={128} cy={1416} r={40} fill={PEACH.wall} />
          <text x={52} y={1378} fontSize={46} fill={G2} style={bold}>z</text><text x={14} y={1332} fontSize={60} fill={G2} style={bold}>Z</text>
        </g>
      </Pop>
      <Pop a={TRIGGERS.stres} out={out} clock={clock} x={270} y={560}>
        <g transform={`translate(${sway(amb, 3, 6)} 0)`}>
          <ellipse cx={270} cy={570} rx={112} ry={62} fill={G3} /><circle cx={214} cy={548} r={46} fill={G3} /><circle cx={300} cy={526} r={56} fill={G3} /><circle cx={346} cy={556} r={40} fill={G3} />
          <path d="M 236 560 C 236 530 300 528 300 560 C 300 592 248 598 250 566 C 252 548 282 548 282 562" fill="none" stroke={G1} strokeWidth={8} strokeLinecap="round" />
          <path d="M 292 604 L 270 646 L 290 646 L 274 690 L 318 636 L 296 636 L 312 604 Z" fill={YELLOW} />
        </g>
      </Pop>
      <Pop a={TRIGGERS.kering} out={out} clock={clock} x={810} y={580}>
        <g transform={`translate(0 ${sway(amb, 4, 7)})`}>
          <path d="M 810 480 C 850 548 872 576 872 604 A 62 62 0 0 1 748 604 C 748 576 770 548 810 480 Z" fill={STEAM} />
          <path d="M 784 560 C 770 588 768 610 776 628" fill="none" stroke={WHITE} strokeWidth={10} strokeLinecap="round" opacity={0.9} />
          <rect x={742} y={594} width={136} height={14} rx={7} fill={G1} transform="rotate(-38 810 601)" />
        </g>
      </Pop>
    </g>
  );
};

const World: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const kopi = win(clock, TRIGGERS.kopi, TRIGGERS.out + 0.6, 0.5);
  return (
    <g>
      <Wall />
      <Shelf amb={amb} coffee={kopi} />
      <Mirror clock={clock} />
      <Triggers clock={clock} amb={amb} />
    </g>
  );
};

/* ---------- the screen layer: hook text, labels, stamp, chips, tip cards ---------- */
const HookText: React.FC<{ clock: number }> = ({ clock }) => {
  const o = clock > 20 ? clamp01((clock - 39.5) / 0.5) : 1 - clamp01((clock - 2.7) / 0.3);   // frame 0 has it, the last 0.5 s of the outro brings it back (B41: the loop)
  const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 800 } as const;
  const lines = ["Bukan", "pertanda.", "Ini ototmu", "kelelahan."];
  if (o <= 0) return null;
  return <g opacity={o}>{lines.map((ln, i) => <text key={ln} x={SAFE.left + 20} y={236 + i * 112} fontSize={110} fill={BLACK} style={bold}>{ln}</text>)}</g>;
};

const ScreenLabel: React.FC<{ l: (typeof LABELS)[number]; clock: number; cam: { x: number; y: number; z: number } }> = ({ l, clock, cam }) => {
  if (clock < l.from || clock > l.to + 0.3) return null;
  const o = clamp01((clock - l.from) / 0.25) * (1 - clamp01((clock - l.to) / 0.3));
  const [px, py] = l.at ? toScreen(cam, l.at[0], l.at[1]) : [0, 0];
  const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
  const wide = l.text.length * 54 * 0.52;
  const sx = l.x + (px > l.x ? Math.min(40, wide / 3) : -Math.min(40, wide / 3));
  const up = l.at !== undefined && py < l.y - 70, y1 = up ? l.y - 58 : l.y + 24;
  return (
    <g opacity={o}>
      {l.at && <path d={`M ${sx} ${y1} L ${px} ${up ? py + 10 : py - 10}`} stroke={BLACK} strokeWidth={5} strokeLinecap="round" />}
      {l.at && <circle cx={px} cy={py} r={9} fill={BLACK} />}
      <text x={l.x} y={l.y} fontSize={54} fill={BLACK} textAnchor="middle" style={bold}>{l.text}</text>
    </g>
  );
};

const Card: React.FC<{ y: number; title: string; sub: string; a: number; out: number; clock: number }> = ({ y, title, sub, a, out, clock }) => {
  const p = springAt(clock, a, true), o = 1 - clamp01((clock - out) / 0.4);
  if (clock < a || o <= 0) return null;
  return (
    <g transform={`translate(540 ${y + 90}) scale(${Math.max(0, p)}) translate(-540 ${-(y + 90)})`} opacity={o}>
      <rect x={SAFE.left} y={y} width={SAFE.right - SAFE.left} height={180} rx={44} fill={WHITE} />
      <rect x={SAFE.left} y={y + 30} width={14} height={120} rx={7} fill={YELLOW} />
      <text x={SAFE.left + 64} y={y + 84} fontSize={66} fill={BLACK} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>{title}</text>
      <text x={SAFE.left + 64} y={y + 144} fontSize={48} fill={G1} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 600 }}>{sub}</text>
    </g>
  );
};

const Chip: React.FC<{ x: number; y: number; text: string; a: number; out: number; clock: number }> = ({ x, y, text, a, out, clock }) => {
  const p = clock < a ? 0 : springAt(clock, a, true), o = 1 - clamp01((clock - out) / 0.4);
  if (p <= 0 || o <= 0) return null;
  return (
    <g opacity={o} transform={`translate(${x} ${y}) scale(${Math.max(0, p)}) translate(${-x} ${-y})`}>
      <rect x={x - 205} y={y - 50} width={410} height={100} rx={50} fill={WHITE} />
      <text x={x} y={y + 22} fontSize={46} fill={BLACK} textAnchor="middle" style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>{text}</text>
    </g>
  );
};

const Stamp: React.FC<{ clock: number }> = ({ clock }) => {
  if (clock < STAMP.a || clock > STAMP.out + 0.4) return null;
  const p = springAt(clock, STAMP.a, true), o = 1 - clamp01((clock - STAMP.out) / 0.4);
  return (
    <g opacity={o} transform={`translate(780 640) rotate(-9) scale(${Math.max(0, 1.5 - 0.5 * Math.min(1, p))}) translate(-780 -640)`}>
      <rect x={560} y={570} width={440} height={140} rx={28} fill={YELLOW} />
      <rect x={574} y={584} width={412} height={112} rx={20} fill="none" stroke={BLACK} strokeWidth={6} />
      <text x={780} y={672} fontSize={96} fill={BLACK} textAnchor="middle" style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 800 }}>FAKTA</text>
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
      <Stamp clock={clock} />
      <Chip x={290} y={430} text="detik sampai menit" a={CHIPS[0].a} out={CHIPS[0].out} clock={clock} />
      <Chip x={790} y={430} text="hari sampai minggu" a={CHIPS[1].a} out={CHIPS[1].out} clock={clock} />
      <Card y={380} title="Tidur cukup" sub="kurangi kopi, istirahatkan mata" a={CARDS[0].a} out={CARDS[0].out} clock={clock} />
      <Card y={590} title="Berminggu-minggu?" sub="atau menjalar: periksa dokter" a={CARDS[1].a} out={CARDS[1].out} clock={clock} />
      {(hook || outro) && <HookText clock={clock} />}
      {sting && <StingMark slug="mata-kedutan-itu-pertanda" t={t} clock={clock} />}
      {!hook && !sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {/* no caption in the hook: the hook text already says the same words, and frame 0 then matches the last frame (the loop) */}
      {!hook && !sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
