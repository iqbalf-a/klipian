/* A sheet of the 3D toon assets (P28-A4), for looking at them: the wall socket with its plug (cool, heating, scorched with smoke),
   the cutaway (tight, loose) on the lab background. Not part of a story. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FRAME } from "./tokens.ts";
import { Lab } from "./components/Backgrounds.tsx";
import { FPS } from "./timeline.ts";
import { useFonts } from "./FunFact.tsx";
import { Host3D, Placed, type Look } from "./three/common.tsx";
import { Cable3D, Cutaway3D, PlugHeat, Plug3D, Smoke3D, WallSocket3D } from "./three/Socket3D.tsx";

export const Models3D: React.FC<{ look?: Look }> = ({ look = "realistic" }) => {
  useFonts();
  const t = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill>
      <svg width={FRAME.width} height={FRAME.height} style={{ position: "absolute", inset: 0 }}><Lab clock={t} /></svg>
      <Host3D look={look}>
        <Placed x={300} y={330} s={0.75} clock={t}><WallSocket3D /></Placed>
        <Placed x={780} y={330} s={0.75} clock={t}><WallSocket3D /><Plug3D /><PlugHeat heat={0.9} t={t} /></Placed>
        <Placed x={300} y={760} s={0.75} clock={t}><WallSocket3D /><Plug3D gap={1.6} /></Placed>
        <Placed x={780} y={760} s={0.75} clock={t}><WallSocket3D scorched /><Smoke3D t={t} /></Placed>
        <Placed x={540} y={1130} s={0.62} clock={t}><Cutaway3D t={t} /></Placed>
        <Placed x={540} y={1560} s={0.62} clock={t}><Cutaway3D loose heat={1} t={t} /></Placed>
        <Cable3D route={[[780, 460], [780, 560], [900, 640], [1100, 640]]} radiusPx={16} draw={1} />
      </Host3D>
    </AbsoluteFill>
  );
};
