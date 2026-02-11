# Pocket Stories

Pocket Stories is a lightweight, fully static Choose-Your-Own-Adventure engine with a visual graph editor and built-in player. It runs with plain HTML/CSS/JavaScript and works well on GitHub Pages.

## What’s New

- Right-click any node and choose **“Test from here”** to jump straight into Player Mode at that passage.
- Validation now highlights:
  - cycles/loops (amber)
  - unreachable/orphaned passages (red)
- Sidebar now includes a **Passage Search** panel to filter/focus nodes quickly.
- Added **demo story hub**: [`demo.html`](demo.html)

## Quickstart

1. Open [`index.html`](index.html) in a browser.
2. Edit your story in **Editor Mode**:
   - Double-click empty canvas to add a new passage.
   - Drag from a node output dot to connect passages.
   - Right-click a connection to edit choice text / condition / effect.
   - Right-click a node to test from that node.
3. Click **Validate Story** to find broken links, unreachable nodes, and cycles.
4. Click **Play Story** to test normally from `start`.
5. Export with **Export story.yaml**.

## Variable Syntax (Conditions and Effects)

Pocket Stories supports three variable groups:

- `inventory` (bool/string/number values)
- `relationships` (usually numeric scores)
- `flags` (booleans)

### Condition examples

- `inventory.key == true`
- `relationships.Alice >= 3`
- `flags.opened_gate == false`

### Effect examples

- `inventory.key = true`
- `relationships.Alice += 2`
- `relationships.Guard -= 1`
- `flags.met_dragon = true`

## Demo Stories

Open [`demo.html`](demo.html) for sample stories:

- Forest Adventure (default)
- Space Outpost
- City Noir

You can also open a specific story directly:

- `index.html?story=story.yaml`
- `index.html?story=stories/space_outpost.yaml`
- `index.html?story=stories/city_noir.yaml`

## Screenshots

### Editor (Space Outpost demo)

![Editor screenshot](browser:/tmp/codex_browser_invocations/1d3008f52288297d/artifacts/assets/screenshots/editor-space-outpost.png)

### Demo stories page

![Demo page screenshot](browser:/tmp/codex_browser_invocations/1d3008f52288297d/artifacts/assets/screenshots/demo-page.png)

## Deploy to GitHub Pages

1. Create a GitHub repo and upload project files.
2. In **Settings → Pages**, publish from `main` and `/ (root)`.
3. Your app will be live at `https://<username>.github.io/<repo>/`.

## Credits

- [js-yaml](https://github.com/nodeca/js-yaml) (MIT)
