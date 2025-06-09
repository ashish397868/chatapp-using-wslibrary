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
      const joinedMsg = {
        type: "userJoined",
        userName,
        activeUsers: clients.size,
      };

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(joinedMsg));
        }
      });

      return;
    }

    // STEP 2: Typing detection
    try {
      const parsed = JSON.parse(msg);

      if (parsed.type === "typing") {
        const typingMsg = {
          type: "typing",
          userName: clients.get(ws),
        };

        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(typingMsg));
          }
        });

        return; // Don't continue
      }
    } catch (e) {
      // Not a typing message
    }

    // STEP 3: Chat message
    const chatData = {
      userName: clients.get(ws),
      message: msg,
      timestamp: new Date().toISOString(),
      activeUsers: clients.size,
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(chatData));
      }
    });
  });

  ws.on("close", () => {
    const leftUser = clients.get(ws);
    clients.delete(ws);

    const leftMsg = {
      type: "userLeft",
      userName: leftUser,
      activeUsers: clients.size,
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(leftMsg));
      }
    });
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
