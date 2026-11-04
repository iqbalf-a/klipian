"""Print the Khusus brief for one topic with the channel defaults (60 s, loop, "Intip yuk!" sting, the three voice apps, the default music).
Used by the /create skill in a cloud checkout: python -m klipian.motion_brief_cli [--look iso|2d|text] "gurita punya tiga jantung".
Without --look the brief makes the agent choose the look from the topic (B28). It only prints; it writes nothing."""
import sys

from . import motion_brief

DURATION = 60


def brief_for(topic: str, look: str | None = None) -> str:
    return motion_brief.build_brief({"topic": topic.strip(), "duration": DURATION, "notes": "", "options": {"kind": "khusus"}, "look": look})


if __name__ == "__main__":
    args = sys.argv[1:]
    look = None
    if len(args) >= 2 and args[0] == "--look":
        look, args = args[1], args[2:]
        if look not in motion_brief.LOOKS:
            sys.exit("--look must be one of: " + ", ".join(motion_brief.LOOKS))
    if not " ".join(args).strip():
        sys.exit('usage: python -m klipian.motion_brief_cli [--look iso|2d|text] "<topic>"')
    sys.stdout.reconfigure(encoding="utf-8")
    print(brief_for(" ".join(args), look))
