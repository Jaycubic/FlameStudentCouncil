// services/authService.js 
import { load } from '@fingerprintjs/fingerprintjs';

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
      const response = await fetch('/api/auth/login', {
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
        if (data.message === 'Invalid email') {
          throw new Error('Invalid email');
        } else if (data.message === 'Invalid password') {
          throw new Error('Invalid password');
        } else if (data.message === 'Email is required') {
          throw new Error('Email is required');
        } else if (data.message === 'Password is required for admin login') {
          throw new Error('Password is required for admin login');
        } else {
          throw new Error(data.message || 'Login failed');
        }
      }
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      } else {
        throw error;
      }
    }
  }

  async verifyCode(userId, code) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await fetch('/api/auth/verify-code', {
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
      const response = await fetch('/api/auth/verify-2fa', {
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
      const response = await fetch('/api/auth/resend-verification-code', {
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

  // Fast-login for returning students — skips Google OAuth redirect if refresh token is valid
  async googleFastLogin(email) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await fetch('/api/auth/google-fast-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, deviceId }),
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
      return { message: 'needs_full_auth' };
    }
  }

  async googleSignIn(email) {
    try {
      if (email) {
        const fastResult = await this.googleFastLogin(email);
        if (fastResult.message === 'success') {
          return { type: 'fast_success', ...fastResult };
        }
      }

      const deviceId = await this.getDeviceId();
      const response = await fetch(`/api/auth/google?deviceId=${encodeURIComponent(deviceId)}`, {
        method: 'GET',
        credentials: 'include',
      });
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
      const response = await fetch('/api/auth/initiate-google-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate Google Sign-In');
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  async verifyGoogleSignInCode(userId, code) {
    try {
      const deviceId = await this.getDeviceId();
      const response = await fetch('/api/auth/verify-google-signin-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code, deviceId }),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify code');
      }
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
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Refresh failed');
      }
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
          this.logout();
        }, timeLeft);
      }
    }
  }

  async init() {
    await this.getDeviceId(); // Ensure deviceId is generated
    if (this.isTokenExpired()) {
      if (localStorage.getItem('deviceId')) { // Check if we have deviceId instead of refreshToken
        await this.refresh().catch(() => this.logout());
      } else {
        this.logout();
      }
    } else {
      this.setAutoLogout();
    }
  }
}

export const authService = new AuthService();