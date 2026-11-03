/* "Ask Gemini" on the Prepare screen (roundtrip.js): the question for YouTube's "Ask about this video", and the
   answer pasted back, kept per video so it survives a change of screen. */

/* Tested by a person: Gemini refuses a question that names clips, TikTok/Shorts, viral or editing, and answers this one.
   Do not reword it. */
const GEMINI_PROMPT = "Apa saja 8 bagian paling menarik dari video ini? Cari momen ketika pembicara menyampaikan pendapat yang tegas atau kontroversial, cerita lucu, fakta mengejutkan, pengakuan pribadi, atau tips praktis. Untuk tiap bagian, sebutkan waktu mulai dan selesai, kutip kalimat pertama yang diucapkan, dan jelaskan dalam satu kalimat kenapa bagian itu menarik. Urutkan dari yang paling menarik.";

const geminiKey = (profile, video) => `klipian:gemini:${profile}:${video}`;

function loadGeminiText(storage, profile, video) {
  try { return storage.getItem(geminiKey(profile, video)) || ""; } catch { return ""; }
}

function saveGeminiText(storage, profile, video, text) {
  try {
    if (text) storage.setItem(geminiKey(profile, video), text);
    else storage.removeItem(geminiKey(profile, video));
  } catch { /* no storage: the text is just not kept */ }
}

if (typeof module !== "undefined" && module.exports) module.exports = { GEMINI_PROMPT, geminiKey, loadGeminiText, saveGeminiText };
