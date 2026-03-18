import { describe, it, expect } from 'vitest';
import { evalCondition, validateConditionSyntax } from './conditionEvaluator';

// Helper to create a standard variable state shape
const makeVars = (
  inventory: Record<string, unknown> = {},
  relationships: Record<string, number> = {},
  flags: Record<string, boolean> = {}
) => ({ inventory, relationships, flags });

const emptyVars = makeVars();

describe('evalCondition', () => {
  describe('basic comparisons', () => {
    it('== returns true when values are equal', () => {
      expect(evalCondition('1 == 1', emptyVars)).toBe(true);
    });

    it('== returns false when values differ', () => {
      expect(evalCondition('1 == 2', emptyVars)).toBe(false);
    });

    it('!= returns true when values differ', () => {
      expect(evalCondition('1 != 2', emptyVars)).toBe(true);
    });

    it('!= returns false when values are equal', () => {
      expect(evalCondition('1 != 1', emptyVars)).toBe(false);
    });

    it('>= returns true when left is greater', () => {
      expect(evalCondition('5 >= 3', emptyVars)).toBe(true);
    });

    it('>= returns true when values are equal', () => {
      expect(evalCondition('3 >= 3', emptyVars)).toBe(true);
    });

    it('>= returns false when left is less', () => {
      expect(evalCondition('2 >= 3', emptyVars)).toBe(false);
    });

    it('<= returns true when left is less', () => {
      expect(evalCondition('2 <= 3', emptyVars)).toBe(true);
    });

    it('<= returns true when values are equal', () => {
      expect(evalCondition('3 <= 3', emptyVars)).toBe(true);
    });

    it('<= returns false when left is greater', () => {
      expect(evalCondition('5 <= 3', emptyVars)).toBe(false);
    });

    it('> returns true when left is greater', () => {
      expect(evalCondition('5 > 3', emptyVars)).toBe(true);
    });

    it('> returns false when equal', () => {
      expect(evalCondition('3 > 3', emptyVars)).toBe(false);
    });

    it('< returns true when left is less', () => {
      expect(evalCondition('2 < 3', emptyVars)).toBe(true);
    });

    it('< returns false when equal', () => {
      expect(evalCondition('3 < 3', emptyVars)).toBe(false);
    });
  });

  describe('boolean literals', () => {
    it('bare true evaluates to true', () => {
      expect(evalCondition('true', emptyVars)).toBe(true);
    });

    it('bare false evaluates to false', () => {
      expect(evalCondition('false', emptyVars)).toBe(false);
    });

    it('true == true is true', () => {
      expect(evalCondition('true == true', emptyVars)).toBe(true);
    });

    it('true == false is false', () => {
      expect(evalCondition('true == false', emptyVars)).toBe(false);
    });

    it('false == false is true', () => {
      expect(evalCondition('false == false', emptyVars)).toBe(true);
    });
  });

  describe('numeric literals', () => {
    it('bare positive number is truthy', () => {
      expect(evalCondition('1', emptyVars)).toBe(true);
    });

    it('bare zero is falsy', () => {
      expect(evalCondition('0', emptyVars)).toBe(false);
    });

    it('negative number comparison works', () => {
      expect(evalCondition('-5 < 0', emptyVars)).toBe(true);
    });

    it('decimal number comparison works', () => {
      expect(evalCondition('1.5 > 1', emptyVars)).toBe(true);
    });
  });

  describe('dotted variable paths', () => {
    it('inventory.key resolves correctly', () => {
      const vars = makeVars({ key: true });
      expect(evalCondition('inventory.key == true', vars)).toBe(true);
    });

    it('inventory.key resolves false', () => {
      const vars = makeVars({ key: false });
      expect(evalCondition('inventory.key == true', vars)).toBe(false);
    });

    it('inventory.key with numeric value', () => {
      const vars = makeVars({ coins: 10 });
      expect(evalCondition('inventory.coins >= 5', vars)).toBe(true);
    });

    it('relationships.Guard resolves correctly', () => {
      const vars = makeVars({}, { Guard: 5 });
      expect(evalCondition('relationships.Guard >= 5', vars)).toBe(true);
    });

    it('relationships.Guard comparison with lower value', () => {
      const vars = makeVars({}, { Guard: 3 });
      expect(evalCondition('relationships.Guard >= 5', vars)).toBe(false);
    });

    it('flags.door_open resolves true', () => {
      const vars = makeVars({}, {}, { door_open: true });
      expect(evalCondition('flags.door_open == true', vars)).toBe(true);
    });

    it('flags.door_open resolves false', () => {
      const vars = makeVars({}, {}, { door_open: false });
      expect(evalCondition('flags.door_open == true', vars)).toBe(false);
    });

    it('undefined path returns undefined (falsy)', () => {
      const vars = makeVars();
      expect(evalCondition('inventory.missing == true', vars)).toBe(false);
    });
  });

  describe('logical AND (&&)', () => {
    it('true && true is true', () => {
      expect(evalCondition('true && true', emptyVars)).toBe(true);
    });

    it('true && false is false', () => {
      expect(evalCondition('true && false', emptyVars)).toBe(false);
    });

    it('false && true is false', () => {
      expect(evalCondition('false && true', emptyVars)).toBe(false);
    });

    it('false && false is false', () => {
      expect(evalCondition('false && false', emptyVars)).toBe(false);
    });

    it('chained AND with comparisons', () => {
      const vars = makeVars({ key: true }, { Guard: 5 });
      expect(evalCondition('inventory.key == true && relationships.Guard >= 5', vars)).toBe(true);
    });
  });

  describe('logical OR (||)', () => {
    it('true || false is true', () => {
      expect(evalCondition('true || false', emptyVars)).toBe(true);
    });

    it('false || true is true', () => {
      expect(evalCondition('false || true', emptyVars)).toBe(true);
    });

    it('false || false is false', () => {
      expect(evalCondition('false || false', emptyVars)).toBe(false);
    });

    it('true || true is true', () => {
      expect(evalCondition('true || true', emptyVars)).toBe(true);
    });
  });

  describe('NOT (!)', () => {
    it('!true is false', () => {
      expect(evalCondition('!true', emptyVars)).toBe(false);
    });

    it('!false is true', () => {
      expect(evalCondition('!false', emptyVars)).toBe(true);
    });

    it('double negation !!true is true', () => {
      expect(evalCondition('!!true', emptyVars)).toBe(true);
    });

    it('NOT with variable path', () => {
      const vars = makeVars({}, {}, { door_open: false });
      expect(evalCondition('!flags.door_open', vars)).toBe(true);
    });
  });

  describe('grouped expressions with parentheses', () => {
    it('parentheses change evaluation order', () => {
      // Without parens: false && false || true = (false && false) || true = true
      expect(evalCondition('false && false || true', emptyVars)).toBe(true);
      // With parens: false && (false || true) = false && true = false
      expect(evalCondition('false && (false || true)', emptyVars)).toBe(false);
    });

    it('nested parens work', () => {
      expect(evalCondition('(true && (true || false))', emptyVars)).toBe(true);
    });
  });

  describe('short-circuit evaluation', () => {
    // The parser does not implement real short-circuit (it evaluates both sides),
    // but the result should still be correct
    it('true || <anything> is true', () => {
      expect(evalCondition('true || false', emptyVars)).toBe(true);
    });

    it('false && <anything> is false', () => {
      expect(evalCondition('false && true', emptyVars)).toBe(false);
    });
  });

  describe('invalid syntax', () => {
    it('returns false on unexpected character', () => {
      expect(evalCondition('inventory.key @ true', emptyVars)).toBe(false);
    });

    it('returns false on unmatched parenthesis', () => {
      expect(evalCondition('(true', emptyVars)).toBe(false);
    });

    it('returns false on empty string', () => {
      expect(evalCondition('', emptyVars)).toBe(false);
    });

    it('returns false on dangling operator', () => {
      expect(evalCondition('true &&', emptyVars)).toBe(false);
    });
  });

  describe('works with full variables object shape', () => {
    it('evaluates with all three categories present', () => {
      const vars = {
        inventory: { key: true, coins: 10 },
        relationships: { Guard: 5 },
        flags: { door_open: false },
      };
      expect(evalCondition('inventory.key == true && relationships.Guard > 3 && !flags.door_open', vars)).toBe(true);
    });
  });
});

describe('validateConditionSyntax', () => {
  it('returns null for simple equality', () => {
    expect(validateConditionSyntax('1 == 1')).toBeNull();
  });

  it('returns null for boolean literal', () => {
    expect(validateConditionSyntax('true')).toBeNull();
  });

  it('returns null for dotted path comparison', () => {
    expect(validateConditionSyntax('inventory.key == true')).toBeNull();
  });

  it('returns null for logical AND expression', () => {
    expect(validateConditionSyntax('flags.door_open == true && relationships.Guard >= 5')).toBeNull();
  });

  it('returns null for logical OR expression', () => {
    expect(validateConditionSyntax('true || false')).toBeNull();
  });

  it('returns null for NOT expression', () => {
    expect(validateConditionSyntax('!flags.door_open')).toBeNull();
  });

  it('returns null for parenthesized expression', () => {
    expect(validateConditionSyntax('(true && false) || true')).toBeNull();
  });

  it('returns a non-null string for invalid character', () => {
    const result = validateConditionSyntax('inventory.key @ true');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('returns a non-null string for unmatched opening parenthesis', () => {
    const result = validateConditionSyntax('(true');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('returns a non-null string for trailing operator', () => {
    const result = validateConditionSyntax('true &&');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('returns a non-null string for extra closing parenthesis', () => {
    const result = validateConditionSyntax('true)');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});
