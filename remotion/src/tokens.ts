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
/** The background themes (PLAN-VARIETY stage 2): one per video, the story's `theme` (missing = cream). Each is tokens only: the wall, the floor, the
    ring pattern, the spot and its inner light, the floor edge, and the pattern (dots, grid or stripes). The lens `lab` stays dark in every theme.
    cream is the channel's look so far (its values are the constants above). `night` is not in this stage: the labels are black text, which a dark
    wall cannot carry; it waits for a light label colour. Contrast is checked in tests/style.test.ts. */
export const THEMES = {
  cream: { wall: WALL, floor: FLOOR, ring: BRAND.ring, spot: BRAND.spot, spotInner: BRAND.spotInner, floorEdge: BRAND.floorEdge, pattern: "dots" },
  sky: { wall: rgb([222, 236, 248]), floor: rgb([204, 218, 232]), ring: rgb([196, 214, 232]), spot: rgb([250, 236, 180]), spotInner: rgb([252, 242, 206]), floorEdge: rgb([172, 192, 212]), pattern: "grid" },
  mint: { wall: rgb([226, 242, 230]), floor: rgb([206, 222, 210]), ring: rgb([196, 222, 204]), spot: rgb([250, 236, 176]), spotInner: rgb([252, 242, 200]), floorEdge: rgb([172, 200, 180]), pattern: "stripes" },
  peach: { wall: rgb([250, 232, 220]), floor: rgb([228, 212, 200]), ring: rgb([240, 216, 200]), spot: rgb([252, 230, 160]), spotInner: rgb([254, 240, 196]), floorEdge: rgb([214, 186, 170]), pattern: "dots" },
} as const;
export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as [ThemeName, ...ThemeName[]];
/** The caption looks (PLAN-CAPTION-OPTIONS, B23): `classic` is the channel's caption and the default; the text style is locked in all three. */
export const CAPTION_STYLE_NAMES = ["classic", "wide", "punch"] as const;

/** Where the floor starts in the Room and brand scenes (the sheet's 90 units from the bottom). */
export const FLOOR_Y = 1920 - 90 * (1080 / 280);

/** The platform safe areas (PLAN-SAFE-AREA and PLAN-SAFE-AREA-2, B24), in video px: the part of the 1080 x 1920 frame each app leaves free of its own interface
    (top icons, the title and the buttons at the bottom, the action column on the right).
    - youtube (the priority; the working area SAFE): CALIBRATED on ian's phone on 2026-10-31, ONE DEVICE (a tall phone, about 20:9), from a screenshot of
      out/safe/calibration.mp4 played as a Short (kept as docs/safe/youtube-2026-10-31.jpg). On that phone the top of the video is clear (the app's bar is
      outside it), the title is drawn below the video, only the channel row covers the video from about y 1830, and the action buttons cover about x 955 and
      right from about y 1050. The profile keeps a margin: top 120, bottom 1730, right 930. On a shorter phone (16:9, 18:9) YouTube usually lays the title
      and the description OVER the bottom of the video: the caption bottom 1720 takes that risk, knowingly (ian's choice). Recalibrate when the app changes.
      The earlier web estimates (top 170, bottom 1600, right 920; kreatli.com/guides/youtube-shorts-safe-zone, shortsafezone.com "observed approximations, not
      an official specification", creamate.ai, postplanify.com) are replaced by the calibration.
    - tiktok (checked, not obeyed): ESTIMATE, NOT OFFICIAL (third-party measurements read 2026-10-31: imagevideofit.com/guides/tiktok-safe-zone,
      kreateflo.com, yosefk.me/blog/tiktok-safe-zone), until ian calibrates it with the same clip.
    - instagram, organic Reels (checked): ESTIMATE, NOT OFFICIAL (zeely.ai, houseofmarketers.com, kreatli.com/guides/instagram-reels-safe-zone, read
      2026-10-31). The Reels ads split (top 14 %, bottom 35 %, sides 6 %) is SAFE_INSTAGRAM_ADS and is not used. */
export const SAFE_PLATFORMS = {
  youtube: { top: 120, bottom: 1730, left: 60, right: 930 },
  tiktok: { top: 140, bottom: 1600, left: 60, right: 930 },
  instagram: { top: 220, bottom: 1500, left: 65, right: 1015 },
} as const;
export const SAFE_INSTAGRAM_ADS = { top: 270, bottom: 1250, left: 65, right: 1015 } as const;
export const PLATFORM_NAMES = ["youtube", "tiktok", "instagram"] as const;
export type PlatformName = (typeof PLATFORM_NAMES)[number];
/** The working safe area: the YouTube profile. Text, the mascot, people, labels, badges, source cards and the caption are kept inside it. */
export const SAFE = SAFE_PLATFORMS.youtube;
/** The strictest of the listed platforms (the cross-post mode of a story's `platforms`): the largest top and left, the smallest bottom and right. */
export const safeFor = (platforms: readonly PlatformName[] = ["youtube"]) => {
  const list = platforms.length ? platforms : (["youtube"] as const);
  return {
    top: Math.max(...list.map((p) => SAFE_PLATFORMS[p].top)), bottom: Math.min(...list.map((p) => SAFE_PLATFORMS[p].bottom)),
    left: Math.max(...list.map((p) => SAFE_PLATFORMS[p].left)), right: Math.min(...list.map((p) => SAFE_PLATFORMS[p].right)),
  };
};
/** The top of the banner and of the top text: y 170, below the safe top (120) on purpose: it looks good there and keeps a margin for other phones (the banner was at y 85). */
export const BANNER_TOP = 170;

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
  // phase 1c: the strata of the land (sand, clay) and its stones, used only by the nature assets
  sand: [rgb([226, 210, 160]), rgb([196, 176, 124]), rgb([160, 140, 96])],
  stone: [rgb([176, 176, 170]), rgb([138, 138, 132]), rgb([98, 98, 94])],
} as const satisfies Record<string, readonly [string, string, string]>;
