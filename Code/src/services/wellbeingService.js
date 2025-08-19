// src/services/wellbeingService.js
import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/api/wellbeing-form';

class WellbeingService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  async getAll() {
    const headers = this.getAuthHeaders();
    const res = await axios.get(API_URL, { headers });
    return res.data;
  }

  async getById(id) {
    const headers = this.getAuthHeaders();
    const res = await axios.get(`${API_URL}/${id}`, { headers });
    return res.data;
  }

  async update(id, data) {
    const headers = this.getAuthHeaders();
    const res = await axios.put(`${API_URL}/${id}`, data, { headers });
    return res.data;
  }

  async delete(id) {
    const headers = this.getAuthHeaders();
    const res = await axios.delete(`${API_URL}/${id}`, { headers });
    return res.data;
  }
}

export default new WellbeingService();
