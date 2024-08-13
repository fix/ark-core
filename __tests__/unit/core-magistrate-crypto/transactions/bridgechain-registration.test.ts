import "jest-extended";

import { BridgechainRegistrationBuilder } from "@packages/core-magistrate-crypto/src/builders";
import { BridgechainRegistrationTransaction } from "@packages/core-magistrate-crypto/src/transactions";
import { Managers, Transactions, Validation } from "@packages/crypto";

import { bridgechainRegistrationAsset1, bridgechainRegistrationAsset2, checkCommonFields } from "../helper";

let builder: BridgechainRegistrationBuilder;

describe("Bridgechain registration transaction", () => {
    Managers.configManager.setFromPreset("testnet");
    Managers.configManager.setHeight(2);

    Transactions.TransactionRegistry.registerTransactionType(BridgechainRegistrationTransaction);

    beforeEach(() => {
        builder = new BridgechainRegistrationBuilder();
    });

    describe("Ser/deser", () => {
        it("should ser/deserialize giving back original fields", () => {
            const bridgechainRegistration = builder
                .bridgechainRegistrationAsset(bridgechainRegistrationAsset1)
                .network(23)
                .sign("passphrase")
                .getStruct();

            const serialized =
                Transactions.TransactionFactory.fromData(bridgechainRegistration).serialized.toString("hex");
            const deserialized = Transactions.Deserializer.deserialize(serialized);

            checkCommonFields(deserialized, bridgechainRegistration);

            expect(deserialized.data.asset!.bridgechainRegistration).toStrictEqual(
                bridgechainRegistration.asset!.bridgechainRegistration,
            );
        });

        it("should ser/deserialize giving back original fields", () => {
            const bridgechainRegistration = builder
                .bridgechainRegistrationAsset(bridgechainRegistrationAsset2)
                .network(23)
                .sign("passphrase")
                .getStruct();

            const serialized =
                Transactions.TransactionFactory.fromData(bridgechainRegistration).serialized.toString("hex");
            const deserialized = Transactions.Deserializer.deserialize(serialized);

            checkCommonFields(deserialized, bridgechainRegistration);

            expect(deserialized.data.asset!.bridgechainRegistration).toStrictEqual(
                bridgechainRegistration.asset!.bridgechainRegistration,
            );
        });

        it("should throw on serialization if asset is undefined", () => {
            const bridgechainRegistration = builder
                .bridgechainRegistrationAsset(bridgechainRegistrationAsset2)
                .network(23)
                .sign("passphrase")
                .getStruct();

            const transaction = Transactions.TransactionFactory.fromData(bridgechainRegistration);
            expect(transaction.serialize()).toBeDefined();

            transaction.data.asset = undefined;

            expect(() => {
                transaction.serialize();
            }).toThrowError();
        });
    });

    describe("Schema tests", () => {
        let transactionSchema;

        beforeAll(() => {
            transactionSchema = BridgechainRegistrationTransaction.getSchema();
        });

        it("should not throw any error", () => {
            const bridgechainRegistration = builder
                .bridgechainRegistrationAsset(bridgechainRegistrationAsset1)
                .sign("passphrase");

            const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
            expect(error).toBeUndefined();
        });

        it("should not throw any error", () => {
            const bridgechainRegistration = builder
                .bridgechainRegistrationAsset(bridgechainRegistrationAsset2)
                .sign("passphrase");

            const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
            expect(error).toBeUndefined();
        });

        describe("should test edge cases of bridgechain name", () => {
            it("should fail because name should not be empty (at least 1 char)", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
                        bridgechainRepository: "http://www.repository.com/google/syzkaller",
                        seedNodes: ["74.125.224.72", "66.102.0.0"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });

            it("should fail because name should had max 40 char", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "this_string_is_rly_41_chars_long_string41",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
                        bridgechainRepository: "http://www.repository.com/google/syzkaller",
                        seedNodes: ["74.125.224.72", "66.102.0.0"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });
        });

        describe("should test edge cases of bridgechain genesisHash", () => {
            it("should fail because genesisHash is to short (63chars)", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "google",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26",
                        bridgechainRepository: "http://www.repository.com/google/syzkaller",
                        seedNodes: ["74.125.224.72", "66.102.0.0"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });

            it("should fail because genesisHash is to long (65chars)", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "google",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f+",
                        bridgechainRepository: "http://www.repository.com/google/syzkaller",
                        seedNodes: ["74.125.224.72", "66.102.0.0"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });
        });

        describe("should test edge cases of bridgechain bridgechainRepository", () => {
            it("should fail duo to empty string", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "google",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
                        bridgechainRepository: "",
                        seedNodes: ["74.125.224.72", "66.102.0.0"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });

            it("should fail duo to big repository, max 100 chars", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "google",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
                        bridgechainRepository: "http://" + "a".repeat(101),
                        seedNodes: ["74.125.224.72", "66.102.0.0"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });

            it("should fail due to invalid uri", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "google",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
                        bridgechainRepository: "some.repository",
                        seedNodes: ["74.125.224.72", "66.102.0.0"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });
        });

        describe("should test edge cases for seedNodes", () => {
            it("should have at least one item (ip)", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "google",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
                        bridgechainRepository: "http://www.repository.com/google/syzkaller",
                        seedNodes: [],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });

            it("should not accept duplicates", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "google",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
                        bridgechainRepository: "http://www.repository.com/google/syzkaller",
                        seedNodes: ["66.102.0.0", "66.102.0.0"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });

            it("should not accept localhost", () => {
                const bridgechainRegistration = builder
                    .bridgechainRegistrationAsset({
                        name: "google",
                        genesisHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
                        bridgechainRepository: "http://www.repository.com/google/syzkaller",
                        seedNodes: ["127.0.0.1"],
                        ports: { "@arkecosystem/core-api": 12345 },
                    })
                    .sign("passphrase");

                const { error } = Validation.validator.validate(transactionSchema, bridgechainRegistration.getStruct());
                expect(error).not.toBeUndefined();
            });
        });
    });
});
