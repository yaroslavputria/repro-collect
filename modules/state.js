// Single shared-state object imported by all modules.
// Passed by reference — mutations in any module are visible everywhere.
export const state = {
    tabLogs: {},
    collectingTabs: {},
    tabsListeners: {},
    recordedScreenTabId: null,
    activeTabId: null,
    devtoolsShown: false,
    isCollectingLogs: false,
    devtoolsOpenTabs: new Set(),
    blinkInterval: null,
    recordingIconFlag: false,
};
