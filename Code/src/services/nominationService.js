// services/nominationService.js

const API_URL = '/api/nominations';

class NominationService {
    async getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            const { load } = await import('@fingerprintjs/fingerprintjs');
            const fp = await load();
            const result = await fp.get();
            deviceId = result.visitorId;
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    async handleResponse(response) {
        const contentType = response.headers.get('Content-Type');
        const isJson = contentType && contentType.includes('application/json');

        if (!response.ok) {
            if (isJson) {
                const data = await response.json();
                throw new Error(data.message || `Error ${response.status}: Action failed`);
            } else {
                if (response.status === 502 || response.status === 504) {
                    throw new Error('The server is temporarily busy or unreachable. Please try again.');
                }
                throw new Error(`Server error (${response.status}). Please try again later.`);
            }
        }

        return isJson ? response.json() : response;
    }

    async getNominations() {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(API_URL, {
                method: 'GET',
                credentials: 'include',
                headers: { 'x-device-id': deviceId },
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Network Issue: Unable to reach the server. Please check your connection.');
            }
            throw error;
        }
    }

    async generateNominations() {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(`${API_URL}/generate`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId,
                },
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Network Issue: Unable to reach the server. Please check your connection.');
            }
            throw error;
        }
    }

    async deleteNominee(id) {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(`${API_URL}/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId,
                },
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Network Issue: Unable to reach the server. Please check your connection.');
            }
            throw error;
        }
    }

    async sendNotifications({ to, cc, subject, html }) {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch('/api/email/send-notifications', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId,
                },
                body: JSON.stringify({ to, cc, subject, html }),
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Network Issue: Unable to reach the server. Please check your connection.');
            }
            throw error;
        }
    }
}

export const nominationService = new NominationService();