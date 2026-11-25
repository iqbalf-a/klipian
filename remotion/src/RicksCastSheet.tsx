/* The ricks cast sheet (B46 i): eight stick people who share nothing, as a reference of what Outfit can vary (shirt colours and
   pattern, hair and its colour, hat, face: nose, blush, glasses, moustache, beard; body). A still, not used by any video. */
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { drawStick, type Arms, type Expr, type Outfit } from "./ricks/kit.tsx";

export const CAST_SHEET: [string, Outfit, Expr, Arms][] = [
  ["sheriff", { shirt: "#c8a96a", stripe: "#a8894a", hat: "cowboy", mustache: true, body: "wide", hair: "bald", nose: "big", pattern: "collar" }, "furious", "point"],
  ["petani", { shirt: "#3f9a8a", stripe: "#2f7a6c", hat: "cap", hatColor: "#f2f0ea", nose: "dot" }, "sleepy", "down"],
  ["bapak", { shirt: "#f2f0ea", stripe: "#c9c3b5", hat: "peci", mustache: true, beard: true, hairColor: "#3a3a3a", pattern: "collar" }, "calm", "belly"],
  ["ibu", { shirt: "#e86a8a", stripe: "#c04a6a", hair: "bun", hairColor: "#2b1d14", blush: true, pattern: "dots" }, "grin", "wave"],
  ["tukang", { shirt: "#f28a2e", stripe: "#3a3f4a", hat: "hardhat", body: "wide", beard: true, hairColor: "#5a3a22", pattern: "check" }, "puzzled", "down"],
  ["mahasiswi", { shirt: "#5f7fe0", stripe: "#3e5ab8", hair: "long", hairColor: "#7a3e1d", glasses: true, nose: "dot", pattern: "plain" }, "shocked", "point"],
  ["kasir", { shirt: "#d94b3a", stripe: "#f2c230", hair: "spiky", hairColor: "#c98f3a", blush: true }, "grin", "wave"],
  ["kakek", { shirt: "#8a6fb0", stripe: "#6a5090", hair: "bald", mustache: true, glasses: true, hairColor: "#e6e6e6", nose: "big", pattern: "check" }, "sly", "belly"],
  // B62 (2026-11-25): what the channel's people wear and how their hair is cut: garments, scarves, belts, ties, badges, hijab, ponytails, caping, helmets
  ["sipir", { shirt: "#a9b3bd", stripe: "#d9dee3", garment: "guard", hat: "police", hatColor: "#26324f", belt: "#1a1a1f", radio: true, badge: true, tie: "#1d1b22", brows: "thick", mustache: true }, "calm", "belly"],
  ["tahanan", { shirt: "#f08a24", stripe: "#f6efe0", garment: "prisoner", hair: "quiff", hairColor: "#7a4a22", shades: true, grill: true, chain: true }, "grin", "hips"],
  ["koki", { shirt: "#fbf7ee", stripe: "#e0e0e0", garment: "chef", hat: "chef", scarf: "#d9352a", mustache: true, body: "wide", brows: "bushy" }, "furious", "point"],
  ["gadis kuncir", { shirt: "#f2c230", stripe: "#e0602f", hair: "ponytail", hairColor: "#4a2a18", garment: "dress", lashes: true, freckles: true }, "grin", "wave"],
  ["tukang warung", { shirt: "#c9553a", stripe: "#f6efe0", garment: "apron", hair: "curly", hairColor: "#2a1a14", mustache: true, body: "wide", brows: "thick" }, "puzzled", "hips"],
  ["petugas", { shirt: "#4a6fa5", stripe: "#d8dee8", garment: "uniform", hat: "helmet", badge: true, tie: "#1d1b22", brows: "bushy", glasses: true }, "calm", "salute"],
  ["petani caping", { shirt: "#6b8f5a", stripe: "#e0c36a", hat: "straw", garment: "vest", belt: "#5a3b1f", wrinkles: true, goatee: true, hairColor: "#9a9a9a" }, "sleepy", "down"],
  ["anak pigtail", { shirt: "#e0456b", stripe: "#ffd447", hair: "pigtails", hairColor: "#17141c", scarf: "#3a7bd5", lashes: true, blush: true }, "shocked", "up"],
  ["anak muda", { shirt: "#22252d", stripe: "#e8604c", garment: "jacket", hat: "beanie", hair: "bald", pocket: true, nose: "dot", brows: "arched" }, "sly", "belly"],
  ["kepala desa", { shirt: "#8a5a32", stripe: "#f2f0ea", hat: "turban", garment: "vest", hair: "bald", mustache: true, beard: true, hairColor: "#3a3a3a", wrinkles: true, eyebags: true }, "furious", "point"],
];

const One: React.FC<{ o: Outfit; e: Expr; a: Arms; name: string }> = ({ o, e, a, name }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => { drawStick(ref.current!.getContext("2d")!, e, a, false, 0.3, o); }, [o, e, a]);
  return (
    <div style={{ width: 256, textAlign: "center" }}>
      <canvas ref={ref} width={512} height={1024} style={{ width: 256, height: 512 }} />
      <div style={{ fontFamily: "Outfit, Arial", fontWeight: 800, fontSize: 30, color: "#17141c" }}>{name}</div>
    </div>
  );
};

export const RicksCastSheet: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#dfe7d6", display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", gap: 40, padding: 60 }}>
    {CAST_SHEET.map(([name, o, e, a]) => <One key={name} name={name} o={o} e={e} a={a} />)}
  </AbsoluteFill>
);
