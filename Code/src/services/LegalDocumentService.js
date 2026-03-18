import axios from 'axios';
import { load } from '@fingerprintjs/fingerprintjs';

const API_URL = '/api/legal-documents';

class LegalDocumentService {
  async getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      const fp = await load();
      const result = await fp.get();
      deviceId = result.visitorId;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  async fetchWithAuth(method, url, options = {}) {
    const deviceId = await this.getDeviceId();
    const config = {
      method,
      url: url.startsWith('http') ? url : `${API_URL}${url}`,
      headers: {
        ...options.headers,
        'x-device-id': deviceId,
      },
      params: options.params,
      data: options.data,
      withCredentials: true,
    };
    return axios(config);
  }

  async getAllDocuments() {
    try {
      const response = await this.fetchWithAuth('get', '');
      return response.data;
    } catch (error) {
      console.error('Error fetching all legal documents:', error);
      throw error;
    }
  }

  async getDocumentByType(type) {
    try {
      const response = await this.fetchWithAuth('get', '');
      const documents = response.data;
      const document = documents.find(doc => doc.type === type);
      return document ? document.content : null;
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      throw error;
    }
  }

  async getDocumentById(id) {
    try {
      const response = await this.fetchWithAuth('get', `/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching document with ID ${id}:`, error);
      throw error;
    }
  }

  async saveDocument(type, content) {
    try {
      const response = await this.fetchWithAuth('post', '', { data: { type, content } });
      return response.data;
    } catch (error) {
      console.error('Error saving legal document:', error);
      throw error;
    }
  }

  async updateDocument(id, type, content) {
    try {
      const response = await this.fetchWithAuth('patch', `/${id}`, { data: { type, content } });
      return response.data;
    } catch (error) {
      console.error(`Error updating document with ID ${id}:`, error);
      throw error;
    }
  }

  async deleteDocument(id) {
    try {
      const response = await this.fetchWithAuth('delete', `/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting document with ID ${id}:`, error);
      throw error;
    }
  }
}

export const legalDocumentService = new LegalDocumentService();
