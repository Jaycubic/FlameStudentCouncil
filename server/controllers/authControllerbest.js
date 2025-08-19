// controllers/authController.js

const { User, Role, RoleSetting } = require('../models');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcrypt');
const { google }= require('googleapis');
const nodemailer= require('nodemailer');
const speakeasy = require('speakeasy');
const crypto    = require('crypto');
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
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit verification code
const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Send verification email
const sendVerificationEmail = async (email, code) => {
  try {
    await transporter.sendMail({
      from: `"FLAME STS" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      html: `
        <h2>FLAME STS Password Reset Verification</h2>
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
const generate2FASecret = () => speakeasy.generateSecret({ length: 20 });

// Fetch 2FA setting for a given role ID
const is2FAEnabledForRole = async (roleId) => {
  const record = await RoleSetting.findOne({
    where: { role_id: roleId, setting_key: '2fa_enabled' }
  });
  return record ? record.setting_value === 'true' : false;
};

// Verify 2FA code
const verify2FACode = (secret, code) =>
  speakeasy.totp.verify({
    secret: secret.base32,
    encoding: 'base32',
    token: code,
    window: 1,
  });

// Roles forced to Google Sign-In
const googleSignInRoles = ['RC'];

const authController = {
  async register(req, res) {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
      await User.create({
        username, email, password,
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
      if (!user.Role) {
        return res.status(400).json({ message: 'User does not have a role assigned' });
      }
      if (googleSignInRoles.includes(user.Role.name)) {
        return res.status(403).json({ message: 'Please use Google Sign-In for your role' });
      }

      // password-based for admin & user
      const isValidPassword = await bcrypt.compare(password, user.password || '');
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      // generate and email verification code
      const verificationCode = generateVerificationCode();
      const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
      const hashedCode = await bcrypt.hash(verificationCode, 10);

      await user.update({ verificationToken: hashedCode, tokenExpires });

      const emailSent = await sendVerificationEmail(email, verificationCode);
      if (!emailSent) {
        return res.status(500).json({ message: 'Failed to send verification email' });
      }

      res.json({
        message: 'verify',
        email,
        userId: user.id,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error logging in', error: error.message });
    }
  },

  async verifyCode(req, res) {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ message: 'User ID and code are required' });
    }
    try {
      const user = await User.findByPk(userId, { include: [{ model: Role }] });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!(await bcrypt.compare(code, user.verificationToken || ''))) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      if (!user.tokenExpires || new Date() > user.tokenExpires) {
        return res.status(401).json({ message: 'Verification code has expired' });
      }
      // clear tokens
      await user.update({ verificationToken: null, tokenExpires: null });

      // check 2FA setting for this role
      const twoFAEnabled = await is2FAEnabledForRole(user.Role.id);
      if (twoFAEnabled) {
        if (!user.two_fa_setup) {
          const secret = generate2FASecret();
          await user.update({ two_fa_secret: secret.base32 });
          return res.json({ message: '2fa_setup', userId: user.id, secret: secret.base32 });
        }
        return res.json({ message: '2fa_required', userId: user.id });
      }

      // no 2FA—issue JWT
      const token = jwt.sign(
        { userId: user.id, role: user.Role.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({
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
      await user.update({ verificationToken: hashedCode, tokenExpires });
      const emailSent = await sendVerificationEmail(user.email, verificationCode);
      if (!emailSent) {
        return res.status(500).json({ message: 'Failed to send verification email' });
      }
      res.json({ message: 'Verification code resent successfully' });
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
      // issue JWT
      const token = jwt.sign(
        { userId: user.id, role: user.Role.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({
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

  async googleSignIn(req, res) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      state: JSON.stringify({ googleSignIn: true })
    });
    res.json({ url: authUrl });
  },

  async googleCallback(req, res) {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ message: 'Missing code in callback' });
    }
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email;

      const user = await User.findOne({ where: { email: googleEmail }, include: [{ model: Role }] });
      if (!user) {
        const errorMessage = 'Email not found. Please contact administrators for registration';
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`);
      }
      if (!googleSignInRoles.includes(user.Role.name)) {
        const errorMessage = 'Your role does not support Google Sign-In. Please use email and password to log in.';
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`);
      }

      await user.update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null
      });

      const token = jwt.sign(
        { userId: user.id, role: user.Role.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const frontendUrl = process.env.FRONTEND_URL || 'https://flamestudentcouncil.in:3030';
      return res.redirect(
        302,
        `${frontendUrl}/login?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.Role.name,
        }))}`
      );
    } catch (error) {
      console.error('Google callback error:', error);
      res.status(500).json({ message: 'Error in Google callback', error: error.message });
    }
  },

  async logout(req, res) {
    res.json({ message: 'Logged out successfully' });
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
  },

  // Forgot Password Workflow—always apply 2FA
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const user = await User.findOne({ where: { email }, include: [{ model: Role }] });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!user.password) {
        return res.status(400).json({ message: 'Password reset not available for this account' });
      }

      // send verification code
      const verificationCode = generateVerificationCode();
      const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
      const hashedCode = await bcrypt.hash(verificationCode, 10);
      await user.update({ verificationToken: hashedCode, tokenExpires });

      const emailSent = await sendVerificationEmail(email, verificationCode);
      if (!emailSent) {
        return res.status(500).json({ message: 'Failed to send verification email' });
      }

      res.json({ message: 'code_sent', userId: user.id });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Error processing forgot password request', error: error.message });
    }
  },

  async verifyResetCode(req, res) {
    try {
      const { userId, code } = req.body;
      if (!userId || !code) {
        return res.status(400).json({ message: 'User ID and code are required' });
      }
      const user = await User.findByPk(userId, { include: [{ model: Role }] });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!(await bcrypt.compare(code, user.verificationToken || ''))) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      if (!user.tokenExpires || new Date() > user.tokenExpires) {
        return res.status(401).json({ message: 'Verification code has expired' });
      }

      // clear token
      await user.update({ verificationToken: null, tokenExpires: null });

      // always require 2FA on reset
      return res.json({ message: '2fa_required', userId: user.id });
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
      const user = await User.findByPk(userId);
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

      // generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.update({ verificationToken: resetToken, tokenExpires });

      res.json({ message: 'proceed_to_reset', resetToken });
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
          verificationToken: resetToken,
          tokenExpires: { [require('sequelize').Op.gt]: new Date() },
        },
      });
      if (!user) {
        return res.status(401).json({ message: 'Invalid or expired reset token' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      }
      if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])/.test(newPassword)) {
        return res.status(400).json({ message: 'Password must include letters, numbers, and symbols' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({
        password: hashedPassword,
        verificationToken: null,
        tokenExpires: null,
      });
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
  }
};

module.exports = authController;
