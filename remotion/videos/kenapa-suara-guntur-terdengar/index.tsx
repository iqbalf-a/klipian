/* Kenapa suara guntur terdengar lebih lambat dari kilat?: one set (a flat dry plain with one straight road and kilometre posts, set kind "plain-road"), one hero
   (the storm at the far end of the road: a dark cumulus cloud and its bolt) and one continuous camera (plan.ts CAM). A bolt flashes, a yellow dot of light crosses
   the road in a blink, and a blue ring of sound creeps over the ground at its real speed (1 km in 3 s). The first frame is the last (the loop). */
import React from "react";
import {
  BLACK, CaptionLayer, IsoCloud, Mascot, StoryVideo, TopText, YELLOW, YELLOW_D, block, cam2At, clamp01, easeInOut, easeOutBack,
  isoAt, layerTransform, ptsAttr, springAt, useFonts, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { G2, G4, ISO, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, FLASHES, RINGS, T } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const U = 150, O: [number, number] = [860, 1400];                       // one world unit = 1 km = 150 px; the listener stands at the origin
const HORIZON = 860;
const WATER = ISO.water, SAND = ISO.sand, ASPHALT = ISO.dark;
const SKY_TOP = mixRgb(WATER[1], G2, 0.55), SKY_LOW = mixRgb(G4, WATER[0], 0.14);
const FONT = { fontFamily: '"Outfit", sans-serif', fontWeight: 700 } as const;
const pt = (k: number, y = 0, z = 0): [number, number] => isoAt([-k, y, z], U, O) as [number, number];     // a point k km up the road (up-left on the screen)
const polys = (ps: Poly[], tones: readonly string[], stroke = "none", op = 1) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={stroke} strokeWidth={2} strokeLinejoin="round" opacity={op} />);
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.3) * (1 - clamp01((c - b) / 0.3));
const ease = (c: number, a: number, b: number) => easeInOut(clamp01((c - a) / (b - a)));

/** A bolt is on screen at the start of a flash: two quick flickers over about 0.45 s. */
const flashAt = (c: number): { k: number; v: number } | null => {
  for (const f of FLASHES) { const d = c - f.t; if (d >= 0 && d < 0.46) return { k: f.k, v: d < 0.09 ? 1 : d < 0.16 ? 0.15 : d < 0.34 ? 0.9 : 0.4 * (1 - (d - 0.34) / 0.12) }; }
  return null;
};
/** Where the storm stands (km): 3, slides to 5 for the "farther" beat and back. */
const stormK = (c: number) => 3 + 2 * ease(c, T.slideOut, T.slideOutEnd) - 2 * ease(c, T.slideBack, T.slideBackEnd);

/** The stormy sky (far layer, parallax 0.3): stacked grey-blue tones, a pale band at the horizon. No sun, no sea, no hills. */
const Sky: React.FC = () => (
  <g>
    {Array.from({ length: 48 }, (_, i) => <rect key={i} x={-3200} y={-3000 + i * 100} width={7600} height={101} fill={mixRgb(SKY_TOP, SKY_LOW, Math.min(1, i / 36))} />)}
  </g>
);

/** The plain (p = 1): sand from the horizon down with a pale haze at the far edge, flat strips that read as distance. */
const Ground: React.FC = () => (
  <g>
    <rect x={-3200} y={HORIZON} width={7600} height={3200} fill={SAND[0]} />
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-3200} y={HORIZON + i * 14} width={7600} height={14} fill={mixRgb(SKY_LOW, SAND[0], Math.min(1, i / 11))} />)}
    {Array.from({ length: 9 }, (_, i) => <rect key={`s${i}`} x={-3200} y={HORIZON + 200 + i * 150 + (i % 2) * 40} width={7600} height={5} fill={SAND[1]} opacity={0.35} />)}
  </g>
);

/** The road: one asphalt slab along the iso x axis, white dashes, a pale shoulder. */
const Road: React.FC = () => (
  <g>
    {polys(block([-40, -0.62, 0], [9, 0.62, 0.02], U, O), SAND, "none", 0.55)}
    {polys(block([-40, -0.42, 0.02], [9, 0.42, 0.07], U, O), ASPHALT)}
    {Array.from({ length: 60 }, (_, i) => polys(block([-15.6 + i * 0.7, -0.035, 0.07], [-15.6 + i * 0.7 + 0.32, 0.035, 0.075], U, O), ISO.plastic))}
  </g>
);

/** A kilometre post: a small iso block with a sign. The far ones draw first. */
const Post: React.FC<{ k: number }> = ({ k }) => {
  const top = pt(k, 0.62, 0.62);
  return (
    <g>
      {polys(block([-k - 0.05, 0.57, 0], [-k + 0.05, 0.67, 0.55], U, O), ISO.plastic)}
      <rect x={top[0] - 30} y={top[1] - 6} width={60} height={42} rx={9} fill={WHITE} stroke={BLACK} strokeWidth={3} />
      <text x={top[0]} y={top[1] + 25} fontSize={30} textAnchor="middle" fill={BLACK} style={FONT}>{k}</text>
    </g>
  );
};

/** Power poles along the far side of the road, with a sagging wire: man-made, so boxes; they give the plain a second vertical kind. */
const POLES = Array.from({ length: 12 }, (_, i) => 0.5 - i * 1.5);
const Poles: React.FC = () => {
  const tops = POLES.map((x) => isoAt([x, -1.0, 0.95], U, O) as [number, number]);
  return (
    <g>
      {POLES.map((x, i) => <g key={i}>{polys(block([x - 0.045, -1.045, 0], [x + 0.045, -0.955, 0.95], U, O), ISO.wall)}{polys(block([x - 0.02, -1.15, 0.86], [x + 0.02, -0.85, 0.9], U, O), ISO.wall)}</g>)}
      {tops.slice(0, -1).map((a, i) => <path key={i} d={`M ${a[0]} ${a[1]} Q ${(a[0] + tops[i + 1][0]) / 2} ${(a[1] + tops[i + 1][1]) / 2 + 26} ${tops[i + 1][0]} ${tops[i + 1][1]}`} fill="none" stroke={BLACK} strokeWidth={3} opacity={0.7} />)}
    </g>
  );
};

/** Loose dust drifting across the near layer: it touches nothing and wraps twice per loop. */
const Dust: React.FC<{ c: number }> = ({ c }) => (
  <g>
    {Array.from({ length: 16 }, (_, i) => {
      const x = ((i * 211 + c * 53.34) % 1700) - 300, y = 700 + ((i * 347) % 1000) + 8 * Math.sin((c / 4 + i) * Math.PI * 2 * 0.5);
      return <circle key={i} cx={x} cy={y} r={3 + (i % 3)} fill={SAND[2]} opacity={0.45} />;
    })}
  </g>
);

/** Dry tufts of grass: dressing, swaying a little all the time. */
const TUFTS: [number, number][] = [[-6.2, 2.0], [-4.4, -2.2], [-2.6, 2.6], [-1.0, -2.4], [0.4, 2.8], [-8.4, 1.6], [-5.4, 3.6], [-3.4, -3.4]];
const Tufts: React.FC<{ c: number }> = ({ c }) => (
  <g>
    {TUFTS.map(([x, y], i) => {
      const b = isoAt([x, y, 0], U, O), sw = 4 * Math.sin((c / 5 + i * 0.17) * Math.PI * 2);
      return <g key={i}>{[-1, 0, 1].map((d) => <polygon key={d} points={`${b[0] + d * 9 - 5},${b[1]} ${b[0] + d * 9 + sw + d * 5},${b[1] - 34 + Math.abs(d) * 8} ${b[0] + d * 9 + 5},${b[1]}`} fill={SAND[2]} />)}</g>;
    })}
  </g>
);

/** A white plate with a bold text that pops in and out (in world or screen px). */
const Tag: React.FC<{ text: string; x: number; y: number; fs: number; c: number; a: number; b?: number; fill?: string }> = ({ text, x, y, fs, c, a, b = 1e9, fill = WHITE }) => {
  const k = on(c, a, b);
  if (k <= 0.01) return null;
  const w = text.length * fs * 0.52 + fs * 0.9, h = fs * 1.5, s = easeOutBack(clamp01((c - a) / 0.35));
  return (
    <g opacity={k} transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={fill} opacity={0.92} />
      <text x={x} y={y + fs * 0.36} fontSize={fs} textAnchor="middle" fill={BLACK} style={FONT}>{text}</text>
    </g>
  );
};

/** The sound rings: ellipses on the ground (a circle of radius R km on the iso ground is an ellipse of 1.2247 R U by 0.7071 R U), clipped at the horizon. */
const Rings: React.FC<{ c: number }> = ({ c }) => (
  <g clipPath="url(#ground)">
    {RINGS.map((r, i) => {
      if (c < r.tf || c > r.until + 0.4) return null;
      const R = (c - r.tf) / 3, s = pt(r.k), fade = 1 - clamp01((c - r.until) / 0.4);
      return <g key={i} opacity={fade}>{[0, 0.22, 0.44].map((d, j) => R - d > 0.02 && <ellipse key={j} cx={s[0]} cy={s[1]} rx={1.2247 * (R - d) * U} ry={0.7071 * (R - d) * U} fill="none" stroke={WATER[j === 0 ? 1 : 0]} strokeWidth={10 - j * 2} opacity={0.95 - j * 0.28} />)}</g>;
    })}
  </g>
);

/** The yellow dot of light: crosses the road in 0.35 s from the strike to the listener. */
const LightDots: React.FC<{ c: number }> = ({ c }) => (
  <g>
    {[[T.flashA, 3], [T.flashE, 3], [T.flashB, 5], [T.flashC, 3], [T.flashD, 3]].map(([t0, k], i) => {
      const d = (c - t0) / 0.35;
      if (d < 0 || d > 1.5) return null;
      const f = Math.min(1, d), s = pt(k), e = pt(0), x = s[0] + (e[0] - s[0]) * f, y = s[1] + (e[1] - s[1]) * f, tx = s[0] + (e[0] - s[0]) * Math.max(0, f - 0.25), ty = s[1] + (e[1] - s[1]) * Math.max(0, f - 0.25);
      return <g key={i} opacity={1 - clamp01((d - 1) / 0.5)}><line x1={tx} y1={ty - 6} x2={x} y2={y - 6} stroke={YELLOW} strokeWidth={14} strokeLinecap="round" opacity={0.7} /><circle cx={x} cy={y - 6} r={22} fill={YELLOW} /><circle cx={x} cy={y - 6} r={10} fill={WHITE} /></g>;
    })}
  </g>
);

/** The bolt: a yellow jagged line with a white core, from the cloud's base to the strike point k km up the road. */
const Bolt: React.FC<{ k: number; v: number; top: [number, number] }> = ({ k, v, top }) => {
  const s = pt(k), n = 7, jit = [0, 26, -22, 30, -18, 22, -12, 0];
  const pts = Array.from({ length: n + 1 }, (_, i) => `${top[0] + (s[0] - top[0]) * (i / n) + jit[i]},${top[1] + (s[1] - top[1]) * (i / n)}`).join(" ");
  return <g opacity={v}><polyline points={pts} fill="none" stroke={YELLOW} strokeWidth={22} strokeLinejoin="round" strokeLinecap="round" /><polyline points={pts} fill="none" stroke={WHITE} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" /></g>;
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock, cam = cam2At(CAM, c), isOutro = beat.kind === "outro";
  const kc = stormK(c), S = pt(kc), bob = 7 * Math.sin((c / 6) * Math.PI * 2);
  const cloudO: [number, number] = [S[0], S[1] - 450 + bob];
  const fl = flashAt(c), L = pt(0);
  const hide = isOutro;                                                    // the outro carries no label, pill or card
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <defs><clipPath id="ground"><rect x={-3200} y={HORIZON} width={7600} height={3200} /></clipPath></defs>
      <g transform={layerTransform(cam, 0.3)}><Sky /></g>
      <g transform={layerTransform(cam, 0.55)}>
        {[[40, 640, 0.9, 0.0], [1240, 700, 1.0, 0.4], [-300, 560, 0.8, 0.7]].map(([x, y, g, ph], i) => (
          <g key={i} transform={`translate(${60 * Math.sin((c / 60 + ph) * Math.PI * 2)} 0)`}><IsoCloud u={110} o={[x, y]} cx={0} cy={0} cz={0} grow={g * 0.7} dark={0.55} haze={0.45} phase={c / 6 + ph} /></g>
        ))}
      </g>
      <g transform={layerTransform(cam, 1)}>
        <Ground />
        <Road />
        <Rings c={c} />
        <Tufts c={c} />
        <Poles />
        {[6, 5, 4, 3, 2, 1, 0].map((k) => <Post key={k} k={k} />)}
        {/* the listener: a pin on the post "0", bobbing a little */}
        <g transform={`translate(${L[0] + 70} ${L[1] + 30 + 4 * Math.sin((c / 3) * Math.PI * 2)})`}>
          <ellipse cx={0} cy={0} rx={30} ry={14} fill={SAND[2]} opacity={0.6} />
          <path d="M0 0 C-34 -44 -34 -96 0 -96 C34 -96 34 -44 0 0 Z" fill={YELLOW} stroke={YELLOW_D} strokeWidth={4} />
          <circle cx={0} cy={-62} r={11} fill={WHITE} />
        </g>
        <LightDots c={c} />
        {/* the storm: a dark cumulus over the strike point */}
        <IsoCloud u={150} o={cloudO} cx={0} cy={0} cz={0} grow={1.15} dark={0.92} phase={c / 6} />
        {fl && <Bolt k={fl.k} v={fl.v} top={[S[0], cloudO[1] + 150]} />}
        {/* lahir: the two children of one bolt */}
        {!hide && <>
          <Tag text="kilat" x={S[0] - 270} y={cloudO[1] + 190} fs={52} c={c} a={T.lblKilat} b={11.6} fill={YELLOW} />
          <Tag text="guntur" x={S[0] + 270} y={cloudO[1] + 190} fs={52} c={c} a={T.lblGuntur} b={11.6} />
          {/* cahaya */}
          <Tag text="LIHAT!" x={L[0] + 70} y={L[1] - 150} fs={50} c={c} a={T.lihat} b={16.4} fill={YELLOW} />
          <Tag text="cahaya: seketika" x={380} y={1430} fs={50} c={c} a={T.lblInstan} b={18.6} />
          <Tag text="300 ribu km/detik" x={380} y={1530} fs={44} c={c} a={T.lblSpeed} b={18.6} />
          {/* suara: the ring passes the posts */}
          <Tag text="3 detik" x={pt(2)[0] - 40} y={pt(2)[1] + 140} fs={44} c={c} a={T.tag3} b={26.4} />
          <Tag text="6 detik" x={pt(1)[0] - 40} y={pt(1)[1] + 140} fs={44} c={c} a={T.tag6} b={26.4} />
          <Tag text="9 detik" x={pt(0)[0] - 40} y={pt(0)[1] + 140} fs={44} c={c} a={T.tag9} b={26.4} />
          <Tag text="± 343 m/detik" x={430} y={1640} fs={44} c={c} a={T.lblSound} b={26.4} />
          {/* contoh: three km on the ground */}
          {on(c, T.brace, 35.2) > 0.01 && <g opacity={on(c, T.brace, 35.2)}>
            <line x1={pt(3, 1.3)[0]} y1={pt(3, 1.3)[1]} x2={pt(0, 1.3)[0]} y2={pt(0, 1.3)[1]} stroke={BLACK} strokeWidth={8} strokeLinecap="round" />
            {[3, 0].map((k) => <line key={k} x1={pt(k, 1.1)[0]} y1={pt(k, 1.1)[1]} x2={pt(k, 1.5)[0]} y2={pt(k, 1.5)[1]} stroke={BLACK} strokeWidth={8} strokeLinecap="round" />)}
            <Tag text="3 km" x={pt(1.5, 1.3)[0] - 20} y={pt(1.5, 1.3)[1] + 50} fs={56} c={c} a={T.brace + 0.2} b={35.2} fill={YELLOW} />
          </g>}
          {/* jeda: the same bolt, farther */}
          {on(c, 37.6, 41.8) > 0.01 && <g opacity={on(c, 37.6, 41.8)}>
            <line x1={pt(5, 1.3)[0]} y1={pt(5, 1.3)[1]} x2={pt(0, 1.3)[0]} y2={pt(0, 1.3)[1]} stroke={BLACK} strokeWidth={8} strokeLinecap="round" />
            {[5, 0].map((k) => <line key={k} x1={pt(k, 1.1)[0]} y1={pt(k, 1.1)[1]} x2={pt(k, 1.5)[0]} y2={pt(k, 1.5)[1]} stroke={BLACK} strokeWidth={8} strokeLinecap="round" />)}
            <Tag text="5 km" x={pt(2.5, 1.3)[0] - 20} y={pt(2.5, 1.3)[1] + 55} fs={56} c={c} a={37.8} b={41.8} fill={YELLOW} />
          </g>}
          <Tag text="jeda lebih lebar" x={520} y={1560} fs={54} c={c} a={T.lblGap} b={41.8} />
          {/* lipat */}
          <Tag text="cahaya: sudah sampai" x={430} y={1470} fs={46} c={c} a={T.lblC1} b={47.6} />
          <Tag text="suara: baru segini" x={pt(3)[0] - 170} y={pt(3)[1] + 170} fs={46} c={c} a={T.lblC2} b={47.6} />
          <Tag text="ratusan ribu kali" x={600} y={1560} fs={58} c={c} a={T.pillLipat} b={47.6} fill={YELLOW} />
        </>}
        {/* the sound arrives at the listener: DUAAR */}
        {!hide && on(c, T.duar, 24.0) > 0.01 && (() => {
          const k = easeOutBack(clamp01((c - T.duar) / 0.35)), cx = L[0] + 30, cy = L[1] - 320;
          const star = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 78 : 118; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a) * 0.8}`; }).join(" ");
          return <g opacity={on(c, T.duar, 24.0)} transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}><polygon points={star} fill={YELLOW} stroke={YELLOW_D} strokeWidth={4} /><text x={cx} y={cy + 16} fontSize={46} textAnchor="middle" fill={BLACK} style={FONT}>DUAAR!</text></g>;
        })()}
      </g>
      <g transform={layerTransform(cam, 1.4)}><Dust c={c} /></g>
      {/* the sky flashes white for an instant, over everything of the world */}
      {fl && <rect x={0} y={0} width={1080} height={1920} fill={WHITE} opacity={0.5 * fl.v} />}
      {/* contoh: a timeline under the scene: the bolt at 0, the sound creeping to 9 seconds */}
      {!hide && on(c, T.tlBar, 35.2) > 0.01 && (() => {
        const f = clamp01((c - T.flashE) / 9), x0 = 200, x1 = 820, mx = x0 + (x1 - x0) * f;
        return (
          <g opacity={on(c, T.tlBar, 35.2)}>
            <rect x={90} y={1230} width={900} height={250} rx={50} fill={WHITE} opacity={0.92} />
            <polygon points="150,1290 178,1290 164,1322 184,1322 146,1376 156,1332 138,1332" fill={YELLOW} stroke={YELLOW_D} strokeWidth={3} />
            <line x1={x0} y1={1335} x2={x1} y2={1335} stroke={BLACK} strokeWidth={8} strokeLinecap="round" />
            {Array.from({ length: 10 }, (_, i) => <line key={i} x1={x0 + ((x1 - x0) * i) / 9} y1={1318} x2={x0 + ((x1 - x0) * i) / 9} y2={1352} stroke={BLACK} strokeWidth={5} />)}
            <circle cx={mx} cy={1335} r={22} fill={WATER[1]} stroke={WATER[2]} strokeWidth={4} />
            <g transform="translate(890 1335)">{[24, 40, 56].map((r, i) => <path key={r} d={`M ${r * 0.45} ${-r * 0.55} A ${r} ${r} 0 0 1 ${r * 0.45} ${r * 0.55}`} fill="none" stroke={WATER[1]} strokeWidth={7 - i} strokeLinecap="round" />)}<circle cx={-8} cy={0} r={11} fill={WATER[2]} /></g>
            <text x={160} y={1430} fontSize={42} textAnchor="middle" fill={BLACK} style={FONT}>0 detik</text>
            <Tag text="9 detik" x={820} y={1430} fs={42} c={c} a={T.tlLabel} b={35.2} fill={YELLOW} />
          </g>
        );
      })()}
      {/* tips: three cards and the sum */}
      {!hide && [["1  Lihat kilat", T.card1, 1200], ["2  Hitung detik sampai guntur", T.card2, 1330], ["3  Bagi tiga = kilometer", T.card3, 1460]].map(([txt, a, y], i) => {
        const k = on(c, a as number, 56.4), s = springAt(c, a as number, true);
        return k > 0.01 ? <g key={i} opacity={k} transform={`translate(0 ${(1 - s) * 40})`}><rect x={110} y={(y as number) - 52} width={860} height={104} rx={52} fill={WHITE} opacity={0.94} /><text x={540} y={(y as number) + 18} fontSize={46} textAnchor="middle" fill={BLACK} style={FONT}>{txt}</text></g> : null;
      })}
      {!hide && <Tag text="9 ÷ 3 = 3 km" x={540} y={1090} fs={64} c={c} a={T.pillEx} b={56.4} fill={YELLOW} />}
      {/* the text layers: kicker + headline on top (not on the sting or the outro), the caption below; the mascot only in the sting */}
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText key={beat.id} kicker={beat.kind === "hook" ? "KILAT DAN GUNTUR" : beat.kind === "result" ? "JAWABANNYA" : "INTIP GUNTUR"} headline={beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={c} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1489) scale(${Math.max(0, p2)}) translate(-540 -1489)`}>
            <rect x={-210 + 540} y={1443} width={420} height={92} rx={46} fill={YELLOW} />
            <text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={FONT}>Intip yuk!</text>
          </g>
        </g>;
      })()}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
