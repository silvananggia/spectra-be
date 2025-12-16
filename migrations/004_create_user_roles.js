/**
 * Migration: Create user_roles table
 * Junction table for users and roles (many-to-many)
 */

exports.up = async function (knex) {
  await knex.schema.createTable('user_roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.uuid('role_id').notNullable();
    table.timestamps(true, true);

    // Foreign keys with cascade delete
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');

    // Unique constraint: user can only have each role once
    table.unique(['user_id', 'role_id']);
  });

  // Create index for faster lookups
  await knex.schema.raw('CREATE INDEX idx_user_roles_user_id ON user_roles(user_id)');
  await knex.schema.raw('CREATE INDEX idx_user_roles_role_id ON user_roles(role_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_roles');
};

