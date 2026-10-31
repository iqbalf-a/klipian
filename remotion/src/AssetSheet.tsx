/* The asset sheet: one still with every asset of the library, 2D and 3D, with its name (`npm run assets-sheet`). For ian and for the Claude Code
   sessions that make a video: look here before drawing anything new. When an asset is added (DESIGN.md, "How to add an asset") it gets a tile here. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT_BOLD, FONT_MONO, FRAME, G1, G3, WALL, WHITE } from "./tokens.ts";
import { Brand, Lab } from "./components/Backgrounds.tsx";
import { Arrow, Badge, Banner, Black, Label, Pill, Room } from "./components/UI.tsx";
import { Mascot } from "./components/Mascot.tsx";
import { Chibi } from "./components/Chibi.tsx";
import { Cutaway, HeatWaves, PlugIn, PlugStack, Smoke, SocketOutside } from "./components/Socket.tsx";
import { FPS } from "./timeline.ts";
import { useFonts } from "./FunFact.tsx";
import { CHIBI_EXPRESSIONS, CHIBI_POSES, MASCOT_EXPRESSIONS } from "./catalog.ts";
import { Host3D, Placed } from "./three/common.tsx";
import { Cable3D, Cutaway3D, Plug3D, PlugHeat, Smoke3D, WallSocket3D } from "./three/Socket3D.tsx";
import { HeatRise, IsoBlock, IsoCutaway, IsoPlug, IsoWallSocket, Polys, SmokePuffs, Sparks } from "./components/Iso.tsx";
import { LoopArrows, MacroFrame, Magnifier, NumberLabel, SourceChip, TipCard } from "./components/Overlays.tsx";
import { cylinder } from "./iso.ts";
import { IsoAir, IsoBattery, IsoBrain, IsoClock, IsoCup, IsoFan, IsoHeart, IsoKettle, IsoLamp } from "./components/IsoLife.tsx";
import { ISO, LAB } from "./tokens.ts";

/** Every asset of the sheet by name, so a test (and a person) can see the list. Keep it in step with the tiles below. */
export const ASSET_NAMES = [
  "bg room", "bg brand", "bg lab", "bg black",
  ...MASCOT_EXPRESSIONS.map((e) => `mascot ${e}`),
  ...CHIBI_EXPRESSIONS.map((e) => `chibi ${e}`), ...CHIBI_POSES.map((p) => `chibi pose ${p}`), "chibi helmet",
  "banner", "pill", "label", "arrow", "badge",
  "socket plain", "socket scorched", "plug", "cutaway tight", "cutaway loose", "plug stack", "heat waves", "smoke",
  "3d socket", "3d plug (heating)", "3d plug out", "3d scorched + smoke", "3d cutaway tight", "3d cutaway loose", "3d cable",
  // the 2.5D isometric kit and its overlays (the second sheet, AssetSheetIso: out/assets-sheet-iso.png)
  "iso block", "iso cylinder", "iso wall socket", "iso plug", "iso plug out", "iso scorched + smoke", "iso cutaway tight", "iso cutaway loose",
  "heat rise", "sparks", "number label", "tip card", "source chip", "loop arrows", "magnifier", "macro frame",
  // the alive set (the third sheet, AssetSheetLife: out/assets-sheet-life.png): household, electric and body things that move a little all the time
  "life lamp", "life kettle", "life fan + air", "life clock", "life cup", "life battery", "life heart", "life brain", "life brain busy",
] as const;

const mono = { fontFamily: `"${FONT_MONO}", monospace`, fontSize: 18, fill: WHITE } as const;

const Tile: React.FC<{ x: number; y: number; w: number; h?: number; name: string; plate?: string; children?: React.ReactNode }> = ({ x, y, w, h = 150, name, plate = WALL, children }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect width={w} height={h} rx={10} fill={plate} />
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">{children}</svg>
    <text x={w / 2} y={h + 24} textAnchor="middle" {...mono}>{name}</text>
  </g>
);

export const AssetSheet: React.FC = () => {
  useFonts();
  const t = useCurrentFrame() / FPS + 1.2;
  const bgTile = (x: number, name: string, bg: React.ReactNode) => (
    <g transform={`translate(${x} 100)`}><svg width={236} height={150} viewBox="0 0 1080 690" overflow="hidden" preserveAspectRatio="xMidYMid slice">{bg}</svg><text x={118} y={174} textAnchor="middle" {...mono}>{name}</text></g>
  );
  return (
    <AbsoluteFill style={{ background: G1 }}>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0 }}>
        <text x={40} y={56} fontSize={36} fill={WHITE} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>Pustaka aset · klipian intip</text>
        {bgTile(40, "bg room", <Room />)}{bgTile(296, "bg brand", <Brand clock={t} />)}{bgTile(552, "bg lab", <Lab clock={t} />)}{bgTile(808, "bg black", <Black />)}

        {MASCOT_EXPRESSIONS.map((e, i) => <Tile key={e} x={40 + i * 170} y={300} w={150} name={`mascot ${e}`}><Mascot x={75} y={72} w={120} expr={e} t={t} /></Tile>)}

        {CHIBI_EXPRESSIONS.map((e, i) => <Tile key={e} x={40 + i * 120} y={500} w={104} h={150} name={e}><g transform="translate(52 128)"><Chibi u={34} expr={e} pose="idle" /></g></Tile>)}
        <Tile x={540} y={500} w={104} h={150} name="helmet"><g transform="translate(52 128)"><Chibi u={34} expr="happy" pose="idle" costume="helmet" /></g></Tile>
        {CHIBI_POSES.map((p, i) => <Tile key={p} x={40 + i * 120} y={700} w={104} h={150} name={`pose ${p}`}><g transform="translate(52 128)"><Chibi u={34} expr="calm" pose={p} /></g></Tile>)}

        <Tile x={680} y={500} w={360} h={90} name="banner" plate={WALL}><g transform="scale(0.32) translate(0 -45)"><Banner text="Banner teks" t={t} start={0} /></g></Tile>
        <Tile x={680} y={640} w={170} h={70} name="pill"><g transform="translate(85 35)"><Pill text="Intip yuk!" x={0} y={0} fs={36} t={t} start={0} /></g></Tile>
        <Tile x={870} y={640} w={170} h={70} name="label"><Label text="label" x={85} y={42} fs={40} t={t} start={0} /></Tile>
        <Tile x={680} y={760} w={170} h={90} name="arrow"><Arrow x={30} y={45} x2={140} y2={45} w={9} draw={1} /></Tile>
        <Tile x={870} y={760} w={170} h={90} name="badge"><Badge text="1" x={85} y={45} r={34} /></Tile>

        <Tile x={40} y={900} w={150} h={150} name="socket plain"><g transform="translate(75 75) scale(1)"><SocketOutside /></g></Tile>
        <Tile x={210} y={900} w={150} h={150} name="socket scorched"><g transform="translate(75 75)"><SocketOutside scorched /></g></Tile>
        <Tile x={380} y={900} w={150} h={150} name="plug"><g transform="translate(75 75)"><SocketOutside /><PlugIn /></g></Tile>
        <Tile x={550} y={900} w={230} h={150} name="cutaway tight" plate="#444"><g transform="translate(19 11) scale(0.8)"><Cutaway t={t} /></g></Tile>
        <Tile x={800} y={900} w={230} h={150} name="cutaway loose" plate="#444"><g transform="translate(19 11) scale(0.8)"><Cutaway loose heat={1} t={t} /></g></Tile>
        <Tile x={40} y={1100} w={150} h={150} name="plug stack"><g transform="translate(75 75)"><PlugStack /></g></Tile>
        <Tile x={210} y={1100} w={150} h={150} name="heat waves"><g transform="translate(75 100)"><HeatWaves t={t} /></g></Tile>
        <Tile x={380} y={1100} w={150} h={150} name="smoke"><g transform="translate(75 110)"><Smoke t={t} /></g></Tile>
        <text x={560} y={1150} fontSize={26} fill={G3} style={{ fontFamily: `"${FONT_BOLD}", sans-serif` }}>3D toon (three/): di bawah</text>
        <text x={560} y={1190} {...mono} fill={G3}>charger: Dissect3D</text>
      </svg>
      <Host3D>
        <Placed x={190} y={1460} s={0.34} clock={t}><WallSocket3D /></Placed>
        <Placed x={540} y={1460} s={0.34} clock={t}><WallSocket3D /><Plug3D /><PlugHeat heat={0.9} t={t} /></Placed>
        <Placed x={890} y={1460} s={0.34} clock={t}><WallSocket3D /><Plug3D gap={1.6} /></Placed>
        <Placed x={190} y={1720} s={0.34} clock={t}><WallSocket3D scorched /><Smoke3D t={t} /></Placed>
        <Placed x={540} y={1720} s={0.3} clock={t}><Cutaway3D t={t} /></Placed>
        <Placed x={890} y={1720} s={0.3} clock={t}><Cutaway3D loose heat={1} t={t} /></Placed>
        <Cable3D route={[[190, 1530], [190, 1560], [260, 1600], [330, 1600]]} radiusPx={5} draw={1} />
      </Host3D>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {([[190, 1590, "3d socket"], [540, 1590, "3d plug (heating)"], [890, 1590, "3d plug out"], [190, 1830, "3d scorched + smoke"], [540, 1830, "3d cutaway tight"], [890, 1830, "3d cutaway loose"], [330, 1625, "3d cable"]] as const).map(([x, y, name]) => (
          <text key={name} x={x} y={y} textAnchor="middle" {...mono}>{name}</text>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** The second sheet: the 2.5D isometric kit (src/iso.ts, components/Iso.tsx) and the overlays of a camera-led explainer (components/Overlays.tsx). */
export const AssetSheetIso: React.FC = () => {
  useFonts();
  const t = useCurrentFrame() / FPS + 1.2;
  const cap = (x: number, y: number, name: string) => <text x={x} y={y} textAnchor="middle" {...mono}>{name}</text>;
  // a tile: its plate, and what is drawn on it clipped to it
  const tile = (x: number, y: number, w: number, h: number, dark: boolean, children: React.ReactNode) => (
    <g><rect x={x} y={y} width={w} height={h} rx={10} fill={dark ? LAB.slate : WALL} /><svg x={x} y={y} width={w} height={h} viewBox={`${x} ${y} ${w} ${h}`} overflow="hidden">{children}</svg></g>
  );
  return (
    <AbsoluteFill style={{ background: G1 }}>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0 }}>
        <text x={40} y={56} fontSize={36} fill={WHITE} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>Pustaka 2.5D isometrik · klipian intip</text>
        {tile(40, 90, 230, 230, false, <><IsoBlock a={[-0.8, -0.8, -0.5]} b={[0.8, 0.8, 0.5]} u={70} o={[155, 215]} tones={ISO.wall} /></>)}{cap(155, 344, "iso block")}
        {tile(290, 90, 230, 230, false, <><Polys polys={cylinder([0, -0.9, 0], [0, 0.9, 0], 0.6, 0.6, [1, 0, 0], [0, 0, 1], 70, [405, 200])} tones={ISO.dark} /></>)}{cap(405, 344, "iso cylinder")}
        {tile(540, 90, 500, 230, true, <><IsoCutaway u={58} o={[690, 205]} loose={0} t={t} /></>)}{cap(790, 344, "iso cutaway tight")}
        {tile(40, 370, 330, 420, false, <><IsoWallSocket u={62} o={[205, 560]} heat={0.6} t={t} /><IsoPlug u={62} o={[205, 560]} heat={0.6} /><HeatRise x={205} y={470} k={0.8} t={t} scale={0.5} /></>)}{cap(205, 814, "iso wall socket")}{cap(205, 836, "iso plug · heat rise")}
        {tile(375, 370, 330, 420, false, <><IsoWallSocket u={62} o={[540, 560]} /><IsoPlug u={62} o={[540, 560]} gap={1.6} /></>)}{cap(540, 814, "iso plug out")}
        {tile(710, 370, 330, 420, false, <><IsoWallSocket u={62} o={[875, 560]} scorch={1} heat={1} t={t} /><IsoPlug u={62} o={[875, 560]} heat={1} /><SmokePuffs x={880} y={500} k={1} t={t} scale={0.45} /></>)}{cap(875, 814, "iso scorched + smoke")}
        {tile(40, 870, 1000, 300, true, <><IsoCutaway u={78} o={[420, 1020]} loose={1} heat={1} t={t} /><Sparks x={505} y={1037} k={1} t={t} /></>)}{cap(540, 1194, "iso cutaway loose · sparks")}
        {tile(40, 1230, 500, 300, false, <><NumberLabel text="penjepit" n={1} x={230} y={1290} ax={380} ay={1420} t={t} start={0} /><SourceChip x={70} y={1490} text="cpsc.gov · contoh.org" t={t} start={0} /></>)}{cap(290, 1554, "number label · source chip")}
        {tile(560, 1230, 480, 300, true, <><LoopArrows cx={800} cy={1380} r={95} a="panas" b="hambatan" t={t} start={0} /></>)}{cap(800, 1554, "loop arrows")}
        {tile(40, 1590, 500, 300, false, <><g transform="translate(40 1590) scale(0.55)"><TipCard x={30} y={30} w={850} n={1} title="Tip yang pendek" sub="baris di bawahnya" chip="SUMBER  contoh.org" t={t} start={0} /></g></>)}{cap(290, 1912, "tip card")}
        {tile(560, 1590, 480, 300, false, <><Magnifier x={700} y={1730} r={90} t={t} start={0} /><MacroFrame box={{ x0: 830, y0: 1700, x1: 1020, y1: 1860 }} t={t} start={0} onDark={false} tag="ZOOM" /></>)}{cap(800, 1912, "magnifier · macro frame")}
      </svg>
    </AbsoluteFill>
  );
};

/** The third sheet: the alive set (src/components/IsoLife.tsx), one tile each at two moments (t and t + 0.5 s, the same asset twice so the motion shows), with its name. */
export const AssetSheetLife: React.FC = () => {
  useFonts();
  const t = useCurrentFrame() / FPS + 1.2;
  const W = 330, H = 400;
  const items: [string, (o: [number, number], t: number) => React.ReactNode][] = [
    ["life lamp", (o, tt) => <IsoLamp u={85} o={o} t={tt} />],
    ["life kettle", (o, tt) => <IsoKettle u={92} o={o} t={tt} boil={0.8} />],
    ["life fan + air", (o, tt) => <g><IsoFan u={78} o={[o[0] - 30, o[1]]} t={tt} /><IsoAir x={o[0] + 30} y={o[1] - 140} len={120} t={tt} /></g>],
    ["life clock", (o, tt) => <IsoClock u={92} o={o} t={tt} ring={tt % 4 > 2.4 ? 1 : 0} />],
    ["life cup", (o, tt) => <IsoCup u={110} o={o} t={tt} />],
    ["life battery", (o, tt) => <IsoBattery u={82} o={o} t={tt} level={0.5} />],
    ["life heart", (o, tt) => <IsoHeart u={100} o={[o[0], o[1] - 20]} t={tt} />],
    ["life brain", (o, tt) => <IsoBrain u={100} o={[o[0], o[1] - 20]} t={tt} busy={0.2} />],
    ["life brain busy", (o, tt) => <IsoBrain u={100} o={[o[0], o[1] - 20]} t={tt} busy={1} />],
  ];
  return (
    <AbsoluteFill style={{ background: G1 }}>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0 }}>
        <text x={40} y={56} fontSize={36} fill={WHITE} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>Pustaka hidup · rumah tangga, listrik, tubuh</text>
        {items.map(([name, draw], i) => {
          const x = 40 + (i % 3) * (W + 15), y = 90 + Math.floor(i / 3) * (H + 70);
          return (
            <g key={name}>
              <rect x={x} y={y} width={W} height={H} rx={10} fill={WALL} />
              <svg x={x} y={y} width={W} height={H} viewBox={`${x} ${y} ${W} ${H}`} overflow="hidden">{draw([x + W / 2, y + H * 0.72], t)}</svg>
              <text x={x + W / 2} y={y + H + 26} textAnchor="middle" {...mono}>{name}</text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
