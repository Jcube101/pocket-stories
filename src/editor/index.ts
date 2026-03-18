/**
 * src/editor/index.ts
 *
 * Public API for the editor module. Currently re-exports from the legacy
 * monolithic editor.js. As P3-4 modularization progresses, individual
 * functions will be imported from dedicated TypeScript modules here.
 *
 * Usage (from StoryEditor.tsx):
 *   import('../legacy/editor.js').then(mod => {
 *     mod.initEditor();
 *     mod.destroyEditor();
 *   });
 *
 * Future usage (after modularization):
 *   import { initEditor, destroyEditor } from '../editor';
 */

// Re-export the public editor API.
// Dynamic import is used by StoryEditor.tsx to avoid loading ~100KB
// of editor code in player-only sessions.
export type { EditorUiState, CanvasViewMode, EditorModule } from './types';
