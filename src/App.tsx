import { useEffect, useMemo, useState } from 'react';
import { StoryEditor } from './components/StoryEditor';
import { StoryList } from './components/StoryList';
import { StoryPlayer } from './components/StoryPlayer';
import { getAvailableStories, loadStoryById } from './lib/yamlLoader';
import { parseStoryEffect, validateAndNormalizeStory, type StoryData } from './lib/storyValidator';

const stories = getAvailableStories();

export default function App() {
  const [mode, setMode] = useState<'editor' | 'player'>('editor');
  const [story, setStory] = useState<StoryData | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string>('forest_adventure');
  const [pendingStoryId, setPendingStoryId] = useState<string>('forest_adventure');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: string }>({ message: 'Loading story...', type: 'info' });

  const loadStory = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadStoryById(id);
      setStory(loaded);
      setActiveStoryId(id);
      setStatus({ message: `Loaded: ${id}`, type: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load story');
      setStatus({ message: 'Failed to load story', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (window as any).validateAndNormalizeStory = validateAndNormalizeStory;
    (window as any).parseStoryEffect = parseStoryEffect;
    loadStory(activeStoryId);
  }, []);

  const setStoryStatus = (message: string, type = 'info') => setStatus({ message, type });

  const onLoadStoryByPath = async (path: string, label = path) => {
    const id = path.split('/').pop()?.replace('.yaml', '') ?? activeStoryId;
    setPendingStoryId(id);
    await loadStory(id);
    setStatus({ message: `Loaded: ${label}`, type: 'success' });
  };

  const onLoadSelectedStory = async () => {
    if (!pendingStoryId || pendingStoryId === activeStoryId) return;
    await loadStory(pendingStoryId);
  };

  const topStatus = useMemo(() => <p className={`story-status ${status.type}`}>{status.message}</p>, [status]);

  return (
    <div className="app-shell">
      <header className="top-header">
        <h1>Pocket Stories</h1>
        <nav className="tab-row" aria-label="Mode selector">
          <button className={`choice-button ${mode === 'editor' ? 'active' : ''}`} onClick={() => setMode('editor')}>Editor</button>
          <button className={`choice-button ${mode === 'player' ? 'active' : ''}`} onClick={() => setMode('player')}>Player</button>
        </nav>
      </header>

      <main className="main-content">
        <StoryList
          stories={stories}
          activeStoryId={activeStoryId}
          pendingStoryId={pendingStoryId}
          onSelect={setPendingStoryId}
          onLoadSelected={onLoadSelectedStory}
        />
        {topStatus}
        {mode === 'editor' ? (
          <StoryEditor story={story} setStoryStatus={setStoryStatus} onLoadStoryByPath={onLoadStoryByPath} />
        ) : (
          <StoryPlayer story={story} loading={loading} error={error} />
        )}
      </main>
    </div>
  );
}
