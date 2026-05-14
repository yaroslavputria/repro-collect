import { state } from './state.js';

export function startRecording(tabId) {
    if (state.recordedScreenTabId) return;
    chrome.runtime.getContexts({}).then(async existingContexts => {
        if (existingContexts.find((c) => c.contextType === 'OFFSCREEN_DOCUMENT')) {
            await chrome.offscreen.closeDocument();
        }
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['USER_MEDIA'],
            justification: 'Recording tab audio and video',
        });
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        chrome.runtime.sendMessage({ action: 'start-recording', target: 'offscreen', data: streamId });
        state.recordedScreenTabId = tabId;
    });
}

export function stopRecording(tabId) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'stop-recording', target: 'offscreen' }, (data) => {
            state.recordedScreenTabId = null;
            state.tabLogs[tabId].recording = data;
            resolve();
        });
    });
}
