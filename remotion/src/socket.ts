/* The socket's and the plug's geometry (round 6): pure numbers and small functions, read by the picture (components/Iso.tsx), the plan (videos/.../plan.ts)
   and the tests. Keep it free of React. World: x to the lower right, y out of the wall toward the viewer (the plug sticks out along +y), z up. */

/** The socket's centre height, the plate's front face (y), the floor of the recess (y, a shallow recess), its radius, and the pins' x. */
export const SOCKET_Z = 0.5, PLATE_FRONT = 0.3, RECESS_FLOOR = -0.05, RECESS_R = 0.86, PIN_X = 0.4;
/** A pin's radius, and the hole it goes into on the floor of the recess (a little larger than the pin, so the pin sits in it). */
export const PIN_R = 0.1, HOLE_R = 0.17;
/** The plug's strain relief (the boot) ends this far above the plug's face (along y): the cable's joint. Its radius there is the cable's. */
export const BOOT_END = 2.1;
/** The cable's radius (world units): the boot's small end and the cable have one diameter, a third of the back cap's diameter (radius 0.3). */
export const CABLE_R = 0.1;
/** The plug's back cap radius (the boot starts there). */
export const BOOT_START_R = 0.3;

/** One pin of the plug: its x (with the plug's tilt `cx`), its radius, the part in the air (outside: from the plate's front to the plug's face) and the
    part in the hole (inside: from the floor of the recess to the plate's front). */
export type PinPiece = { x: number; z: number; r: number; outside: { y0: number; y1: number }; inside: { y0: number; y1: number } };

/** The two pins at a gap (the plug's distance out of the socket) and a wobble (the plug's tilt). Pins are drawn in two pieces: never beyond the floor. */
export function pinPieces(gap: number, wobble: number): PinPiece[] {
  const y0 = PLATE_FRONT + gap, cx = wobble * 0.05;
  return [-PIN_X, PIN_X].map((x) => ({
    x: x + cx, z: SOCKET_Z, r: PIN_R,
    outside: { y0: PLATE_FRONT, y1: y0 },
    inside: { y0: RECESS_FLOOR, y1: PLATE_FRONT },
  }));
}

/** The opening of the recess as points in (x, z) on the plate's plane (n points round the circle). */
export function holeOutline(n = 48): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [RECESS_R * Math.cos(a), SOCKET_Z + RECESS_R * Math.sin(a)] as [number, number];
  });
}

/** The plug's radius by height above its face (the same numbers as IsoPlug): the body, the back cap and the boot down to the cable. */
export const PLUG_PROFILE: [number, number, number][] = [[0, 1.03, 1.03], [0.14, 0.95, 0.86], [1.0, 0.86, 0.6], [1.16, 0.6, BOOT_START_R], [BOOT_END, BOOT_START_R, CABLE_R]];
