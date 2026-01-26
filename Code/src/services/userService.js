import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/api/users';
const EMPLOYEE_API_URL = 'http://192.168.8.10:8082/employee';

class UserService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    console.log('Retrieved token from localStorage:', token);
    if (!token) {
      console.warn('No token found in localStorage');
    }
    return { Authorization: `Bearer ${token}` };
  }

  async getUsers() {
    const headers = this.getAuthHeaders();
    console.log('Sending request with headers:', headers);
    try {
      const response = await axios.get(API_URL, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error.response?.data || error.message);
      throw error;
    }
  }

  async getUserById(id) {
    const headers = this.getAuthHeaders();
    console.log('Fetching user by ID with headers:', headers);
    try {
      const response = await axios.get(`${API_URL}/${id}`, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error fetching user ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async createUser(userData) {
    const headers = this.getAuthHeaders();
    console.log('Creating user with headers:', headers);
    try {
      const response = await axios.post(API_URL, userData, { headers });
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateUser(id, userData) {
    const headers = this.getAuthHeaders();
    console.log('Updating user with headers:', headers);
    try {
      const response = await axios.put(`${API_URL}/${id}`, userData, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async deleteUser(id) {
    const headers = this.getAuthHeaders();
    console.log('Deleting user with headers:', headers);
    try {
      const response = await axios.delete(`${API_URL}/${id}`, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getEmployeeByCode(code) {
    const headers = this.getAuthHeaders();
    console.log('Fetching employee by code with headers:', headers);
    try {
      const response = await axios.get(`${EMPLOYEE_API_URL}?code=${encodeURIComponent(code)}`, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error fetching employee with code ${code}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getRCUsernames() {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.get(`${API_URL}/rc-usernames`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching RC usernames:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const userService = new UserService();
