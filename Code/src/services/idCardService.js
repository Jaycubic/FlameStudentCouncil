import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/api/pdf';

const idCardService = {
  generatePDF: async (studentIds) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      // Ensure IDs are integers
      const parsedStudentIds = studentIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (parsedStudentIds.length === 0) {
        throw new Error('No valid student IDs provided');
      }
      const response = await axios.post(`${API_URL}/generate`, { studentIds: parsedStudentIds }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to generate PDF');
    }
  },
};

export default idCardService;
