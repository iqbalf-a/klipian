"""Put a finished video of a video folder into the Clips list like a render from the /remotion page: the mp4 in out/motion/, its thumbnail, and one
Draft row whose title, description (caption, hashtags, sources) and hashtags come from the folder's story.json, so the upload needs no typing.
For the look ricks (B46), whose picture and voice are built outside the page (the voice WAV first, then `node scripts/ricksRender.mjs`).

python -m klipian.motion_clip <slug> <video.mp4> [title number 1-3]"""
import argparse
import json
import shutil
import sys
from pathlib import Path

from . import motion, paths, schedule, thumbnail


def add(slug: str, video: Path, title_no: int = 1) -> dict:
    """The row of the clip: {rowId, file, title, created}. Never overwrites a file in out/motion/ (a free name is taken) or a row's own text."""
    story_file = motion.folder_story_path(slug)
    story = json.loads(story_file.read_text(encoding="utf-8"))
    titles = [t for t in story.get("titles") or [] if isinstance(t, str) and t.strip()]
    if not titles or not 1 <= title_no <= len(titles):
        raise motion.MotionError("title", f"The story has {len(titles)} titles: choose 1 to {len(titles)}.")
    if not video.is_file():
        raise motion.MotionError("video", f"The video {video} does not exist.")
    title = titles[title_no - 1]
    urls = list(dict.fromkeys(u for c in story.get("claims") or [] for u in c.get("sources") or []))
    credit = ("Sumber:\n" + "\n".join(urls)) if urls else ""
    post = story.get("post") or {}
    block = schedule.description({"caption": post.get("description", ""), "hashtags": post.get("hashtags", [])}, credit)
    with motion._LOCK:
        name = motion._free_name(paths.safe_name(title)[:120] or slug)
        dest = schedule.folder_dir(motion.MOTION_FOLDER) / name
        shutil.copy2(video, dest)
        thumbnail.write(dest, thumbnail.text_of(story.get("thumb"), title))
        row_id, created = schedule.add_file_row(title, name, None)
        row = schedule.get_row(row_id) or {}
        fields = {"fileFolder": motion.MOTION_FOLDER, "title": title}
        if not (row.get("description") or "").strip():
            fields["description"] = block
        if not (row.get("tiktokCaption") or "").strip():
            fields["tiktokCaption"] = block
        if post.get("hashtags") and not row.get("hashtags"):
            fields["hashtags"] = list(post["hashtags"])
        schedule.set_fields(row_id, fields)
    return {"rowId": row_id, "file": name, "title": title, "created": created}


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="python -m klipian.motion_clip", description=__doc__.split("\n")[0])
    ap.add_argument("slug")
    ap.add_argument("video", type=Path)
    ap.add_argument("title_no", type=int, nargs="?", default=1)
    a = ap.parse_args(argv)
    try:
        r = add(a.slug, a.video, a.title_no)
    except motion.MotionError as exc:
        sys.exit(exc.message)
    print(f"row {r['rowId']} ({'new' if r['created'] else 'existing'}): {r['title']} <- {r['file']}")


if __name__ == "__main__":
    main()
