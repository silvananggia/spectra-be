/**
 * Migration: Enable PostGIS extension
 * This must run first before any spatial tables are created
 */

exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis;');
};

exports.down = async function (knex) {
  await knex.raw('DROP EXTENSION IF EXISTS postgis CASCADE;');
};

