# Pocket Stories — Known Issues

Bugs and gaps found during the initial codebase audit (2026-03-10). Updated 2026-03-19 after CSS @import hotfix. Updated 2026-03-22 after UI overhaul, inspector/diagnostics improvements, and choice editor + UX polish. Updated 2026-03-24 after mobile polish (P8A player + P8B editor). Updated 2026-04-05 after player layout bug fixes and full story audit (P9). Each item links to the relevant roadmap item in `roadmap.md`.

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

### Y3 — `space_outpost.yaml` too thin to demonstrate engine capabilities ✅ Fixed (P5-3 / P9-3, 2026-04-05)
~~8 passages, single linear path, only `==` conditions, no `&&`/`>=`, trivial variable use.~~
**Fix:** Replaced with "Wreck of the Akaida" — 19 passages, 3 endings, `==`/`>=`/`&&` conditions, all three variable types, hull breach puzzle, rescue branching.

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

## Mobile polish (2026-03-24)

Issues discovered and fixed during the Phase 8 mobile polish pass.

### U10 — Player has no mobile-optimised layout ✅ Fixed (P8A)
The player used a two-column grid (passage + history sidebar) that overflowed on 375px phones. No touch-optimised interactions, no tap-to-skip typewriter, history always visible even when empty.
**Fix:** Full-screen immersive layout: passage fills viewport (`flex: 1; overflow-y: auto`), history replaced by a slide-up bottom drawer, mobile top bar (restart + title), bottom bar (history toggle), tap-to-skip typewriter via `skipRevealRef`, `touch-action: manipulation` on all interactive elements, `min-height: 52px` choice buttons. `viewport-fit=cover` added to meta viewport.

### U11 — Editor unusable on phones ✅ Fixed (P8B)
The canvas editor (360px fixed sidebar + SVG graph + inspector) overflowed phone screens. No passage-list fallback.
**Fix:** `useIsMobile` hook in `StoryEditor.tsx` detects phones (< 768px). On phones, `editor.js` canvas is never loaded; instead `MobileEditorView` renders a vertical passage-card list + full-screen passage editor. ID rename, choice editing (reusing `ice-*` classes), add/delete passage, and Play button all work. Safe-area insets and dark mode fully supported.

---

## Player layout and status bar (2026-04-05)

### U12 — Passage container placed in wrong grid column on desktop ✅ Fixed (P9-1)
On desktop (≥900px), `player-layout` switched to `grid-template-columns: 2fr 1fr`. Without explicit column assignments, CSS auto-placement put `h2.player-heading` in col 1 and `#passage-container` in col 2 (right side), pushing `.player-history-aside` to col 1 row 2. The story appeared on the right; the history appeared below the title on the left.
**Fix:** `player.css` — added `grid-column: 1` to `.player-layout > .player-heading` and `.player-layout > #passage-container`; set `.player-history-aside` to `grid-column: 2; grid-row: 1 / span 10`.

### U13 — Redundant "Loaded: story_id" status bar shown in player mode ✅ Fixed (P9-2)
`App.tsx` rendered `{topStatus}` unconditionally above both editor and player. The header right already shows which story is loaded, making the status bar in player mode redundant and distracting.
**Fix:** Changed to `{mode === 'editor' && topStatus}` — status bar only renders in editor mode.

---

## Story YAML bugs (2026-04-05)

### Y4 — `river_oath.yaml`: "Take both" only applied one effect ✅ Fixed (P9-4)
The `crates` passage had a choice labelled "Take both" that only set `inventory.lantern = true` — the one-effect-per-choice constraint meant `inventory.ferry_token` was never set. Players who chose "Take both" could not subsequently pay the ferryman with a token despite expecting to have one.
**Fix:** Split into two passages: `crates` with "Take the lantern" (effect: `lantern = true`) → new `crates_token` passage with optional "Take the token too" (effect: `ferry_token = true`).

### Y5 — `river_oath.yaml`: `relationships.Mira` set but never used in a condition ✅ Fixed (P9-4)
Mira's trust was tracked and could be raised or lowered but had no conditional effect on any passage. Building trust with Mira produced no gameplay difference.
**Fix:** Added a third path through `crossing`: "Invoke Mira's trust as your pledge" gated by `relationships.Mira >= 2`.

### Y6 — `city_noir.yaml`: `alley_talk` was a dead end for evidence ✅ Fixed (P9-4)
Choosing "Ask for details first" in `alley` gave `relationships.Informant += 2` but then went directly to `club_floor` with no evidence. The `good_end` and `best_end` both require evidence, so the entire informant-detail path could never reach a good outcome.
**Fix:** `alley_talk` now also hands over the evidence envelope at the end of the conversation.

### Y7 — `city_noir.yaml`: `relationships.Informant` tracked but never used in a condition ✅ Fixed (P9-4)
The informant's trust was set via `+=` / `-=` effects but no condition in the story ever checked it. Cultivating the relationship had no gameplay impact.
**Fix:** Added `best_end` passage gated by `inventory.evidence == true && relationships.Informant >= 2`. Added `alley_trust` passage to let envelope-takers also build informant trust. Added `confronted` passage with `!inventory.evidence` condition.

### Y8 — `forest_adventure.yaml`: Three flags declared but never used in conditions ✅ Fixed (P9-4)
`flags.opened_gate`, `flags.met_dragon`, and `flags.promised_alice` were all declared in `variables:`. Only `promised_alice` was even set; none were ever checked in a condition gate. The effects that set `opened_gate` and `met_dragon` were dead writes.
**Fix:** Removed `opened_gate` and `met_dragon` from variables and their effect assignments. `promised_alice` is now checked: "Sneak past" dragon uses `relationships.Alice >= 3 || flags.promised_alice == true`; the `treasure_room` hub offers `good_end_promise` (distinct ending) when the flag is true.

### Y9 — `forest_adventure.yaml`: `dragon_fight` was a permanent dead end ✅ Fixed (P9-4)
Choosing to fight the dragon ended the story with `choices: []` and no further options — no survival path, no retreat. Players with an unused potion had no way to spend it in the fight.
**Fix:** `dragon_fight` now has two choices: "Use the healing potion to fight through" (condition: `inventory.potion >= 1`, effect: `inventory.potion = 0`) → `dragon_survived` → `treasure_room`; or "Flee" → `neutral_end_fled`. Added `dragon_survived` and `neutral_end_fled` passages.

---

## Technical audit findings (2026-04-24)

Issues identified by a full codebase audit. Prefix: R = risk from audit register.

### R1 — Leaked anonymous keydown handler fires in player mode ✅ Fixed (2026-04-24)
~~`editor.js` registered `document.addEventListener('keydown', ...)` with an anonymous function at module scope. `destroyEditor()` only removed the named `_bound*` listeners. The handler persisted in player mode: Delete/Backspace popped a `confirm()` dialog, Ctrl+Z silently corrupted `window.storyData`, Ctrl+S triggered a YAML export.~~
**Fix:** Converted to named `_boundOnDocGlobalKeyDown`; registered in `bindEditorEvents()`, removed in `destroyEditor()`.

### R2 — `selectedNode` not cleared on destroy ✅ Fixed (2026-04-24)
~~`destroyEditor()` never set `selectedNode = null`. The variable persisted across mode switches, holding a reference to a detached DOM element and enabling R1's Delete path.~~
**Fix:** Added `selectedNode = null` to `destroyEditor()`.

### R3 — `_autoDiagnosticsTimer` not cancelled on destroy ✅ Fixed (2026-04-24)
~~`saveState()` set a 1.2-second debounced timer. If the editor unmounted within that window, the timer fired after destruction. Survived only by a defensive null check in `validateStory()`.~~
**Fix:** Added `clearTimeout(_autoDiagnosticsTimer); _autoDiagnosticsTimer = null` to `destroyEditor()`.

### R4 — Stale highlight sets flash during story switch ✅ Fixed (2026-04-24)
~~Module-level highlight sets (`highlightedCycleNodes`, `highlightedUnreachableNodes`, `highlightedErrorNodes`, etc.), `diagnosticsState`, `downstreamHighlight`, and `hoveredNodeId` were not cleared at the start of `initEditor()`. During the window between `initEditor()` start and `validateStory()` call, stale highlights from the previous story were rendered on the new story's canvas.~~
**Fix:** All 9 highlighted sets, `diagnosticsState`, `downstreamHighlight`, and `hoveredNodeId` cleared at the top of `initEditor()`.

### R5 — `window.storyData` is a shared mutable reference 🔴 Open (deferred)
`StoryEditor.tsx` sets `window.storyData = story` — intentionally the same object reference as React's `story` state (no clone). The editor mutates `window.storyData.passages` directly — adding choices, renaming nodes, auto-fixing — then calls `window.onStoryChange(window.storyData)`. The React callback clones at notification time: `setStory(structuredClone(updated))`, creating a separate copy for React's state tree. The `structuredClone` at notification time is the sole safety mechanism.

Adding `structuredClone` at the assignment site (`window.storyData = structuredClone(story)`) was attempted and reverted — it breaks undo/redo. The mechanism: `applyStateIncremental()` restores passages by writing directly onto `window.storyData.passages`, then calls `window.onStoryChange(window.storyData)`, which triggers `setStory(structuredClone(...))` → re-render → the `StoryEditor` effect runs → `window.storyData = structuredClone(story)` creates a **new** object. But `applyStateIncremental()` had already written to the previous clone. Each undo writes to an object that is immediately replaced, so undo appears to do nothing. See `decisions.md` Decision 8.

Safe today, but fragile: removing the notification-time clone would cause silent data corruption.
**Future fix:** Introduce a stable editor-owned state object that `editor.js` owns and React never touches. Undo/redo writes to this object; React receives clones via `onStoryChange`. This decouples the editor's mutable state from React's immutable state model. Estimated complexity: High (design session required before any implementation).

### R6 — `registerImportedStoryEntry` briefly undefined during effect re-run ✅ Fixed (2026-04-24)
~~The `useEffect` in `App.tsx` depended on `[stories]`. When `stories` changed, the cleanup function ran `delete window.registerImportedStoryEntry`, then the effect re-created it. During this gap (one microtask), the function was undefined. If a file import happened at exactly this moment, the imported story was lost without feedback.~~
**Fix:** Replaced with `??=` assignment and a `storiesRef` pattern — the function is assigned once, never deleted, and reads the latest `stories` via the ref.

### R8 — Passage IDs unvalidated at YAML boundary ✅ Fixed (2026-04-24)
~~`storyValidator.ts` accepted any string key from YAML as a passage ID. The editor and MobileEditorView enforced `/^[a-zA-Z0-9_-]+$/` on renames, but YAML-imported IDs bypassed this. A passage ID containing special characters (e.g., `bad"].evil`) would break every `querySelector(`.node[data-id="${id}"]`)` call in `editor.js`.~~
**Fix:** Added passage ID format check (`/^[a-zA-Z0-9_-]+$/`) in `validateAndNormalizeStory()`. Non-conforming IDs produce a warning (story still loads).

### R10 — Dual dark mode systems — maintenance trap ✅ Fixed (2026-04-24)
~~`editor-graph.css` used `@media (prefers-color-scheme: dark)` (14 blocks) and `@media (prefers-color-scheme: light)` (3 blocks). `global.css` used `html[data-theme]` overrides. Any new dark-mode CSS added to `editor-graph.css` via media query would silently break the manual theme toggle.~~
**Fix:** All 14 dark and 3 light media query blocks deleted from `editor-graph.css`. Consolidated `@media` blocks added to `global.css` for auto mode. Two missing `html[data-theme="light"]` rules added (`#variables h3`, `#add-variable-form`). `editor-graph.css` now has zero `prefers-color-scheme` media queries — all theme logic lives in `global.css`.

### R11 — Editor modal uses OS dark preference, ignores `data-theme` ✅ Fixed (2026-04-24)
~~`showModal()` in `editor.js` checked `window.matchMedia('(prefers-color-scheme: dark)')` to set modal colors. It did not check `document.documentElement.dataset.theme`. User sets Light theme, OS is dark → modal appeared with dark background inside a light-themed editor.~~
**Fix:** `showModal()` now reads `document.documentElement.dataset.theme` first, falls back to `matchMedia`.

### R12 — Manual story file sync between `src/stories/` and `public/stories/` ✅ Fixed (2026-04-24)
~~Files had to be manually kept in sync. Divergence would cause bundled stories and static-served stories to differ.~~
**Fix:** Added `"prebuild": "cp src/stories/*.yaml public/stories/"` to `package.json`. Runs automatically before every `npm run build`.

### R13 — CI deploys without running test suite ✅ Fixed (2026-04-24)
~~`deploy-gh-pages.yml` ran `npm run build` but not `npm test`. Regressions in the condition parser or story validator would ship silently.~~
**Fix:** Added `npm test` step between Install and Build in the CI workflow.

---

## Audit methodology note

Initial issue list produced by full static analysis in March 2026. Updated after all three phases (P1, P2, P3) completion. Updated again 2026-03-22 after Phase 4 (UI overhaul) and Phase 5 (inspector + diagnostics). Updated 2026-04-05 after Phase 9 post-launch fixes (player layout bugs U12–U13, story YAML bugs Y4–Y9). Updated 2026-04-24 after full codebase audit (13-risk register; 11 fixed, 1 deferred, 1 false alarm). Issues numbered by category prefix (B = blocking/broken, U = UX, C = config/tooling, Y = YAML quality, S = styles, R = audit risk). Original line numbers referenced the state at commit `f879a6d`.
