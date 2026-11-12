/* Kipas angin tidak mendinginkan udara — a custom video (videos/kipas-angin-tidak-mendinginkan/). READ remotion/DESIGN.md FIRST.
   One set (B27): a wall and a table that run past every edge of the frame. The hero is the desk fan of the iso kit (IsoFan, its blades turning on their own clock) and the air it blows
   along the table: white streaks that run straight along the iso x axis. A standing thermometer stands in the stream (new asset 1) and a slab of skin lies further on (new asset 2);
   a cup and a pile of books are the dressing. The camera is a function of the video's clock (plan.ts camAt).
   What the video shows: the air runs past the thermometer and its level does not drop; on the skin the drops of sweat shrink and rise as vapour (the evaporation that cools us) while
   the heat of the skin is carried off by the stream; the motor's waste heat rises over the fan and the thermometer creeps up; the verdict (the skin is cooled, the air is not); the fan is
   switched off in the tip. Every word comes from the checked story. Colours are tokens (the ISO tone sets). */
import React from "react";
import {
  loopClock, BLACK, Brand, CaptionLayer, G3, ISO, IsoCup, IsoFan, Mascot, NumberLabel, Polys, RED, HOT1, HOT2, SourceChip, STEAM, StoryVideo, TopText, WHITE, YELLOW,
  block, circlePts, cylinder, easeInOut, isoAt, layerTransform, ptsAttr, riseAt, smoothPath, springAt, toScreen,
  type P2, type P3, type SceneProps, type StoryT, type Tones,
} from "../../src/design/index.ts";
import { HeatRise, Motes } from "../../src/components/Iso.tsx";
import { BOOKS_AT, CUP_AT, O, SLAB, THERMO, U, WALL_Y, camAt, fanClock, makePlan, stateAt, world } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const AX = [1, 0, 0] as const, AY = [0, 1, 0] as const;
const post = (x: number, y: number, z0: number, z1: number, r0: number, r1: number, u: number, o: P2) => cylinder([x, y, z0], [x, y, z1], r0, r1, AX, AY, u, o);

const HOT_TONES: Tones = [HOT1, HOT2, RED];                 // heat: light, mid, dark
const SKIN: Tones = ISO.brain;                              // a soft pink: skin (the body kit's tone, a soft one, not the red of danger)

// ------------------------------------------------------------------------------------------------------ the thermometer (new asset 1)
const Thermometer: React.FC<{ u: number; o: P2; temp: number }> = ({ u, o, temp }) => {
  const { x, y, h } = THERMO, tube = h - 0.35;
  return (
    <g>
      <Polys polys={post(x, y, 0, 0.12, 0.34, 0.3, u, o)} tones={ISO.dark} />
      <Polys polys={block([x - 0.11, y - 0.11, 0.12], [x + 0.11, y + 0.11, 0.12 + h], u, o)} tones={ISO.plastic} />
      <Polys polys={block([x - 0.045, y - 0.045, 0.2], [x + 0.045, y + 0.12, 0.2 + tube * temp + 0.1], u, o)} tones={HOT_TONES} />
      <Polys polys={post(x, y, 0.14, 0.34, 0.15, 0.15, u, o)} tones={HOT_TONES} />
      {[0.25, 0.5, 0.75, 1].map((k) => <Polys key={k} polys={block([x - 0.11, y + 0.11, 0.2 + tube * k], [x + 0.11, y + 0.125, 0.2 + tube * k + 0.025], u, o)} tones={ISO.dark} />)}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the skin with its sweat (new asset 2)
/** The drops of sweat on the skin: [x, y] on the slab's top face, and a size in units. */
const DROPS: readonly (readonly [number, number, number])[] = [[3.5, -0.4, 0.17], [4.1, -0.1, 0.14], [3.6, 0.3, 0.19], [4.2, 0.6, 0.13], [3.9, 0.1, 0.12], [3.4, 0.7, 0.14]];
const flat = (cx: number, cy: number, z: number, r: number, u: number, o: P2) => ptsAttr(circlePts(cx, cy, r, 20).map(([a, b]) => isoAt([a, b, z], u, o) as P2));
const Steam: React.FC<{ x: number; y: number; h: number; t: number; k: number; phase?: number }> = ({ x, y, h, t, k, phase = 0 }) => {
  if (k < 0.03) return null;
  const r = riseAt(t, phase, 3), a = Math.sin(Math.PI * r), sway = h * 0.12 * Math.sin(r * 6.2 + phase * 9);
  const p: P2[] = [0, 1, 2, 3].map((s) => [x + sway + h * 0.05 * Math.sin(s * 1.5 + r * 4), y - r * h - s * h * 0.12] as P2);
  return <path d={smoothPath(p, 0.5)} fill="none" stroke={STEAM} strokeWidth={Math.max(4, h * 0.05)} strokeLinecap="round" opacity={0.95 * a * k} />;
};
const Skin: React.FC<{ u: number; o: P2; sweat: number; evap: number; clock: number }> = ({ u, o, sweat, evap, clock }) => {
  const a = SLAB.a as unknown as P3, b = SLAB.b as unknown as P3, z = b[2];
  return (
    <g>
      <Polys polys={block(a, b, u, o)} tones={SKIN} />
      {DROPS.map(([x, y, r], i) => {
        const k = r * sweat * (1 - 0.85 * evap), c = isoAt([x, y, z + 0.01], u, o) as P2;
        return <g key={i}>
          <polygon points={flat(x, y, z + 0.01, Math.max(0.005, k), u, o)} fill={ISO.water[1]} stroke={ISO.water[2]} strokeWidth={u * 0.012} />
          <polygon points={flat(x - k * 0.25, y - k * 0.25, z + 0.012, Math.max(0.003, k * 0.35), u, o)} fill={ISO.water[0]} />
          <Steam x={c[0]} y={c[1] - u * 0.05} h={u * 0.9} t={clock} k={evap * sweat} phase={i / DROPS.length} />
        </g>;
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the air: white streaks that run along the iso x axis
const STREAKS: readonly (readonly [number, number])[] = [[-0.7, 1.95], [0.85, 1.5], [-0.7, 1.15], [0.85, 2.05]];
const AirStreaks: React.FC<{ u: number; o: P2; k: number; clock: number }> = ({ u, o, k, clock }) => {
  if (k < 0.03) return null;
  return (
    <g strokeLinecap="round" fill="none">
      {STREAKS.map(([y, z], i) => {
        const ph = (((clock / 1.5 + i / STREAKS.length) % 1) + 1) % 1, x0 = 0.55 + ph * 3.6, op = k * Math.sin(Math.PI * ph);
        const p: P2[] = Array.from({ length: 6 }, (_, s) => isoAt([x0 + s * 0.18, y + 0.07 * Math.sin(s * 1.2 + i * 2 + (clock * 2 * Math.PI * 29) / 60), z + 0.05 * Math.sin(s * 1.4 + i)], u, o) as P2);
        const d = smoothPath(p, 0.5);
        return <g key={i} opacity={op}><path d={d} stroke={G3} strokeWidth={u * 0.035} transform="translate(0 3)" opacity={0.5} /><path d={d} stroke={WHITE} strokeWidth={u * 0.035} /></g>;
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the dressing
const Books: React.FC<{ u: number; o: P2 }> = ({ u, o }) => (
  <g>
    <Polys polys={block([BOOKS_AT[0], BOOKS_AT[1], 0], [BOOKS_AT[0] + 1.3, BOOKS_AT[1] + 0.9, 0.2], u, o)} tones={ISO.labPlastic} />
    <Polys polys={block([BOOKS_AT[0] + 0.05, BOOKS_AT[1] + 0.05, 0.2], [BOOKS_AT[0] + 1.2, BOOKS_AT[1] + 0.85, 0.38], u, o)} tones={ISO.dark} />
    <Polys polys={block([BOOKS_AT[0] + 0.1, BOOKS_AT[1] + 0.08, 0.38], [BOOKS_AT[0] + 1.25, BOOKS_AT[1] + 0.8, 0.54], u, o)} tones={ISO.metal} />
  </g>
);
// the blades end on the pose they began on (the loop-back): the spin so far, plus a share of the part turn that is left at the end, so the whole run is whole turns
const fanTurned = (clock: number, total: number): number => { const rps = 2.2, end = rps * fanClock(total); return fanClock(clock) + ((Math.round(end) - end) / rps) * (clock / total); };
// ------------------------------------------------------------------------------------------------------ the picture
const Picture: React.FC<SceneProps> = ({ beat, t, clock, story: s }) => {
  const TOTAL = s.beats.reduce((a, b) => a + b.dur, 0), amb = loopClock(clock, TOTAL);   // B29: the ambient motion runs on the loop clock
  const P = React.useMemo(() => makePlan(s), [s]);
  const m = P.m, st = stateAt(clock), cam = camAt(clock), top = P.tops.find((x) => clock >= x.a && clock < x.b);
  const u = U, o = O;
  const lastBeat = beat.kind === "outro";
  const at = (p: P3): P2 => toScreen(cam, world(p));
  const Y = (y: number) => Math.max(480, Math.min(1440, y));
  const bt = t, L = (id: string) => beat.id === id;
  const motorTop = world([-0.3, 0, 2.0]);
  const slabTop = world([3.8, 0.1, 0.4]);
  const thermoTop = at([THERMO.x, THERMO.y, THERMO.h + 0.15]);
  const slabL = at([3.8, 0.1, 0.35]);
  return (
    <div style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
        {/* the far layer: the brand wall (the room's wall covers it, but it keeps the theme behind the set) */}
        <g transform={layerTransform(cam, 0.3)}><Brand clock={amb} spot={{ x: 540, y: 400 }} /></g>
        <g transform={layerTransform(cam, 1)}>
          {/* the wall, the table top and its cabinet run past the frame on every side */}
          <Polys polys={block([-90, WALL_Y - 0.6, -14], [90, WALL_Y, 40], u, o)} tones={ISO.wall} />
          <Polys polys={block([-90, WALL_Y, -14], [90, 7, -0.4], u, o)} tones={ISO.dark} />
          <Polys polys={block([-90, WALL_Y, -0.4], [90, 7, 0], u, o)} tones={ISO.floor} />
          <Books u={u} o={o} />
          <IsoCup u={u * 0.25} o={world([CUP_AT[0], CUP_AT[1], 0])} t={amb} />
          <Skin u={u} o={o} sweat={st.sweat} evap={st.evap} clock={amb} />
          <HeatRise x={slabTop[0]} y={slabTop[1] - 10} k={st.skinHeat} t={amb} scale={1.1} />
          <Thermometer u={u} o={o} temp={st.temp} />
          <IsoFan u={u} o={o} t={fanTurned(clock, TOTAL)} speed={1} />
          <HeatRise x={motorTop[0]} y={motorTop[1] + 30} k={st.motorHeat} t={amb + 0.4} scale={0.6} />
          <AirStreaks u={u} o={o} k={st.air} clock={amb} />
        </g>
        {cam.zoom < 2.2 && <g transform={layerTransform(cam, 1.35)}><Motes t={amb} color={WHITE} opacity={0.3} n={8} /></g>}

        {/* labels on their parts (screen px through the camera, beat-local time) */}
        {L("udara") && bt > 0.8 && bt < 4.6 && <NumberLabel text="angin" x={250} y={Y(at([0.9, 0, 1.65])[1] - 170)} ax={at([0.9, 0, 1.65])[0]} ay={at([0.9, 0, 1.65])[1]} fs={46} t={t} start={0.9} end={4.5} />}
        {L("udara") && bt > 5.4 && bt < 8.8 && <NumberLabel text="suhu tetap" x={800} y={Y(thermoTop[1] - 100)} ax={thermoTop[0]} ay={thermoTop[1]} fs={46} t={t} start={5.5} end={8.7} />}
        {L("badan") && bt > 2.6 && bt < 6.6 && <NumberLabel text="keringat" x={820} y={Y(slabL[1] - 230)} ax={slabL[0]} ay={slabL[1]} fs={46} t={t} start={2.7} end={6.5} />}
        {L("badan") && bt > 4.6 && bt < 9.6 && <NumberLabel text="menguap" x={260} y={Y(slabL[1] - 330)} ax={slabL[0] - 30} ay={slabL[1] - 130} fs={46} t={t} start={4.7} end={9.5} />}
        {L("badan") && bt > 9.8 && bt < 14.6 && <NumberLabel text="panas terbawa" red x={810} y={Y(slabL[1] - 420)} ax={slabL[0] + 20} ay={slabL[1] - 200} fs={46} t={t} start={9.9} end={14.5} />}
        {L("motor") && bt > 1.4 && bt < 5.4 && <NumberLabel text="panas motor" red x={810} y={Y(at([-0.3, 0, 2.0])[1] - 200)} ax={at([-0.3, 0, 2.0])[0]} ay={at([-0.3, 0, 2.0])[1]} fs={46} t={t} start={1.5} end={5.3} />}
        {L("hasil") && bt > 1.6 && bt < 6.8 && <NumberLabel text="kulit: dingin" x={810} y={Y(slabL[1] - 160)} ax={slabL[0]} ay={slabL[1]} fs={46} t={t} start={1.7} end={6.7} />}
        {L("hasil") && bt > 3.0 && bt < 7.2 && <NumberLabel text="udara: sama" x={830} y={Y(thermoTop[1] - 190)} ax={thermoTop[0]} ay={thermoTop[1]} fs={46} t={t} start={3.1} end={7.1} />}
        {L("tips") && bt > 0.6 && bt < 5.0 && <NumberLabel text="kosong? matikan" x={540} y={Y(560)} ax={at([0.2, 0, 2.5])[0]} ay={at([0.2, 0, 2.5])[1]} fs={46} t={t} start={0.7} end={4.9} />}
        {L("tips") && bt > 5.4 && bt < 10.8 && <NumberLabel text="bau gosong? cabut, tanya teknisi" red x={540} y={Y(560)} ax={at([-0.3, 0, 1.65])[0]} ay={at([-0.3, 0, 1.65])[1]} fs={44} t={t} start={5.5} end={10.7} />}

        {/* the sources */}
        {L("udara") && bt > 6.6 && bt < 8.9 && <SourceChip x={90} y={1500} text="Wikipedia: Ceiling fan" t={t} start={6.7} end={8.8} />}
        {L("badan") && bt > 7.0 && bt < 9.5 && <SourceChip x={90} y={1500} text="Wikipedia: Perspiration" t={t} start={7.1} end={9.4} />}
        {L("motor") && bt > 5.2 && bt < 7.9 && <SourceChip x={90} y={1500} text="Wikipedia: Ceiling fan" t={t} start={5.3} end={7.8} />}
        {L("hasil") && bt > 5.0 && bt < 7.5 && <SourceChip x={90} y={1500} text="Wikipedia: Fan (machine)" t={t} start={5.1} end={7.4} />}

        {/* the mascot: the small "Intip yuk!" sting (no veil: the world keeps moving behind it) */}
        {clock >= m.sting - 0.1 && clock < m.stingEnd + 0.15 && (() => {
          const p = springAt(clock, m.sting), out2 = 1 - easeInOut(clamp01((clock - m.stingEnd + 0.18) / 0.25));
          const mx = 400, my = 440, px = 700, py = 440, pillW = 300;
          return <g>
            <g transform={`translate(${mx} ${my}) scale(${Math.max(0, p) * out2}) translate(${-mx} ${-my})`}><Mascot x={mx} y={my} w={200} expr="curious" t={clock - m.sting} clock={clock} squash={0.18 * (1 - p)} /></g>
            <g transform={`translate(${px} ${py}) scale(${Math.max(0, springAt(clock, m.sting + 0.25)) * out2}) translate(${-px} ${-py})`}>
              <rect x={px - pillW / 2} y={py - 46} width={pillW} height={92} rx={46} fill={YELLOW} />
              <text x={px} y={py + 18} fontSize={52} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>Intip yuk!</text>
            </g>
          </g>;
        })()}

        {/* the channel's text: the kicker and headline at the top, the caption at the bottom */}
        {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={clock - top.a} />}
        {!lastBeat && beat.kind !== "sting" && <CaptionLayer beat={beat} t={t} />}
      </svg>
    </div>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={(sp) => <Picture {...sp} />} layoutDebug={p.layoutDebug} />;
