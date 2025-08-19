// services/formSubmissionService.js
class FormSubmissionService {
  async create(formData) {
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/form-submissions', {
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