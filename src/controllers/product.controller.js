const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const logger = require('../utils/logger');

/**
 * Get all products (completed uploads)
 * GET /api/products
 */
async function getProducts(req, res) {
  try {
    const products = await db('product')
      .select(
        'id',
       'title',
       'date',
       'category',
       'filename',
       'thumbnail',
      )

    res.json(products);
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

/**
 * Helper to resolve file path safely
 */
function resolveFilePath(filePath) {
  // If path is already absolute, keep it; otherwise resolve from project root
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(process.cwd(), filePath);
}

/**
 * Download product file
 * GET /api/products/:id/download
 */
async function downloadProduct(req, res) {
  try {
    const { id } = req.params;

    const upload = await db('uploads').where('id', id).first();

    if (!upload) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!upload.file_path) {
      return res.status(404).json({ error: 'File path not available for this product' });
    }

    const absolutePath = resolveFilePath(upload.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    const downloadName = upload.original_filename || path.basename(absolutePath);

    logger.info(`Downloading product ${id} from ${absolutePath}`);

    res.download(absolutePath, downloadName, (err) => {
      if (err) {
        logger.error(`Error downloading product ${id}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file' });
        }
      }
    });
  } catch (error) {
    logger.error('Error in downloadProduct:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download product' });
    }
  }
}

/**
 * Preview product file (inline)
 * GET /api/products/:id/preview
 */
async function previewProduct(req, res) {
  try {
    const { id } = req.params;

    const upload = await db('uploads').where('id', id).first();

    if (!upload) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!upload.file_path) {
      return res.status(404).json({ error: 'File path not available for this product' });
    }

    const absolutePath = resolveFilePath(upload.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    const fileName = upload.original_filename || path.basename(absolutePath);

    logger.info(`Previewing product ${id} from ${absolutePath}`);

    const headers = {
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
    };

    if (upload.mime_type) {
      headers['Content-Type'] = upload.mime_type;
    }

    res.sendFile(absolutePath, { headers }, (err) => {
      if (err) {
        logger.error(`Error previewing product ${id}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to preview file' });
        }
      }
    });
  } catch (error) {
    logger.error('Error in previewProduct:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to preview product' });
    }
  }
}

module.exports = {
  getProducts,
  downloadProduct,
  previewProduct,
};

