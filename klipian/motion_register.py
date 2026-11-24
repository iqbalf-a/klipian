"""Put a finished video folder on the Motion page: python -m klipian.motion_register <slug> [--wav FILE] [--workspace DIR] [--videos DIR] [--profile ID]
The /create skill runs it after the push, from ian's checkout, so the video shows up in /remotion with the story taken (and the voice, when a wav is given)
without the steps "choose the folder" and "load the story". The folder is read from --videos (the worktree's remotion/videos, which holds the new video before
ian pulls); the project is written into --workspace (ian's workspace/). A project that already uses the slug is reused, never duplicated."""
import argparse
import json
import sys
from pathlib import Path

from . import motion, paths

DEFAULT_PROFILES = {"ricks": "sebatang-cerita"}      # a ricks video is its own channel; every other video is an intip one
FALLBACK_PROFILE = "klipian-intip"


def register(slug: str, wav: str | None = None, profile: str | None = None) -> dict:
    """Creates (or finds) the Motion project of remotion/videos/<slug>/ in the current workspace and profile. Returns {id, created, voice}."""
    story_file = motion.folder_story_path(slug)                          # the same checks as "Load the story from the folder"
    story = json.loads(story_file.read_text(encoding="utf-8"))
    look = story.get("look") or "auto"
    token = paths.set_profile(profile or DEFAULT_PROFILES.get(look, FALLBACK_PROFILE))
    try:
        found = next((p for p in motion.list_projects() if (p.get("composition") or p.get("slug")) == slug), None)
        if found:
            pid, created = found["id"], False
        else:
            meta = {}
            try:
                meta = json.loads((story_file.parent / "meta.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pass
            titles = story.get("titles") or []
            topic = str(meta.get("title") or (titles[0] if titles else "") or slug)
            seconds = float(story.get("duration") or 0)
            duration = min(motion.DURATIONS, key=lambda d: abs(d - seconds))   # ricks runs 45 to 60 s and need not be exactly a length of the list
            options = {"kind": "khusus", "look": look if look in motion.LOOK_CHOICES else "auto", "loop": True, "sting": look != "ricks",
                       "music": (story.get("music") or {}).get("track") or "auto"}
            try:
                motion.normalize_options(options)
            except motion.MotionError:
                options["music"] = "auto"
            pid = motion.create(topic, duration, options=options)["id"]
            with motion._LOCK:                                            # taken like take_folder, without its length check (a ricks story lasts what its voice lasts)
                motion._accept(pid, story)
                p = motion.load(pid)
                p["composition"] = slug
                p["folderTake"] = {"slug": slug, "hash": motion._file_hash(story_file), "at": int(__import__("time").time())}
                motion.save(p)
            created = True
        voice = None
        if wav:
            voice = motion.import_voice(pid, source=Path(wav))
        return {"id": pid, "created": created, "voice": bool(voice)}
    finally:
        paths._profile.reset(token)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="python -m klipian.motion_register", description=__doc__.split("\n")[0])
    ap.add_argument("slug")
    ap.add_argument("--wav", default=None, help="the voice file (look ricks): imported as the video's narration")
    ap.add_argument("--workspace", default=None, help="the workspace to write into (default: workspace/ of this checkout)")
    ap.add_argument("--videos", default=None, help="the remotion/videos folder that holds the video (default: this checkout's)")
    ap.add_argument("--profile", default=None, help="the channel (default: sebatang-cerita for ricks, else klipian-intip)")
    a = ap.parse_args(argv)
    if a.workspace:
        paths.use_workspace(a.workspace)
    if a.videos:
        motion.VIDEOS_ROOT = Path(a.videos)
    try:
        r = register(a.slug, a.wav, a.profile)
    except motion.MotionError as e:
        sys.exit(f"motion_register: {e}")
    print(f'{"made" if r["created"] else "found"} motion project {r["id"]}' + (" (voice imported)" if r["voice"] else ""))


if __name__ == "__main__":
    main()
