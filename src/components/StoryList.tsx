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
    <div className="story-list card">
      <h2>Stories</h2>
      <div className="story-grid">
        {stories.map((story) => {
          const isActive = story.id === activeStoryId;
          const isPending = story.id === pendingStoryId;
          const displayTitle = isActive && activeStoryTitle ? activeStoryTitle : null;
          return (
            <button
              key={story.id}
              className={`choice-button ${isPending ? 'active' : ''}`}
              onClick={() => onSelect(story.id)}
            >
              {displayTitle ?? story.label}
              {isActive && <span style={{ fontSize: '0.75em', opacity: 0.6, marginLeft: '0.4em' }}>(loaded)</span>}
            </button>
          );
        })}
      </div>
      <button
        className={`choice-button ${hasNewSelection ? 'active' : ''}`}
        onClick={onLoadSelected}
        disabled={!hasNewSelection}
      >
        Load selected story
      </button>
    </div>
  );
}
