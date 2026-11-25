/* The ricks look kit (B46): a lit three.js diorama with a flat 2D stick cast. What every ricks video shares:
   - RicksPost: the world through depth of field and bloom (three's own addons, no extra dependency), then the cast layer drawn sharp
     on top. The cast skips the DOF depth pass because an alpha-tested card writes its whole rectangle into the depth buffer (a sharp
     box around the character), and the scene background is dropped for the cast pass (it would paint over the world).
   - RicksCamera + camAt: one shot per sentence, each a start and an end camera eased across the shot.
   - StickHero: the channel's stick cast (round head, thick ink outline, stick limbs, a striped shirt in the video's own colours),
     unlit (flat colours, as in the reference), with expressions, arm poses, blinks (never on frame 0: frame 0 is the thumbnail) and a
     breath; a contact shadow on the floor.
   - Pills (B45 numbers on their word) and WordCaption (one word at a time, white with a black stroke).
   The set (walls, props, textures) is each video's own (B27.15, B42): only the engine and the cast are shared. */
import React, { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { clamp01, easeInOut } from "../motion.ts";
import { arm, leg, LEAN_BACK, type Pose } from "./rig.ts";

export const CAST = 1;                  // the layer of the 2D cast
export const INK = "#17141c";
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A CanvasTexture painted by `draw` (sRGB, repeated `rx` x `ry`). */
export function painted(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, rx = 1, ry = 1): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}
/** Deterministic noise for painted strokes (no Math.random: every render is identical). */
export const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Keyed values with an eased step between keys: [[seconds, value], ...]. */
export const keyed = (keys: [number, number][], t: number) => {
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * easeInOut(clamp01((t - t0) / (t1 - t0))); }
  return keys[keys.length - 1][1];
};
/** The value of the last key at or before t: [[seconds, value], ...]. */
export const stepAt = <K extends [number, ...unknown[]]>(keys: K[], t: number): K => { let r = keys[0]; for (const k of keys) if (t >= k[0]) r = k; return r; };

// ---------- camera -----------------------------------------------------------------------------------------------------------
export type Cam = { pos: THREE.Vector3; look: THREE.Vector3 };
/** `lin`: the camera moves at a constant speed (no ease at the ends), for a shot that follows a moving vehicle */
export type Shot = { from: number; a: Cam; b: Cam; lin?: boolean };
/** The camera at t: the shot that holds t, eased from its start to its end camera over its length. */
export function camAt(shots: Shot[], t: number, total: number): Cam {
  let i = 0;
  for (let k = 0; k < shots.length; k++) if (t >= shots[k].from) i = k;
  const s = shots[i], end = i + 1 < shots.length ? shots[i + 1].from : total;
  const u = clamp01((t - s.from) / (end - s.from)), k = s.lin ? u : easeInOut(u);
  return { pos: s.a.pos.clone().lerp(s.b.pos, k), look: s.a.look.clone().lerp(s.b.look, k) };
}
export const RicksCamera: React.FC<{ cam: Cam }> = ({ cam }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => { camera.position.copy(cam.pos); camera.lookAt(cam.look); camera.updateProjectionMatrix(); }, [camera, cam]);
  return null;
};

/** Depth of field focused on what the camera looks at (close shots: a soft background; wides: almost sharp), bloom on the lights,
   then the cast on top, sharp. */
export const RicksPost: React.FC<{ cam: Cam; bloom?: number; occlude?: boolean }> = ({ cam, bloom = 0.5, occlude = false }) => {
  const { gl, scene, camera, size } = useThree();
  const fx = useMemo(() => {
    const composer = new EffectComposer(gl);
    const bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.002, maxblur: 0.006 });
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bokeh);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), bloom, 0.6, 0.82));
    composer.addPass(new OutputPass());
    return { composer, bokeh };
  }, [gl, scene, camera, size.width, size.height, bloom]);
  useLayoutEffect(() => { fx.composer.setPixelRatio(gl.getPixelRatio()); fx.composer.setSize(size.width, size.height); return () => fx.composer.dispose(); }, [fx, gl, size.width, size.height]);
  useFrame(() => {
    const d = cam.pos.distanceTo(cam.look);
    const u = fx.bokeh.uniforms as Record<string, { value: number }>;
    u.focus.value = d;
    u.aperture.value = d < 3 ? 0.0045 : 0.0012;
    camera.layers.set(0);
    fx.composer.render();
    gl.autoClear = false;
    gl.clearDepth();
    const bg = scene.background;
    scene.background = null;
    if (occlude) {   // B58: write the world's depth (no colour) so a cart or table in front of a person hides what is behind it
      const su = gl.shadowMap.autoUpdate;
      gl.shadowMap.autoUpdate = false;
      gl.state.buffers.color.setMask(false);
      gl.render(scene, camera);
      gl.state.buffers.color.setMask(true);
      gl.shadowMap.autoUpdate = su;
    }
    camera.layers.set(CAST);
    gl.render(scene, camera);
    scene.background = bg;
    camera.layers.set(0);
    gl.autoClear = true;
  }, 1);
  return null;
};

/** Box with a painted texture whose repeat follows its size (about one texture per `tile` metres). */
export const TBox: React.FC<{ size: [number, number, number]; pos: [number, number, number]; map?: THREE.Texture; color?: string; tile?: number; rough?: number; emissive?: string }> =
  ({ size, pos, map, color = "#ffffff", tile = 1, rough = 0.85, emissive }) => {
    const m = useMemo(() => { if (!map) return undefined; const t = map.clone(); t.needsUpdate = true; t.repeat.set(Math.max(size[0], size[2]) / tile, size[1] / tile); return t; }, [map, size, tile]);
    return (
      <mesh position={pos} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial map={m} color={color} roughness={rough} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? 1.6 : 0} />
      </mesh>
    );
  };

// ---------- the stick cast -----------------------------------------------------------------------------------------------------
export type Expr = "hungry" | "grin" | "sly" | "calm" | "puzzled" | "sleepy" | "shocked" | "furious";
export type Arms = "belly" | "wave" | "down" | "point" | "up" | "shrug" | "hips" | "aim" | "feed" | "binoc" | "salute";
/** What makes one stick person look like nobody else in the video (ian: vary the people): shirt colours, and optionally a hat,
   hair, a moustache and a wider body. Omitted fields give the plain look (spiky hair, slim body, no hat). */
export type Outfit = {
  shirt: string; stripe: string;
  hat?: "cap" | "cowboy" | "hardhat" | "peci" | "straw" | "beanie" | "bucket" | "helmet" | "headband" | "beret" | "turban" | "none"; hatColor?: string;
  hair?: "spiky" | "bald" | "bun" | "long" | "ponytail" | "pigtails" | "curly" | "afro" | "topknot" | "sidepart" | "braid" | "mohawk" | "hijab"; hairColor?: string; mustache?: boolean; body?: "slim" | "wide";
  /** the shirt: stripes (default), plain, dots, check, or plain with a collar */
  pattern?: "stripe" | "plain" | "dots" | "check" | "collar";
  /** the face (the head itself is always white, ian 2026-11-21): a nose, blush, glasses, a beard */
  nose?: "none" | "dot" | "big"; blush?: boolean; glasses?: boolean; beard?: boolean;
  /** more of the face (ian, 2026-11-25: a face is an asset too, B61): eyebrows, freckles, a mole, wrinkles, eye bags, a small chin beard */
  /** the clothes (ian, 2026-11-25, B62: the channel's people wear very different things, not one shirt in another colour): the garment, a scarf, a belt, a tie, a badge, a chest pocket, and for a woman lashes and lips */
  garment?: "shirt" | "vest" | "dress" | "apron" | "jacket" | "uniform"; scarf?: string; belt?: string; tie?: string; badge?: boolean; pocket?: boolean; lashes?: boolean; lips?: boolean;
  brows?: "thick" | "arched" | "bushy"; freckles?: boolean; mole?: boolean; wrinkles?: boolean; eyebags?: boolean; goatee?: boolean;
};

/** One stick figure on a 512 x 1024 canvas, soles at the bottom. `wob` (-1..1) moves the growl lines, the zzz and a waving hand. */
/** Optional motion for one frame: talk = mouth open 0..1 (lip-sync), g = arm gesture 0..1 (arms rise and fall while speaking), step = walk phase (0 = standing). */
export type Motion = { talk?: number; g?: number; step?: number; tilt?: number; nod?: number; rig?: Pose };
export function drawStick(c: CanvasRenderingContext2D, expr: Expr, arms: Arms, blink: boolean, wob: number, outfit: Outfit, m: Motion = {}) {
  c.clearRect(0, 0, 512, 1024);
  c.lineCap = c.lineJoin = "round";
  c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 14;
  const sw = m.step ? Math.sin(m.step) : 0, lf = Math.max(0, sw) * 30, rf = Math.max(0, -sw) * 30;   // walking: the legs swing, the lifted foot rises
  const g = m.g ?? 0, g2 = Math.max(0, g * 1.4 - 0.4);   // the second arm lags behind the first
  if (m.rig) {   // B52: limbs from joint angles; the whole figure drops so the lower foot always stands on the ground
    const dy = 995 - Math.max(leg(m.rig, "l")[2].y, leg(m.rig, "r")[2].y);
    c.save(); c.translate(0, dy); drawRigLegs(c, m.rig);
    c.save(); c.translate(-LEAN_BACK * Math.sin(((m.rig.lean ?? 0) * Math.PI) / 180), 0); c.translate(256, 700); c.rotate(((m.rig.lean ?? 0) * Math.PI) / 180); c.translate(-256, -700); drawRigArms(c, m.rig);   // arms, torso and head lean together
  } else {
  c.beginPath(); c.moveTo(230, 700); c.lineTo(212 + sw * 50, 990 - lf); c.moveTo(282, 700); c.lineTo(300 + sw * 50, 990 - rf); c.stroke();
  c.beginPath(); c.ellipse(200 + sw * 50, 995 - lf, 34, 16, 0, 0, 7); c.ellipse(314 + sw * 50, 995 - rf, 34, 16, 0, 0, 7); c.fill();
  c.beginPath();
  if ((arms === "down" || arms === "belly") && g > 0.02) {
    c.moveTo(190, 470); c.lineTo(140 - 50 * g, 640 - 190 * g); c.lineTo(150 - 80 * g, 700 - 330 * g);
    c.moveTo(322, 470); c.lineTo(372 + 50 * g2, 640 - 190 * g2); c.lineTo(362 + 80 * g2, 700 - 330 * g2);
  }
  else if (arms === "up") { c.moveTo(190, 470); c.lineTo(120, 330); c.lineTo(100, 200); c.moveTo(322, 470); c.lineTo(392, 330); c.lineTo(412, 200); }
  else if (arms === "shrug") { c.moveTo(190, 470); c.lineTo(110, 590); c.lineTo(60, 500); c.moveTo(322, 470); c.lineTo(402, 590); c.lineTo(452, 500); }
  else if (arms === "hips") { c.moveTo(190, 470); c.lineTo(110, 560); c.lineTo(192, 620); c.moveTo(322, 470); c.lineTo(402, 560); c.lineTo(320, 620); }
  else if (arms === "aim") { c.moveTo(322, 470); c.lineTo(402, 500); c.lineTo(440, 522); c.moveTo(190, 470); c.lineTo(110, 560); c.lineTo(192, 620); }   // the right hand reaches out to hold a prop at about (440, 522) of the canvas, the left braces on the hip
  else if (arms === "feed") { c.moveTo(322, 470); c.lineTo(392, 550); c.lineTo(432, 600); c.moveTo(190, 470); c.lineTo(130, 600); c.lineTo(150, 690); }   // the right hand works at a prop low at its side (a belt, a box)
  else if (arms === "binoc" || arms === "salute") { c.moveTo(190, 470); c.lineTo(140, 640); c.lineTo(150, 700); c.moveTo(322, 470); c.lineTo(372, 640); c.lineTo(362, 700); }   // drawn with the head, over the face
  else if (arms === "belly") { c.moveTo(190, 470); c.lineTo(150, 590); c.moveTo(322, 470); c.lineTo(364, 590); }
  else if (arms === "wave") { c.moveTo(190, 470); c.lineTo(130, 640); c.lineTo(150, 700); c.moveTo(322, 470); c.lineTo(420, 380); c.lineTo(440 + wob * 30, 250); }
  else if (arms === "point") { c.moveTo(190, 470); c.lineTo(110, 380); c.lineTo(40, 260); c.moveTo(322, 470); c.lineTo(380, 640); c.lineTo(360, 700); }
  else { const as = m.step ? sw * 46 : 0; c.moveTo(190, 470); c.lineTo(140 - as * 0.6, 640); c.lineTo(150 - as, 700 - Math.abs(as) * 0.3); c.moveTo(322, 470); c.lineTo(372 + as * 0.6, 640); c.lineTo(362 + as, 700 - Math.abs(as) * 0.3); }   // walking: the arms swing against the legs
  c.stroke();
  }
  const bx = outfit.body === "wide" ? 156 : 180, bw = 512 - 2 * bx;
  c.save(); c.beginPath(); c.roundRect(bx, 420, bw, 300, 48); c.clip();
  c.fillStyle = outfit.shirt; c.fillRect(bx - 10, 410, bw + 20, 320);
  c.fillStyle = outfit.stripe;
  const pat = outfit.pattern ?? "stripe";
  if (pat === "stripe") for (let y = 440; y < 720; y += 44) c.fillRect(bx - 10, y, bw + 20, 16);
  else if (pat === "dots") for (let y = 450; y < 720; y += 46) for (let x = bx + 18 + ((y / 46) % 2) * 22; x < bx + bw; x += 44) { c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); }
  else if (pat === "check") { c.globalAlpha = 0.55; for (let y = 430; y < 720; y += 48) c.fillRect(bx - 10, y, bw + 20, 18); for (let x = bx; x < bx + bw; x += 48) c.fillRect(x, 410, 18, 320); c.globalAlpha = 1; }
  else if (pat === "collar") { c.beginPath(); c.moveTo(216, 420); c.lineTo(256, 470); c.lineTo(296, 420); c.closePath(); c.fill(); c.fillRect(250, 470, 12, 240); }
  const gar = outfit.garment ?? "shirt";
  if (gar === "vest") { c.fillStyle = outfit.stripe; c.fillRect(bx - 10, 410, bw + 20, 320); c.fillStyle = outfit.shirt; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(256 + d * (bw / 2 + 10), 410); c.lineTo(256 + d * 30, 410); c.lineTo(256, 560); c.lineTo(256 + d * 20, 730); c.lineTo(256 + d * (bw / 2 + 10), 730); c.closePath(); c.fill(); } c.fillStyle = INK; for (const y of [600, 650]) { c.beginPath(); c.arc(256, y, 7, 0, 7); c.fill(); } }
  else if (gar === "apron") { c.fillStyle = outfit.stripe; c.beginPath(); c.moveTo(206, 500); c.lineTo(306, 500); c.lineTo(322, 730); c.lineTo(190, 730); c.closePath(); c.fill(); c.lineWidth = 8; c.stroke(); c.beginPath(); c.moveTo(206, 500); c.lineTo(228, 420); c.moveTo(306, 500); c.lineTo(284, 420); c.stroke(); c.strokeRect(226, 590, 60, 50); }
  else if (gar === "jacket") { c.fillStyle = outfit.stripe; c.beginPath(); c.moveTo(216, 410); c.lineTo(256, 520); c.lineTo(296, 410); c.closePath(); c.fill(); c.lineWidth = 9; c.beginPath(); c.moveTo(256, 520); c.lineTo(256, 730); c.moveTo(216, 410); c.lineTo(236, 520); c.moveTo(296, 410); c.lineTo(276, 520); c.stroke(); c.fillStyle = INK; c.fillRect(240, 600, 32, 12); }
  else if (gar === "uniform") { c.fillStyle = outfit.stripe; c.beginPath(); c.moveTo(214, 410); c.lineTo(256, 470); c.lineTo(298, 410); c.closePath(); c.fill(); c.fillRect(bx - 10, 410, 40, 26); c.fillRect(bx + bw - 30, 410, 40, 26); c.lineWidth = 8; c.beginPath(); c.moveTo(256, 470); c.lineTo(256, 730); c.stroke(); c.fillStyle = INK; for (const y of [510, 570, 630, 690]) { c.beginPath(); c.arc(256, y, 7, 0, 7); c.fill(); } }
  if (outfit.belt) { c.fillStyle = outfit.belt; c.fillRect(bx - 10, 650, bw + 20, 32); c.fillStyle = "#f2d16b"; c.fillRect(238, 646, 36, 40); c.fillStyle = outfit.belt; c.fillRect(246, 654, 20, 24); }
  if (outfit.tie) { c.fillStyle = outfit.tie; c.beginPath(); c.moveTo(244, 440); c.lineTo(268, 440); c.lineTo(276, 480); c.lineTo(256, 620); c.lineTo(236, 480); c.closePath(); c.fill(); c.lineWidth = 6; c.stroke(); }
  if (outfit.badge) { c.fillStyle = "#f2c230"; c.lineWidth = 7; c.beginPath(); c.arc(304, 500, 20, 0, 7); c.fill(); c.stroke(); }
  if (outfit.pocket) { c.lineWidth = 8; c.strokeStyle = INK; c.strokeRect(208, 510, 52, 48); }
  c.restore();
  c.lineWidth = 12; c.beginPath(); c.roundRect(bx, 420, bw, 300, 48); c.stroke();
  if (gar === "dress") { c.fillStyle = outfit.shirt; c.beginPath(); c.moveTo(bx + 6, 690); c.lineTo(bx + bw - 6, 690); c.lineTo(bx + bw + 70, 870); c.lineTo(bx - 70, 870); c.closePath(); c.fill(); c.stroke(); c.fillStyle = outfit.stripe; c.beginPath(); c.moveTo(bx - 58, 840); c.lineTo(bx + bw + 58, 840); c.lineTo(bx + bw + 70, 870); c.lineTo(bx - 70, 870); c.closePath(); c.fill(); c.stroke(); }
  if (outfit.scarf) { c.fillStyle = outfit.scarf; c.lineWidth = 10; c.beginPath(); c.roundRect(bx + 20, 400, bw - 40, 46, 22); c.fill(); c.stroke(); c.beginPath(); c.moveTo(300, 440); c.lineTo(330, 520); c.lineTo(296, 510); c.closePath(); c.fill(); c.stroke(); }
  if (!m.rig && arms === "belly" && g <= 0.02) {
    c.lineWidth = 14; c.beginPath(); c.moveTo(150, 590); c.lineTo(236, 600); c.moveTo(364, 590); c.lineTo(278, 600); c.stroke();
    c.lineWidth = 7; c.beginPath();
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const x = 256 + s * (120 + k * 26), y = 560 + k * 30 + wob * 6; c.moveTo(x, y); c.quadraticCurveTo(x + s * 14, y + 8, x, y + 18); }
    c.stroke();
  }
  c.save(); c.translate(256, 410 + (m.nod ?? 0)); c.rotate(m.tilt ?? 0); c.translate(-256, -410);   // the head tilts and nods on its neck
  if (outfit.hair === "long") {   // the back of a bob: a rounded mass behind the head down to the jaw line, so the hair hugs the head
    c.fillStyle = outfit.hairColor ?? INK; c.lineWidth = 12; c.beginPath(); c.moveTo(96, 270); c.arc(256, 270, 160, Math.PI, Math.PI * 2); c.lineTo(416, 340); c.quadraticCurveTo(414, 388, 372, 384); c.lineTo(140, 384); c.quadraticCurveTo(98, 388, 96, 340); c.closePath(); c.fill(); c.stroke();
  }
  c.fillStyle = "#fbf7ee"; c.beginPath(); c.arc(256, 260, 150, 0, 7); c.fill();
  c.lineWidth = 16; c.stroke();
  drawHair(c, outfit);
  c.lineWidth = 10; c.beginPath();
  if (expr === "puzzled" || expr === "calm") { c.moveTo(180, 222); c.lineTo(232, 214); c.moveTo(282, 196); c.quadraticCurveTo(310, 178, 336, 192); }
  else if (expr === "sly") { c.moveTo(180, 214); c.lineTo(232, 226); c.moveTo(282, 226); c.lineTo(334, 214); }
  else if (expr === "sleepy") { c.moveTo(182, 226); c.lineTo(232, 232); c.moveTo(282, 232); c.lineTo(332, 226); }
  else if (expr === "hungry") { c.moveTo(182, 212); c.lineTo(232, 200); c.moveTo(282, 200); c.lineTo(332, 212); }
  else if (expr === "furious") { c.lineWidth = 14; c.moveTo(178, 208); c.lineTo(238, 238); c.moveTo(276, 238); c.lineTo(336, 208); }
  else { c.moveTo(182, 196); c.quadraticCurveTo(206, 180, 232, 192); c.moveTo(282, 192); c.quadraticCurveTo(306, 180, 332, 196); }
  c.stroke();
  c.fillStyle = INK;
  if (blink || expr === "grin") {
    c.lineWidth = 9; c.beginPath();
    if (expr === "grin" && !blink) { c.moveTo(196, 268); c.quadraticCurveTo(212, 248, 228, 268); c.moveTo(286, 268); c.quadraticCurveTo(302, 248, 318, 268); }
    else { c.moveTo(196, 262); c.lineTo(228, 262); c.moveTo(286, 262); c.lineTo(318, 262); }
    c.stroke();
  } else if (expr === "sleepy") {
    c.beginPath(); c.ellipse(212, 266, 13, 9, 0, 0, Math.PI); c.ellipse(302, 266, 13, 9, 0, 0, Math.PI); c.fill();
    c.lineWidth = 7; c.beginPath(); c.moveTo(194, 264); c.lineTo(230, 264); c.moveTo(284, 264); c.lineTo(320, 264); c.stroke();
  } else if (expr === "furious") {
    for (const x of [212, 302]) { const g = c.createRadialGradient(x, 262, 2, x, 262, 46); g.addColorStop(0, "rgba(255,60,40,.9)"); g.addColorStop(1, "rgba(255,40,20,0)"); c.fillStyle = g; c.fillRect(x - 46, 216, 92, 92); }
    c.fillStyle = "#ff2a1a"; c.beginPath(); c.ellipse(212, 264, 17, 13, 0, 0, 7); c.ellipse(302, 264, 17, 13, 0, 0, 7); c.fill();
    c.fillStyle = "#fff4d0"; c.beginPath(); c.ellipse(212, 264, 7, 5, 0, 0, 7); c.ellipse(302, 264, 7, 5, 0, 0, 7); c.fill();
  } else if (expr === "shocked" || expr === "hungry") {
    const r = expr === "shocked" ? 1.45 : 1.15;
    c.beginPath(); c.ellipse(212, 262, 12 * r, 17 * r, 0, 0, 7); c.ellipse(302, 262, 12 * r, 17 * r, 0, 0, 7); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(216, 254, 4, 0, 7); c.arc(306, 254, 4, 0, 7); c.fill();
  } else { c.beginPath(); c.ellipse(212, 262, 12, 17, 0, 0, 7); c.ellipse(302, 262, 12, 17, 0, 0, 7); c.fill(); }
  c.lineWidth = 9; c.beginPath(); c.fillStyle = INK;
  const tk = m.talk ?? 0;
  if (tk > 0.05 && expr !== "furious") {   // lip-sync: the mouth opens and closes on the spoken word
    c.ellipse(258, 334 + 8 * tk, 24 + 12 * tk, 7 + 30 * tk, 0, 0, 7); c.fill();
    if (tk > 0.45) { c.fillStyle = "#e86a6a"; c.beginPath(); c.ellipse(258, 334 + 24 * tk, 16, 8 * tk, 0, 0, 7); c.fill(); }
  }
  else if (expr === "grin") { c.moveTo(208, 322); c.quadraticCurveTo(258, 392, 308, 322); c.closePath(); c.fill(); c.fillStyle = "#e86a6a"; c.beginPath(); c.ellipse(258, 352, 22, 10, 0, 0, 7); c.fill(); }
  else if (expr === "hungry") { c.moveTo(222, 344); for (let k = 0; k < 4; k++) c.quadraticCurveTo(232 + k * 18, 330 + (k % 2) * 28, 240 + k * 18, 344); c.stroke(); }
  else if (expr === "shocked") { c.ellipse(258, 346, 20, 28, 0, 0, 7); c.fill(); }
  else if (expr === "sly") { c.moveTo(228, 344); c.quadraticCurveTo(262, 352, 300, 328); c.stroke(); }
  else if (expr === "sleepy") { c.moveTo(236, 346); c.lineTo(282, 346); c.stroke(); }
  else if (expr === "calm") { c.moveTo(226, 334); c.quadraticCurveTo(258, 360, 292, 334); c.stroke(); }
  else if (expr === "furious") { c.fillStyle = "#fff"; c.beginPath(); c.roundRect(214, 326, 90, 34, 8); c.fill(); c.stroke(); c.beginPath(); for (let x = 232; x < 304; x += 18) { c.moveTo(x, 326); c.lineTo(x, 360); } c.moveTo(214, 343); c.lineTo(304, 343); c.lineWidth = 5; c.stroke(); }
  else { c.moveTo(230, 340); c.quadraticCurveTo(262, 326, 290, 344); c.stroke(); }
  if (expr === "sleepy") { c.fillStyle = "#5fb3ff"; c.font = "bold 54px Arial"; c.fillText("z", 400, 140 - wob * 10); c.font = "bold 38px Arial"; c.fillText("z", 440, 92 - wob * 10); }
  if (expr === "shocked") { c.fillStyle = "#7cc6ff"; c.beginPath(); c.moveTo(392, 170); c.quadraticCurveTo(410, 210, 392, 222); c.quadraticCurveTo(374, 210, 392, 170); c.fill(); }
  drawFace(c, outfit);
  if (outfit.mustache) { c.fillStyle = INK; c.beginPath(); c.moveTo(258, 318); c.quadraticCurveTo(222, 300, 196, 326); c.quadraticCurveTo(226, 318, 258, 330); c.quadraticCurveTo(290, 318, 320, 326); c.quadraticCurveTo(294, 300, 258, 318); c.fill(); }
  if (arms === "binoc") {   // binoculars over the eyes, both forearms up to them
    c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 14; c.beginPath(); c.moveTo(190, 470); c.lineTo(132, 390); c.lineTo(168, 300); c.moveTo(322, 470); c.lineTo(380, 390); c.lineTo(344, 300); c.stroke();
    c.beginPath(); c.ellipse(212, 262, 46, 38, 0, 0, 7); c.ellipse(302, 262, 46, 38, 0, 0, 7); c.fill(); c.fillRect(236, 250, 40, 20);
    c.fillStyle = "#5c6a78"; c.beginPath(); c.ellipse(212, 262, 30, 24, 0, 0, 7); c.ellipse(302, 262, 30, 24, 0, 0, 7); c.fill();
    c.fillStyle = "rgba(255,255,255,.6)"; c.beginPath(); c.ellipse(202, 252, 8, 6, 0, 0, 7); c.ellipse(292, 252, 8, 6, 0, 0, 7); c.fill();
    c.fillStyle = "#fbf7ee"; c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.arc(168, 300, 24, 0, 7); c.arc(344, 300, 24, 0, 7); c.fill(); c.stroke();
  }
  drawHat(c, outfit);
  if (arms === "salute") { c.strokeStyle = INK; c.lineWidth = 14; c.beginPath(); c.moveTo(322, 470); c.lineTo(408, 380); c.lineTo(352, 190); c.stroke(); c.fillStyle = "#fbf7ee"; c.lineWidth = 8; c.beginPath(); c.arc(352, 190, 24, 0, 7); c.fill(); c.stroke(); }
  c.restore();
  if (m.rig) { c.restore(); c.restore(); }
}

/** legs and feet from a rig pose */
function drawRigLegs(c: CanvasRenderingContext2D, p: Pose) {
  c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 14;
  for (const side of ["l", "r"] as const) {
    const [h, k, a] = leg(p, side);
    c.beginPath(); c.moveTo(h.x, h.y); c.lineTo(k.x, k.y); c.lineTo(a.x, a.y); c.stroke();
    c.beginPath(); c.ellipse(a.x + 8, a.y + 5, 34, 16, 0, 0, 7); c.fill();
  }
}
/** arms from a rig pose, in the leaned frame (the arms the head layer draws itself are skipped) */
function drawRigArms(c: CanvasRenderingContext2D, p: Pose) {
  c.strokeStyle = INK; c.lineWidth = 14;
  const flat = { ...p, lean: 0 };   // the canvas is already rotated
  for (const side of ["l", "r"] as const) {
    if (side === "l" ? p.hideL : p.hideR) continue;
    const [s, e, h] = arm(flat, side);
    c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(e.x, e.y); c.lineTo(h.x, h.y); c.stroke();
  }
}

function drawFace(c: CanvasRenderingContext2D, o: Outfit) {
  c.strokeStyle = INK; c.fillStyle = INK;
  if (o.lashes) { c.lineWidth = 7; c.beginPath(); for (const [x, d] of [[196, -1], [320, 1]] as const) { c.moveTo(x, 252); c.lineTo(x + d * 18, 236); c.moveTo(x + d * 4, 264); c.lineTo(x + d * 24, 258); } c.stroke(); }
  if (o.lips) { c.strokeStyle = "#d8324f"; c.lineWidth = 9; c.beginPath(); c.moveTo(236, 352); c.quadraticCurveTo(258, 366, 282, 352); c.stroke(); c.strokeStyle = INK; }
  if (o.blush) { c.fillStyle = "rgba(240,110,110,.45)"; c.beginPath(); c.ellipse(176, 306, 26, 14, 0, 0, 7); c.ellipse(338, 306, 26, 14, 0, 0, 7); c.fill(); }
  if (o.nose === "dot") { c.fillStyle = INK; c.beginPath(); c.arc(258, 300, 7, 0, 7); c.fill(); }
  if (o.nose === "big") { c.lineWidth = 8; c.beginPath(); c.moveTo(252, 270); c.quadraticCurveTo(292, 306, 254, 312); c.stroke(); }
  if (o.hair === "long") { c.lineWidth = 7; c.beginPath(); for (const [x, y, dx] of [[176, 262, -1], [338, 262, 1]] as const) { c.moveTo(x, y); c.lineTo(x + dx * 18, y - 14); c.moveTo(x, y + 12); c.lineTo(x + dx * 20, y + 6); } c.stroke(); }
  if (o.glasses) { c.lineWidth = 8; c.beginPath(); c.roundRect(178, 236, 70, 54, 14); c.roundRect(268, 236, 70, 54, 14); c.moveTo(248, 258); c.lineTo(268, 258); c.moveTo(178, 256); c.lineTo(112, 240); c.moveTo(338, 256); c.lineTo(404, 240); c.stroke(); }
  if (o.brows) { c.lineWidth = o.brows === "thick" ? 13 : 7; c.beginPath(); for (const [x0, x1] of [[184, 242], [274, 332]] as const) { if (o.brows === "arched") { c.moveTo(x0, 226); c.quadraticCurveTo((x0 + x1) / 2, 204, x1, 226); } else if (o.brows === "bushy") { c.moveTo(x0, 226); for (let k = 1; k <= 5; k++) c.lineTo(x0 + (k * (x1 - x0)) / 5, 226 + (k % 2 ? -8 : 4)); } else { c.moveTo(x0, 224); c.lineTo(x1, 224); } } c.stroke(); }
  if (o.freckles) { c.fillStyle = "rgba(150,80,40,.6)"; c.beginPath(); for (const [x, y] of [[170, 304], [188, 312], [204, 300], [308, 300], [324, 312], [342, 304]] as const) { c.moveTo(x + 4, y); c.arc(x, y, 4, 0, 7); } c.fill(); }
  if (o.mole) { c.fillStyle = INK; c.beginPath(); c.arc(300, 372, 6, 0, 7); c.fill(); }
  if (o.wrinkles) { c.lineWidth = 5; c.strokeStyle = "rgba(40,30,30,.7)"; c.beginPath(); for (const y of [168, 184, 200]) { c.moveTo(196, y); c.quadraticCurveTo(256, y - 10, 316, y); } for (const dx of [-1, 1]) { c.moveTo(256 + dx * 112, 318); c.quadraticCurveTo(256 + dx * 126, 336, 256 + dx * 112, 356); } c.stroke(); c.strokeStyle = INK; }
  if (o.eyebags) { c.lineWidth = 5; c.strokeStyle = "rgba(40,30,30,.7)"; c.beginPath(); c.moveTo(188, 296); c.quadraticCurveTo(214, 310, 240, 296); c.moveTo(276, 296); c.quadraticCurveTo(302, 310, 328, 296); c.stroke(); c.strokeStyle = INK; }
  if (o.goatee) { c.fillStyle = o.hairColor ?? INK; c.beginPath(); c.moveTo(232, 368); c.quadraticCurveTo(256, 420, 280, 368); c.quadraticCurveTo(256, 380, 232, 368); c.fill(); }
  if (o.beard) { c.fillStyle = o.hairColor ?? INK; c.beginPath(); c.moveTo(130, 300); c.quadraticCurveTo(160, 420, 256, 422); c.quadraticCurveTo(352, 420, 382, 300); c.quadraticCurveTo(352, 380, 300, 372); c.quadraticCurveTo(256, 360, 212, 372); c.quadraticCurveTo(160, 380, 130, 300); c.fill(); }
}
function drawHair(c: CanvasRenderingContext2D, o: Outfit) {
  c.strokeStyle = c.fillStyle = o.hairColor ?? INK; c.lineWidth = 12; c.beginPath();
  const hair = o.hair ?? ((o.hat ?? "none") === "none" ? "spiky" : "bald");   // spiky hair would poke through a hat
  if (hair === "spiky") { c.moveTo(240, 112); c.quadraticCurveTo(232, 70, 262, 52); c.moveTo(262, 112); c.quadraticCurveTo(272, 78, 300, 72); c.moveTo(222, 116); c.quadraticCurveTo(200, 86, 206, 66); c.stroke(); }
  else if (hair === "bun") { c.arc(256, 92, 40, 0, 7); c.fill(); }
  else if (["ponytail", "pigtails", "topknot", "sidepart", "braid", "mohawk", "curly", "afro"].includes(hair)) {
    const cap = () => { c.beginPath(); c.moveTo(106, 262); c.arc(256, 260, 152, Math.PI, Math.PI * 2); c.quadraticCurveTo(400, 196, 352, 176); c.quadraticCurveTo(250, 130, 160, 178); c.quadraticCurveTo(116, 200, 106, 262); c.fill(); c.stroke(); };
    if (hair === "ponytail") { cap(); c.beginPath(); c.moveTo(378, 150); c.quadraticCurveTo(482, 150, 470, 330); c.quadraticCurveTo(448, 400, 424, 330); c.quadraticCurveTo(436, 230, 372, 196); c.fill(); c.stroke(); c.fillStyle = "#ff6fa5"; c.beginPath(); c.arc(386, 160, 16, 0, 7); c.fill(); c.stroke(); }
    else if (hair === "pigtails") { cap(); for (const d of [-1, 1]) { c.fillStyle = o.hairColor ?? INK; c.beginPath(); c.ellipse(256 + d * 178, 330, 40, 92, d * -0.12, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#ffd447"; c.beginPath(); c.arc(256 + d * 168, 236, 15, 0, 7); c.fill(); c.stroke(); } }
    else if (hair === "topknot") { cap(); c.fillStyle = o.hairColor ?? INK; c.beginPath(); c.arc(256, 80, 36, 0, 7); c.fill(); c.stroke(); }
    else if (hair === "sidepart") { cap(); c.beginPath(); c.moveTo(150, 190); c.quadraticCurveTo(220, 150, 330, 182); c.stroke(); }
    else if (hair === "braid") { cap(); c.fillStyle = o.hairColor ?? INK; for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(404 + (k % 2) * 8, 250 + k * 46, 26, 28, 0, 0, 7); c.fill(); c.stroke(); } c.fillStyle = "#e0456b"; c.beginPath(); c.arc(406, 470, 14, 0, 7); c.fill(); }
    else if (hair === "mohawk") { c.beginPath(); c.moveTo(196, 130); for (let k = 0; k < 6; k++) { c.lineTo(212 + k * 17, 40 + (k % 2) * 22); c.lineTo(220 + k * 17, 112); } c.lineTo(320, 130); c.closePath(); c.fill(); c.stroke(); }
    else { const R = hair === "afro" ? 54 : 40, rr = hair === "afro" ? 152 : 140; for (let a = Math.PI * 1.02; a < Math.PI * 1.99; a += hair === "afro" ? 0.3 : 0.36) { c.beginPath(); c.arc(256 + Math.cos(a) * rr, 262 + Math.sin(a) * rr, R, 0, 7); c.fill(); c.stroke(); } if (hair === "afro") { c.beginPath(); c.arc(256, 150, 100, 0, 7); c.fill(); } }
  }
  else if (hair === "hijab") {   // the scarf frames the face: an oval opening, a drape down to the shoulders
    c.beginPath(); c.moveTo(118, 330); c.quadraticCurveTo(96, 120, 256, 96); c.quadraticCurveTo(416, 120, 394, 330); c.quadraticCurveTo(420, 400, 410, 470); c.lineTo(102, 470); c.quadraticCurveTo(92, 400, 118, 330); c.closePath();
    c.moveTo(376, 280); c.ellipse(256, 280, 120, 124, 0, 0, Math.PI * 2, true); c.fill("evenodd"); c.lineWidth = 10; c.stroke(); c.beginPath(); c.ellipse(256, 280, 120, 124, 0, 0, 7); c.stroke(); c.strokeStyle = c.fillStyle = INK;
  }
  else if (hair === "long") {   // a smooth side-swept fringe over the forehead and a bow; the bob behind the head is drawn in drawStick
    c.lineWidth = 10; c.strokeStyle = INK;
    c.beginPath(); c.moveTo(106, 262); c.arc(256, 260, 152, Math.PI, Math.PI * 2); c.quadraticCurveTo(396, 190, 350, 170); c.quadraticCurveTo(250, 215, 150, 190); c.quadraticCurveTo(116, 215, 106, 262); c.fill(); c.stroke();
    c.fillStyle = "#ff6fa5"; c.lineWidth = 8; c.beginPath(); c.moveTo(340, 128); c.lineTo(404, 96); c.lineTo(398, 168); c.closePath(); c.moveTo(340, 128); c.lineTo(300, 88); c.lineTo(290, 150); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.arc(340, 128, 16, 0, 7); c.fill(); c.stroke();
  }

}
function drawHat(c: CanvasRenderingContext2D, o: Outfit) {
  const hat = o.hat ?? "none";
  if (hat === "none") return;
  c.strokeStyle = INK; c.lineWidth = 12;
  const col = o.hatColor ?? { cap: "#d9473b", cowboy: "#8a5a32", hardhat: "#f2c230", peci: "#1d1b22", straw: "#e0c36a", beanie: "#3a7bd5", bucket: "#6b8f5a", helmet: "#8e98a3", headband: "#d9352a", beret: "#7b3fa0", turban: "#e8e0c8" }[hat];
  c.fillStyle = col; c.beginPath();
  if (hat === "cap") { c.arc(256, 160, 132, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.ellipse(330, 160, 110, 22, 0, 0, 7); c.fill(); c.stroke(); }
  else if (hat === "cowboy") { c.ellipse(256, 150, 210, 40, 0, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.roundRect(170, 40, 172, 115, 50); c.fill(); c.stroke(); c.fillStyle = "#3a2618"; c.fillRect(176, 118, 160, 22); }
  else if (hat === "hardhat") { c.arc(256, 168, 140, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.roundRect(96, 156, 320, 28, 12); c.fill(); c.stroke(); }
  else if (hat === "peci") { c.roundRect(160, 82, 192, 86, 18); c.fill(); c.stroke(); }
  else if (hat === "straw") { c.moveTo(40, 180); c.lineTo(256, 14); c.lineTo(472, 180); c.quadraticCurveTo(256, 206, 40, 180); c.closePath(); c.fill(); c.stroke(); c.lineWidth = 6; c.beginPath(); for (const k of [0.3, 0.55, 0.78]) { c.moveTo(256 - 216 * k, 180 - 166 * (1 - k) + 14); c.lineTo(256 + 216 * k, 180 - 166 * (1 - k) + 14); } c.stroke(); }
  else if (hat === "beanie") { c.arc(256, 196, 150, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = "#fbf7ee"; c.beginPath(); c.roundRect(104, 176, 304, 40, 16); c.fill(); c.stroke(); c.beginPath(); c.arc(256, 36, 32, 0, 7); c.fill(); c.stroke(); }
  else if (hat === "bucket") { c.moveTo(150, 60); c.lineTo(362, 60); c.lineTo(392, 160); c.lineTo(120, 160); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.ellipse(256, 164, 200, 34, 0, 0, 7); c.fill(); c.stroke(); }
  else if (hat === "helmet") { c.arc(256, 196, 150, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = "#d94c2f"; c.beginPath(); c.moveTo(236, 50); c.quadraticCurveTo(256, -4, 290, 44); c.lineTo(270, 62); c.closePath(); c.fill(); c.stroke(); c.fillStyle = col; c.beginPath(); c.roundRect(98, 176, 316, 26, 10); c.fill(); c.stroke(); }
  else if (hat === "headband") { c.roundRect(104, 148, 304, 30, 10); c.fill(); c.stroke(); c.beginPath(); c.moveTo(406, 160); c.lineTo(470, 130); c.lineTo(466, 196); c.closePath(); c.fill(); c.stroke(); }
  else if (hat === "beret") { c.ellipse(238, 116, 150, 52, -0.12, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.arc(246, 62, 12, 0, 7); c.fill(); c.stroke(); }
  else if (hat === "turban") { for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(256, 150 - k * 28, 168 - k * 22, 46, 0, 0, 7); c.fill(); c.stroke(); } c.beginPath(); c.arc(256, 62, 20, 0, 7); c.fill(); c.stroke(); }
}

/** A stick figure standing at `pos` (soles), facing the camera, on the CAST layer, with a contact shadow on the floor. */
/** `talk` opens the mouth (0..1), `act` (0..1) is how lively the person is: arms gesture, the body sways and hops; `step` is a walk phase (omit = standing). */
export const StickHero: React.FC<{ pos: THREE.Vector3; expr: Expr; arms: Arms; f: number; outfit: Outfit; height?: number; talk?: number; act?: number; step?: number; hop?: number; lean?: number; tilt?: number; nod?: number; flip?: boolean; rig?: Pose; breath?: number }> = ({ pos, expr, arms, f, outfit, height = 1.7, talk = 0, act = 0, step = 0, hop = 0, lean = 0, tilt = 0, nod = 0, flip = false, rig, breath = 1 }) => {
  const camera = useThree((x) => x.camera), face = React.useRef<THREE.Group>(null);
  useLayoutEffect(() => { if (face.current) face.current.rotation.y = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z); });   // runs after RicksCamera has placed the camera
  const blink = expr !== "sleepy" && (f + 40) % 96 < 3;
  const wob = Math.sin(f * 0.5);
  const tex = useMemo(() => painted(512, 1024, () => undefined), []);
  drawStick((tex.image as HTMLCanvasElement).getContext("2d")!, expr, arms, blink, wob, outfit, { talk, step, tilt, nod, rig, g: act > 0.3 ? act * (0.5 + 0.5 * Math.sin(f * 0.42)) : 0 });
  tex.needsUpdate = true;
  const breathe = 1 + 0.012 * breath * Math.sin(f * 0.18);   // breath = 0: a person who is not acting stands completely still (B58)
  return (
    <group position={pos.toArray()}>
      <group ref={face}>   {/* B62: the drawn person is a billboard that always turns its face to the camera (yaw only), so it is never seen edge-on and never looks flat */}
      <group rotation={[0, 0, lean]}>
        <mesh position={[0, (height / 2) * breathe + hop * height + Math.abs(Math.sin(step)) * 0.03, 0]} scale={[(flip ? -1 : 1) * (rig ? 1 - Math.min(0.06, hop * 0.4) : 1), breathe * (rig ? 1 + Math.min(0.08, hop * 0.5) : 1), 1]} layers={CAST}><planeGeometry args={[height / 2, height]} /><meshBasicMaterial map={tex} alphaTest={0.5} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      </group>
      </group>
      <mesh position={[0, 0.005, 0.03]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[height * 0.13, 32]} /><meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} /></mesh>
    </group>
  );
};

// ---------- 2D overlays ----------------------------------------------------------------------------------------------------------
export type Pill = { at: number; until: number; text: string; key: string; color: string; y: number };
const popScale = (s: number) => { if (s <= 0) return 0; if (s >= 0.35) return 1; const x = s / 0.35 - 1; return 1 + 2.7 * x * x * x + 1.7 * x * x; };   // back-out in 0.35 s
/** Number pills (B45): each on its word, the number (`key`) in colour. */
export const Pills: React.FC<{ pills: Pill[]; t: number }> = ({ pills, t }) => (
  <>
    {pills.filter((p) => t >= p.at && t < p.until).map((p) => {
      const [before, after] = p.text.split(p.key);
      return (
        <div key={p.text} style={{ position: "absolute", left: 0, right: 0, top: p.y, display: "flex", justifyContent: "center", transform: `scale(${popScale(t - p.at)})` }}>
          <div style={{ background: "#fffaf0", border: `8px solid ${INK}`, borderRadius: 26, padding: "14px 30px", fontFamily: "Outfit, Arial Black, sans-serif", fontWeight: 900, fontSize: 58, color: INK, boxShadow: "0 10px 0 rgba(0,0,0,.35)" }}>
            {before}<span style={{ color: p.color }}>{p.key}</span>{after}
          </div>
        </div>
      );
    })}
  </>
);
export type Word = { w: string; a: number; b: number };
/** The words as the viewer reads them: whisper splits "berturut-turut" in two, so a word that starts with "-" joins the one before. */
export const readWords = (words: Word[]) => words.reduce<Word[]>((out, x) => {
  if (x.w.startsWith("-") && out.length) { out[out.length - 1] = { ...out[out.length - 1], w: out[out.length - 1].w + x.w, b: x.b }; return out; }
  out.push({ ...x }); return out;
}, []);
/** One word at a time, white with a black stroke, a small pop on each word. */
export const WordCaption: React.FC<{ words: Word[]; t: number; top?: number }> = ({ words, t, top = 1500 }) => {
  let cur = words[0];
  for (const x of words) if (t >= x.a - 0.05) cur = x;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", fontFamily: "Outfit, Arial Black, sans-serif", fontWeight: 900, fontSize: 104, color: "#fff", WebkitTextStroke: "12px #000", paintOrder: "stroke fill", transform: `scale(${0.85 + 0.15 * clamp01((t - cur.a) / 0.12)})` }}>
      {cur.w.replace(/[.,!?]+$/, "")}
    </div>
  );
};
