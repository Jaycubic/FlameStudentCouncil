import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/api/organizations';

class OrganizationService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found in localStorage. Authentication may fail.');
    }
    return { Authorization: `Bearer ${token || ''}` };
  }

  async getOrganizations() {
    try {
      const response = await axios.get(API_URL, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getOrganizationById(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createOrganization(organizationData) {
    try {
      const response = await axios.post(API_URL, organizationData, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateOrganization(id, organizationData) {
    try {
      const response = await axios.put(`${API_URL}/${id}`, organizationData, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteOrganization(id) {
    try {
      const response = await axios.delete(`${API_URL}/${id}`, {
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

export const organizationService = new OrganizationService();
