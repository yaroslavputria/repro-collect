const params = new URLSearchParams(location.search);
const tabId = parseInt(params.get('tabId'), 10);

let allLogs = [];
let allEntries = [];
let activeLevel = 'all';
let activeStatus = 'all';

// ── Boot ───────────────────────────────────────────────────────────────────────
// Try live session first (when opened from popup with a tabId).
// Fall back to drop zone so the viewer works as a standalone file viewer.
if (!isNaN(tabId)) {
    chrome.runtime.sendMessage({ action: 'get_logs_for_viewer', tabId }, (response) => {
        if (chrome.runtime.lastError || !response) {
            showDropZone();
            return;
        }
        applyData(response.logs ?? [], response.harLog?.log?.entries ?? [], response.sessionId);
    });
} else {
    showDropZone();
}

// ── Data application ───────────────────────────────────────────────────────────
function applyData(logs, entries, sessionId) {
    allLogs = logs;
    allEntries = entries;

    if (sessionId) {
        document.getElementById('session-info').textContent =
            `Session: ${sessionId}${!isNaN(tabId) ? '  ·  Tab: ' + tabId : ''}`;
    }
    document.getElementById('console-count').textContent = allLogs.length;
    document.getElementById('network-count').textContent = allEntries.length;

    hideDropZone();
    renderConsole();
    renderNetwork();
}

// ── Drop zone show/hide ────────────────────────────────────────────────────────
function showDropZone() {
    document.getElementById('drop-zone').classList.remove('hidden');
    document.getElementById('console-panel').classList.add('hidden');
    document.getElementById('network-panel').classList.add('hidden');
}

function hideDropZone() {
    document.getElementById('drop-zone').classList.add('hidden');
    // Activate the currently selected tab panel
    const activeTab = document.querySelector('.tab-btn.active');
    const panelId = `${activeTab?.dataset.tab ?? 'console'}-panel`;
    document.getElementById(panelId).classList.remove('hidden');
}

// ── File loading ───────────────────────────────────────────────────────────────
function loadFiles(files) {
    const pending = Array.from(files).filter(f => f.name.endsWith('.json') || f.name.endsWith('.har'));
    if (!pending.length) return;

    let newLogs = [...allLogs];
    let newEntries = [...allEntries];
    let sessionId = null;
    let remaining = pending.length;

    pending.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const { logs, entries, sid } = classifyFile(data, file.name);
                if (logs) newLogs = newLogs.concat(logs);
                if (entries) newEntries = newEntries.concat(entries);
                if (sid) sessionId = sid;
            } catch {
                // skip files that cannot be parsed
            }
            if (--remaining === 0) {
                // de-duplicate by seq (for console logs loaded multiple times)
                const seen = new Set();
                newLogs = newLogs.filter(l => {
                    const key = `${l.sessionId}:${l.seq}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                newLogs.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
                applyData(newLogs, newEntries, sessionId);
            }
        };
        reader.readAsText(file);
    });
}

// Detect what kind of data a parsed JSON file contains.
function classifyFile(data, filename) {
    // Console logs: array of structured log objects produced by this extension
    if (Array.isArray(data) && data.length > 0 && 'level' in data[0] && 'message' in data[0]) {
        return { logs: data, entries: null, sid: data[0]?.sessionId ?? null };
    }
    // HAR format: { log: { entries: [...] } }
    if (data?.log?.entries && Array.isArray(data.log.entries)) {
        return { logs: null, entries: data.log.entries, sid: null };
    }
    // network_logs_*.json: object whose values are HAR entry objects (keyed by summary string)
    if (typeof data === 'object' && !Array.isArray(data)) {
        const values = Object.values(data);
        if (values.length > 0 && values[0]?._requestId !== undefined) {
            return { logs: null, entries: values, sid: null };
        }
    }
    return { logs: null, entries: null, sid: null };
}

// ── File input / drag-and-drop ─────────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', (e) => {
    loadFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file
});

const dropZone = document.getElementById('drop-zone');

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
document.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) dropZone.classList.remove('drag-over');
});
document.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    loadFiles(e.dataTransfer.files);
});

// ── Tab switching ──────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        if (!document.getElementById('drop-zone').classList.contains('hidden')) return;
        document.getElementById(`${btn.dataset.tab}-panel`).classList.remove('hidden');
    });
});

// ── Level filters ──────────────────────────────────────────────────────────────
document.querySelectorAll('#level-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#level-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLevel = btn.dataset.level;
        renderConsole();
    });
});

// ── Status filters ─────────────────────────────────────────────────────────────
document.querySelectorAll('#status-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#status-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStatus = btn.dataset.status;
        renderNetwork();
    });
});

document.getElementById('console-search').addEventListener('input', renderConsole);
document.getElementById('network-search').addEventListener('input', renderNetwork);

// ── Console render ─────────────────────────────────────────────────────────────
function renderConsole() {
    const search = document.getElementById('console-search').value.toLowerCase();
    const tbody = document.getElementById('console-body');
    const empty = document.getElementById('console-empty');
    tbody.innerHTML = '';

    const filtered = allLogs.filter(log => {
        if (activeLevel !== 'all' && log.level !== activeLevel) return false;
        if (search) {
            const inMsg = log.message?.toLowerCase().includes(search);
            const inUrl = log.url?.toLowerCase().includes(search);
            if (!inMsg && !inUrl) return false;
        }
        return true;
    });

    empty.classList.toggle('hidden', filtered.length > 0);
    if (!filtered.length) return;

    const frag = document.createDocumentFragment();
    filtered.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = `lvl-${log.level}`;

        const time = log.timestamp
            ? new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })
            : '';
        const urlDisplay = formatUrl(log.url, log.line);
        const hasStack = log.stackTrace?.length > 0;
        if (hasStack) tr.dataset.expandable = '1';

        tr.innerHTML =
            `<td class="cell-mono">${esc(log.seq ?? '')}</td>` +
            `<td class="cell-mono">${esc(time)}</td>` +
            `<td><span class="lvl-tag ${esc(log.level ?? '')}">${esc(log.level?.toUpperCase() ?? '')}</span></td>` +
            `<td class="cell-message" title="${esc(log.message ?? '')}">${esc(log.message ?? '')}</td>` +
            `<td class="cell-url" title="${esc(log.url ?? '')}">${esc(urlDisplay)}</td>`;

        if (hasStack) tr.addEventListener('click', () => toggleStack(tr, log));
        frag.appendChild(tr);
    });
    tbody.appendChild(frag);
}

function toggleStack(tr, log) {
    const next = tr.nextElementSibling;
    if (next?.classList.contains('stack-row')) { next.remove(); return; }
    const frames = log.stackTrace
        .map(f => `  at ${f.functionName || '(anonymous)'} (${f.url}:${f.lineNumber}:${f.columnNumber})`)
        .join('\n');
    const stackRow = document.createElement('tr');
    stackRow.className = 'stack-row';
    stackRow.innerHTML = `<td colspan="5"><pre>${esc(frames)}</pre></td>`;
    tr.after(stackRow);
}

// ── Network render ─────────────────────────────────────────────────────────────
function renderNetwork() {
    const search = document.getElementById('network-search').value.toLowerCase();
    const tbody = document.getElementById('network-body');
    const empty = document.getElementById('network-empty');
    tbody.innerHTML = '';

    const filtered = allEntries.filter(entry => {
        const status = entry.response?.status ?? 0;
        if (activeStatus !== 'all') {
            if (activeStatus === '0'   && status !== 0)                   return false;
            if (activeStatus === '2xx' && (status < 200 || status >= 300)) return false;
            if (activeStatus === '3xx' && (status < 300 || status >= 400)) return false;
            if (activeStatus === '4xx' && (status < 400 || status >= 500)) return false;
            if (activeStatus === '5xx' && (status < 500 || status >= 600)) return false;
        }
        if (search && !entry.request?.url?.toLowerCase().includes(search)) return false;
        return true;
    });

    empty.classList.toggle('hidden', filtered.length > 0);
    if (!filtered.length) return;

    const frag = document.createDocumentFragment();
    filtered.forEach(entry => {
        const status = entry.response?.status ?? 0;
        const tagClass = status === 0 ? 'failed'
            : status < 300 ? 'ok'
            : status < 400 ? 'redirect'
            : 'err';
        const size = entry.response?.bodySize > 0 ? formatBytes(entry.response.bodySize) : '—';
        const urlFull = entry.request?.url ?? '';
        const urlShort = shortenUrl(urlFull);
        const timeMs = entry.time > 0 ? Math.round(entry.time) : '—';
        const initiator = entry._initiator ?? null;
        const initiatorFrames = initiator?.stack?.callFrames ?? [];

        const tr = document.createElement('tr');
        if (initiator) tr.dataset.expandable = '1';
        tr.innerHTML =
            `<td><span class="status-tag ${tagClass}">${status || 'ERR'}</span></td>` +
            `<td class="cell-method">${esc(entry.request?.method ?? '')}</td>` +
            `<td class="cell-url" title="${esc(urlFull)}">${esc(urlShort)}</td>` +
            `<td class="cell-mono">${timeMs}</td>` +
            `<td class="cell-mono">${size}</td>`;

        if (initiator) tr.addEventListener('click', () => toggleNetworkStack(tr, initiator, initiatorFrames));
        frag.appendChild(tr);
    });
    tbody.appendChild(frag);
}

function toggleNetworkStack(tr, initiator, frames) {
    const next = tr.nextElementSibling;
    if (next?.classList.contains('stack-row')) { next.remove(); return; }

    let text = `Initiator type: ${initiator.type}`;
    if (initiator.url) {
        text += `\n  ${initiator.url}`;
        if (initiator.lineNumber != null) text += `:${initiator.lineNumber}`;
    }
    if (frames.length > 0) {
        text += '\n' + frames
            .map(f => `  at ${f.functionName || '(anonymous)'} (${f.url}:${f.lineNumber}:${f.columnNumber})`)
            .join('\n');
    }
    const stackRow = document.createElement('tr');
    stackRow.className = 'stack-row';
    stackRow.innerHTML = `<td colspan="5"><pre>${esc(text)}</pre></td>`;
    tr.after(stackRow);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatUrl(url, line) {
    if (!url) return '';
    try {
        const u = new URL(url);
        const path = u.pathname + (u.search || '');
        return line != null ? `${path}:${line}` : path;
    } catch { return line != null ? `${url}:${line}` : url; }
}

function shortenUrl(url) {
    try { return new URL(url).pathname; }
    catch { return url; }
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}
