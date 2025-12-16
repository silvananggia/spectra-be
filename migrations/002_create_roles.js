/**
 * Migration: Create roles table
 * Stores user roles (admin, user, viewer, etc.)
 */

exports.up = async function (knex) {
  await knex.schema.createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 50).notNullable().unique();
    table.text('description').nullable();
    table.timestamps(true, true);
  });

  // Insert default roles
  await knex('roles').insert([
    { name: 'admin', description: 'Administrator with full access' },
    { name: 'user', description: 'Regular user' },
    { name: 'viewer', description: 'Read-only access' },
  ]);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('roles');
};

