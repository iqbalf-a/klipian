/* Satu awan beratnya ratusan ton: one sky set (a wide sky over a thin horizon band, set kind "sky-horizon"), one hero (a cumulus cloud) and one continuous
   camera (plan.ts CAM). The cloud is boxed in a km-wide cube, then a box of cloud air shows half a gram of water, the sums make 500 ton, 100 dots stand for
   100 elephants, arrows show why it floats, and a push shows the droplets. The first frame is the last (the loop). */
import React from "react";
import {
  BLACK, CaptionLayer, IsoCloud, IsoPlane, IsoSun, Label, StoryVideo, TopText, YELLOW, YELLOW_D, block, cam2At, clamp01, easeInOut, easeOutBack,
  isoAt, layerTransform, ptsAttr, springAt, useFonts, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { ISO, THEMES, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, T } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const WATER = ISO.water, SKY = THEMES.sky;
const SKY_TOP = mixRgb(WATER[0], WHITE, 0.35), SKY_LOW = mixRgb(SKY.wall, WHITE, 0.6);
const U = 150, O: [number, number] = [540, 960];                     // the cloud's iso unit and origin (world px)
const GLASS: [string, string, string] = [mixRgb(WHITE, WATER[0], 0.12), mixRgb(WHITE, WATER[0], 0.3), mixRgb(WHITE, WATER[1], 0.35)];
/** 0 to 1 over 0.35 s from `a`; and back to 0 at `b` (a thing is on screen from a to b). */
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
const polys = (ps: Poly[], tones: readonly string[], op = 1) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={WATER[2]} strokeWidth={2} strokeLinejoin="round" opacity={op} />);

/** The sky and the thin horizon band (far layer, parallax 0.3): two sky tones, a faint haze band and a low far ridge strip. No sea, no fields. */
const Sky: React.FC<{ clock: number }> = ({ clock }) => (
  <g>
    {/* the sky: thin bands from the top tone to the low tone, so no edge shows */}
    {Array.from({ length: 40 }, (_, i) => <rect key={i} x={-1400} y={-1500 + i * 81} width={3880} height={82} fill={mixRgb(SKY_TOP, SKY_LOW, Math.min(1, i / 33))} />)}
    <path d={`M-1400 1500 L-1400 1300 Q-1000 1250 -700 1285 T-100 1272 T500 1292 T1100 1268 T1700 1288 T2480 1272 L2480 1500 Z`} fill={mixRgb(SKY.floorEdge, SKY_LOW, 0.45)} />
    <rect x={-1400} y={1340} width={3880} height={900} fill={mixRgb(SKY.floor, SKY_LOW, 0.5)} />
    {[0, 1, 2].map((i) => <rect key={i} x={-1400} y={1352 + i * 22} width={3880} height={3} fill={WHITE} opacity={0.6 - i * 0.18} />)}
    <IsoSun cx={1130 + 12 * Math.sin((clock * Math.PI) / 30)} cy={340} r={85} phase={clock / 6} />
  </g>
);

/** A cube around the cloud: drawn faces in glass tones, with the three edges of a km. */
const CH = 1.9, CZ0 = -1.5, CZ1 = 2.5;
const Cube: React.FC<{ k: number; fill: number }> = ({ k, fill }) => {
  const ps = block([-CH, -CH, CZ0], [CH, CH, CZ1], U, O);
  return <g opacity={k} strokeDasharray={fill > 0.99 ? undefined : "14 10"}>{polys(ps, GLASS, 0.05 + 0.3 * fill)}</g>;
};

/** One small cloud far away (the haze tones, so it sits back) that drifts once across the loop. */
const FarCloud: React.FC<{ x: number; y: number; grow: number; clock: number; amp: number; ph: number }> = ({ x, y, grow, clock, amp, ph }) => (
  <g transform={`translate(${amp * Math.sin((clock / 60 + ph) * Math.PI * 2)} 0)`}><IsoCloud u={110} o={[x, y]} cx={0} cy={0} cz={0} grow={grow * 0.62} haze={0.78} phase={clock / 6 + ph} /></g>
);

const dropAt = (i: number, clock: number, cx: number, cy: number, spread: number): [number, number] => {
  const a = i * 2.399, r = spread * Math.sqrt((i + 1) / 40);
  return [cx + r * Math.cos(a) + 5 * Math.sin((clock / 6 + i * 0.13) * Math.PI * 2), cy + r * Math.sin(a) * 0.8 + 6 * Math.cos((clock / 3 + i * 0.07) * Math.PI * 2)];
};

/** A soft white plate behind a text that sits over the horizon band. */
const Plate: React.FC<{ x: number; y: number; w: number; h: number; k?: number }> = ({ x, y, w, h, k = 1 }) => <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={WHITE} opacity={0.82 * k} />;

const Arrow2: React.FC<{ x1: number; y1: number; x2: number; y2: number; color: string; k: number }> = ({ x1, y1, x2, y2, color, k }) => {
  const ex = x1 + (x2 - x1) * k, ey = y1 + (y2 - y1) * k, a = Math.atan2(y2 - y1, x2 - x1), s = 26;
  return <g opacity={k > 0 ? 1 : 0}><line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={14} strokeLinecap="round" />
    <polygon points={`${ex},${ey} ${ex - s * Math.cos(a - 0.5)},${ey - s * Math.sin(a - 0.5)} ${ex - s * Math.cos(a + 0.5)},${ey - s * Math.sin(a + 0.5)}`} fill={color} /></g>;
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const cam = cam2At(CAM, clock);
  const c = clock;
  const bob = 7 * Math.sin((c / 6) * Math.PI * 2);                         // the cloud floats: a slow bob
  const isOutro = beat.kind === "outro";
  // the dots of "100 elephants": 10 rows of 10 small blocks, a row at a time
  const rowStart = [T.rowA, T.rowB, T.rowC, T.rowD];
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < 10; r++) for (let q = 0; q < 10; q++) {
    const st = rowStart[Math.min(3, Math.floor(r / 2.5))] + (r % 3) * 0.12 + q * 0.025;
    const k = easeOutBack(clamp01((c - st) / 0.35)) * (1 - clamp01((c - 35.2) / 0.4));
    if (k <= 0) continue;
    const o: [number, number] = [540 + (q - 4.5) * 62, 1450 + (r - 4.5) * 46];
    dots.push(<g key={`${r}-${q}`} transform={`translate(${o[0]} ${o[1]}) scale(${k}) translate(${-o[0]} ${-o[1]})`}>{polys(block([-0.1, -0.1, 0], [0.1, 0.1, 0.22], 110, o), ISO.metal, 1)}</g>);
  }
  const kmLine = (x1: number, y1: number, x2: number, y2: number, k: number) => <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * k} y2={y1 + (y2 - y1) * k} stroke={BLACK} strokeWidth={6} strokeLinecap="round" opacity={k > 0 ? 1 : 0} />;
  const KL = isoAt([-CH, CH, CZ0], U, O), KR = isoAt([CH, -CH, CZ0], U, O), KT = isoAt([CH, -CH, CZ1], U, O);
  const cubeK = on(c, T.cube, 11.8), kmAk = clamp01((c - T.kmA) / 0.6), kmBk = clamp01((c - T.kmB) / 0.6);
  const tag = (txt: string, x: number, y: number, a: number, b: number) => <Label text={txt} x={x} y={y} fs={56} t={c} start={a} onDark={false} />;
  const boxO: [number, number] = [920, 1300];
  const boxK = on(c, T.box, 19.8);
  const marbleFall = easeInOut(clamp01((c - T.marble) / (T.marbleLand - T.marble)));
  const my = 1130 + marbleFall * 70;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 0.3)}><Sky clock={c} /></g>
      <g transform={layerTransform(cam, 0.55)}>
        <FarCloud x={80} y={700} grow={0.9} clock={c} amp={90} ph={0} />
        <FarCloud x={1330} y={880} grow={1.1} clock={c} amp={-70} ph={0.4} />
        <FarCloud x={-240} y={1180} grow={0.8} clock={c} amp={60} ph={0.7} />
        <FarCloud x={1300} y={640} grow={0.7} clock={c} amp={-50} ph={0.2} />
      </g>
      <g transform={layerTransform(cam, 1)}>
        {/* the plane: a real-size neighbour of the km-wide cloud; it crosses the sky once per loop */}
        <IsoPlane x={-1500 + 4100 * (c / 60)} y={560} w={120} phase={c / 3} />
        {/* the hero: the cumulus cloud, its glass cube and the km marks */}
        <g transform={`translate(0 ${bob})`}><IsoCloud u={U} o={O} cx={0} cy={0} cz={0} grow={1.5} phase={c / 6} /></g>
        {!isOutro && <Cube k={cubeK} fill={clamp01((c - T.cubeFill) / 0.8)} />}
        {kmLine(KL[0], KL[1] + 46, KR[0], KR[1] + 46, kmAk * cubeK)}
        {kmLine(KR[0] + 50, KR[1], KR[0] + 50, KT[1], kmBk * cubeK)}
        {cubeK > 0.05 && <>{tag("1 km", (KL[0] + KR[0]) / 2, (KL[1] + KR[1]) / 2 + 128, T.kmA, 11.8)}{tag("1 km", KR[0] + 50, KT[1] - 40, T.kmB, 11.8)}</>}
        {on(c, T.volume, 11.8) > 0.05 && <g opacity={on(c, T.volume, 11.8)}>{tag("1 miliar m³", 540, 520, T.volume, 11.8)}</g>}
        {/* the box of cloud air: a glass cube (two people sitting) with specks of water and one marble */}
        {boxK > 0.01 && <g opacity={boxK}>
          <g transform={`translate(${boxO[0]} ${boxO[1]}) scale(${easeOutBack(clamp01((c - T.box) / 0.5))}) translate(${-boxO[0]} ${-boxO[1]})`}>
            {polys(block([-1, -1, 0], [1, 1, 2], 120, boxO), GLASS, 0.2 + 0.35 * clamp01((c - T.glass) / 0.6))}
          </g>
          {Array.from({ length: 14 }, (_, i) => { const p = dropAt(i, c, 900, 1215, 150); const k = clamp01((c - T.specks - i * 0.06) / 0.3); return k > 0 ? <circle key={i} cx={p[0]} cy={p[1]} r={5 * k} fill={WATER[0]} opacity={0.85} /> : null; })}
          {c >= T.marble && <g><circle cx={920} cy={my} r={17} fill={WATER[2]} /><circle cx={913} cy={my - 6} r={7} fill={WATER[0]} /></g>}
          <Label text="1 kelereng air" x={920} y={1500} fs={50} t={c} start={T.lblMarble} />
          <Label text="½ gram per m³" x={920} y={980} fs={52} t={c} start={T.lblHalf} />
        </g>}
        {/* the sums */}
        {on(c, T.vol, 27.8) > 0.02 && <g opacity={on(c, T.vol, 27.8)}>
          <rect x={290} y={1190} width={500} height={330} rx={44} fill={WHITE} opacity={0.82} />
          <Label text="1 miliar m³" x={540} y={1262} fs={60} t={c} start={T.vol} />
          <Label text="× ½ gram" x={540} y={1340} fs={60} t={c} start={T.times} />
          <line x1={330} y1={1385} x2={330 + 420 * clamp01((c - T.equals) / 0.5)} y2={1385} stroke={BLACK} strokeWidth={8} strokeLinecap="round" />
          <Label text="500.000 kg" x={540} y={1470} fs={74} t={c} start={T.kg} highlight={["500.000"]} />
          <g opacity={clamp01((c - T.ton) / 0.4)} transform={`translate(540 ${760 + 24 * (1 - springAt(c, T.ton))})`}>
            <rect x={-220} y={-60} width={440} height={120} rx={60} fill={YELLOW} /><text x={0} y={26} fontSize={72} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>= 500 ton</text>
          </g>
        </g>}
        {/* 100 elephants as 100 markers, below the cloud */}
        {dots}
        {c >= T.lblElephants && c < 35.2 && <><Plate x={540} y={1174} w={420} h={96} /><Label text="100 gajah" x={540} y={1184} fs={64} t={c} start={T.lblElephants} highlight={["100"]} /><Plate x={540} y={1749} w={380} h={80} /><Label text="tersebar luas" x={540} y={1756} fs={52} t={c} start={T.lblSpread} /></>}
        {/* why it floats: the heavy water pulls down, the lighter-than-air cloud is held up, air parcels around it */}
        {on(c, T.air, 41.8) > 0.02 && <g opacity={on(c, T.air, 41.8)}>
          {Array.from({ length: 12 }, (_, i) => { const p = dropAt(i + 7, c, 540, 1010, 560); return <circle key={i} cx={p[0]} cy={p[1] + 40} r={9} fill={WHITE} stroke={WATER[0]} strokeWidth={4} />; })}
          <Arrow2 x1={330} y1={640} x2={330} y2={820} color={BLACK} k={clamp01((c - T.down) / 0.5)} />
          <Arrow2 x1={760} y1={1230} x2={760} y2={1060} color={YELLOW_D} k={clamp01((c - T.up) / 0.5)} />
          <Plate x={330} y={599} w={250} h={76} /><Label text="air berat" x={330} y={604} fs={50} t={c} start={T.down + 0.2} />
          <Plate x={760} y={1309} w={300} h={76} /><Label text="udara naik" x={760} y={1314} fs={50} t={c} start={T.up + 0.2} />
          <Plate x={540} y={1429} w={560} h={100} /><Label text="lebih renggang" x={540} y={1440} fs={64} t={c} start={T.lblLight} highlight={["renggang"]} />
        </g>}
        {/* the droplets at the cloud's rim, seen close */}
        {on(c, T.drops, 47.8) > 0.02 && <g opacity={on(c, T.drops, 47.8)}>
          {Array.from({ length: 36 }, (_, i) => { const p = dropAt(i, c, 800, 920, 190); const k = clamp01((c - T.drops - i * 0.04) / 0.3); return <circle key={i} cx={p[0]} cy={p[1]} r={4.5 * k} fill={WATER[2]} stroke="white" strokeWidth={1.5} />; })}
          <Label text="tetes kecil sekali" x={800} y={1085} fs={34} t={c} start={T.lblDrops} />
        </g>}
        {/* the closing tag on the cloud */}
        {on(c, T.finalTon, 55.8) > 0.02 && <g opacity={on(c, T.finalTon, 55.8)} transform={`translate(540 ${640 + 20 * (1 - springAt(c, T.finalTon))})`}>
          <rect x={-210} y={-62} width={420} height={124} rx={62} fill={YELLOW} /><text x={0} y={28} fontSize={76} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>≈ 500 ton</text>
        </g>}
      </g>
      {/* the text layers: kicker + headline on top (not on the sting or the outro), the caption below; the mascot only in the sting */}
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText key={beat.id} kicker={beat.kind === "hook" ? "SATU AWAN" : beat.kind === "result" ? "JAWABANNYA" : "INTIP AWAN"} headline={beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <StingMark slug="satu-awan-beratnya-ratusan-ton" pose="topLeft" t={t} clock={c} p={p} p2={p2} />
        </g>;
      })()}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
