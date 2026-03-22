# Pocket Stories

A browser-only interactive fiction editor and player. Create branching narrative stories in YAML, play them with animated transitions, and edit them in a visual node-graph editor. No backend, no accounts — everything runs in the browser and deploys as a static site.

**Live app:** https://Jcube101.github.io/pocket-stories/

---

## Quickstart

```bash
npm install
npm run dev       # http://localhost:5173/pocket-stories/
npm run build     # production build → ./dist
npm run deploy    # build + deploy to GitHub Pages
```

> Tests run with Vitest. `npm test` runs the suite.

---

## Two modes

**Editor** — Visual SVG node-graph editor. Each passage is a node. Connect them with choices. Three view modes (Author / Logic / Playtest), pan/zoom canvas, node inspector with full choice breakdown, live diagnostics, and YAML export.

**Player** — Animated story reader with typewriter text reveal, staggered choice buttons, and variable state tracking (inventory, relationships, flags).

---

## Story format

Stories are YAML files with passages, choices, conditions, and effects:

```yaml
title: "My Story"

variables:
  inventory:
    key: false
  relationships:
    Guard: 0         # numeric; use += or -=
  flags:
    door_open: false # boolean; use = true/false

passages:
  start:
    text: |
      You stand before a locked door.
    choices:
      - text: "Use the key"
        target: open
        condition: "inventory.key == true"
        effect: "flags.door_open = true"
      - text: "Walk away"
        target: end

  open:
    text: The door swings open.

  end:
    text: You leave.
```

Conditions support `==`, `!=`, `>=`, `<=`, `>`, `<`, `&&`, `||`, `!`.

Effects: `inventory.x = value`, `relationships.x += N`, `flags.x = true/false`.

---

## Project docs

| File | Contents |
|---|---|
| `spec.md` | What the app is, who it's for, all core behaviors |
| `decisions.md` | Architectural choices and rationale (read before making structural changes) |
| `known-issues.md` | Bugs found in the initial audit — read before touching the editor or player |
| `roadmap.md` | Phased plan for stabilization and new features |
| `CLAUDE.md` | Quick-start for AI coding assistants |

---

## Repository layout

```
src/
  App.tsx              — Root component, all global state
  components/
    PlayerView.tsx     — Story player (canonical)
    StoryEditor.tsx    — React shell for the legacy editor
    StoryList.tsx      — Story selector
  legacy/
    editor.js          — Node-graph editor engine (~3,100 lines, plain JS)
  lib/
    storyValidator.ts  — Validates + normalizes YAML story structure
    yamlLoader.ts      — Loads stories via import.meta.glob
  stories/             — Built-in YAML stories (loaded at build time)
  styles/
    global.css         — Tailwind directives + @imports + theme overrides
    base.css           — Resets and base element styles
    editor-graph.css   — Legacy editor canvas and node styles
    player.css         — Player UI, CSS custom properties, animations
public/
  stories/             — Static copies of built-in stories
```

---

## Adding a story

Drop a `.yaml` file into `src/stories/`. The app picks it up automatically via `import.meta.glob`. Optionally copy it to `public/stories/` for direct URL access.

---

## Known issues

All known issues from the initial audit are resolved. See `known-issues.md` for the full history.

---

## Tech stack

React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Framer Motion 11 · YAML · GitHub Pages
