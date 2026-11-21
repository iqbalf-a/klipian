/* The 3D Chibi rig in Remotion: walks in from the left to a stool, sits down, stands up. Not part of a story. */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FRAME } from "./tokens.ts";
import { ChibiClip } from "./components/ChibiClip.tsx";

const WALK = 72; // 3 walk loops
export const CHIBI_DEMO_FRAMES = WALK + 70 + 20;

export const ChibiDemo: React.FC = () => {
  const f = useCurrentFrame();
  const floor = 1350, h = 900, stop = FRAME.width / 2;
  // shortcut: stride speed tuned by eye (the walk is in place), adjust if the feet slide
  const x = interpolate(f, [0, WALK], [-150, stop], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#f6f1e7" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: floor, bottom: 0, background: "#e4d9c4" }} />
      {f < WALK
        ? <ChibiClip clip="walk" frame={f} loop x={x} y={floor} height={h} />
        : <ChibiClip clip="sit_down" frame={f - WALK} x={x} y={floor} height={h} />}
    </AbsoluteFill>
  );
};
