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
    async getProfile(awardType, id) {
        const deviceId = await this.getDeviceId();
        const res = await fetch(`/api/applicants/profile/${awardType}/${id}`, {
            credentials: 'include',
            headers: { 'x-device-id': deviceId },
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        return res.json();
    }

    async updateApplicant(awardType, id, fields) {
        const deviceId = await this.getDeviceId();
        const res = await fetch(`/api/applicants/profile/${awardType}/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'x-device-id': deviceId,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fields),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Server error ${res.status}`);
        }
        return res.json();
    }

    // Returns a URL suitable for <img src> — goes through authenticated proxy
    getFileUrl(fileType, fileName) {
        if (!fileName) return null;
        return `/api/applicants/file/${fileType}/${encodeURIComponent(fileName)}`;
    }

    // ── Workbook methods ──────────────────────────────────────────────────────

    async openWorkbook() {
        const deviceId = await this.getDeviceId();
        const res = await fetch('/api/awards-workbook/open', {
            credentials: 'include',
            headers: { 'x-device-id': deviceId },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Server error ${res.status}`);
        }
        return res.json();   // { success, isNew, url, workbook_id }
    }

    async syncFromCloud() {
        const deviceId = await this.getDeviceId();
        const res = await fetch('/api/awards-workbook/sync-from-cloud', {
            method: 'POST',
            credentials: 'include',
            headers: { 'x-device-id': deviceId },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Server error ${res.status}`);
        }
        return res.json();   // { success, updated, skipped, total }
    }

    async syncToCloud() {
        const deviceId = await this.getDeviceId();
        const res = await fetch('/api/awards-workbook/sync-to-cloud', {
            method: 'POST',
            credentials: 'include',
            headers: { 'x-device-id': deviceId },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Server error ${res.status}`);
        }
        return res.json();   // { success, tabs_updated }
    }
}

export const applicantsService = new ApplicantsService();
