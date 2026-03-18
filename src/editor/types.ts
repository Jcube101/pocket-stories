/**
 * editor/types.ts
 *
 * TypeScript interfaces for the legacy editor's internal data structures.
 * These types describe the shape of data managed by src/legacy/editor.js
 * and exchanged with React via the window bridge.
 *
 * Source of truth for the YAML story format is src/lib/storyValidator.ts.
 * These types extend that model with editor-specific runtime state.
 */

/** Canvas view modes available in the editor toolbar */
export type CanvasViewMode = 'author' | 'logic' | 'playtest';

/** Persisted editor UI state (stored in localStorage per story hash) */
export interface EditorUiState {
  /** Map of passage IDs that are currently collapsed in the canvas */
  collapsedById: Record<string, boolean>;
  /** Whether focus-critical-path filtering is active */
  focusCriticalPath: boolean;
  /** Current canvas rendering mode */
  canvasViewMode: CanvasViewMode;
}

/** Entry written to the undo/redo history stack */
export interface HistoryEntry {
  /** Serialized story YAML at this point in history */
  yaml: string;
  /** Editor UI state (collapsed nodes, view mode) at this point */
  uiState: EditorUiState;
}

/**
 * Options passed to saveState() in editor.js
 * @property resetHistory - When true, clears undo/redo stack (used on initial load)
 */
export interface SaveStateOptions {
  resetHistory?: boolean;
}

/**
 * The shape of entries written to the window bridge for story import.
 * Matches the BridgeStoryEntry type in App.tsx.
 */
export interface BridgeStoryEntry {
  id?: string;
  label?: string;
  raw: string;
  source?: string;
}

/**
 * Module seam map — describes the natural module boundaries in editor.js.
 * When the incremental modularization proceeds (roadmap P3-4), each section
 * will become a TypeScript file under src/editor/.
 *
 * Current sections (with approximate line ranges in editor.js):
 *
 * - DATA MODEL         (~1–30)   Module-level state vars: passages, variables, undoStack
 * - SERIALIZATION      (~80–200) loadFromStory(), jsyaml serialize/deserialize
 * - HISTORY            (~780–830) saveState(), undo(), redo(), MAX_HISTORY
 * - RENDERING/NODES    (~440–820) renderNode(), renderAllNodes(), node DOM construction
 * - RENDERING/EDGES    (~1350–1700) renderEdges(), connection path SVG
 * - EVENT HANDLING     (~1100–1350, ~2800–2970) bindEditorEvents(), destroyEditor(), document listeners
 * - LAYOUT             (~1800–2100) autoLayout(), fitAll(), zoom controls
 * - INSPECTOR          (~2100–2500) node inspector panel, form bindings
 * - DIAGNOSTICS        (~2500–2800) validateStory(), diagnostics panel
 * - EXPORT/IMPORT      (~1919, ~2736) exportYaml(), loadStoryFromFile()
 */
export type EditorModule =
  | 'data-model'
  | 'serialization'
  | 'history'
  | 'rendering-nodes'
  | 'rendering-edges'
  | 'event-handling'
  | 'layout'
  | 'inspector'
  | 'diagnostics'
  | 'export-import';
