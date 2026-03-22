# Pocket Stories — Product Specification

This document is the source of truth for what Pocket Stories is, who it is for, and how its core behaviors are defined. Future Claude Code sessions and contributors should start here before making product decisions.

---

## What It Is

Pocket Stories is a self-contained, browser-only interactive fiction tool. It has two modes:

- **Editor** — a visual node-graph editor for authoring branching narrative stories
- **Player** — an animated, accessible reader for playing those stories

There is no backend, no database, no user accounts, and no server. The entire application is a static site deployed to GitHub Pages. Stories are YAML files. State is held in memory and `localStorage`.

---

## Who It Is For

**Primary audience: indie authors and hobbyists** who want to create small branching narrative games or interactive stories without writing code. They work alone or in small teams. They are comfortable with simple YAML syntax.

**Secondary audience: readers** who want to play stories created with the tool. They expect a clean, readable interface with smooth transitions and no distractions.

The tool is not intended for large commercial narrative projects. It is a focused, lightweight authoring tool — think "Twine for people who prefer structured data formats."

---

## Core Behaviors

### Story Loading

- Stories are YAML files in `src/stories/`. They are bundled with the app at build time via `import.meta.glob`.
- Users can also import their own stories via the editor's file upload (`.yaml`, `.yml`, `.json`).
- Imported stories are persisted to `localStorage` under the key `pocket_stories_imported_entries_v1` as a JSON array of `{ id, label, raw, source }`.
- Built-in stories are available immediately on load. The default story is `forest_adventure`.

### Story Format

A story is a YAML document with this top-level shape:

```yaml
title: Optional human-readable name
metadata:               # optional
  author: ...
  description: ...

variables:
  inventory:            # any primitive value
    key: false
  relationships:        # numeric only; must use += or -=
    Guard: 0
  flags:                # boolean only; must use =
    door_open: false

passages:
  start:
    text: |
      Passage text here.
    choices:
      - text: "Choice label"
        target: next_passage_id
        condition: "inventory.key == true"   # optional; JavaScript expression
        effect: "flags.door_open = true"     # optional; structured effect syntax
```

#### Effect Syntax Rules

| Variable type | Allowed operators | Value constraint |
|---|---|---|
| `inventory.*` | `=` only | Any primitive (string, number, boolean) |
| `relationships.*` | `+=` and `-=` only | Numeric |
| `flags.*` | `=` only | `true` or `false` |

#### Condition Syntax

Conditions are evaluated against the current variable state. The supported operators are: `==`, `!=`, `>=`, `<=`, `>`, `<`, `&&`, `||`, `!`. Conditions can reference dotted paths: `inventory.key`, `relationships.Guard`, `flags.door_open`.

Conditions are evaluated by the safe sandboxed parser in `src/lib/conditionEvaluator.ts` — no `eval` or `new Function` (B9 fixed, P2-2).

#### Security Constraints

The validator blocks these variable name path segments to prevent prototype pollution: `__proto__`, `prototype`, `constructor`.

### Validation

`src/lib/storyValidator.ts` validates and normalizes raw parsed YAML. It returns `{ ok, data, warnings, errors }`.

- **Errors** prevent the story from loading (e.g., missing `passages`, invalid passage structure)
- **Warnings** indicate issues that don't block loading (e.g., unused variables)
- Warnings are returned as `StoryLoadResult.warnings` and displayed as a dismissible banner in `App.tsx` (B7 fixed, P2-1)

### Player Behavior

- The player starts at the `start` passage if it exists, otherwise the first passage in the passages map.
- Text is revealed character-by-character at 58 characters/second (typewriter effect).
- After text reveal completes, choices appear one at a time with 85ms stagger.
- Transitions between passages use a 300ms crossfade.
- All animations respect `prefers-reduced-motion`.
- Choices with `condition` fields are evaluated against the current variable state; choices whose conditions evaluate to `false` are hidden.
- When a choice is selected, its `effect` (if any) is applied to the variable state before navigating.
- The History panel shows the sequence of choices made. The Restart button resets all state to the story's initial variable values.

### Editor Behavior

- The editor renders a visual node-graph using SVG, where each node represents a passage.
- Node types are inferred from passage structure: start, dialogue, choice, condition, merge, ending.
- Three view modes: **Author** (default), **Logic** (shows all edge conditions), **Playtest** (highlights active paths).
- Canvas interaction: left-click drag on empty canvas background pans; scroll wheel zooms; two-finger pinch-zoom on touch; one-finger drag pans on touch.
- **Creating a node:** double-click on any empty canvas area to instantly place a new passage with an auto-generated ID and placeholder text. The node opens in the inspector immediately.
- The **node inspector** panel appears to the right of the canvas. Click any node (or press it — selection fires on `mousedown`) to open it. Shows passage ID, type, text editor, and a full per-choice breakdown: choice text, target (clickable jump link), condition (amber tag), effect (purple tag), plus status badges and char count.
- **Split View** section: toggle Show Jump/Return edges, Critical Path highlight, Full Downstream highlight.
- **Diagnostics**: validates story structure, detects cycles, flags unreachable and no-exit nodes. Also checks: missing title, empty passage text, long passages (>800 chars), self-loop choices, duplicate choice text, undeclared variable references. Auto-runs silently 1.2s after any edit.
- Undo/redo (max 20 states in memory).
- Export: downloads current story state as a YAML file.
- Import: accepts `.yaml`, `.yml`, `.json` files via file input.
- Canvas layout is persisted to `localStorage` by story identity hash.

### Mode Switching

The app header has **Editor / Player tabs on the left**. The **story selector** (compact `<select>` + Load button) and **theme toggle** are on the right. Switching to Player renders the current loaded story. Editor mutations are synced to React state via `window.onStoryChange` — switching to player mode immediately reflects edits without a reload (B10 fixed, P2-3).

### Global Window Bridge

The React app exposes several functions on `window` so the legacy editor can call back into React:

| Function | Set by | Purpose |
|---|---|---|
| `window.storyData` | `StoryEditor.tsx` | Current story data (mutable) |
| `window.activeStoryId` | `StoryEditor.tsx` | Current story ID |
| `window.setStoryStatus(msg, type)` | `StoryEditor.tsx` | Update the status bar |
| `window.loadStoryByPath(path, label)` | `StoryEditor.tsx` | Load a story by path |
| `window.validateAndNormalizeStory(raw)` | `App.tsx` | Validate + normalize a YAML story |
| `window.parseStoryEffect(effect)` | `App.tsx` | Parse a variable effect string |
| `window.registerImportedStoryEntry({...})` | `App.tsx` | Register an imported story |
| `window.setAppMode('editor'\|'player')` | `App.tsx` | Switch modes |
| `window.setSidebarCollapsed(bool)` | `StoryEditor.tsx` | Collapse/expand the sidebar |
| `window.toggleSidebarCollapsed()` | `StoryEditor.tsx` | Toggle sidebar state |

---

## File Structure

```
src/
  App.tsx                 — Root component. Manages all global state.
  main.tsx                — React entry point.
  components/
    PlayerView.tsx        — Interactive story player (canonical player component).
    StoryEditor.tsx       — React shell for the legacy editor.
    StoryList.tsx         — Story selector UI.
  legacy/
    editor.js             — Visual node-graph editor engine (2,967 lines, plain JS).
  lib/
    storyValidator.ts     — Validates + normalizes YAML story structure.
    yamlLoader.ts         — Loads stories via import.meta.glob or raw YAML string.
  stories/                — Built-in YAML story files.
  styles/
    global.css            — Tailwind directives + @imports + theme overrides (split in P3-2)
    base.css              — Resets and base element styles
    editor-graph.css      — Legacy editor canvas and node styles
    player.css            — Player UI, CSS custom properties, animations
public/
  stories/                — Static copies of built-in stories for direct serving.
```

---

## Styling System

Tailwind CSS 3 with custom design tokens:

| Token category | Examples |
|---|---|
| Colors | `player.bg`, `player.surface`, `player.text`, `player.accent`, `player.border`, `player.error` |
| Spacing | `playerXs`, `playerSm`, `playerMd`, `playerLg`, `playerXl` |
| Typography | `playerSans`, `playerSerif` |
| Other | `rounded-player`, `shadow-player` |

Tokens are defined as CSS custom properties in `player.css` and referenced by Tailwind via `tailwind.config.js`. Dark mode is handled via `@media (prefers-color-scheme: dark)` with manual override via `html[data-theme]` (see P3-3).

---

## Deployment

- Static site, deployed to GitHub Pages at `https://Jcube101.github.io/pocket-stories/`
- CI: GitHub Actions (`deploy-gh-pages.yml`) triggers on push to `master`
- Build: `tsc && vite build` → output in `./dist`
- Vite base path: `/pocket-stories/` (configurable via `VITE_BASE_PATH` env var; see `.env.example`)

---

## What This App Is Not

- Not a multiplayer or collaborative tool
- Not a backend-powered system (no API, no persistence beyond localStorage)
- Not a production game engine (no audio, no images, no custom scripting)
- Not a general-purpose CMS or wiki
- Not intended to support stories larger than can be comfortably edited in a browser session
