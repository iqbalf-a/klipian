/* The nature kit's demo (pilot 2, phases 1 to 1c; not a video): 7 s of the water cycle on the kit's parts, in the depth order of natureGeometry.ts
   (DEPTH_ORDER): the sea warms and gives off vapour, the cloud forms and darkens (its shadow falls on the sea), the rain falls from its lower edge, the
   drops splash on the sea and the land, the puddles grow, and the cycle goes on. Stills fix each state with props (`t` for the timeline, or `dark`,
   `rain`, `vapour`, `splash`, `wet` directly), so the in-between strips of the plan can be rendered from the same code. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FPS, FRAME } from "./design/index.ts";
import { ISO } from "./tokens.ts";
import { IsoBushes, IsoCloud, IsoDroplets, IsoHill, IsoLand, IsoPuddles, IsoRain, IsoRocks, IsoRunoff, IsoSea, IsoSun, IsoTreeShadows, IsoTrees, IsoVapour } from "./components/IsoNature.tsx";
import { CLOUD_GREY, CLOUD_WHITE, RUNOFF, ramp, smooth } from "./natureGeometry.ts";

export const NATURE_DEMO_SECONDS = 7;
const U = 150, O: [number, number] = [600, 1250];

/** The states of the demo at time `t` (seconds, 0..7): dark and grow for the cloud, the rain, the vapour, the splash, the wet ground. */
export function natureStates(t: number) {
  const dark = smooth(ramp(t, 1.5, 3.5)) * (1 - smooth(ramp(t, 5.8, 7)));
  return {
    dark,
    grow: 1 + 0.15 * ramp(t, 1.0, 3.5),
    vapour: ramp(t, 0.3, 1.6) * (1 - ramp(t, 3.5, 4.5)),
    rain: ramp(t, 4.0, 4.6) * (1 - ramp(t, 6.0, 6.8)),
    wet: ramp(t, 4.5, 6.0) * (1 - ramp(t, 6.6, 7)),
    splash: t > 4.8 && t < 6.2 ? (t - 4.8) / 1.4 : 0,
    phase: (t % NATURE_DEMO_SECONDS) / NATURE_DEMO_SECONDS,
  };
}

export const NatureDemo: React.FC<{ t?: number; dark?: number; grow?: number; rain?: number; vapour?: number; splash?: number; wet?: number; phase?: number }> = (props) => {
  const frame = useCurrentFrame();
  const t = props.t ?? frame / FPS;
  const s0 = natureStates(t);
  const s = { ...s0, ...Object.fromEntries(Object.entries(props).filter(([k, v]) => k !== "t" && v !== undefined)) } as typeof s0;
  return (
    <AbsoluteFill style={{ background: ISO.wall[0] }}>
      <svg width={FRAME.width} height={FRAME.height} style={{ position: "absolute", inset: 0 }}>
        <circle cx={540} cy={1000} r={520} fill="rgb(250,236,186)" />
        {/* the depth order of natureGeometry.ts DEPTH_ORDER (the white cloud sits in the sky before the rain; the grey cloud is last) */}
        <IsoSea u={U} o={O} phase={s.phase} splash={s.splash} splashAt={RUNOFF.fall[1].slice(0, 2) as [number, number]} shadow={s.dark} />
        <IsoVapour u={U} o={O} k={s.vapour} phase={s.phase} />
        <IsoLand u={U} o={O} wet={s.wet} />
        <IsoHill u={U} o={O} />
        <IsoPuddles u={U} o={O} wet={s.wet} />
        <IsoTreeShadows u={U} o={O} />
        <IsoRunoff u={U} o={O} k={s.rain} />
        <IsoBushes u={U} o={O} />
        <IsoRocks u={U} o={O} />
        <IsoTrees u={U} o={O} />
        <IsoSun cx={200} cy={520} r={70} phase={s.phase} />
        <IsoCloud u={U} o={O} cx={CLOUD_WHITE.cx} cy={CLOUD_WHITE.cy} cz={CLOUD_WHITE.cz} dark={0} grow={CLOUD_WHITE.grow} phase={s.phase} />
        <IsoRain u={U} o={O} k={s.rain} phase={s.phase} />
        <IsoDroplets u={U} o={O} k={s.vapour} />
        <IsoCloud u={U} o={O} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={s.dark} grow={s.grow * CLOUD_GREY.grow} phase={s.phase} />
      </svg>
    </AbsoluteFill>
  );
};
