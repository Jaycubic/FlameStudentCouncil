import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'https://flameawards.in:8082/api/pdf';

class IdCardService {
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

  async generatePDF(studentIds) {
    try {
      // Ensure IDs are integers
      const parsedStudentIds = studentIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (parsedStudentIds.length === 0) {
        throw new Error('No valid student IDs provided');
      }
      const response = await this.fetchWithAuth('post', '/generate', { data: { studentIds: parsedStudentIds } });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to generate PDF');
    }
  }
}

export default new IdCardService();
