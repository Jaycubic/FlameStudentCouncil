// middleware/auth.js
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const redis = require('redis');

// Redis client setup
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});
redisClient.connect().catch(console.error);


// Device fingerprint hashing function
const getFingerprintHash = (deviceId, userAgent, salt) => {
  const raw = `${deviceId}|${userAgent}|${salt}`;
  return CryptoJS.SHA256(raw).toString();
};

const auth = {
  async validateToken(req, res, next) {
    let encryptedToken = req.headers.authorization?.split(' ')[1];

    // Fallback to cookie if header is missing
    if (!encryptedToken && req.cookies && req.cookies.accessToken) {
      encryptedToken = req.cookies.accessToken;
    }

    if (!encryptedToken) {
      console.error('No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedToken, process.env.TOKEN_ENCRYPTION_KEY);
      const token = bytes.toString(CryptoJS.enc.Utf8);
      if (!token) {
        console.error('Invalid encrypted token');
        return res.status(401).json({ message: 'Invalid token' });
      }
      const exists = await redisClient.exists(token);
      if (exists) {
        console.error('Token is revoked');
        return res.status(401).json({ message: 'Token has been revoked' });
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded);
      const deviceId = req.body.deviceId || req.headers['x-device-id'] || 'unknown'; // Client should send deviceId if available
      const userAgent = req.headers['user-agent'] || '';
      const expectedFingerprint = getFingerprintHash(deviceId, userAgent, decoded.userId.toString());
      if (expectedFingerprint !== decoded.fpHash) {
        console.error('Invalid device fingerprint');
        return res.status(401).json({ message: 'Invalid device fingerprint' });
      }
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Token verification error:', error.message);
      res.status(401).json({ message: 'Invalid token' });
    }
  },

  requireAdmin(req, res, next) {
    console.log('User role:', req.user.role);
    if (req.user.role !== 'admin') {
      console.error('Access denied. User role:', req.user.role);
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
  },

  // ── For file-serve routes only ──────────────────────────────────────────────
  // Browser file requests (new tab / img src / anchor href) send cookies but
  // CANNOT send custom headers like x-device-id.  Skips the fingerprint check
  // while still validating the JWT signature and revocation state.
  async validateTokenFileServe(req, res, next) {
    let encryptedToken = req.headers.authorization?.split(' ')[1];
    if (!encryptedToken && req.cookies?.accessToken) {
      encryptedToken = req.cookies.accessToken;
    }
    if (!encryptedToken) {
      return res.status(401).json({ message: 'No token provided' });
    }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedToken, process.env.TOKEN_ENCRYPTION_KEY);
      const token = bytes.toString(CryptoJS.enc.Utf8);
      if (!token) return res.status(401).json({ message: 'Invalid token' });

      const exists = await redisClient.exists(token);
      if (exists) return res.status(401).json({ message: 'Token has been revoked' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      // ↑ No fingerprint check — browser cannot send x-device-id on direct requests
      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  },
};

module.exports = auth;