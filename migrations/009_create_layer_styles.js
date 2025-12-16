/**
 * Migration: Create layer_styles table
 * Junction table for layers and styles (many-to-many)
 */

exports.up = async function (knex) {
  await knex.schema.createTable('layer_styles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('layer_id').notNullable();
    table.uuid('style_id').notNullable();
    table.boolean('is_default').defaultTo(false);
    table.integer('display_order').defaultTo(0);
    table.timestamps(true, true);

    // Foreign keys with cascade delete
    table.foreign('layer_id').references('id').inTable('layers').onDelete('CASCADE');
    table.foreign('style_id').references('id').inTable('styles').onDelete('CASCADE');

    // Unique constraint
    table.unique(['layer_id', 'style_id']);
  });

  // Create indexes
  await knex.schema.raw('CREATE INDEX idx_layer_styles_layer ON layer_styles(layer_id)');
  await knex.schema.raw('CREATE INDEX idx_layer_styles_style ON layer_styles(style_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('layer_styles');
};

