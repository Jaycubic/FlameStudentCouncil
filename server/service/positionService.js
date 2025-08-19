// services/positionService.js
// This service expects a Sequelize model exported as "Position" from ../models (or ../models/positions fallback).
let Position;
try {
  ({ Position } = require('../models'));
} catch (e) {
  try {
    Position = require('../models/Positions');
  } catch (err) {
    console.error('Could not load Position model for service. Ensure ../models/index.js or ../models/positions.js exists.');
    throw err;
  }
}

const { Op } = require('sequelize');

const positionService = {
  /**
   * Create a new position.
   * @param {Object} data
   * @returns {Promise<Model>}
   */
  async createPosition(data) {
    // Optionally sanitize/validate fields here
    return Position.create(data);
  },

  /**
   * Get positions with pagination.
   * @param {Object} params - { limit, offset, where, order }
   * @returns {Promise<Array<Model>>}
   */
  async getPositions({ limit = 50, offset = 0, where = {}, order = [['priority', 'ASC']] } = {}) {
    const l = parseInt(limit, 10);
    const o = parseInt(offset, 10);

    return Position.findAll({
      where,
      limit: Number.isNaN(l) ? 50 : l,
      offset: Number.isNaN(o) ? 0 : o,
      order,
    });
  },

  /**
   * Get a position by id
   * @param {number} id
   * @returns {Promise<Model|null>}
   */
  async getPositionById(id) {
    return Position.findByPk(id);
  },

  /**
   * Update a position by id
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Model|null>} updated instance or null if not found
   */
  async updatePosition(id, data) {
    const instance = await Position.findByPk(id);
    if (!instance) return null;
    return instance.update(data);
  },

  /**
   * Delete a position by id
   * @param {number} id
   * @returns {Promise<Model|null>} deleted instance or null
   */
  async deletePosition(id) {
    const instance = await Position.findByPk(id);
    if (!instance) return null;
    await instance.destroy();
    return instance;
  },

  /**
   * Search positions by description fragment (example helper)
   */
  async searchByDescription(fragment, { limit = 50, offset = 0 } = {}) {
    return Position.findAll({
      where: {
        description: {
          [Op.iLike]: `%${fragment}%`,
        },
      },
      limit,
      offset,
      order: [['priority', 'ASC']],
    });
  },
};

module.exports = positionService;
