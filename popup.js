let tabId = null;

function getDevtoolsHar() {
    chrome.runtime.sendMessage({ action: 'request_har', tabId });
}

// No return true — sendResponse is never called in this listener
chrome.runtime.onMessage.addListener(function(request) {
    if (request?.action === 'return_har' && request.tabId === tabId) {
        downloadLogs({ log: request.har }, "devtools_network_logs", "application/json", 'har');
    }
});

function notifyCollectingStatus(status) {
    chrome.runtime.sendMessage({ action: "collecting", tabId, status });
}

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const saveBtn = document.getElementById("save");
const viewBtn = document.getElementById("view");
const checkbox = document.getElementById("chbx-profiling");
const checkboxR = document.getElementById("chbx-recording");
const checkboxRLabel = document.getElementById("record-chbx-label");

document.addEventListener("DOMContentLoaded", function() {
    startBtn.addEventListener("click", startCollectingLogs);
    stopBtn.addEventListener("click", stopCollectingLogs);
    saveBtn.addEventListener("click", saveLogs);
    viewBtn.addEventListener("click", openViewer);
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            tabId = tabs[0].id;
            chrome.runtime.sendMessage({ action: "are_logs_being_collected", tabId: tabId }, function(response) {
                if (response && response.status) {
                    if (response.status === 'in_progress') {
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                        saveBtn.disabled = true;
                        notifyCollectingStatus(true);
                    } else if (response.status === 'stopped') {
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                        saveBtn.disabled = false;
                        notifyCollectingStatus(false);
                    }
                    if (response.profile) {
                        checkbox.checked = true;
                    }
                    if (response.recordedScreenTabId) {
                        if (response.recordedScreenTabId === tabId) {
                            checkboxR.checked = true;
                        } else {
                            checkboxR.disabled = true;
                            checkboxRLabel.classList.add('disabled');
                        }
                    }

                }
            });
        }
    });
});

function startCollectingLogs() {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    saveBtn.disabled = true;
    notifyCollectingStatus(true);
    chrome.runtime.sendMessage({ action: "start_collecting_logs", tabId: tabId, profile: checkbox.checked, video: checkboxR.checked });
}

function stopCollectingLogs() {
    notifyCollectingStatus(false);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    saveBtn.disabled = false;
    viewBtn.disabled = false;
    chrome.runtime.sendMessage({ action: "stop_collecting_logs", tabId: tabId });
}

function openViewer() {
    chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?tabId=${tabId}`) });
}

function safeTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

function downloadLogs(data, filename, type, extension, date = new Date()) {
    const logsJson = JSON.stringify(data, null, 2);
    const blob = new Blob([logsJson], { type });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url,
        filename: `${filename}_${safeTimestamp(date)}.${extension}`,
        saveAs: false
    }, () => URL.revokeObjectURL(url));
}

function saveLogs() {
    chrome.runtime.sendMessage({ action: "save_logs_to_file", tabId: tabId }, function(response) {
        if (response && response.logs) {
            getDevtoolsHar();
            const date = new Date();
            downloadLogs(response.logs, "console_logs", "application/json", 'json', date);
            downloadLogs(response.networkLogs, "network_logs", "application/json", 'json', date);
            downloadLogs(response.harLog, "network", "application/json", 'har', date);
            if (response.profile) {
                downloadLogs(response.profile, "code_profile", "application/json", 'json', date);
            }
            if (response.rawProfile) {
                downloadLogs(response.rawProfile, "profile", "application/json", 'cpuprofile', date);
            }
            if (response.recording) {
                chrome.downloads.download({
                    url: response.recording,
                    filename: `screen_recording_${safeTimestamp(date)}.webm`,
                    saveAs: false
                }, () => URL.revokeObjectURL(response.recording));
            }
        }
    });
}
