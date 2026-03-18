import { describe, it, expect } from 'vitest';
import { validateAndNormalizeStory, parseStoryEffect } from './storyValidator';

// Minimal valid story with only a start passage
const minimalStory = {
  passages: {
    start: {
      text: 'You stand at a crossroads.',
    },
  },
};

// Valid story with variables
const storyWithVariables = {
  title: 'My Story',
  variables: {
    inventory: { key: false },
    relationships: { Guard: 0 },
    flags: { door_open: false },
  },
  passages: {
    start: {
      text: 'Opening text.',
      choices: [
        { text: 'Use key', target: 'unlocked', condition: 'inventory.key == true', effect: 'flags.door_open = true' },
      ],
    },
    unlocked: {
      text: 'The door opens.',
    },
  },
};

describe('validateAndNormalizeStory', () => {
  describe('valid minimal story (just passages.start)', () => {
    it('returns ok: true', () => {
      const result = validateAndNormalizeStory(minimalStory);
      expect(result.ok).toBe(true);
    });

    it('returns no errors', () => {
      const result = validateAndNormalizeStory(minimalStory);
      expect(result.errors).toHaveLength(0);
    });

    it('returns normalized data with default variables', () => {
      const result = validateAndNormalizeStory(minimalStory);
      expect(result.data).not.toBeNull();
      expect(result.data!.variables).toEqual({ inventory: {}, relationships: {}, flags: {} });
    });

    it('normalizes passage with empty choices array', () => {
      const result = validateAndNormalizeStory(minimalStory);
      expect(result.data!.passages.start.choices).toEqual([]);
    });

    it('produces a warning for missing variables', () => {
      const result = validateAndNormalizeStory(minimalStory);
      expect(result.warnings.some((w) => w.includes('variables'))).toBe(true);
    });
  });

  describe('valid story with variables', () => {
    it('returns ok: true', () => {
      const result = validateAndNormalizeStory(storyWithVariables);
      expect(result.ok).toBe(true);
    });

    it('returns no errors', () => {
      const result = validateAndNormalizeStory(storyWithVariables);
      expect(result.errors).toHaveLength(0);
    });

    it('preserves title', () => {
      const result = validateAndNormalizeStory(storyWithVariables);
      expect(result.data!.title).toBe('My Story');
    });

    it('preserves inventory variables', () => {
      const result = validateAndNormalizeStory(storyWithVariables);
      expect(result.data!.variables.inventory).toEqual({ key: false });
    });

    it('preserves relationships variables', () => {
      const result = validateAndNormalizeStory(storyWithVariables);
      expect(result.data!.variables.relationships).toEqual({ Guard: 0 });
    });

    it('preserves flags variables', () => {
      const result = validateAndNormalizeStory(storyWithVariables);
      expect(result.data!.variables.flags).toEqual({ door_open: false });
    });

    it('normalizes choices array', () => {
      const result = validateAndNormalizeStory(storyWithVariables);
      const choices = result.data!.passages.start.choices;
      expect(choices).toHaveLength(1);
      expect(choices[0].text).toBe('Use key');
      expect(choices[0].target).toBe('unlocked');
    });
  });

  describe('story with choices array', () => {
    const storyWithChoices = {
      passages: {
        start: {
          text: 'A fork in the road.',
          choices: [
            { text: 'Go left', target: 'left' },
            { text: 'Go right', target: 'right' },
          ],
        },
        left: { text: 'You went left.' },
        right: { text: 'You went right.' },
      },
    };

    it('normalizes multiple choices', () => {
      const result = validateAndNormalizeStory(storyWithChoices);
      expect(result.data!.passages.start.choices).toHaveLength(2);
    });

    it('choices have correct text and target', () => {
      const result = validateAndNormalizeStory(storyWithChoices);
      const choices = result.data!.passages.start.choices;
      expect(choices[0].text).toBe('Go left');
      expect(choices[0].target).toBe('left');
      expect(choices[1].text).toBe('Go right');
      expect(choices[1].target).toBe('right');
    });
  });

  describe('story with unknown passage targets (produces warnings)', () => {
    // The validator does not check whether targets exist, so this is OK.
    // Targets to non-existent passages are a runtime concern, not validation.
    // Actually, re-reading the source: the validator does NOT warn about missing targets.
    // We test that the story is still valid with those choices.
    it('is valid even if a choice targets a non-existent passage', () => {
      const story = {
        passages: {
          start: {
            text: 'Start.',
            choices: [{ text: 'Go somewhere', target: 'nonexistent' }],
          },
        },
      };
      const result = validateAndNormalizeStory(story);
      // The validator doesn't check target existence, so it should still be ok
      expect(result.ok).toBe(true);
    });
  });

  describe('story with bad condition syntax (produces warnings)', () => {
    it('produces a warning for bad condition syntax', () => {
      const story = {
        passages: {
          start: {
            text: 'Start.',
            choices: [
              { text: 'Invalid choice', target: 'end', condition: 'inventory.key @ true' },
            ],
          },
          end: { text: 'End.' },
        },
      };
      const result = validateAndNormalizeStory(story);
      expect(result.warnings.some((w) => w.includes('condition syntax error'))).toBe(true);
    });

    it('still returns ok: true when only warnings exist', () => {
      const story = {
        passages: {
          start: {
            text: 'Start.',
            choices: [
              { text: 'Invalid choice', target: 'end', condition: 'inventory.key @ true' },
            ],
          },
          end: { text: 'End.' },
        },
      };
      const result = validateAndNormalizeStory(story);
      expect(result.ok).toBe(true);
    });
  });

  describe('story with invalid variable types (produces errors)', () => {
    it('invalid passage (missing text) produces an error', () => {
      const story = {
        passages: {
          start: { notText: 'This is wrong' },
        },
      };
      const result = validateAndNormalizeStory(story);
      expect(result.errors.some((e) => e.includes('start'))).toBe(true);
    });

    it('all passages invalid results in ok: false', () => {
      const story = {
        passages: {
          start: { notText: 'This is wrong' },
        },
      };
      const result = validateAndNormalizeStory(story);
      expect(result.ok).toBe(false);
    });

    it('data is null when ok is false', () => {
      const story = {
        passages: {
          start: { notText: 'This is wrong' },
        },
      };
      const result = validateAndNormalizeStory(story);
      expect(result.data).toBeNull();
    });
  });

  describe('empty input (produces errors)', () => {
    it('null input produces errors', () => {
      const result = validateAndNormalizeStory(null);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.ok).toBe(false);
    });

    it('undefined input produces errors', () => {
      const result = validateAndNormalizeStory(undefined);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.ok).toBe(false);
    });

    it('empty string input produces errors', () => {
      const result = validateAndNormalizeStory('');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.ok).toBe(false);
    });

    it('object without passages produces errors', () => {
      const result = validateAndNormalizeStory({ title: 'No passages here' });
      expect(result.errors.some((e) => e.includes('passages'))).toBe(true);
      expect(result.ok).toBe(false);
    });

    it('empty passages object produces an error', () => {
      const result = validateAndNormalizeStory({ passages: {} });
      expect(result.errors.some((e) => e.includes('no valid passages') || e.includes('passages'))).toBe(true);
      expect(result.ok).toBe(false);
    });
  });
});

describe('parseStoryEffect', () => {
  describe('valid inventory effect', () => {
    it('parses inventory assignment', () => {
      const result = parseStoryEffect('inventory.key = true');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.effect.root).toBe('inventory');
        expect(result.effect.path).toBe('inventory.key');
        expect(result.effect.operator).toBe('=');
        expect(result.effect.value).toBe(true);
      }
    });

    it('parses inventory assignment with false', () => {
      const result = parseStoryEffect('inventory.key = false');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.effect.value).toBe(false);
      }
    });

    it('parses inventory assignment with numeric value', () => {
      const result = parseStoryEffect('inventory.coins = 10');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.effect.value).toBe(10);
      }
    });
  });

  describe('valid relationships effect', () => {
    it('parses relationships += effect', () => {
      const result = parseStoryEffect('relationships.Guard += 5');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.effect.root).toBe('relationships');
        expect(result.effect.path).toBe('relationships.Guard');
        expect(result.effect.operator).toBe('+=');
        expect(result.effect.value).toBe(5);
      }
    });

    it('parses relationships -= effect', () => {
      const result = parseStoryEffect('relationships.Guard -= 3');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.effect.operator).toBe('-=');
        expect(result.effect.value).toBe(3);
      }
    });

    it('rejects relationships = effect (must use += or -=)', () => {
      const result = parseStoryEffect('relationships.Guard = 5');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('relationships');
      }
    });
  });

  describe('valid flags effect', () => {
    it('parses flags = true effect', () => {
      const result = parseStoryEffect('flags.door_open = true');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.effect.root).toBe('flags');
        expect(result.effect.path).toBe('flags.door_open');
        expect(result.effect.operator).toBe('=');
        expect(result.effect.value).toBe(true);
      }
    });

    it('parses flags = false effect', () => {
      const result = parseStoryEffect('flags.door_open = false');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.effect.value).toBe(false);
      }
    });

    it('rejects flags += effect (must use =)', () => {
      const result = parseStoryEffect('flags.door_open += true');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('flags');
      }
    });

    it('rejects flags with non-boolean value', () => {
      const result = parseStoryEffect('flags.door_open = open');
      expect(result.ok).toBe(false);
    });
  });

  describe('invalid format returns error', () => {
    it('empty string returns error', () => {
      const result = parseStoryEffect('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });

    it('missing operator returns error', () => {
      const result = parseStoryEffect('inventory.key true');
      expect(result.ok).toBe(false);
    });

    it('unsupported root returns error', () => {
      const result = parseStoryEffect('customRoot.key = true');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('customRoot');
      }
    });

    it('path without key (just root) returns error', () => {
      const result = parseStoryEffect('inventory = true');
      expect(result.ok).toBe(false);
    });

    it('non-string input returns error', () => {
      // @ts-expect-error testing invalid input
      const result = parseStoryEffect(42);
      expect(result.ok).toBe(false);
    });

    it('dangerous key __proto__ returns error', () => {
      const result = parseStoryEffect('inventory.__proto__ = true');
      expect(result.ok).toBe(false);
    });
  });
});
