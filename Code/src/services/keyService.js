import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/keys';

class KeyService {
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

  async issueKey(studentId) {
    try {
      const response = await this.fetchWithAuth('post', '/issue', { data: { studentId } });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to issue key');
    }
  }

  async returnKey(studentId) {
    try {
      const response = await this.fetchWithAuth('post', '/return', { data: { studentId } });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to return key');
    }
  }

  async getKeyStatus(studentId) {
    try {
      const response = await this.fetchWithAuth('get', `/status/${studentId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch key status');
    }
  }
}

export default new KeyService();
