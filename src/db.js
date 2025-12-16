const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

// Create Knex instance
const db = knex(config);

/**
 * Initialize PostGIS extension
 * This should be run after connecting to the database
 */
async function initializePostGIS() {
  try {
    await db.raw('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('PostGIS extension initialized');
  } catch (error) {
    console.error('Error initializing PostGIS:', error.message);
    throw error;
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    await db.raw('SELECT 1');
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  db,
  initializePostGIS,
  testConnection,
};

