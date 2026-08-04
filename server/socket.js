// /server/socket.js
const socketIo = require("socket.io");
const redis = require("redis");
require("dotenv").config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});
redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.connect();

let ioInstance = null;

/**
 * Attach Socket.IO to the HTTPS server.
 * Call this once from app.js after creating the server.
 */
function setupSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: "https://flamestudentcouncil.in",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    console.log("A user connected:", socket.id);

    // ── Push cached award dashboard data immediately on connect ────────────
    try {
      const cached = await redisClient.get("awardDashboardData");
      if (cached) {
        socket.emit("dashboardUpdate", JSON.parse(cached));
      }
    } catch (err) {
      console.error("[Socket] Redis read error on connect:", err.message);
    }

    // ── Client can request a fresh push at any time ─────────────────────────
    socket.on("requestDashboard", async () => {
      try {
        const cached = await redisClient.get("awardDashboardData");
        if (cached) socket.emit("dashboardUpdate", JSON.parse(cached));
      } catch (err) {
        console.error("[Socket] requestDashboard error:", err.message);
      }
    });

    // ── Forward grabGesture to all connected clients ─────────────────────────
    socket.on("grabGesture", (payload) => {
      console.log("Received grabGesture from", socket.id, payload);
      io.emit("grabGesture", payload);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  ioInstance = io;
  return io;
}

/**
 * Broadcast fresh award dashboard data to ALL connected clients.
 * Called by dashboardController.emitDashboardUpdate() after any submission.
 * Also caches the data in Redis so new connections get it immediately.
 */
async function broadcastDashboardUpdate(data) {
  try {
    await redisClient.set("awardDashboardData", JSON.stringify(data), { EX: 300 }); // 5 min TTL
    if (ioInstance) {
      ioInstance.emit("dashboardUpdate", data);
    }
  } catch (err) {
    console.error("[Socket] broadcastDashboardUpdate error:", err.message);
  }
}

/**
 * Returns the active Socket.IO instance.
 * Throws if setupSocket() hasn't been called yet.
 */
function getIo() {
  if (!ioInstance) {
    throw new Error("Socket.IO not initialized. Did you call setupSocket(server)?");
  }
  return ioInstance;
}

module.exports = { setupSocket, getIo, broadcastDashboardUpdate };
