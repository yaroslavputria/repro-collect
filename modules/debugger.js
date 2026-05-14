export function sendCommand(tabId, command, params, cb, onError) {
    chrome.debugger.sendCommand({ tabId }, command, params, (res) => {
        if (chrome.runtime.lastError) {
            if (onError) onError(chrome.runtime.lastError);
            else console.error(`[sendCommand] ${command} failed:`, chrome.runtime.lastError.message);
            return;
        }
        cb(res);
    });
}
