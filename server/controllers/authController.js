// controllers/authController.js
const { User, Role, RoleSetting, StudentData } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const redis = require('redis');
const { Op } = require('sequelize');
require('dotenv').config();

// Redis client setup
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});
redisClient.connect().catch(console.error);

// Google OAuth2 factory — each request gets its own client to prevent
// token contamination under concurrent load (50-100 simultaneous logins)
const createOAuth2Client = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Generate alphanumeric verification code
const generateVerificationCode = (length = 6) => {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += characters[bytes[i] % characters.length];
  }
  return result;
};

// Send verification email
const sendVerificationEmail = async (email, code) => {
  try {
    await transporter.sendMail({
      from: `"FLAME Awards" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      html: `
        <h2>FLAME Awards Verification Code</h2>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('❌ Email sending error:', error);
    return false;
  }
};

// Generate 2FA secret
const generate2FASecret = () => {
  return speakeasy.generateSecret({ length: 20 });
};

// Fetch 2FA setting from RoleSetting based on role_id
const get2FASettingForRole = async (roleId) => {
  const setting = await RoleSetting.findOne({
    where: {
      role_id: roleId,
      setting_key: '2fa_enabled'
    }
  });
  return setting ? setting.setting_value === 'true' : false;
};

// Verify 2FA code
const verify2FACode = (secret, code) => {
  return speakeasy.totp.verify({
    secret: secret.base32,
    encoding: 'base32',
    token: code,
    window: 1,
  });
};

// Device fingerprint hashing function
const getFingerprintHash = (deviceId, userAgent, salt) => {
  const raw = `${deviceId}|${userAgent}|${salt}`;
  return CryptoJS.SHA256(raw).toString();
};

// Generate encrypted access JWT with fingerprint and expiration
const generateEncryptedAccessToken = (user, roleName, req, deviceIdOverride = null) => {
  const deviceId = deviceIdOverride || req.body.deviceId || req.headers['x-device-id'] || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const fingerprintHash = getFingerprintHash(deviceId, userAgent, user.id.toString());
  const payload = {
    userId: user.id,
    email: user.email,
    role: roleName,
    fpHash: fingerprintHash
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '45m' });
  const decoded = jwt.decode(token);
  const exp = decoded.exp;
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  }
  const encryptedToken = CryptoJS.AES.encrypt(token, process.env.TOKEN_ENCRYPTION_KEY).toString();
  return { encryptedToken, exp, fingerprintHash };
};

// Generate refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_TIME = 7200; // 2 hours in seconds
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_LOCK_TIME = 7200; // 2 hours
const MAX_2FA_ATTEMPTS = 5;
const _2FA_LOCK_TIME = 7200; // 2 hours

const authController = {
  async register(req, res) {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      const defaultRole = await Role.findOne({ where: { name: 'user' } });
      if (!defaultRole) {
        return res.status(500).json({ message: 'Default role not found' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        username,
        email,
        password: hashedPassword,
        role_id: defaultRole.id,
        created_at: new Date(),
        updated_at: new Date()
      });
      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Error registering user', error: error.message });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      console.log('Login attempt for email:', email);
      if (!email) {
        console.log('Email is required');
        return res.status(400).json({ message: 'Email is required' });
      }
      const lockKey = `lock:login:${email.toLowerCase()}`;
      const isLocked = await redisClient.exists(lockKey);
      if (isLocked) {
        console.log('Account locked for email:', email);
        return res.status(403).json({ message: 'Account locked due to multiple failed attempts.' });
      }
      console.log('Searching for user with email:', email);
      const user = await User.findOne({
        where: { email }
      });
      console.log('User found:', !!user);
      if (user) {
        console.log('User role_id:', user.role_id);
      }
      const attemptKey = `attempt:login:${email.toLowerCase()}`;
      if (!user) {
        console.log('User not found for email:', email);
        // Mitigate timing attacks
        await bcrypt.compare('dummy', '$2b$10$dummyhash');
        let attempts = await redisClient.incr(attemptKey);
        if (attempts === 1) {
          await redisClient.expire(attemptKey, 3600);
        }
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          await redisClient.set(lockKey, 'locked', { EX: LOGIN_LOCK_TIME });
          await redisClient.del(attemptKey);
          console.log('Locked account after max attempts for email:', email);
        }
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const role = await Role.findByPk(user.role_id);
      console.log('Loaded Role:', role ? role.name : 'null');
      if (!role) {
        console.log('Role not found for id:', user.role_id);
        let attempts = await redisClient.incr(attemptKey);
        if (attempts === 1) {
          await redisClient.expire(attemptKey, 3600);
        }
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          await redisClient.set(lockKey, 'locked', { EX: LOGIN_LOCK_TIME });
          await redisClient.del(attemptKey);
          console.log('Locked account after max attempts for email:', email);
        }
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      console.log('User role:', role.name);
      if (role.name !== 'admin' && role.name !== 'SportsVisitingFaculty' && role.name !== 'SportsFaculty') {
        console.log('Google sign-in required for role:', role.name);
        return res.status(403).json({ message: 'Please use Google Sign-In for your role' });
      }
      if (role.name === 'admin' || role.name === 'SportsVisitingFaculty' || role.name === 'SportsFaculty') {
        if (!password) {
          console.log('Password required for role:', role.name);
          return res.status(400).json({ message: 'Password is required for this role' });
        }
        if (!user.password) {
          console.log('User has no password set:', user.id);
          return res.status(400).json({ message: 'Password has not been set for this account. Please contact an administrator.' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        console.log('Hashed password comparison result:', isValidPassword);
        if (!isValidPassword) {
          console.log('Invalid password for user:', user.id);
          let attempts = await redisClient.incr(attemptKey);
          if (attempts === 1) {
            await redisClient.expire(attemptKey, 3600);
          }
          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            await redisClient.set(lockKey, 'locked', { EX: LOGIN_LOCK_TIME });
            await redisClient.del(attemptKey);
            console.log('Locked account after max attempts for email:', email);
          }
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Reset attempts on success
        await redisClient.del(attemptKey);
        console.log('Successful password validation for user:', user.id);
        const verificationCode = generateVerificationCode();
        const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
        const hashedCode = await bcrypt.hash(verificationCode, 10);
        await user.update({
          verification_token: hashedCode,
          token_expires: tokenExpires,
          updated_at: new Date()
        });
        console.log('Generated verification code for user:', user.id);
        const emailSent = await sendVerificationEmail(email, verificationCode);
        if (!emailSent) {
          console.log('Failed to send verification email for user:', user.id);
          return res.status(500).json({ message: 'Failed to send verification email' });
        }
        console.log('Verification email sent successfully for user:', user.id);
        return res.json({
          message: 'verify',
          email,
          userId: user.id,
        });
      } else {
        console.log('Unsupported role for login method:', role.name);
        return res.status(403).json({ message: 'Unsupported role for this login method' });
      }
    } catch (error) {
      console.error('Login error:', error.stack || error);
      res.status(500).json({ message: 'Error logging in', error: error.message });
    }
  },

  async verifyCode(req, res) {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ message: 'User ID and code are required' });
    }
    try {
      const lockKey = `lock:verify:${userId}`;
      const isLocked = await redisClient.exists(lockKey);
      if (isLocked) {
        return res.status(403).json({ message: 'Too many failed attempts. Please try again in 2 hours.' });
      }
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const role = await Role.findByPk(user.role_id);
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      const attemptKey = `attempt:verify:${userId}`;
      if (!user.verification_token || !(await bcrypt.compare(code, user.verification_token))) {
        let attempts = await redisClient.incr(attemptKey);
        if (attempts === 1) {
          await redisClient.expire(attemptKey, 3600);
        }
        if (attempts >= MAX_VERIFY_ATTEMPTS) {
          await redisClient.set(lockKey, 'locked', { EX: VERIFY_LOCK_TIME });
          await redisClient.del(attemptKey);
        }
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      if (!user.token_expires || new Date() > user.token_expires) {
        return res.status(401).json({ message: 'Verification code has expired' });
      }
      // Reset attempts on success
      await redisClient.del(attemptKey);
      await user.update({
        verification_token: null,
        token_expires: null,
        updated_at: new Date()
      });
      if (role.name === 'admin' || role.name === 'SportsVisitingFaculty' || role.name === 'SportsFaculty') {
        const is2FAEnabled = await get2FASettingForRole(user.role_id);
        if (is2FAEnabled) {
          if (!user.two_fa_setup) {
            const secret = generate2FASecret();
            await user.update({ two_fa_secret: secret.base32, updated_at: new Date() });
            return res.json({ message: '2fa_setup', userId: user.id, secret: secret.base32 });
          }
          return res.json({ message: '2fa_required', userId: user.id });
        }
        if (!process.env.JWT_SECRET) {
          console.error('JWT_SECRET is not set');
          return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing' });
        }
        const { encryptedToken, exp, fingerprintHash } = generateEncryptedAccessToken(user, role.name, req);
        const refreshToken = generateRefreshToken();
        await redisClient.set(`refresh:${refreshToken}`, JSON.stringify({ userId: user.id, fpHash: fingerprintHash }), { EX: 604800 }); // 7 days
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 604800000 // 7 days in ms
        });
        res.cookie('accessToken', encryptedToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: (exp * 1000 - Date.now())
        });
        return res.json({
          message: 'success',
          expiresAt: exp,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: role.name,
          },
        });
      } else {
        return res.status(403).json({ message: 'Unsupported role for this login method' });
      }
    } catch (error) {
      console.error('Verify code error:', error);
      res.status(500).json({ message: 'Error verifying code', error: error.message });
    }
  },

  async resendVerificationCode(req, res) {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const verificationCode = generateVerificationCode();
      const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
      const hashedCode = await bcrypt.hash(verificationCode, 10);
      await user.update({
        verification_token: hashedCode,
        token_expires: tokenExpires,
        updated_at: new Date()
      });
      const emailSent = await sendVerificationEmail(user.email, verificationCode);
      if (!emailSent) {
        return res.status(500).json({ message: 'Failed to send verification email' });
      }
      return res.json({ message: 'Verification code resent successfully' });
    } catch (error) {
      console.error('Resend verification code error:', error);
      res.status(500).json({ message: 'Error resending verification code', error: error.message });
    }
  },

  async verify2FA(req, res) {
    const { userId, code } = req.body;
    try {
      const lockKey = `lock:2fa:${userId}`;
      const isLocked = await redisClient.exists(lockKey);
      if (isLocked) {
        return res.status(403).json({ message: 'Too many failed attempts. Please try again in 2 hours.' });
      }
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const role = await Role.findByPk(user.role_id);
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      const attemptKey = `attempt:2fa:${userId}`;
      const verified = verify2FACode({ base32: user.two_fa_secret }, code);
      if (!verified) {
        let attempts = await redisClient.incr(attemptKey);
        if (attempts === 1) {
          await redisClient.expire(attemptKey, 3600);
        }
        if (attempts >= MAX_2FA_ATTEMPTS) {
          await redisClient.set(lockKey, 'locked', { EX: _2FA_LOCK_TIME });
          await redisClient.del(attemptKey);
        }
        return res.status(401).json({ message: 'Invalid 2FA code' });
      }
      // Reset attempts on success
      await redisClient.del(attemptKey);
      if (!user.two_fa_setup) {
        await user.update({ two_fa_setup: true, updated_at: new Date() });
      }
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set');
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing' });
      }
      const { encryptedToken, exp, fingerprintHash } = generateEncryptedAccessToken(user, role.name, req);
      const refreshToken = generateRefreshToken();
      await redisClient.set(`refresh:${refreshToken}`, JSON.stringify({ userId: user.id, fpHash: fingerprintHash }), { EX: 604800 }); // 7 days
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 604800000 // 7 days in ms
      });
      res.cookie('accessToken', encryptedToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: (exp * 1000 - Date.now())
      });
      return res.json({
        message: 'success',
        expiresAt: exp,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: role.name,
        },
      });
    } catch (error) {
      console.error('Verify 2FA error:', error);
      res.status(500).json({ message: 'Error verifying 2FA', error: error.message });
    }
  },

  async refresh(req, res) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }
    try {
      const stored = await redisClient.get(`refresh:${refreshToken}`);
      if (!stored) {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }
      const parsed = JSON.parse(stored);
      const userId = parsed.userId;
      const storedFpHash = parsed.fpHash;
      const deviceId = req.body.deviceId || req.headers['x-device-id'] || 'unknown';
      const userAgent = req.headers['user-agent'] || '';
      const recomputedFpHash = getFingerprintHash(deviceId, userAgent, userId.toString());
      if (recomputedFpHash !== storedFpHash) {
        return res.status(401).json({ message: 'Device mismatch' });
      }
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const role = await Role.findByPk(user.role_id);
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      if (role.name !== 'admin' && role.name !== 'SportsVisitingFaculty' && role.name !== 'SportsFaculty') {
        if (!user.access_token || new Date() > user.expiry_date) {
          if (!user.refresh_token) {
            return res.status(401).json({ message: 'No Google authorization. Please log in again.' });
          }
          const client = createOAuth2Client();
          client.setCredentials({ refresh_token: user.refresh_token });
          try {
            const { tokens } = await client.refreshAccessToken();
            await user.update({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || user.refresh_token,
              expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
              updated_at: new Date()
            });
          } catch (refreshError) {
            console.error('Failed to refresh Google token:', refreshError);
            return res.status(401).json({ message: 'Google authorization expired. Please log in again.' });
          }
        }
      }
      const { encryptedToken, exp, fingerprintHash } = generateEncryptedAccessToken(user, role.name, req);
      const newRefreshToken = generateRefreshToken();
      await redisClient.del(`refresh:${refreshToken}`);
      await redisClient.set(`refresh:${newRefreshToken}`, JSON.stringify({ userId: user.id, fpHash: fingerprintHash }), { EX: 604800 });
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 604800000 // 7 days in ms
      });
      res.cookie('accessToken', encryptedToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: (exp * 1000 - Date.now())
      });
      return res.json({
        message: 'success',
        expiresAt: exp,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: role.name,
        },
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ message: 'Error refreshing token', error: error.message });
    }
  },

  async googleSignIn(req, res) {
    const deviceId = req.query.deviceId || 'unknown';
    const client = createOAuth2Client();
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar',
      ],
      state: JSON.stringify({ googleSignIn: true, deviceId })
    });
    res.json({ url: authUrl });
  },

  async googleCallback(req, res) {
    const { code, state } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'https://flameawards.in';
    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`);
    }
    try {
      const stateObj = JSON.parse(state || '{}');
      const deviceId = stateObj.deviceId || 'unknown';
      const client = createOAuth2Client();
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email;
      let user = await User.findOne({ where: { email: googleEmail } });

      if (!user) {
        // Search in StudentData for onboarding
        const student = await StudentData.findOne({ where: { email_id: googleEmail } });
        if (student) {
          // Find the Student role
          const studentRole = await Role.findOne({ where: { name: 'Student' } });
          if (!studentRole) {
            const errorMessage = 'Student role not configured in the system. Please contact admin.';
            return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
          }

          // Create new user record
          user = await User.create({
            user_id: student.student_cvue_no,
            username: student.student_name,
            employee_name: student.student_name,
            user_type: 'Student',
            email: googleEmail,
            department: student.batch,
            role_id: studentRole.id,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          });
          console.log(`✅ Automatically onboarded student: ${googleEmail}`);
        } else {
          const errorMessage = 'Email not found. Please contact administrators for registration';
          return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
        }
      }

      const role = await Role.findByPk(user.role_id);
      if (!role) {
        const errorMessage = 'Role not found for user';
        return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
      }

      // Restrict GSO to 'Student' role as per requirement
      if (role.name !== 'Student') {
        const errorMessage = 'This account can not use Google Sign-In. Please use your respective login method.';
        return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
      }
      await user.update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || user.refresh_token,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updated_at: new Date()
      });
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set');
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing' });
      }
      const { encryptedToken, exp, fingerprintHash } = generateEncryptedAccessToken(user, role.name, req, deviceId);
      const refreshToken = generateRefreshToken();
      await redisClient.set(`refresh:${refreshToken}`, JSON.stringify({ userId: user.id, fpHash: fingerprintHash }), { EX: 604800 });
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 604800000 // 7 days in ms
      });
      res.cookie('accessToken', encryptedToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: (exp * 1000 - Date.now())
      });
      const userData = encodeURIComponent(JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        role: role.name,
      }));
      return res.redirect(
        302,
        `${frontendUrl}/login?expiresAt=${exp}&user=${userData}`
      );
    } catch (error) {
      console.error('Google callback error:', error);
      const errorMessage = 'Something went wrong during sign-in. Please try again.';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
    }
  },

  async logout(req, res) {
    const encryptedToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    try {
      if (encryptedToken) {
        const bytes = CryptoJS.AES.decrypt(encryptedToken, process.env.TOKEN_ENCRYPTION_KEY);
        const token = bytes.toString(CryptoJS.enc.Utf8);
        if (token) {
          const decoded = jwt.decode(token);
          if (decoded && decoded.exp) {
            const currentTime = Math.floor(Date.now() / 1000);
            const ttl = decoded.exp - currentTime;
            if (ttl > 0) {
              await redisClient.set(token, 'revoked', { EX: ttl });
            }
          }
        }
      }
      if (refreshToken) {
        await redisClient.del(`refresh:${refreshToken}`);
      }
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Error logging out', error: error.message });
    }
  },

  async getProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.userId, {
        attributes: { exclude: ['password', 'access_token', 'refresh_token', 'two_fa_secret', 'verification_token'] }
      });
      const role = await Role.findByPk(user.role_id);
      const json = user.toJSON();
      const mappedUser = {
        ...json,
        UserID: json.user_id,
        Department: json.department,
        isActive: json.is_active,
        roleId: json.role_id,
        role: role ? role.name : null
      };
      delete mappedUser.user_id;
      delete mappedUser.department;
      delete mappedUser.is_active;
      delete mappedUser.role_id;
      delete mappedUser.token_expires;
      res.json(mappedUser);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const lockKey = `lock:forgot:${email.toLowerCase()}`;
      const isLocked = await redisClient.exists(lockKey);
      if (isLocked) {
        return res.status(403).json({ message: 'Too many requests. Please try again later.' });
      }
      const user = await User.findOne({ where: { email } });
      let emailSent = false;
      if (user && user.password) {
        const verificationCode = generateVerificationCode();
        const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
        const hashedCode = await bcrypt.hash(verificationCode, 10);
        await user.update({
          verification_token: hashedCode,
          token_expires: tokenExpires,
          updated_at: new Date()
        });
        emailSent = await sendVerificationEmail(email, verificationCode);
      }
      if (user && !emailSent) {
        return res.status(500).json({ message: 'Failed to send verification email' });
      }
      // Always return the same message
      return res.json({ message: 'If the email exists, a verification code has been sent', userId: user ? user.id : null });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Error processing forgot password request', error: error.message });
    }
  },

  async verifyResetCode(req, res) {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: 'Email and code are required' });
      }
      const user = await User.findOne({ where: { email } });
      const attemptKey = `attempt:reset:${email.toLowerCase()}`;
      const lockKey = `lock:reset:${email.toLowerCase()}`;
      const isLocked = await redisClient.exists(lockKey);
      if (isLocked) {
        return res.status(403).json({ message: 'Too many failed attempts. Please try again in 2 hours.' });
      }
      if (!user) {
        let attempts = await redisClient.incr(attemptKey);
        if (attempts === 1) {
          await redisClient.expire(attemptKey, 3600);
        }
        if (attempts >= MAX_VERIFY_ATTEMPTS) {
          await redisClient.set(lockKey, 'locked', { EX: VERIFY_LOCK_TIME });
          await redisClient.del(attemptKey);
        }
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      if (!user.verification_token || !(await bcrypt.compare(code, user.verification_token))) {
        let attempts = await redisClient.incr(attemptKey);
        if (attempts === 1) {
          await redisClient.expire(attemptKey, 3600);
        }
        if (attempts >= MAX_VERIFY_ATTEMPTS) {
          await redisClient.set(lockKey, 'locked', { EX: VERIFY_LOCK_TIME });
          await redisClient.del(attemptKey);
        }
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      if (!user.token_expires || new Date() > user.token_expires) {
        return res.status(401).json({ message: 'Verification code has expired' });
      }
      await redisClient.del(attemptKey);
      await user.update({
        verification_token: null,
        token_expires: null,
        updated_at: new Date()
      });
      if (user.two_fa_setup) {
        return res.json({ message: '2fa_required', userId: user.id });
      } else {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.update({
          verification_token: resetToken,
          token_expires: tokenExpires,
          updated_at: new Date()
        });
        return res.json({ message: 'proceed_to_reset', resetToken });
      }
    } catch (error) {
      console.error('Verify reset code error:', error);
      res.status(500).json({ message: 'Error verifying code', error: error.message });
    }
  },

  async verifyReset2FA(req, res) {
    try {
      const { userId, code } = req.body;
      if (!userId || !code) {
        return res.status(400).json({ message: 'User ID and 2FA code are required' });
      }
      const lockKey = `lock:reset2fa:${userId}`;
      const isLocked = await redisClient.exists(lockKey);
      if (isLocked) {
        return res.status(403).json({ message: 'Too many failed attempts. Please try again in 2 hours.' });
      }
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const attemptKey = `attempt:reset2fa:${userId}`;
      const verified = verify2FACode({ base32: user.two_fa_secret }, code);
      if (!verified) {
        let attempts = await redisClient.incr(attemptKey);
        if (attempts === 1) {
          await redisClient.expire(attemptKey, 3600);
        }
        if (attempts >= MAX_2FA_ATTEMPTS) {
          await redisClient.set(lockKey, 'locked', { EX: _2FA_LOCK_TIME });
          await redisClient.del(attemptKey);
        }
        return res.status(401).json({ message: 'Invalid 2FA code' });
      }
      await redisClient.del(attemptKey);
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.update({
        verification_token: resetToken,
        token_expires: tokenExpires,
        updated_at: new Date()
      });
      return res.json({ message: 'proceed_to_reset', resetToken });
    } catch (error) {
      console.error('Verify reset 2FA error:', error);
      res.status(500).json({ message: 'Error verifying 2FA', error: error.message });
    }
  },

  async resetPassword(req, res) {
    try {
      const { resetToken, newPassword } = req.body;
      if (!resetToken || !newPassword) {
        return res.status(400).json({ message: 'Reset token and new password are required' });
      }
      const user = await User.findOne({
        where: {
          verification_token: resetToken,
          token_expires: { [require('sequelize').Op.gt]: new Date() },
        },
      });
      if (!user) {
        return res.status(401).json({ message: 'Invalid or expired reset token' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      }
      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ message: 'Password must include letters, numbers, and symbols' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({
        password: hashedPassword,
        verification_token: null,
        token_expires: null,
        updated_at: new Date()
      });
      return res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
  },

  async initiateGoogleSignIn(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const user = await User.findOne({ where: { email } });
      let emailSent = false;
      if (user) {
        const role = await Role.findByPk(user.role_id);
        if (role && role.name !== 'admin') {
          const verificationCode = generateVerificationCode();
          const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
          const hashedCode = await bcrypt.hash(verificationCode, 10);
          await user.update({
            verification_token: hashedCode,
            token_expires: tokenExpires,
            updated_at: new Date()
          });
          emailSent = await sendVerificationEmail(email, verificationCode);
        }
      }
      if (user && !emailSent) {
        return res.status(500).json({ message: 'Failed to send verification email' });
      }
      // Always return the same message to prevent enumeration
      return res.json({ message: 'If the email is registered for Google Sign-In, a verification code has been sent', userId: user ? user.id : null });
    } catch (error) {
      console.error('Initiate Google Sign-In error:', error);
      res.status(500).json({ message: 'Error initiating Google Sign-In', error: error.message });
    }
  },

  async verifyGoogleSignInCode(req, res) {
    try {
      const { userId, code, deviceId } = req.body;
      if (!userId || !code || !deviceId) {
        return res.status(400).json({ message: 'User ID, code, and device ID are required' });
      }
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!user.verification_token || !(await bcrypt.compare(code, user.verification_token))) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      if (!user.token_expires || new Date() > user.token_expires) {
        return res.status(401).json({ message: 'Verification code has expired' });
      }
      await user.update({
        verification_token: null,
        token_expires: null,
        updated_at: new Date()
      });
      const role = await Role.findByPk(user.role_id);
      if (!role) {
        return res.status(404).json({ message: 'Role not found' });
      }
      if (role.name === 'admin') {
        return res.status(403).json({ message: 'Admins cannot use Google Sign-In' });
      }
      let needsRedirect = false;
      if (!user.access_token || new Date() > user.expiry_date) {
        if (user.refresh_token) {
          const client = createOAuth2Client();
          client.setCredentials({ refresh_token: user.refresh_token });
          try {
            const { tokens } = await client.refreshAccessToken();
            await user.update({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || user.refresh_token,
              expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
              updated_at: new Date()
            });
          } catch (err) {
            console.error('Refresh failed:', err);
            needsRedirect = true;
          }
        } else {
          needsRedirect = true;
        }
      }
      if (needsRedirect) {
        const redirectClient = createOAuth2Client();
        const authUrl = redirectClient.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/calendar',
          ],
          state: JSON.stringify({ googleSignIn: true, deviceId })
        });
        return res.json({ message: 'redirect', url: authUrl });
      }
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set');
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing' });
      }
      const { encryptedToken, exp, fingerprintHash } = generateEncryptedAccessToken(user, role.name, req, deviceId);
      const refreshToken = generateRefreshToken();
      await redisClient.set(`refresh:${refreshToken}`, JSON.stringify({ userId: user.id, fpHash: fingerprintHash }), { EX: 604800 });
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 604800000 // 7 days in ms
      });
      res.cookie('accessToken', encryptedToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: (exp * 1000 - Date.now())
      });
      return res.json({
        message: 'success',
        expiresAt: exp,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: role.name,
        },
      });
    } catch (error) {
      console.error('Verify Google Sign-In code error:', error);
      res.status(500).json({ message: 'Error verifying code', error: error.message });
    }
  },

  // Fast-login for returning Google SSO students — skips the full OAuth redirect
  // if the student's stored refresh token is still valid
  async googleFastLogin(req, res) {
    const sequelize = require('../config/connection');
    try {
      const { email, deviceId } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Raw SQL to find user + role in one query
      const [rows] = await sequelize.query(
        `SELECT u.id, u.username, u.email, u.role_id, u.access_token, u.refresh_token, u.expiry_date,
                r.name as role_name
         FROM app.users u
         LEFT JOIN app.roles r ON u.role_id = r.id
         WHERE LOWER(u.email) = LOWER(:email)
         LIMIT 1`,
        { replacements: { email: email.trim() }, type: sequelize.QueryTypes.SELECT }
      );

      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || row.role_name !== 'Student' || !row.refresh_token) {
        return res.json({ message: 'needs_full_auth' });
      }

      // Check if access token is still valid
      const now = new Date();
      const expiry = row.expiry_date ? new Date(row.expiry_date) : null;
      const isValid = row.access_token && expiry && now < expiry;

      // Load user via ORM for token generation
      const user = await User.findByPk(row.id);
      const role = await Role.findByPk(row.role_id);

      if (isValid) {
        const { encryptedToken, exp, fingerprintHash } = generateEncryptedAccessToken(user, role.name, req, deviceId || 'unknown');
        const refreshToken = generateRefreshToken();
        await redisClient.set(`refresh:${refreshToken}`, JSON.stringify({ userId: user.id, fpHash: fingerprintHash }), { EX: 604800 });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 604800000 });
        res.cookie('accessToken', encryptedToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: (exp * 1000 - Date.now()) });
        return res.json({
          message: 'success',
          expiresAt: exp,
          user: { id: user.id, username: user.username, email: user.email, role: role.name },
        });
      }

      // Access token expired — try silent refresh
      const client = createOAuth2Client();
      client.setCredentials({ refresh_token: row.refresh_token });
      try {
        const { tokens } = await client.refreshAccessToken();
        await user.update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || user.refresh_token,
          expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          updated_at: new Date()
        });
        const { encryptedToken, exp, fingerprintHash } = generateEncryptedAccessToken(user, role.name, req, deviceId || 'unknown');
        const refreshToken = generateRefreshToken();
        await redisClient.set(`refresh:${refreshToken}`, JSON.stringify({ userId: user.id, fpHash: fingerprintHash }), { EX: 604800 });
        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 604800000 });
        res.cookie('accessToken', encryptedToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: (exp * 1000 - Date.now()) });
        return res.json({
          message: 'success',
          expiresAt: exp,
          user: { id: user.id, username: user.username, email: user.email, role: role.name },
        });
      } catch (refreshError) {
        console.error('Fast-login refresh failed:', refreshError.message);
        await user.update({ access_token: null, refresh_token: null, expiry_date: null, updated_at: new Date() });
        return res.json({ message: 'needs_full_auth' });
      }
    } catch (error) {
      console.error('Fast-login error:', error.message);
      res.status(500).json({ message: 'Error during fast login', error: error.message });
    }
  }
};

module.exports = authController;