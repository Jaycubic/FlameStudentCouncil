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

    async handleResponse(response) {
        const contentType = response.headers.get('Content-Type');
        const isJson = contentType && contentType.includes('application/json');

        if (!response.ok) {
            if (isJson) {
                const data = await response.json();
                throw new Error(data.message || `Error ${response.status}: Action failed`);
            } else {
                if (response.status === 502 || response.status === 504) {
                    throw new Error('The server is temporarily busy or unreachable. Please try again in a few moments.');
                }
                throw new Error(`Server error (${response.status}). Please try again later.`);
            }
        }

        return isJson ? response.json() : response;
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
            return await this.handleResponse(response);
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Network Issue: Unable to reach the server. Please check your internet connection.');
            }
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
            return await this.handleResponse(response);
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Network Issue: Server unreachable.');
            }
            console.error('Status fetch error:', error);
            throw error;
        }
    }
    async uploadPhoto(file, studentId) {
        try {
            const deviceId = await this.getDeviceId();
            const formData = new FormData();
            formData.append('photo', file);
            const response = await fetch(`/api/photos/upload?studentId=${encodeURIComponent(studentId)}`, {
                method: 'POST',
                headers: { 'x-device-id': deviceId },
                credentials: 'include',
                body: formData,
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Network Issue: Photo upload failed. Check your connection.');
            }
            console.error('Photo upload error:', error);
            throw error;
        }
    }
}

export const formProcessingService = new FormProcessingService();
