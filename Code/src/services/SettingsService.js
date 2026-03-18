import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/settings';

class SettingsService {
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

  async getAllRolesWith2FA() {
    try {
      const response = await this.fetchWithAuth('get', '/roles-with-2fa');
      return response.data;
    } catch (error) {
      console.error('Error fetching roles with 2FA:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateSettingForRole(roleId, settingKey, settingValue) {
    try {
      const response = await this.fetchWithAuth('put', `/roles/${roleId}/${settingKey}`, {
        data: { settingValue }
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating setting for role ${roleId}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

export const settingsService = new SettingsService();
