const Sequelize = require('sequelize')
const Block = require('app/models/block')
const Transaction = require('app/models/transaction')
const config = require('app/core/config')
const goofy = require('app/core/goofy')
const schema = require('app/database/sequelize/schema')
const DBInterface = require('app/core/dbinterface')
const webhookManager = require('app/core/managers/webhook').getInstance()

module.exports = class SequelizeDB extends DBInterface {
  async init (params) {
    if (this.db) {
      goofy.debug('Already initialised')
    }
    this.db = new Sequelize(params.uri, {
      dialect: params.dialect,
      logging: !!params.logging,
      operatorsAliases: Sequelize.Op
    })

    return this.db
      .authenticate()
      .then(() => schema.syncTables(this.db))
      .then(tables => ([
        this.blocksTable, this.transactionsTable, this.walletsTable, this.roundsTable, this.webhooksTable
      ] = tables))
      .then(() => this.registerHooks())

    // await this.db.authenticate()
    // let tables = await schema.syncTables(this.db)

    // [
    //   this.blocksTable,
    //   this.transactionsTable,
    //   this.walletsTable,
    //   this.roundsTable,
    //   this.webhooksTabl
    // ] = tables

    // this.registerHooks()
  }

  registerHooks () {
    if (config.webhooks.enabled) {
      this.blocksTable.afterCreate((block) => webhookManager.emit('block.created', block));
      this.transactionsTable.afterCreate((transaction) => webhookManager.emit('transaction.created', transaction));
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
    return this.roundsTable.bulkCreate(rounds)
  }

  deleteRound (round) {
    return this.roundsTable.destroy({where: {round}})
  }

  async buildDelegates (block) {
    const activeDelegates = config.getConstants(block.data.height).activeDelegates
    const that = this

    const data = await this.walletsTable.findAll({
      attributes: [
        ['vote', 'publicKey'],
        [Sequelize.fn('SUM', Sequelize.col('balance')), 'balance']
      ],
      group: 'vote',
      where: {
        vote: {
          [Sequelize.Op.ne]: null
        }
      }
    })

    if (data.length < activeDelegates) {
      const data2 = await this.walletsTable.findAll({
        attributes: [
          'publicKey'
        ],
        where: {
          username: {
            [Sequelize.Op.ne]: null
          }
        },
        order: [[ 'publicKey', 'ASC' ]],
        limit: activeDelegates - data.length
      })

      await data.concat(data2)
    }

    // goofy.info(`got ${data.length} voted delegates`)
    const round = parseInt(block.data.height / 51)
    that.activedelegates = data
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 51)
      .map(a => ({...{round: round}, ...a.dataValues}))

    goofy.debug(`generated ${that.activedelegates.length} active delegates`)

    return that.activedelegates
  }

  async buildWallets () {
    this.walletManager.reset()

    try {
      // Start
      goofy.printTracker('SPV Building', 0, 7)
      let data = await this.transactionsTable.findAll({
        attributes: [
          'recipientId',
          [Sequelize.fn('SUM', Sequelize.col('amount')), 'amount']
        ],
        where: {type: 0},
        group: 'recipientId'
      })

      // Received TX
      goofy.printTracker('SPV Building', 1, 7, 'received transactions')
      data.forEach(row => {
        const wallet = this.walletManager.getWalletByAddress(row.recipientId)
        if (wallet) {
          wallet.balance = parseInt(row.amount)
        } else {
          goofy.warn('lost cold wallet:', row.recipientId, row.amount)
        }
      })
      data = await this.db.query('select `generatorPublicKey`, sum(`reward`+`totalFee`) as reward, count(*) as produced from blocks group by `generatorPublicKey`', {type: Sequelize.QueryTypes.SELECT})

      // Block Rewards
      goofy.printTracker('SPV Building', 2, 7, 'block rewards')
      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.generatorPublicKey)
        wallet.balance += parseInt(row.reward)
        wallet.producedBlocks += parseInt(row.produced)
      })
      data = await this.db.query('select *, max(`timestamp`) from blocks group by `generatorPublicKey`', {type: Sequelize.QueryTypes.SELECT})

      // ???
      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.generatorPublicKey)
        wallet.lastBlock = row
      })

      data = await this.transactionsTable.findAll({
        attributes: [
          'senderPublicKey',
          [Sequelize.fn('SUM', Sequelize.col('amount')), 'amount'],
          [Sequelize.fn('SUM', Sequelize.col('fee')), 'fee']
        ],
        group: 'senderPublicKey'
      })

      // Sent Transactions
      goofy.printTracker('SPV Building', 3, 7, 'sent transactions')
      data.forEach(row => {
        let wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        wallet.balance -= parseInt(row.amount) + parseInt(row.fee)
        if (wallet.balance < 0) {
          goofy.warn('Negative balance should never happen except from premining address:')
          goofy.warn(wallet)
        }
      })
      data = await this.transactionsTable.findAll({
        attributes: [
          'senderPublicKey',
          'serialized'
        ],
        where: {type: 1}}
      )

      // Second Signature
      goofy.printTracker('SPV Building', 4, 7, 'second signatures')
      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        wallet.secondPublicKey = Transaction.deserialize(row.serialized.toString('hex')).asset.signature.publicKey
      })
      data = await this.transactionsTable.findAll({
        attributes: [
          'senderPublicKey',
          'serialized'
        ],
        where: {type: 2}}
      )

      // Delegates
      goofy.printTracker('SPV Building', 5, 7, 'delegates')

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        wallet.username = Transaction.deserialize(row.serialized.toString('hex')).asset.delegate.username
        this.walletManager.updateWallet(wallet)
      })

      Object.values(this.walletManager.walletsByAddress)
        .filter(a => a.balance < 0)
        .forEach(a => goofy.debug(a))

      data = await this.transactionsTable.findAll({
        attributes: [
          'senderPublicKey',
          'serialized'
        ],
        order: [[ 'createdAt', 'DESC' ]],
        where: {type: 3}}
      )

      // Votes
      goofy.printTracker('SPV Building', 6, 7, 'votes')
      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        if (!wallet.voted) {
          let vote = Transaction.deserialize(row.serialized.toString('hex')).asset.votes[0]
          if (vote.startsWith('+')) wallet.vote = vote.slice(1)
          wallet.voted = true
        }
      })
      goofy.printTracker('SPV Building', 7, 7, 'multisignatures')
      data = await this.transactionsTable.findAll({
        attributes: [
          'senderPublicKey',
          'serialized'
        ],
        order: [[ 'createdAt', 'DESC' ]],
        where: {type: 4}}
      )

      data.forEach(row => {
        const wallet = this.walletManager.getWalletByPublicKey(row.senderPublicKey)
        wallet.multisignature = Transaction.deserialize(row.serialized.toString('hex')).asset.multisignature
      })

      goofy.stopTracker('SPV Building', 7, 7)
      goofy.info('SPV rebuild finished, wallets in memory:', Object.keys(this.walletManager.walletsByAddress).length)
      goofy.info(`Number of registered delegates: ${Object.keys(this.walletManager.delegatesByUsername).length}`)

      return this.walletManager.walletsByAddress || []
    } catch (error) {
      goofy.error(error)
    }
  }

  async saveWallets (force) {
    await this.db.transaction(t =>
      Promise.all(
        Object.values(this.walletManager.walletsByPublicKey || {})
          // cold addresses are not saved on database
          .filter(acc => acc.publicKey && (force || acc.dirty))
          .map(acc => this.walletsTable.upsert(acc, {transaction: t}))
      )
    )

    goofy.info('Rebuilt wallets saved')

    await Object.values(this.walletManager.walletsByAddress).forEach(acc => (acc.dirty = false))
  }

  async saveBlock (block) {
    let transaction

    try {
      transaction = await this.db.transaction()
      await this.blocksTable.create(block.data, {transaction})
      await this.transactionsTable.bulkCreate(block.transactions || [], {transaction})
      await transaction.commit()
    } catch (error) {
      goofy.error(error)
      await transaction.rollback()
    }
  }

  async deleteBlock (block) {
    let transaction

    try {
      transaction = await this.db.transaction()
      await this.transactionsTable.destroy({where: {blockId: block.data.id}}, {transaction})
      await this.blocksTable.destroy({where: {id: block.data.id}}, {transaction})
      await transaction.commit()
    } catch (error) {
      goofy.error(error)
      await transaction.rollback()
    }
  }

  async getBlock (id) {
    const block = await this.blocksTable.findOne({
      include: [{
        model: this.transactionsTable,
        attributes: ['serialized']
      }],
      attributes: {
        exclude: ['createdAt', 'updatedAt']
      },
      where: {
        id: id
      }
    })

    const data = await this.transactionsTable.findAll({where: {blockId: block.id}})
    block.transactions = data.map(tx => Transaction.deserialize(tx.serialized.toString('hex')))

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
    const block = await this.blocksTable.findOne({order: [['height', 'DESC']]})

    // .thn(data => { // TODO to remove as it would fail anyway next in the pipeline?
    //   if (data) {
    //     return Promise.resolve(data)
    //   } else {
    //     return Promise.reject(new Error('No block found in database'))
    //   }
    // })

    const data = await this.transactionsTable.findAll({where: {blockId: block.id}})
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
        exclude: ['createdAt', 'updatedAt']
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
        exclude: ['createdAt', 'updatedAt']
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
