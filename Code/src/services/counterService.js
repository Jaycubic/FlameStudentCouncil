import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/counters';

class CounterService {
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

  async getCounters() {
    try {
      const response = await this.fetchWithAuth('get', '');
      return response.data;
    } catch (error) {
      console.error('Error fetching counters:', error.response?.data || error.message);
      throw error;
    }
  }

  async createCounter(counterData) {
    try {
      const response = await this.fetchWithAuth('post', '', { data: counterData });
      return response.data;
    } catch (error) {
      console.error('Error creating counter:', error.response?.data || error.message);
      throw error;
    }
  }

  async getCounterById(id) {
    try {
      const response = await this.fetchWithAuth('get', `/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching counter ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async updateCounter(id, counterData) {
    try {
      const response = await this.fetchWithAuth('put', `/${id}`, { data: counterData });
      return response.data;
    } catch (error) {
      console.error(`Error updating counter ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async deleteCounter(id) {
    try {
      const response = await this.fetchWithAuth('delete', `/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting counter ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

export const counterService = new CounterService();
