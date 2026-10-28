/* The mark sheet (Style Bible v1, DESIGN.md section 0b): one tile per drawn row of src/dictionary.ts, each drawn by the component the row names, and a
   spec row for every row still "to build" (text only: no drawing). A separate composition; the nature and colokan sheets are unchanged. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { FRAME } from "./design/index.ts";
import { ISO } from "./tokens.ts";
import { DICTIONARY } from "./dictionary.ts";
import { HeatRise, IsoCutaway, IsoWallSocket, Sparks } from "./components/Iso.tsx";
import { IsoCloud, IsoDrop, IsoRain, IsoSun, IsoTrees, IsoVapour } from "./components/IsoNature.tsx";
import { CLOUD_GREY, TREES } from "./natureGeometry.ts";
import { IsoPlane, IsoSeed } from "./components/IsoSeeding.tsx";
import { IsoBed, IsoPhone, SleepyEyes } from "./components/IsoBedroom.tsx";
import { Arrow } from "./components/UI.tsx";

const COLS = 3, W = 360, H = 380, TOP = 40;
/** The short label of each drawn mark on its tile (the dictionary's `thing` is the full name in the spec rows). */
const LABEL: Record<string, string> = { current: "current", cloud: "cloud", tree: "tree", heat: "heat", danger: "danger", water: "water", vapour: "vapour", light: "light", spark: "spark", force: "force arrow", seed: "seed grains", aircraft: "aircraft", bed: "bed", phone: "phone", eyes: "sleepy eyes" };
/** A spec row's line: the thing and its recipe, cut to fit the sheet. */
const specLine = (thing: string, mark: string): string => `${thing}: ${mark}`.slice(0, 56) + (`${thing}: ${mark}`.length > 56 ? "..." : "");
const T = 1.2;   // the time at which the animated marks are drawn (a still)

/** The drawing of each drawn mark, in a tile of W x H (the tile's origin is the top left). */
const drawMark = (id: string): React.ReactNode => {
  switch (id) {
    case "current": return <g transform="translate(-40 60) scale(0.62)"><IsoCutaway u={58} o={[330, 300]} loose={0} t={T} /></g>;
    case "heat": return <HeatRise x={180} y={250} k={1} t={T} scale={1.1} />;
    case "danger": return <IsoWallSocket u={70} o={[180, 290]} heat={1} t={T} />;
    case "water": return <g><IsoRain u={150} o={[160, 330]} k={1} phase={0} /><IsoDrop cx={270} cy={110} r={30} /></g>;
    case "vapour": return <IsoVapour u={150} o={[160, 330]} k={1} phase={0.2} />;
    case "light": return <IsoSun cx={180} cy={190} r={60} phase={0} />;
    case "spark": return <Sparks x={180} y={220} k={1} t={T} scale={1} />;
    case "force": return <Arrow x={60} y={250} x2={300} y2={160} color="black" w={12} draw={1} />;
    case "seed": return <g><IsoSeed kind="salt" x={110} y={200} s={46} /><IsoSeed kind="agi" x={250} y={200} s={62} t={T} /></g>;
    case "aircraft": return <IsoPlane x={180} y={200} w={250} phase={0} />;
    case "cloud": return <g><g transform="translate(-74 0)"><IsoCloud u={62} o={[174, 370]} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={0} /></g><g transform="translate(40 0)"><IsoCloud u={62} o={[174, 370]} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={1} /></g></g>;
    case "tree": return <IsoTrees u={130} o={[70, 140]} list={[TREES.find((t) => t.kind === "pine")!, TREES.find((t) => t.kind === "round")!]} />;
    case "bed": return <IsoBed u={60} o={[130, 190]} />;
    case "phone": return <IsoPhone u={90} o={[110, 130]} on={1} t={T} />;
    case "eyes": return <SleepyEyes cx={180} cy={200} w={290} open={0.4} />;
    default: return null;
  }
};

export const MarkSheet: React.FC = () => {
  const drawn = DICTIONARY.filter((r) => r.status === "drawn");
  const spec = DICTIONARY.filter((r) => r.status === "to build");
  const rows = Math.ceil(drawn.length / COLS);
  return (
    <AbsoluteFill style={{ background: ISO.wall[0] }}>
      <svg width={FRAME.width} height={TOP + rows * H + 40 + spec.length * 56 + 40}>
        {drawn.map((r, i) => {
          const x = (i % COLS) * W, y = TOP + Math.floor(i / COLS) * H;
          return (
            <g key={r.id} transform={`translate(${x} ${y})`}>
              <rect x={6} y={6} width={W - 12} height={H - 12} rx={24} fill="rgb(250,250,248)" />
              <svg x={6} y={6} width={W - 12} height={H - 70} viewBox={`0 0 ${W - 12} ${H - 70}`} overflow="hidden">
                <g transform="translate(-6 -6)">{drawMark(r.id)}</g>
              </svg>
              <text x={W / 2} y={H - 40} fontSize={32} textAnchor="middle" fill="rgb(38,38,38)" style={{ fontFamily: "monospace" }}>{LABEL[r.id] ?? r.thing}</text>
            </g>
          );
        })}
        <text x={40} y={TOP + rows * H + 30} fontSize={34} fill="rgb(38,38,38)" style={{ fontFamily: "monospace" }}>to build (spec only, not drawn):</text>
        {spec.map((r, i) => (
          <text key={r.id} x={40} y={TOP + rows * H + 90 + i * 56} fontSize={26} fill="rgb(38,38,38)" style={{ fontFamily: "monospace" }}>{specLine(r.thing, r.mark)}</text>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
