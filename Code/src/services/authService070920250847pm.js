class AuthService {

  async login(email, password) {
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log('Server response:', data); // Log the raw server response

      if (response.ok) {
        if (data.message === 'verify' || data.message === 'redirect') {
          return data; // Return data for verification or redirect
        } else if (data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          this.setAutoLogout(); // Set auto-logout timer after storing token
          return data.user;
        } else {
          throw new Error('Login failed: No token received');
        }
      } else {
        // Handle specific error messages from server
        if (data.message === 'Invalid email') {
          throw new Error('Invalid email');
        } else if (data.message === 'Invalid password') {
          throw new Error('Invalid password');
        } else if (data.message === 'Email is required') {
          throw new Error('Email is required');
        } else if (data.message === 'Password is required for admin login') {
          throw new Error('Password is required for admin login');
        } else if (data.message === 'Non-admin users must use Google Sign-In') {
          throw new Error('Non-admin users must use Google Sign-In');
        } else {
          throw new Error(data.message || 'Login failed');
        }
      }
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('Network error, please check your connection');
      } else {
        throw error; // Rethrow specific errors
      }
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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

  getTokenExpiration(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp;
    } catch (e) {
      return null;
    }
  }

  isTokenExpired() {
    const token = localStorage.getItem('token');
    if (!token) return true;
    const exp = this.getTokenExpiration(token);
    if (!exp) return true;
    return exp < Date.now() / 1000;
  }

  setAutoLogout() {
    const token = localStorage.getItem('token');
    if (token) {
      const exp = this.getTokenExpiration(token);
      if (exp) {
        const now = Date.now() / 1000;
        const timeLeft = (exp - now) * 1000;
        if (timeLeft > 0) {
          setTimeout(() => {
            this.logout();
          }, timeLeft);
        }
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
