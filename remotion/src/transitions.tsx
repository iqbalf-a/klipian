/* The transitions between beats (at most 3 per video, style bible). slide and wipe come from @remotion/transitions; zoom and
   "through the lens" are ours. Through the lens: the mascot's lens circle grows until it fills the screen, and the next
   beat (the cutaway) is INSIDE it. The previous beat stays as it was outside the circle. */
import React from "react";
import { AbsoluteFill } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { BLACK, FRAME, YELLOW_D } from "./tokens.ts";
import { easeInOut } from "./motion.ts";
import { Line, Ring } from "./components/svg.tsx";
import type { BeatT } from "./schema.ts";

type ZoomProps = Record<string, never>;
const ZoomComponent: React.FC<TransitionPresentationComponentProps<ZoomProps>> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress;
  const style: React.CSSProperties = presentationDirection === "entering"
    ? { opacity: Math.min(1, p * 1.6), transform: `scale(${0.86 + 0.14 * p})` }
    : { opacity: 1 - Math.max(0, p * 1.4 - 0.4), transform: `scale(${1 + 0.16 * p})` };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
const zoom = (): TransitionPresentation<ZoomProps> => ({ component: ZoomComponent, props: {} });

type LensProps = { x: number; y: number; r: number };
const REACH = Math.hypot(FRAME.width, FRAME.height);
const LensComponent: React.FC<TransitionPresentationComponentProps<LensProps>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const { x, y, r } = passedProps;
  const e = easeInOut(presentationProgress);
  const now = r + (REACH - r) * e;
  const q = r / 92;                                      // the ring and handle keep the sheet's proportions, and fade as they leave the screen
  const fade = 1 - e;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `circle(${now}px at ${x}px ${y}px)` }}>{children}</AbsoluteFill>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0, opacity: fade }}>
        <g transform={`translate(${x} ${y})`}>
          <Ring x={0} y={0} r={now} w={12 * q} stroke={BLACK} />
          <Line a={[0.72 * now, 0.72 * now]} b={[0.72 * now + 46 * q, 0.72 * now + 46 * q]} w={16 * q} stroke={YELLOW_D} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
const lens = (props: LensProps): TransitionPresentation<LensProps> => ({ component: LensComponent, props });

const FROM = { left: "from-left", right: "from-right", up: "from-top", down: "from-bottom" } as const;

/** The presentation for the transition into a beat (never called for "cut"). */
export function presentationFor(t: NonNullable<BeatT["transition"]>): TransitionPresentation<any> {
  switch (t.kind) {
    case "slide": return slide({ direction: FROM[t.dir ?? "right"] });
    case "wipe": return wipe({ direction: FROM[t.dir ?? "left"] });
    case "zoom": return zoom();
    case "lens": return lens({ x: t.x ?? FRAME.width / 2, y: t.y ?? FRAME.height / 2, r: t.r ?? 355 });
    default: return slide();
  }
}
