const { db } = require('../db');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all maps
 * GET /api/maps
 */
async function getMaps(req, res) {
  try {
    const maps = await db('maps')
      .select(
        'id',
        'name',
        'description',
        db.raw('ST_AsGeoJSON(center) as center'),
        'zoom',
        'is_public'
      )
      .orderBy('name', 'asc');

    // Parse center geometry
    const mapsWithCenter = maps.map(map => ({
      ...map,
      center: map.center ? JSON.parse(map.center) : null,
    }));

    res.status(200).json({
      status: 'success',
      code: 200,
      data: mapsWithCenter,
    });
  } catch (error) {
    logger.error('Error fetching maps:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to fetch maps',
    });
  }
}

/**
 * Get map by ID with all layer groups and layers
 * GET /api/maps/:id
 */
async function getMapById(req, res) {
  try {
    const { id } = req.params;

    // Get map
    const map = await db('maps')
      .select(
        'id',
        'name',
        'description',
        db.raw('ST_AsGeoJSON(center) as center'),
        'zoom',
        'is_public'
      )
      .where('id', id)
      .first();

    if (!map) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Map not found',
      });
    }

    // Get layer groups with layers
    const layerGroups = await db('layer_groups')
      .select(
        'id',
        'map_id',
        'name',
        'z_index',
        'is_basemap'
      )
      .where('map_id', id)
      .orderBy('z_index', 'asc')
      .orderBy('name', 'asc');

    // Get layers for each group
    for (const group of layerGroups) {
      const layers = await db('layers')
        .select(
          'id',
          'group_id',
          'name',
          'type',
          'url',
          'layer_name',
          'style',
          'z_index',
          'visible'
        )
        .where('group_id', group.id)
        .orderBy('z_index', 'asc')
        .orderBy('name', 'asc');

      group.layers = layers;
    }

    const mapData = {
      ...map,
      center: map.center ? JSON.parse(map.center) : null,
      layer_groups: layerGroups,
    };

    res.status(200).json({
      status: 'success',
      code: 200,
      data: mapData,
    });
  } catch (error) {
    logger.error('Error fetching map:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to fetch map',
    });
  }
}

/**
 * Create a new map
 * POST /api/maps
 */
async function createMap(req, res) {
  try {
    const { name, description, center, zoom, is_public } = req.body;

    if (!name) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Map name is required',
      });
    }

    // Build insert object
    const insertData = {
      id: uuidv4(), // Generate UUID for new map
      name,
      description: description || null,
      zoom: zoom || 8,
      is_public: is_public !== undefined ? is_public : true,
    };

    // Add center geometry if provided
    if (center && center.coordinates) {
      insertData.center = db.raw(
        `ST_SetSRID(ST_MakePoint(?, ?), 4326)`,
        [center.coordinates[0], center.coordinates[1]]
      );
    } else if (center && center.lng && center.lat) {
      insertData.center = db.raw(
        `ST_SetSRID(ST_MakePoint(?, ?), 4326)`,
        [center.lng, center.lat]
      );
    }

    const [map] = await db('maps')
      .insert(insertData)
      .returning([
        'id',
        'name',
        'description',
        db.raw('ST_AsGeoJSON(center) as center'),
        'zoom',
        'is_public'
      ]);

    const mapData = {
      ...map,
      center: map.center ? JSON.parse(map.center) : null,
    };

    res.status(201).json({
      status: 'success',
      code: 201,
      data: mapData,
    });
  } catch (error) {
    logger.error('Error creating map:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to create map',
    });
  }
}

/**
 * Update map
 * PUT /api/maps/:id
 */
async function updateMap(req, res) {
  try {
    const { id } = req.params;
    const { name, description, center, zoom, is_public } = req.body;

    // Check if map exists
    const existingMap = await db('maps').where('id', id).first();
    if (!existingMap) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Map not found',
      });
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (zoom !== undefined) updateData.zoom = zoom;
    if (is_public !== undefined) updateData.is_public = is_public;

    // Update center geometry if provided
    if (center) {
      if (center.coordinates) {
        updateData.center = db.raw(
          `ST_SetSRID(ST_MakePoint(?, ?), 4326)`,
          [center.coordinates[0], center.coordinates[1]]
        );
      } else if (center.lng && center.lat) {
        updateData.center = db.raw(
          `ST_SetSRID(ST_MakePoint(?, ?), 4326)`,
          [center.lng, center.lat]
        );
      }
    }

    const [map] = await db('maps')
      .where('id', id)
      .update(updateData)
      .returning([
        'id',
        'name',
        'description',
        db.raw('ST_AsGeoJSON(center) as center'),
        'zoom',
        'is_public'
      ]);

    const mapData = {
      ...map,
      center: map.center ? JSON.parse(map.center) : null,
    };

    res.status(200).json({
      status: 'success',
      code: 200,
      data: mapData,
    });
  } catch (error) {
    logger.error('Error updating map:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to update map',
    });
  }
}

/**
 * Delete map
 * DELETE /api/maps/:id
 */
async function deleteMap(req, res) {
  try {
    const { id } = req.params;

    const deleted = await db('maps').where('id', id).del();

    if (deleted === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Map not found',
      });
    }

    res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Map deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting map:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to delete map',
    });
  }
}

/**
 * Create layer group
 * POST /api/maps/:mapId/layer-groups
 */
async function createLayerGroup(req, res) {
  try {
    const { mapId } = req.params;
    const { name, z_index, is_basemap } = req.body;

    if (!name) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Layer group name is required',
      });
    }

    // Check if map exists
    const map = await db('maps').where('id', mapId).first();
    if (!map) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Map not found',
      });
    }

    const [group] = await db('layer_groups')
      .insert({
        id: uuidv4(), // Generate UUID for new layer group
        map_id: mapId,
        name,
        z_index: z_index || 0,
        is_basemap: is_basemap || false,
      })
      .returning('*');

    res.status(201).json({
      status: 'success',
      code: 201,
      data: group,
    });
  } catch (error) {
    logger.error('Error creating layer group:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to create layer group',
    });
  }
}

/**
 * Update layer group
 * PUT /api/layer-groups/:id
 */
async function updateLayerGroup(req, res) {
  try {
    const { id } = req.params;
    const { name, z_index, is_basemap } = req.body;

    const existingGroup = await db('layer_groups').where('id', id).first();
    if (!existingGroup) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Layer group not found',
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (z_index !== undefined) updateData.z_index = z_index;
    if (is_basemap !== undefined) updateData.is_basemap = is_basemap;

    const [group] = await db('layer_groups')
      .where('id', id)
      .update(updateData)
      .returning('*');

    res.status(200).json({
      status: 'success',
      code: 200,
      data: group,
    });
  } catch (error) {
    logger.error('Error updating layer group:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to update layer group',
    });
  }
}

/**
 * Delete layer group
 * DELETE /api/layer-groups/:id
 */
async function deleteLayerGroup(req, res) {
  try {
    const { id } = req.params;

    const deleted = await db('layer_groups').where('id', id).del();

    if (deleted === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Layer group not found',
      });
    }

    res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Layer group deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting layer group:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to delete layer group',
    });
  }
}

/**
 * Create layer
 * POST /api/layer-groups/:groupId/layers
 */
async function createLayer(req, res) {
  try {
    const { groupId } = req.params;
    const { name, type, url, layer_name, layer_id, style, attribution, z_index, visible } = req.body;

    if (!name || !type || !url) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Layer name, type, and url are required',
      });
    }

    // Validate type
    const validTypes = ['wms', 'wfs', 'xyz', 'mvt', 'geojson', 'arcgis', 'mapserver', 'arcgismapserver'];
    if (!validTypes.includes(type.toLowerCase())) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: `Layer type must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Check if group exists
    const group = await db('layer_groups').where('id', groupId).first();
    if (!group) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Layer group not found',
      });
    }

    const layerData = {
      id: uuidv4(), // Generate UUID for new layer
      group_id: groupId,
      name,
      type: type.toLowerCase(),
      url,
      layer_name: layer_name || null,
      style: style || null,
      z_index: z_index || 0,
      visible: visible !== undefined ? visible : true,
    };
    
    // Add optional fields if provided
    if (layer_id !== undefined && layer_id !== null && layer_id !== '') {
      layerData.layer_id = layer_id;
    }
    if (attribution !== undefined && attribution !== null && attribution !== '') {
      layerData.attribution = attribution;
    }
    
    const [layer] = await db('layers')
      .insert(layerData)
      .returning('*');

    res.status(201).json({
      status: 'success',
      code: 201,
      data: layer,
    });
  } catch (error) {
    logger.error('Error creating layer:', error);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Failed to create layer';
    const isDatabaseError = error.code === '42703' || error.code === '42P01' || error.message?.includes('column') || error.message?.includes('does not exist');
    
    res.status(500).json({
      status: 'error',
      code: 500,
      message: isDatabaseError 
        ? 'Database schema error. Please run migrations to add layer_id and attribution columns.'
        : errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update layer
 * PUT /api/layers/:id
 */
async function updateLayer(req, res) {
  try {
    const { id } = req.params;
    const { name, type, url, layer_name, layer_id, style, attribution, z_index, visible } = req.body;

    const existingLayer = await db('layers').where('id', id).first();
    if (!existingLayer) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Layer not found',
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      const validTypes = ['wms', 'wfs', 'xyz', 'mvt', 'geojson', 'arcgis', 'mapserver', 'arcgismapserver'];
      if (!validTypes.includes(type.toLowerCase())) {
        return res.status(400).json({
          status: 'error',
          code: 400,
          message: `Layer type must be one of: ${validTypes.join(', ')}`,
        });
      }
      updateData.type = type.toLowerCase();
    }
    if (url !== undefined) updateData.url = url;
    if (layer_name !== undefined) updateData.layer_name = layer_name;
    if (layer_id !== undefined) {
      // Allow null or empty string to clear the field
      updateData.layer_id = layer_id === '' ? null : layer_id;
    }
    if (style !== undefined) updateData.style = style;
    if (attribution !== undefined) {
      // Allow null or empty string to clear the field
      updateData.attribution = attribution === '' ? null : attribution;
    }
    if (z_index !== undefined) updateData.z_index = z_index;
    if (visible !== undefined) updateData.visible = visible;

    const [layer] = await db('layers')
      .where('id', id)
      .update(updateData)
      .returning('*');

    res.status(200).json({
      status: 'success',
      code: 200,
      data: layer,
    });
  } catch (error) {
    logger.error('Error updating layer:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to update layer',
    });
  }
}

/**
 * Delete layer
 * DELETE /api/layers/:id
 */
async function deleteLayer(req, res) {
  try {
    const { id } = req.params;

    const deleted = await db('layers').where('id', id).del();

    if (deleted === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Layer not found',
      });
    }

    res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Layer deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting layer:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to delete layer',
    });
  }
}

module.exports = {
  getMaps,
  getMapById,
  createMap,
  updateMap,
  deleteMap,
  createLayerGroup,
  updateLayerGroup,
  deleteLayerGroup,
  createLayer,
  updateLayer,
  deleteLayer,
};

