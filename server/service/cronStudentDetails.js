const cron = require('node-cron');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/connection');
const StudentData = require('../models/StudentData');
const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

async function cacheStudentDetails(io) {
  try {
    console.log('Caching student details...');

    // Pagination settings
    const PAGE_SIZE = 100;

    // Total Student Count
    const [totalCountResult] = await sequelize.query(
      'SELECT COUNT(*) AS count FROM app.student_data',
      { type: QueryTypes.SELECT }
    );
    const totalCount = { total: parseInt(totalCountResult.count) };
    await redisClient.setEx('totalStudentCount', 600, JSON.stringify(totalCount));
    io.emit('totalStudentCountUpdated', totalCount);
    console.log('Cached totalStudentCount:', totalCount);

    // Gender Batch Count
    const genderBatchCounts = await sequelize.query(
      `SELECT batch, gender, COUNT(gender) AS count 
       FROM app.student_data 
       WHERE batch IS NOT NULL AND gender IS NOT NULL 
       GROUP BY batch, gender 
       ORDER BY batch ASC`,
      { type: QueryTypes.SELECT }
    );
    const batches = [...new Set(genderBatchCounts.map((item) => item.batch))];
    const genderBatchResult = batches.map((batch) => {
      const female = genderBatchCounts.find((r) => r.batch === batch && r.gender === 'Female');
      const male = genderBatchCounts.find((r) => r.batch === batch && r.gender === 'Male');
      const femaleCount = female ? parseInt(female.count) : 0;
      const maleCount = male ? parseInt(male.count) : 0;
      return { batch, female: femaleCount, male: maleCount, total: femaleCount + maleCount };
    });
    const genderBatchGrandTotal = genderBatchResult.reduce(
      (acc, curr) => ({
        female: acc.female + curr.female,
        male: acc.male + curr.male,
        total: acc.total + curr.total,
      }),
      { female: 0, male: 0, total: 0 }
    );
    const genderBatchData = { data: genderBatchResult, grandTotal: genderBatchGrandTotal };
    await redisClient.setEx('genderBatchCount', 600, JSON.stringify(genderBatchData));
    io.emit('genderBatchCountUpdated', genderBatchData);
    console.log('Cached genderBatchCount:', { dataCount: genderBatchResult.length });

    // City Count (Full)
    const cityCounts = await sequelize.query(
      `SELECT home_town, COUNT(home_town) AS count 
       FROM app.student_data 
       WHERE home_town IS NOT NULL 
       GROUP BY home_town 
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    const formattedCityCounts = cityCounts.map((item) => ({
      homeTown: item.home_town || 'Unknown',
      count: parseInt(item.count),
    }));
    await redisClient.setEx('cityCount', 600, JSON.stringify(formattedCityCounts));
    io.emit('cityCountUpdated', formattedCityCounts);
    console.log('Cached cityCount:', { count: formattedCityCounts.length });

    // City with Highest Count
    const [highestCity] = await sequelize.query(
      `SELECT home_town, COUNT(home_town) AS count 
       FROM app.student_data 
       WHERE home_town IS NOT NULL 
       GROUP BY home_town 
       ORDER BY count DESC 
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    const highestCityData = highestCity
      ? { homeTown: highestCity.home_town || 'Unknown', count: parseInt(highestCity.count) }
      : { homeTown: 'None', count: 0 };
    await redisClient.setEx('cityWithHighestCount', 600, JSON.stringify(highestCityData));
    io.emit('cityWithHighestCountUpdated', highestCityData);
    console.log('Cached cityWithHighestCount:', highestCityData);

    // RC Count (Full)
    const rcCounts = await sequelize.query(
      `SELECT rc_name AS rcName, COUNT(rc_name) AS count 
       FROM app.student_data 
       WHERE rc_name IS NOT NULL 
       GROUP BY rc_name 
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    const formattedRCCounts = rcCounts.map((item) => ({
      rcName: item.rcname,
      count: parseInt(item.count),
    }));
    await redisClient.setEx('rcCount', 600, JSON.stringify(formattedRCCounts));
    io.emit('rcCountUpdated', formattedRCCounts);
    console.log('Cached rcCount:', { count: formattedRCCounts.length });

    // RC Filled Count
    const [rcFilledResult] = await sequelize.query(
      `SELECT COUNT(*) AS count 
       FROM app.student_data 
       WHERE rc_name IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    const rcFilledCount = { total: parseInt(rcFilledResult.count) };
    await redisClient.setEx('rcFilledCount', 600, JSON.stringify(rcFilledCount));
    io.emit('rcFilledCountUpdated', rcFilledCount);
    console.log('Cached rcFilledCount:', rcFilledCount);

    // IN-OUT Count
    const inOutCounts = await sequelize.query(
      `SELECT in_out, COUNT(in_out) AS count 
       FROM app.student_data 
       WHERE in_out IS NOT NULL 
       GROUP BY in_out`,
      { type: QueryTypes.SELECT }
    );
    const formattedInOutCounts = inOutCounts.map((item) => ({
      inOut: item.in_out || 'Unknown',
      count: parseInt(item.count),
    }));
    await redisClient.setEx('inOutCount', 600, JSON.stringify(formattedInOutCounts));
    io.emit('inOutCountUpdated', formattedInOutCounts);
    console.log('Cached inOutCount:', { count: formattedInOutCounts.length });

    // IN-OUT Batch Count
    const inOutBatchCounts = await sequelize.query(
      `SELECT batch, in_out, COUNT(in_out) AS count 
       FROM app.student_data 
       WHERE batch IS NOT NULL AND in_out IS NOT NULL 
       GROUP BY batch, in_out 
       ORDER BY batch ASC`,
      { type: QueryTypes.SELECT }
    );
    const inOutBatches = [...new Set(inOutBatchCounts.map((item) => item.batch))];
    const inOutBatchResult = inOutBatches.map((batch) => {
      const inCount = inOutBatchCounts.find((r) => r.batch === batch && r.in_out === 'IN');
      const outCount = inOutBatchCounts.find((r) => r.batch === batch && r.in_out === 'OUT');
      const inValue = inCount ? parseInt(inCount.count) : 0;
      const outValue = outCount ? parseInt(outCount.count) : 0;
      return { batch, in: inValue, out: outValue, total: inValue + outValue };
    });
    const inOutBatchGrandTotal = inOutBatchResult.reduce(
      (acc, curr) => ({
        in: acc.in + curr.in,
        out: acc.out + curr.out,
        total: acc.total + curr.total,
      }),
      { in: 0, out: 0, total: 0 }
    );
    const inOutBatchData = { data: inOutBatchResult, grandTotal: inOutBatchGrandTotal };
    await redisClient.setEx('inOutBatchCount', 600, JSON.stringify(inOutBatchData));
    io.emit('inOutBatchCountUpdated', inOutBatchData);
    console.log('Cached inOutBatchCount:', { dataCount: inOutBatchResult.length });

    // Paginated Caching for Large Datasets
    const totalRows = totalCount.total;
    const totalPages = Math.ceil(totalRows / PAGE_SIZE);

    for (let page = 1; page <= totalPages; page++) {
      const offset = (page - 1) * PAGE_SIZE;

      // Housing Details
      const housingDetails = await StudentData.findAll({
        attributes: [
          'id',
          ['student_name', 'StudentName'],
          ['email_id', 'EmailID'],
          ['student_cvue_no', 'StudentCvueNo'],
          ['rc_name', 'RCName'],
          ['house', 'House'],
          ['housing_block', 'HousingBlock'],
          ['status', 'Status'],
          ['no_of_days', 'NoOfDays'],
          ['in_out', 'INOUT'],
        ],
        raw: true,
        limit: PAGE_SIZE,
        offset,
      });
      await redisClient.setEx(
        `housingDetails:page:${page}`,
        600,
        JSON.stringify(housingDetails)
      );
      io.emit('housingDetailsUpdated', { page, data: housingDetails });
      console.log(`Cached housingDetails page ${page}:`, { count: housingDetails.length });

      // Parents Info
      const parentsInfo = await StudentData.findAll({
        attributes: [
          ['student_name', 'StudentName'],
          ['email_id', 'EmailID'],
          ['student_cvue_no', 'StudentCvueNo'],
          ['father_name', 'FatherName'],
          ['father_email_id', 'FatherEmailID'],
          ['father_mobile_no', 'FatherMobileNo'],
          ['mother_name', 'MotherName'],
          ['mother_email_id', 'MotherEmailID'],
          ['mother_mobile_no', 'MotherMobileNo'],
        ],
        raw: true,
        limit: PAGE_SIZE,
        offset,
      });
      await redisClient.setEx(
        `parentsInfo:page:${page}`,
        600,
        JSON.stringify(parentsInfo)
      );
      io.emit('parentsInfoUpdated', { page, data: parentsInfo });
      console.log(`Cached parentsInfo page ${page}:`, { count: parentsInfo.length });

      // Student Info
      const studentInfo = await StudentData.findAll({
        attributes: [
          ['student_name', 'StudentName'],
          ['email_id', 'EmailID'],
          ['batch', 'Batch'],
          ['gender', 'Gender'],
          ['dob', 'DOB'],
          ['contact_no', 'ContactNo'],
          ['home_town', 'HomeTown'],
          ['house', 'House'],
          ['photo', 'Photo'],
          ['student_cvue_no', 'StudentCvueNo'],
        ],
        raw: true,
        limit: PAGE_SIZE,
        offset,
      });
      await redisClient.setEx(
        `studentInfo:page:${page}`,
        600,
        JSON.stringify(studentInfo)
      );
      io.emit('studentInfoUpdated', { page, data: studentInfo });
      console.log(`Cached studentInfo page ${page}:`, { count: studentInfo.length });

      // Tracking Info
      const trackingInfo = await StudentData.findAll({
        attributes: [
          ['student_name', 'StudentName'],
          ['student_cvue_no', 'StudentCvueNo'],
          ['email_id', 'EmailID'],
          ['in_out', 'INOUT'],
          ['no_of_days', 'NoOfDays'],
          ['device_name', 'DeviceName'],
          ['last_punch_date', 'LastPunchDate'],
          ['device_id', 'DeviceId'],
        ],
        raw: true,
        limit: PAGE_SIZE,
        offset,
      });
      await redisClient.setEx(
        `trackingInfo:page:${page}`,
        600,
        JSON.stringify(trackingInfo)
      );
      io.emit('trackingInfoUpdated', { page, data: trackingInfo });
      console.log(`Cached trackingInfo page ${page}:`, { count: trackingInfo.length });

      // All Students
      const allStudents = await StudentData.findAll({
        raw: true,
        limit: PAGE_SIZE,
        offset,
      });
      await redisClient.setEx(
        `allStudents:page:${page}`,
        600,
        JSON.stringify(allStudents)
      );
      io.emit('allStudentsUpdated', { page, data: allStudents });
      console.log(`Cached allStudents page ${page}:`, { count: allStudents.length });
    }

    // Store total pages for pagination
    await redisClient.setEx('totalPages', 600, JSON.stringify(totalPages));
    console.log('Cached totalPages:', totalPages);

  } catch (error) {
    console.error('Error in cacheStudentDetails:', error);
  }
}

function startCronJob(io) {
  console.log('Cron job started: Caching student details every 5 minutes.');
  cron.schedule('*/5 * * * *', () => cacheStudentDetails(io));
  cacheStudentDetails(io); // Run immediately on start
}

module.exports = startCronJob;