const StudentData = require("../models/StudentData");
const { Sequelize, QueryTypes } = require("sequelize");
const redis = require('redis');
const { getIo } = require('../socket');
require('dotenv').config();

// Initialize Redis client
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

const getReportData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const batch = req.query.batch || '';
    const limit = 100;
    const offset = (page - 1) * limit;

    // Create cache key based on query parameters
    const cachedKey = `reportData:page:${page}:search:${search}:batch:${batch}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving reportData page ${page} from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    let whereClause = {};
    if (search || batch) {
      whereClause = {
        [Sequelize.Op.and]: [],
      };

      if (search) {
        whereClause[Sequelize.Op.and].push({
          [Sequelize.Op.or]: [
	    { StudentCvueNo: { [Sequelize.Op.like]: `%${search}%` } },
            { StudentName: { [Sequelize.Op.like]: `%${search}%` } },
            { EmailID: { [Sequelize.Op.like]: `%${search}%` } },
            { Batch: { [Sequelize.Op.like]: `%${search}%` } },
          ],
        });
      }

      if (batch) {
        whereClause[Sequelize.Op.and].push({ Batch: batch });
      }
    }

    const students = await StudentData.findAll({
      attributes: [
        "id",
        "StudentName",
        "EmailID",
        "Batch",
        "Gender",
        "DOB",
        "HomeTown",
        "Photo",
        "StudentCvueNo",
        "Reported",
        "AccompanyWith",
      ],
      where: whereClause,
      raw: true,
      limit,
      offset,
    });

    const total = await StudentData.count({ where: whereClause });

    const response = { students, total };
    await redisClient.setEx(cachedKey, 600, JSON.stringify(response));
    const io = getIo();
    io.emit('reportDataUpdated', { page, search, batch, data: response });

    res.json(response);
  } catch (error) {
    console.error("Error in getReportData:", error);
    res.status(500).json({ message: "Failed to fetch report data", error: error.message });
  }
};

const updateReportData = async (req, res) => {
  const { id } = req.params;
  const { Reported, AccompanyWith } = req.body;
  try {
    const student = await StudentData.findByPk(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    student.Reported = Reported;
    student.AccompanyWith = AccompanyWith;
    await student.save();

    // Clear relevant caches
    await redisClient.del([
      'reportData:page:*',
      'totalStudentCount',
      'studentInfo:page:*',
      'allStudents:page:*',
    ]);
    const io = getIo();
    io.emit('reportDataUpdated', { message: 'Report data updated' });

    res.json({ message: "Report data updated successfully" });
  } catch (error) {
    console.error("Error in updateReportData:", error);
    res.status(500).json({ message: "Failed to update report data", error: error.message });
  }
};

module.exports = { getReportData, updateReportData };
