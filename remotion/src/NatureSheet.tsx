/* The nature asset sheet (pilot 2, phase 1): one tile per nature part, each drawn by the same component the demo uses (src/components/IsoNature.tsx),
   on the wall colour with its name under it. A separate composition: AssetSheetIso is not changed. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { FRAME } from "./design/index.ts";
import { ISO } from "./tokens.ts";
import { IsoCloud, IsoLand, IsoRain, IsoSea, IsoSun, IsoVapour } from "./components/IsoNature.tsx";

const TILES: { name: string; x: number; y: number; render: (o: [number, number]) => React.ReactNode }[] = [
  { name: "sea", x: 0, y: 0, render: (o) => <IsoSea u={70} o={o} /> },
  { name: "land", x: 1, y: 0, render: (o) => <IsoLand u={70} o={o} /> },
  { name: "sun", x: 0, y: 1, render: (o) => <IsoSun cx={o[0]} cy={o[1] - 60} r={50} /> },
  { name: "cloud white", x: 1, y: 1, render: (o) => <IsoCloud u={70} o={o} dark={0} /> },
  { name: "cloud grey", x: 0, y: 2, render: (o) => <IsoCloud u={70} o={o} dark={1} /> },
  { name: "rain", x: 1, y: 2, render: (o) => <IsoRain u={70} o={o} k={1} /> },
  { name: "vapour", x: 0, y: 3, render: (o) => <IsoVapour u={70} o={o} k={1} /> },
];

/** The sheet: 2 columns, 4 rows of tiles of 540 by 480 px. */
export const NatureSheet: React.FC = () => (
  <AbsoluteFill style={{ background: ISO.wall[0] }}>
    <svg width={FRAME.width} height={FRAME.height}>
      {TILES.map((t) => {
        const cx = 270 + t.x * 540, cy = 240 + t.y * 480;
        return (
          <g key={t.name}>
            <rect x={cx - 250} y={cy - 220} width={500} height={440} rx={24} fill="rgb(250,250,248)" />
            <g>{t.render([cx, cy + 70])}</g>
            <text x={cx} y={cy + 200} fontSize={36} textAnchor="middle" fill="rgb(38,38,38)" style={{ fontFamily: "monospace" }}>{t.name}</text>
          </g>
        );
      })}
    </svg>
  </AbsoluteFill>
);
