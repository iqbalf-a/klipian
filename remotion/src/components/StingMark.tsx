/* The "Intip yuk!" sting is voice-only (ian, 2026-11-20, B31): the mascot and its pill are not drawn any more, in any video. The component stays so that the
   videos that place it (and `stingPose.ts`) keep compiling; the narration, the sting beat and its sound are unchanged. */
import React from "react";
import type { StingPoseName } from "../stingPose.ts";

export const StingMark: React.FC<{ slug: string; pose?: StingPoseName; t: number; clock?: number; p?: number; p2?: number; out?: number }> = () => null;
