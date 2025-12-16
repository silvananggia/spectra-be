const logger = require('../utils/logger');
const { db } = require('../db');
const layerService = require('../services/layer.service');

/**
 * Get map configuration for frontend
 * GET /api/maps/:id
 */
async function getMap(req, res) {
  try {
    const { id } = req.params;

    const mapConfig = await layerService.getMapConfig(id);

    if (!mapConfig) {
      return res.status(404).json({ error: 'Map not found' });
    }

    res.json(mapConfig);
  } catch (error) {
    logger.error('Error fetching map:', error);
    res.status(500).json({ error: 'Failed to fetch map', message: error.message });
  }
}

/**
 * Get all maps
 * GET /api/maps
 */
async function getMaps(req, res) {
  try {
    const maps = await db('maps')
      .select('id', 'name', 'title', 'description', 'is_public', 'created_at', 'updated_at')
      .orderBy('created_at', 'desc');

    // Get center point for each map
    const mapsWithCenter = await Promise.all(
      maps.map(async (map) => {
        const centerResult = await db.raw(
          `SELECT ST_X(center) as lon, ST_Y(center) as lat FROM maps WHERE id = ?::uuid`,
          [map.id]
        );
        const center = centerResult.rows[0] || { lon: 0, lat: 0 };
        return {
          ...map,
          center: [parseFloat(center.lon), parseFloat(center.lat)],
        };
      })
    );

    res.json(mapsWithCenter);
  } catch (error) {
    logger.error('Error fetching maps:', error);
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
}

/**
 * Create a new map
 * POST /api/maps
 */
async function createMap(req, res) {
  try {
    const { name, title, description, center, zoom, min_zoom, max_zoom, is_public, config } = req.body;

    // Validate required fields
    if (!name || !title || !center || !Array.isArray(center) || center.length !== 2) {
      return res.status(400).json({ error: 'Invalid map data. Required: name, title, center [lon, lat]' });
    }

    // Create geometry point from center coordinates
    const [lon, lat] = center;
    const centerPoint = `POINT(${lon} ${lat})`;

    const map = await db('maps')
      .insert({
        name,
        title,
        description: description || null,
        center: db.raw(`ST_GeomFromText(?, 4326)`, [centerPoint]),
        zoom: zoom || 2,
        min_zoom: min_zoom || 0,
        max_zoom: max_zoom || 20,
        is_public: is_public || false,
        created_by: req.user?.id || null,
        config: config || null,
      })
      .returning('*');

    logger.info(`Created map: ${map[0].id}`);
    res.status(201).json(map[0]);
  } catch (error) {
    logger.error('Error creating map:', error);
    res.status(500).json({ error: 'Failed to create map', message: error.message });
  }
}

/**
 * Update map
 * PUT /api/maps/:id
 */
async function updateMap(req, res) {
  try {
    const { id } = req.params;
    const { name, title, description, center, zoom, min_zoom, max_zoom, is_public, config } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (zoom !== undefined) updateData.zoom = zoom;
    if (min_zoom !== undefined) updateData.min_zoom = min_zoom;
    if (max_zoom !== undefined) updateData.max_zoom = max_zoom;
    if (is_public !== undefined) updateData.is_public = is_public;
    if (config !== undefined) updateData.config = config;

    // Update center if provided
    if (center && Array.isArray(center) && center.length === 2) {
      const [lon, lat] = center;
      const centerPoint = `POINT(${lon} ${lat})`;
      await db('maps')
        .where('id', id)
        .update({
          center: db.raw(`ST_GeomFromText(?, 4326)`, [centerPoint]),
        });
    }

    const updated = await db('maps').where('id', id).update(updateData).returning('*');

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Map not found' });
    }

    logger.info(`Updated map: ${id}`);
    res.json(updated[0]);
  } catch (error) {
    logger.error('Error updating map:', error);
    res.status(500).json({ error: 'Failed to update map', message: error.message });
  }
}

module.exports = {
  getMap,
  getMaps,
  createMap,
  updateMap,
};

