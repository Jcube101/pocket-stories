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

### P5-3 Replace `space_outpost.yaml` with a richer demo story — 🔴 Deferred to Phase 6

- Deferred in favour of UX fixes; `space_outpost.yaml` remains in place for now

---

## Phase 6 — UX Improvements ✅ COMPLETE

Implemented 2026-03-22 (branch `claude/ux-improvements-ZAKIr`).

### P6-1 Streamline node creation — *DONE*

- Double-click on empty canvas now creates a passage instantly with an auto-generated ID (`passage_1`, `passage_2`, …) and placeholder text — no more two-prompt interruption
- New node is immediately selected and opened in the inspector for editing
- Auto-ID counter skips any IDs already in use

### P6-2 Fix inspector opening reliability — *DONE*

- Inspector now opens on `mousedown` rather than `click` — `click` may not fire if the cursor moves even a pixel between press and release (U7)
- `saveState()` is only called when a node actually moved (`hasMoved` flag, threshold 3px) — eliminates spurious undo entries and React re-renders on plain node clicks (U8)

### P6-3 Add in-editor help system — *DONE*

- New **Help & Guide** section at the top of the sidebar, showing a numbered 10-item table of contents
- **"Read more →"** button opens a full modal covering: getting started, node creation, connections, inspector, conditions/effects, variables, diagnostics, canvas controls, keyboard shortcuts, and export/play
- Modal closes on backdrop click or the Close button

---

## Phase 7 — Inspector Choice Editor + UX Polish ✅ COMPLETE

Implemented 2026-03-22 (branch `claude/inspector-choice-editor-ZAKIr`).

### P7-1 Choice editor in inspector — *DONE*

- `renderInspectorMeta()` rewritten: each choice now has editable input fields for text, target (with datalist autocomplete of all passage IDs), condition, and effect
- Delete button (✕) per choice row removes the choice and updates the canvas immediately
- **+ Add Choice** button appends a new empty row and focuses the text field
- All changes commit to `storyData` and push an undo entry on blur

### P7-2 Node ID rename UX improvements — *DONE*

- **Enter key** commits the rename (blur previously required)
- **Escape** cancels the rename and restores the original ID
- `alert()` replaced with an inline `<small>` error below the input field
- Input validation: ID must match `[a-zA-Z0-9_-]+`; inline error clears on next keystroke
- All `target:` references across all passages are updated on rename (was already working; now surfaced clearly)

### P7-3 Raise undo/redo limit — *DONE*

- `MAX_HISTORY` bumped from 20 → 100 steps

---

## Phase 8A — Player: Full-screen Immersive Mobile ✅ COMPLETE

Implemented 2026-03-24 (branch `claude/inspector-choice-editor-ZAKIr`).

### P8A-1 Full-screen immersive player layout — *DONE*

- `index.html`: `viewport-fit=cover` added for notch/rounded-corner safe-area support
- `player-layout` becomes a `flex` column at `max-width: 767px`, filling available height via `app-shell { height: 100dvh }` + `main-content:has(.player-layout) { flex: 1 }`
- `#passage-container` takes `flex: 1; overflow-y: auto` — passage content scrolls; the shell does not

### P8A-2 Mobile top bar & bottom bar — *DONE*

- **Top bar** (48px): ↺ Restart button + story title — hidden on desktop, visible on mobile
- **Bottom bar** (44px + safe-area): History toggle button showing count — hidden on desktop, visible on mobile
- Desktop history `<aside>` gains `.player-history-aside` class and is `display: none` on mobile

### P8A-3 History as a slide-up bottom drawer — *DONE*

- `.player-history-drawer`: `position: fixed; bottom: 0; border-radius: 16px 16px 0 0; transform: translateY(100%)` — slides to `translateY(0)` when `.open`
- `.player-history-backdrop`: `position: fixed; inset: 0` — tap to close drawer
- Drawer resets to closed on story change, restart, and when a choice is made
- Respects `env(safe-area-inset-bottom)` for notched devices

### P8A-4 Tap-to-skip typewriter — *DONE*

- `skipRevealRef` (useRef) set to `true` when passage text is tapped during reveal
- rAF tick checks `skipRevealRef.current` at start of each frame — jumps to full text immediately
- `cursor: pointer` on passage text while typewriter is active; `undefined` when complete
- History drawer closed when a choice is made

### P8A-5 Touch interaction improvements — *DONE*

- `touch-action: manipulation` on all `button`, `a`, `[role="button"]` — eliminates 300ms tap delay
- Choice buttons: `min-height: 52px` on mobile (Apple HIG recommends ≥ 44px)
- `player-top-restart` and `player-history-toggle` both have `:active` states with `var(--player-accent-soft)`

---

## Architectural Decisions

See `decisions.md` for the five decisions that must be made before Phase 2 begins:

1. Editor integration strategy (keep legacy vs. incremental migration vs. rewrite)
2. Condition evaluator approach (blocklist vs. expression parser vs. structured YAML)
3. Story data ownership during editing (React vs. window vs. shared store)
4. CSS architecture going forward (Tailwind-first vs. CSS Modules vs. status quo)
5. Story file persistence model (static only vs. export/import vs. full localStorage)
