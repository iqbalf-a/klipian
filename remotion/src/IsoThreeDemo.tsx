/* The Three.js orthographic spike (experiment, not a video): the socket and the plug of "Kenapa colokan bisa panas?" built as real 3D geometry with an
   OrthographicCamera along (1, 1, 1) and a 3-step toon, on the same timing as the colokan plan (the plug comes out of the socket from 34.5 s). One SVG
   label and a caption box sit over the 3D layer, so the hybrid is tested as well as the picture. The camera is the colokan camera at that time (zoom
   and pan), and the geometry is the colokan's (IsoSocket3D, IsoPlug3D). Nothing here changes an existing video. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FPS, FRAME } from "./design/index.ts";
import { ISO } from "./tokens.ts";
import { toScreen } from "./iso.ts";
import { makeIsoCamera } from "./three/isoCamera.ts";
import { IsoSocket3D } from "./three/IsoSocket3D.tsx";
import { IsoPlug3D } from "./three/IsoPlug3D.tsx";
import { NumberLabel } from "./components/Overlays.tsx";
import { makePlan } from "../videos/kenapa-colokan-panas/plan.ts";
import { validateStory } from "./schema.ts";
import storyJson from "../videos/kenapa-colokan-panas/story.json";

export const ISO_THREE_SECONDS = 6;
const U = 150, O: [number, number] = [540, 900];
const story = validateStory(storyJson);
if (!story.ok) throw new Error(story.errors.join("\n"));
const plan = makePlan(story.story);
const HOOK_TEXT = story.story.beats.find((b) => b.id === "hook")?.narration ?? "";
const TIP_TAG = plan.labels.find((l) => l.id === "plate")?.text ?? "";

/** The demo: `t` (optional, seconds of the colokan timeline) fixes the time for a still; otherwise the demo plays 33.5 s to 39.5 s. */
export const IsoThreeDemo: React.FC<{ t?: number }> = ({ t: fixed }) => {
  const frame = useCurrentFrame();
  const t = fixed ?? 33.5 + frame / FPS;
  const st = plan.state(t), cam2 = plan.outCam(t);
  // the colokan's camera (zoom and pan) as the 3D camera: a bigger scale and the origin where the 2D camera puts it
  const origin = toScreen(cam2, O) as [number, number];
  const camera = React.useMemo(() => makeIsoCamera(FRAME.width, FRAME.height, U * cam2.zoom, origin), [cam2.zoom, origin[0], origin[1]]);
  const nodes = plan.cableAt(t);
  const labelOn = t >= plan.m.replace && t < plan.m.outro;
  return (
    <AbsoluteFill style={{ background: ISO.wall[0] }}>
      <ThreeCanvas width={FRAME.width} height={FRAME.height} camera={camera} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[0.25, 1, 0.55]} intensity={0.85} />
        <IsoSocket3D gap={st.gap} />
        <IsoPlug3D gap={st.gap} cableNodes={nodes} />
      </ThreeCanvas>
      <svg width={FRAME.width} height={FRAME.height} style={{ position: "absolute", inset: 0 }}>
        {labelOn && TIP_TAG && <NumberLabel text={TIP_TAG.toLowerCase()} x={330} y={420} ax={(origin[0] - 60) as number} ay={(origin[1] - 300) as number} t={t} start={plan.m.replace} end={plan.m.outro} fs={46} />}
        <rect x={90} y={1420} width={900} height={180} rx={24} fill={ISO.dark[2]} opacity={0.88} />
        <text x={540} y={1520} fontSize={56} textAnchor="middle" fill="#ffffff" style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>{HOOK_TEXT}</text>
      </svg>
    </AbsoluteFill>
  );
};
