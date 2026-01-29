// services/timeSettingsService.js
import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'https://flameawards.in:8082/api/time-settings';

class TimeSettingsService {
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

    /**
     * Fetch current time settings and title
     */
    async getSettings() {
        try {
            const response = await this.fetchWithAuth('get', API_URL);
            return response.data;
        } catch (error) {
            console.error('Error fetching time settings:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update time settings (Admin only)
     */
    async updateSettings(settingsData) {
        try {
            const response = await this.fetchWithAuth('post', API_URL, { data: settingsData });
            return response.data;
        } catch (error) {
            console.error('Error updating time settings:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const timeSettingsService = new TimeSettingsService();
