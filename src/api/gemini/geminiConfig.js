const { Modality } = require("@google/genai");

const geminiModelConfig = {
  model: "gemini-2.0-flash-live-001",
  config: {
    responseModalities: [Modality.AUDIO],
    systemInstruction:
      "You are a helpful and friendly assistant for Revolt Motors. You should only talk about Revolt Motors. Speak at a natural, conversational pace, slightly faster than a typical AI assistant. Keep responses concise and clear.",
    audioConfig: {
      sampleRate: 16000,
      encoding: "pcm_s16le",
    },
  },
};

module.exports = geminiModelConfig;