/**
 * Migration: Create map_configs table
 * Junction table for maps and layers (many-to-many)
 */

exports.up = async function (knex) {
  await knex.schema.createTable('map_configs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('map_id').notNullable();
    table.uuid('layer_id').notNullable();
    
    // Layer-specific configuration for this map
    table.boolean('is_visible').defaultTo(true);
    table.integer('display_order').defaultTo(0);
    table.decimal('opacity', 3, 2).defaultTo(1.0);
    table.integer('min_zoom').nullable();
    table.integer('max_zoom').nullable();
    
    // Additional config as JSON
    table.jsonb('config').nullable();
    
    table.timestamps(true, true);

    // Foreign keys with cascade delete
    table.foreign('map_id').references('id').inTable('maps').onDelete('CASCADE');
    table.foreign('layer_id').references('id').inTable('layers').onDelete('CASCADE');

    // Unique constraint: each layer can appear once per map
    table.unique(['map_id', 'layer_id']);
  });

  // Create indexes
  await knex.schema.raw('CREATE INDEX idx_map_configs_map ON map_configs(map_id)');
  await knex.schema.raw('CREATE INDEX idx_map_configs_layer ON map_configs(layer_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('map_configs');
};

