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
    components: [{ name: "IsoSea", file: "src/components/IsoNature.tsx" }, { name: "IsoRain", file: "src/components/IsoNature.tsx" }, { name: "IsoDroplets", file: "src/components/IsoNature.tsx" }, { name: "IsoSplash", file: "src/components/IsoNature.tsx" }, { name: "IsoRunoff", file: "src/components/IsoNature.tsx" }, { name: "IsoDrop", file: "src/components/IsoNature.tsx" }], status: "drawn" },
  { id: "vapour", thing: "vapour and steam", mark: "pale blue curving wisps with small bubbles, rising",
    components: [{ name: "IsoVapour", file: "src/components/IsoNature.tsx" }, { name: "SmokePuffs", file: "src/components/Iso.tsx" }], status: "drawn" },
  { id: "light", thing: "light and radiation", mark: "yellow rays around a disc (the sun's tones)",
    components: [{ name: "IsoSun", file: "src/components/IsoNature.tsx" }], status: "drawn" },
  { id: "spark", thing: "a spark or an electric arc", mark: "short yellow and hot-orange flecks that fly out and fade (pilot 1's sparks)",
    components: [{ name: "Sparks", file: "src/components/Iso.tsx" }], status: "drawn" },
  { id: "force", thing: "a force or a flow direction", mark: "a black arrow with a round tail (the Arrow component's shaft and head; the round tail is still to add)",
    components: [{ name: "Arrow", file: "src/components/UI.tsx" }], status: "drawn" },
  { id: "seed", thing: "seeding material (salt grains, silver iodide)", mark: "white cubes for salt, a cut silver gem (metal tones, six facets) for silver iodide; small, drawn in the plastic and metal tones",
    components: [{ name: "IsoSeed", file: "src/components/IsoSeeding.tsx" }], status: "drawn" },
  { id: "aircraft", thing: "an aircraft (the seeding plane)", mark: "a small propeller plane in the dark tones with light windows, a silver tail fin and a rack under the near wing",
    components: [{ name: "IsoPlane", file: "src/components/IsoSeeding.tsx" }], status: "drawn" },
  { id: "bed", thing: "a bed", mark: "a brass frame, a white mattress, a beige pillow and a grey blanket as 2.5D blocks (the tone rule); neutral tones only",
    components: [{ name: "IsoBed", file: "src/components/IsoBedroom.tsx" }], status: "drawn" },
  { id: "phone", thing: "a phone with a lit screen", mark: "a thin dark block with a bright screen of scrolling lines and a pale glow round it that follows how lit the screen is",
    components: [{ name: "IsoPhone", file: "src/components/IsoBedroom.tsx" }], status: "drawn" },
  { id: "eyes", thing: "a pair of eyes (sleepy or awake)", mark: "two eyes on a skin strip: the lids come down over white eyes as it gets sleepy and go up when awake, the brows follow; Z marks beside them when heavy",
    components: [{ name: "SleepyEyes", file: "src/components/IsoBedroom.tsx" }], status: "drawn" },
  { id: "cloud", thing: "a cloud (clear sky or storm)", mark: "a soft white cloud of lobes on a flat grey underside; the storm is the same cloud in darker greys",
    components: [{ name: "IsoCloud", file: "src/components/IsoNature.tsx" }], status: "drawn" },
  { id: "tree", thing: "a tree (pine or round)", mark: "a pine: cone tiers split by the light, with a shaded band under each; a round tree: three lobes on a trunk",
    components: [{ name: "IsoTrees", file: "src/components/IsoNature.tsx" }], status: "drawn" },
  { id: "air", thing: "air and wind", mark: "white curving streaks that flow along the wind (a grey hairline under each, so they show on the light wall); the fan's air",
    components: [{ name: "IsoAir", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "lamp", thing: "a lamp or a bulb that is on", mark: "a brass shade on a pole over a round dark base, a pale yellow glow and a cone of light that breathe and flicker a little; the shade sways",
    components: [{ name: "IsoLamp", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "kettle", thing: "a kettle (boiling water)", mark: "a metal body with a dark band, a dark lid with a knob, a spout and a handle; pale blue steam rises, the lid rattles when it boils",
    components: [{ name: "IsoKettle", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "fan", thing: "a fan (moving air)", mark: "a base, a pole, a motor and a guard of two rings and spokes; three blades spin; the air mark flows from it",
    components: [{ name: "IsoFan", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "clock", thing: "a clock (time passing)", mark: "a brass round body with two bells and feet, a white face with twelve ticks and three hands; the second hand ticks, the bells shake when it rings",
    components: [{ name: "IsoClock", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "cup", thing: "a cup of a hot drink", mark: "a white cup on a saucer with a handle, a dark liquid with ripples; pale blue steam rises",
    components: [{ name: "IsoCup", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "battery", thing: "a battery (charge)", mark: "a dark body with a metal cap and four cells on its face; the cells fill, the next one blinks while it charges, a yellow bolt and glow",
    components: [{ name: "IsoBattery", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "heart", thing: "a heart (the body's pump)", mark: "a soft red relief heart in the organ tones with a highlight and two folds; it beats (lub-dub) and a ring spreads from it",
    components: [{ name: "IsoHeart", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "brain", thing: "a brain (thinking, a busy mind)", mark: "a pink relief brain with folds and a short stem on a pale yellow glow; it breathes, and yellow signals run along the folds faster when it is busy",
    components: [{ name: "IsoBrain", file: "src/components/IsoLife.tsx" }], status: "drawn" },
  { id: "sound", thing: "sound and vibration", mark: "thin concentric arcs (not drawn yet: spec only)", components: [], status: "to build" },
  { id: "cold", thing: "cold and ice", mark: "pale cyan crystals and a blue-white glow (the exact tones are to define first)", components: [], status: "to build" },
];

/** The rows that have a component, and the components' names. */
export const drawnMarks = (): MarkRow[] => DICTIONARY.filter((r) => r.status === "drawn");
export const markComponents = (): string[] => [...new Set(DICTIONARY.flatMap((r) => r.components.map((c) => c.name)))];
