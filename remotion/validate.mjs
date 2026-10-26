// node validate.mjs <story.json>  ->  {"ok":true,...} or {"ok":false,"errors":[{"path":"beats.2.text","message":"..."}]} on stdout; exit code 0 either way
// (1 when the file is not JSON at all, 2 without an argument). klipian (Python) calls this: the rules live in src/schema.ts and nowhere else.
import { readFileSync } from "node:fs";
import { Story } from "./src/schema.ts";

const file = process.argv[2];
if (!file) { process.stderr.write("usage: node validate.mjs <story.json>\n"); process.exit(2); }
let raw;
try { raw = JSON.parse(readFileSync(file, "utf8")); }
catch (e) { process.stdout.write(`${JSON.stringify({ ok: false, errors: [{ path: "", message: `not readable JSON: ${e.message}` }] })}\n`); process.exit(1); }
const r = Story.safeParse(raw);
if (r.success) process.stdout.write(`${JSON.stringify({ ok: true, beats: r.data.beats.map((b) => b.id), duration: r.data.duration })}\n`);
else process.stdout.write(`${JSON.stringify({ ok: false, errors: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) })}\n`);
