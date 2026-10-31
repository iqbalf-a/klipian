/* klipian — the /remotion page, part of ui/js/remotion/page.js (split out, no change of behaviour): the shared state and helpers. Loads first. */

const API = "/api/motion";
let LIST = [];
let STATUS = { installed: true };
let CUR = null;                 // the chosen video's detail (from /api/motion/project)
let POLL = null;
let newDuration = 45;
let OPEN = null;                // the id of the step that is open (one at a time)
let LAST_ACTIVE = null;         // the active step at the last draw: when it changes, the open step follows it
let NARR = null;                // { forId, exports: { <app>: export } }: the voice texts, loaded when the script step opens
let NARR_APP = null;            // the app whose text the script step shows
let PART_TO_REPLACE = null;     // the number of the part the next path replaces (set by "Ganti bagian")
const briefCache = new Map();   // `${id}:main` -> text (fetched ahead, so the Copy click can write to the clipboard at once)

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const byId = (id) => document.getElementById(id);

async function call(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false || j.error) {
    const e = new Error(j.error || `gagal (${r.status})`);
    e.data = j;
    throw e;
  }
  return j;
}
const fmtEta = (s) => (s == null ? "" : `sisa ± ${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const toast = (text) => (typeof showToast === "function" ? showToast(text, { ms: 6000 }) : alert(text));
