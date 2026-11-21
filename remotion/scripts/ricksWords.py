"""Word timings of a ricks voice (B46): python -I remotion/scripts/ricksWords.py <voice.wav> <out words.json> [script.txt]

The ricks look is built to the voice: every shot, face, pill and caption word lands on a word of it. faster-whisper (klipian's own .venv,
model large-v3-turbo, Indonesian) gives [{"w", "a", "b"}] in seconds; the script text, when given, primes it with the exact words.
Run it with the .venv of ian's checkout: <checkout>/.venv/Scripts/python.exe (a worktree has no .venv of its own)."""
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def words(voice: str, prompt: str = "") -> list[dict]:
    model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(voice, language="id", word_timestamps=True, initial_prompt=prompt[:600] or None)
    return [{"w": w.word.strip(), "a": round(w.start, 2), "b": round(w.end, 2)} for s in segs for w in s.words]


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    prompt = Path(sys.argv[3]).read_text(encoding="utf-8") if len(sys.argv) > 3 else ""
    out = words(sys.argv[1], prompt)
    Path(sys.argv[2]).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(" ".join(f"{x['w']}@{x['a']}" for x in out))
    print(f"{len(out)} words, last ends at {out[-1]['b'] if out else 0} s")
