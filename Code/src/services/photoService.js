// src/services/photoService.js
import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const BASE_API = 'http://192.168.8.10:8082';

class PhotoService {
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
      url: `${BASE_API}${url}`,
      headers: {
        ...options.headers,
        'x-device-id': deviceId,
      },
      params: options.params,
      data: options.data,
      withCredentials: true,
      timeout: options.timeout || 10000,
    };
    return axios(config);
  }

  async uploadPhoto(file) {
    if (!file) throw new Error('No file provided');
    const form = new FormData();
    form.append('photo', file);

    try {
      const resp = await this.fetchWithAuth('post', '/api/users/photo', {
        data: form,
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 20000
      });
      return resp.data;
    } catch (err) {
      console.error('Photo upload failed:', err.response?.data || err.message);
      throw err;
    }
  }

  async deletePhoto(filename) {
    if (!filename) throw new Error('No filename provided');
    try {
      const resp = await this.fetchWithAuth('delete', `/api/users/photo/${encodeURIComponent(filename)}`);
      return resp.data;
    } catch (err) {
      console.error('Photo delete failed:', err.response?.data || err.message);
      throw err;
    }
  }

  getPhotoUrl(filename) {
    if (!filename) return null;
    return `/photos/${filename}`;
  }
}

export const photoService = new PhotoService();
export default photoService;
