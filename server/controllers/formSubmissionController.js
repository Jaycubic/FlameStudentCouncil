// controllers/formSubmissionController.js
const { v4: uuidv4 } = require('uuid');
const redis = require('redis');
const FormSubmission = require('../models/formSubmissions');
require('dotenv').config();

// Redis client (v4)
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`,
  password: process.env.REDIS_PASSWORD || undefined,
});
redisClient.connect().catch(console.error);

const QUEUE_KEY = 'form_submissions:queue';
const PROCESSING_SET = 'form_submissions:processing';

// Utility: enqueue a submission for async processing
async function enqueueSubmission(payload) {
  const job = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    payload,
  };
  // push job as JSON string
  await redisClient.lPush(QUEUE_KEY, JSON.stringify(job));
  return job;
}

// The queue worker: blocking pop (BRPOP) pattern
async function startQueueWorker({ concurrency = 3, sleepOnErrorMs = 5000 } = {}) {
  // spawn `concurrency` parallel workers
  for (let i = 0; i < concurrency; i++) {
    runWorker(i, sleepOnErrorMs).catch(err => console.error('Queue worker crash:', err));
  }
  console.log(`Started ${concurrency} form submission queue workers.`);
}

async function runWorker(workerIndex, sleepOnErrorMs) {
  while (true) {
    try {
      // Use BRPOP with 0 timeout to block until an item arrives
      const res = await redisClient.brPop(QUEUE_KEY, 0);
      // res: { element: '...json...', key: 'form_submissions:queue' }
      if (!res || !res.element) continue;

      const job = JSON.parse(res.element);
      const jobId = job.id;
      // optional: mark in a processing set so you can track in-progress jobs
      await redisClient.hSet(PROCESSING_SET, jobId, JSON.stringify({ startedAt: new Date().toISOString(), worker: workerIndex }));

      // process job: insert into DB (safely)
      try {
        await processJobInsert(job.payload);
        // mark success (delete processing entry)
        await redisClient.hDel(PROCESSING_SET, jobId);
        // store a short success record (optional)
        await redisClient.setEx(`form_submissions:job:${jobId}`, 60 * 60, JSON.stringify({ status: 'done', completedAt: new Date().toISOString() }));
      } catch (procErr) {
        console.error('Processing job error', procErr);
        // store error and optionally push to a dead-letter queue
        await redisClient.hSet(PROCESSING_SET, jobId, JSON.stringify({ error: procErr.message, attemptedAt: new Date().toISOString() }));
        // Optional: push to a separate DLQ for later inspection
        await redisClient.rPush(`${QUEUE_KEY}:dead`, JSON.stringify({ job, error: String(procErr) }));
      }
    } catch (err) {
      console.error('Worker loop error:', err);
      // on Redis connection error, wait then retry
      await new Promise(res => setTimeout(res, sleepOnErrorMs));
    }
  }
}

// Insert job into DB using Sequelize
async function processJobInsert(payload) {
  try {
    const submission = await FormSubmission.create({
      name: payload.name,
      student_id: payload.student_id,
      mobile_number: payload.mobile_number,
      position: payload.position,
      cgpa: payload.cgpa,
      cgpa_verification: payload.cgpa_verification || null,
      sports_score: payload.sports_score || null,
      cultural_score: payload.cultural_score || null,
      community_service: payload.community_service || null,
      statement_of_purpose: payload.statement_of_purpose || null,
      not_on_probation: payload.not_on_probation || false,
      read_handbook: payload.read_handbook || false,
      tru_statement: payload.tru_statement || false,
      email: payload.email,
      submission_date: payload.submission_date || new Date(),
      status: payload.status || 'pending',
      ramzi_score: payload.ramzi_score || null,
      farrokh_score: payload.farrokh_score || null,
      gender: payload.Gender || payload.gender || null,
      batch: payload.Batch || payload.batch || null,
      photo: payload.Photo || payload.photo || null,
    });
    return submission;
  } catch (err) {
    throw err;
  }
}

/* Controller methods used by routes */
const formController = {
  // Fast enqueue endpoint — returns job id immediately (202)
  async create(req, res) {
    try {
      // basic validation (you can plug Joi or express-validator)
      const body = req.body;
      if (!body || !body.name || !body.student_id || !body.email) {
        return res.status(400).json({ message: 'name, student_id and email are required' });
      }
      const job = await enqueueSubmission(body);
      // respond accepted with job id for async processing
      return res.status(202).json({ message: 'accepted', jobId: job.id });
    } catch (error) {
      console.error('Enqueue error:', error);
      return res.status(500).json({ message: 'Error enqueueing submission', error: error.message });
    }
  },

  // Optional endpoint to submit many at once; enqueues all and returns ids
  async bulkCreate(req, res) {
    try {
      const items = Array.isArray(req.body) ? req.body : [];
      if (!items.length) return res.status(400).json({ message: 'Empty payload' });

      const jobs = [];
      for (const it of items) {
        const job = await enqueueSubmission(it);
        jobs.push(job.id);
      }
      return res.status(202).json({ message: 'accepted', jobIds: jobs });
    } catch (err) {
      console.error('Bulk enqueue error:', err);
      return res.status(500).json({ message: 'Error enqueueing bulk submissions', error: err.message });
    }
  },

  // Optional synchronous create (if you prefer immediate DB insert)
  async createImmediate(req, res) {
    try {
      const created = await FormSubmission.create(req.body);
      return res.status(201).json(created);
    } catch (error) {
      console.error('Direct create error:', error);
      return res.status(500).json({ message: 'Error creating submission', error: error.message });
    }
  },

  // Get all (supports filters & pagination)
  async getAll(req, res) {
    try {
      const { limit = 50, offset = 0, student_id, status } = req.query;
      const where = {};
      if (student_id) where.student_id = student_id;
      if (status) where.status = status;
      const { count, rows } = await FormSubmission.findAndCountAll({
        where,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
      return res.json({ data: rows, total: count });
    } catch (err) {
      console.error('Get all error:', err);
      return res.status(500).json({ message: 'Error fetching submissions', error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      const item = await FormSubmission.findByPk(id);
      if (!item) return res.status(404).json({ message: 'Not found' });
      return res.json(item);
    } catch (err) {
      console.error('Get one error:', err);
      return res.status(500).json({ message: 'Error fetching submission', error: err.message });
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      const [updated] = await FormSubmission.update(req.body, { where: { id } });
      if (!updated) return res.status(404).json({ message: 'Not found or nothing to update' });
      const updatedItem = await FormSubmission.findByPk(id);
      return res.json(updatedItem);
    } catch (err) {
      console.error('Update error:', err);
      return res.status(500).json({ message: 'Error updating submission', error: err.message });
    }
  },

  async delete(req, res) {
    try {
      const id = Number(req.params.id);
      const item = await FormSubmission.findByPk(id);
      if (!item) return res.status(404).json({ message: 'Not found' });
      await item.destroy();
      return res.json({ message: 'Deleted', data: item });
    } catch (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ message: 'Error deleting submission', error: err.message });
    }
  },

  // helper to start queue worker externally
  startQueueWorker
};

module.exports = formController;