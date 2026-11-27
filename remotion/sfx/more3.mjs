// 2026-11-27 open effect expansion requested by Ian: 40 additional deterministic, sample-free synth recipes.
// The five digestive sounds are designed for gentle internal movement; the rest widen the quiet foley and transition palette.
import { SFX } from "../src/catalog.ts";

export function more3Recipes(H) {
  const { make, sine, osc, noiseOf, rng, bandpass, lowpass1, lowpass2, highpass1, clamp01, TAU } = H;
  const d = (name) => SFX[name].dur;
  const exp = (t, k) => Math.exp(-t * k);
  const env = (t, T, p = 1) => Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t / T))), p);
  const R = {};

  const definitions = [
    ["gut-gurgle", "gurgle", 112, 401], ["gut-rumble", "rumble", 68, 402], ["stomach-bubble", "bubble", 214, 403],
    ["peristaltic-pulse", "pulse", 82, 404], ["hollow-tube-ping", "tube", 430, 405], ["liquid-glug", "glug", 168, 406],
    ["soft-air-sweep", "sweep", 900, 407], ["muted-knock", "impact", 156, 408], ["double-knock", "double", 188, 409],
    ["rounded-thump", "thump", 92, 410], ["rubber-wobble", "wobble", 260, 411], ["elastic-pluck", "pluck", 330, 412],
    ["small-gliss", "gliss", 440, 413], ["falling-chime", "fall", 1175, 414], ["rising-chime", "rise", 784, 415],
    ["shimmer-tap", "shimmer", 1661, 416], ["hollow-wood-tap", "wood", 360, 417], ["soft-metal-tick", "metal", 2200, 418],
    ["paper-flick", "flick", 1800, 419], ["cloth-flick", "cloth", 1100, 420], ["granular-shiver", "grain", 4200, 421],
    ["granular-drop", "drop", 1450, 422], ["soft-static-burst", "static", 2600, 423], ["muted-rattle", "rattle", 3400, 424],
    ["airy-pop", "pop", 520, 425], ["low-whoomp", "whoomp", 58, 426], ["bubble-chain", "chain", 305, 427],
    ["drip-pair", "drips", 1050, 428], ["liquid-ripple", "ripple", 520, 429], ["resonant-bong", "bong", 148, 430],
    ["tiny-whistle", "whistle", 1900, 431], ["tremolo-ping", "tremolo", 1330, 432], ["breath-flutter", "breath", 750, 433],
    ["brush-swish", "brush", 2800, 434], ["soft-zipper", "zip", 1200, 435], ["sonar-sweep", "sonar", 1050, 436],
    ["gentle-impact", "gentle", 180, 437], ["pulse-pair", "pair", 124, 438], ["glass-shiver", "glass", 1950, 439],
    ["steam-puff-soft", "puff", 1150, 440],
  ];

  for (const [name, kind, f, seed] of definitions) {
    const T = d(name), n = noiseOf(seed), lp = lowpass2(1000 + f * 0.8), hp = highpass1(1800 + f), bp = bandpass(noiseOf(seed + 50), (t) => f * (0.72 + 0.5 * clamp01(t / T)), 1.1);
    const sweep = osc((t) => f * (kind === "fall" ? 1.7 - 0.65 * t / T : kind === "rise" ? 0.7 + 0.65 * t / T : 0.92 + 0.09 * Math.sin(TAU * (2 + (seed % 5)) * t)));
    const pop = (t, delay, freq) => { const x = t - delay; return x < 0 ? 0 : (sine(freq - 100 * x, x) + 0.22 * sine(freq * 2.1, x)) * exp(x, 14); };
    R[name] = () => make(T, (t) => {
      const a = env(t, T, 0.65);
      switch (kind) {
        case "gurgle": return a * (0.56 * sine(f + 22 * Math.sin(TAU * 2.7 * t), t) + 0.24 * sine(f * 1.47, t) + 0.12 * lp(n()));
        case "rumble": return a * (0.65 * sweep(t) + 0.18 * lp(n()) + 0.12 * sine(f * 0.5, t));
        case "bubble": return pop(t, 0.02, f) + pop(t, T * 0.36, f * 1.28) + pop(t, T * 0.68, f * 0.82);
        case "pulse": return (0.65 * sine(f, t) + 0.22 * sine(f * 2.02, t)) * Math.pow(Math.max(0, Math.sin(TAU * 2.4 * t)), 3) * a;
        case "tube": return a * (0.52 * sine(f, t) + 0.32 * sine(f * 2.76, t) + 0.12 * sine(f * 4.2, t)) * exp(t, 1.6);
        case "glug": return pop(t, 0.02, f * 1.4) + pop(t, T * 0.3, f) + pop(t, T * 0.64, f * 0.7);
        case "sweep": return bp(t) * a * (0.55 + 0.45 * Math.sin(TAU * 3 * t));
        case "impact": return (0.7 * lp(n()) + 0.6 * sine(f, t)) * exp(t, 22) * Math.min(1, t / 0.004);
        case "double": return pop(t, 0.005, f * 1.5) + pop(t, T * 0.42, f);
        case "thump": return (sweep(t) + 0.3 * sine(f * 0.5, t)) * exp(t, 7) * Math.min(1, t / 0.003);
        case "wobble": return sweep(t) * exp(t, 3.4) * env(t, T, 0.8);
        case "pluck": return (sine(f * (1 + 0.18 * exp(t, 18)), t) + 0.3 * sine(f * 2.5, t)) * exp(t, 5.5) * Math.min(1, t / 0.003);
        case "gliss": return (sweep(t) + 0.28 * sine(f * 2, t)) * a * exp(t, 1.8);
        case "fall": case "rise": return (sweep(t) + 0.28 * sine(f * 2.76, t)) * exp(t, 2.7) * env(t, T, 0.7);
        case "shimmer": return (sine(f, t) + 0.38 * sine(f * 2.76, t) + 0.2 * sine(f * 4.15, t)) * exp(t, 11) * Math.min(1, t / 0.002);
        case "wood": return (sine(f, t) + 0.35 * sine(f * 2.4, t) + 0.35 * lp(n())) * exp(t, 20);
        case "metal": return (sine(f, t) + 0.35 * sine(f * 1.62, t)) * exp(t, 15) + 0.15 * hp(n()) * exp(t, 35);
        case "flick": return hp(n()) * exp(t, 28) * env(t, T, 0.3);
        case "cloth": return lp(n()) * a * (0.6 + 0.4 * Math.abs(Math.sin(TAU * 12 * t)));
        case "grain": case "rattle": return hp(n()) * a * (0.45 + 0.55 * Math.abs(Math.sin(TAU * (kind === "grain" ? 19 : 12) * t)));
        case "drop": return pop(t, 0.015, f * 1.1) + pop(t, T * 0.58, f * 0.8);
        case "static": return bp(t) * a * (0.4 + 0.6 * Math.abs(Math.sin(TAU * 8 * t)));
        case "pop": return (sweep(t) + 0.25 * lp(n())) * exp(t, 12) * Math.min(1, t / 0.002);
        case "whoomp": return (sweep(t) + 0.35 * sine(f * 0.5, t)) * a * Math.pow(exp(t, 2), 1.5);
        case "chain": return pop(t, 0.01, f) + pop(t, T * 0.22, f * 1.34) + pop(t, T * 0.45, f * 0.88) + pop(t, T * 0.68, f * 1.12);
        case "drips": return pop(t, 0.01, f) + pop(t, T * 0.53, f * 0.78);
        case "ripple": return a * (sine(f * (1 + 0.12 * Math.sin(TAU * 4 * t)), t) + 0.28 * sine(f * 2.4, t)) * exp(t, 1.4);
        case "bong": return (sine(f, t) + 0.36 * sine(f * 1.51, t) + 0.18 * sine(f * 2.03, t)) * exp(t, 4.8);
        case "whistle": return (sweep(t) + 0.12 * sine(f * 2, t)) * a * 0.55;
        case "tremolo": return (sine(f, t) + 0.28 * sine(f * 2.76, t)) * a * (0.35 + 0.65 * Math.sin(TAU * 8 * t));
        case "breath": return lp(n()) * a * (0.45 + 0.55 * Math.sin(TAU * 6 * t));
        case "brush": return hp(n()) * a * (0.7 + 0.3 * Math.sin(TAU * 22 * t));
        case "zip": return (sweep(t) + 0.2 * bp(t)) * a;
        case "sonar": return pop(t, 0.01, f) + pop(t, T * 0.35, f * 0.74);
        case "gentle": return (0.55 * lp(n()) + 0.62 * sine(f, t)) * exp(t, 16) * Math.min(1, t / 0.004);
        case "pair": return pop(t, 0.01, f) + pop(t, T * 0.32, f * 0.82);
        case "glass": return (sine(f, t) + 0.36 * sine(f * 2.76, t) + 0.18 * sine(f * 4.15, t)) * exp(t, 3.8) * a;
        case "puff": return lp(n()) * a * (0.7 + 0.3 * Math.sin(TAU * 5 * t));
        default: return 0;
      }
    });
  }
  return R;
}
