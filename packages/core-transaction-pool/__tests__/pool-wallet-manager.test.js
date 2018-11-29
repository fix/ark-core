const { crypto } = require('@arkecosystem/crypto')
const bip39 = require('bip39')
const delegates = require('@arkecosystem/core-test-utils/fixtures/testnet/delegates')
const generateTransfer = require('@arkecosystem/core-test-utils/lib/generators/transactions/transfer')
const generateWallets = require('@arkecosystem/core-test-utils/lib/generators/wallets')
const app = require('./__support__/setup')

const arktoshi = 10 ** 8
let container
let poolWalletManager

beforeAll(async () => {
  container = await app.setUp()
  poolWalletManager = new (require('../lib/pool-wallet-manager'))()
})

afterAll(async () => {
  await app.tearDown()
})

describe('applyPoolTransactionToSender', () => {
  describe('update the balance', () => {
    it('should only update the balance of the sender', async () => {
      const delegate0 = delegates[0]
      const { publicKey } = crypto.getKeys(bip39.generateMnemonic())
      const newAddress = crypto.getAddress(publicKey)

      const delegateWallet = poolWalletManager.findByAddress(delegate0.address)
      const newWallet = poolWalletManager.findByAddress(newAddress)

      expect(+delegateWallet.balance).toBe(+delegate0.balance)
      expect(+newWallet.balance).toBe(0)

      const amount1 = 123 * 10 ** 8
      const transfer = generateTransfer(
        'testnet',
        delegate0.secret,
        newAddress,
        amount1,
        1,
      )[0]

      delegateWallet.applyTransactionToSender(transfer)

      expect(+delegateWallet.balance).toBe(
        +delegate0.balance - amount1 - 0.1 * 10 ** 8,
      )
      expect(newWallet.balance.isZero()).toBeTrue()
    })

    it('should only update the balance of the sender with dyn fees', async () => {
      const delegate0 = delegates[1]
      const { publicKey } = crypto.getKeys(bip39.generateMnemonic())
      const newAddress = crypto.getAddress(publicKey)

      const delegateWallet = poolWalletManager.findByAddress(delegate0.address)
      const newWallet = poolWalletManager.findByAddress(newAddress)

      expect(+delegateWallet.balance).toBe(+delegate0.balance)
      expect(+newWallet.balance).toBe(0)

      const amount1 = 123 * 10 ** 8
      const fee = 10
      const transfer = generateTransfer(
        'testnet',
        delegate0.secret,
        newAddress,
        amount1,
        1,
        false,
        fee,
      )[0]

      delegateWallet.applyTransactionToSender(transfer)

      expect(+delegateWallet.balance).toBe(+delegate0.balance - amount1 - fee)
      expect(newWallet.balance.isZero()).toBeTrue()
    })

    it('should not apply chained transfers', async () => {
      const delegate = delegates[7]
      const delegateWallet = poolWalletManager.findByPublicKey(
        delegate.publicKey,
      )

      const wallets = generateWallets('testnet', 4)
      const poolWallets = wallets.map(w =>
        poolWalletManager.findByAddress(w.address),
      )

      expect(+delegateWallet.balance).toBe(+delegate.balance)
      poolWallets.forEach(w => {
        expect(+w.balance).toBe(0)
      })

      const transfers = [
        {
          // transfer from delegate to wallet 0
          from: delegate,
          to: wallets[0],
          amount: 100 * arktoshi,
        },
        {
          // transfer from wallet 0 to delegatej
          from: wallets[0],
          to: delegate,
          amount: 55 * arktoshi,
        },
      ]

      transfers.forEach(t => {
        const transfer = generateTransfer(
          'testnet',
          t.from.passphrase,
          t.to.address,
          t.amount,
          1,
        )[0]

        // This is normally refused because it's a cold wallet, but since we want
        // to test if chained transfers are refused, pretent it is not a cold wallet.
        container
          .resolvePlugin('database')
          .walletManager.findByPublicKey(transfer.senderPublicKey)

        const errors = []
        if (poolWalletManager.canApply(transfer, errors)) {
          poolWalletManager
            .findByPublicKey(transfer.senderPublicKey)
            .applyTransactionToSender(transfer)

          expect(t.from).toBe(delegate)
        } else {
          expect(t.from).toBe(wallets[0])
          expect(JSON.stringify(errors)).toEqual(
            `["[PoolWalletManager] Can't apply transaction id:${
              transfer.id
            } from sender:${
              t.from.address
            }","Insufficient balance in the wallet"]`,
          )
        }

        container
          .resolvePlugin('database')
          .walletManager.forgetByPublicKey(transfer.publicKey)
      })

      expect(+delegateWallet.balance).toBe(
        delegate.balance - (100 + 0.1) * arktoshi,
      )
      expect(poolWallets[0].balance.isZero()).toBeTrue()
    })
  })
})
