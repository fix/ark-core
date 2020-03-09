import "jest-extended";

import { Contracts } from "@packages/core-kernel/src";
import { BlockState } from "@packages/core-state/src/block-state";
import { Wallet } from "@packages/core-state/src/wallets";
import { WalletRepository } from "@packages/core-state/src/wallets";
import { Factories, FactoryBuilder } from "@packages/core-test-framework/src/factories";
import { Utils } from "@packages/crypto/src";
import { ITransaction } from "@packages/crypto/src/interfaces";
import { IBlock } from "@packages/crypto/src/interfaces";

import { addTransactionsToBlock } from "./__utils__/transactions";
import { makeChainedBlocks } from "./__utils__/make-chained-block";
import { makeVoteTransactions } from "./__utils__/make-vote-transactions";
import { setUp, setUpDefaults } from "./setup";

let blockState: BlockState;
let factory: FactoryBuilder;
let blocks: IBlock[];
let walletRepo: WalletRepository;
let forgingWallet: Contracts.State.Wallet;
let votingWallet: Contracts.State.Wallet;
let sendingWallet: Contracts.State.Wallet;
let recipientWallet: Contracts.State.Wallet;
let recipientsDelegate: Contracts.State.Wallet;

let applySpy: jest.SpyInstance;
let revertSpy: jest.SpyInstance;
let spyApplyTransaction: jest.SpyInstance;
let spyRevertTransaction: jest.SpyInstance;
let spyIncreaseWalletDelegateVoteBalance: jest.SpyInstance;
let spyInitGenesisForgerWallet: jest.SpyInstance;
let spyApplyBlockToForger: jest.SpyInstance;
let spyDecreaseWalletDelegateVoteBalance: jest.SpyInstance;
let spyApplyVoteBalances: jest.SpyInstance;
let spyRevertVoteBalances: jest.SpyInstance;
let spyRevertBlockFromForger: jest.SpyInstance;

beforeAll(async () => {
    const initialEnv = await setUp(setUpDefaults, true); // todo: why do I have to skip booting?
    walletRepo = initialEnv.walletRepo;
    blockState = initialEnv.blockState;
    factory = initialEnv.factory;
    applySpy = initialEnv.spies.applySpy;
    revertSpy = initialEnv.spies.revertSpy;
});

beforeEach(() => {
    blocks = makeChainedBlocks(101, factory.get("Block"));

    spyApplyTransaction = jest.spyOn(blockState, "applyTransaction");
    spyRevertTransaction = jest.spyOn(blockState, "revertTransaction");
    spyIncreaseWalletDelegateVoteBalance = jest.spyOn(blockState, "increaseWalletDelegateVoteBalance");
    spyDecreaseWalletDelegateVoteBalance = jest.spyOn(blockState, "decreaseWalletDelegateVoteBalance");
    spyInitGenesisForgerWallet = jest.spyOn(blockState as any, "initGenesisForgerWallet");
    spyApplyBlockToForger = jest.spyOn(blockState as any, "applyBlockToForger");
    spyApplyVoteBalances = jest.spyOn(blockState as any, "applyVoteBalances");
    spyRevertVoteBalances = jest.spyOn(blockState as any, "revertVoteBalances");
    spyRevertBlockFromForger = jest.spyOn(blockState as any, "revertBlockFromForger");

    forgingWallet = walletRepo.findByPublicKey(blocks[0].data.generatorPublicKey);

    forgingWallet.setAttribute("delegate", {
        username: "test",
        forgedFees: Utils.BigNumber.ZERO,
        forgedRewards: Utils.BigNumber.ZERO,
        producedBlocks: 0,
        lastBlock: undefined,
    });

    votingWallet = factory
        .get("Wallet")
        .withOptions({
            passphrase: "testPassphrase1",
            nonce: 0,
        })
        .make();

    sendingWallet = factory
        .get("Wallet")
        .withOptions({
            passphrase: "testPassphrase1",
            nonce: 0,
        })
        .make();

    recipientWallet = factory
        .get("Wallet")
        .withOptions({
            passphrase: "testPassphrase2",
            nonce: 0,
        })
        .make();

    recipientsDelegate = factory
        .get("Wallet")
        .withOptions({
            passphrase: "recipientDelegate",
            nonce: 0,
        })
        .make();

    recipientsDelegate.setAttribute("delegate", {
        username: "test2",
        forgedFees: Utils.BigNumber.ZERO,
        forgedRewards: Utils.BigNumber.ZERO,
        producedBlocks: 0,
        lastBlock: undefined,
    });
    recipientsDelegate.setAttribute("delegate.voteBalance", Utils.BigNumber.ZERO);

    walletRepo.index([votingWallet, forgingWallet, sendingWallet, recipientWallet, recipientsDelegate]);

    addTransactionsToBlock(
        makeVoteTransactions(3, [`+${"03287bfebba4c7881a0509717e71b34b63f31e40021c321f89ae04f84be6d6ac37"}`]),
        blocks[0],
    );
});

afterEach(() => {
    walletRepo.reset();

    jest.clearAllMocks();
    spyApplyTransaction.mockRestore();
    spyRevertTransaction.mockRestore();
});

describe("BlockState", () => {
    it("should apply sequentially the transactions of the block", async () => {
        await blockState.applyBlock(blocks[0]);

        for (let i = 0; i < blocks[0].transactions.length; i++) {
            expect(spyApplyTransaction).toHaveBeenNthCalledWith(i + 1, blocks[0].transactions[i]);
        }
    });

    it("should call the handler for each transaction", async () => {
        await blockState.applyBlock(blocks[0]);

        expect(applySpy).toHaveBeenCalledTimes(blocks[0].transactions.length);
        expect(revertSpy).not.toHaveBeenCalled();
    });

    it("should init foring wallet on genesis block", async () => {
        blocks[0].data.height = 1;
        await blockState.applyBlock(blocks[0]);
        expect(spyInitGenesisForgerWallet).toHaveBeenCalledWith(blocks[0].data.generatorPublicKey);
    });

    describe("voteBalances", () => {
        it("should not update vote balances if wallet hasn't voted", () => {
            const voteBalanceBefore = Utils.BigNumber.ZERO;

            forgingWallet.setAttribute<Utils.BigNumber>("delegate.voteBalance", voteBalanceBefore);

            const voteWeight = Utils.BigNumber.make(5678);

            blockState.increaseWalletDelegateVoteBalance(votingWallet, voteWeight);

            const voteBalanceAfter = forgingWallet.getAttribute<Utils.BigNumber>("delegate.voteBalance");

            expect(voteBalanceAfter).toEqual(voteBalanceBefore);
        });

        it("should update vote balances", () => {
            const voteBalanceBefore = Utils.BigNumber.ZERO;

            forgingWallet.setAttribute<Utils.BigNumber>("delegate.voteBalance", voteBalanceBefore);

            const voteWeight = Utils.BigNumber.make(5678);

            votingWallet.balance = voteWeight;

            votingWallet.setAttribute("vote", forgingWallet.publicKey);

            blockState.increaseWalletDelegateVoteBalance(votingWallet, voteWeight);

            const voteBalanceAfter = forgingWallet.getAttribute<Utils.BigNumber>("delegate.voteBalance");

            expect(voteBalanceAfter).toEqual(voteBalanceBefore.plus(voteWeight));
        });

        it("should not revert vote balances if wallet hasn't voted", () => {
            const voteBalanceBefore = Utils.BigNumber.ZERO;

            forgingWallet.setAttribute<Utils.BigNumber>("delegate.voteBalance", voteBalanceBefore);

            const voteWeight = Utils.BigNumber.make(5678);

            blockState.increaseWalletDelegateVoteBalance(votingWallet, voteWeight);

            const voteBalanceAfter = forgingWallet.getAttribute<Utils.BigNumber>("delegate.voteBalance");

            expect(voteBalanceAfter).toEqual(voteBalanceBefore);
        });

        it("should revert vote balances", () => {
            const voteBalanceBefore = Utils.BigNumber.make(6789);

            forgingWallet.setAttribute<Utils.BigNumber>("delegate.voteBalance", voteBalanceBefore);

            const voteWeight = Utils.BigNumber.make(5678);

            votingWallet.balance = voteWeight;

            votingWallet.setAttribute("vote", forgingWallet.publicKey);

            blockState.decreaseWalletDelegateVoteBalance(votingWallet, voteWeight);

            const voteBalanceAfter = forgingWallet.getAttribute<Utils.BigNumber>("delegate.voteBalance");

            expect(voteBalanceAfter).toEqual(voteBalanceBefore.minus(voteWeight));
        });

        it("should update vote balances for negative votes", async () => {
            const voteAddress = "03287bfebba4c7881a0509717e71b34b63f31e40021c321f89ae04f84be6d6ac37";
            addTransactionsToBlock(makeVoteTransactions(3, [`-${voteAddress}`]), blocks[0]);

            const sendersBalance = Utils.BigNumber.make(1234);
            const testTransaction = blocks[0].transactions[0];

            const sender = walletRepo.findByPublicKey(testTransaction.data.senderPublicKey);
            sender.balance = sendersBalance;

            const votedForDelegate: Contracts.State.Wallet = walletRepo.findByPublicKey(voteAddress);
            const delegateBalanceBefore = Utils.BigNumber.make(4918);
            votedForDelegate.setAttribute("delegate.voteBalance", delegateBalanceBefore);

            await blockState.applyTransaction(testTransaction);

            const delegateBalanceAfterApply = votedForDelegate.getAttribute("delegate.voteBalance");
            expect(delegateBalanceAfterApply).toEqual(
                delegateBalanceBefore.minus(sendersBalance.plus(testTransaction.data.fee)),
            );

            await blockState.revertTransaction(testTransaction);

            expect(votedForDelegate.getAttribute("delegate.voteBalance")).toEqual(
                delegateBalanceAfterApply.plus(sendersBalance),
            );
        });
    });

    it("should create forger wallet if it doesn't exist genesis block", async () => {
        //@ts-ignore
        const spyApplyBlockToForger = jest.spyOn(blockState, "applyBlockToForger");
        spyApplyBlockToForger.mockImplementationOnce(() => {});
        const spyCreateWallet = jest.spyOn(walletRepo, "createWallet");
        blocks[0].data.height = 1;
        blocks[0].data.generatorPublicKey = "03720586a26d8d49ec27059bd4572c49ba474029c3627715380f4df83fb431aece";
        await expect(blockState.applyBlock(blocks[0])).toResolve();
        expect(spyInitGenesisForgerWallet).toHaveBeenCalledWith(blocks[0].data.generatorPublicKey);
        expect(spyCreateWallet).toHaveBeenCalled();
    });

    it("should apply the block data to the forger", async () => {
        const balanceBefore = forgingWallet.balance;

        const reward = Utils.BigNumber.make(50);
        const totalFee = Utils.BigNumber.make(50);
        blocks[0].data.reward = reward;
        blocks[0].data.totalFee = totalFee;
        const balanceIncrease = reward.plus(totalFee);

        await blockState.applyBlock(blocks[0]);

        expect(spyApplyBlockToForger).toHaveBeenCalledWith(forgingWallet, blocks[0].data);
        expect(spyApplyVoteBalances).toHaveBeenCalled();

        expect(spyIncreaseWalletDelegateVoteBalance).toHaveBeenCalledWith(forgingWallet, balanceIncrease);

        const delegateAfter = forgingWallet.getAttribute<Contracts.State.WalletDelegateAttributes>("delegate");
        const productsBlocks = 1;

        expect(delegateAfter.producedBlocks).toEqual(productsBlocks);
        expect(delegateAfter.forgedFees).toEqual(totalFee);
        expect(delegateAfter.forgedRewards).toEqual(reward);
        expect(delegateAfter.lastBlock).toEqual(blocks[0].data);

        expect(forgingWallet.balance).toEqual(balanceBefore.plus(balanceIncrease));
    });

    it("should revert the block data for the forger", async () => {
        const balanceBefore = forgingWallet.balance;

        const reward = Utils.BigNumber.make(52);
        const totalFee = Utils.BigNumber.make(49);
        blocks[0].data.reward = reward;
        blocks[0].data.totalFee = totalFee;
        const balanceIncrease = reward.plus(totalFee);

        await blockState.applyBlock(blocks[0]);

        expect(forgingWallet.balance).toEqual(balanceBefore.plus(balanceIncrease));

        await blockState.revertBlock(blocks[0]);

        expect(spyApplyBlockToForger).toHaveBeenCalledWith(forgingWallet, blocks[0].data);
        expect(spyRevertBlockFromForger).toHaveBeenCalledWith(forgingWallet, blocks[0].data);
        expect(spyIncreaseWalletDelegateVoteBalance).toHaveBeenCalledWith(forgingWallet, balanceIncrease);
        expect(spyDecreaseWalletDelegateVoteBalance).toHaveBeenCalledWith(forgingWallet, balanceIncrease);

        const delegate = forgingWallet.getAttribute<Contracts.State.WalletDelegateAttributes>("delegate");

        expect(delegate.producedBlocks).toEqual(0);
        expect(delegate.forgedFees).toEqual(Utils.BigNumber.ZERO);
        expect(delegate.forgedRewards).toEqual(Utils.BigNumber.ZERO);
        expect(delegate.lastBlock).toEqual(undefined);

        expect(forgingWallet.balance).toEqual(balanceBefore);
    });

    it("should throw if there is no forger wallet", () => {
        walletRepo.forgetByPublicKey(forgingWallet.publicKey);
        expect(async () => await blockState.applyBlock(blocks[0])).toReject();
    });

    it("should update sender's and recipient's delegate's vote balance when applying transaction", async () => {
        const sendersDelegate = forgingWallet;
        sendersDelegate.setAttribute("delegate.voteBalance", Utils.BigNumber.ZERO);

        const senderDelegateBefore = sendersDelegate.getAttribute("delegate.voteBalance");

        const amount: Utils.BigNumber = Utils.BigNumber.make(2345);
        sendingWallet.balance = amount;

        const recipientsDelegateBefore: Utils.BigNumber = recipientsDelegate.getAttribute("delegate.voteBalance");

        sendingWallet.setAttribute("vote", sendersDelegate.publicKey);
        recipientWallet.setAttribute("vote", recipientsDelegate.publicKey);

        walletRepo.index([sendersDelegate, recipientsDelegate, sendingWallet, recipientWallet]);

        const transferTransaction = factory
            .get("Transfer")
            .withOptions({ amount, senderPublicKey: sendingWallet.publicKey, recipientId: recipientWallet.address })
            .make();

        // @ts-ignore
        const total: Utils.BigNumber = transferTransaction.data.amount.plus(transferTransaction.data.fee);
        // @ts-ignore
        await blockState.applyTransaction(transferTransaction);

        expect(recipientsDelegate.getAttribute("delegate.voteBalance")).toEqual(recipientsDelegateBefore.plus(amount));
        expect(sendersDelegate.getAttribute("delegate.voteBalance")).toEqual(senderDelegateBefore.minus(total));
    });

    it("should update sender's and recipient's delegate's vote balance when reverting transaction", async () => {
        const sendersDelegate = forgingWallet;
        sendersDelegate.setAttribute("delegate.voteBalance", Utils.BigNumber.ZERO);

        const senderDelegateBefore = sendersDelegate.getAttribute("delegate.voteBalance");

        const sendingWallet: Wallet = factory
            .get("Wallet")
            .withOptions({
                passphrase: "testPassphrase1",
                nonce: 0,
            })
            .make();

        const amount: Utils.BigNumber = Utils.BigNumber.make(2345);
        sendingWallet.balance = amount;

        const recipientDelegateBefore = recipientsDelegate.getAttribute("delegate.voteBalance");

        sendingWallet.setAttribute("vote", sendersDelegate.publicKey);
        recipientWallet.setAttribute("vote", recipientsDelegate.publicKey);

        walletRepo.index([sendersDelegate, recipientsDelegate, sendingWallet, recipientWallet]);

        const transferTransaction = factory
            .get("Transfer")
            .withOptions({ amount, senderPublicKey: sendingWallet.publicKey, recipientId: recipientWallet.address })
            .make();

        // @ts-ignore
        const total: Utils.BigNumber = transferTransaction.data.amount.plus(transferTransaction.data.fee);
        // @ts-ignore
        await blockState.revertTransaction(transferTransaction);

        expect(recipientsDelegate.getAttribute("delegate.voteBalance")).toEqual(recipientDelegateBefore.minus(amount));
        expect(sendersDelegate.getAttribute("delegate.voteBalance")).toEqual(senderDelegateBefore.plus(total));
    });

    it("should update delegates vote balance for multiPayments", async () => {
        const sendersDelegate = forgingWallet;
        sendersDelegate.setAttribute("delegate.voteBalance", Utils.BigNumber.ZERO);
        const senderDelegateBefore = sendersDelegate.getAttribute("delegate.voteBalance");

        const sendingWallet: Wallet = factory
            .get("Wallet")
            .withOptions({
                passphrase: "testPassphrase1",
                nonce: 0,
            })
            .make();

        const amount: Utils.BigNumber = Utils.BigNumber.make(2345);

        const multiPaymentTransaction: ITransaction = factory
            .get("MultiPayment")
            .withOptions({ amount, senderPublicKey: sendingWallet.publicKey, recipientId: recipientWallet.address })
            .make();

        // @ts-ignore
        multiPaymentTransaction.data.asset.payments = [
            {
                // @ts-ignore
                amount: [amount],
                recipientId: "D5T4Cjx7khYbwaaCLmi7j3cUdt4GVWqKkG",
            },
            {
                // @ts-ignore
                amount: [amount],
                recipientId: "D5T4Cjx7khYbwaaCLmi7j3cUdt4GVWqKkG",
            },
        ];

        const recipientsDelegateBefore = recipientsDelegate.getAttribute("delegate.voteBalance");

        sendingWallet.setAttribute("vote", sendersDelegate.publicKey);
        recipientWallet.setAttribute("vote", recipientsDelegate.publicKey);
        walletRepo.index([sendersDelegate, recipientsDelegate, sendingWallet, recipientWallet]);

        await blockState.applyTransaction(multiPaymentTransaction);

        expect(recipientsDelegate.getAttribute("delegate.voteBalance")).toEqual(
            recipientsDelegateBefore.plus(amount).times(2),
        );
        expect(sendersDelegate.getAttribute("delegate.voteBalance")).toEqual(
            senderDelegateBefore.minus(amount.times(2).plus(multiPaymentTransaction.data.fee)),
        );

        await blockState.revertTransaction(multiPaymentTransaction);

        expect(recipientsDelegate.getAttribute("delegate.voteBalance")).toEqual(Utils.BigNumber.ZERO);
        expect(sendersDelegate.getAttribute("delegate.voteBalance")).toEqual(Utils.BigNumber.ZERO);
    });

    describe("apply and revert transactions", () => {
        const factory = new FactoryBuilder();

        Factories.registerTransactionFactory(factory);
        Factories.registerWalletFactory(factory);

        const sender: any = factory
            .get("Wallet")
            .withOptions({
                passphrase: "testPassphrase1",
                nonce: 0,
            })
            .make();

        const recipientWallet: any = factory
            .get("Wallet")
            .withOptions({
                passphrase: "testPassphrase2",
            })
            .make();

        const transfer = factory
            .get("Transfer")
            .withOptions({ amount: 96579, senderPublicKey: sender.publicKey, recipientId: recipientWallet.address })
            .make();

        const delegateReg = factory
            .get("DelegateRegistration")
            .withOptions({ username: "dummy", senderPublicKey: sender.publicKey, recipientId: recipientWallet.address })
            .make()
            // @ts-ignore
            .sign("delegatePassphrase")
            .build();

        const secondSign = factory
            .get("Transfer")
            .withOptions({ amount: 10000000, senderPublicKey: sender.publicKey, recipientId: recipientWallet.address })
            .make();

        const vote = factory
            .get("Vote")
            .withOptions({
                publicKey: recipientWallet.publicKey,
                senderPublicKey: sender.publicKey,
                recipientId: recipientWallet.address,
            })
            .make();

        const delegateRes = factory
            .get("DelegateResignation")
            .withOptions({ username: "dummy", senderPublicKey: sender.publicKey, recipientId: recipientWallet.address })
            .make()
            // @ts-ignore
            .sign("delegatePassphrase")
            .build();

        const ipfs = factory
            .get("Ipfs")
            .withOptions({ senderPublicKey: sender.publicKey, recipientId: recipientWallet.address })
            .make();

        const htlcLock = factory
            .get("HtlcLock")
            .withOptions({ senderPublicKey: sender.publicKey, recipientId: recipientWallet.address })
            .make();

        const htlcRefund = factory
            .get("HtlcRefund")
            .withOptions({
                secretHash: "secretHash",
                senderPublicKey: sender.publicKey,
                recipientId: recipientWallet.address,
            })
            .make();

        describe.each`
            type                      | transaction
            ${"transfer"}             | ${transfer}
            ${"delegateRegistration"} | ${delegateReg}
            ${"2nd sign"}             | ${secondSign}
            ${"vote"}                 | ${vote}
            ${"delegateResignation"}  | ${delegateRes}
            ${"ipfs"}                 | ${ipfs}
            ${"htlcLock"}             | ${htlcLock}
            ${"htlcRefund"}           | ${htlcRefund}
        `("when the transaction is a $type", ({ transaction }) => {
            it("should call the transaction handler apply the transaction to the sender & recipient", async () => {
                await blockState.applyTransaction(transaction);

                expect(applySpy).toHaveBeenCalledWith(transaction);
            });

            it("should call be able to revert the transaction", async () => {
                await blockState.revertTransaction(transaction);

                expect(revertSpy).toHaveBeenCalledWith(transaction);
            });
        });

        describe("htlc lock transaction", () => {
            let htlcClaimTransaction: ITransaction;
            let lockData;
            let lockID;

            beforeEach(() => {
                const amount = Utils.BigNumber.make(2345);
                htlcClaimTransaction = factory
                    .get("HtlcClaim")
                    .withOptions({
                        amount,
                        senderPublicKey: sender.publicKey,
                        recipientId: recipientWallet.address,
                    })
                    .make();

                // TODO: Why do these need to be set manually here?
                // @ts-ignore
                htlcClaimTransaction.typeGroup = htlcClaimTransaction.data.typeGroup;
                // @ts-ignore
                htlcClaimTransaction.type = htlcClaimTransaction.data.type;
                htlcClaimTransaction.data.recipientId = recipientWallet.address;

                sender.setAttribute("htlc.lockedBalance", Utils.BigNumber.make(amount));

                lockData = {
                    amount: amount,
                    recipientId: recipientWallet.address,
                    ...htlcClaimTransaction.data.asset!.lock,
                };

                lockID = htlcClaimTransaction.data.asset.claim.lockTransactionId;

                sender.setAttribute("htlc.locks", {
                    [lockID]: lockData,
                });

                walletRepo.index(sender);
                walletRepo.index(recipientWallet);
            });

            it("apply should find correct locks, sender and recipient wallets", async () => {
                await blockState.applyTransaction(htlcClaimTransaction);
                expect(applySpy).toHaveBeenCalledWith(htlcClaimTransaction);
                expect(spyApplyVoteBalances).toHaveBeenCalledWith(
                    sender,
                    recipientWallet,
                    htlcClaimTransaction.data,
                    walletRepo.findByIndex(Contracts.State.WalletIndexes.Locks, lockID),
                    lockData,
                );
            });

            it("revert should find correct locks, sender and recipient wallets", async () => {
                await blockState.revertTransaction(htlcClaimTransaction);
                expect(revertSpy).toHaveBeenCalledWith(htlcClaimTransaction);
                expect(spyRevertVoteBalances).toHaveBeenCalledWith(
                    sender,
                    recipientWallet,
                    htlcClaimTransaction.data,
                    walletRepo.findByIndex(Contracts.State.WalletIndexes.Locks, lockID),
                    lockData,
                );
            });

            it("update vote balances for claims transactions", async () => {
                const recipientsDelegate = walletRepo.findByPublicKey(
                    "32337416a26d8d49ec27059bd0589c49bb474029c3627715380f4df83fb431aece",
                );
                sender.setAttribute("vote", forgingWallet.publicKey);
                recipientWallet.setAttribute("vote", recipientsDelegate.publicKey);

                await blockState.applyTransaction(htlcClaimTransaction);

                expect(recipientsDelegate.getAttribute("delegate.voteBalance")).toEqual(
                    htlcClaimTransaction.data.amount,
                );
                expect(forgingWallet.getAttribute("delegate.voteBalance")).toEqual(htlcClaimTransaction.data.amount);

                await blockState.revertTransaction(htlcClaimTransaction);

                expect(recipientsDelegate.getAttribute("delegate.voteBalance")).toEqual(Utils.BigNumber.ZERO);
                expect(forgingWallet.getAttribute("delegate.voteBalance")).toEqual(Utils.BigNumber.ZERO);
            });

            it("should update vote balances for lock transactions", async () => {
                sender.setAttribute("vote", forgingWallet.publicKey);
                const forgingWalletBefore = Utils.BigNumber.ZERO;
                forgingWallet.setAttribute("delegate.voteBalance", forgingWalletBefore);

                const htlcLock: ITransaction = factory
                    .get("HtlcLock")
                    .withOptions({ senderPublicKey: sender.publicKey, recipientId: recipientWallet.address })
                    .make();

                await blockState.applyTransaction(htlcLock);

                const delegateBalanceAfterApply = forgingWallet.getAttribute("delegate.voteBalance");

                expect(delegateBalanceAfterApply).toEqual(forgingWalletBefore.minus(htlcLock.data.fee));

                await blockState.revertTransaction(htlcLock);

                expect(forgingWallet.getAttribute("delegate.voteBalance")).toEqual(Utils.BigNumber.ZERO);
            });
        });
    });

    describe("when 1 transaction fails while reverting it", () => {
        it("should apply sequentially (from first to last) all the reverted transactions of the block", async () => {
            // @ts-ignore
            spyRevertTransaction.mockImplementation(tx => {
                if (tx === blocks[0].transactions[0]) {
                    throw new Error("Fake error");
                }
            });

            expect(blocks[0].transactions.length).toBe(3);
            await expect(blockState.revertBlock(blocks[0])).rejects.toEqual(Error("Fake error"));

            expect(spyApplyTransaction).toHaveBeenCalledTimes(2);
            expect(applySpy).toHaveBeenCalledTimes(2);

            let counter = 1;
            for (const transaction of blocks[0].transactions.slice(1)) {
                expect(spyApplyTransaction).toHaveBeenNthCalledWith(counter++, transaction);
            }
        });

        it("throws the Error", async () => {
            spyRevertTransaction.mockImplementationOnce(() => {
                throw new Error("Fake error");
            });
            await expect(blockState.revertBlock(blocks[0])).rejects.toEqual(Error("Fake error"));
        });
    });

    describe("when 1 transaction fails while applying it", () => {
        it("should revert sequentially (from last to first) all the transactions of the block", async () => {
            // @ts-ignore
            spyApplyTransaction.mockImplementation(tx => {
                if (tx === blocks[0].transactions[2]) {
                    throw new Error("Fake error");
                }
            });

            expect(blocks[0].transactions.length).toBe(3);
            await expect(blockState.applyBlock(blocks[0])).rejects.toEqual(Error("Fake error"));

            expect(spyRevertTransaction).toHaveBeenCalledTimes(2);
            expect(revertSpy).toHaveBeenCalledTimes(2);

            for (const transaction of blocks[0].transactions.slice(0, 1)) {
                const i = blocks[0].transactions.slice(0, 1).indexOf(transaction);
                const total = blocks[0].transactions.slice(0, 1).length;
                expect(spyRevertTransaction).toHaveBeenNthCalledWith(total + 1 - i, blocks[0].transactions[i]);
            }
        });

        it("throws the Error", async () => {
            spyApplyTransaction.mockImplementationOnce(() => {
                throw new Error("Fake error");
            });
            await expect(blockState.applyBlock(blocks[0])).rejects.toEqual(Error("Fake error"));
        });
    });
});
