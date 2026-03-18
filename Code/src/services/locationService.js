import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/locations';

class LocationService {
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

  async getLocations() {
    try {
      const response = await this.fetchWithAuth('get', '');
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getLocationById(id) {
    try {
      const response = await this.fetchWithAuth('get', `/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createLocation(locationData) {
    try {
      const response = await this.fetchWithAuth('post', '', { data: locationData });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateLocation(id, locationData) {
    try {
      const response = await this.fetchWithAuth('put', `/${id}`, { data: locationData });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteLocation(id) {
    try {
      const response = await this.fetchWithAuth('delete', `/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  handleError(error) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    };
    console.error('API Error:', errorDetails);
    throw error;
  }
}

export const locationService = new LocationService();
