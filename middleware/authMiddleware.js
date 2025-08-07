const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Admin middleware - require admin role
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }
};

// Freelancer middleware - require freelancer role
const freelancer = (req, res, next) => {
  if (req.user && req.user.role === 'freelancer') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Freelancer role required.'
    });
  }
};

// Client middleware - require client role
const client = (req, res, next) => {
  if (req.user && req.user.role === 'client') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Client role required.'
    });
  }
};

module.exports = { protect, admin, freelancer, client }; 