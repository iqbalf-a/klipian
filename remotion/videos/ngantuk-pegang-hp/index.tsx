/* Kenapa rebahan pegang hp ngantuk, tapi hp ditaruh malah melek? — a custom video (videos/ngantuk-pegang-hp/), in the 2.5D style (DESIGN.md "2.5D isometrik"). One
   continuous take on a bed: a lit phone and a pair of eyes whose lids droop while the phone is in hand and open wide when it is put down, a thought bubble that fills up with
   what the screen brings, the phone sent to another room (tip 1), and the loop-back. Every word comes from the checked story through plan.ts. */
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  BLACK, Brand, CaptionLayer, FONT_BOLD, FPS, FRAME, G2, G3, G4, IsoBrain, IsoClock, IsoHeart, IsoLamp, LayoutDebug, Mascot, RED, TopText, WALL, WHITE, YELLOW, bobPx, easeInOut, iso, layerTransform, riseAt, springAt, toScreen, useFonts,
  type StoryT,
} from "../../src/design/index.ts";
import { IsoBed, IsoPhone, SleepyEyes } from "../../src/components/IsoBedroom.tsx";
import { NumberLabel, SourceChip, TipCard, tipCardHeight } from "../../src/components/Overlays.tsx";
import { PHONE } from "../../src/bedroomGeometry.ts";
import { BUBBLE, EYES, OUT, PHONE_PT, makePlan, type Plan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const W = FRAME.width, H = FRAME.height;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => <Picture story={s} layoutDebug={layoutDebug} />;

/** A step number (the story's own badge): a yellow disc at the left of the eyes. */
const StepDisc: React.FC<{ n: string; x: number; y: number; t: number; from: number; to: number }> = ({ n, x, y, t, from, to }) => {
  const p = springAt(t, from, false) * (1 - easeInOut(clamp01((t - to) / 0.3)));
  if (p <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${Math.max(0, p)}) translate(${-x} ${-y})`}>
      <circle cx={x} cy={y} r={54} fill={YELLOW} />
      <text x={x} y={y} fontSize={62} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>{n}</text>
    </g>
  );
};

/** The question mark of the hook: a yellow pill that pops. */
const Mark: React.FC<{ text: string; x: number; y: number; fs: number; p: number }> = ({ text, x, y, fs, p }) => {
  if (p <= 0.001) return null;
  const w = text.length * fs * 0.62 + fs * 1.3, h = fs * 1.5;
  return (
    <g transform={`translate(${x} ${y}) scale(${Math.max(0, p)})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={YELLOW} />
      <text x={0} y={fs * 0.02} fontSize={fs} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>{text}</text>
    </g>
  );
};

/** The thought bubble (a cluster of white circles) with the lines of what the screen brings; `busy` (0..1) makes the lines jump and the bubble breathe, `notif` pops a red dot. */
const Thought: React.FC<{ k: number; busy: number; t: number; notif: number }> = ({ k, busy, t, notif }) => {
  if (k <= 0.01) return null;
  const { cx, cy, r } = BUBBLE, breathe = 1 + 0.05 * busy * Math.sin(t * 5.2);
  return (
    <g transform={`translate(${cx} ${cy}) scale(${k * breathe}) translate(${-cx} ${-cy})`}>
      <circle cx={cx - 72} cy={cy + 38} r={r * 0.62} fill={WHITE} />
      <circle cx={cx + 66} cy={cy + 46} r={r * 0.54} fill={WHITE} />
      <circle cx={cx} cy={cy} r={r} fill={WHITE} />
      <IsoBrain u={46} o={[cx, cy + 4]} t={t} busy={Math.max(0.15, busy)} />
      {notif > 0.01 && <circle cx={cx + 74} cy={cy - 66} r={18 * notif} fill={RED} />}
    </g>
  );
};

/** A notification that flies in beside the phone: a white card with a coloured dot and two grey lines; it pops in at `from` and bobs a little. */
const Toast: React.FC<{ x: number; y: number; t: number; from: number; dot: number; i: number }> = ({ x, y, t, from, dot, i }) => {
  const p = springAt(t, from, false);
  if (p <= 0.001) return null;
  const dots = [YELLOW, G3, RED];
  return (
    <g transform={`translate(${x} ${y + bobPx(t, i * 0.31, 6)}) scale(${Math.max(0, p)})`}>
      <rect x={-165} y={-50} width={330} height={100} rx={26} fill={WHITE} />
      <circle cx={-118} cy={0} r={26} fill={dots[dot % 3]} />
      <rect x={-72} y={-24} width={190} height={17} rx={8} fill={G2} opacity={0.8} />
      <rect x={-72} y={6} width={130 - 14 * dot} height={15} rx={7} fill={G4} />
    </g>
  );
};

/** What each insert shows: the object, big, alive, at the hero point (the plan's HERO), with the things that make it a story (the notifications, the signals running in, the emotions). */
const InsertObject: React.FC<{ P: Plan; kind: string; t: number; from: number; k: number }> = ({ P, kind, t, from, k }) => {
  const [hx, hy] = P.HERO, bt = t - from, pop = Math.max(0.001, springAt(t, from + 0.22, false)), at = (pt: [number, number, number], u: number): [number, number] => { const c = iso(pt, u); return [hx - c[0], hy - c[1]]; };
  const wrap = (children: React.ReactNode) => <g transform={`translate(${hx} ${hy}) scale(${pop}) translate(${-hx} ${-hy})`}>{children}</g>;
  if (kind === "clock") return wrap(<IsoClock u={265} o={at([0, 0.25, 0.95], 265)} t={t} time={22 * 3600 + 50 * 60} speed={from < 20 ? 240 : 900} ring={0} />);
  if (kind === "phone") {
    const u = 330;
    return <g>{wrap(<IsoPhone u={u} o={at([PHONE.c[0], PHONE.c[1], PHONE.c[2] + PHONE.h], u)} on={1} t={t * 2.2} />)}{P.toasts.map((ts, i) => <Toast key={ts.id} x={ts.x} y={ts.y} t={t} from={ts.from} dot={ts.dot} i={i} />)}</g>;
  }
  if (kind === "brain") {
    const signals = [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2 + 0.6, r0 = 560, q = riseAt(t, i * 0.2, 1.4), r = r0 * (1 - q) + 140 * q, x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r * 0.8;
      return <rect key={i} x={x - 22} y={y - 16} width={44} height={32} rx={9} fill={i % 2 ? WHITE : YELLOW} opacity={Math.sin(Math.PI * q)} transform={`rotate(${bt * 40 + i * 30} ${x} ${y})`} />;
    });
    return <g>{wrap(<IsoBrain u={235} o={[hx, hy]} t={t} busy={1} />)}{signals}</g>;
  }
  if (kind === "heart") {
    const mark = (x: number, y: number, ph: number, text: string, fill: string) => <g transform={`translate(${x} ${y + bobPx(t, ph, 10)})`}><circle r={46} fill={fill} /><text y={2} fontSize={60} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>{text}</text></g>;
    return <g>{wrap(<IsoHeart u={215} o={[hx, hy]} t={t} bpm={100} />)}{springAt(t, from + 0.6) > 0.01 && mark(hx - 300, hy - 150, 0.1, "!", YELLOW)}{springAt(t, from + 0.9) > 0.01 && mark(hx + 300, hy - 60, 0.5, "?", G4)}</g>;
  }
  if (kind === "stare") {
    // wide awake in the dark: big eyes looking up at the ceiling, question marks bobbing around them
    const q = (qx: number, qy: number, ph: number, p: number) => springAt(t, from + p) > 0.01 && <text key={ph} x={qx} y={qy + bobPx(t, ph, 9)} fontSize={74} fill={BLACK} opacity={0.55} textAnchor="middle" style={bold}>?</text>;
    return <g>{wrap(<SleepyEyes cx={hx} cy={hy - 20} w={640} open={1} look={-0.8} brow={1} t={t} />)}{q(hx - 330, hy - 190, 0.1, 0.5)}{q(hx + 340, hy - 120, 0.5, 0.9)}{q(hx - 250, hy + 190, 0.8, 1.3)}</g>;
  }
  if (kind === "held") {
    // the lids try to close and the lit screen pulls them up again: a nod, the beam from the phone below
    const open = 0.52 + 0.2 * Math.sin(bt * 2.1), lit = 0.7 + 0.3 * Math.sin(bt * 3);
    return <g>
      <polygon points={`${hx - 90},${hy + 330} ${hx + 90},${hy + 330} ${hx + 250},${hy + 60} ${hx - 250},${hy + 60}`} fill={WHITE} opacity={0.4 * lit} />
      {wrap(<SleepyEyes cx={hx} cy={hy - 20} w={640} open={open} look={0.5} brow={0.3} t={t} />)}
      <g transform={`translate(${hx} ${hy + 340})`}><rect x={-110} y={-26} width={220} height={52} rx={14} fill={G2} /><rect x={-98} y={-17} width={196} height={34} rx={8} fill={WHITE} opacity={lit} /></g>
    </g>;
  }
  return wrap(<IsoLamp u={235} o={at([0, 0, 1.1], 235)} t={t} on={1} />);                  // lamp
};

/** The insert's circle: it opens from where the story is (the plan's origin) over the stage; inside it is the brand background with a spot behind the object. */
const InsertLayer: React.FC<{ P: Plan; t: number }> = ({ P, t }) => {
  const ins = P.inserts.find((x) => t >= x.from && t < x.to);
  if (!ins) return null;
  const k = P.insertOpen(ins, t);
  if (k <= 0.001) return null;
  const id = `ins-${ins.id}`;
  return (
    <g>
      <defs><clipPath id={id}><circle cx={ins.origin[0]} cy={ins.origin[1]} r={1700 * k} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <rect width={W} height={H} fill={WALL} />
        <Brand clock={t} spot={{ x: P.HERO[0], y: P.HERO[1], r: 470 }} />
        <InsertObject P={P} kind={ins.kind} t={t} from={ins.from} k={k} />
      </g>
    </g>
  );
};

const Picture: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => {
  useFonts();
  const frame = useCurrentFrame(), t = frame / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const { m } = P;
  const st = P.state(t), oc = P.outCam(t), lw = P.loopWeight(t), z = P.zMarks(t);
  const beat = s.beats.find((b) => t >= P.beat(b.id).a && t < P.beat(b.id).b) ?? s.beats[s.beats.length - 1];
  const bt = t - P.beat(beat.id).a;
  const top = P.tops.find((x) => t >= x.a && t < x.b);
  const stage = { u: OUT.u, o: OUT.o };
  const notif = clamp01((t - m.notif) / 0.3) * (t < m.putDown ? 1 : 0);
  const tipH = (i: number) => tipCardHeight(P.tips[i].title, P.tips[i].sub, P.TIP.w);
  const hookQ = toScreen(oc, [BUBBLE.cx, BUBBLE.cy]);
  // the phone's trip to another room (tip 1): it lifts, slides to the right and shrinks away; the loop brings it back
  const away = st.away, phoneTrans = `translate(${PHONE_PT[0] + 360 * away} ${PHONE_PT[1] - 260 * away}) scale(${1 - 0.55 * away}) translate(${-PHONE_PT[0]} ${-PHONE_PT[1]})`;
  const beam = [[PHONE_PT[0] - 40, PHONE_PT[1] - 20], [PHONE_PT[0] + 50, PHONE_PT[1] - 20], [EYES.cx + 170, EYES.cy + 150], [EYES.cx - 170, EYES.cy + 150]];

  const labelEls = P.labels.filter((l) => t >= l.from - 0.05 && t < l.to + 0.4).map((l) => {
    const a = P.labelAt(l, t);
    return <NumberLabel key={l.id} text={l.text} x={a.x} y={a.y} ax={a.ax} ay={a.ay} fs={P.LABEL_FS} t={t} start={l.from} end={l.to} />;
  });

  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={WALL} />

        {/* ---------------- the brand wall (far layer), the bed, the phone and its light, the eyes, the bubble */}
        <g transform={layerTransform(oc, 0.3)}><g transform="translate(540 960) scale(1.15) translate(-540 -960)">
          <g opacity={1 - lw}><Brand clock={t} spot={{ x: 540, y: 900, r: 560 }} /></g>
          {lw > 0 && <g opacity={lw}><Brand clock={0} spot={{ x: 540, y: 900, r: 560 }} /></g>}
        </g></g>
        <g transform={layerTransform(oc, 1)}>
          <IsoBed {...stage} t={t} />
          {st.on * (1 - away) > 0.02 && <polygon points={beam.map((p) => p.join(",")).join(" ")} fill={WHITE} opacity={0.2 * st.on * (1 - away)} />}
          <g transform={phoneTrans}><IsoPhone {...stage} on={st.on} t={t} lift={0.35 * away} /></g>
          <SleepyEyes cx={EYES.cx} cy={EYES.cy} w={EYES.w} open={st.open} look={st.look} brow={st.brow} t={t} />
          {z > 0.02 && [0, 1, 2].map((i) => {
            const k = (((t * 0.4 + i / 3) % 1) + 1) % 1;
            return <text key={i} x={EYES.cx - EYES.w / 2 - 6 - i * 30 - 30 * k} y={EYES.cy - 120 - 90 * k - i * 12} fontSize={50 - i * 8} fill={BLACK} opacity={0.55 * z * Math.min(1, k * 4, (1 - k) * 2.5)} style={bold}>Z</text>;
          })}
          <Thought k={st.bubble} busy={st.busy} t={t} notif={notif} />
        </g>

        {/* ---------------- the insert (B25): one object on its own, in a circle that opens from where the story is */}
        <InsertLayer P={P} t={t} />

        {/* ---------------- the question mark, the step, the labels, the chips, the tips */}
        {t < m.sting && <Mark text="?" x={hookQ[0] + 30} y={hookQ[1] + 10} fs={92} p={springAt(t, m.hookQ, false) * (1 - easeInOut(clamp01((t - (m.sting - 0.3)) / 0.3)))} />}
        {P.steps.map((sd) => sd.n && <StepDisc key={sd.id} n={sd.n} x={P.STEP_AT[0]} y={P.STEP_AT[1]} t={t} from={sd.from} to={sd.to} />)}
        {labelEls}
        {P.chips.map((c) => (t >= c.from && t < c.to + 0.4) ? <SourceChip key={c.id} x={P.CHIP_X} y={P.chipY} text={c.text} t={t} start={c.from} end={c.to} /> : null)}
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
        {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={t - top.a} />}
        {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={bt} />}
      </svg>
      {layoutDebug && <LayoutDebug report={{ moved: new Map(), problems: P.problemsAt(t, tipH), boxes: P.specsAt(t, tipH) }} hasBanner={!!top} />}
    </div>
  );
};
