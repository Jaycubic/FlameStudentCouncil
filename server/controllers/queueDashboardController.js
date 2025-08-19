const Queue = require("../models/Queue");
const User = require("../models/User");
const Counter = require("../models/counter");
const Department = require("../models/Department");
const Location = require("../models/Location");
const { Op } = require("sequelize");

// Socket.io instance from server.js
let io;

exports.setIo = (socketIo) => {
  io = socketIo;
};

// Get waiting queues for user's DeviceId
exports.getWaitingQueues = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Counter,
          include: [
            {
              model: Department,
              include: [Location]
            }
          ]
        }
      ]
    });
    if (!user || !user.Counter || !user.Counter.Department || !user.Counter.Department.Location) {
      return res.status(400).json({ message: "User is not associated with a counter or location" });
    }
    const deviceId = user.Counter.Department.Location.DeviceId;
    const queues = await Queue.findAll({
      where: { status: 'WAIT', DeviceId: deviceId },
      order: [['createdAt', 'ASC']],
    });
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching waiting queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get active queues for user's CounterId, including CounterName
exports.getActiveQueues = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findByPk(userId);
    if (!user || !user.CounterId) {
      return res.status(400).json({ message: "User is not associated with a counter" });
    }
    const counterId = user.CounterId;
    const queues = await Queue.findAll({
      where: { status: 'ON', CounterId: counterId },
      include: [
        {
          model: Counter,
          attributes: ['CounterName']
        }
      ],
      order: [['updatedAt', 'DESC']],
    });
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching active queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// New function for dashboard to get all active queues by DeviceId
exports.getActiveQueuesForDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Counter,
          include: [
            {
              model: Department,
              include: [Location]
            }
          ]
        }
      ]
    });
    if (!user || !user.Counter || !user.Counter.Department || !user.Counter.Department.Location) {
      return res.status(400).json({ message: "User is not associated with a counter or location" });
    }
    const deviceId = user.Counter.Department.Location.DeviceId;
    const queues = await Queue.findAll({
      where: { status: 'ON', DeviceId: deviceId },
      include: [
        {
          model: Counter,
          attributes: ['CounterName']
        }
      ],
      order: [['updatedAt', 'DESC']],
    });
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching active queues for dashboard:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get completed queues (status: OFF) for user's DeviceId
exports.getCompletedQueues = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Counter,
          include: [
            {
              model: Department,
              include: [Location]
            }
          ]
        }
      ]
    });
    if (!user || !user.Counter || !user.Counter.Department || !user.Counter.Department.Location) {
      return res.status(400).json({ message: "User is not associated with a counter or location" });
    }
    const deviceId = user.Counter.Department.Location.DeviceId;
    const queues = await Queue.findAll({
      where: { status: 'OFF', DeviceId: deviceId },
      include: [
        {
          model: Counter,
          attributes: ['CounterName'],
          required: false // Allow queues with null CounterId
        }
      ],
      order: [['updatedAt', 'DESC']],
    });
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching completed queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Set queue status to ON with user's CounterId
exports.setQueueOn = async (req, res) => {
  try {
    const queueId = req.params.id;
    const userId = req.user.userId;
    const user = await User.findByPk(userId);
    if (!user || !user.CounterId) {
      return res.status(400).json({ message: "User is not associated with a counter" });
    }
    const counterId = user.CounterId;
    const queue = await Queue.findByPk(queueId);
    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }
    if (queue.status !== 'WAIT') {
      return res.status(400).json({ message: "Queue is not in WAIT status" });
    }
    await queue.update({ status: 'ON', CounterId: counterId });
    io.emit('queueUpdate', queue);
    res.status(200).json({ message: "Queue status set to ON successfully", queue });
  } catch (error) {
    console.error("Error setting queue status to ON:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Set queue status to OFF for user's CounterId
exports.setQueueOff = async (req, res) => {
  try {
    const queueId = req.params.id;
    const userId = req.user.userId;
    const user = await User.findByPk(userId);
    if (!user || !user.CounterId) {
      return res.status(400).json({ message: "User is not associated with a counter" });
    }
    const counterId = user.CounterId;
    const queue = await Queue.findByPk(queueId);
    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }
    if (queue.status !== 'ON' || queue.CounterId !== counterId) {
      return res.status(400).json({ message: "Queue is not active or not assigned to this counter" });
    }
    await queue.update({ status: 'OFF', CounterId: null });
    io.emit('queueUpdate', queue);
    res.status(200).json({ message: "Queue status set to OFF successfully", queue });
  } catch (error) {
    console.error("Error setting queue status to OFF:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a waiting queue entry
exports.deleteQueue = async (req, res) => {
  try {
    const queueId = req.params.id;
    const queue = await Queue.findByPk(queueId);
    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }
    if (queue.status !== 'WAIT') {
      return res.status(400).json({ message: "Only waiting queues can be deleted" });
    }
    await queue.destroy();
    io.emit('queueUpdate', { id: queueId, deleted: true });
    res.status(200).json({ message: "Queue entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting queue entry:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get counters for the user's department
exports.getDepartmentCounters = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findByPk(userId, {
      include: [Counter]
    });
    if (!user || !user.Counter) {
      return res.status(400).json({ message: "User is not associated with a counter" });
    }
    const departmentName = user.Counter.DepartmentName;
    const counters = await Counter.findAll({
      where: { DepartmentName: departmentName },
      attributes: ['id', 'CounterName']
    });
    res.status(200).json(counters);
  } catch (error) {
    console.error("Error fetching department counters:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Move queue to another counter
exports.moveQueueToCounter = async (req, res) => {
  try {
    const queueId = req.params.id;
    const { newCounterId } = req.body;
    const userId = req.user.userId;
    const user = await User.findByPk(userId, {
      include: [Counter]
    });
    if (!user || !user.CounterId) {
      return res.status(400).json({ message: "User is not associated with a counter" });
    }
    const currentCounterId = user.CounterId;
    const queue = await Queue.findByPk(queueId);
    if (!queue) {
      return res.status(404).json({ message: "Queue entry not found" });
    }
    if (queue.status !== 'ON' || queue.CounterId !== currentCounterId) {
      return res.status(400).json({ message: "Queue is not active or not assigned to this counter" });
    }
    const newCounter = await Counter.findByPk(newCounterId);
    if (!newCounter || newCounter.DepartmentName !== user.Counter.DepartmentName) {
      return res.status(400).json({ message: "Invalid counter for the department" });
    }
    await queue.update({ CounterId: newCounterId });
    io.emit('queueUpdate', queue);
    res.status(200).json({ message: "Queue moved to new counter successfully", queue });
  } catch (error) {
    console.error("Error moving queue to new counter:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// ─── modified ───

// Removed any CounterName check — always use counterId → DepartmentName → locationName → Queue

exports.getWaitingQueuesSpecial = async (req, res) => {
  try {
    const counterId = req.user.counterId;
    if (!counterId) {
      return res.status(400).json({ message: "No counterId found in token" });
    }
    // 1) Lookup Counter → get DepartmentName
    const counter = await Counter.findByPk(counterId, {
      attributes: ['DepartmentName']
    });
    if (!counter) {
      return res.status(400).json({ message: "Counter not found" });
    }
    // 2) Lookup Department → get locationName
    const dept = await Department.findOne({
      where: { departmentName: counter.DepartmentName },
      attributes: ['locationName']
    });
    if (!dept) {
      return res.status(400).json({ message: "Department not found" });
    }
    const locName = dept.locationName;
    // 3) Fetch WAIT queues by locationName
    const queues = await Queue.findAll({
      where: { status: 'WAIT', locationName: locName },
      order: [['createdAt','ASC']]
    });
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching special waiting queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getActiveQueuesSpecial = async (req, res) => {
  try {
    const counterId = req.user.counterId;
    if (!counterId) {
      return res.status(400).json({ message: "No counterId found in token" });
    }
    const counter = await Counter.findByPk(counterId, {
      attributes: ['DepartmentName']
    });
    if (!counter) {
      return res.status(400).json({ message: "Counter not found" });
    }
    const dept = await Department.findOne({
      where: { departmentName: counter.DepartmentName },
      attributes: ['locationName']
    });
    if (!dept) {
      return res.status(400).json({ message: "Department not found" });
    }
    const locName = dept.locationName;
    const queues = await Queue.findAll({
      where: { status: 'ON', locationName: locName },
      include: [{ model: Counter, attributes: ['CounterName'] }],
      order: [['updatedAt','DESC']]
    });
    res.status(200).json(queues);
  } catch (error) {
    console.error("Error fetching special active queues:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
