// src/services/applicantsService.js
import { load } from '@fingerprintjs/fingerprintjs';

class ApplicantsService {
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

    async getApplicants({ awardType = 'all', search = '', gender = '', batch = '', sortField = '', sortDir = 'asc', page = 1, limit = 50 } = {}) {
        const deviceId = await this.getDeviceId();
        const params = new URLSearchParams({
            award_type: awardType,
            search,
            gender,
            batch,
            sort_field: sortField,
            sort_dir:   sortDir,
            page,
            limit,
        });
        const res = await fetch(`/api/applicants?${params}`, {
            credentials: 'include',
            headers: { 'x-device-id': deviceId },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Server error ${res.status}`);
        }
        return res.json();
    }
}

export const applicantsService = new ApplicantsService();
