import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'http://192.168.8.10:8082/api/organizations';

class OrganizationService {
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

  async getOrganizations() {
    try {
      const response = await this.fetchWithAuth('get', '');
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getOrganizationById(id) {
    try {
      const response = await this.fetchWithAuth('get', `/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createOrganization(organizationData) {
    try {
      const response = await this.fetchWithAuth('post', '', { data: organizationData });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateOrganization(id, organizationData) {
    try {
      const response = await this.fetchWithAuth('put', `/${id}`, { data: organizationData });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteOrganization(id) {
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

export const organizationService = new OrganizationService();
