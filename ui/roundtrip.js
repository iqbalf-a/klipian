/* klipian — round-trip lewat Claude web
   ==========================================================================
   Alurnya:

     1  drop video di layar Siapkan
     2  aplikasi menyiapkan berkas berisi rubrik + transkrip   -> Unduh
     3  berkas itu dijatuhkan ke Claude web, minta "kerjakan"
     4  Claude web membalas JSON
     5  JSON ditempel di sini                                  -> Impor
     6  aplikasi memotong sesuai JSON, klip muncul di Kandidat

   Tidak ada API key di jalur ini. Yang mengeluarkan biaya cuma langganan
   Claude yang sudah kamu punya.

   Transkripnya NYATA: dibaca dari cache/ yang diisi `klipian transcribe`.
   Server melayani akar proyek, jadi UI bisa menjangkaunya.
   ========================================================================== */

const ROOT = "../";                       // ui/ -> akar proyek
let realTranscript = null;                // { duration, segments[], words[] }

/* ---------- menemukan transkrip yang cocok dengan file yang dijatuhkan ----
   Nama berkas cache mengandung sidik jari, jadi dicocokkan lewat batang
   namanya: radityadika-podcast.mp4 -> radityadika-podcast.*.transcript.json */

async function listCache() {
  // Server klipian menyediakan daftarnya lewat API. Kalau UI dibuka lewat
  // http.server biasa, jatuh kembali ke daftar direktori HTML-nya.
  try {
    const d = await (await fetch("/api/cache")).json();
    if (d.transcript?.length) return d.transcript;
  } catch { /* lanjut ke cadangan */ }
  try {
    const html = await (await fetch(ROOT + "cache/")).text();
    return [...html.matchAll(/href="([^"]+\.transcript\.json)"/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

async function findTranscript(videoName) {
  const stem = videoName.replace(/\.[^.]+$/, "");
  const all = await listCache();
  const matched = all.find((f) => decodeURIComponent(f).startsWith(stem + "."));
  if (!matched) return null;
  const d = await (await fetch(ROOT + "cache/" + matched)).json();
  d.words = d.segments.flatMap((s) => s.words || []);
  return d;
}

/* ---------- langkah 2: menyusun berkas untuk Claude ---------- */

const fmtStamp = (d) => {
  const t = Math.round(d);
  return t < 3600
    ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
    : `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

async function buildBrief(name) {
  const rubricFile = mode === "gameplay" ? "gameplay-mlbb.md" : "dialog-podcast.md";
  let rubric = "";
  try { rubric = await (await fetch(ROOT + "prompts/rubrik/" + rubricFile)).text(); } catch {}
  rubric = rubric.replace(/^# .*\n+/, "").replace(/^Ini yang dibaca Claude[\s\S]*?---\s*\n+/, "");

  const row = realTranscript.segments
    .filter((s) => s.text.trim())
    .map((s) => `[${fmtStamp(s.start)}] ${s.text.trim()}`)
    .join("\n");

  return `# Cari klip — ${name}

Halo. Tolong baca transkrip di bagian bawah berkas ini dan pilih momen yang
layak dijadikan video vertikal pendek.

**Durasi sumber:** ${fmtStamp(realTranscript.duration)} · **${realTranscript.words.length} kata**

Waktu yang kamu berikan tidak perlu presisi. Cukup menit:detik yang mendekati;
klipian yang akan menggeser titik potongnya ke batas kata terdekat.

---

## Rubrik penilaian

${rubric}

---

## Bentuk jawaban

Balas dengan **satu blok JSON** persis seperti ini, tanpa penjelasan tambahan
di luar bloknya.

\`\`\`json
{
  "source": "${name}",
  "clips": [
    {
      "start": "0:12",
      "end": "1:07",
      "title": "Rugi 300 Juta karena Timing",
      "hook": "kutipan persis dari transkrip",
      "scores": { "hook": 9, "complete": 8, "payoff": 9, "emotion": 8, "duration": 9 },
      "reason": "satu dua kalimat untuk dibaca manusia"
    }
  ]
}
\`\`\`

---

## Transkrip

${row}
`;
}

/* ---------- langkah 5: membaca balasan Claude ---------- */

const toSeconds = (t) =>
  String(t).trim().split(":").reduce((a, b) => a * 60 + Number(b), 0);

function extractJSON(text) {
  // JSON.parse melempar pesan teknis berbahasa Inggris ("Expected property
  // name or '}' ... at position 14"). Dibungkus supaya yang dibaca pengguna
  // adalah kalimat yang bisa ditindaklanjuti.
  const parse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      throw new Error("Blok JSON-nya ada, tapi isinya rusak — salin ulang " +
                      "balasan Claude dari awal sampai akhir blok.");
    }
  };
  const fence = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fence) return parse(fence[1]);
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a === -1 || b <= a) throw new Error("Tidak ada blok JSON di teks itu.");
  return parse(text.slice(a, b + 1));
}

/* Geser ke batas kata terdekat. Inilah yang tidak bisa dikerjakan Claude:
   ia tidak punya timestamp per kata. Kita punya. */
/* Sejauh mana titik potong boleh digeser. Sama dengan SNAP_MAX di
   klipian/roundtrip.py -- kalau salah satu diubah, ubah keduanya. Batas kata
   yang lebih jauh dari ini berarti Claude menunjuk ke keheningan, bukan ke
   kata yang meleset sedikit. */
const SNAP_MAX = 2.0;

function snapToWord(time, side) {
  const w = realTranscript?.words;
  if (!w?.length || !Number.isFinite(time)) return time;
  const candidate = side === "start" ? w.map((x) => x.start) : w.map((x) => x.end);
  const nearest = candidate.reduce((a, b) =>
    (Math.abs(b - time) < Math.abs(a - time) ? b : a));
  return Math.abs(nearest - time) <= SNAP_MAX ? nearest : time;
}

/* Kunci Indonesia (klip, mulai, judul, ...) sengaja tetap diterima sebagai
   cadangan. Prompt sekarang meminta kunci Inggris, tapi balasan Claude yang
   terlanjur disimpan sebelum penggantian nama masih harus bisa diimpor --
   dan Claude sesekali menjawab memakai istilah dari prosa promptnya. */
function importJSON(text) {
  const data = extractJSON(text);
  const raw = data.clips || data.klip || [];
  if (!raw.length) throw new Error('JSON-nya tidak punya daftar "clips".');

  const result = raw.map((k) => {
    // Klip tanpa titik waktu dilewati, bukan diterima jadi 0:00. Tanpa penjaga
    // ini toSeconds(undefined) menghasilkan NaN, dan perbandingan NaN yang
    // selalu false membuat snapToWord memulangkan kata pertama -- satu field
    // yang lupa ditulis Claude jadi klip yang mulai dari awal video.
    const m0 = toSeconds(k.start ?? k.mulai);
    const s0 = toSeconds(k.end ?? k.selesai);
    if (!Number.isFinite(m0) || !Number.isFinite(s0) || s0 <= m0) return null;

    // Diperiksa lagi sesudah digeser: dua sisi bergerak sendiri-sendiri, jadi
    // rentang yang tadinya sah bisa jadi terbalik. Kalau begitu, pakai angka
    // asli dari Claude.
    let m = snapToWord(m0, "start");
    let s = snapToWord(s0, "end");
    if (s <= m) { m = m0; s = s0; }

    // Skor DIPAKSA jadi angka di sini, di batas tempat data asing masuk.
    // Claude sesekali menulis "sembilan" atau "9" (string), dan nilai bukan
    // angka yang lolos sampai renderBoard membuat value.toFixed() melempar --
    // papan Kandidat rusak permanen sampai halaman dimuat ulang.
    const scores = k.scores || k.skor || {};
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const nums = Object.values(scores)
      .map(Number).filter(Number.isFinite);
    return {
      title: (k.title || k.judul || "Tanpa judul").trim(),
      hook: (k.hook || "").trim(),
      in: fmtStamp(m), out: fmtStamp(s),
      startSec: m, endSec: s,
      dur: Math.round(s - m),
      total: nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : 0,
      scores: {
        hook: num(scores.hook),
        complete: num(scores.complete ?? scores.self_contained),
        payoff: num(scores.payoff),
      },
      reason: (k.reason || k.alasan || "").trim(),
      spans: [{ start: m, end: s }],   // satu potongan utuh sampai dibelah
    };
  }).filter((k) => k && k.dur > 0).sort((a, b) => b.total - a.total);

  if (!result.length) throw new Error("Semua klip punya durasi nol atau negatif.");
  return result;
}

/* ---------- memasang hasil ke seluruh aplikasi ---------- */

function applyCandidates(candidates) {
  const d = DATA[mode];
  // Tiap klip diberi objek sejak awal. Kalau dibiarkan kosong, klip itu ikut
  // objek yang KEBETULAN sedang aktif, jadi framingnya berubah diam-diam
  // setiap kali kamu memilih orang lain di layar Reframe.
  if (typeof activeObjectId !== "undefined" && activeObjectId) {
    candidates.forEach((k) => { if (!k.objectId) k.objectId = activeObjectId; });
  }
  d.candidates = candidates;
  d.marks = candidates.map((k) => ({
    pos: (k.startSec / realTranscript.duration) * 100,
    scores: k.total,
    label: k.title.split(" ").slice(0, 3).join(" "),
  }));

  // transkrip layar Potong memakai kata sungguhan di sekitar klip teratas
  applyRealWords(candidates[0]);

  renderRibbon(); renderBoard(); renderList(); renderPreview();
  if (typeof summarizeRender === "function") summarizeRender();
  if (typeof setClip === "function") setClip(candidates[0]);
  if (typeof drawSpans === "function") drawSpans();
}

/* Chip kata di layar Potong diisi kata asli dari transkrip, bukan contoh. */
function applyRealWords(clip) {
  if (!clip || !realTranscript) return;
  const pad = 12;
  const w = realTranscript.words.filter(
    (x) => x.end > clip.startSec - pad && x.start < clip.endSec + pad);

  const words = [];
  let before = null;
  for (const x of w) {
    if (before && x.start - before > 0.6) words.push(["|", 0]);
    const inside = x.start >= clip.startSec && x.end <= clip.endSec;
    words.push([x.text.trim(), inside ? 1 : 0]);
    before = x.end;
  }
  DATA[mode].words = words;
  DATA[mode].suspect = w.filter((x) => x.prob < 0.5 && x.text.trim().length >= 5)
                     .map((x) => x.text.trim());
  DATA[mode].cut = { title: clip.title, in: clip.in, out: clip.out, dur: `${clip.dur}s` };
  renderCut();
  $("#cutTitle").textContent = clip.title;
  $("#cutDur").textContent = `${clip.dur}s`;
  $("#cutRange").textContent = `in ${clip.in} · out ${clip.out}`;
  $("#waveRange").textContent = `in ${clip.in} — out ${clip.out}`;
}

/* ---------- pemasangan kontrol ---------- */

async function prepareExport(videoName) {
  const panel = $("#exportPanel"), button = $("#downloadBrief"), note = $("#exportNote");
  note.textContent = "mencari transkrip …";
  realTranscript = await findTranscript(videoName);

  if (!realTranscript) {
    panel.dataset.ready = "false";
    button.disabled = true;
    note.textContent = `Belum ada transkrip. Jalankan dulu: klipian transcribe ${videoName}`;
    return;
  }
  panel.dataset.ready = "true";
  button.disabled = false;
  renderRibbon();   // durasi ribbon baru benar setelah transkrip termuat
  note.textContent =
    `${realTranscript.words.length.toLocaleString("id")} kata · ${fmtStamp(realTranscript.duration)} · siap dijatuhkan ke Claude`;
  $("#importPanel").dataset.ready = "true";
}

$("#downloadBrief").addEventListener("click", async () => {
  const name = chosenSource?.name || "video.mp4";
  const text = await buildBrief(name);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = `brief-claude-${name.replace(/\.[^.]+$/, "")}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  $("#exportNote").textContent =
    `Berkas diunduh · ${(text.length / 1024).toFixed(0)} KB · ~${Math.round(text.length / 3.5).toLocaleString("id")} token`;
});

$("#pasteJSON").addEventListener("input", (e) => {
  $("#importBtn").disabled = !e.target.value.trim();
  $("#importNote").dataset.error = "false";
  $("#importNote").textContent = "";
});

$("#importBtn").addEventListener("click", () => {
  const note = $("#importNote");
  try {
    const candidates = importJSON($("#pasteJSON").value);
    applyCandidates(candidates);
    note.dataset.error = "false";
    note.textContent = `${candidates.length} klip dipotong`;
    toScreen("candidates");
  } catch (err) {
    note.dataset.error = "true";
    note.textContent = err.message;
  }
});

/* .json bisa ditarik langsung ke kotak tempel */
$("#pasteJSON").addEventListener("drop", async (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  e.preventDefault();
  e.stopPropagation();
  $("#pasteJSON").value = await f.text();
  $("#importBtn").disabled = false;
});
