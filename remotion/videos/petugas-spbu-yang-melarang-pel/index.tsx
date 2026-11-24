/* Penjual/Petugas SPBU yang Melarang Pelanggan Menekan Nozzle Lagi (look ricks, B46 + B47 dongeng)
   Dongeng di SPBU: Pak Rudi, petugas SPBU berpengalaman, selalu melarang pelanggan memencet tuas nozzle lagi setelah bunyi klik.
   Hendra rekannya mengira Pak Rudi berlebihan, sampai saat pelanggan nekat dan bensin menyembur tumpah di lantai.
   Fakta sains: nozzle SPBU menggunakan efek Venturi mekanis murni tanpa sensor elektronik.
   Aliran bensin berkecepatan tinggi menciptakan tekanan rendah (vakum) yang menghisap udara melalui lubang kecil di ujung corong.
   Saat bensin naik menutup lubang tersebut, aliran udara terputus, kevakuman melonjak tajam menarik diafragma,
   yang memicu tuas terlepas dan katup pegas menutup seketika dengan bunyi klik.
*/
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FRAME } from "../../src/tokens.ts";
import {
  RicksCamera,
  RicksPost,
  StickHero,
  TBox,
  Pills,
  WordCaption,
  camAt,
  painted,
  readWords,
  rnd,
  stepAt,
  V,
  type Arms,
  type Cam,
  type Expr,
  type Outfit,
  type Pill,
  type Shot,
} from "../../src/ricks/kit.tsx";
import type { StoryT } from "../../src/schema.ts";
import storyJson from "./story.json";
import WORDS from "./words.json";

export const story = storyJson as unknown as StoryT;
const FPS = 30;
const TOTAL = 49.48;
const LOOP_AT = 48.78;
const C = (px: number, py: number, pz: number, lx: number, ly: number, lz: number): Cam => ({
  pos: V(px, py, pz),
  look: V(lx, ly, lz),
});

// ---------- People & Outfits (B46 i: distinct outfits, heads white) -----------------------
const RUDI: Outfit = {
  shirt: "#e07a2f",
  stripe: "#ffffff",
  pattern: "stripe",
  hat: "cap",
  hatColor: "#d9473b",
  mustache: true,
  body: "wide",
  nose: "big",
};
const HENDRA: Outfit = {
  shirt: "#2a6fbd",
  stripe: "#ffffff",
  pattern: "collar",
  hair: "spiky",
  hairColor: "#17141c",
  nose: "dot",
};
const CUSTOMER: Outfit = {
  shirt: "#3d8c4a",
  stripe: "#255c30",
  pattern: "plain",
  hat: "hardhat",
  hatColor: "#f2c230",
  hair: "bald",
  blush: true,
};

// Positions: Rudi at x=-0.6 (near pump), Hendra at x=0.7 (beside scooter), Customer at x=1.5
const RUDI_AT = V(-0.6, 0, 0.2);
const HENDRA_AT = V(0.7, 0, 0.4);
const CUST_AT = V(1.5, 0, 0.5);

// ---------- Camera Shots (one per sentence, alternates close & wide, ends at hook) --------
const HOOK = C(-0.4, 1.3, 2.7, -0.6, 1.25, 0.2);
const SHOTS: Shot[] = [
  // 1. Hook (0.0 - 2.52s): Pak Rudi larang pelanggan pencet nozzle
  { from: 0.0, a: HOOK, b: C(-0.45, 1.3, 2.5, -0.6, 1.25, 0.2) },
  // 2. Dunia (2.52 - 9.94s): Setiap kali nozzle berbunyi klik... Hendra mikir lebay
  { from: 2.52, a: C(0.2, 1.45, 4.8, 0.1, 1.15, 0.1), b: C(0.4, 1.4, 4.2, 0.3, 1.2, 0.2) },
  // 3. Ragu (9.94 - 15.86s): Suatu hari pelanggan komplain. Hendra: tekan lagi... Rudi menggeleng
  { from: 9.94, a: C(1.1, 1.35, 3.2, 1.1, 1.25, 0.4), b: C(0.1, 1.35, 3.2, -0.2, 1.25, 0.3) },
  // 4. Petunjuk (15.86 - 23.12s): Nozzle berhenti bukan karena habis, lubang kecil tertutup bensin
  { from: 15.86, a: C(-0.35, 1.15, 2.0, -0.6, 1.0, 0.1), b: C(-0.45, 1.1, 1.6, -0.6, 0.95, 0.1) },
  // 5. Puncak (23.12 - 31.06s): Hendra tekan lagi! Bensin menyembur... Rudi sudah siap lap
  { from: 23.12, a: C(0.6, 1.35, 3.6, 0.5, 1.15, 0.3), b: C(0.2, 1.5, 4.9, 0.3, 1.1, 0.2) },
  // 6. Sains (31.06 - 46.56s): Nozzle pakai efek Venturi... mekanika fluida murni
  { from: 31.06, a: C(-0.5, 1.35, 2.6, -0.5, 1.3, 0.0), b: C(-0.5, 1.3, 2.1, -0.5, 1.25, -0.1) },
  // 7. Akhir (46.56 - 48.78s): Hendra mengelap lantai sambil mengangguk pelan
  { from: 46.56, a: C(0.4, 0.9, 3.2, 0.3, 0.8, 0.3), b: C(0.0, 1.1, 3.4, -0.2, 1.1, 0.2) },
  // 8. Outro (48.78 - 49.48s): Camera flies back to hook framing (loop)
  { from: 48.78, a: C(0.0, 1.1, 3.4, -0.2, 1.1, 0.2), b: HOOK },
];

// ---------- Character Expressions & Arm Poses ---------------------------------------------
const RUDI_FACES: [number, Expr, Arms][] = [
  [0, "calm", "point"],
  [2.52, "grin", "down"],
  [5.1, "calm", "up"],
  [9.94, "calm", "hips"],
  [14.64, "sly", "down"],
  [15.86, "calm", "point"],
  [23.12, "shocked", "down"],
  [28.22, "calm", "down"],
  [31.06, "calm", "point"],
  [46.56, "grin", "down"],
  [48.78, "calm", "point"],
];

const HENDRA_FACES: [number, Expr, Arms][] = [
  [0, "calm", "down"],
  [2.52, "puzzled", "shrug"],
  [7.4, "sly", "down"],
  [9.94, "grin", "point"],
  [11.94, "grin", "wave"],
  [15.86, "puzzled", "down"],
  [23.12, "grin", "point"],
  [25.18, "shocked", "up"],
  [31.06, "puzzled", "down"],
  [46.56, "calm", "down"],
  [48.78, "calm", "down"],
];

// Quoted speech lip sync (B46 n): Hendra says: "Santai, Pak, tekan lagi, biar penuh beneran." (12.36 to 14.26)
const TALK_WINDOWS: [string, number, number][] = [["hendra", 12.36, 14.26]];

// ---------- Overlays: Pills (B45) & Top Headline at Frame 0 --------------------------------
const PILLS: Pill[] = [
  { at: 3.58, until: 5.6, text: "klik: langsung berhenti", key: "klik", color: "#ffb02e", y: 340 },
  { at: 18.4, until: 21.0, text: "lubang sensor kecil", key: "lubang sensor", color: "#5fb3ff", y: 340 },
  { at: 25.18, until: 28.2, text: "bensin tumpah meluber!", key: "tumpah meluber", color: "#ff3b2e", y: 340 },
  { at: 31.68, until: 35.0, text: "efek Venturi fluida", key: "efek Venturi", color: "#35d29a", y: 340 },
  { at: 35.36, until: 39.0, text: "vakum hisap udara", key: "vakum", color: "#5fb3ff", y: 480 },
  { at: 42.54, until: 46.0, text: "diafragma lepas pengunci", key: "diafragma", color: "#ffb02e", y: 340 },
];

const HOOK_LINES: { text: string; key?: string }[] = [
  { text: "Pak Rudi ", key: "larang" },
  { text: "pencet ", key: "nozzle lagi!" },
];

// ---------- SPBU World Textures -----------------------------------------------------------
const concreteFloor = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#8e9196";
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    c.fillStyle = `rgba(${rnd(i) > 0.5 ? "255,255,255" : "0,0,0"},.08)`;
    c.fillRect(rnd(i * 3) * 256, rnd(i * 7) * 256, 3 + rnd(i * 5) * 6, 3 + rnd(i * 11) * 6);
  }
  // Yellow safety strip at edge
  c.fillStyle = "#f5c518";
  c.fillRect(0, 220, 256, 36);
  c.fillStyle = "#222222";
  for (let x = 0; x < 256; x += 48) {
    c.beginPath();
    c.moveTo(x, 220);
    c.lineTo(x + 24, 256);
    c.lineTo(x + 12, 256);
    c.lineTo(x - 12, 220);
    c.fill();
  }
};

const pumpTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#f4f4f6";
  c.fillRect(0, 0, 256, 512);
  // Red brand bar across top
  c.fillStyle = "#d32f2f";
  c.fillRect(0, 0, 256, 90);
  // Digital meter panel
  c.fillStyle = "#1e2229";
  c.fillRect(24, 110, 208, 140);
  c.fillStyle = "#39ff14";
  c.font = "bold 28px monospace";
  c.fillText("Rp 50.000", 40, 160);
  c.font = "bold 22px monospace";
  c.fillText("5.00 L", 40, 210);
  // Fuel grade stickers
  c.fillStyle = "#1976d2";
  c.fillRect(30, 280, 85, 45);
  c.fillStyle = "#388e3c";
  c.fillRect(140, 280, 85, 45);
  c.fillStyle = "#ffffff";
  c.font = "bold 18px Arial";
  c.fillText("RON92", 42, 310);
  c.fillText("RON90", 152, 310);
};

const canopyRoof = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#eceff1";
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = "#cfd8dc";
  for (let x = 0; x < 256; x += 64) c.fillRect(x, 0, 12, 256);
  // Red accent border
  c.fillStyle = "#c62828";
  c.fillRect(0, 0, 256, 28);
};

const diagramTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#171d28";
  c.fillRect(0, 0, 512, 320);
  c.strokeStyle = "#4da3ff";
  c.lineWidth = 6;
  // Venturi tube outline (narrowing)
  c.beginPath();
  c.moveTo(20, 90);
  c.lineTo(170, 90);
  c.lineTo(230, 130);
  c.lineTo(290, 130);
  c.lineTo(350, 90);
  c.lineTo(490, 90);
  c.stroke();
  c.beginPath();
  c.moveTo(20, 230);
  c.lineTo(170, 230);
  c.lineTo(230, 190);
  c.lineTo(290, 190);
  c.lineTo(350, 230);
  c.lineTo(490, 230);
  c.stroke();
  // Sensing port tube going up to diaphragm
  c.strokeStyle = "#ffb02e";
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(260, 130);
  c.lineTo(260, 40);
  c.stroke();
  // Diaphragm indicator
  c.fillStyle = "#ff5722";
  c.beginPath();
  c.ellipse(260, 36, 44, 12, 0, 0, Math.PI * 2);
  c.fill();
  // Labels
  c.fillStyle = "#ffffff";
  c.font = "bold 24px Arial";
  c.fillText("EFEK VENTURI", 170, 300);
  c.fillStyle = "#ffb02e";
  c.font = "bold 18px Arial";
  c.fillText("DIAFRAGMA", 205, 25);
  c.fillStyle = "#39ff14";
  c.font = "16px Arial";
  c.fillText("Tekanan Rendah (Vakum)", 150, 165);
};

// ---------- 3D SPBU Set Component ---------------------------------------------------------
const SpbuWorld: React.FC<{ t: number; f: number }> = ({ t }) => {
  const tex = useMemo(
    () => ({
      floor: painted(256, 256, concreteFloor, 6, 6),
      pump: painted(256, 512, pumpTex),
      canopy: painted(256, 256, canopyRoof, 4, 1),
      diagram: painted(512, 320, diagramTex),
    }),
    [],
  );

  // Spill puddle grows on floor during 'puncak' beat (after t = 25.18s)
  const spillScale = t < 25.18 ? 0.001 : t < 27.5 ? (t - 25.18) / 2.32 : t < 46.56 ? 1.0 : Math.max(0.01, 1 - (t - 46.56) / 2.0);

  // Diagram visibility in 'sains' beat (t between 31.06 and 46.56)
  const showDiagram = t >= 31.06 && t < 46.56;

  return (
    <group>
      {/* Concrete forecourt ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 18]} />
        <meshStandardMaterial map={tex.floor} roughness={0.88} />
      </mesh>

      {/* Fuel spill puddle */}
      <mesh
        position={[0.7, 0.015, 0.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[spillScale * 1.6, spillScale * 1.1, 1]}
      >
        <circleGeometry args={[0.7, 32]} />
        <meshStandardMaterial color="#4a3e2a" roughness={0.2} metalness={0.6} transparent opacity={0.85} />
      </mesh>

      {/* Main Gas Pump Dispenser (Hero prop at center-left x=-1.2) */}
      <group position={[-1.2, 0, 0]}>
        {/* Pump island concrete plinth */}
        <TBox size={[1.4, 0.22, 2.8]} pos={[0, 0.11, 0]} color="#b0bec5" />
        {/* Pump dispenser housing */}
        <TBox size={[0.8, 2.2, 0.9]} pos={[0, 1.25, 0]} map={tex.pump} tile={1.2} />
        {/* Protection bollards */}
        <mesh position={[0, 0.45, 1.2]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.9, 16]} />
          <meshStandardMaterial color="#ffcc00" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.45, -1.2]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.9, 16]} />
          <meshStandardMaterial color="#ffcc00" roughness={0.5} />
        </mesh>
      </group>

      {/* Overhead Canopy Roof */}
      <TBox size={[14, 0.35, 10]} pos={[0, 4.2, 0]} map={tex.canopy} tile={2} />
      {/* Supporting pillars */}
      <mesh position={[-3.8, 2.1, 2.5]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 4.2, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position={[3.8, 2.1, 2.5]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 4.2, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>

      {/* Customer's scooter parked at x=1.6 */}
      <group position={[1.6, 0, 0.5]} rotation={[0, -0.4, 0]}>
        {/* Frame & body */}
        <TBox size={[1.1, 0.4, 0.3]} pos={[0, 0.45, 0]} color="#1565c0" />
        <TBox size={[0.45, 0.35, 0.28]} pos={[-0.2, 0.75, 0]} color="#212121" />
        {/* Handlebars */}
        <TBox size={[0.08, 0.5, 0.08]} pos={[0.38, 0.85, 0]} color="#9e9e9e" />
        {/* Wheels */}
        {[-0.45, 0.45].map((wx) => (
          <mesh key={wx} position={[wx, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.1, 20]} />
            <meshStandardMaterial color="#1f1f1f" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Science explanation board floating in space during 'sains' beat */}
      {showDiagram && (
        <group position={[-0.5, 1.4, 0.7]} rotation={[0, 0.1, 0]}>
          <TBox size={[1.7, 1.05, 0.06]} pos={[0, 0, 0]} color="#111722" />
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[1.65, 1.0]} />
            <meshBasicMaterial map={tex.diagram} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* Lighting: Sun overhead + cool sky fill */}
      <directionalLight
        position={[4, 9, 5]}
        intensity={1.2}
        color="#fff4d4"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <ambientLight intensity={0.45} color="#dbe6ff" />
      <pointLight position={[0, 3.8, 0]} intensity={1.8} distance={8} color="#ffffff" />
    </group>
  );
};

// Lip sync helper for StickHero
const isSpeaking = (who: string, t: number) =>
  TALK_WINDOWS.some(([person, start, end]) => person === who && t >= start && t <= end);

const getTalkVal = (who: string, t: number) => {
  if (!isSpeaking(who, t)) return 0;
  return 0.3 + 0.7 * Math.abs(Math.sin(t * 18));
};

// Word timings for caption
const READ_WORDS = [
  ...readWords(WORDS as { w: string; a: number; b: number }[]),
  { w: "Pak", a: 48.78, b: 49.48 },
];

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = () => {
  const f = useCurrentFrame();
  const t0 = f / FPS;
  // Loop back: after LOOP_AT, camera & scene hold the first frame framing
  const t = t0 >= LOOP_AT ? 0.02 : t0;

  const cam = camAt(SHOTS, t, TOTAL);
  const [, rudiExpr, rudiArms] = stepAt(RUDI_FACES, t);
  const [, hendraExpr, hendraArms] = stepAt(HENDRA_FACES, t);

  // Hook headline text fade: visible in first beat (0 to 2.52s) and fades back in at loop outro
  const hookA = t0 >= LOOP_AT ? 1 : t0 < 2.1 ? 1 : t0 < 2.52 ? 1 - (t0 - 2.1) / 0.42 : 0;

  // Hendra crouching / bending while cleaning the floor in 'akhir' beat
  const isCleaning = t >= 46.56 && t < 48.78;

  return (
    <AbsoluteFill style={{ backgroundColor: "#2b303c" }}>
      <ThreeCanvas
        shadows
        width={FRAME.width}
        height={FRAME.height}
        camera={{ fov: 40, near: 0.05, far: 80, position: HOOK.pos.toArray() as [number, number, number] }}
      >
        <color attach="background" args={["#2b303c"]} />
        <fog attach="fog" args={["#2b303c", 8, 26]} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={0.3} />
        <SpbuWorld t={t} f={f} />

        {/* Pak Rudi (Attendant 1) */}
        <StickHero
          pos={RUDI_AT}
          expr={rudiExpr}
          arms={rudiArms}
          f={f}
          outfit={RUDI}
          talk={getTalkVal("rudi", t)}
          act={isSpeaking("rudi", t) ? 1 : 0}
        />

        {/* Hendra (Attendant 2) */}
        {isCleaning ? (
          <group position={[HENDRA_AT.x, -0.35, HENDRA_AT.z]}>
            <StickHero
              pos={V(0, 0, 0)}
              expr="calm"
              arms="down"
              f={f}
              outfit={HENDRA}
              height={1.35}
              lean={0.25}
            />
          </group>
        ) : (
          <StickHero
            pos={HENDRA_AT}
            expr={hendraExpr}
            arms={hendraArms}
            f={f}
            outfit={HENDRA}
            talk={getTalkVal("hendra", t)}
            act={isSpeaking("hendra", t) ? 1 : 0}
          />
        )}

        {/* Customer at the motorbike */}
        <StickHero
          pos={CUST_AT}
          expr={t >= 25.18 && t < 31.06 ? "shocked" : "calm"}
          arms={t >= 25.18 && t < 31.06 ? "up" : "down"}
          f={f}
          outfit={CUSTOMER}
          flip
        />
      </ThreeCanvas>

      {/* Hook headline text at frame 0 (B41, B44: bold black banner with yellow key) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 250,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          opacity: hookA,
        }}
      >
        {HOOK_LINES.map((line) => (
          <div
            key={line.text}
            style={{
              background: "#000",
              padding: "10px 32px",
              fontFamily: "Outfit, Arial Black, sans-serif",
              fontWeight: 900,
              fontSize: 124,
              color: "#fff",
              lineHeight: 1.05,
            }}
          >
            {line.text}
            <span style={{ color: "#ffd447" }}>{line.key}</span>
          </div>
        ))}
      </div>

      {/* Number and Fact Pills (B45) */}
      <Pills pills={PILLS} t={t} />

      {/* One-word-at-a-time synchronized caption layer */}
      <WordCaption words={READ_WORDS} t={t} />
    </AbsoluteFill>
  );
};
