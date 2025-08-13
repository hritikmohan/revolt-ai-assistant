// client.js

const talkButton = document.getElementById('talkButton');
const statusElement = document.getElementById('status');

let isTalking = false;
let websocket;
let audioContext;
let microphone;
let workletNode;

// Playback Queue state
let audioQueue = [];
let isPlaying = false;
let nextPlayTime = 0;
let currentAudioSource = null;
let bufferedDuration = 0;
const PREBUFFER_SECONDS = 0.2;

// --- ✨ INTERRUPT FEATURE: Variables ---
let analyserNode;
let interruptionTimer = null;
// --- THE FIX: Lower this value to make interruption easier ---
const INTERRUPTION_SENSITIVITY = 0.02; // Lower is more sensitive
const INTERRUPTION_DELAY = 200; // Time in ms user needs to speak to trigger

talkButton.addEventListener('click', () => {
    if (isTalking) {
        stopConversation();
    } else {
        startConversation();
    }
});

async function startConversation() {
    isTalking = true;
    talkButton.textContent = 'Stop';
    talkButton.classList.add('active');
    statusElement.textContent = 'Connecting...';

    // Reset state
    audioQueue = [];
    isPlaying = false;
    nextPlayTime = 0;
    bufferedDuration = 0;

    websocket = new WebSocket('ws://localhost:3000');

    websocket.onopen = async () => {
        try {
            statusElement.textContent = 'Listening...';

            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000,
                latencyHint: 'interactive'
            });

            if (audioContext.state === 'suspended') await audioContext.resume();

            await audioContext.audioWorklet.addModule('audio-processor.js');

            microphone = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });

            const source = audioContext.createMediaStreamSource(microphone);
            workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

            // --- ✨ INTERRUPT FEATURE: Setup Analyser ---
            // Create an AnalyserNode to monitor microphone volume.
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 512;
            analyserNode.smoothingTimeConstant = 0.5;

            // Connect the microphone source to both the worklet (for sending) and the analyser (for interruption).
            source.connect(workletNode);
            source.connect(analyserNode);

            workletNode.port.onmessage = (event) => {
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                    websocket.send(event.data.buffer);
                }
            };

            console.log('Audio pipeline with interruption detection is ready.');
            detectInterruption(); // Start the detection loop.

        } catch (error) {
            console.error('Error initializing audio:', error);
            statusElement.textContent = 'Error: ' + error.message;
            stopConversation();
        }
    };

    websocket.onmessage = async (event) => {
        if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
            statusElement.textContent = 'AI is speaking...';
            const audioData = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
            addToPlaybackQueue(new Int16Array(audioData));
        }
    };

    websocket.onclose = () => stopConversation();
    websocket.onerror = () => stopConversation();
}

function stopConversation() {
    isTalking = false;
    talkButton.textContent = 'Talk';
    talkButton.classList.remove('active');
    statusElement.textContent = 'Click the button to start';

    // This will also stop the interruption detection loop via isTalking flag
    interruptAI();

    if (microphone) microphone.getTracks().forEach(track => track.stop());
    if (workletNode) workletNode.disconnect();
    if (analyserNode) analyserNode.disconnect(); // Disconnect analyser
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (websocket) websocket.close();

    microphone = workletNode = audioContext = websocket = analyserNode = null;
}

function interruptAI() {
    console.log('🛑 Interrupting AI playback...');

    audioQueue = [];
    bufferedDuration = 0;

    if (currentAudioSource) {
        try { currentAudioSource.stop(0); } catch (e) { }
        currentAudioSource = null;
    }

    isPlaying = false;
    nextPlayTime = 0;

    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'interrupt' }));
    }

    if (isTalking) statusElement.textContent = 'Listening...';
}

// --- ✨ INTERRUPT FEATURE: Detection Loop ---
function detectInterruption() {
    if (!isTalking || !analyserNode) {
        return; // Stop the loop if conversation ends.
    }

    // This runs continuously to check for user speech.
    requestAnimationFrame(detectInterruption);

    if (!isPlaying) {
        return; // Only check for interruptions when the AI is speaking.
    }

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteTimeDomainData(dataArray);

    let peak = 0;
    for (const v of dataArray) {
        const value = Math.abs(v / 128.0 - 1.0); // Normalize to 0-1 range
        if (value > peak) {
            peak = value;
        }
    }

    if (peak > INTERRUPTION_SENSITIVITY) {
        // User is making noise. Start a timer.
        if (!interruptionTimer) {
            interruptionTimer = setTimeout(() => {
                console.log("🎤 User interruption detected!");
                interruptAI();
                interruptionTimer = null; // Reset timer
            }, INTERRUPTION_DELAY);
        }
    } else {
        // User is silent, cancel any pending interruption.
        if (interruptionTimer) {
            clearTimeout(interruptionTimer);
            interruptionTimer = null;
        }
    }
}

function addToPlaybackQueue(pcmData) {
    if (!audioContext) return;

    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
    }

    const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
    audioBuffer.copyToChannel(float32Data, 0);

    audioQueue.push(audioBuffer);
    bufferedDuration += audioBuffer.duration;

    if (!isPlaying) {
        schedulePlayback();
    }
}

function schedulePlayback() {
    if (!isPlaying && bufferedDuration < PREBUFFER_SECONDS && audioQueue.length > 0) {
        return;
    }

    if (audioQueue.length === 0) {
        isPlaying = false;
        bufferedDuration = 0;
        if (isTalking) statusElement.textContent = 'Listening...';
        return;
    }

    isPlaying = true; // AI starts speaking
    const bufferToPlay = audioQueue.shift();
    const source = audioContext.createBufferSource();
    source.buffer = bufferToPlay;
    source.connect(audioContext.destination);

    const playTime = Math.max(audioContext.currentTime, nextPlayTime);
    source.start(playTime);

    nextPlayTime = playTime + bufferToPlay.duration;
    currentAudioSource = source;

    source.onended = () => {
        if (currentAudioSource === source) currentAudioSource = null;
        schedulePlayback();
    };
}