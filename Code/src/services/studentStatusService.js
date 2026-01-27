import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'https://flameawards.in:8082/api/student-status';

class StudentStatusService {
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

  async getStudentStatusData(page = 1, filters = {}) {
    try {
      const response = await this.fetchWithAuth('get', '', {
        params: { page, ...filters }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching student status data:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateStudent(id, data) {
    try {
      const response = await this.fetchWithAuth('put', `/${id}`, { data });
      return response.data;
    } catch (error) {
      console.error(`Error updating student ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getStudentStatusCounts() {
    try {
      const response = await this.fetchWithAuth('get', '/counts');
      return response.data;
    } catch (error) {
      console.error('Error fetching student status counts:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const studentStatusService = new StudentStatusService();
