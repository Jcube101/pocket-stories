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
│   │   ├── PlayerView.tsx       # Canonical interactive story player (268 lines)
│   │   ├── StoryEditor.tsx      # Editor mode wrapper — dynamically loads legacy/editor.js
│   │   └── StoryList.tsx        # Story selector sidebar (32 lines)
│   │   # NOTE: StoryPlayer.tsx is dead code — never rendered. See known-issues.md B5.
│   ├── legacy/
│   │   └── editor.js            # Visual node-graph editor engine (2,967 lines, plain JS)
│   ├── lib/
│   │   ├── storyValidator.ts    # Validates + normalizes story YAML structure
│   │   └── yamlLoader.ts        # Loads stories via import.meta.glob + parses raw YAML
│   ├── stories/                 # YAML story sources (bundled with the app)
│   └── styles/
│       └── global.css           # All styles — monolithic, see known-issues.md S1
├── public/
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

## Known Bugs You Will Hit (read before touching anything)

These are live bugs from the initial audit. They will affect you if you work in the relevant areas:

| ID | Where | What breaks |
|---|---|---|
| B1 | `editor.js:1919` | "Export Story" crashes — `jsyaml` not imported (roadmap P1-1) |
| B2 | `editor.js`, `StoryEditor.tsx` | Canvas goes dead after story switch; event listener memory leak (P1-2) |
| B3 | `StoryEditor.tsx:40` | `initEditor()` fires on every parent render due to unstable dep (P1-3) |
| B4 | `editor.js:780` | Undo/redo breaks after 20 actions (P1-6) |
| B5 | `StoryPlayer.tsx` | Entire file is dead code — never rendered (P1-4) |
| B9 | `PlayerView.tsx:80` | Conditions evaluated via `new Function()` — security gap (P2-2) |
| B10 | `App.tsx`, `editor.js` | Editor edits don't appear in player mode — state not synced (P2-3) |

Full list: `known-issues.md`

---

## State in `App.tsx`

```
stories            — list of all available stories (built-in + imported)
importedStories    — user-imported stories, persisted to localStorage
mode               — 'editor' | 'player'
story              — currently loaded StoryData object (NOT updated by editor edits — see B10)
activeStoryId      — ID of the loaded story
pendingStoryId     — ID selected but not yet loaded
loading / error    — async load state
status             — status bar message
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

Conditions support: `==`, `!=`, `>=`, `<=`, `>`, `<`, `&&`, `||`, `!`. They are currently evaluated via `new Function()` — a known security issue (B9, roadmap P2-2).

---

## Key Files

### `src/lib/storyValidator.ts`
- `validateAndNormalizeStory(input)` → `{ ok, data, warnings, errors }` — validates full story structure
- `parseStoryEffect(effect)` → `{ ok, effect }` — parses a single effect string
- **Warning:** `yamlLoader.ts` currently discards `warnings` — see B7

### `src/lib/yamlLoader.ts`
- `getAvailableStories()` — discovers YAML files via `import.meta.glob('../stories/*.yaml')`
- `loadStoryById(id)` — loads + validates by ID
- `loadStoryFromRaw(yaml)` — parses + validates raw YAML string

### `src/components/PlayerView.tsx`
- Typewriter: 58 chars/sec
- Choice stagger: 85ms
- Crossfade: 300ms
- Respects `prefers-reduced-motion`
- `evalCondition`: uses `new Function()` — see B9
- `applyEffect`: silently ignores failures — see B8

### `src/legacy/editor.js`
- 2,967 lines of plain JS. Initialized via `initEditor()`, exported as named ES export.
- Has **no cleanup function** (yet) — see B2. Adding `destroyEditor()` is roadmap P1-2.
- Calls `window.validateAndNormalizeStory`, `window.registerImportedStoryEntry`, `window.setStoryStatus`, etc.
- `jsyaml.dump()` / `jsyaml.load()` calls are broken — see B1.

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

1. **`StoryPlayer.tsx` is dead code.** Do not use it. `PlayerView.tsx` is the canonical player component.

2. **`editor.js` is plain JS**, not TypeScript. Don't convert unless explicitly asked. It's imported via dynamic `import()` from `StoryEditor.tsx`.

3. **Vite base path `/pocket-stories/`** is required for GitHub Pages. Do not remove it.

4. **Adding a built-in story** means adding a `.yaml` file to `src/stories/`. The `import.meta.glob` in `yamlLoader.ts` picks it up automatically.

5. **The window bridge is fragile.** Effects that register `window.registerImportedStoryEntry` have `stories` in their dependency array on purpose — this keeps the registered function's closure up to date.

6. **Editor edits are not reflected in player mode** until the story is re-loaded (B10). This is a known architectural gap, not a bug to work around.

7. **Prior Codex commits** are identifiable by branch names like `codex/…`. Recent ones introduced Tailwind, Framer Motion, `PlayerView`, and animated passage reveal.

8. **Dark mode is CSS-only** (`@media (prefers-color-scheme: dark)`). No in-app toggle yet (roadmap P3-3).
