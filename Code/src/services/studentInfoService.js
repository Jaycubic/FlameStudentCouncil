import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = 'https://flameawards.in:8082/students';

class StudentInfoService {
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
      responseType: options.responseType || 'json'
    };
    return axios(config);
  }

  async getStudents(page = 1, filters = {}) {
    try {
      const response = await this.fetchWithAuth('get', '/student-info', {
        params: { page, ...filters }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch students');
    }
  }

  async getTotalCount(filters = {}) {
    try {
      const response = await this.fetchWithAuth('get', '/total-count', {
        params: filters
      });
      return response.data.total;
    } catch (error) {
      throw new Error('Failed to fetch total student count');
    }
  }

  async getBatches() {
    try {
      const response = await this.fetchWithAuth('get', '/batches');
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch batches');
    }
  }

  async createStudent(studentData) {
    try {
      const response = await this.fetchWithAuth('post', '', { data: studentData });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to create student');
    }
  }

  async updateStudent(id, updateData) {
    try {
      const response = await this.fetchWithAuth('patch', `/${id}`, { data: updateData });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update student');
    }
  }

  async getStudentPhoto(photoId) {
    try {
      const response = await this.fetchWithAuth('get', `/photos/${photoId}`, {
        responseType: 'blob'
      });
      return URL.createObjectURL(response.data);
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch student photo');
    }
  }

  async uploadStudentPhoto(photoId, file) {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const response = await this.fetchWithAuth('post', `/photos/${photoId}`, {
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to upload photo');
    }
  }
}

export default new StudentInfoService();
