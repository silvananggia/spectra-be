const express = require('express');
const router = express.Router();
const mapController = require('../controllers/map.controller');
const { requireAuth } = require('../middleware/auth.middleware');

/**
 * Map routes
 */

// Get map configuration (public endpoint)
router.get('/:id', mapController.getMap);

// Get all maps
router.get('/', mapController.getMaps);

// Create map (requires auth)
router.post('/', requireAuth, mapController.createMap);

// Update map (requires auth)
router.put('/:id', requireAuth, mapController.updateMap);

module.exports = router;

