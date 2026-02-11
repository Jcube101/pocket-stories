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
    variablesState = JSON.parse(JSON.stringify(window.storyData.variables));
    currentPassage = window.storyData.passages[startPassage] ? startPassage : "start";
    history = [];
    renderPassage();
}

window.startPlayer = startPlayer;

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
    let novel = "";
    history.forEach((h, i) => {
        const p = window.storyData.passages[h.passage];
        novel += p.text.trim() + "\n\n";
        if (i < history.length - 1 || currentPassage !== "start") {
            novel += "You chose: \"" + h.choiceText + "\"\n\n";
        }
    });
    const finalP = window.storyData.passages[currentPassage];
    if (finalP) novel += finalP.text.trim() + "\n\n";
    downloadFile("my-story.txt", "text/plain", novel);
};
