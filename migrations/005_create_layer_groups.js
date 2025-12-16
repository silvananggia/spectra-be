/**
 * Migration: Create layer_groups table
 * Groups layers for organization (e.g., "Basemaps", "Overlays")
 */

exports.up = async function (knex) {
  await knex.schema.createTable('layer_groups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.integer('display_order').defaultTo(0);
    table.boolean('is_visible').defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('layer_groups');
};

