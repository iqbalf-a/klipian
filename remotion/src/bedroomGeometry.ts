/* The geometry of the bedroom set (pure, no React, so a plan and a test can read it): the bed's block and the phone's place on the blanket, in world units
   (x to the lower right, y to the lower left, z up). The drawings are in components/IsoBedroom.tsx. */
export type P3 = [number, number, number];
/** The bed: the mattress block (a, b) and the height of the blanket's top. */
export const BED = { a: [0, 0, 0] as P3, b: [3, 2, 0.5] as P3, top: 0.68 };
/** The phone's place on the blanket: its centre, its half sizes and its thickness. */
export const PHONE = { c: [2.0, 1.0, BED.top] as P3, hx: 0.3, hy: 0.62, h: 0.07 };
