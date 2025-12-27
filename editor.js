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
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 20;

function saveState() {
    // Deep copy essential data
    const state = {
        passages: JSON.parse(JSON.stringify(window.storyData.passages)),
        // If you later add node positions to storyData, include them here
    };
    undoStack.push(state);
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    redoStack = []; // clear redo when new action occurs
}

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

    // Middle-click panning on the wrapper
    const wrapper = document.getElementById('canvas-wrapper');
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    // Deselect on background
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
        if (e.button === 1) {  // middle mouse button
            isPanning = true;
            panStart.x = e.clientX - pan.x;
            panStart.y = e.clientY - pan.y;
            wrapper.style.cursor = 'grabbing';
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

    document.addEventListener('mouseup', e => {
        if (e.button === 1 && isPanning) {
            isPanning = false;
            wrapper.style.cursor = 'default';
        }
    });

    // Prevent context menu on middle-click release
    wrapper.addEventListener('contextmenu', e => {
        if (e.button === 1) e.preventDefault();
    });
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
        const storyKey = 'pocketstories_layout_' + (window.storyData.title || 'untitled');
        const layout = JSON.parse(localStorage.getItem(storyKey) || '{}');
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

            // Also save to localStorage (for browser reloads without export)
            const storyKey = 'pocketstories_layout_' + (window.storyData.title || 'untitled');
            const layout = JSON.parse(localStorage.getItem(storyKey) || '{}');
            if (layout[id]) {
                layout[newId] = layout[id];
                delete layout[id];
                localStorage.setItem(storyKey, JSON.stringify(layout));
            }

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
            drawConnections();
            saveState(); // ← add here
        }
    });

    // Save text change
    nodeDiv.querySelector('.node-text').addEventListener('blur', e => {
        window.storyData.passages[id].text = e.target.textContent + "\n";
        saveState(); // ← add here
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
                saveState(); // ← add here
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

            // Gentle curve in logical space
            const cp1x = fromX + 150;
            const cp2x = toX - 150;
            const pathD = `M ${fromX} ${fromY} C ${cp1x} ${fromY} ${cp2x} ${toY} ${toX} ${toY}`;

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
            path.dataset.index = choiceIndex; // for multi-choices from same node

            path.addEventListener('click', e => {
                e.stopPropagation();
                // Deselect node
                if (selectedNode) {
                    selectedNode.classList.remove('selected');
                    selectedNode = null;
                }
                // Highlight this connection
                document.querySelectorAll('.connection-path.selected').forEach(p => p.classList.remove('selected'));
                path.classList.add('selected');
            });

            // Right-click delete
            path.addEventListener('contextmenu', e => {
                e.preventDefault();
                if (confirm(`Delete connection "${ch.text || 'Continue'}" from ${id} to ${ch.target}?`)) {
                    window.storyData.passages[id].choices.splice(choiceIndex, 1);
                    drawConnections();
                    saveState();
                }
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

            // Right-click edit
            path.addEventListener('contextmenu', e => {
                e.preventDefault();
                const newText = prompt("Choice text", ch.text || "");
                if (newText !== null) ch.text = newText || undefined;
                const cond = prompt("Condition (optional)", ch.condition || "");
                if (cond !== null) ch.condition = cond || undefined;
                const eff = prompt("Effect (optional)", ch.effect || "");
                if (eff !== null) ch.effect = eff || undefined;
                drawConnections();
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
        showModal(script);
    } catch (err) {
        console.error('Branching script failed:', err);
        alert('Failed to generate branching script: ' + err.message);
    }
}

function showModal(content) {
    // Create modal overlay
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

    // Modal content
    const modal = document.createElement('div');
    modal.style.background = '#fff';
    modal.style.padding = '20px';
    modal.style.maxWidth = '80%';
    modal.style.maxHeight = '80%';
    modal.style.overflow = 'auto';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';

    // Dark mode support
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        modal.style.background = '#222';
        modal.style.color = '#eee';
    }

    const pre = document.createElement('pre');
    pre.textContent = content;
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.fontSize = '14px';
    pre.style.lineHeight = '1.5';
    modal.appendChild(pre);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.marginTop = '20px';
    closeBtn.style.padding = '8px 16px';
    closeBtn.onclick = () => document.body.removeChild(overlay);
    modal.appendChild(closeBtn);

    overlay.onclick = (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
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
    if (undoStack.length === 0) return;

    // Save current state to redo stack
    redoStack.push({
        passages: JSON.parse(JSON.stringify(window.storyData.passages))
    });

    // Restore previous state
    const previous = undoStack.pop();
    window.storyData.passages = previous.passages;

    // Rebuild UI
    initEditor(); // this will recreate all nodes & connections
}

function redo() {
    if (redoStack.length === 0) return;

    // Save current state to undo stack
    undoStack.push({
        passages: JSON.parse(JSON.stringify(window.storyData.passages))
    });

    // Restore next state
    const next = redoStack.pop();
    window.storyData.passages = next.passages;

    // Rebuild UI
    initEditor();
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
            saveState(); // ← add here
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
// One-time sidebar tool bindings with debug
const btnExport = document.getElementById('export-yaml');
const btnBranching = document.getElementById('branching-script');
const btnPlay = document.getElementById('play-story');
const btnAddVar = document.getElementById('add-var');

if (btnExport) {
    btnExport.onclick = () => {
        console.log('Export YAML button clicked');
        exportYAML();
    };
} else {
    console.warn('Button #export-yaml not found');
}

if (btnBranching) {
    btnBranching.onclick = () => {
        console.log('Branching script button clicked');
        generateBranchingScript();
    };
} else {
    console.warn('Button #branching-script not found');
}

if (btnPlay) {
    btnPlay.onclick = () => {
        console.log('Play story button clicked');
        document.getElementById('player-btn').click();
    };
}

if (btnAddVar) {
    btnAddVar.onclick = () => {
        console.log('Add variable button clicked');
        const type = prompt("Type: inventory / relationships / flags");
        if (!["inventory", "relationships", "flags"].includes(type)) return;
        const name = prompt("Name");
        if (!name) return;
        variables[type][name] = type === "relationships" ? 0 : false;
        renderVariables();
        saveState();
    };
}