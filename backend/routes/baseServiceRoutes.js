const express = require('express');
const router = express.Router();
const {
  getAllBaseServices,
  getBaseServiceById,
  createBaseService,
  updateBaseService,
  deleteBaseService
} = require('../controllers/baseServiceController');

router.route('/')
  .get(getAllBaseServices)
  .post(createBaseService);

router.route('/:id')
  .get(getBaseServiceById)
  .put(updateBaseService)
  .delete(deleteBaseService);

module.exports = router;








