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

function evalCondition(cond) {
    try {
        const scope = {
            inventory: variablesState.inventory,
            relationships: variablesState.relationships,
            flags: variablesState.flags,
            health: variablesState.health || 0
        };
        // eslint-disable-next-line no-new-func
        return new Function(...Object.keys(scope), `return ${cond};`)(...Object.values(scope));
    } catch (e) {
        console.error("Condition error", cond, e);
        return false;
    }
}

function parsePrimitiveValue(raw) {
    const v = raw.trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
    const n = Number(v);
    if (!Number.isNaN(n) && v !== '') return n;
    return v;
}

function applyEffect(effect) {
    try {
        if (effect.includes('+=')) {
            const [path, valStr] = effect.split('+=');
            const current = Number(getNested(variablesState, path.trim()) || 0);
            setNested(variablesState, path.trim(), current + Number(valStr.trim()));
            return;
        }
        if (effect.includes('-=')) {
            const [path, valStr] = effect.split('-=');
            const current = Number(getNested(variablesState, path.trim()) || 0);
            setNested(variablesState, path.trim(), current - Number(valStr.trim()));
            return;
        }
        if (effect.includes('=')) {
            const [path, valStr] = effect.split('=');
            setNested(variablesState, path.trim(), parsePrimitiveValue(valStr));
        }
    } catch (e) {
        console.error("Effect error", effect, e);
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
