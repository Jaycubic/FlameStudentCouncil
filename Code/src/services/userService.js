import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'http://192.168.8.10:8082/api/users';
const EMPLOYEE_API_URL = 'http://192.168.8.10:8082/employee';

class UserService {
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
      url,
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

  async getUsers() {
    try {
      const response = await this.fetchWithAuth('get', API_URL);
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error.response?.data || error.message);
      throw error;
    }
  }

  async getUserById(id) {
    try {
      const response = await this.fetchWithAuth('get', `${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching user ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      const response = await this.fetchWithAuth('post', API_URL, { data: userData });
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateUser(id, userData) {
    try {
      const response = await this.fetchWithAuth('put', `${API_URL}/${id}`, { data: userData });
      return response.data;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async deleteUser(id) {
    try {
      const response = await this.fetchWithAuth('delete', `${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getEmployeeByCode(code) {
    try {
      const response = await this.fetchWithAuth('get', EMPLOYEE_API_URL, {
        params: { code }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching employee with code ${code}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getRCUsernames() {
    try {
      const response = await this.fetchWithAuth('get', `${API_URL}/rc-usernames`);
      return response.data;
    } catch (error) {
      console.error('Error fetching RC usernames:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const userService = new UserService();
