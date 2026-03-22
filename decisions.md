# Pocket Stories — Architectural Decisions

This document records the key architectural choices for this project, the reasoning behind them, and the alternatives that were considered. Its purpose is to prevent relitigating the same decisions in future sessions.

Each entry follows the format: **Context → Options → Decision → Rationale**.

---

## Decision 1 — Legacy editor strategy

**Status: DECIDED — Option A for Phase 1–2, Option B begins in Phase 3**

**Context:** `src/legacy/editor.js` is 2,967 lines of plain JavaScript with global state, direct DOM manipulation, and `window.*` globals. It is the source of multiple Phase 1 bugs (missing `js-yaml`, event listener leak, broken re-init, undo/redo corruption) and all moderately complex editor feature work goes through it. The question is whether to maintain it, modularize it, or rewrite it.

**Options considered:**
- A) **Keep and stabilize.** Fix the specific bugs. Treat `editor.js` as a sealed black box — minimize the interface (one `initEditor()` in, one `destroyEditor()` out, one `storyChanged` event out). No new features added to the legacy file.
- B) **Incremental migration.** Extract natural seams (data model, undo-redo, serialization, rendering) into TypeScript modules under `src/editor/`. No behavioral rewrite — structure only. Requires test coverage as a safety net.
- C) **Full React rewrite.** Replace `editor.js` entirely with a React SVG node-graph (or use a library like `reactflow`). High cost, clean result.

**Decision:** Option A for Phase 1 and Phase 2. Option B begins in Phase 3, after test infrastructure (P3-1) is in place. Option C is only justified if the authoring tool becomes a primary product focus and editor UX needs a fundamental overhaul.

**Rationale:** A full rewrite risks behavioral regressions without tests. Incremental migration without tests also risks regressions. The correct order is: stabilize → add tests → modularize. Do not start both A and B simultaneously — it will result in two divergent editor states.

---

## Decision 2 — Condition evaluator: `new Function()` vs. expression parser

**Status: DECIDED — Replace with sandboxed expression evaluator (P2-2)**

**Context:** `evalCondition` in `PlayerView.tsx` (line 80) uses `new Function(conditionStr)` to evaluate choice conditions from YAML story files. This executes arbitrary JavaScript. A malicious `.yaml` file can exfiltrate data or manipulate the DOM. The `try/catch` is not a sandbox.

**Options considered:**
- A) **Keep `new Function()` + blocklist.** Add a validator that rejects conditions containing `window`, `document`, `fetch`, `eval`, etc. Simple to implement, not a true sandbox.
- B) **Replace with a small expression parser.** Implement `src/lib/conditionEvaluator.ts` supporting only the operators actually used: `==`, `!=`, `>=`, `<=`, `>`, `<`, `&&`, `||`, `!`, dotted variable paths, and numeric/boolean literals. Safe by construction.
- C) **Replace conditions with structured YAML objects.** Require `{ left: "inventory.key", op: "==", right: true }` instead of strings. Eliminates the evaluation problem but is a breaking format change.

**Decision:** Option B. Implement a sandboxed expression evaluator.

**Rationale:** All four built-in stories use only the minimal operator set that Option B supports — no breaking change. Option A is not a real fix. Option C is too disruptive to the story format and makes condition authoring much more verbose. The evaluator grammar should be documented in `spec.md` so authors know exactly what is supported.

**Constraint:** All four built-in stories must be audited against the new evaluator before shipping P2-2. The compound condition in `river_oath.yaml` line 79 (`&&` operator) must be explicitly tested.

---

## Decision 3 — Story data ownership during editing

**Status: DECIDED — Callback bridge (Option A) as interim; shared store (Option C) is Phase 3 target**

**Context:** The legacy editor mutates `window.storyData.passages` directly. React state (`story` in `App.tsx`) is populated at load time but never updated during editing. Switching to player mode after editing renders stale data. There is no sync path from editor mutations to React.

**Options considered:**
- A) **Callback bridge.** The editor calls `window.onStoryChange(storyData)` after every mutation. `StoryEditor.tsx` registers this callback and triggers a React state update. Minimal changes to `editor.js`.
- B) **`window.storyData` as source of truth.** React reads from `window.storyData` via polling or a dirty-flag callback. React state is a derived cache. Architecturally wrong — makes testing impossible and React devtools meaningless.
- C) **Shared lightweight store.** Introduce a Zustand or context-based store that both React and `editor.js` read from and write to. Mediates between the two worlds.

**Decision:** Option A for Phase 2 (unblocks player sync without editor rewrite). Option C is the Phase 3 target once editor modularization (Decision 1, Option B) is underway.

**Rationale:** Option B is never the answer — it is an architectural dead end. Option C is the correct long-term architecture but requires editor modularization first. Option A is an explicit transitional measure, not a permanent solution. Every mutation site in `editor.js` must call the callback — this is fragile and should be treated as technical debt.

---

## Decision 4 — CSS architecture going forward

**Status: DECIDED — Tailwind-first for new components; legacy editor styles stay flat**

**Context:** `global.css` is 1,553 lines mixing editor graph styles, player styles, sidebar rules, dark mode overrides, and responsive breakpoints. No scoping. Class names are coupled to legacy editor DOM IDs. New components are being built with Tailwind utilities, creating two parallel style systems.

**Options considered:**
- A) **Tailwind-first for all new components.** Legacy editor styles stay in `global.css` untouched. All new React components use Tailwind utilities exclusively. The CSS file split in P3-2 separates editor-specific graph styles from everything else.
- B) **CSS Modules for new components.** New React components get `.module.css` files. Tailwind used only for one-off utilities. Two style systems coexist (modules + Tailwind).
- C) **Status quo.** Continue extending `global.css`.

**Decision:** Option A. Tailwind-first for all new and modified React components. In Phase 3, split `global.css` into `editor-graph.css` (legacy DOM-ID styles, kept flat) and smaller scoped files. Do not rename or touch editor-specific class names — that would require coordinated changes in `editor.js`.

**Rationale:** The project already uses Tailwind consistently in non-legacy components (`PlayerView.tsx` is entirely Tailwind). Formalizing Tailwind-first eliminates ambiguity. CSS Modules add file count without adding meaningful scoping benefit given the Tailwind foundation already in place. Option C compounds the existing problem.

**Constraint:** Never add new unscoped class names to `global.css` for React components. Editor graph styles (`#nodes-container`, `.node`, `#svg-canvas`, etc.) must stay global because `editor.js` creates those DOM elements dynamically.

---

## Decision 5 — Story file persistence model

**Status: DECIDED — Export-first (Option C), then import/export (Option B) in Phase 2**

**Context:** Stories are currently loaded via `import.meta.glob` from `src/stories/` at build time. The editor can create and modify stories in memory, but there is no way to save user-created stories across sessions. The editor's export function (broken by the missing `js-yaml` dependency until P1-1 is fixed) is the only way to get a story out.

**Options considered:**
- A) **Static loading only.** No user persistence. The editor is a demo, not a real authoring tool.
- B) **Browser File API + localStorage/IndexedDB.** Users can import YAML files, edit them, and the app persists them across sessions. No backend needed.
- C) **Export-only first.** Fix the YAML export (P1-1). Let the file system be the persistence layer — users download YAML, edit, re-import.

**Decision:** Option C immediately (unblocked by P1-1), then Option B in Phase 2.

**Rationale:** Option A makes the editor useless as an authoring tool. Option C is zero additional infrastructure — it just requires P1-1 to be fixed. Option B is the right Phase 2 enhancement: file import is already partially present (the `<input type="file">` in `StoryEditor.tsx` and `registerImportedStoryEntry` in `App.tsx`), it just needs to be connected to the export flow.

**Phase 2 scope:** The story import via `registerImportedStoryEntry` (with `localStorage` persistence) is already implemented in `App.tsx`. The gap is the export side (P1-1) and the UX connecting export → edit → re-import into a coherent workflow.

---

## Decision 6 — Canvas-wrapper layout strategy

**Status: DECIDED — `position: relative` with flex layout (2026-03-22)**

**Context:** `#canvas-wrapper` was `position: absolute; top: 0; left: 0; width: 100%; height: 100%` in `editor-graph.css`. This caused it to fill the entire `#graph-container`, completely covering `#node-inspector` and making the inspector invisible and unclickable. Meanwhile `player.css` had added `#graph-container { display: flex }` to place canvas and inspector side-by-side — but the absolute positioning in `editor-graph.css` took precedence.

**Options considered:**
- A) **`position: relative` with flex.** Remove the absolute positioning overrides. The flex layout in `player.css` (`#graph-container { display: flex }`, `#canvas-wrapper { flex: 1; min-width: 0 }`) governs. Canvas children (`#nodes-container`, `#svg-canvas`) remain `position: absolute` relative to the now-`relative` wrapper.
- B) **Keep absolute, set `z-index` on inspector.** Force `#node-inspector` above canvas-wrapper using z-index. Fragile — stacking context issues when nodes have their own `z-index`.
- C) **Restructure HTML.** Move `#node-inspector` outside `#graph-container`. Requires changing `StoryEditor.tsx` layout significantly.

**Decision:** Option A. Changed `#canvas-wrapper` to `position: relative; overflow: hidden`. Panning and zooming use CSS transforms on `#nodes-container` / `#svg-canvas`, not scroll — so `overflow: hidden` is correct.

**Rationale:** The flex layout was already correct in `player.css`. The only problem was the stale absolute-position override in `editor-graph.css` fighting it. Option B is a hack that breaks under z-index changes in nodes. Option C is unnecessary restructuring. The correct fix is exactly one CSS property change on one element.

---

## Decision 7 — Node selection event: mousedown vs. click

**Status: DECIDED — `mousedown` (2026-03-22)**

**Context:** Node selection (opening the inspector) was wired to the `click` event. Browsers only fire `click` when the pointer does not move between `mousedown` and `mouseup`. Authors frequently lost inspector focus because any tiny cursor movement during a press prevented the click from registering.

**Options considered:**
- A) **`mousedown`.** Select immediately on press. Feels instantaneous. The `click` handler is kept but only calls `e.stopPropagation()` to prevent the canvas background handler from deselecting on release.
- B) **`pointerdown`.** Same semantics as `mousedown` but also works for touch. The existing touch pan logic already uses separate touch event listeners — adding `pointerdown` would overlap and risk double-firing.
- C) **`mouseup`.** Fires after movement, so drag-end would still select. Feels slightly sluggish and selects even after a long drag, which is unexpected.

**Decision:** Option A. `selectNodeByElement()` is called in the node's `mousedown` handler, immediately after the `node-output` connector check.

**Rationale:** `mousedown` is the standard interaction primitive for selection in node-graph editors (Figma, draw.io, etc.). Option B is redundant given the existing touch layer. Option C selects after every drag, which is surprising. The `stopPropagation` in the `click` handler cleanly prevents the canvas background's deselect-on-click from fighting the selection.

---

## Non-decisions (things deliberately left open)

**Backend / server-side rendering:** Not under consideration. This is a static site tool. If backend requirements emerge (e.g., story sharing, user accounts), it warrants a separate architectural document.

**Mobile authoring:** The editor is desktop-only (SVG node-graph requires pointer events and a large viewport). The player is mobile-first and touch-friendly. This split is intentional.

**Collaborative editing:** Not in scope. No conflict resolution, no real-time sync, no CRDTs.

**Story format versioning:** No version field in the YAML format yet. If the format changes in a breaking way, a `version` field and migration logic will need to be added. Deferred until there is an actual breaking change.
