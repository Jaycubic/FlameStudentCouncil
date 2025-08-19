const { Counter } = require('../models');

const countersController = {
  async getAllCounters(req, res) {
    try {
      const counters = await Counter.findAll();
      res.json(counters);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching counters', error: error.message });
    }
  },

  async createCounter(req, res) {
    try {
      const { CounterName, DepartmentName } = req.body;
      if (!CounterName || !DepartmentName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      const counter = await Counter.create({ CounterName, DepartmentName });
      res.status(201).json({ message: 'Counter created successfully', counter });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: 'Counter name already exists in this department' });
      }
      console.error('Error creating counter:', error);
      res.status(500).json({ message: 'Error creating counter', error: error.message });
    }
  },

  async getCounterById(req, res) {
    try {
      const { id } = req.params;
      const counter = await Counter.findByPk(id);
      if (!counter) {
        return res.status(404).json({ message: 'Counter not found' });
      }
      res.json(counter);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching counter', error: error.message });
    }
  },

  async updateCounter(req, res) {
    try {
      const { id } = req.params;
      const { CounterName, DepartmentName } = req.body;
      const counter = await Counter.findByPk(id);
      if (!counter) {
        return res.status(404).json({ message: 'Counter not found' });
      }
      await counter.update({ CounterName, DepartmentName });
      res.json({ message: 'Counter updated successfully' });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: 'Counter name already exists in this department' });
      }
      console.error('Error updating counter:', error);
      res.status(500).json({ message: 'Error updating counter', error: error.message });
    }
  },

  async deleteCounter(req, res) {
    try {
      const { id } = req.params;
      const counter = await Counter.findByPk(id);
      if (!counter) {
        return res.status(404).json({ message: 'Counter not found' });
      }
      await counter.destroy();
      res.json({ message: 'Counter deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting counter', error: error.message });
    }
  }
};

module.exports = countersController;
