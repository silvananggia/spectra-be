const fs = require('fs').promises;
const path = require('path');
const { executeCommand } = require('../utils/exec');
const logger = require('../utils/logger');
const geoserverService = require('./geoserver.service');

/**
 * GeoTIFF Processing Service
 * Handles GeoTIFF validation and GeoServer publishing
 */
class GeoTIFFService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
  }

  /**
   * Get GeoTIFF metadata using gdalinfo
   */
  async getGeoTIFFMetadata(tifPath) {
    try {
      const command = `gdalinfo "${tifPath}"`;
      const { stdout } = await executeCommand(command);

      const metadata = {
        size: null,
        projection: null,
        srid: null,
        extent: null,
        bands: [],
        pixelSize: null,
      };

      const lines = stdout.split('\n');
      let currentBand = null;

      for (const line of lines) {
        // Size
        if (line.includes('Size is')) {
          const match = line.match(/Size is (\d+), (\d+)/);
          if (match) {
            metadata.size = { width: parseInt(match[1]), height: parseInt(match[2]) };
          }
        }

        // Projection
        if (line.includes('PROJCS') || line.includes('GEOGCS')) {
          metadata.projection = line.trim();
        }

        // EPSG code
        if (line.includes('EPSG')) {
          const match = line.match(/EPSG["\s]*:["\s]*(\d+)/i);
          if (match) {
            metadata.srid = parseInt(match[1]);
          }
        }

        // Corner coordinates (extent)
        if (line.includes('Corner Coordinates:')) {
          // Next lines will have corner coordinates
          let extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
          let cornerLines = lines.slice(lines.indexOf(line) + 1, lines.indexOf(line) + 6);
          for (const cornerLine of cornerLines) {
            const match = cornerLine.match(/\(([-\d.]+),\s*([-\d.]+)\)/);
            if (match) {
              const x = parseFloat(match[1]);
              const y = parseFloat(match[2]);
              extent.minX = Math.min(extent.minX, x);
              extent.minY = Math.min(extent.minY, y);
              extent.maxX = Math.max(extent.maxX, x);
              extent.maxY = Math.max(extent.maxY, y);
            }
          }
          if (extent.minX !== Infinity) {
            metadata.extent = extent;
          }
        }

        // Pixel size
        if (line.includes('Pixel Size')) {
          const match = line.match(/Pixel Size = \(([-\d.]+),\s*([-\d.]+)\)/);
          if (match) {
            metadata.pixelSize = {
              x: parseFloat(match[1]),
              y: parseFloat(match[2]),
            };
          }
        }

        // Bands
        if (line.includes('Band')) {
          const match = line.match(/Band (\d+)/);
          if (match) {
            currentBand = { number: parseInt(match[1]) };
            metadata.bands.push(currentBand);
          }
        }
        if (currentBand && line.includes('Type=')) {
          const match = line.match(/Type=(\w+)/);
          if (match) currentBand.type = match[1];
        }
      }

      // If no SRID found, default to 4326
      if (!metadata.srid) {
        metadata.srid = 4326;
      }

      return metadata;
    } catch (error) {
      logger.warn('Could not get GeoTIFF metadata:', error.message);
      return {
        size: null,
        projection: null,
        srid: 4326,
        extent: null,
        bands: [],
        pixelSize: null,
      };
    }
  }

  /**
   * Validate GeoTIFF file
   */
  async validateGeoTIFF(tifPath) {
    try {
      // Check if file exists
      await fs.access(tifPath);

      // Check if it's a valid GeoTIFF using gdalinfo
      const command = `gdalinfo "${tifPath}"`;
      await executeCommand(command);

      return true;
    } catch (error) {
      logger.error(`GeoTIFF validation failed: ${error.message}`);
      throw new Error(`Invalid GeoTIFF file: ${error.message}`);
    }
  }

  /**
   * Move GeoTIFF to permanent storage
   */
  async storeGeoTIFF(tifPath, uploadRecord) {
    try {
      const storageDir = path.join(this.uploadDir, 'geotiffs');
      await fs.mkdir(storageDir, { recursive: true });

      const filename = `geotiff_${uploadRecord.id}${path.extname(uploadRecord.original_filename)}`;
      const targetPath = path.join(storageDir, filename);

      await fs.copyFile(tifPath, targetPath);

      logger.info(`Stored GeoTIFF: ${targetPath}`);
      return targetPath;
    } catch (error) {
      logger.error('Error storing GeoTIFF:', error);
      throw error;
    }
  }

  /**
   * Process complete GeoTIFF upload: validate, store, publish
   */
  async processGeoTIFF(tifPath, uploadRecord, options = {}) {
    const {
      workspace = null,
      storeName = null,
      coverageName = null,
    } = options;

    try {
      // Step 1: Validate GeoTIFF
      logger.info(`Validating GeoTIFF: ${uploadRecord.filename}`);
      await this.validateGeoTIFF(tifPath);

      // Step 2: Get metadata
      const metadata = await this.getGeoTIFFMetadata(tifPath);
      logger.info(`GeoTIFF metadata: ${JSON.stringify(metadata)}`);

      // Step 3: Store GeoTIFF in permanent location
      logger.info(`Storing GeoTIFF: ${uploadRecord.filename}`);
      const storedPath = await this.storeGeoTIFF(tifPath, uploadRecord);

      // Step 4: Create GeoServer workspace if needed
      const workspaceName = workspace || process.env.GEOSERVER_WORKSPACE || 'spectra';
      await geoserverService.createWorkspace(workspaceName);

      // Step 5: Determine store and coverage names
      const finalStoreName = storeName || `store_${uploadRecord.id.replace(/-/g, '_')}`;
      const finalCoverageName =
        coverageName || path.parse(uploadRecord.original_filename).name.replace(/[^a-zA-Z0-9_]/g, '_');

      // Step 6: Create coverage store in GeoServer
      // Note: GeoServer needs the file path relative to its data directory or absolute path
      // In production, you'd mount a volume or use a shared storage
      const geoserverPath = `/data/geotiffs/${path.basename(storedPath)}`;
      logger.info(`Creating coverage store: ${finalStoreName}`);
      await geoserverService.createCoverageStore(finalStoreName, geoserverPath);

      // Step 7: Publish coverage
      logger.info(`Publishing coverage: ${finalCoverageName}`);
      await geoserverService.publishCoverage(finalStoreName, finalCoverageName);

      return {
        storeName: finalStoreName,
        coverageName: finalCoverageName,
        workspace: workspaceName,
        filePath: storedPath,
        geoserverPath: geoserverPath,
        metadata: metadata,
        wmsUrl: geoserverService.getWMSLayerURL(finalCoverageName),
      };
    } catch (error) {
      logger.error('Error processing GeoTIFF:', error);
      throw error;
    }
  }
}

module.exports = new GeoTIFFService();

