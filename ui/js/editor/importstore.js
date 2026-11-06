/* The Analyze "Import the AI's reply" panel belongs to one video each: the pasted text, the note under it and what the
   last import left behind (roundtrip.js lastImport / lastImportNotes). assets.js parks it per video id when the active
   video changes, the same way it parks the transcript and the suggestions. Pure functions so node can test them
   (tests/importstore.test.js). */
function emptyImport() { return { text: "", note: "", noteError: "false", lastImport: null, lastImportNotes: [] }; }

/* Keep `state` for video `id` (a copy: later edits to the screen do not reach the store). */
function parkImport(store, id, state) { store[id] = { ...emptyImport(), ...state }; }

/* What video `id` shows: its own panel, or an empty one it never had. */
function takeImport(store, id) { return { ...emptyImport(), ...(store[id] || {}) }; }

/* Write into a video's panel without it being on screen (a Claude run that finished after the user moved on). */
function patchImport(store, id, patch) { store[id] = { ...takeImport(store, id), ...patch }; }

if (typeof module !== "undefined" && module.exports) module.exports = { emptyImport, parkImport, takeImport, patchImport };
