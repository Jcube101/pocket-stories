# Pocket Stories — Development Roadmap

Last updated: 2026-03-10. Based on the initial codebase audit (see `known-issues.md` for the full bug list and `decisions.md` for the architectural choices that shape this plan).

---

## Phase 1 — Stabilize

Must be complete before any new feature work. These are crashes, silent breakage, and dead code that will undermine anything built on top of them.

### P1-1 ★ Fix missing `js-yaml` dependency — *CRASH*

The editor calls `jsyaml.dump()` and `jsyaml.load()` but `js-yaml` is not in `package.json` and is never imported. Clicking "Export Story" throws `ReferenceError: jsyaml is not defined`.

- Add `js-yaml` to `package.json` dependencies
- Add `import jsyaml from 'js-yaml'` at top of `src/legacy/editor.js`
- Files: `package.json`, `src/legacy/editor.js`

### P1-2 ★ Fix editor event listener leak and broken story-switch — *CRASH / LEAK*

`editor.js` attaches seven `document.addEventListener` calls that are never removed. `editorEventsBound` is set `true` on first init and never reset. Switching stories rebuilds the DOM but silently skips re-attaching events — the canvas goes dead. Every mount adds another listener set.

- In `editor.js`: save named references to listener functions; export `destroyEditor()` that calls `removeEventListener` for each and resets `editorEventsBound = false`
- In `StoryEditor.tsx`: return `() => destroyEditor()` from the `useEffect`
- Files: `src/legacy/editor.js` (~line 1102), `src/components/StoryEditor.tsx`

### P1-3 ★ Stabilize `StoryEditor.tsx` effect dependency — *RUNAWAY RE-INIT*

`onLoadStoryByPath` is an inline arrow function in `App.tsx` — it gets a new reference every render. It's listed as a dep in `StoryEditor.tsx`'s `useEffect`, so `initEditor()` fires on every parent re-render.

- Wrap `onLoadStoryByPath` in `useCallback` in `App.tsx`
- Add ID guard in `App.tsx`: validate that the resolved story ID exists before calling `loadStory()`
- Files: `src/App.tsx`, `src/components/StoryEditor.tsx`

### P1-4 Delete dead `StoryPlayer.tsx`

Never rendered — `App.tsx` uses `PlayerView` directly. Has a different prop signature (`story` vs `storyData`), indicating an incomplete refactor.

- Delete `src/components/StoryPlayer.tsx`
- Files: `src/components/StoryPlayer.tsx`

### P1-5 Add `.catch()` to dynamic editor import

`StoryEditor.tsx` has no error handler on `import('../legacy/editor.js')`. A load failure produces a blank, silent canvas.

- Add `.catch(err => { /* set error state */ })` to show a user-visible message
- Files: `src/components/StoryEditor.tsx`

### P1-6 Fix undo/redo history index corruption

When `undoStack` hits `MAX_HISTORY (20)` and the oldest entry is shifted off, `historyIndex` is not decremented. Redo becomes permanently unavailable.

- After `undoStack.shift()`, add `historyIndex = Math.max(0, historyIndex - 1)`
- Files: `src/legacy/editor.js` (lines 780–782)

### P1-7 Fix React StrictMode double-initialization

Partially resolved by P1-2. After that fix, verify dev-mode behavior. Add a `useRef` mount guard in `StoryEditor.tsx` if double-render flicker persists.

- Files: `src/components/StoryEditor.tsx`

---

## Phase 2 — Core Features

These are the gaps that make the current experience incomplete. Requires Phase 1 to be stable first.

### P2-1 ★ Surface validation warnings to story authors

`yamlLoader.ts` discards `result.warnings` — authors get no feedback on unused variables, undeclared targets, etc.

- Extend `loadStoryFromRaw()` to return warnings alongside data
- Pipe warnings through `App.tsx` state
- Display as a dismissible notice when a story is loaded (player and editor)
- Files: `src/lib/yamlLoader.ts`, `src/App.tsx`, `src/components/PlayerView.tsx`

### P2-2 ★ Replace `new Function()` condition evaluator

`evalCondition` in `PlayerView.tsx` executes condition strings as raw JavaScript. A malicious story file could run arbitrary code in the user's browser.

- Implement a safe expression evaluator in `src/lib/conditionEvaluator.ts` supporting: `==`, `!=`, `>=`, `<=`, `>`, `<`, `&&`, `||`, `!`, numeric/boolean literals, and dotted variable paths
- Add condition syntax validation to `storyValidator.ts`
- All four built-in stories use only this operator set — no breaking change
- Files: `src/components/PlayerView.tsx`, `src/lib/storyValidator.ts`, `src/lib/conditionEvaluator.ts` (new)

### P2-3 ★ Sync editor mutations back to React state

The editor mutates `window.storyData.passages` directly. React state (`story` in `App.tsx`) is never updated, so switching to player mode after editing renders stale data.

- Editor calls `window.onStoryChange(storyData)` after every mutation
- `StoryEditor.tsx` registers this callback and triggers a React state update via prop
- Files: `src/legacy/editor.js`, `src/components/StoryEditor.tsx`, `src/App.tsx`

### P2-4 Surface `applyEffect` failures

`applyEffect` in `PlayerView.tsx` silently discards parse failures — broken effect expressions just don't apply.

- Collect failures into a diagnostic state array; display as a non-blocking overlay (requires P2-1 banner infrastructure)
- Files: `src/components/PlayerView.tsx`

### P2-5 Add condition syntax validation in the validator

`storyValidator.ts` accepts any string as a condition without checking it. Pair with P2-2's evaluator grammar to reject unsupported syntax at load time.

- Files: `src/lib/storyValidator.ts`, `src/lib/conditionEvaluator.ts`

### P2-6 Display story title and metadata

`StoryData` has `title` and `metadata` fields — nothing renders them. The story list shows raw file-derived IDs; the player shows no title.

- `StoryList.tsx`: use `title` as primary label (ID as subtitle)
- `PlayerView.tsx`: show title in player header
- Files: `src/components/StoryList.tsx`, `src/components/PlayerView.tsx`

### P2-7 Fix StoryList active/pending selection state

The "Load selected story" button has a hardcoded `active` class — it always appears selected regardless of state. No visual distinction between "selected" and "loaded".

- Apply `active` only when story ID === loaded story ID
- Add a `pending` visual treatment for selected-but-not-loaded
- Files: `src/components/StoryList.tsx`

### P2-8 Add GitHub Pages 404 fallback

No `404.html` redirect is configured. Deep links or browser refreshes return a GitHub Pages 404 before React can handle them.

- Add `public/404.html` with the standard GitHub Pages SPA redirect script
- Files: `public/404.html`, `index.html`

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
