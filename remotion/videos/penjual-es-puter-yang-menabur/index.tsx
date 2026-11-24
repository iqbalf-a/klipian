/* Penjual Es Puter yang Menabur Garam ke Es Batunya (look ricks, B46 + B47 dongeng): a made-up story carried by one true fact. Pak Darto sprinkles salt on the ice of his
   es puter cart, his nephew Tono is sure it makes the ice melt, tries it without salt, and loses: salt lowers the freezing point of water, so ice and salt get far below 0 °C
   and the melting ice pulls heat out of the batter. The picture follows the voice (words.json from faster-whisper): one shot per sentence, one caption word at a time, pills on
   their word (B45), mouths move only on the three quoted lines (B46 n), the last shot flies back to the first shot's framing (the loop). The engine and the cast are the ricks kit;
   the world is a village corner: Pak Darto's cart (stage A) and Tono's bucket (stage B, nine metres to the right), the camera visits them. */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FRAME } from "../../src/tokens.ts";
import { CAST, RicksCamera, RicksPost, StickHero, TBox, Pills, WordCaption, camAt, painted, readWords, rnd, stepAt, V, type Arms, type Cam, type Expr, type Outfit, type Pill, type Shot } from "../../src/ricks/kit.tsx";
import { gesture, handOffset, poseAt, reach, type Pose } from "../../src/ricks/rig.ts";
import { choreoAt, locomote, type Choreo } from "../../src/ricks/choreo.ts";
import type { StoryT } from "../../src/schema.ts";
import storyJson from "./story.json";
import WORDS from "./words.json";

export const story = storyJson as unknown as StoryT;
const FPS = 30;
const TOTAL = 51.26;
const LOOP_AT = 50.56;
const SKY_A = "#bfe6f7", SKY_B = "#8fd3f2";
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const prog = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (u: number) => u * u * (3 - 2 * u);
const pop = (s: number) => (s < 0 ? 0.001 : s < 0.35 ? 1 + 0.25 * Math.sin((s / 0.35) * Math.PI) : 1);

// ---------- the shots: one per sentence (times are the first word of each sentence in words.json) ----------------------------------------------------
const OB = 9;   // stage B: Tono's bucket
const DX = -0.3;   // where Pak Darto stands, left of his cart
const C = (px: number, py: number, pz: number, lx: number, ly: number, lz: number): Cam => ({ pos: V(px, py, pz), look: V(lx, ly, lz) });
const HOOK = C(0.0, 1.3, 3.9, 0.05, 1.2, 0.2);
const SHOTS: Shot[] = [
  { from: 0, a: HOOK, b: C(0.05, 1.28, 3.5, 0.05, 1.22, 0.2) },                                              // Pak Darto menabur tiga genggam garam ke es
  { from: 3.36, a: C(2.4, 1.7, 7.4, 1.0, 1.1, 0), b: C(1.6, 1.5, 6.3, 0.9, 1.1, 0) },                       // Gerobak es puter, Pak Darto melotot (Tono walks in)
  { from: 5.16, a: C(2.9, 1.3, 3.9, 2.0, 1.3, 0.8), b: C(2.5, 1.3, 3.4, 1.8, 1.3, 0.8) },                    // Es kok digaramin, Pak? (Tono)
  { from: 6.9, a: C(-1.0, 1.3, 3.9, -0.3, 1.2, 0.6), b: C(-0.8, 1.3, 3.5, -0.3, 1.25, 0.6) },               // Pak Darto senyum saja
  { from: 8.66, a: C(-0.7, 1.35, 3.0, -0.3, 1.3, 0.7), b: C(-0.4, 1.4, 2.6, -0.3, 1.35, 0.7) },            // Katanya, garamnya buat dingin, bukan buat rasa
  { from: 12.68, a: C(2.8, 1.3, 3.7, 1.9, 1.25, 0.8), b: C(2.4, 1.3, 3.3, 1.9, 1.3, 0.8) },                  // Tono ngakak
  { from: 13.92, a: C(2.2, 1.3, 3.1, 1.8, 1.35, 0.8), b: C(2.0, 1.35, 2.7, 1.8, 1.4, 0.8) },               // Garam bikin es meleleh, Pak
  { from: 15.94, a: C(OB - 1.5, 1.4, 6.8, OB, 1.0, 0.4), b: C(OB - 0.6, 1.3, 5.6, OB + 0.2, 1.05, 0.4) },   // Tono bikin es puter sendiri, pakai es batu saja
  { from: 19.98, a: C(OB + 0.3, 1.0, 2.9, OB + 0.2, 0.95, 0.4), b: C(OB + 0.5, 1.05, 2.4, OB + 0.2, 1.0, 0.4) },  // Dia kocok setengah jam
  { from: 21.74, a: C(OB + 2.2, 1.2, 4.0, OB + 0.6, 1.2, 0.6), b: C(OB + 1.4, 1.25, 3.4, OB + 0.4, 1.25, 0.6) },   // Adonannya tetap cair, tangannya pegel
  { from: 24.94, a: C(2.5, 0.6, 4.5, 3.4, 3.2, -4), b: C(2.4, 0.7, 4.5, 3.0, 3.8, -4) },                    // Siang makin terik (the sun)
  { from: 26.42, a: C(0.9, 1.5, 2.6, 0.3, 0.95, 0.1), b: C(0.7, 1.45, 2.1, 0.3, 0.9, 0.1) },               // es batu Pak Darto meleleh jadi air
  { from: 28.36, a: C(OB + 0.6, 1.3, 3.6, OB + 0.5, 1.3, 0.7), b: C(OB + 0.2, 1.3, 3.1, OB + 0.4, 1.3, 0.7) },    // Tono menang, pikirnya
  { from: 29.78, a: C(0.0, 1.3, 2.3, 0.3, 1.05, 0.1), b: C(0.1, 1.25, 1.9, 0.3, 1.0, 0.1) },                // Tapi, tabung Pak Darto berkabut
  { from: 32.66, a: C(0.5, 1.4, 3.2, 0.2, 1.05, 0.1), b: C(0.4, 1.35, 2.7, 0.2, 1.08, 0.1) },               // Berderak, dan adonannya mengeras jadi es puter
  { from: 35.72, a: C(2.4, 1.3, 3.5, 1.9, 1.3, 0.8), b: C(2.1, 1.3, 3.0, 1.9, 1.35, 0.8) },                  // Tono melongo
  { from: 36.84, a: C(0.4, 1.4, 3.2, 0.2, 1.0, 0.1), b: C(0.35, 1.35, 2.7, 0.2, 1.02, 0.1) },            // Garam menurunkan titik beku air
  { from: 38.94, a: C(1.6, 1.4, 2.5, 1.0, 1.35, 0.4), b: C(1.45, 1.4, 2.1, 1.0, 1.4, 0.4) },              // Jadi, campuran es dan garam bisa sekitar minus 20 derajat
  { from: 43.18, a: C(0.5, 1.4, 3.1, 0.2, 1.0, 0.1), b: C(0.4, 1.35, 2.6, 0.2, 1.0, 0.1) },             // Es yang meleleh menyerap panas dari adonan
  { from: 45.62, a: C(0.3, 1.35, 3.0, 0.2, 1.02, 0.1), b: C(0.3, 1.3, 2.5, 0.2, 1.05, 0.1) },               // dan adonan pun membeku
  { from: 47.36, a: C(0.9, 1.5, 5.4, 0.5, 1.2, 0.4), b: HOOK },                                                    // Tono minta garam, lalu ikut menabur tiga genggam ke es (flies back to the hook framing: the loop)
];

// ---------- the people (every one their own outfit, B46 i; heads are always white) ---------------------------------------------------------------
const DARTO: Outfit = { shirt: "#2ba39a", stripe: "#e6fff8", pattern: "stripe", hair: "bald", hairColor: "#6b6b6b", mustache: true, body: "wide", nose: "big" };
const TONO: Outfit = { shirt: "#7b57d6", stripe: "#d7c9ff", pattern: "check", hat: "cap", hatColor: "#e2554a", glasses: true, nose: "dot" };
const IBU: Outfit = { shirt: "#e0517f", stripe: "#ffe3ee", pattern: "dots", hair: "bun", hairColor: "#2a1a14", blush: true, nose: "dot" };

type Beat = ["hop" | "shake", number, number, number];
const beatsAt = (beats: Beat[], t: number, ph = 0) => {
  let hop = 0;
  for (const [k, a, b, v] of beats) {
    if (t < a || t >= b) continue;
    const u = (t - a) / (b - a);
    if (k === "hop") hop += Math.sin(u * Math.PI) * v;
    else hop += Math.abs(Math.sin(t * 5.5 + ph)) * v * 1.2 * Math.min(1, u * 6, (1 - u) * 6);   // a shake is a stomping sway, never a twitch
  }
  return hop;
};
type Persona = { ph: number; bob: number; bobF: number; tilt: number; tiltF: number; nod: number; nodF: number; gest: number };
const PERSONA: Record<string, Persona> = {
  darto: { ph: 0.4, bob: 0.0, bobF: 0, tilt: 0.06, tiltF: 0.7, nod: 5, nodF: 1.1, gest: 0.8 },   // the seller: calm, slow, a nod for every thought
  tono: { ph: 2.6, bob: 0.03, bobF: 2.4, tilt: 0.12, tiltF: 1.6, nod: 9, nodF: 2.0, gest: 0.9 },    // the student: bounces on his toes, restless
  ibu: { ph: 4.1, bob: 0.0, bobF: 0, tilt: 0.05, tiltF: 0.8, nod: 4, nodF: 1.0, gest: 0 },
};
type Track = { ch?: Choreo; dir?: number; idle?: boolean; flip?: boolean; a: number; b: number; pos: (t: number) => [number, number]; faces: [number, Expr, string][]; beats?: Beat[]; h?: number };
const stay = (x: number, z: number) => (): [number, number] => [x, z];
const walk = (a: number, b: number, x0: number, z0: number, x1: number, z1: number) => (t: number): [number, number] => { const k = ease(prog(t, a, b)); return [lerp(x0, x1, k), lerp(z0, z1, k)]; };
/** B55: a track that walks along its own path gets planted feet (`locomote`); a path that goes left is built mirrored. */
const withGait = (tr: Track, kind: "walk" | "jog", lead = 0): Track => {
  const dir = Math.sign(tr.pos(tr.b - 0.01)[0] - tr.pos(tr.a)[0]) || 1;
  return { ...tr, flip: dir < 0, dir, ch: locomote((t) => dir * tr.pos(t)[0], tr.a, tr.b, kind, lead) };
};

// the three quoted lines (B46 n): only these words move a mouth
const TALK: Record<string, [number, number][]> = { tono: [[5.16, 6.62], [13.92, 15.5]], darto: [[9.44, 11.75]] };
const talkAt = (id: string, t: number) => {
  if (!(TALK[id] ?? []).some(([a, b]) => t >= a && t < b)) return 0;
  const w = WORDS.find((x) => t >= x.a - 0.02 && t < x.b + 0.05);
  return w ? 0.4 + 0.6 * Math.abs(Math.sin(t * 17)) : 0;
};

// ---------- the acted poses of this story: the salt toss and the crank ---------------------------------------------------------------------------
const TOSS_D = [1.5, 2.0, 2.5], TOSS_T = [49.66, 49.98, 50.3];
const bump = (u: number) => (u < -0.35 || u > 0.35 ? 0 : u < 0 ? 1 + u / 0.35 : 1 - u / 0.35);
const A8 = (lSh: number, lEl: number, rSh: number, rEl: number, x: Partial<Pose> = {}): Pose => ({ lSh, lEl, rSh, rEl, lHip: 8, lKn: 0, rHip: -8, rKn: 0, ...x });
const sprinklePose = (t: number, tosses: number[]): Pose => {
  const k = Math.max(...tosses.map((tt) => bump(t - tt)));
  return A8(55, -82, 62 + 50 * k, -62 + 58 * k, { lean: 4 * k });
};
const crankPose = (t: number): Pose => {
  const w = t * Math.PI * 2 * 1.7, q = reach("r", 400 + 38 * Math.cos(w), 585 + 38 * Math.sin(w), 8);
  return A8(55, -82, q.sh, q.el, { lean: 8 });
};
const custom = (name: string, t: number, tosses: number[]): Pose | null => (name === "sprinkle" ? sprinklePose(t, tosses) : name === "crank" ? crankPose(t) : null);

const ACTORS: { id: string; o: Outfit; tracks: Track[]; tosses?: number[] }[] = [
  { id: "darto", o: DARTO, tosses: TOSS_D, tracks: [
    { a: 0, b: 3.36, idle: true, pos: stay(DX, 0.8), faces: [[0, "calm", "sprinkle"]] },
    { a: 3.36, b: 5.16, idle: true, pos: stay(DX, 0.8), faces: [[3.36, "furious", "hips"]], beats: [["shake", 3.6, 5.1, 0.025]] },   // melotot
    { a: 5.16, b: 6.9, idle: true, pos: stay(DX, 0.8), faces: [[5.16, "puzzled", "hips"]] },
    { a: 6.9, b: 9.44, idle: true, pos: stay(DX, 0.8), faces: [[6.9, "grin", "belly"], [8.66, "calm", "hips"]] },   // senyum saja
    { a: 9.44, b: 12.68, idle: true, pos: stay(DX, 0.8), faces: [[9.44, "calm", "down"], [10.84, "calm", "pointc"], [11.72, "grin", "hips"]] },   // garamnya buat dingin, bukan buat rasa
    { a: 12.68, b: 15.94, idle: true, pos: stay(DX, 0.8), faces: [[12.68, "sly", "hips"], [13.92, "puzzled", "hips"]] },
    { a: 24.94, b: 29.78, idle: true, pos: stay(DX, 0.8), faces: [[24.94, "calm", "belly"], [26.42, "calm", "hips"]] },
    { a: 29.78, b: 35.72, idle: true, pos: stay(DX, 0.8), faces: [[29.78, "calm", "feedc"], [32.66, "calm", "hips"], [34.9, "grin", "cheerc"]] },
    { a: 35.72, b: 47.36, idle: true, pos: stay(DX, 0.8), faces: [[35.72, "grin", "hips"]] },
    { a: 47.36, b: LOOP_AT, idle: true, pos: stay(DX, 0.8), faces: [[47.36, "grin", "hips"]], beats: [["hop", 49.5, 49.8, 0.04]] },
  ] },
  { id: "tono", o: TONO, tosses: TOSS_T, tracks: [
    withGait({ a: 3.36, b: 5.0, pos: walk(3.36, 5.0, 5.3, 0.8, 1.9, 0.8), faces: [[3.36, "calm", "down"]] }, "walk", 0.2),
    { a: 5.0, b: 6.9, idle: true, flip: true, pos: stay(1.9, 0.8), faces: [[5.0, "shocked", "down"], [5.16, "puzzled", "pointc"]] },   // Es kok digaramin, Pak?
    { a: 6.9, b: 12.68, idle: true, flip: true, pos: stay(1.9, 0.8), faces: [[6.9, "puzzled", "hips"], [9.44, "puzzled", "shrug"], [11.72, "puzzled", "hips"]] },
    { a: 12.68, b: 13.92, idle: true, flip: true, pos: stay(1.9, 0.8), faces: [[12.68, "grin", "laugh"]], beats: [["hop", 12.8, 13.1, 0.1], ["hop", 13.3, 13.6, 0.1]] },   // ngakak
    { a: 13.92, b: 15.94, idle: true, flip: true, pos: stay(1.9, 0.8), faces: [[13.92, "sly", "pointc"]] },   // Garam bikin es meleleh, Pak!
    { a: 15.94, b: 19.98, idle: true, pos: stay(OB + 0.4, 0.9), faces: [[15.94, "sly", "hips"], [18.9, "calm", "hips"]] },
    { a: 19.98, b: 21.74, idle: true, pos: stay(OB + 0.4, 0.9), faces: [[19.98, "calm", "crank"]] },
    { a: 21.74, b: 24.94, idle: true, pos: stay(OB + 0.4, 0.9), faces: [[21.74, "sleepy", "crank"], [23.14, "sleepy", "shrug"]], beats: [["shake", 23.14, 24.6, 0.03]] },
    { a: 24.94, b: 28.36, idle: true, pos: stay(OB + 0.4, 0.9), faces: [[24.94, "calm", "crank"]] },
    { a: 28.36, b: 29.78, idle: true, pos: stay(OB + 0.4, 0.9), faces: [[28.36, "grin", "cheerc"]], beats: [["hop", 28.5, 28.8, 0.12], ["hop", 29.0, 29.3, 0.12]] },   // Tono menang, pikirnya
    { a: 35.72, b: 47.36, idle: true, flip: true, pos: stay(1.9, 0.8), faces: [[35.72, "shocked", "shrug"], [38.94, "puzzled", "hips"], [43.18, "shocked", "belly"]] },
    withGait({ a: 47.36, b: 48.7, pos: walk(47.36, 48.7, 1.9, 0.8, 1.35, 0.8), faces: [[47.36, "calm", "down"]] }, "walk"),
    { a: 48.7, b: LOOP_AT, idle: true, flip: true, pos: stay(1.35, 0.8), faces: [[48.7, "grin", "sprinkle"]] },   // asks for salt, then sprinkles three handfuls like Pak Darto
  ] },
  { id: "ibu", o: IBU, tracks: [
    withGait({ a: 5.16, b: 11.6, pos: walk(5.16, 11.6, 6.5, -1.9, -4.2, -1.9), faces: [[5.16, "calm", "down"]] }, "walk"),
    withGait({ a: 24.94, b: 32.0, pos: walk(24.94, 32.0, -5.0, -1.7, 4.6, -1.7), faces: [[24.94, "sleepy", "down"]] }, "walk"),
  ] },
];

type AState = { rig: Pose; x: number; y: number; z: number; flip: boolean; expr: Expr; arms: Arms; hop: number; lean: number; tilt: number; nod: number; h: number; talk: number };
const stateOf = (a: { id: string; tracks: Track[]; tosses?: number[] }, t: number): AState | null => {
  const tr = a.tracks.find((k) => t >= k.a && t < k.b);
  if (!tr) return null;
  const P = PERSONA[a.id] ?? PERSONA.darto;
  const [bx, z] = tr.pos(t), ch = tr.ch ? choreoAt(tr.ch, t, tr.h ?? 1.7) : null, x = ch ? (tr.dir ?? 1) * ch.x : bx;
  const [, expr, armName] = stepAt(tr.faces, t);
  const talk = talkAt(a.id, t);
  let rig = ch ? ch.pose : custom(armName, t, a.tosses ?? []) ?? poseAt(tr.faces.map(([ta, , ar]) => [ta, ar] as [number, string]), t, 0.28);
  if (!ch) rig = { ...rig, lHip: rig.lHip + 3 * Math.sin(t * 0.9 + P.ph), rHip: rig.rHip - 3 * Math.sin(t * 0.9 + P.ph) };
  if (!ch && talk > 0 && P.gest > 0 && (armName === "down" || armName === "belly" || armName === "hips" || armName === "pointc")) rig = gesture(rig, t, P.ph, P.gest);   // arms move with the quoted line
  return {
    rig, x, y: 0, z, flip: tr.flip ?? false, expr, arms: "down", h: tr.h ?? 1.7, talk,
    hop: beatsAt(tr.beats ?? [], t, P.ph) + (ch ? ch.hop : 0) + P.bob * Math.abs(Math.sin(t * P.bobF * Math.PI + P.ph)), lean: 0.006 * Math.sin(t * 1.3 + P.ph),
    tilt: P.tilt * 0.6 * Math.sin(t * P.tiltF + P.ph), nod: P.nod * 0.5 * Math.sin(t * P.nodF * 2 + P.ph * 2),
  };
};

// ---------- painted textures -----------------------------------------------------------------------------------------------------------------
const roadTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#b9a078"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(${rnd(i) > 0.5 ? "255,240,200" : "90,70,45"},.16)`; c.fillRect(rnd(i * 3) * 256, rnd(i * 7) * 256, 2 + rnd(i * 5) * 4, 2 + rnd(i * 11) * 4); }
};
const wallTex = (base: string) => (c: CanvasRenderingContext2D) => {
  c.fillStyle = base; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "rgba(255,255,255,.12)"; for (let y = 0; y < 128; y += 32) c.fillRect(0, y, 128, 3);
  c.fillStyle = "rgba(90,60,40,.18)"; for (let i = 0; i < 16; i++) c.fillRect(rnd(i + base.length) * 128, rnd(i * 3) * 128, 18, 9);
};
const roofTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#c2563a"; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "rgba(60,20,10,.35)"; for (let x = 0; x < 128; x += 16) c.fillRect(x, 0, 4, 128);
  c.fillStyle = "rgba(255,200,160,.18)"; for (let y = 0; y < 128; y += 20) c.fillRect(0, y, 128, 3);
};
const cartTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#e4a42c"; c.fillRect(0, 0, 256, 128);
  c.fillStyle = "#1f8f86"; c.fillRect(8, 8, 240, 112);
  c.fillStyle = "#fff6dc"; c.font = "900 56px Arial Black, Arial"; c.textAlign = "center"; c.fillText("ES PUTER", 128, 66);
  c.fillStyle = "#ffd447"; c.font = "900 24px Arial Black, Arial"; c.fillText("DINGIN SEGAR", 128, 102);
};
const sackTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#efe7d2"; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "#1f4fa8"; c.fillRect(0, 36, 128, 56);
  c.fillStyle = "#fff"; c.font = "900 30px Arial Black, Arial"; c.textAlign = "center"; c.fillText("GARAM", 64, 74);
};
const signTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#f4f0e0"; c.fillRect(0, 0, 256, 96);
  c.strokeStyle = "#c2392b"; c.lineWidth = 8; c.strokeRect(5, 5, 246, 86);
  c.fillStyle = "#c2392b"; c.font = "900 42px Arial Black, Arial"; c.textAlign = "center"; c.fillText("WARUNG BU TINA", 128, 62);
};
const softTex = (c: CanvasRenderingContext2D) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); };
const swirlTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#f6dfb4"; c.fillRect(0, 0, 64, 64);
  c.strokeStyle = "#e9c488"; c.lineWidth = 5; c.beginPath(); for (let a = 0; a < 18; a += 0.2) c.lineTo(32 + a * 1.6 * Math.cos(a), 32 + a * 1.6 * Math.sin(a)); c.stroke();
};

// ---------- props ----------------------------------------------------------------------------------------------------------------------------
const Puff: React.FC<{ x: number; y: number; z: number; t: number; at: number; dur?: number; size?: number; tex: THREE.Texture; color?: string; rise?: number }> = ({ x, y, z, t, at, dur = 1.2, size = 0.5, tex, color = "#ffffff", rise = 0.5 }) => {
  const u = (t - at) / dur;
  if (u < 0 || u > 1) return null;
  return <sprite position={[x, y + u * rise, z]} scale={[size * (0.5 + u), size * (0.5 + u), 1]}><spriteMaterial map={tex} color={color} transparent opacity={0.6 * (1 - u)} depthWrite={false} /></sprite>;
};
/** a stream of puffs: puff i of n is at its own point of a loop of `dur` seconds */
const streamAt = (t: number, i: number, n: number, dur: number) => t - ((t / dur + i / n) % 1) * dur;

const House: React.FC<{ x: number; z: number; w: number; h: number; wall: THREE.Texture; roof: THREE.Texture; door?: string }> = ({ x, z, w, h, wall, roof, door = "#6b4a2a" }) => (
  <group position={[x, 0, z]}>
    <TBox size={[w, h, 2.4]} pos={[0, h / 2, 0]} map={wall} tile={1.5} />
    <mesh position={[0, h + 0.3, 0.1]}><boxGeometry args={[w + 0.3, 0.6, 2.8]} /><meshStandardMaterial map={roof} roughness={0.9} /></mesh>
    <mesh position={[0, h + 0.62, 0.1]}><boxGeometry args={[w + 0.5, 0.1, 3.2]} /><meshStandardMaterial map={roof} roughness={0.9} /></mesh>
    <TBox size={[0.7, 1.5, 0.06]} pos={[-w * 0.2, 0.75, 1.23]} color={door} />
    <TBox size={[0.9, 0.7, 0.05]} pos={[w * 0.22, 1.25, 1.22]} color="#9fd0e8" emissive="#243746" />
    <TBox size={[1.0, 0.06, 0.1]} pos={[w * 0.22, 0.88, 1.27]} color="#f4f0e0" />
  </group>
);
const Banana: React.FC<{ x: number; z: number; s?: number; f: number; ph?: number }> = ({ x, z, s = 1, f, ph = 0 }) => (
  <group position={[x, 0, z]} scale={s}>
    <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.1, 0.16, 2.4, 8]} /><meshStandardMaterial color="#7e8a4a" roughness={0.9} /></mesh>
    {[0, 1, 2, 3, 4].map((k) => <mesh key={k} position={[Math.cos(k * 1.25) * 0.6, 2.4 + 0.1 * (k % 2), Math.sin(k * 1.25) * 0.6]} rotation={[0.5 * Math.sin(k * 1.25) + 0.05 * Math.sin(f * 0.1 + ph + k), -k * 1.25, 0.6 * Math.cos(k * 1.25) - 0.9]} scale={[1.7, 0.04, 0.5]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={k % 2 ? "#4f9a3a" : "#5fae44"} roughness={0.8} side={THREE.DoubleSide} /></mesh>)}
  </group>
);
const Chair: React.FC<{ x: number; z: number; yaw?: number; color?: string }> = ({ x, z, yaw = 0, color = "#d9473b" }) => (
  <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
    <TBox size={[0.42, 0.05, 0.42]} pos={[0, 0.42, 0]} color={color} />
    <TBox size={[0.42, 0.45, 0.05]} pos={[0, 0.68, -0.2]} color={color} />
    {[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([lx, lz], i) => <TBox key={i} size={[0.04, 0.4, 0.04]} pos={[lx, 0.2, lz]} color="#e8e8e8" />)}
  </group>
);
const Hen: React.FC<{ x: number; z: number; f: number; ph: number; yaw?: number; color?: string }> = ({ x, z, f, ph, yaw = 0, color = "#b5642a" }) => {
  const peck = Math.max(0, Math.sin(f * 0.35 + ph)), sx = 0.05 * Math.sin(f * 0.07 + ph * 2);
  return (
    <group position={[x + sx, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.24, 0]} scale={[0.9, 0.75, 0.6]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
      <group position={[0.17, 0.34 - 0.12 * peck, 0]} rotation={[0, 0, -0.7 * peck]}>
        <mesh position={[0.02, 0.06, 0]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
        <mesh position={[0.1, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.025, 0.07, 6]} /><meshStandardMaterial color="#f0a830" /></mesh>
        <mesh position={[0.02, 0.14, 0]}><boxGeometry args={[0.05, 0.05, 0.02]} /><meshStandardMaterial color="#d33a3a" /></mesh>
      </group>
      <mesh position={[-0.2, 0.32, 0]} rotation={[0, 0, 0.6]} scale={[0.5, 1, 0.3]}><sphereGeometry args={[0.1, 8, 6]} /><meshStandardMaterial color="#8a4a1e" roughness={0.9} /></mesh>
      {[0.05, -0.05].map((lz) => <TBox key={lz} size={[0.02, 0.14, 0.02]} pos={[0, 0.07, lz]} color="#f0a830" />)}
    </group>
  );
};
const Scooter: React.FC<{ x: number; z: number; f: number }> = ({ x, z, f }) => (
  <group position={[x, 0, z]}>
    <TBox size={[1.5, 0.3, 0.5]} pos={[0, 0.5, 0]} color="#c33a2e" />
    <TBox size={[0.55, 0.12, 0.42]} pos={[-0.1, 0.78, 0]} color="#22242a" />
    <TBox size={[0.08, 0.62, 0.08]} pos={[0.62, 0.8, 0]} color="#c9ccd0" />
    <TBox size={[0.08, 0.08, 0.7]} pos={[0.62, 1.1, 0]} color="#22242a" />
    {[0.62, -0.62].map((wx) => <mesh key={wx} position={[wx, 0.28, 0]} rotation={[0, 0, f * 0.5]}><torusGeometry args={[0.24, 0.07, 8, 16]} /><meshStandardMaterial color="#1c1f20" roughness={0.9} /></mesh>)}
  </group>
);

const Cart: React.FC<{ t: number; tex: { cart: THREE.Texture; soft: THREE.Texture; swirl: THREE.Texture } }> = ({ t, tex }) => {
  const melt = prog(t, 26.0, 29.4) * 0.6, crystals = TOSS_D.filter((s) => t > s + 0.5).length + (t > 49.8 ? 1 : 0) + (t > 50.1 ? 1 : 0);
  const frost = prog(t, 29.8, 34.4), lid = prog(t, 33.4, 34.0) * (1 - prog(t, 35.4, 35.9));
  const handle = (t >= 29.78 && t < 33.4) || (t >= 36 && t < 47) ? t * 5.2 : 0.3;
  return (
    <group position={[0.3, 0, 0]}>
      <TBox size={[1.7, 0.75, 0.9]} pos={[0, 0.55, 0]} map={tex.cart} tile={1.7} />
      <TBox size={[1.74, 0.07, 0.94]} pos={[0, 0.95, 0]} color="#e4a42c" />
      {[[-0.78, 0.4], [0.78, 0.4], [-0.78, -0.4], [0.78, -0.4]].map(([lx, lz], i) => <TBox key={i} size={[0.07, 0.4, 0.07]} pos={[lx, 0.2, lz]} color="#6b4a2a" />)}
      {[0.5, -0.5].map((zz) => <group key={zz} position={[-0.95, 0.4, zz]}><mesh><torusGeometry args={[0.36, 0.05, 8, 20]} /><meshStandardMaterial color="#2b2118" roughness={0.9} /></mesh>{[0, 1, 2].map((k) => <mesh key={k} rotation={[0, 0, (k * Math.PI) / 3]}><boxGeometry args={[0.72, 0.03, 0.03]} /><meshStandardMaterial color="#6b4a2a" /></mesh>)}</group>)}
      <TBox size={[0.5, 0.06, 0.06]} pos={[1.15, 0.7, 0]} color="#6b4a2a" />
      {/* the wooden tub with ice and brine */}
      <mesh position={[0, 1.18, 0]}><cylinderGeometry args={[0.46, 0.4, 0.46, 24, 1, true]} /><meshStandardMaterial color="#8a5a2e" roughness={0.85} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.14 + 0.06 * melt, 0]}><cylinderGeometry args={[0.43, 0.41, 0.2 + 0.18 * melt, 20]} /><meshStandardMaterial color={melt > 0.05 ? "#6fb7e0" : "#a8dcf5"} roughness={0.2} transparent opacity={0.9} /></mesh>
      {[[-0.22, 0.12, 0.3], [0.2, -0.1, 0.26], [0.0, 0.25, 0.22], [-0.05, -0.28, 0.24], [0.28, 0.2, 0.2]].map(([ix, iz, sz], i) => <mesh key={i} position={[ix, 1.3 + 0.05 * (i % 2) - 0.1 * melt, iz]} rotation={[0.2 * i, 0.5 * i, 0.1 * i]} scale={1 - 0.65 * melt}><boxGeometry args={[sz, sz, sz]} /><meshStandardMaterial color="#cdeffd" roughness={0.15} transparent opacity={0.82} /></mesh>)}
      {Array.from({ length: crystals * 7 }, (_, i) => <mesh key={i} position={[(rnd(i + 3) - 0.5) * 0.7, 1.4 + 0.05 * rnd(i + 9), (rnd(i + 7) - 0.5) * 0.6]} rotation={[rnd(i), rnd(i + 1), rnd(i + 2)]}><boxGeometry args={[0.035, 0.035, 0.035]} /><meshStandardMaterial color="#ffffff" roughness={0.4} /></mesh>)}
      {/* the steel drum in the middle, a crank on top */}
      <mesh position={[0, 1.38, 0]}><cylinderGeometry args={[0.17, 0.17, 0.5, 20]} /><meshStandardMaterial color={new THREE.Color("#c5d4dc").lerp(new THREE.Color("#f6fbff"), frost).getStyle()} roughness={0.35} metalness={0.15} /></mesh>
      <group position={[0, 1.66 + 0.25 * lid, 0]} rotation={[0, handle, 0]}><mesh><cylinderGeometry args={[0.18, 0.18, 0.04, 20]} /><meshStandardMaterial color="#9aa7ae" metalness={0.6} roughness={0.35} /></mesh><TBox size={[0.4, 0.04, 0.05]} pos={[0.14, 0.05, 0]} color="#6b4a2a" /></group>
      {lid > 0.5 && <mesh position={[0, 1.64, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.165, 20]} /><meshStandardMaterial map={tex.swirl} roughness={0.7} /></mesh>}
      {t >= 34.9 && t < 36.4 && <group position={[0.1, 1.86 + 0.08 * pop(t - 34.9), 0.3]} scale={pop(t - 34.9)}><mesh position={[0, -0.12, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.09, 0.22, 10]} /><meshStandardMaterial color="#d79a4a" roughness={0.8} /></mesh><mesh position={[0, 0.04, 0]}><sphereGeometry args={[0.11, 14, 12]} /><meshStandardMaterial color="#f6dfb4" roughness={0.7} /></mesh></group>}
      {t >= 29.8 && t < 36.4 && [0, 1, 2, 3, 4, 5].map((i) => <Puff key={i} x={(rnd(i) - 0.5) * 0.5} y={1.7} z={0.1 + (rnd(i + 5) - 0.5) * 0.4} t={t} at={streamAt(t, i, 6, 1.3)} dur={1.3} size={0.55} tex={tex.soft} color="#e4f5ff" rise={0.7} />)}
      {t >= 43.18 && t < 45.6 && [0, 1, 2, 3, 4, 5, 6].map((i) => { const u = (t * 0.55 + i / 7) % 1; return <mesh key={i} position={[lerp(0.0, i % 2 ? 0.34 : -0.34, u), 1.34 + 0.05 * Math.sin(u * 6), lerp(0.05, (rnd(i) - 0.5) * 0.3, u)]}><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color="#ff8a3d" toneMapped={false} /></mesh>; })}
    </group>
  );
};

/** A thermometer that pops in for the science beats: the red column drops from room temperature to minus 20 on the words. */
const Thermo: React.FC<{ t: number }> = ({ t }) => {
  if (t < 36.84 || t >= 47.3) return null;
  const col = lerp(1.0, 0.04, ease(prog(t, 38.4, 42.2)));
  return (
    <group position={[1.4, 0.0, 0.5]} scale={pop(t - 36.84)}>
      <TBox size={[0.2, 1.6, 0.06]} pos={[0, 1.0, 0]} color="#fffaf0" />
      <TBox size={[0.07, 1.3, 0.04]} pos={[0, 1.15, 0.04]} color="#d9e6ee" />
      <TBox size={[0.07, 1.3 * col, 0.05]} pos={[0, 0.5 + 0.65 * col, 0.05]} color="#ff4a3a" />
      <mesh position={[0, 0.46, 0.05]}><sphereGeometry args={[0.1, 14, 12]} /><meshStandardMaterial color="#ff4a3a" roughness={0.4} /></mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <TBox key={i} size={[0.1, 0.02, 0.03]} pos={[0.12, 0.62 + i * 0.19, 0.04]} color="#17141c" />)}
      <TBox size={[0.3, 0.05, 0.04]} pos={[0.2, 0.62 + 0.19, 0.05]} color="#4fb0ff" />
    </group>
  );
};

/** Tono's own bucket: plain ice, no salt, and a bowl of batter he cranks that stays liquid. */
const Bucket: React.FC<{ t: number; tex: { soft: THREE.Texture } }> = ({ t, tex }) => {
  const melt = prog(t, 16, 28), spin = t >= 19.98 && t < 29.78 ? t * Math.PI * 2 * 1.7 : 0;
  return (
    <group position={[OB, 0, 0.45]}>
      <TBox size={[0.9, 0.55, 0.7]} pos={[0, 0.28, 0]} color="#b98a52" />
      <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.36, 0.3, 0.6, 20, 1, true]} /><meshStandardMaterial color="#e24a3b" roughness={0.6} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.86, 0]}><cylinderGeometry args={[0.33, 0.29, 0.5 - 0.12 * melt, 18]} /><meshStandardMaterial color="#cdeffd" roughness={0.2} transparent opacity={0.85} /></mesh>
      {[[-0.12, 0.08], [0.1, -0.06], [0.0, 0.14]].map(([ix, iz], i) => <mesh key={i} position={[ix, 1.12 - 0.06 * melt, iz]} rotation={[0.3 * i, 0.6 * i, 0]} scale={1 - 0.45 * melt}><boxGeometry args={[0.2, 0.2, 0.2]} /><meshStandardMaterial color="#e2f6ff" roughness={0.15} transparent opacity={0.85} /></mesh>)}
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.15, 0.15, 0.36, 18]} /><meshStandardMaterial color="#c5d4dc" roughness={0.35} metalness={0.15} /></mesh>
      <group position={[0, 1.4, 0]} rotation={[0, spin, 0]}><TBox size={[0.46, 0.04, 0.05]} pos={[0.17, 0.02, 0]} color="#6b4a2a" /></group>
      <mesh position={[0, 1.395, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.145, 16]} /><meshStandardMaterial color="#f6efe0" roughness={0.3} /></mesh>
      {t >= 21.74 && t < 24.94 && [0, 1, 2].map((i) => <Puff key={i} x={(rnd(i) - 0.5) * 0.3} y={0.62} z={0.2} t={t} at={streamAt(t, i, 3, 0.9)} dur={0.9} size={0.25} tex={tex.soft} color="#aee0ff" rise={0.3} />)}
    </group>
  );
};

const Sun: React.FC<{ cam: { look: THREE.Vector3 }; hot: number }> = ({ cam, hot }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  const light = React.useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s: { scene: THREE.Scene }) => s.scene);
  React.useLayoutEffect(() => {
    target.position.copy(cam.look); target.updateMatrixWorld();
    light.current!.position.set(cam.look.x + 6, 10, cam.look.z + 6);
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
      <directionalLight ref={light} target={target} intensity={lerp(1.8, 2.6, hot)} color={hot > 0.5 ? "#fff4cf" : "#fff0cc"} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={0.5} shadow-camera-far={40} shadow-bias={-0.0008} />
      <primitive object={target} />
    </>
  );
};

const PILLS: Pill[] = [
  { at: 1.36, until: 2.95, text: "3 genggam garam", key: "3", color: "#ff6b3d", y: 1180 },
  { at: 20.84, until: 22.4, text: "30 menit", key: "30", color: "#ff6b3d", y: 330 },
  { at: 41.62, until: 44.2, text: "−20 °C", key: "−20 °C", color: "#4fb0ff", y: 330 },
  { at: 49.64, until: 50.5, text: "3 genggam garam", key: "3", color: "#ff6b3d", y: 1180 },
];
const HOOK_LINES: { text: string; key?: string }[] = [{ text: "Garam ke" }, { text: "es ", key: "batu" }];
const READ = [...readWords(WORDS), { w: "Pak", a: 50.92, b: 51.26 }];   // the first word comes back on the last 0.34 s so the loop holds

const World: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const tex = useMemo(() => ({
    road: painted(256, 256, roadTex, 120, 60), wallA: painted(128, 128, wallTex("#f0d9a8")), wallB: painted(128, 128, wallTex("#a7d3c2")), wallC: painted(128, 128, wallTex("#f2b8a2")), roof: painted(128, 128, roofTex),
    cart: painted(256, 128, cartTex), sack: painted(128, 128, sackTex), sign: painted(256, 96, signTex), soft: painted(64, 64, softTex), swirl: painted(64, 64, swirlTex),
  }), []);
  const scoot = (t0: number, t1: number, x0: number, x1: number) => (t >= t0 && t < t1 ? <Scooter x={lerp(x0, x1, (t - t0) / (t1 - t0))} z={-2.9} f={f} /> : null);
  const melt = prog(t, 26.0, 29.4);
  const handPos = (id: string, tt: number) => {
    const a = ACTORS.find((q) => q.id === id)!, s = stateOf(a, tt);
    if (!s) return V(0, 1, 0.8);
    const hd = handOffset(s.rig, "r", s.h), side = s.flip ? -1 : 1;
    return V(s.x + side * hd.x, s.y + hd.y, s.z + 0.05);
  };
  const grains = (tt: number, who: number, from: THREE.Vector3, to: THREE.Vector3) => {
    const u = (t - tt) / 0.55;
    if (u < 0 || u > 1) return null;
    return Array.from({ length: 12 }, (_, i) => {
      const k = Math.min(1, u * (0.85 + 0.3 * rnd(i + who)));
      return <mesh key={`${tt}-${i}`} position={[lerp(from.x, to.x, k) + (rnd(i) - 0.5) * 0.16 * k, lerp(from.y, to.y, k) + 0.45 * Math.sin(k * Math.PI) - (rnd(i + 3) - 0.5) * 0.05, lerp(from.z, to.z, k) + (rnd(i + 8) - 0.5) * 0.1]}><boxGeometry args={[0.025, 0.025, 0.025]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>;
    });
  };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[220, 120]} /><meshStandardMaterial map={tex.road} roughness={1} /></mesh>
      <mesh position={[0, 0.004, -2.4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[220, 2.4]} /><meshStandardMaterial color="#6f6a64" roughness={1} /></mesh>
      <mesh position={[2, 17, -52]}><sphereGeometry args={[3, 16, 12]} /><meshBasicMaterial color="#fffbe0" toneMapped={false} /></mesh>
      {/* a village corner: houses behind both stages, a warung, trees, chairs, hens */}
      <House x={-5} z={-6} w={3.2} h={2.4} wall={tex.wallA} roof={tex.roof} />
      <House x={-1.2} z={-6.4} w={3.6} h={2.6} wall={tex.wallB} roof={tex.roof} door="#2f6fa0" />
      <House x={3.2} z={-6} w={3.4} h={2.3} wall={tex.wallC} roof={tex.roof} />
      <House x={7.6} z={-6.2} w={3.6} h={2.5} wall={tex.wallB} roof={tex.roof} door="#7a2f2f" />
      <House x={11.6} z={-6} w={3.4} h={2.4} wall={tex.wallA} roof={tex.roof} />
      <House x={15.6} z={-6.3} w={3.4} h={2.6} wall={tex.wallC} roof={tex.roof} door="#2f6fa0" />
      <TBox size={[1.9, 0.7, 0.05]} pos={[3.2, 2.2, -4.7]} map={tex.sign} tile={1.9} />
      <Banana x={-3.2} z={-4.6} f={f} /><Banana x={5.4} z={-4.3} s={1.15} f={f} ph={2} /><Banana x={13.4} z={-4.5} f={f} ph={4} /><Banana x={-7} z={-4.8} s={0.9} f={f} ph={1} />
      <Chair x={4.4} z={-3.4} yaw={0.3} /><Chair x={5.0} z={-3.3} yaw={-0.2} color="#2f86d9" /><Chair x={12.6} z={-3.3} yaw={0.2} color="#e0a52c" />
      <Hen x={-2.2} z={1.8} f={f} ph={1} /><Hen x={-1.5} z={2.2} f={f} ph={3} yaw={Math.PI} color="#e8d6a8" /><Hen x={6.4} z={1.7} f={f} ph={5} yaw={0.4} /><Hen x={11.6} z={2.1} f={f} ph={2} color="#6b3f1c" />
      {/* the clothesline: clothes swing in the breeze (something besides the hero always moves) */}
      <TBox size={[0.06, 2.2, 0.06]} pos={[-2.6, 1.1, -3.6]} color="#6b4a2a" /><TBox size={[0.06, 2.2, 0.06]} pos={[0.4, 1.1, -3.6]} color="#6b4a2a" /><TBox size={[3.0, 0.02, 0.02]} pos={[-1.1, 2.1, -3.6]} color="#cfd2d6" />
      {([[-2.2, "#e24a6b"], [-1.6, "#3a86d9"], [-0.9, "#f2c230"], [-0.3, "#5fb35a"]] as [number, string][]).map(([cx, col], i) => <group key={i} position={[cx, 2.1, -3.6]} rotation={[0, 0, 0.12 * Math.sin(f * 0.09 + i * 1.7)]}><TBox size={[0.4, 0.55, 0.03]} pos={[0, -0.28, 0]} color={col} /></group>)}
      {scoot(3.6, 7.0, 10, -8)}{scoot(24.2, 27.4, -8, 12)}{scoot(36.9, 40.5, 12, -8)}
      {/* stage A: Pak Darto's cart, salt on a crate, a puddle under it that grows as the ice melts */}
      <Cart t={t} tex={tex} />
      <mesh position={[0.4, 0.01, 0.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.4 + 1.6 * melt, 0.8 + 0.8 * melt, 1]}><circleGeometry args={[0.7, 28]} /><meshStandardMaterial color="#5f564b" roughness={0.3} transparent opacity={0.3 + 0.55 * melt} /></mesh>
      <TBox size={[0.7, 0.45, 0.5]} pos={[-1.5, 0.23, 0.55]} color="#b98a52" />
      <TBox size={[0.5, 0.45, 0.28]} pos={[-1.5, 0.68, 0.55]} map={tex.sack} tile={0.5} />
      <TBox size={[0.4, 0.5, 0.4]} pos={[-2.2, 0.25, 0.1]} color="#c9ccd0" />
      {/* stage B: Tono's bucket, plain ice */}
      <Bucket t={t} tex={tex} />
      <Chair x={OB + 2.2} z={0.4} yaw={-0.4} color="#6b4fd0" />
      <Thermo t={t} />
      {TOSS_D.map((tt) => grains(tt + 0.05, 1, handPos("darto", tt + 0.05), V(0.15, 1.45, 0.1)))}
      {TOSS_T.map((tt) => grains(tt + 0.05, 2, handPos("tono", tt + 0.05), V(0.45, 1.45, 0.1)))}
      {t >= 24.94 && t < 27.5 && [0, 1, 2, 3, 4, 5].map((i) => <Puff key={i} x={0.3 + (rnd(i) - 0.5) * 0.7} y={1.5} z={0.1} t={t} at={25.0 + i * 0.35} dur={1.0} size={0.4} tex={tex.soft} color="#ffefc0" rise={0.35} />)}
    </group>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = () => {
  const fr = useCurrentFrame();
  const t0 = fr / FPS;
  const t = t0 >= LOOP_AT ? 0.04 : t0;   // from the cut the picture holds the first moment (the hook, full text), so the last frame equals the first and the loop is exact
  const f = Math.round(t * FPS);
  const flash = Math.max(0, 1 - Math.abs(t0 - LOOP_AT) / 0.14);
  const cam = camAt(SHOTS, t, TOTAL);
  const hot = prog(t, 24.94, 25.6) * (1 - prog(t, 47.3, 47.4));
  const sky = new THREE.Color(SKY_A).lerp(new THREE.Color(SKY_B), hot).getStyle();
  const hookA = t0 >= LOOP_AT ? 1 : t0 < 3.0 ? 1 : t0 < 3.36 ? 1 - (t0 - 3.0) / 0.36 : 0;
  const actors = ACTORS.map((a) => {
    const s = stateOf(a, t);
    if (!s) return null;
    return <StickHero key={a.id} pos={V(s.x, s.y, s.z)} expr={s.expr} arms={s.arms} f={f} outfit={a.o} height={s.h} hop={s.hop} lean={s.lean} tilt={s.tilt} nod={s.nod} flip={s.flip} rig={s.rig} talk={s.talk} />;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: sky }}>
      <ThreeCanvas width={FRAME.width} height={FRAME.height} shadows camera={{ fov: 40, near: 0.05, far: 120, position: HOOK.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={[sky]} />
        <fog attach="fog" args={[sky, 14, 60]} />
        <hemisphereLight args={["#c6e3ff", "#d8b878", lerp(1.0, 1.25, hot)]} />
        <Sun cam={cam} hot={hot} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={lerp(0.3, 0.5, hot)} />
        <World t={t} f={f} />
        {actors}
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
