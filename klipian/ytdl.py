"""Add from YouTube (P22): download one video into the profile's sources/ with yt-dlp.

Optional dependency (requirements-download.txt): without yt-dlp everything else works and the
dialog says what to install. Every call that touches yt-dlp goes through `_net`, so the
selftest swaps it for a fake and never reaches the network.

What it does and does not do:
  * one link = one video (no playlists), MP4 up to 1080p, H.264 when YouTube has it;
  * no login, no cookies, nothing that gets around DRM, a private video, an age gate or a
    paywall: those come back as an error that says so;
  * the file is named "<channel> - <title>.mp4", the credit (platform, channel, title, the
    canonical link, the video id and the date) is filled in unless the video already has one;
  * a video already in this profile (same id) is not downloaded again, and one that another
    profile holds is linked/copied from there.

A credit is attribution, not permission to reuse the video.
"""

from __future__ import annotations

import contextvars
import datetime
import importlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from . import credits, paths

FORMAT = ("bv*[vcodec^=avc1][height<=1080]+ba[ext=m4a]/b[ext=mp4][height<=1080]"
          "/bv*[height<=1080]+ba/b")
MAX_STEM = 150            # characters of the file name without the extension
MAX_CHANNEL = 50          # a long channel name never eats the whole title
_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be",
          "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"}
_ANSI = re.compile(r"\x1b\[[0-9;]*m")
_LOCK = threading.Lock()  # deciding a file name and writing the credit happen one at a time


class YtError(Exception):
    """An error with a code the UI can switch on and a sentence for the person."""

    def __init__(self, code: str, message: str, **extra):
        super().__init__(message)
        self.code, self.message, self.extra = code, message, extra


# --------------------------------------------------------------------------
# the one place that touches yt-dlp (replaced by a fake in the selftest)
# --------------------------------------------------------------------------

class _Net:
    def module(self):
        try:
            return importlib.import_module("yt_dlp")
        except ImportError:
            raise YtError("missing", "yt-dlp is not installed.", command=install_command()) from None

    def version(self) -> str | None:
        try:
            from importlib import metadata
            importlib.invalidate_caches()
            return metadata.version("yt-dlp")
        except Exception:                                   # noqa: BLE001
            pass
        try:                                                # installed without metadata (a vendored copy)
            return str(self.module().version.__version__)
        except Exception:                                   # noqa: BLE001
            return None

    def info(self, url: str) -> dict:
        yt = self.module()
        opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "skip_download": True,
                "format": FORMAT, "socket_timeout": 20, "retries": 2}
        with yt.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=False)

    def download(self, url: str, folder: Path, hook, ffmpeg_dir: str) -> None:
        yt = self.module()
        opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "format": FORMAT,
                "merge_output_format": "mp4", "outtmpl": str(folder / "video.%(ext)s"),
                "ffmpeg_location": ffmpeg_dir, "progress_hooks": [hook],
                "postprocessor_hooks": [hook], "socket_timeout": 20, "retries": 3,
                "fragment_retries": 3, "continuedl": False, "overwrites": True,
                "noprogress": True, "restrictfilenames": False}
        with yt.YoutubeDL(opts) as ydl:
            ydl.download([url])

    def cancelled_exception(self):
        try:
            return self.module().utils.DownloadCancelled
        except Exception:                                   # noqa: BLE001
            return _Cancelled


class _Cancelled(Exception):
    pass


_net = _Net()


def install_command() -> str:
    exe = sys.executable
    req = Path(paths.ROOT) / "requirements-download.txt"
    return f'"{exe}" -m pip install -r "{req}"'


# --------------------------------------------------------------------------
# the link
# --------------------------------------------------------------------------

def video_id(url: str) -> str:
    """The 11-character id of the video a YouTube link points to. A playlist link without a
    video, a channel or any other site is not one."""
    from urllib.parse import parse_qs, urlparse
    text = str(url or "").strip()
    if not text:
        raise YtError("not_youtube", "Paste a YouTube video link.")
    if _ID.match(text) and "." not in text:
        return text                                          # the bare id
    if "://" not in text:
        text = "https://" + text
    try:
        u = urlparse(text)
    except ValueError:
        raise YtError("not_youtube", "That is not a YouTube video link.") from None
    host = (u.hostname or "").lower()
    if u.scheme not in ("http", "https") or host not in _HOSTS:
        raise YtError("not_youtube", "That is not a YouTube video link.")
    vid = ""
    parts = [p for p in u.path.split("/") if p]
    if host.endswith("youtu.be"):
        vid = parts[0] if parts else ""
    elif parts and parts[0] == "watch":
        vid = (parse_qs(u.query).get("v") or [""])[0]
    elif len(parts) >= 2 and parts[0] in ("shorts", "live", "embed", "v"):
        vid = parts[1]
    if not _ID.match(vid):
        raise YtError("not_youtube", "That link does not point to one YouTube video "
                                     "(a playlist, a channel or a page, not a video).")
    return vid


def canonical_url(vid: str) -> str:
    return f"https://www.youtube.com/watch?v={vid}"


# --------------------------------------------------------------------------
# the file name
# --------------------------------------------------------------------------

# Quote characters are left out of a file name: the name goes into Claude's reply ("source": "...")
# and a quote copied as a straight one would break the JSON. An apostrophe inside a word goes too
# ("Don't" -> "Dont"); the credit keeps the title as YouTube wrote it.
def _clean(text: str) -> str:
    return paths.safe_name(text)


def file_stem(channel: str, title: str) -> str:
    """`<channel> - <title>`, made what Windows keeps: no forbidden characters, no spaces or dots
    at the end, no device name, at most MAX_STEM characters. No video id."""
    ch = _clean(channel)[:MAX_CHANNEL].strip(" .")
    ti = _clean(title)
    stem = f"{ch} - {ti}" if ch and ti else (ch or ti or "YouTube video")
    if len(stem) > MAX_STEM:
        stem = stem[:MAX_STEM].rstrip(" .-")
    return paths.safe_dirname(stem)


def free_name(stem: str, same_video) -> str:
    """The first of `<stem>.mp4`, `<stem> (2).mp4` ... that is not taken by a DIFFERENT video.
    `same_video(name)` says whether a file already there is this very video (then it is reused)."""
    folder = paths.SOURCES
    n = 1
    while True:
        name = f"{stem}.mp4" if n == 1 else f"{stem} ({n}).mp4"
        if not (folder / name).exists() or same_video(name):
            return name
        n += 1


# --------------------------------------------------------------------------
# where the video may already be
# --------------------------------------------------------------------------

def _entries(folder: Path) -> dict[str, dict]:
    return credits.load(folder)


def find_in_profile(vid: str) -> str | None:
    """The file in this profile's sources/ that is this YouTube video, if any."""
    for name, c in _entries(Path(paths.SOURCES)).items():
        if c.get("videoId") == vid:
            return name
    return None


def find_in_other_profile(vid: str) -> tuple[str, str] | None:
    """(profile id, file name) of a copy in another profile."""
    root = Path(paths.PROFILES_DIR)
    if not root.is_dir():
        return None
    for other in sorted(root.iterdir()):
        if other.name == paths.current_profile() or not (other / "sources").is_dir():
            continue
        for name, c in _entries(other / "sources").items():
            if c.get("videoId") == vid:
                return other.name, name
    return None


# --------------------------------------------------------------------------
# what is installed
# --------------------------------------------------------------------------

def status() -> dict:
    version = _net.version()
    ffmpeg = bool(shutil.which("ffmpeg"))
    out = {"installed": version is not None, "version": version, "ffmpeg": ffmpeg,
           "command": install_command()}
    return out


# --------------------------------------------------------------------------
# errors
# --------------------------------------------------------------------------

def map_error(exc: BaseException) -> YtError:
    """A yt-dlp/network failure as an error the person can act on."""
    if isinstance(exc, YtError):
        return exc
    raw = _ANSI.sub("", str(exc) or type(exc).__name__)
    low = raw.lower()
    if isinstance(exc, ImportError):
        return YtError("missing", "yt-dlp is not installed.", command=install_command())
    if "ffmpeg" in low and ("not found" in low or "not installed" in low or "no such file" in low
                            or "ffprobe" in low):
        return YtError("no_ffmpeg", "ffmpeg was not found. klipian needs it to join the video and sound.")
    if "private video" in low:
        return YtError("private", "This video is private. klipian cannot download it.")
    if "age" in low and ("confirm your age" in low or "age-restricted" in low or "age restricted" in low):
        return YtError("age", "This video is age-restricted and needs a signed-in account. "
                              "klipian does not sign in, so it cannot download it.")
    if "members-only" in low or "members only" in low or "join this channel" in low or "premium" in low and "only" in low:
        return YtError("paywall", "This video is for members or paying viewers only. klipian cannot download it.")
    if ("live event will begin" in low or "premieres in" in low or "is upcoming" in low
            or "this live event" in low or "is_live" in low or "live stream" in low and "not" in low):
        return YtError("live", "This is a live stream (or a premiere) that is not finished. "
                               "Try again after it has ended.")
    if "requested format" in low:
        return YtError("outdated", "YouTube did not accept the request. yt-dlp may be out of date: "
                                   "press Update yt-dlp and try again.")
    if ("has been removed" in low or "video unavailable" in low or "is not available" in low
            or "no longer available" in low or "does not exist" in low or "terminated" in low
            or "blocked it" in low or "copyright" in low):
        return YtError("removed", "This video is not available (removed, blocked or never existed).")
    if any(k in low for k in ("getaddrinfo", "urlopen error", "unable to download webpage",
                              "timed out", "timeout", "network is unreachable", "connection reset",
                              "connection aborted", "temporary failure", "name resolution",
                              "remote end closed", "ssl:")) or isinstance(exc, (ConnectionError, TimeoutError)):
        return YtError("network", "Could not reach YouTube. Check the internet connection and try again.")
    if any(k in low for k in ("unable to extract", "nsig", "http error 403", "sign in to confirm",
                              "requested format is not available", "player response", "signature",
                              "please report this issue", "update yt-dlp", "yt-dlp -u")):
        return YtError("outdated", "YouTube did not accept the request. yt-dlp may be out of date: "
                                   "press Update yt-dlp and try again.")
    first = raw.strip().splitlines()[0] if raw.strip() else type(exc).__name__
    return YtError("other", f"The download failed: {first[:200]}")


# --------------------------------------------------------------------------
# preview
# --------------------------------------------------------------------------

def _size_estimate(info: dict) -> int | None:
    parts = info.get("requested_formats") or [info]
    total = 0
    for f in parts:
        size = f.get("filesize") or f.get("filesize_approx")
        if not size:
            return None
        total += int(size)
    return total or None


def preview(url: str) -> dict:
    """What the link is, before anything is downloaded."""
    vid = video_id(url)
    existing = find_in_profile(vid)
    other = None if existing else find_in_other_profile(vid)
    try:
        info = _net.info(canonical_url(vid))
    except YtError:
        raise
    except Exception as exc:                                  # noqa: BLE001
        raise map_error(exc) from None
    if not isinstance(info, dict):
        raise YtError("other", "YouTube returned nothing for this link.")
    if info.get("_type") == "playlist":
        raise YtError("not_youtube", "That link is a playlist; paste the link of one video.")
    live = info.get("live_status") or ""
    if info.get("is_live") or live in ("is_live", "is_upcoming"):
        raise YtError("live", "This is a live stream (or a premiere) that is not finished. "
                              "Try again after it has ended.")
    channel = info.get("channel") or info.get("uploader") or ""
    title = info.get("title") or ""
    out = {"id": vid, "title": title, "channel": channel, "duration": info.get("duration"),
           "thumbnail": info.get("thumbnail"), "size": _size_estimate(info),
           "height": info.get("height"), "url": canonical_url(vid),
           "fileName": existing or f"{file_stem(channel, title)}.mp4",
           "inProfile": existing, "inOtherProfile": other[0] if other else None}
    if out["thumbnail"] and not str(out["thumbnail"]).lower().startswith("https://"):
        out["thumbnail"] = None
    return out


# --------------------------------------------------------------------------
# the download job
# --------------------------------------------------------------------------

_JOBS: dict[str, dict] = {}
_JOBS_LOCK = threading.Lock()
_CANCEL: dict[str, threading.Event] = {}
_ACTIVE: dict[tuple[str, str], str] = {}                      # (profile, video id) -> job id


def _set(jid: str, **fields) -> None:
    with _JOBS_LOCK:
        if jid in _JOBS:
            _JOBS[jid].update(fields)


def state(jid: str) -> dict:
    with _JOBS_LOCK:
        job = _JOBS.get(jid)
        if not job or job.get("profile") != paths.current_profile():
            return {"state": "missing"}
        return dict(job)


def _temp_root() -> Path:
    return Path(paths.SOURCES) / ".ytdl"


def clean_stale() -> None:
    """Leftovers of a download that was killed (the server stopped): folders under sources/.ytdl
    that no running job owns."""
    root = _temp_root()
    if not root.is_dir():
        return
    with _JOBS_LOCK:
        alive = {j.get("temp") for j in _JOBS.values() if j.get("state") in ("running", "queued")}
    for d in root.iterdir():
        if str(d) not in alive:
            shutil.rmtree(d, ignore_errors=True)
    try:
        root.rmdir()
    except OSError:
        pass


def _credit_for(info: dict, vid: str) -> dict:
    return {"platform": "YouTube", "creator": info.get("channel") or info.get("uploader") or "",
            "title": info.get("title") or "", "url": canonical_url(vid), "videoId": vid,
            "downloaded": datetime.date.today().isoformat()}


def _put_credit(name: str, entry: dict) -> bool:
    """Write the credit unless this video already has one (never overwritten)."""
    with _LOCK:
        if name in credits.load():
            return False
        credits.save(name, entry)
        return True


def _from_other(other: tuple[str, str]) -> tuple[str, str | None]:
    """Link (or copy) the other profile's file here and copy its credit."""
    pid, name = other
    src = paths.profile_dir(pid) / "sources" / name
    theirs = credits.load(paths.profile_dir(pid) / "sources").get(name) or {}
    with _LOCK:
        dest_name = free_name(Path(name).stem, lambda n: False)
        dest = Path(paths.SOURCES) / dest_name
        Path(paths.SOURCES).mkdir(parents=True, exist_ok=True)
        try:
            os.link(src, dest)
        except OSError:
            shutil.copy2(src, dest)
        credits.save(dest_name, theirs)
    return dest_name, pid


def start(url: str) -> dict:
    """Begin the download. Returns {"id": job id}, or {"id": None, "name": file} when this
    profile already has the video (nothing to do) -- a copy from another profile is made at once."""
    vid = video_id(url)
    st = status()
    if not st["installed"]:
        raise YtError("missing", "yt-dlp is not installed.", command=st["command"])
    existing = find_in_profile(vid)
    if existing:
        return {"id": None, "name": existing, "existed": True}
    other = find_in_other_profile(vid)
    if other:
        name, pid = _from_other(other)
        return {"id": None, "name": name, "existed": False, "copiedFrom": pid}
    if not st["ffmpeg"]:
        raise YtError("no_ffmpeg", "ffmpeg was not found. klipian needs it to join the video and sound.")
    prof = paths.current_profile()
    with _JOBS_LOCK:
        running = _ACTIVE.get((prof, vid))
        if running:
            return {"id": running, "name": None, "existed": False}
    clean_stale()
    jid = uuid.uuid4().hex[:10]
    temp = _temp_root() / jid
    ev = threading.Event()
    with _JOBS_LOCK:
        _JOBS[jid] = {"state": "queued", "percent": 0, "message": "Starting…", "profile": prof,
                      "videoId": vid, "temp": str(temp), "title": None}
        _CANCEL[jid] = ev
        _ACTIVE[(prof, vid)] = jid
    threading.Thread(target=contextvars.copy_context().run, args=(_run, jid, vid, temp, ev),
                     daemon=True).start()
    return {"id": jid, "name": None, "existed": False}


def _run(jid: str, vid: str, temp: Path, ev: threading.Event) -> None:
    prof = paths.current_profile()
    cancel_exc = _net.cancelled_exception()
    seen: list[str] = []

    def hook(d: dict) -> None:
        if ev.is_set():
            raise cancel_exc("cancelled")
        if d.get("postprocessor"):
            if d.get("status") == "started":
                _set(jid, message="Joining video and sound…", percent=99, speed=None, eta=None)
            return
        if d.get("status") != "downloading":
            return
        fn = str(d.get("filename") or "")
        if fn not in seen:
            seen.append(fn)
        total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
        frac = (d.get("downloaded_bytes") or 0) / total if total else 0
        parts = max(len((d.get("info_dict") or {}).get("requested_formats") or []), 1)
        pct = min(98, int(100 * ((len(seen) - 1) + min(frac, 1)) / max(parts, len(seen))))
        _set(jid, state="running", percent=pct, speed=d.get("speed"), eta=d.get("eta"),
             message="Downloading…")

    try:
        _set(jid, state="running", message="Reading the video…")
        info = _net.info(canonical_url(vid))
        if info.get("is_live") or (info.get("live_status") or "") in ("is_live", "is_upcoming"):
            raise YtError("live", "This is a live stream (or a premiere) that is not finished. "
                                  "Try again after it has ended.")
        size = _size_estimate(info) or 0
        Path(paths.SOURCES).mkdir(parents=True, exist_ok=True)
        free = shutil.disk_usage(paths.SOURCES).free
        if size and size * 2 + (1 << 30) > free:
            raise YtError("disk", f"Not enough disk space: about {size / 1024 ** 3:.1f} GB needed "
                                  f"(twice, while joining), {free / 1024 ** 3:.1f} GB free.")
        temp.mkdir(parents=True, exist_ok=True)
        ffmpeg_dir = str(Path(shutil.which("ffmpeg") or "").parent)
        _net.download(canonical_url(vid), temp, hook, ffmpeg_dir)
        if ev.is_set():
            raise cancel_exc("cancelled")
        made = sorted(p for p in temp.glob("video.*") if p.suffix.lower() == ".mp4" and p.is_file())
        if not made:
            raise YtError("other", "The download finished but no video file came out.")
        stem = file_stem(info.get("channel") or info.get("uploader") or "", info.get("title") or "")
        with _LOCK:
            name = free_name(stem, lambda n: (credits.load().get(n) or {}).get("videoId") == vid)
            dest = Path(paths.SOURCES) / name
            if not dest.exists():
                os.replace(made[0], dest)
        wrote = _put_credit(name, _credit_for(info, vid))
        _set(jid, state="done", percent=100, name=name, creditWritten=wrote, message="Done.",
             speed=None, eta=None)
    except BaseException as exc:                              # noqa: BLE001
        if ev.is_set() or isinstance(exc, cancel_exc):
            _set(jid, state="cancelled", message="Cancelled.", speed=None, eta=None)
        else:
            err = map_error(exc)
            _set(jid, state="failed", code=err.code, message=err.message, speed=None, eta=None,
                 **({"command": err.extra["command"]} if "command" in err.extra else {}))
    finally:
        shutil.rmtree(temp, ignore_errors=True)
        try:
            temp.parent.rmdir()
        except OSError:
            pass
        with _JOBS_LOCK:
            _CANCEL.pop(jid, None)
            if _ACTIVE.get((prof, vid)) == jid:
                _ACTIVE.pop((prof, vid), None)
            _JOBS[jid].pop("temp", None)


def cancel(jid: str) -> dict:
    with _JOBS_LOCK:
        ev = _CANCEL.get(jid)
        job = _JOBS.get(jid)
        if not job or job.get("profile") != paths.current_profile():
            return {"state": "missing"}
    if ev:
        ev.set()
        _set(jid, message="Cancelling…")
    return state(jid)


# --------------------------------------------------------------------------
# keeping yt-dlp current (YouTube changes often)
# --------------------------------------------------------------------------

def start_update() -> str:
    jid = uuid.uuid4().hex[:10]
    with _JOBS_LOCK:
        _JOBS[jid] = {"state": "running", "message": "Updating yt-dlp…", "profile": paths.current_profile(),
                      "kind": "update"}

    def run() -> None:
        try:
            before = _net.version()
            proc = subprocess.run([sys.executable, "-m", "pip", "install", "-U", "yt-dlp"],
                                  capture_output=True, text=True, encoding="utf-8", errors="replace",
                                  timeout=300)
            if proc.returncode != 0:
                tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-1:] or ["pip failed"]
                raise YtError("other", f"The update failed: {tail[0][:200]}")
            for mod in [m for m in sys.modules if m == "yt_dlp" or m.startswith("yt_dlp.")]:
                del sys.modules[mod]                          # the next download loads the new one
            after = _net.version()
            msg = (f"yt-dlp is up to date ({after})." if before == after
                   else f"yt-dlp updated: {before or 'not installed'} → {after}.")
            _set(jid, state="done", message=msg, version=after)
        except subprocess.TimeoutExpired:
            _set(jid, state="failed", code="network", message="The update took too long. Check the connection and try again.")
        except YtError as exc:
            _set(jid, state="failed", code=exc.code, message=exc.message)
        except Exception as exc:                              # noqa: BLE001
            _set(jid, state="failed", code="other", message=f"The update failed ({type(exc).__name__}).")

    threading.Thread(target=contextvars.copy_context().run, args=(run,), daemon=True).start()
    return jid
