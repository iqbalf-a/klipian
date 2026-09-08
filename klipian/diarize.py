"""Active speaker detection (speaker diarization) for AI Framing.

Used to answer "who is speaking at which second" within a clip, so the
framing box can automatically follow the person -- see the design discussion
before this module was written: the audio-only approach via pyannote was
chosen over manual face detection because podcast audio recorded with
separate mics is much cleaner and cheaper to compute than per-frame
computer vision.

Requires HF_TOKEN (see .env.example) -- the `speaker-diarization-community-1`
model is free but still gated on HuggingFace: the token is used ONCE to
download the weights, then it runs offline like Whisper.

Windows note: pyannote 4.x uses `torchcodec` to decode audio, and that
package fails to load its native DLL on many Windows installations (see
the experiments before this module was written -- error "Could not load
this library"). The workaround: read audio manually via `soundfile`, then
pass it to the pipeline as a waveform tensor instead of a file path -- this
makes the pipeline never call torchcodec at all.
"""

from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path

_pipeline = None   # singleton -- loading the model takes tens of seconds, don't repeat
# The server uses ThreadingHTTPServer: two /api/diarize requests can arrive
# simultaneously (e.g. another tab, or a Result clip with multiple spans
# being processed accidentally overlapping). The pyannote model is NOT safe
# to call from two threads at once -- this lock forces one inference to
# finish before the next one starts, regardless of who calls it.
_pipeline_lock = threading.Lock()


def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "HF_TOKEN is not set. Create a free token at "
            "https://huggingface.co/settings/tokens, grant model access at "
            "https://huggingface.co/pyannote/speaker-diarization-community-1, "
            "then set HF_TOKEN=... in the .env file (see .env.example)."
        )
    from pyannote.audio import Pipeline
    _pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-community-1", token=token,
    )
    return _pipeline


def _merge_turns(turns: list[dict], min_gap: float = 1.5,
                  min_dur: float = 0.6) -> list[dict]:
    """Super short turns (<min_dur) are dropped -- likely backchannel
    ("yeah", "hmm", brief laughter), not real speaking turns. Consecutive
    turns from the SAME speaker with gaps <min_gap are merged into one --
    without this, every breath pause triggers a new framing point and the
    video flickers. Consistent with the existing FRAMING principle: hard
    cuts, no creeping."""
    turns = sorted(turns, key=lambda t: t["start"])
    turns = [t for t in turns if t["end"] - t["start"] >= min_dur]
    if not turns:
        return []
    merged = [dict(turns[0])]
    for t in turns[1:]:
        last = merged[-1]
        if t["speaker"] == last["speaker"] and t["start"] - last["end"] < min_gap:
            last["end"] = max(last["end"], t["end"])
        else:
            t = dict(t)
            # Different speaker but overlapping times (pyannote occasionally
            # leaves overlaps at boundaries). Framing consumers expect
            # disjoint turns, so shift this turn's start to the previous end.
            if t["start"] < last["end"]:
                t["start"] = last["end"]
            if t["end"] <= t["start"]:
                continue                    # fully consumed by overlap, discard
            merged.append(t)
    return merged


def diarize_segment(video: Path, start: float, end: float) -> list[dict]:
    """Speaking turns within [start, end) seconds of the SOURCE video.

    Return a list of {start, end, speaker} -- speaker is an arbitrary label
    from the pipeline ("SPEAKER_00", etc.), times are relative to the
    SOURCE video (not relative to the segment cut)."""
    import soundfile as sf
    import torch

    from .ffmpeg_tools import _require, run

    pipeline = _load_pipeline()

    with tempfile.TemporaryDirectory(prefix="klipian-diarize-") as tmp:
        wav = Path(tmp) / "segmen.wav"
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-t", f"{max(0.1, end - start):.3f}",
            "-i", str(video),
            "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
            str(wav),
        ], desc="extracting segment audio")

        data, sr = sf.read(str(wav), dtype="float32")
        if data.ndim == 1:
            data = data[:, None]
        waveform = torch.from_numpy(data.T)   # (channel, time)
        with _pipeline_lock:
            result = pipeline({"waveform": waveform, "sample_rate": sr})

    turns = [
        {"start": round(start + turn.start, 3),
         "end": round(start + turn.end, 3),
         "speaker": speaker}
        for turn, _, speaker in
        result.exclusive_speaker_diarization.itertracks(yield_label=True)
    ]
    return _merge_turns(turns)
