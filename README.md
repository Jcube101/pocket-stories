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

> There are no tests yet. `npm test` will fail. See `roadmap.md` for plans to add Vitest.

---

## Two modes

**Editor** — Visual SVG node-graph editor. Each passage is a node. Connect them with choices. Export your story as YAML.

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
    editor.js          — Node-graph editor engine (2,967 lines, plain JS)
  lib/
    storyValidator.ts  — Validates + normalizes YAML story structure
    yamlLoader.ts      — Loads stories via import.meta.glob
  stories/             — Built-in YAML stories (loaded at build time)
  styles/
    global.css         — All styles (Tailwind + custom CSS)
public/
  stories/             — Static copies of built-in stories
```

---

## Adding a story

Drop a `.yaml` file into `src/stories/`. The app picks it up automatically via `import.meta.glob`. Optionally copy it to `public/stories/` for direct URL access.

---

## Known issues

The codebase has several live bugs from a prior migration. Read `known-issues.md` before working on the editor or player. The most impactful:

- **Editor export crashes** — `js-yaml` is not installed (roadmap P1-1)
- **Editor canvas goes dead after story switch** — event listener cleanup is missing (P1-2)
- **Editor edits don't appear in player mode** — state sync not implemented (P2-3)

---

## Tech stack

React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Framer Motion 11 · YAML · GitHub Pages
