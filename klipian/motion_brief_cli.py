"""Print the Khusus brief for one topic (the /create skill, locally or in a cloud checkout). With no flag it is the channel defaults: 40 s, loop, the "Intip yuk!"
sting, the three voice apps, the music bed suggested for the topic (motion.suggest_music). The flags are the tokens of the -create command (the page writes them too: motion_brief.short_command):
python -m klipian.motion_brief_cli [--look iso|2d|text|ricks] [--duration 30|40|45|60] [--no-loop] [--no-sting | --sting] [--direct] [--dongeng | --kisah] [--voice a,b] [--music id] [--notes text] "gurita punya tiga jantung".
The sting is on by default, off for --look ricks (a channel of its own, B46 l); --sting turns it on there. Without --look the brief makes the agent choose the look from the topic (B28). A wrong value is refused with the page's own message. The brief is the agent one (no chat fallback, no chat mode, no narration or page steps: the skill's own answer replaces them). It only prints; it writes nothing."""
import argparse
import sys

from . import motion, motion_brief

DURATION = 40
RICKS_DURATION = 60


def brief_for(topic: str, look: str | None = None, duration: int | None = None, loop: bool = True, sting: bool | None = None,
              voice: list[str] | None = None, music: str | None = None, notes: str = "", direct: bool = False, dongeng: bool = False, kisah: bool = False) -> str:
    if duration is None:
        duration = RICKS_DURATION if look == "ricks" else DURATION          # a ricks story needs room (B50)
    if look == "ricks" and duration < 45:
        raise motion.MotionError("duration", "duration: a ricks story is 45 or 60 seconds, never 30 or 40 (B50).")
    if sting is None:
        sting = look != "ricks"                 # ricks runs on its own channel: no "Intip yuk!" unless asked (B46 l)
    options = {"kind": "khusus", "loop": loop, "sting": sting, "direct": direct, "story": "kisah" if kisah else "dongeng" if dongeng else "fakta", "music": motion.suggest_music(topic) if music in (None, "auto") else music}
    if voice:
        options["voiceTargets"] = voice
    motion.normalize_options(options)           # a wrong voice app or music is refused here, with the same message as the page
    if duration not in motion_brief.STRUCTURE:
        raise motion.MotionError("duration", f"duration: choose one of {', '.join(map(str, motion_brief.STRUCTURE))}.")
    return motion_brief.build_brief({"topic": topic.strip(), "duration": duration, "notes": notes.strip(), "options": options, "look": look, "agent": True})


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="python -m klipian.motion_brief_cli", description=__doc__.split("\n")[0])
    ap.add_argument("--look", choices=motion_brief.LOOKS)
    ap.add_argument("--duration", type=int, default=None, help="30, 40, 45, 60 or 100 (missing: 40; 60 for --look ricks, which is never under 45)")
    ap.add_argument("--no-loop", action="store_true")
    ap.add_argument("--no-sting", action="store_true")
    ap.add_argument("--sting", action="store_true", help="the sting for --look ricks, where it is off by default")
    ap.add_argument("--direct", action="store_true", help="the hook goes straight into the topic, no 'Kenapa ...' opener (always so for ricks)")
    ap.add_argument("--dongeng", action="store_true", help="a made-up everyday story carried by one true fact (B47)")
    ap.add_argument("--kisah", action="store_true", help="a real sourced story with a twist (B49)")
    ap.add_argument("--voice", help="comma list of: " + ", ".join(motion.VOICE_TARGETS))
    ap.add_argument("--music", help="one of: auto, " + ", ".join(motion.MUSIC_TRACKS))
    ap.add_argument("--notes", default="")
    ap.add_argument("topic", nargs="+")
    a = ap.parse_args(argv)
    topic = " ".join(a.topic)
    if not topic.strip():
        ap.error("the topic is empty")
    try:
        text = brief_for(topic, a.look, a.duration, not a.no_loop, False if a.no_sting else (True if a.sting else None), a.voice.split(",") if a.voice else None, a.music, a.notes, a.direct, a.dongeng, a.kisah)
    except motion.MotionError as exc:
        ap.error(str(exc))
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
