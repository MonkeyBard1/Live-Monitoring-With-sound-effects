from flask import Flask, render_template, request, send_file
import numpy as np
from scipy.io import wavfile
import tempfile

app = Flask(__name__)

@app.route('/')
def index():
    """Render the main HTML interface."""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    """
    Receive uploaded WAV file, remove echo,
    and return the processed file as a download.
    """
    file = request.files['audio_data']
    samplerate, data = wavfile.read(file)

    # Handle stereo or mono
    if data.ndim == 2:
        # Process each channel separately and transpose back
        data = np.array([remove_echo(channel) for channel in data.T]).T
    else:
        data = remove_echo(data)

    # Save to temporary file and send as response
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        wavfile.write(tmp.name, samplerate, data.astype(np.int16))
        tmp.seek(0)
        return send_file(tmp.name, as_attachment=True, download_name='processed.wav')

def remove_echo(signal, delay_samples=4000, attenuation=0.6):
    """
    Remove echo by subtracting a delayed and attenuated version of the signal.

    Args:
        signal (np.ndarray): Input audio signal.
        delay_samples (int): Delay in samples.
        attenuation (float): Echo strength (0–1).

    Returns:
        np.ndarray: Signal with echo removed.
    """
    echo = np.zeros_like(signal)
    echo[delay_samples:] = signal[:-delay_samples] * attenuation
    return signal - echo

def generate_impulse(fs, duration=0.1):
    """
    Generate a single-sample impulse signal.

    Args:
        fs (int): Sample rate in Hz.
        duration (float): Total signal duration in seconds.

    Returns:
        np.ndarray: Impulse signal of given duration.
    """
    impulse = np.zeros(int(fs * duration))
    impulse[0] = 1.0
    return impulse

if __name__ == '__main__':
    app.run(debug=True)
