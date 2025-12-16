const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

/**
 * Product routes
 * Products are based on completed uploads.
 */

// Get all products
router.get('/', productController.getProducts);

// Download product file
router.get('/:id/download', productController.downloadProduct);

// Preview product file inline
router.get('/:id/preview', productController.previewProduct);

module.exports = router;

