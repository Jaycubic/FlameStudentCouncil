// src/services/studentHouseTrackingService.js
import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/students';

const studentHouseTrackingService = {
  getHousingDetails: async (page = 1, filters = {}) => {
    const { search = '', rcName = '', inout = '' } = filters;
    try {
      const response = await axios.get(`${API_URL}/housing-details`, {
        params: { page, search, rcName, inout }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch housing details');
    }
  },

  getTotalCount: async (filters = {}) => {
    const { search = '', rcName = '', inout = '' } = filters;
    try {
      const response = await axios.get(`${API_URL}/total-count`, {
        params: { search, rcName, inout }
      });
      return response.data.total;
    } catch (error) {
      throw new Error('Failed to fetch total student count');
    }
  },

  getRCNames: async () => {
    try {
      const response = await axios.get(`${API_URL}/rc-names`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch RC names');
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

export default studentHouseTrackingService;
