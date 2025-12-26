// player.js
let currentPassage = "start";
let variablesState = {};
let history = []; // [{passage, choiceText}]

function initPlayer() {
    variablesState = JSON.parse(JSON.stringify(window.storyData.variables));
    currentPassage = "start";
    history = [];
    renderPassage();
}

function startPlayer() {
    variablesState = JSON.parse(JSON.stringify(window.storyData.variables));
    currentPassage = "start";
    history = [];
    renderPassage();
}

function renderPassage() {
    const p = window.storyData.passages[currentPassage];
    if (!p) {
        document.getElementById('passage-text').textContent = "The end.";
        document.getElementById('choices').innerHTML = "";
        return;
    }
    document.getElementById('passage-text').textContent = p.text.trim();

    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = "";
    if (p.choices) {
        p.choices.forEach(ch => {
            if (ch.condition && !evalCondition(ch.condition)) return;
            const btn = document.createElement('button');
            btn.textContent = ch.text;
            btn.onclick = () => {
                if (ch.effect) applyEffect(ch.effect);
                history.push({passage: currentPassage, choiceText: ch.text});
                currentPassage = ch.target;
                renderPassage();
            };
            choicesDiv.appendChild(btn);
        });
    }
}

function evalCondition(cond) {
    // Simple eval with safe scope
    try {
        const scope = { inventory: variablesState.inventory, relationships: variablesState.relationships, flags: variablesState.flags, health: variablesState.health || 0 };
        // eslint-disable-next-line no-new-func
        return new Function(...Object.keys(scope), `return ${cond};`)(...Object.values(scope));
    } catch (e) {
        console.error("Condition error", cond, e);
        return false;
    }
}

function applyEffect(effect) {
    try {
        const parts = effect.split(/\+=|-=/);
        if (parts.length > 1) {
            const path = parts[0].trim();
            const op = effect.includes('+=') ? '+=' : '-=';
            const val = Number(parts[1].trim());
            const obj = getNested(variablesState, path);
            if (obj) obj[Object.keys(obj)[0]] = obj[Object.keys(obj)[0]] + (op === '+=' ? val : -val);
        } else if (effect.includes('=')) {
            const [path, valStr] = effect.split('=');
            const value = valStr.trim() === "true" ? true : valStr.trim() === "false" ? false : Number(valStr.trim());
            setNested(variablesState, path.trim(), value);
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

document.getElementById('restart').onclick = startPlayer;

document.getElementById('save-progress').onclick = () => {
    const state = { currentPassage, variablesState, history };
    const json = JSON.stringify(state);
    const b64 = btoa(json);
    downloadFile("progress.txt", "text/plain", b64);
};

document.getElementById('load-progress').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const json = atob(ev.target.result);
            const state = JSON.parse(json);
            currentPassage = state.currentPassage;
            variablesState = state.variablesState;
            history = state.history;
            renderPassage();
        } catch (err) {
            alert("Invalid progress file");
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