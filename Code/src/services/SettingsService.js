import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/api/settings';

class SettingsService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found in localStorage');
    }
    return { Authorization: `Bearer ${token}` };
  }

  async getAllRolesWith2FA() {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.get(`${API_URL}/roles-with-2fa`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching roles with 2FA:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateSettingForRole(roleId, settingKey, settingValue) {
    const headers = this.getAuthHeaders();
    try {
      const response = await axios.put(`${API_URL}/roles/${roleId}/${settingKey}`, { settingValue }, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error updating setting for role ${roleId}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

export const settingsService = new SettingsService();
