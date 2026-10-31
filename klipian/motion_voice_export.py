"""The texts for the voice apps (split out of motion.py, no change of behaviour): the narration in parts, and the export for VoiceStudio (plain text), ElevenLabs and Google
AI Studio. Import `klipian.motion`: it re-exports these names."""

from __future__ import annotations

import re


class _Lazy:
    """The rest of motion.py, reached when a function runs (not when this module loads): `_m.options_of(...)`. motion.py imports this module, so a plain
    import here would be a cycle; and a test that patches `motion._catalog` reaches this code too."""

    def __getattr__(self, name):
        from . import motion
        return getattr(motion, name)


_m = _Lazy()


def _sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", str(text or "").strip()) if s]


# words a second (the planner's range, 2.3 to 3.2): the estimate of a part's length is a range, never a single number
WPS_LOW, WPS_HIGH = 2.3, 3.2
PART_SECONDS = 12.0              # a part is about this long (suggested breaks at sentence ends, 10 to 15 s)


def narration_parts(story: dict) -> list[dict]:
    """The narration split into parts at sentence ends, each about PART_SECONDS long. Each part: {"no", "text", "words", "low", "high", "beats"} with
    the estimated seconds as a range. A beat boundary is kept as a boundary in the parts' text (for the markup that uses it)."""
    units = []
    for beat in story["beats"]:
        for sent in _sentences(beat.get("narration", "")):
            units.append({"beat": beat["id"], "text": sent, "words": len(sent.split())})
    parts: list[dict] = []
    cur: list[dict] = []
    seconds = 0.0
    for u in units:
        cur.append(u)
        seconds += u["words"] / ((WPS_LOW + WPS_HIGH) / 2)
        if seconds >= PART_SECONDS:
            parts.append(cur)
            cur, seconds = [], 0.0
    if cur:
        parts.append(cur)
    out = []
    for n, units_in in enumerate(parts, 1):
        words = sum(u["words"] for u in units_in)
        out.append({"no": n, "words": words, "low": round(words / WPS_HIGH, 1), "high": round(words / WPS_LOW, 1),
                    "units": units_in, "text": " ".join(u["text"] for u in units_in)})
    return out


def _google_style(story: dict) -> str:
    """The short style description, English, built from the beats the story has (no age, gender, names or accent: the docs ask for a concise style)."""
    kinds = {b["kind"] for b in story["beats"] if (b.get("narration") or "").strip()}
    parts = ["friendly, curious and upbeat"]
    if "hook" in kinds:
        parts.append("playful on the hook")
    if "sting" in kinds:
        parts.append("a little hushed on 'Intip yuk!'")
    if kinds & {"lens", "normal", "loose"}:
        parts.append("calm and neutral on the facts")
    if "result" in kinds:
        parts.append("clear on the result")
    if "tips" in kinds:
        parts.append("warm and slightly cautious on the tips")
    return "; ".join(parts) + "; medium pace, short natural pauses at sentence ends."


def _google_script(story: dict, parts: list[dict]) -> tuple[str, list[dict]]:
    """The script with the expression tags, placed by rule (no AI call): a short pause between beats, a long pause before the last tips beat, and at
    most one expression per beat and GOOGLE_EXPRESSIONS_MAX in all: <whispers> before "Intip yuk!", <chuckle> before a sentence that turns the fact
    ("Tapi", "Namun", "Padahal") in a result beat. Tags are never inside a word or after the last sentence. Returns (script, tags used)."""
    kind_of_beat = {b["id"]: b["kind"] for b in story["beats"]}
    tips = [b["id"] for b in story["beats"] if b["kind"] == "tips" and (b.get("narration") or "").strip()]
    last_tips = tips[-1] if tips else None
    tags: list[dict] = []
    used_beats: set[str] = set()
    expressions = 0
    pieces_per_part: list[str] = []
    prev: dict | None = None
    for part in parts:
        out = ""
        for u in part["units"]:
            kind = kind_of_beat[u["beat"]]
            text = u["text"]
            if prev is not None and prev["beat"] != u["beat"]:
                if u["beat"] == last_tips and kind == "tips":
                    out += " <long pause> "
                    tags.append({"tag": "long pause", "beat": u["beat"], "at": "sebelum tips terakhir"})
                else:
                    out += " <short pause> "
                    tags.append({"tag": "short pause", "beat": u["beat"], "at": "antar beat"})
            elif out:
                out += " "
            if u["beat"] not in used_beats and expressions < GOOGLE_EXPRESSIONS_MAX:
                if kind == "sting" and re.match(r"intip yuk", text, re.I):
                    text = f"<whispers> {text}"
                elif kind == "result" and re.match(r"(tapi|namun|padahal)\b", text, re.I):
                    text = f"<chuckle> {text}"
                if text.startswith("<whispers>") or text.startswith("<chuckle>"):
                    used_beats.add(u["beat"])
                    expressions += 1
                    tags.append({"tag": text.split(">")[0][1:], "beat": u["beat"], "at": "awal kalimat"})
            out += text
            prev = u
        pieces_per_part.append(re.sub(r"\s+", " ", out).strip())
    return "\n\n".join(pieces_per_part), tags


GOOGLE_EXPRESSIONS_MAX = 6


def _plain(units: list[dict]) -> str:
    """Pure narration: the sentences of a part, a space inside a beat and a new line between two beats. VoiceStudio reads every character aloud, so nothing else
    is in it: no header, no count, no pause, no tag."""
    out, prev = "", None
    for u in units:
        if prev is not None:
            out += "\n" if u["beat"] != prev else " "
        out += u["text"]
        prev = u["beat"]
    return out


# ElevenLabs (PLAN-VOICE-ELEVENLABS, docs read 2026-10-28): the voice-related tags of the official list, the pauses with "..." and [pause] (never
# <break>, which v4 and v3 do not support), and the model and the settings as a note, not as text.
EL_EXPRESSIONS = ("whispers", "curious", "laughs", "sighs", "excited", "exhales")   # the ones the export may use (the official voice list)
EL_EXPRESSIONS_MAX = 6


def _elevenlabs(story: dict, parts: list[dict]) -> dict:
    """One request: the whole narration (no part headers). "..." ends a sentence before a beat changes (a final "." becomes "..."), [pause] once
    before the last tips, [whispers] before "Intip yuk!", [curious] at the start of a hook that is a question. At most one tag per beat and six in all."""
    kind_of_beat = {b["id"]: b.get("kind") for b in story["beats"]}
    tips = [b["id"] for b in story["beats"] if b.get("kind") == "tips" and (b.get("narration") or "").strip()]
    last_tips = tips[-1] if tips else None
    units = [u for part in parts for u in part["units"]]
    tags: list[dict] = []
    used: set[str] = set()
    expressions = 0
    out = ""
    prev = None
    for u in units:
        kind = kind_of_beat[u["beat"]]
        text = u["text"]
        if prev is not None and prev["beat"] != u["beat"]:
            if out.endswith("."):                                   # the sentence before a beat ends in an ellipsis
                out = out[:-1] + "..."
            if u["beat"] == last_tips and kind == "tips":
                out += " [pause] "
                tags.append({"tag": "pause", "beat": u["beat"], "at": "sebelum tips terakhir"})
            else:
                out += " "
        elif out:
            out += " "
        if u["beat"] not in used and expressions < EL_EXPRESSIONS_MAX:
            tag = None
            if kind == "sting" and re.match(r"intip yuk", text, re.I):
                tag = "whispers"
            elif kind == "hook" and text.rstrip().endswith("?") and prev is None:
                tag = "curious"
            if tag:
                text = f"[{tag}] {text}"
                used.add(u["beat"])
                expressions += 1
                tags.append({"tag": tag, "beat": u["beat"], "at": "awal kalimat"})
        out += text
        prev = u
    script = re.sub(r"\s+", " ", out).strip()
    return {"script": script, "tags": tags}


def narration_export(story: dict, target: str, options: dict | None = None) -> dict:
    """The narration text for one voice app. `text` is exactly what the person copies into the app: nothing in it is read aloud except the narration
    and the tags that app documents (the counts, the settings and the notes are in `info`, shown beside the text, never inside it). VoiceStudio: plain
    narration only, in parts of about 12 s that can be copied one by one. ElevenLabs: the script with the tags of the official voice list. Google AI
    Studio (the Gemini TTS docs, checked 2026-10-28): the script with expression tags from the verified list, and the style description as separate
    fields. The tags exist only in this export: the story has none."""
    if target not in _m.VOICE_TARGETS:
        raise _m.MotionError("voice", f"Aplikasi suara: pilih salah satu dari {', '.join(_m.VOICE_TARGETS)}.")
    parts = narration_parts(story)
    total_low = round(sum(p["low"] for p in parts), 1)
    total_high = round(sum(p["high"] for p in parts), 1)
    head = f"Total sekitar {total_low:.0f} sampai {total_high:.0f} detik, {len(parts)} bagian. Target: {_m.VOICE_TARGETS[target]}."
    base = {"target": target, "label": _m.VOICE_TARGETS[target], "total": {"low": total_low, "high": total_high},
            "parts": [{k: v for k, v in p.items() if k != "units"} for p in parts]}
    if target == "elevenlabs":
        el = _elevenlabs(story, parts)
        settings = "Stability: rendah ke sedang (lebih ekspresif); Similarity: sedang. Speed dan Style tidak ada di v4. Uji dulu tanpa tag."
        model = "Model: Eleven v4 (Eleven v3 jika v4 tidak ada)."
        info = (f"{head}\n\nPENGATURAN (di ElevenLabs, bukan teks)\n{settings}\n{model}\n\n"
                "Catatan: tag memakai kurung siku dari daftar resmi ElevenLabs (diperiksa 28 Okt 2026), bahasa Inggris. "
                "Jeda dibuat dengan ... dan [pause] karena <break> tidak didukung di Eleven v4 dan v3. "
                "Belum diverifikasi: tag pada teks Indonesia, dan dukungan tag di Multilingual v2 dan Flash v2.5.")
        return {**base, "status": "tag dari daftar resmi ElevenLabs; jeda dengan ... dan [pause]; belum diverifikasi untuk teks Indonesia",
                "style": None, "styleLong": None, "script": el["script"], "settings": settings, "model": model, "tags": el["tags"], "text": el["script"], "info": info}
    if target == "voicestudio":
        plain = [_plain(p["units"]) for p in parts]
        base["parts"] = [{**bp, "text": txt} for bp, txt in zip(base["parts"], plain)]
        text = "\n".join(plain)
        info = f"{head} VoiceStudio membaca semua karakter yang ditempel: teks ini polos, hanya kalimat narasinya, tanpa penanda atau tag. Tiap bagian bisa disalin sendiri."
        return {**base, "status": "teks polos: hanya kalimat narasinya", "style": None, "styleLong": None, "script": text, "tags": [], "text": text, "info": info}
    script, tags = _google_script(story, parts)
    style = _google_style(story)
    style_long = "Indonesian short-video science explainer. " + style[0].upper() + style[1:]
    info = (f"{head}\n\nDESKRIPSI (gaya, bahasa Inggris)\n{style}\n\n"
            f"DESKRIPSI LENGKAP (versi lama, opsional: bisa menggeser suara; coba yang singkat dulu)\n{style_long}\n\n"
            "Catatan: tag memakai <...> dan bahasa Inggris, sesuai dokumen Google (diperiksa 28 Okt 2026). Belum diverifikasi: bahasa kolom gaya dan apakah halaman AI Studio memakai kolom yang sama.")
    return {**base, "status": "tag jeda dan ekspresi dari daftar resmi; bahasa kolom gaya belum diverifikasi", "style": style, "styleLong": style_long,
            "script": script, "tags": tags, "text": script, "info": info}
