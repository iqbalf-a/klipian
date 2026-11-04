/* Kenapa jari keriput kalau lama di air? — a custom video (videos/kenapa-jari-keriput-kalau-lama/). READ remotion/DESIGN.md FIRST.
   One set (B27.15, kind "inside-body"): a cut-away slab of soft tissue that bleeds past the frame. The hero is a finger lying on it (a cylinder with a rounded tip, drawn
   from src/iso.ts), in a pool of water. Beside it stands a thin slice of the same finger: the skin, the layer under it, four vessels, the bone. A nerve runs to the slice
   and a heart sits near it. The wrinkles on the finger, the narrowing vessels and the wavy skin of the slice all follow plan.ts (wrinkle, narrow). The hook opens on the
   wide shot, the camera pushes to the finger, each explain beat is a push or a pan inside the same set, the outro eases back to the wide shot (the last frame is the first).
   Every word comes from the checked story; the labels are short pointers to parts of the set. */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, ISO, IsoHeart, Label, Mascot, Pill, Polys, StoryVideo, TopText, WHITE, YELLOW, YELLOW_D, SKIN_A, SKIN_B, PLASTER, cylinder, easeInOut, extrudeXZ,
  circlePts, block, planeXZ, riseAt, smoothPath, springAt, useFonts, layerTransform, toScreen,
  type P2, type P3, type SceneProps, type StoryT, type Tones,
} from "../../src/design/index.ts";
import { isoAt } from "../../src/iso.ts";
import { BODY_Y, FX, R, SLICE_Y, SX, T, TIP_L, U, O, camAt, makePlan, narrow, wrinkle } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const P = (p: P3): P2 => isoAt(p, U, O);
const SKIN: Tones = [PLASTER, SKIN_A, SKIN_B];
const TISSUE: Tones = ISO.floor;     // the cut-away slab: soft tissue, a shade apart from the finger's skin
const WATER: Tones = ISO.water;
const wob = (clock: number, period: number, phase = 0) => Math.sin(TAU * (clock / period + phase));       // the periods divide 60 s: the loop-back matches
const win = (t: number, a: number, b: number, k = 0.5) => easeInOut(clamp01((t - a) / k)) * (1 - easeInOut(clamp01((t - b) / k)));

// ------------------------------------------------------------------------------------------------------ the set
const Slab: React.FC = () => {
  const faces = block([-60, -60, -1.6], [60, 60, 0], U, O);
  return (
    <g>
      <Polys polys={faces} tones={TISSUE} />
      {/* soft fibres in the tissue: short strokes on the top face, in the tone a shade darker (never black) */}
      {Array.from({ length: 34 }, (_, i) => {
        const x = -16 + ((i * 37) % 31) + 0.5, y = -16 + ((i * 53) % 29) + 0.3;
        const a = P([x, y, 0]);
        return <ellipse key={i} cx={a[0]} cy={a[1]} rx={26 + (i % 4) * 8} ry={13 + (i % 4) * 4} fill={TISSUE[1]} opacity={0.55} />;
      })}
    </g>
  );
};

/** A shadow on the slab under a piece: an ellipse on the ground plane (a circle of radius r projects to rx = 1.2247 r u, ry = 0.7071 r u). */
const Shadow: React.FC<{ p: P3; r: number; o?: number }> = ({ p, r, o = 0.22 }) => {
  const c = P(p);
  return <ellipse cx={c[0] + 6} cy={c[1] + 4} rx={1.2247 * r * U} ry={0.7071 * r * U} fill={TISSUE[2]} opacity={o} />;
};

/** The nerve: a line on the slab from the far back to the slice, and a branch to the finger; yellow dots run along it while a signal goes. */
const NERVE_MAIN: P3[] = [[SX, -40, 0.14], [SX, -9, 0.14], [SX, -4, 0.14], [SX, SLICE_Y[0] - 0.1, 0.14]];
const NERVE_BRANCH: P3[] = [[SX, -4, 0.14], [SX + 3, -4, 0.14], [FX - 1.2, -4, 0.14]];
const pathOf = (pts: P3[]) => smoothPath(pts.map(P), 0.4);
const pointOn = (pts: P3[], s: number): P3 => {
  const f = clamp01(s) * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(f)), q = f - j;
  return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * q, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * q, pts[j][2] + (pts[j + 1][2] - pts[j][2]) * q];
};
const Nerve: React.FC<{ clock: number; on: number }> = ({ clock, on }) => (
  <g>
    {[NERVE_MAIN, NERVE_BRANCH].map((pts, k) => <path key={k} d={pathOf(pts)} fill="none" stroke={YELLOW_D} strokeWidth={13} strokeLinecap="round" opacity={0.9} />)}
    {[NERVE_MAIN, NERVE_BRANCH].map((pts, k) => <path key={`l${k}`} d={pathOf(pts)} fill="none" stroke={YELLOW} strokeWidth={6} strokeLinecap="round" />)}
    {on > 0.01 && [NERVE_MAIN, NERVE_BRANCH].map((pts, k) => Array.from({ length: 5 }, (_, i) => {
      const q = pointOn(pts, riseAt(clock, i / 5 + k * 0.1, 2.5)), c = P(q);
      return <circle key={`${k}${i}`} cx={c[0]} cy={c[1]} r={11} fill={WHITE} stroke={YELLOW_D} strokeWidth={4} opacity={on} />;
    }))}
  </g>
);

// ------------------------------------------------------------------------------------------------------ the finger
/** The radius of the finger's surface at y (the body is a cylinder, the tip a quarter-ellipse). */
const rAt = (y: number) => (y <= BODY_Y[1] ? R : R * Math.sqrt(Math.max(0, 1 - Math.pow((y - BODY_Y[1]) / TIP_L, 2))));
const surf = (y: number, th: number, grow = 1): P3 => [FX + rAt(y) * grow * Math.cos(th), y, R + rAt(y) * grow * Math.sin(th)];

const FingerBody: React.FC = () => {
  const polys = [
    ...cylinder([FX, BODY_Y[0], R], [FX, BODY_Y[1], R], R, R, [1, 0, 0], [0, 0, 1], U, O, 44),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * (Math.PI / 2), b = ((i + 1) / 6) * (Math.PI / 2);
      return cylinder([FX, BODY_Y[1] + TIP_L * Math.sin(a), R], [FX, BODY_Y[1] + TIP_L * Math.sin(b), R], R * Math.cos(a), R * Math.cos(b), [1, 0, 0], [0, 0, 1], U, O, 44);
    }).flat(),
  ];
  return <Polys polys={polys} tones={SKIN} />;
};

/** The wrinkles: rings around the finger, each a wavy line over the visible half of the surface, drawn in the skin's dark tone with a pale line beside it.
    k = 0 smooth, 1 wrinkled (plan.ts wrinkle). The lines get wavier, thicker and more numerous with k; a ridge is raised by drawing its pale edge on the lit side. */
const Wrinkles: React.FC<{ k: number }> = ({ k }) => {
  if (k < 0.01) return null;
  const rings = [-5.2, -4.5, -3.8, -3.1, -2.4, -1.7, -1.0, -0.3, 0.4, 1.0, 1.7, 2.3, 2.8, 3.2];
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {rings.map((y0, j) => {
        const pts: P2[] = [], lite: P2[] = [];
        for (let th = -0.7; th <= 2.35; th += 0.1) {
          const y = y0 + 0.16 * k * Math.sin(3 * th + j * 1.7), p = surf(y, th, 1.002);
          pts.push(P(p)); lite.push(P([p[0] - 0.05, p[1], p[2] + 0.07]));
        }
        const o = clamp01(k * 1.4 - (j % 3) * 0.18);
        return (
          <g key={j} opacity={o}>
            <path d={smoothPath(pts, 0.5)} stroke={SKIN_B} strokeWidth={3 + 5 * k} />
            <path d={smoothPath(lite, 0.5)} stroke={SKIN[0]} strokeWidth={2 + 2 * k} opacity={0.9} />
          </g>
        );
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the slice
/** A thin slice of the finger, standing beside it: the skin ring (wavy when wrinkled), the layer under it that loses fluid, four vessels that narrow, the bone. */
const VESSEL_ANG = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
const Slice: React.FC<{ k: number; v: number; clock: number }> = ({ k, v, clock }) => {
  const outline = circlePts(SX, R, R, 40);
  const ring = Array.from({ length: 72 }, (_, i) => { const th = (i / 72) * TAU, rr = R * (0.995 - 0.1 * k * (0.5 + 0.5 * Math.sin(7 * th))); return [SX + rr * Math.cos(th), R + rr * Math.sin(th)] as P2; });
  const inner = Array.from({ length: 72 }, (_, i) => { const th = (i / 72) * TAU, rr = R * (0.86 - 0.1 * k * (0.5 + 0.5 * Math.sin(7 * th))); return [SX + rr * Math.cos(th), R + rr * Math.sin(th)] as P2; });
  const d = (pts: P2[]) => `${pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(" ")} Z`;
  const beat = 1 + 0.08 * Math.max(0, Math.sin(TAU * clock * 1.2)) * (1 - v);
  return (
    <g>
      <Polys polys={extrudeXZ(outline, SLICE_Y[0], SLICE_Y[1], U, O)} tones={SKIN} />
      <g transform={planeXZ(SLICE_Y[1], U, O)}>
        <path d={d(ring)} fill={SKIN[0]} />
        <path d={d(inner)} fill={ISO.brain[0]} />
        {VESSEL_ANG.map((a, i) => (
          <g key={i}>
            <circle cx={SX + 0.58 * R * Math.cos(a)} cy={R + 0.58 * R * Math.sin(a)} r={0.27 * (1 - 0.55 * v) * beat} fill={ISO.organ[1]} />
            <circle cx={SX + 0.58 * R * Math.cos(a) - 0.05} cy={R + 0.58 * R * Math.sin(a) + 0.06} r={0.12 * (1 - 0.55 * v) * beat} fill={ISO.organ[0]} />
          </g>
        ))}
        <circle cx={SX} cy={R} r={0.34 * R} fill={ISO.plastic[1]} />
        <circle cx={SX - 0.1} cy={R + 0.12} r={0.17 * R} fill={ISO.plastic[0]} />
        <circle cx={SX + 0.84 * R * Math.cos(1.2)} cy={R + 0.84 * R * Math.sin(1.2)} r={0.1} fill={YELLOW} />
      </g>
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the water, drops and grip
/** The pool around the finger: a translucent block with a pale rim and slow ripples on its surface. */
const POOL: [P3, P3] = [[FX - 4.4, BODY_Y[0] - 2.5, 0], [FX + 4.6, 4.8, 0.45]];
const Pool: React.FC<{ clock: number }> = ({ clock }) => {
  const faces = block(POOL[0], POOL[1], U, O);
  const cx = FX + 3.2, cy = -1.5, z = POOL[1][2];
  return (
    <g>
      <Polys polys={faces} tones={WATER} opacity={0.92} />
      {[0, 1, 2].map((i) => {
        const age = ((clock / 3 + i / 3) % 1), c = P([cx - 6.4 * (i % 2) + 0.3 * i, cy + i * 1.6 - 2, z]), r = 0.7 + 2.0 * age;
        return <ellipse key={i} cx={c[0]} cy={c[1]} rx={1.2247 * r * U} ry={0.7071 * r * U} fill="none" stroke={WHITE} strokeWidth={4} opacity={0.75 * Math.sin(Math.PI * age)} />;
      })}
    </g>
  );
};

const Drops: React.FC<{ clock: number }> = ({ clock }) => {
  const at = [T.drop1, T.drop2, T.drop3, T.drop4], xs = [FX - 0.7, FX + 0.9, FX - 0.2, FX + 0.5], ys = [-2.2, -0.8, 0.6, -3.4];
  return (
    <g>
      {at.map((t0, i) => {
        const a = clock - t0;
        if (a < 0 || a > 1.4) return null;
        const fall = clamp01(a / 0.7), z = R * 2 + 6 * (1 - fall * fall), c = P([xs[i], ys[i], z]), hit = clamp01((a - 0.7) / 0.7);
        return fall < 1
          ? <path key={i} d={`M ${c[0]} ${c[1] - 26} q 14 22 0 34 q -14 -12 0 -34 Z`} fill={WATER[0]} stroke={WATER[2]} strokeWidth={3} />
          : <ellipse key={i} cx={c[0]} cy={c[1]} rx={26 * (1 + hit)} ry={13 * (1 + hit)} fill="none" stroke={WATER[1]} strokeWidth={4} opacity={1 - hit} />;
      })}
    </g>
  );
};

/** The wet bar the fingertip presses on (a flat bar with a wet sheen) and the water pushed out along the grooves while the finger grips it. */
const BAR: [P3, P3] = [[FX - 1.5, 3.7, 0], [FX + 1.5, 5.3, 1.1]];
const Grip: React.FC<{ on: number }> = ({ on }) => (
  <g opacity={clamp01(on * 4)}>
    <Polys polys={block(BAR[0], BAR[1], U, O)} tones={ISO.metal} />
    <Polys polys={block([BAR[0][0] - 0.05, BAR[0][1] - 0.05, BAR[1][2]], [BAR[1][0] + 0.05, BAR[1][1] + 0.05, BAR[1][2] + 0.12], U, O)} tones={WATER} opacity={0.6} />
  </g>
);
const Drain: React.FC<{ clock: number; on: number }> = ({ clock, on }) => (
  <g opacity={on}>
    {Array.from({ length: 10 }, (_, i) => {
      const side = i % 2 ? 1 : -1, s = riseAt(clock, i / 10, 1.6), y = 3.0 - 0.1 * (i % 5);
      const c = P([FX + side * (0.4 + 2.4 * s), y + 0.5 * s, 0.35 + 0.2 * Math.sin(s * Math.PI)]);
      return <circle key={i} cx={c[0]} cy={c[1]} r={10 - 5 * s} fill={WATER[0]} stroke={WATER[2]} strokeWidth={2.5} opacity={Math.sin(Math.PI * s)} />;
    })}
  </g>
);

/** The scale of the last beat: a beam with two plates, one for each study (2014: level, 2021: the wet grip is lighter). Plain iso blocks. */
const Study: React.FC<{ clock: number }> = ({ clock }) => {
  const p = easeInOut(clamp01((clock - T.scale) / 0.6)) * (1 - easeInOut(clamp01((clock - 55.6) / 0.5)));
  if (p < 0.01) return null;
  const sw = 0.06 * Math.sin(TAU * clock / 3), pivot: P3 = [FX + 5.2, 3.6, 0];
  return (
    <g opacity={p}>
      <Polys polys={block([pivot[0] - 0.25, pivot[1] - 0.25, 0], [pivot[0] + 0.25, pivot[1] + 0.25, 3.2], U, O)} tones={ISO.dark} />
      <g transform={`rotate(${sw * 57} ${P([pivot[0], pivot[1], 3.3])[0]} ${P([pivot[0], pivot[1], 3.3])[1]})`}>
        <Polys polys={block([pivot[0] - 1.9, pivot[1] - 1.9, 3.2], [pivot[0] + 1.9, pivot[1] + 1.9, 3.45], U, O)} tones={ISO.metal} />
      </g>
      <Polys polys={block([pivot[0] - 2.4, pivot[1] - 0.45, 0.6], [pivot[0] - 1.4, pivot[1] + 0.55, 0.85], U, O)} tones={WATER} />
      <Polys polys={block([pivot[0] + 0.5, pivot[1] + 1.4, 0.6], [pivot[0] + 1.5, pivot[1] + 2.4, 0.85], U, O)} tones={ISO.sun} />
      <circle cx={P([pivot[0], pivot[1], 3.3])[0]} cy={P([pivot[0], pivot[1], 3.3])[1]} r={11} fill={YELLOW} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the picture
const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const P_ = React.useMemo(() => makePlan(story), []);
  const cam = camAt(clock), far = layerTransform(cam, 0.3), main = layerTransform(cam, 1), near = layerTransform(cam, 1.3);
  const k = wrinkle(clock), v = narrow(clock);
  const top = P_.tops.find((x) => clock >= x.a && clock < x.b);
  const nerveOn = win(clock, T.nerveOn, T.nerveEnd, 0.6);
  const gripOn = win(clock, T.gripOn, 38.5, 0.5);
  const drainOn = win(clock, T.drain, 37.4, 0.6);
  const stingP = beat.kind === "sting" ? springAt(t, 0) * (1 - easeInOut(clamp01((t - 0.8) / 0.2))) : 0;
  const hairy = win(clock, T.hairOn, 45.4, 0.4);
  const swell = 1 + 0.025 * win(clock, T.swell - 1, T.swell + 2, 0.6);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <Brand clock={clock} spot={{ x: 540, y: -900, r: 300 }} />
      {/* the far layer: the soft back of the tissue, two pale mounds along the horizon of the slab */}
      <g transform={far}>
        {[-900, -200, 600, 1400].map((x, i) => <ellipse key={x} cx={x} cy={420 + (i % 2) * 40} rx={520} ry={200} fill={TISSUE[0]} opacity={0.7} />)}
      </g>
      <g transform={main}>
        <Slab />
        <Nerve clock={clock} on={nerveOn} />
        <Shadow p={[SX + 0.2, 0.8, 0]} r={R * 1.05} />
        <Slice k={k} v={v} clock={clock} />
        <g transform={`translate(${P([-8.4, 3.2, 0])[0]} ${P([-8.4, 3.2, 0])[1]}) scale(${1 + 0.05 * win(clock, T.heartOn, 29, 0.5)}) translate(${-P([-8.4, 3.2, 0])[0]} ${-P([-8.4, 3.2, 0])[1]})`}>
          <Shadow p={[-8.4, 3.2, 0]} r={1.2} />
          <IsoHeart u={46} o={P([-8.4, 3.2, 1.2])} t={clock} bpm={72} />
        </g>
        <Pool clock={clock} />
        <Shadow p={[FX, -0.8, 0.45]} r={R * 1.7} o={0.18} />
        <Grip on={gripOn} />
        <g transform={`translate(${P([FX, -1, 0])[0]} ${P([FX, -1, 0])[1]}) scale(${swell}) translate(${-P([FX, -1, 0])[0]} ${-P([FX, -1, 0])[1]})`}>
          <FingerBody />
          <Wrinkles k={k} />
        </g>
        <Drops clock={clock} />
        <Drain clock={clock} on={drainOn} />
        {hairy > 0.01 && <g opacity={hairy}>
          {[0, 1, 2].map((i) => { const a = P([FX + 2.9 + i * 0.5, 0.4 - i * 0.7, 0]), b = P([FX + 3.4 + i * 0.5, 0.4 - i * 0.7, 1.1]); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0] + 4 * wob(clock, 3, i / 3)} y2={b[1]} stroke={ISO.dark[1]} strokeWidth={5} strokeLinecap="round" />; })}
        </g>}
        <Study clock={clock} />
      </g>
      <g transform={near}>
        {Array.from({ length: 7 }, (_, i) => { const s = riseAt(clock, i / 7, 6), x = -200 + ((i * 331) % 1500), y = 2000 - s * 2300; return <circle key={i} cx={x + 14 * wob(clock, 3, i * 0.3)} cy={y} r={5 + (i % 3) * 3} fill="none" stroke={WHITE} strokeWidth={3} opacity={0.5 * Math.sin(Math.PI * s)} />; })}
      </g>

      {/* labels: short pointers from the text to the part */}
      {beat.kind !== "sting" && beat.kind !== "outro" && P_.labels.filter((l) => clock >= l.from - 0.05 && clock < l.to + 0.3).map((l) => {
        const a = toScreen(cam, P(l.at)), p = clamp01((clock - l.from) / 0.3) * (1 - clamp01((clock - l.to) / 0.3));
        if (p <= 0) return null;
        return (
          <g key={l.id} opacity={p}>
            <line x1={l.lx} y1={l.ly + 34} x2={a[0]} y2={a[1]} stroke={BLACK} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
            <circle cx={a[0]} cy={a[1]} r={9} fill={BLACK} />
            <Label text={l.text} x={l.lx} y={l.ly} fs={44} t={clock} start={l.from} />
          </g>
        );
      })}
      {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={clock - top.a} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {stingP > 0.001 && (
        <g>
          <g transform={`translate(200 700) scale(${stingP}) translate(-200 -700)`}><Mascot x={200} y={700} w={220} expr="curious" t={t} clock={clock} squash={0.18 * (1 - stingP)} /></g>
          <g transform={`translate(540 1489) scale(${stingP}) translate(-540 -1489)`}><Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} /></g>
        </g>
      )}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
