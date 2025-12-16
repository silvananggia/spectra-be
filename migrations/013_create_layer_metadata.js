/**
 * Migration: Create layer_metadata table
 * Stores additional metadata for layers (ISO 19115, Dublin Core, etc.)
 */

exports.up = async function (knex) {
  await knex.schema.createTable('layer_metadata', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('layer_id').notNullable().unique();
    table.foreign('layer_id').references('id').inTable('layers').onDelete('CASCADE');
    
    // Basic metadata fields
    table.string('abstract', 2000).nullable();
    table.text('keywords').nullable(); // Comma-separated or JSON array
    table.string('contact_person', 255).nullable();
    table.string('contact_organization', 255).nullable();
    table.string('contact_email', 255).nullable();
    
    // Temporal extent
    table.timestamp('temporal_start').nullable();
    table.timestamp('temporal_end').nullable();
    
    // Spatial extent (stored as PostGIS geometry - Polygon or Box2D)
    table.specificType('bbox', 'geometry(Polygon, 4326)').nullable();
    
    // Access constraints
    table.text('access_constraints').nullable();
    table.text('use_constraints').nullable();
    table.string('license', 255).nullable();
    
    // Data source
    table.string('data_source', 500).nullable();
    table.string('data_provider', 255).nullable();
    
    // Additional metadata as JSON (for ISO 19115, etc.)
    table.jsonb('extended_metadata').nullable();
    
    table.timestamps(true, true);
  });

  // Create spatial index on bbox
  await knex.schema.raw('CREATE INDEX idx_layer_metadata_bbox ON layer_metadata USING GIST (bbox)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('layer_metadata');
};

