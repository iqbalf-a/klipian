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
