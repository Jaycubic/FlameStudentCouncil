// src/services/QueueDashboardService.js
import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'http://192.168.8.10:8082/api/queue-dashboard';

class QueueDashboardService {
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

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  // Extract counterId from user object in localStorage
  getCounterId() {
    const user = this.getCurrentUser();
    return user?.counterId ?? null;
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

  async createQueue(queueData) {
    const res = await this.fetchWithAuth('post', '', { data: queueData });
    return res.data;
  }

  async getWaitingQueues() {
    const res = await this.fetchWithAuth('get', '/waiting');
    return res.data;
  }

  async getActiveQueues() {
    const res = await this.fetchWithAuth('get', '/active');
    return res.data;
  }

  async getActiveQueuesForDashboard() {
    const res = await this.fetchWithAuth('get', '/active-dashboard');
    return res.data;
  }

  async getCompletedQueues() {
    const res = await this.fetchWithAuth('get', '/completed');
    return res.data;
  }

  async setQueueOn(id) {
    const res = await this.fetchWithAuth('put', `/${id}/on`);
    return res.data;
  }

  async setQueueOff(id) {
    const res = await this.fetchWithAuth('put', `/${id}/off`);
    return res.data;
  }

  async deleteQueue(id) {
    const res = await this.fetchWithAuth('delete', `/${id}`);
    return res.data;
  }

  async getDepartmentCounters() {
    const res = await this.fetchWithAuth('get', '/counters');
    return res.data;
  }

  async moveQueueToCounter(id, newCounterId) {
    const res = await this.fetchWithAuth('put', `/${id}/move`, { data: { newCounterId } });
    return res.data;
  }

  async getWaitingQueuesSpecial() {
    const res = await this.fetchWithAuth('get', '/waiting-special');
    return res.data;
  }

  async getActiveQueuesSpecial() {
    const res = await this.fetchWithAuth('get', '/active-special');
    return res.data;
  }
}

export const queueDashboardService = new QueueDashboardService();
