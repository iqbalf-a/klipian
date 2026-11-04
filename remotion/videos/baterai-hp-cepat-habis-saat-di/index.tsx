/* Kenapa baterai HP cepat habis saat dingin? — a custom video (videos/baterai-hp-cepat-habis-saat-di/), in the 2.5D style (DESIGN.md "2.5D isometrik"). One set: a snowy park with
   a bench, a phone on it (its battery bar drops in the cold), pines, a lamp post and snow mounds. The explain beats cut in to INSERTS (B25), each one idea in a circle that opens
   from the phone: the ions that flow through the electrolyte, the resistance that grows in the cold (the one look inside), the voltage and the current that fall, the lithium
   that sticks to the anode when it is charged frozen. Every word comes from the checked story through plan.ts. */
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  BLACK, Brand, CaptionLayer, FPS, FONT_BOLD, FRAME, G1, G2, G3, ISO, IsoBattery, Label, Lab, Mascot, Polys, RED, TipCard, TopText, WHITE, YELLOW, bobPx, block, easeInOut, isoAt, layerTransform, springAt, useFonts,
  type StoryT,
} from "../../src/design/index.ts";
import { IsoPhone } from "../../src/components/IsoBedroom.tsx";
import { BENCH, O, PHONE_PT, PHONE_SCALE, U, makePlan, type Insert, type Plan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const W = FRAME.width, H = FRAME.height;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const TAU = Math.PI * 2;
const G4x = ISO.cloudWhite[2];

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s, layoutDebug = false }) => <Picture story={s} layoutDebug={layoutDebug} />;

/** Where a world point (x, y, z) of the set is, in the world px of the stage. */
const at = (x: number, y: number, z: number): [number, number] => isoAt([x, y, z], U, O) as [number, number];
const GROUND = -0.35;

// ------------------------------------------------------------------------------------------------------------------------------------- the set

/** A pine: a trunk, three tiers of a soft triangle (light left half, dark right half) with a snow cap on each. `s` is its height in world units. */
const Pine: React.FC<{ x: number; y: number; s: number; sway: number }> = ({ x, y, s, sway }) => {
  const [bx, by] = at(x, y, GROUND), h = s * U * 0.82, sw = sway * 5;
  const tiers = [0, 1, 2].map((i) => {
    const base = by - h * (0.16 + i * 0.27), top = by - h * (0.5 + i * 0.27), half = h * (0.3 - i * 0.07), cx = bx + sw * (i + 1) * 0.3;
    return { cx, base, top, half };
  });
  return (
    <g>
      <rect x={bx - h * 0.05} y={by - h * 0.2} width={h * 0.1} height={h * 0.2} fill={ISO.soil[2]} />
      {tiers.map((tr, i) => (
        <g key={i}>
          <polygon points={`${tr.cx},${tr.top - h * 0.1} ${tr.cx - tr.half},${tr.base} ${tr.cx},${tr.base + h * 0.04}`} fill={ISO.leaf[1]} />
          <polygon points={`${tr.cx},${tr.top - h * 0.1} ${tr.cx},${tr.base + h * 0.04} ${tr.cx + tr.half},${tr.base}`} fill={ISO.leaf[2]} />
          <polygon points={`${tr.cx},${tr.top - h * 0.1} ${tr.cx - tr.half * 0.55},${tr.top + h * 0.1} ${tr.cx + tr.half * 0.55},${tr.top + h * 0.1}`} fill={ISO.cloudWhite[0]} />
        </g>
      ))}
    </g>
  );
};

/** A lamp post: a thin dark post and a neutral head with a snow cap (no yellow: yellow is current). */
const LampPost: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <Polys polys={block([x, y, GROUND], [x + 0.16, y + 0.16, 3.6], U, O)} tones={ISO.dark} />
    <Polys polys={block([x - 0.3, y - 0.3, 3.6], [x + 0.46, y + 0.46, 4.0], U, O)} tones={ISO.plastic} />
    <Polys polys={block([x - 0.34, y - 0.34, 4.0], [x + 0.5, y + 0.5, 4.14], U, O)} tones={ISO.cloudWhite} />
  </g>
);

/** A soft snow mound (a rounded heap, never a block). */
const Mound: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => {
  const [cx, cy] = at(x, y, GROUND);
  return <g><ellipse cx={cx + r * 0.08} cy={cy + r * 0.04} rx={r} ry={r * 0.42} fill={ISO.cloudWhite[2]} /><ellipse cx={cx - r * 0.04} cy={cy - r * 0.04} rx={r * 0.9} ry={r * 0.36} fill={ISO.cloudWhite[1]} /><ellipse cx={cx - r * 0.12} cy={cy - r * 0.1} rx={r * 0.62} ry={r * 0.22} fill={WHITE} /></g>;
};

/** The far hills (parallax 0.3): two soft mounds of snow along the horizon. */
const FarHills: React.FC = () => (
  <g>
    <ellipse cx={80} cy={560} rx={560} ry={150} fill={ISO.cloudWhite[2]} />
    <ellipse cx={1010} cy={580} rx={600} ry={170} fill={ISO.cloudWhite[1]} />
    <ellipse cx={540} cy={620} rx={760} ry={130} fill={ISO.cloudWhite[0]} />
  </g>
);

/** The bench and the phone on it. */
const Bench: React.FC = () => {
  const [a, b] = [BENCH.a, BENCH.b], legs: [number, number][] = [[a[0] + 0.15, a[1] + 0.15], [b[0] - 0.55, a[1] + 0.15], [a[0] + 0.15, b[1] - 0.55], [b[0] - 0.55, b[1] - 0.55]];
  legs.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  return (
    <g>
      {legs.map(([lx, ly], i) => <Polys key={i} polys={block([lx, ly, GROUND], [lx + 0.4, ly + 0.4, a[2]], U, O)} tones={ISO.soil} />)}
      <Polys polys={block(a, b, U, O)} tones={ISO.soil} />
      <Polys polys={block([a[0], a[1], b[2] - 0.0], [b[0], b[1], b[2] + 0.001], U, O)} tones={ISO.soil} />
    </g>
  );
};

const SNOW_PERIOD = 6;                                   // seconds: 60 / 6 is a whole number, so the snow is the same on the first and the last frame
/** The snow that falls: white dots, periodic in `SNOW_PERIOD`. `k` (0..1) is how much of it is falling. */
const Snow: React.FC<{ t: number; k: number }> = ({ t, k }) => (
  <g opacity={0.95 * k}>
    {Array.from({ length: 30 }, (_, i) => {
      const f = ((i * 0.6180339 + t / SNOW_PERIOD) % 1 + 1) % 1, x = -200 + ((i * 397) % 1480) + 40 * Math.sin(TAU * (t / SNOW_PERIOD) + i), y = -200 + f * 2300;
      return <circle key={i} cx={x} cy={y} r={7 + (i % 4) * 3} fill={G4x} />;
    })}
  </g>
);

/** A six-armed snowflake (white strokes) of radius r. */
const Flake: React.FC<{ x: number; y: number; r: number; rot?: number; color?: string }> = ({ x, y, r, rot = 0, color = WHITE }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    {[0, 60, 120].map((a) => <line key={a} x1={-r} y1={0} x2={r} y2={0} stroke={color} strokeWidth={r * 0.16} strokeLinecap="round" transform={`rotate(${a})`} />)}
  </g>
);

/** The phone's battery bar (a HUD above it): a dark body, a cap, a yellow level, and a snowflake that grows with the cold. */
const HudBattery: React.FC<{ x: number; y: number; level: number; cold: number; t: number }> = ({ x, y, level, cold, t }) => {
  const bw = 250, bh = 120, fillW = (bw - 28) * clamp01(level);
  return (
    <g transform={`translate(${x} ${y + bobPx(t, 0.4, 5)})`}>
      <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={26} fill={G2} />
      <rect x={bw / 2} y={-22} width={18} height={44} rx={7} fill={G2} />
      <rect x={-bw / 2 + 14} y={-bh / 2 + 14} width={bw - 28} height={bh - 28} rx={14} fill={G1} />
      <rect x={-bw / 2 + 14} y={-bh / 2 + 14} width={Math.max(0, fillW)} height={bh - 28} rx={14} fill={YELLOW} />
      <g transform={`translate(${bw / 2 + 80} 0) scale(${0.3 + 0.7 * cold})`}><circle r={50} fill={G2} /><Flake x={0} y={0} r={34} rot={t * 20} /></g>
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------------------------------------- the inserts

/** A channel of the cell: the electrolyte as a band with the ions (white discs with a plus) that flow along it. `phase` is how far they travelled; the cold's `grip` grows walls
    (resistance) in their way. */
const Channel: React.FC<{ y: number; phase: number; grip: number; n?: number; dark?: boolean }> = ({ y, phase, grip, n = 8, dark }) => {
  const x0 = 130, len = 820, walls = [0.28, 0.5, 0.72];
  return (
    <g>
      <rect x={x0 - 30} y={y - 78} width={len + 60} height={156} rx={40} fill={dark ? G1 : G2} />
      <rect x={x0 - 12} y={y - 62} width={len + 24} height={124} rx={30} fill={dark ? G2 : G3} opacity={0.75} />
      {walls.map((p, i) => <rect key={i} x={x0 + len * p - 20 * grip} y={y - 62} width={40 * grip} height={124} fill={G1} />)}
      {Array.from({ length: n }, (_, i) => {
        const f = (((phase + i / n) % 1) + 1) % 1, jam = grip * 7 * Math.sin(TAU * (phase * 6 + i * 0.37)), x = x0 + f * len, yy = y + (((i * 37) % 60) - 30) * 0.8 + jam;
        return <g key={i} transform={`translate(${x} ${yy})`}><circle r={25} fill={WHITE} /><text y={2} fontSize={36} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>+</text></g>;
      })}
    </g>
  );
};

/** One bar of a meter: a dark trough with a yellow level. */
const Bar: React.FC<{ x: number; y: number; h: number; level: number; wBar?: number }> = ({ x, y, h, level, wBar = 130 }) => (
  <g>
    <rect x={x - wBar / 2} y={y - h} width={wBar} height={h} rx={24} fill={G2} />
    <rect x={x - wBar / 2 + 12} y={y - h + 12 + (h - 24) * (1 - level)} width={wBar - 24} height={(h - 24) * level} rx={14} fill={YELLOW} />
  </g>
);

const InsertObject: React.FC<{ P: Plan; ins: Insert; t: number }> = ({ P, ins, t }) => {
  const bt = t - ins.from, pop = Math.max(0.001, springAt(t, ins.from + 0.2, false)), phase = P.ionPhase(t), grip = P.grip(t);
  const wrap = (children: React.ReactNode) => <g transform={`translate(540 1000) scale(${pop}) translate(-540 -1000)`}>{children}</g>;
  if (ins.kind === "ions") {
    return wrap(<g><IsoBattery u={175} o={[520, 800]} t={t} level={0.75} charging={false} /><Channel y={1290} phase={phase} grip={0} /></g>);
  }
  if (ins.kind === "cold") {
    return wrap(<g>
      <Channel y={1050} phase={phase} grip={grip} dark />
      {[0, 1, 2, 3, 4].map((i) => <Flake key={i} x={200 + i * 170} y={760 + bobPx(t, i * 0.7, 18)} r={34} rot={t * 25 + i * 20} />)}
    </g>);
  }
  if (ins.kind === "volt") {
    const k = easeInOut(clamp01(bt / 3)), v = 1 - 0.45 * k, a = 1 - 0.55 * k;
    return wrap(<g>
      <Bar x={330} y={1130} h={520} level={v} />
      <Bar x={750} y={1130} h={520} level={a} />
      <g transform={`translate(540 ${870 + 40 * k})`}><polygon points="-46,-34 46,-34 0,50" fill={BLACK} /></g>
    </g>);
  }
  if (ins.kind === "plate") {
    const grow = clamp01((bt - 0.8) / 2.5), pulse = 1 + 0.08 * Math.sin(t * 6);
    return wrap(<g>
      <rect x={110} y={760} width={180} height={520} rx={26} fill={G2} />
      <rect x={110} y={760} width={180} height={520} rx={26} fill={ISO.metal[1]} opacity={0.25} />
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 830 + i * 100, len = (60 + ((i * 53) % 80)) * grow;
        return <polygon key={i} points={`290,${y - 26} ${290 + len + 40 * grow},${y + 8} 290,${y + 26}`} fill={ISO.metal[2]} />;
      })}
      <g transform={`translate(780 ${960}) scale(${pulse})`}><polygon points="0,-130 120,80 -120,80" fill={RED} /><rect x={-12} y={-50} width={24} height={80} rx={10} fill={WHITE} /><circle cy={56} r={13} fill={WHITE} /></g>
      <Flake x={640} y={800} r={36} rot={t * 20} /><Flake x={900} y={1180} r={30} rot={-t * 20} />
    </g>);
  }
  return null;
};

const InsertLayer: React.FC<{ P: Plan; t: number }> = ({ P, t }) => {
  const ins = P.insertAt(t);
  if (!ins) return null;
  const k = P.insertOpen(ins, t);
  if (k <= 0.001) return null;
  const c = P.cam(t), o = [(PHONE_PT[0] - 540) * c.zoom + 540 - (c.x - 540) * c.zoom, (PHONE_PT[1] - 960) * c.zoom + 960 - (c.y - 960) * c.zoom];
  const id = `ins-${ins.id}`, dark = ins.kind === "cold";
  return (
    <g>
      <defs><clipPath id={id}><circle cx={o[0]} cy={o[1]} r={1700 * k} /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        {dark ? <Lab clock={t} /> : <><rect width={W} height={H} fill={ISO.cloudWhite[1]} /><Brand clock={t} spot={{ x: 540, y: 1000, r: 420 }} /></>}
        <InsertObject P={P} ins={ins} t={t} />
      </g>
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------------------------------------- the picture

const Picture: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s }) => {
  useFonts();
  const frame = useCurrentFrame(), t = frame / FPS;
  const P = React.useMemo(() => makePlan(s), [s]);
  const { m } = P;
  const cam = P.cam(t), st = P.state(t);
  const beat = s.beats.find((b) => t >= P.beat(b.id).a && t < P.beat(b.id).b) ?? s.beats[s.beats.length - 1];
  const bt = t - P.beat(beat.id).a;
  const top = P.tops.find((x) => t >= x.a && t < x.b);
  const lw = P.loopWeight(t);
  const mound: [number, number, number][] = [[-1.5, 3.6, 130], [5.6, 3.2, 150], [2.2, -3.4, 140], [6.2, -1.2, 110], [-2.4, 0.4, 120], [-3.6, 1.8, 90], [4.4, 7, 120], [-1.5, -4.5, 100]];
  const pines: [number, number, number][] = [[-8, 0.5, 6.2], [-6.5, 4.5, 6.6], [8.5, 1, 6.4], [9.5, 8.5, 6.2], [-3.8, 6.2, 5.2], [6.4, -1.8, 5.4]];
  const things: { z: number; el: React.ReactNode }[] = [
    ...mound.map(([x, y, r], i) => ({ z: x + y, el: <Mound key={`m${i}`} x={x} y={y} r={r} /> })),
    ...pines.map(([x, y, h], i) => ({ z: x + y, el: <Pine key={`p${i}`} x={x} y={y} s={h} sway={Math.sin(TAU * (t / SNOW_PERIOD) + i)} /> })),
    { z: -1.6, el: <LampPost key="lamp" x={-4.4} y={2.8} /> },
    { z: 3, el: <g key="bench"><Bench /><IsoPhone u={U} o={O} on={1} t={t * 2} scale={PHONE_SCALE} /></g> },       // the bench and its phone stand at x + y = 3: what is farther back is drawn first
  ].sort((a, b) => a.z - b.z);
  const [gx0, gx1] = [-9, 11];

  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <rect width={W} height={H} fill={ISO.cloudWhite[1]} />
        <g transform={layerTransform(cam, 0.3)}><g transform="translate(540 960) scale(1.9) translate(-540 -960)"><Brand clock={t} spot={{ x: 540, y: 1500, r: 300 }} /></g><FarHills /></g>
        <g transform={layerTransform(cam, 1)}>
          <Polys polys={block([gx0, gx0, -1.4], [gx1, gx1, GROUND], U, O)} tones={ISO.cloudWhite} />
          {things.map((x) => x.el)}
          <HudBattery x={PHONE_PT[0]} y={PHONE_PT[1] - 250} level={st.level} cold={st.cold} t={t} />
        </g>
        <g transform={layerTransform(cam, 1.4)}><Snow t={t} k={st.cold} /></g>

        <InsertLayer P={P} t={t} />

        {P.labels.filter((l) => t >= l.from - 0.05 && t < l.to + 0.4).map((l) => <Label key={l.id} text={l.text} x={l.x} y={l.y} fs={l.fs} color={l.color} t={t} start={l.from} onDark={l.dark} />)}
        {P.tips.map((tp, i) => <TipCard key={i} x={P.TIP.x} y={P.TIP.y} w={P.TIP.w} n={tp.n} title={tp.title} t={t} start={tp.from} end={tp.to} />)}

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
          return <g transform={`translate(${R.x} ${R.y}) scale(${Math.max(0, p)}) translate(${-R.x} ${-R.y})`}><Mascot x={R.x} y={R.y} w={R.w} expr="surprised" t={t - m.react} clock={t} /></g>;
        })()}

        {top && lw < 0.5 && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={t - top.a} onDark={P.insertAt(t)?.kind === "cold" && P.insertOpen(P.insertAt(t)!, t) > 0.5} />}
        {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={bt} />}
      </svg>
    </div>
  );
};
