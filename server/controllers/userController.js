const { User, Role } = require('../models');

const userController = {
  async getAllUsers(req, res) {
    try {
      const users = await User.findAll({
        include: [{ model: Role, attributes: ['name', 'permissions'] }],
        attributes: { exclude: ['password'] },
      });
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
  },

  async createUser(req, res) {
    try {
      const { employeeCode, employeeName, department, username, email, password, CounterId } = req.body;
      // Basic required fields check
      if (!employeeCode || !username || !email) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      let roleId = req.body.roleId;
      if (CounterId) {
        const userRole = await Role.findOne({ where: { name: 'user' } });
        if (!userRole) {
          return res.status(400).json({ message: 'User role not found in the system' });
        }
        roleId = userRole.id;
      } else if (!roleId) {
        return res.status(400).json({ message: 'Role ID is required when not assigning to a counter' });
      }
      const role = await Role.findByPk(roleId);
      if (!role) {
        return res.status(400).json({ message: 'Invalid role ID' });
      }
      // Password is mandatory for all roles except 'rc'
      if (role.name.toLowerCase() !== 'rc' && !password) {
        return res.status(400).json({ message: 'Password is required for this role. Please provide a password.' });
      }
      const userData = {
        UserID: parseInt(employeeCode),
        username,
        email,
        Department: department,
        CounterId: CounterId || null,
        password: password || null, // Set to null if not provided
        isActive: true,
        roleId: roleId,
      };
      const existingUser = await User.findOne({
        where: {
          [require('sequelize').Op.or]: [
            { email: email },
            { UserID: parseInt(employeeCode) }
          ]
        }
      });
      if (existingUser) {
        await existingUser.update(userData);
        return res.status(200).json({ message: 'User updated successfully', user: existingUser });
      }
      const user = await User.create(userData);
      res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors[0].path;
        return res.status(400).json({ message: `${field} already exists` });
      }
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Error creating user', error: error.message });
    }
  },

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id, {
        include: [{ model: Role, attributes: ['name', 'permissions'] }],
        attributes: { exclude: ['password'] },
      });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
  },

  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { roleId } = req.body;
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const role = await Role.findByPk(roleId);
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      await user.update({ roleId });
      res.json({ message: 'User role updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error updating user role', error: error.message });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { UserID, username, email, Department, isActive, roleId, password, CounterId } = req.body;
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      let finalRoleId = roleId || user.roleId;
      if (CounterId !== undefined && CounterId !== user.CounterId) {
        const userRole = await Role.findOne({ where: { name: 'user' } });
        if (!userRole) {
          return res.status(400).json({ message: 'User role not found in the system' });
        }
        finalRoleId = userRole.id;
      }
      const role = await Role.findByPk(finalRoleId);
      if (!role) {
        return res.status(400).json({ message: 'Invalid role ID' });
      }
      await user.update({
        UserID: UserID || user.UserID,
        username: username || user.username,
        email: email || user.email,
        Department: Department || user.Department,
        CounterId: CounterId !== undefined ? CounterId : user.CounterId,
        isActive: isActive !== undefined ? isActive : user.isActive,
        roleId: finalRoleId,
        password: password || user.password,
      });
      res.json({ message: 'User updated successfully' });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors[0].path;
        return res.status(400).json({ message: `${field} already exists` });
      }
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Error updating user', error: error.message });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      await user.destroy({ performedBy: req.user.id });
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
  },

  async getRCUsernames(req, res) {
    try {
      const rcRole = await Role.findOne({ where: { name: 'RC' } });
      if (!rcRole) {
        return res.status(404).json({ message: 'Role RC not found' });
      }
      const rcUsers = await User.findAll({
        where: { roleId: rcRole.id },
        attributes: ['username']
      });
      res.json(rcUsers.map(user => user.username));
    } catch (error) {
      res.status(500).json({ message: 'Error fetching RC usernames', error: error.message });
    }
  }
};

module.exports = userController;
