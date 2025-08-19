// controllers/authController.js
const { User, Role, Setting, RoleSetting, StudentLogs } = require('../models');
const StudentData = require('../models/StudentData');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const redis = require('redis');
require('dotenv').config();

// --- SAFETY: if StudentLogs was not exported from ../models, require it directly ---
let StudentLogsModel = StudentLogs;
if (!StudentLogsModel) {
  try {
    StudentLogsModel = require('../models/StudentLogs');
  } catch (err) {
    // keep it undefined so the code still surfaces a meaningful error later
    console.warn('Warning: StudentLogs model not found via direct require:', err.message);
    StudentLogsModel = undefined;
  }
}

// Redis client setup
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});
redisClient.connect().catch(console.error);

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
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
const sendVerificationEmail = async (email, code) => {
  try {
    await transporter.sendMail({
      from: `"FLAME Student Council System" <${process.env.EMAIL_USER}>`,
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

// Generate encrypted JWT with fingerprint and expiration
const generateEncryptedToken = (user, req, studentData = null) => {
  const deviceId = req.body.deviceId || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const fingerprintHash = getFingerprintHash(deviceId, userAgent, user.id.toString());
  const payload = {
    userId: user.id,
    role: user.Role.name,
    fpHash: fingerprintHash
  };
  if (user.Role.name === 'Student' && studentData) {
    payload.studentCvueNo = studentData.StudentCvueNo;
    payload.contactNo = studentData.ContactNo;
    payload.studentName = studentData.StudentName;
    payload.batch = studentData.Batch;
    payload.gender = studentData.Gender;
    payload.photo = studentData.Photo;
  }
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
  const decoded = jwt.decode(token);
  const exp = decoded.exp;
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  }
  const encryptedToken = CryptoJS.AES.encrypt(token, process.env.TOKEN_ENCRYPTION_KEY).toString();
  return { encryptedToken, exp };
};

// Define roles that require Google Sign-In
const googleSignInRoles = ['Student'];

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
      const maxUserID = await User.max('UserID') || 0;
      const newUserID = maxUserID + 1;
      const user = await User.create({
        UserID: newUserID,
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
      if (!user.Role) {
        return res.status(400).json({ message: 'User does not have a role assigned' });
      }
      if (googleSignInRoles.includes(user.Role.name)) {
        return res.status(403).json({ message: 'Please use Google Sign-In for your role' });
      }
      if (user.Role.name === 'admin' || user.Role.name === 'user') {
        if (!password) {
          return res.status(400).json({ message: 'Password is required for this role' });
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
        return res.status(403).json({ message: 'Unsupported role for this login method' });
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
      if (user.Role.name === 'admin' || user.Role.name === 'user') {
        const is2FAEnabled = await get2FASettingForRole(user.Role.id);
        if (is2FAEnabled) {
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
        const { encryptedToken, exp } = generateEncryptedToken(user, req);
        return res.json({
          message: 'success',
          token: encryptedToken,
          expiresAt: exp,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.Role.name,
            counterId: user.CounterId,
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
      const { encryptedToken, exp } = generateEncryptedToken(user, req);
      return res.json({
        message: 'success',
        token: encryptedToken,
        expiresAt: exp,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.Role.name,
          counterId: user.CounterId,
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
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ message: 'Missing code in callback' });
    }
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email;

      // Check if student using Redis cache for efficiency
      let studentData;
      const cacheKey = `student:${googleEmail}`;
      let cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        if (cachedData === 'not_found') {
          const errorMessage = "We're sorry, but only registered students can use Google Sign-On. If you think this is a mistake, please reach out to the Administrator for help.";
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`);
        }
        studentData = JSON.parse(cachedData);
      } else {
        const student = await StudentData.findOne({ where: { EmailID: googleEmail } });
        if (!student) {
          await redisClient.set(cacheKey, 'not_found', { EX: 300 });
          const errorMessage = "We're sorry, but only registered students can use Google Sign-On. If you think this is a mistake, please reach out to the Administrator for help.";
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`);
        }
        studentData = student.toJSON();
        await redisClient.set(cacheKey, JSON.stringify(studentData), { EX: 3600 });
      }

      // Find or create User (but create StudentLogs when user not present)
      let user = await User.findOne({ where: { email: googleEmail }, include: [{ model: Role }] });
      const studentRole = await Role.findOne({ where: { name: 'Student' } });
      if (!studentRole) {
        throw new Error('Student role not found');
      }

      if (!user) {
        if (!StudentLogsModel) {
          // explicit, helpful error if StudentLogs truly isn't available
          throw new Error('StudentLogs model is not available. Ensure it is exported from ../models or exists at models/StudentLogs.js');
        }

        // Instead of creating a record in Users, create in StudentLogs
        const maxUserID = await User.max('UserID') || 0;
        const newUserID = maxUserID + 1;

        // Create on StudentLogsModel
        const created = await StudentLogsModel.create({
          UserID: newUserID,
          username: studentData.StudentName,
          email: googleEmail,
          password: null,
          RoleId: studentRole.id,
        });

        // Try to reload including Role so downstream code expecting user.Role works unchanged
        let studentLog;
        try {
          studentLog = await StudentLogsModel.findByPk(created.id, { include: [{ model: Role }] });
        } catch (err) {
          // If include fails (associations not set up), fall back to the raw created instance
          console.warn('Warning: could not include Role on StudentLogs fetch - falling back to attaching Role manually.', err.message);
          studentLog = created;
        }

        // If Role wasn't included for any reason, attach it manually
        if (!studentLog.Role) {
          studentLog.Role = studentRole;
        }

        // Use studentLog as the "user" moving forward
        user = studentLog;
      }

      if (user.Role.name !== 'Student') {
        const errorMessage = "Your role does not support Google Sign-In. Please use email and password to log in.";
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`);
      }

      // Update access tokens; handle both real Sequelize instances and plain objects
      if (typeof user.update === 'function') {
        await user.update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null
        });
      } else {
        // plain object (shouldn't normally happen) — just set fields so later code sees them
        user.access_token = tokens.access_token;
        user.refresh_token = tokens.refresh_token || null;
        user.expiry_date = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set');
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing' });
      }
      const { encryptedToken, exp } = generateEncryptedToken(user, req, studentData);
      const userPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.Role.name,
        counterId: user.CounterId,
      };
      if (user.Role.name === 'Student') {
        userPayload.studentCvueNo = studentData.StudentCvueNo;
        userPayload.contactNo = studentData.ContactNo;
        userPayload.studentName = studentData.StudentName;
        userPayload.batch = studentData.Batch;
        userPayload.gender = studentData.Gender;
        userPayload.photo = studentData.Photo;
      }
      const frontendUrl = process.env.FRONTEND_URL || 'https://flamestudentcouncil.in:3030';
      return res.redirect(
        302,
        `${frontendUrl}/login?token=${encodeURIComponent(encryptedToken)}&expiresAt=${exp}&user=${encodeURIComponent(JSON.stringify(userPayload))}`
      );
    } catch (error) {
      console.error('Google callback error:', error);
      res.status(500).json({ message: 'Error in Google callback', error: error.message });
    }
  },

  async logout(req, res) {
    const encryptedToken = req.headers.authorization?.split(' ')[1];
    if (!encryptedToken) {
      return res.status(400).json({ message: 'No token provided' });
    }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedToken, process.env.TOKEN_ENCRYPTION_KEY);
      const token = bytes.toString(CryptoJS.enc.Utf8);
      if (!token) {
        return res.status(400).json({ message: 'Invalid token' });
      }
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return res.status(400).json({ message: 'Invalid token' });
      }
      const currentTime = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - currentTime;
      if (ttl > 0) {
        await redisClient.set(token, 'revoked', { EX: ttl });
      }
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
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!user.password) {
        return res.status(400).json({ message: 'Password reset not available for this account' });
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
      return res.json({ message: 'Verification code sent', userId: user.id });
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
      if (user.two_fa_setup) {
        return res.json({ message: '2fa_required', userId: user.id });
      } else {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.update({
          verificationToken: resetToken,
          tokenExpires,
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
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const verified = verify2FACode({ base32: user.two_fa_secret }, code);
      if (!verified) {
        return res.status(401).json({ message: 'Invalid 2FA code' });
      }
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.update({
        verificationToken: resetToken,
        tokenExpires,
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
      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ message: 'Password must include letters, numbers, and symbols' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({
        password: hashedPassword,
        verificationToken: null,
        tokenExpires: null,
      });
      return res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
  }
};

module.exports = authController;
