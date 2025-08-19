const { getIo } = require('../socket');
const Queue = require("../models/Queue");
const StudentData = require("../models/StudentData");
const { Sequelize, QueryTypes, Op } = require("sequelize");
const sequelize = require("../config/database");
const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

// Get queue counts by location, device, and department with status 'OFF'
const getQueueCounts = async (req, res) => {
  try {
    const cachedKey = 'queueCounts';
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log('Serving queueCounts from Redis cache');
      return res.json(JSON.parse(cachedData));
    }

    const counts = await sequelize.query(
      `SELECT locationName, DeviceId, Department, COUNT(DISTINCT EmployeeId) AS count
       FROM Queue
       WHERE status = 'OFF'
       GROUP BY locationName, DeviceId, Department`,
      { type: QueryTypes.SELECT }
    );

    const result = counts.reduce((acc, curr) => {
      const key = `${curr.locationName}_${curr.DeviceId}`;
      if (!acc[key]) {
        acc[key] = {
          locationName: curr.locationName,
          DeviceId: curr.DeviceId,
          departments: {}
        };
      }
      acc[key].departments[curr.Department] = parseInt(curr.count);
      return acc;
    }, {});

    const formattedResult = Object.values(result);
    await redisClient.setEx(cachedKey, 600, JSON.stringify(formattedResult));
    const io = getIo();
    io.emit('queueCountsUpdated', formattedResult);
    res.json(formattedResult);
  } catch (error) {
    console.error("Error in getQueueCounts:", error);
    res.status(500).json({ message: "Failed to fetch queue counts", error: error.message });
  }
};

// Get list of queued members for a specific location and device with status 'OFF'
const getQueueList = async (req, res) => {
  try {
    const { locationName, DeviceId, department, date } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    const cachedKey = `queueList:location:${locationName}:device:${DeviceId}:department:${department || 'all'}:status:OFF:page:${page}:date:${date || 'all'}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log('Serving queueList from Redis cache');
      return res.json(JSON.parse(cachedData));
    }

    let whereClause = { locationName, DeviceId, status: 'OFF' };
    if (department) {
      whereClause.Department = department;
    }
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      whereClause.createdAt = { [Op.between]: [startDate, endDate] };
    }

    const [queues, total] = await Promise.all([
      Queue.findAll({
        where: whereClause,
        attributes: ['EmployeeId', 'EmployeeName', 'Gender', 'Department', 'createdAt'],
        limit,
        offset,
        raw: true,
      }),
      Queue.count({ where: whereClause })
    ]);

    if (total === 0) {
      return res.json({
        message: "No student has visited this location yet",
        data: [],
        total: 0,
        page,
        totalPages: 0
      });
    }

    const result = {
      data: queues,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };

    await redisClient.setEx(cachedKey, 600, JSON.stringify(result));
    const io = getIo();
    io.emit('queueListUpdated', { locationName, DeviceId, department, page, data: result });
    res.json(result);
  } catch (error) {
    console.error("Error in getQueueList:", error);
    res.status(500).json({ message: "Failed to fetch queue list", error: error.message });
  }
};

// Get summary table data for departments and locations
const getSummaryTableData = async (req, res) => {
  try {
    const { date } = req.query;
    let whereClause = "WHERE status = 'OFF'";
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      whereClause += ` AND createdAt >= '${startDate.toISOString()}' AND createdAt <= '${endDate.toISOString()}'`;
    }

    const counts = await sequelize.query(
      `SELECT Department, locationName, COUNT(DISTINCT EmployeeId) AS count
       FROM Queue
       ${whereClause}
       GROUP BY Department, locationName`,
      { type: QueryTypes.SELECT }
    );

    const departments = [...new Set(counts.map(c => c.Department))];
    const locations = [...new Set(counts.map(c => c.locationName))];
    const data = {};

    departments.forEach(dept => {
      data[dept] = {};
      locations.forEach(loc => {
        const entry = counts.find(c => c.Department === dept && c.locationName === loc);
        data[dept][loc] = entry ? parseInt(entry.count) : 0;
      });
      data[dept].total = locations.reduce((sum, loc) => sum + (data[dept][loc] || 0), 0);
    });

    const totals = {};
    locations.forEach(loc => {
      totals[loc] = departments.reduce((sum, dept) => sum + (data[dept][loc] || 0), 0);
    });
    totals.grandTotal = locations.reduce((sum, loc) => sum + totals[loc], 0);

    const result = {
      departments,
      locations,
      data,
      totals
    };

    res.json(result);
  } catch (error) {
    console.error("Error in getSummaryTableData:", error);
    res.status(500).json({ message: "Failed to fetch summary table data", error: error.message });
  }
};

// Get summary data for reported students grouped by batch
const getReportedStudentsSummary = async (req, res) => {
  try {
    const summary = await sequelize.query(
      `SELECT Batch, COUNT(DISTINCT \`Student Cvue No.\`) as count, SUM(IFNULL(AccompanyWith, 0)) as totalAccompanied
       FROM studentdata
       WHERE Reported = 1
       GROUP BY Batch`,
      { type: QueryTypes.SELECT }
    );
    res.json(summary);
  } catch (error) {
    console.error("Error in getReportedStudentsSummary:", error);
    res.status(500).json({ message: "Failed to fetch reported students summary", error: error.message });
  }
};

// Get list of reported students with pagination and optional batch filter
const getReportedStudentsList = async (req, res) => {
  try {
    const { page = 1, limit = '100', batch } = req.query;
    const parsedLimit = parseInt(limit) || 100;
    const offset = (parseInt(page) - 1) * parsedLimit;

    let whereClause = { Reported: 1 };
    if (batch) {
      whereClause.Batch = batch;
    }

    const [students, total] = await Promise.all([
      StudentData.findAll({
        where: whereClause,
        attributes: ['StudentCvueNo', 'StudentName', 'Gender', 'Batch', 'AccompanyWith'],
        limit: parsedLimit,
        offset,
        raw: true,
      }),
      StudentData.count({ where: whereClause })
    ]);

    const result = {
      data: students.map(student => ({
        ...student,
        AccompanyWith: student.AccompanyWith || 0
      })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parsedLimit)
    };

    res.json(result);
  } catch (error) {
    console.error("Error in getReportedStudentsList:", error);
    res.status(500).json({ message: "Failed to fetch reported students list", error: error.message });
  }
};

module.exports = {
  getQueueCounts,
  getQueueList,
  getSummaryTableData,
  getReportedStudentsSummary,
  getReportedStudentsList
};
