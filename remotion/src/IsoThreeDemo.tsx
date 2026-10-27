/* The Three.js orthographic spike, round 2 (an experiment, not a video): the socket and the plug of "Kenapa colokan bisa panas?" as real 3D geometry
   with an OrthographicCamera along (1, 1, 1) and the tone-by-normal material of src/three/isoTone.ts, on the colokan's own framing (OUT.u, OUT.o and the
   2D camera at each time), with the real Brand background in SVG behind a transparent 3D canvas, and the video's own CaptionLayer and one number label
   over it. Every state (the gap, the heat, the scorch, the outline) comes from the colokan plan; every word from the story. Nothing here changes an
   existing video. `props.t` (seconds of the colokan timeline) fixes the time for a still; otherwise the demo plays 33.5 s to 39.5 s. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Brand, FPS, FRAME, useFonts } from "./design/index.ts";
import { ISO } from "./tokens.ts";
import { layerTransform, toScreen } from "./iso.ts";
import { makeIsoCamera } from "./three/isoCamera.ts";
import { IsoSocket3D } from "./three/IsoSocket3D.tsx";
import { IsoPlug3D } from "./three/IsoPlug3D.tsx";
import { CaptionLayer } from "./components/Captions.tsx";
import { NumberLabel } from "./components/Overlays.tsx";
import { makePlan, OUT } from "../videos/kenapa-colokan-panas/plan.ts";
import { validateStory } from "./schema.ts";
import storyJson from "../videos/kenapa-colokan-panas/story.json";

export const ISO_THREE_SECONDS = 6;
const story = validateStory(storyJson);
if (!story.ok) throw new Error(story.errors.join("\n"));
const plan = makePlan(story.story);
const TIP_TAG = plan.labels.find((l) => l.id === "plate")?.text ?? "";

/** The demo at colokan time `t`: the camera, the states, the background and the captions. */
export const IsoThreeFrame: React.FC<{ t: number }> = ({ t }) => {
  useFonts();
  const st = plan.state(t), cam2 = plan.outCam(t);
  // the 2D camera of the video at this time, as the 3D camera: its zoom scales the unit and the origin goes where the 2D camera puts it
  const origin = toScreen(cam2, OUT.o) as [number, number];
  const camera = React.useMemo(() => makeIsoCamera(FRAME.width, FRAME.height, OUT.u * cam2.zoom, origin), [cam2.zoom, origin[0], origin[1]]);
  const nodes = plan.cableAt(t);
  const beat = story.story.beats.find((b) => t >= plan.beat(b.id).a && t < plan.beat(b.id).b) ?? story.story.beats[story.story.beats.length - 1];
  const bt = t - plan.beat(beat.id).a;
  const heat = st.outHeat * (1 - st.gap / 1.6);
  const labelOn = t >= plan.m.replace && t < plan.m.outro;
  return (
    <AbsoluteFill style={{ background: ISO.wall[0] }}>
      {/* the real background in SVG, as the video draws it (the far layer of the outside scene) */}
      <svg width={FRAME.width} height={FRAME.height} style={{ position: "absolute", inset: 0 }}>
        <g transform={layerTransform(cam2, 0.3)}><g transform="translate(540 960) scale(1.15) translate(-540 -960)"><Brand clock={t} spot={{ x: 540, y: 900, r: 560 }} /></g></g>
      </svg>
      <ThreeCanvas width={FRAME.width} height={FRAME.height} camera={camera} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1} />
        <IsoSocket3D gap={st.gap} heat={heat} scorch={st.scorch} outline={st.fresh} />
        <IsoPlug3D gap={st.gap} cableNodes={nodes} />
      </ThreeCanvas>
      <svg width={FRAME.width} height={FRAME.height} style={{ position: "absolute", inset: 0 }}>
        {labelOn && TIP_TAG && <NumberLabel text={TIP_TAG.toLowerCase()} x={330} y={420} ax={origin[0] - 60} ay={origin[1] - 300} t={t} start={plan.m.replace} end={plan.m.outro} fs={46} />}
        <CaptionLayer beat={beat} t={bt} />
      </svg>
    </AbsoluteFill>
  );
};

/** The composition: a fixed time (props.t) for a still, or the 6 s window of the colokan timeline. */
export const IsoThreeDemo: React.FC<{ t?: number }> = ({ t: fixed }) => {
  const frame = useCurrentFrame();
  return <IsoThreeFrame t={fixed ?? 33.5 + frame / FPS} />;
};
