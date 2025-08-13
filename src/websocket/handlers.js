// src/websocket/handlers.js

const { WebSocket } = require("ws");
const geminiService = require("../api/gemini/geminiService");
const network = require("../utils/network");

async function handleConnection(ws) {
  console.log("✅ Client connected via WebSocket");

  if (!(await network.testDNSResolution())) {
    return ws.close(1011, "DNS resolution failed");
  }

  const handleGeminiError = () => {
    console.error("Gemini connection failed. Closing client socket.");
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, "AI service connection failed.");
    }
  };

  const handleGeminiClose = () => {
    console.log("🔌 Gemini session has ended. Notifying client.");
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1013, "AI session ended. Please reconnect.");
    }
  };


  const handleGeminiMessage = (message) => {
    if (message.data && ws.readyState === WebSocket.OPEN) {
      const audioBuffer = Buffer.from(message.data, "base64");
      ws.send(audioBuffer, { binary: true });
    }
  };


  ws.on("message", async (message) => {
    if (!geminiService.isSessionConnected()) {
      console.warn("Received message, but Gemini session is not active.");
      return;
    }

    if (Buffer.isBuffer(message) && message.length < 200) {
      const messageStr = message.toString();

      if (messageStr.startsWith("{")) {
        try {
          const jsonMessage = JSON.parse(messageStr);
          if (jsonMessage.type === "interrupt") {
            await geminiService.sendInterrupt();
            return; 
          }
        } catch (e) {
          console.warn("⚠️ Received a malformed JSON-like message:", messageStr, e.message);
        }
      }
    }

    if (Buffer.isBuffer(message)) {
      const base64Audio = message.toString("base64");
      await geminiService.sendAudio(base64Audio);
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected. Closing Gemini session.");
    geminiService.closeSession();
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
    geminiService.closeSession();
  });

  await geminiService.connectToGemini(handleGeminiMessage, handleGeminiError, handleGeminiClose);
}

module.exports = { handleConnection };