import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/api/reports';
const STUDENTS_API_URL = 'http://192.168.8.10:8082/students';

class ReportService {
  async getReportData(page = 1, filters = {}) {
    const params = { page, ...filters };
    try {
      const response = await axios.get(`${API_URL}/data`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching report data:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateReportData(id, data) {
    try {
      const response = await axios.put(`${API_URL}/data/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating report data for student ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getBatches() {
    try {
      const response = await axios.get(`${STUDENTS_API_URL}/batches`);
      return response.data;
    } catch (error) {
      console.error('Error fetching batches:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const reportService = new ReportService();
