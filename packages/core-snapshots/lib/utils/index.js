'use strict'

const fs = require('fs-extra')
const container = require('@arkecosystem/core-container')

exports.getPath = (table, folder, codec) => {
  return `${process.env.ARK_PATH_DATA}/snapshots/${process.env.ARK_NETWORK_NAME}/${folder}/${table}.${codec}`
}

exports.copySnapshot = (sourceFolder, destFolder, codec) => {
  const logger = container.resolvePlugin('logger')
  logger.info(`Copying snapshot from ${sourceFolder} to a new file ${destFolder} for appending of data`)

  const paths = {
    source: {
      blocks: this.getPath('blocks', sourceFolder, codec),
      transactions: this.getPath('transactions', sourceFolder, codec)
    },
    dest: {
      blocks: this.getPath('blocks', destFolder, codec),
      transactions: this.getPath('transactions', destFolder, codec)
    }
  }

  fs.ensureFileSync(paths.dest.blocks)
  fs.ensureFileSync(paths.dest.transactions)

  if (!fs.existsSync(paths.source.blocks) || !fs.existsSync(paths.source.transactions)) {
    container.forceExit(`Unable to copy snapshot from ${sourceFolder} as it doesn't exist :bomb:`)
  }

  fs.copyFileSync(paths.source.blocks, paths.dest.blocks)
  fs.copyFileSync(paths.source.transactions, paths.dest.transactions)
}

exports.getSnapshotInfo = (blocks) => {
  const [startHeight, endHeight] = blocks.split('-')
  return {
    startHeight: +startHeight,
    endHeight: +endHeight,
    folder: `${startHeight}-${endHeight}`
  }
}

exports.setSnapshotInfo = (options, lastBlock) => {
  let meta = {
    startHeight: (options.start !== -1) ? options.start : 1,
    endHeight: (options.end !== -1) ? options.end : lastBlock.height,
    codec: options.codec
  }
  meta.folder = `${meta.startHeight}-${meta.endHeight}`

  if (options.blocks) {
    const oldMeta = this.getSnapshotInfo(options.blocks)
    meta.startHeight = oldMeta.endHeight + 1
    meta.folder = `${oldMeta.startHeight}-${meta.endHeight}`
  }

  return meta
}
