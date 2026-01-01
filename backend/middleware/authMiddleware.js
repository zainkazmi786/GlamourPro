const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');

// @desc    Protect routes - require authentication
// @usage   router.get('/protected', protect, controllerFunction);
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key-change-in-production');

      // Get staff from token (exclude password)
      req.staff = await Staff.findById(decoded.id);

      if (!req.staff) {
        return res.status(401).json({
          success: false,
          message: 'Staff not found'
        });
      }

      // Check if staff is active
      if (req.staff.status !== 'Active') {
        return res.status(401).json({
          success: false,
          message: 'Account is not active'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error('Protect middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Authorize routes - check role
// @usage   router.get('/admin', protect, authorize('manager'), controllerFunction);
// @usage   router.get('/staff', protect, authorize('therapist', 'receptionist', 'manager'), controllerFunction);
// Note: Manager always has access to all routes
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Manager always has access to everything
    if (req.staff.role === 'manager') {
      return next();
    }

    // Check if user's role is in the allowed roles array
    // When called as authorize('receptionist', 'manager'), roles = ['receptionist', 'manager']
    if (!roles.includes(req.staff.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.staff.role}' is not authorized to access this route. Allowed roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize
};

