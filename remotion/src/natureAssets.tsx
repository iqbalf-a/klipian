/* The drawing of each nature asset on its own (the sheet's tiles and the detail budget read it): the same parts as the demo, at the sheet's scale. */
import React from "react";
import { IsoBushes, IsoCloud, IsoCloudShadow, IsoDroplets, IsoHill, IsoLand, IsoPuddles, IsoRain, IsoRocks, IsoRunoff, IsoSea, IsoSplash, IsoSun, IsoTreeShadows, IsoTrees, IsoVapour } from "./components/IsoNature.tsx";
import { CLOUD_GREY, CLOUD_WHITE, TREES } from "./natureGeometry.ts";

export const drawAsset = (name: string, u: number, o: [number, number]): React.ReactNode => {
  switch (name) {
    case "sea": return <IsoSea u={u} o={o} />;
    case "land": return <>
      <IsoLand u={u} o={o} />
      <IsoHill u={u} o={o} />
      <IsoPuddles u={u} o={o} wet={0} />
      <IsoTreeShadows u={u} o={o} />
      <IsoBushes u={u} o={o} />
      <IsoRocks u={u} o={o} />
      <IsoTrees u={u} o={o} />
    </>;
    case "trees": return <IsoTrees u={u} o={o} />;
    case "pine": return <IsoTrees u={u} o={o} list={TREES.filter((k) => k.kind === "pine").slice(0, 1)} />;
    case "round": return <IsoTrees u={u} o={o} list={TREES.filter((k) => k.kind === "round").slice(0, 1)} />;
    case "hill": return <IsoHill u={u} o={o} />;
    case "shadow": return <IsoCloudShadow u={u} o={o} k={0.4} />;
    case "puddle": return <IsoPuddles u={u} o={o} wet={1} />;
    case "sun": return <IsoSun cx={o[0]} cy={o[1]} r={u * 0.25} />;
    case "cloud-white": return <IsoCloud u={u} o={o} cx={CLOUD_WHITE.cx} cy={CLOUD_WHITE.cy} cz={CLOUD_WHITE.cz} dark={0} grow={CLOUD_WHITE.grow} />;
    case "cloud-grey": return <IsoCloud u={u} o={o} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={1} grow={CLOUD_GREY.grow} />;
    case "clouds": return <>
      <IsoCloud u={u} o={o} cx={CLOUD_WHITE.cx} cy={CLOUD_WHITE.cy} cz={CLOUD_WHITE.cz} dark={0} grow={CLOUD_WHITE.grow} />
      <IsoCloud u={u} o={o} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={1} grow={CLOUD_GREY.grow} />
    </>;
    case "rain": return <IsoRain u={u} o={o} k={1} />;
    case "vapour": return <IsoVapour u={u} o={o} k={1} />;
    case "droplets": return <IsoDroplets u={u} o={o} k={1} />;
    case "splash": return <IsoSplash u={u} o={o} k={0.5} at={[-0.2, -0.3]} />;
    case "runoff": return <><IsoLand u={u} o={o} /><IsoRunoff u={u} o={o} k={1} /></>;
    case "scene": return <>
      <IsoSea u={u} o={o} splash={0} shadow={1} />
      <IsoVapour u={u} o={o} k={1} />
      <IsoLand u={u} o={o} />
      <IsoHill u={u} o={o} />
      <IsoTreeShadows u={u} o={o} />
      <IsoRunoff u={u} o={o} k={1} />
      <IsoBushes u={u} o={o} />
      <IsoRocks u={u} o={o} />
      <IsoTrees u={u} o={o} />
      <IsoRain u={u} o={o} k={1} />
      <IsoCloud u={u} o={o} cx={CLOUD_WHITE.cx} cy={CLOUD_WHITE.cy} cz={CLOUD_WHITE.cz} dark={0} grow={CLOUD_WHITE.grow} />
      <IsoCloud u={u} o={o} cx={CLOUD_GREY.cx} cy={CLOUD_GREY.cy} cz={CLOUD_GREY.cz} dark={1} grow={CLOUD_GREY.grow} />
    </>;
    default: return null;
  }
};
