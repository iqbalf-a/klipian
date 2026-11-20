/* Charger nyolok tanpa HP, listriknya tetap jalan? — look iso (B28): a power strip on a desk against a wall (set kind "desk-power-corner", see set.json), a charger
   plugged into it with nothing on its cable. B44, the feed look: frame 0 is the thumbnail: a huge black-box text (yellow key words), ONE big tired charger with eyes
   (72 % of the width) on a plain yellow background; the wall, the desk and the dressing fade in as the camera pulls back after the hook and fade out in the outro,
   so the last frame is the first (the hook text fades back in over the last 0.5 s, B41). One camera (plan.ts camAt) moves the world; the lens opens on the cut
   charger once (B27.6); labels and cards are on the screen. Ambient motion (the dashes, the lamp) runs on the loop clock (B29). */
import React from "react";
import {
  loopClock, BLACK, CaptionLayer, FONT_BOLD, FONT_MONO, Lab, StoryVideo, TopText, WHITE, YELLOW, YELLOW_D, clamp01, layerTransform, springAt, textWidth, toScreen,
  type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { NumberLabel } from "../../src/components/Overlays.tsx";
import { StingMark } from "../../src/components/StingMark.tsx";
import storyJson from "./story.json";
import { CARDS, LABELS, LENS, P3, camAt, lensAt, revealAt, switchOn } from "./plan.ts";
import { Cable, Charger, Cord, CutCharger, GhostPhone, Room, Strip, labPoint } from "./pieces.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { tanya: "CHARGER KOSONG", dalam: "DI DALAM", bukti: "TANPA HP", jawab: "DAYA SIAGA", tips: "TIPS" };
const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;

/** B44: the hook text in the caption's own language: a black box per line, the key words yellow, the rest white; 130 px, in the top third. */
const HookText: React.FC<{ clock: number }> = ({ clock }) => {
  const o = clock > 20 ? clamp01((clock - 39.45) / 0.45) : 1 - clamp01((clock - 2.7) / 0.3);   // frame 0 has it, the last 0.5 s of the outro brings it back
  if (o <= 0) return null;
  const fs = 130, h = 160;
  const lines: { y: number; parts: [string, boolean][] }[] = [
    { y: 190, parts: [["Charger ini", false]] },
    { y: 362, parts: [["masih ", false], ["makan", true]] },
    { y: 534, parts: [["listrik.", true]] },
  ];
  return (
    <g opacity={o}>
      {lines.map((ln) => {
        const ws = ln.parts.map(([s]) => textWidth(s, fs)), w = ws.reduce((a, b) => a + b, 0) + 70;
        let x = (W - w) / 2 + 35;
        return (
          <g key={ln.y}>
            <rect x={(W - w) / 2} y={ln.y} width={w} height={h} rx={42} fill={BLACK} />
            {ln.parts.map(([s, key], i) => { const px = x; x += ws[i]; return <text key={s} x={px} y={ln.y + 118} fontSize={fs} fill={key ? YELLOW : WHITE} style={bold}>{s}</text>; })}
          </g>
        );
      })}
    </g>
  );
};

const Card: React.FC<{ c: (typeof CARDS)[number]; clock: number }> = ({ c, clock }) => {
  const p = springAt(clock, c.a, true), o = 1 - clamp01((clock - c.out) / 0.4);
  if (clock < c.a || o <= 0) return null;
  return (
    <g transform={`translate(540 ${c.y + 85}) scale(${Math.max(0, p)}) translate(-540 ${-(c.y + 85)})`} opacity={o}>
      <rect x={110} y={c.y} width={690} height={170} rx={40} fill={BLACK} />
      <rect x={110} y={c.y + 28} width={12} height={114} rx={6} fill={YELLOW} />
      <text x={170} y={c.y + 84} fontSize={58} fill={YELLOW} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>{c.title}</text>
      <text x={170} y={c.y + 134} fontSize={36} fill={WHITE} style={{ fontFamily: `"${FONT_MONO}", monospace` }}>{c.sub}</text>
    </g>
  );
};

const LensRing: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => {
  if (r < 4 || r > 1300) return null;
  const ring = Math.max(10, 18 - r / 120), h = r * 0.72;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={BLACK} strokeWidth={ring} />
      <line x1={x + h} y1={y + h} x2={x + h + r * 0.42} y2={y + h + r * 0.42} stroke={YELLOW_D} strokeWidth={ring * 1.6} strokeLinecap="round" />
    </g>
  );
};

const Scene = ({ beat, t, clock, story: s }: SceneProps) => {
  const amb = loopClock(clock, s.beats.reduce((a, b) => a + b.dur, 0), 40);   // B29: ambient motion on the loop clock (a 40 s video)
  const cam = camAt(clock), on = switchOn(clock), reveal = revealAt(clock), L = lensAt(clock);
  const sting = beat.kind === "sting", outro = beat.kind === "outro", hook = beat.kind === "hook";
  const bodyScreen = toScreen(cam, P3(1.65, 0.95, 1.3));
  const lensR = L > 0 ? 1500 * (L * L * (3 - 2 * L)) : 0, inLab = L > 0, dark = clock >= LENS.full - 0.2 && clock < LENS.close + 0.4;
  const clipId = "charger-lens";
  const labEls = LABELS.filter((l) => clock >= l.from - 0.05 && clock < l.to + 0.4);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>{inLab && <clipPath id={clipId}><circle cx={bodyScreen[0]} cy={bodyScreen[1]} r={Math.max(0.1, lensR)} /></clipPath>}</defs>
      <rect width={W} height={H} fill={YELLOW} />
      <g transform={layerTransform(cam, 1)}>
        {reveal > 0.01 && <g opacity={reveal}><Room /></g>}
        {reveal > 0.01 && <g opacity={reveal}><Cord on={on} clock={amb} /></g>}
        <Strip on={on} clock={amb} />
        <Charger on={on} clock={amb} />
        {reveal > 0.01 && <g opacity={reveal}><GhostPhone clock={amb} /><Cable /></g>}
      </g>
      {labEls.filter((l) => l.world === "out").map((l) => {
        if (!("at" in l)) return null;
        const a = toScreen(cam, l.at);
        return <NumberLabel key={l.id} text={l.text} x={l.x} y={l.y} ax={a[0]} ay={a[1]} ring fs={46} t={clock} start={l.from} end={l.to} />;
      })}
      {/* inside the lens: the dark lab and the charger cut open */}
      {inLab && (
        <g clipPath={lensR < 1400 ? `url(#${clipId})` : undefined}>
          <Lab clock={clock} />
          <CutCharger clock={amb} on={on} />
          {labEls.filter((l) => l.world === "lab" && "n" in l).map((l) => {
            const p = l.id === "trafo" ? labPoint(0.45, 0.8) : labPoint(0.92, 1.26);
            return <NumberLabel key={l.id} text={l.text} n={"n" in l ? l.n : undefined} onDark x={l.id === "trafo" ? 230 : 800} y={l.id === "trafo" ? 760 : 700} ax={p[0]} ay={p[1]} fs={48} t={clock} start={l.from} end={l.to} />;
          })}
        </g>
      )}
      {inLab && lensR < 1400 && <LensRing x={bodyScreen[0]} y={bodyScreen[1]} r={lensR} />}
      {CARDS.map((c) => <Card key={c.id} c={c} clock={clock} />)}
      {dark && <rect width={W} height={380} fill={BLACK} opacity={0.0} />}
      {(hook || outro) && <HookText clock={clock} />}
      {sting && <StingMark slug="charger-nyolok-tanpa-hp-listri" t={t} clock={clock} />}
      {!hook && !sting && !outro && <TopText key={beat.id} kicker={KICKER[beat.id]} headline={beat.headline ?? beat.text} t={t} onDark={dark} />}
      {!sting && !outro && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
