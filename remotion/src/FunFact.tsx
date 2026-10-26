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
import { cablePath, type Pt } from "./cable.ts";
import { DefaultLookContext, Host3D, Placed, projectToScreen, type Look } from "./three/common.tsx";
import { ANCHORS, CABLE_EXIT, Cable3D, Cutaway3D, Plug3D, PlugHeat, Smoke3D, WallSocket3D } from "./three/Socket3D.tsx";
import { easeOutBack } from "./motion.ts";
import { Ring, Line } from "./components/svg.tsx";
import { BLACK, YELLOW_D } from "./tokens.ts";
import { applyLayout, fixedLayers, layoutStory } from "./layout.ts";
import { CaptionLayer, TopText } from "./components/Captions.tsx";
import { SourceCard } from "./components/Cards.tsx";
import { LayoutDebug } from "./components/LayoutDebug.tsx";

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

const SHEET_LENS_R = 92;

/** Is this item drawn as a 3D toon model (the default for sockets and lenses) rather than the flat 2D one? */
export const is3D = (item: ItemT): boolean => (item.type === "socket" || item.type === "lens") && item.model !== "flat";

/** The 3D placement of a socket or lens: where its centre is on the screen and its story scale. The lens shows the cutaway centred on
    the pin (52 sheet units to the right of the box centre), at the lens's own scale. */
function placement(item: ItemT): { x: number; y: number; s: number } | null {
  if (item.type === "socket") return { x: item.x, y: item.y, s: item.s };
  if (item.type === "lens") { const q = item.r / SHEET_LENS_R; return { x: item.x - 52 * q, y: item.y, s: q / K }; }
  return null;
}

/** How far a part of a 3D item of the beat has moved from its resting pose (orbit off) on the screen: a label or arrow that follows it moves by that. */
function followAt(items: readonly ItemT[], follow: { item: string; anchor: string } | undefined, clock: number): { x: number; y: number } {
  if (!follow) return { x: 0, y: 0 };
  const target = items.find((o) => (o.type === "socket" || o.type === "lens") && o.id === follow.item);
  const at = target && placement(target);
  if (!at) return { x: 0, y: 0 };
  const part = ANCHORS[follow.anchor] ?? ANCHORS.center;
  const now = projectToScreen(at.x, at.y, at.s, clock, part, 0), rest = projectToScreen(at.x, at.y, at.s, clock, part, 0, false, true);
  return { x: now.x - rest.x, y: now.y - rest.y };
}

const layer: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: FRAME.width, height: FRAME.height };

/** A 3D item (a socket or a lens): its own transparent canvas between the 2D layers, with the same enter / exit / emphasis as a 2D item. */
const Item3DLayer: React.FC<{ item: ItemT; index: number; t: number; clock: number }> = ({ item, index, t, clock }) => {
  if (item.type !== "socket" && item.type !== "lens") return null;
  const plan = enterOf(item, index);
  const enter = enterFx(plan, t), exit = exitFx(item.exit, t), emph = emphasisFx(item.actions, t);
  const opacity = enter.opacity * exit.opacity, scale = enter.scale * exit.scale * emph.scale;
  if (opacity <= 0.002 || scale <= 0.001) return null;
  const [px, py] = [item.x, item.y];
  const draw = plan.kind === "draw" ? enter.draw : 1;
  const style: React.CSSProperties = {
    ...layer, opacity, transformOrigin: `${px}px ${py}px`,
    transform: `translate(${enter.tx + exit.tx + emph.tx}px, ${enter.ty + exit.ty}px) scale(${scale})`,
  };
  const ramp = (item.heat ?? (item.type === "socket" && item.variant === "loose" ? 1 : 0)) * (0.3 + 0.7 * easeOut(clamp01((t - plan.delay) / 2.5)));

  if (item.type === "lens") {
    const q = item.r / SHEET_LENS_R;
    const p = Math.max(0, easeOutBack((t - (item.reveal?.from ?? plan.delay)) / (item.reveal?.dur ?? 0.8)));
    const now = item.r * p;
    if (now < 1) return null;
    const hh = 0.72 * now;
    return (
      <div style={style}>
        <div style={{ ...layer, clipPath: `circle(${now}px at ${item.x}px ${item.y}px)` }}>
          {/* inside the lens is the lab, and the cutaway is a 3D model cut lengthwise, centred on the pin */}
          <svg width={FRAME.width} height={FRAME.height} style={layer}><Lab clock={clock} /></svg>
          <Host3D><Placed x={item.x - 52 * q} y={item.y} s={q / K} clock={clock}><Cutaway3D loose={item.variant === "loose"} heat={item.heat ?? 1} t={t} /></Placed></Host3D>
        </div>
        <svg width={FRAME.width} height={FRAME.height} style={layer}>
          <g transform={`translate(${item.x} ${item.y})`}>
            <Ring x={0} y={0} r={now} w={12 * q * p} stroke={BLACK} />
            <Line a={[hh, hh]} b={[hh + 46 * q * p, hh + 46 * q * p]} w={16 * q * p} stroke={YELLOW_D} />
          </g>
        </svg>
      </div>
    );
  }

  if (item.view === "cutaway") {
    return (
      <div style={style}>
        <Host3D><Placed x={item.x} y={item.y} s={item.s} clock={clock}><Cutaway3D loose={item.variant === "loose"} heat={ramp} dots={item.dots ?? true} t={t} draw={draw} /></Placed></Host3D>
      </div>
    );
  }
  // the outside view: the wall socket, its plug, the cable (a tube along the same smooth curve as the 2D cable), heat and smoke
  const k = K * item.s;
  const tip: Pt = [item.x, item.y + (-CABLE_EXIT.y * 0.9) * (k / 0.02)];
  const route: Pt[] | null = item.plug ? [tip, ...((item.plug.route ?? [[item.x, item.y], [item.plug.cableX ?? item.x, item.plug.cableY ?? item.y]]).slice(1) as Pt[])] : null;
  return (
    <div style={style}>
      <Host3D>
        <Placed x={item.x} y={item.y} s={item.s} clock={clock} phase={index}>
          <WallSocket3D scorched={item.variant === "scorched"} />
          {item.plug && <Plug3D />}
          {item.plug && ramp > 0 && <PlugHeat heat={ramp} t={t} />}
          {item.smoke && <group scale={1 / item.s}><Smoke3D t={t} /></group>}
        </Placed>
        {route && <Cable3D route={route} radiusPx={4.3 * k} draw={draw} />}
      </Host3D>
      {item.waves && (
        <svg width={FRAME.width} height={FRAME.height} style={layer}>
          <g transform={`translate(${item.x} ${item.y}) scale(${k})`}><g transform={`translate(0 ${-50 / item.s}) scale(${0.9 / item.s})`}><HeatWaves t={t} /></g></g>
        </svg>
      )}
    </div>
  );
};

/** One 2D object of a scene, by its type, brought to life by the story's motion words (or the defaults). */
const SceneItem: React.FC<{ item: ItemT; beat: BeatT; index: number; t: number; clock: number; lab: boolean; claims?: StoryT["claims"] }> = ({ item, beat, index, t, clock, lab, claims }) => {
  const off = (item.type === "label" || item.type === "arrow") ? followAt(beat.scene.items, item.follow, clock) : { x: 0, y: 0 };
  const plan = enterOf(item, index);
  const enter = enterFx(plan, t), exit = exitFx(item.exit, t), emph = emphasisFx(item.actions, t);
  const opacity = enter.opacity * exit.opacity, scale = enter.scale * exit.scale * emph.scale;
  if (opacity <= 0.002 || scale <= 0.001) return null;
  const [px, py] = (() => { const [a, b] = pivotOf(item); return [a + off.x, b + off.y] as [number, number]; })();
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
      const route = (item.plug?.route ?? [[item.x, item.y + 20 * k], [item.plug?.cableX ?? item.x, item.plug?.cableY ?? item.y]]) as Pt[];
      const d = item.plug ? cablePath(route) : "";                        // smooth: every corner rounded, a slight sag, round caps and joins
      const cable = item.plug ? evolvePath(draw, d) : null;
      return wrap(
        <g>
          {item.plug && cable && <path d={d} fill="none" stroke={G1} strokeWidth={7 * k} strokeLinecap="round" strokeLinejoin="round"
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
      return wrap(<Label text={item.text} x={item.x + off.x} y={item.y + off.y} fs={item.fs} color={item.color} align={item.align} lines={item.lines}
        t={t} start={textStart} highlight={item.highlight} onDark={lab} />);
    case "arrow":
      return wrap(<Arrow x={item.x + off.x} y={item.y + off.y} x2={item.x2 + off.x} y2={item.y2 + off.y} color={item.color} w={item.w} draw={draw} />);
    case "badge":
      return wrap(<Badge text={item.text} x={item.x} y={item.y} r={item.r} color={item.color} />);
    case "source": {
      const claim = claims?.[item.claim - 1];
      let domain = "";
      try { domain = new URL(claim?.sources[0] ?? "").hostname.replace(/^www\./, ""); } catch { domain = ""; }
      return wrap(<SourceCard x={item.x} y={item.y} w={item.w} quote={item.quote ?? claim?.text ?? ""} org={item.org} domain={domain} date={item.date} t={t} start={textStart} />);
    }
  }
};

const isPersistent = (item: ItemT): boolean => item.type === "mascot" && !!item.persist;

const SceneSvg: React.FC<{ beat: BeatT; startFrame: number; captions?: boolean; claims?: StoryT["claims"] }> = ({ beat, startFrame, captions, claims }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;                                  // continuous time, seconds into the beat (it goes on during a transition)
  const clock = (startFrame + frame) / FPS;               // seconds of the video: backgrounds drift and idles run on it, so they carry across beats
  const bg = beat.scene.bg;
  const cam = cameraAt(cameraOf(beat), t, beat.dur);
  const lab = bg === "lab";
  const svg = (key: React.Key, children: React.ReactNode) => <svg key={key} width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={layer}>{children}</svg>;
  return (
    <div style={{ position: "relative", width: FRAME.width, height: FRAME.height, overflow: "hidden" }}>
      {/* the camera's world: the background, then every item as its own layer (a 2D svg, or a 3D toon canvas), in the story's order */}
      <div style={{ ...layer, transformOrigin: `${FRAME.width / 2}px ${FRAME.height / 2}px`, transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})` }}>
        {svg("bg", bg === "room" ? <Room /> : bg === "brand" ? <Brand clock={clock} spot={beat.scene.spot} /> : lab ? <Lab clock={clock} /> : <Black />)}
        {beat.scene.items.map((item, i) => isPersistent(item) ? null : is3D(item)
          ? <Item3DLayer key={i} item={item} index={i} t={t} clock={clock} />
          : svg(i, <SceneItem item={item} beat={beat} index={i} t={t} clock={clock} lab={lab} claims={claims} />))}
      </div>
      {/* a persistent mascot lives on the screen, not in the camera's world: it stays where it is from beat to beat (and through a
          transition), and only its face and gaze change */}
      {/* the text layers of a voiced video sit on the screen too: the headline on top, the karaoke captions at the bottom */}
      {(beat.headline || captions) && svg("layers", <>
        {beat.headline && <TopText kicker={beat.kicker} headline={beat.headline} t={t} onDark={lab} />}
        {captions && <CaptionLayer beat={beat} t={t} />}
      </>)}
      {svg("persist", beat.scene.items.map((item, i) => isPersistent(item) ? <SceneItem key={i} item={item} beat={beat} index={i} t={t} clock={clock} lab={lab} /> : null))}
    </div>
  );
};

const BeatScene: React.FC<{ beat: BeatT; startFrame: number; debug?: boolean; captions?: boolean; claims?: StoryT["claims"] }> = ({ beat, startFrame, debug, captions, claims }) => {
  const scene = beat.blur ? <CameraMotionBlur shutterAngle={180} samples={5}><SceneSvg beat={beat} startFrame={startFrame} captions={captions} claims={claims} /></CameraMotionBlur> : <SceneSvg beat={beat} startFrame={startFrame} captions={captions} claims={claims} />;
  if (!debug) return scene;
  return <div style={{ position: "relative", width: FRAME.width, height: FRAME.height }}>{scene}<LayoutDebug report={applyLayout(beat.scene.items, fixedLayers({ captions }, beat)).report} /></div>;
};

/** `layout` (default on): the layout manager (layout.ts) moves texts, pills and badges off whatever they would cover. `layoutDebug` draws its boxes. */
export const FunFact: React.FC<{ story: StoryT; layout?: boolean; layoutDebug?: boolean; look?: Look }> = ({ story: given, layout = true, layoutDebug = false, look = "realistic" }) => {
  useFonts();
  const story = React.useMemo(() => (layout ? layoutStory(given) : given), [given, layout]);
  const plan = sequencePlan(story);
  const children: React.ReactNode[] = [];
  plan.forEach((p, i) => {
    const tr = transitionInto(story, i);
    if (i > 0 && tr.frames > 0) {
      children.push(<TransitionSeries.Transition key={`tr-${p.beat.id}`} presentation={presentationFor(p.beat.transition!)} timing={linearTiming({ durationInFrames: tr.frames })} />);
    }
    children.push(
      <TransitionSeries.Sequence key={p.beat.id} durationInFrames={p.sequenceFrames}>
        <BeatScene beat={p.beat} startFrame={p.from} debug={layoutDebug} captions={story.captions} claims={story.claims} />
      </TransitionSeries.Sequence>);
  });
  return <DefaultLookContext.Provider value={look}><TransitionSeries>{children}</TransitionSeries></DefaultLookContext.Provider>;
};
