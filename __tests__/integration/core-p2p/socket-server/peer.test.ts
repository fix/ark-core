import "jest-extended";
import "../mocks/core-container";

import { Blocks, Managers } from "@arkecosystem/crypto/src";
import delay from "delay";
import socketCluster from "socketcluster-client";
import { startSocketServer } from "../../../../packages/core-p2p/src/socket-server";
import { createPeerService } from "../../../helpers/peers";
import { TransactionFactory } from "../../../helpers/transaction-factory";
import { genesisBlock } from "../../../utils/config/unitnet/genesisBlock";
import { wallets } from "../../../utils/fixtures/unitnet/wallets";

Managers.configManager.setFromPreset("unitnet");

let socket;
let emit;

const headers = {
    version: "2.1.0",
    port: "4009",
    nethash: "a63b5a3858afbca23edefac885be74d59f1a26985548a4082f4f479e74fcc348",
    height: 1,
    "Content-Type": "application/json",
};

beforeAll(async () => {
    process.env.CORE_ENV = "test";

    const { service, processor } = createPeerService();

    await startSocketServer(service, { server: { port: 4007 }, rateLimit: 32 });
    await delay(3000);

    socket = socketCluster.create({
        port: 4007,
        hostname: "127.0.0.1",
    });

    emit = (event, data) =>
        new Promise((resolve, reject) => {
            socket.emit(event, data, (err, res) => (err ? reject(err) : resolve(res)));
        });

    jest.spyOn(processor, "validateAndAcceptPeer").mockImplementation(jest.fn());
});

afterAll(() => {
    socket.destroy();
});

describe("Peer socket endpoint", () => {
    describe("socket endpoints", () => {
        it("should getPeers", async () => {
            const { peers } = await emit("p2p.peer.getPeers", {
                headers,
            });

            expect(peers).toBeArray();
        });

        it("should getStatus", async () => {
            const { success, height } = await emit("p2p.peer.getStatus", {
                headers,
            });
            expect(success).toBeTrue();
            expect(height).toBe(1);
        });

        describe("postBlock", () => {
            it("should postBlock successfully", async () => {
                const { success } = await emit("p2p.peer.postBlock", {
                    data: { block: Blocks.Block.fromData(genesisBlock).toJson() },
                    headers,
                });

                expect(success).toBeTrue();
            });

            it("should throw validation error when sending wrong data", async () => {
                await expect(
                    emit("p2p.peer.postBlock", {
                        data: {},
                        headers,
                    }),
                ).rejects.toHaveProperty("name", "CoreValidationError");
            });
        });

        describe("postTransactions", () => {
            it("should get back 'transaction list is not conform' error when transactions are invalid (already in cache)", async () => {
                const transactions = TransactionFactory.transfer(wallets[0].address, 111)
                    .withNetwork("unitnet")
                    .withPassphrase("one two three")
                    .create(15);

                const data = await emit("p2p.peer.postTransactions", {
                    data: { transactions },
                    headers,
                });

                expect(data).toEqual({
                    error: "Transactions list is not conform",
                    message: "Transactions list is not conform",
                    success: false,
                });

                // because our mocking makes all transactions to be invalid (already in cache)
            });

            it("should throw validation error when sending too much transactions", async () => {
                const transactions = TransactionFactory.transfer(wallets[0].address, 111)
                    .withNetwork("unitnet")
                    .withPassphrase("one two three")
                    .create(50);

                await expect(
                    emit("p2p.peer.postTransactions", {
                        data: { transactions },
                        headers,
                    }),
                ).rejects.toHaveProperty("name", "CoreValidationError");
            });
        });
    });

    describe("Socket errors", () => {
        it("should send back an error if no data.headers", async () => {
            try {
                await emit("p2p.peer.getPeers", {});
            } catch (e) {
                expect(e.name).toEqual("CoreHeadersRequiredError");
                expect(e.message).toEqual("Request data and data.headers is mandatory");
            }
        });

        it("should not be disconnected / banned when below rate limit", async () => {
            await delay(1100);

            for (let i = 0; i < 30; i++) {
                const { success } = await emit("p2p.peer.getStatus", {
                    headers,
                });
                expect(success).toBeTrue();
            }

            await delay(1100);

            for (let i = 0; i < 10; i++) {
                const { success } = await emit("p2p.peer.getStatus", {
                    headers,
                });
                expect(success).toBeTrue();
            }
        });

        it("should be disconnected and banned when exceeding rate limit", async () => {
            const onSocketError = jest.fn();
            socket.on("error", onSocketError);

            await delay(1100);

            for (let i = 0; i < 31; i++) {
                const { success } = await emit("p2p.peer.getStatus", {
                    headers,
                });
                expect(success).toBeTrue();
            }

            // 32nd call, should throw CoreRateLimitExceededError
            await expect(
                emit("p2p.peer.postBlock", {
                    data: { block: Blocks.Block.fromData(genesisBlock).toJson() },
                    headers,
                }),
            ).rejects.toHaveProperty("name", "CoreRateLimitExceededError");

            // wait a bit for socket to be disconnected
            await delay(500);

            expect(onSocketError).toHaveBeenCalled();
            expect(socket.getState()).toBe("closed");
        });
    });
});
