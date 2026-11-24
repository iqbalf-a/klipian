/* Style test (2026-11-24, B55): ONE action built from curves, not named poses: a run-up, a lunge, a throw and a strike, after the strongest test clip
   ("Stickman 2D di dunia 3D, lempar bowling"). The feet are planned in the world (`footTrack`, `legIK`), every arm joint has its own curve (`sampler`),
   the ball leaves the real hand joint at a real release time and the pins fall when it arrives, the camera is a keyed track that follows the action,
   the hit is slow motion with a shake. Everything is a pure function of the story time T. Not used by any video. */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FRAME } from "./tokens.ts";
import { RicksCamera, RicksPost, StickHero, painted, rnd, V, type Cam } from "./ricks/kit.tsx";
import { Debris, SmokeRing, shake } from "./ricks/fx.tsx";
import { handOffset } from "./ricks/rig.ts";
import { camTrack, choreoAt, footTrack, sampler, slowAround, smooth, strides, warpTable, type Choreo, type CamKey } from "./ricks/choreo.ts";

const FPS = 30;
export const CHOREO_SECONDS = 7;
const H = 1.7;

// ---- the hero: a run-up of four strides, a lunge on the left foot, the right arm swings back and through ----
const run = strides(0, -0.1, 4, 0.55, 0.6, 0.26, 0.13);   // right foot first; ends right 1.65, left 2.2
const HERO: Choreo = {
  footR: footTrack(0, [...run.r, [1.64, 2.25, 1.65, 2.0, 0, 0, 0.05]]),
  footL: footTrack(-0.1, [...run.l, [1.9, 2.3, 2.2, 2.75, 0, 0, 0.0, "out"]]),
  hipFrac: sampler([[0, 0.97], [0.6, 0.94], [1.0, 0.93], [1.64, 0.9], [1.95, 0.8], [2.3, 0.62], [2.6, 0.7], [3.2, 0.95], [3.6, 0.97], [3.75, 0.8], [3.95, 0.97], [8, 0.97]]),
  lean: sampler([[0, 4], [0.6, 8], [1.64, 14], [2.0, 24], [2.3, 30], [2.6, 14], [3.2, 2], [3.7, 8], [3.95, -6], [4.4, 2], [8, 2]]),
  rSh: sampler([[0, 40], [0.6, 40], [1.0, -20], [1.64, -80], [1.9, -70], [2.1, 40], [2.25, 120], [2.5, 160], [3.2, 150], [3.7, 120], [3.95, 170], [4.6, 160], [8, 20]]),
  rEl: sampler([[0, 70], [0.6, 70], [1.0, 20], [1.64, 0], [2.0, 4], [2.25, 8], [2.5, 12], [3.2, 30], [3.95, 6], [8, 10]]),
  lSh: sampler([[0, 30], [0.6, 30], [1.0, 40], [1.64, 70], [2.0, 95], [2.3, 70], [2.6, 20], [3.2, 10], [3.7, 40], [3.95, 170], [4.6, 160], [8, 15]]),
  lEl: sampler([[0, 60], [1.0, 40], [2.0, 10], [3.2, 20], [3.95, 6], [8, 10]]),
  lift: sampler([[0, 0], [3.65, 0], [3.85, 0.22], [4.05, 0], [8, 0]]),
};
const hero = (T: number) => choreoAt(HERO, T, H);
/** the right hand in the world at story time T (metres): the figure's hip x plus the hand's offset from its centre */
const hand = (T: number) => { const o = hero(T), off = handOffset(o.pose, "r", H); return V(o.x + off.x, off.y + o.hop * H, 0.05); };

// ---- the ball: leaves the hand at T_R, drops to the floor and rolls ----
const T_R = 2.1, BALL_R = 0.11, PIN_X0 = 10.6, PIN_HIT = PIN_X0 - 0.25;
const V0 = 5.5, V1 = 11, TAU = 0.25;
const rollX = (s: number) => V1 * s - (V1 - V0) * TAU * (1 - Math.exp(-s / TAU));
const REL = hand(T_R);
const T_HIT = (() => { let lo = 0, hi = 6; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (REL.x + rollX(m) < PIN_HIT) lo = m; else hi = m; } return T_R + (lo + hi) / 2; })();
function ballAt(T: number) {
  if (T < T_R) { const h = hand(T); return { p: V(h.x + 0.02, h.y + 0.05, 0.05), roll: 0, vis: true }; }
  const s = T - T_R, x = Math.min(REL.x + rollX(s), PIN_HIT + 2.6);
  return { p: V(x, Math.max(BALL_R, REL.y - 4.9 * s * s), 0), roll: -(x - REL.x) / BALL_R, vis: T < T_HIT + 1.5 };
}

// ---- the pins: a triangle of ten, each knocked away on its own seeded path ----
const PINS = (() => {
  const out: { x0: number; z0: number; delay: number; vx: number; vy: number; vz: number; wz: number; wx: number }[] = [];
  let n = 0;
  for (let k = 0; k < 4; k++) for (let j = 0; j <= k; j++, n++) {
    const z0 = (j - k / 2) * 0.34;
    out.push({ x0: PIN_X0 + k * 0.3, z0, delay: 0.02 + k * 0.07 + Math.abs(z0) * 0.12 + rnd(n) * 0.03, vx: 2 + rnd(n + 20) * 3.4 + (k === 0 ? 1.2 : 0), vy: 1.4 + rnd(n + 40) * 2.8, vz: z0 * 5 + (rnd(n + 60) - 0.5) * 2.4, wz: -(4 + rnd(n + 80) * 7), wx: (rnd(n + 100) - 0.5) * 10 });
  }
  return out;
})();
const PIN_H = 0.575, PIN_CY = PIN_H / 2, PIN_RAD = 0.09;
function pinState(p: (typeof PINS)[number], tt: number) {
  if (tt <= p.delay) return { x: p.x0, y: PIN_CY, z: p.z0, rx: 0, rz: 0 };
  const dt = 1 / 120, steps = Math.floor((tt - p.delay) / dt), HP = Math.PI / 2;
  let { x0: x, z0: z, vx, vy, vz, wx, wz } = p, y = PIN_CY, rx = 0, rz = 0;
  for (let i = 0; i < steps; i++) {
    vy -= 14 * dt; x += vx * dt; y += vy * dt; z += vz * dt; rz += wz * dt; rx += wx * dt;
    if (Math.abs(rz) > HP) { rz = Math.sign(rz) * HP; wz = 0; }
    if (Math.abs(rx) > HP) { rx = Math.sign(rx) * HP; wx = 0; }
    const gy = PIN_RAD + (PIN_CY - PIN_RAD) * Math.abs(Math.cos(rz)) * Math.abs(Math.cos(rx));
    if (y <= gy) { y = gy; if (vy < 0) vy = -vy * 0.28; vx *= 0.985; vz *= 0.985; }
    if (x > 13.3) { x = 13.3; vx = -Math.abs(vx) * 0.2; }
    if (Math.abs(z) > 0.9) { z = Math.sign(z) * 0.9; vz = -vz * 0.3; }
  }
  return { x, y, z, rx, rz };
}

// ---- the camera: a track, not a shot per sentence: follows the run, pushes in on the release, rides the ball, stops at the pins, pulls back to the hero ----
const TH = T_HIT;
const CAM: CamKey[] = [
  [0.0, -0.4, 1.3, 4.8, 0.0, 0.95, 0],
  [0.6, -0.2, 1.3, 4.8, 0.0, 0.95, 0],
  [1.0, 0.5, 1.25, 4.6, 0.8, 0.95, 0],
  [1.4, 1.4, 1.2, 4.4, 1.8, 0.95, 0],
  [1.64, 1.9, 1.15, 4.4, 2.0, 0.9, 0],
  [2.1, 2.3, 1.0, 4.0, 2.6, 0.8, 0],
  [2.4, 2.9, 0.9, 3.8, 3.5, 0.7, 0],
  [TH - 0.3, 5.0, 0.8, 3.8, 7.0, 0.5, 0],
  [TH - 0.12, 7.0, 0.85, 4.0, 9.0, 0.45, 0],
  [TH, 8.8, 0.8, 3.4, 11.0, 0.4, 0],
  [TH + 0.6, 9.4, 0.7, 3.0, 11.2, 0.45, 0],
  [TH + 1.3, 7.8, 1.1, 4.6, 5.0, 0.9, 0],
  [TH + 2.0, 3.6, 1.5, 5.8, 2.4, 1.2, 0],
  [8.0, 3.2, 1.55, 5.4, 2.4, 1.2, 0],
];
const camT = camTrack(CAM);
const SPEED = slowAround(T_HIT, 0.75);
const warp = warpTable(SPEED, CHOREO_SECONDS, FPS);

const woodTex = (c: CanvasRenderingContext2D) => {
  c.fillStyle = "#e9c88f"; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24; i++) { c.fillStyle = `rgba(120,70,20,${0.08 + rnd(i) * 0.1})`; c.fillRect(0, i * 21.3, 512, 1.5); c.fillRect(rnd(i + 5) * 512, i * 21.3, 1.5, 21.3); }
};
const wallTex = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, "#ffe9c8"); g.addColorStop(1, "#ffcfa0"); c.fillStyle = g; c.fillRect(0, 0, 512, 512);
  const cols = ["#ff5a5f", "#2ec4b6", "#ffd166", "#7b5cd6"];
  for (let i = 0; i < 6; i++) { c.fillStyle = cols[i % 4]; if (i % 3 === 0) { c.beginPath(); c.arc(70 + i * 80, 200, 50, 0, 7); c.fill(); } else if (i % 3 === 1) { c.beginPath(); c.moveTo(30 + i * 80, 300); c.lineTo(75 + i * 80, 140); c.lineTo(120 + i * 80, 300); c.fill(); } else c.fillRect(40 + i * 80, 150, 80, 150); }
  c.fillStyle = "#3d348b"; c.fillRect(0, 430, 512, 82);
};

export const ChoreoTest: React.FC = () => {
  const f = useCurrentFrame();
  const T = warp(f / FPS);
  const tt = T - T_HIT;
  const tex = useMemo(() => ({ wood: painted(512, 512, woodTex, 30, 4), wall: painted(512, 512, wallTex, 8, 1) }), []);
  const o = hero(T), ball = ballAt(T);
  const cam0 = camT(T);
  const cam: Cam = shake({ pos: V(...cam0.pos), look: V(...cam0.look) }, T, T_HIT, 0.07, 0.8);
  const float = Array.from({ length: 12 }, (_, i) => ({ x: -4 + i * 2.2, y: 2.2 + (i % 3) * 0.7 + Math.sin(T * 0.9 + i) * 0.15, c: ["#ff5a5f", "#2ec4b6", "#ffd166", "#7b5cd6"][i % 4], r: T * (0.4 + (i % 3) * 0.2) + i }));
  const cheer = T > T_HIT + 0.1 && T < 6;
  const expr = T > 1.5 && T < 2.9 ? "furious" : cheer ? "grin" : "calm";
  return (
    <AbsoluteFill style={{ backgroundColor: "#fff1d6" }}>
      <ThreeCanvas shadows width={FRAME.width} height={FRAME.height} camera={{ fov: 44, near: 0.05, far: 200, position: [-1, 1.3, 4.6] }}>
        <color attach="background" args={["#fff1d6"]} />
        <fog attach="fog" args={["#fff1d6", 22, 60]} />
        <hemisphereLight args={["#fff4e0", "#5a4a8c", 0.9]} />
        <directionalLight position={[-4, 9, 7]} intensity={1.3} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={16} shadow-camera-top={6} shadow-camera-bottom={-6} />
        <RicksCamera cam={cam} />
        <RicksPost cam={cam} bloom={0.45} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, -0.02, 0]} receiveShadow><planeGeometry args={[60, 30]} /><meshStandardMaterial color="#4a3f8c" roughness={1} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0, 0]} receiveShadow><planeGeometry args={[20, 1.9]} /><meshStandardMaterial map={tex.wood} roughness={0.5} /></mesh>
        {[-1.15, 1.15].map((z) => <mesh key={z} position={[6, 0.04, z]}><boxGeometry args={[20, 0.1, 0.4]} /><meshStandardMaterial color="#3d348b" roughness={0.6} /></mesh>)}
        {[-1.15, 1.15].map((z) => <mesh key={`n${z}`} position={[6, 0.1, z]}><boxGeometry args={[20, 0.02, 0.05]} /><meshBasicMaterial color="#2ec4b6" /></mesh>)}
        <mesh position={[14.3, 0.5, 0]}><boxGeometry args={[1, 1, 2.1]} /><meshStandardMaterial color="#1b1530" /></mesh>
        <mesh position={[14.8, 2.5, 0]}><boxGeometry args={[0.5, 5, 9]} /><meshStandardMaterial color="#3d348b" roughness={0.7} /></mesh>
        <mesh position={[5, 2.6, -4.2]}><planeGeometry args={[40, 5.4]} /><meshBasicMaterial map={tex.wall} fog={false} /></mesh>
        {[-3, 3.2, 9, 12].map((x, i) => <mesh key={x} position={[x, 1.3, -3.2 - i * 0.2]} castShadow><boxGeometry args={[0.7, 2.6, 0.7]} /><meshStandardMaterial color={["#7b5cd6", "#2ec4b6", "#ff5a5f", "#ffd166"][i]} roughness={0.7} /></mesh>)}
        {float.map((q, i) => <mesh key={i} position={[q.x, q.y, -3.8]} rotation={[q.r, q.r * 1.3, 0]}>{i % 2 ? <octahedronGeometry args={[0.4, 0]} /> : <icosahedronGeometry args={[0.38, 0]} />}<meshStandardMaterial color={q.c} flatShading roughness={0.5} /></mesh>)}
        {PINS.map((p, i) => { const s = tt > 0 ? pinState(p, tt) : { x: p.x0, y: PIN_CY, z: p.z0, rx: 0, rz: 0 };
          return <group key={i} position={[s.x, s.y, s.z]} rotation={[s.rx, 0, s.rz]}><mesh castShadow><cylinderGeometry args={[0.06, 0.09, PIN_H, 14]} /><meshStandardMaterial color="#fdfdfd" roughness={0.3} /></mesh><mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.064, 0.064, 0.05, 14]} /><meshStandardMaterial color="#e63946" /></mesh></group>; })}
        {ball.vis && <mesh position={ball.p.toArray()} rotation={[0, 0, ball.roll]} castShadow><sphereGeometry args={[BALL_R, 24, 18]} /><meshStandardMaterial color="#c0286e" roughness={0.25} metalness={0.1} /></mesh>}
        {ball.vis && <mesh position={[ball.p.x, 0.012, ball.p.z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[BALL_R * 1.1, 20]} /><meshBasicMaterial color="#000" transparent opacity={0.25} depthWrite={false} /></mesh>}
        <SmokeRing t={T} at={T_HIT} pos={V(PIN_X0 + 0.3, 0.3, 0)} radius={1.6} rise={0.4} dur={0.6} />
        <Debris t={T} at={T_HIT} pos={V(PIN_X0 + 0.3, 0.4, 0)} n={24} speed={4.5} color="#ffd166" />
        <StickHero pos={V(o.x, 0, 0)} expr={expr} arms="down" f={f} outfit={{ shirt: "#7b4bb7", stripe: "#5c3590", hat: "cap", hatColor: "#f4a62a", mustache: true, hair: "bald" }} rig={o.pose} hop={o.hop} />
      </ThreeCanvas>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: tt > 0 && tt < 0.18 ? 0.55 * (1 - tt / 0.18) : 0 }} />
      {(() => { const u = tt - 0.05; if (u <= 0 || T > T_HIT + 1.75) return null;
        const sp = 1 - Math.exp(-u * 9) * Math.cos(u * 18), ex = 1 - smooth((T - (T_HIT + 1.4)) / 0.35);
        return <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", fontFamily: "Outfit, Arial Black, sans-serif", fontWeight: 900, fontSize: 190, color: "#ffd166", WebkitTextStroke: "16px #1b1530", paintOrder: "stroke fill", transform: `scale(${(sp * ex).toFixed(3)}) rotate(${-5 + 3 * Math.sin(u * 10) * Math.exp(-u * 3)}deg)` }}>STRIKE!</div>; })()}
    </AbsoluteFill>
  );
};
