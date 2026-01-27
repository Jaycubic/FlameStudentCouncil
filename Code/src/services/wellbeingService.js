// src/services/wellbeingService.js
import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'https://flameawards.in:8082/api/wellbeing-status';

class WellbeingService {
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

  async getAll() {
    try {
      const res = await this.fetchWithAuth('get', '');
      return res.data;
    } catch (error) {
      console.error('Error fetching wellbeing forms:', error);
      throw error;
    }
  }

  async getById(id) {
    try {
      const res = await this.fetchWithAuth('get', `/${id}`);
      return res.data;
    } catch (error) {
      console.error(`Error fetching wellbeing form ${id}:`, error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      const res = await this.fetchWithAuth('put', `/${id}`, { data });
      return res.data;
    } catch (error) {
      console.error(`Error updating wellbeing form ${id}:`, error);
      throw error;
    }
  }

  async delete(id) {
    try {
      const res = await this.fetchWithAuth('delete', `/${id}`);
      return res.data;
    } catch (error) {
      console.error(`Error deleting wellbeing form ${id}:`, error);
      throw error;
    }
  }
}

export default new WellbeingService();
