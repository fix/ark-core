'use strict'
const container = require('@arkecosystem/core-container')
const snapshotManager = container.resolvePlugin('snapshots')

module.exports = async (options) => snapshotManager.importData(options)
