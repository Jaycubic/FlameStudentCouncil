import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'http://192.168.8.10:8082/api/activity-tracker';

class NotificationService {
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

  async getNotifications() {
    try {
      const response = await this.fetchWithAuth('get', '');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch notifications');
    }
  }

  async markNotificationAsRead(activityId) {
    try {
      await this.fetchWithAuth('put', `/mark-read/${activityId}`);
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to mark notification as read');
    }
  }

  async clearNotification(activityId) {
    try {
      await this.fetchWithAuth('put', `/clear/${activityId}`);
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to clear notification');
    }
  }

  async markAllAsRead(activityIds) {
    try {
      await this.fetchWithAuth('put', '/mark-read', { data: { activityIds } });
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to mark all as read');
    }
  }

  async clearAll(activityIds) {
    try {
      await this.fetchWithAuth('put', '/clear', { data: { activityIds } });
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to clear all notifications');
    }
  }
}

export default new NotificationService();
