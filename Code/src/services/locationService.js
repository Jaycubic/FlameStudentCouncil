import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/api/locations';

class LocationService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found in localStorage. Authentication may fail.');
    }
    return { Authorization: `Bearer ${token || ''}` };
  }

  async getLocations() {
    try {
      const response = await axios.get(API_URL, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getLocationById(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createLocation(locationData) {
    try {
      const response = await axios.post(API_URL, locationData, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateLocation(id, locationData) {
    try {
      const response = await axios.put(`${API_URL}/${id}`, locationData, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteLocation(id) {
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

export const locationService = new LocationService();
