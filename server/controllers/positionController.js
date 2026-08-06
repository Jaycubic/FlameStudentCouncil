// server/controllers/positionController.js
const Position = require('../models/Position');

const positionController = {
  // Get all candidate positions
  async getAllPositions(req, res) {
    try {
      const positions = await Position.findAll({
        order: [['id', 'ASC']],
      });
      return res.status(200).json({
        success: true,
        data: positions,
      });
    } catch (error) {
      console.error('Error fetching positions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch positions',
        error: error.message,
      });
    }
  },

  // Get a single candidate position by ID
  async getPositionById(req, res) {
    try {
      const { id } = req.params;
      const position = await Position.findByPk(id);
      if (!position) {
        return res.status(404).json({
          success: false,
          message: 'Position not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: position,
      });
    } catch (error) {
      console.error('Error fetching position:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch position',
        error: error.message,
      });
    }
  },

  // Create a new candidate position
  async createPosition(req, res) {
    try {
      const { description } = req.body;
      if (!description || !description.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Description is required',
        });
      }

      const newPosition = await Position.create({
        description: description.trim(),
      });

      return res.status(201).json({
        success: true,
        message: 'Position created successfully',
        data: newPosition,
      });
    } catch (error) {
      console.error('Error creating position:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create position',
        error: error.message,
      });
    }
  },

  // Update an existing candidate position
  async updatePosition(req, res) {
    try {
      const { id } = req.params;
      const { description } = req.body;

      if (!description || !description.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Description is required',
        });
      }

      const position = await Position.findByPk(id);
      if (!position) {
        return res.status(404).json({
          success: false,
          message: 'Position not found',
        });
      }

      await position.update({
        description: description.trim(),
      });

      return res.status(200).json({
        success: true,
        message: 'Position updated successfully',
        data: position,
      });
    } catch (error) {
      console.error('Error updating position:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update position',
        error: error.message,
      });
    }
  },

  // Delete a candidate position
  async deletePosition(req, res) {
    try {
      const { id } = req.params;
      const position = await Position.findByPk(id);

      if (!position) {
        return res.status(404).json({
          success: false,
          message: 'Position not found',
        });
      }

      await position.destroy();

      return res.status(200).json({
        success: true,
        message: 'Position deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting position:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete position',
        error: error.message,
      });
    }
  },
};

module.exports = positionController;
