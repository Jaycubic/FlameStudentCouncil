// /server/socket.js
const socketIo = require("socket.io");
const redis = require("redis");
require("dotenv").config();

const { ElectionDraft } = require('./models');

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

    // ── Push cached dashboard data immediately on connect ──────────────────
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

    // ── Election Draft Autosave ─────────────────────────────────────────────
    // Receives { email, position_selected, community_service, statement_of_purpose }
    // Upserts to ElectionDraft table and acknowledges back.
    socket.on("saveDraft", async (data, callback) => {
      try {
        const { email, position_selected, community_service, statement_of_purpose } = data || {};

        if (!email) {
          if (typeof callback === 'function') callback({ success: false, error: 'Email required' });
          return;
        }

        await ElectionDraft.upsert({
          email,
          position_selected:    position_selected    ?? null,
          community_service:    community_service    ?? null,
          statement_of_purpose: statement_of_purpose ?? null,
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error("[Socket] saveDraft error:", err.message);
        if (typeof callback === 'function') callback({ success: false, error: err.message });
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
 * Broadcast fresh dashboard data to ALL connected clients.
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
 */
function getIo() {
  if (!ioInstance) {
    throw new Error("Socket.IO not initialized. Did you call setupSocket(server)?");
  }
  return ioInstance;
}

module.exports = { setupSocket, getIo, broadcastDashboardUpdate };
