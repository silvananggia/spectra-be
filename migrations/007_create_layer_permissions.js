/**
 * Migration: Create layer_permissions table
 * Controls which roles can access which layers
 */

exports.up = async function (knex) {
  await knex.schema.createTable('layer_permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('layer_id').notNullable();
    table.uuid('role_id').notNullable();
    
    // Permissions
    table.boolean('can_view').defaultTo(true);
    table.boolean('can_edit').defaultTo(false);
    table.boolean('can_delete').defaultTo(false);
    
    table.timestamps(true, true);

    // Foreign keys with cascade delete
    table.foreign('layer_id').references('id').inTable('layers').onDelete('CASCADE');
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');

    // Unique constraint: each role-layer combination is unique
    table.unique(['layer_id', 'role_id']);
  });

  // Create indexes
  await knex.schema.raw('CREATE INDEX idx_layer_permissions_layer ON layer_permissions(layer_id)');
  await knex.schema.raw('CREATE INDEX idx_layer_permissions_role ON layer_permissions(role_id)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('layer_permissions');
};

