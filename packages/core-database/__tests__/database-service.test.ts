import { Container, Database, EventEmitter } from "@arkecosystem/core-interfaces";
import { Bignum, constants, models, transactionBuilder } from "@arkecosystem/crypto";
import "jest-extended";
import { WalletManager } from "../src";
import { DatabaseService } from "../src/database-service";
import { DatabaseConnectionStub } from "./__fixtures__/database-connection-stub";
import { StateStorageStub } from "./__fixtures__/state-storage-stub";
import { setUp, tearDown } from "./__support__/setup";

const { Block, Transaction, Wallet } = models;

const { SATOSHI, TransactionTypes } = constants;

let connection: Database.IDatabaseConnection;
let databaseService: DatabaseService;
let walletManager: Database.IWalletManager;
let genesisBlock: models.Block;
let container: Container.IContainer;
let emitter: EventEmitter.EventEmitter;

beforeAll(async () => {
    container = await setUp();
    emitter = container.resolvePlugin<EventEmitter.EventEmitter>("event-emitter");
    genesisBlock = new Block(require("@arkecosystem/core-test-utils/src/config/testnet/genesisBlock.json"));
    connection = new DatabaseConnectionStub();
    walletManager = new WalletManager();
});

afterAll(async () => {
    await tearDown();
});

beforeEach(() => {
    jest.restoreAllMocks();
});

function createService() {
    return new DatabaseService({}, connection, walletManager, null, null, null, null);
}

describe("Database Service", () => {
    it("should listen for emitter events during constructor", () => {
        jest.spyOn(emitter, "on");
        jest.spyOn(emitter, "once");

        databaseService = createService();

        expect(emitter.on).toHaveBeenCalledWith("state:started", expect.toBeFunction());
        expect(emitter.on).toHaveBeenCalledWith("wallet.created.cold", expect.toBeFunction());
        expect(emitter.once).toHaveBeenCalledWith("shutdown", expect.toBeFunction());
    });

    describe("applyBlock", () => {
        it("should applyBlock", async () => {
            jest.spyOn(walletManager, "applyBlock").mockImplementation(block => block);
            jest.spyOn(emitter, "emit");

            databaseService = createService();
            jest.spyOn(databaseService, "applyRound").mockImplementation(() => null); // test applyRound logic separately

            await databaseService.applyBlock(genesisBlock);

            expect(walletManager.applyBlock).toHaveBeenCalledWith(genesisBlock);
            expect(emitter.emit).toHaveBeenCalledWith("block.applied", genesisBlock.data);
            genesisBlock.transactions.forEach(tx =>
                expect(emitter.emit).toHaveBeenCalledWith("transaction.applied", tx.data),
            );
        });
    });

    describe("getBlocksByHeight", () => {
        it("should deliver blocks for the given heights", async () => {
            const requestHeightsLow = [1, 5, 20];
            const requestHeightsHigh = [100, 200, 500];
            const stateStorageStub = new StateStorageStub();
            // @ts-ignore
            jest.spyOn(stateStorageStub, "getLastBlocksByHeight").mockImplementation((heightFrom, heightTo) => {
                if (requestHeightsHigh[0] <= heightFrom) {
                    return [{ height: heightFrom, fromState: true }];
                }
                return undefined;
            });
            jest.spyOn(container, "has").mockReturnValue(true);
            jest.spyOn(container, "resolve").mockReturnValue(stateStorageStub);

            databaseService = createService();

            connection.blocksRepository = {
                findByHeight: heights => heights.map(h => ({ height: Number(h), fromDb: true })),
            } as Database.IBlocksRepository;

            let requestHeights = requestHeightsHigh;

            let blocks = await databaseService.getBlocksByHeight(requestHeights);

            expect(stateStorageStub.getLastBlocksByHeight).toHaveBeenCalled();
            expect(blocks).toBeArray();
            expect(blocks.length).toBe(requestHeights.length);
            for (let i = 0; i < requestHeights.length; i++) {
                expect(blocks[i].height).toBe(requestHeights[i]);
                expect(blocks[i].fromState).toBe(true);
            }

            requestHeights = [...requestHeightsLow, ...requestHeightsHigh];

            blocks = await databaseService.getBlocksByHeight(requestHeights);

            expect(stateStorageStub.getLastBlocksByHeight).toHaveBeenCalled();
            expect(blocks).toBeArray();
            expect(blocks.length).toBe(requestHeights.length);
            for (let i = 0; i < requestHeights.length; i++) {
                expect(blocks[i].height).toBe(requestHeights[i]);
                if (requestHeightsHigh.includes(requestHeights[i])) {
                    expect(blocks[i].fromState).toBe(true);
                } else {
                    expect(blocks[i].fromDb).toBe(true);
                }
            }

            jest.spyOn(container, "has").mockReturnValue(false);

            blocks = await databaseService.getBlocksByHeight(requestHeights);

            expect(blocks).toBeArray();
            expect(blocks.length).toBe(requestHeights.length);
            for (let i = 0; i < requestHeights.length; i++) {
                expect(blocks[i].height).toBe(requestHeights[i]);
                expect(blocks[i].fromDb).toBe(true);
            }
        });
    });

    describe("getBlocksForRound", () => {
        it("should fetch blocks using lastBlock in state-storage", async () => {
            const stateStorageStub = new StateStorageStub();
            jest.spyOn(stateStorageStub, "getLastBlock").mockReturnValue(null);
            jest.spyOn(container, "has").mockReturnValue(true);
            jest.spyOn(container, "resolve").mockReturnValue(stateStorageStub);

            databaseService = createService();
            jest.spyOn(databaseService, "getLastBlock").mockReturnValue(null);

            const blocks = await databaseService.getBlocksForRound();

            expect(blocks).toBeEmpty();
            expect(stateStorageStub.getLastBlock).toHaveBeenCalled();
            expect(databaseService.getLastBlock).not.toHaveBeenCalled();
        });

        it("should fetch blocks using lastBlock in database", async () => {
            jest.spyOn(container, "has").mockReturnValue(false);

            databaseService = createService();
            jest.spyOn(databaseService, "getLastBlock").mockReturnValue(null);

            const blocks = await databaseService.getBlocksForRound();

            expect(blocks).toBeEmpty();
            expect(databaseService.getLastBlock).toHaveBeenCalled();
        });

        it("should fetch blocks from lastBlock height", async () => {
            databaseService = createService();

            // @ts-ignore
            jest.spyOn(databaseService, "getLastBlock").mockReturnValue(genesisBlock);
            // @ts-ignore
            jest.spyOn(databaseService, "getBlocks").mockReturnValue([]);
            jest.spyOn(container, "has").mockReturnValue(false);

            const blocks = await databaseService.getBlocksForRound();

            expect(blocks).toBeEmpty();
            expect(databaseService.getBlocks).toHaveBeenCalledWith(
                1,
                container.getConfig().getMilestone(genesisBlock.data.height).activeDelegates,
            );
        });
    });

    /* TODO: Testing a method that's private. This needs a replacement by testing a public method instead */

    describe("calcPreviousActiveDelegates", () => {
        it("should calculate the previous delegate list", async () => {
            walletManager = new WalletManager();
            const initialHeight = 52;

            // Create delegates
            for (const transaction of genesisBlock.transactions) {
                if (transaction.type === TransactionTypes.DelegateRegistration) {
                    const wallet = walletManager.findByPublicKey(transaction.data.senderPublicKey);
                    wallet.username = Transaction.fromBytes(transaction.serialized).data.asset.delegate.username;
                    walletManager.reindex(wallet);
                }
            }

            const keys = {
                passphrase: "this is a secret passphrase",
                publicKey: "02c71ab1a1b5b7c278145382eb0b535249483b3c4715a4fe6169d40388bbb09fa7",
                privateKey: "dcf4ead2355090279aefba91540f32e93b15c541ecb48ca73071f161b4f3e2e3",
                address: "D64cbDctaiADEH7NREnvRQGV27bnb1v2kE",
            };

            // Beginning of round 2 with all delegates 0 vote balance.
            const delegatesRound2 = walletManager.loadActiveDelegateList(51, initialHeight);

            // Prepare sender wallet
            const sender = new Wallet(keys.address);
            sender.publicKey = keys.publicKey;
            sender.canApply = jest.fn(() => true);
            walletManager.reindex(sender);

            // Apply 51 blocks, where each increases the vote balance of a delegate to
            // reverse the current delegate order.
            const blocksInRound = [];
            for (let i = 0; i < 51; i++) {
                const transfer = transactionBuilder
                    .transfer()
                    .amount((i + 1) * SATOSHI)
                    .recipientId(delegatesRound2[i].address)
                    .sign(keys.passphrase)
                    .build();

                // Vote for itself
                walletManager.findByPublicKey(delegatesRound2[i].publicKey).vote = delegatesRound2[i].publicKey;
                // walletManager.byPublicKey[delegatesRound2[i].publicKey].vote = delegatesRound2[i].publicKey;

                const block = Block.create(
                    {
                        version: 0,
                        timestamp: 0,
                        height: initialHeight + i,
                        numberOfTransactions: 1,
                        totalAmount: transfer.data.amount,
                        totalFee: new Bignum(0.1),
                        reward: new Bignum(2),
                        payloadLength: 0,
                        payloadHash: "a".repeat(64),
                        transactions: [transfer.data],
                    },
                    keys,
                );

                block.data.generatorPublicKey = keys.publicKey;
                walletManager.applyBlock(block);

                blocksInRound.push(block);
            }

            // The delegates from round 2 are now reversed in rank in round 3.
            const delegatesRound3 = walletManager.loadActiveDelegateList(51, initialHeight + 51);
            for (let i = 0; i < delegatesRound3.length; i++) {
                expect(delegatesRound3[i].rate).toBe(i + 1);
                expect(delegatesRound3[i].publicKey).toBe(delegatesRound2[delegatesRound3.length - i - 1].publicKey);
            }

            // @ts-ignore
            jest.spyOn(databaseService, "getBlocksForRound").mockReturnValue(blocksInRound);
            databaseService.walletManager = walletManager;

            // Necessary for revertRound to not blow up.
            // @ts-ignore
            walletManager.allByUsername = jest.fn(() => {
                const usernames = Object.values((walletManager as any).byUsername);
                usernames.push(sender);
                return usernames;
            });

            // Finally recalculate the round 2 list and compare against the original list
            const restoredDelegatesRound2 = await (databaseService as any).calcPreviousActiveDelegates(2);

            for (let i = 0; i < restoredDelegatesRound2.length; i++) {
                expect(restoredDelegatesRound2[i].rate).toBe(i + 1);
                expect(restoredDelegatesRound2[i].publicKey).toBe(delegatesRound2[i].publicKey);
            }
        });
    });
});
