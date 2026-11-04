/* Pelangi sebenarnya berbentuk lingkaran — a custom video (videos/pelangi-sebenarnya-berbentuk-l/), in the 2.5D style (DESIGN.md "2.5D isometrik" and "Nature kit").
   One continuous take on the wide nature diorama (sea, land, hills, fields, trees, a rain cloud, the sun). The hero is the rainbow RING, drawn from the iso kit in the XZ plane:
   seven bands, the ground hides its lower half; light from the sun flashes in the rain drops, the marker opposite the sun is the ring's centre, the 42 degree radius, the faint
   hidden half, then the aircraft climbs and the ground sinks away so the whole ring shows, the FAKTA stamp, the two tips, and the loop-back. Every word comes from the checked story through plan.ts. */
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  BLACK, Brand, CaptionLayer, FPS, FRAME, G2, ISO, Mascot, TopText, WALL, YELLOW, YELLOW_D, bobPx, driftPx, easeInOut, springAt, useFonts, layerTransform, toScreen, LayoutDebug,
  FONT_BOLD, ptsAttr, TipCard, NumberLabel, tipCardHeight,
  type StoryT,
} from "../../src/design/index.ts";
import { IsoBushes, IsoCloud, IsoDrop, IsoFarHills, IsoFields, IsoHill, IsoHills, IsoLand, IsoPuddles, IsoRain, IsoRocks, IsoSea, IsoSun, IsoTreeShadows, IsoTrees } from "../../src/components/IsoNature.tsx";
import { IsoPlane } from "../../src/components/IsoSeeding.tsx";
import { Motes } from "../../src/components/Iso.tsx";
import { BUSHES, BUSHES_WIDE, ROCKS, ROCKS_WIDE, TREES, TREES_WIDE, CLOUD_GREY, mixRgb } from "../../src/natureGeometry.ts";
import { FAR, OUT, RING, RING_SCREEN, SPOT, SUN_AT, TIP, HORIZON_DIR, makePlan, ringPoint } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const W = FRAME.width, H = FRAME.height;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ALL_TREES = [...TREES, ...TREES_WIDE].sort((a, b) => a.x + a.y - (b.x + b.y));
const ALL_BUSHES = [...BUSHES, ...BUSHES_WIDE], ALL_ROCKS = [...ROCKS, ...ROCKS_WIDE];
const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const stage = { u: OUT.u, o: OUT.o };
const LABEL_FS = 46;

/** The seven bands of the rainbow, outside to inside, from the kit's meaning tones (soft red, orange, yellow, green, blue, indigo, violet). */
const BANDS = [ISO.organ[1], mixRgb(ISO.organ[1], YELLOW, 0.5), YELLOW, ISO.grass[1], ISO.water[0], ISO.water[2], mixRgb(ISO.water[2], ISO.organ[1], 0.5)];

/** One band of the ring as a ring-shaped polygon in the iso XZ plane (outer arc forward, inner arc back). */
const bandPts = (i: number, n = 90): string => {
  const ro = RING.r - i * RING.band, ri = ro - RING.band + 0.004;
  const outer = Array.from({ length: n + 1 }, (_, k) => ringPoint(ro, (k / n) * Math.PI * 2));
  const inner = Array.from({ length: n + 1 }, (_, k) => ringPoint(ri, ((n - k) / n) * Math.PI * 2));
  return ptsAttr([...outer, ...inner]);
};
const BAND_POLYS = BANDS.map((_, i) => bandPts(i));

/** The region above the horizon line through the ring's centre, sunk by `drop` px (a big polygon; the ring is clipped to it). */
const aboveLine = (drop: number, below = false): string => {
  const [cx, cy] = [RING_SCREEN[0], RING_SCREEN[1] + drop], L = 3000, d = HORIZON_DIR, up = below ? 3000 : -3000;
  return `${cx - L * d[0]},${cy - L * d[1]} ${cx + L * d[0]},${cy + L * d[1]} ${cx + L * d[0]},${cy + L * d[1] + up} ${cx - L * d[0]},${cy - L * d[1] + up}`;
};

const Rainbow: React.FC<{ t: number; drop: number; ghost: number; id: string; pulse: number }> = ({ t, drop, ghost, id, pulse }) => (
  <g>
    <defs>
      <clipPath id={`${id}up`}><polygon points={aboveLine(drop)} /></clipPath>
      <clipPath id={`${id}dn`}><polygon points={aboveLine(drop, true)} /></clipPath>
    </defs>
    <g clipPath={`url(#${id}up)`}>
      {BAND_POLYS.map((pts, i) => <polygon key={i} points={pts} fill={BANDS[i]} opacity={0.88 + 0.12 * pulse} />)}
    </g>
    {ghost > 0.01 && <g clipPath={`url(#${id}dn)`} opacity={0.42 * ghost}>
      {BAND_POLYS.map((pts, i) => <polygon key={i} points={pts} fill={BANDS[i]} />)}
    </g>}
  </g>
);

/** A dashed yellow ray that runs from a to b (the dashes travel toward b). */
const Ray: React.FC<{ a: readonly [number, number]; b: readonly [number, number]; t: number; k: number }> = ({ a, b, t, k }) => {
  if (k <= 0.01) return null;
  const ex = a[0] + (b[0] - a[0]) * k, ey = a[1] + (b[1] - a[1]) * k;
  return <line x1={a[0]} y1={a[1]} x2={ex} y2={ey} stroke={YELLOW_D} strokeWidth={9} strokeLinecap="round" strokeDasharray="26 22" strokeDashoffset={-((t * 90) % 48)} opacity={0.9} />;
};

const Stamp: React.FC<{ text: string; x: number; y: number; fs: number; p: number }> = ({ text, x, y, fs, p }) => {
  if (p <= 0.001) return null;
  const w = text.length * fs * 0.62 + fs * 1.3, h = fs * 1.5;
  return (
    <g transform={`translate(${x} ${y}) rotate(-6) scale(${Math.max(0, p)})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={YELLOW} />
      <text x={0} y={fs * 0.02} fontSize={fs} fill={BLACK} textAnchor="middle" dominantBaseline="central" letterSpacing={2} style={bold}>{text}</text>
    </g>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => {
  useFonts();
  const frame = useCurrentFrame(), t = frame / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const { m } = P;
  const st = P.state(t), oc = P.cam(t), lw = P.loopWeight(t);
  const beat = s.beats.find((b, i) => t >= P.starts[i] && t < P.starts[i] + b.dur) ?? s.beats[s.beats.length - 1];
  const bt = t - P.starts[s.beats.indexOf(beat)];
  const top = P.tops.find((x) => t >= x.a && t < x.b);
  const sc = (p: readonly [number, number]) => toScreen(oc, [p[0], p[1]]);
  const phase = (t % 12) / 12;
  const rainPhase = (t * 1.3) % 1;
  const drop = st.drop;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 3);                      // the ring glows a little all the time (period 3 s divides 60)
  const sunBright = 1 + 0.04 * Math.sin(t * 2 * Math.PI / 4);

  // the raindrops the light flashes in (world points beside the ring's left side, under the cloud)
  const dropPts: (readonly [number, number])[] = [ringPoint(RING.r - 0.4, Math.PI * 0.82), ringPoint(RING.r - 0.4, Math.PI * 0.68), ringPoint(RING.r - 0.4, Math.PI * 0.55), ringPoint(RING.r - 0.4, Math.PI * 0.42)];
  const rayK = (i: number) => clamp01(st.rays * 1.4 - i * 0.12);
  const centreScreen = RING_SCREEN;
  const lab = (text: string, n: number, x: number, y: number, ax: number, ay: number, from: number, to: number) => {
    const [px, py] = [x, y], [qx, qy] = sc([ax, ay]);
    return <NumberLabel key={text} text={text} n={n} x={px} y={py} ax={qx} ay={qy} fs={LABEL_FS} t={t} start={from} end={to} />;
  };
  const tipTitle = ["Berdiri membelakangi matahari", "Naik tinggi, lihat lebih utuh"];
  const tipSub = ["Saat hujan, cari tetes air di depan", "Gunung, gedung tinggi atau pesawat"];
  const tipAt = [m.tip1, m.tip2];
  const tipY = [TIP.y, TIP.y + tipCardHeight(tipTitle[0], tipSub[0], TIP.w) + 28];
    const hiddenPt = ringPoint(RING.r - 0.35, -Math.PI / 2);
  const stampAt = ringPoint(0, 0);

  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={WALL} />

        {/* far (B27.2): the brand wall, far hills and two small pale clouds at parallax 0.3 */}
        <g transform={layerTransform(oc, 0.3)}>
          <g transform="translate(540 960) scale(1.15) translate(-540 -960)">
            <g opacity={1 - lw}><Brand clock={t} spot={{ ...SPOT, r: SPOT.r }} /></g>
            {lw > 0 && <g opacity={lw}><Brand clock={0} spot={{ ...SPOT, r: SPOT.r }} /></g>}
          </g>
          <IsoFarHills {...FAR.hills} />
          {FAR.clouds03.map((c, i) => <IsoCloud key={i} u={c.u} o={c.o} cx={0} cy={0} cz={0} grow={c.grow} haze={0.55} phase={phase + i * 0.3} />)}
        </g>

        <g transform={layerTransform(oc, 1)}>
          {/* the sun, far up on the right, small and out of the top text's band */}
          <g transform={`translate(${SUN_AT[0]} ${SUN_AT[1]}) scale(${sunBright}) translate(${-SUN_AT[0]} ${-SUN_AT[1]})`}><IsoSun cx={SUN_AT[0]} cy={SUN_AT[1]} r={78} phase={t * 0.4} /></g>

          {/* the ground sinks as the aircraft climbs: sea, land, hills, fields */}
          <g transform={`translate(0 ${drop})`}>
            <IsoSea {...stage} wide phase={phase} />
            <IsoLand {...stage} wide wet={1} />
            <IsoHill {...stage} />
            <IsoHills {...stage} />
            <IsoFields {...stage} wet={1} />
            <IsoPuddles {...stage} wet={1} />
          </g>

          {/* the hero: the rainbow ring, clipped by the horizon (the ground hides its lower half) */}
          <Rainbow t={t} drop={drop} ghost={st.ghost} id="rb" pulse={pulse} />

          <g transform={`translate(0 ${drop})`}>
            <IsoTreeShadows {...stage} list={ALL_TREES} />
            <IsoBushes {...stage} bushes={ALL_BUSHES} />
            <IsoRocks {...stage} list={ALL_ROCKS} />
            <IsoTrees {...stage} list={ALL_TREES} time={t} swayAmp={1 - lw} />
          </g>

          {/* the rain and the cloud (alive: the cloud drifts and bobs a little all the time) */}
          <IsoRain {...stage} k={st.rain} phase={rainPhase} />
          <g transform={`translate(${driftPx(t) * (1 - lw)} ${bobPx(t, 0, 5) * (1 - lw)})`}><IsoCloud {...stage} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} grow={1.05} phase={phase} /></g>

          {/* the light: dashed rays from the sun into the drops, a glint in each drop */}
          {dropPts.map((d, i) => <g key={i}><Ray a={SUN_AT} b={d} t={t} k={rayK(i)} />{rayK(i) > 0.95 && <IsoDrop cx={d[0]} cy={d[1]} r={11 + 3 * Math.sin(t * 6 + i)} />}</g>)}

          {/* the marker opposite the sun: the ring's centre (the antisolar point) with a dashed line from the sun, and the 42 degree radius */}
          {st.centre > 0.01 && <g opacity={st.centre}>
            <line x1={SUN_AT[0]} y1={SUN_AT[1]} x2={centreScreen[0]} y2={centreScreen[1]} stroke={YELLOW_D} strokeWidth={7} strokeLinecap="round" strokeDasharray="22 20" strokeDashoffset={-((t * 60) % 42)} />
            <circle cx={centreScreen[0]} cy={centreScreen[1]} r={20 + 5 * pulse} fill={BLACK} opacity={0.9} />
            <line x1={centreScreen[0]} y1={centreScreen[1]} x2={ringPoint(RING.r - RING.band * 3.5, 0.9)[0]} y2={ringPoint(RING.r - RING.band * 3.5, 0.9)[1]} stroke={BLACK} strokeWidth={7} strokeLinecap="round" />
          </g>}

          {/* the aircraft over the ring's centre and its shadow at the centre */}
          {st.plane > 0.01 && (() => {
            const px = centreScreen[0] + 150, py = centreScreen[1] - 170 + bobPx(t, 0.2, 8), s = Math.max(0, springAt(t, m.plane));
            return <g>
              <ellipse cx={centreScreen[0]} cy={centreScreen[1]} rx={46 * s} ry={20 * s} fill={G2} opacity={0.55 * st.plane} />
              <g opacity={st.plane} transform={`translate(${px} ${py}) scale(${s}) translate(${-px} ${-py})`}><IsoPlane x={px} y={py} w={150} phase={t} /></g>
            </g>;
          })()}

          {/* the FAKTA stamp inside the ring */}
          <Stamp text="FAKTA" x={world(stampAt)[0]} y={world(stampAt)[1] - 330} fs={64} p={st.stamp * springAt(t, m.verdict, false)} />
        </g>

        {/* near (B27.2): loose dust that touches nothing */}
        <g transform={layerTransform(oc, 1.35)}><Motes t={t} n={10} opacity={0.2} /></g>

        {/* labels */}
        {lab("TETES AIR", 1, 330, 1010, dropPts[3][0], dropPts[3][1], m.lDrop, m.lDrop + 3.2)}
        {lab("SINAR MATAHARI", 2, 620, 700, (SUN_AT[0] + dropPts[1][0]) / 2, (SUN_AT[1] + dropPts[1][1]) / 2, m.lSun, m.lSun + 3.8)}
        {lab("LAWAN MATAHARI", 1, 540, 1180, centreScreen[0], centreScreen[1], m.lOpp, m.lOpp + 4.6)}
        {lab("SUDUT 42°", 2, 780, 760, ringPoint(RING.r - 0.35, 0.9)[0], ringPoint(RING.r - 0.35, 0.9)[1], m.l42, m.l42 + 3.6)}
        {lab("CAKRAWALA", 1, 800, 1250, ringPoint(RING.r - 0.05, 0)[0], ringPoint(RING.r - 0.05, 0)[1], m.lGround, m.lGround + 3.6)}
        {lab("BAGIAN TERTUTUP", 2, 340, 1440, hiddenPt[0], hiddenPt[1], m.lHidden, m.lHidden + 3.2)}
        {lab("BAYANGAN PESAWAT", 1, 700, 1060, centreScreen[0], centreScreen[1], m.lShadow, m.lShadow + 4)}
        {lab("LINGKARAN PENUH", 2, 340, 1340, hiddenPt[0], hiddenPt[1], m.lCircle, m.lCircle + 3)}

        {/* tips (over the set, which the camera dropped to leave room) */}
        {[0, 1].map((i) => <TipCard key={i} x={TIP.x} y={tipY[i]} w={TIP.w} n={i + 1} title={tipTitle[i]} sub={tipSub[i]} t={t} start={tipAt[i]} end={m.outro - 0.4} />)}

        {/* the mascot: the small "Intip yuk!" sting (no veil: the world keeps moving behind it) */}
        {t >= m.sting - 0.1 && t < m.stingEnd + 0.15 && (() => {
          const p = springAt(t, m.sting), out2 = 1 - easeInOut(clamp01((t - m.stingEnd + 0.18) / 0.25)), px = 540, py = 1489, pw = 360;
          return <g>
            <g transform={`translate(540 720) scale(${Math.max(0, p) * out2}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t - m.sting} clock={t} squash={0.18 * (1 - p)} /></g>
            <g transform={`translate(${px} ${py}) scale(${Math.max(0, springAt(t, m.sting + 0.25)) * out2}) translate(${-px} ${-py})`}>
              <rect x={px - pw / 2} y={py - 46} width={pw} height={92} rx={46} fill={YELLOW} />
              <text x={px} y={py + 18} fontSize={52} textAnchor="middle" fill={BLACK} style={bold}>Intip yuk!</text>
            </g>
          </g>;
        })()}

        {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={t - top.a} />}
        {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={bt} />}
      </svg>
      {layoutDebug && <LayoutDebug report={{ moved: new Map(), problems: [], boxes: [] }} hasBanner={!!top} />}
    </div>
  );
};

function world(p: readonly [number, number]): [number, number] { return [p[0], p[1]]; }
