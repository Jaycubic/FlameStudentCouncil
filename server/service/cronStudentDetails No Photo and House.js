const cron = require('node-cron');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
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
      'SELECT COUNT(*) AS count FROM studentdata',
      { type: QueryTypes.SELECT }
    );
    const totalCount = { total: parseInt(totalCountResult.count) };
    await redisClient.setEx('totalStudentCount', 600, JSON.stringify(totalCount));
    io.emit('totalStudentCountUpdated', totalCount);
    console.log('Cached totalStudentCount:', totalCount);

    // Gender Batch Count
    const genderBatchCounts = await sequelize.query(
      `SELECT Batch, Gender, COUNT(Gender) AS count 
       FROM studentdata 
       WHERE Batch IS NOT NULL AND Gender IS NOT NULL 
       GROUP BY Batch, Gender 
       ORDER BY Batch ASC`,
      { type: QueryTypes.SELECT }
    );
    const batches = [...new Set(genderBatchCounts.map((item) => item.Batch))];
    const genderBatchResult = batches.map((batch) => {
      const female = genderBatchCounts.find((r) => r.Batch === batch && r.Gender === 'Female');
      const male = genderBatchCounts.find((r) => r.Batch === batch && r.Gender === 'Male');
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
      `SELECT HomeTown, COUNT(HomeTown) AS count 
       FROM studentdata 
       WHERE HomeTown IS NOT NULL 
       GROUP BY HomeTown 
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    const formattedCityCounts = cityCounts.map((item) => ({
      homeTown: item.HomeTown || 'Unknown',
      count: parseInt(item.count),
    }));
    await redisClient.setEx('cityCount', 600, JSON.stringify(formattedCityCounts));
    io.emit('cityCountUpdated', formattedCityCounts);
    console.log('Cached cityCount:', { count: formattedCityCounts.length });

    // City with Highest Count
    const [highestCity] = await sequelize.query(
      `SELECT HomeTown, COUNT(HomeTown) AS count 
       FROM studentdata 
       WHERE HomeTown IS NOT NULL 
       GROUP BY HomeTown 
       ORDER BY count DESC 
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    const highestCityData = highestCity
      ? { homeTown: highestCity.HomeTown || 'Unknown', count: parseInt(highestCity.count) }
      : { homeTown: 'None', count: 0 };
    await redisClient.setEx('cityWithHighestCount', 600, JSON.stringify(highestCityData));
    io.emit('cityWithHighestCountUpdated', highestCityData);
    console.log('Cached cityWithHighestCount:', highestCityData);

    // RC Count (Full)
    const rcCounts = await sequelize.query(
      `SELECT \`RC Name\` AS RCName, COUNT(\`RC Name\`) AS count 
       FROM studentdata 
       WHERE \`RC Name\` IS NOT NULL 
       GROUP BY \`RC Name\` 
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    const formattedRCCounts = rcCounts.map((item) => ({
      rcName: item.RCName,
      count: parseInt(item.count),
    }));
    await redisClient.setEx('rcCount', 600, JSON.stringify(formattedRCCounts));
    io.emit('rcCountUpdated', formattedRCCounts);
    console.log('Cached rcCount:', { count: formattedRCCounts.length });

    // RC Filled Count
    const [rcFilledResult] = await sequelize.query(
      `SELECT COUNT(*) AS count 
       FROM studentdata 
       WHERE \`RC Name\` IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    const rcFilledCount = { total: parseInt(rcFilledResult.count) };
    await redisClient.setEx('rcFilledCount', 600, JSON.stringify(rcFilledCount));
    io.emit('rcFilledCountUpdated', rcFilledCount);
    console.log('Cached rcFilledCount:', rcFilledCount);

    // IN-OUT Count
    const inOutCounts = await sequelize.query(
      `SELECT \`IN-OUT\` AS \`in_out\`, COUNT(\`IN-OUT\`) AS count 
       FROM studentdata 
       WHERE \`IN-OUT\` IS NOT NULL 
       GROUP BY \`IN-OUT\``,
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
      `SELECT Batch, \`IN-OUT\` AS \`in_out\`, COUNT(\`IN-OUT\`) AS count 
       FROM studentdata 
       WHERE Batch IS NOT NULL AND \`IN-OUT\` IS NOT NULL 
       GROUP BY Batch, \`IN-OUT\` 
       ORDER BY Batch ASC`,
      { type: QueryTypes.SELECT }
    );
    const inOutBatches = [...new Set(inOutBatchCounts.map((item) => item.Batch))];
    const inOutBatchResult = inOutBatches.map((batch) => {
      const inCount = inOutBatchCounts.find((r) => r.Batch === batch && r.in_out === 'IN');
      const outCount = inOutBatchCounts.find((r) => r.Batch === batch && r.in_out === 'OUT');
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
          'StudentName',
          'EmailID',
          'StudentCvueNo',
          'RCName',
          'HousingBlock',
          'Status',
          'NoOfDays',
          'INOUT',
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
          'StudentName',
          'EmailID',
          'StudentCvueNo',
          'FatherName',
          'FatherEmailID',
          'FatherMobileNo',
          'MotherName',
          'MotherEmailID',
          'MotherMobileNo',
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
          'StudentName',
          'EmailID',
          'Batch',
          'Gender',
          'DOB',
          'ContactNo',
          'HomeTown',
          'StudentCvueNo',
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