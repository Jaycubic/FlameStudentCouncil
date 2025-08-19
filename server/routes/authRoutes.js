// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateToken } = require('../middleware/auth');

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-code', authController.verifyCode);
router.post('/resend-verification-code', authController.resendVerificationCode);
router.post('/verify-2fa', authController.verify2FA);
router.post('/logout', validateToken, authController.logout);
router.get('/profile', validateToken, authController.getProfile);
router.get('/google', authController.googleSignIn);
router.get('/google/callback', authController.googleCallback);

// Forgot Password Routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/verify-reset-2fa', authController.verifyReset2FA);
router.post('/reset-password', authController.resetPassword);

module.exports = router;