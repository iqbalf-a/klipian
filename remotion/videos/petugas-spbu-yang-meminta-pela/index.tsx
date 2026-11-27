/* Petugas SPBU yang Meminta Pelanggan Menyentuh Logam Dulu (look ricks, B46, a made-up story carried by one true fact: static charge from sliding on a car seat can spark at the nozzle).
   Bu Yati, an SPBU attendant, holds the nozzle until Bang Toni, a parcel driver in a hurry, touches the metal of his van pintu; he refuses, sits back in the cab, slides on the seat, jumps out with a
   crackling nylon jacket and a small blue spark snaps from his finger to the nozzle; the voice explains the charge and the discharge on bare body metal away from the fill point; the next
   day the whole queue pats its pintu first. The picture follows the voice (words.json): one shot per sentence, one caption word at a time, pills on their word (B45), mouths move only on the three
   quoted lines (B46 n), the last shot is the whole queue patting its pintu and the cut after it returns to the first moment (the loop). The set is its own: a forecourt under a canopy with two pumps on a
   concrete island, a parcel van with a cab, a sedan, a minibus and a motorbike in the queue, a shop with a sign, a price pole, sand buckets, bollards and palms. */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FRAME } from "../../src/tokens.ts";
import { CAST, RicksCamera, RicksPost, StickHero, Pills, WordCaption, camAt, painted, readWords, rnd, stepAt, V, type Cam, type Expr, type Outfit, type Pill, type Shot, type Ease } from "../../src/ricks/kit.tsx";
import { handOffset, poseAt, reach, type Pose } from "../../src/ricks/rig.ts";
import { choreoAt, locomote, type Choreo } from "../../src/ricks/choreo.ts";
import { whipStyle, BurstFx, type Whip, type Burst } from "../../src/ricks/transitions.tsx";
import type { StoryT } from "../../src/schema.ts";
import storyJson from "./story.json";
import WORDS from "./words.json";

export const story = storyJson as unknown as StoryT;
const FPS = 30;
export const TOTAL = 51.68;
const LOOP_AT = 51.0;   // after the last spoken word has ended (50.98); from here the picture holds the first moment (the loop)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const prog = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
type Beat = ["hop", number, number, number];
const beatsAt = (beats: Beat[], t: number) => {
  let hop = 0;
  for (const [, a, b, v] of beats) if (t >= a && t < b) hop += Math.sin(((t - a) / (b - a)) * Math.PI) * v;   // a hop is a jump or a start; nothing else moves a body up and down
  return hop;
};
type Track = { ch?: Choreo; dir?: number; flip?: boolean; a: number; b: number; pos: (t: number) => [number, number]; faces: [number, Expr, string][]; beats?: Beat[]; h?: number; sit?: number };
const stay = (x: number, z: number) => (): [number, number] => [x, z];
const SPEED = { walk: 1.1, jog: 2.6 };   // B64: the gait cannot keep up above these (m/s)
/** a constant pace from (x0,z0) to (x1,z1): what a walking person really does (B64) */
const go = (a: number, b: number, x0: number, z0: number, x1: number, z1: number) => (t: number): [number, number] => { const k = prog(t, a, b); return [lerp(x0, x1, k), lerp(z0, z1, k)]; };
/** B55: a track that walks along its own path gets planted feet (`locomote`); a path that goes left is built mirrored. */
const withGait = (tr: Track, kind: "walk" | "jog", lead = 0): Track => {
  const [px, pz] = tr.pos(tr.a), [qx, qz] = tr.pos(tr.b), v = Math.hypot(qx - px, qz - pz) / (tr.b - tr.a);
  if (v > SPEED[kind]) throw new Error(`B64: a ${kind} of ${v.toFixed(2)} m/s (${tr.a}-${tr.b}) is faster than the gait allows (${SPEED[kind]} m/s)`);
  const dir = Math.sign(tr.pos(tr.b - 0.01)[0] - tr.pos(tr.a)[0]) || 1;
  return { ...tr, flip: dir < 0, dir, ch: locomote((t) => dir * tr.pos(t)[0], tr.a, tr.b, kind, lead) };
};
const bump = (u: number) => (u < -0.35 || u > 0.35 ? 0 : u < 0 ? 1 + u / 0.35 : 1 - u / 0.35);
const A8 = (lSh: number, lEl: number, rSh: number, rEl: number, x: Partial<Pose> = {}): Pose => ({ lSh, lEl, rSh, rEl, lHip: -8, lKn: 0, rHip: 8, rKn: 0, ...x });
const speck = (c: CanvasRenderingContext2D, w: number, h: number, n: number, cols: string[], size = 3, seed = 0) => {
  for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(rnd(i * 3 + seed) * w, rnd(i * 7 + seed) * h, 1 + rnd(i * 5 + seed) * size, 1 + rnd(i * 11 + seed) * size); }
};

// ---------- the pieces of the set ----------------------------------------------------------------------------------------------------------------
type RBoxP = { size: [number, number, number]; pos: [number, number, number]; rot?: [number, number, number]; color?: string; map?: THREE.Texture; tile?: number; r?: number; rough?: number; metal?: number; emissive?: string; ei?: number; opacity?: number; fit?: boolean };
/** a box with rounded edges (every real object has them) and a texture whose repeat follows its size (`fit`: the whole texture once, for a sign or a display) */
const RBox: React.FC<RBoxP> = ({ size, pos, rot, color = "#ffffff", map, tile = 1, r = 0.03, rough = 0.78, metal = 0, emissive, ei = 1, opacity = 1, fit }) => {
  const g = useMemo(() => new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(r, size[0] / 2.2, size[1] / 2.2, size[2] / 2.2)), [size[0], size[1], size[2], r]);   // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMemo(() => { if (!map) return undefined; const t = map.clone(); t.needsUpdate = true; if (fit) t.repeat.set(1, 1); else t.repeat.set(Math.max(0.2, Math.max(size[0], size[2]) / tile), Math.max(0.2, size[1] / tile)); return t; }, [map, size[0], size[1], size[2], tile, fit]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={g} position={pos} rotation={rot}><meshStandardMaterial map={m} color={color} roughness={rough} metalness={metal} emissive={emissive ?? "#000"} emissiveIntensity={emissive ? ei : 0} transparent={opacity < 1} opacity={opacity} /></mesh>;
};
const Cyl: React.FC<{ r: number; r2?: number; h: number; pos: [number, number, number]; rot?: [number, number, number]; color?: string; map?: THREE.Texture; seg?: number; metal?: number; rough?: number }> = ({ r, r2, h, pos, rot, color = "#fff", map, seg = 24, metal = 0, rough = 0.6 }) => (
  <mesh position={pos} rotation={rot}><cylinderGeometry args={[r2 ?? r, r, h, seg]} /><meshStandardMaterial map={map} color={color} metalness={metal} roughness={rough} /></mesh>
);
const Ball: React.FC<{ r: number; pos: [number, number, number]; color: string; sc?: [number, number, number]; emissive?: string }> = ({ r, pos, color, sc, emissive }) => (
  <mesh position={pos} scale={sc}><sphereGeometry args={[r, 14, 11]} /><meshStandardMaterial color={color} roughness={0.85} emissive={emissive ?? "#000"} emissiveIntensity={emissive ? 1.4 : 0} /></mesh>
);
const Puff: React.FC<{ x: number; y: number; z: number; t: number; at: number; dur?: number; size?: number; tex: THREE.Texture; color?: string; rise?: number; op?: number }> = ({ x, y, z, t, at, dur = 1.6, size = 0.4, tex, color = "#ffffff", rise = 0.6, op = 0.5 }) => {
  const u = (t - at) / dur;
  if (u < 0 || u > 1) return null;
  return <sprite position={[x, y + u * rise, z]} scale={[size * (0.5 + u), size * (0.5 + u), 1]}><spriteMaterial map={tex} color={color} transparent opacity={op * (1 - u)} depthWrite={false} /></sprite>;
};
/** a stream of puffs: puff i of n is at its own point of a loop of `dur` seconds */
const streamAt = (t: number, i: number, n: number, dur: number) => t - ((t / dur + i / n) % 1) * dur;
const Sun: React.FC<{ cam: { look: THREE.Vector3 } }> = ({ cam }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  const light = React.useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s: { scene: THREE.Scene }) => s.scene);
  React.useLayoutEffect(() => {
    target.position.copy(cam.look); target.updateMatrixWorld();
    light.current!.position.set(cam.look.x - 5, 11, cam.look.z + 7);
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
      <directionalLight ref={light} target={target} intensity={2.3} color="#fff3d2" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={0.5} shadow-camera-far={44} shadow-bias={-0.0008} />
      <primitive object={target} />
    </>
  );
};

// ---------- the layout (metres; x right, y up, z toward the camera) -----------------------------------------------------------------------------------------------------
// the island with two pumps (x -3.2 to -0.9, z 0 to 1), Bu Yati beside it, the parcel van behind (x -3.5 to 1.5, side face at z -0.9), the sedan and the minibus queue behind the van (to -14.8)
const VAN_X = -1.0, VAN_Z = -1.8, SEDAN_X = -6.8, ANGKOT_X = -12.5;
const YATI = { x: -0.3, z: 0.45 }, SPOT = { x: 0.95, z: 0.45 }, GRAB = { x: 0.7, z: 0.45 }, PINTU = { x: 0.85, z: -0.45 };
const COLLAR = V(0.22, 1.02, 0.5);   // the steel collar of the nozzle where the spark jumps (Bu Yati's hand at x 0.1 holds it)
const C = (px: number, py: number, pz: number, lx: number, ly: number, lz: number): Cam => ({ pos: V(px, py, pz), look: V(lx, ly, lz) });
const HOOK = C(0.32, 1.15, 5.4, 0.32, 1.2, 0);   // the face-off: Bu Yati with the nozzle, Bang Toni with crossed arms, both whole, the pump hose entering from the left
// B67: at least 35 % of the shots are locked, at most 3 moving in a row, no roll, no orbit; B69: moving shots have different easings, swoops only to a named object
const K = (from: number, ax: number, ay: number, az: number, lx: number, ly: number, lz: number, dx: number, dy: number, dz: number, dlx = 0, dly = 0, dlz = 0, ez: Ease = "inout"): Shot => ({ from, ez, a: C(ax, ay, az, lx, ly, lz), b: C(ax + dx, ay + dy, az + dz, lx + dlx, ly + dly, lz + dlz) });
const SHOTS: Shot[] = [
  K(0, 0.32, 1.15, 5.4, 0.32, 1.2, 0, 0, 0, 0, 0, 0, 0),                                                                                       // LOCKED: the face-off (the hook, locked for the loop)
  K(3.3, 0.32, 1.15, 5.4, 0.32, 1.2, 0, 0.13, -0.05, -3.2, 0.08, -0.2, -0.9, "snap"),                                            // SWOOP: to the van pintu he must touch ("besi pintunya")
  K(5.08, 0.95, 1.2, 4.2, 0.95, 1.2, 0.45, 0, 0.05, -0.6, 0, 0.05, 0, "out"),          // PUSH-IN: Bang Toni, the parcel driver
  K(7.4, 1.2, 1.3, 3.3, 0.95, 1.25, 0.45, 0, 0, 0, 0, 0, 0),                         // LOCKED: he looks at his phone, twenty minutes left
  K(9.6, -4.5, 2.1, 30, -5, 1.4, -0.9, 0, 0, 0, 0, 0, 0),                               // LOCKED: the long queue behind him
  K(11.22, -0.3, 1.25, 3.6, -0.3, 1.25, 0.45, 0, 0, 0, 0, 0, 0),                  // LOCKED: Bu Yati's quoted order
  K(14.3, 1, 1.2, 3.9, 0.95, 1.2, 0.45, 0, 0.05, -0.7, 0, 0.05, 0, "inout"),          // PUSH-IN: his sneer and his answer
  K(17.5, -0.6, 0.45, 3.3, -0.3, 1.35, 0.45, 0, 0, 0, 0, 0, 0),                   // LOCKED: low angle, Bu Yati says nothing
  K(19.12, -7, 1.8, 24, -7, 1.2, -1.2, 0, 0, 0, 0, 0, 0),                                 // LOCKED: the horns of the queue
  K(20.46, 3.4, 1.4, 3.3, 0.85, 1.3, -1.4, 0, 0, 0, 0, 0, 0),                         // LOCKED: he slides on the cab seat
  K(22.9, 1, 1.2, 4.3, 0.85, 1, -1, 0, 0, -0.6, 0, 0, 0.4, "lin"),              // FOLLOW: he jumps down from the cab
  K(24.3, 0.85, 1.3, 3.4, 0.85, 1.2, -0.45, 0, 0.05, -0.7, 0, 0.05, 0, "in"),         // PUSH-IN: the crackling nylon jacket
  K(25.66, 0.4, 1.2, 4.7, 0.4, 1.1, 0.2, 0, 0, 0, 0, 0, 0),                            // LOCKED: "Salaman sama tiang dulu, Bu?"
  K(27.2, 0.3, 1.25, 4, 0.2, 1.2, 0.45, 0, -0.15, -2.4, 0.02, -0.18, 0.05, "snap"),            // SWOOP: to the nozzle collar
  K(28.3, 0.3, 1.1, 1.6, 0.22, 1.02, 0.5, 0, 0, 0, 0, 0, 0),                          // LOCKED: macro of the finger and the collar
  K(30.0, 0.7, 1.2, 3.2, 0.7, 1.2, 0.45, 0, 0, 0, 0, 0, 0),                            // LOCKED: he wrings his hand
  K(31.9, 0.3, 1, 5, 0.3, 1.2, 0.45, 0, 0, 0, 0, 0, 0),                            // LOCKED: he leaps back
  K(33.3, -0.3, 1.3, 3.7, -0.3, 1.3, 0.45, 0, 0, -0.7, 0, 0, 0, "out"),            // PUSH-IN: Bu Yati sighs
  K(35.58, 3.9, 1.5, 2.9, 0.85, 1.3, -1.4, 0, 0, 0, 0, 0, 0),                         // LOCKED: the seat slide again, the charge builds
  K(38.0, 0, 0.7, 3, 0.85, 1, -0.45, 0, 0.8, 0, 0, 0.3, 0, "inout"),          // CRANE UP: thousands of volts on his jacket
  K(39.6, -1, 1.5, 11, -1, 1.1, -0.9, 0, 0, 0, 0, 0, 0),                          // LOCKED: his palm on the pintu, far from the fuel flap
  K(42.1, 0.85, 1.2, 4.6, 0.85, 1.1, -0.6, 0, 0, -1.2, 0, 0, 0, "out"),           // PUSH-IN: the charge drains into the metal
  K(44.6, -0.5, 1.5, 10, -0.5, 1.2, 0, 0, 0, 0, 0, 0, 0),                                // LOCKED: calm forecourt, nothing happens
  K(47.12, 1, 1.3, 4.2, 0.85, 1.1, -0.9, 0, 0, 0, 0, 0, 0),                         // LOCKED: the next morning, he climbs down
  K(49.3, -5, 2, 31, -5, 1.3, -0.5, 0, 0, 0, 0, 0, 0),                                  // LOCKED: the whole queue pats its pintu (held to the loop cut)
];

// ---------- the cast: every person is their own design (B61, B62, B63, B70), none borrowed from an earlier video ------------------------------------------------------------------------------------------------
const YATI_O: Outfit = { shirt: "#d9352a", stripe: "#fbf7ee", garment: "uniform", hat: "cap", hatColor: "#d9352a", hair: "braid", hairColor: "#2b1a14", lashes: true, lips: true, brows: "thick", badge: true, nose: "dot", blush: true };
const TONI_O: Outfit = { shirt: "#17a2b8", stripe: "#c9d2d8", garment: "jacket", pattern: "plain", hat: "bucket", hatColor: "#7a8f3a", scarf: "#e8b923", nose: "dot", brows: "thick", glasses: true, mustache: true, hairColor: "#4a3020" };
const D1_O: Outfit = { shirt: "#8a5aa8", stripe: "#f2d16b", pattern: "dots", hat: "beret", hatColor: "#2d3a55", shades: true, goatee: true, hairColor: "#222222", body: "wide", nose: "dot" };
const D2_O: Outfit = { shirt: "#fbf7ee", stripe: "#1f6f4a", garment: "shirt", pattern: "collar", hat: "turban", hatColor: "#c0392b", mustache: true, brows: "arched", wrinkles: true, nose: "big" };
const D3_O: Outfit = { shirt: "#e0456b", stripe: "#ffd447", garment: "dress", hair: "ponytail", hairColor: "#3a2a24", lashes: true, lips: true, blush: true, freckles: true, brows: "arched", pocket: true };
const D4_O: Outfit = { shirt: "#f08c2a", stripe: "#233a6b", pattern: "stripe", hair: "topknot", hairColor: "#1c1c22", glasses: true, freckles: true, nose: "dot", brows: "thick", body: "wide" };

// the three quoted lines (B46 n): only these words move a mouth
const TALK: Record<string, [number, number][]> = { yati: [[12.3, 14.25]], toni: [[15.52, 17.25], [25.66, 27.0]] };
const talkAt = (id: string, t: number) => {
  if (!(TALK[id] ?? []).some(([a, b]) => t >= a && t < b)) return 0;
  const w = WORDS.find((x) => t >= x.a - 0.02 && t < x.b + 0.05);
  return w ? 0.4 + 0.6 * Math.abs(Math.sin(t * 17)) : 0;
};
const TAPS: Record<string, number[]> = { toni: [48.62, 48.82], d1: [49.45, 49.65], d2: [49.7, 49.9], d3: [49.95, 50.15], d4: [50.2, 50.4] };   // the pats on the metal in the last picture (each right after the one before)
const ty = (y: number) => (1 - y / 1.7) * 1024;   // canvas y of a hand at y metres (a standing figure)
const poseNamed = (name: string, t: number): Pose | null => {
  const pat = (id: string) => Math.max(0, ...TAPS[id].map((p) => bump(t - p)));
  switch (name) {
    case "hold": { const r = reach("r", 499, 520), l = reach("l", 150, 600); return A8(l.sh, l.el, r.sh, r.el); }
    case "holdpoint": { const r = reach("r", 499, 520), l = reach("l", 60 + 22 * Math.sin(t * 7), 380); return A8(l.sh, l.el, r.sh, r.el); }
    case "holdsigh": { const r = reach("r", 499, 520), l = reach("l", 150, 600); return A8(l.sh, l.el, r.sh, r.el, { lean: 3 * Math.sin(((t - 33.4) * Math.PI) / 1.8) }); }
    case "lift": { const k = prog(t, 50.5, 50.98), r = reach("r", 499 - 30 * k, 520 - 150 * k), l = reach("l", 150, 600); return A8(l.sh, l.el, r.sh, r.el); }
    case "cross": { const l = reach("l", 330, 575), r = reach("r", 190, 575); return A8(l.sh, l.el, r.sh, r.el); }
    case "phone": { const r = reach("r", 392, 400 + 6 * Math.sin(t * 5)), l = reach("l", 150, 600); return A8(l.sh, l.el, r.sh, r.el); }
    case "slide": { const l = reach("l", 290, 565), r = reach("r", 335, 565); return A8(l.sh, l.el, r.sh, r.el, { lean: 4 * Math.sin(t * 8) }); }
    case "grab": {   // the right hand (he is mirrored, so it reaches screen-left) goes slowly to the collar, then snaps back from the spark
      const k = prog(t, 27.2, 28.24) - prog(t, 28.3, 28.6), r = reach("r", lerp(470, 509, k), lerp(ty(0.85), ty(1.02), k)), l = reach("l", 150, 590);
      return A8(l.sh, l.el, r.sh, r.el, { lean: -6 * prog(t, 28.26, 28.4) * (1 - prog(t, 28.5, 30)) });
    }
    case "wring": { const r = reach("r", 440 + 20 * Math.sin(t * 22), ty(0.9)), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "pat": { const r = reach("r", 470, ty(1.0) - 26 * pat("toni")), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "palm": { const r = reach("r", 470, ty(1.0) + 6 * Math.sin(t * 4)), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "honk": { const r = reach("r", 392, 400 + 22 * Math.sin(t * 18)), l = reach("l", 190, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "patd1": { const r = reach("r", 470, ty(1.0) - 26 * pat("d1")), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "patd2": { const r = reach("r", 470, ty(1.0) - 26 * pat("d2")), l = reach("l", 150, 590); return A8(l.sh, l.el, r.sh, r.el); }
    case "patd3": { const l = reach("l", 95, ty(1.0) - 26 * pat("d3")), r = reach("r", 362, 600); return A8(l.sh, l.el, r.sh, r.el); }
    case "patd4": { const l = reach("l", 95, ty(0.9) - 26 * pat("d4")), r = reach("r", 362, 600); return A8(l.sh, l.el, r.sh, r.el); }
    case "bags": { const l = reach("l", 215, 600), r = reach("r", 300, 600); return A8(l.sh, l.el, r.sh, r.el, { lean: -2 }); }
    default: return null;
  }
};

const FOREVER = 1000;
const ACTORS: { id: string; o: Outfit; tracks: Track[] }[] = [
  { id: "yati", o: YATI_O, tracks: [
    { a: 0, b: 11.22, pos: stay(YATI.x, YATI.z), faces: [[0, "calm", "hold"]] },
    { a: 11.22, b: 14.4, pos: stay(YATI.x, YATI.z), faces: [[11.22, "calm", "holdpoint"]] },
    { a: 14.4, b: 33.3, pos: stay(YATI.x, YATI.z), faces: [[14.4, "calm", "hold"], [28.28, "calm", "hold"]] },
    { a: 33.3, b: 35.58, pos: stay(YATI.x, YATI.z), faces: [[33.3, "calm", "holdsigh"]] },
    { a: 35.58, b: 50.5, pos: stay(YATI.x, YATI.z), faces: [[35.58, "calm", "hold"], [44.6, "sly", "hold"]] },
    { a: 50.5, b: FOREVER, pos: stay(YATI.x, YATI.z), faces: [[50.5, "grin", "lift"]] },
  ] },
  { id: "toni", o: TONI_O, tracks: [
    { a: 0, b: 5.08, flip: true, pos: stay(SPOT.x, SPOT.z), faces: [[0, "sly", "cross"]] },
    { a: 5.08, b: 9.6, flip: true, pos: stay(SPOT.x, SPOT.z), faces: [[5.08, "calm", "phone"], [7.56, "shocked", "phone"]] },
    { a: 9.6, b: 14.3, flip: true, pos: stay(SPOT.x, SPOT.z), faces: [[9.6, "sly", "cross"], [13.2, "puzzled", "cross"]] },
    { a: 14.3, b: 19.2, flip: true, pos: stay(SPOT.x, SPOT.z), faces: [[14.3, "grin", "cross"], [15.4, "sly", "shrug"], [17.3, "sly", "cross"]], beats: [["hop", 16.9, 17.2, 0.04]] },
    withGait({ a: 19.2, b: 20.45, pos: go(19.2, 20.45, SPOT.x, SPOT.z, PINTU.x, PINTU.z), faces: [[19.2, "furious", "down"]] }, "walk", 0.2),
    { a: 20.45, b: 22.9, flip: true, pos: (t) => [PINTU.x + 0.14 * Math.sin(t * 5.2), -1.4], faces: [[20.45, "calm", "slide"], [21.8, "puzzled", "slide"]], sit: -0.13 },   // seated behind the pintu panel, sliding on the seat
    withGait({ a: 22.9, b: 24.3, pos: go(22.9, 24.3, PINTU.x, -1.4, PINTU.x, PINTU.z), faces: [[22.9, "furious", "down"]], beats: [["hop", 22.9, 23.25, 0.1]] }, "walk", 0.1),
    { a: 24.3, b: 25.66, flip: true, pos: stay(PINTU.x, PINTU.z), faces: [[24.3, "shocked", "down"], [24.9, "puzzled", "down"]] },
    withGait({ a: 25.66, b: 27.0, pos: go(25.66, 27.0, PINTU.x, PINTU.z, GRAB.x, GRAB.z), faces: [[25.66, "sly", "down"]] }, "walk", 0.1),
    { a: 27.0, b: 28.26, flip: true, pos: stay(GRAB.x, GRAB.z), faces: [[27.0, "sly", "grab"]] },
    { a: 28.26, b: 30.0, flip: true, pos: stay(GRAB.x, GRAB.z), faces: [[28.26, "shocked", "grab"]] },
    { a: 30.0, b: 31.9, flip: true, pos: stay(GRAB.x, GRAB.z), faces: [[30.0, "shocked", "wring"]] },
    { a: 31.9, b: 33.3, flip: true, pos: stay(GRAB.x, GRAB.z), faces: [[31.9, "shocked", "up"], [32.9, "puzzled", "down"]], beats: [["hop", 31.95, 32.5, 0.15]] },
    { a: 33.3, b: 35.58, flip: true, pos: stay(GRAB.x, GRAB.z), faces: [[33.3, "puzzled", "wring"], [34.4, "sly", "down"]] },
    { a: 35.58, b: 38.0, flip: true, pos: (t) => [PINTU.x + 0.14 * Math.sin(t * 5.2), -1.4], faces: [[35.58, "calm", "slide"]], sit: -0.13 },   // the replay: the slide that builds the charge
    { a: 38.0, b: 39.6, flip: true, pos: stay(PINTU.x, PINTU.z), faces: [[38.0, "shocked", "down"]] },
    { a: 39.6, b: 47.12, flip: true, pos: stay(PINTU.x, PINTU.z), faces: [[39.6, "calm", "palm"]] },
    { a: 47.12, b: 47.7, flip: true, pos: stay(PINTU.x, -1.4), faces: [[47.12, "calm", "slide"]], sit: -0.13 },   // the next morning
    withGait({ a: 47.7, b: 48.6, pos: go(47.7, 48.6, PINTU.x, -1.4, PINTU.x, PINTU.z), faces: [[47.7, "calm", "down"]], beats: [["hop", 47.7, 47.95, 0.07]] }, "walk", 0.1),
    { a: 48.6, b: FOREVER, flip: true, pos: stay(PINTU.x, PINTU.z), faces: [[48.6, "grin", "pat"]] },
  ] },
  { id: "d1", o: D1_O, tracks: [
    { a: 19.12, b: 20.5, flip: true, pos: stay(-5.7, -1.4), faces: [[19.12, "furious", "honk"]], sit: -0.28 },
    { a: 20.5, b: 48.8, flip: true, pos: stay(-5.7, -1.4), faces: [[20.5, "puzzled", "down"]], sit: -0.28 },
    withGait({ a: 48.8, b: 49.4, pos: go(48.8, 49.4, -5.7, -1.0, -5.7, -0.45), faces: [[48.8, "calm", "down"]] }, "walk", 0.05),
    { a: 49.4, b: FOREVER, flip: true, pos: stay(-5.7, -0.45), faces: [[49.4, "grin", "patd1"]] },
  ] },
  { id: "d2", o: D2_O, tracks: [
    { a: 19.3, b: 20.7, flip: true, pos: stay(-11.4, -1.4), faces: [[19.3, "furious", "honk"]], sit: -0.1 },
    { a: 20.7, b: 49.05, flip: true, pos: stay(-11.4, -1.4), faces: [[20.7, "puzzled", "down"]], sit: -0.1 },
    withGait({ a: 49.05, b: 49.65, pos: go(49.05, 49.65, -11.4, -1.0, -11.4, -0.45), faces: [[49.05, "calm", "down"]] }, "walk", 0.05),
    { a: 49.65, b: FOREVER, flip: true, pos: stay(-11.4, -0.45), faces: [[49.65, "grin", "patd2"]] },
  ] },
  { id: "d3", o: D3_O, tracks: [
    withGait({ a: 5.08, b: 12.5, pos: go(5.08, 12.5, 3.6, 1.9, -0.85, 1.4), faces: [[5.08, "calm", "bags"]] }, "walk", 0.1),
    { a: 12.5, b: 49.6, flip: true, pos: stay(-0.85, 1.4), faces: [[12.5, "puzzled", "bags"], [18.0, "shocked", "bags"], [28.4, "shocked", "bags"], [31.0, "puzzled", "bags"]] },
    { a: 49.6, b: FOREVER, pos: stay(-0.85, 1.4), faces: [[49.6, "grin", "patd3"]] },
  ] },
  { id: "d4", o: D4_O, tracks: [
    { a: 9.6, b: 49.9, pos: stay(-7.3, 1.9), faces: [[9.6, "calm", "down"], [19.12, "furious", "up"], [20.6, "puzzled", "hips"], [28.3, "shocked", "up"], [31.0, "calm", "hips"]], beats: [["hop", 19.3, 19.6, 0.06]] },
    { a: 49.9, b: FOREVER, pos: stay(-7.3, 1.9), faces: [[49.9, "grin", "patd4"]] },
  ] },
];
type AState = { rig: Pose; x: number; z: number; flip: boolean; expr: Expr; hop: number; h: number; talk: number };
const stateOf = (a: { id: string; tracks: Track[] }, t: number): AState | null => {
  const tr = a.tracks.find((k) => t >= k.a && t < k.b);
  if (!tr) return null;
  const [bx, z] = tr.pos(t), ch = tr.ch ? choreoAt(tr.ch, t, tr.h ?? 1.7) : null, x = ch ? (tr.dir ?? 1) * ch.x : bx;
  const [, expr, armName] = stepAt(tr.faces, t);
  const rig = ch ? ch.pose : poseNamed(armName, t) ?? poseAt(tr.faces.map(([ta, , ar]) => [ta, ar] as [number, string]), t, 0.28);   // still means still (B58)
  return { rig, x, z, flip: tr.flip ?? false, expr, h: tr.h ?? 1.7, talk: talkAt(a.id, t), hop: beatsAt(tr.beats ?? [], t) + (ch ? ch.hop : 0) + (tr.sit ?? 0) };
};
const actor = (id: string) => ACTORS.find((q) => q.id === id)!;
const handAt = (id: string, side: "l" | "r", t: number) => {
  const s = stateOf(actor(id), t);
  if (!s) return null;
  const hd = handOffset(s.rig, side, s.h), sg = s.flip ? -1 : 1;
  return { x: s.x + sg * hd.x, y: hd.y + s.hop * s.h, z: s.z + 0.09 };
};

// ---------- the moments of the story ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const SPARK_AT = 28.26;                                    // "Ctak!": the spark between his finger and the collar, the turn
const CRACKLE: [number, number][] = [[24.3, 25.66], [35.8, 39.6]];   // the jacket crackles while the charge builds
const DRAIN = [39.6, 44.6];                                // the palm on the pintu: the charge runs out of him into the metal
const HORNS = [19.12, 19.5, 19.9, 20.3];
const PILLS: Pill[] = [
  { at: 7.5, until: 9.5, text: "20 menit", key: "20", color: "#e63b2e", y: 1180 },
  { at: 38.3, until: 40.3, text: "ribuan volt", key: "ribuan", color: "#2f6fff", y: 1180 },
];
const BURSTS: Burst[] = [{ at: 19.12, colors: ["#ffd447", "#ff8a3a", "#fffaf0", "#e63b2e"] }, { at: 35.58, colors: ["#9fd0ff", "#ffffff", "#5a9bff", "#e8f4ff"] }, { at: 47.12, colors: ["#ffe9a8", "#ffffff", "#ffc86b", "#fffaf0"] }];
const WHIPS: Whip[] = [[31.9, -1]];   // the head turns away from the jolt
const HOOK_LINES: { text: string; key?: string }[] = [{ text: "Sentuh ", key: "besi" }, { text: "dulu" }];
const FIX: Record<string, string> = { "supir": "sopir", "Cetak!": "Ctak!", "Kelakson": "Klakson", "Besoknya,": "Besoknya" };
const READ = [...readWords(WORDS.map((x) => ({ ...x, w: FIX[x.w] ?? x.w }))), { w: "Bu", a: 51.34, b: 51.68 }];   // the first word comes back on the last 0.34 s so the last frame equals the first

// ---------- textures -----------------------------------------------------------------------------------------------------------------------------------
type TexSet = Record<"asphalt" | "conc" | "red" | "white" | "tyre" | "plaster" | "metal" | "paket" | "sign" | "disp" | "leaf" | "sky" | "soft" | "roof" | "seat" | "stripe", THREE.Texture>;
const useTex = (): TexSet => useMemo(() => ({
  asphalt: painted(256, 256, (c) => { c.fillStyle = "#4a4e57"; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 1600, ["rgba(255,255,255,.10)", "rgba(0,0,0,.14)", "rgba(210,190,150,.08)"], 3, 2); c.fillStyle = "rgba(20,20,26,.18)"; for (let i = 0; i < 5; i++) c.fillRect(rnd(i) * 200, rnd(i + 8) * 200, 40 + rnd(i + 3) * 60, 3); }, 30, 30),
  conc: painted(256, 256, (c) => { c.fillStyle = "#bdb9b0"; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 900, ["rgba(255,255,255,.14)", "rgba(80,70,60,.12)"], 3, 5); c.strokeStyle = "rgba(60,55,50,.5)"; c.lineWidth = 3; c.strokeRect(0, 0, 256, 256); }),
  red: painted(256, 256, (c) => { c.fillStyle = "#d3382c"; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 500, ["rgba(255,255,255,.12)", "rgba(60,0,0,.12)"], 2, 9); const g = c.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(0,0,0,.18)"); c.fillStyle = g; c.fillRect(0, 0, 256, 256); }),
  white: painted(256, 256, (c) => { c.fillStyle = "#f3f1ea"; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 500, ["rgba(0,0,0,.06)", "rgba(255,255,255,.4)"], 2, 12); const g = c.createLinearGradient(0, 200, 0, 256); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(90,80,60,.22)"); c.fillStyle = g; c.fillRect(0, 200, 256, 56); }),
  tyre: painted(128, 128, (c) => { c.fillStyle = "#1d1d21"; c.fillRect(0, 0, 128, 128); c.fillStyle = "#2b2b31"; for (let x = 0; x < 128; x += 16) c.fillRect(x, 0, 7, 128); }),
  plaster: painted(256, 256, (c) => { c.fillStyle = "#ece3cc"; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 900, ["rgba(255,255,255,.12)", "rgba(90,70,40,.10)"], 5, 4); const g = c.createLinearGradient(0, 170, 0, 256); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(80,60,35,.25)"); c.fillStyle = g; c.fillRect(0, 170, 256, 86); }),
  metal: painted(256, 256, (c) => { const g = c.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, "#aab6be"); g.addColorStop(0.3, "#eef3f6"); g.addColorStop(0.55, "#8d9aa3"); g.addColorStop(0.8, "#e4ebef"); g.addColorStop(1, "#aab6be"); c.fillStyle = g; c.fillRect(0, 0, 256, 256); speck(c, 256, 256, 300, ["rgba(255,255,255,.14)", "rgba(0,0,0,.08)"], 2, 6); }),
  paket: painted(512, 256, (c) => { c.fillStyle = "#f6f3ea"; c.fillRect(0, 0, 512, 256); c.fillStyle = "#f2a516"; c.fillRect(0, 0, 512, 60); c.fillStyle = "#17141c"; c.font = "bold 88px Arial"; c.fillText("PAKET", 30, 168); c.font = "bold 40px Arial"; c.fillText("ANTAR CEPAT", 30, 226); c.fillStyle = "#c68a4e"; c.fillRect(372, 90, 110, 100); c.strokeStyle = "#17141c"; c.lineWidth = 6; c.strokeRect(372, 90, 110, 100); c.beginPath(); c.moveTo(427, 90); c.lineTo(427, 190); c.stroke(); }),
  sign: painted(512, 160, (c) => { c.fillStyle = "#1f56b8"; c.fillRect(0, 0, 512, 160); c.fillStyle = "#d3382c"; c.fillRect(0, 118, 512, 42); c.fillStyle = "#fff"; c.font = "bold 104px Arial"; c.fillText("SPBU", 28, 108); c.font = "bold 54px Arial"; c.fillText("BBM", 336, 100); }),
  disp: painted(128, 64, (c) => { c.fillStyle = "#0e1f12"; c.fillRect(0, 0, 128, 64); c.fillStyle = "#6bff8a"; c.font = "bold 42px monospace"; c.fillText("0.00", 14, 46); }),
  leaf: painted(64, 256, (c) => { const g = c.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, "#2f7d2b"); g.addColorStop(0.5, "#4fae3a"); g.addColorStop(1, "#2a6e27"); c.fillStyle = g; c.beginPath(); c.moveTo(32, 0); c.quadraticCurveTo(70, 120, 32, 256); c.quadraticCurveTo(-6, 120, 32, 0); c.fill(); c.strokeStyle = "rgba(20,70,20,.6)"; c.lineWidth = 3; c.beginPath(); c.moveTo(32, 4); c.lineTo(32, 250); c.stroke(); for (let y = 20; y < 240; y += 16) { c.beginPath(); c.moveTo(32, y); c.lineTo(8, y + 14); c.moveTo(32, y); c.lineTo(56, y + 14); c.stroke(); } }),
  sky: painted(16, 256, (c) => { const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#5aa7e6"); g.addColorStop(0.55, "#a9d6f3"); g.addColorStop(1, "#f3ead0"); c.fillStyle = g; c.fillRect(0, 0, 16, 256); }),
  soft: painted(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }),
  roof: painted(256, 256, (c) => { c.fillStyle = "#e9edf0"; c.fillRect(0, 0, 256, 256); c.strokeStyle = "rgba(90,100,110,.35)"; c.lineWidth = 2; for (let x = 0; x < 256; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); } speck(c, 256, 256, 500, ["rgba(0,0,0,.05)"], 3, 3); }),
  seat: painted(128, 128, (c) => { c.fillStyle = "#7a2630"; c.fillRect(0, 0, 128, 128); c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 3; for (let i = 0; i < 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke(); } }),
  stripe: painted(64, 64, (c) => { c.fillStyle = "#f2c230"; c.fillRect(0, 0, 64, 64); c.fillStyle = "#17141c"; for (let i = -64; i < 128; i += 32) { c.beginPath(); c.moveTo(i, 64); c.lineTo(i + 16, 64); c.lineTo(i + 48, 0); c.lineTo(i + 32, 0); c.fill(); } }),
}), []);

// ---------- the vehicles ------------------------------------------------------------------------------------------------------------------------------
const Wheel: React.FC<{ x: number; z: number; r?: number; tex: TexSet }> = ({ x, z, r = 0.38, tex }) => (
  <group position={[x, r, z]}>
    <Cyl r={r} h={0.26} pos={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} map={tex.tyre} rough={0.95} seg={28} />
    <Cyl r={r * 0.55} h={0.28} pos={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} map={tex.metal} metal={0.7} rough={0.35} seg={20} />
    <Cyl r={r * 0.14} h={0.3} pos={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} color="#3d4349" seg={10} />
  </group>
);
/** the parcel van, seen from its +z side: a box with a PAKET sticker, a cab with an open side window (the driver shows above the pintu panel), a pintu handle of steel and a fuel flap at the rear */
const Van: React.FC<{ tex: TexSet; t: number }> = ({ tex, t }) => (
  <group position={[VAN_X, 0, VAN_Z]}>
    <RBox size={[5.0, 0.7, 1.9]} pos={[0, 0.7, 0]} map={tex.white} tile={1.2} />
    <RBox size={[3.5, 1.55, 1.9]} pos={[-0.75, 1.82, 0]} map={tex.white} tile={1.6} r={0.06} />
    <RBox size={[3.0, 0.9, 0.02]} pos={[-0.75, 1.82, 0.955]} map={tex.paket} fit r={0.005} />
    <RBox size={[3.5, 0.08, 1.92]} pos={[-0.75, 1.18, 0]} color="#2a6fdb" r={0.01} />
    <RBox size={[1.4, 0.62, 1.9]} pos={[1.8, 1.06, 0]} map={tex.white} tile={1.3} r={0.05} />
    <RBox size={[1.4, 0.1, 1.9]} pos={[1.8, 2.05, 0]} map={tex.white} tile={1.3} />
    <RBox size={[0.12, 0.74, 1.9]} pos={[1.15, 1.67, 0]} map={tex.white} tile={1.3} />
    <RBox size={[0.06, 0.74, 1.7]} pos={[2.45, 1.67, 0]} color="#8fb4cf" opacity={0.35} r={0.01} />
    <RBox size={[1.2, 0.74, 0.03]} pos={[1.8, 1.67, 0.9]} color="#a9d0ea" opacity={0.18} r={0.01} />
    <RBox size={[0.5, 0.3, 0.62]} pos={[1.6, 0.9, 0.2]} map={tex.seat} tile={0.6} r={0.06} />
    <RBox size={[0.16, 0.55, 0.6]} pos={[1.32, 1.18, 0.2]} map={tex.seat} tile={0.6} r={0.05} />
    <RBox size={[0.4, 0.28, 1.5]} pos={[2.3, 1.05, 0]} color="#2c2f36" r={0.05} />
    <Cyl r={0.16} h={0.03} pos={[2.12, 1.22, 0.3]} rot={[0, 0, 1.0]} color="#17141c" seg={20} />
    <RBox size={[0.012, 0.62, 0.012]} pos={[1.2, 1.06, 0.955]} color="#30343b" r={0.003} />
    <RBox size={[0.012, 0.62, 0.012]} pos={[2.38, 1.06, 0.955]} color="#30343b" r={0.003} />
    <RBox size={[0.2, 0.045, 0.04]} pos={[1.55, 1.2, 0.97]} map={tex.metal} metal={0.9} rough={0.25} r={0.015} />
    <RBox size={[0.12, 0.25, 1.9]} pos={[2.56, 0.5, 0]} color="#2c2f36" />
    <Ball r={0.11} pos={[2.55, 0.85, 0.65]} color="#fff6d0" sc={[0.5, 1, 1]} emissive="#fff0a0" />
    <Ball r={0.11} pos={[2.55, 0.85, -0.65]} color="#fff6d0" sc={[0.5, 1, 1]} emissive="#fff0a0" />
    <RBox size={[0.36, 0.34, 0.03]} pos={[-2.0, 1.0, 0.955]} map={tex.metal} metal={0.8} rough={0.3} r={0.01} />
    <Cyl r={0.07} h={0.04} pos={[-2.0, 1.0, 0.98]} rot={[Math.PI / 2, 0, 0]} color="#17141c" seg={14} />
    <Wheel x={-1.7} z={0.92} tex={tex} /><Wheel x={1.9} z={0.92} tex={tex} /><Wheel x={-1.7} z={-0.92} tex={tex} /><Wheel x={1.9} z={-0.92} tex={tex} />
    {/* the exhaust of the idling van and the vapour at the open fuel flap (B27.16: gasoline vapour is heavier than air, it sinks and creeps along the ground) */}
    {[0, 1, 2].map((i) => <Puff key={i} x={-2.55} y={0.45} z={0.2} t={t} at={streamAt(t, i, 3, 2.4)} dur={2.4} size={0.35} tex={tex.soft} color="#cfcfd2" rise={0.5} op={0.35} />)}
    {[0, 1, 2, 3].map((i) => <Puff key={`v${i}`} x={-2.0 - i * 0.1} y={0.9} z={1.05 + i * 0.05} t={t} at={streamAt(t, i, 4, 3.0)} dur={3.0} size={0.4} tex={tex.soft} color="#e6f1c8" rise={-0.55} op={t > 40 && t < 44.6 ? 0.7 : 0.3} />)}
  </group>
);
const Sedan: React.FC<{ tex: TexSet; x: number; color: string; t: number }> = ({ tex, x, color, t }) => (
  <group position={[x, 0, VAN_Z]}>
    <RBox size={[4.4, 0.62, 1.8]} pos={[0, 0.66, 0]} color={color} rough={0.35} metal={0.25} r={0.08} />
    <RBox size={[2.3, 0.62, 1.64]} pos={[-0.15, 1.28, 0]} color={color} rough={0.35} metal={0.25} r={0.1} />
    <RBox size={[2.1, 0.46, 0.03]} pos={[-0.15, 1.32, 0.83]} color="#a9d0ea" opacity={0.2} r={0.01} />
    <RBox size={[0.012, 0.5, 0.012]} pos={[0.55, 0.78, 0.91]} color="#30343b" r={0.003} />
    <RBox size={[0.012, 0.5, 0.012]} pos={[-0.7, 0.78, 0.91]} color="#30343b" r={0.003} />
    <RBox size={[0.18, 0.04, 0.04]} pos={[0.3, 0.9, 0.93]} map={tex.metal} metal={0.9} rough={0.25} r={0.015} />
    <RBox size={[0.1, 0.2, 1.8]} pos={[2.2, 0.5, 0]} color="#2c2f36" />
    <Ball r={0.1} pos={[2.18, 0.82, 0.62]} color="#fff6d0" sc={[0.5, 1, 1]} emissive="#fff0a0" />
    <Ball r={0.1} pos={[2.18, 0.82, -0.62]} color="#fff6d0" sc={[0.5, 1, 1]} emissive="#fff0a0" />
    <Wheel x={-1.4} z={0.88} r={0.34} tex={tex} /><Wheel x={1.4} z={0.88} r={0.34} tex={tex} /><Wheel x={-1.4} z={-0.88} r={0.34} tex={tex} /><Wheel x={1.4} z={-0.88} r={0.34} tex={tex} />
    {[0, 1].map((i) => <Puff key={i} x={-2.25} y={0.4} z={0.2} t={t} at={streamAt(t, i, 2, 2.2)} dur={2.2} size={0.3} tex={tex.soft} color="#cfcfd2" rise={0.45} op={0.3} />)}
  </group>
);
/** a minibus: tall, blue, a window strip along the side */
const Minibus: React.FC<{ tex: TexSet; x: number }> = ({ tex, x }) => (
  <group position={[x, 0, VAN_Z]}>
    <RBox size={[4.6, 1.95, 1.85]} pos={[0, 1.35, 0]} color="#2c6fcf" rough={0.4} metal={0.15} r={0.1} />
    <RBox size={[4.2, 0.62, 0.03]} pos={[-0.1, 1.95, 0.93]} color="#b9dcf0" opacity={0.25} r={0.01} />
    <RBox size={[4.6, 0.1, 1.87]} pos={[0, 1.12, 0]} color="#f2c230" r={0.02} />
    <RBox size={[0.012, 1.3, 0.012]} pos={[-0.6, 1.55, 0.93]} color="#30343b" r={0.003} />
    <RBox size={[0.012, 1.3, 0.012]} pos={[0.8, 1.55, 0.93]} color="#30343b" r={0.003} />
    <RBox size={[0.18, 0.04, 0.04]} pos={[0.7, 1.4, 0.95]} map={tex.metal} metal={0.9} rough={0.25} r={0.015} />
    <RBox size={[0.12, 0.25, 1.85]} pos={[2.3, 0.5, 0]} color="#2c2f36" />
    <Wheel x={-1.5} z={0.9} tex={tex} /><Wheel x={1.5} z={0.9} tex={tex} /><Wheel x={-1.5} z={-0.9} tex={tex} /><Wheel x={1.5} z={-0.9} tex={tex} />
  </group>
);
const Motorbike: React.FC<{ tex: TexSet; x: number; z: number }> = ({ tex, x, z }) => (
  <group position={[x, 0, z]}>
    <Wheel x={-0.62} z={0} r={0.3} tex={tex} /><Wheel x={0.62} z={0} r={0.3} tex={tex} />
    <RBox size={[0.9, 0.22, 0.2]} pos={[0, 0.46, 0]} color="#2c2f36" r={0.05} />
    <RBox size={[0.42, 0.24, 0.3]} pos={[0.05, 0.72, 0]} color="#d3382c" rough={0.3} metal={0.3} r={0.07} />
    <RBox size={[0.5, 0.1, 0.26]} pos={[-0.38, 0.72, 0]} color="#1d1d21" r={0.04} />
    <RBox size={[0.04, 0.5, 0.04]} pos={[0.62, 0.55, 0]} map={tex.metal} metal={0.8} r={0.01} />
    <RBox size={[0.05, 0.05, 0.7]} pos={[0.62, 0.84, 0]} color="#17141c" r={0.02} />
  </group>
);

// ---------- the station ---------------------------------------------------------------------------------------------------------------------------------
const Pump: React.FC<{ tex: TexSet; x: number }> = ({ tex, x }) => (
  <group position={[x, 0.18, 0.5]}>
    <RBox size={[0.58, 1.5, 0.44]} pos={[0, 0.75, 0]} map={tex.red} tile={1.5} r={0.05} />
    <RBox size={[0.46, 0.5, 0.02]} pos={[0, 1.0, 0.225]} map={tex.white} tile={1} r={0.01} />
    <RBox size={[0.3, 0.14, 0.02]} pos={[0, 1.22, 0.24]} map={tex.disp} fit emissive="#6bff8a" ei={0.6} r={0.005} />
    <RBox size={[0.7, 0.14, 0.52]} pos={[0, 1.55, 0]} color="#2a6fdb" r={0.04} />
    <RBox size={[0.14, 0.26, 0.1]} pos={[0.34, 1.0, 0.1]} color="#2c2f36" r={0.03} />
    <RBox size={[0.34, 0.1, 0.02]} pos={[0, 0.5, 0.225]} color="#17141c" r={0.01} />
  </group>
);
const Nozzle: React.FC<{ tex: TexSet; hand: { x: number; y: number; z: number } | null }> = ({ tex, hand }) => {
  if (!hand) return null;
  return (
    <group position={[hand.x, hand.y, hand.z + 0.04]}>
      <RBox size={[0.07, 0.2, 0.05]} pos={[0.0, -0.02, 0]} color="#17141c" r={0.02} />
      <RBox size={[0.16, 0.06, 0.05]} pos={[0.07, 0.07, 0]} color="#2c2f36" r={0.02} />
      <Cyl r={0.026} h={0.14} pos={[0.19, 0.07, 0]} rot={[0, 0, Math.PI / 2]} map={tex.metal} metal={0.9} rough={0.25} seg={14} />
      <Cyl r={0.034} h={0.05} pos={[0.12, 0.07, 0]} rot={[0, 0, Math.PI / 2]} map={tex.metal} metal={0.9} rough={0.2} seg={14} />
      <Cyl r={0.017} h={0.2} pos={[0.33, 0.07, 0]} rot={[0, 0, Math.PI / 2]} map={tex.metal} metal={0.9} rough={0.25} seg={12} />
    </group>
  );
};
/** the hose: a sagging tube from the pump to the attendant's hand, rebuilt every frame (it follows the hand) */
const Hose: React.FC<{ from: THREE.Vector3; to: THREE.Vector3 }> = ({ from, to }) => {
  const geo = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5); mid.y = Math.min(from.y, to.y) - 0.35; mid.z += 0.1;
    const q1 = from.clone().lerp(mid, 0.5); q1.y += 0.05;
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([from, q1, mid, to.clone().lerp(mid, 0.5), to]), 26, 0.026, 8, false);
  }, [from.x, from.y, from.z, to.x, to.y, to.z]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo}><meshStandardMaterial color="#1b1b20" roughness={0.6} /></mesh>;
};
const Palm: React.FC<{ x: number; z: number; h: number; tex: TexSet; f: number }> = ({ x, z, h, tex, f }) => (
  <group position={[x, 0, z]}>
    <Cyl r={0.12} r2={0.19} h={h} pos={[0, h / 2, 0]} color="#8a6a45" seg={10} rough={0.95} />
    {Array.from({ length: 9 }, (_, i) => (
      <group key={i} position={[0, h, 0]} rotation={[0, (i / 9) * Math.PI * 2, 0]}>
        <mesh position={[0.9, -0.15, 0]} rotation={[0, Math.PI / 2, -1.05 + 0.04 * Math.sin(f * 0.07 + i)]}><planeGeometry args={[0.5, 2.0]} /><meshStandardMaterial map={tex.leaf} transparent alphaTest={0.4} side={THREE.DoubleSide} /></mesh>
      </group>
    ))}
  </group>
);
const World: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const tex = useTex();
  const yh = handAt("yati", "r", t);
  const hoseFrom = useMemo(() => V(-1.6 + 0.34, 1.18, 0.62), []);
  const hoseTo = yh ? V(yh.x - 0.02, yh.y - 0.02, yh.z + 0.02) : V(-0.2, 1.0, 0.5);
  const sparkU = (t - SPARK_AT) / 0.3, spark = sparkU >= 0 && sparkU <= 1;
  const crackle = CRACKLE.some(([a, b]) => t >= a && t < b);
  const tonia = stateOf(actor("toni"), t);
  const charge = t >= 35.58 && t < 39.6 ? Math.min(1, (t - 35.58) / 3) : 0;
  const drain = t >= DRAIN[0] && t < DRAIN[1] ? (t - DRAIN[0]) / (DRAIN[1] - DRAIN[0]) : 0;
  return (
    <group>
      <hemisphereLight args={["#dcebff", "#d9c9a0", 1.0]} />
      {/* ground: asphalt, a concrete island with a yellow-black curb, white lane dashes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3, 0, -6]}><planeGeometry args={[160, 120]} /><meshStandardMaterial map={tex.asphalt} roughness={0.95} /></mesh>
      <RBox size={[2.5, 0.18, 1.1]} pos={[-2.05, 0.09, 0.5]} map={tex.conc} tile={1.2} r={0.04} />
      <RBox size={[2.52, 0.04, 0.05]} pos={[-2.05, 0.19, 1.04]} map={tex.stripe} tile={0.5} r={0.01} />
      {Array.from({ length: 14 }, (_, i) => <RBox key={i} size={[1.4, 0.012, 0.14]} pos={[-17 + i * 3.2, 0.01, 3.4]} color="#f4f1e6" r={0.004} />)}
      {/* the canopy: a white roof on columns, with a red and blue edge band and lamps underneath */}
      <RBox size={[20, 0.4, 9]} pos={[-5, 5.2, -0.5]} map={tex.roof} tile={2} r={0.05} />
      <RBox size={[20.1, 0.34, 0.12]} pos={[-5, 5.05, 4.0]} color="#d3382c" r={0.02} />
      <RBox size={[20.1, 0.12, 0.12]} pos={[-5, 4.82, 4.02]} color="#2a6fdb" r={0.02} />
      {[-12, -4.5, 2.4].map((x) => <RBox key={x} size={[0.5, 5.1, 0.5]} pos={[x, 2.55, 3.2]} map={tex.white} tile={1.5} r={0.06} />)}
      {[-10, -5, 0].map((x) => <RBox key={`l${x}`} size={[1.4, 0.06, 0.5]} pos={[x, 4.96, 1.0]} color="#fffbe6" emissive="#fff3c0" ei={1.2} r={0.02} />)}
      {/* the pumps, Bu Yati's nozzle and its hose */}
      <Pump tex={tex} x={-2.7} /><Pump tex={tex} x={-1.6} />
      <Nozzle tex={tex} hand={yh} />
      <Hose from={hoseFrom} to={hoseTo} />
      {/* the vehicles: the van (hero), the queue behind it, a motorbike in front of the queue */}
      <Van tex={tex} t={t} />
      <Sedan tex={tex} x={SEDAN_X} color="#c9402f" t={t} />
      <Minibus tex={tex} x={ANGKOT_X} />
      <Motorbike tex={tex} x={-8.0} z={1.9} />
      {/* the shop behind, with its sign, glass front and awning; the price pole; the sand buckets; the bollards; the cone */}
      <RBox size={[16, 4.2, 5]} pos={[-5, 2.1, -11]} map={tex.plaster} tile={2.5} r={0.05} />
      <RBox size={[14, 1.6, 0.06]} pos={[-5, 1.5, -8.45]} color="#9fd0e6" opacity={0.45} r={0.01} />
      <RBox size={[16.4, 0.12, 2.2]} pos={[-5, 3.1, -9.2]} color="#d3382c" r={0.03} />
      <RBox size={[6, 1.5, 0.2]} pos={[-5, 4.9, -8.6]} map={tex.sign} fit r={0.03} />
      <RBox size={[0.3, 8, 0.3]} pos={[6.5, 4, -4.5]} map={tex.metal} metal={0.6} rough={0.4} r={0.04} />
      <RBox size={[2.0, 2.6, 0.22]} pos={[6.5, 7.1, -4.5]} map={tex.sign} fit r={0.04} />
      {[0, 1, 2].map((i) => (<group key={i} position={[-3.9 + i * 0.5, 0, 2.0]}><Cyl r={0.2} r2={0.17} h={0.42} pos={[0, 0.21, 0]} color="#d3382c" seg={16} rough={0.5} /><Cyl r={0.13} h={0.03} pos={[0, 0.43, 0]} color="#c9a766" seg={14} /></group>))}
      <RBox size={[0.9, 0.08, 0.4]} pos={[-3.4, 0.46, 2.0]} color="#8a5a2e" r={0.02} />
      {[-3.4, 2.5].map((x) => <Cyl key={x} r={0.12} h={0.95} pos={[x, 0.48, 1.45]} map={tex.stripe} seg={14} />)}
      <Cyl r={0.02} r2={0.17} h={0.6} pos={[1.9, 0.3, 2.3]} color="#ff7a1a" seg={14} />
      {/* a palm at each side, a flag that flaps on the price pole, the sky dome, far hills, clouds, birds */}
      <Palm x={8.5} z={-7} h={5.5} tex={tex} f={f} /><Palm x={-20} z={-9} h={6.5} tex={tex} f={f} /><Palm x={4.5} z={-10} h={4.6} tex={tex} f={f} />
      <mesh position={[5.5 + 0.28 * Math.sin(f * 0.25), 6.4, -4.5]} rotation={[0, 0, 0.1 * Math.sin(f * 0.25)]}><planeGeometry args={[1.0, 0.6]} /><meshBasicMaterial color="#d3382c" side={THREE.DoubleSide} /></mesh>
      <mesh position={[-5, 0, -4]}><sphereGeometry args={[110, 24, 14]} /><meshBasicMaterial map={tex.sky} side={THREE.BackSide} fog={false} /></mesh>
      <mesh position={[-20, 4, -50]} scale={[1, 0.22, 1]}><sphereGeometry args={[40, 20, 12]} /><meshBasicMaterial color="#a9c6a2" fog={false} /></mesh>
      <mesh position={[30, 3, -55]} scale={[1, 0.2, 1]}><sphereGeometry args={[34, 20, 12]} /><meshBasicMaterial color="#b6cfb4" fog={false} /></mesh>
      {[[-30, 30, -60], [10, 36, -70], [40, 28, -64]].map(([x, y, z], i) => <sprite key={i} position={[x + (t * 0.3) % 6, y, z]} scale={[26, 9, 1]}><spriteMaterial map={tex.soft} color="#ffffff" transparent opacity={0.85} depthWrite={false} fog={false} /></sprite>)}
      <group position={[-8 + (t % 22) * 1.3, 8.2 + Math.sin(t) * 0.3, -9]}>
        <mesh rotation={[0, 0, 0.5 * Math.sin(f * 0.9)]} position={[-0.13, 0, 0]}><planeGeometry args={[0.3, 0.08]} /><meshBasicMaterial color="#17141c" side={THREE.DoubleSide} /></mesh>
        <mesh rotation={[0, 0, -0.5 * Math.sin(f * 0.9)]} position={[0.13, 0, 0]}><planeGeometry args={[0.3, 0.08]} /><meshBasicMaterial color="#17141c" side={THREE.DoubleSide} /></mesh>
      </group>
      {/* the electricity: blue arcs round the jacket while the charge builds, the spark at the collar, charge dots that flow out of the palm into the pintu */}
      {crackle && tonia && Array.from({ length: 7 }, (_, i) => {
        const r = rnd(Math.floor(f / 2) * 7 + i), a = rnd(Math.floor(f / 2) * 11 + i + 3) * Math.PI * 2, tx = tonia.x + Math.cos(a) * (0.25 + 0.2 * r), tyy = 0.95 + Math.sin(a) * 0.35 + 0.1 * r;
        return <mesh key={i} position={[tx, tyy, tonia.z + 0.15]} rotation={[0, 0, a + 1.2]}><boxGeometry args={[0.012, 0.1 + 0.1 * r, 0.012]} /><meshBasicMaterial color="#9fd0ff" toneMapped={false} /></mesh>;
      })}
      {charge > 0 && tonia && Array.from({ length: Math.round(18 * charge) }, (_, i) => {
        const a = rnd(i + 40) * Math.PI * 2, rr = 0.22 + 0.2 * rnd(i + 70);
        return <Ball key={i} r={0.022} pos={[tonia.x + Math.cos(a) * rr, 0.75 + 0.55 * rnd(i + 9) + 0.03 * Math.sin(f * 0.3 + i), tonia.z + 0.2]} color="#5a9bff" emissive="#5a9bff" />;
      })}
      {drain > 0 && Array.from({ length: 12 }, (_, i) => {
        const u = ((drain * 3.4 + i / 12) % 1), px = lerp(PINTU.x + 0.2, 1.3, u), py = lerp(1.15 - 0.25 * (i % 3) * 0.3, 1.0, u);
        return <Ball key={i} r={0.026 * (1 - u * 0.8)} pos={[px, py, -0.82]} color="#5a9bff" emissive="#5a9bff" />;
      })}
      {spark && (
        <group position={COLLAR.toArray()}>
          <pointLight color="#9fd0ff" intensity={14 * (1 - sparkU)} distance={4} />
          <sprite scale={[0.5 * (1.4 - sparkU), 0.5 * (1.4 - sparkU), 1]}><spriteMaterial map={tex.soft} color="#bfe0ff" transparent opacity={1 - sparkU} depthWrite={false} toneMapped={false} /></sprite>
          {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[Math.cos(i * 0.7) * 0.07, Math.sin(i * 0.7) * 0.07, 0]} rotation={[0, 0, i * 0.7]}><boxGeometry args={[0.16 * (1 - sparkU * 0.4), 0.012, 0.012]} /><meshBasicMaterial color="#e8f4ff" toneMapped={false} /></mesh>)}
        </group>
      )}
    </group>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = () => {
  const fr = useCurrentFrame();
  const t0 = fr / FPS;
  const t = t0 >= LOOP_AT ? 0.04 : t0;   // from the cut the picture holds the first moment (the hook, full text), so the last frame equals the first and the loop is exact
  const f = Math.round(t * FPS);
  const cam = camAt(SHOTS, t, TOTAL);
  const hookA = t0 >= LOOP_AT ? 1 : t0 < 3.1 ? 1 : t0 < 3.5 ? 1 - (t0 - 3.1) / 0.4 : 0;
  const flash = Math.max(0, 1 - Math.abs(t0 - SPARK_AT - 0.04) / 0.16) * (t0 < LOOP_AT ? 1 : 0);   // the signature moment: one blue-white flash on the spark
  const actors = ACTORS.map((a) => {
    const s = stateOf(a, t);
    if (!s) return null;
    return <StickHero key={a.id} pos={V(s.x, 0, s.z)} expr={s.expr} arms="down" f={f} outfit={a.o} height={s.h} hop={s.hop} flip={s.flip} rig={s.rig} talk={s.talk} breath={0} />;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#a9d6f3" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: FRAME.width, height: FRAME.height, ...whipStyle(WHIPS, t0) }}>
        <ThreeCanvas width={FRAME.width} height={FRAME.height} shadows camera={{ fov: 40, near: 0.05, far: 320, position: HOOK.pos.toArray() as [number, number, number] }}>
          <color attach="background" args={["#a9d6f3"]} />
          <fog attach="fog" args={["#cfe3ee", 60, 190]} />
          <Sun cam={cam} />
          <RicksCamera cam={cam} />
          <RicksPost cam={cam} bloom={0.3} occlude ao={0.7} />
          <World t={t} f={f} />
          {actors}
        </ThreeCanvas>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: hookA }}>
        {HOOK_LINES.map((l) => (
          <div key={l.text} style={{ background: "#000", padding: "10px 34px", fontFamily: "Outfit, Arial Black, sans-serif", fontWeight: 900, fontSize: 124, color: "#fff", lineHeight: 1.05, whiteSpace: "nowrap" }}>
            {l.text}<span style={{ color: "#ffd447" }}>{l.key}</span>
          </div>
        ))}
      </div>
      <Pills pills={PILLS} t={t0} />
      <WordCaption words={READ} t={t0} />
      <BurstFx bursts={BURSTS} t={t0} />
      <AbsoluteFill style={{ background: "#cfe6ff", opacity: flash * 0.9, pointerEvents: "none" }} />
      {HORNS.map((h) => t0 >= h && t0 < h + 0.22 && <AbsoluteFill key={h} style={{ pointerEvents: "none", boxShadow: "inset 0 0 160px rgba(255,200,60,.55)" }} />)}
    </AbsoluteFill>
  );
};
