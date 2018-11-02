'use strict'

const SnapshotManager = require('./manager')
/**
 * The struct used by the plugin container.
 * @type {Object}
 */
exports.plugin = {
  pkg: require('../package.json'),
  defaults: require('./defaults'),
  alias: 'snapshots',
  async register (container, options) {
    return new SnapshotManager(container.resolvePlugin('database'), options)
  }
}
