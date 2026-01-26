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
      console.log(`Serving studentStatusData page ${page} from Redis cache`);
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
            { student_name: { [Sequelize.Op.like]: `%${search}%` } },
            { email_id: { [Sequelize.Op.like]: `%${search}%` } },
            { student_cvue_no: { [Sequelize.Op.like]: `%${search}%` } },
            { rc_name: { [Sequelize.Op.like]: `%${search}%` } },
            { house: { [Sequelize.Op.like]: `%${search}%` } },
            { housing_block: { [Sequelize.Op.like]: `%${search}%` } },
            { status: { [Sequelize.Op.like]: `%${search}%` } },
            { student_status: { [Sequelize.Op.like]: `%${search}%` } },
          ],
        });
      }
      if (studentStatus) {
        whereClause[Sequelize.Op.and].push({ student_status: studentStatus });
      }
    }
    const students = await StudentData.findAll({
      attributes: [
        ['student_name', 'StudentName'],
        ['email_id', 'EmailID'],
        ['student_cvue_no', 'StudentCvueNo'],
        ['rc_name', 'RCName'],
        ['house', 'House'],
        ['housing_block', 'HousingBlock'],
        ['status', 'Status'],
        ['student_status', 'StudentStatus'],
        ['withdrawn_date', 'WithDrawnDate'],
        ['withdrawn_reason', 'WithDrawnReason'],
        ['withdrawn_comment', 'WithDrawnComment'],
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
        ['student_status', 'StudentStatus'],
        [Sequelize.fn('COUNT', Sequelize.col('student_status')), 'count']
      ],
      group: ['student_status'],
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

    if (!StudentStatus || typeof StudentStatus !== 'string' || StudentStatus.trim() === '') {
      return res.status(400).json({ message: "StudentStatus is required and must be a non-empty string" });
    }

    const studentCvueNoInt = parseInt(StudentCvueNo, 10);
    if (isNaN(studentCvueNoInt)) {
      return res.status(400).json({ message: "Invalid StudentCvueNo" });
    }

    const student = await StudentData.findOne({ where: { student_cvue_no: studentCvueNoInt } });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const updateData = { student_status: StudentStatus };

    if (student.student_status === 'WITHDRAWAL COMPLETED' && ['ACTIVE', 'LOA', 'STUDY ABROAD'].includes(StudentStatus)) {
      updateData.withdrawn_date = null;
      updateData.withdrawn_reason = null;
      updateData.withdrawn_comment = null;
    } else if (StudentStatus === 'WITHDRAWAL COMPLETED') {
      updateData.withdrawn_date = WithDrawnDate;
      updateData.withdrawn_reason = WithDrawnReason;
      updateData.withdrawn_comment = WithDrawnComment;
    }

    const [updated] = await StudentData.update(updateData, {
      where: { student_cvue_no: studentCvueNoInt },
    });

    if (updated === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    await redisClient.del('studentStatusCounts');
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
