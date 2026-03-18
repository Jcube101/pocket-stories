# Pocket Stories — Development Roadmap

Last updated: 2026-03-18. Phase 1 and Phase 2 complete. See `known-issues.md` for the full bug list and `decisions.md` for the architectural choices that shape this plan.

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

## Phase 3 — Polish and Scale

Nice-to-haves and maintainability improvements. None are blockers, but several compound in value as the project grows.

### P3-1 ★ Add test infrastructure (Vitest)

Zero test coverage. `storyValidator.ts` is the highest-value first target — pure logic, well-defined inputs and outputs.

- Add `vitest` + `@testing-library/react` to devDependencies
- Write unit tests for: `storyValidator.ts` (all branches), `conditionEvaluator.ts`, `yamlLoader.ts`, `applyEffect` logic
- Files: `package.json`, `vitest.config.ts` (new), `src/lib/*.test.ts` (new)

### P3-2 ★ Refactor `global.css` into scoped files

1,553 lines mixing editor graph styles, player styles, sidebar rules, and dark mode. Class names are coupled to legacy editor DOM IDs.

- Split into: `editor-graph.css` (legacy editor styles, kept flat), `player.css`, `base.css` (resets + CSS custom properties)
- Migrate new React component styles to Tailwind utility classes
- Files: `src/styles/global.css`, component files

### P3-3 ★ Add manual dark mode toggle

Dark mode is CSS-only via `@media (prefers-color-scheme: dark)`. No in-app toggle.

- Add `darkMode` state to `App.tsx`; apply `data-theme="dark"` to `<html>`
- Update CSS selectors to use `[data-theme="dark"]` in addition to the media query
- Persist preference to `localStorage`; add toggle button to header
- Files: `src/App.tsx`, `src/styles/global.css`

### P3-4 Modularize `editor.js` (incremental)

Seal `editor.js` for Phase 2 (bug fixes only). In Phase 3, extract natural module seams (data model, node rendering, edge rendering, event handling, serialization, undo-redo) into TypeScript files under `src/editor/`. Do not rewrite behavior — restructure only. Requires P3-1 test coverage as a safety net.

- Files: `src/legacy/editor.js` → `src/editor/` (new directory)

### P3-5 Clean up unused story variables

Four variables declared across three stories are never meaningfully used. They create noise and will produce false positives from any future static analysis.

- `forest_adventure.yaml`: remove or use `sword`, `dragon_scale`
- `river_oath.yaml`: remove or use `crossed_river`; note: `bribed_guard` in `city_noir.yaml` is set but never checked — add a condition or remove it
- Document the compound condition syntax used in `river_oath.yaml` line 79
- Files: `src/stories/*.yaml`

### P3-6 Make Vite base path configurable

`base: '/pocket-stories/'` is hardcoded. Breaks on rename, fork, or custom domain without a manual config edit.

- `vite.config.ts`: `base: process.env.VITE_BASE_PATH ?? '/pocket-stories/'`
- Files: `vite.config.ts`, `.env.example` (new)

### P3-7 Fix `tsconfig.json` `moduleResolution` casing

`"Bundler"` → `"bundler"` (deprecated capitalization, harmless today).

- Files: `tsconfig.json`

---

## Architectural Decisions

See `decisions.md` for the five decisions that must be made before Phase 2 begins:

1. Editor integration strategy (keep legacy vs. incremental migration vs. rewrite)
2. Condition evaluator approach (blocklist vs. expression parser vs. structured YAML)
3. Story data ownership during editing (React vs. window vs. shared store)
4. CSS architecture going forward (Tailwind-first vs. CSS Modules vs. status quo)
5. Story file persistence model (static only vs. export/import vs. full localStorage)
