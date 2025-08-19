const { Department, Location } = require('../models');

const departmentController = {
  async getAllDepartments(req, res) {
    try {
      const departments = await Department.findAll({
        include: [{ model: Location, attributes: ['locationName'] }],
      });
      res.json(departments);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching departments', error: error.message });
    }
  },

  async createDepartment(req, res) {
    try {
      const { departmentName, locationName, hodName, hodEmail } = req.body;

      if (!departmentName || !locationName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const location = await Location.findOne({ where: { locationName } });
      if (!location) {
        return res.status(400).json({ message: 'Invalid location name' });
      }

      const department = await Department.create({
        departmentName,
        locationName,
        hodName,
        hodEmail,
      });

      res.status(201).json({ message: 'Department created successfully', department });
    } catch (error) {
      console.error('Error creating department:', error);
      res.status(500).json({ message: 'Error creating department', error: error.message });
    }
  },

  async getDepartmentById(req, res) {
    try {
      const { id } = req.params;
      const department = await Department.findByPk(id, {
        include: [{ model: Location, attributes: ['locationName'] }],
      });
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }
      res.json(department);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching department', error: error.message });
    }
  },

  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const { departmentName, locationName, hodName, hodEmail } = req.body;
      const department = await Department.findByPk(id);
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }

      if (locationName) {
        const location = await Location.findOne({ where: { locationName } });
        if (!location) {
          return res.status(400).json({ message: 'Invalid location name' });
        }
      }

      await department.update({
        departmentName: departmentName || department.departmentName,
        locationName: locationName || department.locationName,
        hodName: hodName || department.hodName,
        hodEmail: hodEmail || department.hodEmail,
      });
      res.json({ message: 'Department updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error updating department', error: error.message });
    }
  },

  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      const department = await Department.findByPk(id);
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }
      await department.destroy();
      res.json({ message: 'Department deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting department', error: error.message });
    }
  },
};

module.exports = departmentController;
