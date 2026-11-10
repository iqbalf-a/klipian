/* The sting poses (src/stingPose.ts, B31): stable per slug, inside the safe area, clear of the caption band, one mark. `node tests/stingPose.test.ts` */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STING_POSE_NAMES, STING_POSES, slugHash, stingBoxes, stingInsideSafe, stingPoseFor, stingPlace } from "../src/stingPose.ts";
import { captionBox } from "../src/layout.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

yes(STING_POSE_NAMES.length >= 4 && STING_POSE_NAMES.length <= 5, "four or five poses");
yes(stingPoseFor("kenapa-bulan-selalu-menghadap") === stingPoseFor("kenapa-bulan-selalu-menghadap"), "the same slug gives the same pose, every time");
yes(slugHash("a") !== slugHash("b"), "the hash tells slugs apart");

const cap = captionBox();
for (const name of STING_POSE_NAMES) {
  const b = stingBoxes(name), c = stingPlace(name);
  yes(stingInsideSafe(b.mascot) && stingInsideSafe(b.pill), `${name}: mascot and pill inside the safe area`);
  yes(b.mascot.y1 < 1500 && b.pill.y1 < 1500 && b.pill.y1 < cap.y0, `${name}: clear of the caption band (y 1500 and below)`);
  yes(b.pill.y0 >= b.mascot.y1 - 40 && b.pill.y0 <= b.mascot.y1 + 20, `${name}: the pill sits right under the mascot (one mark)`);
  yes(c.pill.x === c.mascot.x, `${name}: the pill is centred under the mascot`);
  yes(b.mascot.y1 <= STING_POSES[name].y + 130, `${name}: the mascot box is its own`);
}

// every stock video gets a pose, and the five poses are all used somewhere
const slugs = readdirSync(path.join(ROOT, "videos"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const used = new Set(slugs.map(stingPoseFor));
yes(slugs.length > 5 && used.size >= 4, `the stock slugs spread over the poses (${used.size} of ${STING_POSE_NAMES.length})`);

console.log(`stingPose: ${n} checks ok`);
