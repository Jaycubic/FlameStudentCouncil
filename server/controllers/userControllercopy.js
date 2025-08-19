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
      const { employeeCode, username, email, userType, password } = req.body;

      if (!employeeCode || !username || !email || !userType) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const role = await Role.findOne({ where: { name: userType } });
      if (!role) {
        return res.status(400).json({ message: 'Invalid role name' });
      }

      let finalPassword;
      if (userType === 'admin') {
        if (!password) {
          return res.status(400).json({ message: 'Password is required for admin users' });
        }
        finalPassword = password;
      } else {
        finalPassword = 'default_password'; // Consider security implications
      }

      const user = await User.create({
        UserID: parseInt(employeeCode),
        username,
        email,
        password: finalPassword,
        Department: null,
        isActive: true,
        roleId: role.id,
      });

      res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
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
      const { UserID, username, email, Department, isActive, userType, password } = req.body;
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if userType is 'admin' and password is required
      const roleName = userType || user.Role?.name;
      if (roleName === 'admin' && !password) {
        return res.status(400).json({ message: 'Password is required for admin users' });
      }

      await user.update({ 
        UserID: UserID || user.UserID,
        username: username || user.username,
        email: email || user.email,
        Department: Department || user.Department,
        isActive: isActive !== undefined ? isActive : user.isActive,
        roleId: userType ? (await Role.findOne({ where: { name: userType } }))?.id : user.roleId,
        password: password || user.password,
      });
      res.json({ message: 'User updated successfully' });
    } catch (error) {
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
      await user.destroy();
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
  },
};

module.exports = userController;
