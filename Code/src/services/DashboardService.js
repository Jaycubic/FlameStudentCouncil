import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '';

class DashboardService {
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

  async getTotalStudents() {
    const response = await this.fetchWithAuth('get', '/total-students');
    return response.data.total;
  }

  async getGenderBatchCount() {
    const response = await this.fetchWithAuth('get', '/gender-batch-count');
    return response.data;
  }

  async getRCFilledCount() {
    const response = await this.fetchWithAuth('get', '/rc-filled-count');
    return response.data.total;
  }

  async getRCCount() {
    const response = await this.fetchWithAuth('get', '/rc-count');
    return response.data;
  }

  async getCityWithHighest() {
    const response = await this.fetchWithAuth('get', '/city-highest');
    return response.data;
  }

  async getCityCount() {
    const response = await this.fetchWithAuth('get', '/city-count');
    return response.data;
  }

  async getInOutCount() {
    const response = await this.fetchWithAuth('get', '/in-out-count');
    return response.data;
  }

  async getInOutBatchCount() {
    const response = await this.fetchWithAuth('get', '/in-out-batch-count');
    return response.data;
  }
}

export default new DashboardService();
