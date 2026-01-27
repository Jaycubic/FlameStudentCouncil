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

  async create(formData) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await fetch('https://flameawards.in:8082/api/form-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId
        },
        body: JSON.stringify(formData),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        return data;
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch (error) {
      throw error;
    }
  }
}

export const formSubmissionService = new FormSubmissionService();