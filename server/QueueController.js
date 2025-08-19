const Queue = require("../models/Queue");
const { Op } = require("sequelize");

// Assume io is passed from server.js
let io;

exports.setIo = (socketIo) => {
  io = socketIo;
};

// Create a new queue entry
exports.createQueue = async (req, res) => {
  try {
    const { EmployeeId, EmployeeName, Gender, Department, Email, locationName, DeviceId, status = 'WAIT' } = req.body;

    if (!EmployeeId || !EmployeeName || !Gender || !Department || !Email || !locationName || !DeviceId) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    const newQueue = await Queue.create({
      EmployeeId,
      EmployeeName,
      Gender,
      Department,
      Email,
      locationName,
      DeviceId,
      status
    });
    io.emit('queueUpdate', newQueue); // Emit queueUpdate
    res.status(201).json({ message: "Queue entry created successfully", newQueue });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Error creating queue entry:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all queue entries
exports.getAllQueues = async (req, res) => {
  try {
    const queues = await Queue.findAll();
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching queue entries:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get a single queue entry by ID
exports.getQueueById = async (req, res) => {
  try {
    const queue = await Queue.findByPk(req.params.id);
    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }
    res.status(200).json(queue);
  } catch (error) {
    console.error("Error fetching queue entry:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a queue entry
exports.updateQueue = async (req, res) => {
  try {
    const queueId = req.params.id;
    const queue = await Queue.findByPk(queueId);

    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }

    await queue.update(req.body, { validate: true });
    io.emit('queueUpdate', queue); // Emit queueUpdate
    res.status(200).json({ message: "Queue entry updated successfully", queue });
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Error updating queue entry:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a queue entry
exports.deleteQueue = async (req, res) => {
  try {
    const queueId = req.params.id;
    const queue = await Queue.findByPk(queueId);

    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }

    await queue.destroy();
    io.emit('queueUpdate', { id: queueId, status: 'OFF' }); // Emit queueUpdate
    res.status(200).json({ message: "Queue entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting queue:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get queues with status WAIT
exports.getQueuesByStatusWait = async (req, res) => {
  try {
    const queues = await Queue.findAll({
      where: { status: 'WAIT' },
      limit: 9,
      order: [['createdAt', 'ASC']], // Oldest first
    });
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching WAIT queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get queues with status ON
exports.getQueuesByStatusOn = async (req, res) => {
  try {
    const queues = await Queue.findAll({
      where: { status: 'ON' },
      limit: 9,
      order: [['updatedAt', 'DESC']],
    });
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching ON queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Count queues with status WAIT
exports.countQueuesByStatusWait = async (req, res) => {
  try {
    const count = await Queue.count({ where: { status: 'WAIT' } });
    res.status(200).json({ count });
  } catch (error) {
    console.error("Error counting WAIT queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Count queues with status ON
exports.countQueuesByStatusOn = async (req, res) => {
  try {
    const count = await Queue.count({ where: { status: 'ON' } });
    res.status(200).json({ count });
  } catch (error) {
    console.error("Error counting ON queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Set queue status to OFF
exports.setQueueOff = async (req, res) => {
  try {
    const queueId = req.params.id;
    const queue = await Queue.findByPk(queueId);

    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }

    await queue.update({ status: 'OFF', CounterId: null }, { validate: true });
    io.emit('queueUpdate', queue); // Emit queueUpdate
    res.status(200).json({ message: "Queue status set to OFF successfully", queue });
  } catch (error) {
    console.error("Error setting queue status to OFF:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Set queue status to ON with CounterId
exports.setQueueOn = async (req, res) => {
  try {
    const queueId = req.params.id;
    const { CounterId } = req.body; // Get CounterId from request body
    if (!CounterId) {
      return res.status(400).json({ message: "CounterId is required" });
    }

    const queue = await Queue.findByPk(queueId);
    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }

    await queue.update(
      { status: 'ON', CounterId },
      { validate: true }
    );
    io.emit('queueUpdate', queue); // Emit queueUpdate
    res.status(200).json({ message: "Queue status set to ON successfully", queue });
  } catch (error) {
    console.error("Error setting queue status to ON:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
