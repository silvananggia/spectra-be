const logger = require('../utils/logger');
const layerService = require('../services/layer.service');
const geoserverService = require('../services/geoserver.service');
const { db } = require('../db');

/**
 * Get all layers
 * GET /api/layers
 */
async function getLayers(req, res) {
  try {
    const { map_id, type, is_visible, layer_group_id } = req.query;

    const filters = {};
    if (map_id) filters.map_id = map_id;
    if (type) filters.type = type;
    if (is_visible !== undefined) filters.is_visible = is_visible === 'true';
    if (layer_group_id) filters.layer_group_id = layer_group_id;

    const layers = await layerService.getLayers(filters);

    res.json(layers);
  } catch (error) {
    logger.error('Error fetching layers:', error);
    res.status(500).json({ error: 'Failed to fetch layers', message: error.message });
  }
}

/**
 * Get layer by ID
 * GET /api/layers/:id
 */
async function getLayer(req, res) {
  try {
    const { id } = req.params;

    const layer = await layerService.getLayerById(id);

    if (!layer) {
      return res.status(404).json({ error: 'Layer not found' });
    }

    res.json(layer);
  } catch (error) {
    logger.error('Error fetching layer:', error);
    res.status(500).json({ error: 'Failed to fetch layer', message: error.message });
  }
}

/**
 * Create a new layer
 * POST /api/layers
 */
async function createLayer(req, res) {
  try {
    const {
      name,
      title,
      description,
      type,
      tile_type,
      url,
      layer_name,
      workspace,
      datastore,
      default_style,
      is_visible,
      is_queryable,
      min_zoom,
      max_zoom,
      display_order,
      opacity,
      layer_group_id,
      srs,
      metadata,
    } = req.body;

    // Validate required fields
    if (!name || !title || !type || !url) {
      return res.status(400).json({
        error: 'Missing required fields. Required: name, title, type, url',
      });
    }

    // Validate type
    const validTypes = ['wms', 'wfs', 'xyz', 'mvt', 'geojson'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const layerData = {
      name,
      title,
      description: description || null,
      type,
      tile_type: tile_type || null,
      url,
      layer_name: layer_name || null,
      workspace: workspace || null,
      datastore: datastore || null,
      default_style: default_style || null,
      is_visible: is_visible !== undefined ? is_visible : true,
      is_queryable: is_queryable !== undefined ? is_queryable : true,
      min_zoom: min_zoom || null,
      max_zoom: max_zoom || null,
      display_order: display_order || 0,
      opacity: opacity || 1.0,
      layer_group_id: layer_group_id || null,
      srs: srs || 'EPSG:4326',
      metadata: metadata || null,
    };

    const layer = await layerService.createLayer(layerData);

    logger.info(`Created layer: ${layer.id}`);
    res.status(201).json(layer);
  } catch (error) {
    logger.error('Error creating layer:', error);
    res.status(500).json({ error: 'Failed to create layer', message: error.message });
  }
}

/**
 * Update layer
 * PUT /api/layers/:id
 */
async function updateLayer(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove id from update data if present
    delete updateData.id;

    // Validate type if provided
    if (updateData.type) {
      const validTypes = ['wms', 'wfs', 'xyz', 'mvt', 'geojson'];
      if (!validTypes.includes(updateData.type)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
      }
    }

    const layer = await layerService.updateLayer(id, updateData);

    if (!layer) {
      return res.status(404).json({ error: 'Layer not found' });
    }

    logger.info(`Updated layer: ${id}`);
    res.json(layer);
  } catch (error) {
    logger.error('Error updating layer:', error);
    res.status(500).json({ error: 'Failed to update layer', message: error.message });
  }
}

/**
 * Delete layer
 * DELETE /api/layers/:id
 */
async function deleteLayer(req, res) {
  try {
    const { id } = req.params;

    // Get layer info before deletion
    const layer = await layerService.getLayerById(id);

    if (!layer) {
      return res.status(404).json({ error: 'Layer not found' });
    }

    // If layer is from GeoServer, try to delete from GeoServer first
    if (layer.workspace && layer.layer_name) {
      try {
        const layerType = layer.tile_type === 'raster' ? 'coverage' : 'featuretype';
        await geoserverService.deleteLayer(layer.layer_name, layerType);
      } catch (error) {
        logger.warn(`Could not delete layer from GeoServer: ${error.message}`);
        // Continue with database deletion even if GeoServer deletion fails
      }
    }

    // Delete from database (cascade will handle related records)
    const deleted = await layerService.deleteLayer(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Layer not found' });
    }

    logger.info(`Deleted layer: ${id}`);
    res.json({ message: 'Layer deleted successfully' });
  } catch (error) {
    logger.error('Error deleting layer:', error);
    res.status(500).json({ error: 'Failed to delete layer', message: error.message });
  }
}

module.exports = {
  getLayers,
  getLayer,
  createLayer,
  updateLayer,
  deleteLayer,
};

