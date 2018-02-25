const Model = require('./model')

module.exports = class Block extends Model {
  static get tableName () {
    return 'blocks'
  }

  static get fillable () {
    return [
      'id',
      'version',
      'timestamp',
      'previousBlock',
      'height',
      'numberOfTransactions',
      'totalAmount',
      'totalFee',
      'reward',
      'payloadLength',
      'payloadHash',
      'generatorPublicKey',
      'blockSignature'
    ]
  }

  static relationMappings () {
    return {
      generator: {
        relation: sModel.BelongsToOneRelation,
        modelClass: `${__dirname}/Wallet`,
        join: {
          from: 'blocks.generatorPublicKey',
          to: 'wallets.publicKey'
        }
      },
      transactions: {
        relation: sModel.HasManyRelation,
        modelClass: `${__dirname}/Transaction`,
        join: {
          from: 'blocks.id',
          to: 'transactions.blockId'
        }
      },
      serializedTransactions: {
        relation: sModel.HasManyRelation,
        modelClass: `${__dirname}/Transaction`,
        filter: query => query.select('serialized'),
        join: {
          from: 'blocks.id',
          to: 'transactions.blockId'
        }
      }
    }
  }

  static async findOrInsert (data) {
    const row = await this.query().where({ id: data.id, height: data.height }).first()

    if (!row) await this.query().insert(this.transform(data))
  }
}
