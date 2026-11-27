// The sound effects of the 2026-11-28 catalog growth (ian: "tambahkan bunyi baru ke katalog sfx", sources checked in the lemo-opuscar repo). The recipes are ported from
// that library's synthesis code (core/audio/sfx.py and the films' audio.py, MIT licence, see LICENSES.md): the brick click and clack, the creak, the rumble, the quindar beep,
// the rising pop, the bell ding, the transformer purr, the log drum and the plip. Its sample libraries are not used (third-party licences). Synthesised like every other sound
// here (sines, noise and filters, seeded, no samples); sfx/synth.mjs writes each file the same way (mono, 48 kHz, normalised to a 0.9 peak). The length of each sound is the
// `dur` of its row in src/catalog.ts. These sounds are OPEN (scripts/soundHash.mjs) until ian approves them; judge them by ear and say which to redo.
import { SFX, SFX_SAMPLE_RATE } from "../src/catalog.ts";

export function more3Recipes(H) {
  const { make, sine, osc, noiseOf, bandpass, lowpass1, lowpass2, highpass1, TAU } = H;
  const d = (name) => SFX[name].dur;
  const e = (t, tau) => Math.exp(-t / tau);                      // lemo's env_exp: decay with time constant tau (seconds)
  const R = {};

  // ---- bricks and toys (lemo sfx.py click / clack)
  const click = (name, seed, pitch) => () => {
    const hp = highpass1(2500), sm = lowpass2(6500), n = noiseOf(seed), ph = [0.3, 1.7, 3.1];
    return make(d(name), (t) => 0.8 * sm(hp(n())) * e(t, 0.0015) + [[2900, 0.6, 0.012], [4600, 0.4, 0.008], [1500, 0.35, 0.018]].reduce((s, [f, a, tau], i) => s + a * Math.sin(TAU * f * pitch * t + ph[i]) * e(t, tau), 0) + 0.5 * sine(190 * pitch, t) * e(t, 0.01));
  };
  R["brick-click"] = click("brick-click", 401, 1.0);
  R["brick-click-lo"] = click("brick-click-lo", 402, 0.7);
  const clack = (name, seed, pitch) => () => {
    const hp = highpass1(1200), sm = lowpass2(6500), n = noiseOf(seed);
    return make(d(name), (t) => sm(hp(n())) * e(t, 0.004) + [[1200, 0.6, 0.02], [2300, 0.5, 0.012], [380, 0.5, 0.03]].reduce((s, [f, a, tau]) => s + a * sine(f * pitch, t) * e(t, tau), 0));
  };
  R["brick-clack"] = clack("brick-clack", 403, 1.0);
  R["brick-clack-hi"] = clack("brick-clack-hi", 404, 1.3);
  R["brick-tumble"] = () => {                                        // lemo's crash, tamed: a handful of small clacks falling over each other, a soft low thud under them
    const lp = lowpass1(400), n = noiseOf(405), T = d("brick-tumble");
    const list = Array.from({ length: 12 }, (_, k) => [Math.pow(k / 12, 1.4) * 0.55, 0.45 + (0.4 * ((k * 7) % 5)) / 4, 0.85 + (0.5 * ((k * 3) % 4)) / 3]);
    return make(T, (t) => {
      let s = t < 0.25 ? 0.5 * lp(n()) * e(t, 0.05) : 0;
      for (const [at, a, p] of list) { const x = t - at; if (x >= 0 && x < 0.12) s += 0.5 * a * [[1200, 0.6, 0.02], [2300, 0.5, 0.012], [380, 0.5, 0.03]].reduce((q, [f, b, tau]) => q + b * sine(f * p, x) * e(x, tau), 0); }
      return s;
    });
  };

  // ---- a stick or a hinge that creaks, a low rumble
  R["stick-creak"] = () => {                                         // a saw whose pitch wobbles, band-passed, chopped into creaks
    const T = d("stick-creak"), hp = highpass1(400), lp = lowpass2(3000); let ph = 0;
    return make(T, (t) => { ph = (ph + (70 * (1 + 0.3 * sine(9, t))) / SFX_SAMPLE_RATE) % 1; return lp(hp(2 * ph - 1)) * Math.pow(Math.abs(sine(23, t)), 3) * Math.sin((Math.PI * t) / T); });
  };
  R["deep-rumble"] = () => {                                         // brown noise through a 200 Hz low-pass, swelling in
    const T = d("deep-rumble"), n = noiseOf(406), lp = lowpass1(200); let w = 0;
    return make(T, (t) => { w = w * 0.9995 + n() * 0.02; return lp(w) * 6 * Math.pow(Math.sin((Math.PI * t) / T / 2), 2) * Math.min(1, (T - t) / 0.3); });
  };

  // ---- tones
  R["quindar-tone"] = () => { const T = d("quindar-tone"); return make(T, (t) => sine(2525, t) * Math.min(1, t / 0.005) * Math.min(1, (T - t) / 0.005)); };
  R["sweep-pop"] = () => { const o = osc((t) => 500 + 1400 * (t / d("sweep-pop"))); return make(d("sweep-pop"), (t) => o(t) * e(t, 0.05)); };
  R["tiny-step"] = () => { const hp = highpass1(1800), sm = lowpass2(5500), n = noiseOf(407); return make(d("tiny-step"), (t) => sm(hp(n())) * e(t, 0.004) + 0.5 * sine(2200, t) * e(t, 0.006)); };
  R["ding-long"] = () => make(d("ding-long"), (t) => [[1318, 1, 0.6], [2637, 0.5, 0.35], [3951, 0.3, 0.2], [1976, 0.25, 0.5], [5274, 0.15, 0.1]].reduce((s, [f, a, tau]) => s + a * sine(f, t) * e(t, tau), 0) * Math.min(1, t / 0.002));
  R["purr-hum"] = () => {                                            // lemo's transformer purr: a 100 Hz buzz, low-passed, trembling at 25 Hz
    const T = d("purr-hum"), lp = lowpass2(700), hp = highpass1(80);
    return make(T, (t) => { let s = 0; for (let k = 1; k <= 12; k++) s += sine(100 * k, t) / k; return hp(lp(s)) * (0.55 + 0.45 * Math.pow(sine(25, t), 2)) * Math.min(1, t / 0.3) * Math.min(1, (T - t) / 0.4); });
  };

  // ---- log drums and plips (lemo's bakat-usaha film)
  const drum = (name, f) => () => { const o = osc((t) => f * (1 + 0.5 * Math.exp(-t / 0.03))); return make(d(name), (t) => o(t) * e(t, 0.12)); };
  R["log-drum-hi"] = drum("log-drum-hi", 190);
  R["log-drum-mid"] = drum("log-drum-mid", 130);
  R["log-drum-lo"] = drum("log-drum-lo", 90);
  const plip = (name, f) => () => { const o = osc((t) => f * (1 + 0.5 * Math.exp(-t / 0.02))); return make(d(name), (t) => o(t) * e(t, 0.05)); };
  R["plip-hi"] = plip("plip-hi", 1400);
  R["plip-mid"] = plip("plip-mid", 900);
  R["plip-lo"] = plip("plip-lo", 600);
  R["shaker-tick"] = () => { const hp = highpass1(2000), sm = lowpass2(3000), n = noiseOf(408); return make(d("shaker-tick"), (t) => sm(hp(n())) * e(t, 0.02)); };

  return R;
}
