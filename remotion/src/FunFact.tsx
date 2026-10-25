/* The composition: a story (JSON) in, 1080 x 1920 at 30 fps out. Each beat is one scene; the video lasts the sum of the beats
   (a transition overlaps the end of the previous beat, so the beats keep their length). The look is flat vector with SMOOTH
   motion: continuous time, springs and easing; every item enters (staggered), idles (hover, blink, breathing, the current
   always flowing), and the camera moves; shaking is only ever a danger action. The AI never writes any of this: it only
   fills the story, from the fixed vocabulary of motion.ts. */
import React, { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { evolvePath } from "@remotion/paths";
import { FONT_BOLD, FONT_MONO, FRAME, G1, SHEET_TO_VIDEO as K } from "./tokens.ts";
import type { BeatT, ItemT, StoryT } from "./schema.ts";
import { breathe, blink, cameraAt, easeOut, emphasisFx, enterFx, exitFx, exprAt, lookAt, poseAt, springAt, clamp01 } from "./motion.ts";
import { cameraOf, enterOf, FPS, sequencePlan, transitionInto } from "./timeline.ts";
import { presentationFor } from "./transitions.tsx";
import { Mascot } from "./components/Mascot.tsx";
import { Chibi } from "./components/Chibi.tsx";
import { Cutaway, HeatWaves, PlugIn, PlugStack, Smoke, SocketOutside, SOCKET_BOX } from "./components/Socket.tsx";
import { LensReveal } from "./components/LensReveal.tsx";
import { Arrow, Badge, Banner, Black, Label, Pill, Room } from "./components/UI.tsx";
import { Brand, Lab } from "./components/Backgrounds.tsx";
import type { ChibiExpression, ChibiPose, MascotExpression } from "./catalog.ts";

export { totalFrames } from "./timeline.ts";

const FONTS = [
  { family: FONT_BOLD, file: "fonts/Outfit-Bold.ttf", weight: "700" },
  { family: FONT_BOLD, file: "fonts/Outfit-Regular.ttf", weight: "400" },
  { family: FONT_MONO, file: "fonts/DMMono-Regular.ttf", weight: "400" },
];

export function useFonts(): void {
  const [handle] = useState(() => delayRender("loading the fonts"));
  useEffect(() => {
    Promise.all(FONTS.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(f.file)})`, { weight: f.weight });
      await face.load();
      (document.fonts as unknown as { add(f: FontFace): void }).add(face);
    })).then(() => continueRender(handle)).catch((err) => cancelRender(err));
  }, [handle]);
}

/** The point an item grows, slides and pulses around. */
function pivotOf(item: ItemT): [number, number] {
  if (item.type === "banner") return [FRAME.width / 2, (item.y ?? 22 * K) + ((item.fs ?? 20 * K) * 2.6) / 2];
  return [item.x, item.y];
}

/** One object of a scene, by its type, brought to life by the story's motion words (or the defaults). */
const SceneItem: React.FC<{ item: ItemT; beatId: string; index: number; t: number; clock: number; lab: boolean }> = ({ item, index, t, clock, lab }) => {
  const plan = enterOf(item, index);
  const enter = enterFx(plan, t), exit = exitFx(item.exit, t), emph = emphasisFx(item.actions, t);
  const opacity = enter.opacity * exit.opacity, scale = enter.scale * exit.scale * emph.scale;
  if (opacity <= 0.002 || scale <= 0.001) return null;
  const [px, py] = pivotOf(item);
  const draw = plan.kind === "draw" ? enter.draw : 1;
  const textStart = plan.delay + (plan.kind === "slide" ? 0.1 : 0.05);
  const wrap = (children: React.ReactNode) => (
    <g opacity={opacity} transform={`translate(${px + enter.tx + exit.tx + emph.tx} ${py + enter.ty + exit.ty}) scale(${scale}) translate(${-px} ${-py})`}>{children}</g>
  );
  switch (item.type) {
    case "mascot": {
      const face = exprAt(item.expr, item.actions, t);
      const squash = plan.kind === "pop" ? 0.28 * clamp01(1 - springAt(t, plan.delay)) : 0;
      return wrap(<Mascot x={item.x} y={item.y} w={item.w} expr={face.expr as MascotExpression} t={t} sparks={item.sparks} rot={item.rot}
        body={item.body} squash={squash} look={lookAt(item.actions, t)} bump={face.bump} phase={(item.persist ? 0 : index) * 1.7} clock={clock} />);
    }
    case "chibi": {
      const face = exprAt(item.expr, item.actions, t), pose = poseAt(item.pose, item.actions, t);
      return wrap(
        <g transform={`translate(${item.x} ${item.y})`}>
          <Chibi u={item.u} expr={face.expr as ChibiExpression} pose={pose.from as ChibiPose} poseTo={pose.to as ChibiPose} mix={pose.mix}
            costume={item.costume} open={blink(t, 4.1, index * 0.9 + 1.3)} breath={breathe(t)} bump={face.bump} />
        </g>);
    }
    case "socket": {
      const k = K * item.s;
      if (item.view === "cutaway") {
        return wrap(
          <g transform={`translate(${item.x} ${item.y}) scale(${k}) translate(${-SOCKET_BOX.w / 2} ${-SOCKET_BOX.h / 2})`}>
            <Cutaway loose={item.variant === "loose"} dots={item.dots ?? true} t={t} draw={draw} wall={!lab}
              heat={(item.heat ?? (item.variant === "loose" ? 1 : 0)) * (item.variant === "loose" ? 0.3 + 0.7 * easeOut(clamp01((t - plan.delay) / 2.5)) : 1)} />
          </g>);
      }
      // the cable follows its route (it drops to the floor, runs along it, leaves the frame or ends behind an object), or goes straight
      const route = item.plug?.route ?? [[item.x, item.y + 20 * k], [item.plug?.cableX ?? item.x, item.plug?.cableY ?? item.y]];
      const cablePath = item.plug ? `M ${route.map(([px, py]) => `${px} ${py}`).join(" L ")}` : "";
      const cable = item.plug ? evolvePath(draw, cablePath) : null;
      return wrap(
        <g>
          {item.plug && cable && <path d={cablePath} fill="none" stroke={G1} strokeWidth={7 * k} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={cable.strokeDasharray} strokeDashoffset={cable.strokeDashoffset} />}
          <g transform={`translate(${item.x} ${item.y}) scale(${k})`}>
            <SocketOutside scorched={item.variant === "scorched"} />
            {item.plug && <PlugIn />}
            {item.waves && <g transform={`translate(0 ${-50 / item.s}) scale(${0.9 / item.s})`}><HeatWaves t={t} /></g>}
            {item.smoke && <g transform={`scale(${1 / item.s})`}><Smoke t={t} /></g>}
          </g>
        </g>);
    }
    case "lens":
      return wrap(<LensReveal id={`${index}`} x={item.x} y={item.y} r={item.r} variant={item.variant} heat={item.heat} t={t} clock={clock}
        revealFrom={item.reveal?.from ?? plan.delay} revealDur={item.reveal?.dur} />);
    case "stack":
      return wrap(<g transform={`translate(${item.x} ${item.y}) scale(${K * item.s})`}><PlugStack /></g>);
    case "banner":
      return wrap(<Banner text={item.text} fs={item.fs} y={item.y} t={t} start={textStart} highlight={item.highlight} onDark={lab} />);
    case "pill":
      return wrap(<Pill text={item.text} x={item.x} y={item.y} fs={item.fs} t={t} start={textStart} highlight={item.highlight} />);
    case "label":
      return wrap(<Label text={item.text} x={item.x} y={item.y} fs={item.fs} color={item.color} align={item.align} lines={item.lines}
        t={t} start={textStart} highlight={item.highlight} onDark={lab} />);
    case "arrow":
      return wrap(<Arrow x={item.x} y={item.y} x2={item.x2} y2={item.y2} color={item.color} w={item.w} draw={draw} />);
    case "badge":
      return wrap(<Badge text={item.text} x={item.x} y={item.y} r={item.r} color={item.color} />);
  }
};

const isPersistent = (item: ItemT): boolean => item.type === "mascot" && !!item.persist;

const SceneSvg: React.FC<{ beat: BeatT; startFrame: number }> = ({ beat, startFrame }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;                                  // continuous time, seconds into the beat (it goes on during a transition)
  const clock = (startFrame + frame) / FPS;               // seconds of the video: backgrounds drift and idles run on it, so they carry across beats
  const bg = beat.scene.bg;
  const cam = cameraAt(cameraOf(beat), t, beat.dur);
  const cx = FRAME.width / 2, cy = FRAME.height / 2;
  return (
    <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ display: "block" }}>
      <g transform={`translate(${cam.tx} ${cam.ty}) translate(${cx} ${cy}) scale(${cam.scale}) translate(${-cx} ${-cy})`}>
        {bg === "room" ? <Room /> : bg === "brand" ? <Brand clock={clock} spot={beat.scene.spot} /> : bg === "lab" ? <Lab clock={clock} /> : <Black />}
        {beat.scene.items.map((item, i) => isPersistent(item) ? null : <SceneItem key={i} item={item} beatId={beat.id} index={i} t={t} clock={clock} lab={bg === "lab"} />)}
      </g>
      {/* a persistent mascot lives on the screen, not in the camera's world: it stays where it is from beat to beat (and through a
          transition), and only its face and gaze change */}
      {beat.scene.items.map((item, i) => isPersistent(item) ? <SceneItem key={i} item={item} beatId={beat.id} index={i} t={t} clock={clock} lab={bg === "lab"} /> : null)}
    </svg>
  );
};

const BeatScene: React.FC<{ beat: BeatT; startFrame: number }> = ({ beat, startFrame }) =>
  beat.blur ? <CameraMotionBlur shutterAngle={180} samples={5}><SceneSvg beat={beat} startFrame={startFrame} /></CameraMotionBlur> : <SceneSvg beat={beat} startFrame={startFrame} />;

export const FunFact: React.FC<{ story: StoryT }> = ({ story }) => {
  useFonts();
  const plan = sequencePlan(story);
  const children: React.ReactNode[] = [];
  plan.forEach((p, i) => {
    const tr = transitionInto(story, i);
    if (i > 0 && tr.frames > 0) {
      children.push(<TransitionSeries.Transition key={`tr-${p.beat.id}`} presentation={presentationFor(p.beat.transition!)} timing={linearTiming({ durationInFrames: tr.frames })} />);
    }
    children.push(
      <TransitionSeries.Sequence key={p.beat.id} durationInFrames={p.sequenceFrames}>
        <BeatScene beat={p.beat} startFrame={p.from} />
      </TransitionSeries.Sequence>);
  });
  return <TransitionSeries>{children}</TransitionSeries>;
};
