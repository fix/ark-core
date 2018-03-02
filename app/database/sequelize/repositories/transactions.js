const Op = require('sequelize').Op
const moment = require('moment')
const Transaction = require('app/models/transaction')
const buildFilterQuery = require('../utils/filter-query')

module.exports = class TransactionsRepository {
  constructor (db) {
    this.db = db
  }

  async findAll (params) {
    let whereStatement = {}
    let orderBy = []

    const filter = ['type', 'senderPublicKey', 'recipientId', 'amount', 'fee', 'blockId']
    for (const elem of filter) {
      if (params[elem]) { whereStatement[elem] = params[elem] }
    }

    if (params['senderId']) {
      let wallet = this.db.walletManager.getWalletByAddress([params['senderId']])

      if (wallet) whereStatement['senderPublicKey'] = wallet.publicKey
    }

    if (params.orderBy) {
      const order = params.orderBy.split(':')

      if (['timestamp', 'type', 'amount'].includes(order[0])) orderBy.push(params.orderBy.split(':'))
    }

    const results = await this.db.transactionsTable.findAndCountAll({
      attributes: ['blockId', 'serialized'],
      where: whereStatement,
      order: orderBy,
      offset: params.offset,
      limit: params.limit,
      include: {
        model: this.db.blocksTable,
        attributes: ['height']
      }
    })

    return { results: results.rows, total: results.count }
  }

  findAllByWallet (wallet, paginator) {
    return this.findAll({
      ...{
        [Op.or]: [{
          senderPublicKey: wallet.publicKey
        }, {
          recipientId: wallet.address
        }]
      },
      ...paginator
    })
  }

  findAllBySender (senderPublicKey, paginator) {
    return this.findAll({...{senderPublicKey}, ...paginator})
  }

  findAllByRecipient (recipientId, paginator) {
    return this.findAll({...{recipientId}, ...paginator})
  }

  allVotesBySender (senderPublicKey, paginator) {
    return this.findAll({...{senderPublicKey, type: 3}, ...paginator})
  }

  findAllByBlock (blockId, paginator) {
    return this.findAll({...{blockId}, ...paginator})
  }

  findAllByType (type, paginator) {
    return this.findAll({...{type}, ...paginator})
  }

  findById (id) {
    return this.db.transactionsTable.findById(id, {
      include: {
        model: this.db.blocksTable,
        attributes: ['height']
      }
    })
  }

  findByIdAndType (id, type) {
    return this.db.transactionsTable.findOne({
      where: {id, type},
      include: {
        model: this.db.blocksTable,
        attributes: ['height']
      }
    })
  }

  async findAllByDateAndType (type, from, to) {
    let where = { type, timestamp: {} }

    if (from) where.timestamp[Op.lte] = to
    if (to) where.timestamp[Op.gte] = from
    if (!where.timestamp.length) delete where.timestamp

    const results = await this.db.transactionsTable.findAndCountAll({
      attributes: ['serialized'],
      where,
      include: {
        model: this.db.blocksTable,
        attributes: ['height']
      }
    })

    return results.rows.map(row => Transaction.deserialize(row.serialized.toString('hex')))
  }

  async search (params) {
    const results = await this.db.transactionsTable.findAndCountAll({
      attributes: ['blockId', 'serialized'],
      where: buildFilterQuery(
        params,
        {
          exact: ['id', 'blockId', 'type', 'version', 'senderPublicKey', 'recipientId'],
          between: ['timestamp', 'amount', 'fee'],
          wildcard: ['vendorFieldHex']
        }
      ),
      include: {
        model: this.db.blocksTable,
        attributes: ['height']
      }
    })

    return { results: results.rows, total: results.count }
  }
}
