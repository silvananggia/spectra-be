/**
 * Migration: Create maps table
 * Stores map definitions with center point and zoom
 */

exports.up = async function (knex) {
  await knex.schema.createTable('maps', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    
    // Center point as PostGIS geometry (Point, 4326)
    table.specificType('center', 'geometry(Point, 4326)').notNullable();
    
    // Zoom level
    table.integer('zoom').defaultTo(2);
    table.integer('min_zoom').defaultTo(0);
    table.integer('max_zoom').defaultTo(20);
    
    // Map properties
    table.boolean('is_public').defaultTo(false);
    table.uuid('created_by').nullable();
    table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    
    // Additional configuration as JSON
    table.jsonb('config').nullable();
    
    table.timestamps(true, true);
  });

  // Create spatial index on center point
  await knex.schema.raw('CREATE INDEX idx_maps_center ON maps USING GIST (center)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('maps');
};

