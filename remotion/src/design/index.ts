/* The channel's design system in one import, for the scenes of a custom video (videos/<slug>/index.tsx):
     import { Stage, Brand, Banner, Mascot, ..., StoryVideo, resolve, ZONES } from "../../src/design/index.ts";
   Everything here is what the template videos are made of, so a custom video looks like the channel. Read DESIGN.md before using it. */

// the frame and the story
export { StoryVideo, type Scene, type SceneProps } from "./StoryVideo.tsx";
export { useFonts } from "../FunFact.tsx";
export type { StoryT, BeatT, ItemT } from "../schema.ts";
export { FPS, sequencePlan, totalFrames } from "../timeline.ts";

// palette, sizes, safe area
export * from "../tokens.ts";

// backgrounds, text, arrows, badges
export { Brand, Lab } from "../components/Backgrounds.tsx";
export { Room, Black, Banner, Pill, Label, Arrow, Badge, textWidth } from "../components/UI.tsx";

// characters
export { Mascot } from "../components/Mascot.tsx";
export { Chibi } from "../components/Chibi.tsx";

// objects: flat 2D (components/Socket.tsx) and 3D toon (three/)
export { Cutaway, HeatWaves, PlugIn, PlugStack, Smoke, SocketOutside, SOCKET_BOX } from "../components/Socket.tsx";
export { LensReveal } from "../components/LensReveal.tsx";
export { Host3D, Placed, projectToScreen } from "../three/common.tsx";
export { ANCHORS, Cable3D, Cutaway3D, Plug3D, PlugHeat, Smoke3D, WallSocket3D } from "../three/Socket3D.tsx";
export { cablePath, cableSamples } from "../cable.ts";
export { Ring, Line } from "../components/svg.tsx";

// motion
export { breathe, blink, cameraAt, clamp01, easeOut, easeInOut, easeOutBack, enterFx, exitFx, hover, springAt, wordIn } from "../motion.ts";
export { enterOf, cameraOf, transitionInto } from "../timeline.ts";

// layout: zones, boxes and the resolver (nothing overlaps, everything inside the safe area)
export * from "../layout.ts";
export { LayoutDebug } from "../components/LayoutDebug.tsx";

// sound: the events of a video are a list { t, name, vol } (see sfx.ts and DESIGN.md)
export { defaultBeatSfx, type SfxEvent } from "../sfx.ts";
export type { SfxName } from "../catalog.ts";
