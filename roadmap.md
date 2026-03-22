# Pocket Stories — Development Roadmap

Last updated: 2026-03-22. Phases 1–5 complete. See `known-issues.md` for the full bug list and `decisions.md` for the architectural choices that shape this plan.

---

## Phase 1 — Stabilize ✅ COMPLETE

All Phase 1 items were implemented and merged (branch `claude/create-claude-md-ZAKIr`, 2026-03-18).

### P1-1 ★ Fix missing `js-yaml` dependency — *DONE*

- Added `js-yaml` to `package.json` dependencies
- Added `import jsyaml from 'js-yaml'` at top of `src/legacy/editor.js`

### P1-2 ★ Fix editor event listener leak and broken story-switch — *DONE*

- Named listener refs in `editor.js`; `destroyEditor()` exported and removes all listeners, resets `editorEventsBound`
- `StoryEditor.tsx` calls `destroyEditor()` on cleanup; `cancelled` flag prevents double-init in StrictMode

### P1-3 ★ Stabilize `StoryEditor.tsx` effect dependency — *DONE*

- `loadStoryRef` pattern: ref holds latest `loadStory`; `onLoadStoryByPath` wrapped in `useCallback([activeStoryId])`
- Effect dep is now stable — `initEditor()` only fires when `story` or `activeStoryId` changes

### P1-4 Delete dead `StoryPlayer.tsx` — *DONE*

- Deleted `src/components/StoryPlayer.tsx`

### P1-5 Add `.catch()` to dynamic editor import — *DONE*

- `.catch()` added to `import('../legacy/editor.js')` in `StoryEditor.tsx`; shows user-visible error message

### P1-6 Fix undo/redo history index corruption — *DONE*

- After `undoStack.shift()`, sets `historyIndex = MAX_HISTORY - 1`

### P1-7 Fix React StrictMode double-initialization — *DONE*

- Resolved by P1-2 + `cancelled` flag in `StoryEditor.tsx` effect

---

## Phase 2 — Core Features ✅ COMPLETE

All Phase 2 items were implemented and merged (branch `claude/create-claude-md-ZAKIr`, 2026-03-18).

### P2-1 ★ Surface validation warnings to story authors — *DONE*

- `yamlLoader.ts` returns `{ data, warnings }` as `StoryLoadResult`
- `App.tsx` shows dismissible warnings banner on story load

### P2-2 ★ Replace `new Function()` condition evaluator — *DONE*

- `src/lib/conditionEvaluator.ts` created: tokenizer + recursive descent parser
- Supports `==`, `!=`, `>=`, `<=`, `>`, `<`, `&&`, `||`, `!`, numeric/boolean literals, dotted variable paths
- `PlayerView.tsx` uses `evalCondition()` from `conditionEvaluator.ts`

### P2-3 ★ Sync editor mutations back to React state — *DONE*

- `editor.js` calls `window.onStoryChange(storyData)` after every `saveState()` commit and after undo/redo
- `StoryEditor.tsx` registers the callback and calls `setStory(structuredClone(updated))`

### P2-4 Surface `applyEffect` failures — *DONE*

- `PlayerView.tsx` collects `applyEffect` failures into `effectErrors` state; shown as dismissible overlay

### P2-5 Add condition syntax validation in the validator — *DONE*

- `storyValidator.ts` calls `validateConditionSyntax()` on each choice condition; bad syntax produces a warning

### P2-6 Display story title and metadata — *DONE*

- `PlayerView.tsx` shows story title header
- `StoryList.tsx` shows `activeStoryTitle` for the loaded story

### P2-7 Fix StoryList active/pending selection state — *DONE*

- Load button `active` class and `disabled` state conditional on `pendingStoryId !== activeStoryId`

### P2-8 Add GitHub Pages 404 fallback — *DONE*

- `public/404.html` created with SPA redirect script
- `index.html` has path restoration script

---

## Phase 3 — Polish and Scale ✅ COMPLETE

All Phase 3 items implemented (branch `claude/create-claude-md-ZAKIr`, 2026-03-18).

### P3-1 ★ Add test infrastructure (Vitest) — *DONE*

- `vitest` added to devDependencies; `vitest.config.ts` created
- `src/lib/conditionEvaluator.test.ts` — full coverage of tokenizer, parser, all operators, edge cases
- `src/lib/storyValidator.test.ts` — validates story structure, effect parsing, condition syntax

### P3-2 ★ Refactor `global.css` into scoped files — *DONE*

- `src/styles/base.css` — resets, body, h1, basic HTML elements
- `src/styles/editor-graph.css` — legacy editor: sidebar, canvas, nodes, connections, SVG
- `src/styles/player.css` — CSS custom properties, app-shell, player layout, animations
- `global.css` now just `@tailwind` directives + `@import` statements + theme overrides

**Hotfix (2026-03-19):** P3-2 placed `@import` after `@tailwind` directives, which caused browsers to silently drop all three imported stylesheets. Fixed by moving `@import` statements above `@tailwind` directives (see known-issues.md S2).

### P3-3 ★ Add manual dark mode toggle — *DONE*

- `App.tsx`: `theme` state (auto/dark/light), persisted to `localStorage`
- `document.documentElement.dataset.theme` updated on change
- Header toggle button cycles: ⚙️ Auto → 🌙 Dark → ☀️ Light → ⚙️ Auto
- CSS: `html[data-theme="dark"]` and `html[data-theme="light"]` overrides in `global.css`
  covering both CSS custom property layer (player UI) and legacy editor element colors

### P3-4 Modularize `editor.js` (incremental) — *DONE*

- `src/editor/types.ts` — TypeScript interfaces for `EditorUiState`, `HistoryEntry`, `CanvasViewMode`, module seam map
- `src/editor/index.ts` — public API barrel, documents migration path
- `src/legacy/editor.js` — 11 section header comments marking module boundaries:
  DATA MODEL / CONSTANTS / PERSISTENCE / GRAPH MODEL / HISTORY / EVENT HANDLING /
  RENDERING/EDGES / LAYOUT / SIDEBAR PANELS / EXPORT/IMPORT / MODAL / DIAGNOSTICS / UNDO/REDO

### P3-5 Clean up unused story variables — *DONE*

- `forest_adventure.yaml`: removed `sword` and `dragon_scale` from inventory
- `river_oath.yaml`: removed `crossed_river` from flags (empty `flags: {}`)
- `city_noir.yaml`: removed `bribed_guard` from flags and removed its `effect` assignment

### P3-6 Make Vite base path configurable — *DONE*

- `vite.config.ts`: `base: process.env.VITE_BASE_PATH ?? '/pocket-stories/'`
- `.env.example` created with documentation

### P3-7 Fix `tsconfig.json` `moduleResolution` casing — *DONE*

- `"Bundler"` → `"bundler"`

---

## Phase 4 — UI Overhaul ✅ COMPLETE

Implemented 2026-03-22 (branch `claude/create-claude-md-ZAKIr`).

### P4-1 Restructure app header — *DONE*

- Editor/Player mode tabs moved to left side of header
- Story selector (compact `<select>` + Load button) placed in header right alongside theme toggle
- Stories container removed from main content area entirely — collapsed into the header dropdown

### P4-2 Reorder sidebar sections — *DONE*

- New order from top to bottom: Variables → Passages → Tools → Diagnostics → Canvas Controls → Split View → Stories
- Stories section demoted to bottom of sidebar (now also accessible via header dropdown)

### P4-3 Variables panel improvements — *DONE*

- "Remove" button text replaced with `−` (minus symbol), 32×32px icon button
- Variable names rendered with full legibility (ellipsis overflow, tooltip on hover)

### P4-4 Tools 2×2 grid layout — *DONE*

- Tool buttons laid out in a 2-column grid — reduces vertical space consumption

### P4-5 Canvas Controls and Split View sections — *DONE*

- Canvas Controls: all canvas actions as visible buttons; zoom percentage displayed inline
- View Mode: Author / Logic / Playtest toggle buttons (replace hidden radio inputs)
- Split View: new section with Show Jump/Return, Critical Path, Full Downstream toggle buttons
- Fixed "Runtime parser unavailable" — `window.storyParsers` bridge set in `App.tsx` (U3)

### P4-6 Canvas interaction improvements — *DONE*

- Left-click drag on canvas background (nodesContainer) now pans the canvas
- Scroll-to-zoom moved to `canvas-wrapper` (covers all canvas areas)
- Touch support: one-finger pan, two-finger pinch-zoom

### P4-7 Node click → inspector bug fixed — *DONE*

- After drag → `saveState()` → React re-render → `initEditor()`, selected node was reset to nothing
- Fixed via `_preservedSelectedId` module-level variable: stored in `selectNodeByElement()`, restored at end of `initEditor()`

### P4-8 Diagnostics panel expanded — *DONE*

- Max-height increased from 34vh to 55vh
- More vertical space for viewing multiple issues

---

## Phase 5 — Inspector and Diagnostics Power-Up ✅ COMPLETE

Implemented 2026-03-22 (branch `claude/create-claude-md-ZAKIr`).

### P5-1 Fix node inspector overlap and enhance inspector — *DONE*

- Root cause: `#canvas-wrapper { position: absolute; top: 0; left: 0; width: 100%; height: 100% }` completely obscured `#node-inspector` (U4)
- Fix: changed to `position: relative; overflow: hidden`; flex layout in `player.css` takes over correctly
- Enhanced `renderInspectorMeta()`: full per-choice list with text, target (clickable jump link), condition tag, effect tag
- Status badges: ✓ OK / ⚠ Unreachable / ✖ Dangling ref / ⊙ Ending node + char count pill (U5)

### P5-2 Diagnostics power-up — *DONE*

- 6 new checks: missing story title, empty passage text, long passages (>800 chars), self-loop choices, duplicate choice text, undeclared variable references in conditions
- Auto-run diagnostics (debounced 1.2s) after every `saveState()` mutation — no modal (U6)
- Richer panel: severity icons (✖/⚠/ℹ), colored count pills, green "✓ No issues found" when clean

### P5-3 Replace `space_outpost.yaml` with `hearts_and_ashes.yaml` — *DONE*

- Replaced the 8-passage sci-fi demo with a ~35-passage love triangle narrative
- Features: multiple loops, multiple endings, `relationships` numeric tracking, `flags` state, conditional paths
- Resolves Y3 (redundant condition in old `space_outpost.yaml`)

---

## Architectural Decisions

See `decisions.md` for the five decisions that must be made before Phase 2 begins:

1. Editor integration strategy (keep legacy vs. incremental migration vs. rewrite)
2. Condition evaluator approach (blocklist vs. expression parser vs. structured YAML)
3. Story data ownership during editing (React vs. window vs. shared store)
4. CSS architecture going forward (Tailwind-first vs. CSS Modules vs. status quo)
5. Story file persistence model (static only vs. export/import vs. full localStorage)
