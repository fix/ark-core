const Sequelize = require('sequelize')
const Block = require('app/models/block')
const Transaction = require('app/models/transaction')
const config = require('app/core/config')
const logger = require('app/core/logger')
const DBInterface = require('app/core/dbinterface')
const webhookManager = require('app/core/managers/webhook').getInstance()

const { Model } = require('objection')
const Knex = require('knex')
const knexConfig = require('knexfile')

const fg = require('fast-glob')
const path = require('path')

module.exports = class SequelizeDB extends DBInterface {
  async init (params) {
    if (this.db) {
      throw new Error('Already initialised')
    }

    this.db = Knex(knexConfig.development)
    Model.knex(this.db)

    await this.registerModels()
    this.registerHooks()
  }

  async registerModels () {
    const modelFiles = await fg([path.resolve(__dirname, 'models/**/*.js')])
    modelFiles.forEach(modelFile => {
      const model = require(modelFile)
      this[`${model.tableName}Table`] = model
    })
  }

  registerHooks () {
    if (config.webhooks.enabled) {
      this.blocksTable.afterCreate((block) => webhookManager.emit('block.created', block))
      this.transactionsTable.afterCreate((transaction) => webhookManager.emit('transaction.created', transaction))
    }
  }

  async getActiveDelegates (height) {
    const activeDelegates = config.getConstants(height).activeDelegates
    const round = ~~(height / activeDelegates)

    if (this.activedelegates && this.activedelegates.length && this.activedelegates[0].round === round) {
      return this.activedelegates
    }

    const data = await this.roundsTable.findAll({
      where: {
        round: round
      },
      order: [[ 'publicKey', 'ASC' ]]
    })

    return data.map(a => a.dataValues).sort((a, b) => b.balance - a.balance)
  }

  saveRounds (rounds) {
    return this.roundsTable.batchInsert(rounds)
  }

  deleteRound (round) {
    console.log('delete', round)
    return this.roundsTable.query().delete().where('id', round)
  }

  async buildDelegates (block) {
    const activeDelegates = config.getConstants(block.data.height).activeDelegates

    let data = await this.walletsTable.query()
      .select('vote', 'publicKey', this.db.raw('SUM(balance) as balance'))
      .whereNotNull('vote')
      .groupBy('vote')

    // at the launch of blockchain, we may have not enough voted delegates, completing in a deterministic way (alphabetical order of publicKey)
    if (data.length < activeDelegates) {
      const data2 = await this.walletsTable.query()
        .select('publicKey')
        .whereNotNull('username')
        .orderBy('publicKey', 'asc')
        .limit(activeDelegates - data.length)

      data = data.concat(data2)
    }

    // logger.info(`got ${data.length} voted delegates`)
    const round = parseInt(block.data.height / 51)
    this.activedelegates = data
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 51)
      .map(a => ({...{round: round}, ...a.dataValues}))

    logger.debug(`generated ${this.activedelegates.length} active delegates`)

    return this.activedelegates
  }

  async buildWallets () {
    this.walletManager.reset()

    // try {
      // Received TX
      logger.printTracker('SPV Building', 1, 8, 'Received Transactions')

      let data = await this.transactionsTable.query()
        .select('recipientId', this.db.raw('sum(amount) as amount'))
        .where('type', 0)
        .groupBy('recipientId')

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByAddress(row.recipientId)
        if (wallet) {
          wallet.balance = parseInt(row.amount)
        } else {
          logger.warn(`lost cold wallet: ${row.recipientId} ${row.amount}`)
        }
      })

      // Block Rewards
      logger.printTracker('SPV Building', 2, 8, 'Block Rewards')

      data = await this.blocksTable.query()
        .select('generatorPublicKey', this.db.raw('SUM(`reward`+`totalFee`) as reward'), this.db.raw('count(*) as produced'))
        .groupBy('generatorPublicKey')

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.generatorPublicKey)
        wallet.balance += parseInt(row.reward)
      })

      // Last block forged for each delegate
      logger.printTracker('SPV Building', 3, 8, 'Last Forged Blocks')

      data = await this.blocksTable.query()
        .select('*', this.db.raw('max(`timestamp`)'))
        .groupBy('generatorPublicKey')

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.generatorPublicKey)
        wallet.lastBlock = row
      })

      // Sent Transactions
      logger.printTracker('SPV Building', 4, 8, 'Sent Transactions')

      data = await this.transactionsTable.query()
        .select('senderPublicKey', this.db.raw('SUM(amount) as amount'), this.db.raw('SUM(fee) as fee'))
        .groupBy('senderPublicKey')

        data.forEach(row => {
        let wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        wallet.balance -= parseInt(row.amount) + parseInt(row.fee)
        if (wallet.balance < 0) {
          logger.warn(`Negative balance should never happen except from premining address: ${wallet}`)
        }
      })

      // Second Signature
      logger.printTracker('SPV Building', 5, 8, 'Second Signatures')

      data = await this.transactionsTable.query()
        .select('senderPublicKey', 'serialized')
        .where('type', 1)

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        wallet.secondPublicKey = Transaction.deserialize(row.serialized.toString('hex')).asset.signature.publicKey
      })

      // Delegates
      logger.printTracker('SPV Building', 6, 8, 'Delegates')

      data = await this.transactionsTable.query()
        .select('senderPublicKey', 'serialized')
        .where('type', 2)

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        wallet.username = Transaction.deserialize(row.serialized.toString('hex')).asset.delegate.username
        this.walletManager.updateWallet(wallet)
      })

      // Votes
      logger.printTracker('SPV Building', 7, 8, 'Votes')

      data = await this.transactionsTable.query()
        .select('senderPublicKey', 'serialized')
        .where('type', 3)
        .orderBy('created_at', 'desc')

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        if (!wallet.voted) {
          let vote = Transaction.deserialize(row.serialized.toString('hex')).asset.votes[0]
          if (vote.startsWith('+')) wallet.vote = vote.slice(1)
          wallet.voted = true
        }
      })

      // Multisignatures
      logger.printTracker('SPV Building', 8, 8, 'Multi Signatures')

      data = await this.transactionsTable.query()
        .select('senderPublicKey', 'serialized')
        .where('type', 4)
        .orderBy('created_at', 'desc')

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        wallet.multisignature = Transaction.deserialize(row.serialized.toString('hex')).asset.multisignature
      })

      logger.stopTracker('SPV Building', 8, 8)
      logger.info(`SPV rebuild finished, wallets in memory: ${Object.keys(this.walletManager.walletsByAddress).length}`)
      logger.info(`Number of registered delegates: ${Object.keys(this.walletManager.delegatesByUsername).length}`)

      return this.walletManager.walletsByAddress || []
    // } catch (error) {
    //   logger.error(JSON.stringify(error))
    // }
  }

  // must be called before builddelegates for  new round
  async updateDelegateStats (activedelegates) {
    if (!activedelegates) {
      return
    }
    logger.debug('Calculating delegate statistics')
    try {
      let lastBlockGenerators = await this.db.query(`SELECT id, generatorPublicKey FROM blocks WHERE height/51 = ${activedelegates[0].round}`, {type: Sequelize.QueryTypes.SELECT})

        activedelegates.forEach(delegate => {
        let idx = lastBlockGenerators.findIndex(blockGenerator => blockGenerator.generatorPublicKey === delegate.publicKey)
        const wallet = this.walletManager.getWalletByPublicKey(delegate.publicKey)

        idx === -1 ? wallet.missedBlocks++ : wallet.producedBlocks++
      })
    } catch (error) {
      logger.error(JSON.stringify(error))
    }
  }

  async saveWallets (force) {
    await Promise.all(
      Object.values(this.walletManager.walletsByPublicKey || {})
        // cold addresses are not saved on database
        .filter(acc => acc.publicKey && (force || acc.dirty))
        .map(acc => this.walletsTable.findOrInsert(acc))
    )

    logger.info('Rebuilt wallets saved')

    return Object.values(this.walletManager.walletsByAddress).forEach(acc => (acc.dirty = false))
  }

  async saveBlock (block) {
    try {
      await this.blocksTable.findOrInsert(block.data)
      await this.transactionsTable.batchInsert(block.transactions || [])
    } catch (error) {
      logger.error(JSON.stringify(error))
    }
  }

  async deleteBlock (block) {
    try {
      await this.transactionsTable.query().delete().where('blockId', block.data.id)
      await this.blocksTable.query().delete().where('id', block.data.id)
    } catch (error) {
      logger.error(JSON.stringify(error))
    }
  }

  async getBlock (id) {
    const block = await this.blocksTable.query().findById(id)

    const transactions = await this.transactionsTable.query().select('serialized').where('blockId', block.id)
    block.transactions = transactions.map(tx => Transaction.deserialize(tx.serialized.toString('hex')))

    return new Block(block)
  }

  getTransaction (id) {
    return this.db.query(`SELECT * FROM transactions WHERE id = '${id}'`, {type: Sequelize.QueryTypes.SELECT})
  }

  getCommonBlock (ids) {
    return this.db.query(`SELECT MAX("height") AS "height", "id", "previousBlock", "timestamp" FROM blocks WHERE "id" IN ('${ids.join('\',\'')}') GROUP BY "id" ORDER BY "height" DESC`, {type: Sequelize.QueryTypes.SELECT})
  }

  async getTransactionsFromIds (txids) {
    const rows = await this.db.query(`SELECT serialized FROM transactions WHERE id IN ('${txids.join('\',\'')}')`, {type: Sequelize.QueryTypes.SELECT})
    const transactions = await rows.map(row => Transaction.deserialize(row.serialized.toString('hex')))

    return txids.map((tx, i) => (txids[i] = transactions.find(tx2 => tx2.id === txids[i])))
  }

  async getLastBlock () {
    const block = await this.blocksTable.query().orderBy('height', 'desc').limit(1)[0]

    if (!block) return null

    const data = await this.transactionsTable.query().where('blockId', block.id)
    block.transactions = data.map(tx => Transaction.deserialize(tx.serialized.toString('hex')))

    return new Block(block)
  }

  async getBlocks (offset, limit) {
    const last = offset + limit
    const blocks = await this.blocksTable.findAll({
      include: [{
        model: this.transactionsTable,
        attributes: ['serialized']
      }],
      attributes: {
        exclude: ['created_at', 'updatedAt']
      },
      where: {
        height: {
          [Sequelize.Op.between]: [offset, last]
        }
      }
    })
    const nblocks = blocks.map(block => {
      block.dataValues.transactions = block.dataValues.transactions.map(tx => tx.serialized.toString('hex'))

      return block.dataValues
    })

    return nblocks
  }

  async getBlockHeaders (offset, limit) {
    const last = offset + limit
    const blocks = await this.blocksTable.findAll({
      attributes: {
        exclude: ['created_at', 'updatedAt']
      },
      where: {
        height: {
          [Sequelize.Op.between]: [offset, last]
        }
      }
    })

    return blocks.map(block => Block.serialize(block))
  }
}
