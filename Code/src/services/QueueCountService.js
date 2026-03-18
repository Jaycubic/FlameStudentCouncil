import axios from 'axios';
import { locationService } from './locationService';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/queue-count';

class QueueCountService {
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
      url: `${API_URL}${url}`,
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

  async getQueueCounts() {
    try {
      const response = await this.fetchWithAuth('get', '/counts');
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getQueueList(locationName, DeviceId, department, page = 1, limit = 100, date) {
    try {
      const response = await this.fetchWithAuth('get', '/list', {
        params: { locationName, DeviceId, department, page, limit, date }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getLocations() {
    try {
      return await locationService.getLocations();
    } catch (error) {
      this.handleError(error);
    }
  }

  async getSummaryTableData(date) {
    try {
      const response = await this.fetchWithAuth('get', '/summary', {
        params: { date }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getReportedStudentsSummary() {
    try {
      const response = await this.fetchWithAuth('get', '/reported-summary');
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getReportedStudentsList(page = 1, limit = 100, batch) {
    try {
      const response = await this.fetchWithAuth('get', '/reported-list', {
        params: { page, limit, batch }
      });
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

export const queueCountService = new QueueCountService();
