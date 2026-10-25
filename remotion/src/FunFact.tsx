/* The composition: a story (JSON) in, 1080 x 1920 at 30 fps out. Each beat is one scene; the video lasts the sum of the
   beats. The look is stop-motion: animation time moves in 12 fps steps and every object shakes a little between photos
   (stopmotion.ts), deterministically from the beat's id. The AI never writes any of this: it only fills the story. */
import React, { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BOLD, FONT_MONO, FRAME, G1, SHEET_TO_VIDEO as K } from "./tokens.ts";
import type { BeatT, ItemT, StoryT } from "./schema.ts";
import { jitter, stepIndex, stepTime } from "./stopmotion.ts";
import { Mascot } from "./components/Mascot.tsx";
import { Chibi } from "./components/Chibi.tsx";
import { Cutaway, HeatWaves, PlugIn, PlugStack, Smoke, SocketOutside, SOCKET_BOX } from "./components/Socket.tsx";
import { LensReveal } from "./components/LensReveal.tsx";
import { Banner, Black, Label, Pill, Room } from "./components/UI.tsx";

const FONTS = [
  { family: FONT_BOLD, file: "fonts/Outfit-Bold.ttf", weight: "700" },
  { family: FONT_BOLD, file: "fonts/Outfit-Regular.ttf", weight: "400" },
  { family: FONT_MONO, file: "fonts/DMMono-Regular.ttf", weight: "400" },
];

function useFonts(): void {
  const [handle] = useState(() => delayRender("loading the fonts"));
  useEffect(() => {
    Promise.all(FONTS.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(f.file)})`, { weight: f.weight });
      await face.load();
      (document.fonts as unknown as { add(f: FontFace): void }).add(face);
    })).then(() => continueRender(handle)).catch((err) => cancelRender(err));
  }, [handle]);
}

/** One object of a scene, by its type. Text pieces are not shaken (they must stay readable). */
const SceneItem: React.FC<{ item: ItemT; beatId: string; index: number; t: number; step: number }> = ({ item, beatId, index, t, step }) => {
  const j = jitter(beatId, index, step);
  const shake = (children: React.ReactNode) => <g transform={`translate(${j.dx} ${j.dy}) rotate(${j.rot})`}>{children}</g>;
  switch (item.type) {
    case "mascot":
      return shake(<Mascot x={item.x} y={item.y} w={item.w} expr={item.expr} t={t} sparks={item.sparks} rot={item.rot} pop={item.pop} body={item.body} />);
    case "chibi":
      return shake(
        <g transform={`translate(${item.x} ${item.y})`}>
          <Chibi u={item.u} expr={item.expr} pose={item.pose} costume={item.costume} t={t} />
        </g>);
    case "socket": {
      const k = K * item.s;
      if (item.view === "cutaway") {
        return shake(
          <g transform={`translate(${item.x} ${item.y}) scale(${k}) translate(${-SOCKET_BOX.w / 2} ${-SOCKET_BOX.h / 2})`}>
            <Cutaway loose={item.variant === "loose"} heat={item.heat ?? (item.variant === "loose" ? 1 : 0)} dots={item.dots ?? true} t={t} />
          </g>);
      }
      return shake(
        <g>
          {item.plug && <line x1={item.x} y1={item.y + 20 * k} x2={item.plug.cableX} y2={item.plug.cableY} stroke={G1} strokeWidth={7 * k} strokeLinecap="round" />}
          <g transform={`translate(${item.x} ${item.y}) scale(${k})`}>
            <SocketOutside scorched={item.variant === "scorched"} />
            {item.plug && <PlugIn />}
            {item.waves && <g transform={`translate(0 ${-50 / item.s}) scale(${0.9 / item.s})`}><HeatWaves t={t} /></g>}
            {item.smoke && <g transform={`scale(${1 / item.s})`}><Smoke t={t} /></g>}
          </g>
        </g>);
    }
    case "lens":
      return shake(<LensReveal id={`${beatId}-${index}`} x={item.x} y={item.y} r={item.r} variant={item.variant} heat={item.heat} t={t}
        revealFrom={item.reveal?.from} revealDur={item.reveal?.dur} />);
    case "stack":
      return shake(<g transform={`translate(${item.x} ${item.y}) scale(${K * item.s})`}><PlugStack /></g>);
    case "banner":
      return <Banner text={item.text} fs={item.fs} y={item.y} t={t} />;
    case "pill":
      return <Pill text={item.text} x={item.x} y={item.y} fs={item.fs} t={t} />;
    case "label":
      return <Label text={item.text} x={item.x} y={item.y} fs={item.fs} color={item.color} align={item.align} lines={item.lines} />;
  }
};

const BeatScene: React.FC<{ beat: BeatT }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = stepTime(frame, fps), step = stepIndex(frame, fps);
  return (
    <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ display: "block" }}>
      {beat.scene.bg === "room" ? <Room /> : <Black />}
      {beat.scene.items.map((item, i) => <SceneItem key={i} item={item} beatId={beat.id} index={i} t={t} step={step} />)}
    </svg>
  );
};

export const beatFrames = (story: StoryT, fps: number): number[] => story.beats.map((b) => Math.round(b.dur * fps));
export const totalFrames = (story: StoryT, fps: number): number => beatFrames(story, fps).reduce((a, b) => a + b, 0);
/** The first frame of each beat (for stills and for cutting the narration later). */
export const beatStarts = (story: StoryT, fps: number): number[] => {
  let at = 0;
  return beatFrames(story, fps).map((n) => { const s = at; at += n; return s; });
};

export const FunFact: React.FC<{ story: StoryT }> = ({ story }) => {
  useFonts();
  const { fps } = useVideoConfig();
  const starts = beatStarts(story, fps), lengths = beatFrames(story, fps);
  return (
    <>
      {story.beats.map((beat, i) => (
        <Sequence key={beat.id} from={starts[i]} durationInFrames={lengths[i]} layout="none">
          <BeatScene beat={beat} />
        </Sequence>
      ))}
    </>
  );
};
