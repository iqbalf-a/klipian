/* One scale per set (DESIGN.md B27.7): every object of a room set has its real size relative to the hero, from this one table of real sizes in cm. The hero is
   the socket plate (8.5 cm, 2.4 world units of the kit), so one world unit is 8.5 / 2.4 = 3.54 cm. A plain .ts module (B26): plans and tests load it in Node.
   When the hero is a close-up a big piece is shown partly, cut by the frame, never shrunk to fit; only a far layer (parallax below 1) may look smaller. */
export const REAL_SIZE_CM = {
  socketPlate: 8.5, plugBody: 4, socketAboveDesk: 25, deskThickness: 3,
  tableLamp: 40, window: { w: 100, h: 110 }, windowCasing: 5, windowSillAboveDesk: 15,
  sideTable: { h: 55, w: 45 }, diningTable: 75, doorHeight: 200, pottedPlant: 45, chibiAdult: 160,
} as const;

export const PLATE_UNITS = 2.4;
export const SOCKET_CENTER_Z = 0.5;                              // the plate's centre height in the kit's world (socket.ts SOCKET_Z)
/** World units of a real size in cm, at the scale of the socket plate. */
export const unitsOf = (cm: number): number => (cm * PLATE_UNITS) / REAL_SIZE_CM.socketPlate;

/** The colokan room: a desk under the socket (its top is the floor the cable lies on), a window beside it, a table lamp on the desk. */
const deskZ = SOCKET_CENTER_Z - unitsOf(REAL_SIZE_CM.socketAboveDesk);
const winX1 = -3.4, winZ0 = deskZ + unitsOf(REAL_SIZE_CM.windowSillAboveDesk);
export const ROOM = {
  deskZ, deskThick: unitsOf(REAL_SIZE_CM.deskThickness),
  window: { x0: winX1 - unitsOf(REAL_SIZE_CM.window.w), x1: winX1, z0: winZ0, z1: winZ0 + unitsOf(REAL_SIZE_CM.window.h) },
  casing: unitsOf(REAL_SIZE_CM.windowCasing),
  lamp: { h: unitsOf(REAL_SIZE_CM.tableLamp), at: [8.2, 3.6] as const },
} as const;
/** The IsoLamp's own height in its own units (its pole and shade run 0 to 2.05). */
export const LAMP_OWN_H = 2.05;
