// public/audio-processor.js

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Send smaller chunks more frequently to reduce input latency
    this.bufferSize = 1024; 
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  // Simple linear resampler from the browser's sample rate to 16kHz
  resample(inputBuffer, fromSampleRate, toSampleRate) {
    if (fromSampleRate === toSampleRate) {
        return inputBuffer;
    }
    const ratio = fromSampleRate / toSampleRate;
    const outputLength = Math.floor(inputBuffer.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const inputIndex = i * ratio;
        const index = Math.floor(inputIndex);
        const fraction = inputIndex - index;
        const p1 = inputBuffer[index];
        const p2 = inputBuffer[index + 1] || p1;
        output[i] = p1 + (p2 - p1) * fraction;
    }
    return output;
  }
  
  // Convert Float32 audio data to 16-bit PCM
  float32ToInt16(buffer) {
    const pcm16 = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        let s = Math.max(-1, Math.min(1, buffer[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];

      // Buffer the incoming data
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];
        if (this.bufferIndex === this.bufferSize) {
          const resampled = this.resample(this.buffer, sampleRate, 16000);
          const pcm16 = this.float32ToInt16(resampled);
          this.port.postMessage(pcm16, [pcm16.buffer]);
          this.bufferIndex = 0; // Reset buffer
        }
      }
    }
    // Keep the processor alive
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);