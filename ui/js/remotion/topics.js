/* The list of topics of /remotion, as pure rules (no DOM): the search, the filters, the order and the paging.
   Used by ui/js/remotion/page-list.js and tested by node tests/topics.test.js. */

const TOPIC_PAGE = 30;
const TOPIC_SORTS = { updated: "Terbaru diubah", created: "Terbaru dibuat", name: "Nama A-Z", stage: "Butuh tindakan dulu" };
const TOPIC_STATUSES = { all: "Semua", draft: "Draft", story: "Cerita", checked: "Dicek", rendered: "Sudah dirender" };
const TOPIC_DEFAULT = { q: "", status: "all", need: false, dur: 0, music: "", sort: "updated", shown: TOPIC_PAGE };

// a topic needs a move from the person when the backend's next step (chip.key) is not "already rendered and current" or "not ready"
const topicNeedsAction = (p) => !["selesai", "blocked"].includes((p.chip || {}).key);

const topicText = (p) => `${p.topic} ${p.title} ${p.id} ${p.composition}`.toLowerCase();

// every topic that matches the search and ALL filters, in the chosen order (a tie falls back to newest changed)
function filterTopics(list, ui) {
  const u = { ...TOPIC_DEFAULT, ...ui }, needle = String(u.q).trim().toLowerCase();
  const recent = (a, b) => (b.updated || 0) - (a.updated || 0);
  const order = {
    updated: recent,
    created: (a, b) => (b.created || 0) - (a.created || 0) || recent(a, b),
    name: (a, b) => String(a.title || a.topic).localeCompare(String(b.title || b.topic), "id") || recent(a, b),
    stage: (a, b) => topicNeedsAction(b) - topicNeedsAction(a) || recent(a, b),
  }[u.sort] || recent;
  return list
    .filter((p) => !needle || topicText(p).includes(needle))
    .filter((p) => u.status === "all" || p.status === u.status)
    .filter((p) => !u.need || topicNeedsAction(p))
    .filter((p) => !u.dur || p.duration === u.dur)
    .filter((p) => !u.music || p.music === u.music)
    .sort(order);
}

// is anything other than the order narrowing the list (the "Hapus filter" button shows then)
const topicFiltered = (ui) => { const u = { ...TOPIC_DEFAULT, ...ui }; return !!(u.q.trim() || u.status !== "all" || u.need || u.dur || u.music); };

if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, { filterTopics, topicFiltered, topicNeedsAction, TOPIC_SORTS, TOPIC_STATUSES, TOPIC_DEFAULT, TOPIC_PAGE });
