"""The voice of the cold open: the hook said by Gemini text-to-speech, cached on disk.

`voice_for(text)` returns (wav path, seconds). The model and the voice are settings in the Gemini settings file
(`ttsModel`, `ttsVoice`, next to the key; the defaults below), the key is the one Admin already holds. The WAV is made
once per (text, model, voice, style) in cache/tts/, trimmed of silence at both ends and levelled to the loudness of a
spoken clip, so a re-render never calls Google again. Raises TtsError with a plain reason; the caller decides what to do."""
from __future__ import annotations

import hashlib
import io
import re
import subprocess
import time
import wave
from pathlib import Path

from . import gemini_api, paths

DEFAULT_MODEL = "gemini-3.8-flash-tts"
DEFAULT_VOICE = "Fola"
# How the hook is said: the `speech_metadata` annotation of the Interactions API (the docs of gemini-3.8 TTS), NOT words in the text:
# the model reads the text as a verbatim transcript, so a direction put in front of it is spoken (heard with Whisper). Keep it short.
DEFAULT_STYLE = ("Bahasa Indonesia santai, energik, dramatis dan menarik perhatian seperti pembuka Shorts atau Reels. "
                 "Tempo cepat, tekanan kuat di kata kunci, tanpa jeda di awal.")
API_VERSION = "v1beta"                                 # the TTS models are only served there
LOUDNESS = -16                                         # LUFS: what a loud podcast clip sounds like
MAX_SEC = 3.0
SAMPLE = "Ini contoh suara pembuka klip kamu!"


class TtsError(RuntimeError):
    pass


def settings() -> tuple[str, str, str]:
    """(model, voice, style) from the Gemini settings file: `ttsModel`, `ttsVoice`, `ttsStyle` (a text; "" = no style)."""
    s = gemini_api.load_settings()
    return str(s.get("ttsModel") or DEFAULT_MODEL), str(s.get("ttsVoice") or DEFAULT_VOICE), str(s["ttsStyle"] if isinstance(s.get("ttsStyle"), str) else DEFAULT_STYLE)


def state() -> dict:
    """What the profile page shows: the saved values (empty = the default applies), the defaults, and whether a voice can be made."""
    s = gemini_api.load_settings()
    return {"model": str(s.get("ttsModel") or ""), "voice": str(s.get("ttsVoice") or ""),
            "style": str(s["ttsStyle"]) if isinstance(s.get("ttsStyle"), str) else "", "noStyle": s.get("ttsStyle") == "",
            "defaults": {"model": DEFAULT_MODEL, "voice": DEFAULT_VOICE, "style": DEFAULT_STYLE},
            "hasKey": bool(s.get("apiKey")), "sdk": gemini_api.sdk_available()}


def save(model: str, voice: str, style: str, no_style: bool) -> None:
    """Keep the three settings in the Gemini settings file (never in a profile: it may be in git). Blank = the default;
    `no_style` is the deliberate empty style."""
    gemini_api.save_settings(tts={"model": model, "voice": voice, "style": "" if no_style else (style.strip() or None)})


def say_text(text: str) -> str:
    """What is spoken: the card text without its `*` marks, spaces collapsed."""
    t = " ".join(text.replace("*", " ").split())
    return t if not t or t[-1] in ".!?" else t + "!"          # a closing "!" is the only energy the plain text asks for


def _wav_bytes(data: bytes, mime: str) -> bytes:
    """Google answers with a WAV or with raw 16-bit PCM ("audio/L16;rate=24000"); a WAV is what ffmpeg and `wave` read."""
    if data[:4] == b"RIFF":
        return data
    m = re.search(r"rate=(\d+)", mime or "")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(m.group(1)) if m else 24000)
        w.writeframes(data)
    return buf.getvalue()


def _audio_via_interactions(text: str, style: str, model: str, voice: str, client) -> bytes:
    import base64
    note = [{"type": "speech_metadata", "style": style}] if style else []
    r = client.interactions.create(
        model=model,
        input=[{"type": "user_input", "content": [{"type": "text", "text": text, **({"annotations": note} if note else {})}]}],
        response_format={"type": "audio"},
        generation_config={"speech_config": [{"voice": voice}]})
    return _wav_bytes(base64.b64decode(r.output_audio.data), "")


def _audio_via_generate(text: str, model: str, voice: str, client) -> bytes:
    """The older call, without a style: for a model the Interactions call does not take."""
    from google.genai import types
    config = types.GenerateContentConfig(
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))))
    part = client.models.generate_content(model=model, contents=text, config=config).candidates[0].content.parts[0].inline_data
    return _wav_bytes(part.data, getattr(part, "mime_type", ""))


def _synthesize(text: str, style: str, model: str, voice: str, client, pause) -> bytes:
    for attempt in (0, 1):
        try:
            try:
                return _audio_via_interactions(text, style, model, voice, client)
            except Exception as exc:                      # noqa: BLE001
                if gemini_api.map_error(exc).code in ("quota", "bad_key", "no_key", "sdk"):
                    raise
                return _audio_via_generate(text, model, voice, client)        # a model the new call does not know: plain, no style
        except gemini_api.GeminiError:
            raise
        except Exception as exc:                          # noqa: BLE001
            err = gemini_api.map_error(exc)
            if err.code == "quota" and attempt == 0 and gemini_api._retry_delay(exc) <= 45:
                pause(gemini_api._retry_delay(exc))        # the free tier allows 3 a minute: one wait, one more try
                continue
            raise err from None
    raise TtsError("no audio")


def _level(src: Path, dest: Path) -> None:
    """Trim the silence at both ends and level to LOUDNESS (one pass is enough for a few seconds of speech)."""
    from .ffmpeg_tools import _require
    cut = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05"
    af = f"{cut},areverse,{cut},areverse,loudnorm=I={LOUDNESS}:TP=-1.5:LRA=7"
    r = subprocess.run([_require("ffmpeg"), "-y", "-hide_banner", "-loglevel", "error", "-i", str(src), "-af", af,
                        "-ar", "48000", "-ac", "1", str(dest)], capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise TtsError("ffmpeg could not level the voice: " + (r.stderr or "").strip()[-200:])


def seconds_of(wav: Path) -> float:
    with wave.open(str(wav), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def voice_for(text: str, *, client=None, pause=time.sleep, cache_dir: Path | None = None) -> tuple[Path, float]:
    """(wav, seconds) of `text` spoken, from the cache or made now. `client` is a test double (see selftest)."""
    text = say_text(text)
    if not text:
        raise TtsError("there is no text to say")
    model, voice, style = settings()
    folder = (cache_dir or Path(paths.CACHE_DIR)) / "tts"
    key = hashlib.sha1("\n".join((model, voice, style, str(LOUDNESS), text)).encode("utf-8")).hexdigest()[:20]
    out = folder / f"{key}.wav"
    if not out.is_file():
        try:
            client = client or gemini_api._client(API_VERSION)
            raw = _synthesize(text, style, model, voice, client, pause)
        except gemini_api.GeminiError as exc:
            raise TtsError(str(exc)) from None
        folder.mkdir(parents=True, exist_ok=True)
        tmp = folder / f"{key}.raw.wav"
        tmp.write_bytes(raw)
        try:
            _level(tmp, out)
        finally:
            tmp.unlink(missing_ok=True)
    return out, seconds_of(out)


def clip_gain_db(video: Path, start: float, seconds: float = 20.0) -> float:
    """dB to add to the (LOUDNESS-levelled) voice so it sits as loud as the clip's own speech: measured over the first
    `seconds` of the clip, kept within -6..+9 dB. 0 when the measure fails."""
    from .ffmpeg_tools import _require
    try:
        r = subprocess.run([_require("ffmpeg"), "-hide_banner", "-nostats", "-ss", f"{start:.2f}", "-t", f"{seconds:.1f}", "-i", str(video),
                            "-vn", "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, timeout=90)
        hits = re.findall(r"\bI:\s+(-?\d+(?:\.\d+)?)\s+LUFS", r.stderr)
        return max(-6.0, min(9.0, float(hits[-1]) - LOUDNESS)) if hits else 0.0
    except (OSError, subprocess.SubprocessError, ValueError):
        return 0.0
