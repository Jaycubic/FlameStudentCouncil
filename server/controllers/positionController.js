// controllers/positionController.js
const redis = require('redis');
require('dotenv').config();

// Try to import Position model from either ../models (index) or ../models/positions
let PositionModel;
try {
  // Common pattern when using Sequelize CLI: models/index.js exports models
  ({ Position: PositionModel } = require('../models'));
} catch (e) {
  // Fallback: single model file
  try {
    PositionModel = require('../models/Positions');
  } catch (err) {
    console.error('Could not load Position model. Make sure ../models/index.js or ../models/positions.js exists.');
    throw err;
  }
}

const positionService = (() => {
  try {
    return require('../services/positionService');
  } catch (err) {
    // If service is not present, we'll use the model directly.
    return null;
  }
})();

// Redis client (v4)
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`,
  password: process.env.REDIS_PASSWORD || undefined,
});
redisClient.connect().catch((err) => {
  console.error('Redis connection error:', err);
});

const CACHE_KEY = 'positions:all';
const CACHE_TTL = 3600; // 1 hour

const positionController = {
  async create(req, res) {
    try {
      const body = req.body;
      if (!body.description || body.max_vote === undefined || body.priority === undefined) {
        return res.status(400).json({ message: 'description, max_vote, and priority are required' });
      }

      // Use service if available for separation of concerns
      const created = positionService
        ? await positionService.createPosition(body)
        : await PositionModel.create(body);

      // Invalidate cache
      try {
        await redisClient.del(CACHE_KEY);
      } catch (e) {
        console.warn('Failed to clear cache after create:', e.message);
      }

      return res.status(201).json(created);
    } catch (error) {
      console.error('Create error:', error);
      return res.status(500).json({ message: 'Error creating position', error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      // Check cache first
      try {
        const cached = await redisClient.get(CACHE_KEY);
        if (cached) {
          return res.json({ data: JSON.parse(cached), fromCache: true });
        }
      } catch (cacheErr) {
        console.warn('Redis get failed:', cacheErr.message);
      }

      const { limit = 50, offset = 0 } = req.query;
      // Use service if available
      const rows = positionService
        ? await positionService.getPositions({ limit: parseInt(limit, 10), offset: parseInt(offset, 10) })
        : await PositionModel.findAll({
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
            order: [['priority', 'ASC']],
          });

      // Cache the result (stringify)
      try {
        await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(rows));
      } catch (cacheErr) {
        console.warn('Redis setEx failed:', cacheErr.message);
      }

      return res.json({ data: rows });
    } catch (err) {
      console.error('Get all error:', err);
      return res.status(500).json({ message: 'Error fetching positions', error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

      const item = positionService
        ? await positionService.getPositionById(id)
        : await PositionModel.findByPk(id);

      if (!item) return res.status(404).json({ message: 'Not found' });
      return res.json(item);
    } catch (err) {
      console.error('Get one error:', err);
      return res.status(500).json({ message: 'Error fetching position', error: err.message });
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

      let updated;
      if (positionService) {
        updated = await positionService.updatePosition(id, req.body);
      } else {
        const instance = await PositionModel.findByPk(id);
        if (!instance) return res.status(404).json({ message: 'Not found' });
        updated = await instance.update(req.body);
      }

      // Invalidate cache
      try {
        await redisClient.del(CACHE_KEY);
      } catch (e) {
        console.warn('Failed to clear cache after update:', e.message);
      }

      return res.json(updated);
    } catch (err) {
      console.error('Update error:', err);
      return res.status(500).json({ message: 'Error updating position', error: err.message });
    }
  },

  async delete(req, res) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

      let removed;
      if (positionService) {
        removed = await positionService.deletePosition(id);
      } else {
        const instance = await PositionModel.findByPk(id);
        if (!instance) return res.status(404).json({ message: 'Not found' });
        removed = await instance.destroy();
      }

      // Invalidate cache
      try {
        await redisClient.del(CACHE_KEY);
      } catch (e) {
        console.warn('Failed to clear cache after delete:', e.message);
      }

      return res.json({ message: 'Deleted', data: removed });
    } catch (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ message: 'Error deleting position', error: err.message });
    }
  },
};

module.exports = positionController;
