import { useEffect, useRef, useState } from 'react';
import type { StoryData } from '../lib/storyValidator';

type Props = {
  story: StoryData | null;
  activeStoryId: string;
  setStoryStatus: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onLoadStoryByPath: (path: string, label?: string) => Promise<void>;
  onStoryChange: (updated: StoryData) => void;
};

export function StoryEditor({ story, activeStoryId, setStoryStatus, onLoadStoryByPath, onStoryChange }: Props) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const destroyRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    (window as any).setSidebarCollapsed = (collapsed: boolean) => {
      setIsSidebarCollapsed(Boolean(collapsed));
    };
    (window as any).toggleSidebarCollapsed = () => {
      setIsSidebarCollapsed((prev) => !prev);
    };

    return () => {
      delete (window as any).setSidebarCollapsed;
      delete (window as any).toggleSidebarCollapsed;
    };
  }, []);

  const onStoryChangeRef = useRef(onStoryChange);
  useEffect(() => { onStoryChangeRef.current = onStoryChange; });

  useEffect(() => {
    (window as any).onStoryChange = (updated: StoryData) => {
      onStoryChangeRef.current(structuredClone(updated));
    };
    return () => { delete (window as any).onStoryChange; };
  }, []);

  useEffect(() => {
    if (!story) return;
    (window as any).storyData = story;
    (window as any).activeStoryId = activeStoryId;
    (window as any).setStoryStatus = setStoryStatus;
    (window as any).loadStoryByPath = onLoadStoryByPath;
    (window as any).validateAndNormalizeStory ??= () => ({ ok: true, data: (window as any).storyData, warnings: [], errors: [] });
    (window as any).parseStoryEffect ??= () => ({ ok: true });

    let cancelled = false;
    import('../legacy/editor.js').then((mod) => {
      if (cancelled) return;
      mod.initEditor();
      destroyRef.current = mod.destroyEditor;
    }).catch((err) => {
      if (!cancelled) {
        console.error('Failed to load editor:', err);
        setStoryStatus('Editor failed to load. Check the console for details.', 'error');
      }
    });

    return () => {
      cancelled = true;
      destroyRef.current?.();
      destroyRef.current = undefined;
    };
  }, [story, activeStoryId, setStoryStatus, onLoadStoryByPath]);

  return (
    <div id="editor-mode" className="mode">
      <button
        id="toggle-sidebar"
        type="button"
        aria-controls="sidebar"
        aria-expanded={!isSidebarCollapsed}
        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setIsSidebarCollapsed((prev) => !prev)}
      >
        {isSidebarCollapsed ? '▶' : '◀'}
      </button>
      <div id="sidebar" className={isSidebarCollapsed ? 'hidden' : ''}>

        {/* 1. Global Variables */}
        <section className="sidebar-section">
          <h2>Global Variables</h2>
          <div id="variables"></div>
          <div id="add-variable-form">
            <div className="row-inline">
              <select id="new-var-type">
                <option value="inventory">Inventory</option>
                <option value="relationships">Relationships</option>
                <option value="flags">Flags</option>
              </select>
              <input type="text" id="new-var-name" placeholder="Variable name" />
              <button id="add-var-btn">+ Add</button>
            </div>
          </div>
        </section>

        {/* 2. Passages */}
        <section className="sidebar-section">
          <h2>Passages</h2>
          <input type="text" id="passage-search" placeholder="Search passage id/text..." />
          <div id="passage-list" className="passage-list"></div>
        </section>

        {/* 3. Tools — 2×2 grid */}
        <section className="sidebar-section">
          <h2>Tools</h2>
          <div className="tools-grid">
            <button id="branching-script">Branching Script</button>
            <button id="export-yaml">Export YAML</button>
            <button id="validate-story">Validate</button>
            <button id="play-story">Play Story</button>
          </div>
        </section>

        {/* 4. Diagnostics */}
        <section className="sidebar-section" id="diagnostics-section">
          <h2>Diagnostics</h2>
          <div id="diagnostics-summary">Run Validate to view analyzer output.</div>
          <div id="diagnostics-panel" className="diagnostics-panel"></div>
        </section>

        {/* 5. Canvas Controls */}
        <section className="sidebar-section">
          <h2>Canvas Controls</h2>
          <div className="canvas-controls-grid">
            <button id="zoom-in" title="Zoom in">＋ Zoom In</button>
            <button id="zoom-out" title="Zoom out">− Zoom Out</button>
            <button id="zoom-fit" title="Fit all nodes">⊞ Fit All</button>
            <button id="zoom-reset" title="Reset zoom and position">↺ Reset</button>
            <button id="auto-layout" title="Re-run layered auto layout" style={{ gridColumn: '1 / -1' }}>⬡ Auto Layout</button>
            <button id="focus-start" title="Jump to start node">⚑ Go to Start</button>
            <button id="focus-start-cluster" title="Focus start and first connected nodes">⚑ Start + Next</button>
            <div id="zoom-indicator" className="zoom-indicator" aria-live="polite">100%</div>
            <div className="canvas-hint" style={{ gridColumn: '1 / -1' }}>
              Shortcuts: Alt+C collapse, Alt+E expand, Alt+M cycle view
            </div>
          </div>

          {/* View mode — 3 visible buttons; hidden select keeps editor.js wiring */}
          <h3 className="controls-subhead">View Mode</h3>
          <div className="view-mode-btns">
            <button id="view-btn-author" className="view-mode-btn" data-mode="author">Author</button>
            <button id="view-btn-logic" className="view-mode-btn" data-mode="logic">Logic</button>
            <button id="view-btn-playtest" className="view-mode-btn" data-mode="playtest">Playtest</button>
          </div>
          {/* Hidden select — kept for editor.js binding */}
          <select id="canvas-view-mode" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }}>
            <option value="author">Author</option>
            <option value="logic">Logic</option>
            <option value="playtest">Playtest</option>
          </select>
        </section>

        {/* 6. Split View — toggles separated from canvas controls */}
        <section className="sidebar-section">
          <h2>Split View</h2>
          <div className="view-toggles-grid">
            <button id="toggle-secondary-edges-btn" className="view-toggle-btn" data-active="true">Show Jump/Return</button>
            <button id="focus-critical-path-btn" className="view-toggle-btn" data-active="false">Critical Path</button>
            <button id="highlight-full-downstream-btn" className="view-toggle-btn" data-active="false">Full Downstream</button>
          </div>
          {/* Hidden checkboxes — kept for editor.js binding */}
          <div style={{ display: 'none' }}>
            <input id="toggle-secondary-edges" type="checkbox" defaultChecked />
            <input id="focus-critical-path" type="checkbox" />
            <input id="highlight-full-downstream" type="checkbox" />
          </div>
        </section>

        {/* 7. Stories (at bottom) */}
        <section className="sidebar-section">
          <h2>Stories</h2>
          <p className="story-status info">Use the story selector in the header to choose a story.</p>
          <label className="file-upload-label">Import story file
            <input type="file" id="load-story" accept=".yaml,.yml,.json" />
          </label>
          <p className="story-status info">Supports .yaml, .yml, and .json exports.</p>
          <div id="story-status" className="story-status" aria-live="polite"></div>
        </section>

      </div>
      <div id="graph-container" className={isSidebarCollapsed ? 'expanded' : ''}>
        <div id="canvas-wrapper">
          <div id="nodes-container"></div>
          <svg id="svg-canvas"></svg>
        </div>
        <aside id="node-inspector" aria-live="polite">
          <h2>Node Inspector</h2>
          <p className="inspector-empty">Select a node to inspect full details.</p>
          <div className="inspector-content hidden">
            <label htmlFor="inspector-node-id">Passage ID</label>
            <input id="inspector-node-id" type="text" />
            <label htmlFor="inspector-node-type">Node Type</label>
            <select id="inspector-node-type" defaultValue="__auto__">
              <option value="__auto__">Auto (infer from structure)</option>
              <option value="start">Start</option>
              <option value="dialogue">Dialogue</option>
              <option value="choice">Choice</option>
              <option value="condition">Condition</option>
              <option value="merge">Merge</option>
              <option value="ending">Ending</option>
              <option value="__custom__">Custom…</option>
            </select>
            <input id="inspector-node-type-custom" type="text" className="hidden" placeholder="Custom type token" />
            <label htmlFor="inspector-node-text">Full Text</label>
            <textarea id="inspector-node-text" rows={10}></textarea>
            <div id="inspector-node-meta"></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
