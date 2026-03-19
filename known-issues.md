# Pocket Stories — Known Issues

Bugs and gaps found during the initial codebase audit (2026-03-10). Updated 2026-03-19 after CSS @import hotfix. Each item links to the relevant roadmap item in `roadmap.md`.

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

### C1 — No test infrastructure ✅ Fixed (P3-1)
~~`npm test` fails. Zero test coverage across all modules.~~
**Fix:** Vitest installed; `conditionEvaluator.test.ts` and `storyValidator.test.ts` written; `npm test` passes.

### C2 — No GitHub Pages 404 fallback ✅ Fixed (P2-8)
~~Bookmarked or shared direct URLs returned a GitHub Pages 404 before React loaded.~~
**Fix:** `public/404.html` added with SPA redirect script; `index.html` has path restoration script.

### C3 — Vite base path is hardcoded ✅ Fixed (P3-6)
~~`base: '/pocket-stories/'` is a string literal. Breaks on fork or rename without manual edit.~~
**Fix:** `vite.config.ts` now uses `process.env.VITE_BASE_PATH ?? '/pocket-stories/'`; `.env.example` added.

### C4 — `tsconfig.json` uses deprecated `moduleResolution` casing ✅ Fixed (P3-7)
~~`"moduleResolution": "Bundler"` — should be lowercase `"bundler"`. No runtime impact today.~~
**Fix:** Changed to `"bundler"`.

### C5 — `StoryEditor.tsx` dynamic import has no error handler ✅ Fixed (P1-5)
~~Load failure produced a blank, silent canvas with no message.~~
**Fix:** `.catch()` added to `import('../legacy/editor.js')`; shows user-visible error message.

---

## Story YAML quality issues

### Y1 — Unused variables declared in built-in stories ✅ Fixed (P3-5)
~~Four variables declared across three stories were never meaningfully used.~~
**Fix:** Removed `sword` and `dragon_scale` from `forest_adventure.yaml`; removed `crossed_river` from `river_oath.yaml`; removed `bribed_guard` variable and its effect assignment from `city_noir.yaml`.

### Y2 — Compound condition syntax ✅ Resolved (P2-2, P3-5)
~~Compound conditions undocumented.~~
**Fix:** `&&` / `||` / `!` fully supported by `conditionEvaluator.ts` (P2-2). Story YAML cleanup done (P3-5). Compound condition in `river_oath.yaml` verified working.

### Y3 — Redundant condition in `space_outpost.yaml` 🔴 Open
**File:** `src/stories/space_outpost.yaml:75`
`condition: "flags.power_restored == true"` — logically redundant but harmless.

---

## CSS maintainability

### S1 — `global.css` is monolithic and unscoped ✅ Fixed (P3-2)
~~1,553-line monolithic CSS file.~~
**Fix:** Split into `base.css` (resets), `editor-graph.css` (editor/canvas), `player.css` (React player + CSS custom properties). `global.css` now just `@tailwind` + `@import` + theme overrides.

### S2 — `@import` after `@tailwind` in `global.css` drops all custom styles ✅ Fixed (2026-03-19)
~~P3-2 placed the three `@import` statements after `@tailwind` directives. CSS spec requires `@import` before all other rules; browsers silently ignore `@import` that appears after other rules, so `base.css`, `editor-graph.css`, and `player.css` were all dropped — rendering the app as plain unstyled text.~~
**Fix:** Moved the three `@import` lines to the top of `global.css`, before the `@tailwind` directives.

---

## Audit methodology note

Initial issue list produced by full static analysis in March 2026. Updated after all three phases (P1, P2, P3) completion. Issues numbered by category prefix (B = blocking/broken, U = UX, C = config/tooling, Y = YAML quality, S = styles). Original line numbers referenced the state at commit `f879a6d`.
