import { state } from './state.js';

export function updateIcon() {
    const variant = state.devtoolsShown ? 'devtools' : 'log';
    if (state.isCollectingLogs) {
        const icon = state.recordingIconFlag ? `${variant}_record` : variant;
        state.recordingIconFlag = !state.recordingIconFlag;
        setIcon(icon);
    } else {
        setIcon(`${variant}_stopped`);
    }
}

export function checkAndReflectOpenedDevtools(tabId) {
    state.devtoolsShown = state.devtoolsOpenTabs.has(tabId);
}

export function startBlink() {
    state.isCollectingLogs = true;
    checkAndReflectOpenedDevtools(state.activeTabId);
    updateIcon();
    if (!state.blinkInterval) {
        state.blinkInterval = setInterval(() => {
            checkAndReflectOpenedDevtools(state.activeTabId);
            state.isCollectingLogs = state.activeTabId ? !!state.collectingTabs[state.activeTabId] : false;
            updateIcon();
        }, 500);
    }
}

export function stopBlink() {
    if (state.blinkInterval) {
        clearInterval(state.blinkInterval);
        state.blinkInterval = null;
    }
    state.isCollectingLogs = state.activeTabId ? !!state.collectingTabs[state.activeTabId] : false;
    checkAndReflectOpenedDevtools(state.activeTabId);
    updateIcon();
}

export function initAlarm() {
    chrome.alarms.create('iconUpdate', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== 'iconUpdate') return;
        checkAndReflectOpenedDevtools(state.activeTabId);
        state.isCollectingLogs = state.activeTabId ? !!state.collectingTabs[state.activeTabId] : false;
        updateIcon();
    });
}

function setIcon(variant) {
    chrome.action.setIcon({
        path: {
            '16':  `images/${variant}/icon16.png`,
            '32':  `images/${variant}/icon32.png`,
            '48':  `images/${variant}/icon48.png`,
            '128': `images/${variant}/icon128.png`,
        },
    });
}
