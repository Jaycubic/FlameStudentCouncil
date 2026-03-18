// src/services/departmentService.js
import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/departments';

class DepartmentService {
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

  async getDepartments(page = 1, limit = 100, filters = {}, sortField = '', sortDir = '') {
    const deviceId = await this.getDeviceId();
    const headers = { 'x-device-id': deviceId };
    const params = { page, limit, ...filters };
    if (sortField) {
      params.sortField = sortField;
      params.sortDir = sortDir;
    }
    try {
      const response = await axios.get(API_URL, { params, headers, withCredentials: true });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getUnique(column, search = '') {
    const deviceId = await this.getDeviceId();
    const headers = { 'x-device-id': deviceId };
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    try {
      const response = await axios.get(`${API_URL}/unique?column=${column}${searchParam}`, { headers, withCredentials: true });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createDepartment(departmentData) {
    const deviceId = await this.getDeviceId();
    const headers = { 'x-device-id': deviceId };
    try {
      const response = await axios.post(API_URL, departmentData, { headers, withCredentials: true });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateDepartment(id, departmentData) {
    const deviceId = await this.getDeviceId();
    const headers = { 'x-device-id': deviceId };
    try {
      const response = await axios.put(`${API_URL}/${id}`, departmentData, { headers, withCredentials: true });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteDepartment(id) {
    const deviceId = await this.getDeviceId();
    const headers = { 'x-device-id': deviceId };
    try {
      const response = await axios.delete(`${API_URL}/${id}`, { headers, withCredentials: true });
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

export const departmentService = new DepartmentService();