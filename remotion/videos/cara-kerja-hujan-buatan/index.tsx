/* Hujan buatan: benarkah hujan bisa dipesan? — a custom video (videos/cara-kerja-hujan-buatan/), in the 2.5D style (DESIGN.md "2.5D isometrik" and
   "Nature kit"). One continuous take on the nature stage (sea, land, a cloud over them): a seeding aircraft sprinkles grains into the cloud and grains rise from the
   ground, the magnifier goes into the cloud (salt draws vapour, silver iodide is an ice-like crystal, the drop grows heavy and falls), back out to the rain, the
   SEBAGIAN stamp, the two tips, and the loop-back. Every word comes from the checked story through plan.ts. */
import React from "react";
import { useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import {
  BLACK, Brand, CaptionLayer, FONT_BOLD, FPS, FRAME, G3, Lab, LayoutDebug, Mascot, TopText, WALL, YELLOW, easeInOut, springAt, useFonts, layerTransform, toScreen,
  type StoryT,
} from "../../src/design/index.ts";
import { IsoBushes, IsoCloud, IsoDrop, IsoHill, IsoLand, IsoPuddles, IsoRain, IsoRocks, IsoRunoff, IsoSea, IsoTreeShadows, IsoTrees } from "../../src/components/IsoNature.tsx";
import { IsoPlane, IsoSeed } from "../../src/components/IsoSeeding.tsx";
import { Magnifier, NumberLabel, SourceChip, TipCard, tipCardHeight } from "../../src/components/Overlays.tsx";
import { CLOUD, CLOUD_PT, OUT, makePlan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const W = FRAME.width, H = FRAME.height;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const SPLASH_AT: [number, number] = [0.55, -0.3];
const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;

/** Motion blur only on the two fast moves: the dive into the cloud and the way out of it (the blur costs render time, so it is off everywhere else). */
const Blur: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) =>
  on ? <CameraMotionBlur shutterAngle={180} samples={5}>{children}</CameraMotionBlur> : <>{children}</>;

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => {
  const t = useCurrentFrame() / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const fast = (t >= P.m.through && t < P.m.inside + 0.05) || (t >= P.m.exit && t < P.m.exitEnd);
  return <Blur on={fast}><Picture story={s} layoutDebug={layoutDebug} /></Blur>;
};

/** A step number (the story's own badge): a yellow disc at the top left of the stage. */
const StepDisc: React.FC<{ n: string; t: number; from: number; to: number }> = ({ n, t, from, to }) => {
  const p = springAt(t, from, false) * (1 - easeInOut(clamp01((t - to) / 0.3)));
  if (p <= 0.001) return null;
  return (
    <g transform={`translate(110 440) scale(${Math.max(0, p)}) translate(-110 -440)`}>
      <circle cx={110} cy={440} r={54} fill={YELLOW} />
      <text x={110} y={440} fontSize={62} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>{n}</text>
    </g>
  );
};

/** A flat pill with a word in it (the question mark of the hook, the SEBAGIAN stamp: grey, B9). */
const Stamp: React.FC<{ text: string; x: number; y: number; fs: number; fill: string; rot?: number; p: number }> = ({ text, x, y, fs, fill, rot = 0, p }) => {
  if (p <= 0.001) return null;
  const w = text.length * fs * 0.62 + fs * 1.3, h = fs * 1.5;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${Math.max(0, p)})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={fill} />
      <text x={0} y={fs * 0.02} fontSize={fs} fill={BLACK} textAnchor="middle" dominantBaseline="central" letterSpacing={2} style={bold}>{text}</text>
    </g>
  );
};

const Picture: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => {
  useFonts();
  const frame = useCurrentFrame(), t = frame / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const { m } = P;
  const st = P.state(t), oc = P.outCam(t), lens = P.lens(t), lw = P.loopWeight(t), ph = P.phase(t);
  const beat = s.beats.find((b) => t >= P.beat(b.id).a && t < P.beat(b.id).b) ?? s.beats[s.beats.length - 1];
  const bt = t - P.beat(beat.id).a;
  const top = P.tops.find((x) => t >= x.a && t < x.b);
  const lensC = toScreen(oc, CLOUD_PT);
  const inLab = P.insideLens(t), outside = P.outsideVisible(t);
  // the top text turns white when the lens circle covers it (its radius, as the Magnifier draws it)
  const lensR = lens.r * (1 + 7 * easeInOut(lens.grow) ** 1.4);
  const dark = lens.show && Math.hypot(540 - lensC[0], 160 - lensC[1]) < lensR - 20;
  const stage = { u: OUT.u, o: OUT.o };
  const planeP = P.planeAt(t), grains = P.grains(t);
  const rainPhase = (t * 1.3) % 1;

  const grainEls = (front: boolean) => grains.filter((g) => g.front === front).map((g, i) => <g key={`${front}${i}`} opacity={g.a}><IsoSeed kind={g.kind} x={g.x} y={g.y} s={g.s} t={t} /></g>);

  // ---------------------------------------------------------------- the lab: the inside of the cloud, seen through the magnifier (screen px)
  const salt = P.saltPos(t), drop = P.dropAt(t);
  const inTumbuh = t >= P.beat("tumbuh").a - 0.3;
  const labScene = (
    <g>
      <Lab clock={t} />
      {/* silver iodide: an ice-like crystal that stays in "inti" and fades away as the drop takes over */}
      {t < P.beat("tumbuh").a + 1.2 && <g opacity={1 - clamp01((t - P.beat("tumbuh").a + 0.2) / 1.2)}><IsoSeed kind="agi" x={P.LAB.agi[0]} y={P.LAB.agi[1] + 6 * Math.sin(t * 3.4)} s={92} t={t} /></g>}
      {/* the drop: a few small drops stick round the salt, then they gather into one that grows heavy and falls */}
      {inTumbuh && drop.r > 0 && <g opacity={clamp01((t - P.beat("tumbuh").a + 0.3) / 0.5)}><IsoDrop cx={drop.cx} cy={drop.cy} r={drop.r} stretch={drop.stretch} /></g>}
      <g transform={`translate(${drop.cx - salt[0]} ${drop.cy - salt[1]}) translate(${salt[0]} ${salt[1]}) scale(${inTumbuh ? 0.62 : 1}) translate(${-salt[0]} ${-salt[1]})`}>
        <IsoSeed kind="salt" x={salt[0]} y={salt[1]} s={64} t={t} />
      </g>
      {Array.from({ length: P.DOTS }, (_, i) => {
        const d = P.dotAt(i, t), e = 1 - Math.pow(1 - d.stuck, 3), merge = inTumbuh ? drop.merge : 0;
        // a stuck dot rides with the salt grain when it moves to the middle, then gathers into the drop
        const x = d.x + (salt[0] - P.LAB.salt[0]) * e, y = d.y + (salt[1] - P.LAB.salt[1]) * e;
        return t >= m.salt - 0.3 && merge < 0.98 ? <g key={i} opacity={clamp01((t - m.salt + 0.3) / 0.4) * (1 - merge)}><IsoDrop cx={x + (drop.cx - x) * merge} cy={y + (drop.cy - y) * merge} r={13} /></g> : null;
      })}
    </g>
  );

  const labelEls = (world: "out" | "lab") => P.labels.filter((l) => l.world === world && t >= l.from - 0.05 && t < l.to + 0.4).map((l) => {
    const a = P.labelAt(l, t);
    return <NumberLabel key={l.id} text={l.text} n={l.n} red={l.red} ring={l.ring} onDark={world === "lab"} x={a.x} y={a.y} ax={a.ax} ay={a.ay} fs={P.LABEL_FS} t={t} start={l.from} end={l.to} />;
  });
  const tipH = (i: number) => tipCardHeight(P.tips[i].title, P.tips[i].sub, P.TIP.w);
  const hookQ = toScreen(oc, [CLOUD_PT[0] + 235, CLOUD_PT[1] - 205]);
  const stampAt = toScreen(oc, [CLOUD_PT[0] + 215, CLOUD_PT[1] - 215]);

  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={WALL} />

        {/* ---------------- outside: the brand wall (far layer), the stage, the aircraft and the grains */}
        {outside && <g>
          <g transform={layerTransform(oc, 0.3)}><g transform="translate(540 960) scale(1.15) translate(-540 -960)">
            <g opacity={1 - lw}><Brand clock={t} spot={{ x: 540, y: 900, r: 560 }} /></g>
            {lw > 0 && <g opacity={lw}><Brand clock={0} spot={{ x: 540, y: 900, r: 560 }} /></g>}
          </g></g>
          <g transform={layerTransform(oc, 1)}>
            {/* the depth order of the nature kit (natureGeometry.ts DEPTH_ORDER): sea, land and its things, the grains behind the cloud, the rain, the cloud, then the aircraft in front */}
            <IsoSea {...stage} phase={ph} splash={st.splash} splashAt={SPLASH_AT} shadow={st.dark} />
            <IsoLand {...stage} wet={st.wet} />
            <IsoHill {...stage} />
            <IsoPuddles {...stage} wet={st.wet} />
            <IsoTreeShadows {...stage} />
            <IsoRunoff {...stage} k={st.rain} />
            <IsoBushes {...stage} />
            <IsoRocks {...stage} />
            <IsoTrees {...stage} />
            {grainEls(false)}
            <IsoRain {...stage} k={st.rain} phase={rainPhase} />
            <IsoCloud {...stage} cx={CLOUD.cx} cy={CLOUD.cy} cz={CLOUD.cz} dark={st.dark} grow={CLOUD.grow} phase={ph} />
            {planeP && <IsoPlane x={planeP.x} y={planeP.y} w={planeP.w} phase={t} />}
            {grainEls(true)}
          </g>
        </g>}

        {/* ---------------- the magnifier over the cloud, and the lab inside it */}
        {lens.show && <Magnifier x={lensC[0]} y={lensC[1]} r={lens.r} t={t} start={m.magnifier} grow={lens.grow} tag={t >= m.exit ? "" : "DIPERBESAR"}>{labScene}</Magnifier>}

        {/* ---------------- stamps, labels, chips, tips */}
        {t < m.sting && <Stamp text="?" x={hookQ[0]} y={hookQ[1]} fs={92} fill={YELLOW} p={springAt(t, m.hookQ, false) * (1 - easeInOut(clamp01((t - (m.sting - 0.3)) / 0.3)))} />}
        {outside && t >= m.verdict && t < P.beat("hasil").b + 0.3 && <Stamp text={P.verdictWord} x={stampAt[0]} y={stampAt[1]} fs={50} fill={G3} rot={-6} p={springAt(t, m.verdict, false) * (1 - easeInOut(clamp01((t - P.beat("hasil").b) / 0.3)))} />}
        {P.steps.map((sd) => sd.n && <StepDisc key={sd.id} n={sd.n} t={t} from={sd.from} to={sd.to} />)}
        {outside && labelEls("out")}
        {inLab && labelEls("lab")}
        {P.chips.map((c) => ((c.onDark ? inLab : outside) && t >= c.from && t < c.to + 0.4) ? <SourceChip key={c.id} x={90} y={P.chipY} text={c.text} t={t} start={c.from} end={c.to} onDark={c.onDark} /> : null)}
        {P.tips.map((tp, i) => <TipCard key={i} x={P.TIP.x} y={P.TIP.y} w={P.TIP.w} n={tp.n} title={tp.title} sub={tp.sub} keyword={tp.keyword} t={t} start={tp.from} subAt={tp.subAt} end={tp.to} />)}

        {/* ---------------- the mascot: the small "Intip yuk!" sting (no veil: the world keeps moving behind it) and one short reaction */}
        {t >= m.sting - 0.1 && t < m.stingEnd + 0.15 && (() => {
          const S = P.STING, p = springAt(t, m.sting), out2 = 1 - easeInOut(clamp01((t - m.stingEnd + 0.18) / 0.25));
          return <g>
            <g transform={`translate(${S.mx} ${S.my}) scale(${Math.max(0, p) * out2}) translate(${-S.mx} ${-S.my})`}><Mascot x={S.mx} y={S.my} w={S.mw} expr="curious" t={t - m.sting} clock={t} squash={0.18 * (1 - p)} /></g>
            <g transform={`translate(${S.px} ${S.py}) scale(${Math.max(0, springAt(t, m.sting + 0.25)) * out2}) translate(${-S.px} ${-S.py})`}>
              <rect x={S.px - S.pillW / 2} y={S.py - 46} width={S.pillW} height={92} rx={46} fill={YELLOW} />
              <text x={S.px} y={S.py + 18} fontSize={S.fs} textAnchor="middle" fill={BLACK} style={bold}>{P.stingPill}</text>
            </g>
          </g>;
        })()}
        {t >= m.react && t < m.react + 1.25 && (() => {
          const p = springAt(t, m.react) * (1 - easeInOut(clamp01((t - m.react - 0.95) / 0.25))), R = P.REACT;
          return <g transform={`translate(${R.x} ${R.y}) scale(${Math.max(0, p)}) translate(${-R.x} ${-R.y})`}><Mascot x={R.x} y={R.y} w={R.w} expr="think" t={t - m.react} clock={t} /></g>;
        })()}

        {/* ---------------- the two text layers */}
        {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={t - top.a} onDark={dark} />}
        {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={bt} />}
      </svg>
      {layoutDebug && <LayoutDebug report={{ moved: new Map(), problems: P.problemsAt(t, tipH), boxes: P.specsAt(t, tipH) }} hasBanner={!!top} />}
    </div>
  );
};
