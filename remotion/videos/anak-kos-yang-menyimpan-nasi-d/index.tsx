/* Anak Kos yang Menyimpan Nasi di Magic Com Semalaman (look ricks, B46): a made-up story carried by one true fact. Mas Fajar leaves cooked rice twelve hours in an unplugged rice cooker,
   Bu Wulan, the sharp-eyed landlady of a ten-room boarding house, warns him, he grins and eats three plates of it; hours later the whole house queues for the one WC. Bacillus cereus spores
   survive cooking, wake in lukewarm rice, multiply and make a toxin that reheating does not destroy (BfR 2008, FSAI 2016). The picture follows the voice (words.json from faster-whisper):
   one shot per sentence, one caption word at a time, pills on their word (B45), mouths move only on the three quoted lines (B46 n), the last shot is Fajar handing the pot to Bu Wulan and the
   cut after it returns to the first shot (the loop). The set is the video's own: a boarding-house kitchen (lime wall, tiled splash, concrete counter, gas hob and cylinder, wall rack), a corridor of ten numbered
   doors and a WC, and a back yard with banana plants, laundry, a fence and a motorbike. The peak (B46 h): all ten doors burst open at once and the sandals fly out. */
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FRAME } from "../../src/tokens.ts";
import { CAST, RicksCamera, RicksPost, StickHero, Pills, WordCaption, camAt, painted, readWords, rnd, stepAt, INK, V, type Cam, type Expr, type Outfit, type Pill, type Shot } from "../../src/ricks/kit.tsx";
import { handOffset, poseAt, reach, POSES, type Pose } from "../../src/ricks/rig.ts";
import { choreoAt, locomote, type Choreo } from "../../src/ricks/choreo.ts";
import type { StoryT } from "../../src/schema.ts";
import storyJson from "./story.json";
import WORDS from "./words.json";

export const story = storyJson as unknown as StoryT;
const FPS = 30;
export const TOTAL = 55.44;
const LOOP_AT = 54.74;   // after the last spoken word has ended; from here the picture holds the first moment (the loop)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const prog = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (u: number) => u * u * (3 - 2 * u);
const pop = (s: number) => (s < 0 ? 0.001 : s < 0.35 ? 1 + 0.25 * Math.sin((s / 0.35) * Math.PI) : 1);
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
const bump = (u: number) => (u < -0.35 || u > 0.35 ? 0 : u < 0 ? 1 + u / 0.35 : 1 - u / 0.35);
const A8 = (lSh: number, lEl: number, rSh: number, rEl: number, x: Partial<Pose> = {}): Pose => ({ lSh, lEl, rSh, rEl, lHip: -8, lKn: 0, rHip: 8, rKn: 0, ...x });
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
const metalTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 256, 0); [0, "#aab6be", 0.18, "#e9f0f4", 0.34, "#8d9aa3", 0.5, "#c5d0d7", 0.7, "#f4f8fa", 0.86, "#8d9aa3", 1, "#aab6be"].forEach((v, i, a) => { if (i % 2 === 0) g.addColorStop(v as number, a[i + 1] as string); });
  c.fillStyle = g; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 400, ["rgba(255,255,255,.12)", "rgba(0,0,0,.08)"], 2, 6);
};
const softTex = (c: CanvasRenderingContext2D) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); };
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


// ---------- the layout: the shared kitchen of a boarding house (x -3.4 to 1.5), the corridor of ten room doors and the WC (x 1.5 to 11.5), the back yard (x > 11.5) ------------------------------
const MC = { x: -1.4, y: 0.74, z: -0.6 };   // the rice cooker on the concrete counter (its base)
const F0 = { x: -1.8, z: 0.2 }, W0 = { x: 0.9, z: 0.2 }, W1 = { x: -1.05, z: 0.2 };
const DOOR_X = (i: number) => 2.2 + 0.62 * i, WC_X = 8.9;
const SOCKET = V(-0.72, 1.0, -1.27);
const INS = V(-0.2, 1.55, -0.1);   // the round magnifier that floats beside the rice cooker when the story looks at rice, a palm or the spores
const C = (px: number, py: number, pz: number, lx: number, ly: number, lz: number): Cam => ({ pos: V(px, py, pz), look: V(lx, ly, lz) });
const HOOK = C(-1.55, 1.3, 4.0, -1.55, 1.2, 0);   // Mas Fajar, head about 30 % of the width, the rice cooker at his side
// B62: the camera holds, the cuts do the variety; at most 40 % of the shots drift, none above 0.3 m/s
const SHOTS: Shot[] = [
  { from: 0, a: HOOK, b: C(-1.55, 1.3, 3.9, -1.55, 1.2, 0) },                                                 // Fajar and the dead rice cooker
  { from: 3.8, a: C(0.9, 1.25, 4.2, 0.9, 1.0, 0.1), b: C(0.9, 1.25, 4.2, 0.9, 1.0, 0.1) },                    // Bu Wulan, the sharp-eyed landlady
  { from: 7.14, a: C(4.9, 1.6, 14.5, 4.9, 1.05, -0.5), b: C(4.9, 1.6, 14.5, 4.9, 1.05, -0.5) },                 // the ten doors
  { from: 10.22, a: C(-1.4, 1.25, 4.3, -1.4, 1.0, 0), b: C(-1.4, 1.25, 4.3, -1.4, 1.0, 0) },                  // she raps the lid
  { from: 12.38, a: C(-1.4, 0.75, 4.8, -1.4, 1.15, 0), b: C(-1.4, 0.75, 4.8, -1.4, 1.15, 0) },              // her warning
  { from: 15.14, a: C(-2.05, 1.25, 3.8, -2.05, 1.0, 0.1), b: C(-2.05, 1.25, 3.8, -2.05, 1.0, 0.1) },              // Fajar grins
  { from: 18.18, a: C(-0.8, 1.3, 5.6, -0.8, 1.1, 0), b: C(-0.8, 1.3, 5.4, -0.8, 1.1, 0) },                    // morning: the lid is up, the rice is white
  { from: 21.98, a: C(-0.55, 1.5, 9.0, -0.55, 0.95, -0.3), b: C(-0.55, 1.5, 9.0, -0.55, 0.95, -0.3) },            // three plates, the friends line up
  { from: 25.34, a: C(-1.1, 1.3, 4.8, -1.1, 1.0, 0), b: C(-1.1, 1.3, 4.8, -1.1, 1.0, 0) },                    // her palm on the warm cooker
  { from: 29.06, a: C(-2.3, 1.2, 4.8, -2.3, 1.0, 0), b: C(-2.3, 1.2, 4.8, -2.3, 1.0, 0) },                    // Fajar's belly drums
  { from: 33.16, a: C(5.0, 1.5, 9.0, 5.0, 1.0, -0.5), b: C(5.0, 1.5, 9.0, 5.0, 1.0, -0.5) },                  // the friends hurry down the corridor
  { from: 35.56, a: C(4.9, 1.6, 14.5, 4.9, 1.05, -0.5), b: C(4.9, 1.6, 14.5, 4.9, 1.05, -0.5) },                // ten doors burst open, one WC
  { from: 37.72, a: C(10.4, 1.6, 8.6, 10.4, 1.0, 0), b: C(10.9, 1.6, 8.6, 10.9, 1.0, 0) },                      // TRUCK RIGHT: the line reaches the yard
  { from: 39.62, a: C(-0.6, 1.3, 5.6, -0.6, 1.1, 0), b: C(-0.6, 1.3, 5.6, -0.6, 1.1, 0) },                    // the spore
  { from: 42.22, a: C(-0.15, 1.3, 3.2, -0.15, 1.3, 0), b: C(-0.15, 1.3, 3.2, -0.15, 1.3, 0) },                        // it survives the cooking
  { from: 44.34, a: C(-0.6, 1.3, 5.6, -0.6, 1.1, 0), b: C(-0.6, 1.3, 5.6, -0.6, 1.1, 0) },                    // it wakes in the lukewarm rice
  { from: 47.0, a: C(-0.15, 1.3, 3.2, -0.15, 1.3, 0), b: C(-0.15, 1.3, 3.2, -0.15, 1.3, 0) },                         // it multiplies
  { from: 48.16, a: C(-0.6, 1.3, 5.6, -0.6, 1.1, 0), b: C(-0.6, 1.3, 4.8, -0.6, 1.1, 0) },                    // PUSH-IN: the toxin that the heat cannot kill
  { from: 51.18, a: C(-0.7, 1.3, 4.8, -0.7, 1.0, 0), b: C(-0.7, 1.3, 4.6, -0.7, 1.0, 0) },                    // the next morning
];

// ---------- the cast: every person is their own design (B61, B62, B63), none borrowed from an earlier video ------------------------------------------------------------------------------------------------
const FAJAR: Outfit = { shirt: "#e8892a", stripe: "#233a6b", garment: "jacket", pattern: "plain", hair: "quiff", hairColor: "#3b2418", glasses: true, freckles: true, nose: "dot", blush: true, brows: "thick" };
const WULAN: Outfit = { shirt: "#7a3fa0", stripe: "#f2d16b", garment: "apron", hair: "curly", hairColor: "#4a2a1e", lashes: true, lips: true, brows: "arched", mole: true, pocket: true, eyebags: true };
const E1: Outfit = { shirt: "#fbf7ee", stripe: "#1b6e4f", garment: "vest", hat: "headband", hatColor: "#d9352a", eyebags: true, body: "wide", nose: "big", brows: "bushy" };
const E2: Outfit = { shirt: "#ffd447", stripe: "#e0456b", pattern: "dots", hat: "beanie", hatColor: "#2a9d8f", beard: true, hairColor: "#6b3b1c", nose: "dot", freckles: true };
const E3: Outfit = { shirt: "#2fb7c9", stripe: "#ffffff", garment: "dress", hair: "afro", hairColor: "#2a1a14", lashes: true, lips: true, blush: true, brows: "arched" };
const E4: Outfit = { shirt: "#fbf7ee", stripe: "#9aa3ad", garment: "uniform", tie: "#c0392b", badge: true, hair: "sidepart", hairColor: "#17141c", wrinkles: true, glasses: true, brows: "thick", goatee: true };

// the three quoted lines (B46 n): only these words move a mouth
const TALK: Record<string, [number, number][]> = { wulan: [[12.38, 14.3]], fajar: [[16.7, 18.0], [53.62, 54.74]] };
const talkAt = (id: string, t: number) => {
  if (!(TALK[id] ?? []).some(([a, b]) => t >= a && t < b)) return 0;
  const w = WORDS.find((x) => t >= x.a - 0.02 && t < x.b + 0.05);
  return w ? 0.4 + 0.6 * Math.abs(Math.sin(t * 17)) : 0;
};

// ---------- the acted poses (hands reach canvas points, B52) ----------------------------------------------------------------------------------------------------------------------------------
const RAPS = [10.78, 11.1, 11.42];
const poseNamed = (name: string, t: number): Pose | null => {
  switch (name) {
    case "lidhand": { const r = reach("r", 490, 400 - 14 * bump(t - 1.76)), l = reach("l", 150, 560); return A8(l.sh, l.el, r.sh, r.el); }
    case "liftlid": { const k = prog(t, 18.2, 18.7) - prog(t, 21.0, 21.4), r = reach("r", 492, 400 - 110 * k), l = reach("l", 150, 560); return A8(l.sh, l.el, r.sh, r.el); }
    case "eyes": { const k = prog(t, 5.84, 6.1), r = reach("r", 330 - 40 * (1 - k), 350 + 120 * (1 - k)), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "rap": { const l = reach("l", 70, 420 - 20 * Math.max(0, ...RAPS.map((p) => bump(t - p)))), r = reach("r", 380, 600); return A8(l.sh, l.el, r.sh, r.el); }
    case "scold": { const l = reach("l", 40 + 20 * Math.sin(t * 9), 330), r = reach("r", 390, 560); return A8(l.sh, l.el, r.sh, r.el); }
    case "palm": { const l = reach("l", 70, 430 + 8 * Math.sin(t * 5)), r = reach("r", 380, 600); return A8(l.sh, l.el, r.sh, r.el); }
    case "gut": { const b = POSES.belly; return { ...b, lean: 7 * prog(t, 30.9, 31.8) - 7 * prog(t, 32.9, 33.1) }; }
    case "eat": { const u = (t * 1.7) % 1, r = reach("r", 312, 460 - 120 * Math.sin(Math.PI * u)), l = reach("l", 170, 540); return A8(l.sh, l.el, r.sh, r.el); }
    case "carry": { const l = reach("l", 210, 560), r = reach("r", 304, 560); return A8(l.sh, l.el, r.sh, r.el, { lean: -2 }); }
    case "offer": { const k = prog(t, 53.9, 54.3), l = reach("l", 200 - 110 * k, 560 - 40 * k), r = reach("r", 312 + 110 * k, 560 - 40 * k); return A8(l.sh, l.el, r.sh, r.el); }
    case "plugin": { const k = prog(t, 49.1, 49.5) - prog(t, 49.9, 50.2), r = reach("r", 380 + 90 * k, 600 - 210 * k), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "queue": { const l = reach("l", 160, 590), r = reach("r", 352, 590); return A8(l.sh, l.el, r.sh, r.el, { lean: 4 + 3 * Math.sin(t * 6) }); }
    default: return null;
  }
};

const FOREVER = 1000;
const ACTORS: { id: string; o: Outfit; tracks: Track[] }[] = [
  { id: "fajar", o: FAJAR, tracks: [
    { a: 0, b: 10.22, pos: stay(F0.x, F0.z), faces: [[0, "sly", "lidhand"], [3.8, "sly", "down"]] },
    { a: 10.22, b: 12.38, pos: stay(F0.x, F0.z), faces: [[10.22, "calm", "hips"]] },
    { a: 12.38, b: 15.14, pos: stay(F0.x, F0.z), faces: [[12.38, "puzzled", "hips"], [14.2, "sly", "hips"]] },
    { a: 15.14, b: 18.18, pos: stay(F0.x, F0.z), faces: [[15.14, "grin", "hips"], [16.7, "sly", "shrug"]], beats: [["hop", 15.98, 16.3, 0.09]] },
    { a: 18.18, b: 21.98, pos: stay(F0.x, F0.z), faces: [[18.18, "grin", "liftlid"]] },
    { a: 21.98, b: 25.34, pos: stay(F0.x, F0.z), faces: [[21.98, "hungry", "eat"], [24.0, "grin", "eat"]] },
    { a: 25.34, b: 29.06, pos: stay(F0.x, F0.z), faces: [[25.34, "grin", "hips"]] },
    { a: 29.06, b: 33.16, pos: stay(F0.x, F0.z), faces: [[29.06, "puzzled", "gut"], [30.94, "shocked", "gut"]], beats: [["hop", 32.38, 32.7, 0.1]] },
    withGait({ a: 33.16, b: 37.9, pos: walk(33.16, 37.9, F0.x, F0.z, 12.8, 0.4), faces: [[33.16, "shocked", "gut"]] }, "jog", 0.2),
    { a: 37.9, b: 50.9, pos: stay(12.8, 0.4), faces: [[37.9, "shocked", "queue"]], beats: [["hop", 38.3, 38.6, 0.06], ["hop", 39.1, 39.4, 0.06], ["hop", 40.2, 40.5, 0.06], ["hop", 41.6, 41.9, 0.06]] },
    withGait({ a: 50.9, b: 52.5, pos: walk(50.9, 52.5, 1.7, F0.z, -0.1, F0.z), faces: [[50.9, "calm", "carry"]] }, "walk", 0.2),
    { a: 52.5, b: FOREVER, flip: true, pos: stay(-0.1, F0.z), faces: [[52.5, "sly", "carry"], [53.6, "sly", "offer"]] },
  ] },
  { id: "wulan", o: WULAN, tracks: [
    { a: 3.8, b: 7.14, pos: stay(W0.x, W0.z), faces: [[3.8, "sly", "hips"], [5.84, "sly", "eyes"], [6.6, "sly", "hips"]] },
    withGait({ a: 7.14, b: 10.22, pos: walk(7.14, 10.22, 7.4, 0.4, 3.0, 0.4), faces: [[7.14, "sly", "down"]] }, "walk", 0.2),
    { a: 10.22, b: 12.38, pos: stay(W1.x, W1.z), faces: [[10.22, "sly", "rap"]] },
    { a: 12.38, b: 15.14, pos: stay(W1.x, W1.z), faces: [[12.38, "shocked", "scold"]] },
    { a: 15.14, b: 25.34, pos: stay(W1.x, W1.z), faces: [[15.14, "puzzled", "hips"], [17.2, "shocked", "hips"], [18.18, "puzzled", "belly"], [21.98, "sly", "hips"]] },
    { a: 25.34, b: 29.06, pos: stay(W1.x, W1.z), faces: [[25.34, "puzzled", "palm"]] },
    { a: 29.06, b: 48.16, pos: stay(W1.x, W1.z), faces: [[29.06, "puzzled", "hips"], [33.16, "sly", "belly"], [39.62, "calm", "hips"], [44.34, "sly", "belly"]] },
    { a: 48.16, b: 50.2, pos: stay(W1.x, W1.z), faces: [[48.16, "sly", "plugin"]] },
    { a: 50.2, b: FOREVER, pos: stay(W1.x, W1.z), faces: [[50.2, "sly", "hips"], [54.3, "grin", "hips"]] },
  ] },
  { id: "e1", o: E1, tracks: [
    withGait({ a: 23.68, b: 25.0, pos: walk(23.68, 25.0, 2.4, 0.15, 0.2, 0.2), faces: [[23.68, "hungry", "down"]] }, "walk", 0.2),
    { a: 25.0, b: 33.3, flip: true, pos: stay(0.2, 0.2), faces: [[25.0, "hungry", "feed"]] },
    withGait({ a: 33.3, b: 36.6, pos: walk(33.3, 36.6, 0.2, 0.2, 9.6, 0.2), faces: [[33.3, "shocked", "belly"]] }, "jog", 0.2),
    { a: 36.6, b: FOREVER, pos: stay(9.6, 0.2), faces: [[36.6, "shocked", "queue"]], beats: [["hop", 37.0, 37.3, 0.07], ["hop", 38.4, 38.7, 0.07], ["hop", 40.0, 40.3, 0.07]] },
  ] },
  { id: "e2", o: E2, tracks: [
    withGait({ a: 23.9, b: 25.3, pos: walk(23.9, 25.3, 2.7, 0.3, 0.75, 0.3), faces: [[23.9, "hungry", "down"]] }, "walk", 0.2),
    { a: 25.3, b: 33.9, flip: true, pos: stay(0.75, 0.3), faces: [[25.3, "hungry", "hips"]] },
    withGait({ a: 33.9, b: 37.1, pos: walk(33.9, 37.1, 0.75, 0.3, 11.2, 0.3), faces: [[33.9, "shocked", "belly"]] }, "jog", 0.2),
    { a: 37.1, b: FOREVER, pos: stay(11.2, 0.3), faces: [[37.1, "puzzled", "queue"]], beats: [["hop", 37.8, 38.1, 0.06], ["hop", 39.5, 39.8, 0.06]] },
  ] },
  { id: "e3", o: E3, tracks: [
    withGait({ a: 34.6, b: 35.2, pos: walk(34.6, 35.2, DOOR_X(4), -0.7, DOOR_X(4), 0.3), faces: [[34.6, "shocked", "belly"]] }, "walk", 0.2),
    withGait({ a: 35.2, b: 37.4, pos: walk(35.2, 37.4, DOOR_X(4), 0.3, 10.4, 0.45), faces: [[35.2, "shocked", "belly"]] }, "jog", 0.2),
    { a: 37.4, b: FOREVER, pos: stay(10.4, 0.45), faces: [[37.4, "shocked", "queue"]], beats: [["hop", 38.0, 38.3, 0.07], ["hop", 39.0, 39.3, 0.07]] },
  ] },
  { id: "e4", o: E4, tracks: [
    withGait({ a: 35.0, b: 35.6, pos: walk(35.0, 35.6, DOOR_X(7), -0.7, DOOR_X(7), 0.25), faces: [[35.0, "shocked", "belly"]] }, "walk", 0.2),
    withGait({ a: 35.6, b: 37.6, pos: walk(35.6, 37.6, DOOR_X(7), 0.25, 12.0, 0.2), faces: [[35.6, "shocked", "belly"]] }, "jog", 0.2),
    { a: 37.6, b: FOREVER, pos: stay(12.0, 0.2), faces: [[37.6, "shocked", "queue"]], beats: [["hop", 38.2, 38.5, 0.07], ["hop", 39.7, 40.0, 0.07]] },
  ] },
];
type AState = { rig: Pose; x: number; z: number; flip: boolean; expr: Expr; hop: number; h: number; talk: number; kind: string };
const stateOf = (a: { id: string; tracks: Track[] }, t: number): AState | null => {
  const tr = a.tracks.find((k) => t >= k.a && t < k.b);
  if (!tr) return null;
  const [bx, z] = tr.pos(t), ch = tr.ch ? choreoAt(tr.ch, t, tr.h ?? 1.7) : null, x = ch ? (tr.dir ?? 1) * ch.x : bx;
  const [, expr, armName] = stepAt(tr.faces, t);
  const rig = ch ? ch.pose : poseNamed(armName, t) ?? poseAt(tr.faces.map(([ta, , ar]) => [ta, ar] as [number, string]), t, 0.28);   // still means still (B58)
  return { rig, x, z, flip: tr.flip ?? false, expr, h: tr.h ?? 1.7, talk: talkAt(a.id, t), hop: beatsAt(tr.beats ?? [], t) + (ch ? ch.hop : 0), kind: armName };
};
const actor = (id: string) => ACTORS.find((q) => q.id === id)!;
const handAt = (id: string, side: "l" | "r", t: number) => {
  const s = stateOf(actor(id), t);
  if (!s) return null;
  const hd = handOffset(s.rig, side, s.h), sg = s.flip ? -1 : 1;
  return { x: s.x + sg * hd.x, y: hd.y + s.hop * s.h, z: s.z + 0.09, sg };
};

// ---------- the moments of the story --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const LID = [18.2, 18.7, 21.0, 21.4];                       // the lid opens on "Paginya", closes after the rice has been shown
const DOOR_OPEN: Record<number, number> = { 4: 34.5, 7: 34.9 };   // doors 5 and 8 open for the two who come out; the others burst open together on "Sepuluh kamar"
const BURST = 35.9;
const PLUG_AT = [49.1, 49.5, 49.9];
const WARM_ON = 50.0;                                        // the cooker is plugged in again and heats again
const INSERTS: [number, number, string][] = [[18.18, 21.98, "rice"], [25.34, 29.06, "palm"], [39.62, 42.22, "spore"], [42.22, 44.34, "heat"], [44.34, 47.0, "wake"], [47.0, 48.16, "split"], [48.16, 51.18, "toxin"]];
const insertAt = (t: number) => INSERTS.find(([a, b]) => t >= a && t < b);
const PILLS: Pill[] = [
  { at: 9.2, until: 10.6, text: "10 kamar", key: "10", color: "#ff6b3d", y: 330 },
  { at: 22.7, until: 24.0, text: "3 piring", key: "3", color: "#ff6b3d", y: 330 },
  { at: 35.56, until: 37.6, text: "10 kamar, 1 WC", key: "10", color: "#ff6b3d", y: 330 },
  { at: 40.92, until: 42.2, text: "Bacillus cereus", key: "cereus", color: "#2fb7a0", y: 330 },
];
const HOOK_LINES: { text: string; key?: string }[] = [{ text: "Nasi ", key: "12 jam" }, { text: "di magic com" }];
const FIX: Record<string, string> = { "antri.": "antre.", "Antriannya": "Antreannya" };
const READ = [...readWords(WORDS.map((x) => ({ ...x, w: FIX[x.w] ?? x.w }))), { w: "Mas", a: 55.1, b: 55.44 }];   // the first word comes back on the last 0.34 s so the loop holds

// ---------- painted textures (grain, wear, many small marks; nothing is one flat colour) ----------------------------------------------------------------------------------------------------------------------------
const tileTex = (a: string, b: string, grout = "#9aa39a") => (c: CanvasRenderingContext2D) => {
  c.fillStyle = grout; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? a : b; c.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(x * 64 + 3, y * 64 + 3, 58, 6); c.fillStyle = "rgba(0,0,0,.10)"; c.fillRect(x * 64 + 3, y * 64 + 55, 58, 6); }
  speck(c, 256, 256, 700, ["rgba(255,255,255,.12)", "rgba(60,50,30,.12)"], 3, 8);
};
const smallTileTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#b8c4c8"; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = rnd(x * 9 + y) > 0.85 ? "#cfe3ea" : "#f4f7f4"; c.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); c.fillStyle = "rgba(255,255,255,.5)"; c.fillRect(x * 32 + 3, y * 32 + 3, 26, 4); }
  const g = c.createLinearGradient(0, 150, 0, 256); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(120,90,40,.28)"); c.fillStyle = g; c.fillRect(0, 150, 256, 106);   // grease
};
const terrazzoTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#d9d2c3"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { c.fillStyle = ["#8a7f6a", "#b9553b", "#4e6e7a", "#f2efe6", "#7a8a5a"][i % 5]; c.beginPath(); c.ellipse(rnd(i) * 256, rnd(i + 70) * 256, 2 + rnd(i + 3) * 5, 1.5 + rnd(i + 5) * 3.5, rnd(i) * 3, 0, 7); c.fill(); }
  c.strokeStyle = "rgba(60,50,30,.35)"; c.lineWidth = 2; c.strokeRect(1, 1, 254, 254);
  speck(c, 256, 256, 500, ["rgba(255,255,255,.12)", "rgba(60,40,20,.10)"], 3, 3);
};
const concreteTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#a9a59a"; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 1400, ["rgba(255,255,255,.16)", "rgba(40,36,30,.16)", "rgba(120,80,40,.1)"], 4, 12);
  c.strokeStyle = "rgba(40,36,30,.25)"; c.lineWidth = 1.5; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(rnd(k) * 256, 0); c.bezierCurveTo(rnd(k + 4) * 256, 80, rnd(k + 9) * 256, 160, rnd(k + 2) * 256, 256); c.stroke(); }
  c.fillStyle = "rgba(255,255,255,.2)"; c.fillRect(0, 0, 256, 6);
};
const grassTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#5fae45"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { c.strokeStyle = ["#7cc95a", "#3f8a35", "#8fd35f", "#4c9a3a"][i % 4]; c.lineWidth = 1.5; c.beginPath(); const x = rnd(i) * 256, y = rnd(i + 40) * 256; c.moveTo(x, y); c.lineTo(x + (rnd(i + 9) - 0.5) * 6, y - 5 - rnd(i + 7) * 7); c.stroke(); }
  for (let i = 0; i < 26; i++) { c.fillStyle = i % 2 ? "#fff3c4" : "#ffd447"; c.beginPath(); c.arc(rnd(i * 5 + 2) * 256, rnd(i * 7 + 1) * 256, 2.6, 0, 7); c.fill(); }
};
const leafTex = (c: CanvasRenderingContext2D) => {   // a banana leaf: tapered blade, a midrib and side veins
  c.clearRect(0, 0, 128, 256); c.fillStyle = "#4fa83d"; c.beginPath(); c.moveTo(64, 0); c.bezierCurveTo(125, 60, 125, 190, 64, 256); c.bezierCurveTo(3, 190, 3, 60, 64, 0); c.fill();
  c.strokeStyle = "#a8dc7a"; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 4); c.lineTo(64, 250); c.stroke();
  c.strokeStyle = "rgba(20,70,20,.35)"; c.lineWidth = 1.5; for (let y = 16; y < 240; y += 10) { c.beginPath(); c.moveTo(64, y); c.lineTo(8 + 4 * Math.abs(y - 128) / 128 * 10, y + 22); c.moveTo(64, y); c.lineTo(120 - 4 * Math.abs(y - 128) / 128 * 10, y + 22); c.stroke(); }
};
const plateTex = (n: string, bg: string) => (c: CanvasRenderingContext2D) => { c.fillStyle = bg; c.fillRect(0, 0, 64, 64); c.strokeStyle = "#17141c"; c.lineWidth = 3; c.strokeRect(3, 3, 58, 58); c.fillStyle = "#17141c"; c.font = "bold 34px Arial Black, Arial"; c.textAlign = "center"; c.fillText(n, 32, 45); };
const dutyTex = (c: CanvasRenderingContext2D) => {   // a hand-drawn duty chart: a grid, a title bar, coloured names
  c.fillStyle = "#fbf7ee"; c.fillRect(0, 0, 256, 180); c.fillStyle = "#e0456b"; c.fillRect(0, 0, 256, 34); c.strokeStyle = "#17141c"; c.lineWidth = 3; c.strokeRect(2, 2, 252, 176);
  for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, 34 + i * 29); c.lineTo(256, 34 + i * 29); c.stroke(); }
  c.beginPath(); c.moveTo(90, 34); c.lineTo(90, 180); c.stroke();
  for (let i = 0; i < 5; i++) { c.fillStyle = ["#2f6fdf", "#e8892a", "#2a9d8f", "#7a3fa0", "#c0392b"][i]; c.fillRect(8, 42 + i * 29, 70, 14); c.fillStyle = "#6b6b6b"; c.fillRect(100, 44 + i * 29, 100 + (i % 3) * 20, 10); }
};
const skyTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#5aa8e8"); g.addColorStop(0.6, "#bfe0f5"); g.addColorStop(1, "#f4efdc"); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7; i++) { const x = rnd(i) * 256, y = 40 + rnd(i + 8) * 110; c.fillStyle = "rgba(255,255,255,.85)"; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + k * 14 - 28, y + (k % 2) * 6, 14 + (k % 3) * 5, 0, 7); c.fill(); } }
};
const clothTex = (base: string) => (c: CanvasRenderingContext2D) => { c.fillStyle = base; c.fillRect(0, 0, 64, 64); c.strokeStyle = "rgba(0,0,0,.12)"; c.lineWidth = 1; for (let i = 0; i < 64; i += 4) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 64); c.stroke(); } speck(c, 64, 64, 120, ["rgba(255,255,255,.14)"], 2, 4); };
const riceTex = (c: CanvasRenderingContext2D) => { c.fillStyle = "#f6f2e6"; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 160; i++) { c.fillStyle = i % 3 ? "#fffdf6" : "#e7e0cc"; c.beginPath(); c.ellipse(rnd(i) * 128, rnd(i + 11) * 128, 5, 2.4, rnd(i + 3) * 3, 0, 7); c.fill(); } };
const steelTex = (c: CanvasRenderingContext2D) => { metalTex(c); c.strokeStyle = "rgba(255,255,255,.25)"; c.lineWidth = 1; for (let k = 0; k < 40; k++) { c.beginPath(); c.arc(128, 128, 6 + k * 3, 0, 7); c.stroke(); } };

type TexSet = Record<"tileF" | "terr" | "wallLime" | "wallCream" | "wain" | "splash" | "conc" | "kolong" | "grass" | "leaf" | "sky" | "rice" | "steel" | "doorA" | "doorB" | "soft" | "plateWC" | "duty", THREE.Texture> & { clothA: THREE.Texture[] };

// ---------- the rice cooker (the hero): a cream body with a dark foot, a domed lid on a back hinge, a panel with two lights, side handles, a cord that ends in a plug ----------------------------------------------------------
const lidAngle = (t: number) => 1.75 * (prog(t, LID[0], LID[1]) - prog(t, LID[2], LID[3])) + (t >= 50.9 ? 1.75 : 0);
const plugPos = (t: number): THREE.Vector3 => {
  const rest = V(MC.x + 0.57, MC.y + 0.017, -0.34), at = SOCKET.clone().add(V(0, 0, 0.05));
  if (t < PLUG_AT[0]) return rest;
  const h = handAt("wulan", "r", t), hv = h ? V(h.x, h.y + 0.03, h.z) : rest;   // the plug rides her right hand up to the wall socket
  return t < PLUG_AT[2] ? hv : at;
};
const MagicCom: React.FC<{ t: number; tex: TexSet }> = ({ t, tex }) => {
  const ang = lidAngle(t), warm = t >= WARM_ON, potIn = t < 50.9;
  const pp = plugPos(t), S = V(MC.x + 0.17, MC.y + 0.09, MC.z - 0.04);
  const mid = V((S.x + pp.x) / 2, Math.min(S.y, pp.y) - 0.02, (S.z + pp.z) / 2 + 0.12);
  const cord = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([S, V(S.x + 0.1, MC.y + 0.01, S.z + 0.1), mid, pp]), 28, 0.011, 8, false), [pp.x, pp.y, pp.z]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <group position={[MC.x, MC.y, MC.z]}>
        <Cyl r={0.19} h={0.05} pos={[0, 0.025, 0]} color="#3b3b46" rough={0.5} />
        <Cyl r={0.175} h={0.2} pos={[0, 0.15, 0]} color="#f3e8c8" rough={0.4} seg={32} />
        <Cyl r={0.18} h={0.025} pos={[0, 0.255, 0]} color="#d8c9a0" rough={0.4} seg={32} />
        <RBox size={[0.012, 0.05, 0.04]} pos={[-0.185, 0.2, 0]} color="#3b3b46" r={0.004} />
        <RBox size={[0.012, 0.05, 0.04]} pos={[0.185, 0.2, 0]} color="#3b3b46" r={0.004} />
        <RBox size={[0.13, 0.07, 0.012]} pos={[0, 0.12, 0.172]} color="#2a2a33" r={0.006} rough={0.3} />
        <Ball r={0.011} pos={[-0.03, 0.125, 0.18]} color={warm ? "#ff9a3d" : "#5a4a3a"} sc={[1, 1, 0.5]} />
        <Ball r={0.011} pos={[0.03, 0.125, 0.18]} color="#5a4a3a" sc={[1, 1, 0.5]} />
        {potIn && <><Cyl r={0.15} h={0.012} pos={[0, 0.262, 0]} map={tex.steel} metal={0.6} rough={0.35} seg={32} /><Cyl r={0.14} h={0.012} pos={[0, 0.272, 0]} map={tex.rice} seg={32} /></>}
        {!potIn && <Cyl r={0.14} h={0.012} pos={[0, 0.262, 0]} color="#17141c" seg={32} />}
        <group position={[0, 0.27, -0.16]} rotation={[-ang, 0, 0]}>
          <mesh position={[0, 0.012, 0.16]} scale={[1, 0.42, 1]}><sphereGeometry args={[0.185, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#f3e8c8" roughness={0.4} /></mesh>
          <Cyl r={0.022} h={0.03} pos={[0, 0.09, 0.16]} color="#3b3b46" />
          <RBox size={[0.1, 0.02, 0.025]} pos={[0, 0.082, 0.3]} color="#3b3b46" r={0.008} />
        </group>
      </group>
      <mesh geometry={cord}><meshStandardMaterial color="#2a2a33" roughness={0.6} /></mesh>
      <group position={pp.toArray()}><RBox size={[0.05, 0.034, 0.05]} pos={[0, 0, 0]} color="#17141c" r={0.01} /><Cyl r={0.004} h={0.03} pos={[-0.011, 0, -0.035]} rot={[Math.PI / 2, 0, 0]} color="#c9cfd6" metal={0.8} seg={8} /><Cyl r={0.004} h={0.03} pos={[0.011, 0, -0.035]} rot={[Math.PI / 2, 0, 0]} color="#c9cfd6" metal={0.8} seg={8} /></group>
    </group>
  );
};

// ---------- the magnifier: what the story looks at (rice, a palm, a spore, heat that cannot hurt it, a spore waking, rods splitting, toxin) ----------------------------------------------------------------------------------
const caps = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number, fill: string) => { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = fill; c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h / 2); c.fill(); c.stroke(); c.restore(); };
const flame = (c: CanvasRenderingContext2D, x: number, base: number, h: number, w: number, ph: number) => { c.fillStyle = "#ff8a2b"; c.beginPath(); c.moveTo(x - w, base); c.quadraticCurveTo(x - w * 0.6, base - h * 0.5, x + 6 * Math.sin(ph), base - h); c.quadraticCurveTo(x + w * 0.6, base - h * 0.5, x + w, base); c.fill(); c.fillStyle = "#ffd447"; c.beginPath(); c.moveTo(x - w * 0.5, base); c.quadraticCurveTo(x - w * 0.3, base - h * 0.35, x + 3 * Math.sin(ph), base - h * 0.62); c.quadraticCurveTo(x + w * 0.3, base - h * 0.35, x + w * 0.5, base); c.fill(); };
const spore = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => { for (const [k, col] of [[1, "#1f5a55"], [0.78, "#2fb7a0"], [0.5, "#9fe3d2"]] as const) { c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = k === 1 ? 8 : 4; c.beginPath(); c.ellipse(x, y, r * k * 1.15, r * k, 0, 0, 7); c.fill(); c.stroke(); } };
const drawLens = (c: CanvasRenderingContext2D, mode: string, t: number, a: number) => {
  const u = t - a;
  c.clearRect(0, 0, 512, 512);
  c.save(); c.beginPath(); c.arc(256, 256, 238, 0, 7); c.clip(); c.fillStyle = "#fffaf0"; c.fillRect(0, 0, 512, 512);
  if (mode === "rice") {
    for (let i = 0; i < 90; i++) { const x = 256 + (rnd(i) - 0.5) * 380, y = 330 - Math.abs(x - 256) * 0.35 + (rnd(i + 5) - 0.5) * 70 + 40; c.fillStyle = i % 3 ? "#fffdf6" : "#e9e2cd"; c.strokeStyle = "#cfc6ae"; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 30, 14, rnd(i + 9) * 3, 0, 7); c.fill(); c.stroke(); }
    c.strokeStyle = "#7fc65a"; c.lineWidth = 9; c.lineCap = "round"; for (let k = 0; k < 3; k++) { c.beginPath(); for (let y = 270; y > 60; y -= 8) { const x = 150 + k * 110 + 18 * Math.sin(y * 0.05 - u * 3 + k); y === 270 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); }
  } else if (mode === "palm") {
    c.fillStyle = "#c9d2d8"; c.fillRect(0, 300, 512, 212); c.fillStyle = "#e9eef1"; c.fillRect(0, 300, 512, 14);
    c.fillStyle = "#f5dcc4"; c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.roundRect(150, 250, 220, 150, 50); c.fill(); c.stroke();
    for (let k = 0; k < 4; k++) { c.beginPath(); c.roundRect(158 + k * 52, 130 + (k === 1 || k === 2 ? -20 : 0), 40, 150, 20); c.fill(); c.stroke(); }
    c.beginPath(); c.roundRect(110, 270, 90, 36, 18); c.fill(); c.stroke();
    c.strokeStyle = "#f0a060"; c.lineWidth = 8; c.lineCap = "round"; for (let k = 0; k < 3; k++) { c.beginPath(); for (let x = 150; x < 380; x += 10) { const y = 440 + 14 * Math.sin(x * 0.06 + u * 4 + k); x === 150 ? c.moveTo(x, y + k * 0) : c.lineTo(x, y); } c.translate(0, 0); c.stroke(); }
  } else if (mode === "spore" || mode === "heat") {
    c.fillStyle = "#f2e6c4"; c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.ellipse(256, 300, 220, 110, -0.25, 0, 7); c.fill(); c.stroke();
    spore(c, 256, 270 + 6 * Math.sin(u * 4), 62);
    if (mode === "heat") { for (let k = 0; k < 6; k++) { const hh = 90 + 30 * Math.sin(u * 9 + k), ph = u * 8 + k; flame(c, 60 + k * 78, 512, hh + 60, 34, ph); } c.strokeStyle = "#fff"; c.lineWidth = 6; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(256, 270, 90 + (u * 120 + k * 30) % 80, -2.8 + k * 0.1, -2.4 + k * 0.1); c.stroke(); } }
  } else if (mode === "wake") {
    const k = prog(t, a + 0.2, a + 2.2), r = 62 + 22 * k;
    c.fillStyle = "#f2e6c4"; c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.ellipse(256, 300, 220, 110, -0.25, 0, 7); c.fill(); c.stroke();
    if (k > 0.55) caps(c, 256 + 150 * (k - 0.55), 250 - 20 * (k - 0.55), 150 * Math.min(1, (k - 0.55) * 3), 60, -0.2, "#7fd05a");
    spore(c, 256, 270, r);
    if (k > 0.35) { c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(256 - r * 0.6, 270 - r * 0.6); c.lineTo(256 - r * 0.2, 270 - r * 0.1); c.lineTo(256 - r * 0.5, 270 + r * 0.3); c.moveTo(256 + r * 0.7, 270 - r * 0.4); c.lineTo(256 + r * 0.3, 270); c.stroke(); }
    c.fillStyle = "#ffd447"; c.font = "bold 70px Arial Black, Arial"; c.textAlign = "center"; if (k < 0.5) c.fillText("zzz", 380, 150 - 8 * Math.sin(u * 4));
  } else if (mode === "split") {
    const n = u < 0.35 ? 1 : u < 0.7 ? 2 : u < 1.0 ? 4 : 8;
    for (let i = 0; i < n; i++) { const ang = (i / n) * 6.28 + 0.4, rr = n === 1 ? 0 : 100 + 30 * (n > 4 ? 1 : 0); caps(c, 256 + rr * Math.cos(ang), 270 + rr * 0.8 * Math.sin(ang), 110, 46, ang * 0.5, "#7fd05a"); }
  } else {
    for (let i = 0; i < 4; i++) caps(c, 100 + i * 105, 120 + 14 * Math.sin(u * 3 + i), 100, 42, 0.2 * i - 0.3, "#7fd05a");
    for (let k = 0; k < 6; k++) flame(c, 50 + k * 82, 512, 60 + 24 * Math.sin(u * 9 + k), 30, u * 9 + k);
    for (let i = 0; i < 12; i++) { const y = ((u * 90 + i * 44) % 330) + 150, x = 80 + (i % 4) * 105 + (i > 3 ? 40 : 0); c.fillStyle = "#8f4bd8"; c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(x, y - 22); c.quadraticCurveTo(x + 17, y + 6, x, y + 16); c.quadraticCurveTo(x - 17, y + 6, x, y - 22); c.fill(); c.stroke(); }
  }
  c.restore(); c.strokeStyle = INK; c.lineWidth = 16; c.beginPath(); c.arc(256, 256, 238, 0, 7); c.stroke();
};
const Lens: React.FC<{ t: number }> = ({ t }) => {
  const camera = useThree((x) => x.camera), g = useRef<THREE.Group>(null), cv = useMemo(() => painted(512, 512, () => undefined), []);
  const cur = insertAt(t);
  useLayoutEffect(() => { if (g.current) g.current.rotation.y = Math.atan2(camera.position.x - INS.x, camera.position.z - INS.z); });
  if (!cur) return null;
  drawLens((cv.image as HTMLCanvasElement).getContext("2d")!, cur[2], t, cur[0]);
  cv.needsUpdate = true;
  return <group ref={g} position={INS.toArray()} scale={pop(t - cur[0])}><mesh layers={CAST}><planeGeometry args={[1.05, 1.05]} /><meshBasicMaterial map={cv} transparent alphaTest={0.05} toneMapped={false} side={THREE.DoubleSide} /></mesh></group>;
};

// ---------- the shared kitchen ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const Dapur: React.FC<{ tex: TexSet; t: number }> = ({ tex, t }) => {
  const floor = useMemo(() => { const m = tex.tileF.clone(); m.needsUpdate = true; m.repeat.set(5, 13); return m; }, [tex]);
  const plates = [22.7, 23.3, 23.9].filter((a) => t >= a);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.5, 0, 6.45]}><planeGeometry args={[5.8, 15.5]} /><meshStandardMaterial map={floor} roughness={0.5} /></mesh>
      <RBox size={[5.8, 2.7, 0.12]} pos={[-1.5, 1.35, -1.36]} map={tex.wallLime} tile={1.6} r={0.01} />
      <RBox size={[4.7, 0.78, 0.04]} pos={[-1.05, 1.17, -1.28]} map={tex.splash} tile={0.8} r={0.006} />
      {/* the concrete counter: a top with a rounded edge and three panelled fronts */}
      <RBox size={[4.8, 0.07, 0.66]} pos={[-1.1, 0.705, -0.6]} map={tex.conc} tile={1.2} r={0.02} />
      {[-2.95, -1.75, -0.55, 0.65].map((x, i) => <RBox key={i} size={[1.18, 0.62, 0.05]} pos={[x, 0.34, -0.3]} map={tex.kolong} tile={0.7} r={0.015} />)}
      {[-2.95, -1.75, -0.55, 0.65].map((x, i) => <RBox key={i} size={[0.2, 0.025, 0.03]} pos={[x, 0.56, -0.26]} color="#d8d2c4" r={0.01} metal={0.6} />)}
      {/* a two-burner gas hob with a steaming panci, the green gas cylinder beside the counter */}
      <RBox size={[0.7, 0.08, 0.42]} pos={[0.55, 0.78, -0.6]} color="#c9cfd6" metal={0.5} rough={0.35} r={0.015} />
      {[0.4, 0.7].map((x, i) => <Cyl key={i} r={0.07} h={0.025} pos={[x, 0.835, -0.6]} color="#2a2a33" seg={20} />)}
      <Cyl r={0.12} h={0.14} pos={[0.4, 0.915, -0.6]} map={tex.steel} metal={0.6} seg={24} />
      <Cyl r={0.125} h={0.02} pos={[0.4, 0.99, -0.6]} map={tex.steel} metal={0.6} seg={24} />
      {[0, 1, 2].map((i) => <Puff key={i} x={0.4 + 0.03 * Math.sin(i * 2)} y={1.0} z={-0.6} t={t} at={streamAt(t, i, 3, 2.4)} dur={2.4} size={0.28} tex={tex.soft} rise={0.55} />)}
      <Cyl r={0.15} h={0.42} pos={[1.45, 0.21, -0.75]} color="#4aa84a" rough={0.5} seg={24} />
      <Cyl r={0.15} h={0.04} pos={[1.45, 0.44, -0.75]} color="#3b8a3b" seg={24} />
      <Cyl r={0.095} h={0.015} pos={[1.45, 0.47, -0.75]} rot={[0, 0, 0]} color="#d9d2b0" seg={20} />
      <Cyl r={0.025} h={0.06} pos={[1.45, 0.5, -0.75]} color="#c9a227" metal={0.7} seg={10} />
      <mesh><tubeGeometry args={[new THREE.CatmullRomCurve3([V(1.45, 0.52, -0.75), V(1.2, 0.5, -0.5), V(0.95, 0.62, -0.5), V(0.88, 0.78, -0.6)]), 20, 0.012, 8, false]} /><meshStandardMaterial color="#e0562f" roughness={0.6} /></mesh>
      {/* the wall rack of plates and glasses, a bucket with a scoop, the basin */}
      <RBox size={[1.5, 0.04, 0.22]} pos={[-2.5, 1.6, -1.18]} map={tex.kolong} tile={0.6} r={0.01} />
      {[-3.05, -2.8, -2.55, -2.3, -2.05].map((x, i) => <Cyl key={i} r={0.1} h={0.015} pos={[x, 1.72, -1.14]} rot={[Math.PI / 2 - 0.15, 0, 0]} color={i % 2 ? "#fffaf0" : "#9fd0e6"} rough={0.3} seg={24} />)}
      {[-1.95, -1.85, -1.75].map((x, i) => <Cyl key={i} r={0.035} r2={0.04} h={0.1} pos={[x, 1.66, -1.14]} color="#bfe3f2" rough={0.1} seg={14} />)}
      <Cyl r={0.17} r2={0.2} h={0.3} pos={[-3.1, 0.15, 0.0]} color="#2e7fd9" rough={0.5} seg={22} open />
      <Cyl r={0.03} h={0.14} pos={[-3.1, 0.34, 0.0]} rot={[0, 0, 0.6]} color="#f2c230" seg={8} />
      <RBox size={[0.7, 0.12, 0.45]} pos={[-2.55, 0.78, -0.6]} map={tex.steel} metal={0.6} rough={0.35} r={0.02} />
      <Cyl r={0.018} h={0.2} pos={[-2.55, 0.92, -0.8]} color="#c9cfd6" metal={0.8} seg={10} />
      <RBox size={[0.7, 0.5, 0.03]} pos={[-1.15, 1.95, -1.25]} map={tex.duty} fit r={0.01} />
      <RBox size={[0.9, 0.03, 0.03]} pos={[0.2, 1.72, -1.25]} color="#c9cfd6" metal={0.7} r={0.01} />
      {[-0.1, 0.1, 0.3, 0.5].map((x, i) => <group key={i} position={[x, 1.72, -1.22]}><RBox size={[0.03, 0.3 + 0.04 * (i % 2), 0.02]} pos={[0, -0.18, 0]} color={["#3b3b46", "#c9a227", "#c9cfd6", "#8f4b2a"][i]} r={0.006} metal={0.4} /><Cyl r={0.06} h={0.02} pos={[0, -0.38, 0]} rot={[Math.PI / 2, 0, 0]} color={["#c9cfd6", "#8f4b2a", "#3b3b46", "#c9a227"][i]} metal={0.4} seg={16} /></group>)}
      <RBox size={[0.8, 0.04, 0.2]} pos={[0.35, 1.38, -1.2]} map={tex.kolong} tile={0.6} r={0.01} />
      {[0.1, 0.35, 0.6].map((x, i) => <group key={i} position={[x, 1.5, -1.2]}><Cyl r={0.06} h={0.14} pos={[0, 0, 0]} color={["#e0456b", "#f2c230", "#2fb7c9"][i]} rough={0.3} seg={16} /><Cyl r={0.065} h={0.03} pos={[0, 0.085, 0]} color="#f4efdc" seg={16} /></group>)}
      {plates.map((a, i) => <Cyl key={i} r={0.12} h={0.02} pos={[-3.2, 0.77 + 0.02 * i, -0.6]} color={["#fffaf0", "#e0456b", "#9fd0e6"][i]} rough={0.3} seg={24} />)}
    </group>
  );
};

// ---------- the corridor: ten numbered room doors that open on their hinges, the WC door at the end ----------------------------------------------------------------------------------------------------------------------------
const doorAngle = (i: number, t: number) => {
  const o = DOOR_OPEN[i];
  if (o !== undefined && t >= o) return 1.65 * ease(prog(t, o, o + 0.35));
  if (t >= BURST) return 1.85 * ease(prog(t, BURST + 0.03 * i, BURST + 0.03 * i + 0.2));
  return 0;
};
const Koridor: React.FC<{ tex: TexSet; t: number; nums: THREE.Texture[] }> = ({ tex, t, nums }) => {
  const floor = useMemo(() => { const m = tex.terr.clone(); m.needsUpdate = true; m.repeat.set(9, 13); return m; }, [tex]);
  return (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.45, 0, 6.45]}><planeGeometry args={[10.1, 15.5]} /><meshStandardMaterial map={floor} roughness={0.45} /></mesh>
    <RBox size={[10.1, 2.7, 0.12]} pos={[6.45, 1.35, -1.36]} map={tex.wallCream} tile={1.6} r={0.01} />
    {/* the upper storey of the boarding house: a cream wall, a balcony rail and shuttered windows, so the long shots have a building and not sky */}
    <RBox size={[10.1, 3.9, 0.12]} pos={[6.45, 4.65, -1.36]} map={tex.wallCream} tile={1.6} r={0.01} />
    <RBox size={[10.1, 0.12, 0.7]} pos={[6.45, 2.76, -1.0]} color="#b9a98a" r={0.02} />
    {Array.from({ length: 11 }, (_, k) => <RBox key={k} size={[0.05, 0.6, 0.05]} pos={[1.6 + k * 0.92, 3.1, -0.68]} color="#2f3b4a" r={0.01} />)}
    <RBox size={[10.1, 0.06, 0.06]} pos={[6.45, 3.42, -0.68]} color="#2f3b4a" r={0.01} />
    {Array.from({ length: 5 }, (_, k) => <group key={k} position={[2.4 + k * 1.9, 4.55, -1.28]}><RBox size={[0.9, 1.2, 0.05]} pos={[0, 0, 0]} color="#f4efdc" r={0.01} /><RBox size={[0.76, 1.06, 0.05]} pos={[0, 0, 0.02]} color={k % 2 ? "#8fb7c9" : "#7aa3b8"} r={0.01} /><RBox size={[0.03, 1.06, 0.05]} pos={[0, 0, 0.04]} color="#f4efdc" r={0.005} /><RBox size={[0.4, 1.1, 0.04]} pos={[0.55, 0, 0.03]} color={["#c0392b", "#2a9d8f", "#e8892a", "#7a3fa0", "#2f6fdf"][k]} r={0.01} /></group>)}
    <RBox size={[10.1, 0.9, 0.05]} pos={[6.45, 0.45, -1.28]} map={tex.wain} tile={0.9} r={0.01} />
    {/* near layer: a laundry stand with shirts on the left, a bucket with a mop on the right */}
    <group position={[4.05, 0, 7.6]}>
      {[-0.5, 0.5].map((x) => <RBox key={x} size={[0.04, 1.4, 0.04]} pos={[x, 0.7, 0]} color="#c9cfd6" metal={0.6} r={0.01} />)}
      <RBox size={[1.06, 0.04, 0.04]} pos={[0, 1.4, 0]} color="#c9cfd6" metal={0.6} r={0.01} />
      {[-0.32, 0, 0.32].map((x, i) => <RBox key={i} size={[0.26, 0.5 + 0.08 * i, 0.02]} pos={[x, 1.12 - 0.04 * i, 0]} map={tex.clothA[i]} fit r={0.008} />)}
    </group>
    <group position={[5.75, 0, 8.2]}>
      <Cyl r={0.2} r2={0.26} h={0.4} pos={[0, 0.2, 0]} color="#2fb7c9" rough={0.35} seg={20} />
      <Cyl r={0.014} h={1.3} pos={[0.1, 0.8, 0]} rot={[0, 0, 0.12]} color="#8f4b2a" seg={8} />
      <Ball r={0.13} pos={[0.2, 1.43, 0]} color="#e6e1d0" />
    </group>
    <RBox size={[10.1, 0.07, 0.07]} pos={[6.45, 0.92, -1.26]} color="#f4efdc" r={0.02} />
    {Array.from({ length: 10 }, (_, i) => {
      const x = DOOR_X(i), a = doorAngle(i, t), open = a > 0.05;
      return (
        <group key={i}>
          <RBox size={[0.6, 2.06, 0.06]} pos={[x, 1.03, -1.27]} color="#d9cfb8" r={0.012} />
          {open && <RBox size={[0.48, 1.96, 0.05]} pos={[x, 1.0, -1.25]} color="#241e2a" r={0.01} />}
          <group position={[x - 0.24, 0, -1.24]} rotation={[0, -a, 0]}><RBox size={[0.48, 1.96, 0.045]} pos={[0.24, 1.0, 0]} map={i % 2 ? tex.doorA : tex.doorB} tile={0.9} r={0.01} /><Ball r={0.022} pos={[0.41, 0.95, 0.04]} color="#d8b84a" /><RBox size={[0.17, 0.17, 0.012]} pos={[0.24, 1.62, 0.03]} map={nums[i]} fit r={0.006} /></group>
          {a > 0.5 && t < BURST + 0.7 && [0, 1, 2].map((k) => <Puff key={k} x={x + (k - 1) * 0.25} y={0.3} z={-0.6} t={t} at={BURST + 0.03 * i + 0.03 * k} dur={0.7} size={0.5} tex={tex.soft} color="#e8dcc0" rise={0.5} />)}
        </group>
      );
    })}
    <RBox size={[0.7, 2.06, 0.06]} pos={[WC_X, 1.03, -1.27]} color="#d9cfb8" r={0.012} />
    <RBox size={[0.58, 1.96, 0.05]} pos={[WC_X, 1.0, -1.23]} map={tex.doorA} tile={0.9} r={0.01} color="#8fd8d0" />
    <RBox size={[0.3, 0.2, 0.012]} pos={[WC_X, 1.65, -1.2]} map={tex.plateWC} fit r={0.006} />
    {/* the sandals that fly out of the ten doors when they all burst open (the story's one impossible peak) */}
    {t >= BURST && t < BURST + 2.2 && Array.from({ length: 20 }, (_, k) => {
      const i = k >> 1, s = t - BURST - 0.03 * i, d = k & 1 ? 1 : -1;
      if (s < 0) return null;
      const x = DOOR_X(i) + d * (0.35 + 1.4 * s * (0.6 + rnd(k)) * (rnd(k + 20) > 0.5 ? 1 : -1)), y = Math.max(0.03, 0.7 + 5.2 * s - 4.9 * s * s), z = -0.9 + 2.2 * s * (0.8 + rnd(k + 40));
      return <group key={k} position={[x, y, Math.min(z, 1.4)]} rotation={[y > 0.04 ? s * 9 : 0, k, y > 0.04 ? s * 7 : 0]}><RBox size={[0.1, 0.02, 0.26]} pos={[0, 0, 0]} color={["#e0456b", "#2fb7c9", "#ffd447", "#7a3fa0"][k % 4]} r={0.008} /><RBox size={[0.1, 0.012, 0.07]} pos={[0, 0.016, -0.02]} color="#f4efdc" r={0.004} /></group>;
    })}
  </group>
  );
};

// ---------- the back yard: grass, a fence with a gate, banana plants, laundry on a line, a parked motorbike, far hills -----------------------------------------------------------------------------------------------
const Pohon: React.FC<{ x: number; z: number; s?: number; tex: TexSet; t: number }> = ({ x, z, s = 1, tex, t }) => (
  <group position={[x, 0, z]} scale={s}>
    <Cyl r={0.14} r2={0.2} h={2.1} pos={[0, 1.05, 0]} color="#8aa65a" seg={14} />
    {Array.from({ length: 7 }, (_, k) => <group key={k} position={[0, 2.15, 0]} rotation={[0.9 + 0.1 * Math.sin(t * 1.2 + k), (k / 7) * 6.283, 0]}><group position={[0, 0.7, 0]}><mesh><planeGeometry args={[0.7, 1.7]} /><meshStandardMaterial map={tex.leaf} transparent alphaTest={0.4} side={THREE.DoubleSide} roughness={0.8} /></mesh></group></group>)}
  </group>
);
const Halaman: React.FC<{ tex: TexSet; t: number }> = ({ tex, t }) => {
  const g = useMemo(() => { const m = tex.grass.clone(); m.needsUpdate = true; m.repeat.set(14, 6); return m; }, [tex]);
  const sway = (k: number) => 0.06 * Math.sin(t * 1.6 + k);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[26, -0.005, 3]}><planeGeometry args={[30, 14]} /><meshStandardMaterial map={g} roughness={1} /></mesh>
      {Array.from({ length: 14 }, (_, k) => <RBox key={k} size={[0.16, 1.2, 0.03]} pos={[12.0 + k * 0.95, 0.6, -1.5]} map={tex.kolong} tile={0.6} r={0.01} />)}
      {Array.from({ length: 4 }, (_, k) => <RBox key={k} size={[12.8, 0.06, 0.04]} pos={[18.4, 0.3 + 0.28 * k, -1.46]} color="#7a5a3a" r={0.01} />)}
      <Pohon x={14.2} z={-0.6} tex={tex} t={t} /><Pohon x={17.6} z={-1.0} s={1.2} tex={tex} t={t} /><Pohon x={22.0} z={-0.4} s={0.9} tex={tex} t={t} />
      <Pohon x={-2.4} z={-4.0} s={1.4} tex={tex} t={t} />
      {/* the laundry line: two posts, a rope, shirts and trousers that sway */}
      {[13.0, 17.4].map((x, i) => <Cyl key={i} r={0.045} h={2.1} pos={[x, 1.05, 2.2]} color="#7a5a3a" seg={8} />)}
      <mesh><tubeGeometry args={[new THREE.CatmullRomCurve3([V(13.0, 2.0, 2.2), V(15.2, 1.88, 2.2), V(17.4, 2.0, 2.2)]), 12, 0.008, 6, false]} /><meshStandardMaterial color="#d9d2b0" /></mesh>
      {[13.5, 14.2, 14.9, 15.7, 16.4].map((x, i) => <group key={i} position={[x, 1.55, 2.2]} rotation={[0, 0, sway(i)]}><RBox size={[0.4, i % 2 ? 0.7 : 0.5, 0.025]} pos={[0, 0.2, 0]} map={tex.clothA[i % 3]} fit r={0.01} /></group>)}
      {/* a parked motorbike: two wheels with tyres and hubs, a frame, a tank, a seat, handlebars, a headlight, a mirror */}
      <group position={[15.4, 0, 0.8]}>
        {[-0.5, 0.5].map((x, i) => <group key={i} position={[x, 0.28, 0]}><mesh rotation={[0, 0, 0]}><torusGeometry args={[0.28, 0.06, 10, 28]} /><meshStandardMaterial color="#1b1b20" roughness={0.9} /></mesh><Cyl r={0.08} h={0.12} pos={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} color="#c9cfd6" metal={0.8} seg={14} /></group>)}
        <RBox size={[0.9, 0.12, 0.14]} pos={[0, 0.42, 0]} color="#c8352a" r={0.04} />
        <RBox size={[0.34, 0.2, 0.2]} pos={[-0.05, 0.62, 0]} color="#c8352a" r={0.07} rough={0.3} />
        <RBox size={[0.4, 0.08, 0.2]} pos={[0.3, 0.62, 0]} color="#17141c" r={0.04} />
        <RBox size={[0.04, 0.4, 0.04]} pos={[-0.52, 0.62, 0]} rot={[0, 0, -0.2]} color="#8e98a3" metal={0.7} r={0.01} />
        <RBox size={[0.04, 0.04, 0.5]} pos={[-0.58, 0.82, 0]} color="#17141c" r={0.015} />
        <Ball r={0.07} pos={[-0.6, 0.72, 0]} color="#fff3c4" />
      </group>
    </group>
  );
};

const World: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const tex = useMemo(() => ({
    tileF: painted(256, 256, tileTex("#f1e4bd", "#6aa885", "#8f968c")), terr: painted(256, 256, terrazzoTex), wallLime: painted(256, 256, plasterTex("#cfe58a", "rgba(70,90,20,.25)")), wallCream: painted(256, 256, plasterTex("#f6e6b4", "rgba(90,60,30,.22)")),
    wain: painted(256, 256, woodTex("#3f8f8a", 52)), splash: painted(256, 256, smallTileTex), conc: painted(256, 256, concreteTex), kolong: painted(256, 256, woodTex("#c98048", 56)), grass: painted(256, 256, grassTex), leaf: painted(128, 256, leafTex),
    sky: painted(256, 256, skyTex), rice: painted(128, 128, riceTex), steel: painted(256, 256, steelTex), doorA: painted(256, 256, woodTex("#4a78b5", 64)), doorB: painted(256, 256, woodTex("#d9a441", 64)), soft: painted(64, 64, softTex),
    plateWC: painted(64, 64, plateTex("WC", "#bfe9e5")), duty: painted(256, 180, dutyTex), clothA: [painted(64, 64, clothTex("#e0456b")), painted(64, 64, clothTex("#2f6fdf")), painted(64, 64, clothTex("#f2c230"))],
  } as unknown as TexSet), []);
  const nums = useMemo(() => Array.from({ length: 10 }, (_, i) => painted(64, 64, plateTex(String(i + 1), "#fffaf0"))), []);
  return (
    <group>
      <mesh position={[4, 0, 0]}><sphereGeometry args={[120, 24, 16]} /><meshBasicMaterial map={tex.sky} side={THREE.BackSide} fog={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, -0.02, 0]}><planeGeometry args={[200, 120]} /><meshStandardMaterial color="#9bd07a" roughness={1} /></mesh>
      <Dapur tex={tex} t={t} /><Koridor tex={tex} t={t} nums={nums} /><Halaman tex={tex} t={t} />
      <MagicCom t={t} tex={tex} />
      <mesh position={[-0.2, 3.2, -9]} scale={[1, 0.35, 1]}><sphereGeometry args={[7, 20, 12]} /><meshBasicMaterial color="#a9c9d9" fog={false} /></mesh>
      <mesh position={[18, 2.6, -10]} scale={[1, 0.3, 1]}><sphereGeometry args={[9, 20, 12]} /><meshBasicMaterial color="#b6d3de" fog={false} /></mesh>
      {/* the plates Fajar eats from, the pot Fajar carries to Bu Wulan, a bird crossing the sky */}
      {(() => {
        const l = handAt("fajar", "l", t), r = handAt("fajar", "r", t);
        return (
          <>
            {l && t >= 21.98 && t < 25.34 && <group position={[l.x, l.y + 0.02, l.z + 0.05]}><Cyl r={0.12} h={0.02} pos={[0, 0, 0]} color="#fffaf0" rough={0.3} seg={24} /><mesh position={[0, 0.03, 0]} scale={[1, 0.5, 1]}><sphereGeometry args={[0.08, 12, 8]} /><meshStandardMaterial map={tex.rice} /></mesh></group>}
            {l && r && t >= 50.9 && <group position={[(l.x + r.x) / 2, (l.y + r.y) / 2 + 0.02, (l.z + r.z) / 2 + 0.1]}><Cyl r={0.16} h={0.17} pos={[0, 0, 0]} map={tex.steel} metal={0.6} rough={0.35} seg={28} /><Cyl r={0.15} h={0.01} pos={[0, 0.088, 0]} map={tex.rice} seg={24} /><RBox size={[0.04, 0.02, 0.05]} pos={[0.17, 0.06, 0]} color="#3b3b46" r={0.008} /><RBox size={[0.04, 0.02, 0.05]} pos={[-0.17, 0.06, 0]} color="#3b3b46" r={0.008} /></group>}
          </>
        );
      })()}
      <group position={[-6 + (t % 24) * 1.4, 4.2 + Math.sin(t) * 0.3, -6]} rotation={[0, 0, 0]}>
        <mesh rotation={[0, 0, 0.5 * Math.sin(f * 0.9)]} position={[-0.13, 0, 0]}><planeGeometry args={[0.3, 0.08]} /><meshBasicMaterial color="#17141c" side={THREE.DoubleSide} /></mesh>
        <mesh rotation={[0, 0, -0.5 * Math.sin(f * 0.9)]} position={[0.13, 0, 0]}><planeGeometry args={[0.3, 0.08]} /><meshBasicMaterial color="#17141c" side={THREE.DoubleSide} /></mesh>
      </group>
      <Lens t={t} />
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
  const hookA = t0 >= LOOP_AT ? 1 : t0 < 3.4 ? 1 : t0 < 3.8 ? 1 - (t0 - 3.4) / 0.4 : 0;
  const actors = ACTORS.map((a) => {
    const s = stateOf(a, t);
    if (!s) return null;
    return <StickHero key={a.id} pos={V(s.x, 0, s.z)} expr={s.expr} arms="down" f={f} outfit={a.o} height={s.h} hop={s.hop} flip={s.flip} rig={s.rig} talk={s.talk} breath={0} />;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#bfe0f5" }}>
      <ThreeCanvas width={FRAME.width} height={FRAME.height} shadows camera={{ fov: 40, near: 0.05, far: 260, position: HOOK.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={["#bfe0f5"]} />
        <fog attach="fog" args={["#cfe6f2", 30, 130]} />
        <hemisphereLight args={["#d8ecff", "#e0c890", 1.05]} />
        <Sun cam={cam} hot={0.35} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={0.3} occlude />
        <World t={t} f={f} />
        {actors}
      </ThreeCanvas>
      <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: hookA }}>
        {HOOK_LINES.map((l) => (
          <div key={l.text} style={{ background: "#000", padding: "10px 34px", fontFamily: "Outfit, Arial Black, sans-serif", fontWeight: 900, fontSize: 124, color: "#fff", lineHeight: 1.05, whiteSpace: "nowrap" }}>
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
