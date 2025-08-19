// src/services/photoService.js
import axios from 'axios';

const BASE_API = process.env.REACT_APP_API_BASE || 'https://flamestudentcouncil.in:5050';

function getCookie(name) {
  let matches = document.cookie.match(new RegExp(
    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
  ));
  return matches ? decodeURIComponent(matches[1]) : null;
}

class PhotoService {
  getAuthHeaders() {
    const token = getCookie('token');
    if (!token) {
      console.warn('PhotoService: no token found in cookie');
    }
    return {
      Authorization: token ? `Bearer ${token}` : '',
    };
  }

  /**
   * Upload a photo file (multipart/form-data).
   * Expects backend endpoint: POST {BASE_API}/api/users/photo
   * Returns an object with { filename } or the axios response data.
   */
  async uploadPhoto(file) {
    if (!file) throw new Error('No file provided');

    const form = new FormData();
    form.append('photo', file);

    const headers = {
      ...this.getAuthHeaders(),
      'Content-Type': 'multipart/form-data',
    };

    try {
      // Adjust endpoint if your backend expects a different path
      const resp = await axios.post(`${BASE_API}/api/users/photo`, form, { headers, timeout: 20000 });
      // typical response: { filename: 'abc123' } or resp.data
      return resp.data;
    } catch (err) {
      // Surface backend error if present
      const message = err.response?.data || err.message;
      console.error('Photo upload failed:', message);
      throw err;
    }
  }

  /**
   * Delete a photo on backend (if supported).
   * Expects DELETE {BASE_API}/api/users/photo/:filename
   */
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
   * Return the same-origin proxied URL that your frontend server exposes.
   * (frontend server proxies /photos/:filename -> backend)
   */
  getPhotoUrl(filename) {
    if (!filename) return null;
    return `/photos/${filename}.jpg`;
  }
}

export const photoService = new PhotoService();
export default photoService;