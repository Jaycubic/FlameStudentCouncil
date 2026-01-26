import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/api'; // Adjust as needed

const DashboardService = {
  getTotalStudents: async () => {
    const response = await axios.get(`${API_URL}/total-students`);
    return response.data.total;
  },
  getGenderBatchCount: async () => {
    const response = await axios.get(`${API_URL}/gender-batch-count`);
    return response.data;
  },
  getRCFilledCount: async () => {
    const response = await axios.get(`${API_URL}/rc-filled-count`);
    return response.data.total;
  },
  getRCCount: async () => {
    const response = await axios.get(`${API_URL}/rc-count`);
    return response.data;
  },
  getCityWithHighest: async () => {
    const response = await axios.get(`${API_URL}/city-highest`);
    return response.data;
  },
  getCityCount: async () => {
    const response = await axios.get(`${API_URL}/city-count`);
    return response.data;
  },
  getInOutCount: async () => {
    const response = await axios.get(`${API_URL}/in-out-count`);
    return response.data;
  },
  getInOutBatchCount: async () => {
    const response = await axios.get(`${API_URL}/in-out-batch-count`);
    return response.data;
  },
};

export default DashboardService;
