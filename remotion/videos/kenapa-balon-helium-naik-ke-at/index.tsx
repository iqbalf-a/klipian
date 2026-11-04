/* Kenapa balon helium naik ke atas?: one tall party hall (set kind "party-hall"), one hero (a latex balloon: an egg-shaped body with a tied knot at the
   bottom, not a circle) and one continuous camera (plan.ts CAM). Air has weight, helium is lighter (a balance), the air pushes the balloon up (arrows),
   the ribbon is let go and the balloon rises to the ceiling, then it stops where its weight equals the air it moves. The first frame is the last (loop). */
import React from "react";
import {
  BLACK, CaptionLayer, Label, Mascot, StoryVideo, TopText, YELLOW, YELLOW_D, block, cam2At, clamp01, easeInOut, easeOutBack,
  layerTransform, ptsAttr, springAt, useFonts, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { ISO, THEMES, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { BALLOON_END_Y, CAM, HALL, T } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const P = THEMES.peach, WATER = ISO.water;
const WALL = P.wall, CEIL = mixRgb(P.floorEdge, WHITE, 0.45), FLOOR = P.floor;
const GLASS: [string, string, string] = [mixRgb(WHITE, WATER[0], 0.15), mixRgb(WHITE, WATER[0], 0.32), mixRgb(WHITE, WATER[1], 0.4)];
const BOX_A = [mixRgb(WATER[0], WHITE, 0.2), WATER[1], WATER[2]] as const;
const BOX_B = ISO.brass;
const polys = (ps: Poly[], tones: readonly string[], op = 1) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={mixRgb(P.floorEdge, BLACK, 0.35)} strokeWidth={2} strokeLinejoin="round" opacity={op} />);
/** 0 to 1 over 0.35 s from `a`; and back to 0 at `b`. */
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
const S = 0.88;                                                         // the balloon's body scale: about 430 px wide and 520 px high (HALL.rx, HALL.ry)
const KNOT = 300 * S;                                                   // the knot's tip below the balloon's middle

/** The latex balloon: an egg-shaped body that is narrower at the bottom, a small knot with a flared neck, a soft shine. The shading follows the tone rule
    (light from the top left): the light tone on the top left, the mid tone as the body, the dark tone as a crescent on the right. */
const Balloon: React.FC<{ x: number; y: number; s?: number; rot?: number; sx?: number; sy?: number; id: string; op?: number; limp?: boolean }> = ({ x, y, s = 1, rot = 0, sx = 1, sy = 1, id, op = 1, limp = false }) => {
  const body = "M0 -290 C150 -290 240 -170 240 -30 C240 130 120 238 30 268 L18 296 L-18 296 L-30 268 C-120 238 -240 130 -240 -30 C-240 -170 -150 -290 0 -290 Z";
  const limpBody = "M0 -110 C150 -110 240 -60 240 -10 C240 50 120 100 30 112 L18 128 L-18 128 L-30 112 C-120 100 -240 50 -240 -10 C-240 -60 -150 -110 0 -110 Z";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s * S * sx} ${s * S * sy})`} opacity={op}>
      <defs><clipPath id={`bc-${id}`}><path d={limp ? limpBody : body} /></clipPath></defs>
      <path d={limp ? limpBody : body} fill={WATER[1]} stroke={WATER[2]} strokeWidth={7} strokeLinejoin="round" />
      <g clipPath={`url(#bc-${id})`}>
        <ellipse cx={170} cy={limp ? 20 : 20} rx={150} ry={limp ? 120 : 330} fill={WATER[2]} opacity={0.75} />
        <ellipse cx={-90} cy={limp ? -50 : -150} rx={limp ? 90 : 78} ry={limp ? 28 : 100} fill={WATER[0]} opacity={0.95} transform={`rotate(${limp ? -8 : 18} -90 ${limp ? -50 : -150})`} />
      </g>
      <path d={limp ? limpBody : body} fill="none" stroke={WATER[2]} strokeWidth={7} strokeLinejoin="round" />
    </g>
  );
};

const Plate: React.FC<{ x: number; y: number; w: number; h: number; k?: number }> = ({ x, y, w, h, k = 1 }) => <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={WHITE} opacity={0.85 * k} />;
const Arrow2: React.FC<{ x1: number; y1: number; x2: number; y2: number; color: string; k: number; w?: number }> = ({ x1, y1, x2, y2, color, k, w = 16 }) => {
  const ex = x1 + (x2 - x1) * k, ey = y1 + (y2 - y1) * k, a = Math.atan2(y2 - y1, x2 - x1), s = w * 2;
  return <g opacity={k > 0 ? 1 : 0}><line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={w} strokeLinecap="round" />
    <polygon points={`${ex},${ey} ${ex - s * Math.cos(a - 0.5)},${ey - s * Math.sin(a - 0.5)} ${ex - s * Math.cos(a + 0.5)},${ey - s * Math.sin(a + 0.5)}`} fill={color} /></g>;
};

/** A bubble of air: a little white circle that drifts a little all the time (periods 6 s and 3 s, so the loop is seamless). */
const dotAt = (i: number, c: number): [number, number] => [-320 + ((i * 397) % 1760) + 14 * Math.sin((c / 6 + i * 0.13) * Math.PI * 2), -650 + ((i * 613) % 2000) + 12 * Math.cos((c / 3 + i * 0.07) * Math.PI * 2)];
const rnd = (i: number) => ((i * 7919) % 1000) / 1000;

const Hall: React.FC<{ c: number }> = ({ c }) => {
  const stripes: React.ReactNode[] = [];
  for (let i = -8; i < 22; i++) stripes.push(<rect key={i} x={i * 200} y={HALL.ceiling} width={100} height={HALL.floor - HALL.ceiling} fill={mixRgb(WALL, WHITE, 0.4)} opacity={0.55} />);
  return (
    <g>
      <rect x={-3000} y={-3400} width={7000} height={3400 + HALL.ceiling} fill={CEIL} />
      <rect x={-3000} y={HALL.ceiling} width={7000} height={HALL.floor - HALL.ceiling} fill={WALL} />
      {stripes}
      <rect x={-3000} y={HALL.ceiling - 10} width={7000} height={26} fill={mixRgb(P.floorEdge, WHITE, 0.2)} />
      <rect x={-3000} y={HALL.floor - 52} width={7000} height={52} fill={P.floorEdge} />
      <rect x={-3000} y={HALL.floor} width={7000} height={2600} fill={FLOOR} />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={-3000} y={HALL.floor + 90 + i * i * 38 + i * 60} width={7000} height={4 + i} fill={P.floorEdge} opacity={0.5} />)}
      {/* the dressing at real size: gift boxes on the left, a round side table on the right (cut by the frame in the wide shot) */}
      {polys(block([-0.7, -0.7, 0], [0.7, 0.7, 1], 120, [150, HALL.floor + 20]), BOX_A)}
      {polys(block([-0.55, -0.55, 0], [0.55, 0.55, 0.8], 120, [150, HALL.floor + 20 - 120]), BOX_B)}
      <g>
        <ellipse cx={1090} cy={HALL.floor + 24} rx={120} ry={30} fill={BLACK} opacity={0.12} />
        <rect x={1078} y={HALL.floor - 320} width={24} height={330} fill={ISO.metal[1]} />
        <ellipse cx={1090} cy={HALL.floor - 322} rx={150} ry={40} fill={ISO.brass[0]} stroke={ISO.brass[2]} strokeWidth={5} />
        <path d={`M940 ${HALL.floor - 322} L1240 ${HALL.floor - 322} L1240 ${HALL.floor - 290} Q1090 ${HALL.floor - 250} 940 ${HALL.floor - 290} Z`} fill={ISO.brass[1]} stroke={ISO.brass[2]} strokeWidth={5} strokeLinejoin="round" />
      </g>
    </g>
  );
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock;
  const cam = cam2At(CAM, c);
  const sway = Math.sin((c / 6) * Math.PI * 2);
  const tied = c < T.untie || c >= T.newBalloon;
  const rise = easeInOut(clamp01((c - T.rise) / (T.riseEnd - T.rise)));
  const growK = 1 + 0.14 * easeInOut(clamp01((c - T.grow) / (T.growEnd - T.grow)));
  const floatY = c < T.rise ? HALL.restY + 6 * sway : HALL.restY + (BALLOON_END_Y - HALL.restY) * rise + (c >= T.riseEnd ? 5 * Math.sin(((c - T.riseEnd) / 3) * Math.PI * 2) * 0.4 : 0);
  const bump = c >= T.bump ? Math.exp(-(c - T.bump) * 3) * Math.sin((c - T.bump) * 14) * 0.07 : 0;
  const squash = c >= T.riseEnd - 0.3 && c < T.bump + 1.5 ? 0.05 + bump : 0;
  const flyY = Math.min(floatY, BALLOON_END_Y);
  const flyOp = 1 - clamp01((c - (T.tips - 0.6)) / 0.5);
  const newK = c >= T.newBalloon ? easeOutBack(clamp01((c - T.newBalloon) / 0.6)) : 0;
  const hook = { x: 540, y: HALL.boxTop };
  const bx = 540 + 6 * sway;
  const by = c < T.untie ? HALL.restY + 6 * sway : flyY;
  const ribbon = (x0: number, y0: number, x1: number, y1: number, k: number) => <path d={`M${x0} ${y0} Q${(x0 + x1) / 2 + k} ${(y0 + y1) / 2} ${x1} ${y1}`} fill="none" stroke={BLACK} strokeWidth={5} strokeLinecap="round" />;
  const isOutro = beat.kind === "outro";

  // the air: dots that fill the hall while the air is the subject; fewer and fewer with height in the last explanation
  const airOn = Math.max(on(c, T.dots, 33.5), on(c, T.thin, 47));
  const thin = c >= T.thin ? clamp01((c - T.thin) / 1.0) : 0;
  const dots: React.ReactNode[] = [];
  if (airOn > 0.02) for (let i = 0; i < 150; i++) {
    const [x, y] = dotAt(i, c);
    if (960 + (y - cam.y) * cam.zoom < 380) continue;
    if (c >= T.panScale - 0.5 && c < T.panBack && x > 700 && y > 600) continue;
    if (Math.pow((x - 540) / 260, 2) + Math.pow((y - by) / 320, 2) < 1 || (x > 420 && x < 660 && y > by && y < HALL.floor)) continue;
    const keep = thin > 0 ? (rnd(i) < clamp01((y - HALL.ceiling) / 2100) ? 1 : 0) : 1;
    if (!keep || y > HALL.floor - 60) continue;
    dots.push(<circle key={i} cx={x} cy={y} r={7} fill={WHITE} stroke={WATER[0]} strokeWidth={3} opacity={airOn * (0.35 + 0.65 * clamp01((c - T.dots - rnd(i) * 1.2) / 0.4))} />);
  }

  // the balance (the helium and the air, the same size)
  const PV = { x: 1330, y: 1050 }, L = 380;
  const tilt = -13 * easeInOut(clamp01((c - T.tilt) / 0.9)) * Math.PI / 180;
  const endL = [PV.x - L * Math.cos(tilt), PV.y - L * Math.sin(tilt)], endR = [PV.x + L * Math.cos(tilt), PV.y + L * Math.sin(tilt)];
  const scaleOn = on(c, T.beam, 17.9);
  const cube = (e: number[], k: number, nDots: number, tag: string) => {
    const bottom: [number, number] = [e[0], e[1] + 70 + 117];
    return <g opacity={k > 0 ? 1 : 0}>
      <line x1={e[0]} y1={e[1]} x2={e[0]} y2={e[1] + 70} stroke={BLACK} strokeWidth={5} />
      <g transform={`translate(${bottom[0]} ${bottom[1]}) scale(${k}) translate(${-bottom[0]} ${-bottom[1]})`}>
        {polys(block([-0.55, -0.55, 0], [0.55, 0.55, 1.3], 90, bottom), GLASS, 0.9)}
        {Array.from({ length: nDots }, (_, i) => <circle key={tag + i} cx={bottom[0] - 34 + (i % 3) * 34 + 4 * Math.sin((c / 3 + i) * Math.PI * 2)} cy={bottom[1] - 40 - Math.floor(i / 3) * 34 + 4 * Math.cos((c / 3 + i) * Math.PI * 2)} r={9} fill={WHITE} stroke={WATER[2]} strokeWidth={3} />)}
      </g>
    </g>;
  };

  // the rest of the explanation beats
  const upK = (a: number) => clamp01((c - a) / 0.5);
  const pushOn = on(c, T.hit, T.untie - 0.2);
  const ghostK = on(c, T.ghost, 40.6);
  const ceilBalloonY = BALLOON_END_Y + 8 * Math.sin((c / 6) * Math.PI * 2) * (c >= T.riseEnd ? 0.3 : 0);

  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 0.3)}><rect x={-3000} y={-3600} width={7000} height={8000} fill={CEIL} /></g>
      <g transform={layerTransform(cam, 1)}>
        <Hall c={c} />
        {/* the weight: a gift box the ribbon is tied to */}
        {polys(block([-0.6, -0.6, 0], [0.6, 0.6, 1], 120, [540, HALL.floor + 4]), BOX_A)}
        {polys(block([-0.5, -0.5, 0], [0.5, 0.5, 0.18], 120, [540, HALL.floor + 4 - 120]), BOX_B)}
        {dots}

        {/* the balloon tied to the box (the first frame and the last) */}
        {tied && !isOutro && c < T.untie && <>
          {ribbon(bx, by + KNOT, hook.x, hook.y, 36 * sway)}
          <Balloon id="tied" x={bx} y={by} rot={2.2 * sway} />
        </>}
        {isOutro && newK > 0.001 && <g transform={`translate(${hook.x} ${hook.y}) scale(${newK}) translate(${-hook.x} ${-hook.y})`}>
          {ribbon(bx, HALL.restY + 6 * sway + KNOT, hook.x, hook.y, 36 * sway)}
          <Balloon id="new" x={bx} y={HALL.restY + 6 * sway} rot={2.2 * sway} />
        </g>}

        {/* after the ribbon is let go: the balloon floats up on its own, the ribbon trails below it */}
        {!isOutro && c >= T.untie && flyOp > 0.01 && <g opacity={flyOp}>
          {c < T.rise + 2.2 && <g opacity={1 - clamp01((c - T.rise - 1.4) / 0.8)}>{ribbon(hook.x, hook.y - 8, hook.x + 24, hook.y - 10 - 60 * easeInOut(clamp01((c - T.untie) / 0.6)), 20 * sway)}</g>}
          {ribbon(540 + 6 * sway * (1 - rise), flyY + KNOT * growK, 540 + 30 * sway, flyY + KNOT * growK + 230 * (1 - 0.5 * rise), 40 * sway)}
          <Balloon id="fly" x={540 + 6 * sway * (1 - rise)} y={c >= T.riseEnd ? ceilBalloonY : flyY} rot={2.2 * sway * (1 - rise)} s={c >= T.grow ? growK : 1} sx={1 + squash} sy={1 - squash} />
        </g>}

        {/* beat 1: the air presses down */}
        {on(c, T.downA, 10.3) > 0.02 && <g opacity={on(c, T.downA, 10.3)}>
          <Arrow2 x1={200} y1={-90} x2={200} y2={330} color={BLACK} k={upK(T.downA)} />
          <Arrow2 x1={880} y1={-90} x2={880} y2={330} color={BLACK} k={upK(T.downB)} />
          <Plate x={540} y={1060} w={480} h={100} k={clamp01((c - T.lblPress) / 0.25)} /><Label text="udara punya berat" x={540} y={1086} fs={56} t={c} start={T.lblPress} highlight={["berat"]} />
        </g>}

        {/* beat 2: the balance, the same size of air and of helium */}
        {scaleOn > 0.02 && <g opacity={scaleOn}>
          {polys(block([-0.3, -0.3, 0], [0.3, 0.3, 3.5], 100, [PV.x, HALL.floor]), ISO.metal)}
          <g transform={`translate(${PV.x} ${PV.y}) rotate(${(tilt * 180) / Math.PI}) translate(${-PV.x} ${-PV.y})`}>
            <rect x={PV.x - L} y={PV.y - 11} width={2 * L} height={22} rx={11} fill={ISO.brass[1]} stroke={ISO.brass[2]} strokeWidth={4} />
          </g>
          <circle cx={PV.x} cy={PV.y} r={20} fill={ISO.brass[0]} stroke={ISO.brass[2]} strokeWidth={4} />
          {cube(endL, easeOutBack(clamp01((c - T.cubeAir) / 0.5)), 9, "a")}
          {cube(endR, easeOutBack(clamp01((c - T.cubeHe) / 0.5)), 3, "h")}
          <Label text="udara" x={endL[0]} y={endL[1] + 340} fs={56} t={c} start={T.lblAir} />
          <Label text="helium" x={endR[0]} y={endR[1] + 340} fs={56} t={c} start={T.lblHe} />
          <Plate x={PV.x} y={PV.y - 150} w={540} h={92} k={clamp01((c - T.lblNum) / 0.25)} /><Label text="helium 0,18 g/liter" x={PV.x} y={PV.y - 126} fs={50} t={c} start={T.lblNum} highlight={["0,18"]} />
        </g>}

        {/* beat 3: the air pushes up from all sides, the weight pulls down */}
        {pushOn > 0.02 && <g opacity={pushOn}>
          <Arrow2 x1={140} y1={640} x2={140} y2={300} color={YELLOW_D} k={upK(T.upA)} w={22} />
          <Arrow2 x1={940} y1={640} x2={940} y2={300} color={YELLOW_D} k={upK(T.upB)} w={22} />
          <Arrow2 x1={400} y1={760} x2={400} y2={540} color={YELLOW_D} k={upK(T.upC)} w={22} />
          <Arrow2 x1={680} y1={760} x2={680} y2={540} color={YELLOW_D} k={upK(T.upD)} w={22} />
          <Plate x={540} y={880} w={620} h={92} k={clamp01((c - T.lblPush) / 0.25)} /><Label text="dorongan udara" x={540} y={906} fs={54} t={c} start={T.lblPush} highlight={["dorongan"]} />
          <Arrow2 x1={540} y1={300} x2={540} y2={400} color={BLACK} k={upK(T.weight)} w={14} />
          <Plate x={540} y={1010} w={600} h={86} k={clamp01((c - T.lblWeight) / 0.25)} /><Label text="berat balon" x={540} y={1034} fs={50} t={c} start={T.lblWeight} />
        </g>}
        {on(c, T.lblDisp, T.untie - 0.2) > 0.02 && <g opacity={on(c, T.lblDisp, T.untie - 0.2)}>
          <Plate x={540} y={1150} w={700} h={92} k={clamp01((c - T.lblDisp) / 0.25)} /><Label text="= berat udara tergeser" x={540} y={1176} fs={48} t={c} start={T.lblDisp} />
        </g>}

        {/* beat 4: let go */}
        {on(c, T.lblFree, T.rise + 2.4) > 0.02 && <g opacity={on(c, T.lblFree, T.rise + 2.4)}><Plate x={760} y={1190} w={300} h={88} k={clamp01((c - T.lblFree) / 0.25)} /><Label text="lepas!" x={760} y={1216} fs={56} t={c} start={T.lblFree} /></g>}

        {/* result: the displaced air as a ghost, and the comparison */}
        {ghostK > 0.02 && <g opacity={ghostK}>
          <g opacity={0.5}>{polys(block([-1.9, -1.9, 0], [1.9, 1.9, 1.6], 135, [540, BALLOON_END_Y + 240]), GLASS, 0.35)}</g>
          <rect x={150} y={BALLOON_END_Y + 290} width={780} height={330} rx={50} fill={WHITE} opacity={0.88} />
          <Label text="balon + helium" x={540} y={BALLOON_END_Y + 380} fs={58} t={c} start={T.lblBalloon} />
          <g opacity={clamp01((c - T.less) / 0.3)}><text x={540} y={BALLOON_END_Y + 480} fontSize={100} textAnchor="middle" fill={YELLOW_D} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>{"<"}</text></g>
          <Label text="udara tergeser" x={540} y={BALLOON_END_Y + 580} fs={58} t={c} start={T.lblAirDisp} />
        </g>}

        {/* the limit: the balloon swells while the pressure falls, and it stops where the weights are equal */}
        {on(c, T.lblPressure, 46.8) > 0.02 && <g opacity={on(c, T.lblPressure, 46.8)}>
          <Plate x={540} y={BALLOON_END_Y + 404} w={620} h={92} k={clamp01((c - T.lblPressure) / 0.25)} /><Label text="tekanan turun" x={540} y={BALLOON_END_Y + 430} fs={54} t={c} start={T.lblPressure} />
          <Arrow2 x1={330} y1={BALLOON_END_Y + 60} x2={250} y2={BALLOON_END_Y + 60} color={BLACK} k={upK(T.grow + 0.5)} w={12} />
          <Arrow2 x1={750} y1={BALLOON_END_Y + 60} x2={830} y2={BALLOON_END_Y + 60} color={BLACK} k={upK(T.grow + 0.5)} w={12} />
        </g>}
        {on(c, T.equal, 46.8) > 0.02 && <g opacity={on(c, T.equal, 46.8)}>
          <Plate x={540} y={BALLOON_END_Y + 514} w={540} h={92} k={clamp01((c - T.lblEqual) / 0.25)} /><Label text="berat sama = berhenti" x={540} y={BALLOON_END_Y + 540} fs={46} t={c} start={T.lblEqual} />
        </g>}

        {/* tips: a balloon of breath lies on the floor, a balloon of helium floats */}
        {on(c, T.cardA, 56) > 0.02 && <g opacity={on(c, T.cardA, 56)}>
          <Balloon id="breath" x={810} y={HALL.floor - 70} rot={-8} s={0.55} limp />
          <Plate x={810} y={1130} w={470} h={92} k={clamp01((c - T.lblBreath) / 0.25)} /><Label text="isi napas: jatuh" x={810} y={1156} fs={50} t={c} start={T.lblBreath} />
        </g>}
        {on(c, T.cardB, 56) > 0.02 && <g opacity={on(c, T.cardB, 56)}>
          <g transform={`translate(0 ${6 * sway})`}>{ribbon(300, 660 + 125, 300 + 30 * sway, 660 + 330, 30)}<Balloon id="mini" x={300} y={660} s={0.5} rot={3 * sway} /></g>
          <Plate x={300} y={1080} w={470} h={92} k={clamp01((c - T.lblHelium) / 0.25)} /><Label text="isi helium: naik" x={300} y={1106} fs={50} t={c} start={T.lblHelium} />
        </g>}
      </g>
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText key={beat.id} kicker={beat.kind === "hook" ? "KENAPA BALON" : beat.kind === "result" ? "JAWABANNYA" : "INTIP BALON"} headline={beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={c} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1489) scale(${Math.max(0, p2)}) translate(-540 -1489)`}>
            <rect x={-210 + 540} y={1443} width={420} height={92} rx={46} fill={YELLOW} />
            <text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>Intip yuk!</text>
          </g>
        </g>;
      })()}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
