require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  webSocket: {
    perMessageDeflate: false,
    noDelay: true,
  },
};