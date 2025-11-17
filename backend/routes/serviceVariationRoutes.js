const express = require('express');
const router = express.Router();
const {
  getAllVariations,
  getVariationsByBaseService,
  getVariationById,
  createVariation,
  updateVariation,
  deleteVariation
} = require('../controllers/serviceVariationController');

router.route('/')
  .get(getAllVariations)
  .post(createVariation);

router.route('/base-service/:baseServiceId')
  .get(getVariationsByBaseService);

router.route('/:id')
  .get(getVariationById)
  .put(updateVariation)
  .delete(deleteVariation);

module.exports = router;

