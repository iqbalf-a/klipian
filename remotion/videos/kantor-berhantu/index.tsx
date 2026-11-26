/* Lab dikira berhantu, pelakunya kipas (look ricks, B46): a true story told in the ricks picture. In a medical-equipment laboratory a scientist, alone, feels cold and low and sees a shape at the corner of his eye;
   the next day a fencing foil clamped in a vice vibrates by itself, and more the nearer it is carried to the middle of the room. The cause is a newly fitted extractor fan that makes about 19 Hz infrasound; the
   researchers (Tandy and Lawrence, 1998) suggest such sound can cause chills, dread and seeing a figure (Wikipedia "Vic Tandy", IFLScience 2026). Nothing is invented but the doubting colleagues and their lines (illustration).
   The picture follows the voice (words.json from faster-whisper): one shot per sentence, one caption word at a time, a pill on its number (B45), mouths move only on the two quoted lines (B46 n), the last shot is the
   whole team round the vice and the cut after it returns to the first shot (the loop). The set is the video's own: a laboratory of white-green plaster and a teal band, a vinyl check floor, a steel workbench with a
   cast-iron vice, a pegboard of outlined tools, a wall fan with a duct, a steel trolley and a drawer cabinet; the ghost, the cold breath and the sound rings are drawn for the story. */
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FRAME } from "../../src/tokens.ts";
import { CAST, RicksCamera, RicksPost, StickHero, Pills, WordCaption, camAt, painted, readWords, rnd, stepAt, V, type Cam, type Expr, type Outfit, type Pill, type Shot } from "../../src/ricks/kit.tsx";
import { handOffset, poseAt, reach, POSES, type Pose } from "../../src/ricks/rig.ts";
import { choreoAt, locomote, type Choreo } from "../../src/ricks/choreo.ts";
import type { StoryT } from "../../src/schema.ts";
import storyJson from "./story.json";
import WORDS from "./words.json";

export const story = storyJson as unknown as StoryT;
export const TOTAL = 90.02;
const LOOP_AT = 89.5;   // after the last spoken word has ended; from here the picture holds the first moment (the loop)
const SPEED = { walk: 1.1, jog: 2.6 };   // B64: the gait cannot keep up above these (m/s)
const FPS = 30;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const prog = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (u: number) => u * u * (3 - 2 * u);
type Beat = ["hop", number, number, number];
const beatsAt = (beats: Beat[], t: number) => {
  let hop = 0;
  for (const [, a, b, v] of beats) if (t >= a && t < b) hop += Math.sin(((t - a) / (b - a)) * Math.PI) * v;   // a hop is a laugh or a cheer; nothing else moves a body up and down
  return hop;
};
type Track = { ch?: Choreo; dir?: number; flip?: boolean; a: number; b: number; pos: (t: number) => [number, number]; faces: [number, Expr, string][]; beats?: Beat[]; h?: number };
const stay = (x: number, z: number) => (): [number, number] => [x, z];
/** a constant pace from (x0,z0) to (x1,z1): what a walking or running person really does (B64) */
const go = (a: number, b: number, x0: number, z0: number, x1: number, z1: number) => (t: number): [number, number] => { const k = prog(t, a, b); return [lerp(x0, x1, k), lerp(z0, z1, k)]; };
/** B55: a track that walks along its own path gets planted feet (`locomote`); a path that goes left is built mirrored. */
const withGait = (tr: Track, kind: "walk" | "jog", lead = 0): Track => {
  const [px, pz] = tr.pos(tr.a), [qx, qz] = tr.pos(tr.b), v = Math.hypot(qx - px, qz - pz) / (tr.b - tr.a);
  if (v > SPEED[kind]) throw new Error(`B64: a ${kind} of ${v.toFixed(2)} m/s (${tr.a}-${tr.b}) is faster than the gait allows (${SPEED[kind]} m/s)`);
  const dir = Math.sign(tr.pos(tr.b - 0.01)[0] - tr.pos(tr.a)[0]) || 1;
  return { ...tr, flip: dir < 0, dir, ch: locomote((t) => dir * tr.pos(t)[0], tr.a, tr.b, kind, lead) };
};
const A8 = (lSh: number, lEl: number, rSh: number, rEl: number, x: Partial<Pose> = {}): Pose => ({ lSh, lEl, rSh, rEl, lHip: -8, lKn: 0, rHip: 8, rKn: 0, ...x });
const speck = (c: CanvasRenderingContext2D, w: number, h: number, n: number, cols: string[], size = 3, seed = 0) => {
  for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(rnd(i * 3 + seed) * w, rnd(i * 7 + seed) * h, 1 + rnd(i * 5 + seed) * size, 1 + rnd(i * 11 + seed) * size); }
};
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

// ---------- the cast: who is really there (B53): the scientist of a medical-equipment laboratory, an older colleague, a young technician; every look is its own (B61 to B63) ----------------------------------
const SCI: Outfit = { shirt: "#f4f1e8", stripe: "#3d6f9e", garment: "jacket", pattern: "plain", hair: "sidepart", hairColor: "#6b4a2b", glasses: true, brows: "thick", pocket: true, nose: "dot", freckles: true };
const OLD: Outfit = { shirt: "#8c9a5b", stripe: "#d9d2b0", garment: "vest", hat: "cap", hatColor: "#35508a", mustache: true, body: "wide", nose: "big", brows: "bushy", wrinkles: true, hairColor: "#9aa0a6" };
const YNG: Outfit = { shirt: "#2fb7c9", stripe: "#ffffff", garment: "shirt", pattern: "dots", hair: "mohawk", hairColor: "#d9352a", nose: "dot", blush: true, eyebags: true, brows: "arched", belt: "#3a2a1c" };

// the two quoted lines (B46 n, illustration): only these words move a mouth
const TALK: Record<string, [number, number][]> = { old: [[14.0, 16.2]], yng: [[47.6, 48.8]] };
const talkAt = (id: string, t: number) => {
  if (!(TALK[id] ?? []).some(([a, b]) => t >= a && t < b)) return 0;
  const w = WORDS.find((x) => t >= x.a - 0.02 && t < x.b + 0.05);
  return w ? 0.4 + 0.6 * Math.abs(Math.sin(t * 17)) : 0;
};

// ---------- the layout (metres): the vice on the bench at x 0.3, the fan on the back wall at x 4.2, the trolley at 3.5, the scientist's desk at -3.4 ----------------------------------------------------------------
const VICE = { x: 0.3, y: 0.9, z: -0.7 };
const FAN = V(4.2, 2.15, -1.2);
const TROLLEY = { x: 3.5, z: -0.3 };
const DESK = { x: -3.4, z: -0.55 };
const C = (px: number, py: number, pz: number, lx: number, ly: number, lz: number): Cam => ({ pos: V(px, py, pz), look: V(lx, ly, lz) });
const HOOK = C(0.3, 1.3, 4.6, 0.3, 1.2, 0);   // the scientist and the foil in the vice, his head about 30 % of the width
/** B65/B66: every shot carries a real move that combines kinds (push, orbit, crane, roll, follow), 0.06 to 1.2 m/s, one direction, no ease; K = start camera, start look-at, the change over the shot, then the roll (degrees) at the start and its change */
const K = (from: number, ax: number, ay: number, az: number, lx: number, ly: number, lz: number, dx: number, dy: number, dz: number, dlx = 0, dly = 0, dlz = 0, r0 = 0, dr = 0): Shot => {
  const R = Math.PI / 180;
  return { from, lin: true, a: { ...C(ax, ay, az, lx, ly, lz), roll: r0 * R }, b: { ...C(ax + dx, ay + dy, az + dz, lx + dlx, ly + dly, lz + dlz), roll: (r0 + dr) * R } };
};
const SHOTS: Shot[] = [
  K(0, 0.3, 1.3, 4.6, 0.3, 1.2, 0, -0.1, -0.1, -1.0, -0.3, -0.1, -0.3, 0, 3),                 //  1 PUSH+ROLL: the foil vibrates by itself (frame 0 is the hook camera)
  K(4.4, -1.0, 2.6, 10.5, 0.8, 1.2, -0.5, 1.4, -1.1, -3.5, -0.4, -0.05, 0.5),                //  2 CRANE DOWN+PUSH: from high over the whole laboratory down to the bench
  K(8.82, 0.9, 1.1, 5.0, 1.0, 1.0, 0.4, 1.6, 0, 0.2, 1.4, 0, 0, 0, -4),                       //  3 FOLLOW+ROLL: one worker runs out of the building
  K(10.24, 1.4, 1.2, 4.2, -1.0, 1.2, 0.55, -1.2, -0.05, -1.2, 0.1, 0, 0, 0, 3),               //  4 PUSH+ROLL: another is gloomy and shivering
  K(12.76, 0.9, 0.9, 3.2, -1.0, 1.25, 0.5, -1.5, 0.6, 0.2, 0, 0.05, 0),                       //  5 ORBIT+CRANE: low, then up past the shoulder: "ini hantu, jangan diusik"
  K(16.9, -1.6, 0.95, 2.9, -3.4, 1.2, 0.2, -1.3, 0.3, -0.2, 0, 0.05, 0),                      //  6 PUSH+ORBIT: from the desk top, Vic alone in the evening
  K(21.18, -4.2, 1.3, 3.9, -3.4, 1.2, 0.2, 0.4, -0.1, -0.9, 0, -0.05, 0, 0, 6),               //  7 PUSH+ROLL: gloom, a cold sweat, the room creaks
  K(25.52, -3.0, 2.4, 2.6, -3.4, 0.9, 0.2, -0.6, -0.5, 0.3, 0, 0.1, 0, 0, -4),                //  8 CRANE DOWN+ROLL: from above the desk, he works on
  K(27.84, -4.5, 1.3, 3.4, -3.5, 1.2, 0.2, 0.6, 0, -0.9, 0.8, 0, 0, 0, -5),                   //  9 PUSH+ROLL: the shape at the corner of his eye
  K(29.98, -2.0, 1.2, 3.2, -3.2, 1.15, 0.2, -1.6, 0.1, -0.2, -0.2, 0.05, 0, -5, 5),           // 10 ORBIT+ROLL: he turns, it is gone
  K(32.78, -3.2, 0.35, 3.0, -4.2, 1.1, 0.2, -0.5, 0.45, -0.4, 0.1, 0.15, 0),                  // 11 LOW CRANE+PUSH: from the floor up the gas bottle
  K(36.06, -2.8, 1.3, 3.8, -4.0, 1.2, 0.2, -0.5, -0.05, -0.9, 0, -0.05, 0, 0, 3),             // 12 PUSH+ROLL: no leak, he must be tired
  K(38.42, 2.4, 2.6, 5.0, -0.1, 1.0, 0.3, -2.1, -1.3, -1.4, 0, 0.1, -0.3),                  // 13 CRANE DOWN+PUSH: next day, a spare foil into the vice
  K(43.24, 2.2, 1.05, 2.0, 0.5, 1.0, -0.7, -0.8, -0.05, -1.1, -0.2, 0, 0, 0, -4),             // 14 PUSH+ROLL: close on the blade, it vibrates wildly alone
  K(46.32, 1.5, 1.3, 3.6, 0.2, 1.2, 0.3, -2.1, 0.05, 0.2, 0, 0, 0, 3, -6),                    // 15 ORBIT+ROLL: the whisper
  K(49.58, 0.6, 1.3, 4.6, 0.4, 1.1, 0.5, 1.9, 0.1, -0.4, 2.0, 0, 0, 3, -6),                   // 16 FOLLOW+ROLL: he carries the foil across the room
  K(51.98, 2.4, 0.7, 4.4, 2.0, 1.3, 0.5, 1.5, 0.5, -0.2, 1.6, -0.1, 0),                       // 17 LOW FOLLOW+CRANE: stronger in the middle, then it fades
  K(54.46, 3.0, 1.0, 3.2, 4.0, 1.2, 0.5, 0.6, 0.4, 0.4, 0.2, 0.95, -1.7),                     // 18 TILT UP+FOLLOW: he looks for the source, up to the fan
  K(57.2, 2.8, 0.8, 5.2, 3.9, 2.0, -1.2, 1.1, 0.4, -1.6, 0.2, 0.1, 0, 0, -3),                 // 19 LOW PUSH+CRANE: the new extractor fan
  K(59.24, 2.4, 1.4, 4.8, 4.0, 1.4, 0.4, 0.8, -0.05, -1.4, 0, 0, 0, 0, 3),                    // 20 PUSH+ROLL: 19 hertz
  K(61.34, 1.6, 1.3, 9.0, 2.2, 1.4, -0.5, 0.6, 0.9, 1.2, 0, 0.1, 0, 0, -3),                   // 21 CRANE UP+ROLL: too low to hear
  K(62.92, 6.2, 1.3, 3.6, 4.0, 1.2, 0.4, -1.4, -0.05, -0.4, 0, 0, 0),                         // 22 ORBIT+PUSH: the book of symptoms
  K(68.92, -1.5, 1.6, 10.0, 1.5, 1.4, -0.5, 5.0, 0.6, -1.0, 0, 0, 0),                         // 23 ORBIT+CRANE: the standing wave across the room
  K(74.9, -1.2, 1.1, 4.8, -3.2, 1.15, 0.1, -1.2, 0.2, -1.4, -0.2, 0.05, 0, 0, -5),            // 24 PUSH+ROLL: the paper, and the shape in the waves
  K(82.5, -0.8, 1.9, 10.5, -2.0, 1.4, -0.5, -1.4, -0.45, -2.5, -0.8, -0.2, 0.6),              // 25 PUSH+CRANE: the ghost was an unheard sound
  K(84.98, 0.6, 1.9, 9.8, 0.6, 1.15, -0.2, 0, -0.6, -2.2),                                     // 26 PUSH+CRANE: everyone knows the cause
];

// ---------- the acted poses (hands reach canvas points, B52) ----------------------------------------------------------------------------------------------------------------------------------
const poseNamed = (name: string, t: number): Pose | null => {
  const H = POSES.hips;
  switch (name) {
    case "foil": { const l = reach("l", 60, 380 - 12 * Math.sin(t * 6)); return A8(l.sh, l.el, H.rSh, H.rEl); }
    case "chin": { const r = reach("r", 300, 400), l = reach("l", 200, 580); return A8(l.sh, l.el, r.sh, r.el, { lean: 5 }); }
    case "talk": { const l = reach("l", 40 + 25 * Math.sin(t * 7), 380), r = reach("r", 470, 540 + 20 * Math.sin(t * 5)); return A8(l.sh, l.el, r.sh, r.el); }
    case "whisper": { const r = reach("r", 318, 380), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el, { lean: -3 }); }
    case "read": { const r = reach("r", 330, 600 + 10 * Math.sin(t * 3)), l = reach("l", 190, 590); return A8(l.sh, l.el, r.sh, r.el, { lean: 6 }); }
    case "shiver": { const b = POSES.belly; return { ...b, lean: 2.6 * Math.sin(t * 47) }; }
    case "recoil": { const l = reach("l", 60, 300), r = reach("r", 452, 300); return A8(l.sh, l.el, r.sh, r.el, { lean: -5 }); }
    case "carry": { const r = reach("r", 470, 575), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "valve": { const r = reach("r", 420, 230), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "pointup": { const r = reach("r", 362, 590), l = reach("l", 70, 170 + 10 * Math.sin(t * 4)); return A8(l.sh, l.el, r.sh, r.el); }
    case "palmface": { const r = reach("r", 262, 300), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el, { lean: 3 }); }
    case "stand": { const l = reach("l", 150, 590), r = reach("r", 362, 590); return A8(l.sh, l.el, r.sh, r.el); }
    default: return null;
  }
};

type AState = { rig: Pose; x: number; z: number; flip: boolean; expr: Expr; hop: number; h: number; talk: number; kind: string };
const FOREVER = 1000;
const ACTORS: { id: string; o: Outfit; tracks: Track[] }[] = [
  { id: "sci", o: SCI, tracks: [   // Vic Tandy, the lab scientist
    { a: 0, b: 4.4, pos: stay(-0.2, 0.5), faces: [[0, "puzzled", "foil"]] },
    { a: 4.4, b: 8.82, pos: stay(-0.2, 0.5), faces: [[4.4, "puzzled", "chin"], [6.6, "sly", "chin"]] },
    { a: 8.82, b: 12.76, pos: stay(-0.2, 0.5), faces: [[8.82, "shocked", "stand"], [10.3, "puzzled", "stand"]] },
    { a: 12.76, b: 16.9, pos: stay(-0.2, 0.5), faces: [[12.76, "calm", "stand"], [15.4, "sly", "hips"]] },
    { a: 16.9, b: 21.18, pos: stay(-3.4, 0.2), faces: [[16.9, "calm", "read"]] },
    { a: 21.18, b: 25.52, pos: stay(-3.4, 0.2), faces: [[21.18, "puzzled", "shiver"], [22.8, "sleepy", "shiver"]] },
    { a: 25.52, b: 27.84, pos: stay(-3.4, 0.2), faces: [[25.52, "sleepy", "read"]] },
    { a: 27.84, b: 29.98, pos: stay(-3.4, 0.2), faces: [[27.84, "shocked", "recoil"]] },
    { a: 29.98, b: 32.78, flip: true, pos: stay(-3.4, 0.2), faces: [[29.98, "shocked", "recoil"], [31.4, "puzzled", "hips"]] },
    withGait({ a: 32.78, b: 34.0, pos: go(32.78, 34.0, -3.4, 0.2, -4.0, 0.2), faces: [[32.78, "puzzled", "down"]] }, "walk", 0.2),
    { a: 34.0, b: 36.06, flip: true, pos: stay(-4.0, 0.2), faces: [[34.0, "puzzled", "valve"], [35.2, "calm", "valve"]] },
    { a: 36.06, b: 38.42, flip: true, pos: stay(-4.0, 0.2), faces: [[36.06, "sleepy", "palmface"]] },
    { a: 38.42, b: 41.72, pos: stay(-0.2, 0.5), faces: [[38.42, "grin", "carry"]] },
    { a: 41.72, b: 42.3, pos: stay(-0.2, 0.5), faces: [[41.72, "calm", "foil"]] },
    withGait({ a: 42.3, b: 43.5, pos: go(42.3, 43.5, -0.2, 0.5, -1.3, 0.5), faces: [[42.3, "calm", "down"]] }, "walk", 0.2),
    { a: 43.5, b: 44.8, pos: stay(-1.3, 0.5), faces: [[43.5, "shocked", "stand"]] },
    withGait({ a: 44.8, b: 46.0, pos: go(44.8, 46.0, -1.3, 0.5, -0.2, 0.5), faces: [[44.8, "puzzled", "down"]] }, "walk", 0.2),
    { a: 46.0, b: 49.58, pos: stay(-0.2, 0.5), faces: [[46.0, "puzzled", "stand"], [47.6, "shocked", "recoil"]] },
    withGait({ a: 49.58, b: 54.4, pos: go(49.58, 54.4, -0.2, 0.5, 4.0, 0.5), faces: [[49.58, "sly", "carry"]] }, "walk", 0.2),
    { a: 54.4, b: 57.2, pos: stay(4.0, 0.5), faces: [[54.4, "puzzled", "stand"]] },
    { a: 57.2, b: 59.24, pos: stay(4.0, 0.5), faces: [[57.2, "grin", "pointup"]] },
    { a: 59.24, b: 61.34, pos: stay(4.0, 0.5), faces: [[59.24, "calm", "stand"], [60.1, "grin", "stand"]] },
    { a: 61.34, b: 62.92, pos: stay(4.0, 0.5), faces: [[61.34, "puzzled", "palmface"]] },
    { a: 62.92, b: 68.92, pos: stay(4.0, 0.5), faces: [[62.92, "puzzled", "read"], [66.3, "sleepy", "shiver"]] },
    { a: 68.92, b: 74.9, pos: stay(4.0, 0.5), faces: [[68.92, "calm", "stand"], [72.4, "grin", "pointup"]] },
    { a: 74.9, b: 82.5, pos: stay(-3.4, 0.2), faces: [[74.9, "calm", "read"], [80.4, "sleepy", "shiver"]] },
    { a: 82.5, b: 84.98, pos: stay(-3.4, 0.2), faces: [[82.5, "grin", "hips"]] },
    { a: 84.98, b: FOREVER, pos: stay(1.5, 0.5), faces: [[84.98, "grin", "hips"], [87.0, "grin", "stand"]] },
  ] },
  { id: "old", o: OLD, tracks: [   // the senior lab colleague
    { a: 4.4, b: 6.0, pos: stay(-3.0, 0.4), faces: [[4.4, "calm", "read"]] },
    withGait({ a: 6.0, b: 8.2, pos: go(6.0, 8.2, -3.0, 0.4, -1.0, 0.55), faces: [[6.0, "sly", "down"]] }, "walk", 0.2),
    { a: 8.2, b: 10.24, pos: stay(-1.0, 0.55), faces: [[8.2, "puzzled", "stand"]] },
    { a: 10.24, b: 12.76, pos: stay(-1.0, 0.55), faces: [[10.24, "sleepy", "shiver"]] },
    { a: 12.76, b: 16.9, pos: stay(-1.0, 0.55), faces: [[12.76, "puzzled", "talk"], [13.8, "shocked", "talk"]] },
    { a: 84.98, b: FOREVER, pos: stay(-0.3, 0.5), faces: [[84.98, "puzzled", "palmface"], [87.0, "sly", "shrug"]] },
  ] },
  { id: "yng", o: YNG, tracks: [   // the young technician: runs out, comes back
    withGait({ a: 8.82, b: 10.24, pos: go(8.82, 10.24, 0.9, 0.4, 4.4, 0.4), faces: [[8.82, "shocked", "recoil"]] }, "jog", 0.2),
    { a: 46.32, b: 54.46, pos: stay(0.6, 0.15), faces: [[46.32, "shocked", "whisper"], [49.58, "shocked", "recoil"]] },
    { a: 84.98, b: FOREVER, pos: stay(0.7, 0.1), faces: [[84.98, "grin", "hips"], [87.0, "grin", "shrug"]] },
  ] },
];
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

// ---------- the moments of the story ----------------------------------------------------------------------------------------------------------------------------------------------------------------
const FOIL_IN = 38.42, FOIL_LAID = 54.46, FOIL_BACK = 84.98;     // the spare foil arrives in his hand, is laid on the trolley, goes back into the vice for the last shot
const AMP: [number, number][] = [[0, 0.05], [4.4, 0.05], [41.7, 0.02], [43.24, 0.02], [44.2, 0.18], [49.5, 0.18], [49.6, 0.05], [52.4, 0.19], [54.4, 0.03], [55, 0.03], [84.9, 0.05], [85.0, 0.16], [89.6, 0.16], [90.1, 0.05]];   // how far the tip of the blade swings (m)
const dusk = (t: number) => (t >= 16.9 && t < 38.42 ? prog(t, 16.9, 17.4) : 0);   // the evening he is alone
const GHOSTS: [number, number, number, number][] = [[27.9, 32.0, -2.55, 0.15], [80.6, 82.6, -2.5, 0.15]];   // [from, to, x, z]: the shape at the corner of his eye, and again in the waves
const WAVES: [number, number] = [59.24, 84.98];
const PILLS: Pill[] = [{ at: 59.92, until: 61.9, text: "19 hertz", key: "19", color: "#ff6b3d", y: 330 }];
const HOOK_LINES: { text: string; key?: string }[] = [{ text: "Pedang" }, { text: "", key: "bergetar" }, { text: "sendiri" }];
const READ = [...readWords(WORDS.map((x) => ({ ...x }))), { w: "Pedang", a: 89.62, b: 90.02 }];   // the first word comes back on the last 0.4 s so the loop holds

// ---------- painted textures (grain, wear, many small marks; nothing is one flat colour) ----------------------------------------------------------------------------------------------------------------------------
const plaster = (base: string, grime: string) => (c: CanvasRenderingContext2D) => {
  c.fillStyle = base; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 1100, ["rgba(255,255,255,.12)", "rgba(40,60,50,.10)"], 4, 3);
  for (let i = 0; i < 5; i++) { const g = c.createRadialGradient(rnd(i + 2) * 256, rnd(i + 8) * 256, 0, rnd(i + 2) * 256, rnd(i + 8) * 256, 70); g.addColorStop(0, "rgba(255,255,255,.14)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 256, 256); }
  const g = c.createLinearGradient(0, 170, 0, 256); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, grime); c.fillStyle = g; c.fillRect(0, 170, 256, 86);
};
const vinyl = (c: CanvasRenderingContext2D) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? "#c9d3d7" : "#8f9ea6"; c.fillRect(x * 64, y * 64, 64, 64); }
  speck(c, 256, 256, 900, ["rgba(255,255,255,.14)", "rgba(20,30,40,.12)"], 3, 9);
  c.strokeStyle = "rgba(30,40,50,.35)"; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, 256); c.moveTo(0, i * 64); c.lineTo(256, i * 64); c.stroke(); }
  c.strokeStyle = "rgba(40,30,20,.25)"; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(rnd(i) * 256, rnd(i + 3) * 256); c.quadraticCurveTo(rnd(i + 5) * 256, rnd(i + 7) * 256, rnd(i + 11) * 256, rnd(i + 13) * 256); c.stroke(); }   // scuffs
};
const laminate = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#5f7f95"; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 700, ["rgba(255,255,255,.12)", "rgba(0,20,40,.12)"], 2, 5);
  c.strokeStyle = "rgba(255,255,255,.16)"; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 60); c.lineTo(256, 40); c.moveTo(0, 170); c.lineTo(256, 190); c.stroke();
  c.fillStyle = "rgba(20,15,10,.5)"; c.beginPath(); c.arc(70, 120, 9, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.arc(198, 70, 14, 0, 7); c.fill();   // a ring mark, a bright patch
};
const steelBrushed = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#b9c3ca"; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) { c.fillStyle = `rgba(${rnd(y) > 0.5 ? "255,255,255" : "30,40,50"},${0.04 + rnd(y + 3) * 0.1})`; c.fillRect(0, y, 256, 2); }
  const g = c.createLinearGradient(0, 0, 256, 0); g.addColorStop(0.2, "rgba(255,255,255,.28)"); g.addColorStop(0.5, "rgba(255,255,255,0)"); g.addColorStop(0.85, "rgba(0,0,0,.2)"); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
};
const pegboard = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#d8c9a6"; c.fillRect(0, 0, 512, 256); c.fillStyle = "rgba(60,45,25,.5)";
  for (let y = 10; y < 256; y += 20) for (let x = 10; x < 512; x += 20) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
  c.lineCap = "round"; c.lineJoin = "round";
  const shade = (draw: () => void) => { c.save(); c.translate(6, 6); c.fillStyle = "rgba(70,50,25,.35)"; c.strokeStyle = "rgba(70,50,25,.35)"; draw(); c.restore(); };
  const hammer = () => { c.lineWidth = 16; c.beginPath(); c.moveTo(70, 60); c.lineTo(70, 220); c.stroke(); c.fillRect(30, 40, 80, 32); };
  const pliers = () => { c.lineWidth = 12; c.beginPath(); c.moveTo(170, 90); c.lineTo(150, 230); c.moveTo(210, 90); c.lineTo(230, 230); c.stroke(); c.beginPath(); c.moveTo(170, 90); c.lineTo(180, 30); c.lineTo(200, 30); c.lineTo(210, 90); c.closePath(); c.fill(); };
  const spanner = () => { c.lineWidth = 18; c.beginPath(); c.moveTo(320, 220); c.lineTo(320, 80); c.stroke(); c.beginPath(); c.arc(320, 60, 30, 0.6, 5.7); c.lineWidth = 14; c.stroke(); };
  const saw = () => { c.beginPath(); c.moveTo(380, 50); c.lineTo(500, 50); c.lineTo(500, 110); c.lineTo(380, 150); c.closePath(); c.fill(); c.lineWidth = 12; c.beginPath(); c.moveTo(380, 150); c.lineTo(380, 220); c.stroke(); };
  for (const [d, fill] of [[hammer, "#4a4a52"], [pliers, "#c0392b"], [spanner, "#8e98a3"], [saw, "#b9c3ca"]] as [() => void, string][]) { shade(d); c.fillStyle = fill; c.strokeStyle = fill; d(); }
  c.fillStyle = "#8a5a32"; c.fillRect(62, 120, 16, 100); c.fillStyle = "#2f6fdf"; c.fillRect(372, 150, 16, 70);
};
const softTex = (c: CanvasRenderingContext2D) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); };
const ringTex = (c: CanvasRenderingContext2D) => { c.strokeStyle = "rgba(150,215,255,1)"; c.lineWidth = 5; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.stroke(); c.lineWidth = 2; c.strokeStyle = "rgba(255,255,255,.8)"; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.stroke(); };
const ghostTex = (c: CanvasRenderingContext2D) => {   // a tall person-shaped shadow with a pale rim and a wavy hem, no face
  c.fillStyle = "rgba(14,8,34,.88)"; c.strokeStyle = "rgba(170,150,255,.55)"; c.lineWidth = 3;
  c.beginPath(); c.arc(64, 48, 24, 0, 7); c.moveTo(34, 256); c.quadraticCurveTo(26, 120, 44, 84); c.quadraticCurveTo(64, 74, 84, 84); c.quadraticCurveTo(102, 120, 94, 256);
  for (let k = 0; k < 4; k++) c.quadraticCurveTo(88 - k * 16, 236 + (k % 2) * 18, 78 - k * 16, 256 - (k % 2) * 4);
  c.closePath(); c.fill(); c.stroke();
};
const drawScreen = (c: CanvasRenderingContext2D, mode: "ecg" | "meter", t: number) => {
  c.fillStyle = mode === "ecg" ? "#06140c" : "#10181f"; c.fillRect(0, 0, 256, 160); c.lineWidth = 4;
  c.strokeStyle = mode === "ecg" ? "#5dff9a" : "#7cc6ff"; c.beginPath();
  for (let x = 0; x <= 256; x += 4) { const u = x / 256; const y = mode === "ecg" ? 80 - (((x / 4 + Math.floor(t * 6)) % 18) === 0 ? 50 : 0) - (((x / 4 + Math.floor(t * 6)) % 18) === 1 ? -22 : 0) : 80 + 38 * Math.sin(u * 22 + t * 9); x === 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
  c.stroke();
  if (mode === "meter") { c.fillStyle = "#ffd447"; c.font = "bold 42px Arial"; c.fillText("19 Hz", 14, 44); }
};

// ---------- parts: the vice with its foil, the bench, the fan, the trolley, the cabinet, the desk, the monitor ------------------------------------------------------------------------------------------------------
const Foil: React.FC<{ pos: [number, number, number]; amp: number; f: number; rotZ?: number; buzz?: number }> = ({ pos, amp, f, rotZ = 0, buzz = 1 }) => {
  const ph = f * 1.13, segs = Array.from({ length: 9 }, (_, i) => i);
  const yAt = (s: number) => amp * buzz * s * s * Math.sin(ph) / 0.95;   // a clamped blade swings in a curve: nothing at the clamp, most at the tip
  return (
    <group position={pos} rotation={[0, 0, rotZ]}>
      <RBox size={[0.22, 0.032, 0.032]} pos={[-0.12, -0.018, 0]} color="#2b2b33" r={0.012} />
      <RBox size={[0.08, 0.05, 0.03]} pos={[-0.27, -0.045, 0]} rot={[0, 0, -0.5]} color="#2b2b33" r={0.012} />
      <Cyl r={0.06} r2={0.075} h={0.04} pos={[0.015, 0, 0]} rot={[0, 0, Math.PI / 2]} color="#c9a227" metal={0.8} rough={0.3} seg={24} />
      {segs.map((i) => { const s0 = i * 0.105, s1 = s0 + 0.105, y0 = yAt(s0), y1 = yAt(s1), len = Math.hypot(0.105, y1 - y0); return <RBox key={i} size={[len + 0.004, 0.024, 0.008]} pos={[0.04 + (s0 + s1) / 2, (y0 + y1) / 2, 0]} rot={[0, 0, Math.atan2(y1 - y0, 0.105)]} color="#dfe6ea" metal={0.9} rough={0.2} r={0.002} />; })}
      <Ball r={0.008} pos={[0.04 + 0.95, yAt(0.95), 0]} color="#dfe6ea" />
    </group>
  );
};
const Vice: React.FC = () => (
  <group position={[VICE.x, VICE.y, VICE.z]}>
    <RBox size={[0.34, 0.09, 0.26]} pos={[0, 0.045, 0]} color="#244a6b" metal={0.4} rough={0.5} r={0.02} />
    <RBox size={[0.22, 0.16, 0.1]} pos={[0.03, 0.17, 0.07]} color="#2d5c85" metal={0.4} rough={0.5} r={0.02} />
    <RBox size={[0.1, 0.14, 0.07]} pos={[-0.08, 0.17, -0.07]} color="#2d5c85" metal={0.4} rough={0.5} r={0.02} />
    <Cyl r={0.014} h={0.3} pos={[-0.02, 0.15, 0.2]} rot={[Math.PI / 2, 0, 0]} color="#8e98a3" metal={0.8} rough={0.3} seg={10} />
    <Cyl r={0.012} h={0.2} pos={[-0.02, 0.15, 0.34]} rot={[0, 0, Math.PI / 2]} color="#8e98a3" metal={0.8} rough={0.3} seg={10} />
    <Ball r={0.02} pos={[-0.12, 0.15, 0.34]} color="#8e98a3" /><Ball r={0.02} pos={[0.08, 0.15, 0.34]} color="#8e98a3" />
  </group>
);
const Bench: React.FC<{ tex: TexSet; q: number }> = ({ tex, q }) => (
  <group>
    <RBox size={[4.2, 0.06, 0.82]} pos={[-0.6, 0.87, -0.75]} map={tex.lam} tile={1.0} r={0.015} />
    {[-2.5, -0.6, 1.3].map((x, i) => <RBox key={i} size={[0.06, 0.84, 0.74]} pos={[x, 0.42, -0.75]} color="#6d7a84" metal={0.5} rough={0.5} r={0.01} />)}
    <RBox size={[4.1, 0.04, 0.7]} pos={[-0.6, 0.3, -0.75]} map={tex.steel} metal={0.5} rough={0.4} r={0.01} />
    {[-1.9, -0.8, 0.5].map((x, i) => <group key={i}><RBox size={[0.5, 0.24, 0.04]} pos={[x, 0.58, -0.37]} color="#8e9aa4" metal={0.4} rough={0.45} r={0.012} /><RBox size={[0.16, 0.025, 0.03]} pos={[x, 0.58, -0.34]} map={tex.steel} metal={0.8} r={0.008} /></group>)}
    <Vice />
    {/* the lab's own products on the bench: a bedside monitor with its trace, an infusion pump with a syringe, a coil of ECG leads; they tremble with the room (q) */}
    <group position={[-1.8 + 0.006 * q, 0.9, -0.85]}><RBox size={[0.52, 0.4, 0.3]} pos={[0, 0.2, 0]} color="#d6dde2" r={0.03} /><RBox size={[0.42, 0.28, 0.02]} pos={[0, 0.22, 0.16]} map={tex.ecg} fit r={0.01} /><Cyl r={0.04} h={0.1} pos={[0, 0.02, 0]} color="#8e98a3" metal={0.6} seg={14} /></group>
    <group position={[-1.1, 0.9, -0.85 + 0.005 * q]}><RBox size={[0.28, 0.34, 0.22]} pos={[0, 0.17, 0]} color="#f2efe6" r={0.03} /><RBox size={[0.18, 0.1, 0.02]} pos={[0, 0.25, 0.115]} color="#2f6fdf" r={0.008} /><Cyl r={0.022} h={0.2} pos={[0.18, 0.2, 0]} rot={[0, 0, Math.PI / 2]} color="#cfe9f5" rough={0.1} seg={12} /></group>
    <mesh position={[-0.55, 0.93, -0.55]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.1, 0.012, 8, 24]} /><meshStandardMaterial color="#e0456b" roughness={0.6} /></mesh>
    <group position={[1.0 + 0.004 * q, 0.9, -0.9]}><Cyl r={0.05} h={0.12} pos={[0, 0.06, 0]} color="#fffaf0" rough={0.3} seg={16} /><Cyl r={0.045} h={0.01} pos={[0, 0.115, 0]} color="#5a3a24" seg={16} /></group>
  </group>
);
const Fan: React.FC<{ tex: TexSet; f: number }> = ({ tex, f }) => (
  <group position={FAN.toArray()}>
    <RBox size={[1.25, 1.25, 0.18]} pos={[0, 0, 0]} color="#e9ecee" r={0.05} rough={0.5} />
    <RBox size={[1.3, 0.05, 0.22]} pos={[0, 0.66, 0]} color="#c9d0d6" r={0.02} />
    <mesh position={[0, 0, 0.1]}><circleGeometry args={[0.52, 40]} /><meshStandardMaterial color="#10161b" roughness={0.9} /></mesh>
    <group position={[0, 0, 0.12]} rotation={[0, 0, -f * 0.62]}>{[0, 1, 2, 3, 4].map((k) => <group key={k} rotation={[0, 0, (k / 5) * Math.PI * 2]}><mesh position={[0.24, 0, 0]} rotation={[0, 0.5, 0]}><boxGeometry args={[0.46, 0.17, 0.012]} /><meshStandardMaterial color="#cfd6db" metalness={0.5} roughness={0.35} /></mesh></group>)}<Cyl r={0.07} h={0.07} pos={[0, 0, 0.02]} rot={[Math.PI / 2, 0, 0]} color="#7b8791" metal={0.7} seg={16} /></group>
    {[0.2, 0.34, 0.48].map((r, i) => <mesh key={i} position={[0, 0, 0.17]}><torusGeometry args={[r, 0.008, 6, 40]} /><meshStandardMaterial color="#aeb8bf" metalness={0.8} roughness={0.3} /></mesh>)}
    {[0, 1, 2, 3].map((k) => <RBox key={k} size={[1.0, 0.012, 0.012]} pos={[0, 0, 0.17]} rot={[0, 0, (k * Math.PI) / 4]} color="#aeb8bf" metal={0.8} r={0.004} />)}
    <RBox size={[0.34, 0.2, 0.01]} pos={[0.5, -0.5, 0.1]} map={tex.tag} fit r={0.004} />
    <Cyl r={0.22} h={1.1} pos={[0, 1.15, -0.02]} color="#c4cbd1" metal={0.5} rough={0.5} seg={20} />
  </group>
);
const Trolley: React.FC<{ tex: TexSet; q: number; hasMeter: boolean }> = ({ tex, q, hasMeter }) => (
  <group position={[TROLLEY.x, 0, TROLLEY.z]}>
    {[[-0.35, -0.22], [0.35, -0.22], [-0.35, 0.22], [0.35, 0.22]].map(([x, z], i) => <group key={i}><RBox size={[0.04, 0.8, 0.04]} pos={[x, 0.46, z]} map={tex.steel} metal={0.7} rough={0.3} r={0.01} /><Cyl r={0.05} h={0.04} pos={[x, 0.05, z]} rot={[0, 0, Math.PI / 2]} color="#17141c" seg={14} /></group>)}
    <RBox size={[0.8, 0.04, 0.55]} pos={[0, 0.9, 0]} map={tex.steel} metal={0.6} rough={0.3} r={0.01} />
    <RBox size={[0.8, 0.04, 0.55]} pos={[0, 0.35, 0]} map={tex.steel} metal={0.6} rough={0.3} r={0.01} />
    <group position={[0.1, 0.35 + 0.02, 0]}><RBox size={[0.4, 0.2, 0.3]} pos={[0, 0.1, 0]} color="#e0b84a" r={0.03} /><RBox size={[0.3, 0.1, 0.02]} pos={[0, 0.12, 0.16]} color="#2a2a33" r={0.01} /></group>
    {!hasMeter && <RBox size={[0.22, 0.1, 0.14]} pos={[-0.15 + 0.004 * q, 0.97, 0]} color="#2f6fdf" r={0.02} />}
  </group>
);
const Cabinet: React.FC<{ tex: TexSet }> = ({ tex }) => (
  <group position={[5.4, 0, -0.85]}>
    <RBox size={[1.0, 1.9, 0.6]} pos={[0, 0.95, 0]} color="#8fa2ad" metal={0.4} rough={0.5} r={0.025} />
    {[0, 1, 2, 3, 4].map((i) => <group key={i}><RBox size={[0.9, 0.3, 0.03]} pos={[0, 0.2 + i * 0.36, 0.31]} map={tex.steel} metal={0.5} rough={0.4} r={0.012} /><RBox size={[0.3, 0.025, 0.04]} pos={[0, 0.3 + i * 0.36, 0.34]} color="#2a2a33" r={0.01} /><RBox size={[0.16, 0.08, 0.005]} pos={[-0.32, 0.22 + i * 0.36, 0.33]} color="#f4efdc" r={0.002} /></group>)}
  </group>
);
const Desk: React.FC<{ tex: TexSet; f: number }> = ({ tex, f }) => (
  <group position={[DESK.x, 0, DESK.z]}>
    <RBox size={[1.5, 0.05, 0.7]} pos={[0, 0.76, 0]} color="#c9b48a" r={0.015} />
    {[[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]].map(([x, z], i) => <RBox key={i} size={[0.05, 0.74, 0.05]} pos={[x, 0.37, z]} color="#4a4a52" metal={0.4} r={0.01} />)}
    <RBox size={[0.34, 0.012, 0.25]} pos={[-0.3, 0.79, 0.05]} rot={[0, 0.2, 0]} color="#fffaf0" r={0.003} /><RBox size={[0.3, 0.012, 0.22]} pos={[0.1, 0.8, -0.1]} rot={[0, -0.3, 0]} color="#f4efdc" r={0.003} />
    <Cyl r={0.04} h={0.09} pos={[0.5, 0.84, 0.1]} color="#e0456b" rough={0.3} seg={14} />
    <RBox size={[0.24, 0.02, 0.2]} pos={[0.42, 0.78, -0.2]} color="#17141c" r={0.01} />
    <group position={[0, 0, 0.8]}><RBox size={[0.44, 0.05, 0.44]} pos={[0, 0.46, 0]} color="#3d6f9e" r={0.02} /><Cyl r={0.03} h={0.44} pos={[0, 0.22, 0]} color="#6d7a84" metal={0.6} seg={10} /><RBox size={[0.5, 0.04, 0.06]} pos={[0, 0.03, 0]} color="#6d7a84" metal={0.6} r={0.01} /></group>
  </group>
);
const GasBottle: React.FC = () => (
  <group position={[-4.5, 0, -0.7]}>
    <Cyl r={0.12} h={1.2} pos={[0, 0.6, 0]} color="#c8352a" metal={0.3} rough={0.4} seg={20} /><Ball r={0.12} pos={[0, 1.2, 0]} color="#c8352a" rough={0.4} /><Cyl r={0.035} h={0.1} pos={[0, 1.36, 0]} color="#c9a227" metal={0.8} seg={10} />
    <Cyl r={0.12} h={0.03} pos={[0, 0.66, 0]} color="#f4efdc" seg={20} />
  </group>
);
const Book: React.FC<{ pos: THREE.Vector3 }> = ({ pos }) => (
  <group position={pos.toArray()}><RBox size={[0.26, 0.34, 0.05]} pos={[0, 0, 0]} color="#8a2f3a" r={0.015} /><RBox size={[0.22, 0.3, 0.04]} pos={[0.01, 0, 0.012]} color="#f4efdc" r={0.004} /><RBox size={[0.18, 0.04, 0.01]} pos={[0, 0.08, 0.034]} color="#c9a227" r={0.003} /></group>
);
const Ghost: React.FC<{ x: number; z: number; a: number; tex: THREE.Texture; f: number }> = ({ x, z, a, tex, f }) => {
  const camera = useThree((s) => s.camera), g = useRef<THREE.Group>(null);
  useLayoutEffect(() => { if (g.current) g.current.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z); });
  const flick = a * (0.78 + 0.22 * Math.sin(f * 1.7));
  return <group ref={g} position={[x + 0.04 * Math.sin(f * 0.21), 0.99 + 0.04 * Math.sin(f * 0.17), z]}><mesh layers={CAST}><planeGeometry args={[0.9, 1.9]} /><meshBasicMaterial map={tex} transparent opacity={flick} alphaTest={0.02} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh></group>;
};

// ---------- the room ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
type TexSet = Record<"wall" | "floor" | "lam" | "steel" | "peg" | "ecg" | "tag" | "soft" | "ring" | "ghost" | "band", THREE.Texture>;
const Lab: React.FC<{ tex: TexSet; t: number; f: number; q: number }> = ({ tex, t, f, q }) => {
  const floor = useMemo(() => { const m = tex.floor.clone(); m.needsUpdate = true; m.repeat.set(13, 14); return m; }, [tex]);
  const waveOn = t >= WAVES[0] && t < WAVES[1];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0, 6]}><planeGeometry args={[14, 15]} /><meshStandardMaterial map={floor} roughness={0.45} /></mesh>
      <RBox size={[14, 3.3, 0.12]} pos={[0.5, 1.65, -1.36]} map={tex.wall} tile={1.6} r={0.01} />
      <RBox size={[14, 1.0, 0.05]} pos={[0.5, 0.5, -1.28]} map={tex.band} tile={1.2} r={0.01} />
      <RBox size={[14, 0.06, 0.07]} pos={[0.5, 1.02, -1.26]} color="#f4efdc" r={0.02} />
      <RBox size={[0.12, 3.3, 15]} pos={[-6.4, 1.65, 6]} map={tex.wall} tile={1.6} r={0.01} /><RBox size={[0.12, 3.3, 15]} pos={[7.4, 1.65, 6]} map={tex.wall} tile={1.6} r={0.01} />
      <RBox size={[14, 0.1, 15]} pos={[0.5, 3.35, 6]} color="#e9ecee" r={0.02} />
      {[-3.5, 0.5, 4.5].flatMap((x, i) => [1.2, 5.2, 9.2].map((z, k) => <RBox key={`${i}${k}`} size={[0.35, 0.05, 1.5]} pos={[x, 3.28, z]} color="#fffbe8" emissive="#fff6d8" ei={1.1} r={0.02} />))}
      {/* the pegboard of outlined tools and a notice board on the back wall, a pipe along it */}
      <RBox size={[2.6, 1.3, 0.03]} pos={[-2.6, 1.85, -1.27]} map={tex.peg} fit r={0.01} />
      <Cyl r={0.04} h={13.6} pos={[0.5, 2.9, -1.2]} rot={[0, 0, Math.PI / 2]} color="#b9553b" metal={0.4} seg={10} />
      <RBox size={[1.3, 0.9, 0.03]} pos={[0.55, 1.95, -1.27]} color="#b98d54" r={0.01} />
      {[[0.15, 2.1, "#fffaf0"], [0.5, 1.8, "#f4efdc"], [0.85, 2.15, "#ffd447"], [0.9, 1.75, "#fffaf0"]].map(([x, y, c], i) => <RBox key={i} size={[0.26, 0.32, 0.01]} pos={[x as number, y as number, -1.24]} rot={[0, 0, 0.06 * (i - 1.5)]} color={c as string} r={0.002} />)}
      <RBox size={[0.4, 0.4, 0.02]} pos={[-0.7, 2.0, -1.27]} rot={[0, 0, Math.PI / 4]} color="#f2c230" r={0.01} />
      <RBox size={[0.5, 0.35, 0.4]} pos={[0.95, 0.18, 2.8]} color="#b98d54" r={0.02} />
      <Bench tex={tex} q={q} /><Fan tex={tex} f={f} /><Cabinet tex={tex} /><Desk tex={tex} f={f} /><GasBottle />
      {/* near layer: cardboard cartons and a stool cut by the frame, a cable drum */}
      <RBox size={[0.6, 0.45, 0.5]} pos={[-1.5, 0.23, 2.3]} color="#b98d54" r={0.02} /><RBox size={[0.5, 0.35, 0.45]} pos={[-1.45, 0.62, 2.3]} rot={[0, 0.3, 0]} color="#c79a60" r={0.02} />
      <Cyl r={0.2} h={0.5} pos={[1.6, 0.25, 2.2]} color="#7a5a3a" seg={18} /><Cyl r={0.26} h={0.04} pos={[1.6, 0.52, 2.2]} color="#9a7a52" seg={18} />
      <RBox size={[0.5, 0.5, 0.4]} pos={[4.6, 0.25, 1.8]} color="#2f3b4a" r={0.03} metal={0.3} />
      {/* the sound: rings that spread from the fan across the room */}
      {waveOn && [0, 1, 2, 3, 4].map((i) => { const at = streamAt(t, i, 5, 3.2), u = (t - at) / 3.2; return <sprite key={i} position={[FAN.x - 0.2 - u * 1.2, FAN.y - u * 0.6, 0.3]} scale={[0.8 + u * 10, 0.8 + u * 10, 1]}><spriteMaterial map={tex.ring} transparent opacity={0.55 * (1 - u)} depthWrite={false} /></sprite>; })}
      {waveOn && t >= 68.9 && [0, 1, 2, 3, 4].map((i) => { const at = streamAt(t, i, 5, 3.2), u = (t - at) / 3.2; return <sprite key={`r${i}`} position={[-5.8 + u * 1.2, 1.5, 0.3]} scale={[0.8 + u * 10, 0.8 + u * 10, 1]}><spriteMaterial map={tex.ring} transparent opacity={0.4 * (1 - u)} depthWrite={false} /></sprite>; })}
      {/* dust motes in the light, always drifting */}
      {Array.from({ length: 16 }, (_, k) => <sprite key={k} position={[-3 + rnd(k) * 9 + 0.3 * Math.sin(t * 0.5 + k), 0.6 + rnd(k + 20) * 2 + 0.1 * Math.sin(t * 0.7 + k * 2), rnd(k + 40) * 3 - 0.5]} scale={[0.05, 0.05, 1]}><spriteMaterial map={tex.soft} transparent opacity={0.5} depthWrite={false} /></sprite>)}
    </group>
  );
};

const World: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const tex = useMemo(() => ({
    wall: painted(256, 256, plaster("#c3d9cc", "rgba(60,80,60,.28)")), floor: painted(256, 256, vinyl), lam: painted(256, 256, laminate), steel: painted(256, 256, steelBrushed), peg: painted(512, 256, pegboard),
    ecg: painted(256, 160, (c) => drawScreen(c, "ecg", 0)), soft: painted(64, 64, softTex), ring: painted(128, 128, ringTex), ghost: painted(128, 256, ghostTex),
    tag: painted(128, 64, (c) => { c.fillStyle = "#fffaf0"; c.fillRect(0, 0, 128, 64); c.strokeStyle = "#c0392b"; c.lineWidth = 6; c.strokeRect(3, 3, 122, 58); c.fillStyle = "#c0392b"; c.font = "bold 34px Arial"; c.fillText("BARU", 22, 44); }),
    band: painted(256, 256, plaster("#2f7f86", "rgba(0,30,40,.3)")),
  } as unknown as TexSet), []);
  const q = (t >= 21.18 && t < 25.4) || t >= 43.24 ? Math.sin(f * 1.9) : 0;   // the room creaks, later it trembles with the fan
  const sci = stateOf(actor("sci"), t), hand = handAt("sci", "r", t);
  const amp = keyedAmp(t);
  const foilState = t < 4.4 ? "vice" : t < FOIL_IN ? "none" : t < 41.72 ? "hand" : t < 49.58 ? "vice" : t < FOIL_LAID ? "hand" : t < FOIL_BACK ? "laid" : "vice";
  const cold = (t >= 21.18 && t < 36.06) || (t >= 62.92 && t < 69) || (t >= 80.4 && t < 82.5);
  return (
    <group>
      <Lab tex={tex} t={t} f={f} q={q} />
      <Trolley tex={tex} q={q} hasMeter />
      {foilState === "vice" && <Foil pos={[VICE.x - 0.12, VICE.y + 0.17, VICE.z]} amp={amp} f={f} />}
      {foilState === "hand" && hand && <Foil pos={[hand.x + 0.12, hand.y + 0.02, hand.z]} amp={amp} f={f} rotZ={0.12} />}
      {foilState === "laid" && <Foil pos={[TROLLEY.x - 0.45, 0.94, TROLLEY.z + 0.12]} amp={amp} f={f} buzz={1} />}
      {t >= 62.92 && t < 66.3 && hand && <Book pos={V(hand.x + 0.04, hand.y + 0.05, hand.z + 0.12)} />}
      {cold && sci && [0, 1, 2].map((i) => <Puff key={i} x={sci.x + (sci.flip ? -0.06 : 0.06)} y={1.1} z={sci.z + 0.2} t={t} at={streamAt(t, i, 3, 1.4)} dur={1.4} size={0.2} tex={tex.soft} color="#e6f4ff" rise={0.14} />)}
      {GHOSTS.map(([a, b, x, z], i) => t >= a && t < b && <Ghost key={i} x={x} z={z} a={0.55 * Math.min(prog(t, a, a + 0.5), 1 - prog(t, b - 0.7, b))} tex={tex.ghost} f={f} />)}
    </group>
  );
};
const keyedAmp = (t: number) => { for (let i = 1; i < AMP.length; i++) if (t <= AMP[i][0]) { const [t0, v0] = AMP[i - 1], [t1, v1] = AMP[i]; return v0 + (v1 - v0) * ease(prog(t, t0, t1)); } return AMP[AMP.length - 1][1]; };

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = () => {
  const fr = useCurrentFrame();
  const t0 = fr / FPS;
  const t = t0 >= LOOP_AT ? 0.04 : t0;   // from the cut the picture holds the first moment (the hook, full text), so the last frame equals the first and the loop is exact
  const f = Math.round(t * FPS);
  const flash = Math.max(0, 1 - Math.abs(t0 - LOOP_AT) / 0.14);
  const cam = camAt(SHOTS, t, TOTAL);
  const hookA = t0 >= LOOP_AT ? 1 : t0 < 3.9 ? 1 : t0 < 4.4 ? 1 - (t0 - 3.9) / 0.5 : 0;
  const dk = dusk(t);
  const actors = ACTORS.map((a) => {
    const s = stateOf(a, t);
    if (!s) return null;
    return <StickHero key={a.id} pos={V(s.x, 0, s.z)} expr={s.expr} arms="down" f={f} outfit={a.o} height={s.h} hop={s.hop} flip={s.flip} rig={s.rig} talk={s.talk} breath={0} />;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#2a3338" }}>
      <ThreeCanvas width={FRAME.width} height={FRAME.height} shadows camera={{ fov: 40, near: 0.05, far: 80, position: HOOK.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={["#2a3338"]} />
        <fog attach="fog" args={["#c9d6d6", 18, 48]} />
        <hemisphereLight args={[dk > 0.5 ? "#9fb4d8" : "#e4f0ff", "#b9b49a", lerp(1.7, 0.5, dk)]} />
        <Sun cam={cam} hot={0.35 - 1.7 * dk} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={0.35} occlude />
        <World t={t} f={f} />
        {actors}
      </ThreeCanvas>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: hookA }}>
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
