const Joi = require('joi')
const network = require('../../services/network')

module.exports = {
  name: 'accounts.info',
  async method (params) {
    const response = await network.getFromNodeApi(`wallets/${params.address}`)

    return response.data.data
  },
  schema: {
    address: Joi.string().length(34).required()
  }
}
