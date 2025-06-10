const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const socketServer = new WebSocket.Server({ server }); // renamed wss → socketServer

// Serve HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const connectedUsers = new Map(); // Map<socket, username>

// Utility to broadcast message to clients
function broadcastToAllClients(data, excludeSocket) {
  const message = JSON.stringify(data);
  socketServer.clients.forEach((clientSocket) => {
    if (clientSocket.readyState === WebSocket.OPEN && clientSocket !== excludeSocket) {
      clientSocket.send(message);
    }
  });
}

socketServer.on("connection", (clientSocket) => {
  let userName = null;

  clientSocket.on("message", (msg) => {
    msg = msg.toString();

    // STEP 1: Handle username as first message
    if (!connectedUsers.has(clientSocket)) {
      userName = msg;
      connectedUsers.set(clientSocket, userName);

      clientSocket.send(JSON.stringify({ type: "welcome", userName }));

      // Notify others
      broadcastToAllClients(
        { type: "userJoined", userName, activeUsers: connectedUsers.size },
        clientSocket
      );
      return;
    }

    // STEP 2: Typing detection
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === "typing") {
        broadcastToAllClients(
          { type: "typing", userName: connectedUsers.get(clientSocket) },
          clientSocket
        );
        return;
      }
    } catch (err) {
      // Not a typing message
    }

    // STEP 3: Chat message
    const chatMessage = {
      type: "chatMessage",
      userName: connectedUsers.get(clientSocket),
      message: msg,
      timestamp: new Date().toISOString(),
      activeUsers: connectedUsers.size,
    };

    broadcastToAllClients(chatMessage);
  });

  clientSocket.on("close", () => {
    const leftUser = connectedUsers.get(clientSocket);
    connectedUsers.delete(clientSocket);

    broadcastToAllClients(
      { type: "userLeft", userName: leftUser, activeUsers: connectedUsers.size },
      clientSocket
    );
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
``
