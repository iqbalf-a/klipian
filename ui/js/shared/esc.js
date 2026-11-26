/* klipian — HTML-escape one value for innerHTML (classic script, shared by /admin, /autopilot, /profiles and /remotion). */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
