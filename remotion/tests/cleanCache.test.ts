/* The bundle cache cleaner (scripts/cleanCache.mjs): keeps the newest bundles, removes the rest and the old job files, touches nothing else. `npm test`. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pruneBundles, touchBundle } from "../scripts/cleanCache.mjs";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };

const dir = mkdtempSync(path.join(tmpdir(), "klipian-cache-"));
const names = ["bundle-aaaaaaaaaaaa", "bundle-bbbbbbbbbbbb", "bundle-cccccccccccc", "bundle-dddddddddddd"];
names.forEach((name, i) => {
  mkdirSync(path.join(dir, name));
  writeFileSync(path.join(dir, name, "index.html"), "x");
  const t = new Date(Date.now() - (names.length - i) * 3600_000);             // a is the oldest, d the newest
  utimesSync(path.join(dir, name), t, t);
});
writeFileSync(path.join(dir, "job-old.json"), "{}");
writeFileSync(path.join(dir, "notes.txt"), "keep me");
mkdirSync(path.join(dir, "bundle-not-a-hash"));                                  // a name that is not a bundle's: never touched

const r = pruneBundles(dir, 2);
yes(r.kept.join() === "bundle-dddddddddddd,bundle-cccccccccccc", `the two newest are kept: ${r.kept}`);
yes(!existsSync(path.join(dir, "bundle-aaaaaaaaaaaa")) && !existsSync(path.join(dir, "bundle-bbbbbbbbbbbb")), "the older bundles are removed");
yes(existsSync(path.join(dir, "bundle-dddddddddddd", "index.html")) && existsSync(path.join(dir, "bundle-cccccccccccc", "index.html")), "the kept bundles are whole");
yes(!existsSync(path.join(dir, "job-old.json")), "an old job file is removed");
yes(existsSync(path.join(dir, "notes.txt")) && existsSync(path.join(dir, "bundle-not-a-hash")), "a file or folder that is not a bundle or a job file is never touched");

// the bundle just used becomes the newest, so pruning to one keeps it
const old = path.join(dir, "bundle-cccccccccccc");
const t = new Date(Date.now() - 10 * 3600_000);
utimesSync(old, t, t);
touchBundle(old);
yes(pruneBundles(dir, 1).kept.join() === "bundle-cccccccccccc", "touching a bundle makes it the newest");
yes(pruneBundles(path.join(dir, "missing"), 1).removed.length === 0, "a missing cache folder is not an error");

console.log(`cleanCache: ${n} checks ok`);
