import { useEffect, useState } from 'react';
import type { StoryData } from '../lib/storyValidator';

type Choice = { text: string; target: string; condition: string; effect: string };
type ClauseParts = { varPath: string; op: string; value: string };

type Props = {
  story: StoryData | null;
  onStoryChange: (s: StoryData) => void;
  setStoryStatus: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
};

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// ---------------------------------------------------------------------------
// Variable helpers

type VarInfo = { path: string; defaultValue: unknown; namespace: string };

function getVarPaths(story: StoryData): VarInfo[] {
  const result: VarInfo[] = [];
  const vars = story.variables || {};
  for (const ns of ['inventory', 'relationships', 'flags'] as const) {
    const nsVars = (vars[ns] || {}) as Record<string, unknown>;
    for (const key of Object.keys(nsVars)) {
      result.push({ path: `${ns}.${key}`, defaultValue: nsVars[key], namespace: ns });
    }
  }
  return result;
}

/** Operators allowed for each namespace in effects. */
function effectOpsFor(namespace: string): string[] {
  return namespace === 'relationships' ? ['+=', '-=', '='] : ['='];
}

// ---------------------------------------------------------------------------
// Simple clause parsers

function parseSimpleCondition(s: string): ClauseParts | null {
  const m = s.match(/^(\S+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) return null;
  return { varPath: m[1].trim(), op: m[2], value: m[3].trim() };
}

function parseSimpleEffect(s: string): ClauseParts | null {
  // Order matters: try += and -= before = to avoid partial matches
  const m = s.match(/^(\S+)\s*(\+=|-=|=)\s*(.+)$/);
  if (!m) return null;
  return { varPath: m[1].trim(), op: m[2], value: m[3].trim() };
}

// ---------------------------------------------------------------------------
// Clause builder sub-components

function ConditionField({
  value, onChange, onBlur, varInfos,
}: { value: string; onChange: (v: string) => void; onBlur: () => void; varInfos: VarInfo[] }) {
  const parsed = value ? parseSimpleCondition(value) : null;
  const isComplex = value && !parsed;

  // Complex multi-clause condition → raw text fallback
  if (isComplex) {
    return (
      <input className="ice-cond" type="text" value={value}
        placeholder="condition"
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur} />
    );
  }

  const vp = parsed?.varPath ?? '';
  const op = parsed?.op ?? '==';
  const val = parsed?.value ?? '';
  const varInfo = varInfos.find(v => v.path === vp);
  const isBool = varInfo && typeof varInfo.defaultValue === 'boolean';
  const isNum = varInfo && typeof varInfo.defaultValue === 'number';

  return (
    <div className="mev-clause-builder mev-cond-builder">
      <select className="clause-var"
        value={vp}
        onChange={e => {
          const newVar = e.target.value;
          if (!newVar) { onChange(''); return; }
          const newInfo = varInfos.find(v => v.path === newVar);
          const defVal = newInfo?.namespace === 'flags' ? 'true' : '0';
          onChange(`${newVar} ${op} ${val || defVal}`);
        }}
        onBlur={onBlur}
      >
        <option value="">— condition —</option>
        {varInfos.map(v => <option key={v.path} value={v.path}>{v.path}</option>)}
      </select>
      {vp && (
        <>
          <select className="clause-op"
            value={op}
            onChange={e => onChange(`${vp} ${e.target.value} ${val}`)}
            onBlur={onBlur}
          >
            {['==', '!=', '>=', '<=', '>', '<'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {isBool
            ? (
              <select className="clause-val"
                value={val === 'false' ? 'false' : 'true'}
                onChange={e => onChange(`${vp} ${op} ${e.target.value}`)}
                onBlur={onBlur}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            )
            : (
              <input className="clause-val" type={isNum ? 'number' : 'text'}
                value={val}
                placeholder={isNum ? '0' : 'value'}
                onChange={e => onChange(`${vp} ${op} ${e.target.value}`)}
                onBlur={onBlur} />
            )}
        </>
      )}
    </div>
  );
}

function EffectField({
  value, onChange, onBlur, varInfos,
}: { value: string; onChange: (v: string) => void; onBlur: () => void; varInfos: VarInfo[] }) {
  const parsed = value ? parseSimpleEffect(value) : null;
  const isComplex = value && !parsed;

  if (isComplex) {
    return (
      <input className="ice-effect" type="text" value={value}
        placeholder="effect"
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur} />
    );
  }

  const vp = parsed?.varPath ?? '';
  const op = parsed?.op ?? '=';
  const val = parsed?.value ?? '';
  const varInfo = varInfos.find(v => v.path === vp);
  const isBool = varInfo && typeof varInfo.defaultValue === 'boolean';
  const isNum = varInfo && typeof varInfo.defaultValue === 'number';
  const opsAllowed = varInfo ? effectOpsFor(varInfo.namespace) : ['=', '+=', '-='];
  const safeOp = opsAllowed.includes(op) ? op : opsAllowed[0];

  return (
    <div className="mev-clause-builder mev-effect-builder">
      <select className="clause-var"
        value={vp}
        onChange={e => {
          const newVar = e.target.value;
          if (!newVar) { onChange(''); return; }
          const newInfo = varInfos.find(v => v.path === newVar);
          const newOp = effectOpsFor(newInfo?.namespace ?? '')[0];
          const defVal = newInfo?.namespace === 'flags' ? 'true'
            : newInfo?.namespace === 'relationships' ? '1' : '1';
          onChange(`${newVar} ${newOp} ${val || defVal}`);
        }}
        onBlur={onBlur}
      >
        <option value="">— no effect —</option>
        {varInfos.map(v => <option key={v.path} value={v.path}>{v.path}</option>)}
      </select>
      {vp && (
        <>
          <select className="clause-op"
            value={safeOp}
            onChange={e => onChange(`${vp} ${e.target.value} ${val}`)}
            onBlur={onBlur}
          >
            {opsAllowed.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {isBool
            ? (
              <select className="clause-val"
                value={val === 'false' ? 'false' : 'true'}
                onChange={e => onChange(`${vp} ${safeOp} ${e.target.value}`)}
                onBlur={onBlur}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            )
            : (
              <input className="clause-val" type={isNum ? 'number' : 'text'}
                value={val}
                placeholder={isNum ? '0' : 'value'}
                onChange={e => onChange(`${vp} ${safeOp} ${e.target.value}`)}
                onBlur={onBlur} />
            )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passage status badge

function getPassageStatus(passageId: string, story: StoryData) {
  const p = story.passages[passageId];
  const choices = p?.choices || [];
  const hasDangling = choices.some(ch => ch.target && !story.passages[ch.target]);
  if (hasDangling) return { text: '✖ Dangling ref', cls: 'badge-error' };
  if (choices.length === 0 && passageId !== 'start') return { text: '⊙ Ending', cls: 'badge-info' };
  return { text: '✓ OK', cls: 'badge-ok' };
}

function nextPassageId(passages: StoryData['passages']): string {
  let n = 1;
  while (passages[`passage_${n}`]) n++;
  return `passage_${n}`;
}

// ---------------------------------------------------------------------------
// Main component

export function MobileEditorView({ story, onStoryChange, setStoryStatus }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localText, setLocalText] = useState('');
  const [localChoices, setLocalChoices] = useState<Choice[]>([]);
  const [localId, setLocalId] = useState('');
  const [idError, setIdError] = useState('');

  // Re-initialise local state only when switching to a different passage
  useEffect(() => {
    if (!editingId || !story?.passages[editingId]) return;
    const p = story.passages[editingId];
    setLocalText((p.text || '').trim());
    setLocalChoices(
      (p.choices || []).map(ch => ({
        text: ch.text || '',
        target: ch.target || '',
        condition: ch.condition || '',
        effect: ch.effect || '',
      }))
    );
    setLocalId(editingId);
    setIdError('');
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Helpers -----------------------------------------------------------------

  function buildStory(id: string, text: string, choices: Choice[], base: StoryData): StoryData {
    const passages = { ...base.passages };
    passages[id] = {
      ...passages[id],
      text: text.trimEnd() + '\n',
      choices: choices
        .filter(ch => ch.text.trim() || ch.target.trim())
        .map(ch => ({
          text: ch.text.trim(),
          target: ch.target.trim(),
          ...(ch.condition.trim() ? { condition: ch.condition.trim() } : {}),
          ...(ch.effect.trim() ? { effect: ch.effect.trim() } : {}),
        })),
    };
    return { ...base, passages };
  }

  function commitPassage(text = localText, choices = localChoices) {
    if (!editingId || !story) return;
    onStoryChange(structuredClone(buildStory(editingId, text, choices, story)));
  }

  function applyIdRename() {
    if (!editingId || !story) return;
    const newId = localId.trim();
    if (!newId || newId === editingId) { setIdError(''); return; }
    if (!ID_PATTERN.test(newId)) {
      setIdError('ID must contain only letters, digits, _ or -');
      setLocalId(editingId);
      return;
    }
    if (story.passages[newId]) {
      setIdError(`"${newId}" already exists.`);
      setLocalId(editingId);
      return;
    }
    setIdError('');

    const base = buildStory(editingId, localText, localChoices, story);
    const passages = { ...base.passages };
    passages[newId] = passages[editingId];
    delete passages[editingId];

    Object.values(passages).forEach(p => {
      (p.choices || []).forEach(ch => {
        if (ch.target === editingId) ch.target = newId;
      });
    });

    onStoryChange(structuredClone({ ...base, passages }));
    setEditingId(newId);
    setStoryStatus(`Renamed "${editingId}" → "${newId}"`, 'success');
  }

  function handleBack() {
    commitPassage();
    setEditingId(null);
  }

  function addPassage() {
    if (!story) return;
    const newId = nextPassageId(story.passages);
    const passages = { ...story.passages, [newId]: { text: '\n', choices: [] } };
    onStoryChange(structuredClone({ ...story, passages }));
    setEditingId(newId);
  }

  function deletePassage() {
    if (!editingId || !story) return;
    if (!window.confirm(`Delete passage "${editingId}"? This cannot be undone.`)) return;
    const passages = { ...story.passages };
    delete passages[editingId];
    Object.values(passages).forEach(p => {
      (p.choices || []).forEach(ch => { if (ch.target === editingId) ch.target = ''; });
    });
    onStoryChange(structuredClone({ ...story, passages }));
    setEditingId(null);
    setStoryStatus(`Deleted passage "${editingId}"`, 'info');
  }

  function updateChoice(idx: number, patch: Partial<Choice>, andCommit = false) {
    const next = localChoices.map((ch, i) => i === idx ? { ...ch, ...patch } : ch);
    setLocalChoices(next);
    if (andCommit) commitPassage(localText, next);
  }

  function removeChoice(idx: number) {
    const next = localChoices.filter((_, i) => i !== idx);
    setLocalChoices(next);
    commitPassage(localText, next);
  }

  // --- No story loaded ---------------------------------------------------------

  if (!story) {
    return (
      <div className="mev-shell">
        <div className="mev-top-bar">
          <span className="mev-story-title">Editor</span>
        </div>
        <p className="mev-empty-hint">Load a story using the header to start editing.</p>
      </div>
    );
  }

  const passageIds = Object.keys(story.passages).sort((a, b) => {
    if (a === 'start') return -1;
    if (b === 'start') return 1;
    return a.localeCompare(b);
  });

  const varInfos = getVarPaths(story);

  // --- Passage detail editor ---------------------------------------------------

  if (editingId && story.passages[editingId]) {
    return (
      <div className="mev-shell">

        {/* Header */}
        <div className="mev-detail-header">
          <button className="mev-back-btn" onClick={handleBack} aria-label="Back to passage list">
            ← Back
          </button>
          <div className="mev-id-field">
            <input
              className="mev-id-input"
              type="text"
              value={localId}
              aria-label="Passage ID"
              onChange={e => { setLocalId(e.target.value); setIdError(''); }}
              onBlur={applyIdRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                if (e.key === 'Escape') { setLocalId(editingId); setIdError(''); (e.target as HTMLInputElement).blur(); }
              }}
            />
            {idError && <small className="inspector-id-error">{idError}</small>}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="mev-detail-body">

          {/* Passage text */}
          <label className="mev-field-label" htmlFor="mev-text-input">Passage Text</label>
          <textarea
            id="mev-text-input"
            className="mev-text-input"
            value={localText}
            rows={8}
            placeholder="Enter the passage text shown to the reader…"
            onChange={e => setLocalText(e.target.value)}
            onBlur={() => commitPassage()}
          />

          {/* Choices */}
          <div className="mev-choices-heading">
            <span className="mev-field-label">Choices</span>
            <span className="inspector-meta-pill">
              {localChoices.length} choice{localChoices.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="inspector-choices-editor">
            {localChoices.map((ch, idx) => (
              <div key={idx} className="inspector-choice-editor">
                <div className="ice-row-main">
                  <span className="ice-num">{idx + 1}.</span>
                  <input
                    className="ice-text"
                    type="text"
                    placeholder="Choice text…"
                    value={ch.text}
                    onChange={e => updateChoice(idx, { text: e.target.value })}
                    onBlur={() => commitPassage()}
                  />
                  {/* Target: native <select> for reliable mobile dropdown */}
                  <select
                    className="ice-target"
                    value={ch.target}
                    onChange={e => updateChoice(idx, { target: e.target.value })}
                    onBlur={() => commitPassage()}
                  >
                    <option value="">— target —</option>
                    {passageIds.map(id => <option key={id} value={id}>{id}</option>)}
                    {ch.target && !story.passages[ch.target] && (
                      <option value={ch.target}>{ch.target} ⚠</option>
                    )}
                  </select>
                  <button
                    type="button"
                    className="ice-delete"
                    title="Delete this choice"
                    onClick={() => removeChoice(idx)}
                  >✕</button>
                </div>
                <div className="ice-row-meta">
                  <ConditionField
                    value={ch.condition}
                    onChange={v => updateChoice(idx, { condition: v })}
                    onBlur={() => commitPassage()}
                    varInfos={varInfos}
                  />
                  <EffectField
                    value={ch.effect}
                    onChange={v => updateChoice(idx, { effect: v })}
                    onBlur={() => commitPassage()}
                    varInfos={varInfos}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="inspector-add-choice-btn"
            onClick={() => setLocalChoices([
              ...localChoices,
              { text: '', target: '', condition: '', effect: '' },
            ])}
          >
            + Add Choice
          </button>

          {/* Delete zone */}
          <div className="mev-delete-zone">
            <button type="button" className="mev-btn-danger" onClick={deletePassage}>
              Delete Passage
            </button>
          </div>

        </div>
      </div>
    );
  }

  // --- Passage list ------------------------------------------------------------

  return (
    <div className="mev-shell">

      <div className="mev-top-bar">
        <span className="mev-story-title">{story.title || 'Untitled Story'}</span>
        <div className="mev-top-actions">
          <button
            className="mev-btn"
            onClick={() => (window as any).setAppMode?.('player')}
          >
            ▶ Play
          </button>
          <button className="mev-btn mev-btn-primary" onClick={addPassage}>
            + New
          </button>
        </div>
      </div>

      <div className="mev-list-scroll">
        {passageIds.length === 0 && (
          <p className="mev-empty-hint">No passages yet. Tap <strong>+ New</strong> to create one.</p>
        )}
        {passageIds.map(id => {
          const p = story.passages[id];
          const status = getPassageStatus(id, story);
          const excerpt = (p.text || '').trim().slice(0, 120) || '(no text)';
          const choiceCount = (p.choices || []).length;
          return (
            <div
              key={id}
              className="mev-passage-card"
              role="button"
              tabIndex={0}
              onClick={() => setEditingId(id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditingId(id); }}
            >
              <div className="mev-card-header">
                <span className="mev-card-id">{id}</span>
                <span className={`inspector-badge ${status.cls}`}>{status.text}</span>
              </div>
              <p className="mev-card-excerpt">{excerpt}</p>
              <p className="mev-card-meta">{choiceCount} choice{choiceCount !== 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

    </div>
  );
}
