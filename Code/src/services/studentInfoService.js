import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/students';

const studentInfoService = {
  getStudents: async (page = 1, filters = {}) => {
    try {
      const response = await axios.get(`${API_URL}/student-info`, {
        params: { page, ...filters }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch students');
    }
  },

  getTotalCount: async (filters = {}) => {
    try {
      const response = await axios.get(`${API_URL}/total-count`, {
        params: filters
      });
      return response.data.total;
    } catch (error) {
      throw new Error('Failed to fetch total student count');
    }
  },

  getBatches: async () => {
    try {
      const response = await axios.get(`${API_URL}/batches`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch batches');
    }
  },

  createStudent: async (studentData) => {
    try {
      const response = await axios.post(`${API_URL}`, studentData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to create student');
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

  getStudentPhoto: async (photoId) => {
    try {
      const response = await axios.get(`${API_URL}/photos/${photoId}`, {
        responseType: 'blob' // Expecting an image file
      });
      return URL.createObjectURL(response.data); // Convert blob to URL for frontend use
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch student photo');
    }
  },

  uploadStudentPhoto: async (photoId, file) => {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const response = await axios.post(`${API_URL}/photos/${photoId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to upload photo');
    }
  },
};

export default studentInfoService;
