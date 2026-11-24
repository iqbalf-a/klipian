// The sound effects of the 2026-11-25 catalog growth (ian: "untuk pool suara buat lebih banyak lagi"): the pool had run dry because B60 asks every video for sound names that
// none of the 10 most recent videos used. Struck bars and bells, plucked tones, drums, cartoon and foley, desk and kitchen, 8-bit and sci-fi, and body sounds. Synthesised like
// every other sound here (sines, noise and filters, seeded, no samples, no licences: see LICENSES.md); sfx/synth.mjs passes in its helpers and writes each file the same way
// (mono, 48 kHz, normalised to a 0.9 peak). The length of each sound is the `dur` of its row in src/catalog.ts. These sounds are OPEN (scripts/soundHash.mjs) until ian
// approves them. They are made from recipes, not auditioned one by one: judge them by ear and say which to redo.
import { SFX } from "../src/catalog.ts";

export function more2Recipes(H) {
  const { make, sine, osc, noiseOf, rng, bandpass, lowpass2, highpass1, clamp01 } = H;
  const d = (name) => SFX[name].dur;
  const e = (t, k) => Math.exp(-t * k);
  const sin2 = (t, d0) => Math.pow(Math.sin((Math.PI * Math.min(t, d0)) / d0), 2);
  const hits = (seed, n, t0, t1) => { const r = rng(seed); return Array.from({ length: n }, () => [t0 + r() * (t1 - t0), 0.4 + 0.6 * r(), 0.8 + 0.4 * r()]).sort((a, b) => a[0] - b[0]); };
  const sumHits = (list, life, fn) => (t) => { let s = 0; for (const [at, a, p] of list) { if (at > t) break; const x = t - at; if (x < life) s += a * fn(x, p); } return s; };
  const struck = (f, parts, decay) => (x) => (x < 0 ? 0 : parts.reduce((s, [m, a, k]) => s + a * sine(f * m, x) * e(x, decay * k), 0) * Math.min(1, x / 0.001));
  const R = {};

  // ---- struck bars, bells and drums: [name, base Hz, [[partial ratio, amplitude, decay factor]...], decay]
  const STRUCK = [
    ["xylophone-c", 1047, [[1, 1, 1], [3.9, 0.4, 3]], 9], ["xylophone-g", 1568, [[1, 1, 1], [3.9, 0.4, 3]], 9],
    ["glockenspiel", 2093, [[1, 1, 1], [2.76, 0.5, 1.2], [5.4, 0.3, 1.6], [8.9, 0.15, 2]], 4], ["triangle-ding", 3200, [[1, 1, 1], [2.4, 0.35, 1.3], [4.1, 0.2, 1.7]], 3],
    ["cowbell", 560, [[1, 1, 1], [1.51, 0.8, 1.2], [2.3, 0.4, 1.6]], 9], ["gong-soft", 180, [[1, 1, 1], [1.5, 0.7, 0.9], [2.1, 0.5, 1.1], [2.9, 0.3, 1.3]], 1.6],
    ["marimba-low", 262, [[1, 1, 1], [3.9, 0.35, 3], [9, 0.1, 5]], 4], ["pan-clang", 330, [[1, 1, 1], [2.4, 0.7, 1.2], [4.1, 0.5, 1.6], [6.2, 0.3, 2]], 5],
    ["mug-clink", 1400, [[1, 1, 1], [2.7, 0.5, 1.3]], 14], ["elevator-ding", 1760, [[1, 1, 1], [1.26, 0.8, 1], [2.76, 0.3, 1.5]], 3.5],
    ["steel-drum", 440, [[1, 1, 1], [2, 0.7, 1.1], [3, 0.45, 1.3], [4.2, 0.2, 1.5]], 4], ["sonar-ping", 1400, [[1, 1, 1]], 3],
    ["kalimba-a", 880, [[1, 1, 1], [5.4, 0.25, 3], [9.5, 0.08, 5]], 7], ["kalimba-e", 659, [[1, 1, 1], [5.4, 0.25, 3], [9.5, 0.08, 5]], 7],
    ["music-box", 1319, [[1, 1, 1], [1.34, 0.4, 1.2], [2.01, 0.5, 1.1]], 5], ["toy-piano", 784, [[1, 1, 1], [2.9, 0.5, 2], [5.8, 0.3, 3]], 8],
    ["claves", 2500, [[1, 1, 1]], 60], ["woodblock-hi", 900, [[1, 1, 1], [2.4, 0.3, 2]], 30], ["woodblock-lo", 520, [[1, 1, 1], [2.4, 0.3, 2]], 28],
    ["pizzicato", 330, [[1, 1, 1], [2, 0.5, 1.3], [3, 0.3, 1.6]], 12],
  ];
  for (const [name, f, parts, decay] of STRUCK) R[name] = () => { const s = struck(f, parts, decay); return make(d(name), (t) => s(t)); };

  R["vibraphone"] = () => make(d("vibraphone"), (t) => (sine(880, t) + 0.3 * sine(1760 * 1.01, t)) * e(t, 2.2) * (0.7 + 0.3 * sine(5.5, t)) * Math.min(1, t / 0.004));
  R["harp-gliss"] = () => { const notes = [392, 494, 587, 784, 988, 1175, 1568], T = d("harp-gliss");
    return make(T, (t) => { let s = 0; notes.forEach((f, k) => { const x = t - k * 0.085; if (x >= 0) s += (sine(f, x) + 0.3 * sine(2 * f, x)) * e(x, 4.5) * 0.5; }); return s; }); };
  R["ukulele-strum"] = () => { const notes = [392, 523, 659, 784]; return make(d("ukulele-strum"), (t) => { let s = 0; notes.forEach((f, k) => { const x = t - k * 0.03; if (x >= 0) s += (sine(f, x) + 0.5 * sine(2 * f, x) + 0.25 * sine(3 * f, x)) * e(x, 7); }); return s * 0.5; }); };
  R["rubber-band-twang"] = () => { const o = osc((t) => 170 + 22 * e(t, 9) * sine(26, t)); return make(d("rubber-band-twang"), (t) => (o(t) + 0.4 * sine(340 + 40 * e(t, 9), t)) * e(t, 7) * Math.min(1, t / 0.002)); };

  // ---- drums and shakers
  R["bongo-hi"] = () => { const o = osc((t) => 190 + 130 * e(t, 40)); return make(d("bongo-hi"), (t) => o(t) * e(t, 14) * Math.min(1, t / 0.002)); };
  R["bongo-lo"] = () => { const o = osc((t) => 135 + 90 * e(t, 36)); return make(d("bongo-lo"), (t) => o(t) * e(t, 11) * Math.min(1, t / 0.002)); };
  R["snare-hit"] = () => { const bp = bandpass(noiseOf(301), () => 2100, 0.8), o = osc((t) => 190 - 60 * e(t, 30)); return make(d("snare-hit"), (t) => 0.8 * bp(t) * e(t, 16) + 0.7 * o(t) * e(t, 22)); };
  R["kick-soft"] = () => { const o = osc((t) => 48 + 80 * e(t, 28)); return make(d("kick-soft"), (t) => o(t) * e(t, 9) * Math.min(1, t / 0.003)); };
  R["hi-hat"] = () => { const hp = highpass1(6500), n = noiseOf(302); return make(d("hi-hat"), (t) => hp(n()) * e(t, 38)); };
  R["rimshot"] = () => { const bp = bandpass(noiseOf(303), () => 3000, 2), o = osc((t) => 420 - 80 * e(t, 40)); return make(d("rimshot"), (t) => 0.7 * bp(t) * e(t, 70) + o(t) * e(t, 26)); };
  R["tambourine"] = () => { const hp = highpass1(5000), n = noiseOf(304), h = sumHits(hits(305, 9, 0, 0.38), 0.12, (x, p) => (sine(7200 * p, x) * 0.4 + 0.8 * hp(n())) * e(x, 38)); return make(d("tambourine"), (t) => h(t)); };
  R["maracas"] = () => { const bp = bandpass(noiseOf(306), () => 5200, 1.2); return make(d("maracas"), (t) => bp(t) * (e(t % 0.17, 26) * (t < 0.34 ? 1 : 0.5)) * (t > 0.17 || t < 0.17 ? 1 : 1)); };
  R["castanets"] = () => { const h = sumHits([[0, 1, 1], [0.1, 0.8, 1.1], [0.2, 0.9, 0.95], [0.27, 0.7, 1.05]], 0.06, (x, p) => sine(1700 * p, x) * e(x, 90) + 0.4 * sine(3400 * p, x) * e(x, 120)); return make(d("castanets"), (t) => h(t)); };
  R["gong-wobble"] = () => make(d("gong-wobble"), (t) => (sine(140, t) + 0.6 * sine(214, t) + 0.4 * sine(305, t)) * e(t, 1.1) * (0.75 + 0.25 * sine(3.2, t)));

  // ---- cartoon and foley
  R["spring-boing"] = () => { const o = osc((t) => 260 + 140 * Math.sin(t * 38) * e(t, 3.5)); return make(d("spring-boing"), (t) => o(t) * e(t, 4.5) * Math.min(1, t / 0.004)); };
  R["balloon-squeak"] = () => { const o = osc((t) => 1500 + 1100 * t + 160 * sine(31, t)), bp = bandpass(noiseOf(307), () => 2400, 4); return make(d("balloon-squeak"), (t) => (0.6 * o(t) + 0.3 * bp(t)) * sin2(t, d("balloon-squeak"))); };
  R["balloon-pop"] = () => { const n = noiseOf(308), lp = lowpass2(7000); return make(d("balloon-pop"), (t) => lp(n()) * e(t, 55) + 0.4 * sine(180, t) * e(t, 40)); };
  R["plunger-pop"] = () => { const o = osc((t) => 160 + 600 * clamp01(t / 0.06)); const n = noiseOf(309); return make(d("plunger-pop"), (t) => o(t) * e(t, 30) * 0.8 + 0.2 * n() * e(t, 80)); };
  R["ratchet"] = () => { const T = d("ratchet"), bp = bandpass(noiseOf(310), () => 2600, 3); return make(T, (t) => { const ph = (t * 46) % 1; return bp(t) * (ph < 0.2 ? 1 : 0.05) * Math.min(1, t / 0.02) * Math.min(1, (T - t) / 0.05) + (ph < 0.05 ? 0.3 * sine(900, t) : 0); }); };
  R["slap-hit"] = () => { const bp = bandpass(noiseOf(311), () => 1500, 1.5); return make(d("slap-hit"), (t) => bp(t) * e(t, 48) + 0.5 * sine(310, t) * e(t, 38)); };
  R["punch-soft"] = () => { const o = osc((t) => 55 + 70 * e(t, 30)), lp = lowpass2(900), n = noiseOf(312); return make(d("punch-soft"), (t) => o(t) * e(t, 12) + 0.6 * lp(n()) * e(t, 40)); };
  R["stomp"] = () => { const o = osc((t) => 42 + 60 * e(t, 24)), lp = lowpass2(1500), n = noiseOf(313); return make(d("stomp"), (t) => o(t) * e(t, 8) + 0.5 * lp(n()) * e(t, 30)); };
  R["door-slam"] = () => { const o = osc((t) => 62 + 90 * e(t, 20)), lp = lowpass2(2500), n = noiseOf(314); return make(d("door-slam"), (t) => o(t) * e(t, 7) + 0.7 * lp(n()) * e(t, 24)); };
  R["sticker-peel"] = () => { const T = d("sticker-peel"), bp = bandpass(noiseOf(315), (t) => 1800 + 1800 * (t / T), 1.4); return make(T, (t) => bp(t) * (0.35 + 0.65 * Math.abs(sine(19, t))) * sin2(t, T)); };
  R["tape-rip"] = () => { const T = d("tape-rip"), r = rng(316), bp = bandpass(noiseOf(317), (t) => 3000 - 900 * (t / T), 1.1); return make(T, (t) => { const on = r() < 0.12 ? 1 : 0; return bp(t) * (0.2 + 1.3 * on) * Math.min(1, t / 0.02) * Math.min(1, (T - t) / 0.08); }); };
  R["scissors-snip"] = () => { const hp = highpass1(2500), n = noiseOf(318); return make(d("scissors-snip"), (t) => hp(n()) * (e(t, 70) + 0.8 * (t > 0.11 ? e(t - 0.11, 80) : 0)) + 0.3 * sine(2300, t) * e(t, 90)); };
  R["stapler"] = () => { const hp = highpass1(1800), n = noiseOf(319); return make(d("stapler"), (t) => hp(n()) * e(t, 90) + 0.8 * sine(240, t) * e(t, 50) + (t > 0.05 ? 0.4 * sine(1300, t) * e(t - 0.05, 120) : 0)); };
  R["pencil-tap"] = () => make(d("pencil-tap"), (t) => sine(1250, t) * e(t, 110) + 0.4 * sine(2900, t) * e(t, 160));
  R["marker-squeak"] = () => { const o = osc((t) => 2500 + 500 * sine(7, t) + 400 * t); return make(d("marker-squeak"), (t) => o(t) * sin2(t, d("marker-squeak")) * (0.7 + 0.3 * sine(23, t))); };
  R["eraser-rub"] = () => { const T = d("eraser-rub"), bp = bandpass(noiseOf(320), () => 1700, 0.5), lp = lowpass2(4000); return make(T, (t) => lp(bp(t)) * (0.3 + 0.7 * Math.abs(sine(7, t))) * sin2(t, T)); };
  R["coin-drop"] = () => make(d("coin-drop"), (t) => { let s = 0; [[0, 1], [0.16, 0.6], [0.27, 0.35], [0.34, 0.2]].forEach(([at, a]) => { const x = t - at; if (x >= 0) s += a * (sine(2400, x) + 0.5 * sine(3650, x)) * e(x, 26); }); return s; });
  R["cash-register"] = () => make(d("cash-register"), (t) => { const click = t < 0.06 ? sine(380, t) * e(t, 60) : 0, x = t - 0.12; return click + (x >= 0 ? (sine(2637, x) + 0.5 * sine(3520, x)) * e(x, 5) * 0.8 : 0); });
  R["keyboard-clack"] = () => { const hp = highpass1(1500), n = noiseOf(321), h = sumHits([[0, 1, 1], [0.09, 0.8, 1.1], [0.17, 0.9, 0.9]], 0.05, (x, p) => (hp(n()) * 0.8 + sine(900 * p, x) * 0.5) * e(x, 110)); return make(d("keyboard-clack"), (t) => h(t)); };
  R["mouse-click"] = () => make(d("mouse-click"), (t) => sine(1900, t) * e(t, 220) + (t > 0.055 ? 0.7 * sine(1400, t) * e(t - 0.055, 240) : 0));
  R["usb-plug"] = () => make(d("usb-plug"), (t) => sine(660, t) * (t < 0.1 ? 1 : 0) * Math.min(1, (0.1 - t) / 0.01) * 0.8 + (t >= 0.1 ? sine(990, t) * e(t - 0.1, 14) : 0));
  R["modem-chirp"] = () => { const T = d("modem-chirp"), o = osc((t) => [1200, 2100, 1650, 2400, 980, 1800][Math.floor(t / 0.13) % 6] + 30 * sine(40, t)); return make(T, (t) => o(t) * 0.7 * Math.min(1, t / 0.01) * Math.min(1, (T - t) / 0.05)); };
  R["radar-blip"] = () => make(d("radar-blip"), (t) => sine(900, t) * e(t, 24) * Math.min(1, t / 0.004));
  R["lock-click"] = () => { const hp = highpass1(2000), n = noiseOf(322); return make(d("lock-click"), (t) => (hp(n()) * e(t, 140) + 0.6 * sine(2100, t) * e(t, 90)) + (t > 0.12 ? (hp(n()) * 0.8 + 0.5 * sine(1500, t)) * e(t - 0.12, 120) : 0)); };
  R["shutter-roll"] = () => { const T = d("shutter-roll"), bp = bandpass(noiseOf(323), () => 900, 1.5); return make(T, (t) => { const ph = (t * 14) % 1; return (bp(t) * (ph < 0.3 ? 1 : 0.1) + (ph < 0.06 ? 0.3 * sine(160, t) : 0)) * Math.min(1, t / 0.03) * Math.min(1, (T - t) / 0.12); }); };

  // ---- sci-fi and 8-bit
  R["laser-zap"] = () => { const o = osc((t) => 2400 * e(t, 9) + 160); return make(d("laser-zap"), (t) => o(t) * e(t, 6) * Math.min(1, t / 0.003)); };
  R["robot-chirp"] = () => { const o = osc((t) => 900 + 700 * Math.sin(t * 60) + 400 * Math.floor(t / 0.1)); return make(d("robot-chirp"), (t) => o(t) * (0.6 + 0.4 * Math.sign(sine(22, t))) * sin2(t, d("robot-chirp"))); };
  R["teleport"] = () => { const T = d("teleport"), o = osc((t) => 200 + 1700 * Math.pow(t / T, 2)); return make(T, (t) => o(t) * (0.6 + 0.4 * sine(24, t)) * sin2(t, T)); };
  R["magic-twinkle"] = () => { const notes = [1568, 1976, 2349, 2637, 3136]; return make(d("magic-twinkle"), (t) => { let s = 0; notes.forEach((f, k) => { const x = t - k * 0.09; if (x >= 0) s += sine(f, x) * e(x, 7) * 0.5; }); return s; }); };
  const sq = (f, t) => (sine(f, t) >= 0 ? 1 : -1) * 0.45;
  R["jump-8bit"] = () => { const o = osc((t) => 300 + 650 * clamp01(t / 0.2)); return make(d("jump-8bit"), (t) => (Math.sign(o(t)) * 0.45) * e(t, 7)); };
  R["coin-8bit"] = () => make(d("coin-8bit"), (t) => (t < 0.07 ? sq(988, t) : sq(1319, t)) * e(Math.max(0, t - 0.07), 9) * Math.min(1, (d("coin-8bit") - t) / 0.02));
  R["powerdown-8bit"] = () => { const o = osc((t) => 880 * e(t, 3.5) + 80); return make(d("powerdown-8bit"), (t) => Math.sign(o(t)) * 0.4 * Math.min(1, (d("powerdown-8bit") - t) / 0.05)); };
  R["pickup-8bit"] = () => make(d("pickup-8bit"), (t) => sq([523, 659, 784, 1047][Math.min(3, Math.floor(t / 0.07))], t) * Math.min(1, (d("pickup-8bit") - t) / 0.03));

  // ---- household and kitchen
  R["fan-whirr"] = () => { const T = d("fan-whirr"), lp = lowpass2(900), n = noiseOf(324); return make(T, (t) => lp(n()) * (0.6 + 0.4 * sine(24, t)) * sin2(t, T) + 0.15 * sine(110, t) * sin2(t, T)); };
  R["steam-hiss"] = () => { const T = d("steam-hiss"), hp = highpass1(3000), n = noiseOf(325); return make(T, (t) => hp(n()) * sin2(t, T) * (0.8 + 0.2 * sine(9, t))); };
  R["spray-can"] = () => { const T = d("spray-can"), bp = bandpass(noiseOf(326), () => 5200, 0.7); return make(T, (t) => bp(t) * Math.min(1, t / 0.03) * Math.min(1, (T - t) / 0.06)); };
  R["water-drip-echo"] = () => make(d("water-drip-echo"), (t) => { let s = 0; [[0, 1], [0.22, 0.45], [0.44, 0.2]].forEach(([at, a]) => { const x = t - at; if (x >= 0) s += a * sine(950 + 400 * e(x, 30), x) * e(x, 38); }); return s; });
  R["bath-bubbles"] = () => { const h = sumHits(hits(327, 12, 0, 0.7), 0.1, (x, p) => sine(380 * p * (1 + 3 * x), x) * e(x, 38)); return make(d("bath-bubbles"), (t) => h(t)); };
  R["pan-sizzle"] = () => { const T = d("pan-sizzle"), hp = highpass1(2500), n = noiseOf(328), r = rng(329); return make(T, (t) => hp(n()) * (0.4 + 0.6 * (r() < 0.04 ? 1 : 0.3)) * Math.min(1, t / 0.05) * Math.min(1, (T - t) / 0.2)); };
  R["cutlery-clatter"] = () => { const h = sumHits(hits(330, 7, 0, 0.5), 0.12, (x, p) => (sine(3400 * p, x) + 0.5 * sine(5600 * p, x)) * e(x, 38)); return make(d("cutlery-clatter"), (t) => h(t)); };
  R["gate-squeak"] = () => { const o = osc((t) => 900 + 250 * sine(3, t) + 300 * t); return make(d("gate-squeak"), (t) => (o(t) + 0.5 * sine(1800 + 500 * sine(3, t), t)) * sin2(t, d("gate-squeak")) * 0.6); };
  R["wheel-squeak"] = () => { const o = osc((t) => 1400 + 200 * sine(9, t)); return make(d("wheel-squeak"), (t) => o(t) * 0.6 * (0.5 + 0.5 * Math.abs(sine(5, t))) * sin2(t, d("wheel-squeak"))); };
  R["school-bell"] = () => { const s = struck(2100, [[1, 1, 1], [2.4, 0.5, 1.2]], 5); return make(d("school-bell"), (t) => s(t % 0.065) * (0.6 + 0.4 * sine(8, t)) * Math.min(1, (d("school-bell") - t) / 0.1)); };

  // ---- the body
  R["crowd-gasp"] = () => { const T = d("crowd-gasp"), bp = bandpass(noiseOf(331), (t) => 900 + 700 * (t / T), 0.8), lp = lowpass2(3000); return make(T, (t) => lp(bp(t)) * sin2(t, T)); };
  R["sigh"] = () => { const T = d("sigh"), bp = bandpass(noiseOf(332), (t) => 1500 - 800 * (t / T), 0.7), lp = lowpass2(2500); return make(T, (t) => lp(bp(t)) * sin2(t, T) * 0.9); };
  R["sniff"] = () => { const bp = bandpass(noiseOf(333), (t) => 800 + 2600 * clamp01(t / 0.1), 1.2); return make(d("sniff"), (t) => bp(t) * sin2(t, d("sniff"))); };
  R["yawn"] = () => { const T = d("yawn"), o = osc((t) => 260 - 120 * (t / T) + 25 * sine(6, t)), o2 = osc((t) => 520 - 240 * (t / T)); return make(T, (t) => (o(t) + 0.4 * o2(t)) * sin2(t, T) * 0.6); };
  R["snore"] = () => { const T = d("snore"), lp = lowpass2(700), n = noiseOf(334), o = osc((t) => 70 + 10 * sine(2, t)); return make(T, (t) => (lp(n()) * 0.8 + o(t) * 0.5) * Math.pow(sin2((t % 0.6), 0.6), 1.3)); };
  R["hiccup"] = () => { const o = osc((t) => (t < 0.12 ? 300 + 600 * (t / 0.12) : 300 + 500 * ((t - 0.15) / 0.12))); return make(d("hiccup"), (t) => o(t) * 0.8 * ((t < 0.12 ? e(t, 12) : 0) + (t >= 0.15 && t < 0.27 ? e(t - 0.15, 12) : 0))); };
  return R;
}
