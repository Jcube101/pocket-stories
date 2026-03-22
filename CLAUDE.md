# CLAUDE.md — Pocket Stories

Quick-start orientation for working on this project. For deeper context, read the companion docs:

- `spec.md` — what the app is, who it's for, core behaviors
- `decisions.md` — architectural choices and why (don't relitigate these)
- `known-issues.md` — all bugs found in the initial audit with file + line refs
- `roadmap.md` — phased plan: what to fix and in what order

---

## What This Project Is

**Pocket Stories** is a static, client-side interactive fiction editor and player. No backend, no database. Stories are YAML files. The app deploys to GitHub Pages at `https://Jcube101.github.io/pocket-stories/`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 + `src/styles/{base,editor-graph,player}.css` |
| Animation | Framer Motion 11 |
| Story format | YAML (parsed with the `yaml` package) |
| State | React hooks + `localStorage` |
| Deployment | GitHub Pages via `gh-pages` + GitHub Actions |

---

## Running the Project

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:5173/pocket-stories/
npm run build        # tsc + vite build → ./dist
npm run preview      # preview production build locally
npm run deploy       # build + push to gh-pages branch
npm test             # run Vitest suite (conditionEvaluator + storyValidator)
```

---

## Repository Layout

```
pocket-stories/
├── src/
│   ├── App.tsx                  # Root component — global state, mode switching, story loading
│   ├── main.tsx                 # React entry point
│   ├── components/
│   │   ├── PlayerView.tsx       # Canonical interactive story player
│   │   ├── StoryEditor.tsx      # Editor mode wrapper — dynamically loads legacy/editor.js
│   │   └── StoryList.tsx        # Compact <select> + Load button (renders in app header)
│   ├── legacy/
│   │   └── editor.js            # Visual node-graph editor engine (~3,100 lines, plain JS)
│   ├── lib/
│   │   ├── conditionEvaluator.ts # Safe tokenizer + recursive descent condition parser
│   │   ├── storyValidator.ts    # Validates + normalizes story YAML structure
│   │   └── yamlLoader.ts        # Loads stories via import.meta.glob + parses raw YAML
│   ├── stories/                 # YAML story sources (bundled with the app)
│   └── styles/
│       ├── global.css           # Tailwind directives + @imports + theme overrides
│       ├── base.css             # Resets, body, base element styles
│       ├── editor-graph.css     # Legacy editor: canvas, nodes, SVG
│       └── player.css           # Player UI, CSS custom properties, animations + 2026 UI overrides
├── public/
│   ├── 404.html                 # GitHub Pages SPA redirect (prevents 404 on deep links)
│   └── stories/                 # Static copies of YAML files (served as assets)
├── .github/workflows/
│   └── deploy-gh-pages.yml      # CI: build + deploy on push to master
├── spec.md                      # Product spec (source of truth)
├── decisions.md                 # Architectural decisions log
├── known-issues.md              # Bug tracker from initial audit
├── roadmap.md                   # Phased development plan
├── vite.config.ts               # base: '/pocket-stories/' — required for GitHub Pages
├── tailwind.config.js           # Custom player.* color/spacing/font tokens
├── tsconfig.json
└── package.json
```

---

## App Header Layout (2026 UI)

The header is a flex row:
- **Left:** `h1` title → Editor tab → Player tab
- **Right:** story `<select>` + Load button → theme toggle (Auto/Dark/Light)

`StoryList.tsx` renders the `<select>` + Load button only — it is mounted inside the header, not as a standalone panel.

---

## Two Modes

- **Editor mode** — `<StoryEditor>` dynamically imports `src/legacy/editor.js` (plain JS, SVG node-graph). Connected to React via `window.*` globals.
- **Player mode** — `<PlayerView>` — typewriter text reveal, staggered choices, variable state, history.

---

## Editor Sidebar Sections (top → bottom)

0. **Help & Guide** — compact 10-item TOC; "Read more →" opens full help modal
1. **Variables** — live variable state; remove button is `−` (32×32px icon)
2. **Passages** — passage list
3. **Tools** — 2×2 button grid (Branching Script, Export YAML, Validate, Play Story)
4. **Diagnostics** — live validation panel; auto-updates 1.2s after each save
5. **Canvas Controls** — zoom %, fit, center, reset; view mode toggle (Author/Logic/Playtest)
6. **Split View** — Show Jump/Return edges, Critical Path, Full Downstream toggles
7. **Stories** — story list at bottom (also accessible via header `<select>`)

---

## Known Issues

All Phase 1–7 items are complete. No open issues remain. CSS @import ordering bug (S2) introduced by P3-2 was hotfixed 2026-03-19. Node inspector overlap (U4) fixed 2026-03-22. Inspector click reliability (U7/U8) fixed 2026-03-22. Choice editor in inspector, ID rename UX polish, and undo limit raised to 100 (P7, 2026-03-22).

Full history: `known-issues.md`

---

## State in `App.tsx`

```
stories            — list of all available stories (built-in + imported)
importedStories    — user-imported stories, persisted to localStorage
mode               — 'editor' | 'player'
story              — currently loaded StoryData object (updated by editor via onStoryChange)
activeStoryId      — ID of the loaded story
pendingStoryId     — ID selected but not yet loaded
loading / error    — async load state
status             — status bar message
storyWarnings      — validation warnings from the last story load
showWarnings       — controls visibility of the dismissible warnings banner
```

---

## Window Bridge (React ↔ Legacy Editor)

`App.tsx` and `StoryEditor.tsx` expose functions on `window` for the legacy editor to call back into React:

```ts
window.storyData                          // current story (mutable by editor; synced to React via onStoryChange)
window.activeStoryId
window.validateAndNormalizeStory(raw)     // validate + normalize a YAML story
window.parseStoryEffect(effect)           // parse a variable effect string
window.registerImportedStoryEntry({...})  // register a new imported story
window.setAppMode('editor' | 'player')    // switch modes
window.setStoryStatus(msg, type)
window.loadStoryByPath(path, label)
window.setSidebarCollapsed(bool)
window.toggleSidebarCollapsed()
window.storyParsers                       // { parseCondition, parseEffect } — set by App.tsx for diagnostics
```

---

## Story Format (YAML)

```yaml
title: "My Story"          # required — diagnostics warn if missing
variables:
  inventory:
    key: false             # any primitive
  relationships:
    Guard: 0               # numeric only; += and -= only
  flags:
    door_open: false       # boolean only; = only

passages:
  start:
    text: |
      Opening text.
    choices:
      - text: "Use key"
        target: unlocked
        condition: "inventory.key == true"
        effect: "flags.door_open = true"
  unlocked:
    text: The door opens.
```

Conditions support: `==`, `!=`, `>=`, `<=`, `>`, `<`, `&&`, `||`, `!`. Evaluated by the safe parser in `src/lib/conditionEvaluator.ts` — no `eval` or `new Function`.

**One `effect` per choice only.** YAML does not allow duplicate keys — a second `effect:` key silently overwrites the first.

---

## Key Files

### `src/lib/storyValidator.ts`
- `validateAndNormalizeStory(input)` → `{ ok, data, warnings, errors }` — validates full story structure
- `parseStoryEffect(effect)` → `{ ok, effect }` — parses a single effect string
- Calls `validateConditionSyntax()` on each choice condition; bad syntax becomes a warning

### `src/lib/conditionEvaluator.ts`
- `evalCondition(condition, vars)` → `boolean` — tokenizer + recursive descent parser; no `eval`
- `validateConditionSyntax(condition)` → `string | null` — returns error message or null if valid
- Supports: `==`, `!=`, `>=`, `<=`, `>`, `<`, `&&`, `||`, `!`, numeric/boolean literals, dotted variable paths

### `src/lib/yamlLoader.ts`
- `getAvailableStories()` — discovers YAML files via `import.meta.glob('../stories/*.yaml')`
- `loadStoryById(id)` → `Promise<StoryLoadResult>` — loads + validates by ID
- `loadStoryFromRaw(yaml)` → `Promise<StoryLoadResult>` — parses + validates raw YAML string
- `StoryLoadResult = { data: StoryData; warnings: string[] }`

### `src/components/PlayerView.tsx`
- Typewriter: 58 chars/sec
- Choice stagger: 85ms
- Crossfade: 300ms
- Respects `prefers-reduced-motion`
- `evaluateCondition`: uses `evalCondition()` from `conditionEvaluator.ts` — safe parser
- `applyEffect`: failures collected in `effectErrors` state → shown as dismissible overlay

### `src/legacy/editor.js`
- ~3,100 lines of plain JS. Initialized via `initEditor()`, exported as named ES export.
- `destroyEditor()` exported — removes all document event listeners, resets `editorEventsBound`
- Calls `window.onStoryChange(storyData)` after every mutation and after undo/redo
- `jsyaml.dump()` / `jsyaml.load()` both work — `js-yaml` imported at top of file
- `_preservedSelectedId` — module-level variable; stores selected node ID before `initEditor()` re-runs and restores it after. Required because `saveState()` triggers `window.onStoryChange` → React re-render → `initEditor()`.
- `_autoDiagnosticsTimer` — holds the debounce timer for auto-diagnostics after `saveState()`
- `validateStory({ showModalReport })` — runs all checks; `showModalReport: false` for auto-silent runs
- **Double-click canvas** — creates a node instantly with auto-generated sequential ID and placeholder text; no prompts; immediately opens in inspector
- **Node mousedown** — calls `selectNodeByElement()` immediately so inspector opens on press; `saveState()` only fires if `hasMoved` (threshold 3px), preventing spurious re-renders on plain clicks

### `src/styles/editor-graph.css`
- `#canvas-wrapper { position: relative; overflow: hidden }` — **must stay `position: relative`**. If changed back to `position: absolute`, it will cover `#node-inspector` entirely (see Decision 6 and U4 in `known-issues.md`).
- Panning and zooming use CSS `transform` on `#nodes-container` / `#svg-canvas` — not scroll.

### `src/styles/player.css`
- Contains all 2026 UI overrides (sidebar layout, tools grid, view mode buttons, inspector meta styles, diagnostics styles).
- `#graph-container { display: flex }` — places `#canvas-wrapper` (flex: 1) beside `#node-inspector` (width: 320px).

---

## Diagnostics Checks (as of 2026-03-22)

`validateStory()` in `editor.js` checks:

| Check | Severity |
|---|---|
| Missing `start` passage | error |
| Choice missing text | error |
| Choice missing target | error |
| Dangling reference (target passage doesn't exist) | error |
| Condition syntax error | warning |
| Effect syntax error | warning |
| Unreachable node | warning |
| No-exit node (no choices, not start) | warning |
| Missing story title | warning |
| Empty passage text | warning |
| Self-loop choice (targets own passage) | warning |
| Duplicate choice text within same passage | warning |
| Undeclared variable reference in condition | warning |
| Long passage text (>800 chars) | info |
| Cycle detected | info |

---

## Styling

### Tailwind custom tokens (`tailwind.config.js`)
```
colors:   player.bg, player.surface, player.text, player.muted, player.accent, player.border, player.error
spacing:  playerXs, playerSm, playerMd, playerLg, playerXl
fonts:    playerSans, playerSerif
```

### CSS custom properties (`src/styles/player.css`)
`--player-bg`, `--player-text`, `--player-accent`, etc. Dark mode via `@media (prefers-color-scheme: dark)`.

**Tailwind-first rule:** New React components should use Tailwind utilities, not add to CSS files. See `decisions.md` Decision 4. Editor graph styles (`#nodes-container`, `.node`, `#svg-canvas`) must stay in `editor-graph.css`.

---

## localStorage Keys

| Key | Contents |
|---|---|
| `pocket_stories_imported_entries_v1` | JSON array of `{ id, label, raw, source }` |
| `pocketstories_layout_<hash>` | Canvas node positions for editor |
| `pocketstories_layout_<hash>_ui` | Editor UI state (collapsed nodes, view mode) |
| `pocket_stories_theme_v1` | Theme preference: `'auto'` \| `'dark'` \| `'light'` |

---

## CI/CD

- Trigger: push to `master`
- Steps: Node 22 → `npm install` → `npm run build` → deploy `./dist` to GitHub Pages
- Token: `GITHUB_TOKEN`
- Env: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` (silences GH Actions Node.js 20 deprecation warnings)

---

## Development Branch Convention

Branches follow `claude/<task-slug>-<session-id>`. Always push to the branch specified. Never push to `master` directly.

---

## Important Gotchas

1. **`StoryPlayer.tsx` was deleted** (dead code, P1-4). `PlayerView.tsx` is the canonical player component.

2. **`editor.js` is plain JS**, not TypeScript. Don't convert unless explicitly asked. It's imported via dynamic `import()` from `StoryEditor.tsx`.

3. **Vite base path `/pocket-stories/`** is required for GitHub Pages. Do not remove it.

4. **Adding a built-in story** means adding a `.yaml` file to `src/stories/`. The `import.meta.glob` in `yamlLoader.ts` picks it up automatically.

5. **The window bridge is fragile.** Effects that register `window.registerImportedStoryEntry` have `stories` in their dependency array on purpose — this keeps the registered function's closure up to date.

6. **Editor edits now sync to player mode** via `window.onStoryChange` → `setStory(structuredClone(updated))` in `StoryEditor.tsx`. No reload needed.

7. **Do NOT set `toggleBtn.onclick` in `editor.js`.** The `#toggle-sidebar` button is managed by React's `onClick` handler in `StoryEditor.tsx`. Setting `onclick` directly causes a double-fire that cancels itself out (both handlers call `setIsSidebarCollapsed` → net no change).

8. **Prior Codex commits** are identifiable by branch names like `codex/…`. Recent ones introduced Tailwind, Framer Motion, `PlayerView`, and animated passage reveal.

9. **Dark mode toggle** — `App.tsx` cycles `theme` state (auto/dark/light), writes `data-theme` to `<html>`. CSS handles the rest via `html[data-theme="dark"]` / `html[data-theme="light"]` overrides in `global.css`. Persisted to `localStorage` key `pocket_stories_theme_v1`.

10. **`#canvas-wrapper` must stay `position: relative`** — changing it back to `position: absolute` will make the node inspector invisible and unclickable (U4). The panning/zooming is done via CSS transform on `#nodes-container`, not via scroll. See `decisions.md` Decision 6.

11. **`window.storyParsers`** must be set by `App.tsx` before the editor is initialized. Without it, all condition/effect syntax diagnostics fall through to "parser unavailable". It is set in a `useEffect` that runs after mount.

12. **`_preservedSelectedId` pattern** — `selectNodeByElement()` stores the node ID in this module-level variable; `initEditor()` restores the selection at the end. Never remove this without also removing the `saveState()` → `onStoryChange` → re-render → `initEditor()` chain.

13. **Node selection is in `mousedown`, not `click`** — `click` does not fire if the cursor moves between press and release. `selectNodeByElement()` is called in the node's `mousedown` handler. The `click` handler only calls `e.stopPropagation()` to prevent the canvas background from deselecting. Do not move selection back to `click`.

14. **`saveState()` only fires on actual node moves** — The node `onMouseUp` handler checks `hasMoved` (movement > 3px) before calling `saveState()`. This prevents every node click from pushing an undo entry and triggering a React re-render via `onStoryChange`.

15. **Help modal is a React component in `StoryEditor.tsx`** — `HelpModal` is defined at the top of the file (before the `StoryEditor` component). `showHelp` state is in `StoryEditor`. The `HelpModal` renders as a fixed full-screen overlay. It does not use a portal — it renders inside the editor's DOM tree, which is fine since it's `position: fixed`.
