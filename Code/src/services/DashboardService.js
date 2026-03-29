// src/services/DashboardService.js
import { load } from '@fingerprintjs/fingerprintjs';

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

    async getStats() {
        const deviceId = await this.getDeviceId();
        const response = await fetch('/api/dashboard/stats', {
            method: 'GET',
            credentials: 'include',
            headers: { 'x-device-id': deviceId },
        });
        if (!response.ok) throw new Error('Failed to fetch dashboard stats');
        const json = await response.json();
        return json.data;
    }
}

export const dashboardService = new DashboardService();
