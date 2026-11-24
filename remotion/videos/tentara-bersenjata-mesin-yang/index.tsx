/* Tentara bersenjata mesin kalah lawan burung emu (look ricks, B46 + B49): a true story with a twist. Campion district, Western Australia, 1932:
   three soldiers with two Lewis guns against the emus that trample the wheat of veteran farmers; the birds scatter, outrun the truck, shrug
   off glancing bullets, and (reportedly, Britannica) every mob keeps one lookout. The twist at about 73 %: the lookout. The picture follows
   the voice (words.json from faster-whisper): one shot per sentence, one caption word at a time, pills on their word (B45), the last shot
   flies back to the first shot's framing (the loop). The engine and the cast are the ricks kit; the world is seven small stages far apart
   on one ground (field, water hole, chase lane, shooting range, parliament, farm gate, the lookout's scrub), the camera visits them. */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FRAME } from "../../src/tokens.ts";
import { CAST, RicksCamera, RicksPost, StickHero, TBox, Pills, WordCaption, camAt, painted, readWords, rnd, stepAt, V, type Arms, type Cam, type Expr, type Outfit, type Pill, type Shot } from "../../src/ricks/kit.tsx";
import { Debris, shake } from "../../src/ricks/fx.tsx";
import { gait, gesture, handOffset, kick as kickPose, poseAt, shovelDeg, type Pose } from "../../src/ricks/rig.ts";
import type { StoryT } from "../../src/schema.ts";
import storyJson from "./story.json";
import WORDS from "./words.json";

export const story = storyJson as unknown as StoryT;
const FPS = 30;
const TOTAL = 58.96;
const SKY = "#b4d9ef";
const HIT = 26.9;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const prog = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (u: number) => u * u * (3 - 2 * u);

// ---------- the stages (x offsets on one ground) -----------------------------------------------------------------------------------------
const OA = 0, OB = 40, OC = 80, OD = -40, OE = -80, OF = 120, OG = -120;
const C = (px: number, py: number, pz: number, lx: number, ly: number, lz: number): Cam => ({ pos: V(px, py, pz), look: V(lx, ly, lz) });
const HOOK = C(0.1, 1.25, 3.6, 0, 1.25, 0);

// the chase: the truck at 5 m/s, the emus at 8 m/s (they pull away); the truck leaves and comes back at the farm gate
const TRUCK_C = (t: number) => OC + (t - 21.78) * 5;
const EMU_C = (t: number, j: number) => OC + 3.5 + 0.5 * j + (t - 21.78) * 6;
const TRUCK_F = (t: number) => (t < 41.5 ? OF + 1 + Math.max(0, t - 38.04) * 4.2 : OF + 12 - (t - 41.5) * 5.2);

const SHOTS: Shot[] = [
  { from: 0, a: HOOK, b: C(4.94, 1.3, 3.15, 4.84, 1.25, 0) },                                                  // Tiga tentara berangkat melawan burung emu
  { from: 4.4, a: C(-4.5, 1.5, 9.2, -3, 1.1, -1), b: C(-2.9, 1.5, 8.6, -2.1, 1.1, -1) },                      // para veteran perang bertani gandum
  { from: 6.9, a: C(0.5, 1.5, -1.5, 3, 1.1, -12), b: C(2.5, 1.4, -3.0, 4, 1.1, -12) },                           // ribuan emu setinggi satu setengah meter
  { from: 9.2, a: C(3.0, 0.55, -4.5, 4.5, 0.8, -10), b: C(3.6, 0.6, -5.2, 5, 0.8, -11) },                    // menginjak ladangnya
  { from: 11.1, a: C(-0.5, 1.3, 6.5, 0.3, 1.1, 0), b: C(0.2, 1.3, 6.0, 0.5, 1.1, 0) },                      // tentara dikirim dengan dua senapan mesin
  { from: 13.42, a: C(-1.2, 1.3, 6.8, 1.1, 1.0, -2.5), b: C(-0.9, 1.25, 6.3, 1.7, 1.05, -3.5) },                  // tembakan pertama: emu bubar
  { from: 17.54, a: C(0.9, 1.3, 4.6, 0.5, 1.2, 0.9), b: C(0.8, 1.3, 4.0, 0.6, 1.2, 0.9) },              // susah sekali membidiknya
  { from: 19.38, a: C(OB + 2.4, 1.3, 7.5, OB + 3.5, 1.1, 0), b: C(OB + 3, 1.3, 6.5, OB + 3.6, 1.1, 0) },     // disergap di sumber air, senapan macet
  { from: 21.78, a: C(OC + 0.5, 1.7, 17, OC + 2, 1.0, -1), b: C(OC + 12, 1.7, 17, OC + 13.6, 1.0, -1) },        // dikejar pakai truk
  { from: 24.1, a: C(OC + 13.5, 2.0, 20, OC + 15, 1.0, -1), b: C(OC + 22, 2.0, 20, OC + 23.5, 1.0, -1) },        // emu berlari lebih cepat
  { from: 25.68, a: C(OD - 2.6, 1.3, 11, OD - 2.5, 1.0, 0), b: C(OD - 2.4, 1.3, 9.5, OD - 2.3, 1.0, 0) },        // kulit emu tebal, peluru nyasar
  { from: 28.74, a: C(OD - 2.2, 1.3, 9, OD - 1.0, 1.0, 0), b: C(OD + 1.6, 1.3, 9, OD + 2.8, 1.0, 0) },    // tertembak tapi tetap lari
  { from: 31.34, a: C(OE - 1.5, 1.4, 4.0, OE, 1.3, 0), b: C(OE - 0.5, 1.4, 3.4, OE, 1.3, 0) },             // beritanya menyebar, parlemen bercanda
  { from: 34.38, a: C(OE + 5.8, 1.5, 8.6, OE + 5.8, 1.3, 0), b: C(OE + 5.8, 1.5, 7.6, OE + 5.8, 1.3, 0) },   // medali pantasnya buat emu
  { from: 38.04, a: C(OF + 1, 1.4, 9, OF + 3, 1.0, 0), b: C(OF + 8, 1.4, 9, OF + 9.5, 1.0, 0) },           // tentara sempat ditarik
  { from: 40.12, a: C(OF - 2, 1.3, 4, OF - 2, 1.3, 0), b: C(OF - 1.4, 1.3, 3.5, OF - 2, 1.3, 0) },         // para petani menuntut
  { from: 41.5, a: C(OF + 9, 1.4, 9, OF + 10.5, 1.0, 0), b: C(OF + 1, 1.4, 9, OF + 2.5, 1.0, 0) },             // dikirim lagi
  { from: 43.52, a: C(OG - 3, 0.5, 3, OG, 0.9, -3), b: C(OG - 2.5, 0.55, 2.4, OG, 1.0, -3) },              // Ternyata, dikabarkan
  { from: 45.3, a: C(OG - 1.5, 1.6, 7.8, OG, 2.1, -1), b: C(OG - 0.7, 1.7, 6.4, OG, 2.2, -1) },            // tiap kawanan punya satu emu penjaga
  { from: 47.5, a: C(OG - 0.6, 1.6, 5.6, OG, 2.4, -1), b: C(OG - 0.4, 1.7, 5.0, OG, 2.5, -1) },            // yang memperingatkan yang lain
  { from: 49.0, a: C(OG - 1, 1.6, 6, OG + 1, 0.9, -6), b: C(OG, 2.0, 7, OG + 3, 0.9, -8) },                // semuanya sempat kabur
  { from: 51.16, a: C(1.5, 1.5, 8, 1.5, 1.0, -1), b: C(4, 1.5, 8, 4.5, 1.0, -1) },                            // operasi dihentikan
  { from: 53.2, a: C(-1.5, 1.0, 3.5, 0.5, 1.3, -4), b: C(1.5, 1.1, 3.2, 0.5, 1.3, -4) },                  // emu dianggap pemenangnya
  { from: 55.52, a: C(-5, 0.9, 3, -4, 1.0, -3.2), b: C(-8, 1.0, 3.2, -10, 1.2, -3.2) },                   // yang akhirnya ampuh cuma satu
  { from: 57.4, a: C(-9, 2.0, 6, -11, 1.0, -3.2), b: HOOK },                                              // pagar panjang; the camera flies back to the first shot (the loop)
  { from: 58.0, a: HOOK, b: HOOK },
];

// ---------- the people (every one their own outfit, B46 i; heads are always white) ---------------------------------------------------------
const KOM: Outfit = { shirt: "#9b9b5a", stripe: "#6e6e38", pattern: "plain", hat: "cowboy", hatColor: "#7c7a45", mustache: true, body: "wide", nose: "big" };
const SOL1: Outfit = { shirt: "#6f8a52", stripe: "#4a6034", pattern: "check", hat: "cap", hatColor: "#58693f", nose: "dot", blush: true };
const SOL2: Outfit = { shirt: "#a39a6a", stripe: "#7a7248", pattern: "collar", hat: "hardhat", hatColor: "#6b7a4a", glasses: true };
const FARM1: Outfit = { shirt: "#c0502e", stripe: "#7a2f18", pattern: "check", hat: "cowboy", hatColor: "#8a5a32", beard: true, hairColor: "#5a3b1f", body: "wide" };
const FARM2: Outfit = { shirt: "#3b86b8", stripe: "#1f5a80", pattern: "dots", hair: "long", hairColor: "#3b2418", blush: true, nose: "dot" };
const PARL1: Outfit = { shirt: "#3a3f4a", stripe: "#8fa0bf", pattern: "collar", hair: "bald", glasses: true, nose: "big" };
const PARL2: Outfit = { shirt: "#7a2f4a", stripe: "#d9a0b8", pattern: "plain", hair: "bun", hairColor: "#d8d8d8", blush: true };

type Beat = ["hop" | "lean" | "shake", number, number, number];
const beatsAt = (beats: Beat[], t: number, ph = 0) => {
  let hop = 0, lean = 0;
  for (const [k, a, b, v] of beats) {
    if (t < a || t >= b) continue;
    const u = (t - a) / (b - a);
    if (k === "hop") hop += Math.sin(u * Math.PI) * v;
    else if (k === "lean") lean += Math.min(1, u * 5, (1 - u) * 5) * v;
    else { const e = Math.min(1, u * 6, (1 - u) * 6); hop += Math.abs(Math.sin(t * 5.5 + ph)) * v * 1.2 * e; }   // a shake is a stomping sway, never a twitch
  }
  return { hop, lean };
};
/** How one person moves when nothing else is asked of them: paces about, bobs, tilts and nods the head, gestures. Every person differs (B51). */
type Persona = { pace: number; per: number; ph: number; bob: number; bobF: number; tilt: number; tiltF: number; nod: number; nodF: number; gest: number; gestF: number };
const PERSONA: Record<string, Persona> = {
  kom:   { pace: 0, per: 5.2, ph: 0.0, bob: 0.0,   bobF: 0,   tilt: 0.06, tiltF: 0.7, nod: 6,  nodF: 1.1, gest: 0.9, gestF: 0.45 },   // the commander: slow pacing, points and orders
  sol1:  { pace: 0,  per: 2.3, ph: 1.3, bob: 0.035, bobF: 2.6, tilt: 0.12, tiltF: 1.7, nod: 10, nodF: 2.2, gest: 0.0, gestF: 0 },      // the cheerful private: bounces on his toes, looks around
  sol2:  { pace: 0,  per: 3.4, ph: 2.4, bob: 0.0,   bobF: 0,   tilt: 0.09, tiltF: 1.2, nod: 4,  nodF: 0.8, gest: 0.7, gestF: 0.8 },    // the nervous private: shifts his weight, fidgets with his hands
  farm1: { pace: 0,  per: 4.1, ph: 0.5, bob: 0.0,   bobF: 0,   tilt: 0.07, tiltF: 0.9, nod: 5,  nodF: 1.4, gest: 0.9, gestF: 0.6 },
  farm2: { pace: 0, per: 2.9, ph: 3.1, bob: 0.03,  bobF: 2.1, tilt: 0.1,  tiltF: 1.5, nod: 8,  nodF: 1.9, gest: 0.6, gestF: 1.0 },
  parl1: { pace: 0,  per: 4.7, ph: 1.9, bob: 0.0,   bobF: 0,   tilt: 0.05, tiltF: 0.6, nod: 5,  nodF: 1.0, gest: 0.8, gestF: 0.5 },
  parl2: { pace: 0, per: 3.3, ph: 4.2, bob: 0.02,  bobF: 1.6, tilt: 0.11, tiltF: 1.3, nod: 7,  nodF: 1.6, gest: 0.5, gestF: 0.9 },
};
type Track = { idle?: boolean; ride?: boolean; flip?: boolean; a: number; b: number; pos: (t: number) => [number, number, number?]; faces: [number, Expr, string][]; beats?: Beat[]; h?: number };
const stay = (x: number, z: number) => (): [number, number] => [x, z];
const walk = (a: number, b: number, x0: number, z0: number, x1: number, z1: number) => (t: number): [number, number] => { const k = ease(prog(t, a, b)); return [lerp(x0, x1, k), lerp(z0, z1, k)]; };
const inTruckF = (dx: number) => (t: number): [number, number, number] => [TRUCK_F(t) + dx, -0.2, 0.72];

/** The three soldiers: the same pattern of places for each (i = 0 commander, 1 and 2 privates). */
const soldier = (i: number): Track[] => {
  const A: [number, number][] = [[0, 0], [-0.85, -0.7], [0.85, -0.9]];
  const POST: [number, number][] = [[-1.05, 0.3], [0.45, 0.88], [-0.35, 0.45]];   // the gun is at sol1's right hand: the commander watches, sol2 stands behind him and feeds the belt
  const B: [number, number][] = [[OB + 4.4, 1.5], [OB + 3.4, 1.6], [OB + 2.5, 1.9]];
  const D: [number, number][] = [[OD - 1.8, 0.6], [OD - 3.4, 1.1], [OD - 2.6, -0.4]];
  const G: [number, number][] = [[OG + 5.5, -9], [OG + 6.5, -9.4], [OG + 7.3, -9]];
  const F = [-0.9, -0.2, 0.5][i], home = [0, -0.85, 0.85][i], homeZ = [0, -0.7, -0.9][i], TR = [-0.15, -0.8, -1.45][i];
  type F3 = [number, Expr, string][];
  const fMarch: F3[] = [[[0, "calm", "pointc"]], [[0, "grin", "down"]], [[0, "puzzled", "down"]]];
  const fStay: F3[] = [[[4.4, "calm", "hips"]], [[4.4, "calm", "down"], [9.2, "sly", "belly"]], [[4.4, "puzzled", "down"], [9.2, "calm", "belly"]]];
  const fWalk: F3[] = [[[11.1, "grin", "pointc"]], [[11.1, "grin", "down"]], [[11.1, "calm", "down"]]];
  const fPost: F3[] = [
    [[12.3, "furious", "pointc"], [13.42, "shocked", "binoc"], [16.9, "furious", "pointc"], [17.54, "furious", "fist"]],
    [[12.3, "grin", "shoot"], [13.42, "furious", "shoot"], [17.54, "puzzled", "shoot"]],
    [[12.3, "grin", "feedc"], [13.42, "shocked", "feedc"], [17.54, "sleepy", "scratch"]],
  ];
  const fB: F3[] = [[[19.38, "furious", "fist"], [20.6, "furious", "cheerc"]], [[19.38, "sly", "shoot"], [19.9, "shocked", "jam"], [21.0, "shocked", "jam"]], [[19.38, "shocked", "cheerc"], [21.0, "shocked", "cheerc"]]];
  const fC: F3[] = [[[21.78, "furious", "pointc"], [24.1, "shocked", "cheerc"]], [[21.78, "furious", "shoot"]], [[21.78, "shocked", "cheerc"]]];
  const fD: F3[] = [[[25.68, "calm", "hips"], [HIT, "shocked", "cheerc"], [28.74, "furious", "fist"]], [[25.68, "calm", "shoot"], [HIT - 0.4, "furious", "shoot"], [HIT + 0.3, "shocked", "cheerc"], [28.74, "furious", "fist"]], [[25.68, "calm", "belly"], [HIT, "shocked", "cheerc"], [28.74, "furious", "pointc"]]];
  const fG: F3[] = [[[43.52, "calm", "down"], [49.0, "shocked", "cheerc"]], [[43.52, "calm", "down"], [49.0, "furious", "shoot"], [50.8, "shocked", "down"]], [[43.52, "calm", "down"], [49.0, "shocked", "cheerc"]]];
  const [ax, az] = A[i], [px, pz] = POST[i], [bx, bz] = B[i], [dx, dz] = D[i], [gx, gz] = G[i];
  const circle = (t: number): [number, number] => [bx + 1.1 * Math.cos((t - 19.38) * 3.4), bz - 0.5 + 0.7 * Math.sin((t - 19.38) * 3.4)];   // sol2 runs round in a panic
  return [
    { a: 0, b: 4.4, pos: (t: number): [number, number] => [ax + 1.1 * t, az], faces: fMarch[i] },   // they march out (the camera walks with them), mid-stride at frame 0
    { a: 4.4, b: 11.1, idle: true, pos: stay(ax, az), faces: fStay[i] },
    { a: 11.1, b: 12.3, pos: walk(11.1, 12.3, ax, az, px, pz), faces: fWalk[i] },                                   // they take their posts at the gun
    { a: 12.3, b: 19.38, idle: true, pos: stay(px, pz), faces: fPost[i] },
    { a: 19.38, b: 21.78, idle: i !== 2, pos: i === 2 ? circle : stay(bx, bz), faces: fB[i], beats: [["shake", 20.6, 21.7, 0.03 + 0.01 * i], ["hop", 20.95, 21.25, 0.1]] },
    { a: 21.78, b: 25.68, ride: true, flip: i !== 1, pos: (t: number): [number, number, number] => [TRUCK_C(t) + TR, -1.5, 0.72], faces: fC[i] },   // all three ride the truck
    { a: 25.68, b: 28.74, idle: true, pos: stay(dx, dz), faces: fD[i], beats: [["hop", HIT, HIT + 0.3, 0.12]] },
    { a: 28.74, b: 31.34, pos: walk(28.74, 30.6, dx, dz, dx + 5.2 + 0.7 * i, dz + 0.2 * i), faces: fD[i] },     // the emu runs on: they run after it
    { a: 38.04, b: 40.12, ride: true, pos: inTruckF(F), faces: [[38.04, "sleepy", "down"]] },
    { a: 41.5, b: 43.52, ride: true, pos: inTruckF(F), faces: [[41.5, "grin", "wavec"]], beats: [["shake", 41.5, 43.5, 0.03]] },
    { a: 43.52, b: 51.16, idle: true, flip: i === 1, pos: stay(gx, gz), faces: fG[i], beats: [["hop", 49.3, 49.6, 0.1]] },
    { a: 51.16, b: 53.0, pos: walk(51.16, 53.0, home, -0.8, 5.6 + 0.3 * i, -1.2), faces: [[51.16, "sleepy", "down"]] },
    { a: 56.8, b: 58.96, pos: walk(56.8, 58.2, 6.5 + i * 0.9, -0.6, home, homeZ), faces: [[56.8, "furious", "fist"], [58.3, "calm", "hips"]] },
  ];
};

// ---------- one person's state at a time: where, which pose, how they move (the gun reads it to sit in the right hand) ------------------------
type AState = { prop: string; rig: Pose; x: number; y: number; z: number; flip: boolean; expr: Expr; arms: Arms; hop: number; lean: number; act: number; step: number; tilt: number; nod: number; h: number };
const BURSTS: [number, number][] = [[14.05, 14.7], [15.1, 15.7], [16.3, 16.9], [22.2, 23.0], [23.6, 24.4], [HIT - 0.4, HIT + 0.3], [49.6, 50.8]];
const firing = (t: number) => BURSTS.some(([a, b]) => t >= a && t < b);
const LEGACY_ARMS = new Set(["binoc", "salute"]);   // the head layer draws these two itself
const stateOf = (a: { id: string; tracks: Track[] }, t: number, f: number): AState | null => {
  const tr = a.tracks.find((k) => t >= k.a && t < k.b);
  if (!tr) return null;
  const P = PERSONA[a.id] ?? PERSONA.kom, w = (Math.PI * 2) / P.per;
  const off = (s: number) => (tr.idle ? P.pace * Math.sin(w * s + P.ph) : 0);
  const [bx, z, y = 0] = tr.pos(t), x = bx + off(t), x2 = tr.pos(t + 0.05)[0] + off(t + 0.05), x1 = tr.pos(t - 0.05)[0] + off(t - 0.05);
  const m = beatsAt(tr.beats ?? [], t, P.ph), [, expr, armName] = stepAt(tr.faces, t);
  const speed = Math.abs(x2 - x1) / 0.1, moving = !tr.ride && speed > 0.12;
  const flip = tr.flip ?? (moving ? x2 < x1 - 0.002 : false);
  const shooting = a.id === "sol1" && firing(t);
  let rig = poseAt(tr.faces.map(([ta, , ar]) => [ta, ar] as [number, string]), t, 0.28);
  if (moving) rig = gait(rig, (bx * Math.PI * 2) / (speed > 2.2 ? 1.5 : 0.9), speed > 2.2 ? 1.6 : speed > 1.4 ? 1.25 : 1);   // the legs follow the ground: one stride per 0.9 m, so the feet never slide
  else rig = { ...rig, lHip: rig.lHip + 3 * Math.sin(t * 0.9 + P.ph), rHip: rig.rHip - 3 * Math.sin(t * 0.9 + P.ph) };
  const gesturing = P.gest > 0 && !moving && (armName === "down" || armName === "belly" || armName === "hips") && Math.sin(t * P.gestF * 2 + P.ph) > 0.1;
  if (gesturing) rig = gesture(rig, t, P.ph, P.gest);
  if (shooting) rig = kickPose(rig, f % 2);
  const bump = tr.ride ? 0.012 * Math.abs(Math.sin(t * 14 + P.ph)) : 0;   // riding the truck over rough ground
  return {
    prop: armName, rig, x, y, z, flip, expr, arms: (LEGACY_ARMS.has(armName) ? armName : "down") as Arms, h: tr.h ?? 1.7, act: 0, step: 0,
    hop: m.hop + bump + (shooting ? 0.012 * (f % 2) : 0) + P.bob * Math.abs(Math.sin(t * P.bobF * Math.PI + P.ph)), lean: m.lean + (shooting ? (f % 2 ? -0.03 : 0.008) : 0) + 0.006 * Math.sin(t * 1.3 + P.ph),
    tilt: P.tilt * 0.6 * Math.sin(t * P.tiltF + P.ph), nod: P.nod * 0.5 * Math.sin(t * P.nodF * 2 + P.ph * 2),
  };
};
/** The machine gun is always in somebody's hand: sol1's right hand (the sprite's hand is 0.30 right of the body and 0.83 up), or on its tripod once nobody holds it. */
const gunPose = (t: number, f: number): { x: number; y: number; z: number; yaw: number; held: boolean; fire: boolean; s: number } | null => {
  if (t < 12.02 || t >= 51.1) return null;
  const s1 = stateOf(ACTORS[1], t, f);
  const fire = firing(t) && Math.floor(f / 2) % 2 === 0, u = t - 12.02, s = u < 0.35 ? 1 + 0.25 * Math.sin((u / 0.35) * Math.PI) : 1;
  if (t >= HIT + 0.5 && t < 43.52) return { x: OD - 3.1, y: 0, z: 1.12, yaw: 0, held: false, fire: false, s };   // put down after the hit
  if (!s1) return null;
  const side = s1.flip ? -1 : 1;
  const yaw = t < 19.38 ? 0.3 + (t >= 17.54 ? 0.3 * Math.sin((t - 17.54) * 3.2) : 0) : t >= 43.52 ? Math.PI : 0;   // stage A: the barrel points the way he faces (out to the right, a little into the field), sweeping while he can not aim
  const hr = handOffset(s1.rig, "r", s1.h), hl = handOffset(s1.rig, "l", s1.h), two = s1.prop === "shoot";   // two hands on the gun when he shoots (grip and forestock), else the grip is in the right hand
  const hd = two ? { x: (hr.x + hl.x) / 2 - 0.1, y: (hr.y + hl.y) / 2 } : hr;
  return { x: s1.x + side * hd.x, y: s1.y + hd.y - 0.62, z: s1.z + 0.05, yaw, held: true, fire, s };
};
const ACTORS: { id: string; o: Outfit; tracks: Track[] }[] = [
  { id: "kom", o: KOM, tracks: soldier(0) },
  { id: "sol1", o: SOL1, tracks: soldier(1) },
  { id: "sol2", o: SOL2, tracks: soldier(2) },
  { id: "farm1", o: FARM1, tracks: [
    { a: 4.4, b: 6.9, pos: walk(4.4, 6.9, -4.6, 0.2, -3.1, 0.5), faces: [[4.4, "calm", "down"], [5.6, "furious", "fist"]] },
    { a: 40.12, b: 43.52, idle: true, pos: stay(OF - 2.5, -0.2), faces: [[40.12, "furious", "fist"], [41.5, "furious", "pointc"]], beats: [["hop", 40.3, 40.6, 0.14], ["hop", 40.9, 41.2, 0.14], ["shake", 41.5, 43.4, 0.04]] },
  ] },
  { id: "farm2", o: FARM2, tracks: [
    { a: 4.4, b: 5.2, pos: walk(4.4, 5.2, -3.0, -1.2, -1.9, -0.1), faces: [[4.4, "sly", "down"]] },
    { a: 5.2, b: 6.9, idle: true, pos: stay(-1.9, -0.1), faces: [[5.2, "sly", "dig"]] },   // he shovels the trampled soil
    { a: 40.12, b: 43.52, idle: true, pos: stay(OF - 1.3, -0.6), faces: [[40.12, "furious", "cheerc"], [41.5, "furious", "fist"]], beats: [["hop", 40.5, 40.8, 0.14], ["hop", 41.0, 41.3, 0.14]] },
  ] },
  { id: "parl1", o: PARL1, tracks: [{ a: 31.34, b: 34.38, idle: true, pos: stay(OE - 0.6, -0.5), faces: [[31.34, "calm", "down"], [32.72, "grin", "laugh"]], beats: [["hop", 32.9, 33.2, 0.06], ["hop", 33.5, 33.8, 0.06]] }] },
  { id: "parl2", o: PARL2, tracks: [{ a: 31.34, b: 34.38, idle: true, pos: stay(OE + 0.7, -0.7), faces: [[31.34, "sleepy", "pointc"], [32.9, "grin", "clap"]], beats: [["hop", 33.8, 34.1, 0.08]] }] },
];

// ---------- the emus ---------------------------------------------------------------------------------------------------------------------
type Spec = { x: number; z: number; yaw: number; ph: number; s: number };
const mob = (n: number, seed: number, x0: number, x1: number, z0: number, z1: number, yaw0 = Math.PI): Spec[] =>
  Array.from({ length: n }, (_, i) => ({ x: lerp(x0, x1, rnd(seed + i)), z: lerp(z0, z1, rnd(seed + i + 40)), yaw: yaw0 + (rnd(seed + i + 80) - 0.5) * 1.8, ph: rnd(seed + i + 120) * 6.28, s: 0.92 + 0.16 * rnd(seed + i + 160) }));
/** An emu running away from `from` at `t0`: it zigzags a little, the direction spread over `spread` radians. */
const flee = (e: Spec, t: number, t0: number, from: [number, number], speed: number, spread: number, seed: number) => {
  const a = Math.atan2(e.z - from[1], e.x - from[0]) + (rnd(seed) - 0.5) * spread;
  const dt = Math.max(0, t - t0), sp = speed * (0.85 + 0.3 * rnd(seed + 7));
  const zig = Math.sin(dt * 4 + seed) * 0.5 * Math.min(1, dt);
  return { x: e.x + Math.cos(a) * sp * dt - Math.sin(a) * zig, z: e.z + Math.sin(a) * sp * dt + Math.cos(a) * zig, yaw: dt > 0 ? -a : e.yaw };
};
const MOB_A = mob(22, 10, -4, 10, -9, -17);
const MOB_B = mob(10, 200, OB + 8, OB + 13, -2, -6);
const MOB_C = Array.from({ length: 8 }, (_, j) => ({ z: -1.2 - 0.45 * (j % 3), ph: j * 1.3 }));
const MOB_G = mob(13, 300, OG - 5, OG + 5, -3.5, -8, 0);
const MOB_A2 = mob(12, 400, -6, 6, -6, -9.5, Math.PI / 2);
const MOB_X = mob(4, 500, OD + 3, OD + 8, -5, -9, Math.PI);
const MOB_F = mob(3, 600, OF - 7, OF + 3, -9, -12, Math.PI);
const GUN0: [number, number] = [0.75, 0.9];

type EmuMode = "graze" | "walk" | "run" | "stand" | "alert";
const featherTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#86694a"; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 150; i++) { c.fillStyle = `rgba(${rnd(i) > 0.5 ? "50,34,20" : "190,160,120"},.4)`; c.fillRect(rnd(i * 3) * 128, rnd(i * 7) * 128, 2 + rnd(i * 5) * 3, 8 + rnd(i * 11) * 22); }
};
const Emu: React.FC<{ x: number; y?: number; z: number; yaw: number; mode: EmuMode; f: number; ph: number; s?: number; head?: number; neck?: number; shadow?: THREE.Texture; fur?: THREE.Texture }> =
  ({ x, y = 0, z, yaw, mode, f, ph, s = 1, head = 0, neck, shadow, fur }) => {
    const run = mode === "run", wk = mode === "walk";
    const cyc = run ? f * 0.95 + ph : f * 0.3 + ph;
    const sw = run ? Math.sin(cyc) * 0.95 : wk ? Math.sin(cyc) * 0.4 : 0;
    const bob = run ? Math.abs(Math.sin(cyc)) * 0.08 : wk ? Math.abs(Math.sin(cyc)) * 0.015 : 0;
    const tilt = neck !== undefined ? neck : mode === "graze" ? 1.1 + 1.0 * (0.5 + 0.5 * Math.sin(f * 0.07 + ph * 3)) : run ? 0.75 : mode === "alert" ? -0.05 : 0.18;
    const sway = mode === "alert" ? 0.03 * Math.sin(f * 0.2 + ph) : 0.07 * Math.sin(f * 0.11 + ph * 2) + (wk ? 0.1 * Math.sin(cyc) : run ? 0.12 * Math.sin(cyc * 2) : 0);   // the neck swings, the head pecks
    const nl = mode === "alert" ? 0.8 : 0.62;
    const flap = run ? Math.sin(cyc * 2) * 0.7 : 0.08 * Math.sin(f * 0.2 + ph);
    const fm = { map: fur, roughness: 0.95 } as const;
    return (
      <group position={[x, y, z]} rotation={[0, yaw, 0]} scale={s}>
        <group position={[0, bob, 0]} rotation={[0, 0, run ? -0.12 : 0]}>
          <mesh position={[0, 0.95, 0]} scale={[0.66, 0.4, 0.36]}><sphereGeometry args={[1, 18, 14]} /><meshStandardMaterial {...fm} color="#c19c72" /></mesh>
          <mesh position={[-0.4, 0.98, 0]} scale={[0.42, 0.36, 0.4]}><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial {...fm} color="#7d6248" /></mesh>
          <mesh position={[-0.55, 0.78, 0]} scale={[0.2, 0.3, 0.3]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial {...fm} color="#6a5038" /></mesh>
          <mesh position={[0.3, 1.1, 0]} scale={[0.32, 0.24, 0.3]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial {...fm} color="#b09070" /></mesh>
          <mesh position={[0.1, 0.78, 0]} scale={[0.5, 0.22, 0.3]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial {...fm} color="#d6b98f" /></mesh>
          {[[-0.2, 1.22, 0.14, 0.22], [0.15, 1.28, -0.12, 0.2], [-0.45, 1.12, -0.16, 0.2], [0.45, 0.98, 0.2, 0.17], [-0.05, 0.72, -0.18, 0.2], [0.35, 0.82, -0.2, 0.16]].map(([fx, fy, fz, r], i) => <mesh key={i} position={[fx, fy, fz]} scale={[1.2, 0.8, 0.9]} rotation={[0, 0, 0.4 * (i % 3 - 1)]}><sphereGeometry args={[r, 8, 6]} /><meshStandardMaterial {...fm} color={i % 2 ? "#9a7a58" : "#6f573d"} /></mesh>)}
          {[1, -1].map((side) => <group key={side} position={[0.05, 1.0, side * 0.33]} rotation={[side * flap, 0, 0]}><mesh position={[-0.05, -0.08, side * 0.02]} scale={[0.3, 0.2, 0.05]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial {...fm} color="#5b4630" /></mesh></group>)}
          <group position={[0.46, 1.02, 0]} rotation={[0, head + sway, -tilt]}>
            <mesh position={[0, nl / 2, 0]}><cylinderGeometry args={[0.062, 0.095, nl, 10]} /><meshStandardMaterial color="#9db3c4" roughness={0.8} /></mesh>
            <mesh position={[0, 0.06, 0]}><sphereGeometry args={[0.12, 10, 8]} /><meshStandardMaterial {...fm} color="#a8896a" /></mesh>
            <mesh position={[0.03, nl + 0.04, 0]} scale={[1.5, 1, 1]}><sphereGeometry args={[0.095, 12, 10]} /><meshStandardMaterial color="#9db3c4" roughness={0.8} /></mesh>
            <mesh position={[0.2, nl + 0.03, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.05, 0.17, 8]} /><meshStandardMaterial color="#3a3330" roughness={0.6} /></mesh>
            {[1, -1].map((side) => <group key={side} position={[0.07, nl + 0.09, side * 0.07]}><mesh><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color="#f4ead0" /></mesh><mesh position={[0.016, 0, side * 0.018]}><sphereGeometry args={[0.02, 6, 6]} /><meshBasicMaterial color="#17141c" /></mesh></group>)}
          </group>
        </group>
        {[0.11, -0.11].map((zz, k) => {
          const a = k ? -sw : sw, knee = Math.max(0, -a) * 0.9 + (run ? 0.15 : 0.05);
          return (
            <group key={k} position={[0, 0.88, zz]} rotation={[0, 0, a]}>
              <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[0.1, 0.07, 0.4, 8]} /><meshStandardMaterial {...fm} color="#a88b68" /></mesh>
              <group position={[0, -0.4, 0]} rotation={[0, 0, -knee - a * 0.5]}>
                <mesh position={[0, -0.24, 0]}><cylinderGeometry args={[0.04, 0.055, 0.48, 8]} /><meshStandardMaterial color="#c9b8a2" roughness={0.8} /></mesh>
                <mesh position={[0, -0.49, 0]}><sphereGeometry args={[0.06, 8, 6]} /><meshStandardMaterial color="#b3a28a" roughness={0.8} /></mesh>
                {[-0.05, 0, 0.05].map((tz, j) => <mesh key={j} position={[0.1, -0.5, tz]} rotation={[0, (j - 1) * 0.35, 0]}><boxGeometry args={[0.2, 0.04, 0.045]} /><meshStandardMaterial color="#7d6e5c" roughness={0.8} /></mesh>)}
              </group>
            </group>
          );
        })}
        {shadow && <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.3, 0.9]} /><meshBasicMaterial map={shadow} transparent opacity={0.4} depthWrite={false} /></mesh>}
      </group>
    );
  };

// ---------- props ------------------------------------------------------------------------------------------------------------------------
const Gun: React.FC<{ x: number; y?: number; z: number; yaw: number; f: number; fire?: boolean; flash: THREE.Texture; s?: number; held?: boolean }> = ({ x, y = 0, z, yaw, f, fire = false, flash, s = 1, held = false }) => (
  <group position={[x, y, z]} rotation={[0, yaw, 0]} scale={s}>
    {held && <><TBox size={[0.06, 0.2, 0.06]} pos={[0.0, 0.5, 0]} color="#2a2d27" /><TBox size={[0.32, 0.1, 0.07]} pos={[-0.3, 0.62, 0]} color="#5a4630" /><TBox size={[0.2, 0.14, 0.12]} pos={[0.1, 0.5, 0.09]} color="#4b5033" /></>}
    {!held && ([[0, 0.3, 0.18, 0.5, 0, 0], [0, 0.3, -0.18, -0.5, 0, 0], [-0.22, 0.3, 0, 0, 0, 0.5]] as number[][]).map((l, i) => <mesh key={i} position={[l[0], l[1], l[2]]} rotation={[l[3], l[4], l[5]]}><cylinderGeometry args={[0.02, 0.02, 0.66, 6]} /><meshStandardMaterial color="#3a3d36" roughness={0.6} /></mesh>)}
    <TBox size={[0.5, 0.12, 0.1]} pos={[0.1, 0.62, 0]} color="#2c302a" rough={0.5} />
    <mesh position={[0.56, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.72, 12]} /><meshStandardMaterial color="#454a44" roughness={0.4} metalness={0.5} /></mesh>
    <mesh position={[0.1, 0.77, 0]}><cylinderGeometry args={[0.13, 0.13, 0.05, 20]} /><meshStandardMaterial color="#34382f" roughness={0.5} /></mesh>
    {fire && <sprite position={[1.0, 0.62, 0]} scale={[0.6 + 0.35 * rnd(Math.floor(f / 2)), 0.6 + 0.35 * rnd(Math.floor(f / 2) + 9), 1]}><spriteMaterial map={flash} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></sprite>}
  </group>
);

/** a shovel held at `x,y,z` by the top hand; `deg` is the handle's angle from hanging down toward the way the digger faces (rig.shovelDeg) */
const Shovel: React.FC<{ x: number; y: number; z: number; deg: number; side: number; loaded: boolean }> = ({ x, y, z, deg, side, loaded }) => (
  <group position={[x, y, z]} rotation={[0, 0, (side * deg * Math.PI) / 180]}>
    <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.022, 0.022, 1.2, 8]} /><meshStandardMaterial color="#8a6a3e" roughness={0.8} /></mesh>
    <TBox size={[0.05, 0.05, 0.22]} pos={[0, 0.2, 0]} color="#8a6a3e" />
    <TBox size={[0.04, 0.3, 0.24]} pos={[0, -1.12, 0]} color="#8d949a" rough={0.4} />
    {loaded && <mesh position={[0.05, -1.0, 0]} scale={[1, 0.55, 1]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#5a3f28" roughness={1} /></mesh>}
  </group>
);

const Truck: React.FC<{ x: number; z: number; f: number; rolling: boolean; yaw?: number }> = ({ x, z, f, rolling, yaw = 0 }) => (
  <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
    <TBox size={[3.5, 0.18, 1.1]} pos={[0.3, 0.5, 0]} color="#2c3326" />
    <TBox size={[2.0, 0.3, 1.3]} pos={[-0.55, 0.7, 0]} color="#4f5e34" />
    {[0.62, -0.62].map((zz) => <TBox key={zz} size={[2.0, 0.42, 0.07]} pos={[-0.55, 1.06, zz]} color="#586a38" />)}
    <TBox size={[0.07, 0.42, 1.3]} pos={[-1.55, 1.06, 0]} color="#586a38" />
    <TBox size={[0.06, 0.42, 1.2]} pos={[0.45, 1.06, 0]} color="#586a38" />
    {[[-1.2, 0.2], [-0.8, -0.15], [-0.55, 0.25], [-0.2, -0.2], [-1.3, -0.3]].map(([sx, sz], i) => <mesh key={i} position={[sx, 0.95, sz]} scale={[0.3, 0.16, 0.2]} rotation={[0, i, 0]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={i % 2 ? "#b79b6a" : "#a98c5d"} roughness={1} /></mesh>)}
    <TBox size={[0.75, 1.0, 1.28]} pos={[0.85, 1.2, 0]} color="#5f6f3c" />
    <TBox size={[0.95, 0.08, 1.38]} pos={[0.9, 1.74, 0]} color="#4a5830" />
    <TBox size={[0.04, 0.5, 1.05]} pos={[1.23, 1.38, 0]} color="#a9d6ec" />
    {[0.65, -0.65].map((zz) => <TBox key={zz} size={[0.5, 0.42, 0.03]} pos={[0.85, 1.38, zz]} color="#a9d6ec" />)}
    <TBox size={[0.85, 0.5, 1.12]} pos={[1.65, 0.97, 0]} color="#566835" />
    <TBox size={[0.06, 0.34, 0.8]} pos={[2.1, 0.95, 0]} color="#22261e" />
    {[0.38, -0.38].map((zz) => <mesh key={zz} position={[2.1, 1.0, zz]}><sphereGeometry args={[0.1, 10, 8]} /><meshBasicMaterial color="#fff6c8" toneMapped={false} /></mesh>)}
    <TBox size={[0.14, 0.14, 1.35]} pos={[2.1, 0.55, 0]} color="#8a8f88" rough={0.4} />
    {[0.7, -0.7].map((zz) => <TBox key={zz} size={[0.9, 0.05, 0.22]} pos={[0.9, 0.55, zz]} color="#2c3326" />)}
    {[0.68, -0.68].map((zz) => <mesh key={zz} position={[-0.7, 0.4, zz + (zz > 0 ? 0.0 : 0)]}><boxGeometry args={[0.04, 0.0, 0.0]} /><meshBasicMaterial color="#000" /></mesh>)}
    <mesh position={[-1.7, 0.9, 0.35]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.14, 0.14, 0.34, 10]} /><meshStandardMaterial color="#6d7a3a" roughness={0.7} /></mesh>
    <group position={[-0.1, 0.92, 0.72]}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.22, 0.08, 8, 16]} /><meshStandardMaterial color="#1c1f20" roughness={0.9} /></mesh></group>
    {([[-1.0, 0.72], [1.25, 0.72], [-1.0, -0.72], [1.25, -0.72]] as number[][]).map(([wx, wz], i) => (
      <group key={i} position={[wx, 0.38, wz]}>
        <mesh><torusGeometry args={[0.27, 0.11, 10, 20]} /><meshStandardMaterial color="#1c1f20" roughness={0.95} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.2, 16]} /><meshStandardMaterial color="#a8a698" roughness={0.5} metalness={0.4} /></mesh>
        <group rotation={[0, 0, rolling ? -f * 0.4 : 0]} position={[0, 0, wz > 0 ? 0.11 : -0.11]}>
          <mesh><boxGeometry args={[0.38, 0.05, 0.03]} /><meshStandardMaterial color="#6e6d62" /></mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.38, 0.05, 0.03]} /><meshStandardMaterial color="#6e6d62" /></mesh>
        </group>
      </group>
    ))}
  </group>
);

const Puff: React.FC<{ x: number; y: number; z: number; t: number; at: number; dur?: number; size?: number; tex: THREE.Texture; color?: string }> = ({ x, y, z, t, at, dur = 1.2, size = 0.7, tex, color = "#e8d6a8" }) => {
  const u = (t - at) / dur;
  if (u < 0 || u > 1) return null;
  return <sprite position={[x, y + u * 0.5, z]} scale={[size * (0.5 + u), size * (0.5 + u), 1]}><spriteMaterial map={tex} color={color} transparent opacity={0.55 * (1 - u)} depthWrite={false} /></sprite>;
};

const Medal: React.FC<{ x: number; y: number; z: number; f: number }> = ({ x, y, z, f }) => (
  <group position={[x, y, z]} rotation={[0, 0, 0.12 * Math.sin(f * 0.15)]}>
    <TBox size={[0.07, 0.3, 0.02]} pos={[-0.05, 0.2, 0]} color="#d33a3a" />
    <TBox size={[0.07, 0.3, 0.02]} pos={[0.05, 0.2, 0]} color="#2f5fd0" />
    <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.13, 0.13, 0.03, 20]} /><meshStandardMaterial color="#f2c230" roughness={0.25} metalness={0.7} emissive="#7a5a10" emissiveIntensity={0.5} /></mesh>
  </group>
);

// ---------- painted textures ------------------------------------------------------------------------------------------------------------
const groundTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#d3a954"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${rnd(i) > 0.5 ? "255,226,140" : "120,84,30"},.14)`; c.fillRect(rnd(i * 3) * 256, rnd(i * 7) * 256, 1 + rnd(i * 5) * 1.5, 8 + rnd(i * 11) * 26); }
};
const roofTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#b9bfc4"; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "rgba(60,70,80,.35)"; for (let x = 0; x < 128; x += 16) c.fillRect(x, 0, 5, 128);
  c.fillStyle = "rgba(150,70,30,.25)"; for (let i = 0; i < 14; i++) c.fillRect(rnd(i) * 128, rnd(i * 3) * 128, 12, 6);
};
const woodTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#9a7448"; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "rgba(60,36,14,.3)"; for (let y = 0; y < 128; y += 21) c.fillRect(0, y, 128, 3);
};
const paperTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#efe6cf"; c.fillRect(0, 0, 256, 320);
  c.fillStyle = "#17141c"; c.font = "900 60px Arial Black, Arial"; c.textAlign = "center"; c.fillText("PERANG", 128, 78); c.fillText("EMU", 128, 140);
  c.fillRect(20, 160, 216, 6); c.fillStyle = "#7a7468";
  for (let y = 190; y < 300; y += 16) c.fillRect(20, y, 90 + rnd(y) * 120, 7);
  c.fillStyle = "#a9a290"; c.fillRect(150, 188, 86, 60);
};
const boardTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#2e5a46"; c.fillRect(0, 0, 256, 192);
  c.strokeStyle = "#e9e6d8"; c.lineWidth = 6; c.strokeRect(6, 6, 244, 180);
  c.fillStyle = "#f3f0e0"; c.font = "900 42px Arial Black, Arial"; c.textAlign = "left"; c.fillText("EMU", 22, 76); c.fillText("TENTARA", 22, 150);
  c.fillRect(20, 96, 216, 4);
};
const tickTex = (c: CanvasRenderingContext2D) => { c.clearRect(0, 0, 64, 64); c.fillStyle = "#ffe066"; c.font = "900 56px Arial Black, Arial"; c.textAlign = "center"; c.fillText("✓", 32, 52); };
const bangTex = (c: CanvasRenderingContext2D) => {
  c.clearRect(0, 0, 128, 160); c.fillStyle = "#ffdd33"; c.strokeStyle = "#17141c"; c.lineWidth = 10;
  c.font = "900 150px Arial Black, Arial"; c.textAlign = "center"; c.strokeText("!", 64, 140); c.fillText("!", 64, 140);
};
const flashTex = (c: CanvasRenderingContext2D) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,250,200,1)"); g.addColorStop(0.3, "rgba(255,200,80,.85)"); g.addColorStop(1, "rgba(255,150,40,0)"); c.fillStyle = g; c.fillRect(0, 0, 128, 128); };
const softTex = (c: CanvasRenderingContext2D) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); };
const blobTex = (c: CanvasRenderingContext2D) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(0,0,0,.9)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); };

const Stalks: React.FC<{ n: number; x0: number; x1: number; z0: number; z1: number; seed: number; color: string; h?: number }> = ({ n, x0, x1, z0, z1, seed, color, h = 0.55 }) => {
  const stem = React.useRef<THREE.InstancedMesh>(null);
  const ear = React.useRef<THREE.InstancedMesh>(null);
  React.useLayoutEffect(() => {
    const d = new THREE.Object3D(), e = new THREE.Object3D(), c = new THREE.Color(), base = new THREE.Color(color), light = new THREE.Color("#f0d27a"), dark = new THREE.Color("#a97a28");
    for (let i = 0; i < n; i++) {
      const s = 0.75 + 0.5 * rnd(seed + i + 1700), rx = (rnd(seed + i + 900) - 0.5) * 0.25, rz = (rnd(seed + i + 1300) - 0.5) * 0.25;
      d.position.set(lerp(x0, x1, rnd(seed + i)), (h * s) / 2, lerp(z0, z1, rnd(seed + i + 500)));
      d.rotation.set(rx, 0, rz); d.scale.set(1, s, 1); d.updateMatrix();
      stem.current!.setMatrixAt(i, d.matrix);
      // the ear sits on the tip of the tilted stem
      e.position.set(d.position.x - Math.sin(rz) * (h * s) / 2, d.position.y + Math.cos(rx) * Math.cos(rz) * (h * s) / 2, d.position.z + Math.sin(rx) * (h * s) / 2);
      e.rotation.set(rx, 0, rz); e.scale.set(1, 1, 1); e.updateMatrix();
      ear.current!.setMatrixAt(i, e.matrix);
      const k = rnd(seed + i + 2100);
      c.copy(base).lerp(k > 0.5 ? light : dark, Math.abs(k - 0.5) * 0.9);
      stem.current!.setColorAt(i, c); ear.current!.setColorAt(i, c);
    }
    for (const m of [stem.current!, ear.current!]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }, [n, x0, x1, z0, z1, seed, h, color]);
  return (
    <group>
      <instancedMesh ref={stem} args={[undefined, undefined, n]}><cylinderGeometry args={[0.005, 0.01, h, 4]} /><meshStandardMaterial color="#ffffff" roughness={0.9} /></instancedMesh>
      <instancedMesh ref={ear} args={[undefined, undefined, n]}><capsuleGeometry args={[0.011, 0.075, 3, 5]} /><meshStandardMaterial color="#ffffff" roughness={0.85} /></instancedMesh>
    </group>
  );
};

const Tree: React.FC<{ x: number; z: number; s?: number }> = ({ x, z, s = 1 }) => (
  <group position={[x, 0, z]} scale={s}>
    <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.14, 0.26, 2.8, 10]} /><meshStandardMaterial color="#b9aa8c" roughness={0.9} /></mesh>
    <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.3, 0.42, 0.24, 10]} /><meshStandardMaterial color="#a89a7c" roughness={0.95} /></mesh>
    {[[-0.5, 2.6, 0.3, 0.9], [0.55, 2.7, -0.2, -0.8]].map(([bx, by, bz, rz], i) => <mesh key={i} position={[bx, by, bz]} rotation={[0, 0, rz]}><cylinderGeometry args={[0.05, 0.1, 1.1, 6]} /><meshStandardMaterial color="#b0a184" roughness={0.9} /></mesh>)}
    {([[0, 3.4, 0, 1.15], [-0.9, 2.95, 0.3, 0.9], [0.9, 3.05, -0.2, 0.95], [-0.2, 3.0, 0.7, 0.8], [0.3, 3.7, -0.4, 0.7], [-1.4, 3.3, -0.3, 0.6]] as number[][]).map(([cx, cy, cz, r], i) => <mesh key={i} position={[cx, cy, cz]} scale={[1.4, 0.7, 1.1]}><sphereGeometry args={[r, 14, 10]} /><meshStandardMaterial color={["#68804a", "#7c8f55", "#5b7340", "#8a9a5c"][i % 4]} roughness={0.95} /></mesh>)}
  </group>
);
const Bush: React.FC<{ x: number; z: number; s?: number }> = ({ x, z, s = 1 }) => (
  <group position={[x, 0, z]} scale={s}>
    {([[0, 0.4, 0, 0.55], [0.5, 0.3, 0.1, 0.4], [-0.5, 0.32, -0.1, 0.45], [0.15, 0.62, -0.1, 0.35], [-0.2, 0.25, 0.4, 0.3], [0.7, 0.22, -0.2, 0.28]] as number[][]).map(([bx, by, bz, r], i) => <mesh key={i} position={[bx, by, bz]}><sphereGeometry args={[r, 10, 8]} /><meshStandardMaterial color={i === 1 ? "#6f8a4c" : "#58733d"} roughness={0.95} /></mesh>)}
  </group>
);
const Hills: React.FC<{ ox: number }> = ({ ox }) => (
  <group>{[-3, -2, -1, 0, 1, 2, 3].map((i) => <mesh key={i} position={[ox + i * 15, -1.4, -48 - 3 * rnd(i + 30)]} scale={[10 + 3 * rnd(i), 3 + 1.5 * rnd(i + 8), 4]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={i % 2 ? "#a3b08a" : "#91a47e"} roughness={1} /></mesh>)}</group>
);

/** A post-and-wire fence built post by post outward from the camera (the last shot). */
const Fence: React.FC<{ t: number; side: 1 | -1 }> = ({ t, side }) => {
  const N = 30, start = (i: number) => (i < 14 ? 55.98 + i * 0.07 : 56.98 + (i - 14) * 0.07);
  return (
    <group>
      {Array.from({ length: N }, (_, i) => {
        const k = prog(t, start(i), start(i) + 0.25), x = side * (3.3 + 1.1 * i);
        if (k <= 0) return null;
        return (
          <group key={i}>
            <TBox size={[0.12, 1.2 * k, 0.12]} pos={[x, 0.6 * k, -3.2]} color="#7a5632" />
            {i > 0 && [0.35, 0.7, 1.05].map((yy) => <TBox key={yy} size={[1.1 * k, 0.03, 0.03]} pos={[x - side * 0.55, yy, -3.2]} color="#c9ccd0" rough={0.3} />)}
          </group>
        );
      })}
    </group>
  );
};

const PILLS: Pill[] = [
  { at: 8.52, until: 10.4, text: "setinggi 1,5 m", key: "1,5 m", color: "#ff6b3d", y: 330 },
  { at: 12.02, until: 13.4, text: "2 senapan mesin", key: "2", color: "#ffb02e", y: 330 },
  { at: 24.18, until: 25.66, text: "emu 50 km/jam", key: "50 km/jam", color: "#ff6b3d", y: 330 },
  { at: 44.38, until: 46.6, text: "dikabarkan", key: "dikabarkan", color: "#ffb02e", y: 330 },
];
const HOOK_LINES: { text: string; key?: string }[] = [{ text: "Tentara lawan" }, { text: "burung ", key: "emu" }];
const READ = [...readWords(WORDS), { w: "Tiga", a: 58.62, b: 58.96 }];   // the first word comes back on the last 0.3 s so the loop holds
const STAGE_TIME: [number, number, number][] = [[OA, 0, 19.4], [OB, 19.38, 21.8], [OC, 21.78, 25.7], [OD, 25.68, 31.4], [OE, 31.34, 38.1], [OF, 38.04, 43.6], [OG, 43.52, 51.2]];

const World: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const tex = useMemo(() => ({ ground: painted(256, 256, groundTex, 130, 70), roof: painted(128, 128, roofTex), wood: painted(128, 128, woodTex), paper: painted(256, 320, paperTex), board: painted(256, 192, boardTex), tick: painted(64, 64, tickTex), bang: painted(128, 160, bangTex), flash: painted(128, 128, flashTex), soft: painted(64, 64, softTex), blob: painted(64, 64, blobTex), fur: painted(128, 128, featherTex) }), []);
  const on = (a: number, b: number) => t >= a - 0.6 && t <= b + 0.6;
  const pop = (t0: number) => { const s = t - t0; return s < 0 ? 0.001 : s < 0.35 ? 1 + 0.25 * Math.sin((s / 0.35) * Math.PI) : 1; };
  const emu = (key: string | number, x: number, z: number, yaw: number, mode: EmuMode, ph: number, s = 1, extra: { y?: number; head?: number; neck?: number } = {}) =>
    <Emu key={key} x={x} z={z} yaw={yaw} mode={mode} f={f} ph={ph} s={s} shadow={tex.blob} fur={tex.fur} {...extra} />;

  // stage A: the wheat field, the farm, the soldiers' place (hook, farm, mob, shooting, the end)
  const aEmus = MOB_A.map((e, i) => {
    if (t < 14.05) return emu(i, e.x + t * 0.2 * Math.cos(e.yaw), e.z - t * 0.2 * Math.sin(e.yaw), e.yaw, i % 3 === 0 ? "graze" : "walk", e.ph, e.s);
    const r = flee(e, t, 14.05 + 0.05 * (i % 4), GUN0, 7.5, 2.6, 40 + i);
    return emu(i, r.x, r.z, r.yaw, "run", e.ph, e.s);
  });
  const a2Emus = MOB_A2.map((e, i) => {
    const cheer = t >= 54.38 && t < 56;
    const mode: EmuMode = t >= 55.5 && i % 3 === 0 ? "walk" : "stand";
    return emu(i, e.x, e.z, e.yaw, mode, e.ph, e.s, { y: cheer ? Math.abs(Math.sin((t - 54.38) * 7 + i)) * 0.15 : 0, neck: cheer ? -0.1 : undefined });
  });
  const bEmus = MOB_B.map((e, i) => {
    if (t < 20.95) return emu(i, e.x, e.z, e.yaw, "graze", e.ph, e.s);
    const r = flee(e, t, 20.95 + 0.04 * i, [OB + 4, 1.5], 8, 1.4, 240 + i);
    return emu(i, r.x, r.z, r.yaw, "run", e.ph, e.s);
  });
  const cEmus = MOB_C.map((e, j) => emu(j, EMU_C(t, j), e.z, 0, "run", e.ph));
  const xEmus = MOB_X.map((e, i) => emu(i, e.x, e.z, e.yaw, "graze", e.ph, e.s));
  const gEmus = MOB_G.map((e, i) => {
    if (t >= 49.0) { const r = flee(e, t, 49.0 + 0.05 * i, [OG, -1], 7.5, 1.2, 340 + i); return emu(i, r.x, r.z, r.yaw, "run", e.ph, e.s); }
    const up = t >= 47.86 + 0.07 * i;                                                // the others raise their heads after the lookout's warning
    return emu(i, e.x, e.z, e.yaw, up ? "stand" : "graze", e.ph, e.s, { neck: up ? -0.05 : undefined });
  });
  const lookoutHead = Math.sin(t * 1.7) * 0.7 * (t < 47.5 ? 1 : 0.35);
  const tick = (i: number, t0: number) => t >= t0 ? <mesh key={i} position={[OE + 5.55 + 0.34 * i, 1.62, 0.07]} scale={pop(t0)}><planeGeometry args={[0.3, 0.3]} /><meshBasicMaterial map={tex.tick} transparent toneMapped={false} /></mesh> : null;
  const confetti = t >= 54.38 && t < 56.6 ? Array.from({ length: 36 }, (_, i) => {
    const dt = t - 54.38, a = rnd(i + 70) * 6.28, v = 1.6 + rnd(i + 90) * 2.2;
    const y = 1.6 + v * 0.8 * dt - 2.4 * dt * dt;
    return y > 0.05 ? <mesh key={i} position={[Math.cos(a) * v * dt * 0.6, y, -4 + Math.sin(a) * v * dt * 0.6]} rotation={[dt * 5 + i, dt * 4, 0]}><boxGeometry args={[0.07, 0.01, 0.04]} /><meshBasicMaterial color={["#ffdd33", "#ff6b3d", "#3fa7ff", "#5fd37a"][i % 4]} toneMapped={false} /></mesh> : null;
  }) : null;
  const newsK = prog(t, 31.34, 32.5);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[650, 320]} /><meshStandardMaterial map={tex.ground} roughness={1} /></mesh>
      <mesh position={[20, 17, -62]}><sphereGeometry args={[3, 16, 12]} /><meshBasicMaterial color="#fffbe0" toneMapped={false} /></mesh>
      {STAGE_TIME.filter(([o, a, b]) => on(a, b) || (o === OA && t >= 51.1)).map(([o]) => <Hills key={o} ox={o} />)}

      {/* stage A: field, farm, windmill, the truck that came for the soldiers, the long fence at the end */}
      {(t < 20 || t >= 51.1) && (
        <group>
          <Stalks n={2700} x0={-10} x1={10} z0={-4} z1={3.5} seed={1} color="#e0b84a" />
          <Stalks n={1500} x0={-10} x1={10} z0={-9} z1={-4} seed={7} color="#c99a30" h={0.5} />
          <group position={[-5, 0, -5.5]}>
            <TBox size={[2.6, 1.7, 1.8]} pos={[0, 0.85, 0]} color="#e9dcc0" />
            <TBox size={[3.0, 0.1, 2.2]} pos={[0, 2.0, 0]} map={tex.roof} tile={1} />
            <TBox size={[0.5, 1.1, 0.04]} pos={[0.5, 0.55, 0.92]} color="#6b4a2a" />
            <TBox size={[0.5, 0.5, 0.04]} pos={[-0.7, 1.0, 0.92]} color="#9fd0e8" />
            <TBox size={[0.3, 0.7, 0.3]} pos={[-0.9, 2.3, -0.3]} color="#8a8f95" />
          </group>
          <group position={[11, 0, -9]}>
            <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.2, 0.5, 4.4, 8]} /><meshStandardMaterial color="#b9bdc2" roughness={0.6} metalness={0.3} /></mesh>
            <group position={[0, 4.3, 0.35]} rotation={[0, 0, f * 0.06]}>{[0, 1, 2, 3, 4, 5].map((k) => <mesh key={k} rotation={[0, 0, (k * Math.PI) / 3]}><boxGeometry args={[0.28, 2.2, 0.03]} /><meshStandardMaterial color="#d9dde0" /></mesh>)}</group>
          </group>
          <Tree x={9} z={-9} s={1.1} />
          <Tree x={-9.5} z={-10} />
          <Bush x={-2} z={-8} />
          <Truck x={t >= 52.4 && t < 56.8 ? 6.5 + Math.max(0, t - 52.9) * 6 : 6.5} z={-2.2} f={f} rolling={t >= 52.9 && t < 56.8} />
          {t >= 51.1 && <mesh position={[3.2, 0.45, -5.5]} rotation={[Math.PI / 2, 0, 0.6]}><cylinderGeometry args={[0.45, 0.45, 0.9, 20]} /><meshStandardMaterial color="#e0bd55" roughness={1} /></mesh>}
          {aEmus}
          {t >= 51.1 && a2Emus}
          {t >= 54.0 && <Emu x={0} y={0.7} z={-4} yaw={Math.PI / 2} mode="stand" f={f} ph={1} s={1.05} neck={-0.05} shadow={tex.blob} fur={tex.fur} />}
          {t >= 54.0 && <Medal x={0.42} y={1.75} z={-3.9} f={f} />}
          {confetti}
          <Fence t={t} side={1} />
          <Fence t={t} side={-1} />
          {on(9.2, 11.4) && [0, 1, 2, 3, 4, 5].map((i) => <Puff key={i} x={3 + i * 0.6} y={0.2} z={-3.5 - i * 0.8} t={t} at={9.4 + i * 0.12} size={0.8} tex={tex.soft} />)}
          {t > 14.1 && t < 18 && MOB_A.map((e, i) => { const r = flee(e, t, 14.05 + 0.05 * (i % 4), GUN0, 7.5, 2.6, 40 + i); return i % 2 === 0 ? <Puff key={i} x={r.x - Math.cos(-r.yaw) * 0.8} y={0.25} z={r.z - Math.sin(-r.yaw) * 0.8} t={t} at={t - 0.01} dur={0.5} size={0.9} tex={tex.soft} /> : null; })}
        </group>
      )}

      {/* stage B: the water hole (the ambush) */}
      {on(19.38, 21.8) && (
        <group>
          <Stalks n={900} x0={OB - 2} x1={OB + 15} z0={-1} z1={5} seed={21} color="#c99a30" h={0.35} />
          <mesh position={[OB + 10, 0.015, -4.5]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.18, 0.72, 1]}><circleGeometry args={[5, 32]} /><meshStandardMaterial color="#8a6a3c" roughness={1} /></mesh>
          <mesh position={[OB + 10, 0.02, -4.5]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.6, 1]}><circleGeometry args={[5, 32]} /><meshStandardMaterial color="#4a9fc4" roughness={0.25} metalness={0.2} /></mesh>
          <Tree x={OB + 15} z={-9} s={1.2} /><Tree x={OB - 3} z={-8} />
          <Bush x={OB + 2.6} z={1.6} s={1.4} /><Bush x={OB + 5.6} z={2.0} s={1.2} /><Bush x={OB + 1} z={3} s={0.9} />
          <Puff x={OB + 4.7} y={0.8} z={1.2} t={t} at={20.6} dur={1.0} size={0.7} tex={tex.soft} color="#9a9a9a" />
          {bEmus}
        </group>
      )}

      {/* stage C: the chase lane */}
      {on(21.78, 25.7) && (
        <group>
          <Stalks n={2100} x0={OC - 4} x1={OC + 50} z0={-4} z1={3} seed={31} color="#c99a30" h={0.45} />
          <Truck x={TRUCK_C(t)} z={-1.5} f={f} rolling />
          {cEmus}
          {Array.from({ length: 10 }, (_, i) => <Puff key={i} x={TRUCK_C(Math.max(21.78, t - i * 0.12)) - 1.5} y={0.2} z={-1.5} t={t} at={t - 0.001} dur={0.4} size={0.8} tex={tex.soft} />)}
          {Array.from({ length: 8 }, (_, j) => <Puff key={`e${j}`} x={EMU_C(t, j) - 0.9} y={0.25} z={MOB_C[j].z} t={t} at={t - 0.001} dur={0.4} size={0.7} tex={tex.soft} />)}
        </group>
      )}

      {/* stage D: the shooting range (the bullet that only grazes) */}
      {on(25.68, 31.4) && (
        <group>
          <Stalks n={900} x0={OD - 6} x1={OD + 14} z0={-1} z1={5} seed={41} color="#e0b84a" h={0.35} />
          <TBox size={[0.4, 0.4, 0.4]} pos={[OD - 4.1, 0.2, 1.4]} color="#8a6a3c" />
          {t < 28.74 ? emu("hit", OD - 0.6, 0, Math.PI, "stand", 0.5, 1.1) : emu("hit", OD - 0.6 + (t - 28.74) * 7, 0, 0, "run", 0.5, 1.1)}
          {t >= HIT && t < HIT + 0.2 && <mesh position={[lerp(OD - 2.6, OD + 0.05, prog(t, HIT, HIT + 0.18)), 1.2, 0.06]}><boxGeometry args={[0.5, 0.025, 0.025]} /><meshBasicMaterial color="#fff4a0" toneMapped={false} /></mesh>}
          {t >= HIT + 0.18 && t < HIT + 0.55 && <sprite position={[OD + 0.1, 1.2, 0.2]} scale={[0.6 * (1 + (t - HIT) * 2), 0.6 * (1 + (t - HIT) * 2), 1]}><spriteMaterial map={tex.flash} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></sprite>}
          <Debris t={t} at={HIT + 0.18} pos={V(OD + 0.1, 1.15, 0.2)} n={10} speed={2.2} color="#ffd24a" seed={11} size={0.04} />
          {xEmus}
          <Tree x={OD + 9} z={-7} />
        </group>
      )}

      {/* stage E: parliament laughs, the emu gets the medal, the scoreboard */}
      {on(31.34, 38.1) && (
        <group>
          <TBox size={[1.7, 1.0, 0.7]} pos={[OE, 0.5, 0.3]} map={tex.wood} tile={0.7} />
          <TBox size={[1.9, 0.08, 0.8]} pos={[OE, 1.02, 0.3]} color="#6b4a2a" />
          <TBox size={[4.2, 2.6, 0.12]} pos={[OE, 1.3, -1.8]} color="#e9dcc0" />
          <TBox size={[4.2, 0.2, 0.2]} pos={[OE, 2.7, -1.75]} color="#8a6a3c" />
          <group position={[OE - 0.4 - 2 * (1 - newsK), 1.55 + 1.5 * (1 - newsK), 0.9 + 1.5 * (1 - newsK)]} rotation={[0, 0, (1 - newsK) * 7]}>
            <mesh><planeGeometry args={[0.9, 1.12]} /><meshBasicMaterial map={tex.paper} toneMapped={false} side={THREE.DoubleSide} /></mesh>
          </group>
          {emu("win", OE + 4.9, -0.6, -Math.PI / 2 + 0.25, "stand", 2, 1.1, { neck: -0.02, head: 0.3 })}
          {emu("e2", OE + 7.5, -4, 0, "graze", 3, 1)}
          {emu("e3", OE + 2, -5, Math.PI, "graze", 4, 0.95)}
          {t >= 34.7 && <Medal x={OE + 5.35} y={lerp(3.2, 1.38, ease(prog(t, 34.7, 35.1)))} z={-0.45} f={f} />}
          <TBox size={[0.08, 1.2, 0.08]} pos={[OE + 5.7, 0.6, 0]} color="#5a3b1f" />
          <TBox size={[0.08, 1.2, 0.08]} pos={[OE + 7.3, 0.6, 0]} color="#5a3b1f" />
          <group position={[OE + 6.5, 1.65, 0]}>
            <mesh><planeGeometry args={[1.6, 1.2]} /><meshBasicMaterial map={tex.board} toneMapped={false} /></mesh>
          </group>
          {[36.34, 36.82, 37.02].map((t0, i) => tick(i, t0))}
        </group>
      )}

      {/* stage F: the farm gate (the truck leaves and comes back) */}
      {on(38.04, 43.6) && (
        <group>
          <Stalks n={1500} x0={OF - 8} x1={OF + 26} z0={-3} z1={3} seed={51} color="#e0b84a" h={0.5} />
          <Truck x={TRUCK_F(t)} z={-0.2} f={f} rolling={t > 38.5} yaw={t >= 41.5 ? Math.PI : 0} />
          <TBox size={[0.18, 1.6, 0.18]} pos={[OF - 3.4, 0.8, -1.3]} color="#7a5632" />
          <TBox size={[0.18, 1.6, 0.18]} pos={[OF + 0.2, 0.8, -1.3]} color="#7a5632" />
          <TBox size={[3.6, 0.1, 0.1]} pos={[OF - 1.6, 1.5, -1.3]} color="#9a7448" />
          <Tree x={OF - 6} z={-8} s={1.1} />
          {MOB_F.map((e, i) => emu(i, e.x + (t - 38) * 0.2, e.z, e.yaw, "walk", e.ph, e.s))}
          {t >= 38.04 && t < 40.5 && Array.from({ length: 6 }, (_, i) => <Puff key={i} x={TRUCK_F(t) - 1.8 - i * 0.5} y={0.25} z={-0.2} t={t} at={t - 0.001} dur={0.5} size={0.9} tex={tex.soft} />)}
          {t >= 41.5 && Array.from({ length: 6 }, (_, i) => <Puff key={i} x={TRUCK_F(t) + 1.8 + i * 0.5} y={0.25} z={-0.2} t={t} at={t - 0.001} dur={0.5} size={0.9} tex={tex.soft} />)}
        </group>
      )}

      {/* stage G: the lookout's scrub (the twist) */}
      {on(43.52, 51.2) && (
        <group>
          <Stalks n={2700} x0={OG - 7} x1={OG + 8} z0={-9} z1={4} seed={61} color="#d6aa44" h={0.7} />
          <Bush x={OG - 4} z={-9.5} s={1.4} /><Bush x={OG + 4.5} z={-9.5} s={1.2} /><Tree x={OG + 9} z={-10} s={1.1} /><Tree x={OG - 9} z={-11} />
          <mesh position={[OG, 0.45, -1]}><coneGeometry args={[0.75, 0.9, 10]} /><meshStandardMaterial color="#b0825a" roughness={1} /></mesh>
          {emu("look", OG, -1, -Math.PI / 2 + 0.2, "alert", 0.5, 1.1, { y: 0.9, head: lookoutHead, neck: t >= 47.86 ? -0.08 : 0.05 })}
          {gEmus}
          {t >= 45.9 && t < 47.7 && <mesh position={[OG, 3.5 + 0.1 * Math.sin(f * 0.3), -1]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.18, 0.34, 3]} /><meshBasicMaterial color="#ffd23a" toneMapped={false} /></mesh>}
          {t >= 47.86 && t < 49.6 && <sprite position={[OG + 0.3, 3.6, -1]} scale={[0.7 * pop(47.86), 0.88 * pop(47.86), 1]}><spriteMaterial map={tex.bang} transparent toneMapped={false} depthWrite={false} /></sprite>}
        </group>
      )}
    </group>
  );
};

/** The sun follows the camera so the shadow map covers what is in view (the world is seven stages far apart). */
const Sun: React.FC<{ cam: { look: THREE.Vector3 } }> = ({ cam }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  const light = React.useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s: { scene: THREE.Scene }) => s.scene);
  React.useLayoutEffect(() => {
    target.position.copy(cam.look); target.updateMatrixWorld();
    light.current!.position.set(cam.look.x + 7, 11, cam.look.z + 5);
    scene.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.layers.isEnabled(CAST)) return;
      const mat = m.material as THREE.Material;
      m.receiveShadow = !mat.transparent;
      m.castShadow = !(m as unknown as THREE.InstancedMesh).isInstancedMesh && !mat.transparent && !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial;
    });
  });
  return (
    <>
      <directionalLight ref={light} target={target} intensity={1.9} color="#fff0cc" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={0.5} shadow-camera-far={45} shadow-bias={-0.0008} />
      <primitive object={target} />
    </>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = () => {
  const fr = useCurrentFrame();
  const t0 = fr / FPS;
  // the loop: from LOOP_AT the picture replays the first seconds (same scene, cast and camera as frame 0), a short flash hides the swap
  const LOOP_AT = 58.0;
  const t = t0 >= LOOP_AT ? t0 - LOOP_AT : t0;
  const f = Math.round(t * FPS);
  const flash = Math.max(0, 1 - Math.abs(t0 - LOOP_AT) / 0.14);
  let cam = camAt(SHOTS, t, TOTAL);
  cam = shake(cam, t, 14.05, 0.05, 3.4);
  cam = shake(cam, t, HIT + 0.18, 0.06, 0.5);
  const hookA = t0 >= LOOP_AT ? 1 : t0 < 4.0 ? 1 : t0 < 4.4 ? 1 - (t0 - 4.0) / 0.4 : 0;
  const actors = ACTORS.map((a) => {
    const s = stateOf(a, t, f);
    if (!s) return null;
    return <StickHero key={a.id} pos={V(s.x, s.y, s.z)} expr={s.expr} arms={s.arms} f={f} outfit={a.o} height={s.h} hop={s.hop} lean={s.lean} act={s.act} step={s.step} tilt={s.tilt} nod={s.nod} flip={s.flip} rig={s.rig} />;
  });
  const gunP = gunPose(t, f);
  const diggers = ACTORS.map((a) => {
    const s = stateOf(a, t, f);
    if (!s || s.prop !== "dig") return null;
    const side = s.flip ? -1 : 1, hd = handOffset(s.rig, "r", s.h), u = (t / 1.9) % 1;
    return <Shovel key={a.id} x={s.x + side * hd.x} y={s.y + hd.y} z={s.z + 0.05} deg={shovelDeg(t)} side={side} loaded={u > 0.4 && u < 0.84} />;
  });
  const flashT = useMemo(() => painted(128, 128, flashTex), []);
  return (
    <AbsoluteFill style={{ backgroundColor: SKY }}>
      <ThreeCanvas width={FRAME.width} height={FRAME.height} shadows camera={{ fov: 40, near: 0.05, far: 120, position: HOOK.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={[SKY]} />
        <fog attach="fog" args={["#cfe3ee", 16, 75]} />
        <hemisphereLight args={["#c6e3ff", "#c9a45a", 1.05]} />
        <Sun cam={cam} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={0.3} />
        <World t={t} f={f} />
        {actors}
        {diggers}
        {gunP && <Gun x={gunP.x} y={gunP.y} z={gunP.z} yaw={gunP.yaw} f={f} fire={gunP.fire} flash={flashT} held={gunP.held} s={gunP.s} />}
      </ThreeCanvas>
      <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: hookA }}>
        {HOOK_LINES.map((l) => (
          <div key={l.text} style={{ background: "#000", padding: "10px 34px", fontFamily: "Outfit, Arial Black, sans-serif", fontWeight: 900, fontSize: 118, color: "#fff", lineHeight: 1.05, whiteSpace: "nowrap" }}>
            {l.text}<span style={{ color: "#ffd447" }}>{l.key}</span>
          </div>
        ))}
      </div>
      <Pills pills={PILLS} t={t0} />
      <WordCaption words={READ} t={t0} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.85, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
