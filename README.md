# Pocket Stories (Vite + React + TypeScript)

Pocket Stories is now a Vite-powered React 18 + TypeScript app with tabs for **Editor** and **Player** mode.

## Quickstart

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## New Structure

```text
pocket-stories/
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
- Story loading is dynamic via `import.meta.glob`.
- `story-validation.js` logic is migrated into typed `src/lib/storyValidator.ts`.
- Player logic is now in `StoryPlayer.tsx` with loading/error states.
- Editor UI is rendered by React (`StoryEditor.tsx`) and reuses the legacy editor engine (`src/legacy/editor.js`) for minimal-risk migration.
- Responsive defaults are mobile-first with touch-friendly button sizing (44px min target).

## Story URLs

You can keep stories in both:
- `src/stories/` (for dynamic module loading)
- `public/stories/` (for static file serving)

This dual setup keeps migration safe while preserving your original content.
