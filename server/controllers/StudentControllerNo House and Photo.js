const { getIo } = require('../socket');
const StudentData = require("../models/StudentData");
const { Sequelize, QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

// Get total student count
const getTotalStudentCount = async (req, res) => {
  try {
    const search = req.query.search || '';
    let whereClause = {};
    if (search) {
      whereClause = {
        [Sequelize.Op.or]: [
          { StudentName: { [Sequelize.Op.like]: `%${search}%` } },
          { EmailID: { [Sequelize.Op.like]: `%${search}%` } },
          { StudentCvueNo: { [Sequelize.Op.like]: `%${search}%` } },
          { RCName: { [Sequelize.Op.like]: `%${search}%` } },
          { HousingBlock: { [Sequelize.Op.like]: `%${search}%` } },
          { Status: { [Sequelize.Op.like]: `%${search}%` } },
          { INOUT: { [Sequelize.Op.like]: `%${search}%` } },
        ],
      };
    }

    const cachedKey = `totalStudentCount:search:${search}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log('Serving totalStudentCount from Redis cache');
      return res.json(JSON.parse(cachedData));
    }

    const result = await StudentData.count({ where: whereClause });
    const totalCount = { total: result };
    await redisClient.setEx(cachedKey, 600, JSON.stringify(totalCount));
    
    const io = getIo();
    io.emit('totalStudentCountUpdated', totalCount);
    
    res.json(totalCount);
  } catch (error) {
    console.error("Error in getTotalStudentCount:", error);
    res.status(500).json({ message: "Failed to fetch total student count", error: error.message });
  }
};

// Count students by gender and batch (structured for table)
const getGenderBatchCount = async (req, res) => {
  try {
    const cachedData = await redisClient.get('genderBatchCount');
    if (cachedData) {
      console.log('Serving genderBatchCount from Redis cache');
      return res.json(JSON.parse(cachedData));
    }

    const rawCounts = await sequelize.query(
      `SELECT Batch, Gender, COUNT(Gender) AS count 
       FROM studentdata 
       WHERE Batch IS NOT NULL AND Gender IS NOT NULL 
       GROUP BY Batch, Gender 
       ORDER BY Batch ASC`,
      { type: QueryTypes.SELECT }
    );

    const batches = [...new Set(rawCounts.map((item) => item.Batch))];
    const result = batches.map((batch) => {
      const female = rawCounts.find((r) => r.Batch === batch && r.Gender === "Female");
      const male = rawCounts.find((r) => r.Batch === batch && r.Gender === "Male");
      const femaleCount = female ? parseInt(female.count) : 0;
      const maleCount = male ? parseInt(male.count) : 0;
      return {
        batch,
        female: femaleCount,
        male: maleCount,
        total: femaleCount + maleCount,
      };
    });

    const grandTotal = result.reduce(
      (acc, curr) => ({
        female: acc.female + curr.female,
        male: acc.male + curr.male,
        total: acc.total + curr.total,
      }),
      { female: 0, male: 0, total: 0 }
    );

    const genderBatchData = { data: result, grandTotal };
    await redisClient.setEx('genderBatchCount', 600, JSON.stringify(genderBatchData));
    const io = getIo();
    io.emit('genderBatchCountUpdated', genderBatchData);
    res.json(genderBatchData);
  } catch (error) {
    console.error("Error in getGenderBatchCount:", error);
    res.status(500).json({ message: "Failed to fetch gender batch count", error: error.message });
  }
};

// Count students by city (HomeTown) with pagination
const getCityCount = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    const cachedData = await redisClient.get('cityCount');
    if (cachedData) {
      console.log('Serving cityCount from Redis cache');
      const allCities = JSON.parse(cachedData);
      const paginatedCities = allCities.slice(offset, offset + limit);
      return res.json(paginatedCities);
    }

    const counts = await sequelize.query(
      `SELECT HomeTown, COUNT(HomeTown) AS count 
       FROM studentdata 
       WHERE HomeTown IS NOT NULL 
       GROUP BY HomeTown 
       ORDER BY count DESC 
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { limit, offset },
        type: QueryTypes.SELECT,
      }
    );

    const formatted = counts.map((item) => ({
      homeTown: item.HomeTown || "Unknown",
      count: parseInt(item.count),
    }));

    const fullCounts = await sequelize.query(
      `SELECT HomeTown, COUNT(HomeTown) AS count 
       FROM studentdata 
       WHERE HomeTown IS NOT NULL 
       GROUP BY HomeTown 
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    const fullFormatted = fullCounts.map((item) => ({
      homeTown: item.HomeTown || 'Unknown',
      count: parseInt(item.count),
    }));
    await redisClient.setEx('cityCount', 600, JSON.stringify(fullFormatted));
    const io = getIo();
    io.emit('cityCountUpdated', fullFormatted);
    res.json(formatted);
  } catch (error) {
    console.error("Error in getCityCount:", error);
    res.status(500).json({ message: "Failed to fetch city count", error: error.message });
  }
};

// Get city with highest student count
const getCityWithHighestCount = async (req, res) => {
  try {
    const cachedData = await redisClient.get('cityWithHighestCount');
    if (cachedData) {
      console.log('Serving cityWithHighestCount from Redis cache');
      return res.json(JSON.parse(cachedData));
    }

    const [city] = await sequelize.query(
      `SELECT HomeTown, COUNT(HomeTown) AS count 
       FROM studentdata 
       WHERE HomeTown IS NOT NULL 
       GROUP BY HomeTown 
       ORDER BY count DESC 
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );

    const highestCity = city
      ? { homeTown: city.HomeTown || "Unknown", count: parseInt(city.count) }
      : { homeTown: "None", count: 0 };
    await redisClient.setEx('cityWithHighestCount', 600, JSON.stringify(highestCity));
    const io = getIo();
    io.emit('cityWithHighestCountUpdated', highestCity);
    res.json(highestCity);
  } catch (error) {
    console.error("Error in getCityWithHighestCount:", error);
    res.status(500).json({ message: "Failed to fetch city with highest count", error: error.message });
  }
};

// Count students by RC Name with pagination
const getRCCount = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    const cachedData = await redisClient.get('rcCount');
    if (cachedData) {
      console.log('Serving rcCount from Redis cache');
      const allRCs = JSON.parse(cachedData);
      const paginatedRCs = allRCs.slice(offset, offset + limit);
      return res.json(paginatedRCs);
    }

    const counts = await sequelize.query(
      `SELECT \`RC Name\` AS RCName, COUNT(\`RC Name\`) AS count 
       FROM studentdata 
       WHERE \`RC Name\` IS NOT NULL 
       GROUP BY \`RC Name\` 
       ORDER BY count DESC 
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { limit, offset },
        type: QueryTypes.SELECT,
      }
    );

    const formatted = counts.map((item) => ({
      rcName: item.RCName || 'Unknown',
      count: parseInt(item.count),
    }));

    const fullCounts = await sequelize.query(
      `SELECT \`RC Name\` AS RCName, COUNT(\`RC Name\`) AS count 
       FROM studentdata 
       WHERE \`RC Name\` IS NOT NULL 
       GROUP BY \`RC Name\` 
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    const fullFormatted = fullCounts.map((item) => ({
      rcName: item.RCName || 'Unknown',
      count: parseInt(item.count),
    }));
    await redisClient.setEx('rcCount', 600, JSON.stringify(fullFormatted));
    const io = getIo();
    io.emit('rcCountUpdated', fullFormatted);
    res.json(formatted);
  } catch (error) {
    console.error("Error in getRCCount:", error);
    res.status(500).json({ message: "Failed to fetch RC count", error: error.message });
  }
};

// Count students with non-null RCName
const getRCFilledCount = async (req, res) => {
  try {
    const cachedData = await redisClient.get('rcFilledCount');
    if (cachedData) {
      console.log('Serving rcFilledCount from Redis cache');
      return res.json(JSON.parse(cachedData));
    }

    const [result] = await sequelize.query(
      `SELECT COUNT(*) AS count 
       FROM studentdata 
       WHERE \`RC Name\` IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    const rcFilledCount = { total: parseInt(result.count) };
    await redisClient.setEx('rcFilledCount', 600, JSON.stringify(rcFilledCount));
    const io = getIo();
    io.emit('rcFilledCountUpdated', rcFilledCount);
    res.json(rcFilledCount);
  } catch (error) {
    console.error("Error in getRCFilledCount:", error);
    res.status(500).json({ message: "Failed to fetch RC filled count", error: error.message });
  }
};

// Count students by IN-OUT status
const getInOutCount = async (req, res) => {
  try {
    const cachedData = await redisClient.get('inOutCount');
    if (cachedData) {
      console.log('Serving inOutCount from Redis cache');
      return res.json(JSON.parse(cachedData));
    }

    const counts = await sequelize.query(
      `SELECT \`IN-OUT\` AS in_out, COUNT(\`IN-OUT\`) AS count 
       FROM studentdata 
       WHERE \`IN-OUT\` IS NOT NULL 
       GROUP BY \`IN-OUT\``,
      { type: QueryTypes.SELECT }
    );

    const formatted = counts.map((item) => ({
      inOut: item.in_out || "Unknown",
      count: parseInt(item.count),
    }));

    await redisClient.setEx('inOutCount', 600, JSON.stringify(formatted));
    const io = getIo();
    io.emit('inOutCountUpdated', formatted);
    res.json(formatted);
  } catch (error) {
    console.error("Error in getInOutCount:", error);
    res.status(500).json({ message: "Failed to fetch IN-OUT count", error: error.message });
  }
};

// Count students by IN-OUT status and batch
const getInOutBatchCount = async (req, res) => {
  try {
    const cachedData = await redisClient.get('inOutBatchCount');
    if (cachedData) {
      console.log('Serving inOutBatchCount from Redis cache');
      return res.json(JSON.parse(cachedData));
    }

    const rawCounts = await sequelize.query(
      `SELECT Batch, \`IN-OUT\` AS in_out, COUNT(\`IN-OUT\`) AS count 
       FROM studentdata 
       WHERE Batch IS NOT NULL AND \`IN-OUT\` IS NOT NULL 
       GROUP BY Batch, \`IN-OUT\` 
       ORDER BY Batch ASC`,
      { type: QueryTypes.SELECT }
    );

    const batches = [...new Set(rawCounts.map((item) => item.Batch))];
    const result = batches.map((batch) => {
      const inCount = rawCounts.find((r) => r.Batch === batch && r.in_out === "IN");
      const outCount = rawCounts.find((r) => r.Batch === batch && r.in_out === "OUT");
      const inValue = inCount ? parseInt(inCount.count) : 0;
      const outValue = outCount ? parseInt(outCount.count) : 0;
      return {
        batch,
        in: inValue,
        out: outValue,
        total: inValue + outValue,
      };
    });

    const grandTotal = result.reduce(
      (acc, curr) => ({
        in: acc.in + curr.in,
        out: acc.out + curr.out,
        total: acc.total + curr.total,
      }),
      { in: 0, out: 0, total: 0 }
    );

    const inOutBatchData = { data: result, grandTotal };
    await redisClient.setEx('inOutBatchCount', 600, JSON.stringify(inOutBatchData));
    const io = getIo();
    io.emit('inOutBatchCountUpdated', inOutBatchData);
    res.json(inOutBatchData);
  } catch (error) {
    console.error("Error in getInOutBatchCount:", error);
    res.status(500).json({ message: "Failed to fetch IN-OUT batch count", error: error.message });
  }
};

// Update RC Name for multiple students
const updateMultipleRC = async (req, res) => {
  const { studentIds, newRCName } = req.body;
  try {
    await StudentData.update(
      { RCName: newRCName },
      { where: { id: studentIds } }
    );
    // Clear relevant caches
    await redisClient.del([
      'rcCount',
      'rcFilledCount',
      'housingDetails:page:*',
      'allStudents:page:*',
    ]);
    const io = getIo();
    io.emit('rcDataUpdated', { message: 'RC data updated' });
    res.json({ message: "RC Names updated successfully" });
  } catch (error) {
    console.error("Error in updateMultipleRC:", error);
    res.status(500).json({ message: "Failed to update RC names", error: error.message });
  }
};

// Get all student data
const getAllStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const cachedData = await redisClient.get(`allStudents:page:${page}`);
    if (cachedData) {
      console.log(`Serving allStudents page ${page} from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    const students = await StudentData.findAll({
      raw: true,
      limit: 100,
      offset: (page - 1) * 100,
    });
    await redisClient.setEx(`allStudents:page:${page}`, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('allStudentsUpdated', { page, data: students });
    res.json(students);
  } catch (error) {
    console.error("Error in getAllStudents:", error);
    res.status(500).json({ message: "Failed to fetch all students", error: error.message });
  }
};

// Get student by ID
const getStudentById = async (req, res) => {
  try {
    const student = await StudentData.findByPk(req.params.id, { raw: true });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json(student);
  } catch (error) {
    console.error("Error in getStudentById:", error);
    res.status(500).json({ message: "Failed to fetch student", error: error.message });
  }
};

// Add a new student
const createStudent = async (req, res) => {
  try {
    const student = await StudentData.create(req.body);
    // Clear all relevant caches
    await redisClient.del([
      'totalStudentCount',
      'genderBatchCount',
      'cityCount',
      'cityWithHighestCount',
      'rcCount',
      'rcFilledCount',
      'inOutCount',
      'inOutBatchCount',
      'housingDetails:page:*',
      'parentsInfo:page:*',
      'studentInfo:page:*',
      'trackingInfo:page:*',
      'allStudents:page:*',
      'totalPages',
    ]);
    const io = getIo();
    io.emit('studentDataUpdated', { message: 'Student data updated' });
    res.status(201).json(student);
  } catch (error) {
    console.error("Error in createStudent:", error);
    res.status(500).json({ message: "Failed to create student", error: error.message });
  }
};

// Update a student by ID
const updateStudent = async (req, res) => {
  try {
    const [updated] = await StudentData.update(req.body, {
      where: { id: req.params.id },
    });
    if (updated === 0) {
      return res.status(404).json({ message: "Student not found" });
    }
    const updatedStudent = await StudentData.findByPk(req.params.id, { raw: true });
    // Clear all relevant caches
    await redisClient.del([
      'totalStudentCount',
      'genderBatchCount',
      'cityCount',
      'cityWithHighestCount',
      'rcCount',
      'rcFilledCount',
      'inOutCount',
      'inOutBatchCount',
      'housingDetails:page:*',
      'parentsInfo:page:*',
      'studentInfo:page:*',
      'trackingInfo:page:*',
      'allStudents:page:*',
      'totalPages',
    ]);
    const io = getIo();
    io.emit('studentDataUpdated', { message: 'Student data updated' });
    res.json(updatedStudent);
  } catch (error) {
    console.error("Error in updateStudent:", error);
    res.status(500).json({ message: "Failed to update student", error: error.message });
  }
};

// Delete a student by ID
const deleteStudent = async (req, res) => {
  try {
    const deleted = await StudentData.destroy({
      where: { id: req.params.id },
    });
    if (!deleted) {
      return res.status(404).json({ message: "Student not found" });
    }
    // Clear all relevant caches
    await redisClient.del([
      'totalStudentCount',
      'genderBatchCount',
      'cityCount',
      'cityWithHighestCount',
      'rcCount',
      'rcFilledCount',
      'inOutCount',
      'inOutBatchCount',
      'housingDetails:page:*',
      'parentsInfo:page:*',
      'studentInfo:page:*',
      'trackingInfo:page:*',
      'allStudents:page:*',
      'totalPages',
    ]);
    const io = getIo();
    io.emit('studentDataUpdated', { message: 'Student data updated' });
    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error in deleteStudent:", error);
    res.status(500).json({ message: "Failed to delete student", error: error.message });
  }
};

// Get all student data in terms of Parents Info
const getParentsInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const cachedData = await redisClient.get(`parentsInfo:page:${page}`);
    if (cachedData) {
      console.log(`Serving parentsInfo page ${page} from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    const students = await StudentData.findAll({
      attributes: [
        "StudentName",
        "EmailID",
        "StudentCvueNo",
        "FatherName",
        'FatherEmailID',
        "FatherMobileNo",
        "MotherName",
        'MotherEmailID',
        "MotherMobileNo",
      ],
      raw: true,
      limit: 100,
      offset: (page - 1) * 100,
    });
    await redisClient.setEx(`parentsInfo:page:${page}`, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('parentsInfoUpdated', { page, data: students });
    res.json(students);
  } catch (error) {
    console.error("Error in getParentsInfo:", error);
    res.status(500).json({ message: "Failed to fetch parents info", error: error.message });
  }
};

// Get all student data in terms of Student Info
const getStudentInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const cachedData = await redisClient.get(`studentInfo:page:${page}`);
    if (cachedData) {
      console.log(`Serving studentInfo page ${page} from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    const students = await StudentData.findAll({
      attributes: [
        "StudentName",
        "EmailID",
        "Batch",
        "Gender",
        "DOB",
        "ContactNo",
        "HomeTown",
        "StudentCvueNo",
      ],
      raw: true,
      limit: 100,
      offset: (page - 1) * 100,
    });
    await redisClient.setEx(`studentInfo:page:${page}`, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('studentInfoUpdated', { page, data: students });
    res.json(students);
  } catch (error) {
    console.error("Error in getStudentInfo:", error);
    res.status(500).json({ message: "Failed to fetch student info", error: error.message });
  }
};

// Get all student data in terms of Housing Details
const getHousingDetails = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = 100;
    const offset = (page - 1) * limit;

    const cachedKey = `housingDetails:page:${page}:search:${search}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving housingDetails page ${page} with search "${search}" from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    let whereClause = {};
    if (search) {
      whereClause = {
        [Sequelize.Op.or]: [
          { StudentName: { [Sequelize.Op.like]: `%${search}%` } },
          { EmailID: { [Sequelize.Op.like]: `%${search}%` } },
          { StudentCvueNo: { [Sequelize.Op.like]: `%${search}%` } },
          { RCName: { [Sequelize.Op.like]: `%${search}%` } },
          { HousingBlock: { [Sequelize.Op.like]: `%${search}%` } },
          { Status: { [Sequelize.Op.like]: `%${search}%` } },
          { INOUT: { [Sequelize.Op.like]: `%${search}%` } },
        ],
      };
    }

    const students = await StudentData.findAll({
      attributes: [
        'id',
        'StudentName',
        'EmailID',
        'StudentCvueNo',
        'RCName',
        'HousingBlock',
        'Status',
        'NoOfDays',
        'INOUT',
      ],
      where: whereClause,
      raw: true,
      limit,
      offset,
    });

    await redisClient.setEx(cachedKey, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('housingDetailsUpdated', { page, search, data: students });
    res.json(students);
  } catch (error) {
    console.error('Error in getHousingDetails:', error);
    res.status(500).json({ message: 'Failed to fetch housing details', error: error.message });
  }
};

// Get all student data in terms of Tracking
const getTrackingInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const cachedData = await redisClient.get(`trackingInfo:page:${page}`);
    if (cachedData) {
      console.log(`Serving trackingInfo page ${page} from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    const students = await StudentData.findAll({
      attributes: [
        'StudentName',
        'StudentCvueNo',
        'EmailID',
        'INOUT',
        'NoOfDays',
        'DeviceName',
        'LastPunchDate',
        'DeviceId',
      ],
      raw: true,
      limit: 100,
      offset: (page - 1) * 100,
    });
    await redisClient.setEx(`trackingInfo:page:${page}`, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('trackingInfoUpdated', { page, data: students });
    res.json(students);
  } catch (error) {
    console.error('Error in getTrackingInfo:', error);
    res.status(500).json({ message: 'Failed to fetch tracking info', error: error.message });
  }
};

// In your studentController.js
const getBatches = async (req, res) => {
  try {
    const batches = await sequelize.query(
      `SELECT DISTINCT Batch FROM studentdata WHERE Batch IS NOT NULL ORDER BY Batch ASC`,
      { type: QueryTypes.SELECT }
    );
    res.json(batches.map(b => b.Batch));
  } catch (error) {
    console.error("Error in getBatches:", error);
    res.status(500).json({ 
      message: "Failed to fetch batches", 
      error: error.message 
    });
  }
};

// Get distinct RC names
const getRCNames = async (req, res) => {
  try {
    const rcNames = await sequelize.query(
      `SELECT DISTINCT \`RC Name\` AS RCName FROM studentdata WHERE \`RC Name\` IS NOT NULL ORDER BY \`RC Name\` ASC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rcNames.map(r => r.RCName));
  } catch (error) {
    console.error("Error in getRCNames:", error);
    res.status(500).json({ message: "Failed to fetch RC names", error: error.message });
  }
};

module.exports = {
  getTotalStudentCount,
  getGenderBatchCount,
  getCityCount,
  getCityWithHighestCount,
  getRCCount,
  getRCFilledCount,
  getInOutCount,
  getInOutBatchCount,
  updateMultipleRC,
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getParentsInfo,
  getStudentInfo,
  getHousingDetails,
  getTrackingInfo,
  getBatches,
  getRCNames,
};