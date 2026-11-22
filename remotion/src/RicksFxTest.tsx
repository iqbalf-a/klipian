/* Style test (2026-11-21): visual hyperbole for the ricks look (B46 h, src/ricks/fx.tsx), after RicksClips3000 "The Instinct That
   Makes You Crash" (30.5-34.5 s): a furious stick figure in red crackle, lightning on his axe, one chop that launches the tree
   through the clouds (smoke ring, debris, shake), the camera tilting up to the hole punched in the sky. No voice; not used by any video. */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FRAME } from "./tokens.ts";
import { RicksCamera, RicksPost, StickHero, camAt, painted, rnd, V, type Cam, type Shot } from "./ricks/kit.tsx";
import { CloudHole, Crackle, Debris, SmokeRing, Strike, shake } from "./ricks/fx.tsx";

const FPS = 30;
export const RICKS_FX_SECONDS = 5;
const HAZE = "#a9b0ba";
const TREE = V(0, 0, -1.2);
const HERO = V(1.05, 0, -0.55);
const AXE = V(0.66, 1.5, -0.5);         // in the raised (left) hand
const FARMER = V(-2.4, 0, 1.4);
const CHOP = 1.45;                     // the chop; the tree leaves on the same frame
/** How high the tree has flown: slow enough over the first 0.3 s to be read, then gone (40 m/s² of pure hyperbole). */
const treeY = (t: number) => { const dt = Math.max(0, t - CHOP); return 40 * dt * dt; };

const A: Cam = { pos: V(1.25, 1.35, 2.3), look: V(1.1, 1.45, -0.6) };
const B: Cam = { pos: V(3.4, 1.6, 3.6), look: V(0.2, 1.8, -1.0) };
const SHOTS: Shot[] = [
  { from: 0, a: A, b: { pos: V(1.2, 1.4, 1.9), look: V(1.12, 1.5, -0.6) } },
  { from: 1.15, a: B, b: { pos: V(3.6, 1.5, 4.0), look: V(0.2, 2.6, -1.0) } },
  { from: 2.0, a: { pos: V(2.5, 1.3, 5.0), look: V(0.0, 12, -3) }, b: { pos: V(2.6, 1.2, 6.2), look: V(0.0, 40, -4) } },
  { from: 3.9, a: { pos: V(-1.3, 1.25, 4.4), look: V(-2.3, 1.5, 1.4) }, b: { pos: V(-1.5, 1.25, 4.0), look: V(-2.35, 1.5, 1.4) } }, // the deadpan witness
];

const grass = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#6fae45"; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) { c.fillStyle = ["#7dbd4e", "#5f9a3a", "#8cc95a"][i % 3]; c.fillRect(rnd(i) * 512, rnd(i + 7) * 512, 2, 6 + rnd(i + 3) * 8); }
};
const road = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#4a4d52"; c.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) { c.fillStyle = i % 2 ? "#55585e" : "#3f4246"; c.fillRect(rnd(i) * 256, rnd(i + 5) * 512, 3, 3); }
  c.fillStyle = "#f2f0e6"; c.fillRect(8, 0, 8, 512); c.fillRect(240, 0, 8, 512);
  c.fillStyle = "#f2c230"; c.fillRect(124, 0, 8, 300);
};

/** The tree: a trunk and a cluster of low-poly leaf balls; after the chop it leaves straight up, stretched by its speed. */
const Tree: React.FC<{ t: number }> = ({ t }) => {
  const dt = Math.max(0, t - CHOP);
  const y = treeY(t);
  const stretch = 1 + Math.min(0.7, dt * 3);
  return (
    <group position={[TREE.x, TREE.y + y, TREE.z]} scale={[1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch)]}>
      <mesh position={[0, 1.3, 0]} castShadow><cylinderGeometry args={[0.2, 0.32, 2.6, 10]} /><meshStandardMaterial color="#6b4a32" roughness={0.9} flatShading /></mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[(rnd(i) - 0.5) * 2.2, 3.0 + rnd(i + 3) * 1.2, (rnd(i + 6) - 0.5) * 1.6]} scale={0.8 + rnd(i + 9) * 0.5} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={["#4f9a3c", "#5fae46", "#3f8733"][i % 3]} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
};

/** The stump left behind, and a glowing slash across the trunk on the chop. */
const Stump: React.FC<{ t: number }> = ({ t }) => {
  const slash = t >= CHOP - 0.05 && t < CHOP + 0.25;
  return (
    <group position={TREE.toArray()}>
      {t >= CHOP && <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.3, 0.34, 0.36, 10]} /><meshStandardMaterial color="#6b4a32" roughness={0.9} flatShading /></mesh>}
      {t >= CHOP && <mesh position={[0, 0.365, 0]}><cylinderGeometry args={[0.29, 0.29, 0.01, 10]} /><meshStandardMaterial color="#d8b27a" roughness={0.8} /></mesh>}
      {slash && <mesh position={[0.05, 0.4, 0.3]} rotation={[0, 0, -0.25]}><boxGeometry args={[1.1, 0.05, 0.02]} /><meshBasicMaterial color="#fff2b0" toneMapped={false} /></mesh>}
    </group>
  );
};

/** The axe in the hero's raised hand (it follows him into the chop). */
const Axe: React.FC<{ t: number }> = ({ t }) => {
  const swing = t < CHOP - 0.15 ? 0 : Math.min(1, (t - (CHOP - 0.15)) / 0.15);
  return (
    <group position={AXE.toArray()} rotation={[0, 0, 0.5 + swing * 1.6]}>
      <mesh position={[0, -0.35, 0]}><cylinderGeometry args={[0.025, 0.03, 0.8, 8]} /><meshStandardMaterial color="#8a5a32" roughness={0.7} /></mesh>
      <mesh position={[0.09, 0.02, 0]}><boxGeometry args={[0.22, 0.16, 0.03]} /><meshStandardMaterial color="#c9ced6" metalness={0.6} roughness={0.3} emissive="#ff4020" emissiveIntensity={t > 0.75 && t < CHOP ? 1.5 : 0} /></mesh>
    </group>
  );
};

export const RicksFxTest: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const base = camAt(SHOTS, t, RICKS_FX_SECONDS);
  // after the chop the camera tilts up after the flying tree until the cut to the sky
  const follow = t >= CHOP && t < 2.0 ? { pos: base.pos, look: base.look.clone().add(V(0, treeY(t) + Math.min(1.6, (t - CHOP) * 8), 0)) } : base;
  const cam = shake(follow, t, CHOP, 0.12, 0.7);
  const tex = useMemo(() => ({ grass: painted(512, 512, grass, 60, 60), road: painted(256, 512, road, 1, 40) }), []);
  const hole = (t - 2.25) / 1.4;
  return (
    <AbsoluteFill style={{ backgroundColor: HAZE }}>
      <ThreeCanvas shadows width={FRAME.width} height={FRAME.height} camera={{ fov: 42, near: 0.05, far: 900, position: A.pos.toArray() as [number, number, number] }}>
        <color attach="background" args={[HAZE]} />
        <fog attach="fog" args={[HAZE, 25, 320]} />
        <hemisphereLight args={["#c9d6ea", "#4d5a3a", 0.9]} />
        <directionalLight position={[6, 10, 4]} intensity={1.6} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={0.7} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[600, 600]} /><meshStandardMaterial map={tex.grass} roughness={1} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.2, 0.01, 0]} receiveShadow><planeGeometry args={[3, 600]} /><meshStandardMaterial map={tex.road} roughness={0.95} /></mesh>
        <Tree t={t} />
        <Stump t={t} />
        <Axe t={t} />
        <Strike t={t} at={0.75} target={AXE.clone().add(V(0.09, 0.05, 0))} seed={4} />
        <Crackle f={f} pos={HERO} power={t < 2 ? 1 : 0} />
        <SmokeRing t={t} at={CHOP} pos={TREE.clone().add(V(0, 0.3, 0))} radius={2.0} rise={0.5} dur={0.9} />
        <SmokeRing t={t} at={CHOP + 0.12} pos={TREE.clone().add(V(0, 9, 0))} radius={3.4} rise={18} dur={1.3} />
        <Debris t={t} at={CHOP} pos={TREE.clone().add(V(0, 0.4, 0))} n={30} speed={6} />
        <CloudHole hole={hole} height={42} maxR={11} />
        <StickHero pos={HERO} expr="furious" arms="point" f={f} outfit={{ shirt: "#c8a96a", stripe: "#a8894a", hat: "cowboy", mustache: true, body: "wide", hair: "bald" }} />
        <StickHero pos={FARMER} expr="sleepy" arms="down" f={f} outfit={{ shirt: "#3f9a8a", stripe: "#2f7a6c", hat: "cap", hatColor: "#f2f0ea" }} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
