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
| Styling | Tailwind CSS 3 + `src/styles/global.css` (1,553 lines) |
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
```

**There are no tests.** `npm test` will fail. See roadmap P3-1 for the plan to add Vitest.

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
│   │   └── StoryList.tsx        # Story selector sidebar
│   ├── legacy/
│   │   └── editor.js            # Visual node-graph editor engine (~3,000 lines, plain JS)
│   ├── lib/
│   │   ├── conditionEvaluator.ts # Safe tokenizer + recursive descent condition parser
│   │   ├── storyValidator.ts    # Validates + normalizes story YAML structure
│   │   └── yamlLoader.ts        # Loads stories via import.meta.glob + parses raw YAML
│   ├── stories/                 # YAML story sources (bundled with the app)
│   └── styles/
│       └── global.css           # All styles — monolithic, see known-issues.md S1
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

## Two Modes

- **Editor mode** — `<StoryEditor>` dynamically imports `src/legacy/editor.js` (plain JS, SVG node-graph). Connected to React via `window.*` globals.
- **Player mode** — `<PlayerView>` — typewriter text reveal, staggered choices, variable state, history.

---

## Known Issues

Phase 1 and Phase 2 bugs are all fixed. Remaining open issues are Phase 3 polish items:

| ID | Where | What |
|---|---|---|
| C1 | — | No test infrastructure (`npm test` fails) — roadmap P3-1 |
| C3 | `vite.config.ts:5` | Hardcoded base path breaks on fork/rename — roadmap P3-6 |
| C4 | `tsconfig.json` | Deprecated `"Bundler"` casing, harmless — roadmap P3-7 |
| S1 | `src/styles/global.css` | Monolithic 1,553-line CSS — roadmap P3-2 |
| Y1 | `src/stories/*.yaml` | Unused variables in built-in stories — roadmap P3-5 |

Full list with history: `known-issues.md`

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
window.storyData                          // current story (mutable by editor — see B10)
window.activeStoryId
window.validateAndNormalizeStory(raw)     // validate + normalize a YAML story
window.parseStoryEffect(effect)           // parse a variable effect string
window.registerImportedStoryEntry({...})  // register a new imported story
window.setAppMode('editor' | 'player')    // switch modes
window.setStoryStatus(msg, type)
window.loadStoryByPath(path, label)
window.setSidebarCollapsed(bool)
window.toggleSidebarCollapsed()
```

---

## Story Format (YAML)

```yaml
title: "My Story"          # optional but should be set
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
- ~3,000 lines of plain JS. Initialized via `initEditor()`, exported as named ES export.
- `destroyEditor()` exported — removes all document event listeners, resets `editorEventsBound`
- Calls `window.onStoryChange(storyData)` after every mutation and after undo/redo
- `jsyaml.dump()` / `jsyaml.load()` both work — `js-yaml` imported at top of file

---

## Styling

### Tailwind custom tokens (`tailwind.config.js`)
```
colors:   player.bg, player.surface, player.text, player.muted, player.accent, player.border, player.error
spacing:  playerXs, playerSm, playerMd, playerLg, playerXl
fonts:    playerSans, playerSerif
```

### CSS custom properties (`src/styles/global.css`)
`--player-bg`, `--player-text`, `--player-accent`, etc. Dark mode via `@media (prefers-color-scheme: dark)`.

**Tailwind-first rule:** New React components should use Tailwind utilities, not add to `global.css`. See `decisions.md` Decision 4. Editor graph styles (`#nodes-container`, `.node`, `#svg-canvas`) must stay global.

---

## localStorage Keys

| Key | Contents |
|---|---|
| `pocket_stories_imported_entries_v1` | JSON array of `{ id, label, raw, source }` |
| `pocketstories_layout_<hash>` | Canvas node positions for editor |
| `pocketstories_layout_<hash>_ui` | Editor UI state (collapsed nodes, view mode) |

---

## CI/CD

- Trigger: push to `master`
- Steps: Node 20 → `npm install` → `npm run build` → deploy `./dist` to GitHub Pages
- Token: `GITHUB_TOKEN`

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

9. **Dark mode is CSS-only** (`@media (prefers-color-scheme: dark)`). No in-app toggle yet (roadmap P3-3).
