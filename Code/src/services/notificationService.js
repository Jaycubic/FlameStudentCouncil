import axios from 'axios';

const API_URL = 'http://192.168.8.10:8082/api/activity-tracker';

// Helper function to get the Authorization header with the token
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const notificationService = {
  getNotifications: async () => {
    try {
      const response = await axios.get(API_URL, { headers: getAuthHeaders() });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch notifications');
    }
  },
  markNotificationAsRead: async (activityId) => {
    try {
      await axios.put(`${API_URL}/mark-read/${activityId}`, {}, { headers: getAuthHeaders() });
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to mark notification as read');
    }
  },
  clearNotification: async (activityId) => {
    try {
      await axios.put(`${API_URL}/clear/${activityId}`, {}, { headers: getAuthHeaders() });
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to clear notification');
    }
  },
  markAllAsRead: async (activityIds) => {
    try {
      await axios.put(`${API_URL}/mark-read`, { activityIds }, { headers: getAuthHeaders() });
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to mark all as read');
    }
  },
  clearAll: async (activityIds) => {
    try {
      await axios.put(`${API_URL}/clear`, { activityIds }, { headers: getAuthHeaders() });
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to clear all notifications');
    }
  },
};

export default notificationService;
