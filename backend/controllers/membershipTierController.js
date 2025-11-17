const mongoose = require('mongoose');
const MembershipTier = require('../models/MembershipTier');
const Client = require('../models/Client');

// @desc    Get all membership tiers
// @route   GET /api/membership-tiers
// @access  Public
const getAllMembershipTiers = async (req, res) => {
  try {
    console.log('getAllMembershipTiers - Query params:', req.query);
    const { isActive } = req.query;
    let query = {};

    // Filter by active status if provided
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const tiers = await MembershipTier.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Get member count for each tier
    const tiersWithCounts = await Promise.all(
      tiers.map(async (tier) => {
        const memberCount = await Client.countDocuments({ membership_id: tier._id });
        return {
          ...tier,
          memberCount
        };
      })
    );

    console.log(`getAllMembershipTiers - Found ${tiers.length} tiers`);

    res.status(200).json({
      success: true,
      count: tiers.length,
      data: tiersWithCounts
    });
  } catch (error) {
    console.error('getAllMembershipTiers - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching membership tiers',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single membership tier by ID
// @route   GET /api/membership-tiers/:id
// @access  Public
const getMembershipTierById = async (req, res) => {
  try {
    const tier = await MembershipTier.findById(req.params.id).lean();

    if (!tier) {
      return res.status(404).json({
        success: false,
        message: 'Membership tier not found'
      });
    }

    // Get member count
    const memberCount = await Client.countDocuments({ membership_id: tier._id });

    res.status(200).json({
      success: true,
      data: {
        ...tier,
        memberCount
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership tier ID'
      });
    }
    console.error('getMembershipTierById - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching membership tier',
      error: error.message
    });
  }
};

// @desc    Create new membership tier
// @route   POST /api/membership-tiers
// @access  Public
const createMembershipTier = async (req, res) => {
  try {
    console.log('createMembershipTier - Request body:', JSON.stringify(req.body, null, 2));

    const {
      name,
      discount_percent,
      points_per_session,
      point_value,
      redemption_threshold,
      max_sessions_before_reset,
      isActive
    } = req.body;

    // Validate required fields
    if (!name || discount_percent === undefined || points_per_session === undefined || 
        point_value === undefined || redemption_threshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, discount_percent, points_per_session, point_value, redemption_threshold'
      });
    }

    const tierData = {
      name: name.trim(),
      discount_percent: Number(discount_percent),
      points_per_session: Number(points_per_session),
      point_value: Number(point_value),
      redemption_threshold: Number(redemption_threshold),
      max_sessions_before_reset: max_sessions_before_reset !== undefined && max_sessions_before_reset !== null 
        ? Number(max_sessions_before_reset) 
        : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    };

    const tier = await MembershipTier.create(tierData);

    console.log('createMembershipTier - Created tier:', tier._id);

    res.status(201).json({
      success: true,
      data: tier
    });
  } catch (error) {
    console.error('createMembershipTier - Error:', error);
    console.error('createMembershipTier - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors
    });

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Membership tier name already exists'
      });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating membership tier',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update membership tier
// @route   PUT /api/membership-tiers/:id
// @access  Public
const updateMembershipTier = async (req, res) => {
  try {
    console.log('updateMembershipTier - Request params:', req.params);
    console.log('updateMembershipTier - Request body:', JSON.stringify(req.body, null, 2));

    const tier = await MembershipTier.findById(req.params.id);

    if (!tier) {
      return res.status(404).json({
        success: false,
        message: 'Membership tier not found'
      });
    }

    const {
      name,
      discount_percent,
      points_per_session,
      point_value,
      redemption_threshold,
      max_sessions_before_reset,
      isActive
    } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (discount_percent !== undefined) updateData.discount_percent = Number(discount_percent);
    if (points_per_session !== undefined) updateData.points_per_session = Number(points_per_session);
    if (point_value !== undefined) updateData.point_value = Number(point_value);
    if (redemption_threshold !== undefined) updateData.redemption_threshold = Number(redemption_threshold);
    if (max_sessions_before_reset !== undefined) {
      updateData.max_sessions_before_reset = max_sessions_before_reset !== null 
        ? Number(max_sessions_before_reset) 
        : null;
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    console.log('updateMembershipTier - Update data:', JSON.stringify(updateData, null, 2));

    const updatedTier = await MembershipTier.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedTier
    });
  } catch (error) {
    console.error('updateMembershipTier - Error:', error);
    console.error('updateMembershipTier - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors
    });

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership tier ID'
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Membership tier name already exists'
      });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating membership tier',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete membership tier
// @route   DELETE /api/membership-tiers/:id
// @access  Public
const deleteMembershipTier = async (req, res) => {
  try {
    const tier = await MembershipTier.findById(req.params.id);

    if (!tier) {
      return res.status(404).json({
        success: false,
        message: 'Membership tier not found'
      });
    }

    // Check if any clients are using this tier
    const clientsUsingTier = await Client.countDocuments({ membership_id: tier._id });

    if (clientsUsingTier > 0) {
      // Instead of hard delete, deactivate the tier
      tier.isActive = false;
      await tier.save();
      
      return res.status(200).json({
        success: true,
        message: `Cannot delete tier as ${clientsUsingTier} client(s) are using it. Tier has been deactivated instead.`,
        data: tier
      });
    }

    await MembershipTier.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Membership tier deleted successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership tier ID'
      });
    }
    console.error('deleteMembershipTier - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting membership tier',
      error: error.message
    });
  }
};

// @desc    Get tier statistics
// @route   GET /api/membership-tiers/:id/stats
// @access  Public
const getTierStats = async (req, res) => {
  try {
    const tier = await MembershipTier.findById(req.params.id);

    if (!tier) {
      return res.status(404).json({
        success: false,
        message: 'Membership tier not found'
      });
    }

    // Get member count
    const memberCount = await Client.countDocuments({ membership_id: tier._id });

    // Get total points issued (sum of points_balance for all members)
    const totalPointsResult = await Client.aggregate([
      { $match: { membership_id: new mongoose.Types.ObjectId(req.params.id) } },
      { $group: { _id: null, totalPoints: { $sum: '$points_balance' } } }
    ]);
    const totalPointsIssued = totalPointsResult.length > 0 ? totalPointsResult[0].totalPoints : 0;

    // Get total sessions (sum of total_sessions for all members)
    const totalSessionsResult = await Client.aggregate([
      { $match: { membership_id: new mongoose.Types.ObjectId(req.params.id) } },
      { $group: { _id: null, totalSessions: { $sum: '$total_sessions' } } }
    ]);
    const totalSessions = totalSessionsResult.length > 0 ? totalSessionsResult[0].totalSessions : 0;

    res.status(200).json({
      success: true,
      data: {
        tier: tier,
        memberCount,
        totalPointsIssued,
        totalSessions
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership tier ID'
      });
    }
    console.error('getTierStats - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tier statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllMembershipTiers,
  getMembershipTierById,
  createMembershipTier,
  updateMembershipTier,
  deleteMembershipTier,
  getTierStats
};
