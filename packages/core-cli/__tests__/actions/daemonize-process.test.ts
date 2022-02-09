import { Container } from "@packages/core-cli";
import { DaemonizeProcess } from "@packages/core-cli/src/actions";
import { Setup } from "@packages/core-cli/src/services/setup";
import { Console } from "@packages/core-test-framework";
import os from "os";

let cli;
let processManager;
let setup: Partial<Setup>;
let action;

const localEntrypoint = "/local/entrypoint";
const globalEntrypoint = "/global/entrypoint";

beforeEach(() => {
    setup = {
        isGlobal: jest.fn().mockReturnValue(false),
        getLocalEntrypoint: jest.fn().mockReturnValue(localEntrypoint),
        getGlobalEntrypoint: jest.fn().mockReturnValue(globalEntrypoint),
    };

    cli = new Console();
    processManager = cli.app.get(Container.Identifiers.ProcessManager);

    // Bind from src instead of dist to collect coverage.
    cli.app.rebind(Container.Identifiers.Setup).toConstantValue(setup);
    cli.app.rebind(Container.Identifiers.DaemonizeProcess).to(DaemonizeProcess).inSingletonScope();
    action = cli.app.get(Container.Identifiers.DaemonizeProcess);
});

describe("DaemonizeProcess", () => {
    it("should throw if the process has entered an unknown state", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(true);

        expect(() =>
            action.execute(
                {
                    name: "ark-core",
                    args: "core:run --daemon",
                },
                {},
            ),
        ).toThrow('The "ark-core" process has entered an unknown state.');

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");

        has.mockClear();
        isUnknown.mockClear();
    });

    it("should throw if the process is running", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(true);

        expect(() =>
            action.execute(
                {
                    name: "ark-core",
                    args: "core:run --daemon",
                },
                {},
            ),
        ).toThrow('The "ark-core" process is already running.');

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");
        expect(isOnline).toHaveBeenCalledWith("ark-core");

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
    });

    it("should continue execution if the process does not exist", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(false);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(false);

        action.execute(
            {
                name: "ark-core",
                args: "core:run --daemon",
            },
            {},
        );

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).not.toHaveBeenCalledWith("ark-core");
        expect(isOnline).not.toHaveBeenCalledWith("ark-core");

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
    });

    it("should run with the [no-daemon] flag if the daemon flag is not set", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(false);
        const totalmem = jest.spyOn(os, "totalmem").mockReturnValue(99999999999);
        const start = jest.spyOn(processManager, "start").mockImplementation(undefined);

        action.execute(
            {
                name: "ark-core",
                args: "core:run --daemon",
            },
            {},
        );

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");
        expect(isOnline).toHaveBeenCalledWith("ark-core");
        expect(totalmem).toHaveBeenCalled();
        expect(start).toHaveBeenCalledWith(
            {
                args: "core:run --daemon",
                env: { CORE_ENV: undefined, NODE_ENV: "production" },
                name: "ark-core",
                node_args: undefined,
                script: localEntrypoint,
            },
            { "kill-timeout": 30000, "max-restarts": 5, name: "ark-core", "no-daemon": true },
        );

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
        totalmem.mockClear();
        start.mockClear();
    });

    it("should run with the [no-daemon] flag if the daemon flag is false", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(false);
        const totalmem = jest.spyOn(os, "totalmem").mockReturnValue(99999999999);
        const start = jest.spyOn(processManager, "start").mockImplementation(undefined);

        action.execute(
            {
                name: "ark-core",
                args: "core:run --daemon",
            },
            { daemon: false },
        );

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");
        expect(isOnline).toHaveBeenCalledWith("ark-core");
        expect(totalmem).toHaveBeenCalled();
        expect(start).toHaveBeenCalledWith(
            {
                args: "core:run --daemon",
                env: { CORE_ENV: undefined, NODE_ENV: "production" },
                name: "ark-core",
                node_args: undefined,
                script: localEntrypoint,
            },
            { "kill-timeout": 30000, "max-restarts": 5, name: "ark-core", "no-daemon": true },
        );

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
        totalmem.mockClear();
        start.mockClear();
    });

    it("should run without the [--no-daemon] flag if the daemon flag is true", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(false);
        const totalmem = jest.spyOn(os, "totalmem").mockReturnValue(99999999999);
        const start = jest.spyOn(processManager, "start").mockImplementation(undefined);

        action.execute(
            {
                name: "ark-core",
                args: "core:run --daemon",
            },
            { daemon: true },
        );

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");
        expect(isOnline).toHaveBeenCalledWith("ark-core");
        expect(totalmem).toHaveBeenCalled();
        expect(start).toHaveBeenCalledWith(
            {
                args: "core:run --daemon",
                env: { CORE_ENV: undefined, NODE_ENV: "production" },
                name: "ark-core",
                node_args: undefined,
                script: localEntrypoint,
            },
            { "kill-timeout": 30000, "max-restarts": 5, name: "ark-core" },
        );

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
        totalmem.mockClear();
        start.mockClear();
    });

    it("should run with potato settings", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(false);
        const totalmem = jest.spyOn(os, "totalmem").mockReturnValue(2 * 1024 ** 3 - 1);
        const start = jest.spyOn(processManager, "start").mockImplementation(undefined);

        action.execute(
            {
                name: "ark-core",
                args: "core:run --daemon",
            },
            {},
        );

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");
        expect(isOnline).toHaveBeenCalledWith("ark-core");
        expect(totalmem).toHaveBeenCalled();
        expect(start).toHaveBeenCalledWith(
            {
                args: "core:run --daemon",
                env: {
                    CORE_ENV: undefined,
                    NODE_ENV: "production",
                },
                name: "ark-core",
                node_args: {
                    max_old_space_size: 500,
                },
                script: localEntrypoint,
            },
            { "kill-timeout": 30000, "max-restarts": 5, name: "ark-core", "no-daemon": true },
        );

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
        totalmem.mockClear();
        start.mockClear();
    });

    it("should throw if an unknown error occurs", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(false);
        const totalmem = jest.spyOn(os, "totalmem").mockReturnValue(99999999999);
        const start = jest.spyOn(processManager, "start").mockImplementation(() => {
            throw new Error("unexpected error");
        });

        expect(() =>
            action.execute(
                {
                    name: "ark-core",
                    args: "core:run --daemon",
                },
                {},
            ),
        ).toThrow("unexpected error");

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");
        expect(isOnline).toHaveBeenCalledWith("ark-core");
        expect(totalmem).toHaveBeenCalled();
        expect(start).toHaveBeenCalledWith(
            {
                args: "core:run --daemon",
                env: { CORE_ENV: undefined, NODE_ENV: "production" },
                name: "ark-core",
                node_args: undefined,
                script: localEntrypoint,
            },
            { "kill-timeout": 30000, "max-restarts": 5, name: "ark-core", "no-daemon": true },
        );

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
        totalmem.mockClear();
        start.mockClear();
    });

    it("should throw if an unknown error occurs (with stdrr)", () => {
        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(false);
        const totalmem = jest.spyOn(os, "totalmem").mockReturnValue(99999999999);
        const start = jest.spyOn(processManager, "start").mockImplementation(() => {
            const error: Error = new Error("hello world");
            // @ts-ignore
            error.stderr = "unexpected error";

            throw error;
        });

        expect(() =>
            action.execute(
                {
                    name: "ark-core",
                    args: "core:run --daemon",
                },
                {},
            ),
        ).toThrow("hello world: unexpected error");

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");
        expect(isOnline).toHaveBeenCalledWith("ark-core");
        expect(totalmem).toHaveBeenCalled();
        expect(start).toHaveBeenCalledWith(
            {
                args: "core:run --daemon",
                env: { CORE_ENV: undefined, NODE_ENV: "production" },
                name: "ark-core",
                node_args: undefined,
                script: localEntrypoint,
            },
            { "kill-timeout": 30000, "max-restarts": 5, name: "ark-core", "no-daemon": true },
        );

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
        totalmem.mockClear();
        start.mockClear();
    });

    it("should take global entrypoint if setup is global", () => {
        setup.isGlobal = jest.fn().mockReturnValue(true);

        const has = jest.spyOn(processManager, "has").mockReturnValue(true);
        const isUnknown = jest.spyOn(processManager, "isUnknown").mockReturnValue(false);
        const isOnline = jest.spyOn(processManager, "isOnline").mockReturnValue(false);
        const totalmem = jest.spyOn(os, "totalmem").mockReturnValue(99999999999);
        const start = jest.spyOn(processManager, "start").mockImplementation(undefined);

        action.execute(
            {
                name: "ark-core",
                args: "core:run --daemon",
            },
            {},
        );

        expect(has).toHaveBeenCalledWith("ark-core");
        expect(isUnknown).toHaveBeenCalledWith("ark-core");
        expect(isOnline).toHaveBeenCalledWith("ark-core");
        expect(totalmem).toHaveBeenCalled();
        expect(start).toHaveBeenCalledWith(
            {
                args: "core:run --daemon",
                env: { CORE_ENV: undefined, NODE_ENV: "production" },
                name: "ark-core",
                node_args: undefined,
                script: globalEntrypoint,
            },
            { "kill-timeout": 30000, "max-restarts": 5, name: "ark-core", "no-daemon": true },
        );

        has.mockClear();
        isUnknown.mockClear();
        isOnline.mockClear();
        totalmem.mockClear();
        start.mockClear();
    });
});
