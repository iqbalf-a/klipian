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

// source and data cards, pointer labels, sounds written out
export { SourceCard, SearchCard, NumberCard, BarChart, LineChart, CalendarCard, PointerLabel, Onomatopoeia, cardSpec, pointerBox, wrap } from "../components/Cards.tsx";
// overlays of a camera-led explainer: the magnifier, the macro frame, tip cards, source chips, a loop of two causes
export { Magnifier, MacroFrame, TipCard, tipCardHeight, tipCardSpec, SourceChip, sourceChipSpec, LoopArrows, loopSpec, NumberLabel, monoWidth } from "../components/Overlays.tsx";
// the 2.5D isometric kit (the main style): geometry and the 2D camera (iso.ts), the pieces and the socket set (components/Iso.tsx)
export { iso, isoAt, block, extrudeXZ, extrudeAnyXZ, cylinder, planeXZ, planeYZ, roundRectPts, circlePts, smoothPath, toneOf, visible, ptsAttr, cam2At, layerCam, layerTransform, toScreen, REST_CAM, type P2, type P3, type Poly, type Tones, type Cam2, type Key2 } from "../iso.ts";
export { Polys, IsoBlock, OnPlane, Hatch, IsoWallSocket, IsoPlug, IsoCutaway, ISO_SOCKET_POINTS, ISO_CUT_POINTS, isoContactPoint, HeatRise, SmokePuffs, Sparks, Motes } from "../components/Iso.tsx";
// karaoke captions and the top text
export { CaptionLayer, TopText } from "../components/Captions.tsx";
export { estimateWords, pagesOf, pageAt, activeWord, wordsOfBeat } from "../captions.ts";

// characters
export { Mascot } from "../components/Mascot.tsx";
export { Chibi } from "../components/Chibi.tsx";

// objects: flat 2D (components/Socket.tsx) and 3D toon (three/)
export { Cutaway, HeatWaves, PlugIn, PlugStack, Smoke, SocketOutside, SOCKET_BOX } from "../components/Socket.tsx";
export { LensReveal } from "../components/LensReveal.tsx";
export { Host3D, Placed, Shadowing, objectScale, projectToScreen, projectView, projectBox, corners, LookContext, DefaultLookContext, type Look } from "../three/common.tsx";
export { shots, viewAt, speedAt, cameraFromView, REST_VIEW, type Shot, type View } from "../three/rigMath.ts";
export { ANCHORS, Cable3D, Cutaway3D, Plug3D, PlugHeat, Smoke3D, WallSocket3D } from "../three/Socket3D.tsx";
// the semi-realistic socket set: Indonesian socket, round plug, the contact cutaway (spring leaves, current dashes, hot contact)
export { IndoSocket3D, RoundPlug3D, CollarHeat, ContactCutaway3D, contactPoint, OUTLET_POINTS, CUTAWAY_POINTS, PLATE_FRONT, mixColor } from "../three/Outlet3D.tsx";
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
