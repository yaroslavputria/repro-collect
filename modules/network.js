import { state } from './state.js';
import { sendCommand } from './debugger.js';

export function handleRequestWillBeSent(params, tabId) {
    const { requestId, timestamp, request } = params;
    state.tabLogs[tabId].harLog.log.entries.push({
        startedDateTime: new Date(timestamp * 1000).toISOString(),
        time: 0,
        request: {
            method: request.method,
            cookies: [],
            httpVersion: 'HTTP/1.1',
            url: request.url,
            headers: Object.entries(request.headers ?? {}).map(([name, value]) => ({ name, value })),
            ...(request.postData ? { postData: request.postData } : {}),
            queryString: request.queryString ?? [],
            headersSize: -1,
            bodySize: -1,
        },
        // HAR 1.2 requires all numeric fields to be present; undefined casts to NaN
        // and causes DevTools to reject the file. Defaults are set here and overwritten
        // by handleResponseReceived / handleLoadingFailed when the response arrives.
        response: {
            status: 0,
            statusText: '',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            content: { size: -1, mimeType: '', text: '' },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1,
        },
        cache: {},
        timings: { send: -1, wait: -1, receive: -1 },
        serverIPAddress: '',
        connection: '',
        pageref: '',
        _requestId: requestId,
        _initiator: params.initiator ?? null,
    });
}

export function handleResponseReceived(params, tabId) {
    const { requestId, response } = params;
    const entry = state.tabLogs[tabId].harLog.log.entries.find(e => e._requestId === requestId);
    if (!entry) {
        console.error('Missing request entry for requestId:', requestId);
        return;
    }

    const receiveHeadersEnd = response.timing?.receiveHeadersEnd ?? 0;
    const sendEnd = response.timing?.sendEnd ?? 0;
    entry.time = receiveHeadersEnd;
    entry.timings = {
        send: sendEnd,
        wait: Math.max(0, receiveHeadersEnd - sendEnd),
        receive: 0, // body receive time is unknown at this point
    };
    entry.response = {
        status: response.status,
        statusText: response.statusText,
        httpVersion: 'HTTP/1.1',
        headers: Object.entries(response.headers ?? {}).map(([name, value]) => ({ name, value })),
        cookies: [],
        content: { size: -1, mimeType: response.mimeType, text: '' },
        redirectURL: '',
        headersSize: -1,
        bodySize: -1,
    };
    if (response.remoteIPAddress) entry.serverIPAddress = response.remoteIPAddress;

    getResponseBody(tabId, requestId).then(body => {
        entry.response.content.size = body.length;
        entry.response.bodySize = body.length;
        if (body && response.mimeType.includes('json')) {
            try {
                // Strip security prefixes such as )]}' prepended by some APIs
                body = JSON.parse(body.replace(/^[^\[{]*/, ''));
            } catch {
                // Leave body as raw string if it cannot be parsed
            }
        }
        entry.response.content.text = body;
    }).catch(err => console.error('Error retrieving response body:', err));
}

export function handleLoadingFailed(params, tabId) {
    const { requestId, errorText } = params;
    const entry = state.tabLogs[tabId].harLog.log.entries.find(e => e._requestId === requestId);
    if (!entry) return;
    entry.response.status = 0;
    entry.response.statusText = errorText;
    entry.response._error = errorText;
    entry.time = 0;
}

function getResponseBody(tabId, requestId) {
    return new Promise((resolve) => {
        sendCommand(
            tabId, 'Network.getResponseBody', { requestId },
            (res) => resolve(res?.body ?? ''),
            () => resolve(''), // body unavailable (redirect, pre-attach, cache, etc.)
        );
    });
}
