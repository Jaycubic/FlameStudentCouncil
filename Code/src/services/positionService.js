// frontend/services/positionService.js
class PositionService {
  constructor() {
    // change baseUrl if your API path differs
    this.baseUrl = 'https://flamestudentcouncil.in:5050/api/positions';
  }

  _getAuthHeaders() {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async fetchPositions(limit = 50, offset = 0) {
    const url = `${this.baseUrl}?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: this._getAuthHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to fetch positions');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async fetchPosition(id) {
    try {
      const resp = await fetch(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: this._getAuthHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to fetch position');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async createPosition(payload) {
    try {
      const resp = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        // pass detailed error messages
        throw new Error(data.message || 'Failed to create position');
      }
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async updatePosition(id, payload) {
    try {
      const resp = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: this._getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to update position');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }

  async deletePosition(id) {
    try {
      const resp = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: this._getAuthHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to delete position');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw err;
    }
  }
}

export const positionService = new PositionService();
