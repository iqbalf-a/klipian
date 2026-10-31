// node scripts/cleanCache.mjs [--keep N]      (npm run clean-cache)
// The bundle cache of render.mjs (.cache/bundle-<hash>/, about 40 MB each) grows by one folder for every change to src/, videos/, public/, stories/ or package.json.
// This keeps the newest N bundles (1 by default when run by hand; render.mjs keeps 2 after every render) and removes the rest, together with the old job files
// (.cache/job-*.json). It only ever touches names that match those two patterns inside the cache folder, never anything else.
import { existsSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CACHE_DIR = path.join(ROOT, ".cache");
const BUNDLE = /^bundle-[0-9a-f]{12}$/;
const JOB = /^job-[A-Za-z0-9._-]+\.json$/;

/** Marks a bundle as the newest (the one just used), so pruning keeps it. */
export function touchBundle(dir) {
  try { const now = new Date(); utimesSync(dir, now, now); } catch { /* a cache is best effort */ }
}

/** Removes all but the `keep` newest bundles and every job file in `cacheDir`; returns { removed: [names], kept: [names] }. */
export function pruneBundles(cacheDir = CACHE_DIR, keep = 1) {
  const removed = [], kept = [];
  if (!existsSync(cacheDir)) return { removed, kept };
  const entries = readdirSync(cacheDir).map((name) => ({ name, full: path.join(cacheDir, name) }));
  const bundles = entries.filter((e) => BUNDLE.test(e.name) && statSync(e.full).isDirectory()).sort((a, b) => statSync(b.full).mtimeMs - statSync(a.full).mtimeMs);
  bundles.forEach((b, i) => {
    if (i < keep) { kept.push(b.name); return; }
    try { rmSync(b.full, { recursive: true, force: true }); removed.push(b.name); } catch { /* in use: leave it */ }
  });
  for (const e of entries) {
    if (!JOB.test(e.name)) continue;
    try { rmSync(e.full, { force: true }); removed.push(e.name); } catch { /* ignore */ }
  }
  return { removed, kept };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const i = process.argv.indexOf("--keep");
  const keep = i > 0 ? Math.max(0, Number(process.argv[i + 1]) || 0) : 1;
  const { removed, kept } = pruneBundles(CACHE_DIR, keep);
  console.log(`clean-cache: kept ${kept.length} bundle(s) (${kept.join(", ") || "none"}), removed ${removed.length}`);
}
