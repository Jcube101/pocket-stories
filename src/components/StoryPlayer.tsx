import type { StoryData } from '../lib/storyValidator';
import { PlayerView } from './PlayerView';

type Props = {
  story: StoryData | null;
  loading?: boolean;
  error?: string | null;
};

export function StoryPlayer({ story, loading, error }: Props) {
  return <PlayerView storyData={story} loading={loading} error={error} />;
}
