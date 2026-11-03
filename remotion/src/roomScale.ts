/* One scale per set (DESIGN.md B27.7): every object of a room set has its real size relative to the hero, from this one table of real sizes in cm. The hero is
   the socket plate (8.5 cm, 2.4 world units of the kit), so one world unit is 8.5 / 2.4 = 3.54 cm. A plain .ts module (B26): plans and tests load it in Node.
   When the hero is a close-up a big piece is shown partly, cut by the frame, never shrunk to fit; only a far layer (parallax below 1) may look smaller. */
export const REAL_SIZE_CM = {
  socketPlate: 8.5, plugBody: 4, socketAboveDesk: 30, deskThickness: 4, deskLeg: 5,
  tableLamp: 35, window: { w: 100, h: 110 }, windowCasing: 5, windowSillAboveDesk: 15,
  sideTable: { h: 55, w: 45, d: 40 }, diningTable: 75, doorHeight: 200, pottedPlant: 45, chibiAdult: 160,
} as const;

export const PLATE_UNITS = 2.4;
export const SOCKET_CENTER_Z = 0.5;                              // the plate's centre height in the kit's world (socket.ts SOCKET_Z)
/** World units of a real size in cm, at the scale of the socket plate. */
export const unitsOf = (cm: number): number => (cm * PLATE_UNITS) / REAL_SIZE_CM.socketPlate;

/** The colokan room: a small bedside table under the socket (its top is the floor the cable lies on), a window beside it, a table lamp on the table, plugged in. */
export type Box = { name: string; a: readonly [number, number, number]; b: readonly [number, number, number]; stands?: number };
const deskZ = SOCKET_CENTER_Z - unitsOf(REAL_SIZE_CM.socketAboveDesk);
const floorZ = deskZ - unitsOf(REAL_SIZE_CM.sideTable.h), thick = unitsOf(REAL_SIZE_CM.deskThickness), leg = unitsOf(REAL_SIZE_CM.deskLeg);
const deskW = unitsOf(REAL_SIZE_CM.sideTable.w), deskD = unitsOf(REAL_SIZE_CM.sideTable.d);
const desk = { x0: -9.7, x1: -9.7 + deskW, y0: 0, y1: deskD, leg };
// the window sits well to the left of the socket (a real gap of the wall between the plate and the casing), so it shows in the wide shot only
const casing = unitsOf(REAL_SIZE_CM.windowCasing), winX1 = -7.5, winZ0 = deskZ + unitsOf(REAL_SIZE_CM.windowSillAboveDesk);
const window = { x0: winX1 - unitsOf(REAL_SIZE_CM.window.w), x1: winX1, z0: winZ0, z1: winZ0 + unitsOf(REAL_SIZE_CM.window.h) };
const lampH = unitsOf(REAL_SIZE_CM.tableLamp), lampScale = lampH / 2.05;
const LAMP_SHADE_R = 0.66, LAMP_BASE_R = 0.62;       // IsoLamp's own radii (the shade is the widest part)
const shadeZ = (1.5 / 2.05) * lampH;                  // the shade starts at 1.5 of IsoLamp's 2.05 own units: under it the cord can enter beside the base
const lampAt = [desk.x0 + 3.6 + 0.4, 5.0] as const;
const legs = [[desk.x1 - leg - 0.1, 0.3], [desk.x0 + 0.1, desk.y1 - leg - 0.1], [desk.x1 - leg - 0.1, desk.y1 - leg - 0.1]] as const;
/** B27.9 (no overlap, no pass-through): the world box of every solid object of the set, in drawing order (far to near). Two boxes may touch, never overlap; `stands` is the
    height of the surface an object stands on (its base z equals it). The legs stand on the floor, the table top rests on them, the lamp stands on the table top. */
const BOXES: Box[] = [
  { name: "floor", a: [-40, 0, floorZ - 0.4], b: [40, 40, floorZ] },
  { name: "wall", a: [-40, -0.5, floorZ], b: [40, 0, 60] },
  { name: "skirting", a: [-40, 0, floorZ], b: [40, 0.3, floorZ + 2.8], stands: floorZ },
  { name: "casing", a: [window.x1, 0, window.z0 - casing], b: [window.x1 + casing, 0.3, window.z1 + casing] },
  ...legs.map(([x, y], i): Box => ({ name: `leg${i}`, a: [x, y, floorZ], b: [x + leg, y + leg, deskZ - thick], stands: floorZ })),
  { name: "table", a: [desk.x0, desk.y0, deskZ - thick], b: [desk.x1, desk.y1, deskZ] },
  { name: "lampBase", a: [lampAt[0] - LAMP_BASE_R * lampScale, lampAt[1] - LAMP_BASE_R * lampScale, deskZ], b: [lampAt[0] + LAMP_BASE_R * lampScale, lampAt[1] + LAMP_BASE_R * lampScale, deskZ + shadeZ], stands: deskZ },
  { name: "lampShade", a: [lampAt[0] - LAMP_SHADE_R * lampScale, lampAt[1] - LAMP_SHADE_R * lampScale, deskZ + shadeZ], b: [lampAt[0] + LAMP_SHADE_R * lampScale, lampAt[1] + LAMP_SHADE_R * lampScale, deskZ + lampH] },
];
export const ROOM = {
  deskZ, deskThick: thick, floorZ, desk, window, casing,
  lamp: { h: lampH, at: lampAt, baseR: LAMP_BASE_R * lampScale },
  /** Where the lamp's cord comes out of its base: on the side that faces the viewer and the plug (+x of the base), at the table top. */
  lampCord: [lampAt[0] + LAMP_BASE_R * lampScale + 0.05, lampAt[1], deskZ + 0.05] as const,
  /** The sun behind the window glass, in the brand far layer's own coordinates (index.tsx draws the spot there). It stays clear of the lamp's shade in every frame (a yellow light behind it would make the lamp look lit; yellow is current). */
  sun: { x: -84, y: 219, r: 165 },
  boxes: BOXES,
  /** The boxes the cable must not pass through (the wall and the plug's body are in the sim already; the floor is the table top). */
  obstacles: BOXES.filter((b) => b.name.startsWith("lamp")),
} as const;
/** The IsoLamp's own height in its own units (its pole and shade run 0 to 2.05). */
export const LAMP_OWN_H = 2.05;
