/* The nature asset sheet (pilot 2, phases 1 and 1b): one tile per nature part, each fitted by its bounding box (natureGeometry.ts sheetTile): scaled to
   80 % of the tile's drawing area, centred, with the bottom 70 px kept for the label. A pale spot behind each tile, so the white cloud reads. Drawn by the
   same components as the demo (src/components/IsoNature.tsx). A separate composition: AssetSheetIso is not changed. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { FRAME } from "./design/index.ts";
import { ISO } from "./tokens.ts";
import { IsoCloud, IsoDroplets, IsoLand, IsoRain, IsoRunoff, IsoSea, IsoSplash, IsoSun, IsoTrees, IsoVapour } from "./components/IsoNature.tsx";
import { CLOUD_GREY, CLOUD_WHITE, SHEET, SHEET_TILES, sheetTile } from "./natureGeometry.ts";

const drawAsset = (name: string, u: number, o: [number, number]): React.ReactNode => {
  switch (name) {
    case "sea": return <IsoSea u={u} o={o} />;
    case "land": return <><IsoLand u={u} o={o} /><IsoTrees u={u} o={o} /></>;
    case "trees": return <IsoTrees u={u} o={o} />;
    case "sun": return <IsoSun cx={o[0]} cy={o[1]} r={u * 0.25} />;
    case "cloud-white": return <IsoCloud u={u} o={o} cx={CLOUD_WHITE.cx} cy={CLOUD_WHITE.cy} cz={CLOUD_WHITE.cz} dark={0} grow={CLOUD_WHITE.grow} />;
    case "cloud-grey": return <IsoCloud u={u} o={o} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={1} grow={CLOUD_GREY.grow} />;
    case "clouds": return <>
      <IsoCloud u={u} o={o} cx={CLOUD_WHITE.cx} cy={CLOUD_WHITE.cy} cz={CLOUD_WHITE.cz} dark={0} grow={CLOUD_WHITE.grow} />
      <IsoCloud u={u} o={o} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={1} grow={CLOUD_GREY.grow} />
    </>;
    case "rain": return <IsoRain u={u} o={o} k={1} />;
    case "vapour": return <IsoVapour u={u} o={o} k={1} />;
    case "droplets": return <IsoDroplets u={u} o={o} k={1} />;
    case "splash": return <IsoSplash u={u} o={o} k={0.5} at={[-0.2, -0.3]} />;
    case "runoff": return <><IsoLand u={u} o={o} /><IsoRunoff u={u} o={o} k={1} /></>;
    case "scene": return <>
      <IsoSea u={u} o={o} splash={0} />
      <IsoVapour u={u} o={o} k={1} />
      <IsoLand u={u} o={o} />
      <IsoRunoff u={u} o={o} k={1} />
      <IsoTrees u={u} o={o} />
      <IsoRain u={u} o={o} k={1} />
      <IsoCloud u={u} o={o} cx={CLOUD_WHITE.cx} cy={CLOUD_WHITE.cy} cz={CLOUD_WHITE.cz} dark={0} grow={CLOUD_WHITE.grow} />
      <IsoCloud u={u} o={o} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={1} grow={CLOUD_GREY.grow} />
    </>;
    default: return null;
  }
};

/** The sheet: the tiles of natureGeometry.ts SHEET_TILES, each drawn at SHEET.u about the origin and transformed to its fitted place. */
export const NatureSheet: React.FC = () => (
  <AbsoluteFill style={{ background: ISO.wall[0] }}>
    <svg width={FRAME.width} height={FRAME.height}>
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
