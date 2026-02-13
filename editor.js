// editor.js — minimal SVG + DOM graph editor for Pocket Stories
let nodesContainer;
let svgCanvas;
let variables = { inventory: {}, relationships: {}, flags: {} };
let pan = { x: 0, y: 0 };
let scale = 1;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let connectingFrom = null;
let selectedNode = null;
let undoStack = [];
let historyIndex = -1;
const MAX_HISTORY = 20;
let highlightedCycleNodes = new Set();
let highlightedCycleEdges = new Set();
let highlightedUnreachableNodes = new Set();
let highlightedErrorNodes = new Set();
let highlightedErrorEdges = new Set();
let highlightedWarningNodes = new Set();
let highlightedWarningEdges = new Set();
let highlightedInfoNodes = new Set();
let highlightedInfoEdges = new Set();
let editorEventsBound = false;

function normalizeStorageToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function getStoryLayoutStorageKey() {
    const metadata = (window.storyData && typeof window.storyData.metadata === 'object')
        ? window.storyData.metadata
        : {};
    const identityToken = normalizeStorageToken(metadata.storyIdentity);
    const titleToken = normalizeStorageToken(window.storyData && window.storyData.title);
    const primaryToken = identityToken || titleToken || 'untitled';

    return {
        newKey: `pocketstories_layout_${primaryToken}`,
        oldKey: `pocketstories_layout_${window.storyData?.title || 'untitled'}`
    };
}

function getStoryLayout() {
    const { newKey, oldKey } = getStoryLayoutStorageKey();
    const hasNew = localStorage.getItem(newKey) !== null;
    const oldLayout = localStorage.getItem(oldKey);

    if (!hasNew && oldLayout !== null) {
        localStorage.setItem(newKey, oldLayout);
    }

    try {
        return JSON.parse(localStorage.getItem(newKey) || '{}');
    } catch (err) {
        console.warn('Failed to parse saved layout from localStorage', err);
        return {};
    }
}

function saveStoryLayout(layout) {
    const { newKey } = getStoryLayoutStorageKey();
    localStorage.setItem(newKey, JSON.stringify(layout));
}

async function hashText(text) {
    if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') {
        return null;
    }
    const bytes = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function normalizeVariables(v = {}) {
    return {
        inventory: v.inventory || {},
        relationships: v.relationships || {},
        flags: v.flags || {}
    };
}

function cloneEditorState() {
    return {
        passages: JSON.parse(JSON.stringify(window.storyData.passages || {})),
        variables: JSON.parse(JSON.stringify(normalizeVariables(window.storyData.variables)))
    };
}

function saveState(options = {}) {
    if (options.resetHistory) {
        undoStack = [];
        historyIndex = -1;
    }

    const state = cloneEditorState();

    if (historyIndex < undoStack.length - 1) {
        undoStack = undoStack.slice(0, historyIndex + 1);
    }

    undoStack.push(state);
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    } else {
        historyIndex += 1;
    }

    if (undoStack.length === MAX_HISTORY && historyIndex >= MAX_HISTORY) {
        historyIndex = MAX_HISTORY - 1;
    }
}

function initEditor() {
    nodesContainer = document.getElementById('nodes-container');
    svgCanvas = document.getElementById('svg-canvas');

    // Clear previous content
    nodesContainer.innerHTML = '';
    svgCanvas.innerHTML = `<defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#666" />
        </marker>
    </defs>`;

    // Create nodes with safe initial positions
    let index = 0;
    Object.keys(window.storyData.passages).forEach(id => {
        const p = window.storyData.passages[id];
        createNode(id, p.text.trim(), index++);
    });

        // Ensure start passage exists
    if (!window.storyData.passages.start) {
        window.storyData.passages.start = {
            text: "You begin your adventure...\n\nWhat do you do?",
            choices: []
        };
        console.log('Auto-created missing start passage');
    }

    // Draw connections
    drawConnections();
    expandCanvasIfNeeded();  // ensure initial size is sufficient
    fitToNodes();

    // Initialize undo/redo baseline for current story
    saveState({ resetHistory: true });

    // Variables sidebar
    variables = JSON.parse(JSON.stringify(normalizeVariables(window.storyData.variables)));
    window.storyData.variables = JSON.parse(JSON.stringify(variables));
    renderVariables();
    renderPassageList();

    const searchInput = document.getElementById('passage-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = () => applyPassageSearch(searchInput.value);
    }

    bindEditorEvents();

    // Wheel zoom
    nodesContainer.onwheel = e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        scale = Math.max(0.3, Math.min(scale * factor, 2));
        updateTransform();
        updateZoomIndicator();
    };

    // Zoom and focus controls
    document.getElementById('zoom-in').onclick = () => { scale = Math.min(scale * 1.2, 2); updateTransform(); updateZoomIndicator(); };
    document.getElementById('zoom-out').onclick = () => { scale = Math.max(scale / 1.2, 0.3); updateTransform(); updateZoomIndicator(); };
    document.getElementById('zoom-reset').onclick = () => { scale = 1; pan = { x: 0, y: 0 }; updateTransform(); updateZoomIndicator(); };
    document.getElementById('zoom-fit').onclick = fitToNodes;
    const focusStartBtn = document.getElementById('focus-start');
    if (focusStartBtn) focusStartBtn.onclick = () => jumpToPassage('start');
    const focusStartClusterBtn = document.getElementById('focus-start-cluster');
    if (focusStartClusterBtn) focusStartClusterBtn.onclick = () => focusStartCluster();

    updateZoomIndicator();

    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.ondblclick = e => {
        if (e.target.closest('.node')) return;

        const newIdRaw = prompt('New passage ID', `passage_${Date.now()}`);
        if (newIdRaw === null) return;
        const newId = newIdRaw.trim();
        if (!newId) {
            alert('Passage ID cannot be empty.');
            return;
        }
        if (window.storyData.passages[newId]) {
            alert(`Passage "${newId}" already exists.`);
            return;
        }

        const newText = prompt('Passage text', 'Write your passage text here...');
        if (newText === null) return;

        const x = Math.max(0, (e.clientX - pan.x) / scale - 160);
        const y = Math.max(0, (e.clientY - pan.y) / scale - 100);

        window.storyData.passages[newId] = {
            text: `${newText}\n`,
            choices: [],
            position: { x, y }
        };

        createNode(newId, newText, Object.keys(window.storyData.passages).length);
        renderPassageList();
        drawConnections();
        expandCanvasIfNeeded();
        saveState();
    };
}

function bindEditorEvents() {
    if (editorEventsBound) return;

    const wrapper = document.getElementById('canvas-wrapper');

    nodesContainer.addEventListener('click', e => {
        if (e.target === nodesContainer || e.target === svgCanvas) {
            if (selectedNode) {
                selectedNode.classList.remove('selected');
                selectedNode = null;
            }
        }
    });

    wrapper.addEventListener('click', e => {
        if (e.target === wrapper || e.target === svgCanvas) {
            if (selectedNode) {
                selectedNode.classList.remove('selected');
                selectedNode = null;
            }
            document.querySelectorAll('.connection-path.selected').forEach(p => p.classList.remove('selected'));
        }
    });

    wrapper.addEventListener('mousedown', e => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey && !e.target.closest('.node'))) {
            isPanning = true;
            panStart.x = e.clientX - pan.x;
            panStart.y = e.clientY - pan.y;
            wrapper.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    wrapper.addEventListener('contextmenu', e => {
        if (e.button === 1) e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
        if (!isPanning) return;
        pan.x = e.clientX - panStart.x;
        pan.y = e.clientY - panStart.y;
        updateTransform();
    });

    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            wrapper.style.cursor = 'default';
        }
    });

    editorEventsBound = true;
}

function updateTransform() {
    nodesContainer.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    svgCanvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
}

function createNode(id, text, index) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'node';
    nodeDiv.dataset.id = id;

    // Load position: YAML first, then localStorage fallback, then grid
    const passage = window.storyData.passages[id];
    let posX, posY;

    if (passage.position) {
        posX = passage.position.x;
        posY = passage.position.y;
    } else {
        // Fallback to localStorage
        const layout = getStoryLayout();
        const saved = layout[id];
        if (saved) {
            posX = saved.x;
            posY = saved.y;
        } else {
            // Final fallback: grid
            posX = 150 + (index % 4) * 380;
            posY = 150 + Math.floor(index / 4) * 320;
        }
    }

    nodeDiv.style.left = `${posX}px`;
    nodeDiv.style.top = `${posY}px`;

    nodeDiv.innerHTML = `
        <div class="node-title" contenteditable="true">${id}</div>
        ${id === 'start' ? '<div class="start-badge">START</div>' : ''}
        <div class="node-text" contenteditable="true">${text}</div>
        <div class="node-output"></div>
    `;

    // Drag node or start connection
    nodeDiv.addEventListener('mousedown', e => {
        // Start connection from output port
        if (e.target.classList.contains('node-output')) {
            connectingFrom = nodeDiv;
            e.stopPropagation();
            return;
        }

        // Allow editing contenteditable fields
        if (e.target.isContentEditable) return;

        // Otherwise: start dragging the node
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const origX = parseFloat(nodeDiv.style.left);
        const origY = parseFloat(nodeDiv.style.top);

        nodeDiv.style.zIndex = 100; // bring to front

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            nodeDiv.style.left = `${origX + dx}px`;
            nodeDiv.style.top = `${origY + dy}px`;
            drawConnections(); // live update
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            nodeDiv.style.zIndex = ''; // reset
            expandCanvasIfNeeded();

            // Sync to both YAML and localStorage
            const newX = parseFloat(nodeDiv.style.left);
            const newY = parseFloat(nodeDiv.style.top);

            if (!window.storyData.passages[id].position) {
                window.storyData.passages[id].position = {};
            }
            window.storyData.passages[id].position.x = newX;
            window.storyData.passages[id].position.y = newY;

            // Fixed: save current position to localStorage
            const layout = getStoryLayout();
            layout[id] = { x: newX, y: newY };
            saveStoryLayout(layout);

            drawConnections();
            saveState(); // for undo/redo
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // Save title change
    nodeDiv.querySelector('.node-title').addEventListener('blur', e => {
        const newId = e.target.textContent.trim();
        if (newId && newId !== id) {
            window.storyData.passages[newId] = JSON.parse(JSON.stringify(window.storyData.passages[id]));
            delete window.storyData.passages[id];
            nodeDiv.dataset.id = newId;
            renderPassageList();
            drawConnections();
            saveState();
        }
    });

    // Save text change
    nodeDiv.querySelector('.node-text').addEventListener('blur', e => {
        window.storyData.passages[id].text = e.target.textContent + "\n";
        saveState();
    });

    // Start connection on output
    nodeDiv.querySelector('.node-output').addEventListener('mousedown', e => {
        e.stopPropagation();
        connectingFrom = nodeDiv;
    });

    // Click to select node
    nodeDiv.addEventListener('click', e => {
        if (e.target.isContentEditable) return;
        e.stopPropagation();
        if (selectedNode) selectedNode.classList.remove('selected');
        selectedNode = nodeDiv;
        nodeDiv.classList.add('selected');
    });

    nodeDiv.addEventListener('contextmenu', e => {
        if (e.target.classList.contains('node-output') || e.target.isContentEditable) return;
        e.preventDefault();
        const nodeId = nodeDiv.dataset.id;
        if (confirm(`Test from here? Start Player Mode at "${nodeId}".`)) {
            window.__playerStartPassage = nodeId;
            document.getElementById('player-btn').click();
        }
    });

    nodesContainer.appendChild(nodeDiv);
}

document.addEventListener('mouseup', e => {
    if (connectingFrom && e.target.closest('.node') && e.target.closest('.node') !== connectingFrom) {
        const fromId = connectingFrom.dataset.id;
        const toNode = e.target.closest('.node');
        const toId = toNode.dataset.id;
        if (fromId !== toId) {
            const text = prompt("Choice text", "Continue");
            if (text) {
                if (!window.storyData.passages[fromId].choices) window.storyData.passages[fromId].choices = [];
                window.storyData.passages[fromId].choices.push({ text, target: toId });
                drawConnections();
                saveState();
            }
        }
    }
    connectingFrom = null;
});

function drawConnections() {
    // Clear and re-add marker only (no viewBox, no sizing)
    svgCanvas.innerHTML = `<defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#666" />
        </marker>
    </defs>`;

    Object.keys(window.storyData.passages).forEach(id => {
        const p = window.storyData.passages[id];
        if (!p.choices) return;

        const fromNode = document.querySelector(`.node[data-id="${id}"]`);
        if (!fromNode) return;

        // Logical positions (same space as node.style.left/top)
        const fromX = parseFloat(fromNode.style.left) + fromNode.offsetWidth;
        const fromY = parseFloat(fromNode.style.top) + fromNode.offsetHeight / 2;

        p.choices.forEach((ch, choiceIndex) => {
            const toNode = document.querySelector(`.node[data-id="${ch.target}"]`);
            if (!toNode) return;

            const toX = parseFloat(toNode.style.left);
            const toY = parseFloat(toNode.style.top) + toNode.offsetHeight / 2;

            const connId = `${id}-to-${ch.target}-${choiceIndex}`;

            // Smarter routing: vertical offset to avoid node overlap
            const deltaY = toY - fromY;
            const horizontal = Math.max(120, Math.abs(toX - fromX) / 3); // wider on long links
            const offset = Math.abs(deltaY) < 100 ? 80 : Math.sign(deltaY) * 150; // pronounced arc for vertical separation

            const cp1x = fromX + horizontal;
            const cp1y = fromY + offset;
            const cp2x = toX - horizontal;
            const cp2y = toY - offset;

            const pathD = `M ${fromX} ${fromY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${toX} ${toY}`;

            // Hidden def for textPath
            const defPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            defPath.id = `textpath-${connId}`;
            defPath.setAttribute("d", pathD);
            defPath.style.display = "none";
            svgCanvas.appendChild(defPath);

            // Visible path
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathD);
            path.classList.add("connection-path");
            path.setAttribute("marker-end", "url(#arrow)");
            svgCanvas.appendChild(path);

            // Connection selection
            path.dataset.from = id;
            path.dataset.to = ch.target;
            path.dataset.index = choiceIndex;

            path.addEventListener('click', e => {
                e.stopPropagation();
                if (selectedNode) {
                    selectedNode.classList.remove('selected');
                    selectedNode = null;
                }
                document.querySelectorAll('.connection-path.selected').forEach(p => p.classList.remove('selected'));
                path.classList.add('selected');
            });

            const edgeKey = `${id}->${ch.target}`;
            if (highlightedCycleEdges.has(edgeKey)) {
                path.classList.add('cycle-edge');
            }

            if (highlightedErrorEdges.has(connId)) {
                path.classList.add('validation-edge-error');
            } else if (highlightedWarningEdges.has(connId)) {
                path.classList.add('validation-edge-warning');
            } else if (highlightedInfoEdges.has(connId)) {
                path.classList.add('validation-edge-info');
            }

            // Right-click action menu for connection
            path.addEventListener('contextmenu', e => {
                e.preventDefault();
                const action = prompt('Connection action: type "edit" to edit, "delete" to remove.', 'edit');
                if (!action) return;

                if (action.toLowerCase() === 'delete') {
                    if (confirm(`Delete connection "${ch.text || 'Continue'}" from ${id} to ${ch.target}?`)) {
                        window.storyData.passages[id].choices.splice(choiceIndex, 1);
                        drawConnections();
                        saveState();
                    }
                    return;
                }

                if (action.toLowerCase() !== 'edit') return;

                const newText = prompt('Choice text', ch.text || '');
                if (newText !== null) ch.text = newText || undefined;
                const cond = prompt('Condition (optional)', ch.condition || '');
                if (cond !== null) ch.condition = cond || undefined;
                const eff = prompt('Effect (optional)', ch.effect || '');
                if (eff !== null) {
                    const nextEffect = eff || undefined;
                    if (nextEffect && typeof window.parseStoryEffect === 'function') {
                        const parsedEffect = window.parseStoryEffect(nextEffect);
                        if (!parsedEffect.ok) {
                            console.error('[EffectParser] Invalid effect:', nextEffect, '-', parsedEffect.error);
                            alert(`Invalid effect: ${parsedEffect.error}`);
                            return;
                        }
                    }
                    ch.effect = nextEffect;
                }
                drawConnections();
                saveState();
            });

            // Label
            let labelText = ch.text || "Continue";
            if (ch.condition) labelText += ` [if ${ch.condition}]`;
            if (ch.effect) labelText += ` [${ch.effect}]`;

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
            textPath.setAttribute("href", `#textpath-${connId}`);
            textPath.setAttribute("startOffset", "50%");
            textPath.setAttribute("text-anchor", "middle");
            textPath.textContent = labelText;
            textPath.style.fontSize = "13px";
            textPath.style.fill = "#e2e8f0";
            text.appendChild(textPath);
            svgCanvas.appendChild(text);

        });
    });

    document.querySelectorAll('.node').forEach(node => {
        const nodeId = node.dataset.id;
        node.classList.toggle('cycle-node', highlightedCycleNodes.has(nodeId));
        node.classList.toggle('unreachable-node', highlightedUnreachableNodes.has(nodeId));
        node.classList.toggle('validation-node-error', highlightedErrorNodes.has(nodeId));
        node.classList.toggle('validation-node-warning', highlightedWarningNodes.has(nodeId));
        node.classList.toggle('validation-node-info', highlightedInfoNodes.has(nodeId));
    });

    const searchInput = document.getElementById('passage-search');
    if (searchInput) applyPassageSearch(searchInput.value || '');
}

function jumpToPassage(id) {
    const node = document.querySelector(`.node[data-id="${id}"]`);
    if (!node) return;

    if (selectedNode) selectedNode.classList.remove('selected');
    selectedNode = node;
    node.classList.add('selected');

    const x = parseFloat(node.style.left);
    const y = parseFloat(node.style.top);
    pan.x = window.innerWidth / 2 - (x + 160) * scale;
    pan.y = window.innerHeight / 2 - (y + 60) * scale;
    updateTransform();
}

function focusStartCluster() {
    const start = window.storyData.passages.start;
    if (!start) {
        jumpToPassage('start');
        return;
    }

    const ids = ['start', ...(start.choices || []).slice(0, 2).map(ch => ch.target)].filter(Boolean);
    const nodes = ids
        .map(id => document.querySelector(`.node[data-id="${id}"]`))
        .filter(Boolean);

    if (nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach(node => {
        const x = parseFloat(node.style.left);
        const y = parseFloat(node.style.top);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + node.offsetWidth);
        maxY = Math.max(maxY, y + node.offsetHeight);
    });

    focusBounds(minX, minY, maxX, maxY, 120);
}

function updateZoomIndicator() {
    const indicator = document.getElementById('zoom-indicator');
    if (!indicator) return;
    indicator.textContent = `${Math.round(scale * 100)}%`;
}

function focusBounds(minX, minY, maxX, maxY, padding = 160) {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;

    const width = (maxX - minX) + padding * 2;
    const height = (maxY - minY) + padding * 2;
    const availableW = wrapper.clientWidth;
    const availableH = wrapper.clientHeight;
    scale = Math.max(0.3, Math.min(Math.min(availableW / width, availableH / height), 2));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    pan.x = (availableW / 2) - (centerX * scale);
    pan.y = (availableH / 2) - (centerY * scale);
    updateTransform();
    updateZoomIndicator();
}

function jumpToConnection(from, target, index) {
    jumpToPassage(from);
    const edge = document.querySelector(`.connection-path[data-from="${from}"][data-to="${target}"][data-index="${index}"]`);
    if (!edge) return;
    document.querySelectorAll('.connection-path.selected').forEach(p => p.classList.remove('selected'));
    edge.classList.add('selected');
}

function fitToNodes() {
    const nodes = document.querySelectorAll('.node');
    if (nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach(n => {
        const x = parseFloat(n.style.left);
        const y = parseFloat(n.style.top);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + n.offsetWidth);
        maxY = Math.max(maxY, y + n.offsetHeight);
    });

    focusBounds(minX, minY, maxX, maxY);
}

function renderPassageList() {
    const list = document.getElementById('passage-list');
    if (!list) return;
    list.innerHTML = '';

    const ids = Object.keys(window.storyData.passages || {}).sort();
    ids.forEach(id => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'passage-item';
        item.textContent = id;
        item.onclick = () => jumpToPassage(id);
        list.appendChild(item);
    });
}

function applyPassageSearch(rawTerm) {
    const term = (rawTerm || '').trim().toLowerCase();
    const ids = Object.keys(window.storyData.passages || {});

    ids.forEach(id => {
        const node = document.querySelector(`.node[data-id="${id}"]`);
        if (!node) return;

        const text = (window.storyData.passages[id].text || '').toLowerCase();
        const match = !term || id.toLowerCase().includes(term) || text.includes(term);
        node.classList.toggle('search-match', !!term && match);
        node.classList.toggle('search-dim', !!term && !match);
    });

    const listItems = document.querySelectorAll('#passage-list .passage-item');
    listItems.forEach(btn => {
        const id = btn.textContent || '';
        const text = (window.storyData.passages[id]?.text || '').toLowerCase();
        const match = !term || id.toLowerCase().includes(term) || text.includes(term);
        btn.classList.toggle('hidden', !!term && !match);
    });
}

function renderVariables() {
    const container = document.getElementById('variables');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(variables).forEach(cat => {
        const group = document.createElement('section');
        group.className = 'variable-group';

        const h3 = document.createElement('h3');
        h3.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        h3.title = getCategoryTooltip(cat);
        group.appendChild(h3);

        const keys = Object.keys(variables[cat]);
        if (keys.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'variable-empty';
            empty.textContent = 'No variables yet.';
            group.appendChild(empty);
        }

        keys.forEach(key => {
            const row = document.createElement('div');
            row.className = 'variable-row';

            const label = document.createElement('label');
            label.className = 'variable-label';
            label.textContent = key;
            row.appendChild(label);

            const input = document.createElement('input');
            input.className = 'variable-input';
            input.type = cat === 'relationships' ? 'number' : 'text';
            input.value = variables[cat][key];
            input.onchange = () => {
                let val = input.value;
                if (cat === 'relationships') val = Number(val) || 0;
                else val = val === 'true' ? true : val === 'false' ? false : val;
                variables[cat][key] = val;
                window.storyData.variables = JSON.parse(JSON.stringify(variables));
                saveState();
            };
            row.appendChild(input);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = 'Remove';
            removeBtn.className = 'variable-remove';
            removeBtn.onclick = () => {
                delete variables[cat][key];
                renderVariables();
                window.storyData.variables = JSON.parse(JSON.stringify(variables));
                saveState();
            };
            row.appendChild(removeBtn);

            group.appendChild(row);
        });

        container.appendChild(group);
    });
}

// Helper for category tooltips
function getCategoryTooltip(cat) {
    if (cat === 'inventory') return 'Items or quantities (e.g., key: true). Use in conditions: inventory.key == true';
    if (cat === 'relationships') return 'Numeric scores (e.g., Alice: 50). Use in effects: relationships.Alice += 10';
    if (cat === 'flags') return 'Boolean toggles (e.g., met_guard: true). Use in effects: flags.met_guard = true';
}

function exportStoryDataFromGraph() {
    // No change needed — data lives in window.storyData
}

function exportYAML() {
    try {
        console.log('Starting exportYAML');
        exportStoryDataFromGraph(); // if this exists
        const yamlText = jsyaml.dump(window.storyData);
        console.log('YAML generated:', yamlText.substring(0, 100)); // preview
        downloadFile("story.yaml", "text/yaml", yamlText);
    } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed: ' + err.message);
    }
}

function downloadFile(filename, type, content) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function generateBranchingScript() {
    try {
        console.log('Starting generateBranchingScript');
        let script = "";
        const visited = new Set();

        function recurse(id, depth = 0) {
            if (visited.has(id)) return; // skip cycles
            visited.add(id);

            const p = window.storyData.passages[id];
            if (!p) return;

            script += "  ".repeat(depth) + id + "\n";
            script += "  ".repeat(depth) + p.text.trim() + "\n\n";

            if (p.choices) {
                p.choices.forEach(ch => {
                    let line = "  ".repeat(depth) + "→ " + (ch.text || "Continue") + " → " + ch.target;
                    if (ch.condition) line += " [if " + ch.condition + "]";
                    if (ch.effect) line += " [" + ch.effect + "]";
                    script += line + "\n";
                    recurse(ch.target, depth + 1);
                });
            }
            script += "\n";
        }

        recurse("start");
        console.log('Script generated');
        showModal({ text: script });
    } catch (err) {
        console.error('Branching script failed:', err);
        alert('Failed to generate branching script: ' + err.message);
    }
}

function sanitizeHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    const allowedTags = new Set(['H2', 'H3', 'P', 'UL', 'LI', 'STRONG', 'EM', 'CODE', 'BR']);
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
    const toReplace = [];

    while (walker.nextNode()) {
        const el = walker.currentNode;
        if (!allowedTags.has(el.tagName)) {
            toReplace.push(el);
            continue;
        }

        // Strip all attributes from allowed tags.
        while (el.attributes.length > 0) {
            el.removeAttribute(el.attributes[0].name);
        }
    }

    toReplace.forEach(el => {
        const fragment = document.createDocumentFragment();
        while (el.firstChild) fragment.appendChild(el.firstChild);
        el.replaceWith(fragment);
    });

    return template.innerHTML;
}

function showModal(content) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1000';

    const modal = document.createElement('div');
    modal.style.background = '#fff';
    modal.style.padding = '24px';
    modal.style.maxWidth = '90%';
    modal.style.maxHeight = '80vh';
    modal.style.overflow = 'auto';
    modal.style.borderRadius = '12px';
    modal.style.boxShadow = '0 6px 30px rgba(0,0,0,0.4)';

    // Dark mode support
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        modal.style.background = '#1f2937';
        modal.style.color = '#f3f4f6';
    }

    const contentDiv = document.createElement('div');

    if (content instanceof Node) {
        contentDiv.appendChild(content);
    } else if (Array.isArray(content) && content.every(node => node instanceof Node)) {
        content.forEach(node => contentDiv.appendChild(node));
    } else if (content && typeof content === 'object') {
        if (typeof content.text === 'string' && content.text.length > 0) {
            const textBlock = document.createElement('p');
            textBlock.style.whiteSpace = 'pre-wrap';
            textBlock.textContent = content.text;
            contentDiv.appendChild(textBlock);
        }

        if (Array.isArray(content.listItems) && content.listItems.length > 0) {
            const list = document.createElement('ul');
            list.style.textAlign = 'left';
            list.style.paddingLeft = '1.5em';
            content.listItems.forEach(item => {
                const listItem = document.createElement('li');
                listItem.textContent = item;
                list.appendChild(listItem);
            });
            contentDiv.appendChild(list);
        }

        if (typeof content.richHTML === 'string' && content.richHTML.trim().length > 0) {
            const rich = document.createElement('div');
            rich.innerHTML = sanitizeHTML(content.richHTML);
            contentDiv.appendChild(rich);
        }
    } else {
        const textBlock = document.createElement('p');
        textBlock.style.whiteSpace = 'pre-wrap';
        textBlock.textContent = typeof content === 'string' ? content : '';
        contentDiv.appendChild(textBlock);
    }

    modal.appendChild(contentDiv);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.marginTop = '20px';
    closeBtn.style.padding = '10px 20px';
    closeBtn.style.background = '#3b82f6';
    closeBtn.style.color = 'white';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => document.body.removeChild(overlay);
    modal.appendChild(closeBtn);

    overlay.onclick = (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function validateStory() {
    const issues = [];
    const passages = window.storyData.passages;
    const ids = Object.keys(passages);
    const storyParsers = window.storyParsers || {};

    function addIssue(severity, message, context = {}) {
        issues.push({ severity, message, ...context });
    }

    // Missing start
    if (!passages.start) {
        addIssue('error', "Missing 'start' passage");
    }

    // Broken links + effect validation
    for (const id of ids) {
        const p = passages[id];
        if (p.choices) {
            p.choices.forEach((ch, idx) => {
                const edgeContext = { from: id, target: ch.target, index: idx };

                if (typeof ch.text !== 'string' || ch.text.trim() === '') {
                    addIssue('error', `Missing choice text: "${id}" choice #${idx + 1}`, edgeContext);
                }

                if (typeof ch.target !== 'string' || ch.target.trim() === '') {
                    addIssue('error', `Missing choice target: "${id}" choice #${idx + 1}`, edgeContext);
                }

                if (!passages[ch.target]) {
                    addIssue('error', `Broken link: "${id}" choice #${idx + 1} → "${ch.target}" (missing)`, edgeContext);
                }

                if (ch.condition) {
                    if (typeof storyParsers.parseCondition === 'function') {
                        try {
                            storyParsers.parseCondition(ch.condition);
                        } catch (err) {
                            addIssue('error', `Invalid condition in "${id}" choice #${idx + 1}: ${err.message}`, edgeContext);
                        }
                    } else {
                        addIssue('warning', `Cannot parse-check condition in "${id}" choice #${idx + 1}: runtime parser unavailable.`, edgeContext);
                    }
                }

                if (ch.effect) {
                    if (typeof storyParsers.parseEffect === 'function') {
                        try {
                            storyParsers.parseEffect(ch.effect);
                        } catch (err) {
                            addIssue('error', `Invalid effect in "${id}" choice #${idx + 1}: ${err.message}`, edgeContext);
                        }
                    } else {
                        addIssue('warning', `Cannot parse-check effect in "${id}" choice #${idx + 1}: runtime parser unavailable.`, edgeContext);
                    }
                }

                if (ch.effect) {
                    if (typeof window.parseStoryEffect !== 'function') {
                        issues.push('Effect validator unavailable. Could not validate effect syntax.');
                    } else {
                        const parsedEffect = window.parseStoryEffect(ch.effect);
                        if (!parsedEffect.ok) {
                            issues.push(`Invalid effect: "${id}" choice #${idx + 1} (${parsedEffect.error})`);
                        }
                    }
                }
            });
        }
    }

    // Unreachable passages (excluding start)
    const reachable = new Set(['start']);
    const queue = ['start'];
    while (queue.length) {
        const current = queue.shift();
        const p = passages[current];
        if (p && p.choices) {
            p.choices.forEach(ch => {
                if (!reachable.has(ch.target)) {
                    reachable.add(ch.target);
                    queue.push(ch.target);
                }
            });
        }
    }
    const unreachable = new Set();
    for (const id of ids) {
        if (id !== 'start' && !reachable.has(id)) {
            addIssue('warning', `Unreachable passage: "${id}"`, { nodeId: id });
            unreachable.add(id);
        }
    }

    const cycles = findCycles(passages);
    if (cycles.length > 0) {
        cycles.forEach((cycle, idx) => {
            addIssue('info', `Cycle ${idx + 1}: ${cycle.join(' → ')} → ${cycle[0]}`, { nodeId: cycle[0] });
        });
    }

    const cycleNodes = new Set();
    const cycleEdges = new Set();
    cycles.forEach(cycle => {
        for (let i = 0; i < cycle.length; i += 1) {
            const from = cycle[i];
            const to = cycle[(i + 1) % cycle.length];
            cycleNodes.add(from);
            cycleEdges.add(`${from}->${to}`);
        }
    });
    highlightedCycleNodes = cycleNodes;
    highlightedCycleEdges = cycleEdges;
    highlightedUnreachableNodes = unreachable;

    highlightedErrorNodes = new Set();
    highlightedErrorEdges = new Set();
    highlightedWarningNodes = new Set();
    highlightedWarningEdges = new Set();
    highlightedInfoNodes = new Set();
    highlightedInfoEdges = new Set();

    issues.forEach(issue => {
        const edgeId = (issue.from && issue.target != null && issue.index != null)
            ? `${issue.from}-to-${issue.target}-${issue.index}`
            : null;

        if (issue.severity === 'error') {
            if (issue.nodeId) highlightedErrorNodes.add(issue.nodeId);
            if (issue.from) highlightedErrorNodes.add(issue.from);
            if (issue.target && passages[issue.target]) highlightedErrorNodes.add(issue.target);
            if (edgeId) highlightedErrorEdges.add(edgeId);
        } else if (issue.severity === 'warning') {
            if (issue.nodeId) highlightedWarningNodes.add(issue.nodeId);
            if (issue.from) highlightedWarningNodes.add(issue.from);
            if (issue.target && passages[issue.target]) highlightedWarningNodes.add(issue.target);
            if (edgeId) highlightedWarningEdges.add(edgeId);
        } else {
            if (issue.nodeId) highlightedInfoNodes.add(issue.nodeId);
            if (issue.from) highlightedInfoNodes.add(issue.from);
            if (issue.target && passages[issue.target]) highlightedInfoNodes.add(issue.target);
            if (edgeId) highlightedInfoEdges.add(edgeId);
        }
    });

    drawConnections();

    // Report
    const report = document.createElement('div');

    const heading = document.createElement('strong');
    heading.style.fontSize = '1.2em';

    const summary = document.createElement('p');
    summary.style.marginTop = '1em';

    if (issues.length === 0) {
        heading.style.color = '#10b981';
        heading.textContent = '✓ All good!';
        summary.textContent = 'Your story has no validation issues.';
        report.appendChild(heading);
        report.appendChild(summary);
        showModal(report);
        return;
    }

    const grouped = {
        error: issues.filter(issue => issue.severity === 'error'),
        warning: issues.filter(issue => issue.severity === 'warning'),
        info: issues.filter(issue => issue.severity === 'info')
    };

    heading.style.color = '#ef4444';
    heading.textContent = `⚠ Validation issues found (${issues.length})`;
    summary.style.color = '#666';
    summary.textContent = `Errors: ${grouped.error.length}, warnings: ${grouped.warning.length}, info: ${grouped.info.length}`;
    report.appendChild(heading);
    report.appendChild(summary);

    [
        { key: 'error', label: 'Errors', color: '#dc2626' },
        { key: 'warning', label: 'Warnings', color: '#d97706' },
        { key: 'info', label: 'Info', color: '#2563eb' }
    ].forEach(section => {
        const sectionIssues = grouped[section.key];
        if (sectionIssues.length === 0) return;

        const subheading = document.createElement('h3');
        subheading.textContent = `${section.label} (${sectionIssues.length})`;
        subheading.style.color = section.color;
        subheading.style.marginTop = '1em';
        report.appendChild(subheading);

        const list = document.createElement('ul');
        list.style.textAlign = 'left';
        list.style.margin = '0.5em 0 0';
        list.style.paddingLeft = '1.5em';
        list.style.lineHeight = '1.6';

        sectionIssues.forEach(issue => {
            const item = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = issue.message;
            item.appendChild(label);

            if (issue.nodeId || issue.from) {
                const jumpBtn = document.createElement('button');
                jumpBtn.type = 'button';
                jumpBtn.textContent = 'Jump';
                jumpBtn.style.marginLeft = '0.6em';
                jumpBtn.style.padding = '2px 8px';
                jumpBtn.style.fontSize = '0.8em';
                jumpBtn.onclick = () => {
                    if (issue.from && issue.target != null && issue.index != null) {
                        jumpToConnection(issue.from, issue.target, issue.index);
                        return;
                    }
                    jumpToPassage(issue.nodeId || issue.from);
                };
                item.appendChild(jumpBtn);
            }

            list.appendChild(item);
        });

        report.appendChild(list);
    });

    showModal(report);
}

function findCycles(passages) {
    const ids = Object.keys(passages);
    const visited = new Set();
    const onStack = new Set();
    const stack = [];
    const cycleSignatures = new Set();
    const cycles = [];

    function normalizeCycle(cycleIds) {
        let best = null;
        for (let i = 0; i < cycleIds.length; i += 1) {
            const rotated = cycleIds.slice(i).concat(cycleIds.slice(0, i));
            const signature = rotated.join('->');
            if (best === null || signature < best) best = signature;
        }
        return best;
    }

    function dfs(id) {
        visited.add(id);
        onStack.add(id);
        stack.push(id);

        const choices = passages[id]?.choices || [];
        choices.forEach(ch => {
            const target = ch.target;
            if (!passages[target]) return;

            if (!visited.has(target)) {
                dfs(target);
                return;
            }

            if (onStack.has(target)) {
                const idx = stack.indexOf(target);
                if (idx >= 0) {
                    const cycle = stack.slice(idx);
                    const signature = normalizeCycle(cycle);
                    if (!cycleSignatures.has(signature)) {
                        cycleSignatures.add(signature);
                        cycles.push(cycle);
                    }
                }
            }
        });

        stack.pop();
        onStack.delete(id);
    }

    ids.forEach(id => {
        if (!visited.has(id)) dfs(id);
    });

    return cycles;
}

function expandCanvasIfNeeded() {
    const nodes = document.querySelectorAll('.node');
    if (nodes.length === 0) return;

    let maxX = 0, maxY = 0;
    nodes.forEach(node => {
        const x = parseFloat(node.style.left) + node.offsetWidth;
        const y = parseFloat(node.style.top) + node.offsetHeight;
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    });

    const minSize = 5000;
    const padding = 1000;
    const newWidth = Math.max(minSize, maxX + padding);
    const newHeight = Math.max(minSize, maxY + padding);

    if (newWidth > nodesContainer.offsetWidth || newHeight > nodesContainer.offsetHeight) {
        nodesContainer.style.width = `${newWidth}px`;
        nodesContainer.style.height = `${newHeight}px`;
        svgCanvas.style.width = `${newWidth}px`;
        svgCanvas.style.height = `${newHeight}px`;
    }
}

function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    applyStateIncremental(undoStack[historyIndex]);
}

function redo() {
    if (historyIndex >= undoStack.length - 1) return;
    historyIndex += 1;
    applyStateIncremental(undoStack[historyIndex]);
}

function applyStateIncremental(state) {
    if (!state) return;

    const targetPassages = JSON.parse(JSON.stringify(state.passages || {}));
    const existingNodes = new Map(Array.from(document.querySelectorAll('.node')).map(node => [node.dataset.id, node]));

    // Remove nodes no longer present
    existingNodes.forEach((node, id) => {
        if (!targetPassages[id]) {
            node.remove();
        }
    });

    // Add missing nodes
    Object.keys(targetPassages).forEach((id, index) => {
        if (!existingNodes.has(id)) {
            createNode(id, (targetPassages[id].text || '').trim(), index);
        }
    });

    // Update existing node content/position
    Object.keys(targetPassages).forEach(id => {
        const node = document.querySelector(`.node[data-id="${id}"]`);
        if (!node) return;
        const p = targetPassages[id];

        const title = node.querySelector('.node-title');
        if (title && title.textContent.trim() !== id) {
            title.textContent = id;
        }

        const text = node.querySelector('.node-text');
        const trimmed = (p.text || '').trim();
        if (text && text.textContent !== trimmed) {
            text.textContent = trimmed;
        }

        if (p.position) {
            node.style.left = `${p.position.x}px`;
            node.style.top = `${p.position.y}px`;
        }
    });

    window.storyData.passages = targetPassages;
    window.storyData.variables = JSON.parse(JSON.stringify(normalizeVariables(state.variables)));
    variables = JSON.parse(JSON.stringify(window.storyData.variables));
    renderVariables();
    renderPassageList();

    if (selectedNode && !window.storyData.passages[selectedNode.dataset.id]) {
        selectedNode = null;
    }

    drawConnections();
    expandCanvasIfNeeded();
}

// Import handler — rebuild with new node creation
const loadStoryInput = document.getElementById('load-story');
if (loadStoryInput) {
    loadStoryInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
            try {
                const raw = ev.target.result;
                const isJson = file.name.toLowerCase().endsWith('.json');
                const parsed = isJson ? JSON.parse(raw) : jsyaml.load(raw);
                const importHash = await hashText(raw);
                if (typeof window.loadStoryData === 'function') {
                    window.loadStoryData(parsed, file.name, { importHash });
                } else {
                    const validator = window.validateAndNormalizeStory;
                    const result = typeof validator === 'function'
                        ? validator(parsed)
                        : { ok: true, data: parsed, warnings: [], errors: [] };

                    if (!result.ok) {
                        throw new Error(result.errors.join(' | '));
                    }

                    window.storyData = result.data;
                    if (!window.storyData.metadata || typeof window.storyData.metadata !== 'object') {
                        window.storyData.metadata = {};
                    }
                    if (importHash) {
                        window.storyData.metadata.importHash = importHash;
                        window.storyData.metadata.storyIdentity = `import:${importHash}`;
                    }
                    variables = JSON.parse(JSON.stringify(normalizeVariables(window.storyData.variables)));
                    window.storyData.variables = JSON.parse(JSON.stringify(variables));
                    initEditor();
                    if (typeof initPlayer === 'function') initPlayer();

                    if (result.warnings.length > 0 && typeof window.setStoryStatus === 'function') {
                        window.setStoryStatus(`Imported with ${result.warnings.length} warning(s): ${file.name}`, 'warning');
                    } else if (typeof window.setStoryStatus === 'function') {
                        window.setStoryStatus(`Imported: ${file.name}`, 'success');
                    }
                }
                alert(`Story imported: ${file.name}`);
            } catch (err) {
                console.error(err);
                if (typeof window.setStoryStatus === 'function') {
                    window.setStoryStatus(`Import failed: ${file.name}`, 'error');
                }
                alert(`Failed to import story file: ${file.name}`);
            }
        };
        reader.readAsText(file);
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    // Delete selected node
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
        const id = selectedNode.dataset.id;
        const incoming = Object.keys(window.storyData.passages).filter(pid =>
            (window.storyData.passages[pid].choices || []).some(ch => ch.target === id)
        );
        const outgoing = (window.storyData.passages[id]?.choices || []).map(ch => ch.target);

        const warnings = [];
        if (id === 'start') {
            warnings.push('You are deleting the START passage. The story may become unplayable.');
        }
        if (incoming.length > 0 || outgoing.length > 0) {
            warnings.push(`This node has ${incoming.length} incoming and ${outgoing.length} outgoing connection(s).`);
        }

        const message = `${warnings.length ? `⚠ ${warnings.join('\n')}` : ''}\n\nDelete passage "${id}" and all connections to/from it?`;
        if (confirm(message.trim())) {
            delete window.storyData.passages[id];
            // Remove incoming connections
            Object.keys(window.storyData.passages).forEach(pid => {
                if (window.storyData.passages[pid].choices) {
                    window.storyData.passages[pid].choices = window.storyData.passages[pid].choices.filter(ch => ch.target !== id);
                }
            });
            selectedNode.remove();
            selectedNode = null;
            renderPassageList();
            drawConnections();
            saveState();
        }
    }

    // Esc deselect
    if (e.key === 'Escape' && selectedNode) {
        selectedNode.classList.remove('selected');
        selectedNode = null;
    }

    // Ctrl+S export
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        exportYAML();
    }

    //Ctrl+Z Undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }

    //Ctrl+Y Redo
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault();
        redo();
    }
});

// One-time sidebar tool bindings (runs once, survives initEditor rebuilds)
const btnValidate = document.getElementById('validate-story');
const btnExport = document.getElementById('export-yaml');
const btnBranching = document.getElementById('branching-script');
const btnPlay = document.getElementById('play-story');
const sidebar = document.getElementById('sidebar');
const graphContainer = document.getElementById('graph-container');
const toggleBtn = document.getElementById('toggle-sidebar');
const btnHelp = document.getElementById('help-btn');
const sampleStorySelect = document.getElementById('sample-story-select');
const loadSampleStoryBtn = document.getElementById('load-sample-story');
if (sampleStorySelect && loadSampleStoryBtn) {
    loadSampleStoryBtn.onclick = async () => {
        const value = sampleStorySelect.value;
        if (!value) return;
        if (typeof window.loadStoryByPath === 'function') {
            await window.loadStoryByPath(value, sampleStorySelect.options[sampleStorySelect.selectedIndex].textContent);
        }
    };
}

// Add variable handler (runs once)
const addVarBtn = document.getElementById('add-var-btn');
const varTypeSelect = document.getElementById('new-var-type');
const varNameInput = document.getElementById('new-var-name');

if (addVarBtn && varTypeSelect && varNameInput) {
    addVarBtn.onclick = () => {
        const type = varTypeSelect.value;
        const name = varNameInput.value.trim();
        if (!name) {
            alert("Please enter a variable name.");
            return;
        }
        if (variables[type][name] !== undefined) {
            alert("Variable already exists.");
            return;
        }
        variables[type][name] = type === 'relationships' ? 0 : false;
        varNameInput.value = ''; // clear input
        renderVariables();       // refresh list
        window.storyData.variables = JSON.parse(JSON.stringify(variables));
        saveState();
    };

    // Optional: add Enter key support
    varNameInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addVarBtn.click();
        }
    });
}

if (btnValidate) {
    btnValidate.onclick = () => validateStory();
} else {
    console.warn('Button #validate-story not found');
}

if (btnExport) {
    btnExport.onclick = () => exportYAML();
} else {
    console.warn('Button #export-yaml not found');
}

if (btnBranching) {
    btnBranching.onclick = () => generateBranchingScript();
} else {
    console.warn('Button #branching-script not found');
}

if (btnPlay) {
    btnPlay.onclick = () => document.getElementById('player-btn').click();
}

if (toggleBtn) {
    toggleBtn.onclick = () => {
        sidebar.classList.toggle('hidden');
        graphContainer.classList.toggle('expanded');
        toggleBtn.textContent = sidebar.classList.contains('hidden') ? '▶' : '◀';
    };
}

if (btnHelp) {
    btnHelp.onclick = () => showModal({ richHTML: `
        <h2>Pocket Stories Quickstart</h2>
        <p>Create branching interactive fiction with variables, conditions, and effects.</p>
        <h3>Basics</h3>
        <ul>
            <li><strong>Nodes</strong>: Double-click title/text to edit. Drag to rearrange.</li>
            <li><strong>Connections</strong>: Drag from output dot to another node. Right-click line to edit choice/condition/effect or delete.</li>
            <li><strong>Delete</strong>: Select node + Delete key.</li>
        </ul>
        <h3>Variables (Sidebar)</h3>
        <ul>
            <li><strong>Inventory</strong>: Items (e.g., key: true). Condition: inventory.key == true</li>
            <li><strong>Relationships</strong>: Scores (e.g., Alice: 50). Effect: relationships.Alice += 10</li>
            <li><strong>Flags</strong>: Toggles (e.g., met_guard: true). Effect: flags.met_guard = true</li>
            <li>Use in choice right-click: "Condition" gates visibility, "Effect" changes state.</li>
        </ul>
        <h3>Tools</h3>
        <ul>
            <li>Play: Test in player mode.</li>
            <li>Export/Import: story.yaml with all data.</li>
            <li>Validate: Check for issues like missing start.</li>
        </ul>
        <p>Stay static—edit story.yaml directly for bulk changes.</p>
    ` });
}
