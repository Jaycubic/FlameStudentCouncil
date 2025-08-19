// src/services/QueueDashboardService.js
import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/api/queue-dashboard';

class QueueDashboardService {
  // Grab raw token
  getToken() {
    return localStorage.getItem('token');
  }

  // Decode JWT payload
  getDecodedToken() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (e) {
      console.warn('Failed to decode token', e);
      return null;
    }
  }

  // Extract counterId directly from JWT
  getCounterId() {
    const decoded = this.getDecodedToken();
    return decoded?.counterId ?? null;
  }

  // Standard Auth header
  getAuthHeaders() {
    const token = this.getToken();
    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  }

  async createQueue(queueData) {
    const headers = this.getAuthHeaders();
    const res = await axios.post(API_URL, queueData, { headers });
    return res.data;
  }

  async getWaitingQueues() {
    const headers = this.getAuthHeaders();
    const res = await axios.get(`${API_URL}/waiting`, { headers });
    return res.data;
  }

  async getActiveQueues() {
    const headers = this.getAuthHeaders();
    const res = await axios.get(`${API_URL}/active`, { headers });
    return res.data;
  }

  async getActiveQueuesForDashboard() {
    const headers = this.getAuthHeaders();
    const res = await axios.get(`${API_URL}/active-dashboard`, { headers });
    return res.data;
  }

  async getCompletedQueues() {
    const headers = this.getAuthHeaders();
    const res = await axios.get(`${API_URL}/completed`, { headers });
    return res.data;
  }

  async setQueueOn(id) {
    const headers = this.getAuthHeaders();
    const res = await axios.put(`${API_URL}/${id}/on`, {}, { headers });
    return res.data;
  }

  async setQueueOff(id) {
    const headers = this.getAuthHeaders();
    const res = await axios.put(`${API_URL}/${id}/off`, {}, { headers });
    return res.data;
  }

  async deleteQueue(id) {
    const headers = this.getAuthHeaders();
    const res = await axios.delete(`${API_URL}/${id}`, { headers });
    return res.data;
  }

  async getDepartmentCounters() {
    const headers = this.getAuthHeaders();
    const res = await axios.get(`${API_URL}/counters`, { headers });
    return res.data;
  }

  async moveQueueToCounter(id, newCounterId) {
    const headers = this.getAuthHeaders();
    const res = await axios.put(`${API_URL}/${id}/move`, { newCounterId }, { headers });
    return res.data;
  }

  async getWaitingQueuesSpecial() {
    const headers = this.getAuthHeaders();
    const res = await axios.get(`${API_URL}/waiting-special`, { headers });
    return res.data;
  }

  async getActiveQueuesSpecial() {
    const headers = this.getAuthHeaders();
    const res = await axios.get(`${API_URL}/active-special`, { headers });
    return res.data;
  }
}

export const queueDashboardService = new QueueDashboardService();
