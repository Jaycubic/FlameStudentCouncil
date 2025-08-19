const { getIo } = require('../socket');
const StudentData = require("../models/StudentData");
const { Sequelize, QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const redis = require('redis');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
require('dotenv').config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

// Multer configuration for photo upload
const upload = multer({
  dest: '/opt/View/StudentTrackingSystem/server/Photos',
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only .jpg and .jpeg files are allowed'));
    }
    cb(null, true);
  }
});

// Get total student count
const getTotalStudentCount = async (req, res) => {
  try {
    const search = req.query.search || '';
    const batch = req.query.batch || '';
    const gender = req.query.gender || '';

    let whereClause = {};
    if (search || batch || gender) {
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
            { HousingBlock: { [Sequelize.Op.like]: `%${search}%` } },
            { Status: { [Sequelize.Op.like]: `%${search}%` } },
            { INOUT: { [Sequelize.Op.like]: `%${search}%` } },
          ],
        });
      }

      if (batch) {
        whereClause[Sequelize.Op.and].push({ Batch: batch });
      }

      if (gender) {
        whereClause[Sequelize.Op.and].push({ Gender: gender });
      }
    }

    const cachedKey = `totalStudentCount:search:${search}:batch:${batch}:gender:${gender}`;
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

    const statusCounts = {
      IN: 0,
      OUT: 0,
      'NO PUNCH': 0,
    };

    counts.forEach((item) => {
      if (item.in_out in statusCounts) {
        statusCounts[item.in_out] = parseInt(item.count);
      }
    });

    const formatted = Object.entries(statusCounts).map(([inOut, count]) => ({
      inOut,
      count,
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
      const noPunchCount = rawCounts.find((r) => r.Batch === batch && r.in_out === "NO PUNCH");
      const inValue = inCount ? parseInt(inCount.count) : 0;
      const outValue = outCount ? parseInt(outCount.count) : 0;
      const noPunchValue = noPunchCount ? parseInt(noPunchCount.count) : 0;
      return {
        batch,
        in: inValue,
        out: outValue,
        noPunch: noPunchValue,
        total: inValue + outValue + noPunchValue,
      };
    });

    const grandTotal = result.reduce(
      (acc, curr) => ({
        in: acc.in + curr.in,
        out: acc.out + curr.out,
        noPunch: acc.noPunch + curr.noPunch,
        total: acc.total + curr.total,
      }),
      { in: 0, out: 0, noPunch: 0, total: 0 }
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
// ... (other imports and code remain unchanged)
const updateStudent = async (req, res) => {
  try {
    // Try to get studentId from req.params.id, fallback to req.body.id
    let studentId = parseInt(req.params.id);
    if (isNaN(studentId) && req.body.id) {
      studentId = parseInt(req.body.id);
    }
    console.log(`Attempting to update student with ID: ${studentId}`);
    console.log(`Request body: ${JSON.stringify(req.body)}`);
    
    // Validate studentId
    if (!studentId || isNaN(studentId)) {
      console.error('Invalid student ID:', req.params.id, 'or body ID:', req.body.id);
      return res.status(400).json({ message: "Invalid student ID" });
    }

    // Validate update data
    const allowedFields = [
      'HomeTown',
      'ContactNo',
      'FatherName',
      'FatherEmailID',
      'FatherMobileNo',
      'MotherName',
      'MotherEmailID',
      'MotherMobileNo',
      'RCName',
      'HousingBlock',
      'Status'
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        updateData[field] = req.body[field]; // Store as-is, since mobile numbers are VARCHAR
      }
    }

    if (Object.keys(updateData).length === 0) {
      console.error('No valid fields provided for update:', req.body);
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    // Check if student exists
    const studentExists = await StudentData.findByPk(studentId, { raw: true });
    if (!studentExists) {
      console.error(`Student with ID ${studentId} not found in database`);
      return res.status(404).json({ message: "Student not found" });
    }

    // Log current values for comparison
    console.log(`Current student data: ${JSON.stringify({
      HomeTown: studentExists.HomeTown,
      ContactNo: studentExists.ContactNo,
      FatherName: studentExists.FatherName,
      FatherEmailID: studentExists.FatherEmailID,
      FatherMobileNo: studentExists.FatherMobileNo,
      MotherName: studentExists.MotherName,
      MotherEmailID: studentExists.MotherEmailID,
      MotherMobileNo: studentExists.MotherMobileNo,
      RCName: studentExists.RCName,
      HousingBlock: studentExists.HousingBlock,
      Status: studentExists.Status
    })}`);
    console.log(`Update data: ${JSON.stringify(updateData)}`);

    // Check if data has changed
    let hasChanges = false;
    for (const [key, value] of Object.entries(updateData)) {
      if (studentExists[key] !== value) {
        hasChanges = true;
        console.log(`Change detected in ${key}: ${studentExists[key]} -> ${value}`);
      }
    }

    if (!hasChanges) {
      console.log(`No changes detected for student ID: ${studentId}`);
      return res.status(400).json({ message: "No changes to apply" });
    }

    // Perform the update with explicit transaction
    const result = await sequelize.transaction(async (t) => {
      const [updated] = await StudentData.update(updateData, {
        where: { id: studentId },
        individualHooks: true,
        performedBy: req.user?.userId || 'unknown',
        transaction: t
      });
      return updated;
    });

    if (result === 0) {
      console.error(`No rows updated for student ID: ${studentId}. Possible reasons: Data unchanged, database constraints, or locking issue.`);
      // Try direct SQL update for debugging
      try {
        const replacements = { id: studentId, ...updateData };
        const setClause = Object.keys(updateData)
          .map(field => `\`${field}\` = :${field}`)
          .join(', ');
        const [sqlResult] = await sequelize.query(
          `UPDATE studentdata SET ${setClause} WHERE id = :id`,
          {
            replacements,
            type: QueryTypes.UPDATE,
            transaction: null
          }
        );
        console.log(`Direct SQL update result: ${sqlResult} rows affected`);
        if (sqlResult === 0) {
          console.error(`Direct SQL update failed for ID: ${studentId}`);
          return res.status(400).json({ message: "Update failed. Possible database constraint or locking issue." });
        }
      } catch (sqlError) {
        console.error(`Direct SQL update error: ${sqlError.message}`);
        return res.status(500).json({ message: "Update failed due to database error", error: sqlError.message });
      }
    }

    const updatedStudent = await StudentData.findByPk(studentId, { raw: true });
    console.log(`Student updated successfully: ${JSON.stringify(updatedStudent)}`);

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
    io.emit('studentDataUpdated', { message: 'Student data updated', studentId });
    res.json(updatedStudent);
  } catch (error) {
    console.error("Error in updateStudent:", error);
    res.status(500).json({ message: "Failed to update student", error: error.message });
  }
};
// ... (rest of StudentController.js remains unchanged)


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

// Get all student data in terms of Parents Info with search
const getParentsInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = 100;
    const offset = (page - 1) * limit;

    const cachedKey = `parentsInfo:page:${page}:search:${search}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving parentsInfo page ${page} with search "${search}" from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    let whereClause = {};
    if (search) {
      whereClause = {
        [Sequelize.Op.or]: [
          { StudentName: { [Sequelize.Op.like]: `%${search}%` } },
          { EmailID: { [Sequelize.Op.like]: `%${search}%` } },
          { StudentCvueNo: { [Sequelize.Op.like]: `%${search}%` } },
          { FatherName: { [Sequelize.Op.like]: `%${search}%` } },
          { MotherName: { [Sequelize.Op.like]: `%${search}%` } },
        ],
      };
    }

    const students = await StudentData.findAll({
      attributes: [
        "id",
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
      where: whereClause,
      raw: true,
      limit,
      offset,
    });

    await redisClient.setEx(cachedKey, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('parentsInfoUpdated', { page, search, data: students });
    res.json(students);
  } catch (error) {
    console.error("Error in getParentsInfo:", error);
    res.status(500).json({ message: "Failed to fetch parents info", error: error.message });
  }
};


const getStudentInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const batch = req.query.batch || '';
    const gender = req.query.gender || '';
    const limit = 100;
    const offset = (page - 1) * limit;

    const cachedKey = `studentInfo:page:${page}:search:${search}:batch:${batch}:gender:${gender}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving studentInfo page ${page} with search "${search}", batch "${batch}", gender "${gender}" from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    let whereClause = {};
    if (search || batch || gender) {
      whereClause = {
        [Sequelize.Op.and]: [],
      };

      if (search) {
        whereClause[Sequelize.Op.and].push({
          [Sequelize.Op.or]: [
            { StudentName: { [Sequelize.Op.like]: `%${search}%` } },
            { EmailID: { [Sequelize.Op.like]: `%${search}%` } },
            { Batch: { [Sequelize.Op.like]: `%${search}%` } },
            { Gender: { [Sequelize.Op.like]: `%${search}%` } },
            { HomeTown: { [Sequelize.Op.like]: `%${search}%` } },
            { House: { [Sequelize.Op.like]: `%${search}%` } },
            { StudentCvueNo: { [Sequelize.Op.like]: `%${search}%` } },
          ],
        });
      }

      if (batch) {
        whereClause[Sequelize.Op.and].push({ Batch: batch });
      }

      if (gender) {
        whereClause[Sequelize.Op.and].push({ Gender: gender });
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
        "ContactNo",
        "HomeTown",
        "House",
        "Photo",
        "StudentCvueNo",
        "FatherName",
        "FatherEmailID",
        "FatherMobileNo",
        "MotherName",
        "MotherEmailID",
        "MotherMobileNo",
        "BloodGroup"
      ],
      where: whereClause,
      raw: true,
      limit,
      offset,
    });

    await redisClient.setEx(cachedKey, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('studentInfoUpdated', { page, search, batch, gender, data: students });
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
    const rcName = req.query.rcName || '';
    const limit = 100;
    const offset = (page - 1) * limit;

    const cachedKey = `housingDetails:page:${page}:search:${search}:rcName:${rcName}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving housingDetails page ${page} with search "${search}" and rcName "${rcName}" from Redis cache`);
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
          { House: { [Sequelize.Op.like]: `%${search}%` } },
        ],
      };
    }
    if (rcName) {
      whereClause.RCName = rcName;
    }

    const students = await StudentData.findAll({
      attributes: [
        'id',
        'StudentName',
        'EmailID',
        'StudentCvueNo',
        'RCName',
        'House',
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
    io.emit('housingDetailsUpdated', { page, search, rcName, data: students });
    res.json(students);
  } catch (error) {
    console.error('Error in getHousingDetails:', error);
    res.status(500).json({ message: 'Failed to fetch housing details', error: error.message });
  }
};

// Get all student data in terms of Tracking with search
const getTrackingInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = 100;
    const offset = (page - 1) * limit;

    const cachedKey = `trackingInfo:page:${page}:search:${search}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving trackingInfo page ${page} with search "${search}" from Redis cache`);
      return res.json(JSON.parse(cachedData));
    }

    let whereClause = {};
    if (search) {
      whereClause = {
        [Sequelize.Op.or]: [
          { StudentName: { [Sequelize.Op.like]: `%${search}%` } },
          { StudentCvueNo: { [Sequelize.Op.like]: `%${search}%` } },
          { EmailID: { [Sequelize.Op.like]: `%${search}%` } },
          { INOUT: { [Sequelize.Op.like]: `%${search}%` } },
          { DeviceName: { [Sequelize.Op.like]: `%${search}%` } },
        ],
      };
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
      where: whereClause,
      raw: true,
      limit,
      offset,
    });

    await redisClient.setEx(cachedKey, 600, JSON.stringify(students));
    const io = getIo();
    io.emit('trackingInfoUpdated', { page, search, data: students });
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

// Get student photo based on Photo column
const getStudentPhoto = async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const photoDir = '/opt/View/StudentTrackingSystem/server/Photos';
    const extensions = ['.jpg', '.jpeg', '.png'];

    for (const ext of extensions) {
      const filePath = path.join(photoDir, `${photoId}${ext}`);
      try {
        await fs.access(filePath);
        return res.sendFile(filePath);
      } catch (error) {
        // File not found, try next extension
      }
    }

    res.status(404).json({ message: 'No Photo available' });
  } catch (error) {
    console.error('Error in getStudentPhoto:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Upload student photo
const uploadStudentPhoto = async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const newFileName = `${photoId}${path.extname(file.originalname)}`;
    const newFilePath = path.join('/opt/View/StudentTrackingSystem/server/Photos', newFileName);

    await fs.rename(file.path, newFilePath);
    console.log(`Photo uploaded successfully: ${newFilePath}`);
    res.json({ message: 'Photo uploaded successfully' });
  } catch (error) {
    console.error('Error in uploadStudentPhoto:', error);
    res.status(500).json({ message: 'Failed to upload photo', error: error.message });
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
  getStudentPhoto,
  uploadStudentPhoto,
};
