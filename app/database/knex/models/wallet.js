const Model = require('./model')

module.exports = class Wallet extends Model {
  static get tableName () {
    return 'wallets'
  }

  static get fillable () {
    return [
      'address',
      'publicKey',
      'secondPublicKey',
      'vote',
      'username',
      'balance',
      'votebalance',
      'producedBlocks',
      'missedBlocks'
    ]
  }

  static relationMappings () {
    return {
      blocks: {
        relation: Model.HasManyRelation,
        modelClass: `${__dirname}/Block`,
        join: {
          from: 'wallets.publicKey',
          to: 'blocks.generatorPublicKey'
        }
      },
      rounds: {
        relation: Model.HasManyRelation,
        modelClass: `${__dirname}/Round`,
        join: {
          from: 'wallets.publicKey',
          to: 'rounds.publicKey'
        }
      },
      sentTransactions: {
        relation: Model.HasManyRelation,
        modelClass: `${__dirname}/Transaction`,
        join: {
          from: 'wallets.publicKey',
          to: 'transactions.senderPublicKey'
        }
      },
      receivedTransactions: {
        relation: Model.HasManyRelation,
        modelClass: `${__dirname}/Transaction`,
        join: {
          from: 'wallets.address',
          to: 'transactions.recipientId'
        }
      }
    }
  }

  static async updateOrCreate (data) {
    let roundExists = await this.query().where('address', data.address).first()

    roundExists
      ? await this.query().where('address', data.address).update(this.prepare(data))
      : await this.query().insert(this.prepare(data))
  }
}
