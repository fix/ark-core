const { TRANSACTION_TYPES } = require('../../../constants')
const transaction = require('./base')

module.exports = joi => ({
  name: 'arkMultiSignature',
  base: transaction(joi).append({
    type: joi.number().valid(TRANSACTION_TYPES.MULTI_SIGNATURE),
    amount: joi.alternatives().try(joi.bignumber(), joi.number().valid(0)),
    recipientId: joi.empty(),
    signatures: joi
      .array()
      .length(joi.ref('asset.multisignature.keysgroup.length'))
      .required(),
    asset: joi
      .object({
        multisignature: joi
          .object({
            min: joi
              .when(joi.ref('keysgroup.length'), {
                is: joi.number().greater(16),
                then: joi
                  .number()
                  .positive()
                  .max(16),
                otherwise: joi
                  .number()
                  .positive()
                  .max(joi.ref('keysgroup.length')),
              })
              .required(),
            keysgroup: joi
              .array()
              .unique()
              .min(2)
              .items(
                joi
                  .string()
                  .not(`+${transaction.senderPublicKey}`)
                  .length(67)
                  .regex(/^\+/)
                  .required(),
              )
              .required(),
            lifetime: joi
              .number()
              .integer()
              .min(1)
              .max(72)
              .required(),
          })
          .required(),
      })
      .required(),
  }),
})
