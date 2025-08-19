// services/authService.js

function getCookie(name) {
  let matches = document.cookie.match(new RegExp(
    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
  ));
  return matches ? decodeURIComponent(matches[1]) : null;
}

function setCookie(name, value, expiresInSeconds) {
  let expires = "";
  if (expiresInSeconds > 0) {
    let date = new Date();
    date.setTime(date.getTime() + (expiresInSeconds * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

function deleteCookie(name) {
  setCookie(name, "", -1);
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    throw new Error('Invalid token');
  }
}

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
          const now = Math.floor(Date.now() / 1000);
          const expiresIn = data.expiresAt - now;
          setCookie('token', data.token, expiresIn);
          setCookie('user', JSON.stringify(data.user), expiresIn);
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
    deleteCookie('token');
    deleteCookie('user');
  }

  getCurrentUser() {
    const user = getCookie('user');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated() {
    const token = getCookie('token');
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
    const token = getCookie('token');
    if (!token) return true;
    try {
      const decoded = parseJwt(token);
      return decoded.exp < Math.floor(Date.now() / 1000);
    } catch (e) {
      return true;
    }
  }

  setAutoLogout() {
    const token = getCookie('token');
    if (token) {
      try {
        const decoded = parseJwt(token);
        const timeLeft = (decoded.exp * 1000) - Date.now();
        if (timeLeft > 0) {
          setTimeout(() => {
            this.logout();
          }, timeLeft);
        } else {
          this.logout();
        }
      } catch (e) {
        this.logout();
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