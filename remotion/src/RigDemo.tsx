/* One continuous object (P28-P): the camera rig moves round a wall socket with its plug: a push in, an orbit, a dolly to the pin, a macro. The pattern of
   DESIGN.md, "Camera-led scenes". Not part of a story. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FRAME } from "./tokens.ts";
import { Brand } from "./components/Backgrounds.tsx";
import { Host3D, objectScale } from "./three/common.tsx";
import { Plug3D, PlugHeat, WallSocket3D } from "./three/Socket3D.tsx";
import { shots, viewAt } from "./three/rigMath.ts";
import { FPS } from "./timeline.ts";
import { useFonts } from "./FunFact.tsx";

const SHOTS = [shots.hold(0, 1), shots.push(1, 3, 0.55), shots.orbit(3, 5, 38, 12), shots.dolly(5, 7, [0, -0.7, 1.2], 0.35), shots.macro(7, 8, [0, -0.85, 1.3])];
export const RIG_DEMO_SECONDS = 8;

export const RigDemo: React.FC = () => {
  useFonts();
  const t = useCurrentFrame() / FPS;
  const view = viewAt(SHOTS, t);
  return (
    <AbsoluteFill>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0 }}><Brand clock={t} /></svg>
      <Host3D rig={view}>
        <group scale={objectScale(1.5)}>
          <WallSocket3D />
          <Plug3D />
          <PlugHeat heat={Math.min(1, t / 6)} t={t} />
        </group>
      </Host3D>
    </AbsoluteFill>
  );
};
