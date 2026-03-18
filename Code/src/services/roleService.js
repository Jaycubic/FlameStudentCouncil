import axios from 'axios';
import { userService } from './userService';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/roles';

class RoleService {
  async getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      const fp = await load();
      const result = await fp.get();
      deviceId = result.visitorId;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  async fetchWithAuth(method, url, options = {}) {
    const deviceId = await this.getDeviceId();
    const config = {
      method,
      url: url.startsWith('http') ? url : `${API_URL}${url}`,
      headers: {
        ...options.headers,
        'x-device-id': deviceId,
      },
      params: options.params,
      data: options.data,
      withCredentials: true,
    };
    return axios(config);
  }

  async getRoles() {
    try {
      const response = await this.fetchWithAuth('get', '');
      // Fetch users to calculate userCount
      const users = await userService.getUsers();
      const rolesWithCounts = response.data.map((role) => ({
        ...role,
        permissions: Array.isArray(role.permissions) ? role.permissions : [],
        userCount: users.filter((user) => user.role === role.name).length,
      }));
      return rolesWithCounts;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRoleById(id) {
    try {
      const response = await this.fetchWithAuth('get', `/${id}`);
      const role = response.data;
      role.permissions = Array.isArray(role.permissions) ? role.permissions : [];
      return role;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createRole(roleData) {
    try {
      const response = await this.fetchWithAuth('post', '', { data: roleData });
      const role = response.data;
      role.permissions = Array.isArray(role.permissions) ? role.permissions : [];
      return role;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateRole(id, roleData) {
    try {
      const response = await this.fetchWithAuth('put', `/${id}`, { data: roleData });
      const role = response.data;
      role.permissions = Array.isArray(role.permissions) ? role.permissions : [];
      return role;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteRole(id) {
    try {
      const response = await this.fetchWithAuth('delete', `/${id}`);
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
