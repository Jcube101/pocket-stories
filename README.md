# Pocket Stories (Vite + React + TypeScript)

Pocket Stories is now a Vite-powered React 18 + TypeScript app with tabs for **Editor** and **Player** mode.

## Quickstart

```bash
npm install
npm run dev
npm run build
npm run deploy
```

Open `http://localhost:5173`.

## Commands

- `npm install` — install dependencies.
- `npm run dev` — start the local Vite development server.
- `npm run build` — create a production build.
- `npm run deploy` — deploy to GitHub Pages.

## New Structure

```text
pocket-stories/
├── legacy/                     # archived pre-Vite app files
│   ├── demo.html
│   ├── editor.js
│   ├── player.js
│   ├── story-validation.js
│   └── style.css
├── public/
│   └── stories/                 # static YAML copies for easy hosting/export
├── src/
│   ├── components/
│   │   ├── StoryEditor.tsx
│   │   ├── StoryList.tsx
│   │   └── StoryPlayer.tsx
│   ├── legacy/
│   │   └── editor.js            # existing editor core logic, integrated in React
│   ├── lib/
│   │   ├── storyValidator.ts
│   │   └── yamlLoader.ts
│   ├── stories/                 # YAML source set used by import.meta.glob
│   ├── styles/
│   │   └── global.css
│   ├── App.tsx
│   └── main.tsx
├── stories/                     # original YAML files kept intact
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Notes

- Existing YAML stories were **not deleted**.
- YAML story files remain in place in `stories/`, `public/stories/`, and `src/stories/`.
- Story loading is dynamic via `import.meta.glob`.
- `story-validation.js` logic is migrated into typed `src/lib/storyValidator.ts`.
- Player logic is now in `StoryPlayer.tsx` with loading/error states.
- Editor UI is rendered by React (`StoryEditor.tsx`) and reuses the legacy editor engine (`src/legacy/editor.js`) for minimal-risk migration.
- Responsive defaults are mobile-first with touch-friendly button sizing (44px min target).
- GitHub Pages deploy uses the `/pocket-stories/` base path configured in `vite.config.ts`.

## Story URLs

You can keep stories in both:
- `src/stories/` (for dynamic module loading)
- `public/stories/` (for static file serving)
- `stories/` (original YAML source archive retained during migration)

This dual setup keeps migration safe while preserving your original content.
