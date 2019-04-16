import { Crypto, Interfaces, Transactions } from "@arkecosystem/crypto";
import { ITransactionData } from "@arkecosystem/crypto/dist/interfaces";
import { generateMnemonic } from "bip39";
import Boom from "boom";
import { IWallet } from "../interfaces";
import { database } from "./services/database";
import { network } from "./services/network";
import { decryptWIF, getBIP38Wallet } from "./utils";

export const blocks = [
    {
        name: "blocks.info",
        async method(params) {
            const response = await network.sendRequest({ url: `blocks/${params.id}` });

            if (!response) {
                return Boom.notFound(`Block ${params.id} could not be found.`);
            }

            return response.data;
        },
        schema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    minLength: 64,
                    maxLength: 64,
                },
            },
            required: ["id"],
        },
    },
    {
        name: "blocks.latest",
        async method() {
            const response = await network.sendRequest({
                url: "blocks",
                query: { orderBy: "height:desc", limit: 1 },
            });

            return response ? response.data[0] : Boom.notFound(`Latest block could not be found.`);
        },
    },
    {
        name: "blocks.transactions",
        async method(params) {
            const response = await network.sendRequest({
                url: `blocks/${params.id}/transactions`,
                query: {
                    offset: params.offset,
                    orderBy: "timestamp:desc",
                },
            });

            if (!response) {
                return Boom.notFound(`Block ${params.id} could not be found.`);
            }

            return {
                count: response.meta.totalCount,
                data: response.data,
            };
        },
        schema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    minLength: 64,
                    maxLength: 64,
                },
                offset: {
                    type: "number",
                    default: 0,
                },
            },
            required: ["id"],
        },
    },
];

export const transactions = [
    {
        name: "transactions.broadcast",
        async method(params) {
            const transaction: ITransactionData = await database.get<ITransactionData>(params.id);

            if (!transaction) {
                return Boom.notFound(`Transaction ${params.id} could not be found.`);
            }

            if (!Crypto.crypto.verify(transaction)) {
                return Boom.badData();
            }

            await network.broadcast(transaction);

            return transaction;
        },
        schema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    $ref: "transactionId",
                },
            },
            required: ["id"],
        },
    },
    {
        name: "transactions.create",
        async method(params) {
            const transactionBuilder = Transactions.BuilderFactory.transfer()
                .recipientId(params.recipientId)
                .amount(params.amount);

            if (params.vendorField) {
                transactionBuilder.vendorField(params.vendorField);
            }

            const transaction: Interfaces.ITransactionData = transactionBuilder.sign(params.passphrase).getStruct();

            if (!transactionBuilder.verify()) {
                return Boom.badRequest("Failed to verify the transaction.");
            }

            await database.set(transaction.id, transaction);

            return transaction;
        },
        schema: {
            type: "object",
            properties: {
                amount: {
                    type: "number",
                },
                recipientId: {
                    type: "string",
                    $ref: "address",
                },
                passphrase: {
                    type: "string",
                },
                vendorField: {
                    type: "string",
                },
            },
            required: ["amount", "recipientId", "passphrase"],
        },
    },
    {
        name: "transactions.info",
        async method(params) {
            const response = await network.sendRequest({ url: `transactions/${params.id}` });

            if (!response) {
                return Boom.notFound(`Transaction ${params.id} could not be found.`);
            }

            return response.data;
        },
        schema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    $ref: "address",
                },
            },
            required: ["id"],
        },
    },
    {
        name: "transactions.bip38.create",
        async method(params) {
            const wallet: IWallet = await getBIP38Wallet(params.userId, params.bip38);

            if (!wallet) {
                return Boom.notFound(`User ${params.userId} could not be found.`);
            }

            const transactionBuilder = Transactions.BuilderFactory.transfer()
                .recipientId(params.recipientId)
                .amount(params.amount);

            if (params.vendorField) {
                transactionBuilder.vendorField(params.vendorField);
            }

            const transaction: Interfaces.ITransactionData = transactionBuilder.signWithWif(wallet.wif).getStruct();

            if (!transactionBuilder.verify()) {
                return Boom.badRequest("Failed to verify the transaction.");
            }

            await database.set(transaction.id, transaction);

            return transaction;
        },
        schema: {
            type: "object",
            properties: {
                amount: {
                    type: "number",
                },
                recipientId: {
                    type: "string",
                    $ref: "address",
                },
                vendorField: {
                    type: "string",
                },
                bip38: {
                    type: "string",
                },
                userId: {
                    type: "string",
                    $ref: "hex",
                },
            },
            required: ["amount", "recipientId", "bip38", "userId"],
        },
    },
];

export const wallets = [
    {
        name: "wallets.create",
        async method(params) {
            const { publicKey }: Interfaces.IKeyPair = Crypto.crypto.getKeys(params.passphrase);

            return {
                publicKey,
                address: Crypto.crypto.getAddress(publicKey),
            };
        },
        schema: {
            type: "object",
            properties: {
                passphrase: {
                    type: "string",
                },
            },
            required: ["passphrase"],
        },
    },
    {
        name: "wallets.info",
        async method(params) {
            const response = await network.sendRequest({ url: `wallets/${params.address}` });

            if (!response) {
                return Boom.notFound(`Wallet ${params.address} could not be found.`);
            }

            return response.data;
        },
        schema: {
            type: "object",
            properties: {
                address: {
                    type: "string",
                    $ref: "address",
                },
            },
            required: ["address"],
        },
    },
    {
        name: "wallets.transactions",
        async method(params) {
            const response = await network.sendRequest({
                url: "transactions",
                query: {
                    offset: params.offset || 0,
                    orderBy: "timestamp:desc",
                    ownerId: params.address,
                },
            });

            if (!response.data || !response.data.length) {
                return Boom.notFound(`Wallet ${params.address} could not be found.`);
            }

            return {
                count: response.meta.totalCount,
                data: response.data,
            };
        },
        schema: {
            type: "object",
            properties: {
                address: {
                    type: "string",
                    $ref: "address",
                },
                userId: {
                    type: "integer",
                    default: 0,
                },
            },
            required: ["address"],
        },
    },
    {
        name: "wallets.bip38.create",
        async method(params) {
            try {
                const { keys, wif }: IWallet = await getBIP38Wallet(params.userId, params.bip38);

                return {
                    publicKey: keys.publicKey,
                    address: Crypto.crypto.getAddress(keys.publicKey),
                    wif,
                };
            } catch (error) {
                const { publicKey, privateKey }: Interfaces.IKeyPair = Crypto.crypto.getKeys(generateMnemonic());

                const encryptedWIF: string = Crypto.bip38.encrypt(
                    Buffer.from(privateKey, "hex"),
                    true,
                    params.bip38 + params.userId,
                );

                await database.set(
                    Crypto.HashAlgorithms.sha256(Buffer.from(params.userId)).toString("hex"),
                    encryptedWIF,
                );

                return {
                    publicKey,
                    address: Crypto.crypto.getAddress(publicKey),
                    wif: decryptWIF(encryptedWIF, params.userId, params.bip38).wif,
                };
            }
        },
        schema: {
            type: "object",
            properties: {
                bip38: {
                    type: "string",
                },
                userId: {
                    type: "string",
                    $ref: "hex",
                },
            },
            required: ["bip38", "userId"],
        },
    },
    {
        name: "wallets.bip38.info",
        async method(params) {
            const encryptedWIF = await database.get(
                Crypto.HashAlgorithms.sha256(Buffer.from(params.userId)).toString("hex"),
            );

            if (!encryptedWIF) {
                return Boom.notFound(`User ${params.userId} could not be found.`);
            }

            const { keys, wif } = decryptWIF(encryptedWIF, params.userId, params.bip38);

            return {
                publicKey: keys.publicKey,
                address: Crypto.crypto.getAddress(keys.publicKey),
                wif,
            };
        },
        schema: {
            type: "object",
            properties: {
                bip38: {
                    type: "string",
                },
                userId: {
                    type: "string",
                    $ref: "hex",
                },
            },
            required: ["bip38", "userId"],
        },
    },
];
