/* Visual hyperbole for the ricks look (B46 h), opt-in: an ordinary action shown with impossible force (a chop that launches the
   tree through the clouds), then a deadpan reaction. Studied on RicksClips3000 "The Instinct That Makes You Crash" (30.5-34.5 s).
   Every piece is a pure function of time (seconds) and a seed, so a frame renders the same every time. Bright parts are unlit and
   not tone-mapped, so RicksPost's bloom makes them glow. */
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { clamp01 } from "../motion.ts";
import { painted, rnd, type Cam } from "./kit.tsx";

const UP = new THREE.Vector3(0, 1, 0);

/** A jagged bolt from `a` to `b` with side branches: [[p0, p1], ...] segments. Same seed, same bolt. */
export function boltSegs(a: THREE.Vector3, b: THREE.Vector3, seed: number, jag = 0.12, branches = 3): [THREE.Vector3, THREE.Vector3][] {
  const out: [THREE.Vector3, THREE.Vector3][] = [];
  const walk = (p: THREE.Vector3, q: THREE.Vector3, n: number, s: number, depth: number) => {
    const len = p.distanceTo(q);
    let prev = p.clone();
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const next = p.clone().lerp(q, k);
      if (i < n) next.add(new THREE.Vector3(rnd(s + i) - 0.5, (rnd(s + i + 50) - 0.5) * 0.3, rnd(s + i + 90) - 0.5).multiplyScalar(len * jag));
      out.push([prev, next]);
      if (depth === 0 && i < n - 1 && rnd(s + i * 7) < branches / n) {
        const dir = q.clone().sub(p).normalize().add(new THREE.Vector3(rnd(s + i + 3) - 0.5, 0, rnd(s + i + 5) - 0.5).multiplyScalar(1.6));
        walk(next.clone(), next.clone().add(dir.multiplyScalar(len * 0.25)), 4, s + i * 31, 1);
      }
      prev = next;
    }
  };
  walk(a, b, 12, seed, 0);
  return out;
}

/** Glowing segments (a bolt, a crackle), each a thin cylinder; `r` the radius of the main strokes. */
export const Segs: React.FC<{ segs: [THREE.Vector3, THREE.Vector3][]; r: number; color: string; opacity?: number }> = ({ segs, r, color, opacity = 1 }) => (
  <group>
    {segs.map(([p, q], i) => {
      const d = q.clone().sub(p), len = d.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
      return (
        <mesh key={i} position={p.clone().lerp(q, 0.5).toArray()} quaternion={quat}>
          <cylinderGeometry args={[r, r, len, 5, 1]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      );
    })}
  </group>
);

/** A lightning strike at `at` (seconds) from high above onto `target`: two flickers and a flash light, gone after `dur`. */
export const Strike: React.FC<{ t: number; at: number; target: THREE.Vector3; seed?: number; dur?: number }> = ({ t, at, target, seed = 1, dur = 0.35 }) => {
  const u = (t - at) / dur;
  const segs = useMemo(() => boltSegs(target.clone().add(new THREE.Vector3(0.6, 9, -1)), target, seed, 0.1, 4), [target, seed]);
  if (u < 0 || u > 1) return null;
  const on = u < 0.3 || (u > 0.45 && u < 0.7);
  return (
    <group>
      {on && <Segs segs={segs} r={0.028} color="#eaf4ff" />}
      {on && <Segs segs={segs} r={0.09} color="#7fb4ff" opacity={0.35} />}
      <pointLight position={target.clone().add(new THREE.Vector3(0, 0.6, 0.4)).toArray()} intensity={on ? 40 : 6} distance={9} decay={1.6} color="#cfe2ff" />
    </group>
  );
};

/** Red energy crackling around a body at `pos` (soles): small bolts that change every two frames. */
export const Crackle: React.FC<{ f: number; pos: THREE.Vector3; height?: number; power?: number }> = ({ f, pos, height = 1.7, power = 1 }) => {
  if (power <= 0) return null;
  const s = Math.floor(f / 2) * 13;
  const segs: [THREE.Vector3, THREE.Vector3][] = [];
  for (let k = 0; k < 5; k++) {
    const ang = rnd(s + k) * Math.PI * 2, h = 0.2 + rnd(s + k + 20) * height * 0.8;
    const a = pos.clone().add(new THREE.Vector3(Math.cos(ang) * 0.35, h, Math.sin(ang) * 0.2 - 0.05));
    const b = a.clone().add(new THREE.Vector3((rnd(s + k + 40) - 0.5) * 0.9, (rnd(s + k + 60) - 0.5) * 0.9, 0));
    segs.push(...boltSegs(a, b, s + k * 17, 0.35, 0).slice(0, 6));
  }
  return <Segs segs={segs} r={0.02 * power} color="#ff3b2a" />;
};

/** A puffy smoke ring born at `at` on `pos`, rising `rise` metres and widening to `radius`. */
export const SmokeRing: React.FC<{ t: number; at: number; pos: THREE.Vector3; radius: number; rise?: number; dur?: number; tilt?: number }> =
  ({ t, at, pos, radius, rise = 0, dur = 1.6, tilt = 0 }) => {
    const u = (t - at) / dur;
    if (u < 0 || u > 1) return null;
    const e = 1 - (1 - u) ** 3;
    const R = radius * (0.25 + 0.75 * e);
    const puff = radius * 0.09 * (1 + u);
    return (
      <group position={[pos.x, pos.y + rise * e, pos.z]} rotation={[tilt, 0, 0]}>
        {Array.from({ length: 26 }, (_, i) => {
          const a = (i / 26) * Math.PI * 2, j = 0.85 + rnd(i) * 0.3;
          return (
            <mesh key={i} position={[Math.cos(a) * R, (rnd(i + 9) - 0.5) * puff * 0.6, Math.sin(a) * R]} scale={puff * j * (1 - u * 0.6)}>
              <icosahedronGeometry args={[1, 2]} />
              <meshStandardMaterial color="#f4f1ea" emissive="#bdb8ad" emissiveIntensity={0.6} roughness={1} transparent opacity={1 - u * u} />
            </mesh>
          );
        })}
      </group>
    );
  };

/** Debris thrown from `pos` at `at`: chunks on ballistic arcs (gravity 9.8), tumbling. */
export const Debris: React.FC<{ t: number; at: number; pos: THREE.Vector3; n?: number; speed?: number; color?: string; seed?: number; size?: number }> =
  ({ t, at, pos, n = 24, speed = 6, color = "#5b4a3a", seed = 3, size = 0.08 }) => {
    const dt = t - at;
    if (dt < 0 || dt > 3) return null;
    return (
      <group>
        {Array.from({ length: n }, (_, i) => {
          const a = rnd(seed + i) * Math.PI * 2, up = 0.4 + rnd(seed + i + 30) * 0.9, v = speed * (0.5 + rnd(seed + i + 60));
          const p = [pos.x + Math.cos(a) * v * dt * (1 - up * 0.5), pos.y + v * up * dt - 4.9 * dt * dt, pos.z + Math.sin(a) * v * dt * (1 - up * 0.5)];
          if (p[1] < 0) return null;
          const s = size * (0.5 + rnd(seed + i + 90));
          return (
            <mesh key={i} position={p as [number, number, number]} rotation={[dt * 9 + i, dt * 7, i]} scale={s}>
              <boxGeometry args={[1, 0.7, 0.8]} />
              <meshStandardMaterial color={color} roughness={0.9} flatShading />
            </mesh>
          );
        })}
      </group>
    );
  };

/** The clear sky behind a cloud hole: blue, a white sun in the middle and light streaks fanning from it (painted once). */
const skyRays = (c: CanvasRenderingContext2D) => {
  const g = c.createRadialGradient(512, 512, 10, 512, 512, 512);
  g.addColorStop(0, "#fffbe8"); g.addColorStop(0.025, "#fff6d6"); g.addColorStop(0.07, "#a9d4fb"); g.addColorStop(0.4, "#5fa6ec"); g.addColorStop(1, "#3a86d8");
  c.fillStyle = g; c.fillRect(0, 0, 1024, 1024);
  c.globalCompositeOperation = "lighter";
  for (let i = 0; i < 22; i++) {
    const a = rnd(i + 200) * Math.PI * 2, w = 0.015 + rnd(i + 230) * 0.04;
    c.fillStyle = `rgba(255,250,230,${0.03 + rnd(i + 260) * 0.06})`;
    c.beginPath(); c.moveTo(512, 512); c.lineTo(512 + Math.cos(a - w) * 760, 512 + Math.sin(a - w) * 760); c.lineTo(512 + Math.cos(a + w) * 760, 512 + Math.sin(a + w) * 760); c.fill();
  }
  c.globalCompositeOperation = "source-over";
};

/** The cloud deck at `height` with a hole punched through it: `hole` 0..1 opens it to `maxR` metres. Above the deck a sky disk
   (sun and rays) shows through the hole; torn white puffs ring its edge. Set the scene background to the haze colour. */
export const CloudHole: React.FC<{ hole: number; height?: number; maxR?: number; color?: string }> = ({ hole, height = 40, maxR = 12, color = "#9aa1ad" }) => {
  const r = Math.max(0.01, maxR * (1 - (1 - clamp01(hole)) ** 3));
  const geo = useMemo(() => new THREE.RingGeometry(r, 1200, 96, 1), [r]);
  useEffect(() => () => geo.dispose(), [geo]);
  const sky = useMemo(() => painted(1024, 1024, skyRays), []);
  // the group turns local z into world -y: positive z is below the deck, negative above it
  return (
    <group position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={geo}><meshBasicMaterial color={color} side={THREE.DoubleSide} fog /></mesh>
      <mesh position={[0, 0, -20]}><circleGeometry args={[maxR * 5, 64]} /><meshBasicMaterial map={sky} side={THREE.DoubleSide} fog={false} /></mesh>
      {hole > 0 && Array.from({ length: 56 }, (_, i) => {
        const a = (i / 56) * Math.PI * 2 + rnd(i) * 0.08, s = (0.6 + r * 0.07) * (0.6 + rnd(i + 8) * 0.7), d = r + s * (0.1 + 0.4 * rnd(i + 2));
        return (
          <mesh key={i} position={[Math.cos(a) * d, Math.sin(a) * d, (rnd(i + 4) - 0.3) * s]} scale={s}>
            <icosahedronGeometry args={[1, 2]} />
            <meshStandardMaterial color="#f3f4f6" emissive="#c9ccd2" emissiveIntensity={0.7} roughness={1} fog={false} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Camera shake: the camera nudged by up to `amp` metres, decaying over `dur` seconds after `at`. */
export function shake(cam: Cam, t: number, at: number, amp = 0.08, dur = 0.6): Cam {
  const u = (t - at) / dur;
  if (u < 0 || u > 1) return cam;
  const k = amp * (1 - u) ** 2, i = Math.floor(t * 60);
  const n = new THREE.Vector3(rnd(i) - 0.5, rnd(i + 1) - 0.5, rnd(i + 2) - 0.5).multiplyScalar(2 * k);
  return { pos: cam.pos.clone().add(n), look: cam.look.clone().add(n) };
}
