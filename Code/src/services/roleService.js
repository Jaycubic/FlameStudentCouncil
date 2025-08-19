import axios from 'axios';
import { userService } from './userService';

const API_URL = 'https://flamestudentcouncil.in:5050/api/roles';

function getCookie(name) {
  let matches = document.cookie.match(new RegExp(
    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
  ));
  return matches ? decodeURIComponent(matches[1]) : null;
}

class RoleService {
  getAuthHeaders() {
    const token = getCookie('token');
    if (!token) {
      console.warn('No token found in cookie. Authentication may fail.');
    }
    return { Authorization: `Bearer ${token || ''}` };
  }

  async getRoles() {
    try {
      const response = await axios.get(API_URL, {
        headers: this.getAuthHeaders(),
      });
      // Fetch users to calculate userCount
      const users = await userService.getUsers();
      const rolesWithCounts = response.data.map((role) => ({
        ...role,
        permissions: Array.isArray(role.permissions) ? role.permissions : [], // Ensure permissions is an array
        userCount: users.filter((user) => user.role === role.name).length,
      }));
      return rolesWithCounts;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRoleById(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: this.getAuthHeaders(),
      });
      const role = response.data;
      role.permissions = Array.isArray(role.permissions) ? role.permissions : []; // Ensure permissions is an array
      return role;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createRole(roleData) {
    try {
      const response = await axios.post(API_URL, roleData, {
        headers: this.getAuthHeaders(),
      });
      const role = response.data;
      role.permissions = Array.isArray(role.permissions) ? role.permissions : []; // Ensure permissions is an array
      return role;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateRole(id, roleData) {
    try {
      const response = await axios.put(`${API_URL}/${id}`, roleData, {
        headers: this.getAuthHeaders(),
      });
      const role = response.data;
      role.permissions = Array.isArray(role.permissions) ? role.permissions : []; // Ensure permissions is an array
      return role;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteRole(id) {
    try {
      const response = await axios.delete(`${API_URL}/${id}`, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  handleError(error) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    };
    console.error('API Error:', errorDetails);
    throw error;
  }
}

export const roleService = new RoleService();