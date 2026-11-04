A message that starts with `-create <topic>` (not `-create-cloud`) means: make one klipian intip video for that topic by following `.claude/skills/create/SKILL.md` exactly (the topic is the rest of the message); the video is saved on `main`. Ask nothing.

A message that starts with `-create-cloud "<topic>"` is a different command from `-create`: make one klipian intip video for that topic by following `.claude/skills/create-cloud/SKILL.md` exactly. It reads the rules and the design from `origin/main` and saves only the video's files to `cloud/stok-video`. Ask nothing.
