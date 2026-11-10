/* The "Intip yuk!" sting: the mascot and its pill as one mark, in the pose of the video (src/stingPose.ts, B31). It pops in with the springs the video already
   uses (p for the mascot, p2 for the pill); `out` (0..1) fades it when the sting ends early. */
import React from "react";
import { springAt } from "../motion.ts";
import { STING_FS, STING_MASCOT_W, STING_TEXT, stingPlace, stingPoseFor, type StingPoseName } from "../stingPose.ts";
import { Mascot } from "./Mascot.tsx";
import { Pill } from "./UI.tsx";

export const StingMark: React.FC<{ slug: string; pose?: StingPoseName; t: number; clock?: number; p?: number; p2?: number; out?: number }> =
  ({ slug, pose, t, clock, p = springAt(t, 0), p2 = springAt(t, 0.2), out = 1 }) => {
    const { mascot, pill } = stingPlace(pose ?? stingPoseFor(slug));
    return (
      <g>
        <g transform={`translate(${mascot.x} ${mascot.y}) scale(${Math.max(0, p) * out}) translate(${-mascot.x} ${-mascot.y})`}>
          <Mascot x={mascot.x} y={mascot.y} w={STING_MASCOT_W} expr="curious" t={t} clock={clock} squash={0.18 * (1 - Math.min(1, p))} />
        </g>
        <g transform={`translate(${pill.x} ${pill.y}) scale(${Math.max(0, p2) * out}) translate(${-pill.x} ${-pill.y})`}>
          <Pill text={STING_TEXT} x={pill.x} y={pill.y} fs={STING_FS} t={t} start={0.2} />
        </g>
      </g>
    );
  };
