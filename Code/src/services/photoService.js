// src/services/photoService.js
import axios from 'axios';

const BASE_API = process.env.REACT_APP_API_BASE || 'https://flamestudentcouncil.in:5050';

class PhotoService {
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      Authorization: token ? `Bearer ${token}` : '',
    };
  }

  async uploadPhoto(file) {
    if (!file) throw new Error('No file provided');
    const form = new FormData();
    form.append('photo', file);

    const headers = {
      ...this.getAuthHeaders(),
      'Content-Type': 'multipart/form-data',
    };

    try {
      const resp = await axios.post(`${BASE_API}/api/users/photo`, form, { headers, timeout: 20000 });
      return resp.data;
    } catch (err) {
      console.error('Photo upload failed:', err.response?.data || err.message);
      throw err;
    }
  }

  async deletePhoto(filename) {
    if (!filename) throw new Error('No filename provided');
    const headers = this.getAuthHeaders();
    try {
      const resp = await axios.delete(`${BASE_API}/api/users/photo/${encodeURIComponent(filename)}`, { headers });
      return resp.data;
    } catch (err) {
      console.error('Photo delete failed:', err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * Return a browser-fetchable URL. The backend returns the filename WITH extension
   * (e.g. 123.jpg) so just return /photos/<filename>.
   */
  getPhotoUrl(filename) {
    if (!filename) return null;
    // if the filename already includes an extension, return as-is
    return `/photos/${filename}`;
  }
}

export const photoService = new PhotoService();
export default photoService;
