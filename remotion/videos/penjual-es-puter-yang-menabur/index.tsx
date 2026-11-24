/* Penjual Es Puter yang Menabur Garam ke Es Batunya (look ricks, B46 + B47 dongeng): a made-up story carried by one true fact. Pak Darto sprinkles salt on the ice of his
   es puter cart, his nephew Tono is sure it makes the ice melt, tries it without salt, and loses: salt lowers the freezing point of water, so ice and salt get far below 0 °C
   and the melting ice pulls heat out of the batter. The picture follows the voice (words.json from faster-whisper): one shot per sentence, one caption word at a time, pills on
   their word (B45), mouths move only on the three quoted lines (B46 n), the last shot flies back to the first shot's framing (the loop).
   Revision 1 (ian, 2026-11-24, B58): people stand still when nothing is acted, both sellers stand BEHIND their cart or table (the world hides their legs, `RicksPost occlude`),
   the camera keeps the seller in frame, and the world is built like RicksClips3000's: rounded, textured, many-part objects (wood, plaster, tiles, metal, leaves), a sky, hills. */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FRAME } from "../../src/tokens.ts";
import { CAST, RicksCamera, RicksPost, StickHero, Pills, WordCaption, camAt, painted, readWords, rnd, stepAt, V, type Arms, type Cam, type Expr, type Outfit, type Pill, type Shot } from "../../src/ricks/kit.tsx";
import { handOffset, poseAt, reach, type Pose } from "../../src/ricks/rig.ts";
import { choreoAt, locomote, type Choreo } from "../../src/ricks/choreo.ts";
import type { StoryT } from "../../src/schema.ts";
import storyJson from "./story.json";
import WORDS from "./words.json";

export const story = storyJson as unknown as StoryT;
const FPS = 30;
const TOTAL = 51.26;
const LOOP_AT = 50.56;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const prog = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (u: number) => u * u * (3 - 2 * u);
const pop = (s: number) => (s < 0 ? 0.001 : s < 0.35 ? 1 + 0.25 * Math.sin((s / 0.35) * Math.PI) : 1);

// ---------- the layout: stage A is Pak Darto's cart, stage B (nine metres right) is Tono's table; a seller stands BEHIND it, 0.22 m left of the tub ------------
const OB = 9;
const DX = 0.0, TUB = 0.3, SZ = -0.62;   // Pak Darto's x, the tub's x relative to the seller, the seller's z (behind the cart, which stands at z 0)
const TOP = 0.34;                           // height of the cart's top: a seller's hips are at 0.54 m, so the cart hides everything below the waist
const TONO_A = 1.1;                        // where Tono stands at the cart: in front of it, facing left
const C = (px: number, py: number, pz: number, lx: number, ly: number, lz: number): Cam => ({ pos: V(px, py, pz), look: V(lx, ly, lz) });
const HOOK = C(0.1, 1.3, 3.5, 0.12, 1.28, -0.4);
// every shot keeps the seller (or Tono) whole in the 1.4 to 2 m the frame shows; none goes closer than 2.7 m
const SHOTS: Shot[] = [
  { from: 0, a: HOOK, b: C(0.1, 1.28, 3.15, 0.12, 1.26, -0.4) },                                                          // Pak Darto menabur tiga genggam garam ke es
  { from: 3.36, a: C(1.8, 1.0, 6.6, 0.7, 1.05, 0), b: C(1.4, 1.0, 5.4, 0.7, 1.1, 0) },                                      // Gerobak es puter, Pak Darto melotot (Tono walks in)
  { from: 5.16, a: C(1.9, 1.35, 3.6, 1.0, 1.3, 0.4), b: C(1.7, 1.35, 3.25, 1.0, 1.3, 0.4) },                               // Es kok digaramin, Pak? (Tono)
  { from: 6.9, a: C(0.9, 1.35, 3.4, 0.1, 1.25, -0.4), b: C(0.7, 1.35, 3.0, 0.1, 1.25, -0.4) },                              // Pak Darto senyum saja
  { from: 8.66, a: C(0.6, 1.35, 3.1, 0.1, 1.25, -0.4), b: C(0.4, 1.35, 2.8, 0.1, 1.25, -0.4) },                             // Katanya, garamnya buat dingin, bukan buat rasa
  { from: 12.68, a: C(2.0, 1.35, 3.5, 1.0, 1.3, 0.4), b: C(1.8, 1.35, 3.2, 1.0, 1.3, 0.4) },                               // Tono ngakak
  { from: 13.92, a: C(1.9, 1.35, 3.1, 1.0, 1.35, 0.4), b: C(1.7, 1.35, 2.8, 1.0, 1.35, 0.4) },                             // Garam bikin es meleleh, Pak
  { from: 15.94, a: C(OB + 1.5, 1.5, 6.0, OB + 0.1, 1.1, -0.3), b: C(OB + 0.8, 1.4, 5.0, OB + 0.1, 1.1, -0.3) },            // Tono bikin es puter sendiri, pakai es batu saja
  { from: 19.98, a: C(OB + 0.5, 1.3, 3.3, OB + 0.1, 1.2, -0.4), b: C(OB + 0.3, 1.3, 3.0, OB + 0.1, 1.2, -0.4) },            // Dia kocok setengah jam
  { from: 21.74, a: C(OB + 1.4, 1.3, 3.7, OB + 0.2, 1.1, -0.2), b: C(OB + 0.9, 1.3, 3.3, OB + 0.2, 1.1, -0.2) },            // Adonannya tetap cair, tangannya pegal
  { from: 24.94, a: C(2.5, 0.6, 4.5, 3.2, 2.3, -4), b: C(2.4, 0.7, 4.5, 3.0, 2.8, -4) },                                   // Siang makin terik (the sun)
  { from: 26.42, a: C(0.8, 1.3, 3.5, 0.15, 1.05, -0.2), b: C(0.6, 1.3, 3.1, 0.15, 1.05, -0.2) },                           // es batu Pak Darto meleleh jadi air
  { from: 28.36, a: C(OB + 0.8, 1.3, 3.7, OB + 0.1, 1.2, -0.3), b: C(OB + 0.4, 1.3, 3.3, OB + 0.1, 1.2, -0.3) },           // Tono menang, pikirnya
  { from: 29.78, a: C(0.5, 1.35, 3.3, 0.12, 1.15, -0.3), b: C(0.4, 1.3, 2.9, 0.12, 1.15, -0.3) },                          // Tapi, tabung Pak Darto berkabut
  { from: 32.66, a: C(0.6, 1.4, 3.4, 0.12, 1.15, -0.3), b: C(0.4, 1.35, 3.0, 0.12, 1.15, -0.3) },                          // Berderak, dan adonannya mengeras jadi es puter
  { from: 35.72, a: C(1.9, 1.35, 3.5, 1.0, 1.3, 0.4), b: C(1.7, 1.35, 3.1, 1.0, 1.3, 0.4) },                               // Tono melongo
  { from: 36.84, a: C(0.6, 1.4, 3.4, 0.12, 1.1, -0.3), b: C(0.4, 1.35, 3.0, 0.12, 1.1, -0.3) },                            // Garam menurunkan titik beku air
  { from: 38.94, a: C(-0.3, 1.4, 4.0, -0.35, 1.15, 0.0), b: C(-0.3, 1.4, 3.6, -0.3, 1.15, 0.0) },                            // Jadi, campuran es dan garam bisa sekitar minus 20 derajat (thermometer)
  { from: 43.18, a: C(0.6, 1.4, 3.4, 0.12, 1.1, -0.3), b: C(0.4, 1.35, 3.0, 0.12, 1.1, -0.3) },                            // Es yang meleleh menyerap panas dari adonan
  { from: 45.62, a: C(0.5, 1.35, 3.3, 0.12, 1.15, -0.3), b: C(0.4, 1.3, 2.9, 0.12, 1.15, -0.3) },                          // dan adonan pun membeku
  { from: 47.36, a: C(1.0, 1.4, 5.0, 0.55, 1.2, 0.1), b: C(0.7, 1.35, 4.1, 0.55, 1.2, 0.1) },                                                            // Tono minta garam, lalu ikut menabur tiga genggam ke es (flies back to the hook framing: the loop)
];

// ---------- the people (every one their own outfit, B46 i; heads are always white) ---------------------------------------------------------------
const DARTO: Outfit = { shirt: "#2ba39a", stripe: "#e6fff8", pattern: "stripe", hair: "bald", hairColor: "#6b6b6b", mustache: true, body: "wide", nose: "big" };
const TONO: Outfit = { shirt: "#7b57d6", stripe: "#d7c9ff", pattern: "check", hat: "cap", hatColor: "#e2554a", glasses: true, nose: "dot" };

type Beat = ["hop", number, number, number];
const beatsAt = (beats: Beat[], t: number) => {
  let hop = 0;
  for (const [, a, b, v] of beats) if (t >= a && t < b) hop += Math.sin(((t - a) / (b - a)) * Math.PI) * v;   // a hop is a laugh or a cheer; nothing else moves a body up and down
  return hop;
};
type Track = { ch?: Choreo; dir?: number; flip?: boolean; a: number; b: number; pos: (t: number) => [number, number]; faces: [number, Expr, string][]; beats?: Beat[]; h?: number };
const stay = (x: number, z: number) => (): [number, number] => [x, z];
const walk = (a: number, b: number, x0: number, z0: number, x1: number, z1: number) => (t: number): [number, number] => { const k = ease(prog(t, a, b)); return [lerp(x0, x1, k), lerp(z0, z1, k)]; };
/** B55: a track that walks along its own path gets planted feet (`locomote`); a path that goes left is built mirrored. */
const withGait = (tr: Track, kind: "walk" | "jog", lead = 0): Track => {
  const dir = Math.sign(tr.pos(tr.b - 0.01)[0] - tr.pos(tr.a)[0]) || 1;
  return { ...tr, flip: dir < 0, dir, ch: locomote((t) => dir * tr.pos(t)[0], tr.a, tr.b, kind, lead) };
};

// the three quoted lines (B46 n): only these words move a mouth (and the arm that goes with them)
const TALK: Record<string, [number, number][]> = { tono: [[5.16, 6.62], [13.92, 15.5]], darto: [[9.44, 11.75]] };
const talkAt = (id: string, t: number) => {
  if (!(TALK[id] ?? []).some(([a, b]) => t >= a && t < b)) return 0;
  const w = WORDS.find((x) => t >= x.a - 0.02 && t < x.b + 0.05);
  return w ? 0.4 + 0.6 * Math.abs(Math.sin(t * 17)) : 0;
};

// ---------- the acted poses of this story: the salt toss and the crank (B52: the real movement of the activity) -------------------------------------
const TOSS_D = [1.5, 2.0, 2.5], TOSS_T = [49.66, 49.98, 50.3];
const CRANK_D: [number, number][] = [[29.78, 33.3], [36.5, 47.2]], CRANK_T: [number, number][] = [[19.98, 29.78]];   // while these run the hand turns the crank
const CR = 0.12, SPEED = 2 * Math.PI * 1.4;
/** the crank's angle: it only advances while its owner is cranking, so it never snaps back */
const crankAngle = (iv: [number, number][], t: number) => iv.reduce((s, [a, b]) => s + Math.max(0, Math.min(t, b) - a), 0) * SPEED;
const bump = (u: number) => (u < -0.35 || u > 0.35 ? 0 : u < 0 ? 1 + u / 0.35 : 1 - u / 0.35);
const A8 = (lSh: number, lEl: number, rSh: number, rEl: number, x: Partial<Pose> = {}): Pose => ({ lSh, lEl, rSh, rEl, lHip: 8, lKn: 0, rHip: -8, rKn: 0, ...x });
const sprinklePose = (t: number, tosses: number[]): Pose => {
  const k = Math.max(...tosses.map((tt) => bump(t - tt)));
  return A8(55, -82, 62 + 50 * k, -62 + 58 * k, { lean: 4 * k });
};
/** the right hand follows the crank knob: a circle of CR m around the drum, which stands TUB m right of the seller (canvas: 602 px per metre, knob at 0.8 m) */
const crankPose = (t: number, iv: [number, number][]): Pose => {
  const w = crankAngle(iv, t), q = reach("r", 256 + (TUB + CR * Math.cos(w)) * 602, 1024 - 0.8 * 602 + 7 * Math.sin(w), 6);
  return A8(55, -82, q.sh, q.el, { lean: 6 });
};
const custom = (name: string, t: number, tosses: number[]): Pose | null => (name === "sprinkle" ? sprinklePose(t, tosses) : name === "crankD" ? crankPose(t, CRANK_D) : name === "crankT" ? crankPose(t, CRANK_T) : null);

const ACTORS: { id: string; o: Outfit; tracks: Track[]; tosses?: number[] }[] = [
  { id: "darto", o: DARTO, tosses: TOSS_D, tracks: [
    { a: 0, b: 3.36, pos: stay(DX, SZ), faces: [[0, "calm", "sprinkle"]] },
    { a: 3.36, b: 5.16, pos: stay(DX, SZ), faces: [[3.36, "shocked", "hips"]] },   // melotot
    { a: 5.16, b: 6.9, pos: stay(DX, SZ), faces: [[5.16, "puzzled", "hips"]] },
    { a: 6.9, b: 9.44, pos: stay(DX, SZ), faces: [[6.9, "grin", "belly"], [8.66, "calm", "hips"]] },   // senyum saja
    { a: 9.44, b: 12.68, pos: stay(DX, SZ), faces: [[9.44, "calm", "down"], [10.84, "calm", "pointc"], [11.72, "grin", "hips"]] },   // garamnya buat dingin, bukan buat rasa
    { a: 12.68, b: 15.94, pos: stay(DX, SZ), faces: [[12.68, "sly", "hips"], [13.92, "puzzled", "hips"]] },
    { a: 24.94, b: 29.78, pos: stay(DX, SZ), faces: [[24.94, "calm", "belly"], [26.42, "calm", "hips"]] },
    { a: 29.78, b: 33.3, pos: stay(DX, SZ), faces: [[29.78, "calm", "crankD"]] },   // berkabut, berderak: he cranks
    { a: 33.3, b: 36.5, pos: stay(DX, SZ), faces: [[33.3, "calm", "feedc"], [34.9, "grin", "cheerc"]] },   // the lid comes off, he shows the batter
    { a: 36.5, b: 47.2, pos: stay(DX, SZ), faces: [[36.5, "calm", "crankD"]] },
    { a: 47.2, b: LOOP_AT, pos: stay(DX, SZ), faces: [[47.2, "grin", "hips"]], beats: [["hop", 49.5, 49.8, 0.04]] },
  ] },
  { id: "tono", o: TONO, tosses: TOSS_T, tracks: [
    withGait({ a: 3.36, b: 5.0, pos: walk(3.36, 5.0, 5.3, 0.75, TONO_A, 0.75), faces: [[3.36, "calm", "down"]] }, "walk", 0.2),
    { a: 5.0, b: 6.9, flip: true, pos: stay(TONO_A, 0.75), faces: [[5.0, "shocked", "down"], [5.16, "puzzled", "pointc"]] },   // Es kok digaramin, Pak?
    { a: 6.9, b: 12.68, flip: true, pos: stay(TONO_A, 0.75), faces: [[6.9, "puzzled", "hips"], [9.44, "puzzled", "shrug"], [11.72, "puzzled", "hips"]] },
    { a: 12.68, b: 13.92, flip: true, pos: stay(TONO_A, 0.75), faces: [[12.68, "grin", "laugh"]], beats: [["hop", 12.8, 13.1, 0.1], ["hop", 13.3, 13.6, 0.1]] },   // ngakak
    { a: 13.92, b: 15.94, flip: true, pos: stay(TONO_A, 0.75), faces: [[13.92, "sly", "pointc"]] },   // Garam bikin es meleleh, Pak!
    { a: 15.94, b: 19.98, pos: stay(OB, SZ), faces: [[15.94, "sly", "hips"], [18.9, "calm", "hips"]] },
    { a: 19.98, b: 21.74, pos: stay(OB, SZ), faces: [[19.98, "calm", "crankT"]] },
    { a: 21.74, b: 24.94, pos: stay(OB, SZ), faces: [[21.74, "sleepy", "crankT"]] },
    { a: 24.94, b: 28.36, pos: stay(OB, SZ), faces: [[24.94, "calm", "crankT"]] },
    { a: 28.36, b: 29.78, pos: stay(OB, SZ), faces: [[28.36, "grin", "cheerc"]], beats: [["hop", 28.5, 28.8, 0.12], ["hop", 29.0, 29.3, 0.12]] },   // Tono menang, pikirnya
    { a: 35.72, b: 47.36, flip: true, pos: stay(TONO_A, 0.75), faces: [[35.72, "shocked", "shrug"], [38.94, "puzzled", "hips"], [43.18, "shocked", "belly"]] },
    withGait({ a: 47.36, b: 48.7, pos: walk(47.36, 48.7, TONO_A, 0.75, TONO_A - 0.05, 0.75), faces: [[47.36, "calm", "down"]] }, "walk"),
    { a: 48.7, b: LOOP_AT, flip: true, pos: stay(TONO_A - 0.05, 0.75), faces: [[48.7, "grin", "sprinkle"]] },   // asks for salt, then sprinkles three handfuls like Pak Darto
  ] },
];

type AState = { rig: Pose; x: number; z: number; flip: boolean; expr: Expr; arms: Arms; hop: number; h: number; talk: number };
const stateOf = (a: { id: string; tracks: Track[]; tosses?: number[] }, t: number): AState | null => {
  const tr = a.tracks.find((k) => t >= k.a && t < k.b);
  if (!tr) return null;
  const [bx, z] = tr.pos(t), ch = tr.ch ? choreoAt(tr.ch, t, tr.h ?? 1.7) : null, x = ch ? (tr.dir ?? 1) * ch.x : bx;
  const [, expr, armName] = stepAt(tr.faces, t);
  const rig = ch ? ch.pose : custom(armName, t, a.tosses ?? []) ?? poseAt(tr.faces.map(([ta, , ar]) => [ta, ar] as [number, string]), t, 0.28);   // still means still: no sway, tilt or nod unless acted
  return { rig, x, z, flip: tr.flip ?? false, expr, arms: "down", h: tr.h ?? 1.7, talk: talkAt(a.id, t), hop: beatsAt(tr.beats ?? [], t) + (ch ? ch.hop : 0) };
};

// ---------- painted textures (RicksClips3000: soft shaded, grained, many small marks; nothing is one flat colour) ------------------------------------
const speck = (c: CanvasRenderingContext2D, w: number, h: number, n: number, cols: string[], size = 3, seed = 0) => {
  for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(rnd(i * 3 + seed) * w, rnd(i * 7 + seed) * h, 1 + rnd(i * 5 + seed) * size, 1 + rnd(i * 11 + seed) * size); }
};
const woodTex = (base = "#a8733c", plank = 40) => (c: CanvasRenderingContext2D) => {
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += plank) {
    c.fillStyle = `rgba(${rnd(y) > 0.5 ? "255,220,170" : "40,18,6"},.14)`; c.fillRect(0, y, 256, plank);
    c.fillStyle = "rgba(35,16,5,.55)"; c.fillRect(0, y, 256, 2.5);
    c.fillStyle = "rgba(255,230,190,.18)"; c.fillRect(0, y + 3, 256, 1.5);
    c.strokeStyle = "rgba(50,24,8,.22)"; c.lineWidth = 1;
    for (let k = 0; k < 9; k++) { const yy = y + 5 + rnd(y + k) * (plank - 10); c.beginPath(); c.moveTo(0, yy); c.bezierCurveTo(70, yy + 4 * rnd(k), 150, yy - 4 * rnd(k + 2), 256, yy + 2); c.stroke(); }
    const kx = rnd(y * 3) * 220 + 15; c.fillStyle = "rgba(60,28,10,.45)"; c.beginPath(); c.ellipse(kx, y + plank / 2, 6, 3.5, 0, 0, 7); c.fill();
  }
};
const plasterTex = (base: string, grime = "rgba(70,50,30,.22)") => (c: CanvasRenderingContext2D) => {
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  speck(c, 256, 256, 900, ["rgba(255,255,255,.10)", "rgba(80,60,40,.10)"], 5, 4);
  for (let i = 0; i < 6; i++) { const g = c.createRadialGradient(rnd(i) * 256, rnd(i + 9) * 256, 0, rnd(i) * 256, rnd(i + 9) * 256, 60); g.addColorStop(0, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 256, 256); }
  const g = c.createLinearGradient(0, 160, 0, 256); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, grime); c.fillStyle = g; c.fillRect(0, 160, 256, 96);
};
const roofTex = (base: string) => (c: CanvasRenderingContext2D) => {
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) for (let k = 0; k < 9; k++) {
    const x = k * 32 + (r % 2) * 16, y = r * 32, v = rnd(r * 11 + k);
    c.fillStyle = `rgba(${v > 0.5 ? "255,190,140" : "70,20,10"},${0.10 + 0.14 * v})`; c.fillRect(x, y, 30, 30);
    c.strokeStyle = "rgba(50,14,6,.55)"; c.lineWidth = 2; c.beginPath(); c.arc(x + 15, y, 15, 0.1, Math.PI - 0.1); c.stroke();
    c.strokeStyle = "rgba(255,210,170,.22)"; c.lineWidth = 1.5; c.beginPath(); c.arc(x + 15, y + 2, 12, 0.3, Math.PI - 0.3); c.stroke();
  }
};
const pavingTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#4b4540"; c.fillRect(0, 0, 256, 256);
  const cols = ["#b99a7a", "#c7a583", "#a98b6e", "#bfa086", "#b08d6d"];
  for (let r = 0; r < 16; r++) for (let k = 0; k < 8; k++) { const x = k * 32 + (r % 2) * 16, y = r * 16; c.fillStyle = cols[Math.floor(rnd(r * 13 + k) * 5)]; c.fillRect(x + 1.5, y + 1.5, 29, 13); c.fillStyle = "rgba(255,255,255,.09)"; c.fillRect(x + 1.5, y + 1.5, 29, 3); }
  speck(c, 256, 256, 500, ["rgba(255,245,225,.18)", "rgba(40,30,20,.18)"], 3, 8);
};
const asphaltTex = (c: CanvasRenderingContext2D) => { c.fillStyle = "#59575a"; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 1400, ["rgba(255,255,255,.12)", "rgba(0,0,0,.18)", "rgba(190,180,170,.16)"], 3, 2); };
const grassTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#5faa45"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) { const x = rnd(i) * 256, y = rnd(i + 5) * 256; c.strokeStyle = ["#79c455", "#4a9338", "#8bd061", "#3f8530"][i % 4]; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd(i + 2) - 0.5) * 5, y - 5 - rnd(i + 3) * 6); c.stroke(); }
  for (let i = 0; i < 22; i++) { c.fillStyle = ["#fff3a8", "#ffffff", "#ffb3c8"][i % 3]; c.beginPath(); c.arc(rnd(i + 40) * 256, rnd(i + 70) * 256, 2.2, 0, 7); c.fill(); }
};
const metalTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 256, 0); [0, "#aab6be", 0.18, "#e9f0f4", 0.34, "#8d9aa3", 0.5, "#c5d0d7", 0.7, "#f4f8fa", 0.86, "#8d9aa3", 1, "#aab6be"].forEach((v, i, a) => { if (i % 2 === 0) g.addColorStop(v as number, a[i + 1] as string); });
  c.fillStyle = g; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 400, ["rgba(255,255,255,.12)", "rgba(0,0,0,.08)"], 2, 6);
};
const barrelTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#8f5d30"; c.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 21) { c.fillStyle = `rgba(${rnd(x) > 0.5 ? "255,215,160" : "40,16,4"},.16)`; c.fillRect(x, 0, 21, 256); c.fillStyle = "rgba(30,12,3,.6)"; c.fillRect(x, 0, 2, 256); c.fillStyle = "rgba(255,225,180,.16)"; c.fillRect(x + 3, 0, 1.5, 256); }
  for (const y of [36, 214]) { c.fillStyle = "#4a5259"; c.fillRect(0, y, 256, 14); c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(0, y + 2, 256, 3); }
};
const cartSign = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#e8a92e"; c.fillRect(0, 0, 256, 96);
  c.fillStyle = "#1c8b82"; c.beginPath(); c.roundRect(7, 7, 242, 82, 10); c.fill();
  c.fillStyle = "rgba(255,255,255,.14)"; c.fillRect(7, 7, 242, 22);
  c.fillStyle = "#fff6dc"; c.font = "900 50px Arial Black, Arial"; c.textAlign = "center"; c.fillText("ES PUTER", 140, 55);
  c.fillStyle = "#ffd447"; c.font = "900 19px Arial Black, Arial"; c.fillText("DINGIN SEGAR", 140, 80);
  c.fillStyle = "#f6dfb4"; c.beginPath(); c.arc(40, 38, 17, 0, 7); c.fill(); c.fillStyle = "#e3a65a"; c.beginPath(); c.moveTo(24, 46); c.lineTo(56, 46); c.lineTo(40, 82); c.fill();
  c.fillStyle = "#ff9fb7"; c.beginPath(); c.arc(40, 26, 12, 0, 7); c.fill();
};
const sackTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#efe3c6"; c.fillRect(0, 0, 128, 128); speck(c, 128, 128, 500, ["rgba(120,90,50,.18)", "rgba(255,255,255,.2)"], 2, 3);
  for (let y = 0; y < 128; y += 4) { c.fillStyle = "rgba(120,90,50,.07)"; c.fillRect(0, y, 128, 1); }
  c.fillStyle = "#1f4fa8"; c.fillRect(0, 38, 128, 54); c.fillStyle = "#fff"; c.font = "900 30px Arial Black, Arial"; c.textAlign = "center"; c.fillText("GARAM", 64, 76);
};
const signTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#f4f0e0"; c.fillRect(0, 0, 256, 96); c.strokeStyle = "#c2392b"; c.lineWidth = 8; c.strokeRect(5, 5, 246, 86);
  c.fillStyle = "#c2392b"; c.font = "900 38px Arial Black, Arial"; c.textAlign = "center"; c.fillText("WARUNG BU TINA", 128, 60);
};
const softTex = (c: CanvasRenderingContext2D) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); };
const swirlTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#f6dfb4"; c.fillRect(0, 0, 64, 64);
  c.strokeStyle = "#e9c488"; c.lineWidth = 5; c.beginPath(); for (let a = 0; a < 18; a += 0.2) c.lineTo(32 + a * 1.6 * Math.cos(a), 32 + a * 1.6 * Math.sin(a)); c.stroke();
};
const leafTex = (c: CanvasRenderingContext2D) => {   // a tapered banana leaf with a midrib and side veins, transparent around it
  c.clearRect(0, 0, 128, 256);
  const g = c.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, "#3f8f33"); g.addColorStop(0.5, "#79c24a"); g.addColorStop(1, "#4a9a38"); c.fillStyle = g;
  c.beginPath(); c.moveTo(64, 4); c.bezierCurveTo(124, 50, 124, 200, 64, 252); c.bezierCurveTo(4, 200, 4, 50, 64, 4); c.fill();
  c.strokeStyle = "#2f7a2a"; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 6); c.lineTo(64, 250); c.stroke();
  c.strokeStyle = "rgba(30,90,30,.45)"; c.lineWidth = 1.2; for (let y = 24; y < 240; y += 10) { c.beginPath(); c.moveTo(64, y); c.lineTo(10 + 6 * Math.abs(y - 128) / 128 * 4, y - 16); c.moveTo(64, y); c.lineTo(118 - 6 * Math.abs(y - 128) / 128 * 4, y - 16); c.stroke(); }
};
const skyTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, "#4aa7e6"); g.addColorStop(0.45, "#8ccdf2"); g.addColorStop(0.8, "#d7f0fb"); g.addColorStop(1, "#f6fbf0"); c.fillStyle = g; c.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 16; i++) {
    const cx = rnd(i * 7) * 1024, cy = 150 + rnd(i * 3) * 190, s = 0.7 + rnd(i * 5) * 0.9;
    for (let k = 0; k < 7; k++) { const x = cx + (k - 3) * 26 * s, y = cy - Math.sin(k / 6 * Math.PI) * 18 * s, r = (20 + 12 * Math.sin(k / 6 * Math.PI)) * s; const rg = c.createRadialGradient(x, y - r * 0.25, r * 0.1, x, y, r); rg.addColorStop(0, "rgba(255,255,255,.98)"); rg.addColorStop(0.75, "rgba(255,255,255,.92)"); rg.addColorStop(1, "rgba(205,225,240,.0)"); c.fillStyle = rg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    c.fillStyle = "rgba(160,190,215,.35)"; c.beginPath(); c.ellipse(cx, cy + 14 * s, 90 * s, 7 * s, 0, 0, 7); c.fill();
  }
};
const hillsTex = (c: CanvasRenderingContext2D) => {
  c.clearRect(0, 0, 1024, 256);
  const layer = (col: string, base: number, amp: number, f: number, ph: number) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 256); for (let x = 0; x <= 1024; x += 8) c.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * f + ph)) - amp * 0.4 * Math.sin(x * f * 2.7 + ph * 2)); c.lineTo(1024, 256); c.fill(); };
  layer("#9cc3c8", 120, 70, 0.006, 1); layer("#7eb08f", 160, 50, 0.009, 4); layer("#5f9c58", 205, 34, 0.013, 2);
  for (let i = 0; i < 90; i++) { const x = rnd(i) * 1024, y = 205 + rnd(i + 3) * 40; c.fillStyle = ["#3f8a3a", "#4f9a45", "#2f7a35"][i % 3]; c.beginPath(); c.arc(x, y, 9 + rnd(i + 5) * 9, 0, 7); c.fill(); }
};
const umbrellaTex = (c: CanvasRenderingContext2D) => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? "#fff1d6" : "#e2493c"; c.fillRect(i * 16, 0, 16, 64); } const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(0,0,0,.18)"); c.fillStyle = g; c.fillRect(0, 0, 192, 64); };
const barkTex = (c: CanvasRenderingContext2D) => { c.fillStyle = "#7a5a3a"; c.fillRect(0, 0, 64, 128); for (let x = 0; x < 64; x += 6) { c.fillStyle = `rgba(40,25,10,${0.18 + 0.2 * rnd(x)})`; c.fillRect(x, 0, 2, 128); } };

// ---------- parts ----------------------------------------------------------------------------------------------------------------------------
type RBoxP = { size: [number, number, number]; pos: [number, number, number]; rot?: [number, number, number]; color?: string; map?: THREE.Texture; tile?: number; r?: number; rough?: number; metal?: number; emissive?: string; ei?: number; opacity?: number; fit?: boolean };
/** a box with rounded edges (every real object has them) and a texture whose repeat follows its size */
const RBox: React.FC<RBoxP> = ({ size, pos, rot, color = "#ffffff", map, tile = 1, r = 0.025, rough = 0.78, metal = 0, emissive, ei = 1, opacity = 1, fit }) => {
  const g = useMemo(() => new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(r, size[0] / 2.2, size[1] / 2.2, size[2] / 2.2)), [size[0], size[1], size[2], r]);   // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMemo(() => { if (!map) return undefined; const t = map.clone(); t.needsUpdate = true; if (fit) t.repeat.set(1, 1); else t.repeat.set(Math.max(0.2, Math.max(size[0], size[2]) / tile), Math.max(0.2, size[1] / tile)); return t; }, [map, size[0], size[1], size[2], tile, fit]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={g} position={pos} rotation={rot}><meshStandardMaterial map={m} color={color} roughness={rough} metalness={metal} emissive={emissive ?? "#000"} emissiveIntensity={emissive ? ei : 0} transparent={opacity < 1} opacity={opacity} /></mesh>;
};
const Cyl: React.FC<{ r: number; r2?: number; h: number; pos: [number, number, number]; rot?: [number, number, number]; color?: string; map?: THREE.Texture; seg?: number; metal?: number; rough?: number; open?: boolean }> = ({ r, r2, h, pos, rot, color = "#fff", map, seg = 24, metal = 0, rough = 0.6, open }) => (
  <mesh position={pos} rotation={rot}><cylinderGeometry args={[r2 ?? r, r, h, seg, 1, open]} /><meshStandardMaterial map={map} color={color} metalness={metal} roughness={rough} side={open ? THREE.DoubleSide : THREE.FrontSide} /></mesh>
);
const Ball: React.FC<{ r: number; pos: [number, number, number]; color: string; sc?: [number, number, number]; rough?: number }> = ({ r, pos, color, sc, rough = 0.85 }) => (
  <mesh position={pos} scale={sc}><sphereGeometry args={[r, 14, 11]} /><meshStandardMaterial color={color} roughness={rough} /></mesh>
);

const Puff: React.FC<{ x: number; y: number; z: number; t: number; at: number; dur?: number; size?: number; tex: THREE.Texture; color?: string; rise?: number }> = ({ x, y, z, t, at, dur = 1.2, size = 0.5, tex, color = "#ffffff", rise = 0.5 }) => {
  const u = (t - at) / dur;
  if (u < 0 || u > 1) return null;
  return <sprite position={[x, y + u * rise, z]} scale={[size * (0.5 + u), size * (0.5 + u), 1]}><spriteMaterial map={tex} color={color} transparent opacity={0.6 * (1 - u)} depthWrite={false} /></sprite>;
};
/** a stream of puffs: puff i of n is at its own point of a loop of `dur` seconds */
const streamAt = (t: number, i: number, n: number, dur: number) => t - ((t / dur + i / n) % 1) * dur;

type TexSet = Record<"wood" | "woodDark" | "plasterA" | "plasterB" | "plasterC" | "roofA" | "roofB" | "paving" | "asphalt" | "grass" | "metal" | "barrel" | "cartSign" | "sack" | "sign" | "soft" | "swirl" | "leaf" | "umbrella" | "bark" | "hills" | "sky", THREE.Texture>;

/** a village house: plaster walls on a plinth, a hip roof of tiles, framed windows with shutters and a sill, a door with a step and a lamp */
const House: React.FC<{ x: number; z: number; w: number; h: number; wall: THREE.Texture; roof: THREE.Texture; tex: TexSet; door?: string; shutter?: string }> = ({ x, z, w, h, wall, roof, tex, door = "#6b4a2a", shutter = "#2f6f9a" }) => (
  <group position={[x, 0, z]}>
    <RBox size={[w, h, 2.4]} pos={[0, h / 2, 0]} map={wall} tile={1.6} r={0.05} />
    <RBox size={[w + 0.06, 0.28, 2.46]} pos={[0, 0.14, 0]} color="#8d8579" r={0.03} />
    <RBox size={[w + 0.1, 0.1, 2.5]} pos={[0, h + 0.02, 0]} color="#f3eadb" r={0.03} />
    <mesh position={[0, h + 0.62, 0]} scale={[w + 0.8, 1, 3.1]} rotation={[0, Math.PI / 4, 0]}><cylinderGeometry args={[0.0707 * 1, 0.7071, 1.1, 4]} /><meshStandardMaterial map={roof} roughness={0.85} /></mesh>
    <RBox size={[0.34, 0.8, 0.34]} pos={[w * 0.28, h + 0.9, -0.2]} color="#b9a58f" r={0.03} />
    {/* the door */}
    <RBox size={[0.86, 1.62, 0.07]} pos={[-w * 0.22, 0.81, 1.2]} color="#f3eadb" r={0.02} />
    <RBox size={[0.7, 1.5, 0.08]} pos={[-w * 0.22, 0.78, 1.215]} color={door} map={tex.wood} tile={0.8} r={0.02} />
    <Ball r={0.035} pos={[-w * 0.22 + 0.25, 0.78, 1.275]} color="#e0b04a" rough={0.3} />
    <RBox size={[1.1, 0.1, 0.4]} pos={[-w * 0.22, 0.05, 1.4]} color="#9a9288" r={0.02} />
    <Ball r={0.09} pos={[-w * 0.22 + 0.62, 1.95, 1.3]} color="#fff4c2" rough={0.3} />
    {/* the window: white frame, glass with a light streak, a cross, a sill, shutters, a pot */}
    <group position={[w * 0.24, 1.35, 1.2]}>
      <RBox size={[1.02, 0.92, 0.08]} pos={[0, 0, 0]} color="#f3eadb" r={0.03} />
      <RBox size={[0.86, 0.76, 0.04]} pos={[0, 0, 0.03]} color="#9ccfe6" rough={0.12} metal={0.2} emissive="#2a4658" ei={0.9} r={0.01} />
      <RBox size={[0.86, 0.04, 0.06]} pos={[0, 0, 0.06]} color="#f3eadb" r={0.01} /><RBox size={[0.04, 0.76, 0.06]} pos={[0, 0, 0.06]} color="#f3eadb" r={0.01} />
      <RBox size={[0.04, 0.3, 0.02]} pos={[-0.22, 0.14, 0.052]} rot={[0, 0, 0.5]} color="#e8f6ff" emissive="#8fb3c8" ei={0.8} r={0.005} />
      <RBox size={[1.2, 0.07, 0.2]} pos={[0, -0.5, 0.08]} color="#d8cfc0" r={0.02} />
      <RBox size={[0.34, 0.9, 0.04]} pos={[-0.7, 0, 0.04]} color={shutter} r={0.02} /><RBox size={[0.34, 0.9, 0.04]} pos={[0.7, 0, 0.04]} color={shutter} r={0.02} />
      <Cyl r={0.08} r2={0.06} h={0.14} pos={[0.3, -0.4, 0.12]} color="#c2623a" seg={12} /><Ball r={0.11} pos={[0.3, -0.27, 0.12]} color="#4fa23d" />
    </group>
  </group>
);
const Banana: React.FC<{ x: number; z: number; s?: number; f: number; ph?: number; leaf: THREE.Texture }> = ({ x, z, s = 1, f, ph = 0, leaf }) => {
  const geo = useMemo(() => { const g = new THREE.PlaneGeometry(0.55, 1.9, 4, 10); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.95; p.setZ(i, -0.5 * (y / 1.9) * (y / 1.9) * 1.1); } g.computeVertexNormals(); return g; }, []);
  return (
    <group position={[x, 0, z]} scale={s}>
      <Cyl r={0.12} r2={0.08} h={2.3} pos={[0, 1.15, 0]} color="#8a9a52" seg={12} />
      <Cyl r={0.15} r2={0.12} h={0.3} pos={[0, 0.15, 0]} color="#6f7d3f" seg={12} />
      {[0, 1, 2, 3, 4, 5, 6].map((k) => <group key={k} position={[0, 2.25, 0]} rotation={[0, k * 0.9, 0]}><group rotation={[-1.0 + 0.05 * Math.sin(f * 0.08 + ph + k), 0, 0]}><mesh geometry={geo} position={[0, 0.95, 0]}><meshStandardMaterial map={leaf} alphaTest={0.4} side={THREE.DoubleSide} roughness={0.7} /></mesh></group></group>)}
    </group>
  );
};
const Tree: React.FC<{ x: number; z: number; s?: number; bark: THREE.Texture }> = ({ x, z, s = 1, bark }) => (
  <group position={[x, 0, z]} scale={s}>
    <Cyl r={0.26} r2={0.14} h={1.6} pos={[0, 0.8, 0]} map={bark} seg={10} rough={0.95} />
    <Cyl r={0.12} r2={0.05} h={0.9} pos={[0.2, 1.7, 0]} rot={[0, 0, -0.6]} color="#7a5a3a" seg={8} />
    {[[0, 2.5, 0, 0.9, "#4c9a3b"], [0.7, 2.2, 0.2, 0.65, "#5aac44"], [-0.7, 2.25, -0.1, 0.7, "#3f8a34"], [0.1, 3.0, 0.1, 0.65, "#62b44a"], [0.15, 2.3, 0.7, 0.6, "#4c9a3b"], [-0.1, 2.35, -0.7, 0.6, "#559f40"]].map(([a, b, c, r, col], i) => <Ball key={i} r={r as number} pos={[a as number, b as number, c as number]} color={col as string} />)}
  </group>
);
const Hedge: React.FC<{ x: number; z: number; n: number }> = ({ x, z, n }) => <group position={[x, 0, z]}>{Array.from({ length: n }, (_, i) => <Ball key={i} r={0.34 + 0.06 * rnd(i)} pos={[i * 0.5, 0.32, 0.04 * Math.sin(i)]} color={i % 2 ? "#3f8a34" : "#4c9a3b"} sc={[1, 0.85, 1]} />)}</group>;
const LampPost: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <group position={[x, 0, z]}>
    <Cyl r={0.07} r2={0.045} h={3.4} pos={[0, 1.7, 0]} color="#3b4a52" metal={0.5} seg={10} /><Cyl r={0.12} h={0.25} pos={[0, 0.12, 0]} color="#2f3b42" metal={0.5} seg={10} />
    <RBox size={[0.6, 0.05, 0.05]} pos={[0.25, 3.35, 0]} color="#3b4a52" metal={0.5} r={0.01} />
    <RBox size={[0.34, 0.1, 0.22]} pos={[0.5, 3.32, 0]} color="#2f3b42" r={0.02} /><Ball r={0.09} pos={[0.5, 3.24, 0]} color="#fff2b8" rough={0.3} />
  </group>
);
const Chair: React.FC<{ x: number; z: number; yaw?: number; color?: string }> = ({ x, z, yaw = 0, color = "#d9473b" }) => (
  <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
    <RBox size={[0.44, 0.06, 0.44]} pos={[0, 0.44, 0]} color={color} r={0.03} rough={0.45} />
    <RBox size={[0.44, 0.4, 0.05]} pos={[0, 0.72, -0.2]} color={color} r={0.025} rough={0.45} />
    {[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([lx, lz], i) => <Cyl key={i} r={0.018} h={0.42} pos={[lx, 0.21, lz]} color="#dfe3e6" metal={0.6} seg={8} />)}
  </group>
);
const Hen: React.FC<{ x: number; z: number; f: number; ph: number; yaw?: number; color?: string }> = ({ x, z, f, ph, yaw = 0, color = "#b5642a" }) => {
  const peck = Math.max(0, Math.sin(f * 0.35 + ph)), sx = 0.05 * Math.sin(f * 0.07 + ph * 2);
  return (
    <group position={[x + sx, 0, z]} rotation={[0, yaw, 0]}>
      <Ball r={0.2} pos={[0, 0.26, 0]} color={color} sc={[0.95, 0.78, 0.65]} />
      <Ball r={0.13} pos={[0.04, 0.3, 0.1]} color={color} sc={[1.2, 0.6, 0.35]} />
      <Ball r={0.13} pos={[0.04, 0.3, -0.1]} color={color} sc={[1.2, 0.6, 0.35]} />
      <group position={[0.17, 0.36 - 0.12 * peck, 0]} rotation={[0, 0, -0.7 * peck]}>
        <Ball r={0.07} pos={[0.02, 0.06, 0]} color={color} />
        <mesh position={[0.1, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.025, 0.07, 6]} /><meshStandardMaterial color="#f0a830" /></mesh>
        <RBox size={[0.05, 0.05, 0.02]} pos={[0.02, 0.14, 0]} color="#d33a3a" r={0.01} /><Ball r={0.012} pos={[0.07, 0.09, 0.05]} color="#111" rough={0.2} />
      </group>
      {[0, 1, 2, 3].map((k) => <mesh key={k} position={[-0.2 - 0.02 * k, 0.33 + 0.03 * k, 0]} rotation={[0, 0, 0.5 + 0.18 * k]} scale={[0.35, 1, 0.3]}><sphereGeometry args={[0.1, 8, 6]} /><meshStandardMaterial color={k % 2 ? "#8a4a1e" : color} roughness={0.9} /></mesh>)}
      {[0.05, -0.05].map((lz) => <group key={lz}><Cyl r={0.012} h={0.14} pos={[0, 0.07, lz]} color="#f0a830" seg={6} /><RBox size={[0.1, 0.012, 0.03]} pos={[0.03, 0.006, lz]} color="#f0a830" r={0.004} /></group>)}
    </group>
  );
};
const Scooter: React.FC<{ x: number; z: number; f: number }> = ({ x, z, f }) => (
  <group position={[x, 0, z]}>
    <RBox size={[1.2, 0.26, 0.42]} pos={[-0.05, 0.5, 0]} color="#c33a2e" r={0.09} rough={0.4} />
    <RBox size={[0.5, 0.34, 0.4]} pos={[-0.45, 0.62, 0]} color="#c33a2e" r={0.09} rough={0.4} />
    <RBox size={[0.55, 0.1, 0.36]} pos={[0.0, 0.7, 0]} color="#22242a" r={0.04} />
    <RBox size={[0.07, 0.62, 0.1]} pos={[0.56, 0.78, 0]} color="#c9ccd0" metal={0.6} r={0.02} rot={[0, 0, -0.15]} />
    <RBox size={[0.08, 0.06, 0.62]} pos={[0.5, 1.1, 0]} color="#22242a" r={0.02} /><RBox size={[0.14, 0.14, 0.16]} pos={[0.62, 1.0, 0]} color="#e8e8e8" r={0.05} emissive="#fff2b8" ei={0.5} />
    {[0.56, -0.56].map((wx) => <group key={wx} position={[wx, 0.27, 0]} rotation={[0, 0, f * 0.5]}><mesh><torusGeometry args={[0.22, 0.07, 10, 18]} /><meshStandardMaterial color="#1c1f20" roughness={0.9} /></mesh><Cyl r={0.09} h={0.1} pos={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} color="#b7bcc2" metal={0.7} seg={10} /></group>)}
    <RBox size={[0.18, 0.12, 0.12]} pos={[-0.72, 0.4, 0.28]} color="#444" r={0.04} />
  </group>
);

// ---------- Pak Darto's cart: a wooden gerobak with a spoked wheel, a plank body and sign, a barrel of ice and salt, a steel drum with a crank, a parasol ------------------------
const Wheel: React.FC<{ z: number; tex: TexSet }> = ({ z, tex }) => (
  <group position={[0.5, 0.27, z]}>
    <mesh><torusGeometry args={[0.265, 0.03, 10, 28]} /><meshStandardMaterial color="#3d4247" metalness={0.6} roughness={0.5} /></mesh>
    <mesh><torusGeometry args={[0.235, 0.028, 8, 28]} /><meshStandardMaterial map={tex.wood} color="#c9a070" roughness={0.8} /></mesh>
    {Array.from({ length: 10 }, (_, k) => <mesh key={k} rotation={[0, 0, (k * Math.PI) / 5]}><boxGeometry args={[0.48, 0.026, 0.026]} /><meshStandardMaterial map={tex.wood} color="#c9a070" roughness={0.8} /></mesh>)}
    <Cyl r={0.06} h={0.1} pos={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} color="#4b5157" metal={0.6} seg={12} /><Cyl r={0.03} h={0.13} pos={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} color="#c2c8cd" metal={0.8} seg={10} />
  </group>
);
const Cart: React.FC<{ t: number; tex: TexSet }> = ({ t, tex }) => {
  const melt = prog(t, 26.0, 29.4) * 0.6, crystals = TOSS_D.filter((s) => t > s + 0.5).length + (t > 49.8 ? 1 : 0) + (t > 50.1 ? 1 : 0);
  const frost = prog(t, 29.8, 34.4), lid = prog(t, 33.4, 34.0) * (1 - prog(t, 35.4, 35.9));
  const spin = crankAngle(CRANK_D, t);
  const IY = TOP + 0.2 - 0.05 * melt;   // the level of the ice
  return (
    <group>
      {/* frame and body */}
      <RBox size={[1.5, 0.05, 0.07]} pos={[0, 0.14, 0.32]} map={tex.wood} tile={0.5} r={0.015} /><RBox size={[1.5, 0.05, 0.07]} pos={[0, 0.14, -0.32]} map={tex.wood} tile={0.5} r={0.015} />
      <RBox size={[1.5, 0.24, 0.8]} pos={[0, 0.27, 0]} map={tex.wood} tile={0.7} r={0.03} />
      <RBox size={[1.14, 0.2, 0.03]} pos={[-0.04, 0.27, 0.41]} map={tex.cartSign} fit r={0.012} rough={0.5} />
      <RBox size={[1.58, 0.04, 0.88]} pos={[0, TOP, 0]} map={tex.wood} color="#b98b58" tile={0.6} r={0.02} />
      {[[-0.74, 0.4], [0.74, 0.4], [-0.74, -0.4], [0.74, -0.4]].map(([lx, lz], i) => <RBox key={i} size={[0.06, 0.3, 0.06]} pos={[lx, 0.27, lz]} map={tex.wood} color="#b98b58" tile={0.4} r={0.015} />)}
      <Wheel z={0.5} tex={tex} /><Wheel z={-0.5} tex={tex} />
      <Cyl r={0.025} h={1.12} pos={[0.5, 0.27, 0]} rot={[Math.PI / 2, 0, 0]} color="#5b6168" metal={0.6} seg={8} />
      {/* handle bars to the left and a stand at the right */}
      {[0.3, -0.3].map((hz) => <RBox key={hz} size={[0.85, 0.05, 0.05]} pos={[-1.12, 0.42, hz]} rot={[0, 0, 0.1]} map={tex.wood} tile={0.5} r={0.02} />)}
      <RBox size={[0.06, 0.2, 0.06]} pos={[-0.7, 0.1, 0.3]} map={tex.wood} tile={0.5} r={0.015} /><RBox size={[0.06, 0.2, 0.06]} pos={[-0.7, 0.1, -0.3]} map={tex.wood} tile={0.5} r={0.015} />
      {/* on the board: the barrel of ice, syrup bottles, cups and cones, a towel */}
      <Cyl r={0.34} r2={0.31} h={0.28} pos={[TUB, TOP + 0.16, 0]} map={tex.barrel} seg={28} rough={0.8} open />
      <mesh position={[TUB, IY - 0.03, 0]}><cylinderGeometry args={[0.32, 0.3, 0.1, 24]} /><meshStandardMaterial color={melt > 0.05 ? "#6fb7e0" : "#b6e3f7"} roughness={0.15} metalness={0.05} transparent opacity={0.92} /></mesh>
      {[[-0.16, 0.1, 0.2], [0.15, -0.1, 0.18], [0.02, 0.2, 0.16], [-0.05, -0.2, 0.17], [0.2, 0.14, 0.15], [-0.2, -0.1, 0.14]].map(([ix, iz, sz], i) => <RBox key={i} size={[sz, sz * 0.85, sz]} pos={[TUB + ix, IY + 0.01 + 0.03 * (i % 2) - 0.05 * melt, iz]} rot={[0.2 * i, 0.5 * i, 0.1 * i]} color="#d8f2ff" rough={0.1} opacity={0.88} r={0.03} />)}
      {Array.from({ length: crystals * 8 }, (_, i) => <mesh key={i} position={[TUB + (rnd(i + 3) - 0.5) * 0.55, IY + 0.07 + 0.04 * rnd(i + 9), (rnd(i + 7) - 0.5) * 0.5]} rotation={[rnd(i), rnd(i + 1), rnd(i + 2)]}><boxGeometry args={[0.035, 0.035, 0.035]} /><meshStandardMaterial color="#ffffff" roughness={0.4} /></mesh>)}
      {/* the steel drum and its crank */}
      <Cyl r={0.13} h={0.34} pos={[TUB, IY + 0.06, 0]} map={tex.metal} color={new THREE.Color("#ffffff").lerp(new THREE.Color("#dff2ff"), frost).getStyle()} seg={28} metal={0.45} rough={0.35} />
      <Cyl r={0.15} h={0.04} pos={[TUB, IY + 0.24 + 0.25 * lid, 0]} color="#a9b4bb" metal={0.7} rough={0.3} seg={28} />
      <group position={[TUB, IY + 0.29 + 0.25 * lid, 0]} rotation={[0, -spin, 0]}>
        <RBox size={[CR + 0.04, 0.035, 0.05]} pos={[(CR + 0.04) / 2 - 0.02, 0, 0]} map={tex.wood} tile={0.3} r={0.012} /><Cyl r={0.022} h={0.13} pos={[CR, -0.04, 0]} map={tex.wood} seg={10} />
      </group>
      {lid > 0.5 && <mesh position={[TUB, IY + 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.125, 24]} /><meshStandardMaterial map={tex.swirl} roughness={0.7} /></mesh>}
      {t >= 34.9 && t < 36.4 && <group position={[TUB - 0.1, IY + 0.5 + 0.08 * pop(t - 34.9), 0.3]} scale={pop(t - 34.9)}><mesh position={[0, -0.12, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.09, 0.22, 12]} /><meshStandardMaterial color="#d79a4a" roughness={0.8} /></mesh><Ball r={0.11} pos={[0, 0.04, 0]} color="#f6dfb4" rough={0.7} /></group>}
      {[[-0.62, "#e04a5a"], [-0.55, "#4fb04f"], [-0.48, "#f0b030"]].map(([bx, col], i) => <group key={i} position={[bx as number, TOP + 0.02, 0.24]}><Cyl r={0.04} h={0.22} pos={[0, 0.13, 0]} color={col as string} rough={0.25} seg={12} /><Cyl r={0.016} h={0.06} pos={[0, 0.27, 0]} color="#dfe3e6" metal={0.5} seg={8} /></group>)}
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[-0.62, TOP + 0.06 + 0.07 * i, -0.2]}><cylinderGeometry args={[0.07, 0.05, 0.08, 14]} /><meshStandardMaterial color={i % 2 ? "#f3f0e8" : "#ffd9a0"} roughness={0.6} /></mesh>)}
      <RBox size={[0.3, 0.02, 0.22]} pos={[0.58, TOP + 0.12, -0.3]} rot={[0.5, 0, 0]} color="#e9eef2" r={0.008} />
      {/* the parasol */}
      <Cyl r={0.022} h={2.35} pos={[-0.66, 1.2, -0.42]} color="#9a7a52" seg={8} />
      <mesh position={[-0.66, 2.45, -0.42]}><coneGeometry args={[1.3, 0.42, 12, 1, true]} /><meshStandardMaterial map={tex.umbrella} roughness={0.75} side={THREE.DoubleSide} emissive="#7a3a2c" emissiveIntensity={0.55} /></mesh>
      <Ball r={0.05} pos={[-0.66, 2.68, -0.42]} color="#f0c040" rough={0.4} />
      {/* fog, heat and sparks */}
      {t >= 29.8 && t < 36.4 && [0, 1, 2, 3, 4, 5].map((i) => <Puff key={i} x={TUB + (rnd(i) - 0.5) * 0.5} y={IY + 0.35} z={0.1 + (rnd(i + 5) - 0.5) * 0.4} t={t} at={streamAt(t, i, 6, 1.3)} dur={1.3} size={0.55} tex={tex.soft as THREE.CanvasTexture} color="#e4f5ff" rise={0.7} />)}
      {t >= 43.18 && t < 45.6 && [0, 1, 2, 3, 4, 5, 6].map((i) => { const u = (t * 0.55 + i / 7) % 1; return <mesh key={i} position={[TUB + lerp(0.0, i % 2 ? 0.34 : -0.34, u), IY + 0.06 + 0.05 * Math.sin(u * 6), lerp(0.05, (rnd(i) - 0.5) * 0.3, u)]}><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial color="#ff8a3d" toneMapped={false} /></mesh>; })}
    </group>
  );
};

/** A thermometer that pops in for the science beats: the red column drops from room temperature to minus 20 on the words. */
const Thermo: React.FC<{ t: number }> = ({ t }) => {
  if (t < 36.84 || t >= 47.3) return null;
  const col = lerp(1.0, 0.04, ease(prog(t, 38.4, 42.2)));
  return (
    <group position={[-0.78, 0.0, 0.5]} scale={0.62 * pop(t - 36.84)}>
      <RBox size={[0.22, 1.6, 0.06]} pos={[0, 1.0, 0]} color="#fffaf0" r={0.03} />
      <RBox size={[0.07, 1.3, 0.04]} pos={[0, 1.15, 0.04]} color="#d9e6ee" r={0.02} />
      <RBox size={[0.07, 1.3 * col, 0.05]} pos={[0, 0.5 + 0.65 * col, 0.05]} color="#ff4a3a" r={0.02} />
      <Ball r={0.1} pos={[0, 0.46, 0.05]} color="#ff4a3a" rough={0.3} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <RBox key={i} size={[0.1, 0.02, 0.03]} pos={[0.12, 0.62 + i * 0.19, 0.04]} color="#17141c" r={0.005} />)}
      <RBox size={[0.3, 0.05, 0.04]} pos={[0.2, 0.62 + 0.19, 0.05]} color="#4fb0ff" r={0.01} />
    </group>
  );
};

/** Tono's own table: a red bucket of plain ice and a drum of batter he cranks; the batter stays liquid. */
const Bucket: React.FC<{ t: number; tex: TexSet }> = ({ t, tex }) => {
  const melt = prog(t, 16, 28), spin = crankAngle(CRANK_T, t), IY = TOP + 0.18 - 0.05 * melt, BX = OB + TUB;
  return (
    <group>
      <RBox size={[1.3, 0.06, 0.74]} pos={[OB + 0.1, TOP - 0.03, 0]} map={tex.wood} tile={0.6} color="#c79a62" r={0.025} />
      {[[-0.5, 0.28], [0.7, 0.28], [-0.5, -0.28], [0.7, -0.28]].map(([lx, lz], i) => <RBox key={i} size={[0.07, TOP - 0.05, 0.07]} pos={[OB + lx, (TOP - 0.05) / 2, lz]} map={tex.wood} tile={0.4} r={0.02} />)}
      <RBox size={[1.2, 0.05, 0.05]} pos={[OB + 0.1, 0.2, 0.28]} map={tex.wood} tile={0.4} r={0.015} />
      <Cyl r={0.26} r2={0.22} h={0.26} pos={[BX, TOP + 0.13, 0]} color="#e24a3b" rough={0.4} seg={28} open />
      <Cyl r={0.265} h={0.03} pos={[BX, TOP + 0.26, 0]} color="#c23a2e" rough={0.4} seg={28} />
      <mesh position={[BX, IY - 0.03, 0]}><cylinderGeometry args={[0.235, 0.215, 0.1, 22]} /><meshStandardMaterial color="#cdeffd" roughness={0.2} transparent opacity={0.88} /></mesh>
      {[[-0.12, 0.08], [0.09, -0.07], [0.0, 0.13], [0.15, 0.08]].map(([ix, iz], i) => <RBox key={i} size={[0.16, 0.14, 0.16]} pos={[BX + ix, IY + 0.03 - 0.04 * melt, iz]} rot={[0.3 * i, 0.6 * i, 0]} color="#e2f6ff" rough={0.12} opacity={0.88} r={0.03} />)}
      <Cyl r={0.13} h={0.34} pos={[BX, IY + 0.06, 0]} map={tex.metal} seg={28} metal={0.45} rough={0.35} />
      <Cyl r={0.15} h={0.04} pos={[BX, IY + 0.24, 0]} color="#a9b4bb" metal={0.7} rough={0.3} seg={28} />
      <group position={[BX, IY + 0.29, 0]} rotation={[0, -spin, 0]}><RBox size={[CR + 0.04, 0.035, 0.05]} pos={[(CR + 0.04) / 2 - 0.02, 0, 0]} map={tex.wood} tile={0.3} r={0.012} /><Cyl r={0.022} h={0.13} pos={[CR, -0.04, 0]} map={tex.wood} seg={10} /></group>
      {t >= 21.74 && t < 24.94 && [0, 1, 2].map((i) => <Puff key={i} x={BX + (rnd(i) - 0.5) * 0.3} y={0.8} z={0.2} t={t} at={streamAt(t, i, 3, 0.9)} dur={0.9} size={0.25} tex={tex.soft as THREE.CanvasTexture} color="#aee0ff" rise={0.3} />)}
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
      m.castShadow = !(m as unknown as THREE.InstancedMesh).isInstancedMesh && !mat.transparent && !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial && !(mat as THREE.Material & { alphaTest: number }).alphaTest;
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
    wood: painted(256, 256, woodTex()), woodDark: painted(256, 256, woodTex("#7b4f2a", 32)),
    plasterA: painted(256, 256, plasterTex("#f0d9a8")), plasterB: painted(256, 256, plasterTex("#a7d3c2")), plasterC: painted(256, 256, plasterTex("#f2b8a2")),
    roofA: painted(256, 256, roofTex("#c2563a")), roofB: painted(256, 256, roofTex("#a8452f")),
    paving: painted(256, 256, pavingTex, 110, 5.5), asphalt: painted(256, 256, asphaltTex, 110, 1.2), grass: painted(256, 256, grassTex, 110, 60), metal: painted(256, 256, metalTex), barrel: painted(256, 256, barrelTex), cartSign: painted(256, 96, cartSign),
    sack: painted(128, 128, sackTex), sign: painted(256, 96, signTex), soft: painted(64, 64, softTex), swirl: painted(64, 64, swirlTex), leaf: painted(128, 256, leafTex), umbrella: painted(192, 64, umbrellaTex), bark: painted(64, 128, barkTex),
    hills: painted(1024, 256, hillsTex, 1, 1), sky: painted(1024, 512, skyTex, 1, 1),
  } as unknown as TexSet), []);
  const scoot = (t0: number, t1: number, x0: number, x1: number) => (t >= t0 && t < t1 ? <Scooter x={lerp(x0, x1, (t - t0) / (t1 - t0))} z={-3.2} f={f} /> : null);
  const melt = prog(t, 26.0, 29.4);
  const handPos = (id: string, tt: number) => {
    const a = ACTORS.find((q) => q.id === id)!, s = stateOf(a, tt);
    if (!s) return V(0, 1, 0.8);
    const hd = handOffset(s.rig, "r", s.h), side = s.flip ? -1 : 1;
    return V(s.x + side * hd.x, hd.y, s.z + 0.05);
  };
  const grains = (tt: number, who: number, from: THREE.Vector3, to: THREE.Vector3) => {
    const u = (t - tt) / 0.55;
    if (u < 0 || u > 1) return null;
    return Array.from({ length: 12 }, (_, i) => {
      const k = Math.min(1, u * (0.85 + 0.3 * rnd(i + who)));
      return <mesh key={`${tt}-${i}`} position={[lerp(from.x, to.x, k) + (rnd(i) - 0.5) * 0.16 * k, lerp(from.y, to.y, k) + 0.4 * Math.sin(k * Math.PI) - (rnd(i + 3) - 0.5) * 0.05, lerp(from.z, to.z, k) + (rnd(i + 8) - 0.5) * 0.1]}><boxGeometry args={[0.025, 0.025, 0.025]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>;
    });
  };
  return (
    <group>
      {/* sky dome, far hills, grass, road, paved square */}
      <mesh><sphereGeometry args={[95, 32, 16]} /><meshBasicMaterial map={tex.sky} color="#c9d4dc" side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[4, 5.5, -42]} scale={[1, 1, 1]}><planeGeometry args={[150, 20]} /><meshBasicMaterial map={tex.hills} transparent fog={false} toneMapped={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]}><planeGeometry args={[220, 120]} /><meshStandardMaterial map={tex.grass} roughness={1} /></mesh>
      <mesh position={[0, 0.006, -3.3]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[220, 2.3]} /><meshStandardMaterial map={tex.asphalt} roughness={0.95} /></mesh>
      {Array.from({ length: 24 }, (_, i) => <mesh key={i} position={[-12 + i * 1.8, 0.012, -3.3]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.9, 0.1]} /><meshStandardMaterial color="#f1ead2" roughness={0.9} /></mesh>)}
      <RBox size={[220, 0.14, 0.22]} pos={[0, 0.07, -2.05]} color="#bdb6aa" r={0.03} />
      <RBox size={[220, 0.14, 0.22]} pos={[0, 0.07, -4.55]} color="#bdb6aa" r={0.03} />
      <mesh position={[0, 0.008, 3.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[220, 11]} /><meshStandardMaterial map={tex.paving} roughness={0.95} /></mesh>
      <mesh position={[3.4, 14.0, -40]}><sphereGeometry args={[2.6, 28, 20]} /><meshBasicMaterial color="#ffd23a" toneMapped={false} fog={false} /></mesh>
      {/* a village corner across the road: houses, a warung sign, hedges, trees, banana plants, lamp posts */}
      <House x={-5} z={-7} w={3.2} h={2.4} wall={tex.plasterA} roof={tex.roofA} tex={tex} />
      <House x={-1.2} z={-7.4} w={3.6} h={2.6} wall={tex.plasterB} roof={tex.roofB} tex={tex} door="#2f6fa0" shutter="#d9473b" />
      <House x={3.2} z={-7} w={3.4} h={2.3} wall={tex.plasterC} roof={tex.roofA} tex={tex} shutter="#3f8a56" />
      <House x={7.6} z={-7.2} w={3.6} h={2.5} wall={tex.plasterB} roof={tex.roofA} tex={tex} door="#7a2f2f" />
      <House x={11.6} z={-7} w={3.4} h={2.4} wall={tex.plasterA} roof={tex.roofB} tex={tex} shutter="#d9473b" />
      <House x={15.6} z={-7.3} w={3.4} h={2.6} wall={tex.plasterC} roof={tex.roofA} tex={tex} door="#2f6fa0" />
      <RBox size={[1.9, 0.7, 0.06]} pos={[3.2, 2.0, -5.7]} map={tex.sign} fit r={0.02} />
      <Hedge x={-3.4} z={-5.5} n={4} /><Hedge x={5.2} z={-5.5} n={3} /><Hedge x={13.4} z={-5.5} n={5} />
      <Tree x={-7.4} z={-5.6} s={1.1} bark={tex.bark} /><Tree x={1.2} z={-5.8} s={0.9} bark={tex.bark} /><Tree x={9.6} z={-5.6} s={1.2} bark={tex.bark} /><Tree x={-12} z={-6} s={1.3} bark={tex.bark} />
      <Banana x={-3.2} z={-5.2} f={f} leaf={tex.leaf} /><Banana x={5.4} z={-5.1} s={1.15} f={f} ph={2} leaf={tex.leaf} /><Banana x={13.9} z={-5.2} f={f} ph={4} leaf={tex.leaf} /><Banana x={-9.5} z={-5} s={0.9} f={f} ph={1} leaf={tex.leaf} />
      <LampPost x={-2.2} z={-1.7} /><LampPost x={6.6} z={-1.7} /><LampPost x={13.5} z={-1.7} />
      <Chair x={3.6} z={-1.2} yaw={0.3} /><Chair x={4.2} z={-1.1} yaw={-0.2} color="#2f86d9" /><Chair x={12.6} z={-1.2} yaw={0.2} color="#e0a52c" />
      <Hen x={-2.2} z={2.4} f={f} ph={1} /><Hen x={-1.5} z={2.9} f={f} ph={3} yaw={Math.PI} color="#e8d6a8" /><Hen x={5.4} z={2.4} f={f} ph={5} yaw={0.4} /><Hen x={11.6} z={2.6} f={f} ph={2} color="#6b3f1c" />
      {/* the clothesline behind the road: clothes swing in the breeze */}
      <Cyl r={0.04} h={2.2} pos={[-2.6, 1.1, -5.9]} color="#6b4a2a" seg={8} /><Cyl r={0.04} h={2.2} pos={[0.4, 1.1, -5.9]} color="#6b4a2a" seg={8} /><RBox size={[3.0, 0.02, 0.02]} pos={[-1.1, 2.1, -5.9]} color="#cfd2d6" r={0.005} />
      {([[-2.2, "#e24a6b"], [-1.6, "#3a86d9"], [-0.9, "#f2c230"], [-0.3, "#5fb35a"]] as [number, string][]).map(([cx, col], i) => <group key={i} position={[cx, 2.1, -5.9]} rotation={[0, 0, 0.12 * Math.sin(f * 0.09 + i * 1.7)]}><RBox size={[0.4, 0.55, 0.03]} pos={[0, -0.28, 0]} color={col} r={0.012} /></group>)}
      {scoot(3.6, 7.0, 10, -8)}{scoot(24.2, 27.4, -8, 12)}{scoot(36.9, 40.5, 12, -8)}
      {/* stage A: Pak Darto's cart, salt sack and crate, a puddle under it that grows as the ice melts */}
      <Cart t={t} tex={tex} />
      <mesh position={[0.3, 0.014, 0.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.4 + 1.6 * melt, 0.8 + 0.8 * melt, 1]}><circleGeometry args={[0.7, 28]} /><meshStandardMaterial color="#4d463f" roughness={0.25} transparent opacity={0.3 + 0.55 * melt} /></mesh>
      <RBox size={[0.7, 0.4, 0.5]} pos={[-1.3, 0.2, 0.55]} map={tex.wood} tile={0.6} r={0.03} />
      <RBox size={[0.46, 0.5, 0.26]} pos={[-1.3, 0.65, 0.55]} map={tex.sack} tile={0.5} r={0.09} />
      <Cyl r={0.2} r2={0.18} h={0.5} pos={[-1.95, 0.25, 0.2]} color="#c9ccd0" metal={0.5} seg={18} />
      {/* stage B: Tono's table, plain ice */}
      <Bucket t={t} tex={tex} />
      <Chair x={OB + 1.7} z={0.5} yaw={-0.4} color="#6b4fd0" />
      <Thermo t={t} />
      {TOSS_D.map((tt) => grains(tt + 0.05, 1, handPos("darto", tt + 0.05), V(TUB, 1.0, 0)))}
      {TOSS_T.map((tt) => grains(tt + 0.05, 2, handPos("tono", tt + 0.05), V(TUB, 1.0, 0)))}
      {t >= 24.94 && t < 27.5 && [0, 1, 2, 3, 4, 5].map((i) => <Puff key={i} x={0.3 + (rnd(i) - 0.5) * 0.7} y={1.2} z={0.1} t={t} at={25.0 + i * 0.35} dur={1.0} size={0.4} tex={tex.soft as THREE.CanvasTexture} color="#ffefc0" rise={0.35} />)}
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
  const sky = new THREE.Color("#a9d9f4").lerp(new THREE.Color("#8fd3f2"), hot).getStyle();
  const hookA = t0 >= LOOP_AT ? 1 : t0 < 3.0 ? 1 : t0 < 3.36 ? 1 - (t0 - 3.0) / 0.36 : 0;
  const actors = ACTORS.map((a) => {
    const s = stateOf(a, t);
    if (!s) return null;
    return <StickHero key={a.id} pos={V(s.x, 0, s.z)} expr={s.expr} arms={s.arms} f={f} outfit={a.o} height={s.h} hop={s.hop} flip={s.flip} rig={s.rig} talk={s.talk} breath={0} />;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: sky }}>
      <ThreeCanvas width={FRAME.width} height={FRAME.height} shadows camera={{ fov: 40, near: 0.05, far: 130, position: HOOK.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={[sky]} />
        <fog attach="fog" args={[sky, 16, 70]} />
        <hemisphereLight args={["#c6e3ff", "#d8b878", lerp(1.0, 1.25, hot)]} />
        <Sun cam={cam} hot={hot} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={lerp(0.3, 0.5, hot)} occlude />
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
