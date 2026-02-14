import type { StoryListItem } from '../lib/yamlLoader';

type Props = {
  stories: StoryListItem[];
  activeStoryId?: string;
  pendingStoryId?: string;
  onSelect: (id: string) => void;
  onLoadSelected: () => void;
};

export function StoryList({ stories, activeStoryId, pendingStoryId, onSelect, onLoadSelected }: Props) {
  return (
    <div className="story-list card">
      <h2>Stories</h2>
      <div className="story-grid">
        {stories.map((story) => (
          <button
            key={story.id}
            className={`choice-button ${pendingStoryId === story.id ? 'active' : ''}`}
            onClick={() => onSelect(story.id)}
          >
            {story.label}
            {activeStoryId === story.id ? ' (loaded)' : ''}
          </button>
        ))}
      </div>
      <button className="choice-button active" onClick={onLoadSelected} disabled={!pendingStoryId}>
        Load selected story
      </button>
    </div>
  );
}
