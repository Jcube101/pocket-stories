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
let selectedConnection = null; // not used yet, but preparing for future

function initEditor() {
    nodesContainer = document.getElementById('nodes-container');
    svgCanvas = document.getElementById('svg-canvas');

    // Deselect on canvas click
    nodesContainer.addEventListener('click', e => {
        if (e.target === nodesContainer || e.target === svgCanvas) {
            if (selectedNode) {
                selectedNode.classList.remove('selected');
                selectedNode = null;
            }
        }
    });

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

    // Draw connections
    drawConnections();

    // Variables sidebar
    variables = JSON.parse(JSON.stringify(window.storyData.variables));
    renderVariables();

    // Canvas interactions
    nodesContainer.addEventListener('mousedown', e => {
        if (e.target === nodesContainer || e.target === svgCanvas) {
            isPanning = true;
            panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', e => {
        if (isPanning) {
            pan.x = e.clientX - panStart.x;
            pan.y = e.clientY - panStart.y;
            updateTransform();
        }
    });

    document.addEventListener('mouseup', () => {
        isPanning = false;
        connectingFrom = null;
    });

    // Wheel zoom (screen-centered, no drift)
    nodesContainer.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        scale = Math.max(0.3, Math.min(scale * factor, 2));
        updateTransform();
    }, { passive: false });

    // Zoom buttons
    document.getElementById('zoom-in').onclick = () => { scale = Math.min(scale * 1.2, 2); updateTransform(); };
    document.getElementById('zoom-out').onclick = () => { scale = Math.max(scale / 1.2, 0.3); updateTransform(); };
    document.getElementById('zoom-reset').onclick = () => { scale = 1; pan = { x: 0, y: 0 }; updateTransform(); };
    document.getElementById('zoom-fit').onclick = fitToNodes;

    // Sidebar tools
    document.getElementById('play-story').onclick = () => document.getElementById('player-btn').click();
    document.getElementById('export-yaml').onclick = exportYAML;
    document.getElementById('branching-script').onclick = generateBranchingScript;
    document.getElementById('add-var').onclick = () => {
        const type = prompt("Type: inventory / relationships / flags");
        if (!["inventory", "relationships", "flags"].includes(type)) return;
        const name = prompt("Name");
        if (!name) return;
        variables[type][name] = type === "relationships" ? 0 : false;
        renderVariables();
    };
}

function updateTransform() {
    nodesContainer.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    svgCanvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
}

function createNode(id, text, index) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'node';
    nodeDiv.dataset.id = id;
    nodeDiv.style.left = `${150 + (index % 4) * 380}px`;
    nodeDiv.style.top = `${150 + Math.floor(index / 4) * 320}px`;

    nodeDiv.innerHTML = `
        <div class="node-title" contenteditable="true">${id}</div>
        <div class="node-text" contenteditable="true">${text}</div>
        <div class="node-output"></div>
    `;

    // Drag node
    nodeDiv.addEventListener('mousedown', e => {
        if (e.target.classList.contains('node-output')) {
            connectingFrom = nodeDiv;
        } else if (!e.target.isContentEditable) {
            e.stopPropagation();
        }
    });

    // Save title change
    nodeDiv.querySelector('.node-title').addEventListener('blur', e => {
        const newId = e.target.textContent.trim();
        if (newId && newId !== id) {
            window.storyData.passages[newId] = JSON.parse(JSON.stringify(window.storyData.passages[id]));
            delete window.storyData.passages[id];
            nodeDiv.dataset.id = newId;
            drawConnections();
        }
    });

    // Save text change
    nodeDiv.querySelector('.node-text').addEventListener('blur', e => {
        window.storyData.passages[id].text = e.target.textContent + "\n";
    });

    // Start connection on output
    nodeDiv.querySelector('.node-output').addEventListener('mousedown', e => {
        e.stopPropagation();
        connectingFrom = nodeDiv;
    });

    // Click to select node
    nodeDiv.addEventListener('click', e => {
        if (e.target.isContentEditable) return; // don't select while editing text
        e.stopPropagation();
        if (selectedNode) selectedNode.classList.remove('selected');
        selectedNode = nodeDiv;
        nodeDiv.classList.add('selected');
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
            }
        }
    }
    connectingFrom = null;
});

function drawConnections() {
    // Clear everything except defs
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

        const fromRect = fromNode.getBoundingClientRect();
        const containerRect = nodesContainer.getBoundingClientRect();
        const fromX = (fromRect.right - containerRect.left) / scale - pan.x / scale;
        const fromY = (fromRect.top + fromRect.height / 2 - containerRect.top) / scale - pan.y / scale;

        p.choices.forEach((ch, choiceIndex) => {
            const toNode = document.querySelector(`.node[data-id="${ch.target}"]`);
            if (!toNode) return;

            const toRect = toNode.getBoundingClientRect();
            const toX = (toRect.left - containerRect.left) / scale - pan.x / scale;
            const toY = (toRect.top + toRect.height / 2 - containerRect.top) / scale - pan.y / scale;

            // Unique ID for this connection's path
            const connId = `${id}-to-${ch.target}-${choiceIndex}`;

            // Curved path (adjusted control points for smoother flow)
            const midX = (fromX + toX) / 2;
            const pathD = `M ${fromX} ${fromY} C ${fromX + 120} ${fromY} ${midX} ${toY} ${toX} ${toY}`;

            // Hidden path for textPath reference
            const defPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            defPath.id = `textpath-${connId}`;
            defPath.setAttribute("d", pathD);
            defPath.style.display = "none";
            svgCanvas.appendChild(defPath);

            // Visible connection path
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathD);
            path.classList.add("connection-path");
            path.setAttribute("marker-end", "url(#arrow)");
            svgCanvas.appendChild(path);

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
            textPath.style.fill = "#374151";
            text.appendChild(textPath);
            svgCanvas.appendChild(text);

            // Right-click to edit
            path.addEventListener('contextmenu', e => {
                e.preventDefault();
                const newText = prompt("Choice text", ch.text || "");
                if (newText !== null) ch.text = newText || undefined;
                const cond = prompt("Condition (optional)", ch.condition || "");
                if (cond !== null) ch.condition = cond || undefined;
                const eff = prompt("Effect (optional)", ch.effect || "");
                if (eff !== null) ch.effect = eff || undefined;
                drawConnections(); // refresh labels
            });
        });
    });
}

function fitToNodes() {
    const nodes = document.querySelectorAll('.node');
    if (nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
        const r = n.getBoundingClientRect();
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.right);
        maxY = Math.max(maxY, r.bottom);
    });

    const width = maxX - minX + 200;
    const height = maxY - minY + 200;
    const canvasW = window.innerWidth - 300;
    const canvasH = window.innerHeight - 80;

    scale = Math.min(canvasW / width, canvasH / height, 1);
    pan.x = (canvasW - width * scale) / 2 + 150;
    pan.y = (canvasH - height * scale) / 2;
    updateTransform();
}

function renderVariables() {
    const container = document.getElementById('variables');
    container.innerHTML = '';
    Object.keys(variables).forEach(cat => {
        const h3 = document.createElement('h3');
        h3.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        container.appendChild(h3);
        Object.keys(variables[cat]).forEach(key => {
            const div = document.createElement('div');
            div.innerHTML = `<strong>${key}</strong>: <input type="text" value="${variables[cat][key]}" data-cat="${cat}" data-key="${key}"> <button onclick="this.parentNode.remove(); delete variables['${cat}']['${key}']">Remove</button>`;
            div.querySelector('input').onchange = e => {
                const val = e.target.value;
                variables[cat][key] = cat === "relationships" ? Number(val) : (val === "true" || val === "false" ? val === "true" : val);
            };
            container.appendChild(div);
        });
    });
}

function exportStoryDataFromGraph() {
    // No change needed — data lives in window.storyData
}

function exportYAML() {
    exportStoryDataFromGraph();
    const yamlText = jsyaml.dump(window.storyData);
    downloadFile("story.yaml", "text/yaml", yamlText);
}

function generateBranchingScript() {
    let script = "";
    function recurse(id, depth = 0) {
        const p = window.storyData.passages[id];
        if (!p) return;
        script += "  ".repeat(depth) + id + "\n";
        script += "  ".repeat(depth) + p.text.trim() + "\n\n";
        if (p.choices) {
            p.choices.forEach(ch => {
                let line = "  ".repeat(depth) + "→ " + ch.text + " → " + ch.target;
                if (ch.condition) line += " [if " + ch.condition + "]";
                if (ch.effect) line += " [" + ch.effect + "]";
                script += line + "\n";
                recurse(ch.target, depth + 1);
            });
        }
        script += "\n";
    }
    recurse("start");
    showModal(script);
}

// Import handler — rebuild with new node creation
document.getElementById('load-story').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const yamlText = ev.target.result;
            const newData = jsyaml.load(yamlText);
            if (!newData.passages) throw "Invalid story";
            window.storyData = newData;
            variables = JSON.parse(JSON.stringify(newData.variables || { inventory: {}, relationships: {}, flags: {} }));
            initEditor(); // Rebuild everything
            alert("Story loaded successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to load story.yaml");
        }
    };
    reader.readAsText(file);
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    // Delete selected node
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
        const id = selectedNode.dataset.id;
        if (confirm(`Delete passage "${id}" and all connections to/from it?`)) {
            delete window.storyData.passages[id];
            // Remove incoming connections
            Object.keys(window.storyData.passages).forEach(pid => {
                if (window.storyData.passages[pid].choices) {
                    window.storyData.passages[pid].choices = window.storyData.passages[pid].choices.filter(ch => ch.target !== id);
                }
            });
            selectedNode.remove();
            selectedNode = null;
            drawConnections();
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
});