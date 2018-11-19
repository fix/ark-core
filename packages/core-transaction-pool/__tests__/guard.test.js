const { slots, crypto } = require('@arkecosystem/crypto')
const bip39 = require('bip39')
const delegates = require('@arkecosystem/core-test-utils/fixtures/testnet/delegates')
const generateTransfer = require('@arkecosystem/core-test-utils/lib/generators/transactions/transfer')
const generateVote = require('@arkecosystem/core-test-utils/lib/generators/transactions/vote')
const generateSignature = require('@arkecosystem/core-test-utils/lib/generators/transactions/signature')
const generateDelegateReg = require('@arkecosystem/core-test-utils/lib/generators/transactions/delegate')
const app = require('./__support__/setup')

let container
let guard
let poolInterface

beforeAll(async () => {
  container = await app.setUp()
})

afterAll(async () => {
  await app.tearDown()
})

beforeEach(() => {
  poolInterface = new (require('../lib/interface'))({})
  guard = new (require('../lib/guard'))(poolInterface)
})

describe('Transaction Guard', () => {
  it('should be an object', () => {
    expect(guard).toBeObject()
  })

  describe('validate', () => {
    it('should be a function', () => {
      expect(guard.validate).toBeFunction()
    })

    it('should not apply the tx to the balance of the sender & recipient with dyn fee < min fee', async () => {
      guard.pool.transactionExists = jest.fn(() => false)
      guard.pool.hasExceededMaxTransactions = jest.fn(() => false)

      const delegate0 = delegates[0]
      const { publicKey } = crypto.getKeys(bip39.generateMnemonic())
      const newAddress = crypto.getAddress(publicKey)

      const delegateWallet = poolInterface.walletManager.findByPublicKey(
        delegate0.publicKey,
      )
      const newWallet = poolInterface.walletManager.findByPublicKey(publicKey)

      expect(+delegateWallet.balance).toBe(+delegate0.balance)
      expect(+newWallet.balance).toBe(0)

      const amount1 = 123 * 10 ** 8
      const fee = 10
      const transfers = generateTransfer(
        'testnet',
        delegate0.secret,
        newAddress,
        amount1,
        1,
        false,
        fee,
      )

      await guard.validate(transfers)

      expect(+delegateWallet.balance).toBe(+delegate0.balance)
      expect(+newWallet.balance).toBe(0)
    })

    it('should update the balance of the sender & recipient with dyn fee > min fee', async () => {
      guard.pool.transactionExists = jest.fn(() => false)
      guard.pool.hasExceededMaxTransactions = jest.fn(() => false)
      guard.__reset()

      const delegate1 = delegates[1]
      const { publicKey } = crypto.getKeys(bip39.generateMnemonic())
      const newAddress = crypto.getAddress(publicKey)

      const delegateWallet = poolInterface.walletManager.findByPublicKey(
        delegate1.publicKey,
      )
      const newWallet = poolInterface.walletManager.findByPublicKey(publicKey)

      expect(+delegateWallet.balance).toBe(+delegate1.balance)
      expect(+newWallet.balance).toBe(0)

      const amount1 = +delegateWallet.balance / 2
      const fee = 0.1 * 10 ** 8
      const transfers = generateTransfer(
        'testnet',
        delegate1.secret,
        newAddress,
        amount1,
        1,
        false,
        fee,
      )

      await guard.validate(transfers)
      expect(guard.errors).toEqual({})

      expect(+delegateWallet.balance).toBe(+delegate1.balance - amount1 - fee)
      expect(+newWallet.balance).toBe(amount1)
    })

    it('should update the balance of the sender & recipient with multiple transactions type', async () => {
      guard.pool.transactionExists = jest.fn(() => false)
      guard.pool.hasExceededMaxTransactions = jest.fn(() => false)
      guard.pool.senderHasTransactionsOfType = jest.fn(() => false)
      guard.__reset()

      const delegate2 = delegates[2]
      const newWalletPassphrase = bip39.generateMnemonic()
      const { publicKey } = crypto.getKeys(newWalletPassphrase)
      const newAddress = crypto.getAddress(publicKey)

      const delegateWallet = poolInterface.walletManager.findByPublicKey(
        delegate2.publicKey,
      )
      const newWallet = poolInterface.walletManager.findByPublicKey(publicKey)

      expect(+delegateWallet.balance).toBe(+delegate2.balance)
      expect(+newWallet.balance).toBe(0)

      const amount1 = +delegateWallet.balance / 2
      const fee = 0.1 * 10 ** 8
      const voteFee = 10 ** 8
      const delegateRegFee = 25 * 10 ** 8
      const signatureFee = 5 * 10 ** 8
      const transfers = generateTransfer(
        'testnet',
        delegate2.secret,
        newAddress,
        amount1,
        1,
        false,
        fee,
      )
      const votes = generateVote(
        'testnet',
        newWalletPassphrase,
        delegate2.publicKey,
        1,
      )
      const delegateRegs = generateDelegateReg(
        'testnet',
        newWalletPassphrase,
        1,
      )
      const signatures = generateSignature('testnet', newWalletPassphrase, 1)

      await guard.validate([
        transfers[0],
        votes[0],
        delegateRegs[0],
        signatures[0],
      ])
      expect(guard.errors).toEqual({})

      expect(+delegateWallet.balance).toBe(+delegate2.balance - amount1 - fee)
      expect(+newWallet.balance).toBe(
        amount1 - voteFee - delegateRegFee - signatureFee,
      )
    })

    it('should not accept transaction in excess', async () => {
      guard.pool.transactionExists = jest.fn(() => false)
      guard.pool.hasExceededMaxTransactions = jest.fn(() => false)
      guard.pool.senderHasTransactionsOfType = jest.fn(() => false)
      guard.__reset()

      const delegate3 = delegates[3]
      const newWalletPassphrase = bip39.generateMnemonic()
      const { publicKey } = crypto.getKeys(newWalletPassphrase)
      const newAddress = crypto.getAddress(publicKey)

      const delegateWallet = poolInterface.walletManager.findByPublicKey(
        delegate3.publicKey,
      )
      const newWallet = poolInterface.walletManager.findByPublicKey(publicKey)

      expect(+delegateWallet.balance).toBe(+delegate3.balance)
      expect(+newWallet.balance).toBe(0)

      // first, transfer coins to new wallet so that we can test from it then
      const amount1 = 1000 * 10 ** 8
      const fee = 0.1 * 10 ** 8
      const transfers1 = generateTransfer(
        'testnet',
        delegate3.secret,
        newAddress,
        amount1,
        1,
      )
      await guard.validate(transfers1)

      expect(+delegateWallet.balance).toBe(+delegate3.balance - amount1 - fee)
      expect(+newWallet.balance).toBe(amount1)

      // transfer almost everything from new wallet so that we don't have enough for any other transaction
      const amount2 = 999 * 10 ** 8
      const transfers2 = generateTransfer(
        'testnet',
        newWalletPassphrase,
        delegate3.address,
        amount2,
        1,
      )
      await guard.validate(transfers2)

      expect(+newWallet.balance).toBe(amount1 - amount2 - fee)

      // now try to validate any other transaction - should not be accepted because in excess
      const transferAmount = 0.5 * 10 ** 8
      const transferDynFee = 0.5 * 10 ** 8
      const allTransactions = [
        generateTransfer(
          'testnet',
          newWalletPassphrase,
          delegate3.address,
          transferAmount,
          1,
          false,
          transferDynFee,
        ),
        generateSignature('testnet', newWalletPassphrase, 1),
        generateVote('testnet', newWalletPassphrase, delegate3.publicKey, 1),
        generateDelegateReg('testnet', newWalletPassphrase, 1),
      ]

      for (const transaction of allTransactions) {
        await guard.validate(transaction) // eslint-disable-line no-await-in-loop

        const errorExpected = {}
        errorExpected[transaction[0].id] = [
          {
            message: `Error: [PoolWalletManager] Can't apply transaction ${
              transaction[0].id
            }`,
            type: 'ERR_UNKNOWN',
          },
        ]
        expect(guard.errors).toEqual(errorExpected)

        expect(+delegateWallet.balance).toBe(
          +delegate3.balance - amount1 - fee + amount2,
        )
        expect(+newWallet.balance).toBe(amount1 - amount2 - fee)

        guard.__reset()
      }
    })
  })

  describe('invalidate', () => {
    it('should be a function', () => {
      expect(guard.invalidate).toBeFunction()
    })

    it('should invalidate transactions', () => {
      guard.invalidate([{ id: 1 }, { id: 2 }], 'Invalid.')

      expect(guard.invalid).toHaveLength(2)
      expect(guard.invalid).toEqual([{ id: 1 }, { id: 2 }])
      expect(guard.errors).toBeObject()
      expect(Object.keys(guard.errors)).toHaveLength(2)
      expect(guard.errors['1']).toEqual([
        { message: 'Invalid.', type: 'ERR_INVALID' },
      ])
    })
  })

  describe('getIds', () => {
    it('should be a function', () => {
      expect(guard.getIds).toBeFunction()
    })

    it('should be ok', () => {
      guard.transactions = [{ id: 1 }]
      guard.accept = [{ id: 2 }]
      guard.excess = [{ id: 3 }]
      guard.invalid = [{ id: 4 }]
      guard.broadcast = [{ id: 5 }]

      expect(guard.getIds()).toEqual({
        transactions: [1],
        accept: [2],
        excess: [3],
        invalid: [4],
        broadcast: [5],
      })
    })

    it('should be ok using a type', () => {
      guard.excess = [{ id: 3 }]

      expect(guard.getIds('excess')).toEqual([3])
    })
  })

  describe('getTransactions', () => {
    it('should be a function', () => {
      expect(guard.getTransactions).toBeFunction()
    })

    it('should be ok', () => {
      guard.transactions = [{ id: 1 }]
      guard.accept = [{ id: 2 }]
      guard.excess = [{ id: 3 }]
      guard.invalid = [{ id: 4 }]
      guard.broadcast = [{ id: 5 }]

      expect(guard.getTransactions()).toEqual({
        transactions: [{ id: 1 }],
        accept: [{ id: 2 }],
        excess: [{ id: 3 }],
        invalid: [{ id: 4 }],
        broadcast: [{ id: 5 }],
      })
    })

    it('should be ok using a type', () => {
      guard.excess = [{ id: 3 }]

      expect(guard.getTransactions('excess')).toEqual([{ id: 3 }])
    })
  })

  describe('toJson', () => {
    it('should be a function', () => {
      expect(guard.toJson).toBeFunction()
    })

    it('should be ok', () => {
      guard.transactions = [{ id: 1 }]
      guard.accept = [{ id: 2 }]
      guard.excess = [{ id: 3 }]
      guard.broadcast = [{ id: 5 }]

      expect(guard.toJson()).toEqual({
        data: {
          accept: [2],
          excess: [3],
          invalid: [],
          broadcast: [5],
        },
        errors: null,
      })
    })

    it('should be ok with error', () => {
      guard.transactions = [{ id: 1 }]
      guard.accept = [{ id: 2 }]
      guard.excess = [{ id: 3 }]
      guard.invalidate({ id: 4 }, 'Invalid.')
      guard.broadcast = [{ id: 5 }]

      expect(guard.toJson()).toEqual({
        data: {
          accept: [2],
          excess: [3],
          invalid: [4],
          broadcast: [5],
        },
        errors: { 4: [{ message: 'Invalid.', type: 'ERR_INVALID' }] },
      })
    })
  })

  describe('has', () => {
    it('should be a function', () => {
      expect(guard.has).toBeFunction()
    })

    it('should be ok', () => {
      guard.excess = [{ id: 1 }, { id: 2 }]

      expect(guard.has('excess', 2)).toBeTrue()
    })

    it('should not be ok', () => {
      guard.excess = [{ id: 1 }, { id: 2 }]

      expect(guard.has('excess', 1)).toBeFalse()
    })
  })

  describe('hasAtLeast', () => {
    it('should be a function', () => {
      expect(guard.hasAtLeast).toBeFunction()
    })

    it('should be ok', () => {
      guard.excess = [{ id: 1 }, { id: 2 }]

      expect(guard.hasAtLeast('excess', 2)).toBeTrue()
    })

    it('should not be ok', () => {
      guard.excess = [{ id: 1 }]

      expect(guard.hasAtLeast('excess', 2)).toBeFalse()
    })
  })

  describe('hasAny', () => {
    it('should be a function', () => {
      expect(guard.hasAny).toBeFunction()
    })

    it('should be ok', () => {
      guard.excess = [{ id: 1 }]

      expect(guard.hasAny('excess')).toBeTrue()
    })

    it('should not be ok', () => {
      guard.excess = []

      expect(guard.hasAny('excess')).toBeFalse()
    })
  })

  describe('__transformAndFilterTransactions', () => {
    it('should be a function', () => {
      expect(guard.__transformAndFilterTransactions).toBeFunction()
    })

    it('should reject duplicate transactions', () => {
      guard.pool.transactionExists = jest.fn(() => true)
      guard.pool.pingTransaction = jest.fn(() => true)

      const tx = { id: 1 }
      guard.__transformAndFilterTransactions([tx])

      expect(guard.errors['1']).toEqual([
        {
          message: 'Duplicate transaction 1',
          type: 'ERR_DUPLICATE',
        },
      ])
    })

    it('should reject blocked senders', () => {
      guard.pool.transactionExists = jest.fn(() => false)
      guard.pool.isSenderBlocked = jest.fn(() => true)

      const tx = { id: 1, senderPublicKey: 'affe' }
      guard.__transformAndFilterTransactions([tx])

      expect(guard.errors['1']).toEqual([
        {
          message: 'Transaction 1 rejected. Sender affe is blocked.',
          type: 'ERR_SENDER_BLOCKED',
        },
      ])
    })

    it('should reject transactions from the future', () => {
      guard.pool.transactionExists = jest.fn(() => false)
      const getTime = slots.getTime
      slots.getTime = jest.fn(() => 47157042)

      const tx = {
        id: 1,
        senderPublicKey: 'affe',
        timestamp: slots.getTime() + 1,
      }
      guard.__transformAndFilterTransactions([tx])

      expect(guard.errors['1']).toEqual([
        {
          message: 'Transaction 1 is from the future (47157043 > 47157042)',
          type: 'ERR_FROM_FUTURE',
        },
      ])

      slots.getTime = getTime
    })
  })

  describe('__determineValidTransactions', () => {
    it('should be a function', () => {
      expect(guard.__determineValidTransactions).toBeFunction()
    })
  })

  describe('__determineExcessTransactions', () => {
    it('should be a function', () => {
      expect(guard.__determineExcessTransactions).toBeFunction()
    })
  })

  describe('__determineFeeMatchingTransactions', () => {
    it('should be a function', () => {
      expect(guard.__determineFeeMatchingTransactions).toBeFunction()
    })
  })

  describe('__pushError', () => {
    it('should be a function', () => {
      expect(guard.__pushError).toBeFunction()
    })

    it('should have error for transaction', () => {
      expect(guard.errors).toBeEmpty()

      guard.__pushError({ id: 1 }, 'ERR_INVALID', 'Invalid.')

      expect(guard.errors).toBeObject()
      expect(guard.errors['1']).toBeArray()
      expect(guard.errors['1']).toHaveLength(1)
      expect(guard.errors['1']).toEqual([
        { message: 'Invalid.', type: 'ERR_INVALID' },
      ])
      expect(guard.invalid).toHaveLength(1)
      expect(guard.invalid).toEqual([{ id: 1 }])
    })

    it('should have multiple errors for transaction', () => {
      expect(guard.errors).toBeEmpty()

      guard.__pushError({ id: 1 }, 'ERR_INVALID', 'Invalid 1.')
      guard.__pushError({ id: 1 }, 'ERR_INVALID', 'Invalid 2.')

      expect(guard.errors).toBeObject()
      expect(guard.errors['1']).toBeArray()
      expect(guard.errors['1']).toHaveLength(2)
      expect(guard.errors['1']).toEqual([
        { message: 'Invalid 1.', type: 'ERR_INVALID' },
        { message: 'Invalid 2.', type: 'ERR_INVALID' },
      ])
      expect(guard.invalid).toHaveLength(1)
      expect(guard.invalid).toEqual([{ id: 1 }])
    })
  })

  describe('__reset', () => {
    it('should be a function', () => {
      expect(guard.__reset).toBeFunction()
    })

    it('should be ok', () => {
      guard.transactions = [{ id: 1 }]
      guard.accept = [{ id: 2 }]
      guard.excess = [{ id: 3 }]
      guard.invalid = [{ id: 4 }]
      guard.broadcast = [{ id: 5 }]

      expect(guard.transactions).not.toBeEmpty()
      expect(guard.accept).not.toBeEmpty()
      expect(guard.excess).not.toBeEmpty()
      expect(guard.invalid).not.toBeEmpty()
      expect(guard.broadcast).not.toBeEmpty()

      guard.__reset()

      expect(guard.transactions).toBeEmpty()
      expect(guard.accept).toBeEmpty()
      expect(guard.excess).toBeEmpty()
      expect(guard.invalid).toBeEmpty()
      expect(guard.broadcast).toBeEmpty()
    })
  })
})
