/* Tinggi badanmu pagi hari lebih tinggi 1 cm, kok bisa? — look 2d (B28): a flat SIDE view of a person standing in a hallway, the spine shown through a cut
   window (set kind "hallway-height-wall", see set.json). Real shapes (B27.16): the spine has 24 movable vertebrae (7 cervical, 12 thoracic, 5 lumbar) that grow
   bigger downwards, an S-curve (the neck and the lower back curve forward, the chest curves back), a disc between every two vertebrae and the sacrum under them.
   Two tones per part: a base and the same shape moved down-right as its shade (light from the top left). One world, one camera (plan.ts camAt), one load
   value n (plan.ts loadAt) that thins every disc, drops the head, moves the sun and the moon and turns the clock. */
import React from "react";
import {
  loopClock, BLACK, CaptionLayer, FONT_BOLD, FONT_MONO, G1, G2, G3, G4, Arrow, Label, NumberCard, PLASTER, SKIN_A, SKIN_B, StoryVideo, STEAM, THEMES, TopText, WHITE,
  YELLOW, YELLOW_D, clamp01, easeInOut, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { BED_CARD, BRACKETS, CARD, DETAIL, LABELS, LOAD_ARROWS, NOTE, camAt, loadAt } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { hook: "TINGGI BADAN", tulang: "TULANG BELAKANG", air: "CAKRAM", siang: "SIANG HARI", malam: "MALAM HARI", hasil: "HASILNYA", fakta: "FAKTA", tips: "TIPS" };
const SKY = THEMES.sky;
const FLOOR_Y = 2400, Y0 = 1250, HIP = 1440;           // the floor, the top of the sacrum, the waist (world px; the person is about 2300 px tall, 170 cm)
const DISC_SQUEEZE = 3;                                 // px each disc thins by at the night (times the vertebra's size): 24 discs add up to about 70 px, drawn larger than real (the picture says so)

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const cosMix = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(u));
const sway = (t: number, p: number, a: number) => a * Math.sin((2 * Math.PI * t) / p);

/** One part: its shade (the same shape moved down-right) and its base. */
const Part: React.FC<{ d: string; base: string; shade: string; o?: number; sh?: [number, number]; so?: number }> = ({ d, base, shade, o = 1, sh = [10, 12], so = 1 }) => (
  <g>
    <path d={d} fill={shade} opacity={so * o} transform={`translate(${sh[0]} ${sh[1]})`} />
    <path d={d} fill={base} opacity={o} />
  </g>
);
const Box: React.FC<{ x: number; y: number; w: number; h: number; r?: number; base: string; shade: string; sh?: [number, number] }> = ({ x, y, w, h, r = 8, base, shade, sh = [5, 6] }) => (
  <g>
    <rect x={x + sh[0]} y={y + sh[1]} width={w} height={h} rx={r} fill={shade} />
    <rect x={x} y={y} width={w} height={h} rx={r} fill={base} />
  </g>
);

/** The sideways shift of the spine along its length (u 0 = the sacrum, 1 = the skull): the lower back curves forward (right), the chest curves back, the neck curves forward. */
const CURVE: [number, number][] = [[0, -6], [0.1, 16], [0.24, 0], [0.45, -34], [0.66, -30], [0.8, -2], [0.9, 14], [1, 8]];
function curveX(u: number) {
  for (let i = 1; i < CURVE.length; i++) if (u <= CURVE[i][0]) { const a = CURVE[i - 1], b = CURVE[i]; return lerp(a[1], b[1], cosMix((u - a[0]) / (b[0] - a[0]))); }
  return CURVE[CURVE.length - 1][1];
}
const SIZES = [...Array(5).fill(1.25), ...Array(12).fill(1), ...Array(7).fill(0.7)] as number[];   // from the sacrum up: 5 lumbar, 12 thoracic, 7 cervical

type Vert = { cx: number; y: number; h: number; w: number; s: number; tilt: number };
type Disc = { cx: number; y: number; h: number; w: number; s: number };
/** The stack of the spine for the load n: every disc is thinner at the night, so the top of the spine, and the head with it, comes down. */
function spine(n: number) {
  const verts: Vert[] = [], discs: Disc[] = [];
  let y = Y0;
  SIZES.forEach((s, i) => {
    const u = i / (SIZES.length - 1), cx = 540 + curveX(u);
    const dh = (14 - DISC_SQUEEZE * n) * s, bh = 24 * s, w = 62 * Math.pow(s, 0.85);
    y -= dh; discs.push({ cx, y, h: dh, w: w + 6 + 6 * n, s });
    y -= bh;
    const tilt = (Math.atan2(curveX(Math.min(1, u + 0.04)) - curveX(Math.max(0, u - 0.04)), (dh + bh) * 2) * 180) / Math.PI;
    verts.push({ cx, y, h: bh, w, s, tilt: -tilt });
  });
  return { verts, discs, top: y };
}
const TOP_MORNING = spine(0).top;

const Wall: React.FC<{ n: number; clock: number; amb: number }> = ({ n, clock, amb }) => {
  const day = 1 - clamp01((n - 0.45) * 3), night = clamp01((n - 0.4) * 3);
  const hour = 7 + 14 * n;
  const sunX = 880 + 190 * n, sunY = 830 + 230 * n * n;
  return (
    <g>
      <rect x={-1800} y={-900} width={4700} height={4600} fill={SKY.wall} />
      {/* the wainscot: a darker lower wall with a dado rail and a skirting; the floor planks under it */}
      <rect x={-1800} y={1560} width={4700} height={FLOOR_Y - 1560} fill={SKY.floor} />
      <rect x={-1800} y={1540} width={4700} height={34} fill={SKY.floorEdge} />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={-1500 + i * 480} y={1640} width={14} height={680} fill={SKY.floorEdge} opacity={0.5} />)}
      <rect x={-1800} y={2330} width={4700} height={FLOOR_Y - 2330} fill={SKY.floorEdge} />
      <rect x={-1800} y={FLOOR_Y} width={4700} height={900} fill={PLASTER} />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-1800} y={FLOOR_Y + 22 + i * 52} width={4700} height={5} fill={SKIN_B} opacity={0.55} />)}
      {/* the window (cut by the frame on the right): the sky, a sun by day and a moon with stars by night */}
      <g>
        <rect x={792} y={402} width={800} height={796} fill={SKIN_B} />
        <rect x={810} y={420} width={780} height={760} fill={WHITE} />
        <rect x={810} y={420} width={780} height={760} fill={G1} opacity={0.88 * night} />
        {day > 0 && <g opacity={day}>
          <circle cx={sunX} cy={sunY} r={62} fill={YELLOW} />
          {Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * 2 * Math.PI + amb * 0.4189; return <rect key={i} x={sunX + 88 * Math.cos(a) - 7} y={sunY + 88 * Math.sin(a) - 22} width={14} height={44} rx={7} fill={YELLOW} transform={`rotate(${(a * 180) / Math.PI + 90} ${sunX + 88 * Math.cos(a)} ${sunY + 88 * Math.sin(a)})`} />; })}
        </g>}
        {night > 0 && <g opacity={night}>
          <circle cx={1010} cy={610} r={52} fill={G4} />
          <circle cx={995} cy={598} r={11} fill={G3} /><circle cx={1028} cy={630} r={8} fill={G3} />
          {[[900, 520, 7], [1120, 500, 6], [1230, 700, 8], [960, 880, 6], [1180, 960, 7], [870, 760, 5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r * (0.8 + 0.25 * Math.sin(amb * 3.142 + i * 2))} fill={WHITE} />)}
        </g>}
        <rect x={1190} y={420} width={20} height={760} fill={SKIN_B} /><rect x={810} y={790} width={780} height={20} fill={SKIN_B} />
        <rect x={770} y={1198} width={840} height={36} fill={SKIN_A} /><rect x={776} y={1210} width={840} height={30} fill={SKIN_B} opacity={0.6} />
      </g>
      {/* the wall clock: its hands follow the time of day (7 in the morning to 21 at night) */}
      <g transform="translate(900 250)">
        <circle cx={7} cy={8} r={74} fill={SKY.floorEdge} /><circle r={74} fill={WHITE} />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-3} y={-62} width={6} height={i % 3 === 0 ? 16 : 9} fill={G2} transform={`rotate(${i * 30})`} />)}
        <rect x={-4} y={-40} width={8} height={44} rx={4} fill={BLACK} transform={`rotate(${((hour % 12) / 12) * 360})`} />
        <rect x={-3} y={-58} width={6} height={62} rx={3} fill={G2} transform={`rotate(${hour * 360})`} />
        <circle r={8} fill={BLACK} />
      </g>
      {/* a potted plant at the left, swaying */}
      <g transform="translate(-40 0)">
        {[[-60, -230, -22], [0, -330, 4], [60, -250, 24], [-24, -180, -10]].map(([dx, dy, rot], i) => (
          <g key={i} transform={`translate(110 ${FLOOR_Y - 190}) rotate(${rot + sway(amb + i, [3, 3.75, 4, 5][i], 3)})`}>
            <path d={`M 0 0 C ${dx - 30} ${dy * 0.5} ${dx - 20} ${dy * 0.9} ${dx} ${dy} C ${dx + 26} ${dy * 0.8} ${dx + 28} ${dy * 0.4} 0 0 Z`} fill={SKIN_B} opacity={0.35} transform="translate(8 8)" />
            <path d={`M 0 0 C ${dx - 30} ${dy * 0.5} ${dx - 20} ${dy * 0.9} ${dx} ${dy} C ${dx + 26} ${dy * 0.8} ${dx + 28} ${dy * 0.4} 0 0 Z`} fill={G3} />
          </g>
        ))}
        <Part d={`M 20 ${FLOOR_Y - 200} L 200 ${FLOOR_Y - 200} L 175 ${FLOOR_Y} L 45 ${FLOOR_Y} Z`} base={SKIN_A} shade={SKIN_B} sh={[10, 0]} />
      </g>
    </g>
  );
};

/** The wall height chart: a wooden ruler strip with ticks (every tick about 1 cm of the picture's scale), with a pointer at the head's top, the morning line and the 1 cm bracket. */
const Chart: React.FC<{ n: number; headTop: number; t: number }> = ({ n, headTop, t }) => {
  const line = win(t, 3.0, 5.8) + win(t, 37.4, 52.4, 0.4);
  const br = BRACKETS.reduce((m, b) => Math.max(m, win(t, b.a, b.b, 0.25)), 0);
  const ym = TOP_MORNING - 285;
  return (
    <g>
      <Box x={200} y={60} w={86} h={2300} r={6} base={SKIN_A} shade={SKIN_B} sh={[8, 0]} />
      {Array.from({ length: 31 }, (_, i) => <rect key={i} x={200} y={150 + i * 72} width={i % 5 === 0 ? 54 : 32} height={6} fill={G2} />)}
      <polygon points={`296,${headTop} 336,${headTop - 20} 336,${headTop + 20}`} fill={YELLOW} />
      {line > 0 && <g opacity={Math.min(1, line)}><line x1={296} y1={ym} x2={760} y2={ym} stroke={YELLOW_D} strokeWidth={6} strokeDasharray="22 16" /></g>}
      {br > 0 && n > 0.05 && <g opacity={br * clamp01(n * 2)}>
        <rect x={352} y={ym} width={10} height={Math.max(2, headTop - ym)} fill={BLACK} />
        <rect x={340} y={ym - 5} width={34} height={10} fill={BLACK} /><rect x={340} y={headTop - 5} width={34} height={10} fill={BLACK} />
      </g>}
    </g>
  );
};

const Person: React.FC<{ n: number; clock: number; amb: number; hl: number }> = ({ n, clock, amb, hl }) => {
  const sp = spine(n), ytop = sp.top, ys = ytop + 60;
  const hx = sp.verts[sp.verts.length - 1].cx + 14, hy = ytop - 150;
  const breath = 0.5 - 0.5 * Math.cos((2 * Math.PI * amb) / 4);
  const eyeShut = (amb * 0.8) % 4 < 0.12;
  const speed = (loadAt(clock + 0.05) - loadAt(clock - 0.05)) / 0.1;
  const flow = Math.abs(speed) > 0.04;
  const torso = `M 430 ${ys} C 392 ${ys + 40} 388 ${ys + 200} 396 ${ys + 500} C 402 ${ys + 700} 380 1200 392 ${HIP} L 692 ${HIP} C 705 1300 690 1150 702 1000 C 716 800 722 ${ys + 250} 650 ${ys + 60} C 610 ${ys} 520 ${ys - 20} 430 ${ys} Z`;
  return (
    <g>
      {/* legs and shoes */}
      <Part d={`M 430 1660 L 690 1660 C 700 1990 656 2230 644 2350 L 470 2350 C 460 2110 430 1900 430 1660 Z`} base={SKIN_A} shade={SKIN_B} sh={[12, 0]} />
      <Part d="M 450 2338 L 660 2338 C 706 2338 790 2366 804 2400 L 450 2400 Z" base={G2} shade={G1} sh={[8, 0]} />
      <rect x={450} y={2386} width={354} height={14} fill={WHITE} />
      <Part d={`M 408 ${HIP - 10} L 696 ${HIP - 10} L 706 1790 L 566 1790 L 552 1640 L 536 1790 L 400 1790 Z`} base={G3} shade={G2} sh={[10, 0]} />
      {/* the arm, hanging in front of the belly */}
      <path d={`M 700 ${ys + 50} L 738 ${ys + 590}`} stroke={SKIN_B} strokeWidth={66} strokeLinecap="round" transform="translate(8 6)" />
      <path d={`M 700 ${ys + 50} L 738 ${ys + 590}`} stroke={SKIN_A} strokeWidth={66} strokeLinecap="round" />
      <circle cx={740} cy={ys + 620} r={44} fill={SKIN_A} />
      {/* the neck and the torso, breathing a little */}
      <Part d={`M 490 ${ytop - 20} L 618 ${ytop - 20} L 632 ${ys + 40} L 468 ${ys + 40} Z`} base={SKIN_A} shade={SKIN_B} sh={[8, 8]} />
      <g transform={`translate(540 ${ys + 400}) scale(${1 + 0.008 * breath} ${1 + 0.004 * breath}) translate(-540 ${-(ys + 400)})`}><Part d={torso} base={SKIN_A} shade={SKIN_B} sh={[12, 10]} /></g>
      {/* the cut window over the torso: a plaster face with the spine in it */}
      <Part d={`M 478 ${ytop - 10} L 616 ${ytop - 10} L 616 ${ytop + 170} L 654 ${ytop + 200} L 654 ${HIP - 6} L 436 ${HIP - 6} L 436 ${ytop + 200} L 478 ${ytop + 170} Z`} base={PLASTER} shade={SKIN_B} sh={[9, 9]} so={0.7} />
      {/* the sacrum, then each disc and each vertebra (a spinous process points back) */}
      <Part d={`M ${sp.verts[0].cx - 46} ${Y0} L ${sp.verts[0].cx + 46} ${Y0} C ${sp.verts[0].cx + 52} ${Y0 + 60} ${sp.verts[0].cx + 22} ${Y0 + 130} ${sp.verts[0].cx - 12} ${Y0 + 168} C ${sp.verts[0].cx - 32} ${Y0 + 120} ${sp.verts[0].cx - 44} ${Y0 + 60} ${sp.verts[0].cx - 46} ${Y0} Z`} base={WHITE} shade={G3} sh={[6, 6]} />
      {sp.discs.map((d, i) => (
        <g key={`d${i}`}>
          {i === 2 && hl > 0 && <rect x={d.cx - d.w / 2 - 12} y={d.y - 10} width={d.w + 24} height={d.h + 20} rx={14} fill={YELLOW} opacity={hl} />}
          <Box x={d.cx - d.w / 2} y={d.y} w={d.w} h={d.h} r={Math.min(8, d.h / 2)} base={STEAM} shade={G3} sh={[4, 4]} />
          {flow && [-1, 1].map((sd) => {
            const ph = (amb * 1.3 + i * 0.37 + (sd > 0 ? 0.5 : 0)) % 1, dir = speed > 0 ? ph : 1 - ph;
            return <ellipse key={sd} cx={d.cx + sd * (d.w / 2 + 6 + dir * 34)} cy={d.y + d.h / 2 + dir * dir * 16} rx={6 * d.s} ry={8 * d.s} fill={STEAM} opacity={Math.sin(Math.PI * ph) * 0.95} />;
          })}
        </g>
      ))}
      {sp.verts.map((v, i) => (
        <g key={`v${i}`} transform={`rotate(${v.tilt} ${v.cx} ${v.y + v.h / 2})`}>
          <Box x={v.cx - v.w - 0 - 36 * Math.pow(v.s, 0.7) + v.w / 2} y={v.y + v.h * 0.28} w={36 * Math.pow(v.s, 0.7)} h={v.h * 0.38} r={6} base={G4} shade={G3} sh={[4, 5]} />
          <Box x={v.cx - v.w / 2} y={v.y} w={v.w} h={v.h} r={9 * v.s} base={WHITE} shade={G3} sh={[5, 6]} />
        </g>
      ))}
      {/* the head: skull, jaw, nose, ear, hair, one eye */}
      <Part d={`M ${hx - 40} ${hy + 70} L ${hx + 40} ${hy + 70} L ${hx + 40} ${hy + 160} L ${hx - 40} ${hy + 160} Z`} base={SKIN_A} shade={SKIN_B} sh={[6, 8]} />
      <circle cx={hx + 12} cy={hy + 14} r={140} fill={SKIN_B} />
      <circle cx={hx} cy={hy} r={140} fill={SKIN_A} />
      <ellipse cx={hx + 52} cy={hy + 82} rx={78} ry={62} fill={SKIN_A} />
      <path d={`M ${hx + 126} ${hy - 6} L ${hx + 178} ${hy + 44} L ${hx + 122} ${hy + 52} Z`} fill={SKIN_A} />
      <path d={`M ${hx + 126} ${hy - 6} L ${hx + 178} ${hy + 44} L ${hx + 122} ${hy + 52} Z`} fill={SKIN_B} opacity={0.35} transform="translate(5 6)" />
      <ellipse cx={hx - 26} cy={hy + 16} rx={24} ry={34} fill={SKIN_B} />
      <path d={`M ${hx - 144} ${hy + 20} C ${hx - 170} ${hy - 150} ${hx + 90} ${hy - 190} ${hx + 138} ${hy - 50} C ${hx + 70} ${hy - 100} ${hx - 10} ${hy - 70} ${hx - 60} ${hy + 10} C ${hx - 90} ${hy + 60} ${hx - 120} ${hy + 70} ${hx - 144} ${hy + 20} Z`} fill={G1} />
      <ellipse cx={hx + 78} cy={hy - 8} rx={10} ry={eyeShut ? 2 : 12} fill={BLACK} />
    </g>
  );
};

/** The magnified disc between two vertebrae, in a round window: the disc is full of water dots that are squeezed out under load and come back at rest. */
const DetailBubble: React.FC<{ n: number; clock: number }> = ({ n, clock }) => {
  const p = springAt(clock, DETAIL.a) * (1 - clamp01((clock - DETAIL.b) / 0.4));
  if (p <= 0.01) return null;
  const cx = 985, cy = 1020, R = 226, hd = 150 - 40 * n;
  const dots = Array.from({ length: 20 }, (_, i) => ({ x: ((i * 71) % 220) - 110, y: ((i * 37) % 100) - 50, th: ((i * 0.618) % 1) * 0.85, side: i % 2 ? 1 : -1, r: 9 + (i % 3) * 4 }));
  const id = "detail-clip";
  return (
    <g transform={`translate(${cx} ${cy}) scale(${Math.max(0.001, p)}) translate(${-cx} ${-cy})`}>
      <circle cx={cx + 10} cy={cy + 12} r={R + 16} fill={SKIN_B} />
      <circle cx={cx} cy={cy} r={R + 16} fill={WHITE} />
      <clipPath id={id}><circle cx={cx} cy={cy} r={R} /></clipPath>
      <g clipPath={`url(#${id})`}>
        <rect x={cx - R} y={cy - R} width={R * 2} height={R * 2} fill={G1} />
        <Box x={cx - 170} y={cy - hd / 2 - 150} w={340} h={150} r={22} base={WHITE} shade={G3} sh={[0, 8]} />
        <Box x={cx - 170} y={cy + hd / 2} w={340} h={150} r={22} base={WHITE} shade={G3} sh={[0, 8]} />
        <rect x={cx - 150} y={cy - hd / 2} width={300} height={hd} fill={STEAM} />
        {dots.map((d, i) => {
          const out = clamp01((n - d.th) / 0.16), e = easeInOut(out);
          const x = lerp(cx + d.x + 14 * Math.sin(clock * 1.6 + i), cx + d.side * 230, e), y = lerp(cy + d.y * (hd / 150) + 6 * Math.cos(clock * 1.9 + i), cy + 60 + d.y, e) + e * e * 90;
          return <circle key={i} cx={x} cy={y} r={d.r * (1 - 0.25 * e)} fill={WHITE} opacity={0.95 * (1 - clamp01((out - 0.8) / 0.2) * 0.4)} />;
        })}
      </g>
    </g>
  );
};

const World: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const n = loadAt(clock), sp = spine(n), headTop = sp.top - 285;
  const hl = win(clock, DETAIL.a - 0.4, DETAIL.b, 0.4) * (0.55 + 0.35 * Math.sin(clock * 5));
  const la = win(clock, LOAD_ARROWS.a, LOAD_ARROWS.b, 0.3), pulse = 10 * Math.sin(clock * 4.2);
  const ys = sp.top + 60;
  return (
    <g>
      <Wall n={n} clock={clock} amb={amb} />
      <Chart n={n} headTop={headTop} t={clock} />
      <Person n={n} clock={clock} amb={amb} hl={Math.max(0, hl)} />
      {/* the leader from the lit disc to its magnified bubble */}
      {win(clock, DETAIL.a, DETAIL.b, 0.4) > 0 && <g opacity={win(clock, DETAIL.a, DETAIL.b, 0.4)}>
        <line x1={600} y1={sp.discs[2].y + sp.discs[2].h / 2} x2={776} y2={880} stroke={G2} strokeWidth={6} strokeDasharray="14 10" />
        <line x1={600} y1={sp.discs[2].y + sp.discs[2].h / 2} x2={776} y2={1160} stroke={G2} strokeWidth={6} strokeDasharray="14 10" />
      </g>}
      <DetailBubble n={n} clock={clock} />
      {/* the weight that presses down on the spine */}
      {la > 0 && <g opacity={la}>
        <Arrow x={400} y={ys - 250 + pulse} x2={400} y2={ys - 60 + pulse} color="black" w={20} draw={1} />
        <Arrow x={690} y={ys - 250 + pulse} x2={690} y2={ys - 60 + pulse} color="black" w={20} draw={1} />
      </g>}
    </g>
  );
};

const BedCard: React.FC<{ clock: number }> = ({ clock }) => {
  if (clock < BED_CARD.a || clock >= BED_CARD.b + 0.3) return null;
  const p = springAt(clock, BED_CARD.a) * (1 - clamp01((clock - BED_CARD.b) / 0.3));
  const zz = (i: number) => ({ y: -38 - ((clock * 24 + i * 22) % 66), o: Math.sin(Math.PI * (((clock * 24 + i * 22) % 66) / 66)) });
  return (
    <g transform={`translate(540 1250) scale(${Math.max(0, p)})`}>
      <rect x={-250} y={-96} width={500} height={192} rx={36} fill={WHITE} />
      <rect x={-205} y={36} width={410} height={26} rx={10} fill={G3} />
      <rect x={-205} y={-2} width={410} height={44} rx={14} fill={PLASTER} />
      <rect x={-195} y={-30} width={72} height={34} rx={16} fill={G4} />
      <circle cx={-150} cy={-14} r={30} fill={SKIN_A} />
      <rect x={-118} y={-30} width={250} height={36} rx={18} fill={SKIN_B} />
      {[0, 1, 2].map((i) => <text key={i} x={140 + i * 28} y={zz(i).y} fontSize={34 + i * 8} fill={G2} opacity={zz(i).o} style={{ fontFamily: `"${FONT_MONO}", monospace` }}>z</text>)}
    </g>
  );
};

const Scene = ({ beat, t, clock, story }: SceneProps) => {
  const amb = loopClock(clock, story.beats.reduce((a, b) => a + b.dur, 0));   // B29: the ambient motion runs on the loop clock
  const c = camAt(clock), sting = beat.kind === "sting", outro = beat.kind === "outro";
  const labels = LABELS.filter((l) => clock >= l.from && clock < l.to + 0.3);
  const tx = `translate(${W / 2} ${H / 2}) scale(${c.z}) translate(${-c.x} ${-c.y})`;
  const tips = beat.id === "tips";
  const gaugeNote = win(clock, NOTE.a, NOTE.b, 0.3);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <g transform={tx}>
        <World clock={clock} amb={amb} />
        {labels.map((l) => <g key={l.text} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={l.x} y={l.y} fs={l.fs} t={clock} start={l.from} /></g>)}
        {BRACKETS.map((b, i) => clock >= b.a && clock < b.b + 0.3 && <g key={i} opacity={1 - clamp01((clock - b.b) / 0.3)}><Label text="1 cm" x={470} y={TOP_MORNING - 285 + 38} fs={50} t={clock} start={b.a + 0.1} highlight={["1"]} /></g>)}
      </g>
      <BedCard clock={clock} />
      {gaugeNote > 0 && <g opacity={gaugeNote}><Label text="gambar dilebihkan" x={540} y={1330} fs={46} t={clock} start={NOTE.a + 0.1} color="black" /></g>}
      {clock >= CARD.a && clock < CARD.out + 0.3 && <g opacity={1 - clamp01((clock - CARD.out) / 0.3)}><NumberCard x={280} y={1170} w={520} label="selisih harian" value={1.9} decimals={1} unit="cm" note="sekitar 1% tinggi badan" t={clock} start={CARD.a} /></g>}
      {tips && <g transform={`translate(540 1290) scale(${Math.max(0, springAt(clock, 52.0))}) translate(-540 -1290)`}>
        <rect x={110} y={1150} width={860} height={280} rx={40} fill={WHITE} />
        <rect x={110} y={1180} width={12} height={220} rx={6} fill={YELLOW} />
        <circle cx={230} cy={1290} r={64} fill={YELLOW} />
        {Array.from({ length: 8 }, (_, i) => <rect key={i} x={226} y={1204} width={8} height={26} rx={4} fill={YELLOW} transform={`rotate(${i * 45} 230 1290)`} />)}
        <text x={330} y={1272} fontSize={54} fill={BLACK} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>Ukur di pagi hari</text>
        <text x={330} y={1340} fontSize={38} fill={G2} style={{ fontFamily: `"${FONT_MONO}", monospace` }}>hasil selalu sebanding</text>
      </g>}
      {sting && <g>
        <StingMark slug="tinggi-badanmu-di-pagi-hari-se" pose="topRight" t={t} clock={clock} />
      </g>}
      {!sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.text} t={t} />}
      {!sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
