const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "websockets.html"));
});

const users = new Map(); // socket.id → userName

io.on("connection", (socket) => {
  // 1) Join
  socket.on("join", (userName) => {
    users.set(socket.id, userName);
    socket.emit("welcome", userName);
    socket.broadcast.emit("userJoined", {
      userName,
      activeUsers: users.size,
    });
  });

  // 2) Typing
  socket.on("typing", () => {
    const userName = users.get(socket.id);
    socket.broadcast.emit("typing", userName);
  });

  // 3) Message
  socket.on("message", (msg) => {
    const userName = users.get(socket.id);
    const payload = {
      userName,
      message: msg,
      timestamp: new Date().toISOString(),
      activeUsers: users.size,
    };
    io.emit("chatMessage", payload);
  });

  // 4) Disconnect
  socket.on("disconnect", () => {
    const userName = users.get(socket.id);
    users.delete(socket.id);
    socket.broadcast.emit("userLeft", {
      userName,
      activeUsers: users.size,
    });
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
