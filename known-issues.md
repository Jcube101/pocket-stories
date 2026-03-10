# Pocket Stories — Known Issues

Bugs and gaps found during the initial codebase audit (2026-03-10). Organized by severity. Each item links to the relevant roadmap item in `roadmap.md`.

---

## Blocking — Will crash or corrupt at runtime

### B1 — `jsyaml` is undefined: editor export and import crash
**Roadmap:** P1-1
**File:** `src/legacy/editor.js:1919`, `editor.js:2736`
**Symptom:** Clicking "Export Story" throws `ReferenceError: jsyaml is not defined`. Importing a YAML file also crashes.
**Cause:** `editor.js` calls `jsyaml.dump()` and `jsyaml.load()` as globals. `js-yaml` is not in `package.json` and is never imported anywhere in the codebase.

### B2 — Editor event listeners never removed: memory leak + broken canvas on story switch
**Roadmap:** P1-2
**Files:** `src/legacy/editor.js:1141,1148,1155,1161,1298,1333,2798`, `src/components/StoryEditor.tsx:37-40`
**Symptom:** After switching stories in editor mode, the canvas renders but does not respond to clicks, drags, or keyboard shortcuts. Every story switch (or mode toggle) adds another set of orphaned event listeners.
**Cause:** `editor.js` attaches seven `document.addEventListener` calls. None are paired with `removeEventListener`. `StoryEditor.tsx`'s `useEffect` returns no cleanup function. Additionally, `editorEventsBound` (line 24) is set `true` on first init and never reset, so subsequent `initEditor()` calls skip event binding entirely.

### B3 — `StoryEditor.tsx` effect fires on every parent render
**Roadmap:** P1-3
**File:** `src/components/StoryEditor.tsx:40`, `src/App.tsx:145`
**Symptom:** `initEditor()` is called repeatedly — on every App.tsx re-render, not just when the story changes. Causes constant editor re-initialization, performance degradation, and potential state corruption.
**Cause:** The `useEffect` dependency array includes `onLoadStoryByPath`, which is defined as an inline arrow function in `App.tsx` and therefore gets a new reference on every render.

---

## Broken — Wrong behavior, no crash

### B4 — Undo/redo permanently breaks after 20 actions
**Roadmap:** P1-6
**File:** `src/legacy/editor.js:780-782`
**Symptom:** After making 20 or more edits, redo becomes permanently unavailable. Further undo may also produce incorrect results.
**Cause:** When `undoStack` hits `MAX_HISTORY (20)` and the oldest entry is shifted off with `undoStack.shift()`, `historyIndex` is not decremented. The index points past the valid range of the array.

### B5 — `StoryPlayer.tsx` is dead code (incomplete refactor)
**Roadmap:** P1-4
**File:** `src/components/StoryPlayer.tsx`
**Symptom:** No visible bug — the file is simply never used.
**Cause:** `App.tsx:181` renders `<PlayerView>` directly. `<StoryPlayer>` is never instantiated. The two components have different prop signatures (`story: StoryData` vs `storyData: StoryData | null`), indicating an incomplete refactor from a prior Codex session.

### B6 — StoryList "Load" button always appears active
**Roadmap:** P2-7
**File:** `src/components/StoryList.tsx:27`
**Symptom:** The "Load selected story" button always has the `active` CSS class, making it appear permanently selected regardless of state. Users cannot tell whether a story is loaded or merely selected.
**Cause:** Hardcoded `className="choice-button active"` — the class is not conditional.

### B10 — Editor mutations do not sync back to React state
**Roadmap:** P2-3
**Files:** `src/legacy/editor.js` (all mutation sites), `src/App.tsx`
**Symptom:** Editing a story in the editor and then switching to player mode shows the original, unedited story.
**Cause:** `editor.js` mutates `window.storyData.passages` directly. `App.tsx`'s `story` state is set once at load time and never updated from editor mutations. There is no sync path.

---

## Silent failures — No crash, wrong outcome, no feedback

### B7 — Validation warnings silently discarded
**Roadmap:** P2-1
**File:** `src/lib/yamlLoader.ts:18-20`
**Symptom:** Story authors receive no feedback on issues like unused variables, undeclared passage targets, or suspicious conditions — even when the validator detects them.
**Cause:** `validateAndNormalizeStory()` returns `{ ok, data, warnings, errors }`. `yamlLoader.ts` only exposes errors; `result.warnings` is never returned to the caller.

### B8 — `applyEffect` silently ignores malformed effects
**Roadmap:** P2-4
**File:** `src/components/PlayerView.tsx:153-157`
**Symptom:** A story with a broken effect expression (e.g., `inventory.key =` with no value) silently skips the effect. Variables are not updated. No console warning, no player feedback, no indication anything went wrong.
**Cause:** `applyEffect` returns early on `parseStoryEffect` failure with no logging or state update.

### B9 — `evalCondition` executes arbitrary JavaScript (security gap)
**Roadmap:** P2-2
**File:** `src/components/PlayerView.tsx:78-86`
**Symptom:** No runtime symptom for normal stories. A maliciously crafted story YAML could run arbitrary JavaScript in the user's browser session.
**Cause:** Condition strings from YAML are passed directly to `new Function('inventory', 'relationships', 'flags', \`return (${condition});\`)`. The `try/catch` is not a sandbox. Any condition string is valid — `window.location.href = 'evil.com'` would execute without error.

---

## UI / UX issues

### U1 — No story title displayed anywhere
**Roadmap:** P2-6
**Files:** `src/components/StoryList.tsx`, `src/components/PlayerView.tsx`
**Symptom:** The story list shows raw file-derived IDs (e.g., `forest adventure`). The player shows no story title or author.
**Cause:** `StoryData` has `title` and `metadata` fields — neither component reads or renders them.

### U2 — No distinction between selected and loaded story in list
**Roadmap:** P2-7
**File:** `src/components/StoryList.tsx:19-23`
**Symptom:** Only the loaded story shows `(loaded)`. There is no visual treatment for a story that has been clicked (selected) but not yet loaded with the "Load selected story" button.
**Cause:** No pending/selected state is communicated visually — the UX assumes users understand the two-step select → load flow without any feedback.

---

## Configuration and tooling gaps

### C1 — No test infrastructure
**Roadmap:** P3-1
**Symptom:** `npm test` fails. Zero test coverage across all modules.
**Impact:** Any refactoring of `storyValidator.ts`, `yamlLoader.ts`, or `PlayerView.tsx` logic is done without a safety net. The undo/redo bug (B4) is exactly the kind of issue unit tests would catch.

### C2 — No GitHub Pages 404 fallback
**Roadmap:** P2-8
**Symptom:** Bookmarked or shared direct URLs to the app return a GitHub Pages 404 before React loads.
**Cause:** No `public/404.html` SPA redirect configured. Standard issue for GitHub Pages SPAs.

### C3 — Vite base path is hardcoded
**Roadmap:** P3-6
**File:** `vite.config.ts:5`
**Symptom:** Any fork, rename, or deployment to a different path requires manually editing `vite.config.ts`.
**Cause:** `base: '/pocket-stories/'` is a string literal.

### C4 — `tsconfig.json` uses deprecated `moduleResolution` casing
**Roadmap:** P3-7
**File:** `tsconfig.json`
**Symptom:** No runtime impact. May produce warnings in future TypeScript versions.
**Cause:** `"moduleResolution": "Bundler"` — should be lowercase `"bundler"`.

### C5 — `StoryEditor.tsx` dynamic import has no error handler
**Roadmap:** P1-5
**File:** `src/components/StoryEditor.tsx:37-39`
**Symptom:** If `editor.js` fails to load, the user sees a blank, silent canvas with no message.
**Cause:** `.then(mod => mod.initEditor())` with no `.catch()`.

---

## Story YAML quality issues

### Y1 — Unused variables declared in built-in stories
**Roadmap:** P3-5
| Story | Variable | Issue |
|---|---|---|
| `forest_adventure.yaml` | `sword` | Declared, never set or read |
| `forest_adventure.yaml` | `dragon_scale` | Declared, never set or read |
| `river_oath.yaml` | `crossed_river` | Declared, never set or used |
| `city_noir.yaml` | `bribed_guard` | Set (line 30) but never checked by any condition |

### Y2 — Compound condition syntax undocumented
**Roadmap:** P3-5
**File:** `src/stories/river_oath.yaml:79`
`condition: "inventory.lantern == true && relationships.Ferryman >= 1"` — works today because `evalCondition` uses `new Function()`. If the evaluator is replaced (Decision 2), this condition must be verified against the new system. Currently undocumented.

### Y3 — Redundant condition in `space_outpost.yaml`
**File:** `src/stories/space_outpost.yaml:75`
`condition: "flags.power_restored == true"` — this condition is always true at that point in the story flow (the only path to that passage sets the flag). Logically redundant but harmless.

---

## CSS maintainability

### S1 — `global.css` is monolithic and unscoped
**Roadmap:** P3-2
**File:** `src/styles/global.css`
1,553 lines mixing editor graph styles, player styles, sidebar rules, dark mode overrides, and responsive breakpoints in a single unscoped global file. Class names are tightly coupled to legacy editor DOM IDs generated by `editor.js`. Risk of class name collisions between editor and player styles increases as the file grows.

---

## Audit methodology note

This issue list was produced by a full static analysis of the codebase in March 2026. Issues are numbered by category prefix (B = blocking/broken, U = UX, C = config/tooling, Y = YAML quality, S = styles). All line numbers refer to the state of the codebase at commit `f879a6d`.
