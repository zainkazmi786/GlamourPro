const jwt = require('jsonwebtoken');
const ClientAuth = require('../models/ClientAuth');
const Client = require('../models/Client');

// @desc    Protect routes - require client authentication
// @usage   router.get('/protected', clientAuth, controllerFunction);
const clientAuth = async (req, res, next) => {
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

      // Check token type (should be 'client')
      if (decoded.type !== 'client') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      // Get client auth from token (decoded.id is clientId)
      const clientAuth = await ClientAuth.findOne({ clientId: decoded.id, isActive: true });

      if (!clientAuth) {
        return res.status(401).json({
          success: false,
          message: 'Client authentication not found or inactive'
        });
      }

      // Verify client still has membership
      const client = await Client.findById(decoded.id);
      if (!client || !client.membership_id) {
        return res.status(403).json({
          success: false,
          message: 'Membership is no longer active'
        });
      }

      // Attach client to request
      req.client = {
        id: decoded.id,
        authId: clientAuth._id
      };

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error('ClientAuth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  clientAuth
};
