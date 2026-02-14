import { useEffect, useMemo, useRef, useState } from 'react';
import { parseStoryEffect, type StoryData } from '../lib/storyValidator';

type PlayerViewProps = {
  storyData: StoryData | null;
  loading?: boolean;
  error?: string | null;
};

type HistoryItem = { passage: string; choiceText: string; target: string };
type VariablesState = StoryData['variables'];
type StoryChoice = StoryData['passages'][string]['choices'][number];
type OutgoingSnapshot = { text: string; choices: StoryChoice[] };

const TYPEWRITER_CHARS_PER_SECOND = 58;
const CHOICE_STAGGER_MS = 85;
const CROSSFADE_MS = 300;

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
  const [displayPassage, setDisplayPassage] = useState('start');
  const [variablesState, setVariablesState] = useState<VariablesState>({ inventory: {}, relationships: {}, flags: {} });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [renderedText, setRenderedText] = useState('');
  const [isPassageRevealComplete, setIsPassageRevealComplete] = useState(false);
  const [visibleChoiceCount, setVisibleChoiceCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [outgoingSnapshot, setOutgoingSnapshot] = useState<OutgoingSnapshot | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);

  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (!storyData) return;
    const startPassage = storyData.passages.start ? 'start' : Object.keys(storyData.passages)[0] ?? 'start';
    setCurrentPassage(startPassage);
    setDisplayPassage(startPassage);
    setVariablesState(normalizeVariables(storyData.variables));
    setHistory([]);
    setIsTransitioning(false);
    setOutgoingSnapshot(null);
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, [storyData]);

  useEffect(
    () => () => {
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    },
    []
  );

  const passage = storyData?.passages[displayPassage] ?? null;

  const evalCondition = (condition: string) => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('inventory', 'relationships', 'flags', `return (${condition});`);
      return Boolean(fn(variablesState.inventory, variablesState.relationships, variablesState.flags));
    } catch {
      return false;
    }
  };

  const visibleChoices = passage ? (passage.choices ?? []).filter((choice) => !choice.condition || evalCondition(choice.condition)) : [];

  useEffect(() => {
    if (!passage) return;
    const text = passage.text.trim();
    setVisibleChoiceCount(0);
    setIsPassageRevealComplete(false);

    if (!text || prefersReducedMotion) {
      setRenderedText(text);
      setIsPassageRevealComplete(true);
      return;
    }

    let rafId = 0;
    let previous = 0;
    let revealedCharacters = 0;

    const tick = (now: number) => {
      if (!previous) previous = now;
      const deltaMs = now - previous;
      previous = now;
      revealedCharacters = Math.min(text.length, revealedCharacters + (deltaMs / 1000) * TYPEWRITER_CHARS_PER_SECOND);
      const count = Math.floor(revealedCharacters);
      setRenderedText(text.slice(0, count));

      if (count >= text.length) {
        setRenderedText(text);
        setIsPassageRevealComplete(true);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    setRenderedText('');
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [displayPassage, passage, prefersReducedMotion]);

  useEffect(() => {
    if (!isPassageRevealComplete) return;

    if (prefersReducedMotion) {
      setVisibleChoiceCount(visibleChoices.length);
      return;
    }

    let rafId = 0;
    let start = 0;
    const total = visibleChoices.length;

    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const count = Math.min(total, Math.floor(elapsed / CHOICE_STAGGER_MS));
      setVisibleChoiceCount(count);
      if (count >= total) return;
      rafId = window.requestAnimationFrame(tick);
    };

    setVisibleChoiceCount(0);
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPassageRevealComplete, visibleChoices.length, displayPassage, prefersReducedMotion]);

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

  const renderChoiceButton = (choice: StoryChoice, index: number, outgoing = false) => {
    const visible = outgoing || index < visibleChoiceCount;
    return (
      <button
        key={`${choice.text}-${choice.target}-${index}-${outgoing ? 'out' : 'in'}`}
        className="player-choice player-control min-h-11 rounded-xl border border-player-border bg-player-surface-elevated px-playerMd py-playerSm text-left text-player-text"
        data-visible={visible}
        style={{ transitionDelay: `${index * 45}ms` }}
        disabled={outgoing || isTransitioning || !isPassageRevealComplete || !visible}
        onClick={() => {
          if (!passage || outgoing || isTransitioning || !isPassageRevealComplete) return;
          setOutgoingSnapshot({ text: passage.text.trim(), choices: visibleChoices });
          setIsTransitioning(true);
          if (choice.effect) applyEffect(choice.effect);
          setHistory((prev: HistoryItem[]) => [...prev, { passage: currentPassage, choiceText: choice.text, target: choice.target }]);
          setCurrentPassage(choice.target);
          setDisplayPassage(choice.target);
          transitionTimeoutRef.current = window.setTimeout(() => {
            setOutgoingSnapshot(null);
            setIsTransitioning(false);
            transitionTimeoutRef.current = null;
          }, CROSSFADE_MS);
        }}
      >
        {choice.text}
      </button>
    );
  };

  if (loading) return <p className="player-control text-player-muted">Loading story…</p>;
  if (error) return <p className="player-control text-red-600 dark:text-red-400">{error}</p>;
  if (!storyData) return <p className="player-control text-player-muted">Load a story to start playing.</p>;
  if (!passage) return <p className="player-control text-red-600 dark:text-red-400">Current passage not found.</p>;

  return (
    <section className="player-layout">
      <div id="passage-container" className="card border-player-border bg-player-surface-elevated p-playerLg text-player-text">
        <div className="passage-stage" data-transitioning={isTransitioning}>
          {outgoingSnapshot && (
            <div className="passage-layer passage-layer-outgoing">
              <div className="passage-text mb-playerMd rounded-xl border border-player-border bg-player-surface p-playerLg text-player-text">
                {outgoingSnapshot.text}
              </div>
              <div className="choices-grid grid-cols-1 sm:grid-cols-2">
                {outgoingSnapshot.choices.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-300">No available choices.</p>
                ) : (
                  outgoingSnapshot.choices.map((choice, index) => renderChoiceButton(choice, index, true))
                )}
              </div>
            </div>
          )}

          <div className="passage-layer passage-layer-incoming">
            <div id="passage-text" className="passage-text mb-playerMd rounded-xl border border-player-border bg-player-surface p-playerLg text-player-text" aria-live="polite">
              {renderedText}
            </div>
            <div id="choices" className="choices-grid grid-cols-1 sm:grid-cols-2">
              {visibleChoices.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-300">No available choices.</p>
              ) : (
                visibleChoices.map((choice, index) => renderChoiceButton(choice, index))
              )}
            </div>
          </div>
        </div>
      </div>
      <aside className="card border-player-border bg-player-surface-elevated p-playerLg text-player-text">
        <h3 className="player-heading mb-playerSm text-2xl font-semibold tracking-tight">History</h3>
        <button
          className="player-control mb-playerMd min-h-11 rounded-xl border border-player-border bg-player-surface-elevated px-playerMd py-playerSm text-player-text transition-colors hover:border-player-accent hover:bg-player-accent-soft"
          onClick={() => {
            const startPassage = storyData.passages.start ? 'start' : Object.keys(storyData.passages)[0] ?? 'start';
            setCurrentPassage(startPassage);
            setDisplayPassage(startPassage);
            setVariablesState(normalizeVariables(storyData.variables));
            setHistory([]);
            setOutgoingSnapshot(null);
            setIsTransitioning(false);
            if (transitionTimeoutRef.current) {
              window.clearTimeout(transitionTimeoutRef.current);
              transitionTimeoutRef.current = null;
            }
          }}
        >
          Restart
        </button>
        <ol className="list-decimal space-y-playerSm pl-5 text-sm text-player-muted">
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
