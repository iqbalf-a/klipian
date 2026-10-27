/* The tone of a face for the Three.js spike (round 2): a material that paints every fragment one of the three flat ISO colours of its kind,
   chosen by the fragment's world normal with the same thresholds as `toneOf` in src/iso.ts. No lighting, no ambient, no shadows, no gradients:
   the SVG kit's look, in a depth-buffered scene. `toneFromNormal` is the plain-TypeScript version of the shader's tone function; the test
   (tests/isoThree.test.ts) checks it against `toneOf` for the six axis normals and 200 random normals. */
import * as THREE from "three";
import { ISO } from "../tokens.ts";
import type { P3, Tone } from "../iso.ts";

/** The LIGHT of src/iso.ts (not exported there): top 1, left 0.55, right 0.25. The test keeps it equal to toneOf's. */
export const LIGHT: P3 = [0.25, 0.55, 1];
const LEN = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2]);
/** The two thresholds of toneOf, on the brightness b = n . LIGHT / |n|. */
export const T0 = (LIGHT[2] + LIGHT[1]) / 2 / LEN;
export const T1 = (LIGHT[1] + LIGHT[0]) / 2 / LEN;

/** The tone of a face with the 2.5D normal n: 0 light, 1 mid, 2 dark (the same rule as toneOf). */
export function toneFromNormal(n: P3): Tone {
  const b = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / Math.hypot(n[0], n[1], n[2]);
  return b >= T0 ? 0 : b >= T1 ? 1 : 2;
}

/** The three flat colours of an ISO kind as 0..1 RGB triples. */
export function kindColours(kind: keyof typeof ISO): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const parse = (s: string): THREE.Vector3 => {
    const m = s.match(/\d+(\.\d+)?/g)!.map(Number);
    return new THREE.Vector3(m[0] / 255, m[1] / 255, m[2] / 255);
  };
  const c = ISO[kind];
  return [parse(c[0]), parse(c[1]), parse(c[2])];
}

const vertex = /* glsl */ `
  varying vec3 vWorldNormal;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColour0;
  uniform vec3 uColour1;
  uniform vec3 uColour2;
  uniform vec3 uLight;
  uniform float uT0;
  uniform float uT1;
  uniform vec3 uTint;
  uniform float uTintAmount;
  varying vec3 vWorldNormal;
  void main() {
    // three's axes back to the 2.5D axes: (x, y, z) three = (x, z, y) 2.5D, so the 2.5D normal is (n.x, n.z, n.y)
    vec3 n = vec3(vWorldNormal.x, vWorldNormal.z, vWorldNormal.y);
    float b = dot(n, uLight) / length(n);
    vec3 c = b >= uT0 ? uColour0 : (b >= uT1 ? uColour1 : uColour2);
    c = mix(c, uTint, uTintAmount);
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** A tone material for an ISO kind (plastic, wall, floor, dark, metal, brass, labPlastic). `tint` and `tintAmount` darken the part (the scorch). */
export function toneMaterial(kind: keyof typeof ISO, tint = new THREE.Color(0, 0, 0), tintAmount = 0): THREE.ShaderMaterial {
  const [c0, c1, c2] = kindColours(kind);
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uColour0: { value: c0 }, uColour1: { value: c1 }, uColour2: { value: c2 },
      uLight: { value: new THREE.Vector3(...LIGHT) }, uT0: { value: T0 }, uT1: { value: T1 },
      uTint: { value: new THREE.Vector3(tint.r, tint.g, tint.b) }, uTintAmount: { value: tintAmount },
    },
  });
}
