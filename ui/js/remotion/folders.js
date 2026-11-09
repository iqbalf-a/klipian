/* The folder picker of step 3, as pure rules (no DOM): the status of a folder, the search, the quick filter and the order.
   Used by ui/js/remotion/page-steps-1.js and tested by node tests/folders.test.js. */

// "current" = the folder this topic uses, "other" = taken by another topic (c.takenBy is that topic), "free" = nobody took it
function folderStatus(c, picked) {
  return c.slug === picked ? "current" : c.takenBy ? "other" : "free";
}

const FOLDER_SORTS = { recent: "Terbaru", name: "Nama A-Z", duration: "Durasi", free: "Belum diambil dulu" };
const FOLDER_FILTERS = { all: "Semua", free: "Belum diambil", taken: "Sudah diambil" };

// the folders to show: the search matches the title and the slug (any case), the filter keeps by status, the sort orders (a tie falls back to newest)
function pickFolders(list, { q = "", filter = "all", sort = "recent" } = {}, picked = "") {
  const needle = String(q).trim().toLowerCase();
  const recent = (a, b) => (b.modified || 0) - (a.modified || 0);
  const free = (c) => (folderStatus(c, picked) === "free" ? 0 : 1);
  const order = {
    recent,
    name: (a, b) => String(a.title).localeCompare(String(b.title), "id") || recent(a, b),
    duration: (a, b) => (a.duration ?? Infinity) - (b.duration ?? Infinity) || recent(a, b),
    free: (a, b) => free(a) - free(b) || recent(a, b),
  }[sort] || recent;
  return list
    .filter((c) => !needle || `${c.title} ${c.slug}`.toLowerCase().includes(needle))
    .filter((c) => filter === "all" || (filter === "free") === (folderStatus(c, picked) === "free"))
    .sort(order);
}

if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, { folderStatus, pickFolders, FOLDER_SORTS, FOLDER_FILTERS });
