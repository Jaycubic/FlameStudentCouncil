// src/services/positionService.js

const API_URL = '/api/positions';

class PositionService {
    async getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            try {
                const { load } = await import('@fingerprintjs/fingerprintjs');
                const fp = await load();
                const result = await fp.get();
                deviceId = result.visitorId;
                localStorage.setItem('deviceId', deviceId);
            } catch (err) {
                deviceId = 'fallback-device-id';
            }
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

    async getAllPositions() {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(API_URL, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId
                }
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Failed to fetch positions:', error);
            throw error;
        }
    }

    async getPositionById(id) {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId
                }
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Failed to fetch position ${id}:`, error);
            throw error;
        }
    }

    async createPosition(data) {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(API_URL, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId
                },
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Failed to create position:', error);
            throw error;
        }
    }

    async updatePosition(id, data) {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId
                },
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Failed to update position ${id}:`, error);
            throw error;
        }
    }

    async deletePosition(id) {
        try {
            const deviceId = await this.getDeviceId();
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId
                }
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Failed to delete position ${id}:`, error);
            throw error;
        }
    }
}

export const positionService = new PositionService();
