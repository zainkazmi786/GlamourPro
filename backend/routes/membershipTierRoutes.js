const express = require('express');
const router = express.Router();
const {
  getAllMembershipTiers,
  getMembershipTierById,
  createMembershipTier,
  updateMembershipTier,
  deleteMembershipTier,
  getTierStats
} = require('../controllers/membershipTierController');

router.route('/')
  .get(getAllMembershipTiers)
  .post(createMembershipTier);

router.route('/:id')
  .get(getMembershipTierById)
  .put(updateMembershipTier)
  .delete(deleteMembershipTier);

router.route('/:id/stats')
  .get(getTierStats);

module.exports = router;

