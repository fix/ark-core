import "jest-extended";

import { Application, Container, Contracts, Services } from "@arkecosystem/core-kernel";
import { ServiceProvider } from "@packages/core-transaction-pool/src";
import { fork } from "child_process";
import { AnySchema } from "@hapi/joi";

jest.mock("child_process");

let app: Application;

beforeEach(() => {
    app = new Application(new Container.Container());
    app.bind(Container.Identifiers.TriggerService).to(Services.Triggers.Triggers).inSingletonScope();
});

describe("ServiceProvider", () => {
    let serviceProvider: ServiceProvider;

    beforeEach(() => {
        serviceProvider = app.resolve<ServiceProvider>(ServiceProvider);
    });

    it("should register, boot and dispose", async () => {
        await expect(serviceProvider.register()).toResolve();

        app.rebind(Container.Identifiers.TransactionPoolStorage).toConstantValue({
            boot: jest.fn(),
            dispose: jest.fn(),
        });

        app.rebind(Container.Identifiers.TransactionPoolService).toConstantValue({
            boot: jest.fn(),
            dispose: jest.fn(),
        });

        await expect(serviceProvider.boot()).toResolve();

        await expect(serviceProvider.dispose()).toResolve();
    });

    it("should be required", async () => {
        await expect(serviceProvider.required()).resolves.toBeTrue();
    });

    it("should provide TransactionPoolWorkerIpcSubprocessFactory", async () => {
        await expect(serviceProvider.register()).toResolve();
        const subprocessFactory = app.get<Contracts.TransactionPool.WorkerIpcSubprocessFactory>(
            Container.Identifiers.TransactionPoolWorkerIpcSubprocessFactory,
        );
        (fork as jest.Mock).mockReturnValueOnce({ on: jest.fn() });
        subprocessFactory();
        expect(fork).toBeCalled();
    });

    describe("configSchema", () => {
        beforeEach(() => {
            serviceProvider = app.resolve<ServiceProvider>(ServiceProvider);

            for (const key of Object.keys(process.env)) {
                if (key.includes("CORE_TRANSACTION_POOL") || key === "CORE_MAX_TRANSACTIONS_IN_POOL") {
                    delete process.env[key];
                }
            }
        });

        it("should validate schema using defaults", async () => {
            jest.resetModules();
            const result = (serviceProvider.configSchema() as AnySchema).validate(
                (await import("@packages/core-transaction-pool/src/defaults")).defaults,
            );

            expect(result.error).toBeUndefined();

            expect(result.value.enabled).toBeTrue();
            expect(result.value.storage).toBeString();
            expect(result.value.maxTransactionsInPool).toBeNumber();
            expect(result.value.maxTransactionsPerSender).toBeNumber();
            expect(result.value.allowedSenders).toEqual([]);
            expect(result.value.maxTransactionsPerRequest).toBeNumber();
            expect(result.value.maxTransactionAge).toBeNumber();
            expect(result.value.maxTransactionBytes).toBeNumber();

            expect(result.value.dynamicFees.enabled).toBeTrue();
            expect(result.value.dynamicFees.minFeePool).toBeNumber();
            expect(result.value.dynamicFees.minFeeBroadcast).toBeNumber();

            expect(result.value.dynamicFees.addonBytes.transfer).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.secondSignature).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.delegateRegistration).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.vote).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.multiSignature).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.ipfs).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.multiPayment).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.delegateResignation).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.htlcLock).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.htlcClaim).toBeNumber();
            expect(result.value.dynamicFees.addonBytes.htlcRefund).toBeNumber();

            expect(result.value.workerPool.workerCount).toBeNumber();
            expect(result.value.workerPool.cryptoPackages.length).toBeGreaterThan(0);
            result.value.workerPool.cryptoPackages.forEach((item) => {
                expect(item.typeGroup).toBeNumber();
                expect(item.packageName).toBeString();
            });
        });

        describe("process.env.CORE_TRANSACTION_POOL_DISABLED", () => {
            it("should return true when process.env.CORE_TRANSACTION_POOL_DISABLED is undefined", async () => {
                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeUndefined();
                expect(result.value.enabled).toBeTrue();
            });

            it("should return false when process.env.CORE_TRANSACTION_POOL_DISABLED is present", async () => {
                process.env.CORE_TRANSACTION_POOL_DISABLED = "true";

                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeUndefined();
                expect(result.value.enabled).toBeFalse();
            });
        });

        describe("process.env.CORE_PATH_DATA", () => {
            it("should return path containing process.env.CORE_PATH_DATA", async () => {
                process.env.CORE_PATH_DATA = "dummy/path";

                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeUndefined();
                expect(result.value.storage).toEqual("dummy/path/transaction-pool.sqlite");
            });
        });

        describe("process.env.CORE_MAX_TRANSACTIONS_IN_POOL", () => {
            it("should parse process.env.CORE_MAX_TRANSACTIONS_IN_POOL", async () => {
                process.env.CORE_MAX_TRANSACTIONS_IN_POOL = "4000";

                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeUndefined();
                expect(result.value.maxTransactionsInPool).toEqual(4000);
            });

            it("should throw if process.env.CORE_MAX_TRANSACTIONS_IN_POOL is not number", async () => {
                process.env.CORE_MAX_TRANSACTIONS_IN_POOL = "false";

                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeDefined();
                expect(result.error!.message).toEqual('"maxTransactionsInPool" must be a number');
            });
        });

        describe("process.env.CORE_TRANSACTION_POOL_MAX_PER_SENDER", () => {
            it("should parse process.env.CORE_TRANSACTION_POOL_MAX_PER_SENDER", async () => {
                process.env.CORE_TRANSACTION_POOL_MAX_PER_SENDER = "4000";

                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeUndefined();
                expect(result.value.maxTransactionsPerSender).toEqual(4000);
            });

            it("should throw if process.env.CORE_TRANSACTION_POOL_MAX_PER_SENDER is not number", async () => {
                process.env.CORE_TRANSACTION_POOL_MAX_PER_SENDER = "false";

                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeDefined();
                expect(result.error!.message).toEqual('"maxTransactionsPerSender" must be a number');
            });
        });

        describe("process.env.CORE_TRANSACTION_POOL_MAX_PER_REQUEST", () => {
            it("should parse process.env.CORE_TRANSACTION_POOL_MAX_PER_SENDER", async () => {
                process.env.CORE_TRANSACTION_POOL_MAX_PER_REQUEST = "4000";

                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeUndefined();
                expect(result.value.maxTransactionsPerRequest).toEqual(4000);
            });

            it("should throw if process.env.CORE_TRANSACTION_POOL_MAX_PER_REQUEST is not number", async () => {
                process.env.CORE_TRANSACTION_POOL_MAX_PER_REQUEST = "false";

                jest.resetModules();
                const result = (serviceProvider.configSchema() as AnySchema).validate(
                    (await import("@packages/core-transaction-pool/src/defaults")).defaults,
                );

                expect(result.error).toBeDefined();
                expect(result.error!.message).toEqual('"maxTransactionsPerRequest" must be a number');
            });
        });
    });
});
