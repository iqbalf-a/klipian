/* Magnet menempel di kulkas tanpa lem — a custom video (videos/magnet-menempel-di-kulkas-tanp/). READ remotion/DESIGN.md FIRST.
   One set (B27), drawn in the iso kit (src/iso.ts blocks, IsoBlock, OnPlane, IsoCup): a kitchen wall with a window, a fridge whose door holds a note under a magnet (the hero),
   a counter with a cup, a steel tin and an aluminium pot. The hook opens on the wide shot, the camera pushes to the fridge, then each explain beat is a push or a pan inside the
   same set (plan.ts); the domain beats and the ferrite beat open a magnified cut of the material in a panel over the set (arrows are the domains, they turn to face the magnet).
   The loose magnet drops off the aluminium pot, a second one holds on the steel tin. The outro eases back to the wide shot. Every word comes from the checked story.
   Colours are tokens (ISO tone sets), shapes are flat three-tone iso blocks. */
import React from "react";
import {
  BLACK, Badge, Brand, CaptionLayer, G2, G4, ISO, IsoBlock, IsoCup, Label, MacroFrame, Mascot, Motes, OnPlane, Pill, SourceCard, SourceChip, StoryVideo, TopText, WALL, WHITE, YELLOW_D,
  easeInOut, iso, isoAt, layerTransform, riseAt, springAt, toScreen, wrap,
  type Cam2, type P2, type P3, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { MAG, MAGNET_AT, POT_FACE, SET, TIN_FACE, U, O, at, makePlan, type Plan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const wob = (clock: number, period: number, phase = 0) => Math.sin(TAU * (clock / period + phase));           // the periods divide 60 s: the loop-back matches
const FACE = SET.fridge.b[1];                                                                                   // the fridge door plane y

// ------------------------------------------------------------------------------------------------------ small pieces of the set
type Box = { a: readonly [number, number, number]; b: readonly [number, number, number] };
const Blk: React.FC<{ box: Box; tones: readonly [string, string, string]; u?: number; o?: P2 }> = ({ box, tones, u = U, o = O }) => <IsoBlock a={box.a as unknown as P3} b={box.b as unknown as P3} u={u} o={o} tones={tones as unknown as readonly [string, string, string]} />;

/** A magnet block (a dark body and a light strip on its face), centre c, drawn at scale k (0 = gone) about its centre. */
const Magnet: React.FC<{ c: P3; k: number; u?: number; o?: P2 }> = ({ c, k, u = U, o = O }) => {
  if (k <= 0.001) return null;
  const hw = (MAG.w / 2) * k, hd = (MAG.d / 2) * k, hh = (MAG.h / 2) * k;
  const a: P3 = [c[0] - hw, c[1] - hd, c[2] - hh], b: P3 = [c[0] + hw, c[1] + hd, c[2] + hh];
  return (
    <g>
      <IsoBlock a={a} b={b} u={u} o={o} tones={ISO.dark} />
      <OnPlane y={b[1]} u={u} o={o}>        <rect x={a[0] + hw * 0.2} y={a[2] + hh * 0.15} width={hw * 1.6} height={hh * 0.7} rx={hw * 0.12} fill={ISO.metal[0]} />
      </OnPlane>
    </g>
  );
};

/** The window in the wall (the plane y = 0): a frame, two panes and a sill; the glass is pale, never a meaning colour. */
const Window: React.FC<{ clock: number }> = ({ clock }) => {
  const w = SET.window, mx = (w.x0 + w.x1) / 2;
  return (
    <g>
      <OnPlane y={0} u={U} o={O}>
        <rect x={w.x0 - 0.12} y={w.z0 - 0.12} width={w.x1 - w.x0 + 0.24} height={w.z1 - w.z0 + 0.24} fill={ISO.plastic[0]} />
        <rect x={w.x0} y={w.z0} width={mx - w.x0 - 0.04} height={w.z1 - w.z0} fill={ISO.cloudWhite[1]} />
        <rect x={mx + 0.04} y={w.z0} width={w.x1 - mx - 0.04} height={w.z1 - w.z0} fill={ISO.cloudWhite[1]} />
        <polygon points={`${w.x0},${w.z0 + 0.5} ${w.x0 + 0.9},${w.z0 + 0.5} ${w.x0},${w.z0 + 1.4}`} fill={WHITE} opacity={0.55 + 0.1 * wob(clock, 6)} />
      </OnPlane>
      <Blk box={{ a: [w.x0 - 0.25, 0, w.z0 - 0.2], b: [w.x1 + 0.25, 0.3, w.z0 - 0.1] }} tones={ISO.plastic} />
    </g>
  );
};

/** The fridge: a white block against the wall, a seam between freezer and fridge doors, two handles. */
const Fridge: React.FC = () => {
  const f = SET.fridge;
  return (
    <g>
      <Blk box={f} tones={ISO.plastic} />
      <OnPlane y={FACE} u={U} o={O}>
        <rect x={f.a[0]} y={2.46} width={f.b[0] - f.a[0]} height={0.05} fill={ISO.plastic[2]} />
        <rect x={f.a[0]} y={0} width={f.b[0] - f.a[0]} height={0.07} fill={ISO.plastic[2]} />
      </OnPlane>
      <Blk box={{ a: [1.18, FACE, 1.0], b: [1.26, FACE + 0.1, 2.3] }} tones={ISO.metal} />
      <Blk box={{ a: [1.18, FACE, 2.6], b: [1.26, FACE + 0.1, 2.9] }} tones={ISO.metal} />
    </g>
  );
};

/** The domain arrow: pointing along +x of the plane at angle ang (degrees, anticlockwise on the plane, 90 = up), length L, centred at (cx, cz). */
const Arrow2: React.FC<{ cx: number; cz: number; L: number; ang: number; fill?: string }> = ({ cx, cz, L, ang, fill = BLACK }) => {
  const s = L / 2, h = 0.28 * L;
  return <polygon transform={`translate(${cx} ${cz}) rotate(${ang})`} points={`${-s},${-0.05} ${s - h},${-0.05} ${s - h},${-0.15} ${s},0 ${s - h},${0.15} ${s - h},${0.05} ${-s},${0.05}`} fill={fill} />;
};

// ------------------------------------------------------------------------------------------------------ the magnified panels (screen space, over the set)
const PU = 80;                                                         // the panels' scale: px a unit
const ANG0 = Array.from({ length: 15 }, (_, i) => (i * 137 + 20) % 360);
const ease2 = (x: number) => easeInOut(clamp01(x));

type PanelProps = { kind: "domain" | "ferit"; clock: number; a: number; b: number; P: Plan };
const Panel: React.FC<PanelProps> = ({ kind, clock, a, b, P }) => {
  if (clock < a - 0.01 || clock > b + 0.4) return null;
  const R = P.PANEL, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, pop = springAt(clock, a) * (1 - ease2((clock - b) / 0.35));
  const k = P.m;
  const isD = kind === "domain";
  // the slab, and the screen point of the panel's middle (the point (3, 0.5, 2.4) of the slab frame lies on it)
  const mid = iso([3, 0.5, isD ? 2.4 : 1.2], PU), o: P2 = [cx - mid[0], cy - mid[1] + (isD ? -50 : -20)];
  const magZ = isD ? 7.6 - 3.0 * ease2((clock - k.magIn) / 1.3) : 9;
  const pulled = isD ? -7 * ease2((clock - k.alignFrom - 1) / 1.2) : 0;
  const sway = isD ? 0 : 5 * wob(clock, 5);
  const slab: Box = isD ? { a: [0, 0, 0], b: [6, 1, 3.2] } : { a: [0, 0, 0], b: [6, 0.6, 2.4] };
  const face = slab.b[1];
  const cells: React.ReactElement[] = [];
  if (isD) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const i = r * 5 + c, w = 6 / 5, h = 3.2 / 3, x0 = c * w, z0 = r * h;
      const e = ease2((clock - (k.alignFrom + 0.16 * i)) / 0.5), ang = ANG0[i] * (1 - e) + 90 * e + 16 * (1 - e) * wob(clock, 3, i * 0.37);
      cells.push(<g key={i}><rect x={x0 + 0.05} y={z0 + 0.05} width={w - 0.1} height={h - 0.1} rx={0.1} fill={ISO.metal[0]} /><Arrow2 cx={x0 + w / 2} cz={z0 + h / 2} L={0.78} ang={ang} /></g>);
    }
  } else {
    for (let i = 0; i < 64; i++) {
      const x = 0.25 + ((i * 0.6180339) % 1) * 5.5, z = 0.2 + ((i * 0.4142135 + 0.13) % 1) * 2.0, s = 0.07 + 0.08 * ((i * 0.7548776) % 1);
      cells.push(<rect key={i} x={x - s} y={z - s} width={s * 2} height={s * 2} rx={s * 0.3} fill={ISO.dark[1]} opacity={0.75 + 0.25 * wob(clock, 4, i * 0.13)} />);
    }
  }
  return (
    <g transform={`translate(${cx} ${cy}) scale(${Math.max(0, pop)}) translate(${-cx} ${-cy})`}>
      <defs><clipPath id={`panel-${kind}`}><rect x={R.x0} y={R.y0} width={R.x1 - R.x0} height={R.y1 - R.y0} rx={44} /></clipPath></defs>
      <rect x={R.x0 - 6} y={R.y0 - 6} width={R.x1 - R.x0 + 12} height={R.y1 - R.y0 + 12} rx={50} fill={BLACK} />
      <g clipPath={`url(#panel-${kind})`}>
        <rect x={R.x0} y={R.y0} width={R.x1 - R.x0} height={R.y1 - R.y0} fill={ISO.cloudWhite[0]} />
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={R.x0} y1={R.y0 + 90 * i + ((clock * 8) % 90)} x2={R.x1} y2={R.y0 + 90 * i + ((clock * 8) % 90)} stroke={G4} strokeWidth={3} opacity={0.5} />)}
        <g transform={`translate(0 ${pulled + sway})`}>
          <IsoBlock a={slab.a as unknown as P3} b={slab.b as unknown as P3} u={PU} o={o} tones={isD ? ISO.metal : ISO.plastic} />
          <OnPlane y={face} u={PU} o={o}>{cells}</OnPlane>
        </g>
        {isD && k.magIn - 0.05 < clock && <g transform={`translate(0 ${3 * wob(clock, 3) * clamp01((clock - k.magIn - 1.3) / 0.5)})`}>
          <IsoBlock a={[1.8, 0.1, magZ - 0.45]} b={[3, 0.9, magZ + 0.45]} u={PU} o={o} tones={ISO.dark} />
          <IsoBlock a={[3, 0.1, magZ - 0.45]} b={[4.2, 0.9, magZ + 0.45]} u={PU} o={o} tones={ISO.metal} />
        </g>}
      </g>
      <MacroFrame box={{ x0: R.x0 + 14, y0: R.y0 + 14, x1: R.x1 - 14, y1: R.y1 - 14 }} t={clock} start={a} end={b} onDark={false} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the picture
/** A pointer: the label's text at (lx, ly) and a line to the dot at (ax, ay). */
const Pointer: React.FC<{ text: string; lx: number; ly: number; ax: number; ay: number; fs: number; t: number; start: number; end?: number }> = ({ text, lx, ly, ax, ay, fs, t, start, end }) => {
  const p = clamp01((t - start) / 0.3) * (end === undefined ? 1 : 1 - clamp01((t - end) / 0.3));
  if (p <= 0.001) return null;
  return (
    <g opacity={p}>
      <line x1={lx} y1={ly + fs * 0.7} x2={ax} y2={ay} stroke={BLACK} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
      <circle cx={ax} cy={ay} r={10} fill={BLACK} />
      <Label text={text} x={lx} y={ly} fs={fs} t={t} start={start} />
    </g>
  );
};

/** Pull arrows from the magnet toward the door (the pull that holds it): three black arrows sliding in along y. */
const PullArrows: React.FC<{ clock: number; k: number }> = ({ clock, k }) => {
  if (k <= 0.01) return null;
  return (
    <g opacity={k}>
      {[-0.17, 0, 0.17].map((dx, i) => {
        const ph = riseAt(clock, i / 3, 1.5), y0 = FACE + MAG.d + 0.5 - 0.3 * ph, y1 = y0 - 0.34, x = MAGNET_AT[0] + dx, z = MAGNET_AT[2] + (i === 1 ? -0.5 : -0.38);
        const p0 = at([x, y0, z]), p1 = at([x, y1, z]), hd = at([x, y1 - 0.12, z]), l = at([x - 0.06, y1 + 0.02, z]), r = at([x + 0.06, y1 + 0.02, z]);
        return <g key={i} opacity={Math.sin(Math.PI * ph)}><line x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke={BLACK} strokeWidth={9} strokeLinecap="round" /><polygon points={`${hd[0]},${hd[1]} ${l[0]},${l[1]} ${r[0]},${r[1]}`} fill={BLACK} /></g>;
      })}
    </g>
  );
};

const Scene = ({ beat, t, clock, story: s }: SceneProps) => {
  const P = React.useMemo(() => makePlan(s), [s]);
  const m = P.m, c: Cam2 = P.cam(clock), B = (id: string) => P.beat(id);
  const inBeat = (id: string) => clock >= B(id).a && clock < B(id).b;
  const hookRing = beat.id === "hook" ? clamp01((t - m.ring) / 0.4) * (1 - clamp01((t - 2.7) / 0.3)) : 0;
  const holdRing = clamp01((clock - m.pull) / 0.4) * (1 - clamp01((clock - B("hasil").b + 0.4) / 0.4));
  const ringR = 0.24 + 0.05 * wob(clock, 2);
  const m2 = P.magnet2(clock), m3 = P.magnet3(clock);
  const stingP = beat.kind === "sting" ? springAt(t, 0) * (1 - easeInOut(clamp01((t - 0.8) / 0.2))) : 0;
  const chip = P.chips.find((x) => x.beat === beat.id);
  const cardH = (q: string) => 150 + wrap(`“${q}”`, 38, 830 - 80).length * 38 * 1.28;
  const screen = (p: P3): P2 => toScreen(c, at(p));
  const labels = beat.scene.items.filter((i) => i.type === "label");
  const textBeat = beat.kind !== "sting" && beat.kind !== "outro";
  const pop = (a: number) => Math.max(0, springAt(clock, a));
  const doorA = screen([0.7, FACE, 1.5]), potA = screen([POT_FACE[0], POT_FACE[1], POT_FACE[2] + 0.25]);
  const panelA = { x: 540, y: P.PANEL.y1 - 70 };
  const cellA = isoAt([3.0, 1, 1.6], PU, [(P.PANEL.x0 + P.PANEL.x1) / 2 - iso([3, 0.5, 2.4], PU)[0], (P.PANEL.y0 + P.PANEL.y1) / 2 - iso([3, 0.5, 2.4], PU)[1] - 50]);
  const grainA = isoAt([2.2, 0.6, 1.0], PU, [(P.PANEL.x0 + P.PANEL.x1) / 2 - iso([3, 0.5, 1.2], PU)[0], (P.PANEL.y0 + P.PANEL.y1) / 2 - iso([3, 0.5, 1.2], PU)[1] - 20]);
  const tipA = [screen([TIN_FACE[0], TIN_FACE[1], SET.tin.b[2] + 0.35]), screen([POT_FACE[0], POT_FACE[1], SET.pot.b[2] + 0.35])];
  const tipBadges = beat.scene.items.filter((i) => i.type === "badge");
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <rect width={1080} height={1920} fill={WALL} />
      {/* far: the brand sky shows only above the wall, in the wide shot (the spot sits low, away from the top text) */}
      <Brand clock={0} spot={{ x: 540, y: 1000, r: 300 }} />
      <g transform={layerTransform(c, 1)}>
        <Blk box={SET.wall} tones={ISO.wall} />
        <Blk box={SET.floor} tones={ISO.labPlastic} />
        <Blk box={{ a: [-14, 0, 0], b: [14, 0.1, 0.3] }} tones={ISO.plastic} />
        <Blk box={{ a: [-3.5, 1.8, 0], b: [3.5, 7, 0.04] }} tones={ISO.dark} />
        <Window clock={clock} />
        <Fridge />
        <Blk box={SET.note} tones={ISO.wall} />
        <OnPlane y={SET.note.b[1] + 0.005} u={U} o={O}>{[0.18, 0.38, 0.58].map((z, i) => <rect key={i} x={SET.note.a[0] + 0.1} y={SET.note.a[2] + z} width={i === 2 ? 0.34 : 0.6} height={0.05} rx={0.025} fill={G2} />)}</OnPlane>
        <Magnet c={MAGNET_AT} k={1} />
        {/* the highlight: a ring round the magnet on the door while the story asks "how", and again while the pull is named */}
        {Math.max(hookRing, holdRing) > 0.01 && <OnPlane y={FACE + MAG.d + 0.02} u={U} o={O}><circle cx={MAGNET_AT[0]} cy={MAGNET_AT[2]} r={ringR + 0.1} fill="none" stroke={YELLOW_D} strokeWidth={0.035} opacity={Math.max(hookRing, holdRing)} /></OnPlane>}
        <PullArrows clock={clock} k={inBeat("hasil") ? clamp01((clock - m.pull) / 0.4) * (1 - clamp01((clock - B("hasil").b + 0.5) / 0.4)) : 0} />
        <Blk box={SET.counter} tones={ISO.dark} />
        <Blk box={SET.counterTop} tones={ISO.metal} />
        <IsoCup u={U * 0.22} o={at(SET.cup.at)} t={clock * 0.99} />
        <Blk box={SET.tin} tones={ISO.dark} />
        <Blk box={SET.pot} tones={ISO.metal} />
        <Magnet c={m2.p} k={m2.k} />
        <Magnet c={[TIN_FACE[0], TIN_FACE[1] + MAG.d / 2, TIN_FACE[2]]} k={m3} />
      </g>
      <g transform={layerTransform(c, 1.35)}>{c.zoom < 2.2 && <Motes t={clock} color={WHITE} opacity={0.45} />}</g>

      {/* the pointers of the set (the story's own labels) */}
      {beat.id === "logam" && labels[0] && labels[0].type === "label" && <Pointer text={labels[0].text} lx={300} ly={560} ax={doorA[0]} ay={doorA[1]} fs={50} t={t} start={1.4} end={beat.dur - 0.3} />}
      {beat.id === "alum" && labels[0] && labels[0].type === "label" && <Pointer text={labels[0].text} lx={700} ly={560} ax={potA[0]} ay={potA[1]} fs={50} t={t} start={3.4} end={beat.dur - 0.3} />}

      {/* the magnified panels */}
      <Panel kind="domain" clock={clock} a={m.panel1} b={m.panel1End} P={P} />
      <Panel kind="ferit" clock={clock} a={m.panel2} b={m.panel2End} P={P} />
      {beat.id === "domain" && labels[0] && labels[0].type === "label" && <Pointer text={labels[0].text} lx={panelA.x} ly={panelA.y} ax={cellA[0]} ay={cellA[1]} fs={50} t={t} start={2.0} end={beat.dur - 0.3} />}
      {beat.id === "sejajar" && labels[0] && labels[0].type === "label" && <Pointer text={labels[0].text} lx={panelA.x} ly={panelA.y} ax={cellA[0]} ay={cellA[1]} fs={50} t={t} start={3.2} end={4.9} />}
      {beat.id === "lentur" && labels[0] && labels[0].type === "label" && <Pointer text={labels[0].text} lx={panelA.x} ly={panelA.y} ax={grainA[0]} ay={grainA[1]} fs={50} t={t} start={1.2} end={beat.dur - 0.3} />}

      {/* the claim's source: a card on the domain claim, a chip on the others */}
      {P.cardOf && beat.id === P.cardOf.beat && t >= 5.2 && t < beat.dur - 0.25 && <SourceCard x={90} y={P.cardBottom - cardH(P.cardOf.quote)} w={830} quote={P.cardOf.quote} org={P.cardOf.org} domain={P.cardOf.domain} date={P.cardOf.date} t={t} start={5.2} />}
      {chip && <SourceChip x={90} y={P.cardBottom - 44} text={chip.text} t={t} start={1.2} end={beat.dur - 0.2} />}

      {/* tips: the two badges over the tin (holds) and the pot (does not) */}
      {beat.id === "tips" && tipBadges.map((bd, i) => bd.type === "badge" && (
        <g key={i} transform={`translate(${tipA[i][0]} ${tipA[i][1] - 60}) scale(${pop(i === 0 ? m.mag3In - 0.2 : m.potTry - 0.2)}) translate(${-tipA[i][0]} ${-(tipA[i][1] - 60)})`}><Badge text={bd.text} x={tipA[i][0]} y={tipA[i][1] - 60} r={52} /></g>
      ))}

      {/* the sting: a small mascot and the pill, the world keeps moving behind them */}
      {stingP > 0.001 && (
        <g>
          <g transform={`translate(400 470) scale(${stingP}) translate(-400 -470)`}><Mascot x={400} y={470} w={220} expr="curious" t={t} clock={clock} squash={0.18 * (1 - stingP)} /></g>
          <g transform={`translate(700 470) scale(${stingP}) translate(-700 -470)`}><Pill text="Intip yuk!" x={700} y={470} fs={52} t={t} start={0.2} /></g>
        </g>
      )}
      {textBeat && <TopText key={beat.id} kicker={beat.kicker} headline={beat.headline ?? beat.text} t={t} />}
      {textBeat && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
