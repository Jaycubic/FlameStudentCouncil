import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'http://192.168.8.10:8082/students';

class ParentInfoService {
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

  async getParentDetails(page = 1, filters = {}) {
    const { search = '' } = filters;
    try {
      const response = await this.fetchWithAuth('get', '/parents-info', {
        params: { page, search }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch parent details');
    }
  }

  async getTotalCount(filters = {}) {
    const { search = '' } = filters;
    try {
      const response = await this.fetchWithAuth('get', '/total-count', {
        params: { search }
      });
      return response.data.total;
    } catch (error) {
      throw new Error('Failed to fetch total student count');
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

export default new ParentInfoService();
