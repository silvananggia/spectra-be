const { db } = require('../db');
const logger = require('../utils/logger');
const geoserverService = require('./geoserver.service');

/**
 * Layer Management Service
 * Handles layer CRUD operations and map configuration
 */
class LayerService {
  /**
   * Create a new layer record
   */
  async createLayer(layerData) {
    try {
      const layer = await db('layers').insert(layerData).returning('*');
      logger.info(`Created layer: ${layer[0].id}`);
      return layer[0];
    } catch (error) {
      logger.error('Error creating layer:', error);
      throw error;
    }
  }

  /**
   * Get layer by ID
   */
  async getLayerById(layerId) {
    try {
      const layer = await db('layers').where('id', layerId).first();
      return layer;
    } catch (error) {
      logger.error('Error fetching layer:', error);
      throw error;
    }
  }

  /**
   * Get all layers with optional filters
   */
  async getLayers(filters = {}) {
    try {
      let query = db('layers').select('*');

      if (filters.map_id) {
        query = query
          .join('map_configs', 'layers.id', 'map_configs.layer_id')
          .where('map_configs.map_id', filters.map_id)
          .select('layers.*', 'map_configs.is_visible as map_visible', 'map_configs.opacity as map_opacity', 'map_configs.display_order as map_display_order');
      }

      if (filters.type) {
        query = query.where('layers.type', filters.type);
      }

      if (filters.is_visible !== undefined) {
        query = query.where('layers.is_visible', filters.is_visible);
      }

      if (filters.layer_group_id) {
        query = query.where('layers.layer_group_id', filters.layer_group_id);
      }

      query = query.orderBy('layers.display_order', 'asc');

      const layers = await query;
      return layers;
    } catch (error) {
      logger.error('Error fetching layers:', error);
      throw error;
    }
  }

  /**
   * Update layer
   */
  async updateLayer(layerId, updateData) {
    try {
      const updated = await db('layers').where('id', layerId).update(updateData).returning('*');
      logger.info(`Updated layer: ${layerId}`);
      return updated[0];
    } catch (error) {
      logger.error('Error updating layer:', error);
      throw error;
    }
  }

  /**
   * Delete layer
   */
  async deleteLayer(layerId) {
    try {
      const deleted = await db('layers').where('id', layerId).del();
      logger.info(`Deleted layer: ${layerId}`);
      return deleted > 0;
    } catch (error) {
      logger.error('Error deleting layer:', error);
      throw error;
    }
  }

  /**
   * Register uploaded layer in CMS
   */
  async registerUploadedLayer(uploadRecord, processingResult) {
    try {
      const layerData = {
        name: processingResult.layerName || processingResult.coverageName,
        title: uploadRecord.original_filename.replace(/\.[^/.]+$/, ''), // Remove extension
        description: `Uploaded ${uploadRecord.file_type}: ${uploadRecord.original_filename}`,
        type: uploadRecord.file_type === 'shapefile' ? 'wms' : 'wms', // Both become WMS
        tile_type: uploadRecord.file_type === 'shapefile' ? 'vector' : 'raster',
        url: processingResult.wmsUrl || geoserverService.getWMSLayerURL(processingResult.layerName || processingResult.coverageName),
        layer_name: processingResult.layerName || processingResult.coverageName,
        workspace: processingResult.workspace,
        datastore: processingResult.datastore || processingResult.storeName,
        is_visible: true,
        is_queryable: uploadRecord.file_type === 'shapefile',
        metadata: processingResult.metadata || {},
      };

      const layer = await this.createLayer(layerData);

      // Update upload record with layer_id
      await db('uploads').where('id', uploadRecord.id).update({ layer_id: layer.id });

      logger.info(`Registered layer in CMS: ${layer.id}`);
      return layer;
    } catch (error) {
      logger.error('Error registering layer:', error);
      throw error;
    }
  }

  /**
   * Get map configuration for frontend
   */
  async getMapConfig(mapId) {
    try {
      // Get map details
      const map = await db('maps').where('id', mapId).first();

      if (!map) {
        throw new Error('Map not found');
      }

      // Get layers for this map
      const layers = await db('layers')
        .join('map_configs', 'layers.id', 'map_configs.layer_id')
        .where('map_configs.map_id', mapId)
        .where('map_configs.is_visible', true)
        .select(
          'layers.*',
          'map_configs.opacity as map_opacity',
          'map_configs.display_order as map_display_order',
          'map_configs.min_zoom as map_min_zoom',
          'map_configs.max_zoom as map_max_zoom'
        )
        .orderBy('map_configs.display_order', 'asc');

      // Format center point
      const centerResult = await db.raw(
        `SELECT ST_X(center) as lon, ST_Y(center) as lat FROM maps WHERE id = ?::uuid`,
        [mapId]
      );
      const center = centerResult.rows[0] || { lon: 0, lat: 0 };

      // Build configuration object
      const config = {
        id: map.id,
        name: map.name,
        title: map.title,
        description: map.description,
        center: [parseFloat(center.lon), parseFloat(center.lat)],
        zoom: map.zoom,
        minZoom: map.min_zoom,
        maxZoom: map.max_zoom,
        layers: layers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          title: layer.title,
          type: layer.type,
          tileType: layer.tile_type,
          url: layer.url,
          layerName: layer.layer_name,
          workspace: layer.workspace,
          opacity: layer.map_opacity || layer.opacity,
          visible: true,
          minZoom: layer.map_min_zoom || layer.min_zoom,
          maxZoom: layer.map_max_zoom || layer.max_zoom,
          queryable: layer.is_queryable,
          metadata: layer.metadata,
        })),
        config: map.config || {},
      };

      return config;
    } catch (error) {
      logger.error('Error getting map config:', error);
      throw error;
    }
  }
}

module.exports = new LayerService();

