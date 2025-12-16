const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

/**
 * Upload routes
 * All upload endpoints require admin authentication
 */

// Upload file (shapefile or GeoTIFF)
router.post('/', requireAuth, requireAdmin, uploadController.upload, uploadController.uploadFile);

// Get upload status
router.get('/:id', requireAuth, requireAdmin, uploadController.getUploadStatus);

// Get all uploads
router.get('/', requireAuth, requireAdmin, uploadController.getUploads);

module.exports = router;

