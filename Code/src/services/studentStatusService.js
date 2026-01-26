import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/api/student-status';

class StudentStatusService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found in localStorage');
    }
    return { Authorization: `Bearer ${token}` };
  }

  async getStudentStatusData(page = 1, filters = {}) {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.get(API_URL, {
        params: { page, ...filters },
        headers,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching student status data:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateStudent(id, data) {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.put(`${API_URL}/${id}`, data, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error updating student ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getStudentStatusCounts() {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.get(`${API_URL}/counts`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching student status counts:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const studentStatusService = new StudentStatusService();
