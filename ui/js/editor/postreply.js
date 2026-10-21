/* klipian — Claude's reply for ONE Result: what it would replace, and what the fields become
   ==========================================================================
   Pure functions (post.js does the DOM). A reply (what /api/result-reply answers: { title, hook, post: { title,
   caption, hashtags }, angle: { take, intro, notes } }) fills the Result's own title, its post text and its angle.
   When any of those fields already has text the person is asked first, with the list of what would go
   (postReplyPlan().conflicts); the angle's notes are kept when the reply brings none.
   ========================================================================== */

const POST_REPLY_LABELS = {
  title: "Result title", postTitle: "Post title", caption: "Caption", hashtags: "Hashtags",
  take: "Angle: take", intro: "Angle: intro", notes: "Angle: notes",
};

/* `current`: { title, post: {title, caption, hashtags[]} | null, angle: {take, intro, notes[]} | null }, what the fields
   hold now. Returns { conflicts: [label...], next: { title, post, angle } }. */
function postReplyPlan(current, reply) {
  const cur = { title: String(current?.title || "").trim(), post: current?.post || {}, angle: current?.angle || {} };
  const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v || "").trim() !== "");
  const conflicts = [];
  const check = (label, now, bringing) => { if (has(now) && has(bringing)) conflicts.push(label); };
  check(POST_REPLY_LABELS.title, cur.title, reply.title);
  check(POST_REPLY_LABELS.postTitle, cur.post.title, reply.post?.title);
  check(POST_REPLY_LABELS.caption, cur.post.caption, reply.post?.caption);
  check(POST_REPLY_LABELS.hashtags, cur.post.hashtags, reply.post?.hashtags);
  check(POST_REPLY_LABELS.take, cur.angle.take, reply.angle?.take);
  check(POST_REPLY_LABELS.intro, cur.angle.intro, reply.angle?.intro);
  check(POST_REPLY_LABELS.notes, cur.angle.notes, reply.angle?.notes);
  const notes = has(reply.angle?.notes) ? reply.angle.notes : (cur.angle.notes || []);
  return {
    conflicts,
    next: {
      title: has(reply.title) ? String(reply.title).trim() : cur.title,
      post: {
        title: has(reply.post?.title) ? reply.post.title : (cur.post.title || ""),
        caption: has(reply.post?.caption) ? reply.post.caption : (cur.post.caption || ""),
        hashtags: has(reply.post?.hashtags) ? reply.post.hashtags : (cur.post.hashtags || []),
      },
      angle: {
        take: has(reply.angle?.take) ? reply.angle.take : (cur.angle.take || ""),
        intro: has(reply.angle?.intro) ? reply.angle.intro : (cur.angle.intro || ""),
        notes,
      },
    },
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = { postReplyPlan, POST_REPLY_LABELS };
