const express = require('express');
const router = express.Router();
const layerController = require('../controllers/layer.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

/**
 * Layer routes
 */

// Get all layers (public, but can be filtered)
router.get('/', layerController.getLayers);

// Get layer by ID (public)
router.get('/:id', layerController.getLayer);

// Create layer (requires admin)
router.post('/', requireAuth, requireAdmin, layerController.createLayer);

// Update layer (requires admin)
router.put('/:id', requireAuth, requireAdmin, layerController.updateLayer);

// Delete layer (requires admin)
router.delete('/:id', requireAuth, requireAdmin, layerController.deleteLayer);

module.exports = router;

