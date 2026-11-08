/* klipian — pagination for every table (shared by the editor and /workspace)
   ==========================================================================
   const pager = createPager({ key: "clips", mount: el, onChange: redraw });
   const visible = pager.slice(allRows);      // the rows of the current page

   slice() clamps the page (a row deleted from the last page lands on the new
   last one, never on an empty page) and draws the controls into `mount`:
   "1–10 of 19", a rows-per-page choice (10 / 25 / 50, remembered per `key` in
   localStorage), Prev / Next and the page numbers. The controls are hidden
   while the rows fit the smallest page: with fewer than 10 rows there is
   nothing to page. (They stay while a bigger page size would show everything,
   so the size can be taken back.) Only a slice is returned: a caller that
   counts rows for a title ("19 clips") keeps counting its own full list.
   `onChange` runs after the person changes the page or the size, and should
   redraw from the same list.

   Storage can be unavailable (private window, blocked site data): the size is
   then simply not remembered.
   ========================================================================== */

const PAGER_SIZES = [10, 25, 50];
const PAGER_KEY = (key) => `klipian.pager.${key}`;

function createPager({ key, mount, onChange }) {
  let size = PAGER_SIZES[0];
  let page = 0;
  let count = 0;
  try {
    const saved = Number(localStorage.getItem(PAGER_KEY(key)));
    if (PAGER_SIZES.includes(saved)) size = saved;
  } catch { /* storage unavailable: the default stays */ }

  const pages = () => Math.max(1, Math.ceil(count / size));

  /* Page numbers around the current one: 1 … 4 5 [6] 7 8 … 20 */
  function numbers() {
    const last = pages() - 1;
    const keep = new Set([0, last, page - 1, page, page + 1]);
    const out = [];
    let prev = -1;
    for (const n of [...keep].filter((n) => n >= 0 && n <= last).sort((a, b) => a - b)) {
      if (n - prev > 1) out.push("gap");
      out.push(n);
      prev = n;
    }
    return out;
  }

  function draw() {
    if (!mount) return;
    if (count <= PAGER_SIZES[0]) { mount.hidden = true; mount.innerHTML = ""; return; }
    const from = page * size + 1;
    const to = Math.min(count, (page + 1) * size);
    const last = pages() - 1;
    const num = numbers().map((n) => n === "gap"
      ? `<span class="pager-gap">…</span>`
      : `<button class="pager-num" type="button" data-pager-page="${n}"
                 ${n === page ? 'aria-current="page"' : ""}>${n + 1}</button>`).join("");
    mount.hidden = false;
    mount.className = "pager";
    mount.innerHTML = `
      <span class="pager-count" role="status">${from}–${to} of ${count}</span>
      <label class="pager-size">Rows
        <select data-pager-size aria-label="Rows per page">
          ${PAGER_SIZES.map((n) => `<option value="${n}"${n === size ? " selected" : ""}>${n}</option>`).join("")}
        </select></label>
      <span class="pager-nav">
        <button class="pager-btn" type="button" data-pager-page="${page - 1}"${page === 0 ? " disabled" : ""}>Prev</button>
        ${num}
        <button class="pager-btn" type="button" data-pager-page="${page + 1}"${page >= last ? " disabled" : ""}>Next</button>
      </span>`;
  }

  mount?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pager-page]");
    if (!b || b.disabled) return;
    page = Math.max(0, Math.min(pages() - 1, Number(b.dataset.pagerPage)));
    onChange?.();
  });
  mount?.addEventListener("change", (e) => {
    if (!e.target.matches("[data-pager-size]")) return;
    const first = page * size;                 // keep the row at the top of the page in view
    size = Number(e.target.value);
    page = Math.floor(first / size);
    try { localStorage.setItem(PAGER_KEY(key), String(size)); } catch { /* not remembered */ }
    onChange?.();
  });

  return {
    slice(items) {
      count = items.length;
      page = Math.max(0, Math.min(pages() - 1, page));
      draw();
      return items.slice(page * size, page * size + size);
    },
    first() { page = 0; },                      // e.g. a new row is added at the top
    goTo(index) { page = Math.floor(Math.max(0, index) / size); },   // the page holding row `index` of the list given to slice()
    last() { page = Infinity; },                // ... or at the bottom (clamped by slice)
  };
}

/* ---------- sorting a table by a column, and searching its rows ----------
   const sort = createSort("clips", "created");   // { col, dir }, remembered as "col:dir" (an old "asc"/"desc" is `created`)
   const rows = sort.apply(list, { title: (r) => r.title, created: (r) => r.createdAt });   // a sorted COPY
   sort.toggle("title");                          // same column: flips; another column: starts at its natural direction
   sort.headHTML("title", "Title / hook");        // the heading's button, arrow on the active column only
   sort.ariaSort("title");                        // "ascending" | "descending" | "none", for the <th>
   Order is filter -> sort -> pager.slice(). Numbers compare as numbers, text with localeCompare (numeric, so
   "clip 2" < "clip 10"); an empty value is ALWAYS last, in both directions; ties keep their order. */

// A new column starts "asc" (A to Z), except these, where the biggest or newest first is what a person wants.
const SORT_DESC_FIRST = new Set(["created", "at", "size", "length", "date", "used"]);
const sortStart = (col) => (SORT_DESC_FIRST.has(col) ? "desc" : "asc");

function parseSort(raw, defaultCol) {
  if (raw === "asc" || raw === "desc") return { col: "created", dir: raw };       // the old, Created-only choice
  const [col, dir] = String(raw || "").split(":");
  if (col && (dir === "asc" || dir === "desc")) return { col, dir };
  return { col: defaultCol, dir: sortStart(defaultCol) };
}

const sortEmpty = (v) => v === "" || v == null || (typeof v === "number" && Number.isNaN(v));

function sortRows(rows, getters, col, dir) {
  const get = getters[col] || getters[Object.keys(getters)[0]];
  const sign = dir === "desc" ? -1 : 1;
  return rows.map((r, i) => {
    let v = get(r);
    if (typeof v === "boolean") v = Number(v);
    return { r, i, v };
  }).sort((a, b) => {
    const ea = sortEmpty(a.v), eb = sortEmpty(b.v);
    if (ea || eb) return ea === eb ? a.i - b.i : ea ? 1 : -1;
    const c = typeof a.v === "number" && typeof b.v === "number"
      ? a.v - b.v
      : String(a.v).localeCompare(String(b.v), undefined, { numeric: true, sensitivity: "base" });
    return sign * c || a.i - b.i;
  }).map((x) => x.r);
}

function createSort(key, defaultCol = "created") {
  const K = `klipian.sort.${key}`;
  let state = { col: defaultCol, dir: sortStart(defaultCol) };
  try { state = parseSort(localStorage.getItem(K), defaultCol); } catch { /* default */ }
  return {
    col: () => state.col,
    dir: () => state.dir,
    toggle(col) {
      state = col === state.col ? { col, dir: state.dir === "desc" ? "asc" : "desc" } : { col, dir: sortStart(col) };
      try { localStorage.setItem(K, `${state.col}:${state.dir}`); } catch { /* not remembered */ }
    },
    apply: (rows, getters) => sortRows(rows, getters, state.col, state.dir),
    ariaSort: (col) => (col !== state.col ? "none" : state.dir === "desc" ? "descending" : "ascending"),
    headHTML(col, label) {
      const on = col === state.col;
      const word = state.dir === "desc" ? "descending" : "ascending";
      return `<button class="sort-head" type="button" data-sort="${col}"
        title="${on ? `Sorted ${word}: click to flip` : `Sort by ${label}`}"
        aria-label="Sort by ${label}${on ? `, ${word}` : ""}">${label}${on
          ? ` <span class="sort-arrow" aria-hidden="true">${state.dir === "desc" ? "▼" : "▲"}</span>` : ""}</button>`;
    },
  };
}

/* Every word of `q` (split on spaces) must appear, in any case, in the joined `fields` of the row.
   A field is a key of the row or a function of it; an empty query lets everything through. */
function matchesQuery(row, fields, q) {
  const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.map((f) => {
    const v = typeof f === "function" ? f(row) : row[f];
    return v == null ? "" : String(v);
  }).join("\n").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/* The small search box of a panel: onChange runs after every keystroke, Esc empties it. Not remembered. */
function createSearch(input, onChange) {
  input?.addEventListener("input", () => onChange());
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && input.value) { input.value = ""; onChange(); }
  });
  return {
    q: () => (input?.value || "").trim(),
    clear() { if (input) input.value = ""; },
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = { createSort, parseSort, sortRows, matchesQuery };
