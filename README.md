# README.md

# Pocket Stories

A lightweight, fully static Choose-Your-Own-Adventure engine with a visual node-based editor. Built entirely with HTML, CSS, and vanilla JavaScript — perfect for deployment on GitHub Pages.

## Features

- Visual editor using LiteGraph.js
- Play mode with conditional choices and variable effects
- Save/load progress
- Export playthrough as a linear novel
- Export story as YAML
- Branching script view for authors
- Mobile-responsive, clean design

## How to Use

1. Open `index.html` in your browser (or deploy to GitHub Pages).
2. By default, you're in **Editor Mode**:
   - Drag from the right side of a passage node to create choices.
   - Right-click a connection → "Edit Choice" to set text, condition, and effect.
   - Add global variables in the sidebar.
   - Use the tools to export or play.
3. Switch to **Player Mode** to test your story.
   - Save progress and reload later.
   - Export your playthrough as a readable novel.

## Deployment on GitHub Pages

1. Create a new repository on GitHub.
2. Upload all files (`index.html`, `style.css`, `editor.js`, `player.js`, `story.yaml`, this README).
3. Go to Settings → Pages → Select branch `main` and folder `/ (root)`.
4. Your site will be live at `https://yourusername.github.io/yourrepo/`.

## Credits

- [LiteGraph.js](https://github.com/jagenjo/litegraph.js) by Javi Agenjo (MIT License)
- [js-yaml](https://github.com/nodeca/js-yaml) (MIT License)

Enjoy creating interactive stories!