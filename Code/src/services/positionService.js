// frontend/services/positionService.js
import { load } from '@fingerprintjs/fingerprintjs';

class PositionService {
  constructor() {
    this.baseUrl = 'https://flameawards.in:8082/api/positions';
  }

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

  async fetchWithAuth(url, options = {}) {
    const deviceId = await this.getDeviceId();
    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        'x-device-id': deviceId,
      },
      credentials: 'include',
    };
    return fetch(url, fetchOptions);
  }

  async fetchPositions(limit = 50, offset = 0) {
    const url = `${this.baseUrl}?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
    try {
      const resp = await this.fetchWithAuth(url);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to fetch positions');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async fetchPosition(id) {
    try {
      const resp = await this.fetchWithAuth(`${this.baseUrl}/${id}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to fetch position');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async createPosition(payload) {
    try {
      const resp = await this.fetchWithAuth(this.baseUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || 'Failed to create position');
      }
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async updatePosition(id, payload) {
    try {
      const resp = await this.fetchWithAuth(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to update position');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async deletePosition(id) {
    try {
      const resp = await this.fetchWithAuth(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to delete position');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async getAll() {
    return this.fetchPositions();
  }
}

export const positionService = new PositionService();
