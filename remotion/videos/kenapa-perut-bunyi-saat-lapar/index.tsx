import React from "react";
import { CaptionLayer, FRAME, StoryVideo, THEMES, TopText, useFonts, type SceneProps, type StoryT } from "../../src/design/index.ts";
import { IsoBlock, Polys } from "../../src/components/Iso.tsx";
import { block, isoAt } from "../../src/iso.ts";
import { stageGeometry } from "../../src/stageShapes.ts";
import { ISO, SKIN_A, SKIN_B, BLACK, YELLOW } from "../../src/tokens.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;
const W = FRAME.width, H = FRAME.height;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** The gut is an opened tissue block with a broad colon and smaller coiled intestine layered on its cut face. */
const Scene = ({ beat, t, index }: SceneProps) => {
  useFonts();
  const START = [0,3,4,12,21,30,42,52,56];
  const elapsed = START[index] + t;
  const time = elapsed >= 59.5 ? elapsed - 60 : elapsed;
  const u = 100, o: [number, number] = [540, 1020], y = 0.82;
  const P = (x: number, z: number) => isoAt([x, y, z], u, o);
  const roundStage = stageGeometry("round",100).polys;
  const cutawayBacking = block([-3.5,-0.75,-1.86],[3.5,-0.73,1.86],u,o);
  const hook = beat.kind === "hook";
  const sting = beat.kind === "sting";
  const outro = beat.kind === "outro";
  const loopHook = outro && t >= 3.5;
  const intro = hook || loopHook;
  const bodyOn = index >= 2 && !outro;
  const turn = beat.id === "kontraksi";
  const pulse = turn ? 1 - 0.085 * (0.5 + 0.5 * Math.sin(time * 7)) : 1;
  const bellyPulse = 1 + 0.012 * Math.sin(time * 3.5);
  const bodyPulse = 1 + (turn ? 0.03 : 0.012) * Math.sin(time * 2.4);
  const headT = intro ? 0.25 : t;
  const headAlpha = loopHook ? clamp01((t - 3.5) / 0.45) : 1;
  const head = intro ? "PERUT BUNYI?" : beat.text;
  const marker = (time * 0.56) % 3.1 - 1.55;
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
    <rect width={W} height={H} fill={THEMES.peach.wall} />
    {!intro && !sting && <g opacity={0.4}>{Array.from({length: 7}, (_,i) => <ellipse key={i} cx={540 + 85*Math.sin(time*0.2+i)} cy={280+i*210} rx={280+i*38} ry={72+i*12} fill="none" stroke={THEMES.peach.ring} strokeWidth="5" />)}</g>}
    
    {intro && <g>
      <ellipse cx="540" cy="1080" rx={402 * bellyPulse} ry={242 * bellyPulse} fill={SKIN_A} stroke={SKIN_B} strokeWidth="18" />
      <ellipse cx="540" cy="1080" rx="320" ry="172" fill="none" stroke={SKIN_B} strokeWidth="8" opacity="0.55" />
      <path d="M356 1080 C386 1025 416 1135 446 1080 S506 1025 536 1080 S596 1135 626 1080 S686 1025 716 1080" fill="none" stroke={YELLOW} strokeWidth="18" strokeLinecap="round" />
      <path d="M430 1080 Q455 1042 480 1080 T530 1080 T580 1080 T630 1080" fill="none" stroke={BLACK} strokeWidth="8" strokeLinecap="round" opacity="0.75" />
    </g>}

    {bodyOn && <g transform={`translate(540 1020) scale(${bodyPulse}) translate(-540 -1020)`}>
      <Polys polys={roundStage} tones={ISO.floor} />
      <Polys polys={cutawayBacking} tones={ISO.brain} opacity={0.45} />
      <IsoBlock a={[-3.55,-0.72,-1.9]} b={[3.55,0.82,1.9]} u={u} o={o} tones={ISO.organ} />
      <path d={`M ${P(2.15,-1.25).join(" ")} C ${P(2.82,-0.92).join(" ")} ${P(2.84,1.18).join(" ")} ${P(2.15,1.22).join(" ")} C ${P(1.45,1.30).join(" ")} ${P(1.42,0.82).join(" ")} ${P(1.42,0.48).join(" ")} L ${P(1.42,-0.38).join(" ")} C ${P(1.42,-0.78).join(" ")} ${P(1.28,-1.02).join(" ")} ${P(0.88,-1.04).join(" ")} L ${P(-0.92,-1.04).join(" ")} C ${P(-1.35,-1.04).join(" ")} ${P(-1.45,-0.75).join(" ")} ${P(-1.45,-0.38).join(" ")} L ${P(-1.45,0.56).join(" ")} C ${P(-1.45,0.98).join(" ")} ${P(-1.72,1.15).join(" ")} ${P(-2.18,1.12).join(" ")} C ${P(-2.82,1.08).join(" ")} ${P(-2.8,-0.9).join(" ")} ${P(-2.18,-1.25).join(" ")}`} fill="none" stroke={SKIN_B} strokeWidth="76" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M ${P(2.15,-1.25).join(" ")} C ${P(2.82,-0.92).join(" ")} ${P(2.84,1.18).join(" ")} ${P(2.15,1.22).join(" ")} C ${P(1.45,1.30).join(" ")} ${P(1.42,0.82).join(" ")} ${P(1.42,0.48).join(" ")} L ${P(1.42,-0.38).join(" ")} C ${P(1.42,-0.78).join(" ")} ${P(1.28,-1.02).join(" ")} ${P(0.88,-1.04).join(" ")} L ${P(-0.92,-1.04).join(" ")} C ${P(-1.35,-1.04).join(" ")} ${P(-1.45,-0.75).join(" ")} ${P(-1.45,-0.38).join(" ")} L ${P(-1.45,0.56).join(" ")} C ${P(-1.45,0.98).join(" ")} ${P(-1.72,1.15).join(" ")} ${P(-2.18,1.12).join(" ")} C ${P(-2.82,1.08).join(" ")} ${P(-2.8,-0.9).join(" ")} ${P(-2.18,-1.25).join(" ")}`} fill="none" stroke={SKIN_A} strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
      <g transform={`translate(540 1020) scale(${pulse}) translate(-540 -1020)`}>
        <path d={`M ${P(-1.15,0.68).join(" ")} C ${P(-0.78,1.08).join(" ")} ${P(-0.22,1.02).join(" ")} ${P(-0.30,0.64).join(" ")} C ${P(-0.40,0.20).join(" ")} ${P(0.82,0.22).join(" ")} ${P(0.56,0.58).join(" ")} C ${P(0.30,0.96).join(" ")} ${P(-0.82,0.98).join(" ")} ${P(-0.92,0.54).join(" ")} C ${P(-1.02,0.10).join(" ")} ${P(0.95,0.08).join(" ")} ${P(0.88,0.42).join(" ")} C ${P(0.80,0.80).join(" ")} ${P(-0.40,0.82).join(" ")} ${P(-0.30,0.46).join(" ")} C ${P(-0.18,0.08).join(" ")} ${P(0.76,0.12).join(" ")} ${P(0.70,0.42).join(" ")}`} fill="none" stroke={ISO.organ[2]} strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M ${P(-1.15,0.68).join(" ")} C ${P(-0.78,1.08).join(" ")} ${P(-0.22,1.02).join(" ")} ${P(-0.30,0.64).join(" ")} C ${P(-0.40,0.20).join(" ")} ${P(0.82,0.22).join(" ")} ${P(0.56,0.58).join(" ")} C ${P(0.30,0.96).join(" ")} ${P(-0.82,0.98).join(" ")} ${P(-0.92,0.54).join(" ")} C ${P(-1.02,0.10).join(" ")} ${P(0.95,0.08).join(" ")} ${P(0.88,0.42).join(" ")} C ${P(0.80,0.80).join(" ")} ${P(-0.40,0.82).join(" ")} ${P(-0.30,0.46).join(" ")} C ${P(-0.18,0.08).join(" ")} ${P(0.76,0.12).join(" ")} ${P(0.70,0.42).join(" ")}`} fill="none" stroke={SKIN_A} strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx={540 + marker * 38} cy="1010" r="17" fill={YELLOW} stroke={BLACK} strokeWidth="4" />
      {turn && <g fill="none" stroke={YELLOW} strokeWidth="12" opacity="0.9"><ellipse cx="540" cy="1000" rx={328 + 18*Math.sin(time*6)} ry="172"/><ellipse cx="540" cy="1000" rx={372 + 18*Math.sin(time*6)} ry="210"/></g>}
      {beat.id === "bukan-meteran" && <g><path d="M360 1450H720" stroke={BLACK} strokeWidth="12"/><path d="M540 1416V1484" stroke={YELLOW} strokeWidth="20"/></g>}
    </g>}
    {intro && <g opacity={headAlpha}><TopText headline={head} t={headT}/></g>}
    {!intro && !sting && !outro && <><TopText headline={head} t={t}/><CaptionLayer beat={beat} t={t}/></>}

  </svg>;
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = ({ story: s }) => <StoryVideo story={s} scene={Scene} />;
