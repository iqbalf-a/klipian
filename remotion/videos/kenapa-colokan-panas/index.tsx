/* Kenapa colokan bisa panas? — pilot 1 of klipian intip, in the 2.5D isometric style (DESIGN.md, "2.5D isometrik"). One continuous take: the camera pushes
   in on a socket in a chunk of wall, a magnifier comes over the plug, the camera goes through it into the dark lab where the contact is cut open (the
   spring leaves on the pin, tight, then loose, the contact heating, the current as yellow dashes), a macro on the contact point, back out to the scorched
   socket, and the tips on the same socket. Everything that happens and every word come from the checked story through plan.ts. */
import React from "react";
import { useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import {
  BLACK, Brand, CaptionLayer, FPS, FRAME, Lab, LayoutDebug, Mascot, Onomatopoeia, SourceCard, TopText, WALL, WHITE, YELLOW, YELLOW_D, easeInOut, springAt, useFonts, wrap,
  type StoryT,
} from "../../src/design/index.ts";
import { HeatRise, IsoCutaway, IsoPlug, IsoWallSocket, Motes, SmokePuffs, Sparks } from "../../src/components/Iso.tsx";
import { LoopArrows, MacroFrame, NumberLabel, SourceChip, TipCard, monoWidth, tipCardHeight } from "../../src/components/Overlays.tsx";
import { isoAt, layerTransform, toScreen } from "../../src/iso.ts";
import { textWidthEstimate } from "../../src/layout.ts";
import { CABLE_TO, LAB, OUT, SOCKET_PTS, contactAt, makePlan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const W = FRAME.width, H = FRAME.height;
const CARD_W = 850;
export const cardHeight = (quote: string): number => 150 + wrap(`“${quote}”`, 38, CARD_W - 80).length * 38 * 1.28;   // a quote is at most two lines (plan.ts quoteFor)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const fade = (t: number, a: number, b: number, d = 0.3) => clamp01((t - a) / d) * (1 - clamp01((t - b) / d));

/** The lens ring over the lab circle (a black ring, the dark-yellow handle, the DIPERBESAR tag while it is small). */
const LensRing: React.FC<{ x: number; y: number; r: number; t: number; tagFrom: number }> = ({ x, y, r, t, tagFrom }) => {
  if (r > 1300) return null;
  const ring = Math.max(10, 18 - r / 120), h = r * 0.72, small = clamp01(1 - (r - 200) / 120);
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={BLACK} strokeWidth={ring} />
      <line x1={x + h} y1={y + h} x2={x + h + r * 0.42} y2={y + h + r * 0.42} stroke={YELLOW_D} strokeWidth={ring * 1.6} strokeLinecap="round" />
      {small > 0 && <g transform={`translate(${x + r * 0.45} ${y - r - 34})`} opacity={small * clamp01((t - tagFrom - 0.25) / 0.25)}>
        <rect x={0} y={-24} width={monoWidth("DIPERBESAR", 26, 2) + 34} height={48} rx={10} fill={YELLOW} />
        <text x={17} y={9} fontSize={26} fill={BLACK} letterSpacing={2} style={{ fontFamily: '"DM Mono", monospace' }}>DIPERBESAR</text>
      </g>}
    </g>
  );
};

/** Motion blur only on the two fast moves (step 6): the dolly through the lens (9.05 s to the lab) and the exit back out of it (28.2 s, 0.9 s).
    The blur costs render time, so it is off everywhere else. The picture reads its own frame (CameraMotionBlur samples it inside the picture). */
const Blur: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) =>
  on ? <CameraMotionBlur shutterAngle={180} samples={5}>{children}</CameraMotionBlur> : <>{children}</>;

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => {
  const t = useCurrentFrame() / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const fast = (t >= P.m.through && t < P.m.inside + 0.05) || (t >= P.m.exit && t < P.m.exit + 0.9);
  return <Blur on={fast}><Picture story={s} layoutDebug={layoutDebug} /></Blur>;
};

const Picture: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => {
  useFonts();
  const frame = useCurrentFrame(), t = frame / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const { m } = P;
  const st = P.state(t), oc = P.outCam(t), lc = P.labCam(t), L = P.lens(t);
  const clipId = "colokan-lens";
  const outPt = (p: readonly [number, number, number]) => isoAt(p, OUT.u, OUT.o);
  const labPt = (p: readonly [number, number, number]) => isoAt(p, LAB.u, LAB.o);
  const inLab = t >= m.inside && t < m.exit;
  const dark = (t >= m.through + 0.55 && t < m.exit + 0.45);
  const top = P.tops.find((x) => t >= x.a && t < x.b);
  const beat = s.beats.find((b) => t >= P.beat(b.id).a && t < P.beat(b.id).b) ?? s.beats[s.beats.length - 1];
  const bt = t - P.beat(beat.id).a;
  const outroFade = 1 - clamp01((t - m.outro + 0.05) / 0.45);
  const contactScreen = toScreen(lc, labPt(contactAt(st.loose)));
  const plugTop = outPt([SOCKET_PTS.plugTop[0], SOCKET_PTS.plugTop[1] + st.gap, SOCKET_PTS.plugTop[2]]);

  const labelEls = (world: "out" | "lab") => P.labels.filter((l) => l.world === world && t >= l.from - 0.05 && t < l.to + 0.4).map((l) => {
    const a = P.labelAt(l, t);
    return <NumberLabel key={l.id} text={l.text} n={l.n} red={l.red} ring={l.ring} onDark={world === "lab"} x={a.x} y={a.y} ax={a.ax} ay={a.ay} fs={P.LABEL_FS} t={t} start={l.from} end={l.to} />;
  });

  const tipH = (i: number) => tipCardHeight(P.tips[i].title, P.tips[i].sub, P.TIP.w, P.tips[i].chip ? `SUMBER  ${P.tips[i].chip}` : undefined);
  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs>{L && L.r < 2300 && <clipPath id={clipId}><circle cx={L.x} cy={L.y} r={Math.max(0.1, L.r)} /></clipPath>}</defs>
      <rect width={W} height={H} fill={WALL} />

      {/* ---------------- outside: the brand wall (far layer), the socket in its chunk of wall, heat and smoke, labels */}
      {P.outsideVisible(t) && <g>
        <g transform={layerTransform(oc, 0.3)}><g transform="translate(540 960) scale(1.15) translate(-540 -960)"><Brand clock={t} spot={{ x: 540, y: 900, r: 560 }} /></g></g>
        <g opacity={outroFade} transform={layerTransform(oc, 1)}>
          <IsoWallSocket u={OUT.u} o={OUT.o} scorch={st.scorch} heat={st.outHeat * (1 - st.gap / 1.6)} t={t} />
          <IsoPlug u={OUT.u} o={OUT.o} gap={st.gap} wobble={st.wobble} heat={st.outHeat} cableTo={CABLE_TO} />
          <HeatRise x={plugTop[0]} y={plugTop[1] - 10} k={st.outHeat * (1 - st.gap / 1.6) * (t < m.tips + 1.5 ? 1 : 0.4)} t={t} scale={0.8} />
          <SmokePuffs x={plugTop[0] + 20} y={plugTop[1] - 30} k={st.smoke} t={t} scale={0.75} />
          {st.fresh > 0 && st.fresh < 1 && (() => { const c = outPt(SOCKET_PTS.center); return <circle cx={c[0]} cy={c[1]} r={60 + 260 * st.fresh} fill="none" stroke={YELLOW} strokeWidth={14 * (1 - st.fresh)} />; })()}
          {st.fresh > 0 && (() => { const c = outPt(SOCKET_PTS.center); return <circle cx={c[0]} cy={c[1]} r={150} fill="none" stroke={YELLOW} strokeWidth={20 * st.fresh} />; })()}
        </g>
        {oc.zoom < 2.2 && <g transform={layerTransform(oc, 1.35)}><Motes t={t} color={WHITE} opacity={0.5} /></g>}
        {labelEls("out")}
        {P.cards.filter((c) => c.from > m.exit).map((c) => <g key={c.claim} opacity={1 - clamp01((t - c.to) / 0.3)}>{t >= c.from && t < c.to + 0.3 && <SourceCard x={90} y={1405 - cardHeight(c.quote)} w={CARD_W} quote={c.quote} org={c.org} domain={c.domain} date={c.date} t={t} start={c.from} />}</g>)}
        {P.tips.map((tp, i) => <TipCard key={i} x={P.TIP.x} y={P.TIP.y} w={P.TIP.w} n={tp.n} title={tp.title} sub={tp.sub} chip={tp.chip ? `SUMBER  ${tp.chip}` : undefined} keyword={tp.keyword} t={t} start={tp.from} subAt={tp.subAt} end={tp.to} />)}
        {t >= m.unplug && t < m.unplug + 1.4 && <Onomatopoeia text="PLOK!" x={Math.min(820, plugTop[0] + 300)} y={Math.max(780, plugTop[1] - 40)} fs={88} rot={-10} t={t} start={m.unplug + 0.12} />}
      </g>}

      {/* ---------------- inside the lens: the lab (far layer), the contact cutaway, sparks, labels, the macro frame, the loop, the card */}
      {L && <g clipPath={L.r < 2300 ? `url(#${clipId})` : undefined}>
        <g transform={layerTransform(lc, 0.3)}><g transform="translate(540 960) scale(1.4) translate(-540 -960)"><Lab clock={t} /></g></g>
        <g transform={layerTransform(lc, 1)}>
          <IsoCutaway u={LAB.u} o={LAB.o} loose={st.loose} heat={st.labHeat} current={st.current} t={t} />
        </g>
        {(() => { const p = toScreen(lc, labPt(contactAt(st.loose))); return <Sparks x={p[0]} y={p[1]} k={st.labHeat} t={t} scale={Math.min(2, lc.zoom)} />; })()}
        <g transform={layerTransform(lc, 1.4)}><Motes t={t} opacity={0.12} n={14} /></g>
        {inLab && labelEls("lab")}
        {inLab && <MacroFrame box={{ x0: contactScreen[0] - 330, y0: contactScreen[1] - 300, x1: contactScreen[0] + 330, y1: contactScreen[1] + 300 }} t={t} start={m.contactLabel - 0.5} end={P.beat("kendur").a + 1.2} />}
        {inLab && P.loopWords[0] && P.loopWords[1] && <LoopArrows cx={contactScreen[0]} cy={contactScreen[1]} r={250} a={P.loopWords[0].toLowerCase()} b={P.loopWords[1].toLowerCase()} t={t} start={m.loop} end={m.exit - 0.35} />}
        {inLab && P.cards.filter((c) => c.from < m.exit).map((c) => <g key={c.claim} opacity={1 - clamp01((t - c.to) / 0.3)}>{t >= c.from && t < c.to + 0.3 && <SourceCard x={90} y={1405 - cardHeight(c.quote)} w={CARD_W} quote={c.quote} org={c.org} domain={c.domain} date={c.date} t={t} start={c.from} />}</g>)}
        {inLab && P.chips.map((c) => <SourceChip key={c.id} x={90} y={1385} text={c.text} t={t} start={c.from} end={c.to} onDark />)}
      </g>}
      {L && t < m.inside + 0.1 && <LensRing x={L.x} y={L.y} r={L.r} t={t} tagFrom={m.magnifier} />}
      {L && t >= m.exit && <circle cx={L.x} cy={L.y} r={Math.max(0.1, L.r)} fill="none" stroke={BLACK} strokeWidth={14} />}

      {/* ---------------- the mascot: the "Intip yuk!" sting, one short reaction, the outro */}
      {t >= m.sting - 0.1 && t < m.stingEnd + 0.15 && (() => {
        const veil = fade(t, m.sting - 0.1, m.stingEnd - 0.15, 0.15), p = springAt(t, m.sting), out2 = 1 - easeInOut(clamp01((t - m.stingEnd + 0.18) / 0.25));
        return <g>
          <rect width={W} height={H} fill={WALL} opacity={0.82 * veil} />
          <g transform={`translate(540 860) scale(${Math.max(0, p) * out2}) translate(-540 -860)`}><Mascot x={540} y={860} w={600} expr="curious" t={t - m.sting} clock={t} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1330) scale(${Math.max(0, springAt(t, m.sting + 0.25)) * out2}) translate(-540 -1330)`}>
            <rect x={540 - (textWidthEstimate(P.stingPill, 96) + 116) / 2} y={1330 - 75} width={textWidthEstimate(P.stingPill, 96) + 116} height={150} rx={75} fill={YELLOW} />
            <text x={540} y={1330 + 34} fontSize={96} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>{P.stingPill}</text>
          </g>
        </g>;
      })()}
      {t >= m.react && t < m.react + 1.25 && (() => {
        const p = springAt(t, m.react) * (1 - easeInOut(clamp01((t - m.react - 0.95) / 0.25)));
        return <g transform={`translate(840 1240) scale(${Math.max(0, p)}) translate(-840 -1240)`}><Mascot x={840} y={1240} w={230} expr="surprised" t={t - m.react} clock={t} /></g>;
      })()}
      {t >= m.outro && (() => {
        const p = springAt(t, m.outro + 0.15), q = springAt(t, m.outro + 0.6, true), r = springAt(t, m.outro + 1.1);
        return <g transform={`translate(540 960) scale(${1 + 0.035 * Math.max(0, t - m.outro - 0.8)}) translate(-540 -960)`}>
          <g transform={`translate(540 820) scale(${Math.max(0, p)}) translate(-540 -820)`}><Mascot x={540} y={820} w={620} expr="understand" sparks t={t - m.outro} clock={t} look={{ x: 540, y: 1470, mix: clamp01((t - m.outro - 1.6) / 0.4) }} /></g>
          <text x={540} y={1300} fontSize={112} textAnchor="middle" fill={BLACK} opacity={q} transform={`translate(0 ${(1 - q) * 30})`} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>{P.outroLabel}</text>
          {P.outroPill && <g transform={`translate(540 1470) scale(${Math.max(0, r)}) translate(-540 -1470)`}>
            <rect x={540 - (textWidthEstimate(P.outroPill, 64) + 80) / 2} y={1470 - 50} width={textWidthEstimate(P.outroPill, 64) + 80} height={100} rx={50} fill={YELLOW} />
            <text x={540} y={1470 + 23} fontSize={64} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>{P.outroPill}</text>
          </g>}
        </g>;
      })()}

      {/* ---------------- the two text layers (in the lab a dark band behind the top text keeps white words readable over light parts) */}
      {dark && <><defs><linearGradient id="colokan-scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(52,52,54)" stopOpacity={0.92} /><stop offset="72%" stopColor="rgb(52,52,54)" stopOpacity={0.8} /><stop offset="100%" stopColor="rgb(52,52,54)" stopOpacity={0} /></linearGradient></defs>
        <rect width={W} height={400} fill="url(#colokan-scrim)" opacity={clamp01((t - m.through - 0.55) / 0.3) * (1 - clamp01((t - m.exit) / 0.45))} /></>}
      {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={t - top.a} onDark={dark} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={bt} />}
    </svg>
    {layoutDebug && <LayoutDebug report={{ moved: new Map(), problems: P.problemsAt(t, cardHeight, tipH), boxes: P.specsAt(t, cardHeight, tipH) }} hasBanner={!!top} />}
    </div>
  );
};
