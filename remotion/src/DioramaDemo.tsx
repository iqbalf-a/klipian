/* Style test (2026-11-21): "Kenapa kita lapar tengah malam", in the 3D-world + 2D-cast look ian asked to try in three.js.
   A lit kitchen diorama at night (pendant lamp, moonlight, fog, painted canvas textures, depth of field and bloom from three's own
   addons) with a flat 2D stick character card drawn sharp on top. The picture follows ian's Google AI Studio narration
   (word timings in dioramaWords.json from faster-whisper; the voice itself is not kept in the repo): one shot per sentence, one caption word at a time,
   number pills on their word (B45), and the last shot lands on the first shot's framing so the video loops. Not used by any video;
   A ricks video is rendered with its voice by scripts/ricksRender.mjs. The engine and the stick cast are the ricks kit (src/ricks/kit.tsx, B46). */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { FRAME } from "./tokens.ts";
import { RicksCamera, RicksPost, StickHero, TBox, Pills, WordCaption, camAt, keyed, painted, readWords, rnd, stepAt, V, type Arms, type Cam, type Expr, type Pill, type Shot } from "./ricks/kit.tsx";
import WORDS from "./dioramaWords.json";

const FPS = 30;
export const DIORAMA_DEMO_SECONDS = 43.28;
export const DIORAMA_DEMO_FRAMES = Math.round(DIORAMA_DEMO_SECONDS * FPS);
const NIGHT = "#1d2a4a";
const HERO = new THREE.Vector3(-0.6, 0, 0.35);           // where the character stands (soles)
const FACE = new THREE.Vector3(-0.6, 1.3, 0.35);
const CLOCK = new THREE.Vector3(-1.05, 2.4, -1.47);

// ---------- the script: shots, faces, the fridge door, the clock, pills -------------------------------------------------------------
const HOOK: Cam = { pos: V(-0.4, 1.3, 3.1), look: V(-0.75, 1.55, 0) };
const HOOK_END: Cam = { pos: V(-0.45, 1.3, 2.8), look: V(-0.75, 1.57, 0) };
const WIDE: Cam = { pos: V(0.3, 1.2, 4.8), look: V(-0.95, 1.2, -0.5) };
const SHOTS: Shot[] = [
  { from: 0, a: HOOK, b: HOOK_END },                                                                       // Jam dua belas malam, perutmu demo.
  { from: 3.05, a: { pos: V(-0.55, 1.3, 1.7), look: FACE }, b: { pos: V(-0.6, 1.3, 1.25), look: FACE } },   // Intip yuk!
  { from: 4.4, a: WIDE, b: { pos: V(0.15, 1.2, 4.3), look: V(-1.0, 1.15, -0.5) } },                        // siang tadi ... pintu toko
  { from: 11.2, a: { pos: V(-0.4, 1.3, 2.0), look: FACE }, b: { pos: V(-0.85, 2.05, 0.9), look: CLOCK } },  // tenang ... punya jam sendiri
  { from: 15.8, a: { pos: V(-0.95, 2.2, 0.75), look: V(-1.05, 2.25, -1.47) }, b: { pos: V(-0.97, 2.2, 0.45), look: V(-1.05, 2.25, -1.47) } }, // jam delapan malam / pagi
  { from: 23.0, a: { pos: V(0.25, 1.25, 3.0), look: V(-0.45, 1.3, 0) }, b: { pos: V(0.0, 1.27, 2.55), look: V(-0.5, 1.3, 0) } }, // begadang ... persen
  { from: 34.6, a: WIDE, b: HOOK },                                                                        // jadi makin lama ... jam dua belas malam: ends on the hook framing (loop)
];
const FACES: [number, Expr, Arms][] = [
  [0, "hungry", "belly"], [3.05, "grin", "wave"], [4.4, "sly", "down"], [8.3, "hungry", "belly"], [11.2, "calm", "down"],
  [13.5, "calm", "point"], [15.8, "puzzled", "down"], [23.0, "sleepy", "down"], [30.2, "shocked", "belly"], [34.6, "sleepy", "down"],
  [37.0, "hungry", "belly"],
];
/** The fridge door, 0 closed .. 1 open: opened and shut twice on "dibuka tutup kayak pintu toko", and open again on "kebuka lagi". */
const DOOR: [number, number][] = [[0, 0], [9.0, 0], [9.25, 1], [9.55, 0], [9.95, 1], [10.3, 0], [39.8, 0], [40.2, 1], [43.28, 1]];
/** The clock in hours (0 = 12:00): midnight, a sweep to 8 (evening), on to 8 (morning), back to just before midnight, midnight on "dua belas". */
const CLOCK_KEYS: [number, number][] = [[0, 0], [18.9, 0], [19.5, 8], [21.5, 8], [22.1, 20], [23.0, 23.8], [41.8, 23.8], [42.3, 24]];

/** Number pills (B45): every number the voice says is on screen when it is said. */
const PILLS: Pill[] = [
  { at: 19.24, until: 23.0, text: "20.00 lapar PALING TINGGI", key: "20.00", color: "#ff6b3d", y: 330 },
  { at: 21.72, until: 23.0, text: "08.00 lapar paling rendah", key: "08.00", color: "#5fb3ff", y: 470 },
  { at: 26.7, until: 34.6, text: "tidur 4 jam × 2 malam", key: "4 jam × 2 malam", color: "#e8a400", y: 330 },
  { at: 30.3, until: 34.6, text: "hormon lapar +28%", key: "+28%", color: "#ff6b3d", y: 470 },
  { at: 33.46, until: 34.6, text: "hormon kenyang −18%", key: "−18%", color: "#5fb3ff", y: 610 },
];

// ---------- painted textures ---------------------------------------------------------------------------------------------------
const planks = (c: CanvasRenderingContext2D) => {
  const cols = ["#b77a4a", "#a86d40", "#c08553", "#9f6639"];
  for (let i = 0; i < 8; i++) {
    c.fillStyle = cols[i % 4]; c.fillRect(0, i * 64, 512, 64);
    c.fillStyle = "rgba(60,30,10,.35)"; c.fillRect(0, i * 64 + 61, 512, 3);
    c.fillRect(((i * 197) % 400) + 40, i * 64, 3, 64);
    for (let k = 0; k < 6; k++) { c.fillStyle = "rgba(255,230,200,.08)"; c.fillRect(rnd(i * 9 + k) * 480, i * 64 + 10 + rnd(k + i) * 40, 30 + rnd(k) * 60, 3); }
  }
};
const tiles = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#e9e1cf"; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    c.fillStyle = (x + y) % 2 ? "#dfe7e4" : "#eef0e6"; c.fillRect(x * 64 + 3, y * 64 + 3, 58, 58);
    c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(x * 64 + 8, y * 64 + 8, 20, 5);
  }
};
const plaster = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#5f86a8"; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${rnd(i) > .5 ? "255,255,255" : "20,40,70"},.06)`; c.beginPath(); c.arc(rnd(i * 3) * 256, rnd(i * 7) * 256, 6 + rnd(i * 5) * 20, 0, 7); c.fill(); }
};
const cabinet = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#e07b4f"; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = "#a6522f"; c.lineWidth = 8; c.strokeRect(18, 18, 220, 220);
  c.fillStyle = "#f6d27a"; c.fillRect(110, 40, 36, 12);
};
/** The inside of the fridge: shelves with a bottle, a cake slice, eggs, a jar and cheese. */
const fridgeInside = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#eef7f8"; c.fillRect(0, 0, 256, 512);
  c.fillStyle = "#c9dde0"; for (const y of [130, 260, 390]) c.fillRect(0, y, 256, 10);
  c.fillStyle = "#3f9f6f"; c.fillRect(30, 40, 34, 90); c.fillRect(40, 25, 14, 18);
  c.fillStyle = "#f3c6d6"; c.beginPath(); c.moveTo(120, 128); c.lineTo(220, 128); c.lineTo(220, 80); c.lineTo(120, 100); c.fill();
  c.fillStyle = "#fff3dc"; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(40 + i * 34, 238, 14, 18, 0, 0, 7); c.fill(); }
  c.fillStyle = "#e0573f"; c.fillRect(150, 300, 60, 90); c.fillStyle = "#f4f0e6"; c.fillRect(146, 292, 68, 14);
  c.fillStyle = "#f6d27a"; c.fillRect(30, 340, 90, 50);
};
const clockFace = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#fbf6ea"; c.beginPath(); c.arc(128, 128, 120, 0, 7); c.fill();
  c.strokeStyle = "#2b2b33"; c.lineWidth = 12; c.stroke();
  c.fillStyle = "#2b2b33";
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.save(); c.translate(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); c.rotate(a); c.fillRect(-4, -12, 8, i % 3 ? 14 : 24); c.restore(); }
};
const glowTex = () => painted(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,235,180,1)"); g.addColorStop(.3, "rgba(255,200,120,.35)"); g.addColorStop(1, "rgba(255,180,90,0)");
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
});

// ---------- the character card (original design: round head, hair tuft, striped mustard shirt, stick limbs) -------------------------
const Kitchen: React.FC<{ t: number }> = ({ t }) => {
  const tex = useMemo(() => ({ floor: painted(512, 512, planks), tiles: painted(256, 256, tiles), wall: painted(256, 256, plaster), cab: painted(256, 256, cabinet), glow: glowTex(), inside: painted(256, 512, fridgeInside), clock: painted(256, 256, clockFace) }), []);
  const floorMap = useMemo(() => { const t2 = tex.floor.clone(); t2.needsUpdate = true; t2.repeat.set(3, 3); return t2; }, [tex]);
  const door = keyed(DOOR, t), h = keyed(CLOCK_KEYS, t);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[9, 9]} /><meshStandardMaterial map={floorMap} roughness={0.9} /></mesh>
      <TBox size={[9, 4, 0.2]} pos={[0, 2, -1.6]} map={tex.wall} tile={1.2} />
      <TBox size={[0.2, 4, 6]} pos={[-2.2, 2, 1.2]} map={tex.wall} tile={1.2} />
      <TBox size={[3.2, 0.8, 0.05]} pos={[0.2, 1.3, -1.48]} map={tex.tiles} tile={0.5} />
      <TBox size={[3.2, 0.9, 0.6]} pos={[0.2, 0.45, -1.15]} map={tex.cab} tile={0.6} />
      <TBox size={[3.3, 0.06, 0.66]} pos={[0.2, 0.93, -1.14]} color="#7a4b2c" rough={0.6} />
      <TBox size={[0.6, 0.04, 0.45]} pos={[0.9, 0.98, -1.15]} color="#2c2f38" rough={0.4} />
      <mesh position={[0.9, 1.1, -1.15]} castShadow><cylinderGeometry args={[0.16, 0.14, 0.22, 24]} /><meshStandardMaterial color="#c9473b" roughness={0.35} metalness={0.2} /></mesh>
      {/* a shelf with jars, a plant on the counter */}
      <TBox size={[1.2, 0.05, 0.25]} pos={[0.75, 2.05, -1.38]} color="#7a4b2c" rough={0.6} />
      {[0.35, 0.6, 0.85].map((x, i) => <mesh key={x} position={[x, 2.17, -1.38]} castShadow><cylinderGeometry args={[0.08, 0.08, 0.2, 20]} /><meshStandardMaterial color={["#f2c14e", "#e86a4a", "#7cc6a4"][i]} roughness={0.3} /></mesh>)}
      <mesh position={[1.25, 2.22, -1.38]} castShadow><sphereGeometry args={[0.14, 16, 12]} /><meshStandardMaterial color="#4f9b5a" roughness={0.8} /></mesh>
      <mesh position={[-0.05, 1.05, -1.2]} castShadow><cylinderGeometry args={[0.08, 0.06, 0.18, 16]} /><meshStandardMaterial color="#d9774c" roughness={0.7} /></mesh>
      <mesh position={[-0.05, 1.24, -1.2]} castShadow><sphereGeometry args={[0.13, 14, 10]} /><meshStandardMaterial color="#5aa865" roughness={0.8} /></mesh>
      {/* the clock: a painted face and two hands that turn */}
      <mesh position={CLOCK.toArray()} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.3, 0.3, 0.05, 40]} /><meshStandardMaterial color="#2b2b33" roughness={0.5} /></mesh>
      <mesh position={[CLOCK.x, CLOCK.y, CLOCK.z + 0.03]}><circleGeometry args={[0.28, 40]} /><meshStandardMaterial map={tex.clock} roughness={0.6} /></mesh>
      <group position={[CLOCK.x, CLOCK.y, CLOCK.z + 0.04]} rotation={[0, 0, -(h / 12) * Math.PI * 2]}><mesh position={[0, 0.07, 0]}><boxGeometry args={[0.03, 0.15, 0.01]} /><meshStandardMaterial color="#2b2b33" /></mesh></group>
      <group position={[CLOCK.x, CLOCK.y, CLOCK.z + 0.05]} rotation={[0, 0, -h * Math.PI * 2]}><mesh position={[0, 0.1, 0]}><boxGeometry args={[0.02, 0.21, 0.01]} /><meshStandardMaterial color="#d94b3a" /></mesh></group>
      {/* the fridge: body, a lit inside, and a door hinged on its right edge */}
      <TBox size={[0.8, 1.9, 0.7]} pos={[-1.6, 0.95, -1.1]} color="#cfe3e6" rough={0.4} />
      <mesh position={[-1.6, 0.97, -0.745]}><planeGeometry args={[0.7, 1.75]} /><meshStandardMaterial map={tex.inside} emissive="#ffffff" emissiveMap={tex.inside} emissiveIntensity={0.15 + 0.22 * door} roughness={0.8} /></mesh>
      <group position={[-1.2, 0.95, -0.72]} rotation={[0, door * 1.75, 0]}>
        <TBox size={[0.8, 1.88, 0.06]} pos={[-0.4, 0, 0]} color="#d6e9ec" rough={0.4} />
        <TBox size={[0.04, 0.4, 0.05]} pos={[-0.72, 0.4, 0.05]} color="#8aa0a6" rough={0.3} />
      </group>
      <pointLight position={[-1.6, 1.1, -0.4]} intensity={1.3 * door} distance={3.5} decay={2} color="#cfe9ff" />
      {/* window in the left wall: emissive night panes with a frame */}
      <TBox size={[0.05, 1.1, 1.3]} pos={[-2.08, 2.0, 0.6]} color="#0e1a33" emissive="#3e6db5" />
      <TBox size={[0.08, 1.2, 0.06]} pos={[-2.05, 2.0, 0.6]} color="#f2ead8" />
      <TBox size={[0.08, 0.06, 1.4]} pos={[-2.05, 2.0, 0.6]} color="#f2ead8" />
      {/* a small table with a mug, foreground right */}
      <TBox size={[0.9, 0.06, 0.9]} pos={[1.45, 0.75, 0.9]} color="#8c5a35" rough={0.6} />
      <TBox size={[0.08, 0.75, 0.08]} pos={[1.1, 0.37, 0.55]} color="#6d4427" />
      <TBox size={[0.08, 0.75, 0.08]} pos={[1.8, 0.37, 1.25]} color="#6d4427" />
      <mesh position={[1.35, 0.85, 0.85]} castShadow><cylinderGeometry args={[0.06, 0.055, 0.14, 20]} /><meshStandardMaterial color="#3f8f7a" roughness={0.5} /></mesh>
      {/* pendant lamp: cord, shade, bulb, light cone, glow */}
      <mesh position={[0.2, 3.1, -0.2]}><cylinderGeometry args={[0.008, 0.008, 1.2, 6]} /><meshBasicMaterial color="#111" /></mesh>
      <mesh position={[0.2, 2.42, -0.2]}><coneGeometry args={[0.32, 0.26, 32, 1, true]} /><meshStandardMaterial color="#2d6b5e" side={THREE.DoubleSide} roughness={0.5} /></mesh>
      <mesh position={[0.2, 2.33, -0.2]}><sphereGeometry args={[0.07, 16, 12]} /><meshBasicMaterial color="#fff1c8" toneMapped={false} /></mesh>
      <mesh position={[0.2, 1.33, -0.45]}><coneGeometry args={[0.7, 2.0, 40, 1, true]} /><meshBasicMaterial color="#ffd89a" transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh>
      <sprite position={[0.2, 2.3, -0.15]} scale={[0.8, 0.8, 1]}><spriteMaterial map={tex.glow} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></sprite>
    </group>
  );
};

const READ = readWords(WORDS);
const OUTFIT = { shirt: "#e8b33c", stripe: "#c4852a" };

export const DioramaDemo: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const cam = camAt(SHOTS, t, DIORAMA_DEMO_SECONDS);
  const [, expr, arms] = stepAt(FACES, t);
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      <ThreeCanvas shadows width={FRAME.width} height={FRAME.height} camera={{ fov: 40, near: 0.05, far: 60, position: HOOK.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={[NIGHT]} />
        <fog attach="fog" args={[NIGHT, 6, 16]} />
        <hemisphereLight args={["#6f8fd0", "#2a1e2a", 0.55]} />
        <directionalLight position={[-6, 4, 1.5]} intensity={1.1} color="#8fb1ff" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} />
        <spotLight position={[0.2, 2.3, -0.2]} target-position={[0.2, 0, -0.2]} angle={0.95} penumbra={0.7} decay={1.6} distance={8} intensity={9} color="#ffc983" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005} />
        <pointLight position={[0.2, 2.2, -0.2]} intensity={1.4} distance={5} decay={2} color="#ffb870" />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} />
        <Kitchen t={t} />
        <StickHero pos={HERO} expr={expr} arms={arms} f={f} outfit={OUTFIT} />
      </ThreeCanvas>
      <Pills pills={PILLS} t={t} />
      <WordCaption words={READ} t={t} />
    </AbsoluteFill>
  );
};
