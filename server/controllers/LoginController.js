const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const Setting = require("../models/Setting");
require("dotenv").config();

// Google OAuth2 setup
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
const sendVerificationEmail = async (email, code) => {
  try {
    await transporter.sendMail({
      from: `"Student Council" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Verification Code",
      html: `
        <h2>FLAME Infirmary Login Verification</h2>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("❌ Email sending error:", error);
    return false;
  }
};

// Generate 2FA secret
const generate2FASecret = () => {
  return speakeasy.generateSecret({ length: 20 });
};

// Generate QR code
const generateQRCode = async (secret, email) => {
  const otpauthUrl = speakeasy.otpauthURL({
    secret: secret.base32,
    label: email,
    issuer: 'FLAME Infirmary',
    encoding: 'base32',
  });
  console.log('Generated OTPAuth URL:', otpauthUrl);
  return otpauthUrl;
};

// Verify 2FA code
const verify2FACode = (secret, code) => {
  return speakeasy.totp.verify({
    secret: secret.base32,
    encoding: "base32",
    token: code,
    window: 1,
  });
};

// Fetch 2FA settings
const get2FASettings = async () => {
  const adminSetting = await Setting.findOne({ where: { setting_key: "admin_2fa_enabled" } });
  const userSetting = await Setting.findOne({ where: { setting_key: "user_2fa_enabled" } });
  return {
    admin_2fa_enabled: adminSetting ? adminSetting.setting_value === "true" : false,
    user_2fa_enabled: userSetting ? userSetting.setting_value === "true" : false,
  };
};

const loginUser = async (req, res) => {
  if (req.method === "GET") {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ message: "error", errors: ["Missing `code` in callback"] });
    }

    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({ message: "error", errors: ["You are not registered yet"] });
      }

      await user.update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      });

      const token = jwt.sign(
        {
          id: user.id,
          userType: user.userType,
          email: user.email,
          employeeName: user.EmployeeName,
        },
        process.env.SECRET_KEY,
        { expiresIn: "365d" }
      );

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        302,
        `${frontendUrl}/oauth2/redirect?token=${encodeURIComponent(token)}`
      );
    } catch (err) {
      return res.status(500).json({ message: "error", errors: [err.message] });
    }
  }

  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ message: "error", errors: ["Please enter email"] });
  }

  let user;
  try {
    user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "error", errors: ["You are not registered yet"] });
    }
  } catch (err) {
    return res.status(500).json({ message: "error", errors: [err.message] });
  }

  if (user.userType === "Admin") {
    if (!password) {
      return res.status(400).json({ message: "error", errors: ["Please enter password"] });
    }
    try {
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: "error", errors: ["Invalid password"] });
      }
    } catch (err) {
      return res.status(500).json({ message: "error", errors: [err.message] });
    }
  }

  try {
    const verificationCode = generateVerificationCode();
    const tokenExpires = new Date(Date.now() + 10 * 60 * 1000);
    const hashedCode = await bcrypt.hash(verificationCode, 10);

    await user.update({
      verificationToken: hashedCode,
      tokenExpires,
    });

    const emailSent = await sendVerificationEmail(email, verificationCode);
    if (!emailSent) {
      return res.status(500).json({ message: "error", errors: ["Failed to send verification email"] });
    }

    return res.json({
      message: "verify",
      email,
      userId: user.id,
    });
  } catch (err) {
    return res.status(500).json({ message: "error", errors: [err.message] });
  }
};

const verifyCode = async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ message: "error", errors: ["User ID and code are required"] });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "error", errors: ["User not found"] });
    }

    if (!user.verificationToken || !(await bcrypt.compare(code, user.verificationToken))) {
      return res.status(401).json({ message: "error", errors: ["Invalid verification code"] });
    }

    if (!user.tokenExpires || new Date() > user.tokenExpires) {
      return res.status(401).json({ message: "error", errors: ["Verification code has expired"] });
    }

    await user.update({
      verificationToken: null,
      tokenExpires: null,
    });

    const settings = await get2FASettings();
    const is2FAEnabled = user.userType === "Admin" ? settings.admin_2fa_enabled : settings.user_2fa_enabled;

    if (is2FAEnabled) {
      if (!user.two_fa_setup) {
        const secret = generate2FASecret();
        const qrCode = await generateQRCode(secret, user.email);
        await user.update({ two_fa_secret: secret.base32 });
        return res.json({ message: "2fa_setup", userId: user.id, qrCode });
      }
      return res.json({ message: "2fa_required", userId: user.id });
    }

    if (user.userType === "Admin") {
      const token = jwt.sign(
        {
          id: user.id,
          userType: user.userType,
          email: user.email,
          employeeName: user.EmployeeName,
        },
        process.env.SECRET_KEY,
        { expiresIn: "365d" }
      );
      return res.json({
        message: "success",
        user: {
          id: user.id,
          employeeName: user.EmployeeName,
          userType: user.userType,
          email: user.email,
        },
        token,
      });
    }

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    });
    return res.status(200).json({ message: "redirect", url: authUrl });
  } catch (err) {
    return res.status(500).json({ message: "error", errors: [err.message] });
  }
};

const verify2FALogin = async (req, res) => {
  const { userId, code } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "error", errors: ["User not found"] });
    }

    const verified = verify2FACode({ base32: user.two_fa_secret }, code);
    if (!verified) {
      return res.status(401).json({ message: "error", errors: ["Invalid 2FA code"] });
    }

    if (!user.two_fa_setup) {
      await user.update({ two_fa_setup: true });
    }

    if (user.userType === "Admin") {
      const token = jwt.sign(
        {
          id: user.id,
          userType: user.userType,
          email: user.email,
          employeeName: user.EmployeeName,
        },
        process.env.SECRET_KEY,
        { expiresIn: "365d" }
      );
      return res.json({
        message: "success",
        user: {
          id: user.id,
          employeeName: user.EmployeeName,
          userType: user.userType,
          email: user.email,
        },
        token,
      });
    }

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    });
    return res.status(200).json({ message: "redirect", url: authUrl });
  } catch (err) {
    return res.status(500).json({ message: "error", errors: [err.message] });
  }
};

const get2FASettingsHandler = async (req, res) => {
  try {
    const settings = await get2FASettings();
    return res.json(settings);
  } catch (err) {
    console.error("Error fetching 2FA settings:", err);
    return res.status(500).json({ message: "error", errors: [err.message] });
  }
};

const update2FASettings = async (req, res) => {
  const { admin_2fa_enabled, user_2fa_enabled } = req.body;
  try {
    console.log("Updating settings with:", { admin_2fa_enabled, user_2fa_enabled });

    let adminSetting = await Setting.findOne({ where: { setting_key: "admin_2fa_enabled" } });
    if (adminSetting) {
      await adminSetting.update({ setting_value: admin_2fa_enabled ? "true" : "false" });
    } else {
      await Setting.create({ setting_key: "admin_2fa_enabled", setting_value: admin_2fa_enabled ? "true" : "false" });
    }

    let userSetting = await Setting.findOne({ where: { setting_key: "user_2fa_enabled" } });
    if (userSetting) {
      await userSetting.update({ setting_value: user_2fa_enabled ? "true" : "false" });
    } else {
      await Setting.create({ setting_key: "user_2fa_enabled", setting_value: user_2fa_enabled ? "true" : "false" });
    }

    console.log("Settings updated successfully");
    return res.json({ message: "2FA settings updated", settings: { admin_2fa_enabled, user_2fa_enabled } });
  } catch (err) {
    console.error("Detailed error in update2FASettings:", err);
    return res.status(500).json({ message: "error", errors: [err.message] });
  }
};

module.exports = { loginUser, verifyCode, verify2FALogin, get2FASettingsHandler, update2FASettings };