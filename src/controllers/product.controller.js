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
    const productsData = await db('products')
      .select(
        'id',
        'title',
        'date',
        'category',
        'filename',
        'thumbnail'
      )

    // Map to product format
    const products = productsData.map(product => ({
      id: product.id,
      title: product.title,
      date: product.date,
      category: product.category,
      filename: product.filename,
      thumbnail: product.thumbnail,
    }));

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
 */
async function previewProduct(req, res) {
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

    const fileName = product.filename ? path.basename(product.filename) : path.basename(absolutePath);

    logger.info(`Previewing product ${id} from ${absolutePath}`);

    const headers = {
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
    };

    // Try to infer mime type from file extension if needed
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext === '.pdf') {
      headers['Content-Type'] = 'application/pdf';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      headers['Content-Type'] = 'image/jpeg';
    } else if (ext === '.png') {
      headers['Content-Type'] = 'image/png';
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

