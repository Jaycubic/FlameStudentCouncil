import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/students';

const ParentInfoService = {
  getParentDetails: async (page = 1, filters = {}) => {
    const { search = '' } = filters;
    try {
      const response = await axios.get(`${API_URL}/parents-info`, {
        params: { page, search }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch parent details');
    }
  },

  getTotalCount: async (filters = {}) => {
    const { search = '' } = filters;
    try {
      const response = await axios.get(`${API_URL}/total-count`, {
        params: { search }
      });
      return response.data.total;
    } catch (error) {
      throw new Error('Failed to fetch total student count');
    }
  },

  updateStudent: async (id, updateData) => {
    try {
      const response = await axios.patch(`${API_URL}/${id}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update student');
    }
  },

  deleteStudent: async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete student');
    }
  },
};

export default ParentInfoService;
