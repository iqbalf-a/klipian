/* Pelangi sebenarnya berbentuk lingkaran: one sky set ("cloud-deck": a sky with the sun, far clouds, a cloud deck below and one slab of ground that can be
   in the way), one hero (the rainbow, a full ring of seven bands) and one continuous camera (plan.ts CAM). A drop splits the sunlight, the ring is drawn round
   the point opposite the sun, the ground slab rises and hides its lower half (the arc we know), then it sinks as the plane climbs and the ring is whole;
   a small glory is shown next to it for scale. The first frame is the last (the loop): the ground is up and the ring is cut. */
import React from "react";
import {
  loopClock, BLACK, CaptionLayer, FONT_BOLD, ISO, IsoCloud, IsoPlane, IsoSun, Label, Mascot, StoryVideo, THEMES, TopText, WHITE, YELLOW, YELLOW_D, RED, HOT2,
  block, cam2At, clamp01, easeInOut, easeOutBack, layerTransform, ptsAttr, springAt, useFonts, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, DROP, RING, SUN, T } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const SKY_TOP = mixRgb(ISO.water[0], WHITE, 0.35), SKY_LOW = mixRgb(THEMES.sky.wall, WHITE, 0.6);
const VIOLET = mixRgb(ISO.water[2], RED, 0.4);
const BANDS = [RED, HOT2, YELLOW, ISO.leaf[1], ISO.water[1], ISO.water[2], VIOLET];     // outside to inside, as the rainbow has them
const BAND_W = 15;
const DEG = Math.PI / 180;

/** 0 to 1 over 0.35 s from `a`; and back to 0 at `b` (a thing is on screen from a to b). */
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
/** The ground slab's drop in px: 0 when it is up (the ring is cut), 1000 when it is away (the ring is whole). */
const slabDrop = (c: number): number => {
  const ease = (a: number, b: number) => easeInOut(clamp01((c - a) / (b - a)));
  return 1000 * (ease(T.slabDown, T.slabDownEnd) - ease(T.slabUp, T.slabUpEnd) + ease(T.slabDown2, T.slabDown2End) - ease(T.slabUp2, T.slabUp2End));
};
const polys = (ps: Poly[], tones: readonly string[]) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} />);
const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos(deg * DEG), cy + r * Math.sin(deg * DEG)];
const font = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;

/** The sky (far layer, parallax 0.3): bands from a high blue to a pale low tone that meets the horizon, and the sun. */
const Sky: React.FC<{ clock: number; pulse: number }> = ({ clock, pulse }) => (
  <g>
    {Array.from({ length: 64 }, (_, i) => <rect key={i} x={-1500} y={-1500 + i * 70} width={4000} height={71} fill={mixRgb(SKY_TOP, SKY_LOW, Math.min(1, i / 36))} />)}
    <g transform={`translate(${SUN.x} ${SUN.y}) scale(${1 + 0.16 * pulse}) translate(${-SUN.x} ${-SUN.y})`}><IsoSun cx={SUN.x} cy={SUN.y} r={SUN.r} phase={clock / 6} /></g>
  </g>
);

/** The rainbow: seven concentric bands, red outside, violet inside. `k` is how much of the ring is drawn (clockwise from the top). */
const Ring: React.FC<{ cx: number; cy: number; r: number; k: number; op: number; sw?: number }> = ({ cx, cy, r, k, op, sw = BAND_W }) => (
  <g opacity={op} transform={`rotate(-90 ${cx} ${cy})`}>
    {BANDS.map((col, i) => <circle key={i} cx={cx} cy={cy} r={r + (3 - i) * sw} fill="none" stroke={col} strokeWidth={sw + 0.6} pathLength={1} strokeDasharray={`${k} 2`} />)}
  </g>
);

/** The cloud deck below the plane: a pale floor and rows of clouds that grow bigger towards the viewer (they bleed past the frame). */
const Deck: React.FC<{ clock: number }> = ({ clock }) => {
  const rows: { y: number; u: number; step: number; haze: number; off: number }[] = [
    { y: 1110, u: 92, step: 190, haze: 0.55, off: 0 }, { y: 1230, u: 128, step: 250, haze: 0.4, off: 90 },
    { y: 1420, u: 170, step: 330, haze: 0.22, off: 30 }, { y: 1700, u: 215, step: 410, haze: 0.08, off: 160 }, { y: 2000, u: 250, step: 480, haze: 0, off: 60 },
  ];
  return (
    <g>
      <rect x={-1500} y={1100} width={4000} height={1500} fill={mixRgb(ISO.cloudWhite[1], SKY_LOW, 0.5)} />
      {rows.map((r, ri) => Array.from({ length: Math.ceil(3200 / r.step) }, (_, i) => {
        const x = -900 + r.off + i * r.step, drift = 14 * Math.sin((clock / 20 + i * 0.37 + ri) * Math.PI * 2);
        return <IsoCloud key={`${ri}-${i}`} u={r.u} o={[x + drift, r.y]} cx={0} cy={0} cz={0} grow={1.15} haze={r.haze} phase={clock / 6 + i * 0.21} />;
      }))}
    </g>
  );
};

/** The ground: one slab with its top edge on the horizon (soil tones, three strata) and two small boxes on it for scale; it bleeds past the frame. */
const Ground: React.FC = () => (
  <g>
    <rect x={-1500} y={RING.y} width={4000} height={1500} fill={ISO.soil[1]} />
    <rect x={-1500} y={RING.y} width={4000} height={24} fill={ISO.soil[0]} />
    <rect x={-1500} y={RING.y + 150} width={4000} height={70} fill={ISO.soil[2]} opacity={0.5} />
    <rect x={-1500} y={RING.y + 420} width={4000} height={110} fill={ISO.soil[2]} opacity={0.4} />
    {polys(block([-0.5, -0.5, 0], [0.5, 0.5, 0.75], 48, [150, RING.y - 28]), ISO.wall)}
    {polys(block([-0.4, -0.4, 0], [0.4, 0.4, 0.5], 48, [930, RING.y - 25]), ISO.wall)}
    {polys(block([-0.3, -0.3, 0], [0.3, 0.3, 0.4], 48, [840, RING.y - 23]), ISO.plastic)}
  </g>
);

const Arrow2: React.FC<{ x1: number; y1: number; x2: number; y2: number; color: string; k: number; w?: number }> = ({ x1, y1, x2, y2, color, k, w = 14 }) => {
  const ex = x1 + (x2 - x1) * k, ey = y1 + (y2 - y1) * k, a = Math.atan2(y2 - y1, x2 - x1), s = w * 2;
  return <g opacity={k > 0 ? 1 : 0}><line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={w} strokeLinecap="round" />
    <polygon points={`${ex},${ey} ${ex - s * Math.cos(a - 0.5)},${ey - s * Math.sin(a - 0.5)} ${ex - s * Math.cos(a + 0.5)},${ey - s * Math.sin(a + 0.5)}`} fill={color} /></g>;
};

const KICKER: Record<string, string> = { hook: "PELANGI", tetes: "DI DALAM TETES", cincin: "BENTUKNYA", cakrawala: "DARI TANAH", pesawat: "DARI PESAWAT", glory: "AWAS TERTUKAR", tips: "TIPS" };

const Scene = ({ beat, t, clock, story }: SceneProps) => {
  const amb = loopClock(clock, story.beats.reduce((a, b) => a + b.dur, 0));   // B29: the ambient motion runs on the loop clock
  useFonts();
  const c = clock, cam = cam2At(CAM, c), isOutro = beat.kind === "outro";
  const drop = slabDrop(c);
  // the ring: whole in the hook, gone while the drop is shown, drawn clockwise at the ring beat, whole to the end
  const ringOp = c < T.ringFade ? 1 : c < T.ringFade + 1 ? 1 - (c - T.ringFade) : c < T.sweep ? 0 : 1;
  const ringK = c >= T.sweep && c < T.sweepEnd ? easeInOut(clamp01((c - T.sweep) / (T.sweepEnd - T.sweep))) : 1;
  const shimmer = 0.93 + 0.07 * Math.sin(amb * Math.PI);
  const sunPulse = on(c, T.sunWarn, T.sunWarn + 1.6) * Math.abs(Math.sin((c - T.sunWarn) * 3));
  const axisK = clamp01((c - T.axis) / 0.8) * (1 - clamp01((c - 53.8) / 0.4));
  // the drop: the light path in and out (A = in, B = back, C = out)
  const dr = DROP, A = pt(dr.x, dr.y, dr.r, 215), B = pt(dr.x, dr.y, dr.r, 315), C = pt(dr.x, dr.y, dr.r, 55);
  const dropOn = on(c, T.ray - 0.8, 13.4);
  const rin = clamp01((c - T.rayIn) / 0.8), rbk = clamp01((c - T.rayBack) / 0.5), rbk2 = clamp01((c - T.rayBack - 0.55) / 0.5), rout = clamp01((c - T.rayOut) / 0.9);
  const start: [number, number] = [A[0] - 430 * Math.cos(6 * DEG), A[1] - 430 * Math.sin(6 * DEG)];
  const redEnd = pt(C[0], C[1], 380, 136), vioEnd = pt(C[0], C[1], 380, 152);
  const lerp = (p: readonly number[], q: readonly number[], k: number): [number, number] => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  const rin1 = lerp(start, A, rin), ab = lerp(A, B, rbk), bc = lerp(B, C, rbk2);
  // the plane (it comes in from the left once the ground has sunk) and its mist
  const planeK = easeInOut(clamp01((c - T.plane) / 2.0)) * (1 - clamp01((c - 54.4) / 1.2));
  const planeX = -200 + planeK * 800 + 10 * Math.sin(amb * 0.942), planeY = 860 + 8 * Math.sin(amb * 1.361 + 1);
  const mistOn = on(c, T.mist, 47.6);
  const glory = on(c, T.glory, 47.0);
  const Lab = (text: string, x: number, y: number, fs: number, a: number, b: number, hi?: string[]) =>
    c >= a && c < b + 0.4 ? <g opacity={on(c, a, b)}><Label text={text} x={x} y={y} fs={fs} t={c} start={a} highlight={hi} /></g> : null;
  const ringEdge = pt(RING.x, RING.y, RING.r + 52, -42);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 0.3)}><Sky clock={amb} pulse={sunPulse} /></g>
      <g transform={layerTransform(cam, 0.55)}>
        <IsoCloud u={120} o={[120 + 40 * Math.sin(amb / 10), 820]} cx={0} cy={0} cz={0} grow={0.9} haze={0.72} phase={amb / 6} />
        <IsoCloud u={120} o={[960 - 30 * Math.sin(amb / 12), 560]} cx={0} cy={0} cz={0} grow={0.85} haze={0.78} phase={amb / 6 + 0.3} />
        <IsoCloud u={110} o={[820 + 25 * Math.sin(amb / 7.5), 930]} cx={0} cy={0} cz={0} grow={0.7} haze={0.7} phase={amb / 6 + 0.6} />
      </g>
      <g transform={layerTransform(cam, 1)}>
        <Deck clock={amb} />
        {/* the rainbow ring, the plane's shadow on the deck, the mist */}
        <Ring cx={RING.x} cy={RING.y} r={RING.r} k={ringK} op={ringOp * shimmer} />
        {planeK > 0.5 && <ellipse cx={RING.x} cy={RING.y + 4} rx={78 * easeOutBack(clamp01((c - T.mist) / 0.6))} ry={26 * easeOutBack(clamp01((c - T.mist) / 0.6))} fill={ISO.cloudGrey[2]} opacity={0.5} />}
        {mistOn > 0.02 && <g opacity={mistOn * 0.8}>{Array.from({ length: 30 }, (_, i) => {
          const a = i * 2.399 + amb * 0.1047, r = 120 + ((i * 53) % 400), x = RING.x + r * Math.cos(a), y = RING.y + 0.8 * r * Math.sin(a) + 6 * Math.sin(amb * 1.361 + i);
          return <circle key={i} cx={x} cy={y} r={4 + (i % 3) * 2} fill={WHITE} stroke={ISO.water[0]} strokeWidth={2} opacity={0.7} />;
        })}</g>}
        {/* the small glory: a ring about the shadow, far smaller than the rainbow */}
        {glory > 0.02 && <Ring cx={RING.x} cy={RING.y + 4} r={34 * easeOutBack(clamp01((c - T.glory) / 0.7))} k={1} op={glory} sw={6} />}
        {/* the axis: from the sun through you to the point opposite it, with the 42 degrees angle */}
        {axisK > 0.01 && <g>
          <line x1={SUN.x} y1={SUN.y} x2={SUN.x + (RING.x - SUN.x) * axisK} y2={SUN.y + (RING.y - SUN.y) * axisK} stroke={YELLOW_D} strokeWidth={8} strokeDasharray="22 16" strokeLinecap="round" />
          <circle cx={RING.x} cy={RING.y} r={14 * springAt(c, T.axis + 0.6)} fill={BLACK} />
        </g>}
        {c >= T.angle && c < 53.6 && (() => {
          const k = clamp01((c - T.angle) / 0.7), e = pt(RING.x, RING.y, RING.r + 3 * BAND_W, -42);
          return <g opacity={on(c, T.angle, 53.4)}><line x1={RING.x} y1={RING.y} x2={RING.x + (e[0] - RING.x) * k} y2={RING.y + (e[1] - RING.y) * k} stroke={BLACK} strokeWidth={7} strokeLinecap="round" /></g>;
        })()}
        {Lab("titik seberang matahari", RING.x, RING.y + 90, 44, T.axisLbl, 23.4)}
        {Lab("42°", (RING.x + ringEdge[0]) / 2 + 36, (RING.y + ringEdge[1]) / 2 - 10, 62, T.angleLbl, 23.4, ["42"])}
        {Lab("pusat cincin", RING.x, RING.y + 150, 44, T.centreLbl, 23.8)}
        {/* the drop (a close shot, the camera pushes to it) */}
        {dropOn > 0.02 && <g opacity={dropOn}>
          <g transform={`translate(${dr.x} ${dr.y}) scale(${easeOutBack(clamp01((c - T.ray + 0.8) / 0.7))}) translate(${-dr.x} ${-dr.y})`}>
            <circle cx={dr.x + 8} cy={dr.y + 10} r={dr.r} fill={ISO.water[2]} />
            <circle cx={dr.x - 4} cy={dr.y - 4} r={dr.r * 0.94} fill={ISO.water[1]} opacity={0.9} />
            <circle cx={dr.x - dr.r * 0.22} cy={dr.y - dr.r * 0.24} r={dr.r * 0.62} fill={ISO.water[0]} opacity={0.5} />
            <ellipse cx={dr.x - dr.r * 0.45} cy={dr.y - dr.r * 0.5} rx={dr.r * 0.16} ry={dr.r * 0.1} fill={WHITE} opacity={0.8} transform={`rotate(-35 ${dr.x - dr.r * 0.45} ${dr.y - dr.r * 0.5})`} />
          </g>
          {rin > 0 && <line x1={start[0]} y1={start[1]} x2={rin1[0]} y2={rin1[1]} stroke={YELLOW} strokeWidth={12} strokeLinecap="round" />}
          {rbk > 0 && <line x1={A[0]} y1={A[1]} x2={ab[0]} y2={ab[1]} stroke={YELLOW} strokeWidth={9} strokeLinecap="round" />}
          {rbk2 > 0 && <line x1={B[0]} y1={B[1]} x2={bc[0]} y2={bc[1]} stroke={YELLOW} strokeWidth={9} strokeLinecap="round" />}
          {rout > 0 && <g>
            <line x1={C[0]} y1={C[1]} x2={C[0] + (redEnd[0] - C[0]) * rout} y2={C[1] + (redEnd[1] - C[1]) * rout} stroke={RED} strokeWidth={10} strokeLinecap="round" />
            <line x1={C[0]} y1={C[1]} x2={C[0] + (vioEnd[0] - C[0]) * rout} y2={C[1] + (vioEnd[1] - C[1]) * rout} stroke={VIOLET} strokeWidth={10} strokeLinecap="round" />
          </g>}
          {Lab("masuk", 610, 515, 44, T.lblIn, 13.2)}
          {Lab("memantul", B[0] - 70, B[1] - 62, 44, T.lblBack, 13.2)}
          {Lab("keluar", C[0] + 8, C[1] + 100, 44, T.lblOut, 13.2)}
          {Lab("merah", redEnd[0] + 18, redEnd[1] + 62, 44, T.lblColours, 13.2)}
          {Lab("ungu", vioEnd[0] - 26, vioEnd[1] - 46, 44, T.lblColours + 0.4, 13.2)}
        </g>}
        {/* the plane, above its shadow */}
        {planeK > 0.02 && <IsoPlane x={planeX} y={planeY} w={190} phase={amb / 3} />}
        {Lab("cincin utuh", RING.x, 1560, 62, T.lblPlane, 38.8, ["utuh"])}
        {Lab("pelangi 42°", RING.x, 850, 46, T.lblRain, 46.6, ["42°"])}
        {Lab("glory", RING.x + 4, RING.y - 74, 40, T.lblGlory, 46.6)}
        {Lab("5–20°", RING.x + 120, RING.y + 82, 42, T.lblSize, 46.6)}
        {/* tips: the sun at your back, the rainbow opposite it */}
        {Lab("matahari", SUN.x + 30, SUN.y - 110, 46, T.sunWarn + 0.3, 53.4)}
        {c >= T.backArrow && c < 53.8 && <g opacity={on(c, T.backArrow, 53.4)}><Arrow2 x1={SUN.x + 90} y1={SUN.y + 130} x2={RING.x - 90} y2={RING.y - 120} color={BLACK} k={easeInOut(clamp01((c - T.backArrow) / 1.2))} w={12} /></g>}
        {Lab("punggung ke matahari", 640, 650, 46, T.lblBack2, 53.4)}
        {Lab("pelangi di seberang", RING.x, 1560, 52, T.lblOpp, 53.6)}
        {/* the ground: one slab that rises to cut the ring at the horizon and sinks again; its lower half of the ring shows as a ghost while it hides */}
        <g transform={`translate(0 ${drop})`}><Ground /></g>
        {c >= T.hide && c < 33.4 && <g opacity={on(c, T.hide, 33.0) * 0.7}>
          <path d={`M${RING.x - RING.r - 3 * BAND_W} ${RING.y} A${RING.r + 3 * BAND_W} ${RING.r + 3 * BAND_W} 0 0 0 ${RING.x + RING.r + 3 * BAND_W} ${RING.y}`} fill="none" stroke={WHITE} strokeWidth={8} strokeDasharray="14 16" strokeLinecap="round" />
        </g>}
        {Lab("cakrawala", 800, RING.y - 190, 48, T.cutLbl, 32.6)}
        {Lab("separuh tersembunyi", RING.x, RING.y + 330, 50, T.cutLbl2, 32.8)}
      </g>
      {!isOutro && beat.kind !== "sting" && <TopText key={beat.id} kicker={KICKER[beat.id] ?? "PELANGI"} headline={beat.text} t={t} />}
      {!isOutro && beat.kind !== "sting" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={c} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1489) scale(${Math.max(0, p2)}) translate(-540 -1489)`}>
            <rect x={330} y={1443} width={420} height={92} rx={46} fill={YELLOW} />
            <text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={font}>Intip yuk!</text>
          </g>
        </g>;
      })()}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
