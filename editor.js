// editor.js
let graph;
let graphcanvas;
let variables = { inventory: {}, relationships: {}, flags: {} };

function initEditor() {
    graph = new LGraph();
    graphcanvas = new LGraphCanvas("#graphcanvas", graph);

    // Custom Passage Node
    function PassageNode() {
        this.addOutput("choices", LiteGraph.ACTION);
        this.properties = { id: "start", text: "Your story begins here..." };
        this.size = [300, 200];
        this.serialize_widgets = true;
    }

    PassageNode.title = "Passage";
    PassageNode.prototype.onExecute = function() {}; // no execution needed

    PassageNode.prototype.getTitle = function() {
        return this.properties.id;
    };

    PassageNode.prototype.onPropertyChanged = function(name, value) {
        if (name === "id") {
            // ensure unique
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
        this.addWidget("space");
        this.addWidget("textarea", "Text", this.properties.text, (v) => { this.properties.text = v; }, { multiline: true });
    };

    LiteGraph.registerNodeType("story/passage", PassageNode);

    // Load from storyData
    Object.keys(window.storyData.passages).forEach(id => {
        const p = window.storyData.passages[id];
        const node = LiteGraph.createNode("story/passage");
        node.properties.id = id;
        node.properties.text = p.text.trim();
        node.pos = [Math.random()*500 + 100, Math.random()*300 + 100];
        graph.add(node);
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
    const yaml = jsyaml.dump(window.storyData);
    downloadFile("story.yaml", "text/yaml", yaml);
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