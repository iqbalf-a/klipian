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
  };
}
