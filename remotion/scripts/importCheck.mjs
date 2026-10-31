// The relative imports of a video's files point at files that exist, spelled exactly (DESIGN.md B26): `tsc` accepts "../../src/components/IsoNature.ts" when the file is
// IsoNature.tsx (a type-only resolution), but the render bundler does not ("Can't resolve"), so the video would pass `npm run check` and fail at the render.
// checkImports(dir) returns the problems as sentences (empty: all good). Used by styleCheck.mjs and tests/videos.test.ts.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const IMPORT = /(?:^|\n)\s*(?:import|export)\b[^;'"]*?(?:from\s*)?["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
const EXTS = [".tsx", ".ts", ".mjs", ".js", ".json"];

/** True when `file` exists with exactly this spelling (a case-insensitive disk must not hide a wrong case). */
const exactly = (file) => existsSync(file) && readdirSync(path.dirname(file)).includes(path.basename(file));

export function checkImports(dir) {
  const problems = [];
  for (const f of readdirSync(dir).filter((x) => /\.(ts|tsx)$/.test(x))) {
    const src = readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2], target = path.resolve(dir, spec);
      if (exactly(target) && !/^\.{1,2}$/.test(path.basename(target))) continue;
      const base = path.basename(spec);
      const dirTarget = path.dirname(target);
      const siblings = existsSync(dirTarget) ? readdirSync(dirTarget) : [];
      const stem = base.replace(/\.(tsx?|mjs|js|json)$/, "");
      const guess = siblings.find((s) => s !== base && s.replace(/\.(tsx?|mjs|js|json)$/, "").toLowerCase() === stem.toLowerCase() && EXTS.some((e) => s.endsWith(e)));
      problems.push(`${f}: ${base} tidak ada${guess ? `; maksudnya ${guess}?` : ""} (import "${spec}": the file must exist with exactly this path and extension, or the render cannot bundle it)`);
    }
  }
  return problems;
}
