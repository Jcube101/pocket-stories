import type { StoryListItem } from '../lib/yamlLoader';

type Props = { stories: StoryListItem[]; activeStoryId?: string; onSelect: (id: string) => void };

export function StoryList({ stories, activeStoryId, onSelect }: Props) {
  return (
    <div className="story-list card">
      <h2>Stories</h2>
      <div className="story-grid">
        {stories.map((story) => (
          <button key={story.id} className={`choice-button ${activeStoryId === story.id ? 'active' : ''}`} onClick={() => onSelect(story.id)}>
            {story.label}
          </button>
        ))}
      </div>
    </div>
  );
}
