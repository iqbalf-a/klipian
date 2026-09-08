/* klipian — Tailwind config, only for the /workspace page.
   ==========================================================================
   The old editor (index.html + css/app.css) is NOT part of this migration
   -- that UI is stable and tuned down to the detail (crop position in
   percent, etc.), migrating it to utility classes is high risk for small
   benefit. Tailwind is only used for the new page, which genuinely had no
   design investment in it yet.

   Colors & fonts are NOT duplicated -- everything points to the custom
   properties already defined in css/tokens.css (one source of truth for
   both pages). If tokens.css changes, the workspace changes along with it
   without needing a rebuild.
   ========================================================================== */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./workspace.html", "./js/workspace/*.js"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
          3: "var(--bg-3)",
        },
        kaca: "var(--glass)",
        "kaca-kuat": "var(--glass-strong)",
        garis: "var(--glass-border)",
        "garis-terang": "var(--border-bright)",
        teks: "var(--text)",
        "teks-lemah": "var(--text-muted)",
        "teks-samar": "var(--text-faint)",
        aksen: "var(--accent)",
        "aksen-lembut": "var(--accent-soft)",
        bahaya: "var(--danger)",
        "status-scheduled": "oklch(0.75 0.14 230)",
        "status-posted": "oklch(0.75 0.16 145)",
      },
      fontFamily: {
        ui: ["Mona Sans", "system-ui", "-apple-system", "sans-serif"],
        data: ["Martian Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { s: "var(--r-s)", m: "var(--r-m)", l: "var(--r-l)" },
      boxShadow: { kartu: "var(--shadow-card)" },
    },
  },
  plugins: [],
};
