/* The palette of klipian intip. Every colour of every component comes from here, so every video looks the same.
   Red is for MEANING only (heat, danger, a cut), never decoration. Values from workspace/channel-art/klipian-intip/. */

export const rgb = (c: readonly [number, number, number]): string => `rgb(${c[0]},${c[1]},${c[2]})`;

export const BLACK = rgb([20, 20, 20]);
export const YELLOW = rgb([255, 212, 71]);
export const YELLOW_D = rgb([214, 168, 20]);          // dark yellow: the lens handle, the current's dots in the cutaway
export const G1 = rgb([38, 38, 38]);
export const G2 = rgb([104, 104, 104]);
export const G3 = rgb([178, 178, 178]);
export const G4 = rgb([232, 232, 230]);
export const WHITE = rgb([250, 250, 248]);
export const RED = rgb([222, 66, 66]);

export const HOT1 = rgb([255, 196, 120]);              // heat rings around the red core
export const HOT2 = rgb([250, 140, 80]);
export const METAL = rgb([196, 196, 192]);             // clips and pins
export const SKIN_A = rgb([240, 196, 160]);
export const SKIN_B = rgb([204, 152, 112]);
export const PLASTER = rgb([236, 214, 170]);
export const PLUG_FACE = rgb([58, 58, 58]);
export const BLUSH = rgb([225, 120, 120]);

/** Depth only (ian 2026-10-25): the style is flat, and the one shadow is a hard crescent inside something that goes INTO
    a surface (a hole, a recess, a cavity), light from the top-left. Its colour is the base colour darkened, never black. */
export const RECESS_SHADE = rgb([167, 167, 166]);      // G4 x 0.72: the round recess of a socket, the ring around a plug
export const HOLE_SHADE = rgb([26, 26, 26]);           // PLUG_FACE x 0.45: the two pin holes
export const CAVITY_SHADE = rgb([64, 64, 64]);         // G2 x 0.62: the cavity in the cutaway

export const WALL = rgb([238, 236, 230]);              // the Room background
export const FLOOR = rgb([214, 212, 206]);
export const SMOKE = G3;

/** Meaning, in one place: yellow = current, red/orange = heat or danger, grey = the object's material, light grey = metal. */
export const MEANING = { current: YELLOW_D, heat: RED, material: G3, metal: METAL } as const;

/** The reference sheet draws a panel 280 x 498; the video is 1080 x 1920. Components keep the sheet's own numbers and
    are drawn with this factor, so what is on the sheet is what is on the screen. */
export const SHEET_TO_VIDEO = 1080 / 280;

export const FONT_BOLD = "Outfit";
export const FONT_MONO = "DM Mono";
export const FRAME = { width: 1080, height: 1920, fps: 30 } as const;

/** The two fuller backgrounds (P28-A3). "brand" for story scenes: the wall carries a faint field of lens rings and a big yellow
    spotlight sits behind the main subject. "lab" for everything INSIDE the lens and for the 3D test: a dark slate "operating room"
    with a grid and a warm glow, so current and heat light up and a white object never merges with it. */
export const BRAND = {
  ring: rgb([226, 224, 218]), spot: rgb([250, 232, 170]), spotInner: rgb([252, 238, 190]), floorEdge: rgb([200, 198, 192]),
} as const;
export const LAB = {
  slate: rgb([70, 70, 72]), grid: rgb([84, 84, 86]), gridMajor: rgb([96, 96, 98]), glow: rgb([86, 82, 66]), glowInner: rgb([98, 92, 66]),
} as const;
/** Where the floor starts in the Room and brand scenes (the sheet's 90 units from the bottom). Key content stays above the
    Shorts interface: out of the bottom 15 % (y > 1632) and the right 12 % (x > 950). */
export const FLOOR_Y = 1920 - 90 * (1080 / 280);
export const SAFE = { left: 60, right: 950, top: 120, bottom: 1632 } as const;

/** The 2.5D isometric kit's tones (P28, 2026-10-26): three per material, [light = a face looking up, mid = looking lower-left, dark = looking lower-right],
    light from the top-left (src/iso.ts). Brass is the one warm metal (the spring leaves of a socket): muted, so it never reads as the yellow of current. */
export const ISO = {
  plastic: [WHITE, G4, rgb([204, 204, 200])],
  wall: [rgb([222, 220, 214]), rgb([202, 200, 194]), rgb([176, 174, 168])],
  floor: [rgb([214, 212, 206]), rgb([192, 190, 184]), rgb([168, 166, 160])],
  dark: [G2, PLUG_FACE, G1],
  metal: [rgb([236, 236, 232]), METAL, rgb([146, 146, 142])],
  brass: [rgb([228, 200, 128]), rgb([196, 160, 84]), rgb([148, 116, 54])],
  labPlastic: [G4, rgb([196, 196, 192]), rgb([150, 150, 148])],
  // the nature kit (pilot 2): meaning colours, used only by the nature assets (src/components/IsoNature.tsx); numbers from make_hujan25d.py
  water: [rgb([120, 182, 226]), rgb([78, 146, 204]), rgb([52, 112, 170])],
  soil: [rgb([206, 196, 170]), rgb([176, 164, 136]), rgb([140, 128, 104])],
  grass: [rgb([152, 190, 120]), rgb([120, 160, 94]), rgb([86, 124, 66])],
  leaf: [rgb([168, 204, 132]), rgb([128, 170, 98]), rgb([92, 134, 70])],
  cloudWhite: [WHITE, rgb([222, 220, 214]), rgb([192, 190, 184])],
  cloudGrey: [rgb([190, 190, 190]), rgb([150, 150, 150]), rgb([110, 110, 110])],
  sun: [rgb([255, 226, 120]), rgb([255, 212, 71]), rgb([214, 168, 20])],
} as const satisfies Record<string, readonly [string, string, string]>;
