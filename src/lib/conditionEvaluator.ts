/**
 * Safe condition evaluator for Pocket Stories.
 *
 * Replaces the `new Function()` approach. Supports the operator set documented
 * in spec.md: ==, !=, >=, <=, >, <, &&, ||, !
 * Variable paths: inventory.x, relationships.x, flags.x
 * Literals: numbers, true, false
 * Parentheses for grouping.
 *
 * String literals are intentionally not supported — the story format only uses
 * numeric and boolean variable values in conditions.
 */

type VarState = {
  inventory: Record<string, unknown>;
  relationships: Record<string, number>;
  flags: Record<string, boolean>;
};

type Token =
  | { type: 'ident'; value: string }
  | { type: 'number'; value: number }
  | { type: 'bool'; value: boolean }
  | { type: 'op'; value: '==' | '!=' | '>=' | '<=' | '>' | '<' }
  | { type: 'and' }
  | { type: 'or' }
  | { type: 'bang' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'eof' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }

    // Two-char tokens
    const two = input.slice(i, i + 2);
    if (two === '==') { tokens.push({ type: 'op', value: '==' }); i += 2; continue; }
    if (two === '!=') { tokens.push({ type: 'op', value: '!=' }); i += 2; continue; }
    if (two === '>=') { tokens.push({ type: 'op', value: '>=' }); i += 2; continue; }
    if (two === '<=') { tokens.push({ type: 'op', value: '<=' }); i += 2; continue; }
    if (two === '&&') { tokens.push({ type: 'and' }); i += 2; continue; }
    if (two === '||') { tokens.push({ type: 'or' }); i += 2; continue; }

    // One-char tokens
    const ch = input[i];
    if (ch === '>') { tokens.push({ type: 'op', value: '>' }); i++; continue; }
    if (ch === '<') { tokens.push({ type: 'op', value: '<' }); i++; continue; }
    if (ch === '!') { tokens.push({ type: 'bang' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }

    // Negative number: '-' followed immediately by a digit
    if (ch === '-' && i + 1 < input.length && /[0-9]/.test(input[i + 1])) {
      const start = i++;
      while (i < input.length && /[0-9]/.test(input[i])) i++;
      if (i < input.length && input[i] === '.') {
        i++;
        while (i < input.length && /[0-9]/.test(input[i])) i++;
      }
      tokens.push({ type: 'number', value: Number(input.slice(start, i)) });
      continue;
    }

    // Positive number
    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < input.length && /[0-9]/.test(input[i])) i++;
      if (i < input.length && input[i] === '.') {
        i++;
        while (i < input.length && /[0-9]/.test(input[i])) i++;
      }
      tokens.push({ type: 'number', value: Number(input.slice(start, i)) });
      continue;
    }

    // Identifier or keyword — dots allowed inside to capture full paths like inventory.key
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      while (i < input.length && /[A-Za-z0-9_.]/.test(input[i])) i++;
      const word = input.slice(start, i);
      if (word === 'true')  { tokens.push({ type: 'bool', value: true }); continue; }
      if (word === 'false') { tokens.push({ type: 'bool', value: false }); continue; }
      tokens.push({ type: 'ident', value: word });
      continue;
    }

    throw new Error(`Unexpected character '${ch}' in condition`);
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

function resolvePath(path: string, vars: VarState): unknown {
  const [root, ...rest] = path.split('.');
  const category = (vars as unknown as Record<string, unknown>)[root];
  if (category === undefined || category === null) return undefined;
  return rest.reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, category);
}

class Parser {
  private readonly tokens: Token[];
  private pos = 0;
  private readonly vars: VarState;

  constructor(tokens: Token[], vars: VarState) {
    this.tokens = tokens;
    this.vars = vars;
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }

  parse(): boolean {
    const result = this.parseOr();
    if (this.peek().type !== 'eof') throw new Error('Unexpected token after expression');
    return result;
  }

  private parseOr(): boolean {
    let left = this.parseAnd();
    while (this.peek().type === 'or') {
      this.consume();
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  private parseAnd(): boolean {
    let left = this.parseNot();
    while (this.peek().type === 'and') {
      this.consume();
      const right = this.parseNot();
      left = left && right;
    }
    return left;
  }

  private parseNot(): boolean {
    if (this.peek().type === 'bang') {
      this.consume();
      return !this.parseNot();
    }
    if (this.peek().type === 'lparen') {
      this.consume();
      const result = this.parseOr();
      if (this.peek().type !== 'rparen') throw new Error('Expected closing parenthesis');
      this.consume();
      return result;
    }
    return this.parseCompare();
  }

  private parseCompare(): boolean {
    const left = this.parseAtom();
    const next = this.peek();
    if (next.type === 'op') {
      this.consume();
      const right = this.parseAtom();
      // eslint-disable-next-line eqeqeq
      if (next.value === '==') return left == right;
      // eslint-disable-next-line eqeqeq
      if (next.value === '!=') return left != right;
      if (next.value === '>=') return (left as number) >= (right as number);
      if (next.value === '<=') return (left as number) <= (right as number);
      if (next.value === '>')  return (left as number) >  (right as number);
      if (next.value === '<')  return (left as number) <  (right as number);
    }
    // Bare value — truthy check
    return Boolean(left);
  }

  private parseAtom(): unknown {
    const tok = this.peek();
    if (tok.type === 'number') { this.consume(); return tok.value; }
    if (tok.type === 'bool')   { this.consume(); return tok.value; }
    if (tok.type === 'ident')  { this.consume(); return resolvePath(tok.value, this.vars); }
    if (tok.type === 'lparen') {
      this.consume();
      const result = this.parseOr();
      if (this.peek().type !== 'rparen') throw new Error('Expected closing parenthesis');
      this.consume();
      return result;
    }
    throw new Error(`Unexpected token type '${tok.type}' in expression`);
  }
}

/**
 * Evaluate a condition string against the current variable state.
 * Returns false on any parse or evaluation error.
 */
export function evalCondition(condition: string, vars: VarState): boolean {
  try {
    const tokens = tokenize(condition);
    const parser = new Parser(tokens, vars);
    return parser.parse();
  } catch {
    return false;
  }
}

/**
 * Validate a condition string's syntax without evaluating it.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateConditionSyntax(condition: string): string | null {
  try {
    const tokens = tokenize(condition);
    const parser = new Parser(tokens, { inventory: {}, relationships: {}, flags: {} });
    parser.parse();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
