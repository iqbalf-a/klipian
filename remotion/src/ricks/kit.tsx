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
export type Shot = { from: number; a: Cam; b: Cam };
/** The camera at t: the shot that holds t, eased from its start to its end camera over its length. */
export function camAt(shots: Shot[], t: number, total: number): Cam {
  let i = 0;
  for (let k = 0; k < shots.length; k++) if (t >= shots[k].from) i = k;
  const s = shots[i], end = i + 1 < shots.length ? shots[i + 1].from : total;
  const k = easeInOut(clamp01((t - s.from) / (end - s.from)));
  return { pos: s.a.pos.clone().lerp(s.b.pos, k), look: s.a.look.clone().lerp(s.b.look, k) };
}
export const RicksCamera: React.FC<{ cam: Cam }> = ({ cam }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => { camera.position.copy(cam.pos); camera.lookAt(cam.look); camera.updateProjectionMatrix(); }, [camera, cam]);
  return null;
};

/** Depth of field focused on what the camera looks at (close shots: a soft background; wides: almost sharp), bloom on the lights,
   then the cast on top, sharp. */
export const RicksPost: React.FC<{ cam: Cam; bloom?: number }> = ({ cam, bloom = 0.5 }) => {
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
    camera.layers.set(CAST);
    const bg = scene.background;
    scene.background = null;
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
export type Arms = "belly" | "wave" | "down" | "point" | "up" | "shrug" | "hips";
/** What makes one stick person look like nobody else in the video (ian: vary the people): shirt colours, and optionally a hat,
   hair, a moustache and a wider body. Omitted fields give the plain look (spiky hair, slim body, no hat). */
export type Outfit = {
  shirt: string; stripe: string;
  hat?: "cap" | "cowboy" | "hardhat" | "peci" | "none"; hatColor?: string;
  hair?: "spiky" | "bald" | "bun" | "long"; hairColor?: string; mustache?: boolean; body?: "slim" | "wide";
  /** the shirt: stripes (default), plain, dots, check, or plain with a collar */
  pattern?: "stripe" | "plain" | "dots" | "check" | "collar";
  /** the face (the head itself is always white, ian 2026-11-21): a nose, blush, glasses, a beard */
  nose?: "none" | "dot" | "big"; blush?: boolean; glasses?: boolean; beard?: boolean;
};

/** One stick figure on a 512 x 1024 canvas, soles at the bottom. `wob` (-1..1) moves the growl lines, the zzz and a waving hand. */
/** Optional motion for one frame: talk = mouth open 0..1 (lip-sync), g = arm gesture 0..1 (arms rise and fall while speaking), step = walk phase (0 = standing). */
export type Motion = { talk?: number; g?: number; step?: number; tilt?: number; nod?: number };
export function drawStick(c: CanvasRenderingContext2D, expr: Expr, arms: Arms, blink: boolean, wob: number, outfit: Outfit, m: Motion = {}) {
  c.clearRect(0, 0, 512, 1024);
  c.lineCap = c.lineJoin = "round";
  c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 14;
  const sw = m.step ? Math.sin(m.step) : 0, lf = Math.max(0, sw) * 30, rf = Math.max(0, -sw) * 30;   // walking: the legs swing, the lifted foot rises
  c.beginPath(); c.moveTo(230, 700); c.lineTo(212 + sw * 50, 990 - lf); c.moveTo(282, 700); c.lineTo(300 + sw * 50, 990 - rf); c.stroke();
  c.beginPath(); c.ellipse(200 + sw * 50, 995 - lf, 34, 16, 0, 0, 7); c.ellipse(314 + sw * 50, 995 - rf, 34, 16, 0, 0, 7); c.fill();
  c.beginPath();
  const g = m.g ?? 0, g2 = Math.max(0, g * 1.4 - 0.4);   // the second arm lags behind the first
  if ((arms === "down" || arms === "belly") && g > 0.02) {
    c.moveTo(190, 470); c.lineTo(140 - 50 * g, 640 - 190 * g); c.lineTo(150 - 80 * g, 700 - 330 * g);
    c.moveTo(322, 470); c.lineTo(372 + 50 * g2, 640 - 190 * g2); c.lineTo(362 + 80 * g2, 700 - 330 * g2);
  }
  else if (arms === "up") { c.moveTo(190, 470); c.lineTo(120, 330); c.lineTo(100, 200); c.moveTo(322, 470); c.lineTo(392, 330); c.lineTo(412, 200); }
  else if (arms === "shrug") { c.moveTo(190, 470); c.lineTo(110, 590); c.lineTo(60, 500); c.moveTo(322, 470); c.lineTo(402, 590); c.lineTo(452, 500); }
  else if (arms === "hips") { c.moveTo(190, 470); c.lineTo(110, 560); c.lineTo(192, 620); c.moveTo(322, 470); c.lineTo(402, 560); c.lineTo(320, 620); }
  else if (arms === "belly") { c.moveTo(190, 470); c.lineTo(150, 590); c.moveTo(322, 470); c.lineTo(364, 590); }
  else if (arms === "wave") { c.moveTo(190, 470); c.lineTo(130, 640); c.lineTo(150, 700); c.moveTo(322, 470); c.lineTo(420, 380); c.lineTo(440 + wob * 30, 250); }
  else if (arms === "point") { c.moveTo(190, 470); c.lineTo(110, 380); c.lineTo(40, 260); c.moveTo(322, 470); c.lineTo(380, 640); c.lineTo(360, 700); }
  else { const as = m.step ? sw * 46 : 0; c.moveTo(190, 470); c.lineTo(140 - as * 0.6, 640); c.lineTo(150 - as, 700 - Math.abs(as) * 0.3); c.moveTo(322, 470); c.lineTo(372 + as * 0.6, 640); c.lineTo(362 + as, 700 - Math.abs(as) * 0.3); }   // walking: the arms swing against the legs
  c.stroke();
  const bx = outfit.body === "wide" ? 156 : 180, bw = 512 - 2 * bx;
  c.save(); c.beginPath(); c.roundRect(bx, 420, bw, 300, 48); c.clip();
  c.fillStyle = outfit.shirt; c.fillRect(bx - 10, 410, bw + 20, 320);
  c.fillStyle = outfit.stripe;
  const pat = outfit.pattern ?? "stripe";
  if (pat === "stripe") for (let y = 440; y < 720; y += 44) c.fillRect(bx - 10, y, bw + 20, 16);
  else if (pat === "dots") for (let y = 450; y < 720; y += 46) for (let x = bx + 18 + ((y / 46) % 2) * 22; x < bx + bw; x += 44) { c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); }
  else if (pat === "check") { c.globalAlpha = 0.55; for (let y = 430; y < 720; y += 48) c.fillRect(bx - 10, y, bw + 20, 18); for (let x = bx; x < bx + bw; x += 48) c.fillRect(x, 410, 18, 320); c.globalAlpha = 1; }
  else if (pat === "collar") { c.beginPath(); c.moveTo(216, 420); c.lineTo(256, 470); c.lineTo(296, 420); c.closePath(); c.fill(); c.fillRect(250, 470, 12, 240); }
  c.restore();
  c.lineWidth = 12; c.beginPath(); c.roundRect(bx, 420, bw, 300, 48); c.stroke();
  if (arms === "belly" && g <= 0.02) {
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
  drawHat(c, outfit);
  c.restore();
}

function drawFace(c: CanvasRenderingContext2D, o: Outfit) {
  c.strokeStyle = INK; c.fillStyle = INK;
  if (o.blush) { c.fillStyle = "rgba(240,110,110,.45)"; c.beginPath(); c.ellipse(176, 306, 26, 14, 0, 0, 7); c.ellipse(338, 306, 26, 14, 0, 0, 7); c.fill(); }
  if (o.nose === "dot") { c.fillStyle = INK; c.beginPath(); c.arc(258, 300, 7, 0, 7); c.fill(); }
  if (o.nose === "big") { c.lineWidth = 8; c.beginPath(); c.moveTo(252, 270); c.quadraticCurveTo(292, 306, 254, 312); c.stroke(); }
  if (o.hair === "long") { c.lineWidth = 7; c.beginPath(); for (const [x, y, dx] of [[176, 262, -1], [338, 262, 1]] as const) { c.moveTo(x, y); c.lineTo(x + dx * 18, y - 14); c.moveTo(x, y + 12); c.lineTo(x + dx * 20, y + 6); } c.stroke(); }
  if (o.glasses) { c.lineWidth = 8; c.beginPath(); c.roundRect(178, 236, 70, 54, 14); c.roundRect(268, 236, 70, 54, 14); c.moveTo(248, 258); c.lineTo(268, 258); c.moveTo(178, 256); c.lineTo(112, 240); c.moveTo(338, 256); c.lineTo(404, 240); c.stroke(); }
  if (o.beard) { c.fillStyle = o.hairColor ?? INK; c.beginPath(); c.moveTo(130, 300); c.quadraticCurveTo(160, 420, 256, 422); c.quadraticCurveTo(352, 420, 382, 300); c.quadraticCurveTo(352, 380, 300, 372); c.quadraticCurveTo(256, 360, 212, 372); c.quadraticCurveTo(160, 380, 130, 300); c.fill(); }
}
function drawHair(c: CanvasRenderingContext2D, o: Outfit) {
  c.strokeStyle = c.fillStyle = o.hairColor ?? INK; c.lineWidth = 12; c.beginPath();
  const hair = o.hair ?? ((o.hat ?? "none") === "none" ? "spiky" : "bald");   // spiky hair would poke through a hat
  if (hair === "spiky") { c.moveTo(240, 112); c.quadraticCurveTo(232, 70, 262, 52); c.moveTo(262, 112); c.quadraticCurveTo(272, 78, 300, 72); c.moveTo(222, 116); c.quadraticCurveTo(200, 86, 206, 66); c.stroke(); }
  else if (hair === "bun") { c.arc(256, 92, 40, 0, 7); c.fill(); }
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
  const col = o.hatColor ?? { cap: "#d9473b", cowboy: "#8a5a32", hardhat: "#f2c230", peci: "#1d1b22" }[hat];
  c.fillStyle = col; c.beginPath();
  if (hat === "cap") { c.arc(256, 160, 132, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.ellipse(330, 160, 110, 22, 0, 0, 7); c.fill(); c.stroke(); }
  else if (hat === "cowboy") { c.ellipse(256, 150, 210, 40, 0, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.roundRect(170, 40, 172, 115, 50); c.fill(); c.stroke(); c.fillStyle = "#3a2618"; c.fillRect(176, 118, 160, 22); }
  else if (hat === "hardhat") { c.arc(256, 168, 140, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.roundRect(96, 156, 320, 28, 12); c.fill(); c.stroke(); }
  else if (hat === "peci") { c.roundRect(160, 82, 192, 86, 18); c.fill(); c.stroke(); }
}

/** A stick figure standing at `pos` (soles), facing the camera, on the CAST layer, with a contact shadow on the floor. */
/** `talk` opens the mouth (0..1), `act` (0..1) is how lively the person is: arms gesture, the body sways and hops; `step` is a walk phase (omit = standing). */
export const StickHero: React.FC<{ pos: THREE.Vector3; expr: Expr; arms: Arms; f: number; outfit: Outfit; height?: number; talk?: number; act?: number; step?: number; hop?: number; lean?: number; tilt?: number; nod?: number; flip?: boolean }> = ({ pos, expr, arms, f, outfit, height = 1.7, talk = 0, act = 0, step = 0, hop = 0, lean = 0, tilt = 0, nod = 0, flip = false }) => {
  const blink = expr !== "sleepy" && (f + 40) % 96 < 3;
  const wob = Math.sin(f * 0.5);
  const tex = useMemo(() => painted(512, 1024, () => undefined), []);
  drawStick((tex.image as HTMLCanvasElement).getContext("2d")!, expr, arms, blink, wob, outfit, { talk, step, tilt, nod, g: act > 0.3 ? act * (0.5 + 0.5 * Math.sin(f * 0.42)) : 0 });
  tex.needsUpdate = true;
  const breathe = 1 + 0.012 * Math.sin(f * 0.18);
  return (
    <group position={pos.toArray()}>
      <group rotation={[0, 0, lean]}>
        <mesh position={[0, (height / 2) * breathe + hop * height + Math.abs(Math.sin(step)) * 0.03, 0]} scale={[flip ? -1 : 1, breathe, 1]} layers={CAST}><planeGeometry args={[height / 2, height]} /><meshBasicMaterial map={tex} alphaTest={0.5} toneMapped={false} side={THREE.DoubleSide} /></mesh>
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
