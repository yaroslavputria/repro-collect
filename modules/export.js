import { state } from './state.js';

export function safeTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function persistCollectionState(tabId, collecting) {
    chrome.storage.local.set({ [`collecting_${tabId}`]: collecting });
}

export function getLogsToSave(tabId) {
    const networkLogs = {};
    state.tabLogs[tabId].harLog.log.entries.forEach(entry => {
        try {
            const key = `${entry.startedDateTime} [${entry.response.status}] ${entry.request.method} ${entry.request.url}`;
            networkLogs[key] = entry;
        } catch {}
    });
    state.tabLogs[tabId].networkLogs = networkLogs;
    return state.tabLogs[tabId];
}
