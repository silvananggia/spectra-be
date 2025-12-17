const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const logger = require('../utils/logger');

/**
 * Get all products (completed uploads)
 * GET /api/products?page=1&limit=10
 */
async function getProducts(req, res) {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Page number must be greater than 0',
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Limit must be between 1 and 100',
      });
    }

    // Get total count for pagination metadata
    const totalCountResult = await db('products').count('id as count').first();
    const total = parseInt(totalCountResult.count) || 0;
    const totalPages = Math.ceil(total / limit);

    // Fetch paginated products
    const productsData = await db('products')
      .select(
        'id',
        'title',
        'date',
        'category',
        'filename',
        'thumbnail',
        'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Map to product format
    const products = productsData.map(product => ({
      id: product.id,
      title: product.title,
      date: product.date,
      category: product.category,
      filename: product.filename,
      thumbnail: product.thumbnail,
    }));

    // Return structured response with status, code, and pagination
    res.status(200).json({
      status: 'success',
      code: 200,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Failed to fetch products',
    });
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
 * Get the absolute file path for a product
 * Products store filename as relative path (e.g., "PCS_Planet/file.pdf")
 * Files are stored under uploads/file/
 */
function getProductFilePath(product) {
  if (!product.filename) {
    return null;
  }

  // If filename is already absolute, use as-is
  if (path.isAbsolute(product.filename)) {
    return product.filename;
  }

  // Construct path: uploads/file/{filename}
  return path.join('uploads', 'file', product.filename);
}

/**
 * Get the absolute thumbnail path for a product
 * Thumbnails are stored under uploads/thumbnails/
 */
function getProductThumbnailPath(product) {
  if (!product.thumbnail) {
    return null;
  }

  // If thumbnail path is already absolute, use as-is
  if (path.isAbsolute(product.thumbnail)) {
    return product.thumbnail;
  }

  // Construct path: uploads/thumbnails/{thumbnail}
  return path.join('uploads', 'thumbnails', product.thumbnail);
}

/**
 * Download product file
 * GET /api/products/:id/download
 */
async function downloadProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await db('products').where('id', id).first();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const filePath = getProductFilePath(product);
    if (!filePath) {
      return res.status(404).json({ error: 'File path not available for this product' });
    }

    const absolutePath = resolveFilePath(filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    const downloadName = product.filename ? path.basename(product.filename) : path.basename(absolutePath);

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
 * Serves thumbnail if available, otherwise falls back to main file
 */
async function previewProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await db('products').where('id', id).first();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Try to serve thumbnail first if available
    let filePath = null;
    let absolutePath = null;
    let isThumbnail = false;
    
    if (product.thumbnail) {
      const thumbnailPath = getProductThumbnailPath(product);
      if (thumbnailPath) {
        const thumbnailAbsolutePath = resolveFilePath(thumbnailPath);
        if (fs.existsSync(thumbnailAbsolutePath)) {
          filePath = thumbnailPath;
          absolutePath = thumbnailAbsolutePath;
          isThumbnail = true;
          const thumbExt = path.extname(thumbnailAbsolutePath).toLowerCase();
          logger.info(`Previewing product ${id} thumbnail from ${absolutePath} (extension: ${thumbExt})`);
        } else {
          logger.warn(`Thumbnail file not found at ${thumbnailAbsolutePath} for product ${id}`);
        }
      }
    }

    // Fall back to main file if no thumbnail or thumbnail doesn't exist
    if (!filePath || !absolutePath) {
      filePath = getProductFilePath(product);
      if (!filePath) {
        return res.status(404).json({ error: 'File path not available for this product' });
      }

      absolutePath = resolveFilePath(filePath);
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'File not found on server' });
      }

      logger.info(`Previewing product ${id} from ${absolutePath}`);
    }

    const fileName = isThumbnail
      ? (product.thumbnail ? path.basename(product.thumbnail) : path.basename(absolutePath))
      : (product.filename ? path.basename(product.filename) : path.basename(absolutePath));

    // Get file extension from both absolute path and filename to ensure we detect it correctly
    let ext = path.extname(absolutePath).toLowerCase();
    // Fallback: try to get extension from the original filename if absolute path doesn't have one
    if (!ext || ext === '') {
      if (isThumbnail && product.thumbnail) {
        ext = path.extname(product.thumbnail).toLowerCase();
        logger.info(`Using extension from thumbnail field: ${ext}`);
      } else if (product.filename) {
        ext = path.extname(product.filename).toLowerCase();
        logger.info(`Using extension from filename field: ${ext}`);
      }
    }
    
    logger.info(`Determined file extension: ${ext}, Content-Type will be set accordingly`);

    const headers = {
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
    };

    // Determine Content-Type based on file extension
    // Thumbnails are always images (PNG or JPG), so prioritize image types
    if (ext === '.jpg' || ext === '.jpeg') {
      headers['Content-Type'] = 'image/jpeg';
    } else if (ext === '.png') {
      headers['Content-Type'] = 'image/png';
    } else if (ext === '.gif') {
      headers['Content-Type'] = 'image/gif';
    } else if (ext === '.webp') {
      headers['Content-Type'] = 'image/webp';
    } else if (ext === '.svg') {
      headers['Content-Type'] = 'image/svg+xml';
    } else if (ext === '.bmp') {
      headers['Content-Type'] = 'image/bmp';
    } else if (ext === '.tiff' || ext === '.tif') {
      headers['Content-Type'] = 'image/tiff';
    } else if (ext === '.pdf') {
      headers['Content-Type'] = 'application/pdf';
    } else if (isThumbnail) {
      // If it's a thumbnail but we can't determine the type, default to PNG
      // since thumbnails from PDFs are PNG and most image thumbnails are JPG/PNG
      headers['Content-Type'] = 'image/png';
      logger.warn(`Could not determine Content-Type for thumbnail ${absolutePath}, defaulting to image/png`);
    } else {
      // Default to octet-stream if we can't determine the type
      headers['Content-Type'] = 'application/octet-stream';
    }

    // Add cache headers for images to improve performance
    if (headers['Content-Type'].startsWith('image/')) {
      headers['Cache-Control'] = 'public, max-age=31536000'; // Cache for 1 year
      headers['X-Content-Type-Options'] = 'nosniff';
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

