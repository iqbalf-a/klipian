/* The markup of the objects the detail budget measures (scripts/detailBudget.mjs bundles this file with esbuild). Each object is drawn as it is on its
   sheet tile, so the count is what the viewer sees. The colokan's socket and plug are the bar; the nature assets must reach 80 % of its numbers. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeatRise, IsoPlug, IsoWallSocket } from "../src/components/Iso.tsx";
import { drawAsset } from "../src/natureAssets.tsx";
import { SHEET, SHEET_TILES, sheetTile } from "../src/natureGeometry.ts";

export const colokanMarkup = (): string => renderToStaticMarkup(
  <svg xmlns="http://www.w3.org/2000/svg" width={330} height={420} viewBox="0 0 330 420">
    <IsoWallSocket u={62} o={[205, 560]} heat={0.6} t={1.2} />
    <IsoPlug u={62} o={[205, 560]} heat={0.6} />
    <HeatRise x={205} y={470} k={0.8} t={1.2} scale={0.5} />
  </svg>,
);

/** The nature assets as drawn on their sheet tiles (at the sheet's scale about the origin), with each tile's box in the sheet. */
export const natureObjects = (): { name: string; markup: string; box: [number, number, number, number] }[] =>
  SHEET_TILES.map((t) => {
    const L = sheetTile(t.name);
    return { name: `nature ${t.label}`, markup: renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg">{drawAsset(t.name, SHEET.u, [0, 0])}</svg>), box: [L.x, L.y, L.w, L.h - 70] as [number, number, number, number] };
  });
