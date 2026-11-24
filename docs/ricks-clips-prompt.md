# Rick's Clips prompts (ChatGPT, for RicksClips3000 style Shorts)

Reference only (ian, 2026-11-24, found by ian). These are two prompts to paste into ChatGPT to plan a narrated cartoon Short in the style of the RicksClips3000 channel: the story, the style sheet, a reference image and one video prompt per shot (for Google Flow / Nano Banana). They are a separate route from `-create ricks` (B46, built in Remotion with three.js and the stick cast); nothing in the pipeline reads this file.

Its story rules are adopted for the ricks look as B54 in `remotion/DESIGN.md` (applies mainly to ricks, ian 2026-11-24). Useful to compare with B46: the story beats (HOOK, SETUP, DOUBT, ESCALATE, TURN, REVEAL, BUTTON), the hook shape (a person named by role doing a strange act with one number, never a question), one sentence = one shot, and "the narrator reveals the mechanism, the hero never explains".

## Prompt 1: master prompt (v3)

Copy everything in the block into a new ChatGPT chat and send.

````text
You are my Shorts producer. Together we will make one vertical (9:16) animated YouTube Short in the style of the big "narrated cartoon story" channels: flat 2D cartoon characters acting out exactly what a fast narrator says, on rich stylised 3D backgrounds.
Work in steps. Ask me ONE question at a time, give numbered options, and wait for my answer before moving on. Keep your own messages short.
STEP 1. Ask how long the Short should be:
1) 30 seconds (about 100 words of narration, 7 to 8 shots)
2) 45 seconds (about 150 words, 10 to 12 shots)
3) 60 seconds (about 205 words, 14 to 16 shots)
STEP 2. Ask whether I already have a topic, or want 10 ideas.
If I want ideas, give 10. Each idea is a TRUE real-world fact or mechanism, told as a tiny story. Rank the ideas by these story types, best first:
A) Hidden-physics underdog: someone does something that looks stupid, everyone mocks them, and a real physical principle proves them right in the end (example of the shape, do not reuse: an engineer who leaves gaps in a railroad).
B) Weird real experiment or institution.
C) A clever scheme or loophole, with a twist that reveals how it worked.
Never offer a pure "what if" fantasy, and never a plain explainer with no main character.
For each idea give: a title of 4 to 8 words (pattern "Why [normal thing] [is secretly weird]" or "The [object] That [impossible thing]"), the one-line hook, and the true fact underneath it.
Then ask me to pick a number.
STEP 3. Write the story. Before writing, state in one line what is true and what is invented for the story (rivals and doubters may be invented; facts may not).
Rules for the narration:
- The first sentence is the hook: 5 to 18 words, a statement, never a question. It opens on a person, named by their role, doing the strange action, with one specific number. Example of the shape: "A young engineer sawed gaps into a brand new railroad every 39 feet."
- Never start with How, What, Why, Did you, Imagine or Ever.
- After the hook, tell the story in present tense.
- Sentence 2 names both sides and the prize: who the hero is up against, where, and what they are competing for.
- Every sentence follows from the one before. A viewer hearing it once must always know where we are, who is who, and what is being tried.
- Beats, in order: HOOK, SETUP (who is up against whom, and what is at stake), DOUBT (the boss or a rival laughs; one short mocking quote, 14 words or less; the hero refuses to explain), ESCALATE (2 or 3 steps over time; the rival seems to win; one small visible clue that the hero is right), TURN (the big threat arrives), REVEAL (the NARRATOR says "You see," plus the real mechanism in one plain true sentence; the hero never explains), BUTTON (the final image: the doubters get exactly what they laughed at).
- Every sentence names something the viewer can SEE: a person, an object, a place, or a number written on a prop.
- Link sentences with So, / But / Then, / Meanwhile, only where the link is real: "So" for a result, "But" for a reversal, "Then" for the next step. Never start the hook with one, and leave many sentences without one. Every sentence must be grammatical on its own.
- At least two jokes, said by the doubters. At least two specific odd numbers (39 feet, 300 soldiers, 3 a.m.), and the viewer must already know what each number counts. No years: say "back then".
- Sentences of 10 to 17 words, with one short 3 to 6 word punch line somewhere.
- No intro, no channel name, no moral, no question to the viewer, no call to action. The last sentence is the payoff image, 25 words or less.
- Hit the word count from Step 1 (plus or minus 10 words).
Count the words before you show it.
Show the narration first, as one clean block I can paste into a voice generator. Under it, show the same narration split into shots: one sentence per shot, numbered SHOT 1, SHOT 2 and so on.
End this message with: "Type GO for the style and shot prompts, or tell me what to change." Then wait.
STEP 4. When I type GO, ask me: "Attach 2 or 3 screenshots of the look you want to match, or type DEFAULT." Then wait.
STEP 5. Write the visual style sheet ONCE.
If I attached screenshots, describe that exact look: the characters, outlines, faces, colours, the 3D background and the lighting. Our own characters, never the ones in the screenshots.
If I typed DEFAULT, use: "Flat 2D cartoon characters with simple round heads, dot eyes, thick clean black outlines and flat colours, animated on a detailed stylised 3D-rendered background with soft daylight, warm saturated colours, shallow depth of field."
Either way, end the style sheet with: "Vertical 9:16. Smooth, expressive cartoon acting. No captions, no subtitles, no logos, no watermarks; the only writing allowed is a number on a prop."
Then describe each recurring character in one fixed sentence (body, clothes, one colour that identifies them). Reuse that exact sentence in every prompt where the character appears.
STEP 6. Write one image prompt for a vertical 9:16 reference image, in its own code block: the style sheet, the character sentences, then all the main characters standing side by side, full body, facing the camera, in the story's main setting, each holding their key prop. No text in the image. Tell me to make this image first (Google Flow, Image, Nano Banana) and attach it to every shot.
STEP 7. Write one video prompt per shot. One shot = one sentence of the narration = one place, one camera angle, one clear action, 4 to 6 seconds long. Each prompt contains, in this order:
1) "Use the attached images as the character and style reference."
2) The style sheet and the sentences of the characters in this shot, word for word.
3) The setting, with the camera position and angle.
4) The action, acting out that sentence literally. Describe only what the camera sees: never quote the narration or any dialogue. Say clearly which way anything moves: towards or away from the camera, left or right, over or past which object. When the narration names a number, show it written on a sign, a label or a prop.
5) "Sound: ambient sound effects only. No dialogue, no narration, no music."
Number them SHOT 1, SHOT 2 and so on, each in its own code block, with its length in seconds in the heading.
STEP 8. At the end of your message write: "Type NEXT for titles and a description."
When I type NEXT, give me:
- 5 title options in the same patterns as Step 2, 4 to 8 words, no emoji.
- A 2 to 3 sentence YouTube description that tells the true fact behind the story, plus 3 hashtags.
Start now with Step 1.
````

## Prompt 2: match the Rick's Clips look

Send it in the same ChatGPT chat, right after the master prompt's reply, with 3 screenshots of Rick's Shorts attached.

````text
These are 3 frames from the channel whose look I want to match.

1. Rewrite the style sheet so it describes this exact look: the characters, outlines, faces, colours, the 3D background and the lighting.

2. Write one image prompt for a 9:16 reference image: our main characters standing side by side, full body, in our main setting, in this exact style. Our own characters, not the ones in the frames. No text in the image.

3. Rewrite the clip prompts as one prompt per shot instead of per 10 seconds. One shot = one sentence of the narration = one place, one camera angle, one clear action, 4 to 6 seconds long. Start every shot with "Use the attached images as the character and style reference." Put the new style sheet and the character sentences word for word in every shot. Describe only what the camera sees: no dialogue, no text except a number on a prop. Number them SHOT 1, SHOT 2 and so on, each in its own code block, with its length in seconds.
````
