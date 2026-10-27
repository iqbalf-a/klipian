/* The nature asset sheet (pilot 2, phases 1 and 1b): one tile per nature part, each fitted by its bounding box (natureGeometry.ts sheetTile): scaled to
   80 % of the tile's drawing area, centred, with the bottom 70 px kept for the label. A pale spot behind each tile, so the white cloud reads. Drawn by the
   same components as the demo (src/components/IsoNature.tsx). A separate composition: AssetSheetIso is not changed. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { FRAME } from "./design/index.ts";
import { ISO } from "./tokens.ts";
import { SHEET, SHEET_HEIGHT, SHEET_TILES, sheetTile } from "./natureGeometry.ts";
import { drawAsset } from "./natureAssets.tsx";


/** The sheet: the tiles of natureGeometry.ts SHEET_TILES, each drawn at SHEET.u about the origin and transformed to its fitted place. */
export const NatureSheet: React.FC = () => (
  <AbsoluteFill style={{ background: ISO.wall[0] }}>
    <svg width={FRAME.width} height={SHEET_HEIGHT}>
      {SHEET_TILES.map((t) => {
        const L = sheetTile(t.name);
        return (
          <g key={t.name}>
            <rect x={L.x + 6} y={L.y + 6} width={L.w - 12} height={L.h - 12} rx={24} fill="rgb(250,250,248)" />
            <circle cx={L.x + L.w / 2} cy={L.area.y0 + (L.area.y1 - L.area.y0) / 2} r={Math.min(L.w, L.h) * 0.36} fill="rgb(250,236,186)" opacity={0.7} />
            <g transform={`translate(${L.tx} ${L.ty}) scale(${L.s}) translate(${-L.bcx} ${-L.bcy})`}>
              {drawAsset(t.name, SHEET.u, [0, 0])}
            </g>
            <text x={L.label.x} y={L.label.y} fontSize={36} textAnchor="middle" fill="rgb(38,38,38)" style={{ fontFamily: "monospace" }}>{t.label}</text>
          </g>
        );
      })}
    </svg>
  </AbsoluteFill>
);
