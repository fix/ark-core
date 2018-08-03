'use strict'

const moment = require('moment')
const semver = require('semver')
const logger = require('@arkecosystem/core-container').resolvePlugin('logger')
const isMyself = require('./utils/is-myself')

class Guard {
  constructor () {
    this.suspensions = {}
  }

  init (config) {
    this.config = config

    return this
  }

  /**
   * Get a list of all suspended peers.
   * @return {Object}
   */
  all () {
    return this.suspensions
  }

  /**
   * Get the suspended peer for the give IP.
   * @return {Object}
   */
  get (ip) {
    return this.suspensions[ip]
  }

  /**
   * Suspends a peer unless whitelisted.
   * @param {Peer} peer
   */
  suspend (peer) {
    if (this.config.peers.whiteList && this.config.peers.whiteList.includes(peer.ip)) {
      return
    }

    const until = moment().add(this.manager.config.suspendMinutes, 'minutes')

    this.suspensions[peer.ip] = {
      peer,
      until,
      untilHuman: until.format('h [hrs], m [min]')
    }

    delete this.peers[peer.ip]

    logger.debug(`Suspended ${peer.ip} for ` + this.get(peer.ip).untilHuman)
  }

  /**
   * Determine if peer is suspended or not.
   * @param  {Peer} peer
   * @return {Boolean}
   */
  isSuspended (peer) {
    const suspendedPeer = this.get(peer.ip)

    if (suspendedPeer && moment().isBefore(suspendedPeer.until)) {
      logger.debug(`${suspendedPeer.ip} still suspended for ` + suspendedPeer.untilHuman)

      return true
    } else if (suspendedPeer) {
      delete this.suspensions[suspendedPeer.ip]
    }

    return false
  }

  /**
   * Determine if the peer is whitelisted.
   * @param  {Peer}  peer
   * @return {Boolean}
   */
  isWhitelisted (peer) {
    return this.config.peers.whiteList.includes(peer.ip)
  }

  /**
   * Determine if the peer is blacklisted.
   * @param  {Peer}  peer
   * @return {Boolean}
   */
  isBlacklisted (peer) {
    return this.config.peers.blackList.includes(peer.ip)
  }

  /**
   * Determine if the peer is within the version constraints.
   * @param  {Peer}  peer
   * @return {Boolean}
   */
  isValidVersion (peer) {
    return semver.satisfies(peer.version, this.config.peers.minimumVersion)
  }

  /**
   * Determine if the peer is localhost.
   * @param  {Peer}  peer
   * @return {Boolean}
   */
  isMyself (peer) {
    return isMyself(peer.ip)
  }
}

module.exports = new Guard()
