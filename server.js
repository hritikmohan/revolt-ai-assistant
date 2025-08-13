// server.js

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const config = require("./src/config");
const { handleConnection } = require("./src/websocket/handlers");

const app = express();
const server = http.createServer(app);

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Setup WebSocket server
const wss = new WebSocket.Server({
  server,
  ...config.webSocket,
});

// Handle WebSocket connections
wss.on("connection", handleConnection);

// Start the server
server.listen(config.port, () => {
  console.log(`🚀 Server is listening on port ${config.port}`);
});