/* klipian — konfigurasi Tailwind, khusus halaman /workspace.
   ==========================================================================
   Editor lama (index.html + css/app.css) TIDAK ikut migrasi -- itu UI yang
   sudah stabil dan disetel detail (posisi crop dalam persen, dst.), migrasi
   ke utility class berisiko tinggi untuk manfaat kecil. Tailwind cuma
   dipakai untuk halaman baru yang memang belum ada investasi desain di
   dalamnya.

   Warna & font TIDAK diduplikasi -- semuanya menunjuk ke custom property
   yang sudah didefinisikan di css/tokens.css (satu sumber kebenaran untuk
   kedua halaman). Kalau tokens.css berubah, workspace ikut berubah tanpa
   perlu build ulang.
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
        kaca: "var(--kaca)",
        "kaca-kuat": "var(--kaca-kuat)",
        garis: "var(--garis-kaca)",
        "garis-terang": "var(--garis-terang)",
        teks: "var(--teks)",
        "teks-lemah": "var(--teks-lemah)",
        "teks-samar": "var(--teks-samar)",
        aksen: "var(--aksen)",
        "aksen-lembut": "var(--aksen-lembut)",
        bahaya: "var(--bahaya)",
        "status-scheduled": "oklch(0.75 0.14 230)",
        "status-posted": "oklch(0.75 0.16 145)",
      },
      fontFamily: {
        ui: ["Mona Sans", "system-ui", "-apple-system", "sans-serif"],
        data: ["Martian Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { s: "var(--r-s)", m: "var(--r-m)", l: "var(--r-l)" },
      boxShadow: { kartu: "var(--bayang-kartu)" },
    },
  },
  plugins: [],
};
