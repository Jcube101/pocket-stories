import { parse } from 'yaml';
import { validateAndNormalizeStory, type StoryData } from './storyValidator';

const storyModules = import.meta.glob('../stories/*.yaml', { as: 'raw' });

export type StoryListItem = { id: string; label: string; loader: () => Promise<string> };
export type StoryLoadResult = { data: StoryData; warnings: string[] };

export function getAvailableStories(): StoryListItem[] {
  return Object.entries(storyModules).map(([path, loader]) => {
    const id = path.split('/').pop()!.replace('.yaml', '');
    return { id, label: id.replace(/_/g, ' '), loader: loader as () => Promise<string> };
  });
}

export async function loadStoryFromRaw(raw: string): Promise<StoryLoadResult> {
  const parsed = parse(raw);
  const result = validateAndNormalizeStory(parsed);
  if (!result.ok || !result.data) {
    throw new Error(result.errors.join(' | ') || 'Story validation failed');
  }
  return { data: result.data, warnings: result.warnings };
}

export async function loadStoryById(id: string): Promise<StoryLoadResult> {
  const found = getAvailableStories().find((story) => story.id === id);
  if (!found) throw new Error(`Story not found: ${id}`);
  const raw = await found.loader();
  return loadStoryFromRaw(raw);
}
