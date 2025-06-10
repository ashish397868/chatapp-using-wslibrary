const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const clients = new Map(); // Map<ws, username>

// Utility to broadcast message to clients
function broadcast(data, exclude) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== exclude) {
      client.send(message);
    }
  });
}

wss.on("connection", (ws) => {
  let userName = null;

  ws.on("message", (msg) => {
    msg = msg.toString();

    // STEP 1: First message is treated as username
    if (!clients.has(ws)) {
      userName = msg;
      clients.set(ws, userName);

      ws.send(JSON.stringify({ type: "welcome", userName }));

      // Notify others
      broadcast({ type: "userJoined", userName, activeUsers: clients.size }, ws);
      return;
    }

    // STEP 2: Typing detection
    try {
      const parsed = JSON.parse(msg);

      if (parsed.type === "typing") {
        broadcast({ type: "typing", userName: clients.get(ws) }, ws);
        return; // Don't continue
      }
    } catch (e) {
      // Not a typing message
    }

    // STEP 3: Chat message
    const chatData = {
      type: "chatMessage",
      userName: clients.get(ws),
      message: msg,
      timestamp: new Date().toISOString(),
      activeUsers: clients.size,
    };

    broadcast(chatData);
  });

  ws.on("close", () => {
    const leftUser = clients.get(ws);
    clients.delete(ws);

    broadcast({type: "userLeft",userName: leftUser,activeUsers: clients.size,},ws);
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});