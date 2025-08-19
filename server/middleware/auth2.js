const jwt = require('jsonwebtoken');

const auth = {
  validateToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.error('No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded); // Debug: Log token payload
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Token verification error:', error.message);
      res.status(401).json({ message: 'Invalid token' });
    }
  },

  requireAdmin(req, res, next) {
    console.log('User role:', req.user.role); // Debug: Log user role
    if (req.user.role !== 'admin') {
      console.error('Access denied. User role:', req.user.role);
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
  },
};

module.exports = auth;
