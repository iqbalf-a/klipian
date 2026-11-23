/* Dimas begadang dan jajan tiap jam (look ricks, B46 + B47): a made-up story in a night gang: Dimas's rented room (cut open), the burjo stall of
   Mang Udin and the street between them. One true fact carries it: after two nights of 4 h sleep, young men reported about 24 % more appetite
   (Spiegel et al., 2004). The picture follows the voice (words.json from faster-whisper): one shot per sentence, one caption word at a time,
   number pills on their word (B45), the last shot lands on the first shot's framing (the loop). The engine and the cast are the ricks kit. */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { FRAME } from "../../src/tokens.ts";
import { RicksCamera, RicksPost, StickHero, TBox, Pills, WordCaption, camAt, keyed, painted, readWords, rnd, stepAt, V, type Arms, type Cam, type Expr, type Outfit, type Pill, type Shot } from "../../src/ricks/kit.tsx";
import type { StoryT } from "../../src/schema.ts";
import storyJson from "./story.json";
import WORDS from "./words.json";

export const story = storyJson as unknown as StoryT;
const FPS = 30;
const TOTAL = 57.34;
const NIGHT = "#1a1530";

// ---------- the people (each their own outfit and face, B46 i) ------------------------------------------------------------------
const DIMAS_AT = V(-2.3, 0, -0.6);
const UDIN_AT = V(2.2, 0, -1.15);
/** Mang Udin steps right while the three foods pop, so none of them hides behind him. */
const UDIN_X: [number, number][] = [[0, 2.2], [25.2, 2.2], [25.7, 3.4], [28.8, 3.4], [29.4, 2.2], [70, 2.2]];
const RANI_AT = V(-0.1, 0, 0.7);
const DIMAS: Outfit = { shirt: "#5a6fd8", stripe: "#3b4aa6", pattern: "plain", hair: "spiky", hairColor: "#17141c", nose: "dot" };
const UDIN: Outfit = { shirt: "#e07a2f", stripe: "#8c4a14", pattern: "check", hat: "peci", mustache: true, body: "wide", nose: "big" };
const RANI: Outfit = { shirt: "#c9a0e8", stripe: "#7b4fa8", pattern: "collar", hair: "long", hairColor: "#3b2418", glasses: true, blush: true };

// ---------- the script: shots, faces, the clock, the chart, pills ---------------------------------------------------------------------
const HOOK: Cam = { pos: V(-2.1, 1.3, 3.4), look: V(-2.3, 1.36, -0.6) };
const SHOTS: Shot[] = [
  { from: 0, a: HOOK, b: { pos: V(-2.15, 1.3, 3.0), look: V(-2.3, 1.36, -0.6) } },                                   // Dimas begadang, tiap jam dia jajan
  { from: 3.4, a: { pos: V(-1.6, 1.25, 1.6), look: V(-2.3, 1.25, -0.6) }, b: { pos: V(-1.9, 1.3, 1.2), look: V(-2.3, 1.25, -0.6) } }, // jam sebelas malam, laptop nyala, tugas belum kelar
  { from: 6.6, a: { pos: V(-1.2, 1.6, 5.2), look: V(0.3, 1.2, -0.8) }, b: { pos: V(0.6, 1.5, 4.6), look: V(1.2, 1.2, -0.8) } },   // Dimas yakin itu cuma lapar mata (the whole gang)
  { from: 9.0, a: { pos: V(1.0, 1.35, 2.2), look: V(2.2, 1.3, -1.0) }, b: { pos: V(1.7, 1.35, 1.6), look: V(2.2, 1.35, -1.0) } },  // Mang Udin burjo hafal pesanan
  { from: 11.8, a: { pos: V(1.2, 1.3, 2.7), look: V(1.6, 1.1, -0.5) }, b: { pos: V(3.0, 1.3, 2.7), look: V(2.8, 1.1, -0.5) } },  // mi instan, telur, es teh (along the counter)
  { from: 14.5, a: { pos: V(0.9, 1.3, 4.0), look: V(0.05, 1.2, 0.7) }, b: { pos: V(0.7, 1.3, 3.5), look: V(0.05, 1.2, 0.7) } },     // Rani pasang aplikasi kalori
  { from: 16.8, a: { pos: V(0.3, 1.25, 3.3), look: V(0.05, 1.2, 0.8) }, b: { pos: V(0.3, 1.25, 3.0), look: V(0.08, 1.2, 0.85) } }, // katanya cuma kebiasaan (the phone)
  { from: 19.9, a: { pos: V(-1.6, 1.25, 1.6), look: V(-2.3, 1.25, -0.6) }, b: { pos: V(-1.9, 1.3, 1.2), look: V(-2.3, 1.25, -0.6) } }, // Dimas coba menahan diri
  { from: 21.6, a: { pos: V(-2.4, 1.5, 3.4), look: V(-2.65, 1.45, -0.8) }, b: { pos: V(-2.55, 1.5, 3.1), look: V(-2.7, 1.5, -0.8) } }, // satu jam, dua jam (the clock runs)
  { from: 23.5, a: { pos: V(-1.6, 1.25, 1.6), look: V(-2.3, 1.25, -0.6) }, b: { pos: V(-1.9, 1.3, 1.2), look: V(-2.3, 1.25, -0.6) } }, // tapi tiap kurang tidur
  { from: 25.6, a: { pos: V(2.25, 1.5, 5.2), look: V(2.25, 1.0, -0.55) }, b: { pos: V(2.25, 1.4, 4.7), look: V(2.25, 1.0, -0.55) } },  // nasi, gorengan, es teh manis
  { from: 28.6, a: { pos: V(-1.3, 1.3, 2.4), look: V(-2.3, 1.3, -0.6) }, b: { pos: V(-1.7, 1.3, 2.0), look: V(-2.3, 1.3, -0.6) } }, // bukan sayur, bukan buah
  { from: 30.8, a: { pos: V(-2.1, 1.0, 2.8), look: V(-2.3, 0.95, -0.6) }, b: { pos: V(-2.2, 1.0, 2.3), look: V(-2.3, 0.95, -0.6) } }, // perutnya minta yang cepat dan manis (the belly)
  { from: 33.6, a: { pos: V(-1.2, 1.6, 5.2), look: V(0.3, 1.2, -0.8) }, b: { pos: V(0.6, 1.5, 4.6), look: V(1.2, 1.2, -0.8) } },   // ternyata ini bukan cuma Dimas
  { from: 35.4, a: { pos: V(-3.0, 1.5, 1.6), look: V(-3.6, 1.5, -1.8) }, b: { pos: V(-3.2, 1.5, 1.3), look: V(-3.6, 1.5, -1.8) } },  // peneliti di Universitas Chicago (the chart)
  { from: 38.4, a: { pos: V(-2.4, 1.5, 3.4), look: V(-2.65, 1.45, -0.8) }, b: { pos: V(-2.55, 1.5, 3.1), look: V(-2.7, 1.5, -0.8) } }, // tidur empat jam, dua malam (the clock)
  { from: 41.4, a: { pos: V(-3.0, 1.5, 1.6), look: V(-3.6, 1.5, -1.8) }, b: { pos: V(-3.2, 1.5, 1.3), look: V(-3.6, 1.5, -1.8) } },  // nafsu makan naik hampir seperempat
  { from: 44.0, a: { pos: V(-2.5, 1.35, 2.8), look: V(-2.3, 1.35, -0.6) }, b: { pos: V(-2.35, 1.35, 2.3), look: V(-2.3, 1.35, -0.6) } }, // ngidam manis, asin, berkarbo
  { from: 47.0, a: { pos: V(0.9, 1.3, 4.0), look: V(0.05, 1.2, 0.7) }, b: { pos: V(0.7, 1.3, 3.5), look: V(0.05, 1.2, 0.7) } },     // tapi ini baru satu studi (Rani doubts)
  { from: 50.6, a: { pos: V(-1.4, 1.5, 4.4), look: V(-3.0, 0.8, -1.1) }, b: { pos: V(-2.0, 1.3, 3.6), look: V(-3.1, 0.75, -1.1) } },  // Malam itu Dimas tidur duluan
  { from: 52.7, a: { pos: V(2.8, 1.4, 4.4), look: V(2.2, 1.2, -1.0) }, b: { pos: V(2.4, 1.4, 3.6), look: V(2.2, 1.25, -1.0) } },   // Mang Udin sepi
  { from: 55.14, a: { pos: V(2.4, 1.4, 3.6), look: V(2.2, 1.25, -1.0) }, b: HOOK },                                              // the camera flies back to the first shot (the loop)
  { from: 57.0, a: HOOK, b: HOOK },
];
const DIMAS_FACES: [number, Expr, Arms][] = [[0, "hungry", "belly"], [3.4, "sleepy", "down"], [5.1, "sleepy", "up"], [5.9, "sleepy", "down"], [6.6, "calm", "down"], [7.8, "grin", "shrug"], [8.7, "calm", "down"], [14.5, "calm", "down"], [19.9, "puzzled", "down"], [23.5, "hungry", "belly"], [25.6, "hungry", "point"], [28.6, "puzzled", "down"], [30.8, "hungry", "belly"], [33.6, "calm", "down"], [38.4, "sleepy", "down"], [41.4, "shocked", "belly"], [42.9, "shocked", "up"], [44.0, "hungry", "belly"], [47.0, "calm", "down"], [50.6, "sleepy", "down"], [56.2, "hungry", "belly"]];
const UDIN_FACES: [number, Expr, Arms][] = [[0, "grin", "wave"], [3.4, "sly", "down"], [9.0, "grin", "wave"], [11.8, "grin", "down"], [13.9, "grin", "wave"], [14.5, "calm", "down"], [33.6, "sly", "down"], [50.6, "sleepy", "down"]];
const RANI_FACES: [number, Expr, Arms][] = [[0, "calm", "down"], [14.5, "sly", "point"], [16.8, "calm", "down"], [19.9, "puzzled", "down"], [47.0, "puzzled", "down"], [48.6, "calm", "shrug"], [50.2, "calm", "hips"], [52.0, "calm", "down"]];
/** The alarm clock in minutes after midnight: 00:12, then "satu jam, dua jam" (02:12), then the study's four hours run past (04:12); it resets with the loop. */
const CLOCK_KEYS: [number, number][] = [[0, 12], [21.7, 12], [22.1, 72], [22.8, 132], [39.3, 132], [41.0, 252], [56.0, 252], [56.8, 12], [70, 12]];
/** The bar chart on the wall: the "kurang tidur" bar grows from the normal height by 24 % on "hampir seperempat". */
const BAR_KEYS: [number, number][] = [[0, 1], [43.2, 1], [44.0, 1.24], [56.0, 1.24], [56.8, 1], [70, 1]];
/** The three foods on the counter pop on their word. */
const POPS = { nasi: 25.84, gorengan: 27.1, teh: 28.04 };
const PILLS: Pill[] = [
  { at: 28.74, until: 30.7, text: "bukan sayur, bukan buah", key: "bukan", color: "#ff6b3d", y: 330 },
  { at: 35.56, until: 38.4, text: "Studi UChicago 2004", key: "2004", color: "#ffb02e", y: 330 },
  { at: 38.54, until: 41.4, text: "tidur 4 jam × 2 malam", key: "4 jam × 2 malam", color: "#ffb02e", y: 330 },
  { at: 43.18, until: 47.0, text: "nafsu makan +24%", key: "+24%", color: "#ff6b3d", y: 470 },
  { at: 44.64, until: 47.0, text: "ngidam manis, asin, karbo", key: "manis, asin, karbo", color: "#ffb02e", y: 330 },
  { at: 47.92, until: 50.5, text: "baru satu studi", key: "satu studi", color: "#ffb02e", y: 330 },
];
const HOOK_LINES: { text: string; key?: string }[] = [{ text: "Dimas ", key: "begadang," }, { text: "jajan ", key: "terus" }];

// ---------- painted textures ------------------------------------------------------------------------------------------------------
const asphalt = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#454d6a"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${rnd(i) > 0.5 ? "255,255,255" : "0,0,0"},.07)`; c.fillRect(rnd(i * 3) * 256, rnd(i * 7) * 256, 2 + rnd(i * 5) * 5, 2 + rnd(i * 11) * 5); }
  c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 40); c.lineTo(90, 70); c.lineTo(120, 130); c.stroke();
};
const roomWall = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#e8c98a"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(120,80,30,${0.03 + rnd(i) * 0.05})`; c.beginPath(); c.arc(rnd(i * 3) * 256, rnd(i * 7) * 256, 8 + rnd(i * 5) * 26, 0, 7); c.fill(); }
  c.fillStyle = "#a8743a"; c.fillRect(0, 226, 256, 30);
};
const roomFloor = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#7c8f86"; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? "#8da097" : "#6f8279"; c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
};
const blanket = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#e8d56a"; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "#e0884a"; for (let y = 0; y < 128; y += 32) c.fillRect(0, y, 128, 12);
  c.fillStyle = "#6e3d9a"; for (let x = 0; x < 128; x += 32) c.fillRect(x, 0, 6, 128);
};
const awningTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#f4efe0"; c.fillRect(0, 0, 256, 128);
  c.fillStyle = "#2f9e6a"; for (let x = 0; x < 256; x += 64) c.fillRect(x, 0, 32, 128);
};
const stallWall = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#2b6f78"; c.fillRect(0, 0, 256, 256);
  c.fillStyle = "rgba(255,255,255,.07)"; for (let x = 0; x < 256; x += 22) c.fillRect(x, 0, 6, 256);
  for (let i = 0; i < 30; i++) { c.fillStyle = "rgba(0,0,0,.06)"; c.fillRect(rnd(i) * 256, rnd(i * 4) * 256, 30, 3); }
};
const signTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#f6e9b8"; c.fillRect(0, 0, 512, 160);
  c.strokeStyle = "#7a2d1a"; c.lineWidth = 12; c.strokeRect(10, 10, 492, 140);
  c.fillStyle = "#7a2d1a"; c.font = "900 96px Arial Black, Arial"; c.textAlign = "center"; c.fillText("BURJO", 256, 108);
};
const phoneScreen = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#101826"; c.fillRect(0, 0, 256, 460);
  c.fillStyle = "#35d29a"; c.font = "900 30px Arial Black, Arial"; c.textAlign = "center"; c.fillText("KALORI", 128, 54);
  c.lineWidth = 22; c.strokeStyle = "#233048"; c.beginPath(); c.arc(128, 200, 74, 0, 7); c.stroke();
  c.strokeStyle = "#35d29a"; c.beginPath(); c.arc(128, 200, 74, -Math.PI / 2, Math.PI * 0.9); c.stroke();
  c.fillStyle = "#fff"; c.font = "900 40px Arial Black, Arial"; c.fillText("1.840", 128, 212);
  c.fillStyle = "#8fa0bf"; c.font = "700 24px Arial"; c.fillText("kkal hari ini", 128, 244);
  c.fillStyle = "#ffb02e"; c.beginPath(); c.roundRect(40, 330, 176, 54, 14); c.fill();
  c.fillStyle = "#17141c"; c.font = "900 26px Arial Black, Arial"; c.fillText("CATAT", 128, 366);
};
const chartTex = (c: CanvasRenderingContext2D) => {
  c.clearRect(0, 0, 256, 350);
  c.fillStyle = "#17141c"; c.font = "900 30px Arial Black, Arial"; c.textAlign = "center"; c.fillText("NAFSU MAKAN", 128, 44);
  c.font = "800 22px Arial"; c.fillText("tidur normal", 62, 318); c.fillText("tidur 4 jam", 192, 318);
  c.fillRect(20, 300, 216, 6);
};
const cityTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#242046"; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) { c.fillStyle = rnd(y * 7 + x) > 0.55 ? "#ffd27a" : "#34305c"; c.fillRect(x * 42 + 8, y * 30 + 10, 24, 16); }
};
const softDot = () => painted(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
const glowTex = () => painted(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,225,150,1)"); g.addColorStop(0.3, "rgba(255,190,100,.35)"); g.addColorStop(1, "rgba(255,170,80,0)"); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });

/** The digital alarm clock: its face is redrawn every frame. */
const ClockFace: React.FC<{ minutes: number }> = ({ minutes }) => {
  const tex = useMemo(() => painted(256, 128, () => undefined), []);
  const c = (tex.image as HTMLCanvasElement).getContext("2d")!;
  const m = Math.round(minutes), hh = String(Math.floor(m / 60) % 24).padStart(2, "0"), mm = String(m % 60).padStart(2, "0");
  c.fillStyle = "#1a0d0d"; c.fillRect(0, 0, 256, 128);
  c.fillStyle = "#ff3b2e"; c.font = "900 92px Arial Black, Arial"; c.textAlign = "center"; c.fillText(`${hh}:${mm}`, 128, 98);
  tex.needsUpdate = true;
  return <mesh position={[-2.55, 2.14, -1.77]}><planeGeometry args={[0.46, 0.23]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>;
};

const Steam: React.FC<{ x: number; y: number; z: number; f: number; tex: THREE.Texture }> = ({ x, y, z, f, tex }) => (
  <>
    {[0, 1, 2].map((i) => {
      const k = ((f / 60 + i / 3) % 1);
      return <sprite key={i} position={[x + Math.sin(k * 6 + i) * 0.04, y + k * 0.55, z]} scale={[0.22 + k * 0.2, 0.22 + k * 0.2, 1]}><spriteMaterial map={tex} transparent opacity={0.5 * (1 - k)} depthWrite={false} /></sprite>;
    })}
  </>
);

const World: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const tex = useMemo(() => ({ asphalt: painted(256, 256, asphalt, 4, 3), wall: painted(256, 256, roomWall), floor: painted(256, 256, roomFloor), blanket: painted(128, 128, blanket), awning: painted(256, 128, awningTex), stall: painted(256, 256, stallWall), sign: painted(512, 160, signTex), phone: painted(256, 460, phoneScreen), city: painted(256, 256, cityTex, 6, 1), chart: painted(256, 350, chartTex), soft: softDot(), glow: glowTex() }), []);
  const minutes = keyed(CLOCK_KEYS, t), bar = keyed(BAR_KEYS, t);
  const pop = (at: number) => { const s = t - at; return s < 0 ? 0.001 : s < 0.35 ? 1 + 0.2 * Math.sin((s / 0.35) * Math.PI) : 1; };
  const bulbs = [0.8, 1.55, 2.3, 3.05, 3.8];
  return (
    <group>
      {/* the street */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[24, 14]} /><meshStandardMaterial map={tex.asphalt} roughness={0.95} /></mesh>
      <TBox size={[26, 6, 0.3]} pos={[0, 3, -7]} map={tex.city} tile={2} />
      <mesh position={[-4.5, 7, -11]}><sphereGeometry args={[0.9, 24, 18]} /><meshBasicMaterial color="#f4efd2" toneMapped={false} /></mesh>
      {/* Dimas's room, cut open toward the camera */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.55, 0.02, -0.7]} receiveShadow><planeGeometry args={[3.3, 2.7]} /><meshStandardMaterial map={tex.floor} roughness={0.8} /></mesh>
      <TBox size={[3.4, 3, 0.15]} pos={[-2.55, 1.5, -2.0]} map={tex.wall} tile={1.2} />
      <TBox size={[0.15, 3, 2.7]} pos={[-4.25, 1.5, -0.7]} map={tex.wall} tile={1.2} />
      <TBox size={[0.15, 3, 1.1]} pos={[-0.85, 1.5, -1.45]} map={tex.wall} tile={1.2} />
      <TBox size={[3.4, 0.12, 2.8]} pos={[-2.55, 3.05, -0.65]} color="#3a2f55" />
      <TBox size={[0.8, 0.9, 0.04]} pos={[-1.5, 1.9, -1.93]} color="#0b1430" emissive="#2d4f9a" />
      <TBox size={[0.9, 0.05, 0.05]} pos={[-1.5, 1.9, -1.9]} color="#f2ead8" />
      <TBox size={[0.05, 1.0, 0.05]} pos={[-1.5, 1.9, -1.9]} color="#f2ead8" />
      {/* the bed with a striped blanket and a pillow */}
      <TBox size={[1.9, 0.35, 1.0]} pos={[-3.15, 0.18, -1.35]} color="#b07e4e" />
      <TBox size={[1.85, 0.2, 0.95]} pos={[-3.15, 0.45, -1.35]} map={tex.blanket} tile={0.9} />
      <TBox size={[0.5, 0.16, 0.7]} pos={[-3.85, 0.62, -1.35]} color="#f6f1e6" />
      {/* the desk, the laptop, a lamp, a mug and the alarm clock on a shelf */}
      <TBox size={[1.3, 0.06, 0.6]} pos={[-1.75, 0.9, -1.65]} color="#9c6a3c" rough={0.6} />
      <TBox size={[0.06, 0.9, 0.06]} pos={[-2.35, 0.45, -1.4]} color="#5a3b1f" />
      <TBox size={[0.06, 0.9, 0.06]} pos={[-1.15, 0.45, -1.4]} color="#5a3b1f" />
      <TBox size={[0.5, 0.03, 0.34]} pos={[-1.95, 0.95, -1.6]} color="#c4c8d0" rough={0.3} />
      <group position={[-1.95, 0.96, -1.78]} rotation={[-0.22, 0, 0]}><TBox size={[0.5, 0.32, 0.02]} pos={[0, 0.17, 0]} color="#bcd6e8" emissive="#4f8fc0" /></group>
      <mesh position={[-1.3, 1.0, -1.65]} castShadow><cylinderGeometry args={[0.05, 0.045, 0.1, 16]} /><meshStandardMaterial color="#e86a4a" roughness={0.4} /></mesh>
      <mesh position={[-2.3, 1.12, -1.8]}><sphereGeometry args={[0.07, 14, 10]} /><meshBasicMaterial color="#ffe6b0" toneMapped={false} /></mesh>
      <TBox size={[0.7, 0.05, 0.28]} pos={[-2.55, 2.0, -1.82]} color="#8a5a32" />
      <TBox size={[0.5, 0.24, 0.12]} pos={[-2.55, 2.14, -1.84]} color="#2a2430" />
      <ClockFace minutes={minutes} />
      {/* the bar chart on the wall: normal sleep against four hours, the second bar grows by 24 % */}
      <TBox size={[1.1, 1.5, 0.04]} pos={[-3.6, 1.7, -1.9]} color="#f6f1e6" />
      <mesh position={[-3.6, 1.7, -1.875]}><planeGeometry args={[1.1, 1.5]} /><meshBasicMaterial map={tex.chart} transparent toneMapped={false} /></mesh>
      <TBox size={[0.35, 0.7, 0.05]} pos={[-3.85, 1.55, -1.86]} color="#5fb3ff" />
      <TBox size={[0.35, 0.7 * bar, 0.05]} pos={[-3.4, 1.2 + 0.35 * bar, -1.86]} color="#ff7a3d" />
      {/* a standing fan, foreground of the room */}
      <TBox size={[0.04, 1.1, 0.04]} pos={[-0.95, 0.55, -0.1]} color="#8aa0a6" />
      <TBox size={[0.4, 0.04, 0.3]} pos={[-0.95, 0.02, -0.1]} color="#8aa0a6" />
      <group position={[-0.95, 1.2, -0.05]} rotation={[0, 0, f * 0.7]}>{[0, 1, 2].map((i) => <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0.12, 0]}><boxGeometry args={[0.1, 0.26, 0.01]} /><meshStandardMaterial color="#cfe3e6" /></mesh>)}</group>
      <pointLight position={[-2.0, 1.4, -1.0]} intensity={1.6} distance={4} decay={2} color="#ffc98a" />
      <pointLight position={[-1.95, 1.2, -1.4]} intensity={0.9} distance={2.5} decay={2} color="#9fd4ff" />
      {/* the burjo stall */}
      <TBox size={[3.4, 2.6, 0.12]} pos={[2.2, 1.3, -1.6]} map={tex.stall} tile={1.2} />
      <mesh position={[2.2, 2.9, -1.5]}><planeGeometry args={[1.6, 0.5]} /><meshBasicMaterial map={tex.sign} color="#9a9a9a" toneMapped={false} /></mesh>
      <TBox size={[2.5, 0.95, 0.8]} pos={[2.2, 0.475, -0.6]} color="#b9854f" rough={0.7} />
      <TBox size={[2.6, 0.06, 0.86]} pos={[2.2, 0.98, -0.6]} color="#6d4427" rough={0.5} />
      <group position={[2.2, 2.45, -0.7]} rotation={[0.22, 0, 0]}><TBox size={[3.2, 0.06, 1.7]} pos={[0, 0, 0]} map={tex.awning} tile={1} /></group>
      <TBox size={[0.06, 2.4, 0.06]} pos={[0.65, 1.2, 0.05]} color="#7a7f88" />
      <TBox size={[0.06, 2.4, 0.06]} pos={[3.75, 1.2, 0.05]} color="#7a7f88" />
      {bulbs.map((x, i) => <mesh key={x} position={[x, 2.3 - 0.02 * (i % 2), 0.05]}><sphereGeometry args={[0.06, 12, 10]} /><meshBasicMaterial color="#fff0c0" toneMapped={false} /></mesh>)}
      <pointLight position={[2.2, 2.1, 0.0]} intensity={2.6 + 0.2 * Math.sin(f * 0.37)} distance={6} decay={2} color="#ffbe6a" />
      <sprite position={[2.2, 2.2, 0.1]} scale={[2.6, 1.1, 1]}><spriteMaterial map={tex.glow} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></sprite>
      {/* on the counter: nasi, gorengan, es teh, a pot with steam (the foods pop on their word) */}
      <group position={[1.5, 1.01, -0.55]} scale={pop(POPS.nasi) * 1.5}>
        <mesh castShadow><cylinderGeometry args={[0.2, 0.18, 0.04, 24]} /><meshStandardMaterial color="#3f8f5a" roughness={0.4} /></mesh>
        <mesh position={[0, 0.07, 0]} castShadow><sphereGeometry args={[0.15, 18, 12, 0, 6.3, 0, 1.45]} /><meshStandardMaterial color="#fffdf2" roughness={0.9} /></mesh>
        <mesh position={[0.02, 0.2, 0]} castShadow><cylinderGeometry args={[0.1, 0.1, 0.012, 24]} /><meshStandardMaterial color="#ffffff" roughness={0.5} /></mesh>
        <mesh position={[0.02, 0.215, 0]} castShadow><sphereGeometry args={[0.04, 14, 10]} /><meshStandardMaterial color="#ffc21a" roughness={0.4} /></mesh>
      </group>
      <group position={[2.2, 1.01, -0.55]} scale={pop(POPS.gorengan) * 1.5}>
        <mesh castShadow><cylinderGeometry args={[0.24, 0.22, 0.03, 24]} /><meshStandardMaterial color="#d9534a" roughness={0.4} /></mesh>
        {[[-0.1, 0.05, 0], [0.1, 0.05, 0.02], [0, 0.05, -0.1], [0, 0.05, 0.1], [-0.05, 0.14, 0.02], [0.07, 0.14, -0.03], [0.0, 0.22, 0.0]].map((p, i) => <mesh key={i} position={p as [number, number, number]} rotation={[0.3 * i, 0.5 * i, 0.2]} castShadow><boxGeometry args={[0.12, 0.07, 0.08]} /><meshStandardMaterial color={["#d99a2b", "#c9821d", "#e5ad3f"][i % 3]} roughness={0.7} /></mesh>)}
      </group>
      <group position={[3.0, 1.01, -0.55]} scale={pop(POPS.teh) * 1.5}>
        <mesh position={[0, 0.17, 0]} castShadow><cylinderGeometry args={[0.1, 0.09, 0.34, 20]} /><meshStandardMaterial color="#c9741a" transparent opacity={0.85} roughness={0.2} /></mesh>
        {[[-0.03, 0.3, 0.02], [0.03, 0.26, -0.02], [0, 0.34, 0.03]].map((p, i) => <mesh key={i} position={p as [number, number, number]} rotation={[0.4 * i, 0.3, 0.2]}><boxGeometry args={[0.05, 0.05, 0.05]} /><meshStandardMaterial color="#e8f6ff" roughness={0.2} /></mesh>)}
      </group>
      <mesh position={[3.45, 1.15, -1.1]} castShadow><cylinderGeometry args={[0.2, 0.2, 0.3, 24]} /><meshStandardMaterial color="#b0b4bc" roughness={0.35} metalness={0.4} /></mesh>
      <Steam x={3.45} y={1.35} z={-1.1} f={f} tex={tex.soft} />
      <mesh position={[0.9, 0.22, 0.4]} castShadow><cylinderGeometry args={[0.2, 0.18, 0.44, 16]} /><meshStandardMaterial color="#3e8e5a" roughness={0.6} /></mesh>
      {/* the street lamp with moths, a motorbike, a cat, pots in the foreground */}
      <TBox size={[0.08, 3.2, 0.08]} pos={[0.35, 1.6, -1.3]} color="#4a4f5c" />
      <TBox size={[0.55, 0.06, 0.2]} pos={[0.55, 3.2, -1.3]} color="#4a4f5c" />
      <mesh position={[0.7, 3.12, -1.3]}><sphereGeometry args={[0.1, 14, 10]} /><meshBasicMaterial color="#fff2c8" toneMapped={false} /></mesh>
      <pointLight position={[0.7, 3.0, -1.0]} intensity={1.8} distance={6} decay={2} color="#ffd9a0" />
      {[0, 1, 2, 3].map((i) => { const a = f * (0.09 + i * 0.02) + i * 1.7; return <mesh key={i} position={[0.7 + Math.cos(a) * 0.3, 3.0 + Math.sin(a * 1.7) * 0.15, -1.3 + Math.sin(a) * 0.3]}><boxGeometry args={[0.035, 0.015, 0.05]} /><meshBasicMaterial color="#f4ead0" toneMapped={false} /></mesh>; })}
      <group position={[3.9, 0, 1.1]} rotation={[0, -0.5, 0]}>
        <TBox size={[1.0, 0.18, 0.28]} pos={[0, 0.42, 0]} color="#c64040" />
        <TBox size={[0.4, 0.22, 0.3]} pos={[-0.15, 0.62, 0]} color="#252a35" />
        <TBox size={[0.06, 0.4, 0.06]} pos={[0.45, 0.7, 0]} color="#8d929c" />
        {[-0.45, 0.45].map((x) => <mesh key={x} position={[x, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.22, 0.22, 0.08, 20]} /><meshStandardMaterial color="#1c1f27" roughness={0.9} /></mesh>)}
        <mesh position={[0.55, 0.55, 0]}><sphereGeometry args={[0.06, 12, 10]} /><meshBasicMaterial color="#fffbe0" toneMapped={false} /></mesh>
      </group>
      <group position={[1.05, 0.3, 0.45]}>
        <mesh castShadow><boxGeometry args={[0.34, 0.2, 0.18]} /><meshStandardMaterial color="#d99a52" roughness={0.9} /></mesh>
        <mesh position={[0.2, 0.08, 0]} castShadow><boxGeometry args={[0.16, 0.15, 0.15]} /><meshStandardMaterial color="#d99a52" roughness={0.9} /></mesh>
        {[0.15, 0.27].map((x) => <mesh key={x} position={[x, 0.2, 0.05]}><coneGeometry args={[0.035, 0.07, 4]} /><meshStandardMaterial color="#d99a52" /></mesh>)}
        <group position={[-0.17, 0.04, 0]} rotation={[0, 0, 0.6 + 0.4 * Math.sin(f * 0.12)]}><mesh position={[-0.12, 0, 0]}><boxGeometry args={[0.26, 0.04, 0.04]} /><meshStandardMaterial color="#c8863c" /></mesh></group>
      </group>
      <TBox size={[0.4, 0.2, 0.4]} pos={[1.05, 0.1, 0.45]} color="#8a5a32" />
      {([[-0.9, 1.6, "#4f9b5a"], [3.2, 2.0, "#3c8a64"]] as [number, number, string][]).map(([x, z, col], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.2, 0.15, 0.4, 16]} /><meshStandardMaterial color="#b5653a" roughness={0.8} /></mesh>
          {[0, 1, 2, 3].map((k) => <mesh key={k} position={[Math.cos(k * 1.6) * 0.14, 0.55 + 0.1 * k, Math.sin(k * 1.6) * 0.14]} rotation={[0.3 * Math.sin(f * 0.05 + k), 0, 0.5]}><sphereGeometry args={[0.2 - k * 0.02, 12, 10]} /><meshStandardMaterial color={col} roughness={0.8} /></mesh>)}
        </group>
      ))}
      {/* the phone Rani holds up (it hovers in front of her at hand height) */}
      <group position={[0.25, 1.15 + 0.02 * Math.sin(f * 0.1), 0.95]} rotation={[0, -0.25, 0]}>
        <TBox size={[0.34, 0.6, 0.03]} pos={[0, 0, 0]} color="#17141c" />
        <mesh position={[0, 0, 0.018]}><planeGeometry args={[0.3, 0.54]} /><meshBasicMaterial map={tex.phone} color="#9a9a9a" toneMapped={false} /></mesh>
      </group>
    </group>
  );
};

/** The people speak only lines the story has them say (a quote inside the narration); everything else is the narrator, so no mouth moves: who, from, to, and "w" = mouth flaps on the words, "o" = held open (a yawn). */
const TALK: [string, number, number, "w" | "o"][] = [
  ["d", 5.1, 5.9, "o"], ["r", 17.3, 19.5, "w"],   // a yawn (no words) and the one line a person really says: Rani, "itu cuma kebiasaan, bukan lapar beneran"
];
const WORD_LIST = WORDS as { w: string; a: number; b: number }[];
const flap = (t: number) => { for (const x of WORD_LIST) if (t >= x.a && t < x.b - 0.04) return 0.3 + 0.7 * Math.abs(Math.sin((t - x.a) * 17)); return 0; };
const talkOf = (who: string, t: number) => { for (const [p, a, b, m] of TALK) if (p === who && t >= a && t < b) return m === "o" ? 1 : flap(t); return 0; };
const speaking = (who: string, t: number) => TALK.some(([p, a, b]) => p === who && t >= a && t < b);
/** Acting beats: [kind, from, to, amount]. hop = a jump (height), lean = tilts and holds (rad, + = left), shake = shivers (rad). */
type Beat = ["hop" | "lean" | "shake", number, number, number];
const beatsAt = (beats: Beat[], t: number) => {
  let hop = 0, lean = 0;
  for (const [k, a, b, v] of beats) {
    if (t < a || t >= b) continue;
    const u = (t - a) / (b - a);
    if (k === "hop") hop += Math.sin(u * Math.PI) * v;
    else if (k === "lean") lean += Math.min(1, u * 5, (1 - u) * 5) * v;
    else lean += Math.sin(t * 40) * v * Math.min(1, u * 6, (1 - u) * 6);
  }
  return { hop, lean };
};
const D_BEATS: Beat[] = [["lean", 0.2, 3.2, -0.05], ["hop", 2.5, 2.95, 0.12], ["shake", 2.0, 3.3, 0.03], ["lean", 3.6, 6.0, -0.06], ["lean", 7.8, 8.6, 0.06], ["shake", 20.3, 21.5, 0.05], ["hop", 21.7, 22.05, 0.1], ["hop", 22.7, 23.05, 0.1],
  ["shake", 24.0, 25.4, 0.03], ["lean", 28.7, 29.3, 0.12], ["lean", 29.7, 30.3, 0.12], ["shake", 31.0, 33.0, 0.04], ["hop", 34.3, 34.7, 0.1], ["hop", 42.9, 43.6, 0.3], ["lean", 44.2, 46.8, -0.1], ["hop", 44.6, 44.9, 0.08], ["hop", 45.7, 46.0, 0.08]];
const R_BEATS: Beat[] = [["lean", 14.8, 16.5, 0.06], ["hop", 15.6, 15.9, 0.1], ["hop", 17.3, 17.6, 0.08], ["hop", 18.7, 19.0, 0.08], ["lean", 47.5, 50.0, 0.08], ["hop", 47.9, 48.2, 0.1], ["shake", 33.9, 34.7, 0.03]];
const U_BEATS: Beat[] = [["hop", 9.1, 9.5, 0.08], ["lean", 9.6, 11.4, -0.07], ["hop", 12.0, 12.3, 0.1], ["hop", 12.7, 13.0, 0.1], ["hop", 13.3, 13.6, 0.1], ["lean", 52.9, 55.0, 0.1]];
/** Positions: Dimas paces in the wide shot, Rani walks over to him on "bukan cuma Dimas", and goes back while the camera is on the chart. */
const DIMAS_X: [number, number][] = [[0, -2.3], [6.5, -2.3], [7.4, -1.5], [8.7, -1.5], [10.5, -2.3], [28.6, -2.3], [29.0, -2.65], [29.9, -2.65], [30.4, -2.3], [70, -2.3]];
const RANI_X: [number, number][] = [[0, -0.1], [33.6, -0.1], [34.9, -1.2], [35.5, -1.2], [37.0, -0.1], [70, -0.1]];
const READ = [...readWords(WORDS), { w: "Dimas", a: 57.0, b: 57.34 }];   // the first word comes back on the last 0.3 s so the loop holds

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const cam = camAt(SHOTS, t, TOTAL);
  const [, dExpr, dArms] = stepAt(DIMAS_FACES, t);
  const [, uExpr, uArms] = stepAt(UDIN_FACES, t);
  const [, rExpr, rArms] = stepAt(RANI_FACES, t);
  const asleep = t >= 51.5 && t < 56.2;                          // after "tidur duluan" Dimas lies on the bed until the loop-back
  const person = (id: string, bt: Beat[], xs: [number, number][] | null) => {
    const m = beatsAt(bt, t), x = xs ? keyed(xs, t) : 0;
    const v = xs ? Math.abs(keyed(xs, t + 0.05) - keyed(xs, t - 0.05)) : 0;
    return { x, props: { talk: talkOf(id, t), act: speaking(id, t) ? 1 : 0, hop: m.hop, lean: m.lean, step: v > 0.02 ? f * 0.55 : 0 } };
  };
  const D = person("d", D_BEATS, DIMAS_X), R = person("r", R_BEATS, RANI_X), U = person("u", U_BEATS, UDIN_X);
  const hookA = t < 3.1 ? 1 : t < 3.4 ? 1 - (t - 3.1) / 0.3 : t >= 56.4 ? Math.min(1, (t - 56.4) / 0.6) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      <ThreeCanvas shadows width={FRAME.width} height={FRAME.height} camera={{ fov: 40, near: 0.05, far: 60, position: HOOK.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={[NIGHT]} />
        <fog attach="fog" args={[NIGHT, 7, 20]} />
        <hemisphereLight args={["#8f82e0", "#3a2e44", 0.85]} />
        <directionalLight position={[-5, 6, 4]} intensity={0.9} color="#a9b8ff" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={5} shadow-camera-bottom={-3} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={0.3} />
        <World t={t} f={f} />
        {asleep
          ? <group position={[-2.7, 0.66, -1.15]} rotation={[0, 0, Math.PI / 2]}><StickHero pos={V(0, 0, 0)} expr="sleepy" arms="down" f={f} outfit={DIMAS} height={1.5} /></group>
          : <StickHero pos={V(D.x, 0, DIMAS_AT.z)} expr={dExpr} arms={dArms} f={f} outfit={DIMAS} {...D.props} />}
        <StickHero pos={V(U.x, 0, UDIN_AT.z)} expr={uExpr} arms={uArms} f={f} outfit={UDIN} {...U.props} />
        <StickHero pos={V(R.x, 0, RANI_AT.z)} expr={rExpr} arms={rArms} f={f} outfit={RANI} {...R.props} />
      </ThreeCanvas>
      <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: hookA }}>
        {HOOK_LINES.map((l) => (
          <div key={l.text} style={{ background: "#000", padding: "10px 34px", fontFamily: "Outfit, Arial Black, sans-serif", fontWeight: 900, fontSize: 132, color: "#fff", lineHeight: 1.05 }}>
            {l.text}<span style={{ color: "#ffd447" }}>{l.key}</span>
          </div>
        ))}
      </div>
      <Pills pills={PILLS} t={t} />
      <WordCaption words={READ} t={t} />
    </AbsoluteFill>
  );
};
