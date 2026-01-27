import { authService } from './authService';

const API_URL = 'https://flameawards.in:8082/api/form-processing';

export const formProcessingService = {
    async getPrefillData() {
        const response = await fetch(`${API_URL}/prefill`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch prefill data');
        return response.json();
    },

    async getApplicationStatus() {
        const response = await fetch(`${API_URL}/status`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch application status');
        return response.json();
    }
};
