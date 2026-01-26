import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/students';

const TrackingInfoService = {
  getTrackingDetails: async (page = 1, filters = {}) => {
    const { search = '', inout = '' } = filters;
    try {
      const response = await axios.get(`${API_URL}/tracking-info`, {
        params: { page, search, inout }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch tracking details');
    }
  },

  getTotalCount: async (filters = {}) => {
    const { search = '', inout = '' } = filters;
    try {
      const response = await axios.get(`${API_URL}/total-count`, {
        params: { search, inout }
      });
      return response.data.total;
    } catch (error) {
      throw new Error('Failed to fetch total tracking count');
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

export default TrackingInfoService;
