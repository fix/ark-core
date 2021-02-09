import "jest-extended";

import { Container } from "@packages/core-kernel";
import { ServiceProvider } from "@packages/core-snapshots/src";
import { Sandbox } from "@packages/core-test-framework";
import { AnySchema } from "joi";
import * as typeorm from "typeorm";

let sandbox: Sandbox;

const spyOnGetCustomRepository = jest.spyOn(typeorm, "getCustomRepository").mockReturnValue(undefined);

ServiceProvider.prototype.config = jest.fn().mockReturnValue({
    all: jest.fn().mockReturnValue({
        connection: {},
    }),
});

beforeEach(() => {
    sandbox = new Sandbox();

    sandbox.app.bind(Container.Identifiers.LogService).toConstantValue({});
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("ServiceProvider", () => {
    let serviceProvider: ServiceProvider;

    beforeEach(() => {
        serviceProvider = sandbox.app.resolve<ServiceProvider>(ServiceProvider);
    });

    it("should register", async () => {
        await expect(serviceProvider.register()).toResolve();
        expect(spyOnGetCustomRepository).toHaveBeenCalledTimes(3);
    });

    it("should register is default connection is already active", async () => {
        sandbox.app.bind(Container.Identifiers.DatabaseConnection).toConstantValue({});

        await expect(serviceProvider.register()).toResolve();
        expect(spyOnGetCustomRepository).toHaveBeenCalledTimes(3);
    });

    it("should dispose", async () => {
        await expect(serviceProvider.register()).toResolve();
        expect(spyOnGetCustomRepository).toHaveBeenCalled();

        await expect(serviceProvider.dispose()).toResolve();
    });

    it("should not be required", async () => {
        await expect(serviceProvider.required()).resolves.toBeTrue();
    });

    describe("ServiceProvider.configSchema", () => {
        beforeEach(() => {
            serviceProvider = sandbox.app.resolve<ServiceProvider>(ServiceProvider);
        });

        it("should validate schema using defaults", async () => {
            jest.resetModules();
            const result = (serviceProvider.configSchema() as AnySchema).validate(
                (await import("@packages/core-snapshots/src/defaults")).defaults,
            );

            expect(result.error).toBeUndefined();

            expect(result.value.updateStep).toBeNumber();
        });

        it("should allow configuration extension", async () => {
            jest.resetModules();
            const defaults = (await import("@packages/core-snapshots/src/defaults")).defaults;

            // @ts-ignore
            defaults.customField = "dummy";

            const result = (serviceProvider.configSchema() as AnySchema).validate(defaults);

            expect(result.error).toBeUndefined();
            expect(result.value.customField).toEqual("dummy");
        });

        describe("schema restrictions", () => {
            let defaults;

            beforeEach(async () => {
                jest.resetModules();
                defaults = (await import("@packages/core-snapshots/src/defaults")).defaults;
            });

            it("updateStep is required && is integer && >= 1 && <= 2000", async () => {
                defaults.updateStep = false;
                let result = (serviceProvider.configSchema() as AnySchema).validate(defaults);

                expect(result.error!.message).toEqual('"updateStep" must be a number');

                defaults.updateStep = 1.12;
                result = (serviceProvider.configSchema() as AnySchema).validate(defaults);

                expect(result.error!.message).toEqual('"updateStep" must be an integer');

                defaults.updateStep = 0;
                result = (serviceProvider.configSchema() as AnySchema).validate(defaults);

                expect(result.error!.message).toEqual('"updateStep" must be greater than or equal to 1');

                defaults.updateStep = 5000;
                result = (serviceProvider.configSchema() as AnySchema).validate(defaults);

                expect(result.error!.message).toEqual('"updateStep" must be less than or equal to 2000');

                delete defaults.updateStep;
                result = (serviceProvider.configSchema() as AnySchema).validate(defaults);

                expect(result.error!.message).toEqual('"updateStep" is required');
            });
        });
    });
});
