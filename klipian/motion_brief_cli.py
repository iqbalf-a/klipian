"""Print the Khusus brief for one topic (the /create skill, locally or in a cloud checkout). With no flag it is the channel defaults: 60 s, loop, the "Intip yuk!"
sting, the three voice apps, the default music. The flags are the tokens of the -create command (the page writes them too: motion_brief.short_command):
python -m klipian.motion_brief_cli [--look iso|2d|text] [--duration 30|45|60] [--no-loop] [--no-sting] [--voice a,b] [--music id] [--notes text] "gurita punya tiga jantung".
Without --look the brief makes the agent choose the look from the topic (B28). A wrong value is refused with the page's own message. It only prints; it writes nothing."""
import argparse
import sys

from . import motion, motion_brief

DURATION = 60


def brief_for(topic: str, look: str | None = None, duration: int = DURATION, loop: bool = True, sting: bool = True,
              voice: list[str] | None = None, music: str | None = None, notes: str = "") -> str:
    options = {"kind": "khusus", "loop": loop, "sting": sting, "music": music or motion.DEFAULT_OPTIONS["music"]}
    if voice:
        options["voiceTargets"] = voice
    motion.normalize_options(options)           # a wrong voice app or music is refused here, with the same message as the page
    if duration not in motion_brief.STRUCTURE:
        raise motion.MotionError("duration", f"durasi: pilih salah satu dari {', '.join(map(str, motion_brief.STRUCTURE))}.")
    return motion_brief.build_brief({"topic": topic.strip(), "duration": duration, "notes": notes.strip(), "options": options, "look": look})


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="python -m klipian.motion_brief_cli", description=__doc__.split("\n")[0])
    ap.add_argument("--look", choices=motion_brief.LOOKS)
    ap.add_argument("--duration", type=int, default=DURATION)
    ap.add_argument("--no-loop", action="store_true")
    ap.add_argument("--no-sting", action="store_true")
    ap.add_argument("--voice", help="comma list of: " + ", ".join(motion.VOICE_TARGETS))
    ap.add_argument("--music", help="one of: auto, " + ", ".join(motion.MUSIC_TRACKS))
    ap.add_argument("--notes", default="")
    ap.add_argument("topic", nargs="+")
    a = ap.parse_args(argv)
    topic = " ".join(a.topic)
    if not topic.strip():
        ap.error("the topic is empty")
    try:
        text = brief_for(topic, a.look, a.duration, not a.no_loop, not a.no_sting, a.voice.split(",") if a.voice else None, a.music, a.notes)
    except motion.MotionError as exc:
        ap.error(str(exc))
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
