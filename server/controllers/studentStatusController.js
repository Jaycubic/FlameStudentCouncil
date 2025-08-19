const { getIo } = require('../socket');
const StudentData = require("../models/StudentData");
const { Sequelize } = require("sequelize");
const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

// Get student status data
const getStudentStatusData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const studentStatus = req.query.studentStatus || '';
    const limit = 100;
    const offset = (page - 1) * limit;
    const cachedKey = `studentStatusData:page:${page}:search:${search}:studentStatus:${studentStatus}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving studentStatusData page ${page} with search "${search}" and studentStatus "${studentStatus}" from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }
    let whereClause = {};
    if (search || studentStatus) {
      whereClause = {
        [Sequelize.Op.and]: [],
      };
      if (search) {
        whereClause[Sequelize.Op.and].push({
          [Sequelize.Op.or]: [
            { StudentName: { [Sequelize.Op.like]: `%${search}%` } },
            { EmailID: { [Sequelize.Op.like]: `%${search}%` } },
            { StudentCvueNo: { [Sequelize.Op.like]: `%${search}%` } },
            { RCName: { [Sequelize.Op.like]: `%${search}%` } },
            { House: { [Sequelize.Op.like]: `%${search}%` } },
            { HousingBlock: { [Sequelize.Op.like]: `%${search}%` } },
            { Status: { [Sequelize.Op.like]: `%${search}%` } },
            { StudentStatus: { [Sequelize.Op.like]: `%${search}%` } },
          ],
        });
      }
      if (studentStatus) {
        whereClause[Sequelize.Op.and].push({ StudentStatus: studentStatus });
      }
    }
    const students = await StudentData.findAll({
      attributes: [
        'StudentName',
        'EmailID',
        'StudentCvueNo',
        'RCName',
        'House',
        'HousingBlock',
        'Status',
        'StudentStatus',
        'WithDrawnDate',
        'WithDrawnReason',
        'WithDrawnComment',
      ],
      where: whereClause,
      raw: true,
      limit,
      offset,
    });
    await redisClient.setEx(cachedKey, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('studentStatusDataUpdated', { page, search, studentStatus, data: students });
    res.json(students);
  } catch (error) {
    console.error('Error in getStudentStatusData:', error);
    res.status(500).json({ message: 'Failed to fetch student status data', error: error.message });
  }
};

// Get student status counts
const getStudentStatusCounts = async (req, res) => {
  try {
    const cachedKey = 'studentStatusCounts';
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log('Serving studentStatusCounts from Redis cache');
      return res.json(JSON.parse(cachedData));
    }
    const counts = await StudentData.findAll({
      attributes: [
        'StudentStatus',
        [Sequelize.fn('COUNT', Sequelize.col('StudentStatus')), 'count']
      ],
      group: ['StudentStatus'],
      raw: true,
    });
    const statusCounts = {
      ACTIVE: 0,
      LOA: 0,
      'STUDY ABROAD': 0,
      'WITHDRAWAL COMPLETED': 0,
    };
    counts.forEach(item => {
      if (item.StudentStatus in statusCounts) {
        statusCounts[item.StudentStatus] = parseInt(item.count);
      }
    });
    await redisClient.setEx(cachedKey, 600, JSON.stringify(statusCounts));
    res.json(statusCounts);
  } catch (error) {
    console.error('Error in getStudentStatusCounts:', error);
    res.status(500).json({ message: 'Failed to fetch student status counts', error: error.message });
  }
};

// Update student status
const updateStudentStatus = async (req, res) => {
  try {
    const { StudentCvueNo } = req.params;
    const { StudentStatus, WithDrawnDate, WithDrawnReason, WithDrawnComment } = req.body;

    // Validate StudentStatus
    if (!StudentStatus || typeof StudentStatus !== 'string' || StudentStatus.trim() === '') {
      return res.status(400).json({ message: "StudentStatus is required and must be a non-empty string" });
    }

    // Parse StudentCvueNo to integer
    const studentCvueNoInt = parseInt(StudentCvueNo, 10);
    if (isNaN(studentCvueNoInt)) {
      return res.status(400).json({ message: "Invalid StudentCvueNo" });
    }

    // Fetch current student data
    const student = await StudentData.findOne({ where: { StudentCvueNo: studentCvueNoInt } });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const updateData = { StudentStatus };

    // Check if previous status was WITHDRAWAL COMPLETED and new status is ACTIVE, LOA, or STUDY ABROAD
    if (student.StudentStatus === 'WITHDRAWAL COMPLETED' && ['ACTIVE', 'LOA', 'STUDY ABROAD'].includes(StudentStatus)) {
      updateData.WithDrawnDate = null;
      updateData.WithDrawnReason = null;
      updateData.WithDrawnComment = null;
    } else if (StudentStatus === 'WITHDRAWAL COMPLETED') {
      updateData.WithDrawnDate = WithDrawnDate;
      updateData.WithDrawnReason = WithDrawnReason;
      updateData.WithDrawnComment = WithDrawnComment;
    }

    // Log the update attempt
    console.log(`Updating StudentCvueNo: ${studentCvueNoInt} with data:`, updateData);

    const [updated] = await StudentData.update(updateData, {
      where: { StudentCvueNo: studentCvueNoInt },
    });

    // Log the result
    console.log(`Rows updated: ${updated}`);

    if (updated === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    await redisClient.del('studentStatusCounts'); // Invalidate counts cache
    const io = getIo();
    io.emit('studentStatusUpdated', { StudentCvueNo: studentCvueNoInt, ...updateData });
    res.json({ message: "Student status updated successfully" });
  } catch (error) {
    console.error('Error in updateStudentStatus:', error);
    res.status(500).json({ message: 'Failed to update student status', error: error.message });
  }
};

module.exports = {
  getStudentStatusData,
  getStudentStatusCounts,
  updateStudentStatus,
};
