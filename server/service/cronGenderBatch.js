const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const redis = require("redis");
require("dotenv").config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});
redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.connect();

async function cacheGenderBatchData() {
  try {
    // Total student count
    const [totalResult] = await sequelize.query("SELECT COUNT(*) AS count FROM studentdata", {
      type: QueryTypes.SELECT,
    });
    const totalCount = { total: parseInt(totalResult.count) };
    await redisClient.setEx("totalStudentCount", 600, JSON.stringify(totalCount));

    // Gender and batch count
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
    await redisClient.setEx("genderBatchCount", 600, JSON.stringify(genderBatchData));
    console.log("Cached genderBatchCount:", { dataCount: result.length, grandTotal });
    return { totalStudentCount: totalCount, genderBatchCount: genderBatchData };
  } catch (error) {
    console.error("Error in cacheGenderBatchData:", error);
  }
}

module.exports = cacheGenderBatchData;