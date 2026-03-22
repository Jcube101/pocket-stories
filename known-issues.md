# Pocket Stories — Known Issues

Bugs and gaps found during the initial codebase audit (2026-03-10). Updated 2026-03-19 after CSS @import hotfix. Updated 2026-03-22 after UI overhaul and inspector/diagnostics improvements. Each item links to the relevant roadmap item in `roadmap.md`.

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

### Y3 — Redundant condition in `space_outpost.yaml` ✅ Resolved (2026-03-22)
`space_outpost.yaml` replaced with `hearts_and_ashes.yaml` — a long-form love triangle story with ~35 passages, multiple loops, and multiple endings.

---

## CSS maintainability

### S1 — `global.css` is monolithic and unscoped ✅ Fixed (P3-2)
~~1,553-line monolithic CSS file.~~
**Fix:** Split into `base.css` (resets), `editor-graph.css` (editor/canvas), `player.css` (React player + CSS custom properties). `global.css` now just `@tailwind` + `@import` + theme overrides.

### S2 — `@import` after `@tailwind` in `global.css` drops all custom styles ✅ Fixed (2026-03-19)
~~P3-2 placed the three `@import` statements after `@tailwind` directives. CSS spec requires `@import` before all other rules; browsers silently ignore `@import` that appears after other rules, so `base.css`, `editor-graph.css`, and `player.css` were all dropped — rendering the app as plain unstyled text.~~
**Fix:** Moved the three `@import` lines to the top of `global.css`, before the `@tailwind` directives.

---

## UI overhaul and inspector/diagnostics (2026-03-22)

Issues discovered and fixed during the Phase 4 UI overhaul and Phase 5 inspector/diagnostics pass.

### U3 — "Runtime parser unavailable" in diagnostics ✅ Fixed (P4-5)
`window.storyParsers` was never set by React. The editor's condition/effect syntax checks always fell through to the "parser unavailable" warning branch.
**Fix:** `App.tsx` sets `window.storyParsers = { parseCondition, parseEffect }` using `validateConditionSyntax` from `conditionEvaluator.ts` and `parseStoryEffect` from `storyValidator.ts`.

### U4 — Node inspector completely obscured by canvas-wrapper ✅ Fixed (P5-1)
`#canvas-wrapper` in `editor-graph.css` used `position: absolute; top: 0; left: 0; width: 100%; height: 100%`. This made canvas-wrapper fill the entire `#graph-container`, completely covering `#node-inspector` and making it unclickable and invisible.
**Fix:** Changed to `position: relative; overflow: hidden`. The parent `#graph-container` flexbox layout in `player.css` (display: flex) now correctly places canvas-wrapper (`flex: 1`) beside node-inspector (`width: 320px`).

### U5 — Node inspector meta panel too sparse ✅ Fixed (P5-1)
Inspector only showed choice count, conditional count, missing targets, and unreachable status — no detail on individual choices.
**Fix:** `renderInspectorMeta()` now shows a full per-choice list: choice text, target node (clickable jump link), condition tag, effect tag, plus status badges and char count.

### U6 — Diagnostics not auto-running after edits ✅ Fixed (P5-2)
The diagnostics panel only ran when the user explicitly clicked "Validate". After editing a node, the panel showed stale results.
**Fix:** `saveState()` starts a debounced timer (1.2s). On expiry, `validateStory({ showModalReport: false })` runs silently and updates the diagnostics panel and node highlight overlays.

## UX improvements (2026-03-22)

Issues discovered and fixed during the Phase 6 UX improvements pass.

### U7 — Node creation requires two blocking prompt() dialogs ✅ Fixed (P6-1)
Double-clicking the canvas called `prompt()` twice — once for the passage ID (pre-filled with a `Date.now()` timestamp) and once for the text. Authors had to dismiss both dialogs before the node appeared.
**Fix:** Double-click now creates a node immediately with an auto-generated sequential ID (`passage_1`, `passage_2`, …) and placeholder text. No prompts. The new node opens in the inspector instantly.

### U8 — Inspector fails to open when cursor moves between mousedown and mouseup ✅ Fixed (P6-2)
Node selection relied on the `click` event. Browsers suppress `click` if the pointer moves even a few pixels between `mousedown` and `mouseup`, meaning any slight hand movement during a click would silently fail to open the inspector. Additionally, `saveState()` was called on every `mouseup` regardless of movement, causing unnecessary React re-renders and undo entries.
**Fix:** Selection now happens in `mousedown` (always fires). `saveState()` is only called when `hasMoved` is true (movement threshold: 3 px). Plain node clicks no longer push undo history.

### U9 — No in-editor help or onboarding documentation ✅ Fixed (P6-3)
New users had no guidance on how to create nodes, connect them, or use conditions and effects — there was no help text anywhere in the UI.
**Fix:** Added a **Help & Guide** section at the top of the sidebar with a 10-item table of contents. A **"Read more →"** button opens a full help modal covering all editor features with examples and a keyboard shortcuts table.

---

## Audit methodology note

Initial issue list produced by full static analysis in March 2026. Updated after all three phases (P1, P2, P3) completion. Updated again 2026-03-22 after Phase 4 (UI overhaul) and Phase 5 (inspector + diagnostics). Issues numbered by category prefix (B = blocking/broken, U = UX, C = config/tooling, Y = YAML quality, S = styles). Original line numbers referenced the state at commit `f879a6d`.
