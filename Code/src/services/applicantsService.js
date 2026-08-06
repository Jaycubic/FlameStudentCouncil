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

    async getApplicants({ position = '', search = '', gender = '', batch = '', sortField = '', sortDir = 'asc', page = 1, limit = 50 } = {}) {
        const deviceId = await this.getDeviceId();
        const params = new URLSearchParams({
            position,
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

    async getProfile(id) {
        const deviceId = await this.getDeviceId();
        const res = await fetch(`/api/applicants/profile/${id}`, {
            credentials: 'include',
            headers: { 'x-device-id': deviceId },
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        return res.json();
    }

    async updateApplicant(id, fields) {
        const deviceId = await this.getDeviceId();
        const res = await fetch(`/api/applicants/profile/${id}`, {
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
        return res.json();
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
        return res.json();
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
        return res.json();
    }
}

export const applicantsService = new ApplicantsService();
