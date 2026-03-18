# Pocket Stories — Known Issues

Bugs and gaps found during the initial codebase audit (2026-03-10). Updated 2026-03-18 after Phase 1 and Phase 2 completion. Each item links to the relevant roadmap item in `roadmap.md`.

**Status key:** ✅ Fixed | 🔴 Open

---

## Blocking — Will crash or corrupt at runtime

### B1 — `jsyaml` is undefined: editor export and import crash ✅ Fixed (P1-1)
~~`editor.js` calls `jsyaml.dump()` and `jsyaml.load()` as globals. `js-yaml` is not in `package.json`.~~
**Fix:** Added `js-yaml` to `package.json`; added `import jsyaml from 'js-yaml'` at top of `editor.js`.

### B2 — Editor event listeners never removed: memory leak + broken canvas on story switch ✅ Fixed (P1-2)
~~Every story switch (or mode toggle) adds another set of orphaned event listeners. Canvas goes dead after first switch.~~
**Fix:** Named listener refs in `editor.js`; `destroyEditor()` removes all listeners and resets `editorEventsBound`. `StoryEditor.tsx` calls it on cleanup.

### B3 — `StoryEditor.tsx` effect fires on every parent render ✅ Fixed (P1-3)
~~`onLoadStoryByPath` was an inline arrow function; got a new reference every render, causing constant `initEditor()` re-fires.~~
**Fix:** `loadStoryRef` pattern in `App.tsx`; `onLoadStoryByPath` wrapped in `useCallback([activeStoryId])`.

---

## Broken — Wrong behavior, no crash

### B4 — Undo/redo permanently breaks after 20 actions ✅ Fixed (P1-6)
~~After 20 edits, `historyIndex` pointed past the valid array range; redo became permanently unavailable.~~
**Fix:** After `undoStack.shift()`, set `historyIndex = MAX_HISTORY - 1`.

### B5 — `StoryPlayer.tsx` is dead code (incomplete refactor) ✅ Fixed (P1-4)
~~File was never rendered; `App.tsx` used `<PlayerView>` directly. Mismatched prop signatures.~~
**Fix:** Deleted `src/components/StoryPlayer.tsx`.

### B6 — StoryList "Load" button always appears active ✅ Fixed (P2-7)
~~Hardcoded `className="choice-button active"` — always appeared selected regardless of state.~~
**Fix:** Load button `active` class and `disabled` state now conditional on `pendingStoryId !== activeStoryId`.

### B10 — Editor mutations do not sync back to React state ✅ Fixed (P2-3)
~~Editing a story in the editor then switching to player mode showed the original, unedited story.~~
**Fix:** `editor.js` calls `window.onStoryChange(storyData)` after every `saveState()` commit and after undo/redo. `StoryEditor.tsx` bridges this to `setStory(structuredClone(updated))`.

---

## Silent failures — No crash, wrong outcome, no feedback

### B7 — Validation warnings silently discarded ✅ Fixed (P2-1)
~~`yamlLoader.ts` only exposed errors; `result.warnings` was never returned to the caller.~~
**Fix:** `yamlLoader.ts` returns `StoryLoadResult = { data, warnings }`. `App.tsx` shows dismissible warnings banner.

### B8 — `applyEffect` silently ignores malformed effects ✅ Fixed (P2-4)
~~Broken effect expressions silently skipped with no feedback.~~
**Fix:** `PlayerView.tsx` collects failures into `effectErrors` state; shown as dismissible overlay.

### B9 — `evalCondition` executes arbitrary JavaScript (security gap) ✅ Fixed (P2-2)
~~Condition strings from YAML were passed directly to `new Function(...)`. A malicious story YAML could run arbitrary code.~~
**Fix:** Replaced with `src/lib/conditionEvaluator.ts` — tokenizer + recursive descent parser. No `eval` or `new Function`.

---

## UI / UX issues

### U1 — No story title displayed anywhere ✅ Fixed (P2-6)
~~Story list showed raw file-derived IDs; player showed no title.~~
**Fix:** `PlayerView.tsx` shows story title header. `StoryList.tsx` shows `activeStoryTitle` for loaded story.

### U2 — No distinction between selected and loaded story in list ✅ Fixed (P2-7)
~~No visual treatment for a story that was clicked but not yet loaded.~~
**Fix:** `(loaded)` badge on active story; Load button only active/enabled when a new story is selected.

---

## Configuration and tooling gaps

### C1 — No test infrastructure 🔴 Open
**Roadmap:** P3-1
`npm test` fails. Zero test coverage across all modules.
**Impact:** Refactoring of `storyValidator.ts`, `yamlLoader.ts`, `conditionEvaluator.ts`, or `PlayerView.tsx` logic done without a safety net.

### C2 — No GitHub Pages 404 fallback ✅ Fixed (P2-8)
~~Bookmarked or shared direct URLs returned a GitHub Pages 404 before React loaded.~~
**Fix:** `public/404.html` added with SPA redirect script; `index.html` has path restoration script.

### C3 — Vite base path is hardcoded 🔴 Open
**Roadmap:** P3-6
**File:** `vite.config.ts:5`
`base: '/pocket-stories/'` is a string literal. Breaks on fork or rename without manual edit.

### C4 — `tsconfig.json` uses deprecated `moduleResolution` casing 🔴 Open
**Roadmap:** P3-7
**File:** `tsconfig.json`
`"moduleResolution": "Bundler"` — should be lowercase `"bundler"`. No runtime impact today.

### C5 — `StoryEditor.tsx` dynamic import has no error handler ✅ Fixed (P1-5)
~~Load failure produced a blank, silent canvas with no message.~~
**Fix:** `.catch()` added to `import('../legacy/editor.js')`; shows user-visible error message.

---

## Story YAML quality issues

### Y1 — Unused variables declared in built-in stories 🔴 Open
**Roadmap:** P3-5
| Story | Variable | Issue |
|---|---|---|
| `forest_adventure.yaml` | `sword` | Declared, never set or read |
| `forest_adventure.yaml` | `dragon_scale` | Declared, never set or read |
| `river_oath.yaml` | `crossed_river` | Declared, never set or used |
| `city_noir.yaml` | `bribed_guard` | Set (line 30) but never checked by any condition |

### Y2 — Compound condition syntax undocumented 🔴 Open (partially resolved)
**Roadmap:** P3-5
**File:** `src/stories/river_oath.yaml:79`
`condition: "inventory.lantern == true && relationships.Ferryman >= 1"` — now verified to work with the new safe evaluator (P2-2 used `&&` / `||` support). Document in spec.md.

### Y3 — Redundant condition in `space_outpost.yaml` 🔴 Open
**File:** `src/stories/space_outpost.yaml:75`
`condition: "flags.power_restored == true"` — logically redundant but harmless.

---

## CSS maintainability

### S1 — `global.css` is monolithic and unscoped 🔴 Open
**Roadmap:** P3-2
**File:** `src/styles/global.css`
~1,553 lines mixing editor graph styles, player styles, sidebar rules, dark mode overrides, and responsive breakpoints. Class names tightly coupled to legacy editor DOM IDs.

---

## Audit methodology note

Initial issue list produced by full static analysis in March 2026. Updated after Phase 1 (P1) and Phase 2 (P2) completion. Issues numbered by category prefix (B = blocking/broken, U = UX, C = config/tooling, Y = YAML quality, S = styles). Original line numbers referenced the state at commit `f879a6d`.
