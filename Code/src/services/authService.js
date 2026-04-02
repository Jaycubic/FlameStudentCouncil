// services/authService.js
import { load } from '@fingerprintjs/fingerprintjs';

// ─── Session-expired overlay (framework-free, works outside React) ────────────
const showSessionExpiredOverlay = () => {
  // Don't double-show
  if (document.getElementById('session-expired-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'session-expired-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Space Grotesk', sans-serif;
  `;

  overlay.innerHTML = `
    <div style="
      background: white;
      border-radius: 24px;
      padding: 48px 40px;
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0,0,0,0.3);
    ">
      <div style="
        width: 64px; height: 64px;
        background: #FFF3CD;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 20px;
        font-size: 28px;
      ">⏱️</div>
      <h2 style="margin: 0 0 10px; font-size: 22px; font-weight: 800; color: #1a202c;">
        Session Expired
      </h2>
      <p style="margin: 0 0 28px; color: #718096; font-size: 15px; line-height: 1.6;">
        Your session has timed out for security reasons.<br/>
        Please log in again to continue.
      </p>
      <button id="session-expired-btn" style="
        background: #3B82F6;
        color: white;
        border: none;
        border-radius: 12px;
        padding: 14px 32px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        width: 100%;
        transition: background 0.2s;
      ">
        Back to Login
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('session-expired-btn').addEventListener('click', () => {
    overlay.remove();
    authService.logout();
    window.location.href = '/login';
  });

  // Auto-redirect after 5 seconds
  setTimeout(() => {
    overlay.remove();
    authService.logout();
    window.location.href = '/login';
  }, 5000);
};

// ─── Global fetch interceptor — catches 401 from ALL services automatically ──
const _originalFetch = window.fetch.bind(window);

window.fetch = async (...args) => {
  const response = await _originalFetch(...args);

  if (response.status === 401) {
    // Clone before reading — response body can only be consumed once
    const cloned = response.clone();
    try {
      const data = await cloned.json();
      const isAuthEndpoint =
        typeof args[0] === 'string' && args[0].includes('/api/auth/');

      // Only intercept session-expired 401s, not login failures
      if (!isAuthEndpoint) {
        showSessionExpiredOverlay();
      }
    } catch {
      showSessionExpiredOverlay();
    }
  }

  return response;
};

// ─────────────────────────────────────────────────────────────────────────────

class AuthService {
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

  async login(email, password) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await _originalFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceId }),
        credentials: 'include',
      });

      const data = await response.json();
      console.log('Server response:', data);

      if (response.ok) {
        if (data.message === 'verify' || data.message === 'redirect') {
          return data;
        } else if (data.message === 'success') {
          localStorage.setItem('expiresAt', data.expiresAt);
          localStorage.setItem('user', JSON.stringify(data.user));
          this.setAutoLogout();
          return data;
        } else {
          throw new Error('Login failed: No token received');
        }
      } else {
        if (data.message === 'Invalid email') throw new Error('Invalid email');
        else if (data.message === 'Invalid password') throw new Error('Invalid password');
        else if (data.message === 'Email is required') throw new Error('Email is required');
        else if (data.message === 'Password is required for admin login') throw new Error('Password is required for admin login');
        else throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      }
      throw error;
    }
  }

  async verifyCode(userId, code) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await _originalFetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code, deviceId }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.message === 'success') {
        localStorage.setItem('expiresAt', data.expiresAt);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.setAutoLogout();
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  async verify2FA(userId, code) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await _originalFetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code, deviceId }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.message === 'success') {
        localStorage.setItem('expiresAt', data.expiresAt);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.setAutoLogout();
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  async resendVerificationCode(userId) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await _originalFetch('/api/auth/resend-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deviceId }),
        credentials: 'include',
      });
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  async googleFastLogin(email) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await _originalFetch('/api/auth/fastlogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, deviceId }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.message === 'success') {
        localStorage.setItem('lastGoogleEmail', email);
        localStorage.setItem('expiresAt', data.expiresAt);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.setAutoLogout();
      }
      return data;
    } catch (error) {
      return { message: 'needs_full_auth' };
    }
  }

  async googleSignIn(email) {
    try {
      const effectiveEmail = email || localStorage.getItem('lastGoogleEmail');

      if (effectiveEmail) {
        const fastResult = await this.googleFastLogin(effectiveEmail);
        if (fastResult.message === 'success') {
          return { type: 'fast_success', ...fastResult };
        }
      }

      const deviceId = await this.getDeviceId();
      const response = await _originalFetch(
        `/api/auth/google?deviceId=${encodeURIComponent(deviceId)}`,
        { method: 'GET', credentials: 'include' }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to initiate Google Sign-In');
      }
      const data = await response.json();
      return data.url;
    } catch (error) {
      throw error;
    }
  }

  async initiateGoogleSignIn(email) {
    try {
      const response = await _originalFetch('/api/auth/initiate-google-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to initiate Google Sign-In');
      return data;
    } catch (error) {
      throw error;
    }
  }

  async verifyGoogleSignInCode(userId, code) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await _originalFetch('/api/auth/verify-google-signin-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code, deviceId }),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to verify code');
      if (data.message === 'redirect') {
        return data;
      } else if (data.message === 'success') {
        localStorage.setItem('expiresAt', data.expiresAt);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.setAutoLogout();
        return data;
      } else {
        throw new Error('Unexpected response');
      }
    } catch (error) {
      throw error;
    }
  }

  async refresh() {
    try {
      const deviceId = await this.getDeviceId();
      const response = await _originalFetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Refresh failed');
      localStorage.setItem('expiresAt', data.expiresAt);
      localStorage.setItem('user', JSON.stringify(data.user));
      this.setAutoLogout();
      return data;
    } catch (error) {
      throw error;
    }
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('expiresAt');
    localStorage.removeItem('awardForm_role');
    localStorage.removeItem('awardForm_agreed');
  }

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated() {
    const user = this.getCurrentUser();
    if (this.isTokenExpired()) {
      this.logout();
      return false;
    }
    return !!user;
  }

  hasRole(roles) {
    const user = this.getCurrentUser();
    return user && roles.includes(user.role);
  }

  isTokenExpired() {
    const expiresAt = localStorage.getItem('expiresAt');
    if (!expiresAt) return true;
    return parseInt(expiresAt, 10) < Date.now() / 1000;
  }

  setAutoLogout() {
    const expiresAt = localStorage.getItem('expiresAt');
    if (expiresAt) {
      const exp = parseInt(expiresAt, 10);
      const now = Date.now() / 1000;
      const timeLeft = (exp - now) * 1000;
      if (timeLeft > 0) {
        setTimeout(() => {
          // Show overlay instead of silently logging out
          showSessionExpiredOverlay();
        }, timeLeft);
      }
    }
  }

  async init() {
    await this.getDeviceId();
    if (this.isTokenExpired()) {
      if (localStorage.getItem('deviceId')) {
        await this.refresh().catch(() => {
          this.logout();
          // Don't show overlay on initial load — just redirect cleanly
          window.location.href = '/login';
        });
      } else {
        this.logout();
      }
    } else {
      this.setAutoLogout();
    }
  }
}

export const authService = new AuthService();