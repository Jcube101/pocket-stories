// player.js
let currentPassage = "start";
let variablesState = {};
let history = []; // [{passage, choiceText, target}]
let renderToken = 0;
let audioCtx = null;

function normalizeVariables(v = {}) {
    return {
        inventory: v.inventory || {},
        relationships: v.relationships || {},
        flags: v.flags || {}
    };
}

function initPlayer() {
    variablesState = JSON.parse(JSON.stringify(normalizeVariables(window.storyData.variables)));
    currentPassage = "start";
    history = [];
    renderPassage();
}

function startPlayer(startPassage = "start") {
    variablesState = JSON.parse(JSON.stringify(normalizeVariables(window.storyData.variables)));
    currentPassage = window.storyData.passages[startPassage] ? startPassage : "start";
    history = [];
    renderPassage();
}

window.startPlayer = startPlayer;

function getAudioContext() {
    if (!audioCtx && window.AudioContext) {
        audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

function playCue(type = 'click') {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    if (type === 'success') {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
    } else if (type === 'fail') {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
    } else {
        osc.frequency.setValueAtTime(420, ctx.currentTime);
    }

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
}

function revealTextTypewriter(el, text, token) {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
        el.textContent = text;
        return;
    }

    const chars = Array.from(text);
    const stepMs = text.length > 350 ? 5 : 12;
    let i = 0;
    el.textContent = '';

    const tick = () => {
        if (token !== renderToken) return;
        if (i >= chars.length) return;
        i += 1;
        el.textContent = chars.slice(0, i).join('');
        window.setTimeout(tick, stepMs);
    };

    tick();
}

function renderPassage() {
    renderToken += 1;
    const thisToken = renderToken;

    const textEl = document.getElementById('passage-text');
    const choicesDiv = document.getElementById('choices');
    const p = window.storyData.passages[currentPassage];

    textEl.classList.remove('passage-fade');
    // force reflow to restart animation
    // eslint-disable-next-line no-unused-expressions
    textEl.offsetWidth;
    textEl.classList.add('passage-fade');

    if (!p) {
        textEl.textContent = "The end.";
        choicesDiv.innerHTML = "";
        playCue('fail');
        return;
    }

    revealTextTypewriter(textEl, p.text.trim(), thisToken);

    choicesDiv.innerHTML = "";
    const visibleChoices = (p.choices || []).filter(ch => !ch.condition || evalCondition(ch.condition));

    if (visibleChoices.length === 0) {
        const endNote = document.createElement('div');
        endNote.className = 'end-note';
        endNote.textContent = 'No available choices.';
        choicesDiv.appendChild(endNote);
        playCue('fail');
        return;
    }

    visibleChoices.forEach(ch => {
        const btn = document.createElement('button');
        btn.textContent = ch.text;
        btn.onclick = () => {
            playCue('click');
            if (ch.effect) applyEffect(ch.effect);
            history.push({ passage: currentPassage, choiceText: ch.text, target: ch.target });
            currentPassage = ch.target;
            renderPassage();
        };
        choicesDiv.appendChild(btn);
    });

    playCue('success');
}

const conditionEvaluator = (() => {
    const TOKEN_TYPES = {
        boolean: 'boolean',
        number: 'number',
        string: 'string',
        identifier: 'identifier',
        operator: 'operator',
        paren: 'paren'
    };

    const allowedRoots = new Set(['inventory', 'relationships', 'flags']);
    const binaryPrecedence = {
        '||': 1,
        '&&': 2,
        '==': 3,
        '!=': 3,
        '<': 4,
        '<=': 4,
        '>': 4,
        '>=': 4
    };

    function tokenize(input) {
        const tokens = [];
        let i = 0;

        while (i < input.length) {
            const char = input[i];

            if (/\s/.test(char)) {
                i += 1;
                continue;
            }

            const twoCharOp = input.slice(i, i + 2);
            if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoCharOp)) {
                tokens.push({ type: TOKEN_TYPES.operator, value: twoCharOp });
                i += 2;
                continue;
            }

            if (['<', '>', '!'].includes(char)) {
                tokens.push({ type: TOKEN_TYPES.operator, value: char });
                i += 1;
                continue;
            }

            if (['(', ')'].includes(char)) {
                tokens.push({ type: TOKEN_TYPES.paren, value: char });
                i += 1;
                continue;
            }

            if (char === '"' || char === "'") {
                const quote = char;
                let value = '';
                i += 1;

                while (i < input.length && input[i] !== quote) {
                    if (input[i] === '\\' && i + 1 < input.length) {
                        value += input[i + 1];
                        i += 2;
                        continue;
                    }
                    value += input[i];
                    i += 1;
                }

                if (input[i] !== quote) {
                    throw new Error('Unterminated string literal');
                }

                tokens.push({ type: TOKEN_TYPES.string, value });
                i += 1;
                continue;
            }

            if (/\d/.test(char)) {
                let raw = char;
                i += 1;
                while (i < input.length && /[\d.]/.test(input[i])) {
                    raw += input[i];
                    i += 1;
                }
                const parsed = Number(raw);
                if (Number.isNaN(parsed)) {
                    throw new Error(`Invalid number literal: ${raw}`);
                }
                tokens.push({ type: TOKEN_TYPES.number, value: parsed });
                continue;
            }

            if (/[A-Za-z_]/.test(char)) {
                let raw = char;
                i += 1;
                while (i < input.length && /[A-Za-z0-9_.]/.test(input[i])) {
                    raw += input[i];
                    i += 1;
                }

                if (raw === 'true' || raw === 'false') {
                    tokens.push({ type: TOKEN_TYPES.boolean, value: raw === 'true' });
                } else {
                    tokens.push({ type: TOKEN_TYPES.identifier, value: raw });
                }
                continue;
            }

            throw new Error(`Unexpected token: ${char}`);
        }

        return tokens;
    }

    function parse(tokens) {
        let index = 0;

        function peek() {
            return tokens[index];
        }

        function consume() {
            const token = tokens[index];
            index += 1;
            return token;
        }

        function parsePrimary() {
            const token = peek();
            if (!token) throw new Error('Unexpected end of expression');

            if (token.type === TOKEN_TYPES.operator && token.value === '!') {
                consume();
                return { type: 'unary', operator: '!', argument: parsePrimary() };
            }

            if (token.type === TOKEN_TYPES.paren && token.value === '(') {
                consume();
                const node = parseExpression(1);
                const closing = consume();
                if (!closing || closing.type !== TOKEN_TYPES.paren || closing.value !== ')') {
                    throw new Error('Missing closing parenthesis');
                }
                return node;
            }

            if ([TOKEN_TYPES.boolean, TOKEN_TYPES.number, TOKEN_TYPES.string].includes(token.type)) {
                consume();
                return { type: 'literal', value: token.value };
            }

            if (token.type === TOKEN_TYPES.identifier) {
                consume();
                return { type: 'identifier', value: token.value };
            }

            throw new Error(`Unexpected token in expression: ${token.value}`);
        }

        function parseExpression(minPrecedence) {
            let left = parsePrimary();

            while (true) {
                const token = peek();
                if (!token || token.type !== TOKEN_TYPES.operator) break;
                const precedence = binaryPrecedence[token.value];
                if (!precedence || precedence < minPrecedence) break;

                const operator = consume().value;
                const right = parseExpression(precedence + 1);
                left = { type: 'binary', operator, left, right };
            }

            return left;
        }

        const ast = parseExpression(1);
        if (index < tokens.length) {
            throw new Error(`Unexpected trailing token: ${tokens[index].value}`);
        }
        return ast;
    }

    function resolveIdentifier(path, scope) {
        const keys = path.split('.');
        const root = keys[0];
        if (!allowedRoots.has(root)) {
            throw new Error(`Disallowed variable root: ${root}`);
        }

        if (keys.some(k => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))) {
            throw new Error(`Invalid identifier path: ${path}`);
        }

        return keys.reduce((acc, key) => (acc == null ? undefined : acc[key]), scope);
    }

    function evaluateNode(node, scope) {
        if (node.type === 'literal') return node.value;
        if (node.type === 'identifier') return resolveIdentifier(node.value, scope);

        if (node.type === 'unary') {
            const arg = evaluateNode(node.argument, scope);
            if (node.operator === '!') return !arg;
            throw new Error(`Unsupported unary operator: ${node.operator}`);
        }

        if (node.type === 'binary') {
            if (node.operator === '&&') {
                return Boolean(evaluateNode(node.left, scope) && evaluateNode(node.right, scope));
            }
            if (node.operator === '||') {
                return Boolean(evaluateNode(node.left, scope) || evaluateNode(node.right, scope));
            }

            const left = evaluateNode(node.left, scope);
            const right = evaluateNode(node.right, scope);

            if (node.operator === '==') return left == right;
            if (node.operator === '!=') return left != right;
            if (node.operator === '<') return left < right;
            if (node.operator === '<=') return left <= right;
            if (node.operator === '>') return left > right;
            if (node.operator === '>=') return left >= right;
            throw new Error(`Unsupported binary operator: ${node.operator}`);
        }

        throw new Error(`Unsupported AST node type: ${node.type}`);
    }

    function evaluate(condition, scope) {
        const tokens = tokenize(condition);
        const ast = parse(tokens);
        return Boolean(evaluateNode(ast, scope));
    }

    return { evaluate };
})();

function evalCondition(cond) {
    try {
        const scope = {
            inventory: variablesState.inventory,
            relationships: variablesState.relationships,
            flags: variablesState.flags
        };

        // README-style examples:
        // - inventory.key == true
        // - relationships.Alice >= 3 && !flags.opened_gate
        // - flags.met_guide == false || inventory.token == "silver"
        return conditionEvaluator.evaluate(cond, scope);
    } catch (e) {
        console.warn('[ConditionEvaluator]', {
            condition: cond,
            error: e.message
        });
        return false;
    }
}

function applyEffect(effect) {
    const parser = window.parseStoryEffect;
    if (typeof parser !== 'function') {
        console.error('[EffectParser] parser unavailable.', effect);
        if (typeof window.setStoryStatus === 'function') {
            window.setStoryStatus('Effect parser unavailable. Story effect was not applied.', 'error');
        }
        return;
    }

    const result = parser(effect);
    if (!result.ok) {
        console.error('[EffectParser] Invalid effect:', effect, '-', result.error);
        if (typeof window.setStoryStatus === 'function') {
            window.setStoryStatus(`Invalid effect ignored: ${result.error}`, 'error');
        }
        return;
    }

    try {
        const parsed = result.effect;
        if (parsed.root === 'relationships') {
            const current = Number(getNested(variablesState, parsed.path) || 0);
            const next = parsed.operator === '+=' ? current + parsed.value : current - parsed.value;
            setNested(variablesState, parsed.path, next);
            return;
        }

        setNested(variablesState, parsed.path, parsed.value);
    } catch (e) {
        console.error('[EffectParser] Failed applying effect:', effect, e);
        if (typeof window.setStoryStatus === 'function') {
            window.setStoryStatus('Effect application failed. See console for details.', 'error');
        }
    }
}

function getNested(obj, path) {
    return path.split('.').reduce((o, k) => o && o[k], obj);
}

function setNested(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k] = o[k] || {}, obj);
    target[last] = value;
}

function encodeProgress(state) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

function decodeProgress(text) {
    const raw = (text || '').trim();
    if (!raw) throw new Error('empty file');

    // 1) Plain JSON support
    if (raw.startsWith('{')) {
        return JSON.parse(raw);
    }

    // 2) URL-safe base64
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);

    // 3) Standard base64
    const decoded = decodeURIComponent(escape(atob(padded)));
    return JSON.parse(decoded);
}

function buildLinearReplayText() {
    const parts = [];
    history.forEach((h, idx) => {
        const p = window.storyData.passages[h.passage];
        if (!p) return;
        parts.push(`[${idx + 1}] ${h.passage}`);
        parts.push(p.text.trim());
        parts.push(`You chose: "${h.choiceText}" -> ${h.target}`);
        parts.push('');
    });

    const finalP = window.storyData.passages[currentPassage];
    if (finalP) {
        parts.push(`[Final] ${currentPassage}`);
        parts.push(finalP.text.trim());
    }

    return parts.join('\n');
}

document.getElementById('restart').onclick = () => startPlayer('start');

document.getElementById('save-progress').onclick = () => {
    const state = { currentPassage, variablesState, history };
    const b64 = encodeProgress(state);
    downloadFile('progress.txt', 'text/plain', b64);
};

document.getElementById('load-progress').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const state = decodeProgress(ev.target.result);
            currentPassage = state.currentPassage || 'start';
            variablesState = normalizeVariables(state.variablesState || {});
            history = Array.isArray(state.history) ? state.history : [];
            renderPassage();
        } catch (err) {
            console.error(err);
            alert('Invalid progress file');
        }
    };
    reader.readAsText(file);
};

document.getElementById('export-novel').onclick = () => {
    const novel = buildLinearReplayText();
    downloadFile('my-story.txt', 'text/plain', novel);
};
