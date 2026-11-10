/* Where the "Intip yuk!" sting (the small mascot and its pill) sits, B31. Five poses, each a mascot with the pill right under it (one mark), every one inside
   the safe area and far above the caption band. The pose is chosen from the video's slug (a hash, never Math.random: a render is the same every time);
   a video whose hero needs another place passes `pose` (stingPose in its plan.ts). Pure: tested by `node tests/stingPose.test.ts`. */

import { SAFE } from "./tokens.ts";
import { mascotBox, textWidthEstimate, type Box } from "./layout.ts";

export const STING_TEXT = "Intip yuk!";
export const STING_FS = 56;
export const STING_MASCOT_W = 220;
export const STING_PILL_DROP = 175;                       // the pill's centre this far under the mascot's centre: it touches the tail, one mark

export const STING_POSES = {
  top: { x: 540, y: 430 },
  topLeft: { x: 310, y: 400 },
  topRight: { x: 770, y: 400 },
  midLeft: { x: 310, y: 800 },
  midRight: { x: 770, y: 800 },
} as const;
export type StingPoseName = keyof typeof STING_POSES;
export const STING_POSE_NAMES = Object.keys(STING_POSES) as StingPoseName[];

/** FNV-1a: the same slug is always the same number. */
export const slugHash = (slug: string): number => {
  let h = 2166136261;
  for (const ch of slug) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
};

export const stingPoseFor = (slug: string): StingPoseName => STING_POSE_NAMES[slugHash(slug) % STING_POSE_NAMES.length];

/** The mascot's centre and the pill's centre of a pose. */
export const stingPlace = (pose: StingPoseName) => {
  const { x, y } = STING_POSES[pose];
  return { mascot: { x, y }, pill: { x, y: y + STING_PILL_DROP } };
};

/** The two boxes of a pose (for the tests and the layout checks): the mascot with its tail, and the pill. */
export const stingBoxes = (pose: StingPoseName): { mascot: Box; pill: Box } => {
  const p = stingPlace(pose), w = textWidthEstimate(STING_TEXT, STING_FS) + STING_FS * 1.2, h = STING_FS * 1.56;
  return { mascot: mascotBox(p.mascot.x, p.mascot.y, STING_MASCOT_W), pill: { x0: p.pill.x - w / 2, y0: p.pill.y - h / 2, x1: p.pill.x + w / 2, y1: p.pill.y + h / 2 } };
};

export const stingInsideSafe = (b: Box): boolean => b.x0 >= SAFE.left && b.x1 <= SAFE.right && b.y0 >= SAFE.top && b.y1 <= SAFE.bottom;
