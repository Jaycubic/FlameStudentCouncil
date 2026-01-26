// services/formSubmissionService.js
class FormSubmissionService {
  async create(formData) {
    try {
      const response = await fetch('http://192.168.8.10:8082/api/form-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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