/* The visual dictionary of the klipian intip formula (Style Bible v1, DESIGN.md section 0b): one mark for one physical thing, across every topic. Each row
   names the thing, its mark (the drawing recipe in one line), the component that draws it and the file, and its status: "drawn" (the component exists and
   a tile is on the mark sheet, src/MarkSheet.tsx) or "to build" (a spec row only: no component and no tile yet). A video may not invent a private mark for
   a thing that has a row. tests/style.test.ts checks this file against the source; scripts/styleCheck.mjs reads it. Pure data: no React here. */

export type MarkStatus = "drawn" | "to build";
export type MarkRow = {
  id: string;            // the key used by the checker and the sheet
  thing: string;         // the physical thing, in words
  mark: string;          // the drawing recipe: shape, colour tokens, motion
  components: { name: string; file: string }[];   // the components that draw it (empty for "to build")
  status: MarkStatus;
};

export const DICTIONARY: readonly MarkRow[] = [
  { id: "current", thing: "electric current", mark: "yellow dashes flowing along the path (the cutaway's current, ISO.brass and YELLOW)",
    components: [{ name: "IsoCutaway", file: "src/components/Iso.tsx" }], status: "drawn" },
  { id: "heat", thing: "heat", mark: "red and orange wavy lines rising from the hot part, with a warm glow ring on it",
    components: [{ name: "HeatRise", file: "src/components/Iso.tsx" }], status: "drawn" },
  { id: "danger", thing: "danger or a hot spot", mark: "red core with a pulsing ring; used only for danger",
    components: [{ name: "IsoWallSocket", file: "src/components/Iso.tsx" }], status: "drawn" },
  { id: "water", thing: "water (liquid)", mark: "blue layers and streaks in three tones (the water set)",
    components: [{ name: "IsoSea", file: "src/components/IsoNature.tsx" }, { name: "IsoRain", file: "src/components/IsoNature.tsx" }, { name: "IsoDroplets", file: "src/components/IsoNature.tsx" }, { name: "IsoSplash", file: "src/components/IsoNature.tsx" }, { name: "IsoRunoff", file: "src/components/IsoNature.tsx" }], status: "drawn" },
  { id: "vapour", thing: "vapour and steam", mark: "pale blue curving wisps with small bubbles, rising",
    components: [{ name: "IsoVapour", file: "src/components/IsoNature.tsx" }, { name: "SmokePuffs", file: "src/components/Iso.tsx" }], status: "drawn" },
  { id: "light", thing: "light and radiation", mark: "yellow rays around a disc (the sun's tones)",
    components: [{ name: "IsoSun", file: "src/components/IsoNature.tsx" }], status: "drawn" },
  { id: "spark", thing: "a spark or an electric arc", mark: "short yellow and hot-orange flecks that fly out and fade (pilot 1's sparks)",
    components: [{ name: "Sparks", file: "src/components/Iso.tsx" }], status: "drawn" },
  { id: "force", thing: "a force or a flow direction", mark: "a black arrow with a round tail (the Arrow component's shaft and head; the round tail is still to add)",
    components: [{ name: "Arrow", file: "src/components/UI.tsx" }], status: "drawn" },
  { id: "bed", thing: "a bed", mark: "a brass frame, a white mattress, a beige pillow and a grey blanket as 2.5D blocks (the tone rule); neutral tones only",
    components: [{ name: "IsoBed", file: "src/components/IsoBedroom.tsx" }], status: "drawn" },
  { id: "phone", thing: "a phone with a lit screen", mark: "a thin dark block with a bright screen of scrolling lines and a pale glow round it that follows how lit the screen is",
    components: [{ name: "IsoPhone", file: "src/components/IsoBedroom.tsx" }], status: "drawn" },
  { id: "eyes", thing: "a pair of eyes (sleepy or awake)", mark: "two eyes on a skin strip: the lids come down over white eyes as it gets sleepy and go up when awake, the brows follow; Z marks beside them when heavy",
    components: [{ name: "SleepyEyes", file: "src/components/IsoBedroom.tsx" }], status: "drawn" },
  { id: "air", thing: "air and wind", mark: "white curving streaks", components: [], status: "to build" },
  { id: "sound", thing: "sound and vibration", mark: "thin concentric arcs (not drawn yet: spec only)", components: [], status: "to build" },
  { id: "cold", thing: "cold and ice", mark: "pale cyan crystals and a blue-white glow (the exact tones are to define first)", components: [], status: "to build" },
];

/** The rows that have a component, and the components' names. */
export const drawnMarks = (): MarkRow[] => DICTIONARY.filter((r) => r.status === "drawn");
export const markComponents = (): string[] => [...new Set(DICTIONARY.flatMap((r) => r.components.map((c) => c.name)))];
