/* The wall socket: seen from outside (plain or scorched, with a plug and heat waves or smoke) and the CUTAWAY seen from the
   side (tight or loose spring leaves, the current's yellow dots, the heat glow). A port of socket_outside(), plug_in(),
   heat_waves(), glow() and cutaway() in make_storyboard.py. Colour code: yellow = current, red/orange = heat, grey =
   material, light grey = metal. Components draw around their own centre in the SHEET's units; the parent scales them. */
import React from "react";
import { BLACK, CAVITY_SHADE, G1, G2, G3, G4, HOLE_SHADE, HOT1, HOT2, METAL, PLUG_FACE, RECESS_SHADE, RED, SMOKE, WALL, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import { Arc, Disc, Hole, Line, Rect } from "./svg.tsx";

export const SOCKET_BOX = { w: 240, h: 160 };      // the cutaway's own box on the sheet

export const SocketOutside: React.FC<{ scorched?: boolean }> = ({ scorched }) => (
  <g>
    <Rect x0={-60} y0={-60} x1={60} y1={60} r={16} fill={WHITE} />
    <Hole x={0} y={0} r={44} fill={G4} shade={RECESS_SHADE} off={0.09} />
    {scorched && ([[-14, -6, 30, "rgb(120,104,92)"], [-18, 2, 20, G1], [12, 10, 14, "rgb(120,104,92)"]] as const).map(([dx, dy, r, c], i) =>
      <Disc key={i} x={dx} y={dy} r={r} fill={c} />)}
    {[-16, 16].map((dx) => <Hole key={dx} x={dx} y={0} r={6.5} fill={PLUG_FACE} shade={HOLE_SHADE} off={0.35} />)}
  </g>
);

/** The plug pushed into the socket: body over the recess, with the recess's shade showing as a ring on its upper-left
    where it goes in. (Its cable is drawn by the caller, in video coordinates.) */
export const PlugIn: React.FC = () => (
  <g>
    <Rect x0={-34} y0={-38} x1={28} y1={32} r={16} fill={RECESS_SHADE} />
    <Rect x0={-30} y0={-34} x1={30} y1={34} r={14} fill={G1} />
    <Rect x0={-12} y0={-20} x1={12} y1={20} r={6} fill={PLUG_FACE} />
  </g>
);

/** Rising heat waves (red): three columns of small S-curves; the whole group sways up and down a little. */
export const HeatWaves: React.FC<{ t: number; n?: number }> = ({ t, n = 3 }) => {
  const bob = Math.sin(t * 5.5) * 3.2;
  return (
    <g transform={`translate(0 ${bob})`}>
      {Array.from({ length: n }, (_, k) => {
        const x = (k - (n - 1) / 2) * 16;
        return [0, 1, 2].map((j) => (
          <Arc key={`${k}${j}`} cx={x + (j % 2 ? 6 : -6)} cy={-j * 12} rx={6} ry={6}
            a0={j % 2 ? 90 : -90} a1={j % 2 ? 270 : 90} w={3.2} stroke={RED} />
        ));
      })}
    </g>
  );
};

/** Smoke rising from a scorched socket, grey puffs that grow as they climb (the sheet's three circles, moving). */
export const Smoke: React.FC<{ t: number }> = ({ t }) => (
  <g>
    {([[-30, -100, 14], [-12, -126, 18], [8, -156, 22]] as const).map(([dx, dy, r], i) => {
      const up = ((t * 12 + i * 6) % 18);                  // a short climb: the puffs must not cover the banner above
      return <Disc key={i} x={dx + Math.sin(t * 5 + i) * 3} y={dy + 22 - up} r={r * (0.85 + (up / 18) * 0.3)} fill={SMOKE} />;
    })}
  </g>
);

const Glow: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => (
  <g><Disc x={x} y={y} r={r} fill={HOT1} /><Disc x={x} y={y} r={r * 0.66} fill={HOT2} /><Disc x={x} y={y} r={r * 0.36} fill={RED} /></g>
);

/** The inside, side view, one pin. Box 0..240 x 0..160 with its top-left at the origin of this group. */
export const Cutaway: React.FC<{ loose?: boolean; heat?: number; dots?: boolean; t: number; wall?: boolean; draw?: number }> = ({ loose, heat = 1, dots = true, t, wall = true, draw = 1 }) => {
  const th = 7;
  const phase = (t * 48) % 110;
  const pulse = 1 + 0.07 * Math.sin(t * 15);
  return (
    <g>
      {wall && <Rect x0={0} y0={0} x1={240} y1={160} fill={WALL} />}
      <Rect x0={110} y0={18} x1={240} y1={142} r={10} fill={G3} />               {/* the socket body (cut) */}
      <Rect x0={110} y0={56} x1={232} y1={104} fill={G2} />                       {/* the cavity */}
      <Rect x0={110} y0={56} x1={232} y1={64} fill={CAVITY_SHADE} />              {/* its depth: shade on the top and back */}
      <Rect x0={224} y0={56} x1={232} y1={104} fill={CAVITY_SHADE} />
      <Rect x0={4} y0={30} x1={78} y1={130} r={14} fill={G1} />                   {/* the plug body */}
      <Rect x0={78} y0={72} x1={196} y1={88} fill={WHITE} />                      {/* the pin */}
      <Rect x0={78} y0={86} x1={196} y1={88} fill={METAL} />
      <Line a={[4, 80]} b={[4 - 18 * draw, 80]} w={10} stroke={G1} />                       {/* the plug's cable */}
      <Line a={[214, 80]} b={[214 + 40 * draw, 80]} w={8} stroke={BLACK} />                   {/* the house wire */}
      {!loose ? (
        <>
          {[72 - th, 88].map((y0) => <Rect key={y0} x0={124} y0={y0} x1={214} y1={y0 + th} fill={METAL} />)}
          <Rect x0={208} y0={58} x1={216} y1={102} fill={METAL} />
        </>
      ) : (
        <>
          {[-1, 1].map((sgn) => {
            const baseY = 80 + sgn * 28, tipY = 80 + sgn * 8 + (sgn > 0 ? 0 : -th);
            return <polygon key={sgn} fill={METAL} points={`214,${baseY - th / 2} 214,${baseY + th / 2} 132,${tipY + th} 132,${tipY}`} />;
          })}
          <Rect x0={208} y0={50} x1={216} y1={110} fill={METAL} />
          {heat > 0 && <Glow x={134} y={80} r={22 * (0.55 + 0.45 * heat) * pulse} />}
          <Rect x0={78} y0={72} x1={196} y1={86} fill={WHITE} />
        </>
      )}
      {dots && !loose && (
        <>
          {Array.from({ length: 5 }, (_, k) => <Disc key={k} x={84 + ((k * 22 + phase) % 110)} y={80} r={3.2} fill={YELLOW_D} />)}
          {Array.from({ length: 7 }, (_, k) => [70, 90].map((y) => <Disc key={`${k}${y}`} x={132 + k * 12} y={y} r={3.2} fill={YELLOW_D} />))}
        </>
      )}
      {dots && loose && (
        <>
          {/* the current crowds into the one small contact: the dots queue up in front of it and jostle */}
          {Array.from({ length: 5 }, (_, k) => <Disc key={k} x={96 + k * 7 + ((t * 30) % 7) * (k % 2 ? 0.5 : 1)} y={80 + Math.sin(t * 17 + k * 2) * 3} r={3.2} fill={YELLOW_D} />)}
          {[71, 89].map((y) => <Disc key={y} x={134} y={y} r={3.2} fill={YELLOW} />)}
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k * 60 + t * 240) * (Math.PI / 180);
            return <Disc key={k} x={134 + 9 * Math.cos(a)} y={80 + 9 * Math.sin(a)} r={2.8} fill={YELLOW} />;
          })}
        </>
      )}
    </g>
  );
};

/** Several plugs piled on one socket, crossed out in red (tip: do not stack big appliances). Centred on the sheet's (70, 236). */
export const PlugStack: React.FC = () => (
  <g transform="translate(-70 -236)">
    <Rect x0={34} y0={228} x1={106} y1={262} r={8} fill={WHITE} />
    {[0, 1, 2].map((k) => <Rect key={k} x0={40 + k * 22} y0={206} x1={56 + k * 22} y1={232} r={4} fill={G1} />)}
    <Line a={[38, 210]} b={[102, 258]} w={6} stroke={RED} />      {/* corner to corner of the icon (34..106 x 206..262), not beyond it */}
  </g>
);

export { YELLOW };
