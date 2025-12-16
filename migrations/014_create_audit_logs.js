/**
 * Migration: Create audit_logs table
 * Tracks user actions and system events for auditing
 */

exports.up = async function (knex) {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    
    // Action details
    table.string('action', 100).notNullable(); // 'create', 'update', 'delete', 'upload', etc.
    table.string('resource_type', 100).notNullable(); // 'layer', 'map', 'upload', etc.
    table.uuid('resource_id').nullable(); // ID of the affected resource
    
    // Request information
    table.string('ip_address', 45).nullable(); // IPv4 or IPv6
    table.string('user_agent', 500).nullable();
    table.string('method', 10).nullable(); // HTTP method
    table.string('endpoint', 500).nullable(); // API endpoint
    
    // Change details
    table.jsonb('old_values').nullable(); // Previous values
    table.jsonb('new_values').nullable(); // New values
    
    // Status
    table.string('status', 50).defaultTo('success'); // 'success', 'error', 'warning'
    table.text('error_message').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Create indexes for common queries
  await knex.schema.raw('CREATE INDEX idx_audit_logs_user ON audit_logs(user_id)');
  await knex.schema.raw('CREATE INDEX idx_audit_logs_action ON audit_logs(action)');
  await knex.schema.raw('CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id)');
  await knex.schema.raw('CREATE INDEX idx_audit_logs_created ON audit_logs(created_at)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('audit_logs');
};

