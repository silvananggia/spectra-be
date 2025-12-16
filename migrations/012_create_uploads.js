/**
 * Migration: Create uploads table
 * Tracks file uploads and their processing status
 */

exports.up = async function (knex) {
  await knex.schema.createTable('uploads', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    
    // File information
    table.string('filename', 255).notNullable();
    table.string('original_filename', 255).notNullable();
    table.string('file_type', 50).notNullable(); // 'shapefile' or 'geotiff'
    table.string('mime_type', 100).nullable();
    table.bigInteger('file_size').nullable(); // in bytes
    table.string('file_path', 500).nullable(); // Relative path to uploaded file
    
    // Processing status
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
    table.text('error_message').nullable();
    
    // Import/processing information
    table.string('table_name', 255).nullable(); // PostGIS table name for shapefiles
    table.string('workspace', 100).nullable(); // GeoServer workspace
    table.string('datastore', 255).nullable(); // GeoServer datastore/coverage store
    table.string('layer_name', 255).nullable(); // GeoServer layer name
    table.uuid('layer_id').nullable(); // Reference to layers table if registered
    table.foreign('layer_id').references('id').inTable('layers').onDelete('SET NULL');
    
    // Additional metadata
    table.jsonb('metadata').nullable(); // Bounding box, SRID, feature count, etc.
    
    table.timestamps(true, true);
  });

  // Create indexes
  await knex.schema.raw('CREATE INDEX idx_uploads_status ON uploads(status)');
  await knex.schema.raw('CREATE INDEX idx_uploads_user ON uploads(user_id)');
  await knex.schema.raw('CREATE INDEX idx_uploads_type ON uploads(file_type)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('uploads');
};

