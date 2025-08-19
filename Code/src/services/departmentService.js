import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/api/departments';

function getCookie(name) {
  let matches = document.cookie.match(new RegExp(
    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
  ));
  return matches ? decodeURIComponent(matches[1]) : null;
}

class DepartmentService {
  getAuthHeaders() {
    const token = getCookie('token');
    if (!token) {
      console.warn('No token found in cookie. Authentication may fail.');
    }
    return { Authorization: `Bearer ${token || ''}` };
  }

  async getDepartments() {
    try {
      const response = await axios.get(API_URL, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getDepartmentById(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createDepartment(departmentData) {
    try {
      const response = await axios.post(API_URL, departmentData, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateDepartment(id, departmentData) {
    try {
      const response = await axios.put(`${API_URL}/${id}`, departmentData, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteDepartment(id) {
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

export const departmentService = new DepartmentService();