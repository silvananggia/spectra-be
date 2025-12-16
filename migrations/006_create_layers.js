/**
 * Migration: Create layers table
 * Stores all layer definitions (WMS, WFS, XYZ, MVT, GeoJSON)
 */

exports.up = async function (knex) {
  await knex.schema.createTable('layers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    
    // Layer type: wms, wfs, xyz, mvt, geojson
    table.enum('type', ['wms', 'wfs', 'xyz', 'mvt', 'geojson']).notNullable();
    
    // Tile type: raster, vector
    table.enum('tile_type', ['raster', 'vector']).nullable();
    
    // Layer source URLs and configuration
    table.text('url').notNullable(); // Base URL for WMS/WFS/XYZ
    table.string('layer_name', 255).nullable(); // Layer name for WMS/WFS
    table.string('workspace', 100).nullable(); // GeoServer workspace
    table.string('datastore', 255).nullable(); // GeoServer datastore/coverage store
    
    // Style information
    table.string('default_style', 255).nullable();
    
    // Layer properties
    table.boolean('is_visible').defaultTo(true);
    table.boolean('is_queryable').defaultTo(true);
    table.integer('min_zoom').nullable();
    table.integer('max_zoom').nullable();
    table.integer('display_order').defaultTo(0);
    table.decimal('opacity', 3, 2).defaultTo(1.0); // 0.00 to 1.00
    
    // Foreign keys
    table.uuid('layer_group_id').nullable();
    table.foreign('layer_group_id').references('id').inTable('layer_groups').onDelete('SET NULL');
    
    // Metadata
    table.jsonb('metadata').nullable(); // Additional metadata as JSON
    table.string('srs', 50).defaultTo('EPSG:4326'); // Spatial Reference System
    
    table.timestamps(true, true);
  });

  // Create indexes
  await knex.schema.raw('CREATE INDEX idx_layers_type ON layers(type)');
  await knex.schema.raw('CREATE INDEX idx_layers_visible ON layers(is_visible)');
  await knex.schema.raw('CREATE INDEX idx_layers_group ON layers(layer_group_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('layers');
};

