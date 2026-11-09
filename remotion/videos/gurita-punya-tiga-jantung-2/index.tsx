/* Gurita punya tiga jantung! Kok bisa? — a custom video (videos/gurita-punya-tiga-jantung-2/). READ remotion/DESIGN.md FIRST.
   One set (B27): a seabed under the sea (far ridge and kelp at parallax 0.3, the sand with rocks and kelp at p = 1, bubbles near the lens), the octopus resting on it.
   The hook opens on the wide shot, the camera pushes to the octopus, then each explain beat is a push or a pan inside the same set (plan.ts camAt); the three hearts
   show through the mantle (a pale window), the blood runs along its vessels, and the octopus swims once (the hearts stop). The outro eases back to the wide shot.
   Every word comes from the checked story (banner and label items of each beat). Colours are tokens (ISO tone sets), shapes are flat three-tone. */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, IsoBlock, TopText, ISO, IsoHeart, Label, Mascot, Pill, StoryVideo, WHITE, blinkClosed, loopClock, easeInOut, riseAt, smoothPath, springAt,
  type BeatT, type P2, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { WORLD, camAt, heartClock, layerCam, swimAt, toScreen, type Cam } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const wob = (clock: number, period: number, phase = 0) => Math.sin(TAU * (clock / period + phase));       // the periods divide 60 s: the loop-back matches when the clock fed in is the loop clock `amb` (Scene)
const win = (c: number, a: number, b: number) => easeInOut(clamp01((c - a) / 0.5)) * (1 - easeInOut(clamp01((c - b) / 0.5)));
const camTf = (c: Cam) => `translate(540 960) scale(${c.z}) translate(${-c.cx} ${-c.cy})`;

// the sea's tones: flat bands of the water set, the far back paler, the deep darker
const SEA_TOP = ISO.water[0], SEA_MID = mixRgb(ISO.water[0], ISO.water[1], 0.4), SEA_LOW = mixRgb(ISO.water[0], ISO.water[1], 0.75);
const FAR_RIDGE = mixRgb(ISO.water[0], ISO.water[1], 0.55), FAR_RIDGE_2 = mixRgb(ISO.water[0], ISO.cloudWhite[0], 0.3);
const FAR_KELP = mixRgb(ISO.leaf[1], ISO.water[0], 0.55);
const X0 = -2600, X1 = 3700, Y_BOTTOM = 4200;

// ------------------------------------------------------------------------------------------------------ the set
const Ridge: React.FC<{ y: number; fill: string; seed: number }> = ({ y, fill, seed }) => {
  const pts: P2[] = [];
  for (let x = X0; x <= X1; x += 260) pts.push([x, y - 70 - 60 * Math.sin(x / 410 + seed) - 40 * Math.sin(x / 170 + seed * 2)]);
  return <path d={`${smoothPath(pts, 0.5)} L ${X1} ${Y_BOTTOM} L ${X0} ${Y_BOTTOM} Z`} fill={fill} />;
};

const Kelp: React.FC<{ x: number; y: number; h: number; w: number; clock: number; phase: number; period?: number; tones: readonly [string, string, string] }> = ({ x, y, h, w, clock, phase, period = 4, tones }) => {
  const N = 9, left: P2[] = [], right: P2[] = [], lite: P2[] = [];
  for (let k = 0; k <= N; k++) {
    const s = k / N, cx = x + (14 + 22 * Math.sin(phase)) * s + 26 * Math.pow(s, 1.4) * wob(clock, period, phase - s * 0.35), hw = (w * (1 - 0.65 * s)) / 2, cy = y - h * s;
    left.push([cx - hw, cy]); right.push([cx + hw, cy]); lite.push([cx - hw * 0.1, cy]);
  }
  const back = (pts: P2[]) => smoothPath([...pts].reverse(), 0.5).replace(/^M [^C]*/, "");
  return (
    <g>
      <path d={`${smoothPath(left, 0.5)} L ${right[N][0]} ${right[N][1]} ${back(right)} Z`} fill={tones[2]} />
      <path d={`${smoothPath(left, 0.5)} L ${lite[N][0]} ${lite[N][1]} ${back(lite)} Z`} fill={tones[1]} />
    </g>
  );
};

/** A stone of the seabed built from the iso kit (src/iso.ts block through IsoBlock): two stacked boxes in the stone tones. (x, y) is the middle of the base on the sand, w the width on screen. */
const Rock: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => {
  const k = 2.2, u = w / (2 * 0.866 * k), hz = h / u;
  const o: P2 = [x, y - 2 * 0.5 * k * u];                      // the lowest corner of the base touches the sand at y
  return (
    <g>
      <IsoBlock a={[0, 0, 0]} b={[k, k, hz * 0.9]} u={u} o={o} tones={ISO.stone} />
      <IsoBlock a={[k * 0.35, k * 0.3, hz * 0.9]} b={[k * 0.8, k * 0.75, hz * 1.25]} u={u} o={o} tones={ISO.stone} />
    </g>
  );
};

// the front of the seabed (nearer the lens: lower on the sand): small rocks and seagrass tufts
const FRONT_ROCKS = [{ x: 250, y: 1620, w: 170, h: 120 }, { x: 860, y: 1700, w: 210, h: 150 }, { x: -380, y: 1680, w: 220, h: 150 }, { x: 1420, y: 1620, w: 190, h: 130 }, { x: 560, y: 1860, w: 180, h: 110 }];
const TUFTS = [-120, 120, 420, 700, 980, 1240, 1500, -420].map((x, i) => ({ x, y: 1480 + (i % 3) * 140 + (i % 2) * 60, h: 150 + (i % 4) * 30 }));
const ROCKS = [
  { x: -70, y: 1300, w: 270, h: 300 }, { x: 1150, y: 1305, w: 270, h: 250 }, { x: -520, y: 1290, w: 300, h: 230 }, { x: 1620, y: 1300, w: 300, h: 330 },
  { x: -1100, y: 1295, w: 340, h: 260 }, { x: 2200, y: 1300, w: 320, h: 280 },
];
const KELPS = [
  { x: -250, h: 820, w: 46, ph: 0.4 }, { x: 40, h: 560, w: 38, ph: 1.7 }, { x: 1010, h: 640, w: 40, ph: 2.6 }, { x: 1300, h: 900, w: 48, ph: 0.9 },
  { x: -800, h: 760, w: 44, ph: 2.1 }, { x: 1880, h: 700, w: 44, ph: 1.2 }, { x: -1400, h: 840, w: 46, ph: 0.2 }, { x: 2500, h: 800, w: 46, ph: 2.9 },
];

const Seabed: React.FC = () => (
  <g>
    <rect x={X0} y={WORLD.floorY - 12} width={X1 - X0} height={46} fill={ISO.sand[0]} />
    <rect x={X0} y={WORLD.floorY + 34} width={X1 - X0} height={420} fill={ISO.sand[1]} />
    <rect x={X0} y={WORLD.floorY + 454} width={X1 - X0} height={Y_BOTTOM} fill={ISO.sand[2]} />
    {Array.from({ length: 24 }, (_, i) => {
      const x = X0 + 160 + i * 270, y = WORLD.floorY + 110 + (i % 3) * 120;
      return <path key={i} d={`M ${x} ${y} q 60 -16 120 0`} fill="none" stroke={ISO.sand[2]} strokeWidth={9} strokeLinecap="round" />;
    })}
  </g>
);

/** Bubbles that rise past the lens (the near layer: loose things that touch nothing). */
const Bubbles: React.FC<{ clock: number }> = ({ clock }) => (
  <g>
    {Array.from({ length: 16 }, (_, i) => {
      const k = riseAt(clock, i / 16, 6), x = -300 + ((i * 197) % 1700) + 18 * wob(clock, 3, i * 0.31), y = 1500 - k * 1700, r = 7 + (i % 4) * 4;
      return (
        <g key={i} opacity={Math.sin(Math.PI * k) * 0.85}>
          <circle cx={x} cy={y} r={r} fill="none" stroke={WHITE} strokeWidth={3} />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.2} fill={WHITE} />
        </g>
      );
    })}
  </g>
);

// ------------------------------------------------------------------------------------------------------ the octopus
const armPoints = (i: number, clock: number, lift: number): P2[] => {
  const side = i < 4 ? -1 : 1, bx = 410 + i * (260 / 7), by = 1090;
  const th0 = 90 + (3.5 - i) * 13, thH = side < 0 ? 178 : 2, L = [270, 285, 300, 310, 310, 300, 285, 270][i] * (1 + 0.18 * lift), K = 7;
  const swimAng = 90 - side * 8;
  const pts: P2[] = [[bx, by]];
  let p: P2 = [bx, by];
  for (let k = 1; k <= K; k++) {
    const s = k / K, rest = th0 + (thH - th0) * Math.pow(s, 0.9) + (6 + 12 * s) * wob(clock, 3, -s * 0.55 + i * 0.13);
    const ang = ((rest + (swimAng + 14 * wob(clock, 2, s * 0.5 + i * 0.1) - rest) * lift) * Math.PI) / 180;
    p = [p[0] + (L / K) * Math.cos(ang), Math.min(p[1] + (L / K) * Math.sin(ang), WORLD.floorY - 8 + 600 * lift)];
    pts.push(p);
  }
  return pts;
};

const Arm: React.FC<{ pts: P2[] }> = ({ pts }) => {
  const K = pts.length - 1, wAt = (s: number) => 40 * (1 - s) + 9;
  return (
    <g strokeLinecap="round">
      {pts.slice(1).map((p, k) => <line key={`d${k}`} x1={pts[k][0] + 5} y1={pts[k][1] + 6} x2={p[0] + 5} y2={p[1] + 6} stroke={ISO.brain[2]} strokeWidth={wAt((k + 0.5) / K)} />)}
      {pts.slice(1).map((p, k) => <line key={`m${k}`} x1={pts[k][0]} y1={pts[k][1]} x2={p[0]} y2={p[1]} stroke={ISO.brain[1]} strokeWidth={wAt((k + 0.5) / K) - 4} />)}
      {pts.slice(1).map((p, k) => <line key={`l${k}`} x1={pts[k][0] - 2} y1={pts[k][1] - 4} x2={p[0] - 2} y2={p[1] - 4} stroke={ISO.brain[0]} strokeWidth={Math.max(3, (wAt((k + 0.5) / K) - 4) * 0.3)} opacity={0.9} />)}
      {pts.slice(2, K).map((p, k) => <circle key={`s${k}`} cx={p[0]} cy={p[1] + 3} r={Math.max(2.5, (wAt((k + 2.5) / K)) * 0.14)} fill={ISO.brain[2]} opacity={0.55} />)}
    </g>
  );
};

const GILL_BASE: P2 = [480, 915];
const gillFan = (mirror: boolean): P2[][] => Array.from({ length: 6 }, (_, k) => {
  const a = ((-112 - k * 12) * Math.PI) / 180, len = 46 + (k % 2) * 12, m = (x: number) => (mirror ? 1080 - x : x);
  return [[m(GILL_BASE[0]), GILL_BASE[1]], [m(GILL_BASE[0] + len * Math.cos(a)), GILL_BASE[1] + len * Math.sin(a)]] as P2[];
});

const BR_L: P2 = [468, 942], BR_R: P2 = [612, 942], SYS: P2 = [540, 832];
const VESSEL_L: P2[] = [[468, 925], [452, 893], [466, 858], [508, 838]];
const VESSEL_R: P2[] = VESSEL_L.map(([x, y]) => [1080 - x, y] as P2);
const TRUNK: P2[] = [[540, 862], [540, 920], [538, 985], [540, 1070]];
const pointAt = (pts: P2[], s: number): P2 => {
  const f = clamp01(s) * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(f)), q = f - j;
  return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * q, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * q];
};
const lineOf = (pts: P2[]) => smoothPath(pts, 0.5);

const Vessel: React.FC<{ pts: P2[]; clock: number; w: number; r: number; period: number; phase?: number; show: number }> = ({ pts, clock, w, r, period, phase = 0, show }) => (
  <g opacity={show}>
    <path d={lineOf(pts)} fill="none" stroke={ISO.water[2]} strokeWidth={w} strokeLinecap="round" />
    {Array.from({ length: 5 }, (_, i) => { const p = pointAt(pts, riseAt(clock, i / 5 + phase, period)); return <circle key={i} cx={p[0]} cy={p[1]} r={r} fill={ISO.water[0]} />; })}
  </g>
);

const Octopus: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const sw = swimAt(clock), hc = heartClock(clock);
  const reveal = easeInOut(clamp01((clock - 3.6) / 0.8)) * (1 - easeInOut(clamp01((clock - 56) / 1.5)));
  const sys = Math.max(win(clock, 4, 11), win(clock, 21, 29), win(clock, 44, 56));
  const bran = Math.max(win(clock, 11, 19), win(clock, 44, 56));
  const opSys = 1 - 0.5 * win(clock, 11, 19), opBran = 1 - 0.5 * win(clock, 4, 11);
  const vess = win(clock, 19.5, 36.5), vessBig = 1 + 0.4 * win(clock, 29.5, 36);
  const tilt = -12 * sw.lift, bob = 5 * wob(amb, 3), breathe = 1 + 0.012 * wob(amb, 3);
  const look = [7 * wob(amb, 5), 3 * wob(amb, 4, 0.25)];
  const lid = blinkClosed(amb, 3, 0.3);
  const jets = Array.from({ length: 9 }, (_, j) => ({ j, age: clock - 37.6 - j * 0.16 })).filter((b) => b.age > 0 && b.age < 1.3);
  const eye = (cx: number) => (
    <g>
      <ellipse cx={cx} cy={1032} rx={36} ry={32} fill={ISO.brain[2]} />
      <ellipse cx={cx} cy={1030} rx={33} ry={29} fill={WHITE} />
      <rect x={cx - 17 + look[0]} y={1021 + look[1]} width={34} height={13} rx={6} fill={BLACK} />
      <ellipse cx={cx} cy={1030 - 29 * (1 - lid)} rx={34} ry={Math.max(0.1, 29 * lid)} fill={ISO.brain[1]} />
    </g>
  );
  return (
    <g transform={`translate(${sw.off} ${-sw.lift * 260 + bob}) rotate(${tilt} 540 1000)`}>
      {/* the water squirted out when it swims */}
      {jets.map((b) => <circle key={b.j} cx={420 - 200 * b.age} cy={1010 + 40 * b.age} r={10 + 14 * b.age} fill="none" stroke={WHITE} strokeWidth={4} opacity={Math.sin((Math.PI * b.age) / 1.3)} />)}
      {Array.from({ length: 8 }, (_, i) => <Arm key={i} pts={armPoints(i, amb, sw.lift)} />)}
      <g transform={`translate(540 840) scale(${breathe}) translate(-540 -840)`}>
        <ellipse cx={552} cy={854} rx={170} ry={190} fill={ISO.brain[2]} />
        <ellipse cx={540} cy={840} rx={170} ry={190} fill={ISO.brain[1]} />
        <ellipse cx={500} cy={790} rx={112} ry={118} fill={ISO.brain[0]} opacity={0.9} />
        {/* the window: the mantle is pale where the hearts show through */}
        <ellipse cx={540} cy={852} rx={146} ry={150} fill={ISO.cloudWhite[0]} opacity={0.62 * reveal} />
        <g opacity={reveal}>
          {[false, true].map((mirror) => gillFan(mirror).map((l, k) => <line key={`${mirror}${k}`} x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} stroke={ISO.brain[2]} strokeWidth={7} strokeLinecap="round" />))}
          <Vessel pts={VESSEL_L} clock={clock} w={9 * vessBig} r={5} period={3} show={vess} />
          <Vessel pts={VESSEL_R} clock={clock} w={9 * vessBig} r={5} period={3} show={vess} />
          <Vessel pts={TRUNK} clock={clock} w={17 * vessBig} r={8} period={2} show={vess} />
          <g opacity={opBran}>
            <IsoHeart u={30 * (1 + 0.14 * bran)} o={BR_L} t={hc} bpm={72} />
            <IsoHeart u={30 * (1 + 0.14 * bran)} o={BR_R} t={hc + 0.2} bpm={72} />
          </g>
          <g opacity={opSys}><IsoHeart u={54 * (1 + 0.12 * sys)} o={SYS} t={hc} bpm={72} /></g>
        </g>
      </g>
      <ellipse cx={546} cy={1046} rx={200} ry={86} fill={ISO.brain[2]} />
      <ellipse cx={540} cy={1036} rx={200} ry={86} fill={ISO.brain[1]} />
      <ellipse cx={490} cy={1008} rx={120} ry={34} fill={ISO.brain[0]} opacity={0.8} />
      {eye(468)}{eye(612)}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the picture
/** The label items of a beat, in order (their text is the story's). The anchor is a world point on the octopus. */
const ANCHORS: Record<string, P2[]> = {
  utama: [SYS], insang: [BR_L, BR_R], tekanan: [[455, 870], [SYS[0], SYS[1] + 20]], biru: [[540, 960]], hasil: [SYS], renang: [SYS], ringkas: [SYS, [BR_R[0], BR_R[1]]],
};
const LABEL_AT = (beat: BeatT, k: number) => {
  const n = ANCHORS[beat.id]?.length ?? 1;
  return 0.6 + (k * (beat.dur - 1.6)) / Math.max(1, n);
};

const Labels: React.FC<{ beat: BeatT; t: number; clock: number; cam: Cam }> = ({ beat, t, clock, cam }) => {
  const items = beat.scene.items.filter((i) => i.type === "label");
  const anchors = ANCHORS[beat.id] ?? [];
  const sw = swimAt(clock);
  return (
    <g>
      {items.map((it, k) => {
        if (it.type !== "label" || !anchors[k]) return null;
        const start = LABEL_AT(beat, k), a = anchors[k], n = items.length;
        const [ax, ay] = toScreen(cam, a[0] + sw.off, a[1] - sw.lift * 260);
        const [, topY] = toScreen(cam, 540, 650 - sw.lift * 260);
        const lx = n === 1 ? 540 : k === 0 ? 335 : 745, ly = Math.max(500, Math.min(580, topY - 70));
        const p = clamp01((t - start) / 0.3);
        if (p <= 0) return null;
        const fs = n === 1 ? 54 : 44;
        return (
          <g key={k} opacity={p}>
            <line x1={lx} y1={ly + fs * 0.7} x2={ax} y2={ay} stroke={BLACK} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
            <circle cx={ax} cy={ay} r={9} fill={BLACK} />
            <Label text={it.text} x={lx} y={ly} fs={fs} t={t} start={start} />
          </g>
        );
      })}
    </g>
  );
};

const Scene = ({ beat, t, clock, story }: SceneProps) => {
  // the loop clock: the ambient motion (kelp, bubbles, waves, arms) has periods that divide 60 s, so it runs on the video's clock scaled to 60 s: one whole number of cycles whatever the voice makes the length (the last frame matches the first)
  const amb = loopClock(clock, story.beats.reduce((a, b) => a + b.dur, 0));
  const cam = camAt(clock), far = layerCam(cam, 0.3), near = layerCam(cam, 1.3);
  // the wave of the surface (seen in the wide shot): its period divides the video so the loop-back matches
  const wave: P2[] = [];
  for (let x = X0; x <= X1; x += 120) wave.push([x, WORLD.surfaceY + 9 * Math.sin(TAU * (x / 360 - amb / 4))]);
  const stingP = beat.kind === "sting" ? springAt(t, 0) * (1 - easeInOut(clamp01((t - 0.8) / 0.2))) : 0;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <Brand clock={0} spot={{ x: 540, y: -900, r: 300 }} />
      <g transform={camTf(cam)}>
        <path d={`${smoothPath(wave, 0.5)} L ${X1} ${Y_BOTTOM} L ${X0} ${Y_BOTTOM} Z`} fill={SEA_TOP} />
        <rect x={X0} y={620} width={X1 - X0} height={560} fill={SEA_MID} />
        <rect x={X0} y={1180} width={X1 - X0} height={Y_BOTTOM} fill={SEA_LOW} />
        <path d={smoothPath(wave, 0.5)} fill="none" stroke={WHITE} strokeWidth={8} strokeLinecap="round" opacity={0.9} />
      </g>
      <g transform={camTf(far)}>
        <Ridge y={1040} fill={FAR_RIDGE_2} seed={0.7} />
        <Ridge y={1130} fill={FAR_RIDGE} seed={2.4} />
        {[-900, -380, 260, 820, 1450, 2000].map((x, i) => <Kelp key={x} x={x} y={1090} h={440 + (i % 3) * 90} w={30} clock={amb} phase={i * 1.3} period={5} tones={[FAR_KELP, FAR_KELP, mixRgb(FAR_KELP, FAR_RIDGE, 0.5)]} />)}
      </g>
      <g transform={camTf(cam)}>
        <Seabed />
        {KELPS.map((k) => <Kelp key={k.x} x={k.x} y={WORLD.floorY + 8} h={k.h} w={k.w} clock={amb} phase={k.ph} tones={ISO.leaf} />)}
        {ROCKS.map((r) => <Rock key={r.x} {...r} />)}
        {TUFTS.map((k, i) => [-1, 0, 1].map((d) => <Kelp key={`${i}${d}`} x={k.x + d * 26} y={k.y} h={k.h - Math.abs(d) * 30} w={16} clock={amb} phase={i + d} period={3} tones={ISO.leaf} />))}
        {FRONT_ROCKS.map((r) => <Rock key={`f${r.x}`} {...r} />)}
        <Octopus clock={clock} amb={amb} />
      </g>
      <g transform={camTf(near)}><Bubbles clock={amb} /></g>

      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText kicker={beat.kicker} headline={beat.headline ?? beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <Labels beat={beat} t={t} clock={clock} cam={cam} />}
      {stingP > 0.001 && (
        <g>
          <g transform={`translate(200 600) scale(${stingP}) translate(-200 -600)`}><Mascot x={200} y={600} w={220} expr="curious" t={t} clock={clock} squash={0.18 * (1 - stingP)} /></g>
          <g transform={`translate(540 1489) scale(${stingP}) translate(-540 -1489)`}><Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} /></g>
        </g>
      )}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
