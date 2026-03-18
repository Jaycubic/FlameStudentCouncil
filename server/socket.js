// /server/socket.js
const socketIo = require("socket.io");
const redis = require("redis");
require("dotenv").config();

// Create and connect Redis client
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});
redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.connect();

// We’ll store the Socket.IO instance here once we initialize it.
let ioInstance = null;

/**
 * Call this from your `app.js` after creating the HTTPS server.
 * This attaches Socket.IO to the server and also populates `ioInstance`.
 */
function setupSocket(server) {
  // Initialize Socket.IO and store it in module scope
  const io = socketIo(server, {
    cors: {
      origin: "https://flameawards.in",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    console.log("A user connected:", socket.id);

    // Immediately fetch all cached data from Redis (if any) and emit to this new client.
    const cachedData = {
      totalStudentCount:
        JSON.parse(await redisClient.get("totalStudentCount")) || { total: 0 },
      genderBatchCount:
        JSON.parse(await redisClient.get("genderBatchCount")) || {
          data: [],
          grandTotal: {},
        },
      rcFilledCount:
        JSON.parse(await redisClient.get("rcFilledCount")) || { total: 0 },
      rcCount: JSON.parse(await redisClient.get("rcCount")) || [],
      cityWithHighestCount:
        JSON.parse(await redisClient.get("cityWithHighestCount")) || {
          homeTown: "None",
          count: 0,
        },
      cityCount: JSON.parse(await redisClient.get("cityCount")) || [],
      inOutCount: JSON.parse(await redisClient.get("inOutCount")) || [],
      inOutBatchCount:
        JSON.parse(await redisClient.get("inOutBatchCount")) || {
          data: [],
          grandTotal: {},
        },
    };

    console.log("Emitting cached data to", socket.id, cachedData);
    socket.emit("updateData", cachedData);

    // Relay any client requestData back to them
    socket.on("requestData", async () => {
      socket.emit("updateData", cachedData);
    });

    // --- NEW: Listen for grabGesture from any client, broadcast to all ---
    socket.on("grabGesture", (payload) => {
      console.log("Received grabGesture from", socket.id, payload);
      // Forward to everyone (including sender)
      io.emit("grabGesture", payload);
    });

    // Clean up on disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Store the `io` instance for later use (in controllers)
  ioInstance = io;
  return io;
}

/**
 * After setupSocket(server) has been called, any controller can do:
 *    const { getIo } = require("../socket");
 *    const io = getIo();
 *    io.emit(...); // etc.
 */
function getIo() {
  if (!ioInstance) {
    throw new Error(
      "Socket.IO has not been initialized yet. Did you forget to call setupSocket(server)?"
    );
  }
  return ioInstance;
}

module.exports = {
  setupSocket,
  getIo,
};
