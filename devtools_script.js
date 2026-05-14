const tabId = chrome.devtools.inspectedWindow.tabId;

function connect() {
    // Stop if the extension context has been invalidated
    if (!chrome.runtime?.id) return;
    try {
        const port = chrome.runtime.connect({ name: `devtools_${tabId}` });
        port.onDisconnect.addListener(() => {
            if (port.error || chrome.runtime?.lastError) return; // invalidated — stop
            // Delay before reconnecting to avoid a tight loop if connection keeps failing
            setTimeout(connect, 250);
        });
    } catch {
        // Extension context invalidated — stop
    }
}
connect();

// No return true — sendResponse is never called here
chrome.runtime.onMessage.addListener(function(request) {
    if (request?.action === 'request_har' && request.tabId === tabId) {
        chrome.devtools.network.getHAR((har) => {
            try {
                chrome.runtime.sendMessage({ action: 'return_har', tabId, har });
            } catch {
                // Extension context invalidated
            }
        });
    }
});
