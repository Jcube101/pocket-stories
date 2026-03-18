# Pocket Stories — Development Roadmap

Last updated: 2026-03-18. All three phases complete. See `known-issues.md` for the full bug list and `decisions.md` for the architectural choices that shape this plan.

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

## Architectural Decisions

See `decisions.md` for the five decisions that must be made before Phase 2 begins:

1. Editor integration strategy (keep legacy vs. incremental migration vs. rewrite)
2. Condition evaluator approach (blocklist vs. expression parser vs. structured YAML)
3. Story data ownership during editing (React vs. window vs. shared store)
4. CSS architecture going forward (Tailwind-first vs. CSS Modules vs. status quo)
5. Story file persistence model (static only vs. export/import vs. full localStorage)
