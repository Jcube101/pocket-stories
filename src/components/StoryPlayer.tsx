import { useEffect, useState } from 'react';
import { parseStoryEffect, type StoryData } from '../lib/storyValidator';

type Props = { story: StoryData | null; loading?: boolean; error?: string | null };

type HistoryItem = { passage: string; choiceText: string; target: string };

const normalizeVariables = (v: StoryData['variables'] | undefined) => ({ inventory: v?.inventory ?? {}, relationships: v?.relationships ?? {}, flags: v?.flags ?? {} });

export function StoryPlayer({ story, loading, error }: Props) {
  const [currentPassage, setCurrentPassage] = useState('start');
  const [variablesState, setVariablesState] = useState<Record<string, any>>({ inventory: {}, relationships: {}, flags: {} });
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!story) return;
    setCurrentPassage(story.passages.start ? 'start' : Object.keys(story.passages)[0] ?? 'start');
    setVariablesState(normalizeVariables(story.variables));
    setHistory([]);
  }, [story]);

  if (loading) return <p className="status-message">Loading story…</p>;
  if (error) return <p className="status-message error">{error}</p>;
  if (!story) return <p className="status-message">Load a story to start playing.</p>;

  const passage = story.passages[currentPassage];
  if (!passage) return <p className="status-message error">Current passage not found.</p>;

  const evalCondition = (condition: string) => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('inventory', 'relationships', 'flags', `return (${condition});`);
      return Boolean(fn(variablesState.inventory, variablesState.relationships, variablesState.flags));
    } catch {
      return false;
    }
  };

  const applyEffect = (effect: string) => {
    const parsed = parseStoryEffect(effect);
    if (!parsed.ok) {
      return;
    }
    const nextState = structuredClone(variablesState);
    const { path, operator, value } = parsed.effect;
    const keys = path.split('.');
    const last = keys.pop()!;
    const target = keys.reduce((acc: Record<string, any>, key) => (acc[key] ??= {}), nextState);

    if (operator === '+=') target[last] = Number(target[last] ?? 0) + Number(value);
    else if (operator === '-=') target[last] = Number(target[last] ?? 0) - Number(value);
    else target[last] = value;
    setVariablesState(nextState);
  };

  const visibleChoices = (passage.choices ?? []).filter((choice) => !choice.condition || evalCondition(choice.condition));

  return (
    <section className="player-layout">
      <div id="passage-container" className="card">
        <div id="passage-text" className="passage-text">{passage.text.trim()}</div>
        <div id="choices" className="choices-grid">
          {visibleChoices.length === 0 ? (
            <p className="status-message">No available choices.</p>
          ) : (
            visibleChoices.map((choice, index) => (
              <button
                key={`${choice.text}-${index}`}
                className="choice-button"
                onClick={() => {
                  if (choice.effect) applyEffect(choice.effect);
                  setHistory((prev) => [...prev, { passage: currentPassage, choiceText: choice.text, target: choice.target }]);
                  setCurrentPassage(choice.target);
                }}
              >
                {choice.text}
              </button>
            ))
          )}
        </div>
      </div>
      <aside className="card history-panel">
        <h3>History</h3>
        <button className="choice-button small" onClick={() => {
          setCurrentPassage('start');
          setVariablesState(normalizeVariables(story.variables));
          setHistory([]);
        }}>Restart</button>
        <ol>
          {history.map((item, idx) => <li key={`${item.passage}-${idx}`}>{item.choiceText} → {item.target}</li>)}
        </ol>
      </aside>
    </section>
  );
}
