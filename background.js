import { state } from './modules/state.js';
import { updateIcon, checkAndReflectOpenedDevtools, initAlarm } from './modules/icon.js';
import { startCollectingLogs, stopCollectingLogs } from './modules/collection.js';
import { getLogsToSave } from './modules/export.js';

// ── Tab activation ─────────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(({ tabId }) => {
    state.activeTabId = tabId;
    checkAndReflectOpenedDevtools(tabId);
    updateIcon();
});

// ── DevTools port tracking ─────────────────────────────────────────────────────
// devtools_script.js connects a named port when DevTools opens and auto-reconnects
// if the service worker restarts, so this Set stays accurate without polling.
chrome.runtime.onConnect.addListener((port) => {
    if (!port.name.startsWith('devtools_')) return;
    const tabId = parseInt(port.name.split('_')[1], 10);
    if (isNaN(tabId)) return;
    state.devtoolsOpenTabs.add(tabId);
    if (tabId === state.activeTabId) { state.devtoolsShown = true; updateIcon(); }
    port.onDisconnect.addListener(() => {
        state.devtoolsOpenTabs.delete(tabId);
        if (tabId === state.activeTabId) { state.devtoolsShown = false; updateIcon(); }
    });
});

// ── Message routing ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start_collecting_logs') {
        startCollectingLogs(request.tabId, request.profile, request.video);
    } else if (request.action === 'stop_collecting_logs') {
        stopCollectingLogs(request.tabId);
    } else if (request.action === 'save_logs_to_file') {
        sendResponse(getLogsToSave(request.tabId));
    } else if (request.action === 'are_logs_being_collected') {
        sendResponse({
            status: state.tabLogs[request.tabId]
                ? (state.tabsListeners[request.tabId] ? 'in_progress' : 'stopped')
                : 'never',
            profile: state.tabLogs[request.tabId]?.profileEnabled,
            recordedScreenTabId: state.recordedScreenTabId,
        });
    } else if (request.action === 'collecting') {
        state.collectingTabs[request.tabId] = request.status;
    } else if (request.action === 'get_logs_for_viewer') {
        sendResponse(state.tabLogs[request.tabId] || null);
    }
    // No return true — all sendResponse calls are synchronous; returning true
    // would keep the channel open for fire-and-forget messages and spam the console.
});

// ── Init ───────────────────────────────────────────────────────────────────────
initAlarm();
