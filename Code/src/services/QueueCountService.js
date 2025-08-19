import axios from 'axios';
import { locationService } from './locationService';

const API_URL = 'https://flamestudentcouncil.in:5050/api/queue-count';

class QueueCountService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found in localStorage. Authentication may fail.');
    }
    return { Authorization: `Bearer ${token || ''}` };
  }

  async getQueueCounts() {
    try {
      const response = await axios.get(`${API_URL}/counts`, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getQueueList(locationName, DeviceId, department, page = 1, limit = 100, date) {
    try {
      const response = await axios.get(`${API_URL}/list`, {
        params: { locationName, DeviceId, department, page, limit, date },
        headers: this.getAuthHeaders(),
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
      const response = await axios.get(`${API_URL}/summary`, {
        params: { date },
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getReportedStudentsSummary() {
    try {
      const response = await axios.get(`${API_URL}/reported-summary`, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getReportedStudentsList(page = 1, limit = 100, batch) {
    try {
      const response = await axios.get(`${API_URL}/reported-list`, {
        params: { page, limit, batch },
        headers: this.getAuthHeaders(),
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
