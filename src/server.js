require('dotenv').config();
const app = require('./app');
const { db, initializePostGIS, testConnection } = require('./db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8888;

/**
 * Start the server
 */
async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const connected = await testConnection();

    if (!connected) {
      logger.error('Database connection failed. Exiting...');
      process.exit(1);
    }

    // Initialize PostGIS extension
    logger.info('Initializing PostGIS extension...');
    await initializePostGIS();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  try {
    await db.destroy();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();

