/* P28-A2 test: a 3D dissection of a USB wall charger head, in the flat klipian intip look (toon shading, palette from tokens.ts,
   light from the top-left, the Room's wall as the background). A visual test only: no facts are claimed.
   Timeline (7.5 s): the charger spins in with a spring, the camera orbits about 40 degrees the whole time, the housing splits
   and lifts (2.0 s), the inner parts separate one after another (3.0 s on), 2D labels pop in, yellow current dots flow,
   and one part (the chip) heats up (red/orange). Everything is a function of the frame, so every render is identical. */
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { BLACK, FONT_BOLD, FRAME, G1, G2, G3, G4, HOT1, HOT2, LAB, METAL, PLUG_FACE, RED, WHITE, YELLOW, YELLOW_D } from "./tokens.ts";
import { Lab } from "./components/Backgrounds.tsx";
import { easeInOut, springAt, clamp01 } from "./motion.ts";
import { FPS } from "./timeline.ts";
import { DISSECT_SECONDS, HEAT_FOR, HEAT_FROM, LABEL_AT, PART_AT, SPLIT_AT } from "./dissectTimeline.ts";
import { useFonts } from "./FunFact.tsx";

export { DISSECT_SECONDS };
const FOV = 26, ELEV = 17;
const DIST_NEAR = 19, DIST_FAR = 38;               // assembled, the charger is about 65 % of the width; the camera pulls back as it comes apart
const TARGET_NEAR = V0(0, 0, 0), TARGET_FAR = V0(-1.5, 0.9, 1.4);
function V0(x: number, y: number, z: number) { return new THREE.Vector3(x, y, z); }

/** Flat shading in three steps (a toon gradient), so it sits next to the 2D shapes. */
function toonGradient(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function slab(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -d / 2);
  return g;
}

// --- the timeline of the parts: how far each has moved (spring), offsets from the assembled place ---------------------------
type Part = "front" | "back" | "pcb" | "trafo" | "cap1" | "cap2" | "chip";
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const EXPLODE: Record<Part, { at: number; by: THREE.Vector3 }> = {
  front: { at: SPLIT_AT, by: V(-1.8, 5.0, 3.0) },
  back: { at: SPLIT_AT + 0.1, by: V(0.2, -2.2, -2.6) },
  pcb: { at: PART_AT.pcb, by: V(0, 0.2, -0.4) },
  trafo: { at: PART_AT.trafo, by: V(-3.0, 1.8, 2.4) },
  cap1: { at: PART_AT.cap1, by: V(2.6, 3.0, 2.2) },
  cap2: { at: PART_AT.cap2, by: V(3.4, -1.0, 2.0) },
  chip: { at: PART_AT.chip, by: V(-1.2, -3.0, 2.8) },
};
const HOME: Record<Part, THREE.Vector3> = {
  front: V(0, 0, 0.62), back: V(0, 0, -0.62), pcb: V(0, 0, 0), trafo: V(-0.55, 0.25, 0.46), cap1: V(0.75, 0.75, 0.5),
  cap2: V(0.8, -0.35, 0.38), chip: V(-0.5, -0.85, 0.2),
};
function placeOf(part: Part, t: number): THREE.Vector3 {
  const e = EXPLODE[part];
  return HOME[part].clone().addScaledVector(e.by, springAt(t, e.at, true));
}
/** The whole charger as it spins in, and floats a little afterwards. */
function spin(t: number): { yaw: number; scale: number; lift: number } {
  const p = springAt(t, 0.0, true);
  return { yaw: THREE.MathUtils.degToRad(-360 * (1 - p) - 12), scale: 0.15 + 0.85 * Math.min(1.04, p), lift: 0.12 * Math.sin(t * 1.6) };
}
/** The camera orbits about 48 degrees and pulls back (and its aim moves to the middle of the exploded parts) as they come apart. */
function cameraAt(t: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const az = THREE.MathUtils.degToRad(interpolate(t, [0, DISSECT_SECONDS], [-24, 24], { easing: easeInOut }));
  const el = THREE.MathUtils.degToRad(ELEV);
  const e = easeInOut(clamp01((t - SPLIT_AT) / 3.4));
  const dist = DIST_NEAR + (DIST_FAR - DIST_NEAR) * e;
  const target = TARGET_NEAR.clone().lerp(TARGET_FAR, e);
  return { target, pos: target.clone().add(V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist)) };
}
const heatAt = (t: number): number => clamp01((t - HEAT_FROM) / HEAT_FOR);

// --- the pieces ---------------------------------------------------------------------------------------------------------------
const Mat: React.FC<{ color: string; emissive?: string; gradient: THREE.DataTexture }> = ({ color, emissive, gradient }) =>
  <meshToonMaterial color={color} gradientMap={gradient} emissive={emissive ?? "#000000"} />;

const Charger: React.FC<{ t: number }> = ({ t }) => {
  const gradient = useMemo(toonGradient, []);
  const shell = useMemo(() => slab(3.2, 3.2, 1.2, 0.35), []);
  const board = useMemo(() => slab(2.8, 3.0, 0.14, 0.12), []);
  const { yaw, scale, lift } = spin(t);
  const heat = heatAt(t);
  const pulse = 0.75 + 0.25 * Math.sin(t * 9);
  const chipColor = new THREE.Color(G1).lerp(new THREE.Color(HOT2), heat);
  const at = (p: Part) => placeOf(p, t).toArray() as [number, number, number];
  return (
    <group rotation={[0, yaw, 0]} scale={scale} position={[0, lift, 0]}>
      {/* the front shell: white, with the USB-A port in its face */}
      <group position={at("front")}>
        <mesh geometry={shell}><Mat color={WHITE} gradient={gradient} /></mesh>
        <mesh position={[0, 0.2, 0.61]}><boxGeometry args={[1.7, 0.72, 0.06]} /><Mat color={PLUG_FACE} gradient={gradient} /></mesh>
        <mesh position={[0, 0.2, 0.66]}><boxGeometry args={[1.4, 0.2, 0.05]} /><Mat color={METAL} gradient={gradient} /></mesh>
        <mesh position={[0, -0.9, 0.62]}><boxGeometry args={[0.7, 0.07, 0.03]} /><Mat color={YELLOW} gradient={gradient} /></mesh>
      </group>
      {/* the back shell and the two pins */}
      <group position={at("back")}>
        <mesh geometry={shell}><Mat color={G4} gradient={gradient} /></mesh>
        {[-0.6, 0.6].map((x) => <mesh key={x} position={[x, 0.2, -1.1]}><boxGeometry args={[0.2, 0.9, 1.0]} /><Mat color={METAL} gradient={gradient} /></mesh>)}
      </group>
      {/* the board with its traces */}
      <group position={at("pcb")}>
        <mesh geometry={board}><Mat color={G1} gradient={gradient} /></mesh>
        {[[-0.3, 0.4, 1.7, 0.05], [0.4, -0.2, 1.2, 0.05], [-0.2, -0.7, 1.5, 0.05]].map(([x, y, w, h], i) =>
          <mesh key={i} position={[x as number, y as number, 0.08]}><boxGeometry args={[w as number, h as number, 0.02]} /><Mat color={YELLOW_D} gradient={gradient} /></mesh>)}
      </group>
      {/* the parts on it */}
      <group position={at("trafo")}>
        <mesh><boxGeometry args={[1.05, 1.05, 0.85]} /><Mat color={G3} gradient={gradient} /></mesh>
        <mesh><boxGeometry args={[1.1, 1.1, 0.26]} /><Mat color={YELLOW_D} gradient={gradient} /></mesh>
      </group>
      <group position={at("cap1")} rotation={[Math.PI / 2, 0, 0]}>
        <mesh><cylinderGeometry args={[0.34, 0.34, 0.9, 28]} /><Mat color={BLACK} gradient={gradient} /></mesh>
        <mesh position={[0, 0.451, 0]}><cylinderGeometry args={[0.3, 0.3, 0.02, 28]} /><Mat color={G3} gradient={gradient} /></mesh>
      </group>
      <group position={at("cap2")} rotation={[Math.PI / 2, 0, 0]}>
        <mesh><cylinderGeometry args={[0.26, 0.26, 0.7, 28]} /><Mat color={G2} gradient={gradient} /></mesh>
        <mesh position={[0, 0.351, 0]}><cylinderGeometry args={[0.22, 0.22, 0.02, 28]} /><Mat color={G4} gradient={gradient} /></mesh>
      </group>
      <group position={at("chip")}>
        <mesh><boxGeometry args={[0.8, 0.8, 0.2]} /><Mat color={`#${chipColor.getHexString()}`} emissive={heat > 0 ? `#${new THREE.Color(RED).multiplyScalar(0.55 * heat * pulse).getHexString()}` : undefined} gradient={gradient} /></mesh>
        {[-0.3, 0, 0.3].map((y) => [-0.46, 0.46].map((x) =>
          <mesh key={`${x}${y}`} position={[x, y, 0]}><boxGeometry args={[0.14, 0.1, 0.06]} /><Mat color={METAL} gradient={gradient} /></mesh>))}
        {heat > 0 && <mesh position={[0, 0, 0.14]}><torusGeometry args={[0.62 + 0.1 * pulse, 0.035, 8, 40]} /><meshBasicMaterial color={HOT1} transparent opacity={0.85 * heat} /></mesh>}
      </group>
      <CurrentDots t={t} />
    </group>
  );
};

/** Yellow dots flowing from the pins, over the board, through the transformer to the chip. */
const CurrentDots: React.FC<{ t: number }> = ({ t }) => {
  if (t < 3.6) return null;
  const k = clamp01((t - 3.6) / 0.6);
  const pts = [
    V(0.6, 0.2, -2.2).add(placeOf("back", t).sub(HOME.back)), V(0.6, 0.2, -0.2), V(0.5, 0.4, 0.1).add(placeOf("pcb", t).sub(HOME.pcb)),
    placeOf("trafo", t).add(V(0, 0, -0.45)), placeOf("cap1", t).add(V(0, 0, -0.45)), placeOf("chip", t).add(V(0, 0, -0.1)),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.2);
  return (
    <group>
      {Array.from({ length: 16 }, (_, i) => {
        const u = (((t * 0.28) + i / 16) % 1 + 1) % 1;
        const p = curve.getPoint(u);
        return <mesh key={i} position={p.toArray() as [number, number, number]} scale={k}><sphereGeometry args={[0.1, 14, 14]} /><meshBasicMaterial color={YELLOW} /></mesh>;
      })}
    </group>
  );
};

/** The camera orbits: set every frame from the time, so it is the same in the Studio and in a render. */
const Rig: React.FC<{ t: number }> = ({ t }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const c = cameraAt(t);
    camera.position.copy(c.pos);
    camera.lookAt(c.target);
    camera.updateProjectionMatrix();
  }, [camera, t]);
  return null;
};

// --- the 2D layer: labels that pop in, with a line to their part ------------------------------------------------------------------
const LABELS: { part: Part; text: string; at: number; danger?: boolean }[] = [
  { part: "front", text: "cangkang", at: LABEL_AT[0] },
  { part: "pcb", text: "papan sirkuit", at: LABEL_AT[1] },
  { part: "trafo", text: "trafo", at: LABEL_AT[2] },
  { part: "cap1", text: "kapasitor", at: LABEL_AT[3] },
  { part: "cap2", text: "kapasitor", at: LABEL_AT[4] },
  { part: "chip", text: "chip", at: LABEL_AT[5] },
  { part: "chip", text: "titik panas", at: LABEL_AT[6], danger: true },
];
function project(part: Part, t: number): { x: number; y: number } {
  const cam = new THREE.PerspectiveCamera(FOV, FRAME.width / FRAME.height, 0.1, 100);
  const c = cameraAt(t);
  cam.position.copy(c.pos);
  cam.lookAt(c.target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const { yaw, scale, lift } = spin(t);
  const v = placeOf(part, t).applyAxisAngle(V(0, 1, 0), yaw).multiplyScalar(scale).add(V(0, lift, 0)).project(cam);
  return { x: (v.x * 0.5 + 0.5) * FRAME.width, y: (-v.y * 0.5 + 0.5) * FRAME.height };
}

const PILL = { fs: 46, left: 50, right: 950, gap: 14 };

/** Where each label's pill goes: beside its part (outward from the middle of the screen), then pushed apart wherever two pills would
    touch, so no two ever overlap. */
function layoutLabels(t: number): { label: (typeof LABELS)[number]; a: { x: number; y: number }; bx: number; by: number; w: number; h: number; p: number }[] {
  const shown = LABELS.map((label) => ({ label, p: springAt(t, label.at) })).filter((l) => l.p > 0.01)
    .map((l) => ({ ...l, a: project(l.label.part, t) })).sort((p, q) => p.a.y - q.a.y);
  const h = PILL.fs * 1.55;
  const placed: ReturnType<typeof layoutLabels> = [];
  for (const l of shown) {
    const w = l.label.text.length * PILL.fs * 0.52 + 56;
    const dir = l.a.x < FRAME.width / 2 ? -1 : 1;
    const bx = Math.max(PILL.left + w / 2, Math.min(PILL.right - w / 2, l.a.x + dir * (w / 2 + 70)));
    let by = Math.max(150, Math.min(l.a.y, FRAME.height - 330));
    for (let guard = 0; guard < 40; guard++) {
      const hit = placed.find((q) => Math.abs(q.bx - bx) < (q.w + w) / 2 + PILL.gap && Math.abs(q.by - by) < h + PILL.gap);
      if (!hit) break;
      by = hit.by + h + PILL.gap;                                   // below the one in the way
    }
    placed.push({ ...l, w, h, bx, by });
  }
  return placed;
}

const Labels: React.FC<{ t: number }> = ({ t }) => (
  <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0 }}>
    {layoutLabels(t).map(({ label: l, a, bx, by, w, h, p }, i) => {
      const fill = l.danger ? RED : YELLOW;
      const edgeX = a.x < bx ? bx - w / 2 : bx + w / 2;
      return (
        <g key={i} opacity={Math.min(1, p * 3)}>
          <line x1={a.x} y1={a.y} x2={edgeX} y2={by} stroke={fill} strokeWidth={5} strokeLinecap="round" />
          <circle cx={a.x} cy={a.y} r={12 * p} fill={fill} />
          <g transform={`translate(${bx} ${by}) scale(${p})`}>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={fill} />
            <text x={0} y={0} fontSize={PILL.fs} fill={l.danger ? WHITE : BLACK} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>{l.text}</text>
          </g>
        </g>
      );
    })}
  </svg>
);

export const Dissect3D: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: LAB.slate }}>
      {/* the lab: the dark slate with its grid and warm glow, so the white housing never merges with the background */}
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0 }}><Lab clock={t} /></svg>
      <ThreeCanvas flat width={FRAME.width} height={FRAME.height} camera={{ fov: FOV, near: 0.1, far: 100, position: cameraAt(0).pos.toArray() as [number, number, number] }}>
        <ambientLight intensity={1.15} />
        <directionalLight position={[-6, 8, 6]} intensity={2.1} />
        <Rig t={t} />
        <Charger t={t} />
      </ThreeCanvas>
      <Labels t={t} />
    </AbsoluteFill>
  );
};
