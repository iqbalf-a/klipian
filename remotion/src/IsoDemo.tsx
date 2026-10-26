/* The 2.5D isometric kit on one screen (DESIGN.md, "2.5D isometrik"): the wall socket with its plug on the brand wall, and the contact cutaway in the lab
   going from tight to loose and heating up, with the current flowing. Not part of a story. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FRAME } from "./tokens.ts";
import { Brand, Lab } from "./components/Backgrounds.tsx";
import { IsoCutaway, IsoPlug, IsoWallSocket } from "./components/Iso.tsx";
import { FPS } from "./timeline.ts";
import { useFonts } from "./FunFact.tsx";

export const ISO_DEMO_SECONDS = 6;

export const IsoDemo: React.FC = () => {
  useFonts();
  const t = useCurrentFrame() / FPS, k = Math.min(1, Math.max(0, (t - 1.5) / 2));
  return (
    <AbsoluteFill>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
        <Brand clock={t} spot={{ x: 540, y: 520, r: 420 }} />
        <IsoWallSocket u={130} o={[540, 470]} heat={k} t={t} />
        <IsoPlug u={130} o={[540, 470]} heat={k} />
        <svg x={0} y={1000} width={1080} height={920} viewBox="0 1000 1080 920"><Lab clock={t} /></svg>
        <IsoCutaway u={210} o={[300, 1420]} loose={k} heat={k} t={t} />
      </svg>
    </AbsoluteFill>
  );
};
