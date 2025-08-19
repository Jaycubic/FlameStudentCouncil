const { User, Role, Setting } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
require('dotenv').config();


// Google OAuth2 setup
const oAuth2Client = new google.auth.OAuth2(
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
    user: process.env.EMAIL_USER || 'jofreyjohnmrutu01@gmail.com',
    pass: process.env.EMAIL_PASS || 'gpgb shae oafd oprq',
  },
});

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
const sendVerificationEmail = async (email, code) => {
  try {
    await transporter.sendMail({
      from: '"FLAME STS" <jofreyjohnmrutu01@gmail.com>',
      to: email,
      subject: 'Your Verification Code',
      html: `
        <h2>VRV Security Login Verification</h2>
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

// Fetch 2FA settings
const get2FASettings = async () => {
  if (!Setting) {
    throw new Error('Setting model is not defined. Please ensure it is exported from models/index.js');
  }
  const adminSetting = await Setting.findOne({ where: { setting_key: 'admin_2fa_enabled' } });
  const userSetting = await Setting.findOne({ where: { setting_key: 'user_2fa_enabled' } });
  return {
    admin_2fa_enabled: adminSetting ? adminSetting.setting_value === 'true' : false,
    user_2fa_enabled: userSetting ? userSetting.setting_value === 'true' : false,
  };
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

      const user = await User.create({
        username,
        email,
        password,
        RoleId: defaultRole.id
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

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const user = await User.findOne({
        where: { email },
        include: [{ model: Role }]
      });

      if (!user) {
        return res.status(404).json({ message: 'Invalid email' });
      }

      // Check if user.Role is null
      if (!user.Role) {
        return res.status(400).json({ message: 'User does not have a role assigned' });
      }

      if (user.Role.name === 'admin') {
        if (!password) {
          return res.status(400).json({ message: 'Password is required for admin login' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ message: 'Invalid password' });
        }

        const verificationCode = generateVerificationCode();
        const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
        const hashedCode = await bcrypt.hash(verificationCode, 10);

        await user.update({
          verificationToken: hashedCode,
          tokenExpires,
        });

        const emailSent = await sendVerificationEmail(email, verificationCode);
        if (!emailSent) {
          return res.status(500).json({ message: 'Failed to send verification email' });
        }

        return res.json({
          message: 'verify',
          email,
          userId: user.id,
        });
      } else {
        if (password) {
          return res.status(400).json({ message: 'Non-admin users must use Google Sign-In' });
        }
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
          ],
          state: JSON.stringify({ email })
        });
        return res.status(200).json({ message: 'redirect', url: authUrl });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error logging in', error: error.message });
    }
  },
  
  async verifyCode(req, res) {
    console.log('verifyCode endpoint hit');
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ message: 'User ID and code are required' });
    }

    try {
      const user = await User.findByPk(userId, { include: [{ model: Role }] });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.verificationToken || !(await bcrypt.compare(code, user.verificationToken))) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }

      if (!user.tokenExpires || new Date() > user.tokenExpires) {
        return res.status(401).json({ message: 'Verification code has expired' });
      }

      await user.update({
        verificationToken: null,
        tokenExpires: null,
      });

      const settings = await get2FASettings();
      const is2FAEnabled = user.Role.name === 'admin' ? settings.admin_2fa_enabled : settings.user_2fa_enabled;

      if (is2FAEnabled && user.Role.name === 'admin') {
        if (!user.two_fa_setup) {
          const secret = generate2FASecret();
          await user.update({ two_fa_secret: secret.base32 });
          return res.json({ message: '2fa_setup', userId: user.id, secret: secret.base32 });
        }
        return res.json({ message: '2fa_required', userId: user.id });
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set');
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing' });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.Role.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'success',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.Role.name,
        },
      });
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
        verificationToken: hashedCode,
        tokenExpires,
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
      const user = await User.findByPk(userId, { include: [{ model: Role }] });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const verified = verify2FACode({ base32: user.two_fa_secret }, code);
      if (!verified) {
        return res.status(401).json({ message: 'Invalid 2FA code' });
      }

      if (!user.two_fa_setup) {
        await user.update({ two_fa_setup: true });
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set');
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing' });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.Role.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'success',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.Role.name,
        },
      });
    } catch (error) {
      console.error('Verify 2FA error:', error);
      res.status(500).json({ message: 'Error verifying 2FA', error: error.message });
    }
  },

  async googleCallback(req, res) {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ message: 'Missing code in callback' });
    }

    try {
      const { email } = JSON.parse(state);
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email;

      if (googleEmail !== email) {
        return res.status(401).json({ message: 'Email mismatch' });
      }

      const user = await User.findOne({ where: { email }, include: [{ model: Role }] });
      if (!user) {
        return res.status(404).json({ message: 'Email not found. Please contact administrators for registration' });
      }

      if (user.Role.name === 'admin') {
        return res.status(403).json({ message: 'Admins cannot use Google Sign-In' });
      }

      await user.update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null
      });

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set');
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing' });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.Role.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(
        302,
        `${frontendUrl}/oauth2/redirect?token=${encodeURIComponent(token)}`
      );
    } catch (error) {
      console.error('Google callback error:', error);
      res.status(500).json({ message: 'Error in Google callback', error: error.message });
    }
  },

  async logout(req, res) {
    try {
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Error logging out', error: error.message });
    }
  },

  async getProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.userId, {
        include: [{ model: Role }],
        attributes: { exclude: ['password', 'access_token', 'refresh_token', 'two_fa_secret', 'verificationToken'] }
      });
      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
  }
};

module.exports = authController;
