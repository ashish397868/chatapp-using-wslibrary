const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Map<username, WebSocket>
const clients = new Map();

// Broadcast to everyone except sender
function broadcast(data, exclude) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== exclude) {
      client.send(message);
    }
  });
}

// Helper to get current usernames
function getActiveUsernames() {
  return Array.from(clients.keys());
}

wss.on("connection", (ws) => {
  let userName = null;

  ws.on("message", (msg) => {
    msg = msg.toString();

    // STEP 1: Handle new connection (register username)
    if (!userName) {
      userName = msg;
      clients.set(userName, ws);

      const activeUsersList = getActiveUsernames();

      ws.send(JSON.stringify({
        type: "welcome",
        userName,
        activeUsers: clients.size,
        activeUsersList,
      }));

      broadcast({
        type: "userJoined",
        userName,
        activeUsers: clients.size,
        activeUsersList,
      }, ws);

      return;
    }

    // STEP 2: Check if it's JSON for typing or private message
    try {
      const parsed = JSON.parse(msg);

      if (parsed.type === "typing") {
        broadcast({ type: "typing", userName }, ws);
        return;
      }

      if (parsed.type === "privateMessage") {
        const to = parsed.to;
        const targetSocket = clients.get(to);
        const timestamp = new Date().toISOString();
        
        // Create message object
        const messageData = {
          type: "privateMessage",
          from: userName,
          to: to,
          message: parsed.message,
          timestamp: timestamp
        };

        // Send to recipient
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(JSON.stringify(messageData));
        }

        return;
      }
    } catch (e) {
      // Not a JSON message: treat as public chat
    }

    // STEP 3: Handle normal public chat message
    const chatData = {
      type: "chatMessage",
      userName,
      message: msg,
      timestamp: new Date().toISOString(),
      activeUsers: clients.size,
    };
    
    // Broadcast to all clients (including sender for consistency)
    const messageStr = JSON.stringify(chatData);
    broadcast(chatData);
    // wss.clients.forEach((client) => {
    //   if (client.readyState === WebSocket.OPEN) {
    //     client.send(messageStr);
    //   }
    // });
  });

  ws.on("close", () => {
    if (userName) {
      clients.delete(userName);
      const activeUsersList = getActiveUsernames();

      broadcast({
        type: "userLeft",
        userName,
        activeUsers: clients.size,
        activeUsersList,
      });
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    if (userName) {
      clients.delete(userName);
    }
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
  console.log("📁 Make sure your index.html file is in the same directory");
});