import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StoryEditor } from './components/StoryEditor';
import { StoryList } from './components/StoryList';
import { PlayerView } from './components/PlayerView';
import { getAvailableStories, loadStoryById, loadStoryFromRaw, type StoryListItem } from './lib/yamlLoader';
import { parseStoryEffect, validateAndNormalizeStory, type StoryData } from './lib/storyValidator';

const IMPORTED_STORIES_STORAGE_KEY = 'pocket_stories_imported_entries_v1';

type ImportedStoryEntry = {
  id: string;
  label: string;
  raw: string;
  source: string;
};

type BridgeStoryEntry = {
  id?: string;
  label?: string;
  raw: string;
  source?: string;
};

const normalizeStoryId = (value: string) =>
  value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'imported_story';

const makeUniqueStoryId = (desiredId: string, takenIds: Set<string>) => {
  if (!takenIds.has(desiredId)) return desiredId;
  let suffix = 2;
  let candidate = `${desiredId}_${suffix}`;
  while (takenIds.has(candidate)) {
    suffix += 1;
    candidate = `${desiredId}_${suffix}`;
  }
  return candidate;
};

export default function App() {
  const [stories, setStories] = useState<StoryListItem[]>(() => getAvailableStories());
  const [importedStories, setImportedStories] = useState<ImportedStoryEntry[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(IMPORTED_STORIES_STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (entry): entry is ImportedStoryEntry =>
          Boolean(entry && typeof entry.id === 'string' && typeof entry.label === 'string' && typeof entry.raw === 'string' && typeof entry.source === 'string'),
      );
    } catch {
      return [];
    }
  });
  const [mode, setMode] = useState<'editor' | 'player'>('editor');
  const [story, setStory] = useState<StoryData | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string>('forest_adventure');
  const [pendingStoryId, setPendingStoryId] = useState<string>('forest_adventure');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: string }>({ message: 'Loading story...', type: 'info' });
  const [storyWarnings, setStoryWarnings] = useState<string[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    localStorage.setItem(IMPORTED_STORIES_STORAGE_KEY, JSON.stringify(importedStories));
  }, [importedStories]);

  useEffect(() => {
    const builtInStories = getAvailableStories();
    const importedList: StoryListItem[] = importedStories.map((entry) => ({
      id: entry.id,
      label: entry.label,
      loader: () => Promise.resolve(entry.raw),
    }));
    setStories([...builtInStories, ...importedList]);
  }, [importedStories]);

  const loadStory = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const imported = importedStories.find((entry) => entry.id === id);
      const { data: loaded, warnings } = imported ? await loadStoryFromRaw(imported.raw) : await loadStoryById(id);
      setStory(loaded);
      setActiveStoryId(id);
      setStoryWarnings(warnings);
      setShowWarnings(warnings.length > 0);
      setStatus({ message: `Loaded: ${id}`, type: warnings.length > 0 ? 'warning' : 'success' });
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

  useEffect(() => {
    (window as any).registerImportedStoryEntry = async ({ id, label, raw, source }: BridgeStoryEntry) => {
      if (!raw) return null;

      const takenIds = new Set(stories.map((storyItem) => storyItem.id));
      const requestedId = normalizeStoryId(id || source || label || 'imported_story');
      const resolvedId = makeUniqueStoryId(requestedId, takenIds);
      const resolvedLabel = label?.trim() || source || resolvedId;
      const resolvedSource = source || label || resolvedId;

      setImportedStories((prev) => {
        const existingIndex = prev.findIndex((entry) => entry.id === resolvedId);
        const nextEntry: ImportedStoryEntry = { id: resolvedId, label: resolvedLabel, raw, source: resolvedSource };
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = nextEntry;
          return next;
        }
        return [...prev, nextEntry];
      });

      setPendingStoryId(resolvedId);
      return { id: resolvedId, label: resolvedLabel };
    };

    return () => {
      delete (window as any).registerImportedStoryEntry;
    };
  }, [stories]);

  useEffect(() => {
    (window as any).setAppMode = (nextMode: 'editor' | 'player') => {
      if (nextMode !== 'editor' && nextMode !== 'player') return false;
      setMode(nextMode);
      return true;
    };

    return () => {
      delete (window as any).setAppMode;
    };
  }, []);

  const setStoryStatus = useCallback((message: string, type = 'info') => setStatus({ message, type }), []);

  // Keep a ref to the latest loadStory so onLoadStoryByPath doesn't change identity
  // when importedStories changes (which would re-trigger the editor effect unnecessarily).
  const loadStoryRef = useRef(loadStory);
  useEffect(() => { loadStoryRef.current = loadStory; });

  const onLoadStoryByPath = useCallback(async (path: string, label = path) => {
    const id = normalizeStoryId(path.split('/').pop() || activeStoryId);
    setPendingStoryId(id);
    await loadStoryRef.current(id);
    setStatus({ message: `Loaded: ${label}`, type: 'success' });
  }, [activeStoryId]);

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
          activeStoryTitle={story?.title}
          pendingStoryId={pendingStoryId}
          onSelect={setPendingStoryId}
          onLoadSelected={onLoadSelectedStory}
        />
        {topStatus}
        {showWarnings && storyWarnings.length > 0 && (
          <div className="story-status warning" role="alert">
            <strong>Story warnings:</strong>
            <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
              {storyWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            <button onClick={() => setShowWarnings(false)} style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
              Dismiss
            </button>
          </div>
        )}
        {mode === 'editor' ? (
          <StoryEditor story={story} activeStoryId={activeStoryId} setStoryStatus={setStoryStatus} onLoadStoryByPath={onLoadStoryByPath} onStoryChange={setStory} />
        ) : (
          <PlayerView storyData={story} loading={loading} error={error} />
        )}
      </main>
    </div>
  );
}
