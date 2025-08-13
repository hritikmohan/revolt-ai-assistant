const { GoogleGenAI } = require("@google/genai");
const config = require("../../config");
const geminiModelConfig = require("./geminiConfig");

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
let session = null;
let isConnected = false;

async function connectToGemini(onMessageCallback, onErrorCallback, onCloseCallback) {
  let connectionRetries = 0;
  const MAX_RETRIES = 3;

  const tryConnect = async () => {
    try {
      console.log(`🔄 Connecting to Gemini Live API... (attempt ${connectionRetries + 1})`);
      session = await ai.live.connect({
        model: geminiModelConfig.model,
        callbacks: {
          onopen: () => {
            console.log("✅ Gemini Live API connected successfully");
            isConnected = true;
            connectionRetries = 0;
          },
          onmessage: onMessageCallback,
          onerror: (error) => {
            console.error("❌ Gemini error:", error);
            isConnected = false;
            onErrorCallback(error);
          },
          onclose: (event) => {
            console.log("🔌 Gemini session closed:", event?.reason || "Unknown reason");
            isConnected = false;
            onCloseCallback(event);
          },
        },
        config: geminiModelConfig.config,
      });
    } catch (error) {
      console.error(`❌ Failed to connect to Gemini Live API:`, error.message);
      connectionRetries++;
      if (connectionRetries < MAX_RETRIES) {
        setTimeout(tryConnect, 2000 * connectionRetries);
      } else {
        onErrorCallback(new Error("Maximum reconnection attempts reached."));
      }
    }
  };

  await tryConnect();
}

async function sendAudio(base64Audio) {
  if (!session || !isConnected) return;
  await session.sendRealtimeInput({
    audio: { data: base64Audio, mimeType: "audio/pcm;rate=16000" },
  });
}

async function sendInterrupt() {
  if (!session || !isConnected) return;
  console.log("🛑 Sending interrupt signal to Gemini...");
  await session.interrupt();
}

function closeSession() {
  if (session) {
    session.close();
    session = null;
  }
}

function isSessionConnected() {
  return isConnected;
}

module.exports = {
  connectToGemini,
  sendAudio,
  sendInterrupt,
  closeSession,
  isSessionConnected,
};