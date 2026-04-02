// services/formSubmissionService.js
import { load } from '@fingerprintjs/fingerprintjs';

class FormSubmissionService {
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

  async handleResponse(response) {
    const contentType = response.headers.get('Content-Type');
    const isJson = contentType && contentType.includes('application/json');

    if (!response.ok) {
      if (isJson) {
        const data = await response.json();
        throw new Error(data.message || `Error ${response.status}: Submission failed`);
      } else {
        // Handle non-JSON errors (like Nginx 502/504 HTML pages)
        if (response.status === 502 || response.status === 504) {
          throw new Error('The server is temporarily busy or unreachable. Please wait a moment and try again.');
        } else if (response.status === 413) {
          throw new Error('The files you are trying to upload are too large.');
        } else {
          throw new Error(`Server returned an error (${response.status}). Please try again later.`);
        }
      }
    }

    return isJson ? response.json() : response;
  }

  async create(formData) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await fetch('/api/form-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId
        },
        body: JSON.stringify(formData),
        credentials: 'include',
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Network issue: Please check your internet connection and try again.');
      }
      throw error;
    }
  }

  async submit(formData) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await fetch('/api/form-submissions/submit', {
        method: 'POST',
        headers: { 'x-device-id': deviceId },
        body: formData, // No Content-Type header needed for FormData
        credentials: 'include'
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Network issue: Please check your internet connection and try again.');
      }
      throw error;
    }
  }
}

export const formSubmissionService = new FormSubmissionService();