const { User, Role } = require('../models');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

const userController = {
  async getAllUsers(req, res) {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password'] },
      });
      const mappedUsers = users.map(u => {
        const json = u.toJSON();
        const mappedUser = {
          ...json,
          UserID: json.user_id,
          Department: json.department,
          isActive: json.is_active,
          roleId: json.role_id,
          createdAt: json.created_at,
          updatedAt: json.updated_at,
        };
        delete mappedUser.user_id;
        delete mappedUser.department;
        delete mappedUser.is_active;
        delete mappedUser.role_id;
        delete mappedUser.created_at;
        delete mappedUser.updated_at;
        delete mappedUser.access_token;
        delete mappedUser.refresh_token;
        delete mappedUser.expiry_date;
        delete mappedUser.two_fa_secret;
        delete mappedUser.two_fa_setup;
        delete mappedUser.verification_token;
        delete mappedUser.token_expires;
        return mappedUser;
      });
      res.json(mappedUsers);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
  },

  async createUser(req, res) {
    try {
      const { employeeCode, employeeName, department, username, email, password, roleId } = req.body;
      // Basic required fields check
      if (!employeeCode || !username || !email || !roleId) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      const role = await Role.findByPk(roleId);
      if (!role) {
        return res.status(400).json({ message: 'Invalid role ID' });
      }
      if ((role.name.toLowerCase() === 'admin' || role.name === 'SportsVisitingFaculty' || role.name === 'SportsFaculty') && !password) {
        return res.status(400).json({ message: 'Password is required for this role. Please provide a password.' });
      }
      if ((role.name.toLowerCase() !== 'admin' && role.name !== 'SportsVisitingFaculty' && role.name !== 'SportsFaculty') && password) {
        return res.status(400).json({ message: 'Password not allowed for non-admin/faculty roles.' });
      }
      const userData = {
        user_id: parseInt(employeeCode),
        username,
        email,
        department: department,
        is_active: true,
        role_id: roleId,
        created_at: new Date(),
        updated_at: new Date()
      };
      if (password) {
        userData.password = await bcrypt.hash(password, 10);
      } else {
        userData.password = null;
      }
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: email },
            { user_id: parseInt(employeeCode) }
          ]
        }
      });
      if (existingUser) {
        const updateData = { ...userData, updated_at: new Date() };
        await existingUser.update(updateData);
        const updatedUser = await User.findByPk(existingUser.id, {
          attributes: { exclude: ['password'] },
        });
        const json = updatedUser.toJSON();
        const mappedUser = {
          ...json,
          UserID: json.user_id,
          Department: json.department,
          isActive: json.is_active,
          roleId: json.role_id,
          createdAt: json.created_at,
          updatedAt: json.updated_at,
        };
        delete mappedUser.user_id;
        delete mappedUser.department;
        delete mappedUser.is_active;
        delete mappedUser.role_id;
        delete mappedUser.created_at;
        delete mappedUser.updated_at;
        delete mappedUser.access_token;
        delete mappedUser.refresh_token;
        delete mappedUser.expiry_date;
        delete mappedUser.two_fa_secret;
        delete mappedUser.two_fa_setup;
        delete mappedUser.verification_token;
        delete mappedUser.token_expires;
        return res.status(200).json({ message: 'User updated successfully', user: mappedUser });
      }
      const user = await User.create(userData);
      const createdUser = await User.findByPk(user.id, {
        attributes: { exclude: ['password'] },
      });
      const json = createdUser.toJSON();
      const mappedUser = {
        ...json,
        UserID: json.user_id,
        Department: json.department,
        isActive: json.is_active,
        roleId: json.role_id,
        createdAt: json.created_at,
        updatedAt: json.updated_at,
      };
      delete mappedUser.user_id;
      delete mappedUser.department;
      delete mappedUser.is_active;
      delete mappedUser.role_id;
      delete mappedUser.created_at;
      delete mappedUser.updated_at;
      delete mappedUser.access_token;
      delete mappedUser.refresh_token;
      delete mappedUser.expiry_date;
      delete mappedUser.two_fa_secret;
      delete mappedUser.two_fa_setup;
      delete mappedUser.verification_token;
      delete mappedUser.token_expires;
      res.status(201).json({ message: 'User created successfully', user: mappedUser });
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
        attributes: { exclude: ['password'] },
      });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const json = user.toJSON();
      const mappedUser = {
        ...json,
        UserID: json.user_id,
        Department: json.department,
        isActive: json.is_active,
        roleId: json.role_id,
        createdAt: json.created_at,
        updatedAt: json.updated_at,
      };
      delete mappedUser.user_id;
      delete mappedUser.department;
      delete mappedUser.is_active;
      delete mappedUser.role_id;
      delete mappedUser.created_at;
      delete mappedUser.updated_at;
      delete mappedUser.access_token;
      delete mappedUser.refresh_token;
      delete mappedUser.expiry_date;
      delete mappedUser.two_fa_secret;
      delete mappedUser.two_fa_setup;
      delete mappedUser.verification_token;
      delete mappedUser.token_expires;
      res.json(mappedUser);
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
      await user.update({ role_id: roleId, updated_at: new Date() });
      res.json({ message: 'User role updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error updating user role', error: error.message });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { UserID, username, email, Department, isActive, roleId, password } = req.body;
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      let finalRoleId = roleId || user.role_id;
      const role = await Role.findByPk(finalRoleId);
      if (!role) {
        return res.status(400).json({ message: 'Invalid role ID' });
      }
      if ((role.name.toLowerCase() === 'admin' || role.name === 'SportsVisitingFaculty' || role.name === 'SportsFaculty') && password && password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      }
      if ((role.name.toLowerCase() !== 'admin' && role.name !== 'SportsVisitingFaculty' && role.name !== 'SportsFaculty') && password) {
        return res.status(400).json({ message: 'Cannot set password for this role.' });
      }
      const updateData = {
        user_id: UserID || user.user_id,
        username: username || user.username,
        email: email || user.email,
        department: Department || user.department,
        is_active: isActive !== undefined ? isActive : user.is_active,
        role_id: finalRoleId,
        updated_at: new Date()
      };
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      await user.update(updateData);
      const updatedUser = await User.findByPk(id, {
        attributes: { exclude: ['password'] },
      });
      const json = updatedUser.toJSON();
      const mappedUser = {
        ...json,
        UserID: json.user_id,
        Department: json.department,
        isActive: json.is_active,
        roleId: json.role_id,
        createdAt: json.created_at,
        updatedAt: json.updated_at,
      };
      delete mappedUser.user_id;
      delete mappedUser.department;
      delete mappedUser.is_active;
      delete mappedUser.role_id;
      delete mappedUser.created_at;
      delete mappedUser.updated_at;
      delete mappedUser.access_token;
      delete mappedUser.refresh_token;
      delete mappedUser.expiry_date;
      delete mappedUser.two_fa_secret;
      delete mappedUser.two_fa_setup;
      delete mappedUser.verification_token;
      delete mappedUser.token_expires;
      res.json({ message: 'User updated successfully', user: mappedUser });
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
      await user.destroy();
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
  },

  async updateMyPassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId; // user id from validated token

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Both current and new passwords are required' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const role = await Role.findByPk(user.role_id);
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }

      // Check if role is allowed to change password
      const allowedRoles = ['admin', 'SportsVisitingFaculty', 'SportsFaculty'];
      if (!allowedRoles.includes(role.name)) {
        return res.status(403).json({ message: 'This role is not authorized to update passwords directly.' });
      }

      // Verify current password
      if (!user.password) {
        // Should not happen for these roles effectively, but safe check
        return res.status(400).json({ message: 'No password set for this account.' });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ message: 'Incorrect current password' });
      }

      // Validate new password rules
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
      }

      // Update password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await user.update({
        password: hashedNewPassword,
        updated_at: new Date()
      });

      res.json({ message: 'Password updated successfully' });

    } catch (error) {
      console.error('Error updating my password:', error);
      res.status(500).json({ message: 'Error updating password', error: error.message });
    }
  }
};

module.exports = userController;