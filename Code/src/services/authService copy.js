// services/authService.js
class AuthService {
  async login(email, password) {
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log('Server response:', data);

      if (response.ok) {
        if (data.message === 'verify' || data.message === 'redirect') {
          return data;
        } else if (data.message === 'success') {
          localStorage.setItem('token', data.token);
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

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('expiresAt');
  }

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated() {
    const token = localStorage.getItem('token');
    const user = this.getCurrentUser();
    if (this.isTokenExpired()) {
      this.logout();
      return false;
    }
    return !!token && !!user;
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

  init() {
    if (this.isTokenExpired()) {
      this.logout();
    } else {
      this.setAutoLogout();
    }
  }
}

export const authService = new AuthService();
