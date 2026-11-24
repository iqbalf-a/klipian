/* The stick cast's skeleton (B52). A pose is a handful of joint angles in degrees; the limbs are drawn from them every frame, so a person can
   reach for a prop, swing their arms when they walk, and ease from one pose into the next with a little overshoot instead of snapping.
   Plain TypeScript (no React, no three): `drawStick` in kit.tsx draws it and tests can import it in Node.

   Angles: a shoulder or hip angle is measured from straight down, growing outward (away from the body: to the screen right for the right arm,
   to the screen left for the left arm). An elbow angle is added to its shoulder angle (positive = the forearm goes further out and up,
   negative = it folds back in). A hip angle grows toward +x for both legs (a walking figure seen from the side) and a knee angle folds the shin back. */
export type Pose = {
  lSh: number; lEl: number; rSh: number; rEl: number;
  lHip: number; lKn: number; rHip: number; rKn: number;
  /** the torso (arms, head and all) tilts forward about the hips, degrees; positive = toward +x */
  lean?: number;
  /** a limb the head layer draws itself (binoculars, a salute): not drawn here */
  hideL?: boolean; hideR?: boolean;
};

export const SH_L = { x: 190, y: 470 }, SH_R = { x: 322, y: 470 };
export const HIP_L = { x: 230, y: 700 }, HIP_R = { x: 282, y: 700 };
export const UPPER = 105, FORE = 100, THIGH = 150, SHIN = 145;
const rad = (d: number) => (d * Math.PI) / 180;
const dir = (deg: number, side: number) => ({ x: side * Math.sin(rad(deg)), y: Math.cos(rad(deg)) });

export type Pt = { x: number; y: number };
/** a canvas point turned `deg` about the hip centre (where the torso leans from) */
export const LEAN_BACK = 270;   // as the torso leans forward the hips go back (px per sin(lean)), which also keeps the head inside the 512 px canvas
export const rot = (p: Pt, deg: number): Pt => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), x = p.x - 256, y = p.y - 700; return { x: 256 + x * c - y * s - LEAN_BACK * s, y: 700 + x * s + y * c }; };
const unrot = (p: Pt, deg: number): Pt => { const c = Math.cos(rad(-deg)), s = Math.sin(rad(-deg)), x = p.x + LEAN_BACK * Math.sin(rad(deg)) - 256, y = p.y - 700; return { x: 256 + x * c - y * s, y: 700 + x * s + y * c }; };
/** shoulder, elbow, hand of one arm in canvas pixels */
export function arm(p: Pose, side: "l" | "r"): [Pt, Pt, Pt] {
  const s = side === "l" ? -1 : 1, o = side === "l" ? SH_L : SH_R, sh = side === "l" ? p.lSh : p.rSh, el = side === "l" ? p.lEl : p.rEl;
  const d1 = dir(sh, s), d2 = dir(sh + el, s);
  const e = { x: o.x + d1.x * UPPER, y: o.y + d1.y * UPPER };
  const h = { x: e.x + d2.x * FORE, y: e.y + d2.y * FORE }, l = p.lean ?? 0;
  return l ? [rot(o, l), rot(e, l), rot(h, l)] : [o, e, h];
}
/** shoulder and elbow angles that put the hand of `side` at canvas point (tx, ty) once the torso has leaned (two-bone reach, elbow below; out of reach = fully stretched) */
export function reach(side: "l" | "r", tx: number, ty: number, lean = 0): { sh: number; el: number } {
  const o = side === "l" ? SH_L : SH_R, s = side === "l" ? -1 : 1, T = unrot({ x: tx, y: ty }, lean), dx = T.x - o.x, dy = T.y - o.y;
  const d = Math.min(UPPER + FORE - 2, Math.max(Math.abs(UPPER - FORE) + 2, Math.hypot(dx, dy))), a = Math.atan2(dx, dy), A = Math.acos((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d));
  const th = Math.cos(a + A) > Math.cos(a - A) ? a + A : a - A, ex = o.x + UPPER * Math.sin(th), ey = o.y + UPPER * Math.cos(th), ph = Math.atan2(T.x - ex, T.y - ey);
  const sh = (s * th * 180) / Math.PI;
  return { sh, el: (s * ph * 180) / Math.PI - sh };
}
/** hip, knee, ankle of one leg */
export function leg(p: Pose, side: "l" | "r"): [Pt, Pt, Pt] {
  const o = side === "l" ? HIP_L : HIP_R, h = side === "l" ? p.lHip : p.rHip, k = side === "l" ? p.lKn : p.rKn;
  const d1 = dir(h, 1), d2 = dir(h - k, 1);
  const kn = { x: o.x + d1.x * THIGH, y: o.y + d1.y * THIGH };
  return [o, kn, { x: kn.x + d2.x * SHIN, y: kn.y + d2.y * SHIN }];
}
/** where the right (or left) hand is, as an offset from the soles in metres for a figure `h` tall (x grows toward the figure's right when not flipped) */
export function handOffset(p: Pose, side: "l" | "r", h = 1.7): { x: number; y: number } {
  const hand = arm(p, side)[2], dy = 995 - Math.max(leg(p, "l")[2].y, leg(p, "r")[2].y);   // the figure is drawn dropped by dy so its lower foot stands on the ground
  return { x: ((hand.x - 256) * h) / 1024, y: h * (1 - (hand.y + dy) / 1024) };
}

const A = (lSh: number, lEl: number, rSh: number, rEl: number, extra: Partial<Pose> = {}): Pose => ({ lSh, lEl, rSh, rEl, lHip: 8, lKn: 0, rHip: -8, rKn: 0, ...extra });
/** the named arm poses of the old `Arms` type, now as joint angles */
export const POSES: Record<string, Pose> = {
  down: A(12, -8, 12, -8),
  belly: A(28, -58, 28, -58),
  hips: A(55, -82, 55, -82),
  shrug: A(62, 72, 62, 72),
  up: A(150, 6, 150, 6),
  point: A(12, -8, 100, -4),
  wave: A(12, -8, 92, 98),
  aim: A(55, -82, 50, 55),                  // the right hand out at about (499, 511): holds a gun, a pot, a hose; the left braces on the hip
  feed: A(14, -10, 38, 36),                 // the right hand works low at its side (a belt, a box)
  binoc: A(12, -8, 12, -8, { hideL: true, hideR: true }),
  salute: A(12, -8, 12, -8, { hideR: true }),
  cower: A(150, -120, 150, -120),           // both forearms folded over the head
  cheer: A(165, 12, 165, 12),
  push: A(88, 4, 88, 4),                     // both arms straight out at the sides of the body, as if shoving
};

/** Poses that move on their own: the name in a person's `faces` list starts a loop (an angry fist, a hoe, a scratch, a laugh, a clap, a yank on a stuck gun). */
const sn = (t: number, f: number, ph = 0) => Math.sin(t * f + ph);
export const MOVING: Record<string, (t: number) => Pose> = {
  fist: (t) => A(12, -8, 125 + 38 * sn(t, 9), 30 + 25 * sn(t, 9, 1.2)),
  hoe: (t) => A(70 + 60 * Math.max(0, sn(t, 3.4)), 8, 70 + 60 * Math.max(0, sn(t, 3.4)), 8),
  scratch: (t) => A(12, -8, 150, -125 + 10 * sn(t, 8)),
  jam: (t) => A(55, -82, 50 + 6 * sn(t, 7), 55 - 40 * Math.max(0, sn(t, 7))),
  laugh: (t) => A(28 + 8 * sn(t, 13), -58, 28 + 8 * sn(t, 13, 1), -58),
  clap: (t) => A(40 - 12 * sn(t, 8), -78, 40 - 12 * sn(t, 8), -78),
  feedc: (t) => A(14, -10, 38 + 12 * sn(t, 6), 36 - 18 * sn(t, 6)),
  cheerc: (t) => A(155 + 18 * sn(t, 8), 10, 155 + 18 * sn(t, 8, 1.4), 10),
  pointc: (t) => A(12, -8, 100 + 6 * sn(t, 7), -4),
  wavec: (t) => A(12, -8, 92, 85 + 25 * sn(t, 9)),
  shoot: (t) => RP(8 + 0.6 * sn(t, 2), SHOOT_LEGS, [400, 520], [470, 548]),
  dig: (t) => seq(DIG_KEYS, t / 1.9),
  bowl: (t) => seq(BOWL_KEYS, t / 2.6),
};
/** a pose from a torso lean, the legs, and the canvas points the two hands must reach */
const RP = (lean: number, legs: Partial<Pose>, rh?: [number, number], lh?: [number, number]): Pose => {
  const p: Pose = { ...A(12, -8, 12, -8), lean, ...legs };
  if (rh) { const q = reach("r", rh[0], rh[1], lean); p.rSh = q.sh; p.rEl = q.el; }
  if (lh) { const q = reach("l", lh[0], lh[1], lean); p.lSh = q.sh; p.lEl = q.el; }
  return p;
};
const smooth = (u: number) => u * u * (3 - 2 * u);
/** a looping action as keyed poses over u in 0..1 (the last key repeats the first), eased between keys */
function seq(keys: [number, Pose][], u: number): Pose {
  u -= Math.floor(u);
  let i = 0;
  while (i < keys.length - 1 && u >= keys[i + 1][0]) i++;
  const [u0, p0] = keys[i], [u1, p1] = keys[Math.min(i + 1, keys.length - 1)];
  return u1 > u0 ? mix(p0, p1, smooth((u - u0) / (u1 - u0))) : p0;
}
/* Real activities (B52): each follows what a body does. SHOOT: feet apart and staggered, weight on the front foot, the torso leaning into the gun, the firing hand at the grip
   near the shoulder, the other hand out on the forestock. DIG: knees bent, lean in, the top hand near the hip and the lower hand ahead on the handle; push the blade in with the
   front foot, lever the load up while straightening, swing it out and drop it. BOWL: ball at the chest, a long backswing with a step, a deep lunge as the arm swings down past
   the knee, release low and forward, the arm follows through up. */
const SHOOT_LEGS = { rHip: 24, rKn: 16, lHip: -18, lKn: 6 };
const DIG0 = RP(14, { rHip: 20, rKn: 24, lHip: -12, lKn: 8 }, [395, 620], [385, 632]);
const DIG_KEYS: [number, Pose][] = [
  [0, DIG0],
  [0.28, RP(24, { rHip: 34, rKn: 48, lHip: -16, lKn: 6 }, [405, 640], [392, 645])],
  [0.58, RP(4, { rHip: 18, rKn: 20, lHip: -8, lKn: 0 }, [385, 560], [375, 578])],
  [0.8, RP(-6, { rHip: 14, rKn: 10, lHip: -10, lKn: 0 }, [400, 530], [382, 548])],
  [1, DIG0],
];
/** the shovel's angle (degrees from hanging straight down toward the way the person faces) over the same cycle: blade in the soil, blade pressed in, blade up with the load, blade swung out */
const SHOVEL_KEYS: [number, number][] = [[0, 32], [0.28, 18], [0.58, 80], [0.8, 105], [1, 32]];
export function shovelDeg(t: number): number {
  const u = t / 1.9 - Math.floor(t / 1.9);
  let i = 0;
  while (i < SHOVEL_KEYS.length - 1 && u >= SHOVEL_KEYS[i + 1][0]) i++;
  const [u0, a0] = SHOVEL_KEYS[i], [u1, a1] = SHOVEL_KEYS[Math.min(i + 1, SHOVEL_KEYS.length - 1)];
  return u1 > u0 ? a0 + (a1 - a0) * smooth((u - u0) / (u1 - u0)) : a0;
}
const BOWL0 = RP(0, { rHip: 8, rKn: 0, lHip: -8, lKn: 0 }, [330, 580], [300, 590]);
const BOWL_KEYS: [number, Pose][] = [
  [0, BOWL0],
  [0.25, RP(10, { rHip: 18, rKn: 24, lHip: -16, lKn: 6 }, [250, 560], [220, 540])],
  [0.5, { ...RP(22, { rHip: 40, rKn: 56, lHip: -30, lKn: 12 }), rSh: -55, rEl: 0, lSh: 30, lEl: 0 }],
  [0.68, { ...RP(26, { rHip: 52, rKn: 74, lHip: -36, lKn: 8 }), rSh: 18, rEl: -4, lSh: 30, lEl: 0 }],
  [0.8, { ...RP(10, { rHip: 40, rKn: 50, lHip: -30, lKn: 4 }), rSh: 116, rEl: -30, lSh: 30, lEl: 0 }],
  [1, BOWL0],
];
const named = (name: string, t: number): Pose => POSES[name] ?? MOVING[name]?.(t) ?? POSES.down;
const mixN = (a: number, b: number, u: number) => a + (b - a) * u;
export function mix(a: Pose, b: Pose, u: number): Pose {
  return {
    lSh: mixN(a.lSh, b.lSh, u), lEl: mixN(a.lEl, b.lEl, u), rSh: mixN(a.rSh, b.rSh, u), rEl: mixN(a.rEl, b.rEl, u),
    lHip: mixN(a.lHip, b.lHip, u), lKn: mixN(a.lKn, b.lKn, u), rHip: mixN(a.rHip, b.rHip, u), rKn: mixN(a.rKn, b.rKn, u),
    lean: mixN(a.lean ?? 0, b.lean ?? 0, u), hideL: u < 0.5 ? a.hideL : b.hideL, hideR: u < 0.5 ? a.hideR : b.hideR,
  };
}
/** 0 -> 1 with a little overshoot and settle (a damped spring): the pose lands past its mark and comes back */
export const spring = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-7 * u) * Math.cos(11 * u));

/** The pose at time `t` for a person whose arms change on `keys` ([time, name]): the arms ease from the last pose into the current one over `dur` seconds. */
export function poseAt(keys: [number, string][], t: number, dur = 0.3): Pose {
  let i = 0;
  for (let k = 0; k < keys.length; k++) if (t >= keys[k][0]) i = k;
  const cur = named(keys[i][1], t), prev = named(keys[Math.max(0, i - 1)][1], t);
  return i === 0 ? cur : mix(prev, cur, spring((t - keys[i][0]) / dur));
}

/** Legs and arms of a walk (or a run) at phase `ph` (radians), added on top of a pose: legs swing and fold, hanging arms swing against them. `amp` 1 = walk, 1.6 = jog. */
export function gait(p: Pose, ph: number, amp = 1, swingArms = true): Pose {
  const s = Math.sin(ph), c = Math.cos(ph);
  const hang = p.rSh < 40 && p.lSh < 40;   // only arms that hang freely swing
  return {
    ...p,
    lHip: 28 * amp * s, rHip: -28 * amp * s, lKn: 34 * amp * Math.max(0, c), rKn: 34 * amp * Math.max(0, -c),
    lSh: p.lSh + (swingArms && hang ? 24 * amp * s : 0), rSh: p.rSh + (swingArms && hang ? 24 * amp * s : 0),
    lEl: p.lEl + (swingArms && hang && amp > 1.2 ? 40 : 0), rEl: p.rEl + (swingArms && hang && amp > 1.2 ? 40 : 0),
  };
}

/** A talking gesture: the free arms rise and fall on their own beat (`ph` differs per person so two people never gesture together). */
export function gesture(p: Pose, t: number, ph: number, power: number): Pose {
  if (power <= 0) return p;
  const a = Math.max(0, Math.sin(t * 5.3 + ph)), b = Math.max(0, Math.sin(t * 4.1 + ph * 1.7 + 1));
  const freeR = p.rSh < 70 && !p.hideR, freeL = p.lSh < 70 && !p.hideL;
  return {
    ...p,
    rSh: p.rSh + (freeR ? 55 * power * a : 0), rEl: p.rEl + (freeR ? 50 * power * a : 0),
    lSh: p.lSh + (freeL ? 50 * power * b : 0), lEl: p.lEl + (freeL ? 45 * power * b : 0),
  };
}
/** a kick on the arm that holds a gun (or a tool): a quick jerk and recovery per shot */
export const kick = (p: Pose, k: number): Pose => ({ ...p, rSh: p.rSh + 9 * k, rEl: p.rEl - 12 * k, lean: (p.lean ?? 0) - 2.5 * k });
