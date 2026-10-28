/* The panels of a video and their numbers, per kind (PLAN-KHUSUS-PAGE), and the label of the folder's state. Pure: no DOM.
   Used by ui/js/remotion/page.js and tested by node tests/khusus.test.js. */

// Otomatis: brief and answer, then the rest. Khusus: the folder panel takes the place of brief and answer.
const PANEL_ORDER_TEMPLATE = ["brief", "paste", "voice", "story", "facts", "title", "render"];
const PANEL_ORDER_CUSTOM = ["folder", "voice", "story", "facts", "title", "render"];

function panelsFor(kind) {
  const keys = kind === "custom" ? PANEL_ORDER_CUSTOM : PANEL_ORDER_TEMPLATE;
  return keys.map((key, i) => ({ key, num: i + 1 }));
}

function panelNumOf(kind, key) {
  const found = panelsFor(kind).find((x) => x.key === key);
  return found ? found.num : "";
}

// the chip of the folder: the state as the page shows it (the states are those of motion.folder_state)
const FOLDER_STATES = ["belum dipilih", "cerita belum diambil", "cerita diambil", "folder berubah", "folder tidak lengkap"];

function folderChip(state) {
  return FOLDER_STATES.includes(state) ? state : "belum dipilih";
}

if (typeof module !== "undefined" && module.exports) module.exports = { panelsFor, panelNumOf, folderChip, FOLDER_STATES };
