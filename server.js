const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const players = new Map();

const carConfigs = [
  { id: "falcon", name: "Falcon GT", maxSpeed: 55, acceleration: 28, handling: 0.95 },
  { id: "vortex", name: "Vortex R", maxSpeed: 62, acceleration: 26, handling: 0.9 },
  { id: "drift", name: "Drift Queen", maxSpeed: 50, acceleration: 30, handling: 1.05 }
];

io.on("connection", (socket) => {
  console.log("Player connected", socket.id);

  socket.emit("init", {
    id: socket.id,
    players: Array.from(players.values()),
    cars: carConfigs
  });

  socket.on("join", (payload) => {
    const newPlayer = {
      id: socket.id,
      name: payload?.name || "Gracz",
      carId: payload?.carId || carConfigs[0].id,
      color: payload?.color || "#44caff",
      position: { x: 0, y: 0.5, z: 0 },
      rotation: { y: 0 },
      speed: 0
    };
    players.set(socket.id, newPlayer);
    io.emit("player:joined", newPlayer);
  });

  socket.on("state:update", (state) => {
    const existing = players.get(socket.id);
    if (!existing) return;
    existing.position = state.position;
    existing.rotation = state.rotation;
    existing.speed = state.speed;
    io.emit("state:sync", existing);
  });

  socket.on("chat:message", (message) => {
    const payload = {
      id: socket.id,
      name: players.get(socket.id)?.name || "Anon",
      text: message?.text || "",
      ts: Date.now()
    };
    io.emit("chat:message", payload);
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("player:left", socket.id);
    console.log("Player disconnected", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
