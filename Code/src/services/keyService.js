import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/keys';

const keyService = {
  issueKey: async (studentId) => {
    try {
      const response = await axios.post(`${API_URL}/issue`, { studentId });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to issue key');
    }
  },

  returnKey: async (studentId) => {
    try {
      const response = await axios.post(`${API_URL}/return`, { studentId });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to return key');
    }
  },

  getKeyStatus: async (studentId) => {
    try {
      const response = await axios.get(`${API_URL}/status/${studentId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch key status');
    }
  },
};

export default keyService;
