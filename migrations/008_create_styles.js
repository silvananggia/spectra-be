/**
 * Migration: Create styles table
 * Stores SLD/SE styles for GeoServer layers
 */

exports.up = async function (knex) {
  await knex.schema.createTable('styles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable().unique();
    table.string('title', 255).nullable();
    table.text('description').nullable();
    table.text('sld_body').nullable(); // SLD XML content
    table.text('sld_url').nullable(); // URL to external SLD file
    table.string('workspace', 100).nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('styles');
};

