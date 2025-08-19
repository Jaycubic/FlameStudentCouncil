const StudentData = require("../models/StudentData");
const redis = require('redis');

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

const getStudentsByIdsForPDF = async (studentCvueNos) => {
  try {
    console.log('Fetching students for StudentCvueNo:', studentCvueNos);
    const cachedKey = `studentsForPDF:cvue:${studentCvueNos.join(',')}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving students for StudentCvueNo from Redis cache`);
      return JSON.parse(cachedData);
    }

    const students = await StudentData.findAll({
      attributes: ['StudentName', 'StudentCvueNo', 'Batch', 'DOB', 'Photo', 'BloodGroup', 'Validity'],
      where: { StudentCvueNo: studentCvueNos },
      raw: true,
    });

    console.log('Database query returned students:', students);

    const formattedStudents = students.map(student => ({
      ...student,
      Batch: student.Batch ? student.Batch.slice(0, 2) : 'NA',
    }));

    if (formattedStudents.length > 0) {
      await redisClient.setEx(cachedKey, 600, JSON.stringify(formattedStudents));
      console.log('Cached students for key:', cachedKey);
    } else {
      console.log('No students found, skipping cache');
    }

    return formattedStudents;
  } catch (error) {
    console.error('Error in getStudentsByIdsForPDF:', error);
    throw error;
  }
};

module.exports = {
  getStudentsByIdsForPDF,
};
