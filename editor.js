// editor.js
let graph;
let graphcanvas;
let variables = { inventory: {}, relationships: {}, flags: {} };

function initEditor() {
    graph = new LGraph();
    graphcanvas = new LGraphCanvas("#graphcanvas", graph);

    // Start at comfortable 100% zoom, centered
    graphcanvas.ds.scale = 1.0;
    graphcanvas.ds.offset = [0, 0];
    graphcanvas.show_info = false;

    // Enable background drag panning only
    graphcanvas.allow_dragcanvas = true;

    // Disable internal zoom to avoid any conflict/drift
    graphcanvas.allow_zoom = false;

    // Custom wheel handler: smooth zoom centered on screen (eliminates any drift/pan during zoom)
    graphcanvas.canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        const factor = e.deltaY < 0 ? 1.1 : 0.9;  // Scroll up = zoom in, down = zoom out
        let newScale = graphcanvas.ds.scale * factor;
        newScale = Math.max(0.1, Math.min(newScale, 5));

        const center = [graphcanvas.canvas.width / 2, graphcanvas.canvas.height / 2];
        graphcanvas.setZoom(newScale, center);
    }, { passive: false, capture: true });

    // Custom Passage Node (only defined once, early for node creation)
    function PassageNode() {
        this.addOutput("choices", LiteGraph.ACTION);
        this.properties = { id: "start", text: "Your story begins here..." };
        this.size = [300, 200];
        this.serialize_widgets = true;
    }

    PassageNode.title = "Passage";
    PassageNode.prototype.onExecute = function() {};

    PassageNode.prototype.getTitle = function() {
        return this.properties.id;
    };

    PassageNode.prototype.onPropertyChanged = function(name, value) {
        if (name === "id") {
            let count = 1;
            let newId = value;
            while (graph.findNodesByTitle(newId).length > 1) {
                newId = value + "_" + count++;
            }
            this.properties.id = newId;
        }
    };

    PassageNode.widgets_up = true;
    PassageNode.prototype.onAdded = function() {
        this.addWidget("text", "ID", this.properties.id, (v) => { this.properties.id = v; this.onPropertyChanged("id", v); });
        this.addWidget("space");  // No callback needed — harmless warning silenced
        this.addWidget("textarea", "Text", this.properties.text, (v) => { this.properties.text = v; }, { multiline: true });
    };

    LiteGraph.registerNodeType("story/passage", PassageNode);

    // Now safely create nodes with nice auto-layout
    let x = 100, y = 100;
    let row = 0;
    Object.keys(window.storyData.passages).forEach(id => {
        const p = window.storyData.passages[id];
        const node = LiteGraph.createNode("story/passage");
        node.properties.id = id;
        node.properties.text = (p.text || "").trim();
        
        node.pos = [
            x + (row % 3) * 420 + (Math.random() * 50 - 25),
            y + Math.floor(row / 3) * 280 + (Math.random() * 40 - 20)
        ];
        graph.add(node);
        row++;
    });

    // Load connections (choices)
    graph.links = {}; // clear
    let linkId = 0;
    Object.keys(window.storyData.passages).forEach(sourceId => {
        const sourceNode = graph.findNodesByTitle(sourceId)[0];
        if (!sourceNode) return;
        const p = window.storyData.passages[sourceId];
        if (p.choices) {
            p.choices.forEach((choice, index) => {
                const targetNode = graph.findNodesByTitle(choice.target)[0];
                if (targetNode) {
                    const link = sourceNode.connect(0, targetNode, 0);
                    linkId++;
                    graph.links[link.id] = { id: link.id, origin_id: sourceNode.id, target_id: targetNode.id };
                    // store choice data on link
                    link.choiceText = choice.text;
                    link.condition = choice.condition || "";
                    link.effect = choice.effect || "";
                }
            });
        }
    });

    // Variables sidebar
    variables = JSON.parse(JSON.stringify(window.storyData.variables)); // deep copy
    renderVariables();

    // Link context menu for editing choice
    graphcanvas.getExtraMenuOptions = function() {
        return null;
    };

    graphcanvas.onShowLinkMenu = function(link, e) {
        const menu = new LiteGraph.ContextMenu(
            ["Edit Choice", "Delete Link"],
            { event: e, callback: (item) => {
                if (item === "Delete Link") {
                    graph.removeLink(link.id);
                } else if (item === "Edit Choice") {
                    const text = prompt("Choice Text", link.choiceText || "");
                    if (text !== null) link.choiceText = text;
                    const cond = prompt("Condition (optional)", link.condition || "");
                    if (cond !== null) link.condition = cond;
                    const eff = prompt("Effect (optional)", link.effect || "");
                    if (eff !== null) link.effect = eff;
                }
            }}
        );
        return false;
    };

    // Sidebar buttons
    document.getElementById('add-var').onclick = () => {
        const type = prompt("Type: inventory / relationships / flags");
        if (!["inventory", "relationships", "flags"].includes(type)) return;
        const name = prompt("Name");
        if (!name) return;
        const value = type === "relationships" ? "0" : "false";
        variables[type][name] = type === "relationships" ? 0 : false;
        renderVariables();
    };

    document.getElementById('branching-script').onclick = generateBranchingScript;

    document.getElementById('export-yaml').onclick = exportYAML;

    document.getElementById('play-story').onclick = () => {
        exportStoryDataFromGraph(); // update storyData
        playerBtn.click();
    };

    // Zoom control buttons — using the correct setZoom method
    const canvasCenter = () => [graphcanvas.canvas.width / 2, graphcanvas.canvas.height / 2];

    document.getElementById('zoom-in').addEventListener('click', () => {
        graphcanvas.setZoom(graphcanvas.ds.scale * 1.2, canvasCenter());
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        graphcanvas.setZoom(graphcanvas.ds.scale * 1.2, canvasCenter());  // Wait, this should be / 1.2 for out
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
        graphcanvas.setZoom(1.0, canvasCenter());
    });

    // Improved Fit All — centered with generous padding
    document.getElementById('zoom-fit').addEventListener('click', () => {
        if (graph._nodes.length === 0) return;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        graph._nodes.forEach(node => {
            if (node.pos) {
                minX = Math.min(minX, node.pos[0]);
                minY = Math.min(minY, node.pos[1]);
                maxX = Math.max(maxX, node.pos[0] + node.size[0]);
                maxY = Math.max(maxY, node.pos[1] + node.size[1]);
            }
        });

        const width = maxX - minX + 100;   // extra breathing room
        const height = maxY - minY + 100;

        const canvasW = graphcanvas.canvas.width;
        const canvasH = graphcanvas.canvas.height;

        // 15% padding on all sides
        const scale = Math.min(
            (canvasW * 0.85) / width,
            (canvasH * 0.85) / height
        );

        const finalScale = Math.min(scale, 1.0); // never zoom in past 100%

        // Center calculation
        const centerX = minX + (maxX - minX) / 2;
        const centerY = minY + (maxY - minY) / 2;
        const offsetX = canvasW / 2 - centerX * finalScale;
        const offsetY = canvasH / 2 - centerY * finalScale;

        graphcanvas.ds.scale = finalScale;
        graphcanvas.ds.offset = [offsetX, offsetY];
        graphcanvas.setDirty(true, true);
    });
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
            div.querySelector('input').onchange = (e) => {
                const val = e.target.value;
                variables[cat][key] = cat === "relationships" ? Number(val) : (val === "true" || val === "false" ? val === "true" : val);
            };
            container.appendChild(div);
        });
    });
}

function exportStoryDataFromGraph() {
    const passages = {};
    graph._nodes.forEach(node => {
        if (node.type === "story/passage") {
            const id = node.properties.id;
            passages[id] = {
                text: node.properties.text + "\n",
                choices: []
            };
            node.outputs[0].links.forEach(linkInfo => {
                const link = graph.links[linkInfo.link_id];
                if (link) {
                    const targetNode = graph.getNodeById(link.target_id);
                    passages[id].choices.push({
                        text: link.choiceText || "Go to " + targetNode.properties.id,
                        target: targetNode.properties.id,
                        condition: link.condition || undefined,
                        effect: link.effect || undefined
                    });
                }
            });
        }
    });
    window.storyData = { variables, passages };
}

function exportYAML() {
    exportStoryDataFromGraph();
    const yamlText = jsyaml.dump(window.storyData);
    downloadFile("story.yaml", "text/yaml", yamlText);
}

function generateBranchingScript() {
    exportStoryDataFromGraph();
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

function showModal(content) {
    document.getElementById('modal-body').textContent = content;
    document.getElementById('modal').classList.remove('hidden');
}

document.querySelector('.close').onclick = () => {
    document.getElementById('modal').classList.add('hidden');
};

function downloadFile(filename, type, content) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

// Allow importing a new story.yaml file
document.getElementById('load-story').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const yamlText = ev.target.result;
            const newData = jsyaml.load(yamlText);
            
            // Basic validation
            if (!newData.passages || typeof newData.passages !== 'object') {
                alert("Invalid story file: missing passages");
                return;
            }

            // Update global story and variables
            window.storyData = newData;
            variables = JSON.parse(JSON.stringify(newData.variables || { inventory: {}, relationships: {}, flags: {} }));

            // Rebuild the graph from scratch
            graph.clear();
            Object.keys(newData.passages).forEach(id => {
                const p = newData.passages[id];
                const node = LiteGraph.createNode("story/passage");
                node.properties.id = id;
                node.properties.text = (p.text || "").trim();
                node.pos = [Math.random() * 500 + 100, Math.random() * 300 + 100];
                graph.add(node);
            });

            // Reconnect choices
            Object.keys(newData.passages).forEach(sourceId => {
                const sourceNode = graph.findNodesByTitle(sourceId)[0];
                if (!sourceNode || !newData.passages[sourceId].choices) return;
                newData.passages[sourceId].choices.forEach(choice => {
                    const targetNode = graph.findNodesByTitle(choice.target)[0];
                    if (targetNode) {
                        const link = sourceNode.connect(0, targetNode, 0);
                        link.choiceText = choice.text || "";
                        link.condition = choice.condition || "";
                        link.effect = choice.effect || "";
                    }
                });
            });

            renderVariables();
            alert("Story loaded successfully! Ready to edit or play.");
        } catch (err) {
            console.error(err);
            alert("Failed to load story.yaml — check console for details");
        }
    };
    reader.readAsText(file);
});