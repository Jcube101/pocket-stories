import { useEffect } from 'react';
import type { StoryData } from '../lib/storyValidator';

type Props = {
  story: StoryData | null;
  activeStoryId: string;
  setStoryStatus: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onLoadStoryByPath: (path: string, label?: string) => Promise<void>;
};

export function StoryEditor({ story, activeStoryId, setStoryStatus, onLoadStoryByPath }: Props) {
  useEffect(() => {
    if (!story) return;
    (window as any).storyData = story;
    (window as any).activeStoryId = activeStoryId;
    (window as any).setStoryStatus = setStoryStatus;
    (window as any).loadStoryByPath = onLoadStoryByPath;
    (window as any).validateAndNormalizeStory ??= () => ({ ok: true, data: (window as any).storyData, warnings: [], errors: [] });
    (window as any).parseStoryEffect ??= () => ({ ok: true });

    import('../legacy/editor.js').then((mod) => {
      mod.initEditor();
    });
  }, [story, activeStoryId, setStoryStatus, onLoadStoryByPath]);

  return (
    <div id="editor-mode" className="mode">
      <div id="sidebar">
        <section className="sidebar-section">
          <h2>Stories</h2>
          <p className="story-status info">Use the story selector above to choose a story, then click "Load selected story".</p>
          <label className="file-upload-label">Import user-generated story<input type="file" id="load-story" accept=".yaml,.yml,.json" /></label>
          <p className="story-status info">Supports .yaml, .yml, and .json exports.</p>
          <div id="story-status" className="story-status" aria-live="polite"></div>
        </section>
        <section className="sidebar-section"><h2>Global Variables</h2><div id="variables"></div><div id="add-variable-form"><div className="row-inline"><select id="new-var-type"><option value="inventory">Inventory</option><option value="relationships">Relationships</option><option value="flags">Flags</option></select><input type="text" id="new-var-name" placeholder="Variable name" /><button id="add-var-btn">+ Add</button></div></div></section>
        <section className="sidebar-section"><h2>Passages</h2><input type="text" id="passage-search" placeholder="Search passage id/text..." /><div id="passage-list" className="passage-list"></div></section>
        <section className="sidebar-section"><h2>Tools</h2><button id="branching-script">View as Branching Script</button><button id="export-yaml">Export Story</button><button id="validate-story">Validate Story</button><button id="play-story">Play Story</button></section>
        <section className="sidebar-section" id="diagnostics-section"><h2>Diagnostics</h2><div id="diagnostics-summary">Run Validate Story to view analyzer output.</div><div id="diagnostics-panel" className="diagnostics-panel"></div></section>
        <section className="sidebar-section"><h2>Canvas Controls</h2><div className="canvas-controls-grid"><button id="zoom-in" title="Zoom in">+</button><button id="zoom-out" title="Zoom out">−</button><button id="zoom-fit" title="Fit all nodes">Fit All</button><button id="zoom-reset" title="Reset zoom and position">Reset</button><button id="auto-layout" title="Re-run layered auto layout">Auto Layout</button><button id="focus-start" title="Jump to start node">Start</button><button id="focus-start-cluster" title="Focus start and first connected nodes">Start + Next</button><label className="edge-toggle view-mode-control">View<select id="canvas-view-mode" aria-label="Canvas view mode"><option value="author">Author</option><option value="logic">Logic</option><option value="playtest">Playtest</option></select></label><label className="edge-toggle"><input id="toggle-secondary-edges" type="checkbox" defaultChecked /> Show jump/return</label><label className="edge-toggle"><input id="focus-critical-path" type="checkbox" /> Focus: critical path</label><label className="edge-toggle"><input id="highlight-full-downstream" type="checkbox" /> Highlight full downstream path</label><div className="control-hint">Shortcuts: Alt+C collapse/expand selected, Alt+E expand visible, Alt+M cycle view mode</div><div id="zoom-indicator" className="zoom-indicator" aria-live="polite">100%</div></div></section>
      </div>
      <div id="graph-container"><div id="canvas-wrapper"><div id="nodes-container"></div><svg id="svg-canvas"></svg></div><aside id="node-inspector" aria-live="polite"><h2>Node Inspector</h2><p className="inspector-empty">Select a node to inspect full details.</p><div className="inspector-content hidden"><label htmlFor="inspector-node-id">Passage ID</label><input id="inspector-node-id" type="text"/><label htmlFor="inspector-node-type">Node Type</label><input id="inspector-node-type" type="text" readOnly/><label htmlFor="inspector-node-text">Full Text</label><textarea id="inspector-node-text" rows={10}></textarea><div id="inspector-node-meta"></div></div></aside></div>
    </div>
  );
}
