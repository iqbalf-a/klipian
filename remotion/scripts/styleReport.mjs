// node scripts/styleReport.mjs <slug>              -> out/<slug>/style-report.md (one file for ian), out/<slug>/contact.png (a still of every beat),
//                                                     out/<slug>/loop.png (the first and last frames) and the numbers of the loop and the detail budget
// node scripts/styleReport.mjs <slug> --beside     -> also out/<slug>/beside.png: the golden row of pilot 1 above this video's row (judge "the same channel")
// node scripts/styleReport.mjs --reference         -> out/style/reference.png and out/style/golden/: pilot 1's golden frames and samples (the reference)
//
// The three "needs a render" lines of styleCheck are measured here (DESIGN.md section 0b, B6 and B16): the first and last frames (PSNR and SSIM, a
// pass at 30 dB or more), the hero's share of the width where the plan declares it (HERO_BOX_AT), and the detail budget table of scripts/detailBudget.mjs.
// Frames come from scripts/frames.mjs (one browser session); ffmpeg makes the sheets and the numbers.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const BESIDE = args.includes("--beside");
const REFERENCE = args.includes("--reference");
const slug = args.find((a) => !a.startsWith("--"));
const PSNR_PASS = 30;                                               // dB: the first and last frames match when the PSNR is at least this (a default; ian may change it)
const FPS = 30;

const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26, ...opts });
const frames = (comp, folder, times) => run(process.execPath, [path.join(ROOT, "scripts", "frames.mjs"), comp, folder, ...times.map((t) => t.toFixed(2))], { stdio: "inherit" });
const stamp = (t) => `t-${t.toFixed(2)}.png`;

/** Tiles PNG files in order into one sheet (cols per row), padded with the last frame to fill the grid. */
function sheet(files, out, cols = 4, width = 270) {
  const tmp = path.join(path.dirname(out), `.tile-${path.basename(out, ".png")}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const n = Math.ceil(files.length / cols) * cols;
  for (let i = 0; i < n; i++) copyFileSync(files[Math.min(i, files.length - 1)], path.join(tmp, `${String(i + 1).padStart(2, "0")}.png`));
  const rows = n / cols;
  run("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-start_number", "1", "-i", path.join(tmp, "%02d.png"), "-vf", `scale=${width}:-2,tile=${cols}x${rows}`, "-frames:v", "1", out]);
  rmSync(tmp, { recursive: true, force: true });
  return out;
}

/** The PSNR and SSIM of two images (ffmpeg's filters), as numbers. */
function compare(a, b) {
  const grab = (filter, pat) => {
    const r = spawnSync("ffmpeg", ["-v", "info", "-i", a, "-i", b, "-lavfi", filter, "-f", "null", "-"], { cwd: ROOT, encoding: "utf8" });
    const m = `${r.stdout ?? ""}${r.stderr ?? ""}`.match(pat);       // ffmpeg writes the scores to stderr
    return m ? Number(m[1]) : null;
  };
  return { psnr: grab("psnr", /average:([\d.inf]+)/), ssim: grab("ssim", /All:([\d.]+)/) };
}

// --- the reference: pilot 1's golden frames (the beats by role), the samples of its motion language, and the sheet
if (REFERENCE) {
  const slugRef = "kenapa-colokan-panas";
  const story = JSON.parse(readFileSync(path.join(ROOT, "videos", slugRef, "story.json"), "utf8"));
  const beats = story.beats;
  const starts = beats.reduce((acc, b, i) => (i === 0 ? [0] : [...acc, acc[i - 1] + beats[i - 1].dur]), []);
  const mid = (i) => starts[i] + beats[i].dur / 2;
  const lens = beats.findIndex((b) => b.kind === "lens");
  const cut = beats.findIndex((b, i) => i > lens && b.kind !== "outro" && b.kind !== "result");
  const result = beats.findIndex((b) => b.kind === "result");
  const tips = beats.findIndex((b) => b.kind === "tips");
  const golden = [
    ["hook", mid(0)], ["sting", mid(1)], ["outside", mid(lens)], ["lens", starts[lens] + 0.4], ["cutaway", mid(cut)],
    ["result", mid(result)], ["tip", mid(tips)], ["loop", starts.at(-1) + beats.at(-1).dur - 0.04],
  ];
  const dir = path.join(ROOT, "out", "style", "golden");
  mkdirSync(dir, { recursive: true });
  frames(`video-${slugRef}`, path.join("style", "golden"), golden.map(([, t]) => t));
  const files = golden.map(([name, t]) => {
    const from = path.join(ROOT, "out", "style", "golden", stamp(t));
    const to = path.join(dir, `${name}.png`);
    renameSync(from, to);
    return to;
  });
  writeFileSync(path.join(dir, "README.md"), `Pilot 1's golden frames (${slugRef}), made by scripts/styleReport.mjs --reference: ${golden.map(([n, t]) => `${n} at ${t.toFixed(2)} s`).join(", ")}.\n`);
  console.log(`reference: ${sheet(files, path.join(ROOT, "out", "style", "reference.png"), 4, 300)}`);
  process.exit(0);
}

if (!slug) { console.error("usage: node scripts/styleReport.mjs <slug> [--beside] | --reference"); process.exit(2); }
const dir = path.join(ROOT, "videos", slug);
const outDir = path.join(ROOT, "out", slug);
mkdirSync(outDir, { recursive: true });
const story = JSON.parse(readFileSync(path.join(dir, "story.json"), "utf8"));
const beats = story.beats;
const starts = beats.reduce((acc, b, i) => (i === 0 ? [0] : [...acc, acc[i - 1] + beats[i - 1].dur]), []);
const total = beats.reduce((a, b) => a + b.dur, 0);
const mids = beats.map((b, i) => starts[i] + b.dur / 2);
const first = 0.04, last = total - 0.04;

// 1. the still of every beat, and the first and last frames (the loop)
frames(`video-${slug}`, path.join(slug, "frames"), [...mids, first, last]);
const frameDir = path.join(outDir, "frames");
const beatFiles = beats.map((b, i) => {
  const from = path.join(frameDir, stamp(mids[i]));
  const to = path.join(frameDir, `${String(i + 1).padStart(2, "0")}-${b.id}.png`);
  renameSync(from, to);
  return to;
});
const firstFile = path.join(frameDir, stamp(first)), lastFile = path.join(frameDir, stamp(last));
const contact = sheet(beatFiles, path.join(outDir, "contact.png"), 4, 270);
const loop = sheet([firstFile, lastFile], path.join(outDir, "loop.png"), 2, 360);
const { psnr, ssim } = compare(firstFile, lastFile);

// 2. the hero's share of the width: where the plan declares its box (HERO_BOX_AT(t) = { x, y, w, h } in the 1080 px frame)
let heroLine = { level: "RENDER", text: "the hero is 60 to 70 % of the width at the main shot: the plan declares no HERO_BOX_AT, so it is measured by hand on the still" };
const planFile = path.join(dir, "plan.ts");
if (existsSync(planFile)) {
  try {
    const P = await import(pathToFileURL(planFile).href);
    if (typeof P.HERO_BOX_AT === "function") {
      const ratios = mids.map((t, i) => ({ id: beats[i].id, r: (P.HERO_BOX_AT(t)?.w ?? 0) / 1080 })).filter((x) => x.r > 0);
      const main = ratios.reduce((a, b) => (b.r > a.r ? b : a), { r: 0 });
      heroLine = main.r >= 0.6 && main.r <= 0.7
        ? { level: "PASS", text: `the hero's declared box is ${(main.r * 100).toFixed(0)} % of the width at its main shot (beat ${main.id})` }
        : { level: "FLAG", text: `the hero's declared box is ${(main.r * 100).toFixed(0)} % of the width at its main shot (beat ${main.id}): 60 to 70 % asked` };
    }
  } catch (e) { heroLine = { level: "FLAG", text: `the plan could not be read for the hero box (${String(e.message ?? e).split("\n")[0]})` }; }
}

// 3. the detail budget (scripts/detailBudget.mjs prints the table; the hero's own tile is measured when the nature sheet is there)
let budget = "";
try { budget = run(process.execPath, [path.join(ROOT, "scripts", "detailBudget.mjs")]); }
catch (e) { budget = `(the detail budget could not run: ${String(e.stderr ?? e.message).split("\n")[0]})`; }

// 4. the styleCheck lines (its pass/flag table, unchanged), the human checklist
let check = "";
try { check = run(process.execPath, [path.join(ROOT, "scripts", "styleCheck.mjs"), slug]); }
catch (e) { check = String(e.stdout ?? e.message); }

// 5. the style reference beside this video (optional)
let besideFile = null;
if (BESIDE) {
  const ref = path.join(ROOT, "out", "style", "reference.png");
  if (!existsSync(ref)) run(process.execPath, [path.join(ROOT, "scripts", "styleReport.mjs"), "--reference"], { stdio: "inherit" });
  besideFile = path.join(outDir, "beside.png");
  run("ffmpeg", ["-v", "error", "-y", "-i", ref, "-i", contact, "-filter_complex", "[0:v]scale=1080:-2[a];[1:v]scale=1080:-2[b];[a][b]vstack=inputs=2", "-frames:v", "1", besideFile]);
}

// the report: one file for ian
const relOut = (p) => path.relative(ROOT, p).replaceAll("\\", "/");
const passLoop = psnr !== null && psnr >= PSNR_PASS;
const md = `# Style report: ${slug}

Made by \`scripts/styleReport.mjs\` (DESIGN.md section 0b). Every line is a machine measure or the checker's own line; the human checklist is at the end.

## The loop (must 2): the first and the last frame

| measure | value | pass |
| --- | --- | --- |
| PSNR | ${psnr === null ? "not measured" : `${psnr.toFixed(2)} dB`} | ${passLoop ? "PASS" : `FLAG (at least ${PSNR_PASS} dB asked)`} |
| SSIM | ${ssim === null ? "not measured" : ssim.toFixed(4)} | (information) |

![the first and last frame](${relOut(loop)})

## The hero and the stage

- ${heroLine.level}: ${heroLine.text}

## The detail budget (B6)

\`\`\`
${budget.trim() || "(not run)"}
\`\`\`

## The checker

\`\`\`
${check.trim()}
\`\`\`

## Stills of every beat

![every beat](${relOut(contact)})
${besideFile ? `\n## Beside the reference (pilot 1's golden frames above this video)\n\n![beside the reference](${relOut(besideFile)})\n` : ""}
## Rule log rows for this report

Add a row to the rule log in DESIGN.md (section 0b) for every rule this report exposed, and name the revision that changed it.
`;
writeFileSync(path.join(outDir, "style-report.md"), md);
console.log(`style-report: ${relOut(path.join(outDir, "style-report.md"))}`);
console.log(`loop: PSNR ${psnr === null ? "not measured" : psnr.toFixed(2)} dB, SSIM ${ssim === null ? "-" : ssim.toFixed(4)} (${passLoop ? "PASS" : "FLAG"})`);
console.log(`hero: ${heroLine.level} ${heroLine.text}`);
