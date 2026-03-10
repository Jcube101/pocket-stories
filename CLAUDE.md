# CLAUDE.md — Pocket Stories

This file contains everything needed to orient yourself quickly when working on this project.

---

## What This Project Is

**Pocket Stories** is a static, client-side interactive fiction editor and player. No backend, no database. Stories are YAML files that define branching narratives with variable state (inventory, relationships, flags), conditions, and effects.

The app is deployed to GitHub Pages at `https://Jcube101.github.io/pocket-stories/`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 + custom CSS (`src/styles/global.css`) |
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

> Note: there are **no tests** in this project. No Vitest, no Jest, nothing configured. `npm test` will fail.

---

## Repository Layout

```
pocket-stories/
├── src/
│   ├── App.tsx                  # Root component — global state, mode switching, story loading
│   ├── main.tsx                 # React entry point
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── PlayerView.tsx       # Interactive story player with animations (268 lines)
│   │   ├── StoryEditor.tsx      # Editor mode wrapper — dynamically loads legacy/editor.js
│   │   ├── StoryList.tsx        # Story selector sidebar (32 lines)
│   │   └── StoryPlayer.tsx      # Thin wrapper around PlayerView (12 lines)
│   ├── legacy/
│   │   └── editor.js            # Main visual node-graph editor engine (2,967 lines, plain JS)
│   ├── lib/
│   │   ├── storyValidator.ts    # Validates + normalizes story YAML structure
│   │   └── yamlLoader.ts        # Loads stories via import.meta.glob + parses raw YAML
│   ├── stories/                 # YAML story sources (bundled with the app)
│   │   ├── forest_adventure.yaml
│   │   ├── city_noir.yaml
│   │   ├── river_oath.yaml
│   │   └── space_outpost.yaml
│   └── styles/
│       └── global.css           # CSS custom properties, theming, dark mode
├── public/
│   └── stories/                 # Static copies of YAML files (served as assets)
├── .github/workflows/
│   └── deploy-gh-pages.yml      # CI: build + deploy on push to master
├── index.html
├── vite.config.ts               # base: '/pocket-stories/'
├── tailwind.config.js           # Custom player.* color/spacing/font tokens
├── tsconfig.json
└── package.json
```

---

## Application Architecture

### Two Modes

The app has two top-level modes toggled by a tab in the header:

- **Editor mode** — renders `<StoryEditor>`, which dynamically imports and mounts `src/legacy/editor.js` (a self-contained SVG node-graph editor written in plain JavaScript).
- **Player mode** — renders `<PlayerView>`, a React component with typewriter text reveal, staggered choice animations, variable state management, and history tracking.

### State in `App.tsx`

```
stories            — list of all available stories (built-in + imported)
importedStories    — user-imported stories, persisted to localStorage
mode               — 'editor' | 'player'
story              — currently loaded StoryData object
activeStoryId      — ID of the loaded story
pendingStoryId     — ID selected but not yet loaded
loading / error    — async load state
status             — status bar message
```

### Window Bridge (App ↔ Legacy Editor)

`App.tsx` exposes several functions on `window` so the legacy editor can call back into React:

```ts
window.validateAndNormalizeStory(raw)    // validate + normalize a YAML story
window.parseStoryEffect(effect)          // parse a variable effect string
window.registerImportedStoryEntry({id, label, raw, source})  // register a new imported story
window.setAppMode('editor' | 'player')   // switch modes
window.setSidebarCollapsed(bool)         // collapse the sidebar
window.toggleSidebarCollapsed()
```

---

## Story Format (YAML)

```yaml
variables:
  inventory:
    badge: false        # any primitive value
    key: false
  relationships:
    Guard: 0            # numeric only
  flags:
    door_open: false    # boolean only

passages:
  start:
    text: |
      Opening narration here.
    choices:
      - text: "Do something"
        target: next_passage
        effect: "inventory.badge = true"
      - text: "Do something else"
        target: another_passage
        condition: "inventory.badge == true"

  next_passage:
    text: |
      What happens next.
    choices:
      - text: "Continue"
        target: ending

  ending:
    text: |
      The end.
```

### Effect Syntax (validated by `storyValidator.ts`)

- `inventory.x = value` — set any primitive
- `relationships.x += N` or `-= N` — numeric adjustments only
- `flags.x = true` or `= false` — boolean only

### Conditions

JavaScript expressions evaluated at runtime:
- `inventory.badge == true`
- `relationships.Guard > 2`
- `flags.door_open`

### Security Notes in Validator

The validator blocks these variable name paths: `__proto__`, `prototype`, `constructor`.

---

## Key Files to Know

### `src/lib/storyValidator.ts`

- `validateAndNormalizeStory(raw: string)` → `{ ok, data, warnings, errors }`
- Normalizes variable categories (inventory/relationships/flags)
- Returns a typed `StoryData` object on success

### `src/lib/yamlLoader.ts`

- `getAvailableStories()` — discovers YAML files via `import.meta.glob('../stories/*.yaml')`
- `loadStoryById(id: string)` — loads + validates a story by ID
- `loadStoryFromRaw(yaml: string)` — parses + validates raw YAML

### `src/components/PlayerView.tsx`

Key behaviours:
- Typewriter reveal: 58 characters/sec
- Choice stagger: 85ms between buttons
- Crossfade transition: 300ms
- Respects `prefers-reduced-motion`
- Variable state stored in React state (`inventory`, `relationships`, `flags`)
- History array tracked for breadcrumbs/restart

### `src/legacy/editor.js`

2,967 lines of plain JavaScript. Self-initialising. Provides:
- SVG canvas node-graph for story structure
- Three view modes: Author, Logic, Playtest
- Diagnostics, undo/redo, cycle detection, unreachable node detection
- Export, import, search, node inspector
- Calls `window.validateAndNormalizeStory` and `window.registerImportedStoryEntry`

---

## Styling System

### Tailwind Custom Tokens (`tailwind.config.js`)

```
colors:     player.bg, player.surface, player.text, player.muted, player.accent, player.accent-hover, player.border, player.error
spacing:    playerXs, playerSm, playerMd, playerLg, playerXl
fonts:      playerSans, playerSerif
radius:     player
shadow:     player
```

### CSS Custom Properties (`src/styles/global.css`)

Variables like `--player-bg`, `--player-text`, `--player-accent`, etc. are defined here, with dark mode overrides via `@media (prefers-color-scheme: dark)`.

---

## localStorage

| Key | Contents |
|---|---|
| `pocket_stories_imported_entries_v1` | JSON array of `{ id, label, raw, source }` user-imported stories |

---

## CI/CD

- **File:** `.github/workflows/deploy-gh-pages.yml`
- **Trigger:** push to `master`
- **Steps:** checkout → Node 20 → `npm install` → `npm run build` → deploy `./dist` to GitHub Pages
- **Token:** uses `GITHUB_TOKEN`

---

## Development Branch Convention

Branches follow the pattern `claude/<task-slug>-<session-id>`. Always push to the branch specified for the task. Never push to `master` directly.

---

## Gotchas & Notes from Prior Work

1. **No tests exist.** Don't try to run them. If you add tests, set up Vitest (it's already a Vite project — natural fit).

2. **`src/legacy/editor.js` is plain JavaScript**, not TypeScript. `StoryEditor.tsx` imports it dynamically with `import()`. Do not convert it to TS unless specifically asked.

3. **Vite base path is `/pocket-stories/`** — required for GitHub Pages. Don't remove it.

4. **`import.meta.glob` in `yamlLoader.ts`** only picks up files in `src/stories/`. Adding a new story means adding a `.yaml` file there (and optionally to `public/stories/` for static serving).

5. **Window bridge is fragile.** The functions registered on `window` in `App.tsx` are React-effect-bound with cleanup. Be careful when refactoring those effects — effects that register `registerImportedStoryEntry` have `stories` in their dependency array on purpose.

6. **Framer Motion `AnimatePresence`** is used in `PlayerView.tsx` for passage transitions. If you add new animated sections, follow the existing `key`-based exit/enter pattern.

7. **Prior Codex work** introduced Tailwind, Framer Motion, `PlayerView`, and the animated passage reveal. All Codex-generated commits are identifiable by branch names like `codex/…`.

8. **Dark mode** is CSS-only via `@media (prefers-color-scheme: dark)`. There is no manual theme toggle in the UI.
