import { validateConditionSyntax } from './conditionEvaluator';

export type StoryValidationResult = {
  ok: boolean;
  data: StoryData | null;
  warnings: string[];
  errors: string[];
};

export type StoryData = {
  title?: string;
  metadata?: Record<string, unknown>;
  variables: {
    inventory: Record<string, unknown>;
    relationships: Record<string, number>;
    flags: Record<string, boolean>;
  };
  passages: Record<string, { text: string; choices: StoryChoice[]; position?: { x: number; y: number; manualOverride?: boolean } }>;
};

export type StoryChoice = { text: string; target: string; condition?: string; effect?: string; [k: string]: unknown };

export type EffectOperator = '=' | '+=' | '-=';

export type StoryEffect = {
  root: 'inventory' | 'relationships' | 'flags';
  path: string;
  operator: EffectOperator;
  value: string | number | boolean;
};

export type ParseEffectResult = { ok: true; effect: StoryEffect } | { ok: false; error: string };

const EFFECT_ROOTS = new Set(['inventory', 'relationships', 'flags']);
const DANGEROUS_EFFECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parsePrimitiveValue(raw: string): string | number | boolean {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  const n = Number(v);
  if (!Number.isNaN(n) && v !== '') return n;
  return v;
}

export function parseStoryEffect(effect: string): ParseEffectResult {
  if (typeof effect !== 'string') return { ok: false, error: 'Effect must be a string.' };
  const input = effect.trim();
  if (!input) return { ok: false, error: 'Effect cannot be empty.' };

  const match = input.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*(\+=|-=|=)\s*(.+)$/);
  if (!match) return { ok: false, error: 'Invalid effect syntax.' };

  const [, rawPath, operator, rawValue] = match;
  const path = rawPath.trim();
  const valueText = rawValue.trim();
  const segments = path.split('.');
  const [rootSegment] = segments;
  if (!EFFECT_ROOTS.has(rootSegment)) return { ok: false, error: `Unsupported effect root "${rootSegment}".` };
  const root = rootSegment as StoryEffect['root'];
  if (segments.length < 2) return { ok: false, error: 'Effect path must include a key after the root.' };

  for (const segment of segments) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) return { ok: false, error: `Invalid effect path segment "${segment}".` };
    if (DANGEROUS_EFFECT_KEYS.has(segment)) return { ok: false, error: `Disallowed effect path segment "${segment}".` };
  }

  if (root === 'relationships') {
    if (operator !== '+=' && operator !== '-=') return { ok: false, error: 'relationships.* effects must use += or -=.' };
    const amount = Number(valueText);
    if (!Number.isFinite(amount)) return { ok: false, error: 'relationships.* effect value must be numeric.' };
    return { ok: true, effect: { root, path, operator, value: amount } };
  }

  if (root === 'flags') {
    if (operator !== '=') return { ok: false, error: 'flags.* effects must use =.' };
    if (valueText !== 'true' && valueText !== 'false') return { ok: false, error: 'flags.* effect value must be true/false.' };
    return { ok: true, effect: { root, path, operator, value: valueText === 'true' } };
  }

  if (operator !== '=') return { ok: false, error: 'inventory.* effects must use =.' };
  return { ok: true, effect: { root, path, operator, value: parsePrimitiveValue(valueText) } };
}

export function validateAndNormalizeStory(input: unknown): StoryValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!isPlainObject(input)) return { ok: false, data: null, warnings, errors: ['Story must be an object.'] };

  const normalized: Partial<StoryData> = { ...input } as StoryData;
  const rawVariables = input.variables;
  const normalizedVariables = { inventory: {}, relationships: {}, flags: {} };

  if (isPlainObject(rawVariables)) {
    (['inventory', 'relationships', 'flags'] as const).forEach((key) => {
      const value = rawVariables[key];
      if (isPlainObject(value)) (normalizedVariables as Record<string, unknown>)[key] = value;
    });
  } else {
    warnings.push('Missing/invalid variables; using defaults.');
  }

  normalized.variables = normalizedVariables as StoryData['variables'];
  const rawPassages = input.passages;
  if (!isPlainObject(rawPassages)) return { ok: false, data: null, warnings, errors: ['Story must include passages map.'] };

  const normalizedPassages: StoryData['passages'] = {};
  Object.entries(rawPassages).forEach(([id, passage]) => {
    if (!isPlainObject(passage) || typeof passage.text !== 'string') {
      errors.push(`Passage "${id}" invalid.`);
      return;
    }

    const choices: StoryChoice[] = [];
    if (Array.isArray(passage.choices)) {
      passage.choices.forEach((choice) => {
        if (isPlainObject(choice) && typeof choice.text === 'string' && typeof choice.target === 'string') {
          const condition = typeof choice.condition === 'string' ? choice.condition : undefined;
          if (condition) {
            const syntaxError = validateConditionSyntax(condition);
            if (syntaxError) {
              warnings.push(`Passage "${id}" choice "${choice.text}": condition syntax error — ${syntaxError}`);
            }
          }
          choices.push({
            text: choice.text,
            target: choice.target,
            condition,
            effect: typeof choice.effect === 'string' ? choice.effect : undefined
          });
        }
      });
    }

    normalizedPassages[id] = { ...(passage as Record<string, never>), text: passage.text, choices };
  });

  normalized.passages = normalizedPassages;
  if (Object.keys(normalizedPassages).length === 0) errors.push('Story has no valid passages.');
  return { ok: errors.length === 0, data: errors.length === 0 ? (normalized as StoryData) : null, warnings, errors };
}
