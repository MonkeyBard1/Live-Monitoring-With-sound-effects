let audioContext;
let source;
let stream;
let gainNode;
let distortionNode;
let analyser;
let animationId;
let latencyStartTime;
let latencyIntervalId;
let maxLatency = 0;

/**
 * Display current gain value while sliding.
 */
document.getElementById('gainRange').addEventListener('input', () => {
    document.getElementById('gainValue').textContent = document.getElementById('gainRange').value;
});

/**
 * Start live monitoring with optional audio effect.
 * @param {string} effect - Selected effect: "none", "distortion", "tremolo"
 */
function startMonitoring(effect = "none") {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
        stream = s;
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        latencyStartTime = performance.now();

        source = audioContext.createMediaStreamSource(stream);
        gainNode = audioContext.createGain();
        distortionNode = audioContext.createWaveShaper();
        analyser = audioContext.createAnalyser();

        if (effect === "distortion") {
            const gain = parseFloat(document.getElementById('gainRange').value);
            const mode = document.getElementById('clipMode').value;
            distortionNode.curve = makeDistortionCurve(gain, mode);
            distortionNode.oversample = '4x';

            source.connect(distortionNode);
            distortionNode.connect(gainNode);

        } else if (effect === "tremolo") {
            setupTremolo();
        } else {
            source.connect(gainNode);
        }

        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);

        monitorLatency();

    }).catch(err => {
        console.error("Microphone access error:", err);
    });
}

/**
 * Stop monitoring and clean up all audio nodes and intervals.
 */
function stopMonitoring() {
    cancelAnimationFrame(animationId);
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (source) source.disconnect();
    if (gainNode) gainNode.disconnect();
    if (distortionNode) distortionNode.disconnect();

    // Stop tremolo LFOs
    if (window._tremoloNodes) {
        window._tremoloNodes.forEach(node => {
            try {
                if (node.stop) node.stop();
                node.disconnect();
            } catch (e) {}
        });
        window._tremoloNodes = null;
    }

    if (audioContext) audioContext.close();

    // Reset display
    document.getElementById('latencyDisplay').textContent = '–';
    document.getElementById('maxLatencyDisplay').textContent = '–';
    maxLatency = 0;

    if (latencyIntervalId) {
        clearInterval(latencyIntervalId);
        latencyIntervalId = null;
    }
}

/**
 * Measure and display current and max audio latency.
 */
function monitorLatency() {
    latencyIntervalId = setInterval(() => {
        if (!audioContext) return;
        const current = performance.now();
        const latency = current - latencyStartTime;
        latencyStartTime = current;

        document.getElementById('latencyDisplay').textContent = latency.toFixed(1);

        if (latency > maxLatency) {
            maxLatency = latency;
            document.getElementById('maxLatencyDisplay').textContent = maxLatency.toFixed(1);
        }
    }, 2);
}

/**
 * Generate a distortion curve for the WaveShaperNode.
 * @param {number} gain - Input gain level.
 * @param {string} mode - "soft" or "hard" clipping.
 * @returns {Float32Array} - Distortion curve.
 */
function makeDistortionCurve(gain, mode = "soft") {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
        let x = i * 2 / n_samples - 1;
        curve[i] = mode === "hard"
            ? Math.max(-1, Math.min(1, gain * x))
            : Math.tanh(gain * x);
    }
    return curve;
}

/**
 * Show or hide distortion control panel.
 */
function toggleDistortionControls() {
    const effect = document.getElementById('effectSelect').value;
    document.getElementById('distortion-controls').style.display = effect === 'distortion' ? 'block' : 'none';
}

/**
 * Setup tremolo effect using delayed copies modulated by LFOs.
 */
function setupTremolo() {
    const mainGain = audioContext.createGain();
    mainGain.gain.value = 1.0;
    source.connect(mainGain);
    mainGain.connect(gainNode);

    const delay1 = audioContext.createDelay();
    delay1.delayTime.value = 0.25;
    const gain1 = audioContext.createGain();
    gain1.gain.value = 0.3;
    const lfo1 = audioContext.createOscillator();
    lfo1.frequency.value = 4.0;
    const lfoGain1 = audioContext.createGain();
    lfoGain1.gain.value = 0.3;
    lfo1.connect(lfoGain1);
    lfoGain1.connect(gain1.gain);
    lfo1.start();

    source.connect(delay1);
    delay1.connect(gain1);
    gain1.connect(gainNode);

    const delay2 = audioContext.createDelay();
    delay2.delayTime.value = 0.50;
    const gain2 = audioContext.createGain();
    gain2.gain.value = 0.2;
    const lfo2 = audioContext.createOscillator();
    lfo2.frequency.value = 6.5;
    const lfoGain2 = audioContext.createGain();
    lfoGain2.gain.value = 0.2;
    lfo2.connect(lfoGain2);
    lfoGain2.connect(gain2.gain);
    lfo2.start();

    source.connect(delay2);
    delay2.connect(gain2);
    gain2.connect(gainNode);

    window._tremoloNodes = [lfo1, lfoGain1, gain1, delay1, lfo2, lfoGain2, gain2, delay2];
}
