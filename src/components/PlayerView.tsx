import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { parseStoryEffect, type StoryData } from '../lib/storyValidator';

const playerMotion = {
  timing: {
    passage: 0.3,
    choiceList: 0.22,
    choiceItem: 0.18,
  },
  ease: [0.22, 1, 0.36, 1] as const,
};

type PlayerViewProps = {
  storyData: StoryData | null;
  loading?: boolean;
  error?: string | null;
};

type HistoryItem = { passage: string; choiceText: string; target: string };
type VariablesState = StoryData['variables'];

const normalizeVariables = (v: StoryData['variables'] | undefined): VariablesState => ({
  inventory: v?.inventory ?? {},
  relationships: v?.relationships ?? {},
  flags: v?.flags ?? {},
});

function ensureObjectPath(root: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return keys.reduce<Record<string, unknown>>((acc, segment: string) => {
    const current = acc[segment];
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      acc[segment] = {};
    }
    return acc[segment] as Record<string, unknown>;
  }, root);
}

export function PlayerView({ storyData, loading, error }: PlayerViewProps) {
  const [currentPassage, setCurrentPassage] = useState('start');
  const [variablesState, setVariablesState] = useState<VariablesState>({ inventory: {}, relationships: {}, flags: {} });
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!storyData) return;
    setCurrentPassage(storyData.passages.start ? 'start' : Object.keys(storyData.passages)[0] ?? 'start');
    setVariablesState(normalizeVariables(storyData.variables));
    setHistory([]);
  }, [storyData]);

  if (loading) return <p className="text-slate-500 dark:text-slate-300">Loading story…</p>;
  if (error) return <p className="text-red-600 dark:text-red-400">{error}</p>;
  if (!storyData) return <p className="text-slate-500 dark:text-slate-300">Load a story to start playing.</p>;

  const passage = storyData.passages[currentPassage];
  if (!passage) return <p className="text-red-600 dark:text-red-400">Current passage not found.</p>;

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
    const target = ensureObjectPath(nextState as unknown as Record<string, unknown>, keys);

    if (operator === '+=') target[last] = Number(target[last] ?? 0) + Number(value);
    else if (operator === '-=') target[last] = Number(target[last] ?? 0) - Number(value);
    else target[last] = value;
    setVariablesState(nextState);
  };

  const visibleChoices = (passage.choices ?? []).filter((choice) => !choice.condition || evalCondition(choice.condition));

  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
      <div id="passage-container" className="rounded-xl border border-slate-300 bg-white p-3 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPassage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: playerMotion.timing.passage, ease: playerMotion.ease }}
          >
            <div id="passage-text" className="mb-3 whitespace-pre-wrap rounded-lg border border-slate-300 bg-slate-50 p-3 leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
              {passage.text.trim()}
            </div>
            <motion.div
              id="choices"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: playerMotion.timing.choiceList, ease: playerMotion.ease }}
            >
              {visibleChoices.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-300">No available choices.</p>
              ) : (
                visibleChoices.map((choice, index) => (
                  <motion.button
                    key={`${choice.text}-${index}`}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-slate-800 transition-colors hover:border-sky-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-sky-400 dark:hover:bg-slate-800"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: playerMotion.timing.choiceItem, delay: index * 0.03, ease: playerMotion.ease }}
                    onClick={() => {
                      if (choice.effect) applyEffect(choice.effect);
                      setHistory((prev: HistoryItem[]) => [...prev, { passage: currentPassage, choiceText: choice.text, target: choice.target }]);
                      setCurrentPassage(choice.target);
                    }}
                  >
                    {choice.text}
                  </motion.button>
                ))
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
      <aside className="rounded-xl border border-slate-300 bg-white p-3 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <h3 className="mb-2 text-lg font-semibold">History</h3>
        <button
          className="mb-3 min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 transition-colors hover:border-sky-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-sky-400 dark:hover:bg-slate-800"
          onClick={() => {
            setCurrentPassage('start');
            setVariablesState(normalizeVariables(storyData.variables));
            setHistory([]);
          }}
        >
          Restart
        </button>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          {history.map((item: HistoryItem, idx: number) => (
            <li key={`${item.passage}-${idx}`}>
              {item.choiceText} → {item.target}
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}
