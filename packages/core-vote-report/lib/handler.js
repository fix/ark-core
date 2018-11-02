'use strict'

const sumBy = require('lodash/sumBy')
const { bignumify, delegateCalculator } = require('@arkecosystem/core-utils')
const container = require('@arkecosystem/core-container')
const config = container.resolvePlugin('config')
const blockchain = container.resolvePlugin('blockchain')
const database = container.resolvePlugin('database')

const formatDelegates = delegates => delegates.map(delegate => {
  const voters = database.walletManager
    .allByPublicKey()
    .filter(wallet => wallet.vote === delegate.publicKey)

  const approval = delegateCalculator.calculateApproval(delegate).toString()
  const rank = delegate.rate.toLocaleString(undefined, { minimumIntegerDigits: 2 })
  const votes = delegate.voteBalance.div(1e8).toFixed().toLocaleString(undefined, { maximumFractionDigits: 0 })

  return {
    rank,
    username: delegate.username.padEnd(25),
    approval: approval.padEnd(4),
    votes: votes.padEnd(10),
    voters: voters.length.toString().padEnd(4)
  }
})

module.exports = (request, h) => {
  const lastBlock = blockchain.getLastBlock()
  const constants = config.getConstants(lastBlock.data.height)
  const rewards = bignumify(constants.reward).times(lastBlock.data.height - constants.height)
  const supply = +bignumify(config.genesisBlock.totalAmount).plus(rewards).toFixed()

  const active = database.walletManager
    .allByUsername()
    .sort((a, b) => a.rate - b.rate)
    .slice(0, constants.activeDelegates)

  const standby = database.walletManager
    .allByUsername()
    .sort((a, b) => a.rate - b.rate)
    .slice(constants.activeDelegates + 1, constants.activeDelegates + 30)

  const voters = database.walletManager
    .allByPublicKey()
    .filter(wallet => wallet.vote)

  const totalVotes = sumBy(voters, wallet => +wallet.balance.toFixed())
  const percentage = (totalVotes * 100) / supply

  return h.view('index', {
    activeDelegatesCount: constants.activeDelegates,
    activeDelegates: formatDelegates(active),
    standbyDelegates: formatDelegates(standby),
    voters: voters.length,
    supply: (supply / 1e8).toLocaleString(undefined, { maximumFractionDigits: 0 }),
    totalVotes: (totalVotes / 1e8).toLocaleString(undefined, { maximumFractionDigits: 0 }),
    percentage: percentage.toLocaleString(undefined, { maximumFractionDigits: 2 })
  })
}
