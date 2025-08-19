import axios from 'axios';

const API_URL = 'https://flamestudentcouncil.in:5050/legal-documents';

class LegalDocumentService {
  // Fetch all legal documents
  async getAllDocuments() {
    try {
      const response = await axios.get(API_URL);
      return response.data;
    } catch (error) {
      console.error('Error fetching all legal documents:', error);
      throw error;
    }
  }

  // Fetch a specific document by type (used in Settings.jsx)
  async getDocumentByType(type) {
    try {
      const response = await axios.get(API_URL);
      const documents = response.data;
      const document = documents.find(doc => doc.type === type);
      return document ? document.content : null;
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      throw error;
    }
  }

  // Fetch a specific document by ID
  async getDocumentById(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching document with ID ${id}:`, error);
      throw error;
    }
  }

  // Create a new legal document
  async saveDocument(type, content) {
    try {
      const response = await axios.post(API_URL, { type, content });
      return response.data;
    } catch (error) {
      console.error('Error saving legal document:', error);
      throw error;
    }
  }

  // Update an existing legal document
  async updateDocument(id, type, content) {
    try {
      const response = await axios.patch(`${API_URL}/${id}`, { type, content });
      return response.data;
    } catch (error) {
      console.error(`Error updating document with ID ${id}:`, error);
      throw error;
    }
  }

  // Delete a legal document
  async deleteDocument(id) {
    try {
      const response = await axios.delete(`${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting document with ID ${id}:`, error);
      throw error;
    }
  }
}

export const legalDocumentService = new LegalDocumentService();
