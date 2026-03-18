import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/reports';
const STUDENTS_API_URL = '/api/students';

class ReportService {
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

  async getReportData(page = 1, filters = {}) {
    const params = { page, ...filters };
    try {
      const response = await this.fetchWithAuth('get', `${API_URL}/data`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching report data:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateReportData(id, data) {
    try {
      const response = await this.fetchWithAuth('put', `${API_URL}/data/${id}`, { data });
      return response.data;
    } catch (error) {
      console.error(`Error updating report data for student ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getBatches() {
    try {
      const response = await this.fetchWithAuth('get', `${STUDENTS_API_URL}/batches`);
      return response.data;
    } catch (error) {
      console.error('Error fetching batches:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const reportService = new ReportService();
