import { useEffect, useMemo, useRef, useState } from 'react';
import { parseStoryEffect, type StoryData } from '../lib/storyValidator';
import { evalCondition } from '../lib/conditionEvaluator';

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
  const [effectErrors, setEffectErrors] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);
  // Set to true by tap-to-skip; the rAF tick checks this and fast-forwards reveal
  const skipRevealRef = useRef(false);

  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Reset all state when the story changes
  useEffect(() => {
    if (!storyData) return;
    const startPassage = storyData.passages.start ? 'start' : Object.keys(storyData.passages)[0] ?? 'start';
    setCurrentPassage(startPassage);
    setDisplayPassage(startPassage);
    setVariablesState(normalizeVariables(storyData.variables));
    setHistory([]);
    setIsTransitioning(false);
    setOutgoingSnapshot(null);
    setEffectErrors([]);
    setHistoryOpen(false);
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

  const evaluateCondition = (condition: string) => evalCondition(condition, variablesState);

  const visibleChoices = passage
    ? (passage.choices ?? []).filter((choice) => !choice.condition || evaluateCondition(choice.condition))
    : [];

  // Typewriter effect — skipRevealRef.current allows tap-to-skip fast-forward
  useEffect(() => {
    if (!passage) return;
    const text = passage.text.trim();
    setVisibleChoiceCount(0);
    setIsPassageRevealComplete(false);
    skipRevealRef.current = false;

    if (!text || prefersReducedMotion) {
      setRenderedText(text);
      setIsPassageRevealComplete(true);
      return;
    }

    let rafId = 0;
    let previous = 0;
    let revealedCharacters = 0;

    const tick = (now: number) => {
      // Tap-to-skip: jump straight to full text
      if (skipRevealRef.current) {
        setRenderedText(text);
        setIsPassageRevealComplete(true);
        return;
      }
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

  // Stagger choices in after text reveal is complete
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
      setEffectErrors((prev) => [...prev, `Effect "${effect}": ${parsed.error}`]);
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

  function handleRestart() {
    if (!storyData) return;
    const startPassage = storyData.passages.start ? 'start' : Object.keys(storyData.passages)[0] ?? 'start';
    setCurrentPassage(startPassage);
    setDisplayPassage(startPassage);
    setVariablesState(normalizeVariables(storyData.variables));
    setHistory([]);
    setOutgoingSnapshot(null);
    setIsTransitioning(false);
    setHistoryOpen(false);
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }

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
          setHistoryOpen(false);
          setOutgoingSnapshot({ text: passage.text.trim(), choices: visibleChoices });
          setIsTransitioning(true);
          if (choice.effect) applyEffect(choice.effect);
          setHistory((prev: HistoryItem[]) => [
            ...prev,
            { passage: currentPassage, choiceText: choice.text, target: choice.target },
          ]);
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

      {/* ── Mobile-only top bar: restart button + story title ─────────────── */}
      <div className="player-top-bar">
        <button className="player-top-restart player-control" onClick={handleRestart}>
          ↺ Restart
        </button>
        {storyData.title && (
          <span className="player-top-title">{storyData.title}</span>
        )}
      </div>

      {/* ── Desktop-only heading (CSS hides this on mobile) ───────────────── */}
      {storyData.title && (
        <h2 className="player-heading text-2xl font-semibold tracking-tight text-player-text mb-playerSm">
          {storyData.title}
        </h2>
      )}

      {/* ── Effect error banner ────────────────────────────────────────────── */}
      {effectErrors.length > 0 && (
        <div className="story-status warning" role="alert">
          <strong>Effect errors (choices may not apply correctly):</strong>
          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
            {effectErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          <button onClick={() => setEffectErrors([])} style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main passage content ───────────────────────────────────────────── */}
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
            {/* Tapping the passage text during typewriter reveal skips to full text */}
            <div
              id="passage-text"
              className="passage-text mb-playerMd rounded-xl border border-player-border bg-player-surface p-playerLg text-player-text"
              aria-live="polite"
              onClick={() => { if (!isPassageRevealComplete) skipRevealRef.current = true; }}
              style={{ cursor: isPassageRevealComplete ? undefined : 'pointer' }}
            >
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

      {/* ── Desktop history aside (CSS hides this on mobile) ──────────────── */}
      <aside className="card player-history-aside border-player-border bg-player-surface-elevated p-playerLg text-player-text">
        <h3 className="player-heading mb-playerSm text-2xl font-semibold tracking-tight">History</h3>
        <button
          className="player-control mb-playerMd min-h-11 rounded-xl border border-player-border bg-player-surface-elevated px-playerMd py-playerSm text-player-text transition-colors hover:border-player-accent hover:bg-player-accent-soft"
          onClick={handleRestart}
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

      {/* ── Mobile bottom bar: history drawer toggle (CSS hides on desktop) ─ */}
      <div className="player-bottom-bar">
        <button
          className="player-history-toggle"
          onClick={() => setHistoryOpen(true)}
          aria-expanded={historyOpen}
          aria-controls="player-history-drawer"
        >
          📜 {history.length > 0 ? `History (${history.length})` : 'History'}
        </button>
      </div>

      {/* ── Mobile history drawer backdrop ────────────────────────────────── */}
      <div
        className={`player-history-backdrop${historyOpen ? ' open' : ''}`}
        onClick={() => setHistoryOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile history drawer ──────────────────────────────────────────── */}
      <div
        id="player-history-drawer"
        className={`player-history-drawer${historyOpen ? ' open' : ''}`}
        aria-hidden={!historyOpen}
        role="dialog"
        aria-label="History"
      >
        <div className="player-drawer-header">
          <h3 className="player-heading text-lg font-semibold tracking-tight text-player-text">History</h3>
          <button
            className="player-drawer-close"
            onClick={() => setHistoryOpen(false)}
            aria-label="Close history"
          >
            ✕
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-player-muted" style={{ fontStyle: 'italic' }}>No choices made yet.</p>
        ) : (
          <ol className="list-decimal space-y-playerSm pl-5 text-sm text-player-muted">
            {history.map((item: HistoryItem, idx: number) => (
              <li key={`${item.passage}-${idx}`}>
                {item.choiceText} → {item.target}
              </li>
            ))}
          </ol>
        )}
      </div>

    </section>
  );
}
