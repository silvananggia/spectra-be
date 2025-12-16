const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { executeCommand } = require('../utils/exec');
const logger = require('../utils/logger');
const { db } = require('../db');
const geoserverService = require('./geoserver.service');

/**
 * Shapefile Processing Service
 * Handles ZIP extraction, PostGIS import, and GeoServer publishing
 */
class ShapefileService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.defaultEPSG = process.env.DEFAULT_EPSG || '4326';
  }

  /**
   * Extract ZIP file and find .shp file
   */
  async extractShapefile(zipPath, extractDir) {
    try {
      await fs.mkdir(extractDir, { recursive: true });

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);

      // Find .shp file
      const files = await fs.readdir(extractDir);
      const shpFile = files.find((f) => f.toLowerCase().endsWith('.shp'));

      if (!shpFile) {
        throw new Error('No .shp file found in ZIP archive');
      }

      const shpPath = path.join(extractDir, shpFile);
      const shpName = path.parse(shpFile).name;

      logger.info(`Extracted shapefile: ${shpFile}`);
      return { shpPath, shpName };
    } catch (error) {
      logger.error('Error extracting shapefile:', error);
      throw error;
    }
  }

  /**
   * Get shapefile metadata (SRID, extent, feature count)
   */
  async getShapefileMetadata(shpPath) {
    try {
      // Use ogrinfo to get metadata
      const command = `ogrinfo -al -so "${shpPath}"`;
      const { stdout } = await executeCommand(command);

      const metadata = {
        srid: null,
        geometryType: null,
        featureCount: 0,
        extent: null,
      };

      // Parse ogrinfo output
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('Geometry:')) {
          const match = line.match(/Geometry: (\w+)/);
          if (match) metadata.geometryType = match[1];
        }
        if (line.includes('Feature Count:')) {
          const match = line.match(/Feature Count: (\d+)/);
          if (match) metadata.featureCount = parseInt(match[1]);
        }
        if (line.includes('Extent:')) {
          const match = line.match(/Extent: \((.*?)\) - \((.*?)\)/);
          if (match) {
            metadata.extent = {
              min: match[1].split(',').map(Number),
              max: match[2].split(',').map(Number),
            };
          }
        }
      }

      return metadata;
    } catch (error) {
      logger.warn('Could not get shapefile metadata:', error.message);
      return { srid: null, geometryType: null, featureCount: 0, extent: null };
    }
  }

  /**
   * Import shapefile into PostGIS using shp2pgsql
   */
  async importToPostGIS(shpPath, tableName, schema = 'public', srid = null, options = {}) {
    try {
      const epsg = srid || this.defaultEPSG;
      const {
        drop = false,
        create = true,
        append = false,
        spatialIndex = true,
      } = options;

      // Build shp2pgsql command
      let mode = '-c'; // Create mode (default)
      if (append) mode = '-a'; // Append mode
      if (drop && !append) mode = '-d'; // Drop mode

      let command = `shp2pgsql ${mode} -s ${epsg} -I "${shpPath}" ${schema}.${tableName}`;

      // Execute shp2pgsql and pipe to psql
      const dbConfig = {
        PGHOST: process.env.DB_HOST || 'localhost',
        PGPORT: process.env.DB_PORT || '5432',
        PGDATABASE: process.env.DB_NAME || 'spectra_gis',
        PGUSER: process.env.DB_USER || 'postgres',
        PGPASSWORD: process.env.DB_PASSWORD || 'postgres',
      };

      // Set environment variables for psql
      const envVars = Object.entries(dbConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');

      // Combine shp2pgsql with psql
      command = `${command} | ${envVars} psql -q`;

      logger.info(`Importing shapefile to PostGIS: ${tableName}`);
      const { stdout, stderr } = await executeCommand(command, {
        env: { ...process.env, ...dbConfig },
        ignoreStderr: true,
      });

      // Create spatial index if requested
      if (spatialIndex) {
        try {
          await db.raw(
            `CREATE INDEX IF NOT EXISTS ${tableName}_geom_idx ON ${schema}.${tableName} USING GIST (geom)`
          );
          logger.info(`Created spatial index on ${tableName}`);
        } catch (error) {
          logger.warn(`Could not create spatial index: ${error.message}`);
        }
      }

      // Get actual feature count and extent from database
      const result = await db.raw(`
        SELECT 
          COUNT(*) as count,
          ST_Extent(geom) as extent,
          ST_SRID(geom) as srid,
          GeometryType(geom) as geom_type
        FROM ${schema}.${tableName}
      `);

      const metadata = {
        featureCount: parseInt(result.rows[0].count) || 0,
        srid: parseInt(result.rows[0].srid) || parseInt(epsg),
        geometryType: result.rows[0].geom_type || 'GEOMETRY',
        extent: result.rows[0].extent,
      };

      logger.info(`Successfully imported ${metadata.featureCount} features to ${tableName}`);
      return metadata;
    } catch (error) {
      logger.error(`Error importing to PostGIS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process complete shapefile upload: extract, import, publish
   */
  async processShapefile(zipPath, uploadRecord, options = {}) {
    const {
      tableName = null,
      workspace = null,
      datastoreName = 'postgis',
      srid = null,
      layerName = null,
    } = options;

    const extractDir = path.join(this.uploadDir, 'temp', uploadRecord.id);
    let shpPath, shpName, metadata;

    try {
      // Step 1: Extract ZIP
      logger.info(`Extracting shapefile: ${uploadRecord.filename}`);
      ({ shpPath, shpName } = await this.extractShapefile(zipPath, extractDir));

      // Step 2: Get metadata (optional, for validation)
      metadata = await this.getShapefileMetadata(shpPath);

      // Step 3: Determine table name
      const finalTableName = tableName || `layer_${uploadRecord.id.replace(/-/g, '_')}`;

      // Step 4: Import to PostGIS
      logger.info(`Importing to PostGIS: ${finalTableName}`);
      const importMetadata = await this.importToPostGIS(
        shpPath,
        finalTableName,
        'public',
        srid || metadata.srid || this.defaultEPSG,
        { spatialIndex: true }
      );

      // Combine metadata
      const fullMetadata = {
        ...metadata,
        ...importMetadata,
        tableName: finalTableName,
        schema: 'public',
      };

      // Step 5: Create GeoServer datastore if needed
      const workspaceName = workspace || process.env.GEOSERVER_WORKSPACE || 'spectra';
      await geoserverService.createWorkspace(workspaceName);

      await geoserverService.createPostGISDataStore(datastoreName, {
        host: process.env.DB_HOST || 'postgres',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'spectra_gis',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        schema: 'public',
      });

      // Step 6: Publish to GeoServer
      const finalLayerName = layerName || shpName || finalTableName;
      await geoserverService.publishFeatureType(datastoreName, finalLayerName, finalTableName);

      // Step 7: Cleanup extracted files
      try {
        await fs.rm(extractDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.warn('Error cleaning up extracted files:', cleanupError.message);
      }

      return {
        tableName: finalTableName,
        layerName: finalLayerName,
        workspace: workspaceName,
        datastore: datastoreName,
        metadata: fullMetadata,
        wmsUrl: geoserverService.getWMSLayerURL(finalLayerName),
      };
    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(extractDir, { recursive: true, force: true });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      logger.error('Error processing shapefile:', error);
      throw error;
    }
  }
}

module.exports = new ShapefileService();

