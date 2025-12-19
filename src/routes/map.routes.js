const express = require('express');
const router = express.Router();
const mapController = require('../controllers/map.controller');

/**
 * Map routes
 * Dynamic map management with layer groups and layers
 */

// Map routes
router.get('/', mapController.getMaps);
router.get('/:id', mapController.getMapById);
router.post('/', mapController.createMap);
router.put('/:id', mapController.updateMap);
router.delete('/:id', mapController.deleteMap);

// Layer group routes (nested under maps)
router.post('/:mapId/layer-groups', mapController.createLayerGroup);

// Layer group routes (direct - must be before /:id route to avoid conflict)
router.put('/layer-groups/:id', mapController.updateLayerGroup);
router.delete('/layer-groups/:id', mapController.deleteLayerGroup);

// Layer routes (nested under layer groups)
router.post('/layer-groups/:groupId/layers', mapController.createLayer);

// Layer routes (direct - must be before /:id route to avoid conflict)
router.put('/layers/:id', mapController.updateLayer);
router.delete('/layers/:id', mapController.deleteLayer);

module.exports = router;

