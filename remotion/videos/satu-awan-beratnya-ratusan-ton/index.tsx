/* Satu awan beratnya ratusan ton — a custom video (videos/satu-awan-beratnya-ratusan-ton/), in the 2.5D style (DESIGN.md "2.5D isometrik" and "Nature kit").
   One continuous take on the nature stage (sea, land, a white cumulus cloud over them): a ruler marks the cloud's width, water droplets fill and multiply in it,
   a row of elephants stands for its weight, air rises under it, the droplets are tiny, and the camera eases back to the wide shot (the loop). Words come from the
   checked story through plan.ts. */
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  BLACK, Brand, CaptionLayer, FONT_BOLD, FPS, FRAME, ISO, WALL, WHITE, YELLOW, Mascot, TopText, bobPx, driftPx, easeInOut, springAt, useFonts, layerTransform, IsoBlock,
  type StoryT,
} from "../../src/design/index.ts";
import { IsoBushes, IsoCloud, IsoDrop, IsoFarHills, IsoFields, IsoHill, IsoHills, IsoLand, IsoRocks, IsoSea, IsoTreeShadows, IsoTrees } from "../../src/components/IsoNature.tsx";
import { Motes } from "../../src/components/Iso.tsx";
import { BUSHES, BUSHES_WIDE, ROCKS, ROCKS_WIDE, TREES, TREES_WIDE } from "../../src/natureGeometry.ts";
import type { P3 } from "../../src/iso.ts";
import { CLOUD, CLOUD_PT, FAR, OUT, SPOT, makePlan, spotK } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const W = FRAME.width, H = FRAME.height;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ALL_TREES = [...TREES, ...TREES_WIDE].sort((a, b) => a.x + a.y - (b.x + b.y));
const ALL_BUSHES = [...BUSHES, ...BUSHES_WIDE], ALL_ROCKS = [...ROCKS, ...ROCKS_WIDE];
const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const LAND_Z = 0.2;                                                    // LAND_TOP in natureGeometry.ts

/** A small iso elephant (a new kit piece: blocks from iso.ts, the stone tones, facing +x). Its foot is at (x, y, LAND_Z). */
const IsoElephant: React.FC<{ x: number; y: number; u: number; o: readonly [number, number]; k: number }> = ({ x, y, u, o, k }) => {
  const z = LAND_Z, T = ISO.stone, S = 1.3;
  const p = (dx: number, dy: number, dz: number): P3 => [x + S * dx, y + S * dy, z + S * dz];
  const B = (a: P3, b: P3, i: number) => <IsoBlock key={i} a={a} b={b} u={u} o={o} tones={T} />;
  const lift = (1 - k) * 0.5;
  return (
    <g opacity={clamp01(k * 2)} transform={`translate(0 ${-lift * u})`}>
      {[
        B(p(0.03, 0, 0), p(0.07, 0.04, 0.08), 0), B(p(0.2, 0, 0), p(0.24, 0.04, 0.08), 1),
        B(p(0.03, 0.08, 0), p(0.07, 0.12, 0.08), 2), B(p(0.2, 0.08, 0), p(0.24, 0.12, 0.08), 3),
        B(p(0, 0, 0.07), p(0.27, 0.12, 0.2), 4),
        B(p(0.34, 0.045, 0.02), p(0.38, 0.085, 0.15), 5),
        B(p(0.27, 0.01, 0.1), p(0.36, 0.11, 0.23), 6),
      ]}
    </g>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <Picture story={p.story} layoutDebug={p.layoutDebug} />;

const Picture: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s }) => {
  useFonts();
  const frame = useCurrentFrame(), t = frame / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const { m } = P;
  const oc = P.outCam(t), lw = P.loopWeight(t), ph = P.phase(t);
  const beat = s.beats.find((b) => t >= P.beat(b.id).a && t < P.beat(b.id).b) ?? s.beats[s.beats.length - 1];
  const bt = t - P.beat(beat.id).a;
  const top = P.tops.find((x) => t >= x.a && t < x.b);
  const stage = { u: OUT.u, o: OUT.o };
  const C = CLOUD_PT;
  const dk = P.dropK(t), N = 64;
  const droplets = Array.from({ length: N }, (_, i) => {
    const a = i * 2.39996, r = Math.sqrt((i + 0.5) / N);
    const x = C[0] + 300 * r * Math.cos(a) * (0.8 + 0.2 * Math.sin(i)), y = C[1] - 10 + 105 * r * Math.sin(a);
    return { x: x + driftPx(t) * 0.3, y: y + bobPx(t, i * 0.37, 5), r: 7 + (i % 4) * 2.5, a: clamp01(dk * N - i) };
  });
  const rk = P.rulerK(t), rx0 = C[0] - 330, rx1 = C[0] + 330, ry = C[1] + 185;
  const ele = [...Array(6)].map((_, i) => ({ i, x: 1.1 + (i % 3) * 0.55, y: i < 3 ? 0.62 : 1.0 })).sort((a, b) => a.x + a.y - (b.x + b.y));
  const air = P.airK(t);
  const hk = P.hundredK(t);

  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={WALL} />
        <g>
          <g transform={layerTransform(oc, 0.3)}><g transform="translate(540 960) scale(1.15) translate(-540 -960)">
            <g opacity={1 - lw}><Brand clock={t} spot={{ ...SPOT, r: SPOT.r * spotK(oc.zoom) }} /></g>
            {lw > 0 && <g opacity={lw}><Brand clock={0} spot={{ ...SPOT, r: SPOT.r * spotK(oc.zoom) }} /></g>}
          </g>
            <IsoFarHills {...FAR.hills} />
            {FAR.clouds03.map((c, i) => <IsoCloud key={i} u={c.u} o={c.o} cx={0} cy={0} cz={0} grow={c.grow} haze={0.55} phase={ph + i * 0.3} />)}
          </g>
          <g transform={layerTransform(oc, 0.6)}>{FAR.clouds06.map((c, i) => <IsoCloud key={i} u={c.u} o={c.o} cx={0} cy={0} cz={0} grow={c.grow} haze={0.3} phase={ph + i * 0.5} />)}</g>
          <g transform={layerTransform(oc, 1)}>
            <IsoSea {...stage} wide phase={ph} />
            <IsoLand {...stage} wide />
            <IsoHill {...stage} />
            <IsoHills {...stage} />
            <IsoFields {...stage} />
            <IsoTreeShadows {...stage} list={ALL_TREES} />
            <IsoBushes {...stage} bushes={ALL_BUSHES} />
            <IsoRocks {...stage} list={ALL_ROCKS} />
            <IsoTrees {...stage} list={ALL_TREES} time={t} swayAmp={1 - lw} />
            {/* the elephants: the weight, in a row on the land (new kit piece, exaggerated against the cloud like the aircraft of the seeding set) */}
            {ele.map((e) => <g key={e.i} opacity={P.eleFade(t)}><IsoElephant x={e.x} y={e.y} u={OUT.u} o={OUT.o} k={clamp01((t - (m.eleFrom + e.i * 0.6)) / 0.4)} /></g>)}
            {/* air rising under the cloud (white streaks, B27: air is a white curving streak) */}
            {air > 0.01 && <g opacity={air}>{[-240, -120, 0, 120, 240].map((dx, i) => {
              const ph2 = (t * 0.6 + i * 0.21) % 1, y0 = C[1] + 330 - 260 * ph2, x0 = C[0] + dx + 14 * Math.sin(ph2 * 6 + i);
              return <path key={i} d={`M ${x0} ${y0 + 90} q 18 -30 0 -60 q -18 -30 0 -60`} fill="none" stroke={WHITE} strokeWidth={8} strokeLinecap="round" opacity={0.85 * Math.sin(ph2 * Math.PI)} />;
            })}</g>}
            <g transform={`translate(${driftPx(t) * (1 - lw)} ${bobPx(t, 0, 5) * (1 - lw)})`}>
              <IsoCloud {...stage} cx={CLOUD.cx} cy={CLOUD.cy} cz={CLOUD.cz} grow={CLOUD.grow} phase={ph} />
              {droplets.map((d, i) => d.a > 0.01 && <g key={i} opacity={d.a}><IsoDrop cx={d.x} cy={d.y} r={d.r} /></g>)}
            </g>
            {/* the ruler across the cloud's width */}
            {rk > 0.01 && <g opacity={rk} stroke={BLACK} strokeWidth={9} strokeLinecap="round">
              <line x1={rx0} y1={ry} x2={rx0 + (rx1 - rx0) * rk} y2={ry} />
              <line x1={rx0} y1={ry - 24} x2={rx0} y2={ry + 24} /><line x1={rx1} y1={ry - 24} x2={rx1} y2={ry + 24} opacity={rk > 0.98 ? 1 : 0} />
            </g>}
          </g>
        </g>
        <g transform={layerTransform(oc, 1.35)}><Motes t={t} n={10} opacity={0.2} /></g>

        {hk > 0.01 && <g transform={`translate(860 620) scale(${hk}) translate(-860 -620)`}><circle cx={860} cy={620} r={92} fill={YELLOW} /><text x={860} y={620} fontSize={72} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>100</text></g>}

        {t >= m.sting - 0.1 && t < m.stingEnd + 0.15 && (() => {
          const S = P.STING, p = springAt(t, m.sting), out2 = 1 - easeInOut(clamp01((t - m.stingEnd + 0.18) / 0.25));
          return <g>
            <g transform={`translate(${S.mx} ${S.my}) scale(${Math.max(0, p) * out2}) translate(${-S.mx} ${-S.my})`}><Mascot x={S.mx} y={S.my} w={S.mw} expr="curious" t={t - m.sting} clock={t} squash={0.18 * (1 - p)} /></g>
            <g transform={`translate(${S.px} ${S.py}) scale(${Math.max(0, springAt(t, m.sting + 0.25)) * out2}) translate(${-S.px} ${-S.py})`}>
              <rect x={S.px - S.pillW / 2} y={S.py - 46} width={S.pillW} height={92} rx={46} fill={YELLOW} />
              <text x={S.px} y={S.py + 18} fontSize={S.fs} textAnchor="middle" fill={BLACK} style={bold}>Intip yuk!</text>
            </g>
          </g>;
        })()}

        {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={t - top.a} />}
        {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={bt} />}
      </svg>
    </div>
  );
};
