// The sound effects of the 2026-11-23 catalog growth (B48: "rule first, catalog follows"): water, wood, metal, cloth, paper, glass, food, animals, vehicles, household,
// electronics, nature, interface, body and cartoon sounds. Synthesised like every other sound in this folder (sines, noise and filters, seeded, no samples, no licences:
// see LICENSES.md); sfx/synth.mjs passes in its own helpers and writes each file the same way (mono, 48 kHz, normalised to a 0.9 peak). The length of each sound is the
// `dur` of its row in src/catalog.ts, so the file and the table cannot disagree. These sounds are OPEN (scripts/soundHash.mjs) until ian approves them: the approved set
// of pilot 1 does not change.
import { SFX } from "../src/catalog.ts";

export function moreRecipes(H) {
  const { make, sine, osc, noiseOf, rng, bandpass, lowpass1, lowpass2, highpass1, bell, pluck, clamp01, TAU } = H;
  const d = (name) => SFX[name].dur;
  const e = (t, k) => Math.exp(-t * k);
  const sin2 = (t, d0) => Math.pow(Math.sin((Math.PI * Math.min(t, d0)) / d0), 2);       // a swell: 0 to 1 to 0 over d0
  /** `n` hits at seeded random times in [t0, t1): [time, amplitude 0.4..1, pitch factor 0.8..1.2]. */
  const hits = (seed, n, t0, t1) => { const r = rng(seed); return Array.from({ length: n }, () => [t0 + r() * (t1 - t0), 0.4 + 0.6 * r(), 0.8 + 0.4 * r()]).sort((a, b) => a[0] - b[0]); };
  /** A sum over the hits of a function of the time since the hit (hits are sorted: only the sounding ones are looked at). */
  const sumHits = (list, life, fn) => (t) => { let s = 0; for (const [at, a, p] of list) { if (at > t) break; const x = t - at; if (x < life) s += a * fn(x, p); } return s; };
  const R = {};

  // ---- water
  R["water-splash"] = () => { const n = noiseOf(101), lp = lowpass2(5000), bp = bandpass(noiseOf(102), (t) => 600 + 3200 * e(t, 9), 0.7), bub = sumHits(hits(103, 9, 0.02, 0.4), 0.12, (x, p) => sine(500 * p * (1 + 4 * x), x) * e(x, 30));
    return make(d("water-splash"), (t) => lp(bp(t)) * e(t, 6) * Math.min(1, t / 0.004) + 0.2 * lp(n()) * e(t, 14) + 0.3 * bub(t)); };
  R["water-pour"] = () => { const T = d("water-pour"), bp = bandpass(noiseOf(104), (t) => 750 + 250 * sine(5.5, t) + 120 * sine(13, t), 1.1), lp = lowpass2(3500);
    return make(T, (t) => lp(bp(t)) * (0.7 + 0.3 * sine(9, t)) * Math.min(1, t / 0.12) * Math.min(1, (T - t) / 0.2)); };
  R["wave-wash"] = () => { const T = d("wave-wash"), bp = bandpass(noiseOf(105), (t) => 500 + 1500 * sin2(t, T), 0.6), lp = lowpass2(3000);
    return make(T, (t) => lp(bp(t)) * sin2(t, T) * (0.8 + 0.2 * sine(11, t))); };
  R["bubble-pop"] = () => { const o = osc((t) => 700 + 1900 * (1 - e(t, 60))); return make(d("bubble-pop"), (t) => o(t) * e(t, 38) * Math.min(1, t / 0.002)); };
  R["stream-trickle"] = () => { const T = d("stream-trickle"), bp = bandpass(noiseOf(106), (t) => 2600 + 700 * sine(17, t) + 500 * sine(41, t), 2.2), lp = lowpass2(5000),
    drips = sumHits(hits(107, 7, 0, T - 0.1), 0.08, (x, p) => sine(1500 * p, x) * e(x, 55));
    return make(T, (t) => (0.45 * lp(bp(t)) * (0.5 + 0.5 * Math.abs(sine(7, t) * sine(3, t))) + 0.4 * drips(t)) * Math.min(1, t / 0.05) * Math.min(1, (T - t) / 0.1)); };
  R["gulp"] = () => { const o = osc((t) => (t < 0.18 ? 420 - 220 * (t / 0.18) : 360 - 160 * ((t - 0.2) / 0.2))), lp = lowpass2(1500);
    return make(d("gulp"), (t) => lp(o(t) * (1 + 0.5 * sine(60, t))) * (sin2(t - 0.0, 0.18) * (t < 0.2) + sin2(t - 0.2, 0.2) * (t >= 0.2))); };

  // ---- wood
  R["door-creak"] = () => { const T = d("door-creak"), f = (t) => 150 + 90 * sine(2.2, t) + 40 * t, o = osc(f), o2 = osc((t) => 2.01 * f(t)), o3 = osc((t) => 3.03 * f(t)), lp = lowpass2(1800);
    return make(T, (t) => lp(o(t) + 0.6 * o2(t) + 0.45 * o3(t)) * (0.6 + 0.4 * sine(14, t)) * Math.min(1, t / 0.08) * Math.min(1, (T - t) / 0.2)); };
  R["wood-crack"] = () => { const bp = bandpass(noiseOf(108), () => 1900, 3), lp = lowpass2(4500);
    return make(d("wood-crack"), (t) => lp(bp(t)) * (e(t, 80) + 0.6 * (t > 0.045 ? e(t - 0.045, 90) : 0) + 0.4 * (t > 0.11 ? e(t - 0.11, 70) : 0)) + 0.5 * sine(260, t) * e(t, 45)); };
  R["drawer-slide"] = () => { const T = d("drawer-slide"), bp = bandpass(noiseOf(109), (t) => 280 + 260 * (t / T), 0.9), lp = lowpass2(1200);
    return make(T, (t) => lp(bp(t)) * (0.55 + 0.45 * sine(23, t)) * Math.min(1, t / 0.05) * (t < T - 0.07 ? 1 : 0.3) + (t > T - 0.07 ? 0.7 * sine(140, t) * e(t - (T - 0.07), 60) : 0)); };
  R["door-knock"] = () => make(d("door-knock"), (t) => { let s = 0; [0, 0.17, 0.34].forEach((at, k) => { const x = t - at; if (x >= 0) s += (0.9 - k * 0.1) * (sine(190, x) * e(x, 40) + 0.5 * sine(430, x) * e(x, 70) + 0.2 * sine(80, x) * e(x, 25)); }); return s; });

  // ---- metal
  const struck = (f, parts, decay) => (x) => x < 0 ? 0 : parts.reduce((s, [m, a, k]) => s + a * sine(f * m, x) * e(x, decay * k), 0) * Math.min(1, x / 0.001);
  R["metal-clang"] = () => { const s = struck(420, [[1, 1, 1], [2.32, 0.8, 1.2], [4.25, 0.6, 1.5], [6.63, 0.4, 1.8], [9.38, 0.25, 2.2]], 4.5); return make(d("metal-clang"), (t) => s(t)); };
  R["anvil-ting"] = () => { const s = struck(1900, [[1, 1, 1], [2.76, 0.5, 1.3], [5.4, 0.3, 1.8], [8.9, 0.15, 2.4]], 6); return make(d("anvil-ting"), (t) => s(t) + 0.3 * sine(95, t) * e(t, 40)); };
  R["chain-rattle"] = () => { const bp = bandpass(noiseOf(110), () => 3300, 3), h = sumHits(hits(111, 16, 0, 0.62), 0.12, (x, p) => (sine(2200 * p, x) * 0.5 + 0.8 * bp(x)) * e(x, 55));
    return make(d("chain-rattle"), (t) => h(t)); };
  R["can-tap"] = () => { const n = noiseOf(112); return make(d("can-tap"), (t) => (sine(1480, t) + 0.5 * sine(2290, t) + 0.3 * sine(3120, t)) * e(t, 55) + 0.3 * n() * e(t, 600)); };
  R["key-jingle"] = () => { const h = sumHits(hits(113, 11, 0, 0.55), 0.2, (x, p) => (sine(4200 * p, x) + 0.4 * sine(6900 * p, x)) * e(x, 22)); return make(d("key-jingle"), (t) => h(t)); };

  // ---- cloth
  R["cloth-rustle"] = () => { const T = d("cloth-rustle"), bp = bandpass(noiseOf(114), () => 2100, 0.6), lp = lowpass2(5000);
    return make(T, (t) => lp(bp(t)) * (0.35 + 0.65 * Math.abs(sine(11, t) * sine(5.3, t + 0.2))) * sin2(t, T)); };
  R["zipper-pull"] = () => { const T = d("zipper-pull"), bp = bandpass(noiseOf(115), () => 3200, 2.5);
    return make(T, (t) => { const ph = (t * (70 + 110 * (t / T))) % 1; return bp(t) * (ph < 0.18 ? 1 : 0.12) * (0.6 + 0.4 * (t / T)) * Math.min(1, t / 0.02) * Math.min(1, (T - t) / 0.03); }); };
  R["velcro-rip"] = () => { const T = d("velcro-rip"), r = rng(116), bp = bandpass(noiseOf(117), () => 1700, 1.2);
    return make(T, (t) => { const on = r() < 0.07 ? 1 : 0; return bp(t) * (0.25 + 1.4 * on) * sin2(t, T) * 0.8; }); };
  R["fabric-flap"] = () => { const T = d("fabric-flap"), lp = lowpass2(1100), n = noiseOf(118);
    return make(T, (t) => lp(n()) * sin2(t, T) * (0.5 + 0.5 * Math.abs(sine(16, t))) + 0.4 * sine(70, t) * e(t, 14)); };

  // ---- paper
  R["paper-crumple"] = () => { const T = d("paper-crumple"), r = rng(119), lp = lowpass2(6000), hp = highpass1(1200);
    return make(T, (t) => { const g = r() < 0.035 + 0.04 * (1 - t / T) ? (r() * 2 - 1) : 0; return lp(hp(g * 3 + (r() * 2 - 1) * 0.15)) * Math.pow(1 - t / T, 0.7) * Math.min(1, t / 0.01); }); };
  R["paper-tear"] = () => { const T = d("paper-tear"), bp = bandpass(noiseOf(120), (t) => 2400 + 1600 * (t / T), 0.9), lp = lowpass2(6000);
    return make(T, (t) => lp(bp(t)) * (0.55 + 0.45 * Math.sign(sine(85, t))) * sin2(t, T)); };
  R["scribble-pen"] = () => { const T = d("scribble-pen"), bp = bandpass(noiseOf(121), () => 4200, 1.4), lp = lowpass2(7000);
    return make(T, (t) => lp(bp(t)) * (0.4 + 0.6 * Math.abs(((t * 7.5) % 1) * 2 - 1)) * Math.min(1, t / 0.03) * Math.min(1, (T - t) / 0.05)); };

  // ---- glass
  R["glass-clink"] = () => make(d("glass-clink"), (t) => (sine(3150, t) * e(t, 11) + 0.7 * sine(4730, t) * e(t, 16) + 0.3 * sine(6300, t) * e(t, 24)) * Math.min(1, t / 0.0008));
  R["cork-pop"] = () => { const o = osc((t) => 140 + 900 * e(t, 55)), bp = bandpass(noiseOf(122), () => 900, 1.5);
    return make(d("cork-pop"), (t) => o(t) * e(t, 28) + 0.4 * bp(t) * e(t, 70)); };
  R["glass-break"] = () => { const T = d("glass-break"), n = noiseOf(123), hp = highpass1(2500), sh = sumHits(hits(124, 34, 0.02, 0.8), 0.25, (x, p) => sine(3000 * p + 1500 * p * p, x) * e(x, 28));
    return make(T, (t) => hp(n()) * e(t, 22) * 0.9 + 0.5 * sh(t) * (0.5 + 0.5 * (1 - t / T))); };

  // ---- food
  R["crunch"] = () => { const lp = lowpass2(3800), n = noiseOf(125), starts = [0, 0.05, 0.115, 0.17];
    return make(d("crunch"), (t) => { let s = 0; for (const a of starts) { const x = t - a; if (x >= 0) s += lp(n()) * e(x, 70) * 1.3 + 0.2 * sine(210 + a * 400, x) * e(x, 60); } return s; }); };
  R["slurp"] = () => { const T = d("slurp"), bp = bandpass(noiseOf(126), (t) => 1200 - 800 * Math.sin((Math.PI * t) / T) + 900 * (t / T), 3), o = osc((t) => 380 + 1100 * Math.pow(t / T, 3));
    return make(T, (t) => bp(t) * sin2(t, T) * 1.2 + 0.35 * o(t) * Math.pow(t / T, 4)); };
  R["soda-fizz"] = () => { const T = d("soda-fizz"), r = rng(127), hp = highpass1(4200), lp = lowpass2(9000);
    return make(T, (t) => lp(hp(r() * 2 - 1)) * (0.2 + 0.8 * e(t, 2.2)) * (0.5 + 0.5 * (r() < 0.5 ? 1 : 0.6)) * Math.min(1, t / 0.01) + (t < 0.12 ? 0.5 * sine(600 - 2000 * t, t) * e(t, 20) : 0)); };
  R["knife-chop"] = () => { const n = noiseOf(128), lp = lowpass2(2200); return make(d("knife-chop"), (t) => sine(150, t) * e(t, 45) + lp(n()) * e(t, 90) * 0.8 + 0.25 * sine(2600, t) * e(t, 160)); };
  R["egg-crack"] = () => { const bp = bandpass(noiseOf(129), () => 2800, 3), n = noiseOf(130), lp = lowpass2(1500);
    return make(d("egg-crack"), (t) => bp(t) * (e(t, 130) + 0.5 * (t > 0.04 ? e(t - 0.04, 120) : 0)) + 0.5 * lp(n()) * (t > 0.09 ? e(t - 0.09, 22) * 0.4 : 0)); };

  // ---- animals
  R["bird-chirp"] = () => make(d("bird-chirp"), (() => { const os = [osc((t) => 3100 + 1800 * clamp01(t / 0.07) + 80 * sine(40, t)), osc((t) => 3500 + 1500 * clamp01(t / 0.06)), osc((t) => 4300 - 1300 * clamp01(t / 0.09))];
    return (t) => { let s = 0; [0, 0.15, 0.3].forEach((at, k) => { const x = t - at; const v = os[k](Math.max(x, 0)); if (x >= 0 && x < 0.11) s += v * Math.sin((Math.PI * x) / 0.11); }); return s; }; })());
  R["meow"] = () => { const T = d("meow"), f = (t) => 520 + 380 * sin2(t, T) + 20 * sine(6, t), o = osc(f), o2 = osc((t) => 2 * f(t)), o3 = osc((t) => 3 * f(t)), lp = lowpass2(2600);
    return make(T, (t) => lp(o(t) + 0.55 * o2(t) + 0.3 * o3(t)) * sin2(t, T) * (1 - 0.3 * (t / T))); };
  R["frog-croak"] = () => { const T = d("frog-croak"), o = osc((t) => 150 + 30 * sine(3, t)), lp = lowpass2(1400);
    return make(T, (t) => lp(o(t) * (0.5 + 0.5 * Math.sign(sine(26, t))) + 0.3 * sine(300, t)) * sin2(t, T)); };
  R["cricket"] = () => make(d("cricket"), (t) => { let s = 0; [0, 0.2, 0.4, 0.6].forEach((at) => { const x = t - at; if (x >= 0 && x < 0.13) s += sine(4600, x) * (0.5 + 0.5 * Math.sign(sine(75, x))) * Math.sin((Math.PI * x) / 0.13); }); return s; });
  R["bee-buzz"] = () => { const T = d("bee-buzz"), o = osc((t) => 190 + 22 * sine(4, t)), o2 = osc((t) => 380 + 44 * sine(4, t)), lp = lowpass2(1800);
    return make(T, (t) => lp(o(t) + 0.5 * o2(t) + 0.3 * Math.sign(o(t))) * (0.6 + 0.4 * sine(95, t)) * Math.min(1, t / 0.1) * Math.min(1, (T - t) / 0.2)); };

  // ---- vehicles
  R["car-horn"] = () => { const T = d("car-horn"), lp = lowpass2(2600); return make(T, (t) => lp(Math.sign(sine(440, t)) + 0.9 * Math.sign(sine(554, t))) * Math.min(1, t / 0.01) * Math.min(1, (T - t) / 0.06)); };
  R["bike-bell"] = () => make(d("bike-bell"), (t) => { const b = (at) => { const x = t - at; return x < 0 ? 0 : (sine(2750, x) + 0.6 * sine(3100, x) * e(x, 4) + 0.3 * sine(5400, x)) * e(x, 7) * Math.min(1, x / 0.001); }; return b(0) + 0.9 * b(0.17); });
  R["engine-rev"] = () => { const T = d("engine-rev"), o = osc((t) => 55 + 120 * Math.pow(t / T, 1.4) + 6 * sine(31, t)), lp = lowpass2(1600);
    return make(T, (t) => lp(Math.tanh(2.2 * o(t)) + 0.4 * Math.sign(o(t))) * Math.min(1, t / 0.06) * Math.min(1, (T - t) / 0.25)); };
  R["train-whistle"] = () => { const T = d("train-whistle"), n = noiseOf(131), bp = bandpass(n, () => 1500, 2);
    return make(T, (t) => { const fall = 1 - 0.07 * clamp01((t - 0.9) / 0.4); return (sine(560 * fall, t) + 0.8 * sine(700 * fall, t) + 0.35 * bp(t)) * (0.85 + 0.15 * sine(6, t)) * Math.min(1, t / 0.05) * Math.min(1, (T - t) / 0.25); }); };
  R["brake-squeal"] = () => { const T = d("brake-squeal"), o = osc((t) => 2900 - 700 * (t / T) + 50 * sine(9, t)), o2 = osc((t) => 5900 - 1400 * (t / T)), n = noiseOf(132), lp = lowpass2(6000);
    return make(T, (t) => (o(t) + 0.4 * o2(t) + 0.25 * lp(n())) * (0.6 + 0.4 * sine(23, t)) * Math.sin((Math.PI * t) / T) * 0.9); };

  // ---- household
  R["doorbell"] = () => make(d("doorbell"), (t) => { const b = (at, f) => { const x = t - at; return x < 0 ? 0 : (sine(f, x) + 0.35 * sine(2 * f, x) * e(x, 5)) * e(x, 3.4) * Math.min(1, x / 0.002); }; return b(0, 740) + b(0.45, 587); });
  R["alarm-ring"] = () => make(d("alarm-ring"), (t) => { const x = t % 0.25; return x < 0.11 ? (Math.sign(sine(1500, t)) * 0.6 + sine(3000, t) * 0.3) * Math.min(1, x / 0.004) * Math.min(1, (0.11 - x) / 0.01) * (t < 0.98 ? 1 : 0) : 0; });
  R["kettle-whistle"] = () => { const T = d("kettle-whistle"), n = noiseOf(133), bp = bandpass(n, () => 2400, 8);
    return make(T, (t) => (sine(2250 + 160 * clamp01(t / 0.6) + 25 * sine(7, t), t) * 0.8 + 1.4 * bp(t)) * Math.min(1, t / 0.2) * Math.min(1, (T - t) / 0.25)); };
  R["microwave-ding"] = () => make(d("microwave-ding"), (t) => (sine(2400, t) + 0.2 * sine(4800, t) * e(t, 6)) * e(t, 3.2) * Math.min(1, t / 0.003));
  R["toaster-pop"] = () => { const n = noiseOf(134), lp = lowpass2(900); return make(d("toaster-pop"), (t) => sine(95 + 700 * e(t, 30), t) * e(t, 14) * 0.9 + sine(420 * (1 + 0.3 * sine(31, t)), t) * (t > 0.05 && t < 0.25 ? e(t - 0.05, 12) * 0.45 : 0) + 0.5 * lp(n()) * e(t, 55)); };

  // ---- electronics
  R["phone-buzz"] = () => make(d("phone-buzz"), (t) => { const x = t % 0.4; return x < 0.28 && t < 0.8 ? (Math.sign(sine(175, t)) * 0.7 + sine(350, t) * 0.4) * Math.min(1, x / 0.01) * Math.min(1, (0.28 - x) / 0.02) : 0; });
  R["camera-shutter"] = () => { const bp = bandpass(noiseOf(135), () => 2300, 2); return make(d("camera-shutter"), (t) => bp(t) * (e(t, 260) + 0.9 * (t > 0.09 ? e(t - 0.09, 200) : 0)) + 0.4 * sine(700, t) * e(t, 120) + 0.35 * (t > 0.09 ? sine(480, t) * e(t - 0.09, 130) : 0)); };
  R["typing"] = () => { const bp = bandpass(noiseOf(136), () => 2600, 2.5), h = sumHits(hits(137, 9, 0, 0.78), 0.06, (x, p) => (bp(x * 7) + 0.8 * sine(1100 * p, x)) * e(x, 140)); return make(d("typing"), (t) => h(t)); };
  R["power-up"] = () => { const T = d("power-up"), o = osc((t) => 220 * Math.pow(8, t / T)), o2 = osc((t) => 440 * Math.pow(8, t / T)); return make(T, (t) => (o(t) + 0.4 * o2(t)) * Math.pow(Math.sin((Math.PI * t) / T * 0.5 + 0.2), 2) * Math.min(1, (T - t) / 0.08)); };
  R["power-down"] = () => { const T = d("power-down"), o = osc((t) => 1300 * Math.pow(0.06, t / T)), o2 = osc((t) => 650 * Math.pow(0.06, t / T)); return make(T, (t) => (o(t) + 0.5 * o2(t)) * e(t, 2.2) * Math.min(1, t / 0.01)); };
  R["static-burst"] = () => { const T = d("static-burst"), r = rng(138); return make(T, (t) => (r() * 2 - 1) * (r() < 0.5 ? 1 : 0.25) * Math.sin((Math.PI * t) / T) * (0.5 + 0.5 * Math.sign(sine(23, t)))); };
  R["notify-ding"] = () => make(d("notify-ding"), (t) => { const b = (at, f) => { const x = t - at; return x < 0 ? 0 : sine(f, x) * e(x, 9) * Math.min(1, x / 0.002); }; return b(0, 988) + 0.9 * b(0.11, 1319); });
  R["low-battery"] = () => make(d("low-battery"), (t) => { const b = (at, f) => { const x = t - at; return x < 0 || x > 0.14 ? 0 : (sine(f, x) + 0.25 * sine(3 * f, x)) * Math.min(1, x / 0.004) * Math.min(1, (0.14 - x) / 0.02); }; return b(0, 1000) + b(0.2, 800) + b(0.4, 600); });

  // ---- nature
  R["wind-gust"] = () => { const T = d("wind-gust"), bp = bandpass(noiseOf(139), (t) => 350 + 700 * sin2(t, T) + 120 * sine(2.3, t), 0.9), lp = lowpass2(2400);
    return make(T, (t) => lp(bp(t)) * sin2(t, T) * (0.8 + 0.2 * sine(5, t))); };
  R["thunder-rumble"] = () => { const T = d("thunder-rumble"), n = noiseOf(140), lp = lowpass2(170), lp2 = lowpass2(420), cr = noiseOf(141), bp = bandpass(cr, () => 2000, 1);
    return make(T, (t) => (lp(n()) * 3.2 + lp2(n()) * 0.8) * Math.min(1, t / 0.25) * e(t, 1.3) * (0.7 + 0.3 * sine(7, t)) + 0.4 * bp(t) * (t < 0.2 ? e(t, 18) : 0)); };
  R["leaf-rustle"] = () => { const T = d("leaf-rustle"), r = rng(142), lp = lowpass2(7000), hp = highpass1(2500);
    return make(T, (t) => lp(hp(r() < 0.08 ? (r() * 2 - 1) * 2 : (r() * 2 - 1) * 0.1)) * (0.4 + 0.6 * Math.abs(sine(6, t))) * sin2(t, T)); };
  R["fire-crackle"] = () => { const T = d("fire-crackle"), n = noiseOf(143), lp = lowpass2(700), bp = bandpass(noiseOf(144), () => 2600, 2), h = sumHits(hits(145, 18, 0, T - 0.05), 0.05, (x, p) => bp(x * 11 + p) * e(x, 110) * 2);
    return make(T, (t) => 0.5 * lp(n()) * (0.6 + 0.4 * sine(3, t)) * Math.min(1, t / 0.1) * Math.min(1, (T - t) / 0.2) + h(t)); };

  // ---- interface and games
  R["success-fanfare"] = () => make(d("success-fanfare"), (t) => [[0, 523], [0.1, 659], [0.2, 784], [0.3, 1047]].reduce((s, [at, f]) => s + pluck(t, at, f, 4.5) * (at === 0.3 ? 1.4 : 1), 0));
  R["error-buzz"] = () => { const lp = lowpass2(1400); return make(d("error-buzz"), (t) => { const x = t % 0.2; return t < 0.38 && x < 0.15 ? lp(Math.sign(sine(115, t)) + 0.6 * Math.sign(sine(173, t))) * Math.min(1, x / 0.005) * Math.min(1, (0.15 - x) / 0.01) : 0; }); };
  R["level-up"] = () => make(d("level-up"), (t) => [523, 587, 659, 784, 880, 1047].reduce((s, f, k) => s + pluck(t, k * 0.1, f, 4) * (k === 5 ? 1.5 : 0.9), 0));
  R["toggle-on"] = () => { const o = osc((t) => 520 + 520 * clamp01(t / 0.05)); return make(d("toggle-on"), (t) => o(t) * Math.sin((Math.PI * t) / d("toggle-on")) + 0.3 * sine(2200, t) * e(t, 220)); };
  R["swipe"] = () => { const T = d("swipe"), hp = highpass1(1800), bp = bandpass(noiseOf(146), (t) => 4800 - 2600 * (t / T), 0.8); return make(T, (t) => hp(bp(t)) * Math.pow(Math.sin((Math.PI * t) / T), 1.2)); };
  R["sparkle"] = () => { const h = sumHits(hits(147, 22, 0, 0.7), 0.22, (x, p) => (sine(4600 * p + 900 * p * p, x) + 0.3 * sine(7400 * p, x)) * e(x, 20) * Math.min(1, x / 0.001)); return make(d("sparkle"), (t) => h(t)); };
  R["countdown-beep"] = () => make(d("countdown-beep"), (t) => (sine(1000, t) + 0.3 * sine(3000, t)) * Math.min(1, t / 0.004) * Math.min(1, (d("countdown-beep") - t) / 0.03));

  // ---- body
  R["heartbeat"] = () => make(d("heartbeat"), (t) => { const b = (at, f, a) => { const x = t - at; return x < 0 ? 0 : a * sine(f * (1 + 0.4 * e(x, 30)), x) * e(x, 22) * Math.min(1, x / 0.004); }; return b(0, 62, 1) + b(0.2, 52, 0.8) + b(0.8 - 0.2 * 0, 62, 0.001); });
  R["footstep"] = () => { const n = noiseOf(148), lp = lowpass2(420); return make(d("footstep"), (t) => (lp(n()) * 2.2 + sine(82 - 40 * t, t)) * e(t, 28) * Math.min(1, t / 0.004)); };
  R["clap-hands"] = () => { const bp = bandpass(noiseOf(149), () => 1450, 1.2); return make(d("clap-hands"), (t) => bp(t) * (e(t, 260) * 0.9 + (t > 0.012 ? e(t - 0.012, 200) * 0.8 : 0) + (t > 0.024 ? e(t - 0.024, 40) * 0.6 : 0))); };
  R["finger-snap"] = () => { const bp = bandpass(noiseOf(150), () => 2700, 4); return make(d("finger-snap"), (t) => bp(t) * e(t, 120) * 1.1 + 0.6 * sine(1200, t) * e(t, 140) + 0.4 * sine(300, t) * e(t, 80)); };

  // ---- cartoon
  R["bonk"] = () => { const o = osc((t) => 520 * e(t, 7) + 130), n = noiseOf(151), lp = lowpass2(2000); return make(d("bonk"), (t) => o(t) * e(t, 11) + 0.4 * lp(n()) * e(t, 90)); };
  R["slide-whistle-up"] = () => { const T = d("slide-whistle-up"), o = osc((t) => 300 * Math.pow(6.5, Math.pow(t / T, 1.2)) * (1 + 0.025 * sine(7, t))); return make(T, (t) => o(t) * Math.min(1, t / 0.02) * Math.min(1, (T - t) / 0.08)); };
  R["drum-roll"] = () => { const T = d("drum-roll"), n = noiseOf(152), bp = bandpass(n, () => 1900, 1.1), lp = lowpass2(5000);
    return make(T, (t) => { const ph = (t * (14 + 22 * (t / T))) % 1; return (lp(bp(t)) * e(ph, 9) + 0.4 * sine(190, t) * e(ph, 12)) * (0.5 + 0.5 * (t / T)); }); };
  R["cymbal-crash"] = () => { const T = d("cymbal-crash"), n = noiseOf(153), hp = highpass1(3500), lp = lowpass2(11000);
    return make(T, (t) => (lp(hp(n())) * 1.0 + 0.2 * [3.1, 4.7, 6.2, 8.4].reduce((s, m) => s + sine(1130 * m, t) * e(t, 3), 0)) * e(t, 2.4) * Math.min(1, t / 0.002)); };
  // the bright noise sounds are rounded off after the fact (the same ear test as every sound: tests/sfx.test.ts, under 12 % of a sound above 9 kHz)
  const SOFTEN = { "water-splash": 5000, "chain-rattle": 4800, "zipper-pull": 5500, "velcro-rip": 3600, "paper-crumple": 4500, "scribble-pen": 6000, "glass-break": 5500, "crunch": 4300,
    "soda-fizz": 3800, "egg-crack": 5500, "static-burst": 3000, "thunder-rumble": 4000, "leaf-rustle": 3800, "fire-crackle": 4500, "swipe": 3600, "clap-hands": 5500, "cymbal-crash": 4200 };
  for (const [name, fc] of Object.entries(SOFTEN)) { const f = R[name]; R[name] = () => { const lp = lowpass2(fc), b = f(); for (let i = 0; i < b.length; i++) b[i] = lp(b[i]); return b; }; }
  return R;
}
