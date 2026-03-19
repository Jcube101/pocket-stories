import type { StoryListItem } from '../lib/yamlLoader';

type Props = {
  stories: StoryListItem[];
  activeStoryId?: string;
  activeStoryTitle?: string;
  pendingStoryId?: string;
  onSelect: (id: string) => void;
  onLoadSelected: () => void;
};

export function StoryList({ stories, activeStoryId, activeStoryTitle, pendingStoryId, onSelect, onLoadSelected }: Props) {
  const hasNewSelection = Boolean(pendingStoryId && pendingStoryId !== activeStoryId);

  return (
    <div className="header-story-selector">
      <select
        value={pendingStoryId ?? activeStoryId ?? ''}
        onChange={e => onSelect(e.target.value)}
        className="story-select"
        aria-label="Select a story"
        title="Select a story to load"
      >
        {stories.map((story) => {
          const isActive = story.id === activeStoryId;
          const label = isActive && activeStoryTitle ? activeStoryTitle : story.label;
          return (
            <option key={story.id} value={story.id}>
              {label}{isActive ? ' ✓' : ''}
            </option>
          );
        })}
      </select>
      <button
        className={`choice-button${hasNewSelection ? ' active' : ''}`}
        onClick={onLoadSelected}
        disabled={!hasNewSelection}
        title="Load selected story"
      >
        Load
      </button>
    </div>
  );
}
