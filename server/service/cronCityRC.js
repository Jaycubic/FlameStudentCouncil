const cron = require('node-cron');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

async function cacheCityRCData() {
  try {
    // City count (without pagination for cache)
    const cityCounts = await sequelize.query(
      `SELECT HomeTown, COUNT(HomeTown) AS count 
       FROM studentdata 
       WHERE HomeTown IS NOT NULL 
       GROUP BY HomeTown 
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );

    if (!cityCounts.length) {
      console.warn('No data for getCityCount. Check for NULL values in HomeTown.');
    }

    const formattedCityCounts = cityCounts.map((item) => ({
      homeTown: item.HomeTown || 'Unknown',
      count: parseInt(item.count),
    }));
    await redisClient.setEx('cityCount', 600, JSON.stringify(formattedCityCounts));
    console.log('Cached cityCount:', { count: formattedCityCounts.length });

    // City with highest count
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
      ? { homeTown: city.HomeTown || 'Unknown', count: parseInt(city.count) }
      : { homeTown: 'None', count: 0 };
    await redisClient.setEx('cityWithHighestCount', 600, JSON.stringify(highestCity));
    console.log('Cached cityWithHighestCount:', highestCity);

    // RC count (without pagination for cache)
    const rcCounts = await sequelize.query(
      `SELECT \`RC Name\` AS RCName, COUNT(\`RC Name\`) AS count 
       FROM studentdata 
       WHERE \`RC Name\` IS NOT NULL 
       GROUP BY \`RC Name\` 
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );

    if (!rcCounts.length) {
      console.warn('No data for getRCCount. Check for NULL values in RC Name.');
    }

    const formattedRCCounts = rcCounts.map((item) => ({
      rcName: item.RCName,
      count: parseInt(item.count),
    }));
    await redisClient.setEx('rcCount', 600, JSON.stringify(formattedRCCounts));
    console.log('Cached rcCount:', { count: formattedRCCounts.length });

    // RC filled count
    const [rcFilledResult] = await sequelize.query(
      `SELECT COUNT(*) AS count 
       FROM studentdata 
       WHERE \`RC Name\` IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    const rcFilledCount = { total: parseInt(rcFilledResult.count) };
    await redisClient.setEx('rcFilledCount', 600, JSON.stringify(rcFilledCount));
    console.log('Cached rcFilledCount:', rcFilledCount);
  } catch (error) {
    console.error('Error in cacheCityRCData:', error);
  }
}

function startCronJob() {
  console.log('Cron job started: Caching city and RC data every 5 minutes.');
  cron.schedule('*/5 * * * *', cacheCityRCData);
  cacheCityRCData(); // Run immediately on start
}

module.exports = startCronJob;