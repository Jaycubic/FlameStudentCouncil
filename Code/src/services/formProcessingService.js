// services/formProcessingService.js
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/form-processing';

class FormProcessingService {
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

    async getPrefillData() {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(`${API_URL}/prefill`, {
                headers: {
                    'x-device-id': deviceId
                },
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch prefill data');
            return response.json();
        } catch (error) {
            console.error('Prefill fetch error:', error);
            throw error;
        }
    }

    async getApplicationStatus() {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(`${API_URL}/status`, {
                headers: {
                    'x-device-id': deviceId
                },
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch application status');
            return response.json();
        } catch (error) {
            console.error('Status fetch error:', error);
            throw error;
        }
    }
    async uploadPhoto(file, studentId) {
        try {
            const deviceId = await this.getDeviceId();
            const formData = new FormData();
            formData.append('photo', file);
            formData.append('studentId', studentId);
            const response = await fetch('/photos/upload', {
                method: 'POST',
                headers: { 'x-device-id': deviceId },
                credentials: 'include',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Upload failed');
            return data;
        } catch (error) {
            console.error('Photo upload error:', error);
            throw error;
        }
    }
}

export const formProcessingService = new FormProcessingService();
