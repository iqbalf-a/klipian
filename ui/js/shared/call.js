/* klipian — JSON call to the local server, for /admin and /autopilot (a classic script). GET without a body, POST with one.
   An error reply or a failed status throws an Error with the server's message; the parsed reply is on `error.reply`.
   (The Motion page has its own `call`: it also treats `ok: false` as an error.) */
async function call(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error(j.error || `failed (${r.status})`); e.reply = j; throw e; }
  return j;
}
