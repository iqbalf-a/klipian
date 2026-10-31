"""The briefs of the Motion page (split out of motion.py, no change of behaviour): what the AI is told for a video (build_brief), for the beats of rejected claims
(build_revise_brief) and when its answer was refused (build_fix_message). Import `klipian.motion`: it re-exports these names."""

from __future__ import annotations

from . import hashtags as hashtags_mod
from . import profiles
import json


class _Lazy:
    """The rest of motion.py, reached when a function runs (not when this module loads): `_m.options_of(...)`. motion.py imports this module, so a plain
    import here would be a cycle; and a test that patches `motion._catalog` reaches this code too."""

    def __getattr__(self, name):
        from . import motion
        return getattr(motion, name)


_m = _Lazy()


# --------------------------------------------------------------------------
# the briefs
# --------------------------------------------------------------------------

# What a video of each length is made of: (beat kind, seconds, what happens). The sum is the length. This is the channel's format
# (hook, "Intip yuk!", explanation, tips, outro), not a rule of the schema: the AI may adapt it as long as the total is exact.
STRUCTURE = {
    30: [("hook", 3, "an everyday hook: a question, a surprising statement or a myth"), ("sting", 1, 'a small mascot and the pill "Intip yuk!"'), ("lens or normal", 7, "step 1 of the cause (look inside through the lens only if the cause is inside the object)"),
         ("normal", 7, "step 2"), ("tips", 8, "what to do"), ("outro", 4, "loop-back: no mascot, no label, no voice; the scene of the first beat again")],
    45: [("hook", 3, "an everyday hook: a question, a surprising statement or a myth"), ("sting", 1, 'a small mascot and the pill "Intip yuk!"'), ("lens or normal", 6, "step 1 (the cutaway through the lens, if the cause is inside)"),
         ("normal", 7, "step 2"), ("loose / normal", 8, "step 3, or the bad case"), ("result", 7, "what happens in the end"), ("tips", 9, "2 tips"),
         ("outro", 4, "loop-back: no mascot, no label, no voice; the scene of the first beat again")],
    60: [("hook", 3, "an everyday hook: a question, a surprising statement or a myth"), ("sting", 1, 'a small mascot and the pill "Intip yuk!"'), ("lens or normal", 6, "step 1"), ("normal", 8, "step 2"), ("normal", 8, "step 3"),
         ("loose / normal", 8, "step 4, or the bad case"), ("result", 7, "what happens in the end"), ("normal", 6, "a fact that surprises"), ("tips", 9, "2-3 tips"),
         ("outro", 4, "loop-back: no mascot, no label, no voice; the scene of the first beat again")],
}


def _items_text(cat: dict) -> str:
    rows = [f"- **{t}**: " + ", ".join(f"`{k}: {v}`" for k, v in fields.items()) for t, fields in cat["items"].items()]
    motion = ", ".join(f"`{k}: {v}`" for k, v in cat["motionFields"].items())
    return "\n".join(rows) + f"\n\nEvery item also takes (all optional): {motion}"


def _stand_in(kind: str) -> str:
    if kind == "custom":
        return " Do not use a catalogue object as a stand-in."
    return " Do not use `socket` unless the topic is an electrical socket or plug. For any other topic use stack, label, arrow, badge, banner or source."


def _catalog_text(cat: dict, kind: str = "template") -> str:
    e, ch, lim, mo = cat["enums"], cat["characters"], cat["limits"], cat["motion"]
    fmt = cat["format"]
    sa = lim["safeArea"]
    story = "\n".join(f"- `{k}`: {v}" for k, v in cat["story"]["fields"].items())
    beat = "\n".join(f"- `{k}`: {v}" for k, v in cat["story"]["beat"].items())
    return f"""## Catalogue: the only things a video can contain

Use only what is listed here. If the story needs an object that is not in this catalogue, **do not invent it**: write what
is missing in `needs`.{_stand_in(kind)}

**Canvas:** {fmt['width']} x {fmt['height']} px, {fmt['fps']} fps, {fmt['unit']}. Keep text, the mascot and people inside x {sa['left']}..{sa['right']},
y {sa['top']}..{sa['bottom']} ({sa['note']}).

**The story** (`beats` are listed below; `item` is one of the items):
{story}

**A beat:**
{beat}

**Items** (`type` picks which; the fields after it belong to that type; `?` = optional):
{_items_text(cat)}

**Characters:** one person (`chibi`): roles {', '.join(ch['roles'])}; expressions {', '.join(ch['expressions'])}; poses {', '.join(ch['poses'])}; costumes {', '.join(ch['costumes'])}.
**The mascot** (the yellow bubble with the magnifying glass, no body): expressions {', '.join(cat['mascot']['expressions'])}.
**Backgrounds:** {', '.join(e['backgrounds'])} (`brand` = story scenes with a yellow spotlight; `lab` = the dark room inside the lens and for cutaways; `room`, `black` = plain).
**Beat kinds:** {', '.join(e['beatKinds'])}.
**Sockets:** views {', '.join(e['socketViews'])}; outside variants {', '.join(e['outsideVariants'])}; cutaway variants {', '.join(e['cutawayVariants'])}; `heat` 0..1 glows red at the contact; `plug.route` is a list of 2-6 [x, y] points the cable follows (it is drawn as a smooth curve).
**Parts a label or arrow can follow** (`follow`): {', '.join(e['anchors'])}. Label colours: {', '.join(e['labelColors'])}; arrow colours: {', '.join(e['arrowColors'])}.
**Motion words:** enter {', '.join(mo['enter'])}; exit {', '.join(mo['exit'])}; directions {', '.join(mo['directions'])}; actions {', '.join(mo['actions'])}; camera {', '.join(mo['camera'])}; transitions {', '.join(mo['transitions'])}. {mo['notes']}
**Sound effects:** {', '.join(cat['sfx']['names'])}, or "none". {cat['sfx']['note']}.

**Rules the answer is checked against** (klipian refuses anything else and sends you a list of what to fix):
""" + "\n".join(f"- {r}" for r in cat["rules"]) + f"""
- at most {lim['maxScreenWords']} words of screen text per piece of text; at most {lim['maxTransitions']} transitions other than a cut; {lim['beats']['min']}-{lim['beats']['max']} beats; at most {lim['itemsPerBeat']['max']} items per beat; narration at most {lim['narrationMaxChars']} characters per beat
"""


def _structure_text(duration: int) -> str:
    rows = STRUCTURE[min(STRUCTURE, key=lambda k: abs(k - duration))]          # the three lengths; anything else gets the nearest plan
    lines = [f"{i}. **{kind}** about {sec} s: {what}" for i, (kind, sec, what) in enumerate(rows, 1)]
    return "\n".join(lines) + f"\n\n(total {sum(r[1] for r in rows)} s, {len(rows)} beats)"


FACT_RULES = """- Every claim the video makes needs at least one source URL (a manufacturer, a safety agency, a standard, a university or a reputable reference). Search the web; do not rely on memory.
- If you are not sure about something, **leave it out**. A smaller true video is better than a bigger doubtful one.
- A claim is one checkable sentence. List each in `claims` with the ids of the beats that use it. A beat can use several claims; a claim can be used in several beats.
- Numbers (watts, degrees, amounts) must come from a source you list; otherwise do not state a number.
- A person will check every claim and its sources before the video is rendered, and any claim they reject comes back to you for a revision of the beats that use it."""


def _options_text(opts: dict) -> str:
    music = f"{_m.MUSIC_USE[opts['music']]} (story music track {_m.MUSIC_TRACKS[opts['music']]})"
    lines = [f"- Loop: {'yes' if opts['loop'] else 'no'} (the ending returns to the scene of the first beat)",
             f"- Intip yuk!: {'yes' if opts['sting'] else 'no'} (the small sting right after the hook)",
             f"- Music: {music}",
             f"- Target voice apps: {_m.voice_apps_text(opts['voiceTargets'])} (klipian writes the narration text in each app's own format; the voices are made outside klipian)",
             f"- Kind: {_m.KINDS[opts['kind']]}"]
    warn = _m.option_warnings(opts)
    if warn:
        lines.append("- Warning: " + " ".join(warn))
    return "## Pilihan video\n\n" + "\n".join(lines)


# The agent-neutral brief (PLAN-BRIEF-AGENTS): any AI can follow it, in chat or as an agent. The hard rules come first, the checklist is testable,
# the lists come from the catalogue (cat), and the examples are real stories that pass the validator.
HARD_RULES = [
    "The beats' seconds add up to exactly the duration.",
    'The first beat is `hook`; the second is `sting` with the narration exactly "Intip yuk!"; the last is `outro`.',
    "The outro has an empty narration and no mascot, label or pill; its scene repeats the first beat's scene so the video loops.",
    "Every screen text (banner, pill, label, text) is at most 6 words.",
    "Every claim has at least one source URL that you opened yourself.",
    'The story has `"bible": 1`.',
    "The hero is the topic's object. Use `socket` only when the topic is an electrical socket or plug.",
    "No health or finance topics. Never teach anything dangerous.",
    "Never write to `workspace/`, never read or print secrets or API keys.",
    "Never say a check passed unless you ran it and pasted its output.",
]

CHECKLIST = [
    "Every beat except the outro has a `banner` equal to its `text`.",
    "At most 3 transitions that are not a cut.",
    "Every claim lists existing beat ids and has at least one URL you opened.",
    "`music.track` is one of the tracks listed under Answer.",
    "Exactly 3 titles, each at most 100 characters; the hashtags follow the profile's rule.",
    "At most one `lens` beat.",
    "The JSON is plain: no comments, no trailing commas, no code.",
]

CHANNEL_RULES = """- Language: casual Indonesian, easy to follow, as if talking to a friend. The narration is what a person says aloud; the screen text is short and carries the key point.
- Hook: an everyday hook of about 3 seconds: a question, a surprising statement or a myth. It does not have to start with "kenapa".
- The look inside (`lens`): only when the cause is inside a physical object, and at most once per video. For a habit, a body, a process or an idea use a flow, a diagram or labels.
- Colour: red only for danger or heat, never decoration; yellow is the accent. For an electrical topic: yellow = current, red or orange = heat, grey = the object's material, light grey = metal.
- Safety: no health or finance topics (say so in `needs`). Never teach anything dangerous. For an electrical topic: no instructions to open, modify or bypass mains equipment; the tips are "stop using it, unplug it, ask a technician".
- One idea per beat; every narration makes sense heard alone.
- Theme (one for the whole video, the story's `theme`): `cream` (the default), `sky` (a gadget, electricity, a process), `mint` (nature, plants, water), `peach` (food, the home). Do not repeat the theme of the video before.
- Stage (the story's `stage`, default `slab`): `slab` (the usual block), `round` (a round object), `strip` (a flow along it), `steps` (cause, effect, result), `island` (an idea or gadget that stands alone). Do not repeat the stage of the video before."""

COMPOSITION = """- Every beat has a `banner` at the top with the beat's screen text (the same words as its `text`).
- Backgrounds: `brand` for the story beats (the hook too); `lab` only inside the lens and in cutaway beats.
- **One hero:** one main object for the whole video, big (about 60 to 70 % of the width, x about 540). The other things are simple supporting elements: parts, arrows, short labels, numbered badges. Empty space is filled by the object, never by people.
- **Kinds of fact:** an object is opened up (the lens); a process follows its flow; a cause is a chain of arrows; a myth check ends with `MITOS`, `FAKTA` or `SEBAGIAN` in the text of the `result` or `tips` beat (the verdict stamp is not drawn yet).
- **People are optional:** a person (`chibi`) only when a person is the point of the beat. A topic about an object shows just the object.
- **The mascot is rare:** the sting has a small `mascot` (w about 220, expression curious, `pop`) and a small `pill` "Intip yuk!" in the caption zone, with no veil; plus at most two short reactions. **The outro has no mascot.**
- The look inside: the outside of the object with the `lens` item first, then cutaway beats with `socket` view "cutaway" (about x 540, y 926, s 1). Give the cutaway an `id` and make labels and arrows `follow` its parts.
- **Source cards** (`source`): one claim with its source for 2 to 3 seconds, only for a fact that needs to be seen.
- Optional: a `headline` (2 to 4 bold words, with a small `kicker`), `"captions": true`, and `music` (`{"track": ...}`)."""


def _beat_kinds_text(cat: dict) -> str:
    meaning = cat["beatKindMeaning"]
    return "\n".join(f"- `{k}`: {meaning[k]}" for k in cat["enums"]["beatKinds"])


def _kind_text(kind: str) -> str:
    if kind == "custom":
        return ("**Kind Khusus:** the video is drawn in code from this story's texts, timing, claims and music. A beat's scene items only need the "
                "`banner` (and the sting's `pill` and `mascot`). Do not fill a scene with catalogue objects to look busy. List every object the video "
                "must show in `needs`; Part B tells how the video folder is built.")
    return ("**Kind Otomatis:** the template draws only what the catalogue lists. Use `socket` and `lens` only for a topic about an electrical socket or "
            "plug. For any other topic prefer `stack`, `label`, `arrow`, `badge`, `banner`, `source` (and `chibi` only if a person is the point). List "
            "the objects the topic needs in `needs`; expect a plain result.")


def _examples_text(cat: dict, d: int) -> str:
    def compact(story: dict) -> str:
        return json.dumps(story, ensure_ascii=False, separators=(",", ":"))
    return (f"Two examples of a valid story, to show the shape (both are 30 seconds; yours is {d} seconds and follows the structure above). "
            "Do not copy their content. Both pass the validator with zero errors and zero warnings.\n\n"
            f"Example 1, an object with an inside (the look inside, once):\n```json\n{compact(cat['example'])}\n```\n\n"
            f"Example 2, a habit (no object, no socket, no lens):\n```json\n{compact(cat['exampleHabit'])}\n```")


PART_B = """## Part B: the video folder (only for Kind Khusus)

Do these steps in order, from the repository root `D:\\github-repos\\klipian`. Stop and report if a step fails.
1. Read, in this order, before you draw anything: `remotion/DESIGN.md` section 0b and every rule B1 up to the last one; `remotion/src/dictionary.ts` (the marks you may use); the isometric kit `remotion/src/components/Iso*.tsx`. List them with `ls remotion/src/components/Iso*.tsx`.
2. Look at the two reference videos: `ls remotion/videos/kenapa-colokan-panas remotion/videos/ngantuk-pegang-hp`. Each has `index.tsx`, `plan.ts`, `sfx.ts` and `meta.json`.
3. `cd remotion`, then `npm run new-video <slug> stories/<slug>.json`. Expected: the folder `remotion/videos/<slug>` with `index.tsx`, `plan.ts`, `sfx.ts`, `meta.json` and `story.json`. Copy the structure of the reference that is closer to your scene (a stage with a hero, or a bed scene) into it.
4. Edit `videos/<slug>/index.tsx` and `plan.ts`: draw each beat with the kit (one hero; reuse before you draw; at most three new assets). Use the story's `theme`, `stage` and `music`.
5. `npm run style-check -- <slug>`. Expected: no FAIL line. Report the FLAG, RENDER and HUMAN lines.
6. `npm run style-report -- <slug>`. Expected: `out/<slug>/style-report.md`. Do not render the video and do not push anything.
7. Narration texts: for each target voice app in the options, run from the repository root and paste the output:
   `python -c "import json,sys; sys.path.insert(0,'.'); from klipian import motion; print(motion.narration_export(json.load(open(sys.argv[1],encoding='utf-8')), sys.argv[2])['text'])" remotion/stories/<slug>.json <target>`
   where `<target>` is `voicestudio`, `elevenlabs` or `googleai`.
8. For the person, in plain words: open `/remotion`, choose the folder `D:\\github-repos\\klipian\\remotion\\videos\\<slug>` and press "Ambil cerita dari folder"; make the voice in your own voice app; choose the audio file; press Cocokkan; look at the preview; then Render.
"""


def _report_text() -> str:
    return """
## Report (agent mode: fill every line, with pasted evidence)
- Story file: the path you saved.
- Validator output: the whole output of `node remotion/validate.mjs`, and any warning left, with why.
- Folder: the full path. Style check: the summary line. Narration texts: pasted.
- Not done or not checked: list it."""


def build_brief(p: dict) -> str:
    """The brief: read this first, the options, the story (Part A), and for Khusus the video folder (Part B). Any agent can follow it."""
    cat = _m._catalog()
    d = p["duration"]
    opts = _m.options_of(p)
    kind = "custom" if _m.kind_of(p) == "custom" else "template"
    notes = f"\n\n**Notes from the person making the video:** {p['notes']}" if p.get("notes") else ""
    rule = hashtags_mod.brief_rule(profiles.hashtag_settings())
    rules = "\n".join(f"{i}. {r}" for i, r in enumerate(HARD_RULES, 1))
    checklist = "\n".join(f"{i}. {item}" for i, item in enumerate(CHECKLIST, 1))
    intro_tail = ("The video is made from one JSON story (Part A) and, for Kind Khusus, a folder of code (Part B)." if kind == "custom"
                  else "The video is made from one JSON story (Part A).")
    mode = ("**Mode.** With file access to the repository `D:\\github-repos\\klipian`, do Part A"
            + (" and Part B" if kind == "custom" else "") + ". In chat only, do Part A and print the JSON in your reply.")
    music = ", ".join(f"`{t}`" for t in _m.MUSIC_TRACKS.values())
    return f"""# klipian intip: one short vertical explainer video (about {d} seconds)

## Read this first

You are an AI. You make one short vertical animated explainer for the channel klipian intip, from the topic below. {intro_tail}

{mode}

**Topic:** {p['topic']}{notes}

**Hard rules (never break these):**
{rules}

**Definition of done:** the story JSON, checked (agent mode: validated; chat mode: checked against the checklist){', and for Kind Khusus Part B' if kind == 'custom' else ''}. **Stop rule:** if a step fails, report it and stop; claim only what you saw.

{_options_text(opts)}

{_kind_text(kind)}

## Part A: the story

1. Find the hook: an everyday hook of about 3 seconds (see the channel rules).
2. Research the facts with web search. Open each source yourself; every claim needs a URL.
3. Write the beats (see the beat kinds): the sting right after the hook, then two or three beats, one claim each.
4. Choose each beat's scene as the kind above says.
5. Give three titles, a description, hashtags, `music`, and the optional `theme` and `stage`.
6. Check the story against the checklist, then answer as the mode says.

## Structure for {d} seconds

{_structure_text(d)}

Adapt the kinds and seconds to the topic if needed, but the beats must add up to exactly {d} seconds; each beat has 2 to 4 moments of movement.

## Beat kinds

{_beat_kinds_text(cat)}

## Channel rules

{CHANNEL_RULES}

## Composition

{COMPOSITION}

## Checklist (tick each item with evidence before you answer)

{checklist}

## Fact rules

{FACT_RULES}

{_catalog_text(cat, _m.kind_of(p))}
## Title, description and hashtags

Give three title options in `titles` (each at most 100 characters). Put the post description in `post.description` (no hashtags in it, no URLs; klipian adds the source links itself) and the hashtags in `post.hashtags`. **Hashtags for this profile:** {rule}

## Answer format

Music tracks: {music}.

Fields: `question`, `titles` (exactly 3), `duration` ({d}), `beats`, `claims`, `post`, `needs`, `bible` (1), `music` (`{{"track": ...}}`), and the optional `theme` and `stage`. Beat fields: `id`, `kind`, `dur`, `narration`, `text` (at most 6 words), `scene` (`bg`, `items`), `sfx`, and optionally `camera` and `transition`. The examples below show the shape.

**Chat mode:** reply with one fenced `json` block and nothing else.
**Agent mode:** save the same JSON to `remotion/stories/<slug>.json` (the slug is the topic in lowercase with hyphens; save nowhere else). Run `node remotion/validate.mjs remotion/stories/<slug>.json` from the repository root and fix every error until it prints `"ok":true`. Then print the JSON in a fenced `json` block in your reply too.
Plain JSON only: no code, comments or trailing commas.

{_examples_text(cat, d)}

{PART_B if kind == 'custom' else ''}{_report_text() if kind == 'custom' else ''}

If something is unclear, choose the safest option, write the choice in `needs` or in your report, and continue.
"""


def build_revise_brief(p: dict, beat_ids: list[str], note: str = "") -> str:
    """For rejected claims: only the beats that use them go back to the AI, with what was rejected and why."""
    story = _m.story_of(p["id"])
    if story is None:
        raise _m.MotionError("no_story", "Belum ada cerita untuk direvisi.")
    known = [b["id"] for b in story["beats"]]
    beat_ids = [b for b in dict.fromkeys(beat_ids or []) if b in known]
    facts = _m.facts_of(p["id"])
    rejected = [(i, f) for i, f in enumerate(facts, 1) if f.get("status") == "rejected"]
    if not beat_ids:                                        # by default: the beats that use a rejected claim
        beat_ids = [b for b in known if any(b in f["beats"] for _, f in rejected)]
    if not beat_ids:
        raise _m.MotionError("nothing", "Tolak satu klaim dulu (atau pilih beat yang direvisi).")
    cat = _m._catalog()
    parts = [b for b in story["beats"] if b["id"] in beat_ids]
    bad = "\n".join(f"- Claim {i}: {f['text']}\n  Sources given: {', '.join(f['sources'])}" + (f"\n  Why it was rejected: {f['note']}" if f.get("note") else "") for i, f in rejected) \
        or "- (no claim was rejected: the person chose these beats to revise)"
    keep = "\n".join(f"- Claim {i}: {f['text']} [{f.get('status', 'pending')}]" for i, f in enumerate(facts, 1))
    note_text = f"\n**Note from the person:** {note.strip()}\n" if str(note or "").strip() else ""
    return f"""# Revise some beats: {p['topic']}

Hello. A fun-fact motion video for the channel "klipian intip" was planned from your JSON, and a person checked its facts.
Some claims were **rejected**. Please revise **only the beats listed below**; every other beat stays as it is.
{note_text}
## What was rejected

{bad}

## All claims now (the ones marked [checked] stay true: do not change them)

{keep}

## The beats to revise (current JSON)

```json
{json.dumps(parts, ensure_ascii=False, indent=1)}
```

## What to do

- Search the web again. Replace what was rejected with something you can back with a source URL; if you cannot, **leave it out** and
  make the beat about something that is certain.
- Keep each beat's `id` and `dur` the same (the video must keep its {p['duration']} seconds), and the same channel rules and catalogue as before.
- Keep the two musts: the "Intip yuk!" sting right after the hook, and the loop-back ending (no mascot, label, pill or voice in the outro).
- Keep the options of this video: loop {'yes' if _m.options_of(p)['loop'] else 'no'}, Intip yuk! {'yes' if _m.options_of(p)['sting'] else 'no'}, music {_m.MUSIC_TRACKS[_m.options_of(p)['music']]}, voice apps {_m.voice_apps_text(_m.options_of(p)['voiceTargets'])}.
- Give the **complete list of claims** again in `claims` (the checked ones unchanged, the revised ones with sources), with the beats that use them.

## Reply format

Reply with **a single JSON block** and nothing else, plain JSON only:

```json
{{
  "beats": [ ...only the revised beats, each complete, with the same id and dur... ],
  "claims": [ {{ "text": "...", "beats": ["beat-id"], "sources": ["https://..."] }} ]
}}
```

{_catalog_text(cat, _m.kind_of(p))}"""


def build_fix_message(errors: list[dict], kind: str = "main", options: dict | None = None) -> str:
    """What to paste back to the AI when its answer was not accepted: every problem with where it is."""
    lines = []
    for e in errors:
        where = f"`{e['path']}`: " if e.get("path") else ""
        lines.append(f"- {where}{e['message']}")
    what = ("only the replaced beats and the full claims list, as before" if kind == "revise" else "the whole JSON story")
    keep = ""
    if options is not None:                                  # the options stay as the person chose them
        keep = (f"\n\nThe options of this video stay as they are: loop {'yes' if options['loop'] else 'no'}, Intip yuk! {'yes' if options['sting'] else 'no'}, "
                f"music {_m.MUSIC_TRACKS[options['music']]}, voice apps {_m.voice_apps_text(options['voiceTargets'])}.")
    return ("klipian could not accept your answer. These are the problems, with where each one is:\n\n"
            + "\n".join(lines)
            + f"\n\nPlease fix them and reply with {what} again: a single JSON block, plain JSON only (no code, comments or trailing commas), "
              "and nothing outside the block. Change only what is needed; keep everything else exactly as it was." + keep)
