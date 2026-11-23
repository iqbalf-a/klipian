/* Channel customisation art for Sebatang Cerita (YouTube Studio): avatar 800x800, banner 2048x1152, video watermark. Stills, not used by any video. */
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { drawStick, type Arms, type Expr, type Outfit } from "./ricks/kit.tsx";

const DIMAS: Outfit = { shirt: "#5a6fd8", stripe: "#3b4aa6", pattern: "plain", hair: "spiky", hairColor: "#17141c", nose: "dot" };
const UDIN: Outfit = { shirt: "#e07a2f", stripe: "#8c4a14", pattern: "check", hat: "peci", mustache: true, body: "wide", nose: "big" };
const RANI: Outfit = { shirt: "#c9a0e8", stripe: "#7b4fa8", pattern: "collar", hair: "long", hairColor: "#3b2418", glasses: true, blush: true };
const GREEN = "#418165", CREAM = "#f6efdc", INK = "#17141c", GOLD = "#ffd60a";
const FONT = "Outfit, Arial";

const Stick: React.FC<{ o: Outfit; e: Expr; a: Arms; w: number; style?: React.CSSProperties }> = ({ o, e, a, w, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => { drawStick(ref.current!.getContext("2d")!, e, a, false, 0.3, o); }, [o, e, a]);
  return <canvas ref={ref} width={512} height={1024} style={{ width: w, height: w * 2, position: "absolute", ...style }} />;
};

export const Avatar: React.FC = () => (
  <AbsoluteFill style={{ background: GREEN, overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 45%, #5aa383 0%, ${GREEN} 70%)` }} />
    <Stick o={DIMAS} e="grin" a="wave" w={980} style={{ left: -90, top: -22 }} />
  </AbsoluteFill>
);

export const Watermark: React.FC = () => (
  <AbsoluteFill style={{ background: "transparent" }}>
    <div style={{ position: "absolute", left: 20, top: 20, right: 20, bottom: 20, borderRadius: "50%", background: GREEN, overflow: "hidden", border: `10px solid ${CREAM}` }}>
      <Stick o={DIMAS} e="grin" a="wave" w={230} style={{ left: 15, top: 24 }} />
    </div>
  </AbsoluteFill>
);

export const Banner: React.FC = () => (
  <AbsoluteFill style={{ background: GREEN, overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 50%, #5aa383 0%, ${GREEN} 65%, #2f6049 100%)` }} />
    {/* safe area for every screen: 1235 x 338, centred (x 406..1641, y 407..745) */}
    <Stick o={DIMAS} e="grin" a="wave" w={190} style={{ left: 470, top: 400 }} />
    <Stick o={RANI} e="puzzled" a="point" w={190} style={{ left: 1390, top: 400 }} />
    <div style={{ position: "absolute", left: 640, width: 770, top: 450, textAlign: "center", fontFamily: FONT }}>
      <div style={{ fontWeight: 900, fontSize: 112, lineHeight: 1, color: CREAM, textShadow: `6px 6px 0 ${INK}` }}>SEBATANG<br />CERITA</div>
      <div style={{ marginTop: 22, display: "inline-block", background: GOLD, color: INK, fontWeight: 800, fontSize: 38, padding: "6px 22px", transform: "rotate(-2deg)" }}>dongeng pendek, satu fakta nyata</div>
    </div>
  </AbsoluteFill>
);
