import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/api/counters';

class CounterService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found in localStorage');
    }
    return { Authorization: `Bearer ${token}` };
  }

  async getCounters() {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.get(API_URL, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching counters:', error.response?.data || error.message);
      throw error;
    }
  }

  async createCounter(counterData) {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.post(API_URL, counterData, { headers });
      return response.data;
    } catch (error) {
      console.error('Error creating counter:', error.response?.data || error.message);
      throw error;
    }
  }

  async getCounterById(id) {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.get(`${API_URL}/${id}`, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error fetching counter ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async updateCounter(id, counterData) {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.put(`${API_URL}/${id}`, counterData, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error updating counter ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async deleteCounter(id) {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.delete(`${API_URL}/${id}`, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error deleting counter ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

export const counterService = new CounterService();
