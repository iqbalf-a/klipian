// node scripts/videoQa.mjs <video.mp4> [--breath 1.5]
// The machine checks of a finished video (B71, from lemo-opuscar's review loop): blank frames, frozen stretches, loudness and true peak.
//   black   ffmpeg blackdetect: any black stretch of 0.1 s or more is a FLAG (a blank frame in a transition, B58).
//   freeze  ffmpeg freezedetect: a stretch where nothing in the picture changes for `--breath` seconds (default 1.5) or more. DESIGN.md section 10 item 3 asks for
//           movement in every second; ONE stretch is the deliberate breath before the signature moment (B71) and passes, a second one is a FLAG.
//   sound   integrated loudness (target about -14 LUFS, ricks) and true peak (-1 dBTP at most after the AAC encode).
// Exit code 1 when anything is FLAGged. It never changes the video.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const args = process.argv.slice(2), file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--breath");
const breath = Number(args[args.indexOf("--breath") + 1]) || 1.5;
if (!file || !existsSync(file)) { console.error("usage: node scripts/videoQa.mjs <video.mp4> [--breath 1.5]"); process.exit(2); }
const ff = (a) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...a], { encoding: "utf8", maxBuffer: 1 << 26 }); if (r.error) { console.error("ffmpeg is not installed"); process.exit(2); } return r.stderr; };

const out = [], add = (level, what) => out.push({ level, what });

const blackLog = ff(["-i", file, "-vf", "blackdetect=d=0.1:pix_th=0.05", "-an", "-f", "null", "-"]);
const black = [...blackLog.matchAll(/black_start:([\d.]+).*?black_duration:([\d.]+)/g)].map((m) => ({ t: +m[1], d: +m[2] }));
add(black.length ? "FLAG" : "PASS", black.length ? `black: ${black.map((b) => `${b.t.toFixed(2)} s for ${b.d.toFixed(2)} s`).join("; ")}` : "black: no blank frame of 0.1 s or more");

const frozenLog = ff(["-i", file, "-vf", `freezedetect=n=-50dB:d=${breath}`, "-an", "-f", "null", "-"]);
const starts = [...frozenLog.matchAll(/freeze_start:\s*([\d.]+)/g)].map((m) => +m[1]), durs = [...frozenLog.matchAll(/freeze_duration:\s*([\d.]+)/g)].map((m) => +m[1]);
const freezes = starts.map((t, i) => ({ t, d: durs[i] ?? NaN }));
add(freezes.length <= 1 ? "PASS" : "FLAG", `freeze: ${freezes.length ? freezes.map((f) => `${f.t.toFixed(2)} s${Number.isFinite(f.d) ? ` for ${f.d.toFixed(2)} s` : " to the end"}`).join("; ") : `no still stretch of ${breath} s or more`}${freezes.length === 1 ? " (one deliberate breath is allowed)" : freezes.length > 1 ? ": one breath is allowed, the others are still screens (section 10 item 3)" : ""}`);

const ebu = ff(["-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]);
const sum = ebu.slice(ebu.lastIndexOf("Summary:"));
const lufs = Number(/\bI:\s+(-?[\d.]+)\s+LUFS/.exec(sum)?.[1]), peak = Number(/Peak:\s+(-?[\d.]+)\s+dBFS/.exec(sum)?.[1]);
if (!Number.isFinite(lufs)) add("INFO", "sound: no audio track or too quiet to measure");
else {
  add(Math.abs(lufs + 14) <= 1 ? "PASS" : "FLAG", `sound: ${lufs.toFixed(1)} LUFS (target about -14, within 1)`);
  add(!Number.isFinite(peak) || peak <= -1 ? "PASS" : "FLAG", `sound: true peak ${Number.isFinite(peak) ? peak.toFixed(1) + " dBTP" : "not measured"} (at most -1 after the encode)`);
}

for (const r of out) console.log(`${r.level.padEnd(5)} ${r.what}`);
process.exit(out.some((r) => r.level === "FLAG") ? 1 : 0);
