import jsyaml from 'js-yaml';
/**
 * editor.js — visual SVG node-graph editor for Pocket Stories (~3,000 lines)
 *
 * Module seams (see src/editor/types.ts for the migration plan):
 *   DATA MODEL        ~3–38    State variables, flags, highlight sets
 *   CONSTANTS         ~39–118  NODE_VARIANTS, VIEW_MODES, EDGE_TYPES, RISK_TOKENS
 *   PERSISTENCE       ~119–226 localStorage read/write for layout + UI state
 *   GRAPH MODEL       ~227–565 Edge/layer/adjacency graph utilities
 *   RENDERING/NODES   ~566–762 Node card, inspector, variant helpers
 *   HISTORY           ~762–793 saveState(), MAX_HISTORY
 *   INIT              ~794–1108 initEditor(), bindToolbarEvents()
 *   EVENT HANDLING    ~1109–1214 bindEditorEvents(), destroyEditor()
 *   CANVAS            ~1215–1378 Transform, zoom, edge detail
 *   RENDERING/EDGES   ~1379–1600 buildEdgePath(), drawConnections()
 *   LAYOUT            ~1601–1785 View mode, collapse, auto-layout, fit/jump
 *   SIDEBAR PANELS    ~1786–1898 Passage list, variable panel
 *   EXPORT/IMPORT     ~1899–2034 exportYAML(), generateBranchingScript()
 *   MODAL             ~2035–2124 showModal() + dialog HTML
 *   DOWNSTREAM        ~2125–2330 Downstream highlight, focus node
 *   DIAGNOSTICS       ~2331–2692 Analyzers, autofix, validation panel
 *   UNDO/REDO         ~2693–2800 undo(), redo(), applyStateIncremental()
 *   BOOTSTRAP         ~2800–3000 Module-level bindings (sampleStory, addVar, help)
 */

// ============================================================
// DATA MODEL — module-level mutable state
// ============================================================
let nodesContainer;
let svgCanvas;
let variables = { inventory: {}, relationships: {}, flags: {} };
let pan = { x: 0, y: 0 };
let scale = 1;
let isPanning = false;
let isSpacePanning = false;
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
let _boundOnDocMouseMove = null;
let _boundOnDocMouseUp = null;
let _boundOnDocKeyDown = null;
let _boundOnDocKeyUp = null;
let _boundOnDocConnectionMouseUp = null;
let _boundOnWrapperWheel = null;
let _boundOnTouchStart = null;
let _boundOnTouchMove = null;
let _boundOnTouchEnd = null;
let showSecondaryEdges = true;
let inspectorEls = null;
let editorUiState = { collapsedById: {}, focusCriticalPath: false, canvasViewMode: 'author' };
let diagnosticsState = { issues: [], analyzers: {}, byNode: {} };
let _autoDiagnosticsTimer = null;
let hoveredNodeId = null;
let _preservedSelectedId = null;
let downstreamHighlight = { nodes: new Set(), edges: new Set() };
let highlightFullDownstream = false;

// ============================================================
// CONSTANTS
// ============================================================
const EDGE_DETAIL_LEVELS = {
    HIDE_LABELS: 0.75,
    SHOW_LABELS: 0.95
};

const NODE_VARIANTS = {
    start: { label: 'Start', icon: '🚩', className: 'variant-start' },
    dialogue: { label: 'Dialogue', icon: '💬', className: 'variant-dialogue' },
    choice: { label: 'Choice', icon: '🔀', className: 'variant-choice' },
    condition: { label: 'Condition', icon: '🧪', className: 'variant-condition' },
    merge: { label: 'Merge', icon: '🧷', className: 'variant-merge' },
    ending: { label: 'Ending', icon: '🏁', className: 'variant-ending' }
};

const RISK_TOKENS = {
    deadEnd: { label: 'Dead End', className: 'risk-dead-end' },
    unresolvedReference: { label: 'Unresolved Ref', className: 'risk-unresolved' },
    unreachable: { label: 'Unreachable', className: 'risk-unreachable' },
    noExit: { label: 'No Exit', className: 'risk-no-exit' },
    dangling: { label: 'Dangling Ref', className: 'risk-dangling' },
    cycle: { label: 'Cycle', className: 'risk-cycle' }
};

const EDGE_TYPES = {
    PROGRESSION: 'progression',
    CHOICE: 'choice',
    JUMP: 'jump',
    RETURN: 'return'
};

const VIEW_MODES = {
    AUTHOR: 'author',
    LOGIC: 'logic',
    PLAYTEST: 'playtest'
};

const VIEW_MODE_ORDER = [VIEW_MODES.AUTHOR, VIEW_MODES.LOGIC, VIEW_MODES.PLAYTEST];

const VIEW_MODE_PRESETS = {
    [VIEW_MODES.AUTHOR]: {
        label: 'Author',
        nodeTemplate: {
            start: { label: 'Start', icon: '🚩', className: 'variant-start' },
            dialogue: { label: 'Dialogue', icon: '💬', className: 'variant-dialogue' },
            choice: { label: 'Choice', icon: '🔀', className: 'variant-choice' },
            condition: { label: 'Condition', icon: '🧪', className: 'variant-condition' },
            merge: { label: 'Merge', icon: '🧷', className: 'variant-merge' },
            ending: { label: 'Ending', icon: '🏁', className: 'variant-ending' }
        },
        edgeStyleClass: 'edge-style-author',
        defaultFilters: { showSecondaryEdges: true, focusCriticalPath: false, highlightFullDownstream: false }
    },
    [VIEW_MODES.LOGIC]: {
        label: 'Logic',
        nodeTemplate: {
            start: { label: 'Entry', icon: '⊙', className: 'variant-start' },
            dialogue: { label: 'Step', icon: '◻', className: 'variant-dialogue' },
            choice: { label: 'Branch', icon: '⋈', className: 'variant-choice' },
            condition: { label: 'Gate', icon: '◇', className: 'variant-condition' },
            merge: { label: 'Merge', icon: '⋃', className: 'variant-merge' },
            ending: { label: 'Terminal', icon: '◎', className: 'variant-ending' }
        },
        edgeStyleClass: 'edge-style-logic',
        defaultFilters: { showSecondaryEdges: true, focusCriticalPath: true, highlightFullDownstream: false }
    },
    [VIEW_MODES.PLAYTEST]: {
        label: 'Playtest',
        nodeTemplate: {
            start: { label: 'Start', icon: '▶', className: 'variant-start' },
            dialogue: { label: 'Scene', icon: '🎬', className: 'variant-dialogue' },
            choice: { label: 'Decision', icon: '🎮', className: 'variant-choice' },
            condition: { label: 'Check', icon: '🎯', className: 'variant-condition' },
            merge: { label: 'Join', icon: '🔁', className: 'variant-merge' },
            ending: { label: 'Outcome', icon: '🏆', className: 'variant-ending' }
        },
        edgeStyleClass: 'edge-style-playtest',
        defaultFilters: { showSecondaryEdges: false, focusCriticalPath: false, highlightFullDownstream: true }
    }
};

// ============================================================
// PERSISTENCE — localStorage read/write for layout + UI state
// ============================================================
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

function getStoryEditorUiStateStorageKey() {
    const { newKey } = getStoryLayoutStorageKey();
    return `${newKey}_ui`;
}

function normalizeEditorUiState(rawState) {
    const collapsedById = {};
    const rawCollapsed = rawState && typeof rawState.collapsedById === 'object' ? rawState.collapsedById : {};
    Object.entries(rawCollapsed).forEach(([id, value]) => {
        if (value === true) collapsedById[id] = true;
    });

    return {
        collapsedById,
        focusCriticalPath: Boolean(rawState?.focusCriticalPath),
        canvasViewMode: VIEW_MODE_ORDER.includes(rawState?.canvasViewMode) ? rawState.canvasViewMode : VIEW_MODES.AUTHOR
    };
}

function getStoryEditorUiState() {
    const key = getStoryEditorUiStateStorageKey();
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        return normalizeEditorUiState(parsed);
    } catch (error) {
        console.warn('Failed to parse editor UI state', error);
        return { collapsedById: {}, focusCriticalPath: false, canvasViewMode: VIEW_MODES.AUTHOR };
    }
}

function saveStoryEditorUiState() {
    const key = getStoryEditorUiStateStorageKey();
    localStorage.setItem(key, JSON.stringify(editorUiState));
}

function normalizeLayoutRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const x = Number(record.x);
    const y = Number(record.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
        x,
        y,
        manualOverride: Boolean(record.manualOverride)
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
        const raw = JSON.parse(localStorage.getItem(newKey) || '{}');
        const normalized = {};
        Object.entries(raw).forEach(([id, record]) => {
            if (typeof record === 'number') return;
            if (record && typeof record.x === 'number' && typeof record.y === 'number') {
                normalized[id] = normalizeLayoutRecord(record);
            }
        });
        return normalized;
    } catch (err) {
        console.warn('Failed to parse saved layout from localStorage', err);
        return {};
    }
}

function saveStoryLayout(layout) {
    const { newKey } = getStoryLayoutStorageKey();
    localStorage.setItem(newKey, JSON.stringify(layout));
}

function saveManualNodePosition(id, x, y) {
    const layout = getStoryLayout();
    layout[id] = { x, y, manualOverride: true };
    saveStoryLayout(layout);
}

function isNodeManuallyPositioned(passage, layoutEntry) {
    return Boolean(layoutEntry?.manualOverride || passage?.position?.manualOverride === true);
}

// ============================================================
// GRAPH MODEL — edge/layer/adjacency utilities
// ============================================================
function classifyEdgeType(fromId, toId, choice, layerById) {
    if (choice.edgeType && Object.values(EDGE_TYPES).includes(choice.edgeType)) {
        return choice.edgeType;
    }

    if (choice.return === true || /\breturn\b/i.test(choice.text || '')) return EDGE_TYPES.RETURN;
    if (choice.jump === true || /\bjump\b/i.test(choice.text || '')) return EDGE_TYPES.JUMP;

    const fromLayer = layerById.get(fromId);
    const toLayer = layerById.get(toId);
    if (Number.isFinite(fromLayer) && Number.isFinite(toLayer)) {
        if (toLayer <= fromLayer) return EDGE_TYPES.RETURN;
        if (toLayer - fromLayer > 1) return EDGE_TYPES.JUMP;
    }

    const hasChoiceSignals = Boolean(choice.condition || choice.effect || ((choice.text || '').trim() && (choice.text || '').trim().toLowerCase() !== 'continue'));
    return hasChoiceSignals ? EDGE_TYPES.CHOICE : EDGE_TYPES.PROGRESSION;
}

function getPrimaryGraphLayers(passages) {
    const ids = Object.keys(passages);
    const adjacency = new Map(ids.map(id => [id, []]));
    const indegree = new Map(ids.map(id => [id, 0]));

    ids.forEach(id => {
        (passages[id].choices || []).forEach(ch => {
            if (!passages[ch.target]) return;
            adjacency.get(id).push(ch.target);
            indegree.set(ch.target, (indegree.get(ch.target) || 0) + 1);
        });
    });

    const startId = passages.start ? 'start' : ids[0];
    const queue = [];
    const layerById = new Map();
    if (startId) {
        layerById.set(startId, 0);
        queue.push(startId);
    }

    while (queue.length) {
        const current = queue.shift();
        const currentLayer = layerById.get(current) || 0;
        (adjacency.get(current) || []).forEach(next => {
            const proposed = currentLayer + 1;
            if (!layerById.has(next) || proposed < layerById.get(next)) {
                layerById.set(next, proposed);
                queue.push(next);
            }
        });
    }

    let fallbackLayer = Math.max(0, ...Array.from(layerById.values(), v => v || 0));
    ids.forEach(id => {
        if (!layerById.has(id)) {
            fallbackLayer += 1;
            layerById.set(id, fallbackLayer);
        }
    });

    const layers = new Map();
    layerById.forEach((layer, id) => {
        if (!layers.has(layer)) layers.set(layer, []);
        layers.get(layer).push(id);
    });

    const parentMap = new Map(ids.map(id => [id, []]));
    ids.forEach(id => {
        (adjacency.get(id) || []).forEach(target => {
            parentMap.get(target).push(id);
        });
    });

    Array.from(layers.keys()).sort((a, b) => a - b).forEach(layer => {
        const idsInLayer = layers.get(layer);
        idsInLayer.sort((a, b) => {
            const pa = parentMap.get(a);
            const pb = parentMap.get(b);
            const avgA = pa.length ? pa.reduce((sum, pid) => sum + ((layers.get(layer - 1) || []).indexOf(pid) + 1), 0) / pa.length : Number.MAX_SAFE_INTEGER;
            const avgB = pb.length ? pb.reduce((sum, pid) => sum + ((layers.get(layer - 1) || []).indexOf(pid) + 1), 0) / pb.length : Number.MAX_SAFE_INTEGER;
            return avgA - avgB || a.localeCompare(b);
        });
    });

    return { layerById, layers };
}

function collectEdges(passages) {
    const { layerById } = getPrimaryGraphLayers(passages);
    const edges = [];

    Object.keys(passages).forEach(id => {
        const p = passages[id];
        (p.choices || []).forEach((choice, choiceIndex) => {
            if (!passages[choice.target]) return;
            const type = classifyEdgeType(id, choice.target, choice, layerById);
            edges.push({
                id: `${id}-to-${choice.target}-${choiceIndex}`,
                from: id,
                to: choice.target,
                choiceIndex,
                choice,
                type,
                isPrimary: type === EDGE_TYPES.PROGRESSION || type === EDGE_TYPES.CHOICE
            });
        });
    });

    return { edges, layerById };
}

function getAdjacencyMap(passages) {
    const adjacency = new Map(Object.keys(passages).map(id => [id, []]));
    Object.keys(passages).forEach(id => {
        (passages[id].choices || []).forEach((choice, index) => {
            if (!passages[choice.target]) return;
            adjacency.get(id).push({ target: choice.target, choice, index });
        });
    });
    return adjacency;
}

function collectCollapsedDescendants(passages, collapsedById) {
    const hidden = new Set();
    const adjacency = getAdjacencyMap(passages);

    Object.keys(collapsedById || {}).forEach(id => {
        if (!collapsedById[id] || !passages[id]) return;
        const queue = [...(adjacency.get(id) || []).map(edge => edge.target)];
        while (queue.length) {
            const current = queue.shift();
            if (hidden.has(current)) continue;
            hidden.add(current);
            (adjacency.get(current) || []).forEach(edge => queue.push(edge.target));
        }
    });

    return hidden;
}

function collectCriticalPathNodes(passages) {
    const startId = passages.start ? 'start' : Object.keys(passages)[0];
    if (!startId) return new Set();
    const { edges } = collectEdges(passages);
    const outgoing = new Map(Object.keys(passages).map(id => [id, []]));
    edges.forEach(edge => outgoing.get(edge.from).push(edge));

    const memo = new Map();
    const visiting = new Set();
    function score(id) {
        if (memo.has(id)) return memo.get(id);
        if (visiting.has(id)) return 0;
        visiting.add(id);
        const options = outgoing.get(id) || [];
        const best = options.reduce((max, edge) => Math.max(max, score(edge.to)), 0);
        const total = 1 + best;
        visiting.delete(id);
        memo.set(id, total);
        return total;
    }

    const critical = new Set();
    let cursor = startId;
    const seen = new Set();
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        critical.add(cursor);
        const options = (outgoing.get(cursor) || []).slice().sort((a, b) => {
            if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
            return score(b.to) - score(a.to);
        });
        cursor = options[0]?.to || null;
    }

    return critical;
}

function buildCanonicalGraphModel(passages) {
    const safePassages = passages || {};
    const incomingCounts = getIncomingCounts(safePassages);
    const { edges, layerById } = collectEdges(safePassages);
    const nodes = Object.keys(safePassages).map(id => {
        const passage = safePassages[id];
        return {
            id,
            passage,
            incomingCount: incomingCounts[id] || 0,
            variantId: inferNodeVariant(id, passage, incomingCounts[id] || 0),
            risks: getNodeRisks(id, passage)
        };
    });
    return {
        nodes,
        nodesById: new Map(nodes.map(node => [node.id, node])),
        edges,
        layerById
    };
}

function getActiveViewMode() {
    const mode = editorUiState.canvasViewMode;
    return VIEW_MODE_ORDER.includes(mode) ? mode : VIEW_MODES.AUTHOR;
}

function getModePreset(mode = getActiveViewMode()) {
    return VIEW_MODE_PRESETS[mode] || VIEW_MODE_PRESETS[VIEW_MODES.AUTHOR];
}

function getNodeTemplate(variantId, mode = getActiveViewMode()) {
    const preset = getModePreset(mode);
    return preset.nodeTemplate[variantId] || preset.nodeTemplate.dialogue || NODE_VARIANTS.dialogue;
}

function getRenderedGraphState(passages, graphModel = buildCanonicalGraphModel(passages)) {
    const hiddenNodes = collectCollapsedDescendants(passages, editorUiState.collapsedById);
    const visibleNodes = new Set(Object.keys(passages).filter(id => !hiddenNodes.has(id)));
    const edges = graphModel.edges;
    const adjacency = new Map(Object.keys(passages).map(id => [id, []]));
    edges.forEach(edge => adjacency.get(edge.from).push(edge));

    const renderedEdges = [];
    edges.forEach(edge => {
        if (visibleNodes.has(edge.from) && visibleNodes.has(edge.to)) {
            renderedEdges.push({ ...edge, rerouted: false });
            return;
        }

        if (!visibleNodes.has(edge.from) || visibleNodes.has(edge.to)) return;

        const queue = [edge.to];
        const visited = new Set(queue);
        const rerouteTargets = new Set();
        while (queue.length) {
            const current = queue.shift();
            if (visibleNodes.has(current)) {
                rerouteTargets.add(current);
                continue;
            }
            (adjacency.get(current) || []).forEach(nextEdge => {
                if (!visited.has(nextEdge.to)) {
                    visited.add(nextEdge.to);
                    queue.push(nextEdge.to);
                }
            });
        }

        rerouteTargets.forEach(target => {
            if (target === edge.from) return;
            renderedEdges.push({
                ...edge,
                id: `${edge.id}-via-${target}`,
                to: target,
                rerouted: true
            });
        });
    });

    const criticalNodes = editorUiState.focusCriticalPath ? collectCriticalPathNodes(passages) : null;

    return { visibleNodes, renderedEdges, criticalNodes };
}

function getIncomingCounts(passages) {
    const counts = {};
    Object.keys(passages || {}).forEach(id => { counts[id] = 0; });
    Object.values(passages || {}).forEach(passage => {
        (passage.choices || []).forEach(choice => {
            if (Object.prototype.hasOwnProperty.call(counts, choice.target)) {
                counts[choice.target] += 1;
            }
        });
    });
    return counts;
}

function inferNodeVariant(id, passage, incomingCount = 0) {
    const explicitVariant = getStoredNodeVariant(passage);
    if (explicitVariant) return explicitVariant;
    if (id === 'start') return 'start';
    const choices = passage.choices || [];
    if (choices.length === 0) return 'ending';
    if (choices.some(choice => Boolean(choice.condition))) return 'condition';
    if (choices.length > 1) return 'choice';
    if (incomingCount > 1) return 'merge';
    return 'dialogue';
}

function normalizeVariantToken(value) {
    return String(value || '').trim().toLowerCase();
}

function getStoredNodeVariantRaw(passage) {
    if (!passage || typeof passage !== 'object') return '';
    const metadataType = (passage.metadata && typeof passage.metadata === 'object' && typeof passage.metadata.nodeType === 'string')
        ? passage.metadata.nodeType
        : '';
    if (typeof passage.nodeType === 'string' && passage.nodeType.trim()) return passage.nodeType;
    return metadataType;
}

function getStoredNodeVariant(passage) {
    const token = normalizeVariantToken(getStoredNodeVariantRaw(passage));
    return Object.prototype.hasOwnProperty.call(NODE_VARIANTS, token) ? token : '';
}

function setStoredNodeVariant(passage, nextTypeToken) {
    if (!passage || typeof passage !== 'object') return;
    const normalized = normalizeVariantToken(nextTypeToken);
    const storedValue = normalized || undefined;

    if (storedValue) {
        passage.nodeType = storedValue;
        if (!passage.metadata || typeof passage.metadata !== 'object') passage.metadata = {};
        passage.metadata.nodeType = storedValue;
        return;
    }

    delete passage.nodeType;
    if (passage.metadata && typeof passage.metadata === 'object') {
        delete passage.metadata.nodeType;
        if (Object.keys(passage.metadata).length === 0) delete passage.metadata;
    }
}

function getNodeRisks(id, passage) {
    const choices = passage.choices || [];
    const unresolvedReference = choices.some(choice => !window.storyData.passages[choice.target]);
    const analyzer = diagnosticsState.analyzers || {};
    return {
        deadEnd: id !== 'start' && choices.length === 0,
        unresolvedReference,
        unreachable: highlightedUnreachableNodes.has(id),
        noExit: (analyzer.noExitNodes || new Set()).has(id),
        dangling: (analyzer.danglingNodes || new Set()).has(id),
        cycle: (analyzer.cycleNodes || new Set()).has(id)
    };
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderInspectorMeta(nodeId, passage) {
    if (!inspectorEls?.meta) return;
    const choices = passage.choices || [];
    const missingTargets = choices.filter(ch => !window.storyData.passages[ch.target]).map(ch => ch.target);
    const isUnreachable = highlightedUnreachableNodes.has(nodeId);
    const textLen = (passage.text || '').trim().length;

    const statusBadge = isUnreachable
        ? '<span class="inspector-badge badge-warning">⚠ Unreachable</span>'
        : missingTargets.length
            ? `<span class="inspector-badge badge-error">✖ Dangling ref</span>`
            : choices.length === 0 && nodeId !== 'start'
                ? '<span class="inspector-badge badge-info">⊙ Ending node</span>'
                : '<span class="inspector-badge badge-ok">✓ OK</span>';

    const choiceRows = choices.map((ch, idx) => {
        const targetExists = Boolean(window.storyData.passages[ch.target]);
        const targetLabel = ch.target
            ? (targetExists ? `<a class="inspector-target-link" data-target="${escapeHtml(ch.target)}">${escapeHtml(ch.target)} →</a>` : `<span class="inspector-target-missing">${escapeHtml(ch.target || '?')} ✖</span>`)
            : '<span class="inspector-target-missing">? missing</span>';
        const condTag = ch.condition ? `<span class="inspector-tag tag-cond" title="${escapeHtml(ch.condition)}">if: ${escapeHtml(ch.condition.length > 28 ? ch.condition.slice(0, 28) + '…' : ch.condition)}</span>` : '';
        const effectTag = ch.effect ? `<span class="inspector-tag tag-effect" title="${escapeHtml(ch.effect)}">fx: ${escapeHtml(ch.effect.length > 28 ? ch.effect.slice(0, 28) + '…' : ch.effect)}</span>` : '';
        return `<div class="inspector-choice-row">
            <span class="inspector-choice-num">${idx + 1}.</span>
            <span class="inspector-choice-text">${escapeHtml((ch.text || '').trim() || '(no text)')}</span>
            <span class="inspector-choice-target">${targetLabel}</span>
            ${condTag}${effectTag}
        </div>`;
    }).join('');

    inspectorEls.meta.innerHTML = `
        <div class="inspector-meta-stats">
            ${statusBadge}
            <span class="inspector-meta-pill">${choices.length} choice${choices.length !== 1 ? 's' : ''}</span>
            <span class="inspector-meta-pill">${textLen} chars</span>
        </div>
        ${choices.length > 0 ? `<div class="inspector-choices-list">${choiceRows}</div>` : '<div class="inspector-no-choices">No choices — terminal passage.</div>'}
    `;

    // Wire jump-to-node links
    inspectorEls.meta.querySelectorAll('.inspector-target-link').forEach(link => {
        link.addEventListener('click', () => {
            const target = link.dataset.target;
            if (target) focusNode(target);
        });
    });
}

function refreshNodeCard(nodeId, graphModel = null) {
    const node = document.querySelector(`.node[data-id="${nodeId}"]`);
    const passage = window.storyData.passages[nodeId];
    if (!node || !passage) return;

    const resolvedGraphModel = graphModel || buildCanonicalGraphModel(window.storyData.passages || {});
    const modelNode = resolvedGraphModel.nodesById.get(nodeId);
    const variantId = modelNode?.variantId || inferNodeVariant(nodeId, passage, 0);
    const variant = getNodeTemplate(variantId);
    const risks = modelNode?.risks || getNodeRisks(nodeId, passage);
    const text = (passage.text || '').trim();
    const riskBadges = Object.entries(risks)
        .filter(([, active]) => active)
        .map(([riskId]) => {
            const risk = RISK_TOKENS[riskId];
            return `<span class="node-badge risk ${risk.className}">${risk.label}</span>`;
        })
        .join('');

    const isCollapsed = editorUiState.collapsedById[nodeId] === true;
    node.className = `node ${variant.className} node-mode-${getActiveViewMode()}`;
    if (selectedNode === node) node.classList.add('selected');
    if (isCollapsed) node.classList.add('node-collapsed');
    node.innerHTML = `
        <div class="node-header">
            <span class="node-variant-icon">${variant.icon}</span>
            <div class="node-header-text">
                <div class="node-title">${escapeHtml(nodeId)} ${isCollapsed ? '<span class="collapsed-tag">▾ collapsed</span>' : ''}</div>
                <div class="node-subtitle">${variant.label}</div>
            </div>
        </div>
        <div class="node-preview">${escapeHtml(text)}</div>
        <div class="node-meta-badges">
            <span class="node-badge variant ${variant.className}">${variant.label}</span>
            ${riskBadges}
        </div>
        <div class="node-output"></div>
    `;

    node.querySelector('.node-output').addEventListener('mousedown', e => {
        e.stopPropagation();
        connectingFrom = node;
    });
}

function updateNodeInspector(nodeId = null) {
    if (!inspectorEls) return;
    if (!nodeId || !window.storyData.passages[nodeId]) {
        inspectorEls.empty.classList.remove('hidden');
        inspectorEls.content.classList.add('hidden');
        return;
    }

    const passage = window.storyData.passages[nodeId];
    const incomingCounts = getIncomingCounts(window.storyData.passages || {});
    const variantId = inferNodeVariant(nodeId, passage, incomingCounts[nodeId] || 0);

    inspectorEls.empty.classList.add('hidden');
    inspectorEls.content.classList.remove('hidden');
    inspectorEls.id.value = nodeId;
    inspectorEls.id.dataset.originalId = nodeId;
    const explicitVariant = normalizeVariantToken(getStoredNodeVariantRaw(passage));
    const hasKnownExplicitVariant = Boolean(explicitVariant) && Object.prototype.hasOwnProperty.call(NODE_VARIANTS, explicitVariant);
    if (inspectorEls.type) {
        inspectorEls.type.value = hasKnownExplicitVariant ? explicitVariant : (explicitVariant ? '__custom__' : '__auto__');
    }
    if (inspectorEls.typeCustom) {
        inspectorEls.typeCustom.value = hasKnownExplicitVariant ? '' : explicitVariant;
        inspectorEls.typeCustom.classList.toggle('hidden', !explicitVariant || hasKnownExplicitVariant);
    }
    inspectorEls.text.value = (passage.text || '').trim();
    renderInspectorMeta(nodeId, passage);
}

function applyInspectorTypeEdit() {
    const activeId = inspectorEls?.id?.dataset?.originalId;
    const passage = activeId ? window.storyData.passages?.[activeId] : null;
    if (!activeId || !passage || !inspectorEls?.type) return;

    let nextToken = '';
    if (inspectorEls.type.value === '__custom__') {
        nextToken = normalizeVariantToken(inspectorEls.typeCustom?.value || '');
    } else if (inspectorEls.type.value !== '__auto__') {
        nextToken = normalizeVariantToken(inspectorEls.type.value);
    }

    setStoredNodeVariant(passage, nextToken);
    if (inspectorEls.typeCustom) {
        inspectorEls.typeCustom.classList.toggle('hidden', inspectorEls.type.value !== '__custom__');
    }

    refreshNodeCard(activeId);
    renderPassageList();
    updateNodeInspector(activeId);
    drawConnections();
    saveState();
}

function selectNodeByElement(node) {
    if (selectedNode) selectedNode.classList.remove('selected');
    selectedNode = node;
    _preservedSelectedId = node ? node.dataset.id : null;
    if (selectedNode) selectedNode.classList.add('selected');
    updateNodeInspector(selectedNode ? selectedNode.dataset.id : null);
    refreshDownstreamHighlight();
    drawConnections();
}

function runLayeredAutoLayout(passages) {
    const { edges, layerById } = collectEdges(passages);
    const layers = new Map();
    layerById.forEach((layer, id) => {
        if (!layers.has(layer)) layers.set(layer, []);
        layers.get(layer).push(id);
    });

    const xSpacing = 430;
    const ySpacing = 250;
    const originX = 140;
    const originY = 130;
    const layout = getStoryLayout();
    const positions = {};

    Array.from(layers.keys()).sort((a, b) => a - b).forEach(layer => {
        const ids = layers.get(layer);
        ids.sort((a, b) => {
            const aParents = edges.filter(e => e.isPrimary && e.to === a).map(e => e.from);
            const bParents = edges.filter(e => e.isPrimary && e.to === b).map(e => e.from);
            const aAvg = aParents.length ? aParents.reduce((sum, pid) => sum + (positions[pid]?.y || originY), 0) / aParents.length : Number.MAX_SAFE_INTEGER;
            const bAvg = bParents.length ? bParents.reduce((sum, pid) => sum + (positions[pid]?.y || originY), 0) / bParents.length : Number.MAX_SAFE_INTEGER;
            return aAvg - bAvg || a.localeCompare(b);
        });

        ids.forEach((id, row) => {
            const passage = passages[id];
            const saved = layout[id];
            const hasManual = isNodeManuallyPositioned(passage, saved);
            if (hasManual) {
                positions[id] = {
                    x: (passage.position && passage.position.manualOverride === true) ? passage.position.x : (saved?.x ?? passage.position?.x),
                    y: (passage.position && passage.position.manualOverride === true) ? passage.position.y : (saved?.y ?? passage.position?.y)
                };
                return;
            }

            positions[id] = {
                x: originX + layer * xSpacing,
                y: originY + row * ySpacing
            };
        });
    });

    return positions;
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

// ============================================================
// HISTORY — undo/redo stack (saveState, MAX_HISTORY = 20)
// ============================================================
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
        historyIndex = MAX_HISTORY - 1;
    } else {
        historyIndex += 1;
    }

    // Notify React of the mutation (skip on init to avoid re-render on every initEditor() call)
    if (!options.resetHistory && typeof window.onStoryChange === 'function') {
        window.onStoryChange(window.storyData);
    }

    // Auto-run diagnostics after mutations (debounced 1.2s, no modal)
    if (!options.resetHistory && diagnosticsState.issues.length >= 0) {
        if (_autoDiagnosticsTimer) clearTimeout(_autoDiagnosticsTimer);
        _autoDiagnosticsTimer = setTimeout(() => {
            _autoDiagnosticsTimer = null;
            validateStory({ showModalReport: false });
        }, 1200);
    }
}

function initEditor() {
    nodesContainer = document.getElementById('nodes-container');
    svgCanvas = document.getElementById('svg-canvas');

    // Clear previous content
    nodesContainer.innerHTML = '';
    svgCanvas.innerHTML = `<defs>
        <marker id="arrow" markerWidth="11" markerHeight="11" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L10,3 z" fill="#64748b" />
        </marker>
        <marker id="arrow-active" markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L11,3 z" fill="#0ea5e9" />
        </marker>
    </defs>`;

    // Ensure start passage exists
    if (!window.storyData.passages.start) {
        window.storyData.passages.start = {
            text: "You begin your adventure...\n\nWhat do you do?",
            choices: []
        };
        console.log('Auto-created missing start passage');
    }

    const autoPositions = runLayeredAutoLayout(window.storyData.passages);
    editorUiState = getStoryEditorUiState();
    editorUiState.collapsedById = Object.fromEntries(
        Object.entries(editorUiState.collapsedById).filter(([id, collapsed]) => collapsed && Boolean(window.storyData.passages[id]))
    );
    saveStoryEditorUiState();

    // Create nodes with safe initial positions
    let index = 0;
    Object.keys(window.storyData.passages).forEach(id => {
        const p = window.storyData.passages[id];
        if (!p.position && autoPositions[id]) {
            p.position = { ...autoPositions[id], manualOverride: false };
        }
        createNode(id, p.text.trim(), index++);
    });

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

    inspectorEls = {
        empty: document.querySelector('#node-inspector .inspector-empty'),
        content: document.querySelector('#node-inspector .inspector-content'),
        id: document.getElementById('inspector-node-id'),
        type: document.getElementById('inspector-node-type'),
        typeCustom: document.getElementById('inspector-node-type-custom'),
        text: document.getElementById('inspector-node-text'),
        meta: document.getElementById('inspector-node-meta')
    };

    if (inspectorEls.id) {
        inspectorEls.id.onblur = () => {
            const originalId = inspectorEls.id.dataset.originalId;
            const nextId = inspectorEls.id.value.trim();
            if (!originalId || !nextId || nextId === originalId) return;
            if (window.storyData.passages[nextId]) {
                alert(`Passage "${nextId}" already exists.`);
                inspectorEls.id.value = originalId;
                return;
            }

            window.storyData.passages[nextId] = JSON.parse(JSON.stringify(window.storyData.passages[originalId]));
            delete window.storyData.passages[originalId];
            if (editorUiState.collapsedById[originalId]) {
                editorUiState.collapsedById[nextId] = true;
            }
            delete editorUiState.collapsedById[originalId];
            saveStoryEditorUiState();

            Object.values(window.storyData.passages).forEach(p => {
                (p.choices || []).forEach(choice => {
                    if (choice.target === originalId) choice.target = nextId;
                });
            });

            const node = document.querySelector(`.node[data-id="${originalId}"]`);
            if (node) {
                node.dataset.id = nextId;
                refreshNodeCard(nextId);
                selectedNode = node;
            }

            renderPassageList();
            drawConnections();
            updateNodeInspector(nextId);
            saveState();
        };
    }

    if (inspectorEls.text) {
        inspectorEls.text.onblur = () => {
            const activeId = inspectorEls.id?.dataset.originalId;
            if (!activeId || !window.storyData.passages[activeId]) return;
            window.storyData.passages[activeId].text = inspectorEls.text.value + '\n';
            refreshNodeCard(activeId);
            renderPassageList();
            saveState();
        };
    }

    if (inspectorEls.type) {
        inspectorEls.type.onchange = () => {
            if (inspectorEls.type.value === '__custom__') {
                if (inspectorEls.typeCustom) {
                    inspectorEls.typeCustom.classList.remove('hidden');
                    inspectorEls.typeCustom.focus();
                }
                return;
            }
            applyInspectorTypeEdit();
        };
    }

    if (inspectorEls.typeCustom) {
        inspectorEls.typeCustom.onblur = () => {
            if (inspectorEls.type?.value === '__custom__') applyInspectorTypeEdit();
        };
        inspectorEls.typeCustom.onkeydown = e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyInspectorTypeEdit();
                inspectorEls.typeCustom.blur();
            }
        };
    }

    // Restore previously selected node after re-init
    if (_preservedSelectedId && window.storyData.passages[_preservedSelectedId]) {
        const restoredNode = nodesContainer.querySelector(`.node[data-id="${_preservedSelectedId}"]`);
        if (restoredNode) {
            selectedNode = restoredNode;
            restoredNode.classList.add('selected');
            updateNodeInspector(_preservedSelectedId);
        } else {
            updateNodeInspector(null);
        }
    } else {
        updateNodeInspector(null);
    }

    const searchInput = document.getElementById('passage-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = () => applyPassageSearch(searchInput.value);
    }

    bindEditorEvents();
    bindToolbarEvents();

    // Zoom and focus controls (wheel zoom is handled in bindEditorEvents)
    document.getElementById('zoom-in').onclick = () => { scale = Math.min(scale * 1.2, 2); updateTransform(); updateZoomIndicator(); };
    document.getElementById('zoom-out').onclick = () => { scale = Math.max(scale / 1.2, 0.3); updateTransform(); updateZoomIndicator(); };
    document.getElementById('zoom-reset').onclick = () => { scale = 1; pan = { x: 0, y: 0 }; updateTransform(); updateZoomIndicator(); };
    document.getElementById('zoom-fit').onclick = fitToNodes;
    const focusStartBtn = document.getElementById('focus-start');
    if (focusStartBtn) focusStartBtn.onclick = () => jumpToPassage('start');
    const focusStartClusterBtn = document.getElementById('focus-start-cluster');
    if (focusStartClusterBtn) focusStartClusterBtn.onclick = () => focusStartCluster();
    const viewModeSelector = document.getElementById('canvas-view-mode');
    if (viewModeSelector) {
        viewModeSelector.value = getActiveViewMode();
        viewModeSelector.onchange = (event) => {
            applyCanvasViewMode(event.target.value);
        };
    }

    const toggleSecondaryEdges = document.getElementById('toggle-secondary-edges');
    if (toggleSecondaryEdges) {
        toggleSecondaryEdges.checked = showSecondaryEdges;
        toggleSecondaryEdges.onchange = (event) => {
            showSecondaryEdges = event.target.checked;
            drawConnections();
        };
    }

    const focusCriticalPathToggle = document.getElementById('focus-critical-path');
    if (focusCriticalPathToggle) {
        focusCriticalPathToggle.checked = editorUiState.focusCriticalPath;
        focusCriticalPathToggle.onchange = (event) => {
            editorUiState.focusCriticalPath = event.target.checked;
            saveStoryEditorUiState();
            drawConnections();
        };
    }

    const fullDownstreamToggle = document.getElementById('highlight-full-downstream');
    if (fullDownstreamToggle) {
        fullDownstreamToggle.checked = highlightFullDownstream;
        fullDownstreamToggle.onchange = (event) => {
            highlightFullDownstream = event.target.checked;
            refreshDownstreamHighlight();
            drawConnections();
        };
    }

    const autoLayoutBtn = document.getElementById('auto-layout');
    if (autoLayoutBtn) {
        autoLayoutBtn.onclick = () => {
            applyAutoLayout();
        };
    }

    applyCanvasViewMode(getActiveViewMode(), { persist: false });
    updateZoomIndicator();
    validateStory({ showModalReport: false });

    // View mode buttons (proxy to hidden #canvas-view-mode select)
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.onclick = () => {
            const mode = btn.dataset.mode;
            if (mode) applyCanvasViewMode(mode);
        };
    });
    syncViewModeButtons(getActiveViewMode());

    // Split-view toggle buttons (proxy to hidden checkboxes)
    const secEdgesBtn = document.getElementById('toggle-secondary-edges-btn');
    const critPathBtn = document.getElementById('focus-critical-path-btn');
    const downstreamBtn = document.getElementById('highlight-full-downstream-btn');

    if (secEdgesBtn) {
        secEdgesBtn.dataset.active = showSecondaryEdges ? 'true' : 'false';
        secEdgesBtn.onclick = () => {
            showSecondaryEdges = !showSecondaryEdges;
            secEdgesBtn.dataset.active = showSecondaryEdges ? 'true' : 'false';
            const cb = document.getElementById('toggle-secondary-edges');
            if (cb) cb.checked = showSecondaryEdges;
            drawConnections();
        };
    }
    if (critPathBtn) {
        critPathBtn.dataset.active = editorUiState.focusCriticalPath ? 'true' : 'false';
        critPathBtn.onclick = () => {
            editorUiState.focusCriticalPath = !editorUiState.focusCriticalPath;
            critPathBtn.dataset.active = editorUiState.focusCriticalPath ? 'true' : 'false';
            const cb = document.getElementById('focus-critical-path');
            if (cb) cb.checked = editorUiState.focusCriticalPath;
            saveStoryEditorUiState();
            drawConnections();
        };
    }
    if (downstreamBtn) {
        downstreamBtn.dataset.active = highlightFullDownstream ? 'true' : 'false';
        downstreamBtn.onclick = () => {
            highlightFullDownstream = !highlightFullDownstream;
            downstreamBtn.dataset.active = highlightFullDownstream ? 'true' : 'false';
            const cb = document.getElementById('highlight-full-downstream');
            if (cb) cb.checked = highlightFullDownstream;
            refreshDownstreamHighlight();
            drawConnections();
        };
    }

    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.ondblclick = e => {
        if (e.target.closest('.node')) return;

        // Auto-generate a clean passage ID
        const existingIds = new Set(Object.keys(window.storyData.passages));
        let counter = existingIds.size + 1;
        let newId = `passage_${counter}`;
        while (existingIds.has(newId)) { counter++; newId = `passage_${counter}`; }

        const x = Math.max(0, (e.clientX - pan.x) / scale - 160);
        const y = Math.max(0, (e.clientY - pan.y) / scale - 100);

        window.storyData.passages[newId] = {
            text: 'Write your passage text here...\n',
            choices: [],
            position: { x, y }
        };

        createNode(newId, '', existingIds.size + 1);
        renderPassageList();
        drawConnections();
        expandCanvasIfNeeded();
        saveState();

        // Immediately open the new node in the inspector for editing
        const newNode = nodesContainer.querySelector(`.node[data-id="${newId}"]`);
        if (newNode) selectNodeByElement(newNode);
    };
}

function bindToolbarEvents() {
    const btnValidate = document.getElementById('validate-story');
    const btnExport = document.getElementById('export-yaml');
    const btnBranching = document.getElementById('branching-script');
    const btnPlay = document.getElementById('play-story');

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
        btnPlay.onclick = () => requestPlayerMode('Play Story button');
    }
}

function requestPlayerMode(sourceLabel = 'Editor') {
    if (typeof window.setAppMode === 'function') {
        const switched = window.setAppMode('player');
        if (switched === false && typeof window.setStoryStatus === 'function') {
            window.setStoryStatus(`Unable to switch to player mode from ${sourceLabel}.`, 'error');
        }
        return Boolean(switched);
    }

    const fallbackMessage = `Unable to open player mode from ${sourceLabel}: app mode bridge unavailable.`;
    if (typeof window.setStoryStatus === 'function') {
        window.setStoryStatus(fallbackMessage, 'error');
    } else {
        console.error(fallbackMessage);
    }
    return false;
}

// ============================================================
// EVENT HANDLING — bindEditorEvents(), destroyEditor()
// ============================================================
function bindEditorEvents() {
    if (editorEventsBound) return;

    const wrapper = document.getElementById('canvas-wrapper');

    nodesContainer.addEventListener('click', e => {
        if (e.target === nodesContainer || e.target === svgCanvas) {
            if (selectedNode) selectNodeByElement(null);
        }
    });

    wrapper.addEventListener('click', e => {
        if (e.target === wrapper || e.target === svgCanvas) {
            if (selectedNode) selectNodeByElement(null);
            document.querySelectorAll('.connection-path.selected').forEach(p => p.classList.remove('selected'));
        }
    });

    wrapper.addEventListener('mousedown', e => {
        const isLeftButton = e.button === 0;
        const isMiddleButton = e.button === 1;
        const isOnNode = Boolean(e.target.closest('.node'));
        const isOnConnectionEditTarget = Boolean(e.target.closest('.connection-path, .connection-label, .node-output'));
        const isOnInteractiveControl = Boolean(e.target.closest('button, input, textarea, select, option, a, label, [contenteditable="true"]'));
        const isCanvasBackground = e.target === wrapper || e.target === svgCanvas || e.target === nodesContainer;
        const shouldPanWithLeftButton = isLeftButton && !isOnNode && !isOnConnectionEditTarget && !isOnInteractiveControl && (isCanvasBackground || e.shiftKey || isSpacePanning);

        if (isMiddleButton || shouldPanWithLeftButton) {
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

    _boundOnDocMouseMove = e => {
        if (!isPanning) return;
        pan.x = e.clientX - panStart.x;
        pan.y = e.clientY - panStart.y;
        updateTransform();
    };

    _boundOnDocMouseUp = () => {
        if (isPanning) {
            isPanning = false;
            wrapper.style.cursor = 'default';
        }
    };

    _boundOnDocKeyDown = e => {
        if (e.code !== 'Space') return;
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        isSpacePanning = true;
    };

    _boundOnDocKeyUp = e => {
        if (e.code !== 'Space') return;
        isSpacePanning = false;
    };

    _boundOnDocConnectionMouseUp = e => {
        if (connectingFrom && e.target.closest('.node') && e.target.closest('.node') !== connectingFrom) {
            const fromId = connectingFrom.dataset.id;
            const toNode = e.target.closest('.node');
            const toId = toNode.dataset.id;
            if (fromId !== toId) {
                const text = prompt('Choice text', 'Continue');
                if (text) {
                    if (!window.storyData.passages[fromId].choices) window.storyData.passages[fromId].choices = [];
                    window.storyData.passages[fromId].choices.push({ text, target: toId });
                    drawConnections();
                    saveState();
                }
            }
        }
        connectingFrom = null;
    };

    document.addEventListener('mousemove', _boundOnDocMouseMove);
    document.addEventListener('mouseup', _boundOnDocMouseUp);
    document.addEventListener('keydown', _boundOnDocKeyDown);
    document.addEventListener('keyup', _boundOnDocKeyUp);
    document.addEventListener('mouseup', _boundOnDocConnectionMouseUp);

    // Scroll-to-zoom on wrapper (covers empty-space clicks too)
    _boundOnWrapperWheel = e => {
        e.preventDefault();
        const wrapperRect = wrapper.getBoundingClientRect();
        const pointerX = e.clientX - wrapperRect.left;
        const pointerY = e.clientY - wrapperRect.top;
        const worldX = (pointerX - pan.x) / scale;
        const worldY = (pointerY - pan.y) / scale;
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        scale = Math.max(0.3, Math.min(scale * factor, 2));
        pan.x = pointerX - worldX * scale;
        pan.y = pointerY - worldY * scale;
        updateTransform();
        updateZoomIndicator();
    };
    wrapper.addEventListener('wheel', _boundOnWrapperWheel, { passive: false });

    // Touch events — one finger: pan; two fingers: pinch-zoom
    let _touchPanActive = false;
    let _lastTouchDist = null;
    _boundOnTouchStart = e => {
        if (e.touches.length === 1) {
            _touchPanActive = true;
            _lastTouchDist = null;
            panStart.x = e.touches[0].clientX - pan.x;
            panStart.y = e.touches[0].clientY - pan.y;
        } else if (e.touches.length === 2) {
            _touchPanActive = false;
            const t1 = e.touches[0], t2 = e.touches[1];
            _lastTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        }
        if (!e.target.closest('.node, button, input, textarea, select')) e.preventDefault();
    };
    _boundOnTouchMove = e => {
        if (e.touches.length === 1 && _touchPanActive) {
            pan.x = e.touches[0].clientX - panStart.x;
            pan.y = e.touches[0].clientY - panStart.y;
            updateTransform();
            e.preventDefault();
        } else if (e.touches.length === 2 && _lastTouchDist !== null) {
            const t1 = e.touches[0], t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const midX = (t1.clientX + t2.clientX) / 2;
            const midY = (t1.clientY + t2.clientY) / 2;
            const wrapperRect = wrapper.getBoundingClientRect();
            const pointerX = midX - wrapperRect.left;
            const pointerY = midY - wrapperRect.top;
            const worldX = (pointerX - pan.x) / scale;
            const worldY = (pointerY - pan.y) / scale;
            const factor = dist / _lastTouchDist;
            scale = Math.max(0.3, Math.min(scale * factor, 2));
            pan.x = pointerX - worldX * scale;
            pan.y = pointerY - worldY * scale;
            updateTransform();
            updateZoomIndicator();
            _lastTouchDist = dist;
            e.preventDefault();
        }
    };
    _boundOnTouchEnd = e => {
        if (e.touches.length === 0) {
            _touchPanActive = false;
            _lastTouchDist = null;
        } else if (e.touches.length === 1) {
            _touchPanActive = true;
            _lastTouchDist = null;
            panStart.x = e.touches[0].clientX - pan.x;
            panStart.y = e.touches[0].clientY - pan.y;
        }
    };
    wrapper.addEventListener('touchstart', _boundOnTouchStart, { passive: false });
    wrapper.addEventListener('touchmove', _boundOnTouchMove, { passive: false });
    wrapper.addEventListener('touchend', _boundOnTouchEnd);

    editorEventsBound = true;
}

function destroyEditor() {
    if (_boundOnDocMouseMove) document.removeEventListener('mousemove', _boundOnDocMouseMove);
    if (_boundOnDocMouseUp) document.removeEventListener('mouseup', _boundOnDocMouseUp);
    if (_boundOnDocKeyDown) document.removeEventListener('keydown', _boundOnDocKeyDown);
    if (_boundOnDocKeyUp) document.removeEventListener('keyup', _boundOnDocKeyUp);
    if (_boundOnDocConnectionMouseUp) document.removeEventListener('mouseup', _boundOnDocConnectionMouseUp);
    _boundOnDocMouseMove = null;
    _boundOnDocMouseUp = null;
    _boundOnDocKeyDown = null;
    _boundOnDocKeyUp = null;
    _boundOnDocConnectionMouseUp = null;

    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) {
        if (_boundOnWrapperWheel) wrapper.removeEventListener('wheel', _boundOnWrapperWheel);
        if (_boundOnTouchStart) wrapper.removeEventListener('touchstart', _boundOnTouchStart);
        if (_boundOnTouchMove) wrapper.removeEventListener('touchmove', _boundOnTouchMove);
        if (_boundOnTouchEnd) wrapper.removeEventListener('touchend', _boundOnTouchEnd);
    }
    _boundOnWrapperWheel = null;
    _boundOnTouchStart = null;
    _boundOnTouchMove = null;
    _boundOnTouchEnd = null;

    editorEventsBound = false;
}

function updateTransform() {
    nodesContainer.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    svgCanvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    updateEdgeDetailVisibility();
}

function getEdgeLabelDetailLevel() {
    if (scale < EDGE_DETAIL_LEVELS.HIDE_LABELS) return 'hidden';
    if (scale < EDGE_DETAIL_LEVELS.SHOW_LABELS) return 'compact';
    return 'full';
}

function truncateEdgeLabel(label, maxLen = 34) {
    const compact = String(label || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= maxLen) return compact;
    return `${compact.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

function updateEdgeDetailVisibility() {
    if (!svgCanvas) return;
    const detailLevel = getEdgeLabelDetailLevel();
    svgCanvas.classList.toggle('zoom-labels-hidden', detailLevel === 'hidden');
    svgCanvas.classList.toggle('zoom-labels-compact', detailLevel === 'compact');
}

function getNodeCenter(node) {
    return {
        x: parseFloat(node.style.left) + node.offsetWidth / 2,
        y: parseFloat(node.style.top) + node.offsetHeight / 2
    };
}

function getBundleLayout(edges, nodeElements, layerById) {
    const groups = new Map();
    edges.forEach(edge => {
        const fromLayer = layerById.get(edge.from) ?? 0;
        const toLayer = layerById.get(edge.to) ?? 0;
        const dir = toLayer >= fromLayer ? 'fwd' : 'rev';
        const key = `${dir}:${Math.min(fromLayer, toLayer)}-${Math.max(fromLayer, toLayer)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(edge);
    });

    const layoutById = new Map();
    groups.forEach(group => {
        group.sort((a, b) => {
            const ac = (getNodeCenter(nodeElements.get(a.from)).y + getNodeCenter(nodeElements.get(a.to)).y) / 2;
            const bc = (getNodeCenter(nodeElements.get(b.from)).y + getNodeCenter(nodeElements.get(b.to)).y) / 2;
            return ac - bc || a.id.localeCompare(b.id);
        });
        const mid = (group.length - 1) / 2;
        group.forEach((edge, index) => {
            layoutById.set(edge.id, { bundleOffset: (index - mid) * 16, bundleSize: group.length });
        });
    });

    return layoutById;
}

function createNode(id, text, index) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'node';
    nodeDiv.dataset.id = id;

    const passage = window.storyData.passages[id];
    let posX, posY;

    if (passage.position) {
        posX = passage.position.x;
        posY = passage.position.y;
    } else {
        const layout = getStoryLayout();
        const saved = layout[id];
        if (saved) {
            posX = saved.x;
            posY = saved.y;
        } else {
            posX = 150 + (index % 4) * 380;
            posY = 150 + Math.floor(index / 4) * 320;
        }
    }

    nodeDiv.style.left = `${posX}px`;
    nodeDiv.style.top = `${posY}px`;

    nodeDiv.addEventListener('mousedown', e => {
        if (e.target.classList.contains('node-output')) {
            connectingFrom = nodeDiv;
            e.stopPropagation();
            return;
        }

        e.stopPropagation();

        // Select immediately on press — don't wait for click event, which
        // may not fire if the cursor moves even slightly during mousedown→mouseup.
        selectNodeByElement(nodeDiv);

        const startX = e.clientX;
        const startY = e.clientY;
        const origX = parseFloat(nodeDiv.style.left);
        const origY = parseFloat(nodeDiv.style.top);
        let hasMoved = false;

        nodeDiv.style.zIndex = 100;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
            nodeDiv.style.left = `${origX + dx}px`;
            nodeDiv.style.top = `${origY + dy}px`;
            drawConnections();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            nodeDiv.style.zIndex = '';
            expandCanvasIfNeeded();

            // Only save state if the node actually moved — avoids spurious
            // undo entries and React re-renders on plain clicks.
            if (hasMoved) {
                const newX = parseFloat(nodeDiv.style.left);
                const newY = parseFloat(nodeDiv.style.top);

                if (!window.storyData.passages[id].position) {
                    window.storyData.passages[id].position = {};
                }
                window.storyData.passages[id].position.x = newX;
                window.storyData.passages[id].position.y = newY;
                window.storyData.passages[id].position.manualOverride = true;

                saveManualNodePosition(id, newX, newY);
                drawConnections();
                saveState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // stopPropagation on click prevents the canvas background click handler
    // from deselecting the node we just selected in mousedown.
    nodeDiv.addEventListener('click', e => { e.stopPropagation(); });


    nodeDiv.addEventListener('mouseenter', () => {
        hoveredNodeId = nodeDiv.dataset.id;
        refreshDownstreamHighlight();
        drawConnections();
    });

    nodeDiv.addEventListener('mouseleave', () => {
        hoveredNodeId = null;
        refreshDownstreamHighlight();
        drawConnections();
    });
    nodeDiv.addEventListener('contextmenu', e => {
        if (e.target.classList.contains('node-output')) return;
        e.preventDefault();
        const nodeId = nodeDiv.dataset.id;
        if (confirm(`Test from here? Start Player Mode at "${nodeId}".`)) {
            window.__playerStartPassage = nodeId;
            requestPlayerMode(`node ${nodeId}`);
        }
    });

    nodesContainer.appendChild(nodeDiv);
    refreshNodeCard(id);
}

function buildEdgePath(edge, fromNode, toNode, layerById, bundleLayout) {
    const fromLeft = parseFloat(fromNode.style.left);
    const fromRight = fromLeft + fromNode.offsetWidth;
    const fromY = parseFloat(fromNode.style.top) + fromNode.offsetHeight / 2;
    const toLeft = parseFloat(toNode.style.left);
    const toRight = toLeft + toNode.offsetWidth;
    const toY = parseFloat(toNode.style.top) + toNode.offsetHeight / 2;

    const fromLayer = layerById.get(edge.from) ?? 0;
    const toLayer = layerById.get(edge.to) ?? 0;
    const forward = toLayer >= fromLayer;
    const lane = bundleLayout.get(edge.id)?.bundleOffset || 0;

    const startX = forward ? fromRight : fromLeft;
    const endX = forward ? toLeft : toRight;
    const direction = forward ? 1 : -1;

    const exitX = startX + direction * 28;
    let corridorX;
    if (forward) {
        corridorX = ((fromRight + toLeft) / 2) + lane;
    } else {
        corridorX = Math.max(fromRight, toRight) + 120 + lane;
    }

    if (edge.type === EDGE_TYPES.JUMP || edge.type === EDGE_TYPES.RETURN) {
        corridorX += direction * 40;
    }

    const entryX = endX - direction * 28;
    return `M ${startX} ${fromY} L ${exitX} ${fromY} L ${corridorX} ${fromY} L ${corridorX} ${toY} L ${entryX} ${toY} L ${endX} ${toY}`;
}

function applyEdgeValidationClasses(path, edgeKey, connId) {
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
}

// ============================================================
// RENDERING/EDGES — buildEdgePath(), drawConnections()
// ============================================================
function drawConnections() {
    svgCanvas.innerHTML = `<defs>
        <marker id="arrow" markerWidth="11" markerHeight="11" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L10,3 z" fill="#64748b" />
        </marker>
        <marker id="arrow-active" markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L11,3 z" fill="#0ea5e9" />
        </marker>
    </defs>`;

    const passages = window.storyData.passages || {};
    const graphModel = buildCanonicalGraphModel(passages);
    const { visibleNodes, renderedEdges, criticalNodes } = getRenderedGraphState(passages, graphModel);
    const { layerById } = graphModel;
    const activeMode = getActiveViewMode();
    const preset = getModePreset(activeMode);
    const graphContainer = document.getElementById('graph-container');
    if (graphContainer) {
        graphContainer.dataset.viewMode = activeMode;
    }
    const nodeElements = new Map();
    document.querySelectorAll('.node').forEach(node => nodeElements.set(node.dataset.id, node));
    const bundleLayout = getBundleLayout(renderedEdges, nodeElements, layerById);
    const orderedEdges = [
        ...renderedEdges.filter(edge => !edge.isPrimary),
        ...renderedEdges.filter(edge => edge.isPrimary)
    ];

    orderedEdges.forEach(edge => {
        if (!showSecondaryEdges && !edge.isPrimary) return;

        const fromNode = nodeElements.get(edge.from);
        const toNode = nodeElements.get(edge.to);
        if (!fromNode || !toNode) return;

        const pathD = buildEdgePath(edge, fromNode, toNode, layerById, bundleLayout);
        const edgeKey = `${edge.from}->${edge.to}`;

        const defPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        defPath.id = `textpath-${edge.id}`;
        defPath.setAttribute('d', pathD);
        defPath.style.display = 'none';
        svgCanvas.appendChild(defPath);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.classList.add('connection-path', `edge-${edge.type}`, `edge-mode-${activeMode}`, preset.edgeStyleClass);
        if (!edge.isPrimary) path.classList.add('edge-secondary');
        if (edge.rerouted) path.classList.add('edge-rerouted');
        if (criticalNodes && (!criticalNodes.has(edge.from) || !criticalNodes.has(edge.to))) {
            path.classList.add('edge-dimmed');
        }
        path.setAttribute('marker-end', (edge.from === hoveredNodeId || edge.to === hoveredNodeId || downstreamHighlight.edges.has(edgeKey)) ? 'url(#arrow-active)' : 'url(#arrow)');
        path.dataset.from = edge.from;
        path.dataset.to = edge.to;
        path.dataset.index = edge.choiceIndex;
        if (downstreamHighlight.edges.has(edgeKey)) {
            path.classList.add('edge-downstream-highlight');
        }
        if (edge.from === hoveredNodeId || edge.to === hoveredNodeId) {
            path.classList.add('edge-active');
        }
        applyEdgeValidationClasses(path, edgeKey, edge.id);

        path.addEventListener('click', e => {
            e.stopPropagation();
            if (selectedNode) selectNodeByElement(null);
            document.querySelectorAll('.connection-path.selected').forEach(p => p.classList.remove('selected'));
            path.classList.add('selected');
        });

        path.addEventListener('contextmenu', e => {
            e.preventDefault();
            const action = prompt('Connection action: type "edit" to edit, "delete" to remove.', 'edit');
            if (!action) return;

            const sourceChoices = window.storyData.passages[edge.from].choices;
            const choice = sourceChoices[edge.choiceIndex];
            if (!choice) return;

            if (action.toLowerCase() === 'delete') {
                if (confirm(`Delete connection "${choice.text || 'Continue'}" from ${edge.from} to ${edge.to}?`)) {
                    sourceChoices.splice(edge.choiceIndex, 1);
                    drawConnections();
                    saveState();
                }
                return;
            }

            if (action.toLowerCase() !== 'edit') return;

            const newText = prompt('Choice text', choice.text || '');
            if (newText !== null) choice.text = newText || undefined;
            const cond = prompt('Condition (optional)', choice.condition || '');
            if (cond !== null) choice.condition = cond || undefined;
            const eff = prompt('Effect (optional)', choice.effect || '');
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
                choice.effect = nextEffect;
            }
            drawConnections();
            saveState();
        });

        svgCanvas.appendChild(path);

        const fullLabelParts = [];
        if (edge.choice.text) fullLabelParts.push(edge.choice.text);
        if (edge.choice.condition) fullLabelParts.push(`if ${edge.choice.condition}`);
        if (edge.choice.effect) fullLabelParts.push(edge.choice.effect);
        let fullLabelText = fullLabelParts.join(' · ') || 'Continue';
        if (edge.rerouted) fullLabelText = `↷ ${fullLabelText}`;

        const isChoiceLike = edge.type === EDGE_TYPES.CHOICE || Boolean(edge.choice.condition);
        const shortLabel = truncateEdgeLabel(fullLabelText, 28);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.classList.add('connection-label', `edge-${edge.type}`, `edge-mode-${activeMode}`, preset.edgeStyleClass);
        if (!edge.isPrimary) text.classList.add('edge-secondary');
        if (criticalNodes && (!criticalNodes.has(edge.from) || !criticalNodes.has(edge.to))) {
            text.classList.add('edge-dimmed');
        }
        const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
        textPath.setAttribute('href', `#textpath-${edge.id}`);
        textPath.setAttribute('startOffset', '50%');
        textPath.setAttribute('text-anchor', 'middle');
        textPath.textContent = isChoiceLike ? shortLabel : truncateEdgeLabel(fullLabelText, 34);
        textPath.style.fontSize = '13px';
        textPath.style.fill = '#e2e8f0';
        text.appendChild(textPath);

        if (isChoiceLike) {
            text.classList.add('label-choice');
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = fullLabelText;
            text.appendChild(title);
        }
        svgCanvas.appendChild(text);
    });

    updateEdgeDetailVisibility();

    document.querySelectorAll('.node').forEach(node => {
        const nodeId = node.dataset.id;
        const isVisible = visibleNodes.has(nodeId);
        node.classList.toggle('node-hidden', !isVisible);
        if (!isVisible) {
            if (selectedNode === node) {
                selectNodeByElement(null);
            }
            return;
        }

        refreshNodeCard(nodeId, graphModel);
        node.classList.toggle('cycle-node', highlightedCycleNodes.has(nodeId));
        node.classList.toggle('unreachable-node', highlightedUnreachableNodes.has(nodeId));
        node.classList.toggle('validation-node-error', highlightedErrorNodes.has(nodeId));
        node.classList.toggle('validation-node-warning', highlightedWarningNodes.has(nodeId));
        node.classList.toggle('validation-node-info', highlightedInfoNodes.has(nodeId));
        node.classList.toggle('node-downstream-highlight', downstreamHighlight.nodes.has(nodeId));
        node.classList.toggle('node-dimmed', Boolean(criticalNodes) && !criticalNodes.has(nodeId));
    });

    const searchInput = document.getElementById('passage-search');
    if (searchInput) applyPassageSearch(searchInput.value || '');
}

function syncViewModeButtons(activeMode) {
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.dataset.active = (btn.dataset.mode === activeMode) ? 'true' : 'false';
    });
}

function applyCanvasViewMode(mode, { persist = true } = {}) {
    if (!VIEW_MODE_ORDER.includes(mode)) return;
    editorUiState.canvasViewMode = mode;
    const preset = getModePreset(mode);
    showSecondaryEdges = preset.defaultFilters.showSecondaryEdges;
    editorUiState.focusCriticalPath = preset.defaultFilters.focusCriticalPath;
    highlightFullDownstream = preset.defaultFilters.highlightFullDownstream;

    const selector = document.getElementById('canvas-view-mode');
    if (selector) selector.value = mode;
    syncViewModeButtons(mode);
    const toggleSecondaryEdges = document.getElementById('toggle-secondary-edges');
    if (toggleSecondaryEdges) toggleSecondaryEdges.checked = showSecondaryEdges;
    const focusCriticalPathToggle = document.getElementById('focus-critical-path');
    if (focusCriticalPathToggle) focusCriticalPathToggle.checked = editorUiState.focusCriticalPath;
    const fullDownstreamToggle = document.getElementById('highlight-full-downstream');
    if (fullDownstreamToggle) fullDownstreamToggle.checked = highlightFullDownstream;

    // Sync split-view toggle buttons
    const secEdgesBtn = document.getElementById('toggle-secondary-edges-btn');
    if (secEdgesBtn) secEdgesBtn.dataset.active = showSecondaryEdges ? 'true' : 'false';
    const critPathBtn = document.getElementById('focus-critical-path-btn');
    if (critPathBtn) critPathBtn.dataset.active = editorUiState.focusCriticalPath ? 'true' : 'false';
    const dsBtn = document.getElementById('highlight-full-downstream-btn');
    if (dsBtn) dsBtn.dataset.active = highlightFullDownstream ? 'true' : 'false';

    refreshDownstreamHighlight();
    if (persist) saveStoryEditorUiState();
    drawConnections();
}

function cycleCanvasViewMode() {
    const current = getActiveViewMode();
    const currentIndex = VIEW_MODE_ORDER.indexOf(current);
    const nextMode = VIEW_MODE_ORDER[(currentIndex + 1) % VIEW_MODE_ORDER.length];
    applyCanvasViewMode(nextMode);
}


function toggleNodeCollapsed(id) {
    if (!id || !window.storyData.passages[id]) return;
    editorUiState.collapsedById[id] = !editorUiState.collapsedById[id];
    if (!editorUiState.collapsedById[id]) {
        delete editorUiState.collapsedById[id];
    }
    saveStoryEditorUiState();
    drawConnections();
}

function expandNodesInViewport() {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    const viewportLeft = -pan.x / scale;
    const viewportTop = -pan.y / scale;
    const viewportRight = viewportLeft + wrapper.clientWidth / scale;
    const viewportBottom = viewportTop + wrapper.clientHeight / scale;

    let changed = false;
    document.querySelectorAll('.node').forEach(node => {
        const id = node.dataset.id;
        const x = parseFloat(node.style.left);
        const y = parseFloat(node.style.top);
        const within = x < viewportRight && (x + node.offsetWidth) > viewportLeft && y < viewportBottom && (y + node.offsetHeight) > viewportTop;
        if (within && editorUiState.collapsedById[id]) {
            delete editorUiState.collapsedById[id];
            changed = true;
        }
    });

    if (changed) {
        saveStoryEditorUiState();
        drawConnections();
    }
}

// ============================================================
// LAYOUT — view mode, collapse, auto-layout, zoom, fit/jump
// ============================================================
function applyAutoLayout() {
    const autoPositions = runLayeredAutoLayout(window.storyData.passages || {});
    Object.entries(autoPositions).forEach(([id, pos]) => {
        const node = document.querySelector(`.node[data-id="${id}"]`);
        if (!node) return;

        const layout = getStoryLayout();
        const passage = window.storyData.passages[id];
        const locked = isNodeManuallyPositioned(passage, layout[id]);
        if (locked) return;

        node.style.left = `${pos.x}px`;
        node.style.top = `${pos.y}px`;
        if (!window.storyData.passages[id].position) window.storyData.passages[id].position = {};
        window.storyData.passages[id].position.x = pos.x;
        window.storyData.passages[id].position.y = pos.y;
        window.storyData.passages[id].position.manualOverride = false;
    });

    drawConnections();
    expandCanvasIfNeeded();
    saveState();
}

function jumpToPassage(id) {
    const node = document.querySelector(`.node[data-id="${id}"]`);
    if (!node) return;

    selectNodeByElement(node);

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

// ============================================================
// SIDEBAR PANELS — passage list, variable panel
// ============================================================
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
            label.title = `${cat}.${key}`;
            label.dataset.variablePath = `${cat}.${key}`;
            label.tabIndex = 0;
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
            removeBtn.textContent = '−';
            removeBtn.title = `Remove ${cat}.${key}`;
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

// ============================================================
// EXPORT/IMPORT — exportYAML(), generateBranchingScript()
// ============================================================
function exportStoryDataFromGraph() {
    if (!window.storyData || !inspectorEls) return;

    const activeId = inspectorEls.id?.dataset.originalId;
    if (activeId && window.storyData.passages?.[activeId]) {
        const pendingId = (inspectorEls.id?.value || '').trim();
        if (pendingId && pendingId !== activeId && !window.storyData.passages[pendingId]) {
            window.storyData.passages[pendingId] = JSON.parse(JSON.stringify(window.storyData.passages[activeId]));
            delete window.storyData.passages[activeId];
            Object.values(window.storyData.passages).forEach(p => {
                (p.choices || []).forEach(choice => {
                    if (choice.target === activeId) choice.target = pendingId;
                });
            });
            inspectorEls.id.dataset.originalId = pendingId;
        }

        const resolvedId = inspectorEls.id?.dataset.originalId;
        if (resolvedId && window.storyData.passages?.[resolvedId] && inspectorEls.text) {
            window.storyData.passages[resolvedId].text = inspectorEls.text.value + '\n';
            if (inspectorEls.type) {
                const isCustom = inspectorEls.type.value === '__custom__';
                const typeToken = isCustom ? (inspectorEls.typeCustom?.value || '') : (inspectorEls.type.value === '__auto__' ? '' : inspectorEls.type.value);
                setStoredNodeVariant(window.storyData.passages[resolvedId], typeToken);
            }
        }
    }
}

function sanitizeExportFileName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'story';
}

function getExportFileName() {
    const storyTitle = window.storyData?.title;
    const activeStoryId = window.activeStoryId || window.storyData?.metadata?.storyIdentity;
    const sanitizedName = sanitizeExportFileName(storyTitle || activeStoryId);
    return `${sanitizedName}.yaml`;
}

function exportYAML() {
    try {
        console.log('Starting exportYAML');
        exportStoryDataFromGraph();
        const yamlText = jsyaml.dump(window.storyData);
        console.log('YAML generated:', yamlText.substring(0, 100)); // preview
        downloadFile(getExportFileName(), 'text/yaml', yamlText);
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

// ============================================================
// MODAL — showModal() dialog system
// ============================================================
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


function collectDownstreamHighlight(rootId) {
    const passages = window.storyData.passages || {};
    const nodes = new Set();
    const edges = new Set();
    if (!rootId || !passages[rootId]) return { nodes, edges };

    if (!highlightFullDownstream) {
        nodes.add(rootId);
        (passages[rootId].choices || []).forEach(choice => {
            if (!passages[choice.target]) return;
            nodes.add(choice.target);
            edges.add(`${rootId}->${choice.target}`);
        });
        return { nodes, edges };
    }

    const queue = [rootId];
    const visited = new Set([rootId]);
    while (queue.length) {
        const current = queue.shift();
        nodes.add(current);
        (passages[current]?.choices || []).forEach(choice => {
            if (!passages[choice.target]) return;
            edges.add(`${current}->${choice.target}`);
            if (!visited.has(choice.target)) {
                visited.add(choice.target);
                queue.push(choice.target);
            }
        });
    }

    return { nodes, edges };
}

function refreshDownstreamHighlight() {
    const selectedId = selectedNode?.dataset?.id;
    const activeId = hoveredNodeId || selectedId || null;
    downstreamHighlight = collectDownstreamHighlight(activeId);
}

function focusNode(nodeId) {
    if (!nodeId) return;
    const node = document.querySelector(`.node[data-id="${nodeId}"]`);
    if (!node) return;
    selectNodeByElement(node);
    jumpToPassage(nodeId);
}

function ensureFallbackEndingPassage() {
    if (window.storyData.passages.fallback_ending) return 'fallback_ending';
    let id = 'fallback_ending';
    let suffix = 2;
    while (window.storyData.passages[id]) {
        id = `fallback_ending_${suffix}`;
        suffix += 1;
    }
    window.storyData.passages[id] = {
        text: 'Fallback ending: this branch was auto-connected by the diagnostics autofix.\n',
        choices: []
    };
    createNode(id, window.storyData.passages[id].text.trim(), Object.keys(window.storyData.passages).length);
    renderPassageList();
    return id;
}

function normalizeChoiceExpression(expression) {
    return String(expression ?? '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([()])\s*/g, '$1')
        .replace(/\s*(\|\||&&|==|!=|<=|>=|<|>)\s*/g, ' $1 ')
        .replace(/\s*(\+=|-=|=)\s*/g, ' $1 ')
        .trim();
}

function applyAutofixBatch(issues) {
    let appliedCount = 0;
    (issues || []).forEach(issue => {
        if (applyAutofix(issue, { skipValidation: true })) appliedCount += 1;
    });

    if (appliedCount > 0) {
        saveState();
        validateStory({ showModalReport: false });
        drawConnections();
    }

    return appliedCount;
}

function applyAutofix(issue, options = {}) {
    if (!issue?.autofix) return;
    let changed = false;
    const passages = window.storyData.passages;
    let fallbackId = null;
    const getFallbackId = () => {
        if (!fallbackId) fallbackId = ensureFallbackEndingPassage();
        return fallbackId;
    };

    if (issue.autofix.type === 'add-missing-start') {
        if (!passages.start) {
            const firstPassageId = Object.keys(passages).find(id => id !== 'start' && !String(id).startsWith('fallback_ending') && passages[id]);
            passages.start = {
                text: 'Auto-created start passage by diagnostics autofix.\n',
                choices: firstPassageId ? [{ text: 'Begin', target: firstPassageId }] : [{ text: 'Continue', target: getFallbackId() }]
            };
            createNode('start', passages.start.text.trim(), 0);
            renderPassageList();
            changed = true;
        }
    }

    if (issue.autofix.type === 'connect-no-exit') {
        const nodeId = issue.autofix.nodeId;
        const passage = passages[nodeId];
        if (!passage) return false;
        if (!Array.isArray(passage.choices)) passage.choices = [];
        const targetId = getFallbackId();
        const exists = passage.choices.some(choice => choice.target === targetId);
        if (!exists) {
            passage.choices.push({ text: 'Continue to fallback ending', target: targetId });
            changed = true;
        }
    }

    if (issue.autofix.type === 'repair-dangling-edge') {
        const source = passages[issue.from];
        if (!source || !source.choices || issue.index == null) return false;
        const choice = source.choices[issue.index];
        const targetId = getFallbackId();
        if (choice && choice.target !== targetId) {
            choice.target = targetId;
            changed = true;
        }
    }

    if (issue.autofix.type === 'connect-unreachable-node') {
        const nodeId = issue.autofix.nodeId;
        const start = passages.start;
        if (start && passages[nodeId] && nodeId !== 'start') {
            if (!Array.isArray(start.choices)) start.choices = [];
            const exists = start.choices.some(choice => choice.target === nodeId);
            if (!exists) {
                start.choices.push({ text: `Reach ${nodeId}`, target: nodeId });
                changed = true;
            }
        }
    }

    if (issue.autofix.type === 'normalize-choice-text') {
        const source = passages[issue.from];
        const choice = source?.choices?.[issue.index];
        if (choice && (typeof choice.text !== 'string' || choice.text.trim() === '')) {
            choice.text = 'Continue';
            changed = true;
        }
    }

    if (issue.autofix.type === 'normalize-choice-target') {
        const source = passages[issue.from];
        const choice = source?.choices?.[issue.index];
        if (!choice) return false;
        const normalizedTarget = typeof choice.target === 'string' ? choice.target.trim() : '';
        if (!normalizedTarget) {
            choice.target = getFallbackId();
            changed = true;
        } else if (choice.target !== normalizedTarget) {
            choice.target = normalizedTarget;
            changed = true;
        }
    }

    if (issue.autofix.type === 'normalize-choice-condition') {
        const source = passages[issue.from];
        const choice = source?.choices?.[issue.index];
        if (choice && choice.condition != null) {
            const normalized = normalizeChoiceExpression(choice.condition);
            if (normalized && normalized !== choice.condition) {
                choice.condition = normalized;
                changed = true;
            }
        }
    }

    if (issue.autofix.type === 'normalize-choice-effect') {
        const source = passages[issue.from];
        const choice = source?.choices?.[issue.index];
        if (choice && choice.effect != null) {
            const normalized = normalizeChoiceExpression(choice.effect);
            if (normalized && normalized !== choice.effect) {
                choice.effect = normalized;
                changed = true;
            }
        }
    }

    if (!changed) return false;

    if (options.skipValidation) return true;

    saveState();
    validateStory({ showModalReport: false });
    drawConnections();
    return true;
}

function renderDiagnosticsPanel() {
    const panel = document.getElementById('diagnostics-panel');
    const summary = document.getElementById('diagnostics-summary');
    if (!panel || !summary) return;

    const issues = diagnosticsState.issues || [];
    const errorCount = issues.filter(issue => issue.severity === 'error').length;
    const warningCount = issues.filter(issue => issue.severity === 'warning').length;
    const infoCount = issues.filter(issue => issue.severity === 'info').length;

    if (issues.length === 0) {
        summary.innerHTML = '<span style="color:#10b981;font-weight:600;">✓ No issues found</span>';
        panel.innerHTML = '<div class="diagnostics-empty">Story looks good! Run Validate anytime after editing.</div>';
        return;
    }

    const summaryParts = [];
    if (errorCount) summaryParts.push(`<span class="diag-count diag-count-error">✖ ${errorCount} error${errorCount !== 1 ? 's' : ''}</span>`);
    if (warningCount) summaryParts.push(`<span class="diag-count diag-count-warning">⚠ ${warningCount} warning${warningCount !== 1 ? 's' : ''}</span>`);
    if (infoCount) summaryParts.push(`<span class="diag-count diag-count-info">ℹ ${infoCount} hint${infoCount !== 1 ? 's' : ''}</span>`);
    summary.innerHTML = summaryParts.join(' &nbsp;');

    panel.innerHTML = '';

    const safeWarnings = issues.filter(issue => issue.severity === 'warning' && issue.autofix?.safe === true);
    if (safeWarnings.length > 0) {
        const safeRow = document.createElement('div');
        safeRow.className = 'diagnostic-row';
        const safeActions = document.createElement('div');
        safeActions.className = 'diagnostic-actions';

        const autofixAllBtn = document.createElement('button');
        autofixAllBtn.type = 'button';
        autofixAllBtn.className = 'autofix-btn';
        autofixAllBtn.textContent = `Autofix all safe warnings (${safeWarnings.length})`;
        autofixAllBtn.onclick = () => {
            applyAutofixBatch(safeWarnings);
        };

        safeActions.appendChild(autofixAllBtn);
        safeRow.appendChild(safeActions);
        panel.appendChild(safeRow);
    }

    const SEVERITY_ICONS = { error: '✖', warning: '⚠', info: 'ℹ' };

    issues.forEach((issue, idx) => {
        const row = document.createElement('div');
        row.className = `diagnostic-row severity-${issue.severity}`;

        const label = document.createElement('div');
        label.className = 'diagnostic-message';
        const icon = SEVERITY_ICONS[issue.severity] || '•';
        label.innerHTML = `<span class="diag-icon diag-icon-${issue.severity}">${icon}</span> ${escapeHtml(issue.message)}`;
        row.appendChild(label);

        const actions = document.createElement('div');
        actions.className = 'diagnostic-actions';

        if (issue.nodeId || issue.from) {
            const jumpBtn = document.createElement('button');
            jumpBtn.type = 'button';
            jumpBtn.textContent = 'Jump';
            jumpBtn.onclick = () => {
                if (issue.from && issue.target != null && issue.index != null) {
                    jumpToConnection(issue.from, issue.target, issue.index);
                    return;
                }
                focusNode(issue.nodeId || issue.from);
            };
            actions.appendChild(jumpBtn);
        }

        if (issue.autofix) {
            const fixBtn = document.createElement('button');
            fixBtn.type = 'button';
            fixBtn.textContent = issue.autofix.label || 'Autofix';
            fixBtn.className = 'autofix-btn';
            fixBtn.onclick = () => applyAutofix(issue);
            actions.appendChild(fixBtn);
        }

        if (actions.children.length > 0) row.appendChild(actions);
        panel.appendChild(row);
    });
}

function runGraphAnalyzers(passages) {
    const ids = Object.keys(passages);
    const reachable = new Set(['start']);
    const queue = passages.start ? ['start'] : [];
    while (queue.length) {
        const current = queue.shift();
        (passages[current]?.choices || []).forEach(choice => {
            if (passages[choice.target] && !reachable.has(choice.target)) {
                reachable.add(choice.target);
                queue.push(choice.target);
            }
        });
    }

    const unreachableNodes = new Set(ids.filter(id => id !== 'start' && !reachable.has(id)));
    const noExitNodes = new Set(ids.filter(id => (passages[id]?.choices || []).length === 0 && id !== 'start'));
    const danglingRefs = [];
    const danglingNodes = new Set();

    ids.forEach(id => {
        (passages[id]?.choices || []).forEach((choice, index) => {
            if (!passages[choice.target]) {
                danglingRefs.push({ from: id, target: choice.target, index });
                danglingNodes.add(id);
            }
        });
    });

    const cycles = findCycles(passages);
    const cycleNodes = new Set();
    const cycleEdges = new Set();
    cycles.forEach(cycle => {
        cycle.forEach((nodeId, idx) => {
            cycleNodes.add(nodeId);
            const to = cycle[(idx + 1) % cycle.length];
            cycleEdges.add(`${nodeId}->${to}`);
        });
    });

    return { unreachableNodes, noExitNodes, danglingRefs, danglingNodes, cycles, cycleNodes, cycleEdges };
}

// ============================================================
// DIAGNOSTICS — analyzers, autofix, validation panel
// ============================================================
function validateStory(options = {}) {
    const showModalReport = options.showModalReport !== false;
    const issues = [];
    const passages = window.storyData.passages;
    const ids = Object.keys(passages);
    const storyParsers = window.storyParsers || {};

    function addIssue(severity, message, context = {}) {
        issues.push({ severity, message, ...context });
    }

    if (!passages.start) {
        addIssue('error', "Missing 'start' passage", {
            autofix: { type: 'add-missing-start', label: 'Autofix: add start passage' }
        });
    }

    for (const id of ids) {
        const p = passages[id];
        if (!p.choices) continue;
        p.choices.forEach((ch, idx) => {
            const edgeContext = { from: id, target: ch.target, index: idx };
            if (typeof ch.text !== 'string' || ch.text.trim() === '') {
                addIssue('error', `Missing choice text: "${id}" choice #${idx + 1}`, {
                    ...edgeContext,
                    autofix: { type: 'normalize-choice-text', label: 'Autofix: set default choice text' }
                });
            }
            if (typeof ch.target !== 'string' || ch.target.trim() === '') {
                addIssue('error', `Missing choice target: "${id}" choice #${idx + 1}`, {
                    ...edgeContext,
                    autofix: { type: 'normalize-choice-target', label: 'Autofix: retarget to fallback ending' }
                });
            }

            if (ch.condition) {
                if (typeof storyParsers.parseCondition === 'function') {
                    try { storyParsers.parseCondition(ch.condition); } catch (err) {
                        addIssue('warning', `Condition needs normalization in "${id}" choice #${idx + 1}: ${err.message}`, {
                            ...edgeContext,
                            autofix: { type: 'normalize-choice-condition', label: 'Autofix: normalize condition', safe: true }
                        });
                    }
                } else {
                    addIssue('warning', `Cannot parse-check condition in "${id}" choice #${idx + 1}: runtime parser unavailable.`, edgeContext);
                }
            }

            if (ch.effect) {
                if (typeof storyParsers.parseEffect === 'function') {
                    try { storyParsers.parseEffect(ch.effect); } catch (err) {
                        addIssue('warning', `Effect needs normalization in "${id}" choice #${idx + 1}: ${err.message}`, {
                            ...edgeContext,
                            autofix: { type: 'normalize-choice-effect', label: 'Autofix: normalize effect', safe: true }
                        });
                    }
                } else {
                    addIssue('warning', `Cannot parse-check effect in "${id}" choice #${idx + 1}: runtime parser unavailable.`, edgeContext);
                }
            }
        });
    }

    // ── Extended checks ──────────────────────────────────────
    // Missing story title
    if (!window.storyData.title || String(window.storyData.title).trim() === '') {
        addIssue('warning', 'Story is missing a title (top-level "title:" field)');
    }

    for (const id of ids) {
        const p = passages[id];
        const text = (p.text || '').trim();

        // Empty passage text
        if (text === '') {
            addIssue('warning', `Empty text in passage "${id}"`, { nodeId: id });
        }

        // Very long passage text (> 800 chars — may affect readability)
        if (text.length > 800) {
            addIssue('info', `Long passage text in "${id}": ${text.length} chars (consider splitting)`, { nodeId: id });
        }

        const choices = p.choices || [];

        // Self-referencing choice
        choices.forEach((ch, idx) => {
            if (ch.target === id) {
                addIssue('warning', `Self-loop in "${id}" choice #${idx + 1}: choice targets its own passage`, { from: id, target: ch.target, index: idx });
            }
        });

        // Duplicate choice text within the same passage
        const seenTexts = new Map();
        choices.forEach((ch, idx) => {
            const t = (ch.text || '').trim().toLowerCase();
            if (!t) return;
            if (seenTexts.has(t)) {
                addIssue('warning', `Duplicate choice text in "${id}" choices #${seenTexts.get(t) + 1} and #${idx + 1}: "${ch.text}"`, { from: id, target: ch.target, index: idx });
            } else {
                seenTexts.set(t, idx);
            }
        });
    }

    // Variable reference validation: conditions that reference undeclared variable groups
    const declaredPaths = new Set();
    const vars = window.storyData.variables || {};
    ['inventory', 'relationships', 'flags'].forEach(group => {
        if (vars[group]) Object.keys(vars[group]).forEach(k => declaredPaths.add(`${group}.${k}`));
    });
    if (declaredPaths.size > 0) {
        for (const id of ids) {
            const p = passages[id];
            (p.choices || []).forEach((ch, idx) => {
                if (!ch.condition || typeof storyParsers.parseCondition !== 'function') return;
                // Extract dotted identifiers from condition string
                const refs = (ch.condition.match(/[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*/gi) || []);
                refs.forEach(ref => {
                    if (!declaredPaths.has(ref)) {
                        addIssue('warning', `Undeclared variable "${ref}" in "${id}" choice #${idx + 1} condition`, { from: id, target: ch.target, index: idx });
                    }
                });
            });
        }
    }

    const analyzer = runGraphAnalyzers(passages);
    analyzer.unreachableNodes.forEach(nodeId => {
        addIssue('warning', `Unreachable node: "${nodeId}"`, {
            nodeId,
            autofix: { type: 'connect-unreachable-node', nodeId, label: 'Autofix: connect from start', safe: true }
        });
    });
    analyzer.noExitNodes.forEach(nodeId => {
        addIssue('warning', `No-exit node: "${nodeId}"`, {
            nodeId,
            autofix: { type: 'connect-no-exit', nodeId, label: 'Autofix: connect to fallback ending', safe: true }
        });
    });
    analyzer.danglingRefs.forEach(ref => {
        addIssue('error', `Dangling reference: "${ref.from}" → "${ref.target}"`, {
            from: ref.from,
            target: ref.target,
            index: ref.index,
            autofix: { type: 'repair-dangling-edge', label: 'Autofix: retarget to fallback ending' }
        });
    });
    analyzer.cycles.forEach((cycle, idx) => {
        addIssue('info', `Cycle warning ${idx + 1}: ${cycle.join(' → ')} → ${cycle[0]}`, { nodeId: cycle[0] });
    });

    highlightedCycleNodes = analyzer.cycleNodes;
    highlightedCycleEdges = analyzer.cycleEdges;
    highlightedUnreachableNodes = analyzer.unreachableNodes;
    highlightedErrorNodes = new Set();
    highlightedErrorEdges = new Set();
    highlightedWarningNodes = new Set();
    highlightedWarningEdges = new Set();
    highlightedInfoNodes = new Set();
    highlightedInfoEdges = new Set();

    issues.forEach(issue => {
        const edgeId = (issue.from && issue.index != null) ? `${issue.from}->${issue.target}#${issue.index}` : null;
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

    diagnosticsState = {
        issues,
        analyzers: analyzer,
        byNode: issues.reduce((acc, issue) => {
            const key = issue.nodeId || issue.from;
            if (key) {
                if (!acc[key]) acc[key] = [];
                acc[key].push(issue);
            }
            return acc;
        }, {})
    };

    refreshDownstreamHighlight();
    drawConnections();
    renderDiagnosticsPanel();

    if (!showModalReport) return;

    const report = document.createElement('div');
    const heading = document.createElement('strong');
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

    heading.style.color = '#ef4444';
    heading.textContent = `⚠ Validation issues found (${issues.length})`;
    summary.textContent = 'See diagnostics panel for jump-to-node and autofix actions.';
    report.appendChild(heading);
    report.appendChild(summary);
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

// ============================================================
// UNDO/REDO — undo(), redo(), applyStateIncremental()
// ============================================================
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

        if (p.position) {
            node.style.left = `${p.position.x}px`;
            node.style.top = `${p.position.y}px`;
        }
        refreshNodeCard(id);
    });

    window.storyData.passages = targetPassages;
    window.storyData.variables = JSON.parse(JSON.stringify(normalizeVariables(state.variables)));
    variables = JSON.parse(JSON.stringify(window.storyData.variables));
    renderVariables();
    renderPassageList();

    if (selectedNode && !window.storyData.passages[selectedNode.dataset.id]) {
        selectedNode = null;
    }
    updateNodeInspector(selectedNode ? selectedNode.dataset.id : null);

    drawConnections();
    expandCanvasIfNeeded();

    if (typeof window.onStoryChange === 'function') {
        window.onStoryChange(window.storyData);
    }
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
                let importedStoryEntry = null;
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

                if (typeof window.registerImportedStoryEntry === 'function') {
                    importedStoryEntry = await window.registerImportedStoryEntry({
                        id: file.name,
                        label: file.name,
                        raw,
                        source: file.name
                    });
                }

                if (importedStoryEntry?.id && typeof window.loadStoryByPath === 'function') {
                    await window.loadStoryByPath(importedStoryEntry.id, importedStoryEntry.label || file.name);
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
    const activeTag = document.activeElement?.tagName;
    const isTypingContext = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable;

    if (!isTypingContext && e.altKey && (e.key === 'c' || e.key === 'C') && selectedNode) {
        e.preventDefault();
        toggleNodeCollapsed(selectedNode.dataset.id);
    }

    if (!isTypingContext && e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        expandNodesInViewport();
    }

    if (!isTypingContext && e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        cycleCanvasViewMode();
    }

    // Delete selected node
    if (!isTypingContext && (e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
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
            delete editorUiState.collapsedById[id];
            saveStoryEditorUiState();
            // Remove incoming connections
            Object.keys(window.storyData.passages).forEach(pid => {
                if (window.storyData.passages[pid].choices) {
                    window.storyData.passages[pid].choices = window.storyData.passages[pid].choices.filter(ch => ch.target !== id);
                }
            });
            selectedNode.remove();
            selectedNode = null;
            updateNodeInspector(null);
            renderPassageList();
            drawConnections();
            saveState();
        }
    }

    // Esc deselect
    if (e.key === 'Escape' && selectedNode) {
        selectNodeByElement(null);
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

// toggleBtn.onclick is intentionally NOT set here.
// StoryEditor.tsx manages #toggle-sidebar via a React onClick handler that calls
// setIsSidebarCollapsed() directly. Setting onclick here would double-fire the
// toggle on first mount (React onClick + legacy onclick = two updater calls = no change).

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

window.initEditor = initEditor;
window.destroyEditor = destroyEditor;
export { initEditor, destroyEditor };
