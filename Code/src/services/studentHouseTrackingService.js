// src/services/studentHouseTrackingService.js
import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/student-house-tracking';

class StudentHouseTrackingService {
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
      url: `${API_URL}${url}`,
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

  async getHousingDetails(page = 1, filters = {}) {
    const { search = '', rcName = '', inout = '' } = filters;
    try {
      const response = await this.fetchWithAuth('get', '/housing-details', {
        params: { page, search, rcName, inout }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch housing details');
    }
  }

  async getTotalCount(filters = {}) {
    const { search = '', rcName = '', inout = '' } = filters;
    try {
      const response = await this.fetchWithAuth('get', '/total-count', {
        params: { search, rcName, inout }
      });
      return response.data.total;
    } catch (error) {
      throw new Error('Failed to fetch total student count');
    }
  }

  async getRCNames() {
    try {
      const response = await this.fetchWithAuth('get', '/rc-names');
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch RC names');
    }
  }

  async updateStudent(id, updateData) {
    try {
      const response = await this.fetchWithAuth('patch', `/${id}`, { data: updateData });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update student');
    }
  }

  async deleteStudent(id) {
    try {
      await this.fetchWithAuth('delete', `/${id}`);
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete student');
    }
  }
}

export default new StudentHouseTrackingService();
