"""Print the Khusus brief for one topic with the channel defaults (60 s, loop, "Intip yuk!" sting, the three voice apps, the default music).
Used by the /create skill in a cloud checkout: python -m klipian.motion_brief_cli "gurita punya tiga jantung". It only prints; it writes nothing."""
import sys

from . import motion, motion_brief

DURATION = 60


def brief_for(topic: str) -> str:
    return motion_brief.build_brief({"topic": topic.strip(), "duration": DURATION, "notes": "", "options": {"kind": "khusus"}})


if __name__ == "__main__":
    if len(sys.argv) < 2 or not " ".join(sys.argv[1:]).strip():
        sys.exit('usage: python -m klipian.motion_brief_cli "<topic>"')
    sys.stdout.reconfigure(encoding="utf-8")
    print(brief_for(" ".join(sys.argv[1:])))
