chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'offscreen') {
        switch (message.action) {
            case 'start-recording':
                startRecording(message.data);
                break;
            case 'stop-recording':
                stopRecording().then(sendResponse);
                return true; // sendResponse is async — keep channel open
        }
    }
});

let recorder;
let data = [];

async function startRecording(streamId) {
    data = [];
    if (recorder?.state === 'recording') {
        throw new Error('Called startRecording while recording is in progress.');
    }

    const media = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
            }
        },
        video: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
            }
        }
    });

    const output = new AudioContext();
    const source = output.createMediaStreamSource(media);
    source.connect(output.destination);

    recorder = new MediaRecorder(media, { mimeType: 'video/webm' });
    recorder.ondataavailable = (event) => data.push(event.data);
    recorder.start();
    window.location.hash = 'recording';
}

function stopRecording() {
    return new Promise((resolve) => {
        recorder.onstop = () => {
            const blob = new Blob(data, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            resolve(url);
            recorder = undefined;
        };
        recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
        window.location.hash = '';
    });
}
