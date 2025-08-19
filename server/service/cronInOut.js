const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const redis = require('redis');
const { spawn } = require('child_process');
require('dotenv').config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

async function cacheInOutData() {
  try {
    // IN-OUT count
    const inOutCounts = await sequelize.query(
      `SELECT \`IN-OUT\` AS \`in_out\`, COUNT(\`IN-OUT\`) AS count 
       FROM studentdata 
       WHERE \`IN-OUT\` IS NOT NULL 
       GROUP BY \`IN-OUT\``,
      { type: QueryTypes.SELECT }
    );

    if (!inOutCounts.length) {
      console.warn('No data for getInOutCount. Check for NULL values in IN-OUT.');
    }

    const statusCounts = {
      IN: 0,
      OUT: 0,
      'NO PUNCH': 0,
    };

    inOutCounts.forEach((item) => {
      if (item.in_out in statusCounts) {
        statusCounts[item.in_out] = parseInt(item.count);
      }
    });

    const formattedInOutCounts = Object.entries(statusCounts).map(([inOut, count]) => ({
      inOut,
      count,
    }));
    await redisClient.setEx('inOutCount', 600, JSON.stringify(formattedInOutCounts));
    console.log('Cached inOutCount:', { count: formattedInOutCounts.length });

    // IN-OUT batch count
    const rawCounts = await sequelize.query(
      `SELECT Batch, \`IN-OUT\` AS \`in_out\`, COUNT(\`IN-OUT\`) AS count 
       FROM studentdata 
       WHERE Batch IS NOT NULL AND \`IN-OUT\` IS NOT NULL 
       GROUP BY Batch, \`IN-OUT\` 
       ORDER BY Batch ASC`,
      { type: QueryTypes.SELECT }
    );

    if (!rawCounts.length) {
      console.warn('No data for getInOutBatchCount. Check for NULL values in Batch or IN-OUT.');
    }

    const batches = [...new Set(rawCounts.map((item) => item.Batch))];
    const result = batches.map((batch) => {
      const inCount = rawCounts.find((r) => r.Batch === batch && r.in_out === 'IN');
      const outCount = rawCounts.find((r) => r.Batch === batch && r.in_out === 'OUT');
      const noPunchCount = rawCounts.find((r) => r.Batch === batch && r.in_out === 'NO PUNCH');
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
    console.log('Cached inOutBatchCount:', { dataCount: result.length, grandTotal });

    return { inOutCount: formattedInOutCounts, inOutBatchCount: inOutBatchData };
  } catch (error) {
    console.error('Error in cacheInOutData:', error);
  }
}

module.exports = { cacheInOutData };
