/* The 3D Chibi (D:\tools\chibi\chibi_base.blend, toon render) played as a transparent PNG sequence from public/chibi/<clip>/NNN.png.
   Placed by its feet: (x, y) is the point on the floor between the feet; height = the drawn frame height in px. */
import React from "react";
import { Img, staticFile } from "remotion";

// From the export script: frame count, crop size, and where the feet touch the floor inside the crop.
export const CHIBI_CLIPS = {
  walk: { frames: 24, w: 282, h: 586, footX: 146.5, groundY: 584 },
  sit_down: { frames: 70, w: 389, h: 586, footX: 168.5, groundY: 584 },
} as const;
export type ChibiClipName = keyof typeof CHIBI_CLIPS;

export const ChibiClip: React.FC<{
  clip: ChibiClipName; frame: number; x: number; y: number; height: number; loop?: boolean; flip?: boolean;
}> = ({ clip, frame, x, y, height, loop = false, flip = false }) => {
  const c = CHIBI_CLIPS[clip];
  const f = Math.floor(frame);
  const i = loop ? ((f % c.frames) + c.frames) % c.frames : Math.min(c.frames - 1, Math.max(0, f));
  const k = height / c.h;
  return (
    <Img
      src={staticFile(`chibi/${clip}/${String(i).padStart(3, "0")}.png`)}
      style={{
        position: "absolute", width: c.w * k, height: c.h * k,
        left: x - (flip ? c.w - c.footX : c.footX) * k, top: y - c.groundY * k,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
};
