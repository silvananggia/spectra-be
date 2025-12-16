const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { db } = require('../db');
const shapefileService = require('../services/shp.service');
const geotiffService = require('../services/tif.service');
const layerService = require('../services/layer.service');

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB default

// Ensure upload directory exists
(async () => {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    logger.error('Error creating upload directory:', error);
  }
})();

// Configure storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = path.join(uploadDir, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedShapefileTypes = (process.env.ALLOWED_SHAPEFILE_TYPES || '.zip').split(',');
  const allowedRasterTypes = (process.env.ALLOWED_RASTER_TYPES || '.tif,.tiff').split(',');

  const ext = path.extname(file.originalname).toLowerCase();
  const isShapefile = allowedShapefileTypes.includes(ext);
  const isGeoTIFF = allowedRasterTypes.includes(ext);

  if (isShapefile || isGeoTIFF) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed: ${[...allowedShapefileTypes, ...allowedRasterTypes].join(', ')}`
      ),
      false
    );
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxFileSize,
  },
});

/**
 * Upload shapefile or GeoTIFF
 * POST /api/upload
 */
async function uploadFile(req, res) {
  let uploadRecord = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Determine file type
    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowedShapefileTypes = (process.env.ALLOWED_SHAPEFILE_TYPES || '.zip').split(',');
    const fileType = allowedShapefileTypes.includes(ext) ? 'shapefile' : 'geotiff';

    // Create upload record
    uploadRecord = await db('uploads').insert({
      id: uuidv4(),
      user_id: req.user?.id || null,
      filename: req.file.filename,
      original_filename: req.file.originalname,
      file_type: fileType,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      file_path: req.file.path,
      status: 'processing',
    }).returning('*');

    uploadRecord = uploadRecord[0];

    logger.info(`File upload started: ${uploadRecord.id} - ${req.file.originalname}`);

    // Process file asynchronously
    processFileAsync(uploadRecord, req.file.path).catch((error) => {
      logger.error(`Error processing file ${uploadRecord.id}:`, error);
    });

    // Return immediate response
    res.status(202).json({
      message: 'File uploaded successfully, processing in background',
      upload_id: uploadRecord.id,
      status: 'processing',
    });
  } catch (error) {
    logger.error('Upload error:', error);

    if (uploadRecord) {
      await db('uploads')
        .where('id', uploadRecord.id)
        .update({
          status: 'failed',
          error_message: error.message,
        });
    }

    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
}

/**
 * Process file asynchronously
 */
async function processFileAsync(uploadRecord, filePath) {
  try {
    // Update status
    await db('uploads').where('id', uploadRecord.id).update({ status: 'processing' });

    let processingResult;

    if (uploadRecord.file_type === 'shapefile') {
      // Process shapefile
      logger.info(`Processing shapefile: ${uploadRecord.id}`);

      // Get optional parameters from query or body
      const srid = uploadRecord.metadata?.srid || process.env.DEFAULT_EPSG || '4326';

      processingResult = await shapefileService.processShapefile(filePath, uploadRecord, {
        srid: srid,
      });

      // Update upload record
      await db('uploads').where('id', uploadRecord.id).update({
        status: 'completed',
        table_name: processingResult.tableName,
        workspace: processingResult.workspace,
        datastore: processingResult.datastore,
        layer_name: processingResult.layerName,
        metadata: processingResult.metadata,
      });

      // Register layer in CMS
      await layerService.registerUploadedLayer(uploadRecord, processingResult);
    } else if (uploadRecord.file_type === 'geotiff') {
      // Process GeoTIFF
      logger.info(`Processing GeoTIFF: ${uploadRecord.id}`);

      processingResult = await geotiffService.processGeoTIFF(filePath, uploadRecord);

      // Update upload record
      await db('uploads').where('id', uploadRecord.id).update({
        status: 'completed',
        workspace: processingResult.workspace,
        datastore: processingResult.storeName,
        layer_name: processingResult.coverageName,
        file_path: processingResult.filePath,
        metadata: processingResult.metadata,
      });

      // Register layer in CMS
      await layerService.registerUploadedLayer(uploadRecord, processingResult);
    }

    logger.info(`File processing completed: ${uploadRecord.id}`);
  } catch (error) {
    logger.error(`Error processing file ${uploadRecord.id}:`, error);

    // Update upload record with error
    await db('uploads').where('id', uploadRecord.id).update({
      status: 'failed',
      error_message: error.message,
    });
  }
}

/**
 * Get upload status
 * GET /api/upload/:id
 */
async function getUploadStatus(req, res) {
  try {
    const { id } = req.params;

    const upload = await db('uploads').where('id', id).first();

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Include layer info if available
    let layer = null;
    if (upload.layer_id) {
      layer = await layerService.getLayerById(upload.layer_id);
    }

    res.json({
      ...upload,
      layer: layer,
    });
  } catch (error) {
    logger.error('Error fetching upload status:', error);
    res.status(500).json({ error: 'Failed to fetch upload status' });
  }
}

/**
 * Get all uploads
 * GET /api/upload
 */
async function getUploads(req, res) {
  try {
    const uploads = await db('uploads')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(100);

    res.json(uploads);
  } catch (error) {
    logger.error('Error fetching uploads:', error);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
}

module.exports = {
  upload: upload.single('file'), // Multer middleware
  uploadFile,
  getUploadStatus,
  getUploads,
};

