/* Petir lebih panas dari permukaan matahari: one street-city set (set kind "street-city"): a plaza slab with a road, boxy buildings and a lightning mast
   under a storm cloud. The hero is the lightning bolt, drawn in its real form: a jagged, branching channel (not a smooth zigzag). The air it heats is
   measured on a red gauge, the sun's surface on a yellow one of the same scale; four more sun pieces stack up to about five. The thunder is the air around
   the channel jumping outward. The first frame is the last (the loop). */
import React from "react";
import {
  BLACK, CaptionLayer, G1, G2, G3, IsoCloud, IsoSun, Label, Mascot, RED, StoryVideo, TopText, YELLOW, block, cam2At, clamp01, easeInOut, easeOutBack,
  flicker, isoAt, layerTransform, ptsAttr, springAt, useFonts, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { ISO, THEMES, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, T } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const U = 100, O: [number, number] = [540, 1300];                   // the set's iso unit and origin (world px)
const SKY = THEMES.sky, WATER = ISO.water;
const SKY_TOP = mixRgb(SKY.wall, G3, 0.35), SKY_LOW = mixRgb(SKY.wall, G3, 0.6);
const GROUND: [string, string, string] = [mixRgb(ISO.floor[0], ISO.stone[0], 0.45), mixRgb(ISO.floor[1], ISO.stone[1], 0.45), mixRgb(ISO.floor[2], ISO.stone[2], 0.45)];
const ROAD = ISO.dark, EDGE = G1;
const HEAT: [string, string, string] = [mixRgb(RED, WHITE, 0.3), RED, mixRgb(RED, BLACK, 0.3)];
const COOL: [string, string, string] = [ISO.metal[0], ISO.metal[1], ISO.metal[2]];
const HAZE = (k: number) => mixRgb(SKY_LOW, WHITE, k);
const BUILD: [string, string, string][] = [
  [mixRgb(ISO.wall[0], ISO.stone[0], 0.3), mixRgb(ISO.wall[1], ISO.stone[1], 0.3), mixRgb(ISO.wall[2], ISO.stone[2], 0.3)],
  [mixRgb(ISO.plastic[0], WATER[0], 0.18), mixRgb(ISO.plastic[1], WATER[0], 0.22), mixRgb(ISO.plastic[2], WATER[1], 0.26)],
  [mixRgb(ISO.sand[0], ISO.stone[0], 0.4), mixRgb(ISO.sand[1], ISO.stone[1], 0.4), mixRgb(ISO.sand[2], ISO.stone[2], 0.4)],
];
const polys = (ps: Poly[], tones: readonly string[], op = 1) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" opacity={op} />);
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));

// ---------------------------------------------------------------------------------------------------------------- the bolt (its real form: jagged, with branches)
const TIP = isoAt([-1, -1, 3.4], U, O);                              // the top of the mast: where the bolt ends
const BASE_Y = 470;                                                   // under the storm cloud
const OFFS = [0, -34, 26, -38, 40, -26, 32, -14, 0];                  // the sideways jag of each step of the channel
const NODES: [number, number][] = OFFS.map((dx, i) => [TIP[0] + dx, BASE_Y + ((TIP[1] - BASE_Y) * i) / (OFFS.length - 1)]);
const bolt = (pts: [number, number][]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
const MAIN = bolt(NODES);
const BR1 = bolt([NODES[3], [NODES[3][0] - 30, NODES[3][1] + 24], [NODES[3][0] - 62, NODES[3][1] + 34], [NODES[3][0] - 84, NODES[3][1] + 70]]);
const BR2 = bolt([NODES[5], [NODES[5][0] + 28, NODES[5][1] + 18], [NODES[5][0] + 52, NODES[5][1] + 22], [NODES[5][0] + 66, NODES[5][1] + 56]]);
const BR3 = bolt([NODES[2], [NODES[2][0] + 24, NODES[2][1] + 10], [NODES[2][0] + 40, NODES[2][1] + 36]]);

/** How much of the bolt shows at time c: 0..1 drawn fraction and its brightness (a strike is drawn in 0.12 s, flickers, and is gone in 0.7 s). */
function strike(c: number): { draw: number; lum: number } {
  for (const s of T.strikes) {
    const k = c - s;
    if (k >= 0 && k < 0.7) return { draw: clamp01(k / 0.12), lum: k < 0.25 ? 1 : k < 0.4 ? (Math.floor(k * 40) % 2 ? 0.25 : 1) : 1 - (k - 0.4) / 0.3 };
  }
  return { draw: 0, lum: 0 };
}

const Bolt: React.FC<{ draw: number; lum: number }> = ({ draw, lum }) => {
  if (draw <= 0 || lum <= 0) return null;
  const strokeOf = (d: string, w: number, col: string, op: number, key: string) => <path key={key} d={d} pathLength={1} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={op * lum} />;
  return <g>
    {[[MAIN, 1], [BR1, 0.8], [BR2, 0.8], [BR3, 0.7]].map(([d, s], i) => strokeOf(d as string, 40 * (s as number), YELLOW, 0.35, `g${i}`))}
    {[[MAIN, 1], [BR1, 0.8], [BR2, 0.8], [BR3, 0.7]].map(([d, s], i) => strokeOf(d as string, 16 * (s as number), YELLOW, 1, `m${i}`))}
    {[[MAIN, 1], [BR1, 0.8], [BR2, 0.8], [BR3, 0.7]].map(([d, s], i) => strokeOf(d as string, 6 * (s as number), WHITE, 1, `c${i}`))}
  </g>;
};

/** The air of the channel after a strike: it glows blue-white, then cools to nothing (kept after the short strike at 48 s). */
const Channel: React.FC<{ k: number; cool: number }> = ({ k, cool }) => k <= 0.01 ? null : (
  <g opacity={k}>
    {[MAIN, BR1, BR2, BR3].map((d, i) => <path key={i} d={d} fill="none" stroke={mixRgb(mixRgb(WATER[0], WHITE, 0.55), SKY_LOW, cool)} strokeWidth={(i ? 14 : 22) * (1 - 0.5 * cool)} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />)}
  </g>
);

// ---------------------------------------------------------------------------------------------------------------- the set
/** A boxy building with its windows on both faces (a few lit, they flicker a little). */
const Bldg: React.FC<{ b: [number, number, number, number, number]; tones: [string, string, string]; id: number; dx?: number; haze?: number; c: number }> = ({ b, tones, id, dx = 0, haze = 0, c }) => {
  const [x0, y0, x1, y1, h] = b, tn = haze ? (tones.map((t) => mixRgb(t, HAZE(0.2), haze)) as [string, string, string]) : tones;
  const wins: React.ReactNode[] = [];
  const nx = Math.max(1, Math.floor((x1 - x0) / 0.42)), ny = Math.max(1, Math.floor((y1 - y0) / 0.42)), nz = Math.max(1, Math.floor((h - 0.3) / 0.62));
  for (let j = 0; j < nz; j++) {
    const z0 = 0.35 + j * 0.62, z1 = z0 + 0.34;
    for (let i = 0; i < nx; i++) {
      const xa = x0 + 0.1 + i * ((x1 - x0 - 0.1) / nx), xb = xa + 0.2, lit = (i * 7 + j * 3 + id) % 5 === 0;
      wins.push(<polygon key={`f${i}-${j}`} points={ptsAttr([isoAt([xa, y1, z0], U, O), isoAt([xb, y1, z0], U, O), isoAt([xb, y1, z1], U, O), isoAt([xa, y1, z1], U, O)])} fill={lit ? ISO.sun[0] : ISO.dark[1]} opacity={lit ? Math.min(1, flicker(c, i + j + id, 0.3)) : 0.85} />);
    }
    for (let i = 0; i < ny; i++) {
      const ya = y0 + 0.1 + i * ((y1 - y0 - 0.1) / ny), yb = ya + 0.2, lit = (i * 5 + j * 2 + id) % 6 === 0;
      wins.push(<polygon key={`s${i}-${j}`} points={ptsAttr([isoAt([x1, ya, z0], U, O), isoAt([x1, yb, z0], U, O), isoAt([x1, yb, z1], U, O), isoAt([x1, ya, z1], U, O)])} fill={lit ? ISO.sun[1] : ISO.dark[2]} opacity={lit ? Math.min(1, flicker(c, i + j + id + 3, 0.3)) : 0.85} />);
    }
  }
  return <g transform={`translate(${dx} 0)`}>{polys(block([x0, y0, 0], [x1, y1, h], U, O), tn)}{wins}</g>;
};

/** A street lamp (a loose supporting piece): a thin post and a lamp head that flickers a little. */
const Lamp: React.FC<{ x: number; y: number; c: number; ph: number }> = ({ x, y, c, ph }) => {
  const head = isoAt([x, y, 1.9], U, O), on_ = clamp01(flicker(c, ph, 0.25));
  return <g>{polys(block([x - 0.05, y - 0.05, 0], [x + 0.05, y + 0.05, 1.8], U, O), ISO.dark)}{polys(block([x - 0.16, y - 0.16, 1.8], [x + 0.16, y + 0.16, 1.95], U, O), ISO.metal)}
    <circle cx={head[0]} cy={head[1] + 4} r={11} fill={ISO.sun[0]} opacity={0.35 * on_} /><circle cx={head[0]} cy={head[1] + 4} r={5} fill={ISO.sun[0]} opacity={on_} /></g>;
};

/** The lightning mast: a metal tower with a thin rod on top. Loose supporting piece. */
const Mast: React.FC = () => <g>{polys(block([-1.25, -1.25, 0], [-0.75, -0.75, 2.6], U, O), ISO.metal)}{polys(block([-1.04, -1.04, 2.6], [-0.96, -0.96, 3.4], U, O), ISO.dark)}</g>;

/** A gauge (the second loose piece): a column of height h units (one unit = 100 px), in the tones given, standing on the plaza. */
const Gauge: React.FC<{ x: number; y: number; h: number; tones: readonly string[]; z0?: number }> = ({ x, y, h, tones, z0 = 0 }) => h <= 0.001 ? null : <g>{polys(block([x, y, z0], [x + 0.6, y + 0.6, z0 + h], U, O), tones)}</g>;

const Rain: React.FC<{ c: number }> = ({ c }) => <g>{Array.from({ length: 22 }, (_, i) => {
  const x = 330 + ((i * 53) % 400), f = (c * 1.5 + i * 0.137) % 1, y = 470 + f * 430;
  return <line key={i} x1={x} y1={y} x2={x - 9} y2={y + 34} stroke={WATER[1]} strokeWidth={4} strokeLinecap="round" opacity={0.6 * Math.min(1, f * 5) * (1 - f)} />;
})}</g>;

/** The sky: stacked bands of grey-blue, paler at the top (the top text sits on it). Far layer. */
const Sky: React.FC = () => <g>{Array.from({ length: 30 }, (_, i) => <rect key={i} x={-1800} y={-1500 + i * 120} width={4680} height={122} fill={mixRgb(SKY_TOP, SKY_LOW, Math.min(1, i / 16))} />)}</g>;

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock, cam = cam2At(CAM, c), isOutro = beat.kind === "outro";
  const st = strike(c);
  const glow = on(c, T.glowA, T.glowAEnd) * (0.8 + 0.2 * Math.sin(c * 6)) + (c >= T.strikes[5] && c < T.coolEnd + 0.5 ? clamp01(1 - (c - T.cool) / (T.coolEnd - T.cool)) * clamp01((c - T.strikes[5]) / 0.15) : 0) + (c >= T.strikes[4] && c < T.strikes[4] + 1.6 ? clamp01(1 - (c - T.strikes[4] - 0.3) / 1.3) : 0);
  const coolK = c >= T.cool ? clamp01((c - T.cool) / (T.coolEnd - T.cool)) : 0;
  // the red gauge: grows 14.6 to 18; drops 49 to 54.2 (the channel cools)
  const hA = 6 * easeInOut(clamp01((c - T.gaugeA) / (T.gaugeAFull - T.gaugeA))) * (1 - easeInOut(clamp01((c - T.cool) / (T.coolEnd - T.cool))));
  const hB = 1.1 * easeOutBack(clamp01((c - T.gaugeB) / (T.gaugeBFull - T.gaugeB))) * (1 - easeInOut(clamp01((c - T.coolEnd) / (T.gone - T.coolEnd))));
  const stackK = T.seg.map((s) => easeOutBack(clamp01((c - s) / 0.4)) * (1 - easeInOut(clamp01((c - T.coolEnd) / (T.gone - T.coolEnd)))));
  const ringsK = T.rings.map((r) => clamp01((c - r) / 1.0));
  const shakeX = c >= T.shake && c < T.shake + 1.0 ? 5 * Math.sin((c - T.shake) * 60) * (1 - (c - T.shake)) : 0;
  const aTop = isoAt([2.8, -0.4, 6], U, O), bTop = isoAt([3.7, -1.3, 1.1], U, O), bTop5 = isoAt([3.7, -1.3, 5.5], U, O);
  const showGauges = !isOutro && (c >= T.gaugeA && c < T.gone);
  // the cloud is out of the frame while the camera works at the gauges (it fades while the camera is panning away and back)
  const cloudOp = (1 - clamp01((c - 14.6) / 0.6) * (1 - clamp01((c - 38.4) / 0.8))) * (1 - clamp01((c - 49.6) / 0.6) * (1 - clamp01((c - 55.2) / 1.2)));
  // the gauges step out while the thunder is the subject (39 to 47.5 s) and come back for the cooling
  const gOp = 1 - clamp01((c - 38.4) / 0.5) * (1 - clamp01((c - 47.4) / 0.5));
  const bob = 6 * Math.sin((c / 6) * Math.PI * 2);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 0.3)}><Sky /></g>
      {/* the set: the plaza slab (bleeds past the frame), the road, the buildings, the mast and the lamps */}
      <g transform={layerTransform(cam, 1)}>
        {polys(block([-9, -9, -1.2], [9, 9, 0], U, O), GROUND)}
        {polys(block([-9, 2.6, 0], [9, 4.2, 0.03], U, O), ROAD)}
        {Array.from({ length: 11 }, (_, i) => polys(block([-8.6 + i * 1.7, 3.33, 0.03], [-8.0 + i * 1.7, 3.47, 0.045], U, O), ISO.plastic))}
        <Bldg b={[-7.2, -2.6, -5.6, -1.0, 3.6]} tones={BUILD[1]} id={1} c={c} haze={0.25} />
        <Bldg b={[-2.6, -7.2, -1.0, -5.6, 4.2]} tones={BUILD[2]} id={2} c={c} haze={0.25} />
        <g><Bldg b={[0.6, -4.0, 2.0, -2.6, 2.8]} tones={BUILD[0]} id={3} c={c} dx={shakeX} />
          <Bldg b={[-4.0, 0.6, -2.6, 2.0, 2.2]} tones={BUILD[1]} id={4} c={c} dx={-shakeX} /></g>
        <Mast />
        <Lamp x={1.6} y={2.2} c={c} ph={0.2} />
        <Lamp x={-3.4} y={2.2} c={c} ph={0.7} />
        {/* the gauges, on the plaza: the red one is the bolt's air, the yellow one the sun's surface (same scale), then four more yellow pieces */}
        {showGauges && <g opacity={gOp}>
          <Gauge x={2.5} y={-0.7} h={hA} tones={coolK > 0 ? HEAT.map((h, i) => mixRgb(h, COOL[i], coolK)) : HEAT} />
          <Gauge x={3.4} y={-1.6} h={hB} tones={ISO.sun} />
          {stackK.map((k, i) => <Gauge key={i} x={3.4} y={-1.6} z0={1.1 * (i + 1)} h={1.1 * Math.max(0, k)} tones={ISO.sun} />)}
        </g>}
      </g>
      {/* the air jumps outward around the channel: rings in the horizontal plane, and one on the ground */}
      <g transform={layerTransform(cam, 1)}>
        {ringsK.map((k, i) => k > 0 && k < 1 && [660, 740, 820].map((y, j) => <ellipse key={`${i}${j}`} cx={TIP[0]} cy={y} rx={30 + 230 * k} ry={(30 + 230 * k) * 0.42} fill="none" stroke={j === 1 ? WHITE : G3} strokeWidth={6 * (1 - k) + 1} opacity={0.9 * (1 - k)} />))}
        {ringsK.map((k, i) => k > 0 && k < 1 && <ellipse key={`g${i}`} cx={TIP[0]} cy={TIP[1] + 340} rx={60 + 520 * k} ry={(60 + 520 * k) * 0.5} fill="none" stroke={G2} strokeWidth={8 * (1 - k) + 1} opacity={0.7 * (1 - k)} />)}
      </g>
      {/* the storm cloud, the rain and the bolt (the hero) */}
      <g transform={layerTransform(cam, 1)}>
        <g opacity={cloudOp}><Rain c={c} /></g>
        <g opacity={cloudOp} transform={`translate(0 ${bob})`}><IsoCloud u={120} o={[540, 430]} cx={0} cy={0} cz={0} dark={0.9} grow={1.5} phase={c / 6} /></g>
        <Channel k={Math.min(1, glow)} cool={coolK} />
        <Bolt draw={st.draw} lum={st.lum} />
        {st.lum > 0.5 && <rect x={-1800} y={-1500} width={4680} height={4600} fill={WHITE} opacity={0.2 * st.lum} />}
      </g>
      {/* the labels on the gauges (the numbers come from the story's claims) */}
      <g transform={layerTransform(cam, 1)}>
        {on(c, T.lblA, 22.4) > 0.02 && <g opacity={on(c, T.lblA, 22.4)}><rect x={aTop[0] - 190} y={aTop[1] - 110} width={380} height={84} rx={42} fill={WHITE} opacity={0.88} /><Label text="± 30.000 °C" x={aTop[0]} y={aTop[1] - 52} fs={54} t={c} start={T.lblA} highlight={["30.000"]} /></g>}
        {on(c, T.lblB, 30.4) > 0.02 && <g opacity={on(c, T.lblB, 30.4)}><rect x={bTop[0] - 190} y={bTop[1] - 210} width={380} height={84} rx={42} fill={WHITE} opacity={0.88} /><Label text="± 5.500 °C" x={bTop[0]} y={bTop[1] - 152} fs={54} t={c} start={T.lblB} highlight={["5.500"]} /></g>}
        {c >= T.sun && c < T.gone && hB > 0.3 && gOp > 0.02 && (() => { const top = isoAt([3.7, -1.3, hB + 1.1 * stackK.reduce((a, k) => a + Math.max(0, k), 0)], U, O); return <g opacity={clamp01((c - T.sun) / 0.4) * gOp}><IsoSun cx={top[0] + 6} cy={top[1] - 58} r={34} phase={c / 6} /></g>; })()}
        {on(c, T.line, 38.2) > 0.02 && <g opacity={on(c, T.line, 38.2)}>
          <line x1={bTop5[0] - 60} y1={bTop5[1]} x2={aTop[0] - 60} y2={aTop[1]} stroke={BLACK} strokeWidth={6} strokeDasharray="14 12" />
          <g transform={`translate(${(bTop5[0] + aTop[0]) / 2 - 150} ${(bTop5[1] + aTop[1]) / 2 - 20 + 20 * (1 - springAt(c, T.lblX5))})`}><rect x={-20} y={-60} width={250} height={110} rx={55} fill={YELLOW} /><text x={105} y={22} fontSize={76} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>≈ 5×</text></g>
        </g>}
        {on(c, T.lblUs, T.lblCool - 0.4) > 0.02 && <g opacity={on(c, T.lblUs, T.lblCool - 0.4)}><rect x={290} y={970} width={500} height={84} rx={42} fill={WHITE} opacity={0.88} /><Label text="puluhan mikrodetik" x={540} y={1030} fs={50} t={c} start={T.lblUs} highlight={["mikrodetik"]} /></g>}
        {on(c, T.lblCool, T.coolEnd + 1) > 0.02 && <g opacity={on(c, T.lblCool, T.coolEnd + 1)}><rect x={640} y={1006} width={300} height={84} rx={42} fill={WHITE} opacity={0.88} /><Label text="mendingin" x={790} y={1066} fs={50} t={c} start={T.lblCool} /></g>}
        {c >= T.rings[0] && c < T.rings[0] + 3 && <g opacity={on(c, T.rings[0] + 0.3, T.rings[0] + 2.8)}><rect x={730} y={720} width={300} height={84} rx={42} fill={WHITE} opacity={0.88} /><Label text="guntur" x={880} y={780} fs={54} t={c} start={T.rings[0] + 0.3} /></g>}
      </g>
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText key={beat.id} kicker={beat.kind === "hook" ? "PETIR" : beat.kind === "result" ? "JAWABANNYA" : "INTIP PETIR"} headline={beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={c} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1489) scale(${Math.max(0, p2)}) translate(-540 -1489)`}>
            <rect x={-210 + 540} y={1443} width={420} height={92} rx={46} fill={YELLOW} />
            <text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>Intip yuk!</text>
          </g>
        </g>;
      })()}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
