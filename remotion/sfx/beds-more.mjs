// The music beds of the 2026-11-23 catalog growth (B48: "rule first, catalog follows"): 20 loops, each with a key, a tempo, a rhythm and voices of its own, made from
// the same voices as sfx/music.mjs (which hands them in): sines, struck tones, noise bursts, a saw/square synth, a kick and an echo, seeded, no samples. Each is a
// whole number of bars and wraps at its end (no seam). They are OPEN (scripts/soundHash.mjs) until ian approves them; the approved beds (bed-calm, bed-tech) never change.
// Each maker returns the loop; src/catalog.ts MUSIC holds its `dur` (bars x beats per bar x 60 / bpm) and its levels.
export function moreBeds(H) {
  const { note, strike, burst, synth, kick, echo, pump, mixInto, lowpass, rng, SR } = H;
  const QUAL = { maj: [0, 4, 7], min: [0, 3, 7], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], d7: [0, 4, 7, 10], sus: [0, 5, 7], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14] };
  const ch = (root, q) => QUAL[q].map((i) => root + i);
  /** Builds a loop of `bars` bars of `bpb` beats at `bpm` and calls `bar(ctx)` for each; `ctx.chord` is bar b of `prog` (a list of [root, quality]). */
  const bed = (bpm, bars, prog, bar, { bpb = 4, post = (b) => b } = {}) => () => {
    const beat = 60 / bpm, buf = new Float32Array(Math.round(bars * bpb * beat * SR));
    for (let b = 0; b < bars; b++) { const [root, q] = prog[b % prog.length]; bar({ buf, b, beat, bar: bpb * beat, at: b * bpb * beat, eighth: beat / 2, six: beat / 4, root, chord: ch(root, q), bars }); }
    return post(buf);
  };
  const R = {};

  // ---- soft and slow
  R["bed-lullaby"] = bed(72, 8, [[60, "maj"], [55, "maj"], [57, "min"], [52, "min"]], (c) => {            // C G Am Em: a music box (high struck tones) over a warm pad, for bedtime facts and small things
    c.chord.forEach((m, k) => note(c.buf, c.at + k * 0.02, m, c.bar - 0.2, 0.07, { attack: 1.0, release: 1.0 }));
    [0, 1, 2, 1, 0, 1, 2, 1].forEach((i, k) => strike(c.buf, c.at + k * c.beat * 0.5, c.chord[i] + 24, 0.09, 3.4, 0.1));
  }, { post: (b) => lowpass(b, 3600) });
  R["bed-dream"] = bed(66, 8, [[62, "maj7"], [59, "m7"], [55, "maj7"], [57, "d7"]], (c) => {                // D Bm G A: long glassy pads and a few bell sparkles, no drums, for big or strange ideas
    c.chord.forEach((m, k) => note(c.buf, c.at + k * 0.03, m, c.bar - 0.1, 0.06, { attack: 1.4, release: 1.4, octave: 0.4 }));
    note(c.buf, c.at, c.root - 24, c.bar - 0.3, 0.18, { attack: 0.8, release: 1.0, octave: 0.05 });
    [[0.5, 3], [1.75, 2], [3.0, 1]].forEach(([k, i]) => strike(c.buf, c.at + k * c.beat, c.chord[i % c.chord.length] + 24, 0.06, 1.6, 0.3));
  }, { post: (b) => lowpass(b, 3000) });
  R["bed-sleepy"] = bed(60, 8, [[53, "maj"], [48, "maj"], [50, "min"], [58, "maj"]], (c) => {                // F C Dm Bb at 60 BPM: two slow pads and one soft low note per bar
    c.chord.forEach((m, k) => note(c.buf, c.at + k * 0.04, m - 12, c.bar - 0.1, 0.12, { attack: 1.6, release: 1.6, octave: 0.1 }));
    strike(c.buf, c.at + 2 * c.beat, c.chord[2] + 12, 0.07, 2.4, 0.1);
  }, { post: (b) => lowpass(b, 1500) });
  R["bed-rainy"] = bed(70, 8, [[57, "min"], [50, "min"], [55, "maj"], [60, "maj"]], (c) => {              // Am Dm G C: a slow piano line high up, the pad low, long gaps, for sad, quiet or gentle topics
    c.chord.forEach((m, k) => note(c.buf, c.at + k * 0.02, m - 12, c.bar - 0.2, 0.1, { attack: 1.2, release: 1.2, octave: 0.1 }));
    [[0, 2], [1.5, 1], [2.5, 2], [3.5, 0]].forEach(([k, i]) => strike(c.buf, c.at + k * c.beat, c.chord[i] + 12, 0.13, 2.6, 0.2));
  }, { post: (b) => lowpass(b, 2200) });
  R["bed-minimal"] = bed(100, 8, [[48, "sus"]], (c) => {                                                  // one C drone and a pentatonic pluck that never repeats a bar, for plain facts that need no mood
    note(c.buf, c.at, 36, c.bar - 0.05, 0.22, { attack: 0.5, release: 0.5, octave: 0.2 });
    const pent = [60, 62, 64, 67, 69, 72], r = rng(401 + c.b * 7);
    for (let k = 0; k < 8; k++) if (r() < 0.45) strike(c.buf, c.at + k * c.eighth, pent[Math.floor(r() * pent.length)] + 12, 0.1, 4.2, 0.15);
  }, { post: (b) => lowpass(b, 2800) });

  // ---- warm, grooving
  R["bed-lofi"] = bed(78, 8, [[53, "maj7"], [52, "m7"], [50, "m7"], [55, "d7"]], (c) => {                  // Fmaj7 Em7 Dm7 G7: dusty electric-piano chords, a lazy kick and snare, a swung hat, for study and slow explanations
    const rand = rng(411 + c.b);
    [[0, 0.55], [1.5, 0.4], [2.75, 0.5]].forEach(([k, g]) => c.chord.forEach((m, j) => strike(c.buf, c.at + k * c.beat + j * 0.012, m + 12, 0.07 * g, 3, 0.35)));
    strike(c.buf, c.at, c.root - 24, 0.2, 4.5, 0.2);
    [0, 2.5].forEach((k) => kick(c.buf, c.at + k * c.beat, 0.15));
    [1, 3].forEach((k) => burst(c.buf, c.at + k * c.beat, 0.09, 0.06, rand, 30));
    for (let k = 0; k < 8; k++) burst(c.buf, c.at + k * c.eighth + (k % 2 ? c.eighth * 0.18 : 0), 0.02, 0.02, rand, 150);
  }, { post: (b) => lowpass(b, 1800) });
  R["bed-groove"] = bed(92, 8, [[50, "m9"], [55, "d7"], [48, "maj7"], [53, "maj7"]], (c) => {              // Dm9 G7 Cmaj7 Fmaj7: syncopated chord stabs, a walking bass and brushes, a late-night jazz feel, for people and habits
    const rand = rng(421 + c.b);
    [0.5, 1.5, 2.5, 3.25].forEach((k) => c.chord.forEach((m, j) => strike(c.buf, c.at + k * c.beat + j * 0.01, m + 12, 0.06, 5, 0.3)));
    [0, 1, 2, 3].forEach((k, j) => strike(c.buf, c.at + k * c.beat, c.root - 12 + [0, 4, 7, 5][j], 0.15, 5.5, 0.2));
    for (let k = 0; k < 8; k++) burst(c.buf, c.at + k * c.eighth, 0.05, k % 2 ? 0.035 : 0.05, rand, 55);
  }, { post: (b) => lowpass(b, 2600) });
  R["bed-funk"] = bed(104, 8, [[52, "m7"], [52, "m7"], [57, "d7"], [55, "d7"]], (c) => {                   // Em7 Em7 A7 G7: a plucked sixteenth bass and muted chord scratches, claps on two and four
    const rand = rng(431 + c.b);
    [0, 3, 6, 7, 10, 12, 14].forEach((k) => strike(c.buf, c.at + k * c.six, c.root - 12 + (k === 7 || k === 14 ? 7 : 0), 0.16, 9, 0.2));
    [2, 5, 9, 11, 13, 15].forEach((k) => c.chord.forEach((m, j) => strike(c.buf, c.at + k * c.six + j * 0.006, m + 12, 0.045, 24, 0.3)));
    [1, 3].forEach((k) => burst(c.buf, c.at + k * c.beat, 0.07, 0.09, rand, 34));
    [0, 2].forEach((k) => kick(c.buf, c.at + k * c.beat, 0.14));
  }, { post: (b) => lowpass(b, 3200) });
  R["bed-disco"] = bed(116, 8, [[55, "min"], [48, "maj"], [53, "maj"], [58, "maj"]], (c) => {              // Gm C F Bb: octave-jumping bass in eighths, off-beat hats, a stab of strings on every bar's last half-beat
    const rand = rng(441 + c.b);
    for (let k = 0; k < 8; k++) synth(c.buf, c.at + k * c.eighth, c.root - 24 + (k % 2 ? 12 : 0), c.eighth * 0.8, 0.13, { decay: 8, harmonics: 4 });
    for (let k = 0; k < 4; k++) { kick(c.buf, c.at + k * c.beat, 0.15); burst(c.buf, c.at + k * c.beat + c.eighth, 0.03, 0.05, rand, 110); }
    c.chord.forEach((m, j) => synth(c.buf, c.at + 3.5 * c.beat + j * 0.005, m + 12, c.beat * 0.45, 0.05, { decay: 5, harmonics: 6 }));
  }, { post: (b) => lowpass(b, 2800) });

  // ---- bright and cheerful
  R["bed-picnic"] = bed(118, 8, [[53, "maj"], [58, "maj"], [60, "maj"], [53, "maj"]], (c) => {              // F Bb C F: pizzicato bass, a clap on two and four and a skipping staccato melody, for food and daylight
    const rand = rng(451 + c.b);
    [0, 2].forEach((k) => { strike(c.buf, c.at + k * c.beat, c.root - 12, 0.14, 8, 0.2); strike(c.buf, c.at + (k + 1) * c.beat, c.root - 12 + 7, 0.1, 8, 0.2); });
    [1, 3].forEach((k) => burst(c.buf, c.at + k * c.beat, 0.05, 0.07, rand, 38));
    [0, 1.5, 2, 3, 3.5].forEach((k, j) => strike(c.buf, c.at + k * c.beat, c.chord[[0, 2, 1, 2, 0][j]] + 24, 0.1, 7, 0.15));
  }, { post: (b) => lowpass(b, 4200) });
  R["bed-island"] = bed(100, 8, [[55, "maj"], [60, "maj"], [62, "maj"], [55, "maj"]], (c) => {              // G C D G: a ukulele-like down-up strum, a marimba answer and a shaker, for travel and holidays
    const rand = rng(461 + c.b);
    [0, 1.5, 2, 3, 3.5].forEach((k) => { const down = k % 1 === 0; (down ? c.chord : [...c.chord].reverse()).forEach((m, j) => note(c.buf, c.at + k * c.beat + j * 0.01, m + 12, 0.15, down ? 0.075 : 0.05, { pluck: true, octave: 0.2 })); });
    strike(c.buf, c.at, c.root - 12, 0.13, 5, 0.25);
    [[1, 2], [2.5, 1]].forEach(([k, i]) => strike(c.buf, c.at + k * c.beat, c.chord[i] + 24, 0.08, 5, 0.1));
    for (let k = 0; k < 8; k++) burst(c.buf, c.at + k * c.eighth, 0.025, k % 2 ? 0.03 : 0.045, rand, 100);
  }, { post: (b) => lowpass(b, 3400) });
  R["bed-march"] = bed(112, 8, [[48, "maj"], [53, "maj"], [55, "maj"], [48, "maj"]], (c) => {              // C F G C: a snare roll on the off-beats, a bass on one and three and a bugle-bright bell tune
    const rand = rng(471 + c.b);
    [0, 2].forEach((k) => strike(c.buf, c.at + k * c.beat, c.root - 12, 0.17, 7, 0.2));
    for (let k = 0; k < 8; k++) burst(c.buf, c.at + k * c.eighth, 0.04, k % 2 ? 0.07 : 0.04, rand, 70);
    [0, 0.75, 1, 2, 2.75, 3].forEach((k, j) => strike(c.buf, c.at + k * c.beat, c.chord[[0, 1, 2, 2, 1, 0][j]] + 24, 0.1, 3.4, 0.2));
  }, { post: (b) => lowpass(b, 3800) });
  R["bed-sparkle"] = bed(132, 8, [[57, "maj"], [50, "maj"], [52, "maj"], [57, "maj"]], (c) => {            // A D E A: fast bell arpeggios in sixteenths, claps on two and four, a pumping low note, for quick bright facts
    const rand = rng(481 + c.b);
    for (let k = 0; k < 16; k++) strike(c.buf, c.at + k * c.six, c.chord[[0, 1, 2, 1][k % 4]] + 24 + (k % 8 >= 4 ? 12 : 0), 0.06, 9, 0.1);
    [1, 3].forEach((k) => burst(c.buf, c.at + k * c.beat, 0.05, 0.07, rand, 40));
    for (let k = 0; k < 4; k++) strike(c.buf, c.at + k * c.beat, c.root - 24, 0.13, 8, 0.2);
  }, { post: (b) => lowpass(b, 4600) });
  R["bed-campfire"] = bed(88, 8, [[55, "maj"], [52, "min"], [48, "maj"], [50, "maj"]], (c) => {            // G Em C D: an unhurried guitar strum, a low drum thump and a long bass note, for stories and old habits
    [0, 1.5, 2.5, 3].forEach((k, j) => (j % 2 ? [...c.chord].reverse() : c.chord).forEach((m, i) => note(c.buf, c.at + k * c.beat + i * 0.018, m + 12, 0.35, j % 2 ? 0.05 : 0.08, { pluck: true, octave: 0.25 })));
    note(c.buf, c.at, c.root - 12, c.bar - 0.2, 0.2, { attack: 0.3, release: 0.7, octave: 0.1 });
    [0, 2].forEach((k) => kick(c.buf, c.at + k * c.beat, 0.1));
  }, { post: (b) => lowpass(b, 2500) });
  R["bed-train"] = bed(120, 8, [[50, "maj"], [55, "maj"], [57, "maj"], [50, "maj"]], (c) => {              // D G A D: a boom-chick shuffle: bass on one and three, brushed chops on two and four, a walking pluck
    const rand = rng(491 + c.b);
    [0, 2].forEach((k) => strike(c.buf, c.at + k * c.beat, c.root - 12 + (k ? 7 : 0), 0.16, 7, 0.2));
    [1, 3].forEach((k) => { burst(c.buf, c.at + k * c.beat, 0.07, 0.08, rand, 40); c.chord.forEach((m, j) => strike(c.buf, c.at + k * c.beat + j * 0.01, m + 12, 0.04, 14, 0.3)); });
    for (let k = 0; k < 4; k++) { burst(c.buf, c.at + k * c.beat + c.eighth * 0.66, 0.02, 0.03, rand, 130); strike(c.buf, c.at + k * c.beat + c.eighth * 0.66, c.chord[k % 3] + 12, 0.05, 9, 0.2); }
  }, { post: (b) => lowpass(b, 3600) });
  R["bed-waltz"] = bed(108, 8, [[50, "maj"], [57, "maj"], [59, "min"], [55, "maj"]], (c) => {              // D A Bm G in three: a bass on one, two soft chords, a bell turning over the bar, for classic or old-fashioned topics
    strike(c.buf, c.at, c.root - 12, 0.17, 5, 0.2);
    [1, 2].forEach((k) => c.chord.forEach((m, j) => strike(c.buf, c.at + k * c.beat + j * 0.01, m + 12, 0.06, 4, 0.3)));
    [0, 1, 2].forEach((k, j) => strike(c.buf, c.at + k * c.beat + c.eighth, c.chord[[2, 1, 0][j]] + 24, 0.07, 3.2, 0.1));
  }, { bpb: 3, post: (b) => lowpass(b, 3000) });

  // ---- technology and electronics
  R["bed-pulse"] = bed(124, 8, [[57, "min"], [53, "maj"], [48, "maj"], [55, "maj"]], (c) => {              // Am F C G: a four-on-the-floor kick, a saw bass in off-beat eighths and a breathing pad, for machines and systems
    const rand = rng(501 + c.b), pad = new Float32Array(c.buf.length);
    for (let k = 0; k < 4; k++) { kick(c.buf, c.at + k * c.beat, 0.18); synth(c.buf, c.at + k * c.beat + c.eighth, c.root - 24, c.eighth * 0.8, 0.14, { decay: 9, harmonics: 5 }); burst(c.buf, c.at + k * c.beat + c.eighth, 0.025, 0.04, rand, 120); }
    c.chord.forEach((m, j) => synth(pad, c.at + j * 0.01, m, c.bar - 0.05, 0.05, { decay: 0.4, harmonics: 5, release: 0.2 }));
    pump(pad, c.beat, 0.55); mixInto(c.buf, pad);
  }, { post: (b) => lowpass(b, 2400) });
  R["bed-orbit"] = bed(90, 8, [[52, "min"], [48, "maj"], [55, "maj"], [50, "maj"]], (c) => {              // Em C G D: slow triplet arpeggios of a soft synth with a long echo, a low pad, for space, scale and the unknown
    const lead = new Float32Array(c.buf.length);
    for (let k = 0; k < 12; k++) synth(lead, c.at + k * (c.beat / 3), c.chord[[0, 1, 2, 1][k % 4]] + 12 + (k >= 6 ? 12 : 0), c.beat / 3 * 0.9, 0.06, { decay: 8, harmonics: 3 });
    note(c.buf, c.at, c.root - 12, c.bar - 0.2, 0.22, { attack: 0.8, release: 1.0, octave: 0.1 });
    echo(lead, c.beat * 0.75, 0.55, 0.4, 3); mixInto(c.buf, lead);
  }, { post: (b) => lowpass(b, 2300) });
  R["bed-clockwork"] = bed(100, 8, [[48, "min"], [56, "maj"], [51, "maj"], [58, "maj"]], (c) => {         // Cm Ab Eb Bb: hollow ticks in eighths, a mallet ostinato in sixteenths and a dry bass, for mechanisms and time
    const rand = rng(511 + c.b);
    for (let k = 0; k < 8; k++) burst(c.buf, c.at + k * c.eighth, 0.012, k % 2 ? 0.05 : 0.09, rand, 260);
    for (let k = 0; k < 16; k++) strike(c.buf, c.at + k * c.six, c.chord[[0, 2, 1, 2][k % 4]] + 12, 0.06, 14, 0.3);
    [0, 2].forEach((k) => strike(c.buf, c.at + k * c.beat, c.root - 12, 0.15, 8, 0.2));
  }, { post: (b) => lowpass(b, 3200) });
  R["bed-boot"] = bed(136, 8, [[52, "min"], [48, "maj"], [50, "maj"], [47, "maj"]], (c) => {              // Em C D B at 136 BPM: a square-wave chip melody in eighths and a bass on every beat, a game that is starting up, for the digital and the fast
    const rand = rng(521 + c.b);
    [0, 1, 2, 1, 2, 3, 2, 1].forEach((i, k) => synth(c.buf, c.at + k * c.eighth, c.chord[i % c.chord.length] + 24, c.eighth * 0.7, 0.07, { decay: 12, harmonics: 7, square: true }));
    for (let k = 0; k < 4; k++) { synth(c.buf, c.at + k * c.beat, c.root - 24, c.beat * 0.5, 0.15, { decay: 9, harmonics: 3, square: true }); burst(c.buf, c.at + k * c.beat + c.eighth, 0.02, 0.04, rand, 150); }
    kick(c.buf, c.at, 0.16); kick(c.buf, c.at + 2 * c.beat, 0.16);
  }, { post: (b) => lowpass(b, 3000) });

  // ---- wonder and discovery
  R["bed-wonder"] = bed(84, 8, [[51, "maj"], [55, "min"], [56, "maj"], [58, "maj"]], (c) => {              // Eb Gm Ab Bb: a celesta-like theme that climbs across the bar over a wide pad, for a surprising fact
    c.chord.forEach((m, k) => note(c.buf, c.at + k * 0.03, m, c.bar - 0.1, 0.08, { attack: 0.9, release: 1.1 }));
    [0, 1, 2, 2.5, 3].forEach((k, j) => strike(c.buf, c.at + k * c.beat, c.chord[[0, 1, 2, 1, 2][j]] + 24 + (j === 4 ? 12 : 0), 0.09, 3.6, 0.1));
    strike(c.buf, c.at, c.root - 12, 0.14, 4, 0.25);
  }, { post: (b) => lowpass(b, 3200) });
  return R;
}
