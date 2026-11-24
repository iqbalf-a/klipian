/* Teknisi TV Keliling yang Memotret Remote dengan HP (look ricks, B46 + B47 dongeng): a made-up story carried by one true fact. Pak Darto, a travelling TV technician, photographs the
   remote of Bu Rina's dead TV with his phone while Bang Jaya, the shop technician, laughs and offers a new TV. The phone screen stays dark; new batteries and the screen shows a
   violet blink and the TV comes on: a remote sends its commands as infrared light (about 940 nm) that the eye cannot see but a phone camera can. The picture follows the voice
   (words.json from faster-whisper): one shot per sentence, one caption word at a time, pills on their word (B45), mouths move only on the two quoted lines (B46 n), the last
   shot is Bang Jaya doing the same at his own home and the cut after it returns to the first shot (the loop). The set is a living room cut open: wallpaper, parquet, sofa,
   window and curtain, a TV on a cabinet, a toolbox, a shelf, a clock, a door (stage A) and Bang Jaya's workshop corner nine metres to the right (stage B). */
import React, { useLayoutEffect, useMemo, useRef } from "react";
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
const TOTAL = 50.84;
const LOOP_AT = 50.14;   // after the last spoken word has ended; from here the picture holds the first moment
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
const A8 = (lSh: number, lEl: number, rSh: number, rEl: number, x: Partial<Pose> = {}): Pose => ({ lSh, lEl, rSh, rEl, lHip: 8, lKn: 0, rHip: -8, rKn: 0, ...x });
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
const leafTex = (c: CanvasRenderingContext2D) => {   // a tapered banana leaf with a midrib and side veins, transparent around it
  c.clearRect(0, 0, 128, 256);
  const g = c.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, "#3f8f33"); g.addColorStop(0.5, "#79c24a"); g.addColorStop(1, "#4a9a38"); c.fillStyle = g;
  c.beginPath(); c.moveTo(64, 4); c.bezierCurveTo(124, 50, 124, 200, 64, 252); c.bezierCurveTo(4, 200, 4, 50, 64, 4); c.fill();
  c.strokeStyle = "#2f7a2a"; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 6); c.lineTo(64, 250); c.stroke();
  c.strokeStyle = "rgba(30,90,30,.45)"; c.lineWidth = 1.2; for (let y = 24; y < 240; y += 10) { c.beginPath(); c.moveTo(64, y); c.lineTo(10 + 6 * Math.abs(y - 128) / 128 * 4, y - 16); c.moveTo(64, y); c.lineTo(118 - 6 * Math.abs(y - 128) / 128 * 4, y - 16); c.stroke(); }
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

// ---------- the layout: stage A is Bu Rina's living room (x -3.4 to 4.9), stage B (nine metres right) is Bang Jaya's workshop corner at his own home ------------------------------
const OB = 9;
const DARTO_AT = { x: -0.8, z: 0.5 }, RINA_AT = { x: 0.9, z: 0.2 }, JAYA_AT = { x: 2.3, z: -0.5 }, JB_AT = { x: OB + 0.4, z: 0.2 };
const INSERT = V(-1.65, 1.35, 0.5);   // the phone screen, enlarged, that floats beside Pak Darto when the story looks at what the phone sees
const C = (px: number, py: number, pz: number, lx: number, ly: number, lz: number): Cam => ({ pos: V(px, py, pz), look: V(lx, ly, lz) });
const HOOK = C(-0.8, 1.25, 4.6, -0.8, 1.0, 0.4);   // Pak Darto, head about 30 % of the width
// every shot keeps the person whole (the feet are in frame) and has its own kind of move; no two neighbours and no kind more than three times (B59)
const SHOTS: Shot[] = [
  { from: 0, a: HOOK, b: C(-0.8, 1.2, 3.5, -0.8, 1.0, 0.4) },                                              // PUSH-IN: Pak Darto memotret remote pakai HP
  { from: 3.98, a: C(0.2, 3.2, 7.0, 0.0, 1.0, 0), b: C(0.7, 1.2, 4.8, 0.5, 1.0, 0.1) },                   // CRANE DOWN: Bu Rina bilang TV-nya mati total
  { from: 5.98, a: C(3.4, 1.3, 5.0, 3.6, 1.0, -0.2), b: C(1.8, 1.3, 5.0, 2.0, 1.0, -0.2) },               // TRUCK LEFT: Bang Jaya, teknisi toko saingannya (he walks in)
  { from: 8.36, a: C(2.0, 1.0, 4.9, 2.2, 0.75, -0.3), b: C(2.0, 1.0, 4.9, 2.2, 1.55, -0.3) },             // TILT UP from the flyer to his face: siap menjual TV baru tiga juta
  { from: 11.54, a: C(0.24, 1.25, 2.55, 2.3, 1.0, -0.4), b: C(4.1, 1.25, 2.72, 2.3, 1.0, -0.4) },         // ORBIT: Bang Jaya tertawa
  { from: 13.06, a: C(3.4, 1.3, 4.8, 2.3, 1.0, -0.4), b: C(2.9, 1.25, 3.5, 2.3, 1.0, -0.4) },             // DIAGONAL PUSH: "Remote kok difoto, Pak?"
  { from: 14.46, a: C(0.6, 1.3, 5.3, 2.2, 1.0, -0.3), b: C(0.6, 1.3, 5.3, -0.8, 1.0, 0.4) },             // PAN from Bang Jaya to Pak Darto: diam saja, menekan tombol power
  { from: 17.24, a: C(-0.8, 1.4, 5.0, -0.8, 1.0, 0.4), b: C(-0.8, 1.2, 3.5, -0.8, 1.0, 0.4) },           // PUSH-IN: memelototi layar HP-nya
  { from: 19.08, a: C(-0.2, 0.55, 4.7, -1.0, 1.2, 0.4), b: C(-1.4, 0.6, 4.5, -1.1, 1.2, 0.4) },          // LOW-ANGLE: Layar HP tetap gelap
  { from: 20.26, a: C(1.5, 1.3, 5.4, 1.6, 1.0, -0.4), b: C(2.7, 1.3, 5.4, 2.8, 1.0, -0.4) },             // TRUCK RIGHT: Bang Jaya makin lantang
  { from: 21.46, a: C(2.6, 1.3, 3.7, 2.3, 1.0, -0.4), b: C(1.0, 1.9, 6.4, 1.1, 1.0, 0.1) },              // PULL-OUT + RISE: "Tuh kan, TV-nya rusak, beli baru aja!"
  { from: 24.72, a: C(1.0, 1.2, 4.6, 0.9, 1.55, 0.2), b: C(1.0, 1.2, 4.6, 0.9, 0.85, 0.2) },             // TILT DOWN from her face to the wallet: Bu Rina melirik dompet
  { from: 26.28, a: C(-3.05, 1.25, 3.18, -0.8, 1.0, 0.5), b: C(1.2, 1.25, 3.37, -0.8, 1.0, 0.5) },       // ORBIT: membuka remote, mengganti baterainya
  { from: 29.24, a: C(-0.9, 1.3, 4.6, -0.8, 1.0, 0.4), b: C(-0.9, 1.2, 3.4, -0.8, 1.0, 0.4) },           // FAST PUSH: Tekan lagi
  { from: 30.38, a: C(-1.0, 2.6, 4.3, -1.1, 1.1, 0.4), b: C(-1.1, 1.0, 3.9, -1.1, 1.1, 0.4) },           // CRANE DOWN to the phone screen: muncul kedipan ungu
  { from: 32.28, a: C(-0.2, 1.3, 4.0, 0.2, 1.0, -0.4), b: C(0.5, 1.9, 7.0, 0.2, 1.0, -0.2) },            // PULL-OUT: TV langsung menyala
  { from: 34.66, a: C(-2.0, 1.4, 4.6, -1.0, 1.0, 0.4), b: C(-0.3, 1.2, 3.5, -1.0, 1.0, 0.4) },           // DIAGONAL PUSH: Remote mengirim perintah lewat cahaya inframerah
  { from: 37.1, a: C(-1.9, 1.3, 4.2, -1.3, 1.0, 0.4), b: C(-0.1, 1.3, 4.2, -0.5, 1.0, 0.4) },            // TRUCK RIGHT: sekitar 940 nanometer (Bu Rina walks over)
  { from: 39.64, a: C(-0.5, 0.8, 3.9, -0.5, 1.1, 0.4), b: C(-0.5, 2.3, 4.4, -0.5, 1.0, 0.4) },           // CRANE UP: mata kita tidak bisa melihatnya
  { from: 41.22, a: C(-3.2, 1.25, 2.9, -1.1, 1.0, 0.4), b: C(1.0, 1.25, 2.9, -1.1, 1.0, 0.4) },          // ORBIT: tapi sensor kamera HP bisa
  { from: 43.14, a: C(-1.3, 1.0, 4.6, -1.5, 0.6, 0.4), b: C(-1.3, 1.0, 4.6, -1.5, 1.5, 0.4) },          // TILT UP the dark screen: kalau layar tetap gelap
  { from: 44.46, a: C(-0.3, 0.55, 4.2, -0.8, 1.25, 0.4), b: C(-1.5, 0.6, 3.8, -0.9, 1.25, 0.4) },       // LOW-ANGLE: biasanya remotenya yang bermasalah
  { from: 46.58, a: C(OB + 0.8, 2.9, 6.2, OB + 0.3, 1.0, 0.1), b: C(OB + 0.6, 1.4, 4.4, OB + 0.3, 1.0, 0.1) },   // CRANE DOWN: Besoknya (Bang Jaya's own place)
  { from: 47.36, a: C(OB + 1.5, 1.4, 5.4, OB + 0.3, 1.0, 0.1), b: C(OB + 0.9, 1.25, 3.8, OB + 0.3, 1.0, 0.1) },   // DIAGONAL PUSH: Bang Jaya memotret remote, held to the cut
];

// ---------- the people (each their own outfit and face, B46 i; heads are always white) and who they are (B53): ------------------------------------------------------------------------------
// Pak Darto: an older travelling TV technician with grey hair and glasses, a green dotted work shirt; Bu Rina: the homeowner, a pink blouse, her hair in a bun;
// Bang Jaya: the younger rival who runs an electronics shop, a yellow collared shirt, a blue cap and a beard.
const DARTO: Outfit = { shirt: "#1f7a5c", stripe: "#ffd447", pattern: "dots", hair: "spiky", hairColor: "#9a9a9a", glasses: true, mustache: true, nose: "dot" };
const RINA: Outfit = { shirt: "#e0456b", stripe: "#8a1f3d", pattern: "plain", hair: "bun", hairColor: "#2a1a14", blush: true };
const JAYA: Outfit = { shirt: "#f2c230", stripe: "#b88a00", pattern: "collar", hat: "cap", hatColor: "#1d4ed8", beard: true, hairColor: "#17141c", body: "wide", nose: "big" };

// the two quoted lines (B46 n): only these words move a mouth
const TALK: Record<string, [number, number][]> = { jaya: [[13.06, 14.46], [21.46, 24.3]] };
const talkAt = (id: string, t: number) => {
  if (!(TALK[id] ?? []).some(([a, b]) => t >= a && t < b)) return 0;
  const w = WORDS.find((x) => t >= x.a - 0.02 && t < x.b + 0.05);
  return w ? 0.4 + 0.6 * Math.abs(Math.sin(t * 17)) : 0;
};

// ---------- the acted poses (hands reach canvas points, B52): the photo (remote in the left hand, phone in the right), the raised remote, opening the back, the wallet, the flyer ----------------------------
const PRESS_D = [2.2, 3.3, 16.3, 16.9, 29.9, 35.4, 41.6], PRESS_J = [49.0, 49.7];   // the thumb on a button: the remote hand dips
const press = (t: number, ps: number[]) => Math.max(0, ...ps.map((p) => bump(t - p)));
const photoPose = (t: number, ps: number[]): Pose => { const r = reach("r", 402, 400), l = reach("l", 110, 436 + 26 * press(t, ps)); return A8(l.sh, l.el, r.sh, r.el); };
const showPose = (): Pose => { const l = reach("l", 120, 230), r = reach("r", 400, 560); return A8(l.sh, l.el, r.sh, r.el); };
const openPose = (t: number): Pose => { const l = reach("l", 205, 590), r = reach("r", 300 + 60 * bump(t - 27.3), 585); return A8(l.sh, l.el, r.sh, r.el, { lean: 4 }); };
const walletPose = (): Pose => { const r = reach("r", 330, 560); return A8(12, -8, r.sh, r.el); };
const flyerPose = (kind: string, t: number): Pose => {
  const l = reach("l", 150, 540);
  const r = kind === "jpoint" ? { sh: 100 + 6 * Math.sin(t * 7), el: -4 } : kind === "jhips" ? { sh: 55, el: -82 } : kind === "jlaugh" ? { sh: 28 + 8 * Math.sin(t * 13), el: -58 } : { sh: 12, el: -8 };
  return A8(l.sh, l.el, r.sh, r.el);
};
const custom = (name: string, t: number, ps: number[]): Pose | null =>
  name === "photo" ? photoPose(t, ps) : name === "show" ? showPose() : name === "open" ? openPose(t) : name === "wallet" ? walletPose() : name.startsWith("j") ? flyerPose(name, t) : null;

const FOREVER = 1000;
const ACTORS: { id: string; o: Outfit; ps: number[]; tracks: Track[] }[] = [
  { id: "darto", o: DARTO, ps: PRESS_D, tracks: [
    { a: 0, b: 14.46, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[0, "calm", "photo"]] },
    { a: 14.46, b: 19.08, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[14.46, "calm", "photo"], [17.24, "puzzled", "photo"]] },
    { a: 19.08, b: 26.28, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[19.08, "puzzled", "photo"]] },
    { a: 26.28, b: 29.24, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[26.28, "calm", "open"]] },
    { a: 29.24, b: 32.28, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[29.24, "calm", "photo"], [31.1, "grin", "photo"]] },
    { a: 32.28, b: 34.66, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[32.28, "grin", "photo"]], beats: [["hop", 32.8, 33.1, 0.09], ["hop", 33.3, 33.6, 0.09]] },
    { a: 34.66, b: 41.22, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[34.66, "calm", "show"]] },
    { a: 41.22, b: 44.46, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[41.22, "calm", "photo"], [43.14, "puzzled", "photo"]] },
    { a: 44.46, b: FOREVER, pos: stay(DARTO_AT.x, DARTO_AT.z), faces: [[44.46, "calm", "show"]] },
  ] },
  { id: "rina", o: RINA, ps: [], tracks: [
    { a: 0, b: 3.98, pos: stay(RINA_AT.x, RINA_AT.z), faces: [[0, "calm", "down"]] },
    { a: 3.98, b: 5.98, flip: true, pos: stay(RINA_AT.x, RINA_AT.z), faces: [[3.98, "puzzled", "shrug"], [4.9, "shocked", "point"]] },   // she points at the dead TV
    { a: 5.98, b: 13.06, pos: stay(RINA_AT.x, RINA_AT.z), faces: [[5.98, "puzzled", "hips"]] },
    { a: 13.06, b: 24.72, pos: stay(RINA_AT.x, RINA_AT.z), faces: [[13.06, "puzzled", "belly"]] },
    { a: 24.72, b: 26.28, pos: stay(RINA_AT.x, RINA_AT.z), faces: [[24.72, "puzzled", "wallet"]] },
    { a: 26.28, b: 32.28, pos: stay(RINA_AT.x, RINA_AT.z), faces: [[26.28, "puzzled", "belly"], [31.1, "shocked", "belly"]] },
    { a: 32.28, b: 37.5, pos: stay(RINA_AT.x, RINA_AT.z), faces: [[32.28, "grin", "cheerc"]], beats: [["hop", 32.9, 33.2, 0.1], ["hop", 33.4, 33.7, 0.1]] },
    withGait({ a: 37.5, b: 39.1, pos: walk(37.5, 39.1, RINA_AT.x, RINA_AT.z, -0.1, 0.4), faces: [[37.5, "puzzled", "down"]] }, "walk", 0.2),   // she walks over to look at the remote
    { a: 39.1, b: FOREVER, flip: true, pos: stay(-0.1, 0.4), faces: [[39.1, "puzzled", "hips"], [41.22, "shocked", "hips"], [43.14, "puzzled", "shrug"]] },
  ] },
  { id: "jaya", o: JAYA, ps: [], tracks: [
    withGait({ a: 5.98, b: 7.9, pos: walk(5.98, 7.9, 3.9, JAYA_AT.z, JAYA_AT.x, JAYA_AT.z), faces: [[5.98, "sly", "down"]] }, "walk", 0.2),   // he walks in from the door side
    { a: 7.9, b: 8.36, flip: true, pos: stay(JAYA_AT.x, JAYA_AT.z), faces: [[7.9, "sly", "down"]] },
    { a: 8.36, b: 11.54, flip: true, pos: stay(JAYA_AT.x, JAYA_AT.z), faces: [[8.36, "grin", "jflyer"]] },
    { a: 11.54, b: 13.06, flip: true, pos: stay(JAYA_AT.x, JAYA_AT.z), faces: [[11.54, "grin", "jlaugh"]], beats: [["hop", 11.7, 12.0, 0.1], ["hop", 12.3, 12.6, 0.1]] },
    { a: 13.06, b: 14.46, flip: true, pos: stay(JAYA_AT.x, JAYA_AT.z), faces: [[13.06, "sly", "jpoint"]] },
    { a: 14.46, b: 20.26, flip: true, pos: stay(JAYA_AT.x, JAYA_AT.z), faces: [[14.46, "sly", "jhips"]] },
    { a: 20.26, b: 24.72, flip: true, pos: stay(JAYA_AT.x, JAYA_AT.z), faces: [[20.26, "grin", "jpoint"]], beats: [["hop", 20.5, 20.8, 0.1]] },
    { a: 24.72, b: 32.28, flip: true, pos: stay(JAYA_AT.x, JAYA_AT.z), faces: [[24.72, "grin", "jhips"]] },
    { a: 32.28, b: 46.58, flip: true, pos: stay(JAYA_AT.x, JAYA_AT.z), faces: [[32.28, "shocked", "jflyer"]] },
  ] },
  { id: "jayaB", o: JAYA, ps: PRESS_J, tracks: [
    withGait({ a: 46.58, b: 47.6, pos: walk(46.58, 47.6, OB + 1.4, JB_AT.z, JB_AT.x, JB_AT.z), faces: [[46.58, "sly", "down"]] }, "walk", 0.2),
    { a: 47.6, b: FOREVER, pos: stay(JB_AT.x, JB_AT.z), faces: [[47.6, "sly", "photo"]] },
  ] },
];

type AState = { rig: Pose; x: number; z: number; flip: boolean; expr: Expr; arms: Arms; hop: number; h: number; talk: number; kind: string };
const stateOf = (a: { id: string; ps: number[]; tracks: Track[] }, t: number): AState | null => {
  const tr = a.tracks.find((k) => t >= k.a && t < k.b);
  if (!tr) return null;
  const [bx, z] = tr.pos(t), ch = tr.ch ? choreoAt(tr.ch, t, tr.h ?? 1.7) : null, x = ch ? (tr.dir ?? 1) * ch.x : bx;
  const [, expr, armName] = stepAt(tr.faces, t);
  const rig = ch ? ch.pose : custom(armName, t, a.ps) ?? poseAt(tr.faces.map(([ta, , ar]) => [ta, ar] as [number, string]), t, 0.28);   // still means still: no sway, tilt or nod unless acted
  return { rig, x, z, flip: tr.flip ?? false, expr, arms: "down", h: tr.h ?? 1.7, talk: talkAt(a.id, t), hop: beatsAt(tr.beats ?? [], t) + (ch ? ch.hop : 0), kind: armName };
};
const actor = (id: string) => ACTORS.find((q) => q.id === id)!;

// ---------- the violet blink the phone camera sees (the remote's infrared light), and the TV that comes on --------------------------------------------------------------------------------------------------
const TV_ON = 32.76;
const GLOW: [number, number][] = [[30.9, 32.9], [41.5, 42.9]];
const glowAt = (t: number) => { const w = GLOW.find(([a, b]) => t >= a && t < b); if (!w) return 0; const e = Math.min(1, (t - w[0]) / 0.15, (w[1] - t) / 0.3); return e * (Math.sin(t * 42) > -0.25 ? 1 : 0.12); };
const INSERTS: [number, number][] = [[19.08, 26.28], [30.38, 34.4], [41.22, 46.58]];   // when the enlarged phone screen floats beside Pak Darto
const RINGS: [number, number] = [34.9, 39.64];   // the drawn infrared rings: they stop on "mata kita tidak bisa melihatnya"

const PILLS: Pill[] = [
  { at: 9.62, until: 11.4, text: "Rp 3.000.000", key: "3.000.000", color: "#ff6b3d", y: 330 },
  { at: 36.3, until: 37.8, text: "cahaya inframerah", key: "inframerah", color: "#b46bff", y: 330 },
  { at: 37.8, until: 39.55, text: "940 nm", key: "940 nm", color: "#b46bff", y: 330 },
];
const HOOK_LINES: { text: string; key?: string }[] = [{ text: "Remote difoto" }, { text: "pakai ", key: "HP" }];
const READ = [...readWords(WORDS), { w: "Pak", a: 50.5, b: 50.84 }];   // the first word comes back on the last 0.34 s so the loop holds

// ---------- painted textures (soft shaded, grained, many small marks; nothing is one flat colour) ------------------------------------------------------------------------------------------------------------------
const stripedWall = (base: string, stripe: string) => (c: CanvasRenderingContext2D) => {
  plasterTex(base, "rgba(90,60,30,.22)")(c);
  c.fillStyle = stripe; for (let x = 6; x < 256; x += 32) c.fillRect(x, 0, 11, 256);
  c.fillStyle = "rgba(255,255,255,.2)"; for (let x = 6; x < 256; x += 32) for (let y = 14; y < 220; y += 36) { c.beginPath(); c.arc(x + 5.5, y, 3.2, 0, 7); c.fill(); }
};
const parquetTex = (a: string, b: string) => (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#8a5a32"; c.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 16; r++) for (let k = 0; k < 4; k++) {
    const x = k * 64 + (r % 2) * 32 - 32, y = r * 16, v = rnd(r * 9 + k);
    c.fillStyle = v > 0.5 ? a : b; c.fillRect(x + 1, y + 1, 62, 14);
    c.fillStyle = `rgba(255,235,190,${0.08 + 0.1 * rnd(r + k * 5)})`; c.fillRect(x + 1, y + 1, 62, 3);
    c.strokeStyle = "rgba(60,30,10,.28)"; c.lineWidth = 1; for (let j = 0; j < 3; j++) { const yy = y + 4 + j * 4 + rnd(r * 3 + j) * 2; c.beginPath(); c.moveTo(x + 2, yy); c.bezierCurveTo(x + 20, yy + 2, x + 40, yy - 2, x + 62, yy + 1); c.stroke(); }
  }
};
const rugTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#b3342f"; c.fillRect(0, 0, 256, 256);
  c.fillStyle = "#f2e3c0"; c.fillRect(12, 12, 232, 232); c.fillStyle = "#b3342f"; c.fillRect(22, 22, 212, 212);
  for (let i = 0; i < 5; i++) { const s = 96 - i * 18; c.fillStyle = ["#e8a93a", "#2d7f86", "#f2e3c0", "#e8a93a", "#8a2420"][i]; c.beginPath(); c.moveTo(128, 128 - s); c.lineTo(128 + s, 128); c.lineTo(128, 128 + s); c.lineTo(128 - s, 128); c.fill(); }
  for (let x = 0; x < 256; x += 8) { c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(x, 0, 3, 8); c.fillRect(x, 248, 3, 8); }
  speck(c, 256, 256, 700, ["rgba(255,255,255,.12)", "rgba(0,0,0,.14)"], 2, 12);
};
const sofaTex = (base: string) => (c: CanvasRenderingContext2D) => {
  c.fillStyle = base; c.fillRect(0, 0, 128, 128); speck(c, 128, 128, 500, ["rgba(255,255,255,.12)", "rgba(0,0,0,.14)"], 2, 5);
  c.strokeStyle = "rgba(0,0,0,.22)"; c.lineWidth = 2; for (let k = 16; k < 128; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 128); c.moveTo(0, k); c.lineTo(128, k); c.stroke(); }
  c.fillStyle = "rgba(255,255,255,.35)"; for (let y = 16; y < 128; y += 32) for (let x = 16; x < 128; x += 32) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
};
const curtainTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#e8604c"; c.fillRect(0, 0, 128, 256);
  for (let x = 0; x < 128; x += 16) { const g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, "rgba(0,0,0,.18)"); g.addColorStop(0.5, "rgba(255,255,255,.14)"); g.addColorStop(1, "rgba(0,0,0,.18)"); c.fillStyle = g; c.fillRect(x, 0, 16, 256); }
  for (let i = 0; i < 24; i++) { const x = rnd(i) * 120 + 4, y = rnd(i + 7) * 248 + 4; c.fillStyle = "#fff0c8"; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + 5 * Math.cos(k * 1.26), y + 5 * Math.sin(k * 1.26), 3, 0, 7); c.fill(); } c.fillStyle = "#e8a93a"; c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill(); }
};
const outsideTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#69b8ee"); g.addColorStop(0.7, "#cdeaf8"); g.addColorStop(1, "#f6fbf0"); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  const sg = c.createRadialGradient(200, 50, 4, 200, 50, 60); sg.addColorStop(0, "#fff7c8"); sg.addColorStop(1, "rgba(255,247,200,0)"); c.fillStyle = sg; c.fillRect(0, 0, 256, 256);
  c.fillStyle = "#4f9a45"; c.fillRect(0, 200, 256, 56);
  for (let i = 0; i < 5; i++) { c.fillStyle = ["#3f8a34", "#5aac44"][i % 2]; c.beginPath(); c.arc(30 + i * 52, 190, 34 + rnd(i) * 14, 0, 7); c.fill(); c.fillStyle = "#7a5a3a"; c.fillRect(26 + i * 52, 200, 8, 40); }
};
const flyerTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#fff6d8"; c.fillRect(0, 0, 256, 340);
  c.fillStyle = "#d9352a"; c.fillRect(0, 0, 256, 78); c.fillStyle = "#fff"; c.font = "900 54px Arial Black, Arial"; c.textAlign = "center"; c.fillText("TV BARU", 128, 58);
  c.fillStyle = "#23262e"; c.beginPath(); c.roundRect(40, 100, 176, 112, 10); c.fill();
  const g = c.createLinearGradient(0, 108, 0, 204); g.addColorStop(0, "#69b8ee"); g.addColorStop(1, "#cdeaf8"); c.fillStyle = g; c.fillRect(50, 108, 156, 96);
  c.fillStyle = "#ffd447"; c.beginPath(); c.arc(170, 136, 14, 0, 7); c.fill(); c.fillStyle = "#4f9a45"; c.beginPath(); c.ellipse(110, 206, 90, 30, 0, Math.PI, 0); c.fill();
  c.fillStyle = "#23262e"; c.fillRect(110, 212, 36, 14); c.fillRect(86, 224, 84, 8);
  c.fillStyle = "#d9352a"; c.font = "900 38px Arial Black, Arial"; c.fillText("Rp 3.000.000", 128, 290); c.fillStyle = "#1f4fa8"; c.font = "800 22px Arial"; c.fillText("TOKO JAYA", 128, 322);
};
const toolboxTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#c8382b"; c.fillRect(0, 0, 256, 128); const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "rgba(255,255,255,.28)"); g.addColorStop(0.3, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,.25)"); c.fillStyle = g; c.fillRect(0, 0, 256, 128);
  c.fillStyle = "#f6e9b8"; c.beginPath(); c.roundRect(60, 38, 136, 52, 8); c.fill(); c.fillStyle = "#23262e"; c.font = "900 34px Arial Black, Arial"; c.textAlign = "center"; c.fillText("SERVIS TV", 128, 74);
  speck(c, 256, 128, 160, ["rgba(0,0,0,.18)", "rgba(255,255,255,.16)"], 2, 9);
};
const tvOffTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 256, 160); g.addColorStop(0, "#161b24"); g.addColorStop(1, "#06080c"); c.fillStyle = g; c.fillRect(0, 0, 256, 160);
  c.fillStyle = "rgba(255,255,255,.09)"; c.beginPath(); c.moveTo(0, 0); c.lineTo(130, 0); c.lineTo(40, 160); c.lineTo(0, 160); c.fill();
  c.fillStyle = "rgba(190,220,255,.06)"; c.fillRect(150, 30, 70, 90); c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(184, 30, 3, 90); c.fillRect(150, 74, 70, 3);
};
const tvOnTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, "#4aa7e6"); g.addColorStop(0.7, "#bfe6f7"); g.addColorStop(1, "#e8f5e0"); c.fillStyle = g; c.fillRect(0, 0, 256, 160);
  c.fillStyle = "#ffd447"; c.beginPath(); c.arc(196, 40, 22, 0, 7); c.fill();
  c.fillStyle = "#fff"; for (const [x, y, r] of [[60, 40, 18], [78, 36, 24], [100, 42, 16]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  c.fillStyle = "#5faa45"; c.beginPath(); c.ellipse(70, 170, 130, 56, 0, Math.PI, 0); c.fill(); c.fillStyle = "#3f8a34"; c.beginPath(); c.ellipse(210, 176, 110, 46, 0, Math.PI, 0); c.fill();
  c.fillStyle = "#c2563a"; c.fillRect(120, 108, 36, 28); c.fillStyle = "#f2c230"; c.beginPath(); c.moveTo(114, 110); c.lineTo(138, 90); c.lineTo(162, 110); c.fill();
  c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(0, 138, 256, 22); c.fillStyle = "#fff"; c.font = "800 15px Arial"; c.textAlign = "center"; c.fillText("SELAMAT SORE", 128, 154);
};
const artTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "#f5c27a"); g.addColorStop(1, "#fbe6b8"); c.fillStyle = g; c.fillRect(0, 0, 192, 128);
  c.fillStyle = "#e8604c"; c.beginPath(); c.arc(96, 70, 24, 0, 7); c.fill(); c.fillStyle = "#6b4fa0"; c.beginPath(); c.moveTo(0, 128); c.lineTo(50, 60); c.lineTo(100, 128); c.fill(); c.fillStyle = "#2d7f86"; c.beginPath(); c.moveTo(70, 128); c.lineTo(140, 50); c.lineTo(192, 128); c.fill();
};
const clockTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#f6efe0"; c.fillRect(0, 0, 128, 128); c.strokeStyle = "#23262e"; c.lineWidth = 4; for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; c.beginPath(); c.moveTo(64 + 46 * Math.sin(a), 64 - 46 * Math.cos(a)); c.lineTo(64 + 54 * Math.sin(a), 64 - 54 * Math.cos(a)); c.stroke(); }
};
const calendarTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#fffaf0"; c.fillRect(0, 0, 128, 160); c.fillStyle = "#2d7f86"; c.fillRect(0, 0, 128, 40); c.fillStyle = "#fff"; c.font = "900 24px Arial Black, Arial"; c.textAlign = "center"; c.fillText("NOV", 64, 30);
  c.fillStyle = "#23262e"; c.font = "700 12px Arial"; for (let r = 0; r < 5; r++) for (let k = 0; k < 7; k++) c.fillText(String(r * 7 + k + 1), 14 + k * 17, 62 + r * 20);
};
const remoteTex = (c: CanvasRenderingContext2D) => {   // the remote seen from above, long side along x: power at the left, number pad, a ring, the IR window at the right end
  c.fillStyle = "#262a33"; c.fillRect(0, 0, 256, 64); const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, "rgba(255,255,255,.2)"); g.addColorStop(1, "rgba(0,0,0,.2)"); c.fillStyle = g; c.fillRect(0, 0, 256, 64);
  c.fillStyle = "#d9352a"; c.beginPath(); c.arc(26, 32, 12, 0, 7); c.fill();
  c.fillStyle = "#4a505c"; for (let k = 0; k < 3; k++) for (let r = 0; r < 3; r++) { c.beginPath(); c.roundRect(56 + k * 22, 10 + r * 16, 17, 11, 3); c.fill(); }
  c.fillStyle = "#6b7280"; c.beginPath(); c.arc(150, 32, 22, 0, 7); c.fill(); c.fillStyle = "#262a33"; c.beginPath(); c.arc(150, 32, 9, 0, 7); c.fill();
  c.fillStyle = "#4a505c"; for (let k = 0; k < 2; k++) for (let r = 0; r < 2; r++) { c.beginPath(); c.roundRect(188 + k * 26, 14 + r * 22, 20, 14, 3); c.fill(); }
  c.fillStyle = "#3a1530"; c.fillRect(246, 18, 10, 28);
};

type TexSet = Record<"wood" | "wainA" | "wainB" | "wallA" | "wallB" | "parqA" | "parqB" | "rug" | "sofa" | "sofaB" | "curtain" | "outside" | "flyer" | "toolbox" | "tvOff" | "tvOn" | "art" | "clock" | "calendar" | "remote" | "metal" | "soft" | "leaf", THREE.Texture>;

/** puts what a person holds (and the enlarged phone) on the cast layer, so it is drawn with the cast: in front of the hand, sharp, never hidden by it */
const OnCast: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => { ref.current?.traverse((o) => o.layers.set(CAST)); });
  return <group ref={ref}>{children}<hemisphereLight args={["#ffffff", "#b8a890", 1.5]} /><directionalLight position={[2, 5, 6]} intensity={1.7} color="#fff4dc" /></group>;   // lights must be on the cast layer too, or these meshes render black
};
const ROT_SHOW = 1.35;
const REMOTE_GRIP = 0.17;   // the hand holds the back end of the remote; its centre is this far along it
/** where a held thing sits: the hand joint of a person, in the world (B52: nothing floats near a person) */
const handAt = (id: string, side: "l" | "r", t: number) => {
  const s = stateOf(actor(id), t);
  if (!s) return null;
  const hd = handOffset(s.rig, side, s.h), sg = s.flip ? -1 : 1;
  return { x: s.x + sg * hd.x, y: hd.y + s.hop * s.h, z: s.z + 0.09, sg, show: s.kind === "show" };
};

/** the TV remote: a long dark body with a power button, a number pad, a ring and, at one end, the infrared window */
const Remote: React.FC<{ id: string; t: number; tex: TexSet }> = ({ id, t, tex }) => {
  const h = handAt(id, "l", t);
  if (!h) return null;
  return (
    <group position={[h.x, h.y, h.z]} rotation={[0, 0, h.show ? h.sg * ROT_SHOW : 0]} scale={[h.sg, 1, 1]}>
      <RBox size={[0.44, 0.115, 0.05]} pos={[REMOTE_GRIP, 0, 0]} map={tex.remote} fit r={0.025} rough={0.45} />
      <RBox size={[0.03, 0.07, 0.04]} pos={[REMOTE_GRIP + 0.225, 0, 0]} color="#3a1530" r={0.012} rough={0.2} />
    </group>
  );
};
/** the phone seen from its back: a glassy dark slab with a camera bump */
const Phone: React.FC<{ id: string; t: number }> = ({ id, t }) => {
  const h = handAt(id, "r", t);
  if (!h || (id === "darto" && t >= 26.28 && t < 29.24)) return null;   // while he opens the remote the phone is in his shirt pocket
  return (
    <group position={[h.x, h.y + 0.02, h.z]}>
      <RBox size={[0.21, 0.38, 0.04]} pos={[0, 0, 0]} color="#3d6fb0" r={0.04} rough={0.25} metal={0.5} />
      <RBox size={[0.09, 0.09, 0.02]} pos={[-0.045, 0.125, 0.025]} color="#262b36" r={0.03} rough={0.3} />
      <Cyl r={0.026} h={0.025} pos={[-0.045, 0.125, 0.036]} rot={[Math.PI / 2, 0, 0]} color="#07080c" metal={0.6} rough={0.15} seg={16} />
      <RBox size={[0.012, 0.06, 0.012]} pos={[0.107, 0.06, 0]} color="#8f97a5" r={0.004} metal={0.7} />
    </group>
  );
};
/** the drawn infrared rings: they leave the remote's window while the narrator says so, and stop when the eye is mentioned (the eye cannot see them) */
const Rings: React.FC<{ t: number }> = ({ t }) => {
  if (t < RINGS[0] || t >= RINGS[1]) return null;
  const h = handAt("darto", "l", t);
  if (!h) return null;
  const L = REMOTE_GRIP + 0.225, tx = h.x + h.sg * L * Math.cos(ROT_SHOW), ty = h.y + L * Math.sin(ROT_SHOW);
  return (
    <>
      {[0, 1, 2].map((i) => {
        const u = ((t - RINGS[0]) / 0.9 + i / 3) % 1, r = 0.06 + 0.8 * u;
        return <mesh key={i} position={[tx, ty, h.z + 0.02]} scale={[r, r, 1]}><torusGeometry args={[1, 0.012 / Math.max(r, 0.2), 8, 48]} /><meshBasicMaterial color="#b46bff" transparent opacity={0.75 * (1 - u)} toneMapped={false} depthWrite={false} /></mesh>;
      })}
      <mesh position={[tx, ty, h.z + 0.02]}><sphereGeometry args={[0.03, 12, 10]} /><meshBasicMaterial color="#e6c8ff" toneMapped={false} /></mesh>
    </>
  );
};

/** the phone screen enlarged: the camera view of the remote; dark, or with the remote's violet blink */
const PhoneInsert: React.FC<{ t: number }> = ({ t }) => {
  const tex = useMemo(() => painted(256, 460, () => undefined), []);
  const w = INSERTS.find(([a, b]) => t >= a && t < b);
  if (!w) return null;
  const g = glowAt(t), c = (tex.image as HTMLCanvasElement).getContext("2d")!;
  c.fillStyle = "#06080c"; c.fillRect(0, 0, 256, 460);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.02 + 0.03 * rnd(i + Math.floor(t * 12))})`; c.fillRect(rnd(i) * 256, rnd(i * 3 + 1) * 460, 40 + rnd(i + 4) * 60, 2); }
  c.save(); c.translate(128, 240); c.rotate(-0.12);
  c.fillStyle = "#262b35"; c.beginPath(); c.roundRect(-96, -26, 192, 52, 13); c.fill();
  c.fillStyle = "#3b414d"; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-62 + k * 24, 0, 7, 0, 7); c.fill(); }
  c.fillStyle = "#4a505c"; c.beginPath(); c.arc(52, 0, 14, 0, 7); c.fill();
  c.fillStyle = "#1a0e1a"; c.fillRect(90, -11, 8, 22);
  c.restore();
  if (g > 0) {
    const tx = 128 + 96 * Math.cos(-0.12), ty = 240 + 96 * Math.sin(-0.12), r = 26 + 90 * g;
    const gr = c.createRadialGradient(tx, ty, 2, tx, ty, r); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(222,170,255,.95)"); gr.addColorStop(1, "rgba(150,70,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, 256, 460);
    c.strokeStyle = `rgba(190,120,255,${0.5 * g})`; c.lineWidth = 4; for (const k of [1, 2]) { c.beginPath(); c.arc(tx, ty, 30 + 30 * k * g, 0, 7); c.stroke(); }
  }
  c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 3; for (const [x, y, dx, dy] of [[28, 56, 1, 1], [228, 56, -1, 1], [28, 380, 1, -1], [228, 380, -1, -1]] as const) { c.beginPath(); c.moveTo(x + dx * 26, y); c.lineTo(x, y); c.lineTo(x, y + dy * 26); c.stroke(); }
  c.fillStyle = "#fff"; c.font = "800 17px Arial"; c.textAlign = "center"; c.fillText("VIDEO", 128, 30);
  c.lineWidth = 5; c.beginPath(); c.arc(128, 424, 22, 0, 7); c.stroke(); c.fillStyle = "#e0324a"; c.beginPath(); c.arc(128, 424, 13, 0, 7); c.fill();
  tex.needsUpdate = true;
  const s = pop(t - w[0]) * Math.min(1, (w[1] - t) / 0.2);
  return (
    <group position={INSERT.toArray()} rotation={[0, 0.12, 0]} scale={s}>
      <RBox size={[0.66, 1.16, 0.06]} pos={[0, 0, 0]} color="#14161c" r={0.07} rough={0.25} metal={0.4} />
      <mesh position={[0, 0, 0.034]}><planeGeometry args={[0.58, 1.04]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <RBox size={[0.012, 0.18, 0.02]} pos={[0.335, 0.2, 0]} color="#8f97a5" r={0.004} metal={0.7} />
      {g > 0 && <pointLight position={[0, 0, 0.8]} intensity={2.4 * g} distance={3} decay={2} color="#b46bff" />}
    </group>
  );
};

/** a leafy plant in a pot (leaf cards with the painted leaf, a few lobes) */
const Plant: React.FC<{ x: number; z: number; s?: number; f: number; leaf: THREE.Texture; pot?: string }> = ({ x, z, s = 1, f, leaf, pot = "#c2623a" }) => (
  <group position={[x, 0, z]} scale={s}>
    <Cyl r={0.2} r2={0.14} h={0.34} pos={[0, 0.17, 0]} color={pot} seg={16} rough={0.8} /><Cyl r={0.21} h={0.05} pos={[0, 0.35, 0]} color="#a9502c" seg={16} />
    {[0, 1, 2, 3, 4, 5].map((k) => <group key={k} position={[0, 0.36, 0]} rotation={[0, k * 1.05, 0]}><group rotation={[-0.55 - 0.07 * (k % 3) + 0.03 * Math.sin(f * 0.06 + k), 0, 0]}><mesh position={[0, 0.42, 0]}><planeGeometry args={[0.32, 0.84]} /><meshStandardMaterial map={leaf} alphaTest={0.4} side={THREE.DoubleSide} roughness={0.7} /></mesh></group></group>)}
  </group>
);

type RoomP = { v: "a" | "b"; tex: TexSet; t: number; f: number };
/** a living room cut open toward the camera (x -3.4 to 4.9): wallpaper or plaster, parquet, a TV on a cabinet, a clock, frames, a shelf; A adds the window, sofa, door, lamp and the toolbox table, B a repair bench and old TVs */
const Room: React.FC<RoomP> = ({ v, tex, t, f }) => {
  const a = v === "a", on = t >= TV_ON && a;
  return (
    <group>
      {/* floor, slab, rug, walls, rails */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.75, 0, 0.4]}><planeGeometry args={[8.4, 4.6]} /><meshStandardMaterial map={a ? tex.parqA : tex.parqB} roughness={0.55} /></mesh>
      <RBox size={[8.5, 0.3, 4.7]} pos={[0.75, -0.17, 0.4]} color="#6b4a2a" r={0.03} />
      {a && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.012, 0.6]}><planeGeometry args={[3.2, 2.1]} /><meshStandardMaterial map={tex.rug} roughness={0.95} /></mesh>}
      <RBox size={[8.4, 2.9, 0.2]} pos={[0.75, 1.45, -1.7]} map={a ? tex.wallA : tex.wallB} tile={1.6} r={0.03} />
      <RBox size={[0.2, 2.9, 4.6]} pos={[-3.45, 1.45, 0.4]} map={a ? tex.wallA : tex.wallB} tile={1.6} r={0.03} />
      <RBox size={[0.2, 2.9, 4.6]} pos={[4.95, 1.45, 0.4]} map={a ? tex.wallA : tex.wallB} tile={1.6} r={0.03} />
      <RBox size={[8.4, 0.95, 0.05]} pos={[0.75, 0.5, -1.58]} map={a ? tex.wainA : tex.wainB} tile={1.2} r={0.02} />
      <RBox size={[8.4, 0.06, 0.1]} pos={[0.75, 1.0, -1.57]} color="#f6efe0" r={0.02} />
      <RBox size={[8.4, 0.12, 0.07]} pos={[0.75, 0.06, -1.56]} color="#f6efe0" r={0.02} />
      {/* the TV cabinet and the TV (it comes on at TV_ON: A only) */}
      <RBox size={[1.5, 0.5, 0.45]} pos={[0.4, 0.28, -1.3]} map={tex.wood} tile={0.8} r={0.03} />
      <RBox size={[0.66, 0.38, 0.02]} pos={[0.07, 0.28, -1.075]} color="#8a5a32" r={0.01} /><RBox size={[0.66, 0.38, 0.02]} pos={[0.73, 0.28, -1.075]} color="#8a5a32" r={0.01} />
      <Ball r={0.025} pos={[0.33, 0.28, -1.05]} color="#e0b04a" rough={0.3} /><Ball r={0.025} pos={[0.47, 0.28, -1.05]} color="#e0b04a" rough={0.3} />
      {[[-0.28, -1.12], [1.08, -1.12], [-0.28, -1.48], [1.08, -1.48]].map(([lx, lz], i) => <Cyl key={i} r={0.03} r2={0.02} h={0.08} pos={[lx + 0.0, 0.0, lz]} color="#5a3b1f" seg={8} />)}
      <RBox size={[1.2, 0.74, 0.12]} pos={[0.4, 0.94, -1.3]} color="#1c2028" r={0.04} rough={0.3} />
      <mesh position={[0.4, 0.94, -1.238]}><planeGeometry args={[1.08, 0.64]} /><meshStandardMaterial map={on ? tex.tvOn : tex.tvOff} roughness={on ? 0.9 : 0.12} metalness={on ? 0 : 0.2} emissive={on ? "#ffffff" : "#000000"} emissiveMap={on ? tex.tvOn : undefined} emissiveIntensity={on ? 0.9 : 0} /></mesh>
      <RBox size={[0.3, 0.05, 0.22]} pos={[0.4, 0.55, -1.3]} color="#2a2f3a" r={0.02} metal={0.3} />
      <Ball r={0.012} pos={[0.92, 0.6, -1.236]} color={on ? "#39ff14" : "#3a3f48"} />
      {on && <pointLight position={[0.4, 1.0, -0.4]} intensity={1.6} distance={5} decay={2} color="#cfe6ff" />}
      {/* wall: the clock (the second hand sweeps), two framed pictures, a calendar */}
      <Cyl r={0.23} h={0.05} pos={[0.4, 1.95, -1.55]} rot={[Math.PI / 2, 0, 0]} color="#3b2414" seg={28} rough={0.5} />
      <mesh position={[0.4, 1.95, -1.52]}><circleGeometry args={[0.2, 32]} /><meshStandardMaterial map={tex.clock} roughness={0.5} /></mesh>
      <RBox size={[0.012, 0.11, 0.012]} pos={[0.4, 1.98, -1.51]} rot={[0, 0, 0.4]} color="#17141c" r={0.004} />
      <RBox size={[0.012, 0.16, 0.012]} pos={[0.4, 1.95, -1.505]} color="#17141c" r={0.004} />
      <group position={[0.4, 1.95, -1.5]} rotation={[0, 0, -f * 0.0175]}><RBox size={[0.006, 0.17, 0.006]} pos={[0, 0.07, 0]} color="#d9352a" r={0.002} /></group>
      <RBox size={[0.62, 0.47, 0.05]} pos={[-1.0, 1.75, -1.55]} color="#7a4a22" map={tex.wood} tile={0.6} r={0.02} /><mesh position={[-1.0, 1.75, -1.52]}><planeGeometry args={[0.52, 0.37]} /><meshStandardMaterial map={tex.art} roughness={0.7} /></mesh>
      <RBox size={[0.4, 0.5, 0.05]} pos={[1.6, 1.75, -1.55]} color="#f6efe0" r={0.02} /><mesh position={[1.6, 1.75, -1.52]}><planeGeometry args={[0.32, 0.42]} /><meshStandardMaterial map={tex.art} roughness={0.7} /></mesh>
      <RBox size={[0.36, 0.46, 0.03]} pos={[3.55, 1.6, -1.58]} map={tex.calendar} fit r={0.01} />
      {/* a shelf with a plant, a vase and books */}
      <RBox size={[0.95, 0.05, 0.26]} pos={[1.55, 1.25, -1.5]} map={tex.wood} tile={0.6} r={0.015} />
      {[0, 1, 2, 3].map((k) => <RBox key={k} size={[0.06, 0.26 - 0.02 * (k % 2), 0.17]} pos={[1.15 + k * 0.075, 1.4, -1.5]} color={["#d9352a", "#2f6fa0", "#e8a93a", "#3f8f6a"][k]} r={0.008} />)}
      <Cyl r={0.06} r2={0.04} h={0.2} pos={[1.75, 1.37, -1.5]} color="#5fb3ff" seg={14} rough={0.2} />
      <Plant x={1.97} z={-1.5} s={0.35} f={f} leaf={tex.leaf} pot="#e8a93a" />
      {a ? (
        <>
          {/* the window with curtains, a sill and the sky outside */}
          <RBox size={[1.5, 1.4, 0.1]} pos={[-2.0, 1.7, -1.6]} color="#f6efe0" r={0.03} />
          <mesh position={[-2.0, 1.7, -1.545]}><planeGeometry args={[1.3, 1.2]} /><meshBasicMaterial map={tex.outside} toneMapped={false} /></mesh>
          <RBox size={[1.3, 0.05, 0.05]} pos={[-2.0, 1.7, -1.52]} color="#f6efe0" r={0.01} /><RBox size={[0.05, 1.2, 0.05]} pos={[-2.0, 1.7, -1.52]} color="#f6efe0" r={0.01} />
          <RBox size={[1.75, 0.07, 0.3]} pos={[-2.0, 0.98, -1.48]} color="#f6efe0" r={0.025} />
          <Cyl r={0.025} h={2.0} pos={[-2.0, 2.5, -1.46]} rot={[0, 0, Math.PI / 2]} color="#8a5a32" seg={10} />
          {[-2.8, -1.2].map((cx, i) => <group key={i} position={[cx, 1.6, -1.44]} rotation={[0, 0, 0.012 * Math.sin(f * 0.05 + i * 2)]}><RBox size={[0.4, 1.82, 0.1]} pos={[0, 0, 0]} map={tex.curtain} fit r={0.04} rough={0.95} /></group>)}
          {/* the sofa: base, three seat cushions, back, arms, feet, a pillow */}
          <RBox size={[1.9, 0.3, 0.85]} pos={[-2.0, 0.3, -1.08]} map={tex.sofa} tile={0.8} r={0.05} />
          {[-0.62, 0, 0.62].map((cx, i) => <RBox key={i} size={[0.6, 0.14, 0.7]} pos={[-2.0 + cx, 0.52, -1.0]} map={tex.sofa} tile={0.7} r={0.05} />)}
          <RBox size={[1.9, 0.56, 0.2]} pos={[-2.0, 0.74, -1.43]} map={tex.sofa} tile={0.8} r={0.07} />
          {[-0.95, 0.95].map((ax, i) => <RBox key={i} size={[0.2, 0.52, 0.85]} pos={[-2.0 + ax, 0.5, -1.08]} map={tex.sofa} tile={0.8} r={0.07} />)}
          {[[-0.85, -0.6], [0.85, -0.6], [-0.85, -1.5], [0.85, -1.5]].map(([lx, lz], i) => <Cyl key={i} r={0.04} r2={0.03} h={0.1} pos={[-2.0 + lx, 0.04, lz]} color="#5a3b1f" seg={8} />)}
          <RBox size={[0.36, 0.34, 0.1]} pos={[-2.6, 0.78, -1.2]} rot={[0.2, 0, 0.35]} color="#e8a93a" r={0.05} rough={0.9} />
          {/* the door: frame, a dark hallway behind, the leaf swung open, a knob; a floor lamp; a plant */}
          <RBox size={[0.9, 2.1, 0.02]} pos={[2.55, 1.05, -1.6]} color="#5a4a68" r={0.005} />
          {[2.08, 3.02].map((dx, i) => <RBox key={i} size={[0.09, 2.2, 0.14]} pos={[dx, 1.1, -1.56]} color="#f6efe0" r={0.025} />)}
          <RBox size={[1.03, 0.09, 0.14]} pos={[2.55, 2.17, -1.56]} color="#f6efe0" r={0.025} />
          <RBox size={[0.9, 0.03, 0.5]} pos={[2.55, 0.015, -1.2]} map={tex.wood} color="#9a7a50" tile={0.3} r={0.01} />
          <RBox size={[0.1, 2.0, 0.05]} pos={[2.13, 1.05, -1.46]} map={tex.wood} tile={0.9} color="#c99a62" r={0.02} /><Ball r={0.03} pos={[2.14, 1.0, -1.42]} color="#e0b04a" rough={0.3} />
          <Cyl r={0.025} h={1.6} pos={[4.1, 0.85, -1.1]} color="#3b4a52" metal={0.5} seg={10} /><Cyl r={0.14} h={0.05} pos={[4.1, 0.03, -1.1]} color="#2f3b42" metal={0.5} seg={16} />
          <mesh position={[4.1, 1.75, -1.1]}><cylinderGeometry args={[0.16, 0.26, 0.34, 20, 1, true]} /><meshStandardMaterial color="#f6dfa8" emissive="#ffcf70" emissiveIntensity={0.9} side={THREE.DoubleSide} roughness={0.8} /></mesh>
          <pointLight position={[4.1, 1.7, -0.9]} intensity={1.4} distance={4} decay={2} color="#ffd9a0" />
          <Plant x={-3.0} z={-0.4} s={1.1} f={f} leaf={tex.leaf} />
          {/* the coffee table with the technician's toolbox, screwdrivers and a glass of tea */}
          <RBox size={[1.05, 0.06, 0.62]} pos={[-2.05, 0.46, 0.75]} map={tex.wood} tile={0.7} r={0.02} />
          {[[-0.47, -0.25], [0.47, -0.25], [-0.47, 0.25], [0.47, 0.25]].map(([lx, lz], i) => <Cyl key={i} r={0.035} r2={0.025} h={0.44} pos={[-2.05 + lx, 0.22, 0.75 + lz]} color="#5a3b1f" seg={8} />)}
          <RBox size={[0.52, 0.2, 0.3]} pos={[-2.2, 0.59, 0.72]} map={tex.toolbox} fit r={0.03} metal={0.3} rough={0.5} />
          <RBox size={[0.52, 0.03, 0.3]} pos={[-2.2, 0.71, 0.72]} color="#a82e23" r={0.012} metal={0.3} />
          <RBox size={[0.3, 0.025, 0.04]} pos={[-2.2, 0.78, 0.72]} color="#8f97a5" r={0.01} metal={0.7} />
          {[0, 1, 2].map((k) => <group key={k} position={[-1.78, 0.5, 0.66 + k * 0.07]} rotation={[0, 0.2 * k, 0]}><Cyl r={0.018} h={0.1} pos={[0, 0.0, 0]} rot={[0, 0, Math.PI / 2]} color={["#f2c230", "#2f6fa0", "#d9352a"][k]} seg={8} /><Cyl r={0.006} h={0.16} pos={[0.12, 0, 0]} rot={[0, 0, Math.PI / 2]} color="#c2c8cd" metal={0.8} seg={6} /></group>)}
          <Cyl r={0.045} r2={0.04} h={0.12} pos={[-1.7, 0.55, 0.9]} color="#c9741a" seg={14} rough={0.2} />
          {[0, 1, 2].map((i) => <Puff key={i} x={-1.7} y={0.62} z={0.9} t={t} at={streamAt(t, i, 3, 1.4)} dur={1.4} size={0.12} tex={tex.soft as THREE.CanvasTexture} rise={0.25} />)}
        </>
      ) : (
        <>
          {/* Bang Jaya's repair corner: a bench with an opened TV chassis, a multimeter, old remotes and a lamp; stacked old TVs; a sign; a stool */}
          <RBox size={[1.9, 0.07, 0.72]} pos={[-1.0, 0.85, -1.15]} map={tex.wood} tile={0.7} r={0.02} />
          {[[-0.88, -0.3], [0.88, -0.3], [-0.88, 0.3], [0.88, 0.3]].map(([lx, lz], i) => <Cyl key={i} r={0.04} r2={0.03} h={0.84} pos={[-1.0 + lx, 0.42, -1.15 + lz]} color="#5a3b1f" seg={8} />)}
          <RBox size={[0.7, 0.45, 0.4]} pos={[-1.3, 1.12, -1.15]} color="#3a3f48" r={0.04} />
          <RBox size={[0.6, 0.35, 0.02]} pos={[-1.3, 1.12, -0.94]} color="#2f8f4a" r={0.01} />
          {[0, 1, 2].map((k) => <RBox key={k} size={[0.1, 0.05, 0.03]} pos={[-1.5 + k * 0.2, 1.1 + 0.05 * (k % 2), -0.92]} color={["#d9352a", "#e8a93a", "#1d4ed8"][k]} r={0.01} />)}
          <RBox size={[0.22, 0.32, 0.08]} pos={[-0.55, 1.05, -0.95]} color="#f2c230" r={0.03} /><RBox size={[0.16, 0.08, 0.01]} pos={[-0.55, 1.12, -0.9]} color="#a8d8c8" r={0.005} />
          {[0, 1, 2].map((k) => <RBox key={k} size={[0.38, 0.04, 0.1]} pos={[-0.15 + 0.05 * k, 0.9 + 0.03 * k, -0.9 + 0.1 * k]} rot={[0, 0.3 * k, 0]} color={["#23262e", "#6b7280", "#b3342f"][k]} r={0.015} />)}
          <Cyl r={0.012} h={0.5} pos={[-1.9, 1.14, -1.3]} color="#3b4a52" seg={8} /><RBox size={[0.3, 0.04, 0.04]} pos={[-1.78, 1.38, -1.3]} color="#3b4a52" r={0.01} /><Ball r={0.05} pos={[-1.64, 1.34, -1.3]} color="#fff2b8" rough={0.3} />
          {[0, 1].map((k) => <group key={k} position={[2.6 + 0.12 * k, 0.4 + 0.62 * k, -1.2]}><RBox size={[0.78, 0.58, 0.55]} pos={[0, 0, 0]} color={k ? "#8a8f98" : "#6f757e"} r={0.05} /><RBox size={[0.5, 0.4, 0.02]} pos={[-0.08, 0.02, 0.28]} color="#10141a" r={0.04} rough={0.15} /><Ball r={0.02} pos={[0.28, 0.1, 0.285]} color="#c2c8cd" rough={0.3} /></group>)}
          <RBox size={[1.6, 0.4, 0.05]} pos={[0.4, 2.4, -1.55]} map={tex.flyer} fit r={0.03} />
          <Cyl r={0.2} r2={0.17} h={0.45} pos={[-0.2, 0.22, 0.6]} color="#b3342f" seg={16} rough={0.7} />
          <Plant x={3.8} z={-0.8} s={1.0} f={f} leaf={tex.leaf} pot="#2d7f86" />
        </>
      )}
    </group>
  );
};

const World: React.FC<{ t: number; f: number }> = ({ t, f }) => {
  const tex = useMemo(() => ({
    wood: painted(256, 256, woodTex("#b98250", 44)), wainA: painted(256, 256, woodTex("#4f9f7a", 48)), wainB: painted(256, 256, woodTex("#a8662e", 48)),
    wallA: painted(256, 256, stripedWall("#f3e3b3", "rgba(120,160,90,.22)")), wallB: painted(256, 256, stripedWall("#e48b4c", "rgba(255,230,180,.16)")),
    parqA: painted(256, 256, parquetTex("#c98f55", "#b4773f"), 7, 4), parqB: painted(256, 256, parquetTex("#8a5a32", "#764a28"), 7, 4),
    rug: painted(256, 256, rugTex), sofa: painted(128, 128, sofaTex("#2d7f86")), sofaB: painted(128, 128, sofaTex("#1d4ed8")), curtain: painted(128, 256, curtainTex),
    outside: painted(256, 256, outsideTex), flyer: painted(256, 340, flyerTex), toolbox: painted(256, 128, toolboxTex), tvOff: painted(256, 160, tvOffTex), tvOn: painted(256, 160, tvOnTex),
    art: painted(192, 128, artTex), clock: painted(128, 128, clockTex), calendar: painted(128, 160, calendarTex), remote: painted(256, 64, remoteTex), metal: painted(256, 256, metalTex),
    soft: painted(64, 64, softTex), leaf: painted(128, 256, leafTex),
  } as unknown as TexSet), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, -0.33, 0]}><planeGeometry args={[200, 120]} /><meshStandardMaterial color="#dbe9f0" roughness={1} /></mesh>
      <Room v="a" tex={tex} t={t} f={f} />
      <group position={[OB, 0, 0]}><Room v="b" tex={tex} t={t} f={f} /></group>
      {/* what the people hold */}
      <OnCast><Remote id="darto" t={t} tex={tex} /><Phone id="darto" t={t} />
      <Remote id="jayaB" t={t} tex={tex} /><Phone id="jayaB" t={t} />
      {(() => {
        const w = handAt("rina", "r", t), j = handAt("jaya", "l", t);
        return (
          <>
            {w && t >= 24.72 && t < 26.28 && <group position={[w.x - w.sg * 0.04, w.y, w.z]} scale={pop(t - 24.72)}><RBox size={[0.17, 0.12, 0.035]} pos={[0, 0, 0]} color="#7a4a22" r={0.03} rough={0.6} /><RBox size={[0.06, 0.03, 0.04]} pos={[0.0, 0.03, 0]} color="#e0b04a" r={0.01} metal={0.6} /></group>}
            {j && t >= 8.36 && t < 46.58 && <group position={[j.x, j.y + 0.12, j.z]} scale={pop(t - 8.36)}><RBox size={[0.36, 0.48, 0.015]} pos={[0, 0, 0]} map={tex.flyer} fit r={0.006} /></group>}
          </>
        );
      })()}
      {/* the old batteries fall out of the remote and roll; two new ones pop in and slide home */}
      {(() => {
        const h = handAt("darto", "l", 27.3), g = t - 27.3;
        if (!h || t < 27.3) return null;
        const y = Math.max(0.03, h.y - 4.2 * g * g), rollx = Math.min(0.25, 0.4 * Math.max(0, g - 0.45));
        const n = handAt("darto", "l", t);
        return (
          <>
            {[0, 1].map((k) => <Cyl key={k} r={0.03} h={0.1} pos={[h.x + 0.05 + 0.1 * k + rollx * (k ? 1.3 : 1), y, h.z + 0.05 * k]} rot={[0, 0, Math.PI / 2 + (g > 0.45 ? 0 : 0.5 * k)]} color={k ? "#7b8088" : "#8a8f98"} metal={0.5} seg={12} />)}
            {n && t >= 28.3 && t < 28.95 && [0, 1].map((k) => <Cyl key={k} r={0.03} h={0.1} pos={[n.x + 0.1 * k, n.y + 0.14 - 0.14 * prog(t, 28.6, 28.95), n.z]} rot={[0, 0, Math.PI / 2]} color={k ? "#f2c230" : "#35d29a"} metal={0.4} seg={12} />)}
          </>
        );
      })()}
      <Rings t={t} />
      <PhoneInsert t={t} /></OnCast>
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
  const hookA = t0 >= LOOP_AT ? 1 : t0 < 3.6 ? 1 : t0 < 3.98 ? 1 - (t0 - 3.6) / 0.38 : 0;
  const actors = ACTORS.map((a) => {
    const s = stateOf(a, t);
    if (!s) return null;
    return <StickHero key={a.id} pos={V(s.x, 0, s.z)} expr={s.expr} arms={s.arms} f={f} outfit={a.o} height={s.h} hop={s.hop} flip={s.flip} rig={s.rig} talk={s.talk} breath={0} />;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#cfe3ee" }}>
      <ThreeCanvas width={FRAME.width} height={FRAME.height} shadows camera={{ fov: 40, near: 0.05, far: 130, position: HOOK.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={["#cfe3ee"]} />
        <fog attach="fog" args={["#cfe3ee", 16, 70]} />
        <hemisphereLight args={["#cfe4ff", "#d8b878", 1.0]} />
        <Sun cam={cam} hot={0.3} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={0.35} />
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
