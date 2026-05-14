import { state } from './state.js';
import { sendCommand } from './debugger.js';
import { handleRequestWillBeSent, handleResponseReceived, handleLoadingFailed } from './network.js';
import { processProfile } from './profiler.js';
import { startRecording, stopRecording } from './recorder.js';
import { startBlink, stopBlink } from './icon.js';
import { safeTimestamp, persistCollectionState } from './export.js';

export function startCollectingLogs(tabId, profile, video) {
    if (video) {
        try { startRecording(tabId); }
        catch (err) { console.error('startRecording error:', err); }
    }

    state.tabLogs[tabId] = {
        harLog: {
            log: {
                version: '1.2',
                creator: { name: 'Repro Collect', version: '0.1.0' },
                entries: [],
            },
        },
        logs: [],
        profilerEvents: [],
        profileEnabled: profile,
        sessionId: safeTimestamp(),
        logSeq: 0,
    };

    persistCollectionState(tabId, true);
    startBlink();

    chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
            console.error('[debugger.attach] failed:', chrome.runtime.lastError.message);
            return;
        }
        sendCommand(tabId, 'Network.enable', {}, () => {});
        sendCommand(tabId, 'Console.enable', {}, () => {});
        sendCommand(tabId, 'Runtime.enable', {}, () => {});
        sendCommand(tabId, 'Log.enable', {}, () => {});
        if (profile) {
            sendCommand(tabId, 'Profiler.enable', {}, () => {
                sendCommand(tabId, 'Profiler.start', {}, () => {});
            });
        }
    });

    state.tabsListeners[tabId] = (source, method, params) => {
        if (source.tabId !== tabId) return;
        const [methodArea] = method.split('.');
        const timestamp = new Date().toISOString();
        const seq = ++state.tabLogs[tabId].logSeq;
        const sessionId = state.tabLogs[tabId].sessionId;

        if (methodArea === 'Console' && params.message.level !== 'error') {
            state.tabLogs[tabId].logs.push({
                seq, sessionId, timestamp,
                level: params.message.level,
                source: 'Console.messageAdded',
                message: params.message.text,
                url: params.message.url,
                line: params.message.line,
                column: params.message.column,
                stackTrace: params.message.stackTrace ?? [],
                raw: params.message,
            });
        } else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
            const message = params.args.map(a => a.value ?? a.description ?? '').join(' ');
            const frame = params.stackTrace?.callFrames?.[0];
            state.tabLogs[tabId].logs.push({
                seq, sessionId, timestamp,
                level: 'error',
                source: 'Runtime.consoleAPICalled',
                message,
                url: frame?.url ?? '',
                line: frame?.lineNumber,
                column: frame?.columnNumber,
                stackTrace: params.stackTrace?.callFrames ?? [],
                raw: params,
            });
        } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
            state.tabLogs[tabId].logs.push({
                seq, sessionId, timestamp,
                level: params.entry.level,
                source: `Log.entryAdded (${params.entry.source})`,
                message: params.entry.text,
                url: params.entry.url ?? '',
                line: params.entry.lineNumber,
                column: undefined,
                stackTrace: [],
                raw: params.entry,
            });
        } else if (methodArea === 'Profiler') {
            state.tabLogs[tabId].profilerEvents.push({ type: method, data: params });
        } else {
            switch (method.split('.')[1]) {
                case 'requestWillBeSent': handleRequestWillBeSent(params, tabId); break;
                case 'responseReceived':  handleResponseReceived(params, tabId);  break;
                case 'loadingFailed':     handleLoadingFailed(params, tabId);     break;
            }
        }
    };

    chrome.debugger.onEvent.addListener(state.tabsListeners[tabId]);
}

export function stopCollectingLogs(tabId) {
    const promises = [];
    if (tabId === state.recordedScreenTabId) promises.push(stopRecording(tabId));
    if (state.tabLogs[tabId].profileEnabled) promises.push(processProfile(tabId));
    Promise.all(promises).then(() => {
        disableDevtoolsConnections(tabId);
        stopBlink();
        persistCollectionState(tabId, false);
    });
}

export function disableDevtoolsConnections(tabId) {
    chrome.debugger.detach({ tabId });
    chrome.debugger.onEvent.removeListener(state.tabsListeners[tabId]);
    delete state.tabsListeners[tabId];
}
