"""Measures the music beds (PLAN-VARIETY stage 1): onset rate, spectral centroid, integrated loudness and the voice band (1 to 4 kHz) level at the
catalogue's mix level, next to bed-calm. Run from remotion/: python scripts/musicMeasure.py [out.md]

  onset rate   onsets per second (a spectral-flux peak picker on a 1024-sample STFT)
  centroid     the power-weighted mean frequency of the whole loop (Hz)
  loudness     integrated loudness (LUFS, EBU R128) from ffmpeg's ebur128 filter
  voice band   RMS of the 1 to 4 kHz band at the mix level (level x the wav), in dB, relative to bed-calm's
The tempo and the mode are written by hand from the synthesis in sfx/music.mjs (they are design facts, not measured here)."""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BEDS = {  # the design facts of each bed (sfx/music.mjs)
    "bed-calm": ("80", "Am F C G, minor, legacy"),
    "bed-tech": ("80", "Am F C G, minor, legacy"),
    "bed-sunny": ("120", "C G Am F, major"),
    "bed-bounce": ("120", "G D Em C, major"),
    "bed-glow": ("100", "D A Bm G, major"),
    "bed-curious": ("100", "Dm C Bb Am, Dorian (a major sixth on the minor chord)"),
}


def load(path):
    with wave.open(str(path)) as w:
        rate, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        raw = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768.0
    return rate, raw.reshape(-1, ch).mean(axis=1)


def onset_rate(x, rate, hop=512, win=1024):
    window = np.hanning(win)
    frames = [np.abs(np.fft.rfft(x[i:i + win] * window)) for i in range(0, len(x) - win, hop)]
    spec = np.log1p(np.array(frames) * 100)
    flux = np.maximum(np.diff(spec, axis=0), 0).sum(axis=1)
    # a local threshold: a frame counts when it is clearly above the median of the frames around it (about half a second each way), so a loud
    # clap does not hide the quiet notes, and every bed is measured the same way
    half = int(0.5 * rate / hop)
    peaks = []
    for i in range(1, len(flux) - 1):
        local = np.median(flux[max(0, i - half):i + half + 1])
        if flux[i] > 1.5 * local + 1e-3 and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1]:
            peaks.append(i)
    gap = int(0.08 * rate / hop)
    kept, last = [], -10**9
    for i in peaks:
        if i - last >= gap:
            kept.append(i)
            last = i
    return len(kept) / (len(x) / rate)


def centroid(x, rate):
    spec = np.abs(np.fft.rfft(x)) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / rate)
    return float((freqs * spec).sum() / spec.sum())


def loudness(path):
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.findall(r"I:\s+(-?[\d.]+)\s+LUFS", proc.stderr)
    return float(m[-1]) if m else None


def voice_band_db(x, rate, level):
    spec = np.abs(np.fft.rfft(x * level)) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / rate)
    band = spec[(freqs >= 1000) & (freqs <= 4000)]
    return 10 * np.log10(band.sum() / len(x) ** 2 + 1e-18)


def main():
    levels = json.loads(subprocess.run(["node", "-e", "import('./src/catalog.ts').then(m=>console.log(JSON.stringify(m.MUSIC)))"],
                                       cwd=ROOT, capture_output=True, text=True).stdout)
    rows, calm_band = [], None
    for name, (bpm, design) in BEDS.items():
        path = ROOT / "sfx" / "music" / f"{name}.wav"
        rate, x = load(path)
        level = levels[name]["level"]
        band = voice_band_db(x, rate, level)
        if name == "bed-calm":
            calm_band = band
        rows.append({"bed": name, "bpm": int(bpm), "design": design, "seconds": round(len(x) / rate, 2),
                     "onsets_per_s": round(onset_rate(x, rate), 2), "centroid_hz": round(centroid(x, rate)),
                     "lufs": loudness(path), "voice_band_db": round(band, 2)})
    for r in rows:
        r["voice_vs_calm_db"] = round(r["voice_band_db"] - calm_band, 2)
    lines = ["| bed | BPM | key and mode | loop (s) | onsets/s | centroid (Hz) | loudness (LUFS) | voice band 1-4 kHz vs bed-calm (dB) |",
             "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append(f"| {r['bed']} | {r['bpm']} | {r['design']} | {r['seconds']} | {r['onsets_per_s']} | {r['centroid_hz']} | {r['lufs']} | {r['voice_vs_calm_db']:+.2f} |")
    text = "\n".join(lines) + "\n"
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text, encoding="utf-8")
    print(text)
    print(json.dumps(rows, indent=1))


if __name__ == "__main__":
    main()
