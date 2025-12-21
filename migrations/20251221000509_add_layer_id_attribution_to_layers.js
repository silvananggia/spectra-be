/**
 * Migration: Add layer_id and attribution columns to layers table
 * 
 * This migration adds support for ArcGIS MapServer layers by adding:
 * - layer_id: VARCHAR - The layer ID for ArcGIS MapServer layers
 * - attribution: TEXT - Attribution text for the layer (may already exist)
 */

exports.up = async function(knex) {
  // Check if columns exist before adding
  const hasLayerId = await knex.schema.hasColumn('layers', 'layer_id');
  const hasAttribution = await knex.schema.hasColumn('layers', 'attribution');
  
  return knex.schema.table('layers', function(table) {
    if (!hasLayerId) {
      table.string('layer_id').nullable().comment('Layer ID for ArcGIS MapServer layers');
    }
    if (!hasAttribution) {
      table.text('attribution').nullable().comment('Attribution text for the layer');
    }
  });
};

exports.down = function(knex) {
  return knex.schema.table('layers', function(table) {
    table.dropColumn('layer_id');
    table.dropColumn('attribution');
  });
};

