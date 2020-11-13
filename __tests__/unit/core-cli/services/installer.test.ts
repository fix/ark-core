import "jest-extended";

import { Console } from "@arkecosystem/core-test-framework";
// import path from "path";
import { Installer } from "@packages/core-cli/src/services";
import { setGracefulCleanup } from "tmp";

import execa from "../../../../__mocks__/execa";

let cli;
let installer;

beforeAll(() => setGracefulCleanup());

beforeEach(() => {
    cli = new Console();

    installer = cli.app.resolve(Installer);
});

afterEach(() => jest.resetAllMocks());

describe("Installer.install", () => {
    it("should install latest package when tag isn't provided", () => {
        jest.spyOn(installer, "installPeerDependencies").mockReturnValueOnce(undefined);

        const spySync: jest.SpyInstance = jest.spyOn(execa, "sync").mockReturnValue({
            stdout: "stdout",
            exitCode: 0,
        });

        installer.install("@arkecosystem/core");

        expect(spySync).toHaveBeenCalledWith("yarn global add @arkecosystem/core@latest", { shell: true });
    });

    it("should install specific package when tag is provided", () => {
        jest.spyOn(installer, "installPeerDependencies").mockReturnValueOnce(undefined);

        const spySync: jest.SpyInstance = jest.spyOn(execa, "sync").mockReturnValue({
            stdout: "stdout",
            exitCode: 0,
        });

        installer.install("@arkecosystem/core", "3.0.0");

        expect(spySync).toHaveBeenCalledWith("yarn global add @arkecosystem/core@3.0.0", { shell: true });
    });

    it("should throw when exit code isn't 0", () => {
        jest.spyOn(installer, "installPeerDependencies").mockReturnValueOnce(undefined);

        const spySync: jest.SpyInstance = jest.spyOn(execa, "sync").mockReturnValue({
            stderr: "stderr",
            exitCode: 1,
        });

        expect(() => installer.install("@arkecosystem/core")).toThrow("stderr");

        expect(spySync).toHaveBeenCalledWith("yarn global add @arkecosystem/core@latest", { shell: true });
    });
});

describe("Installer.installPeerDependencies", () => {
    it("should install each peer dependency", () => {
        const spyInstallRangeTop: jest.SpyInstance = jest
            .spyOn(installer, "installRangeTop")
            .mockReturnValue(undefined);

        const spySync: jest.SpyInstance = jest.spyOn(execa, "sync").mockReturnValue({
            stdout: JSON.stringify({ pm2: "4.5.0", somepkg: "^1.0.0" }),
            exitCode: 0,
        });

        installer.installPeerDependencies("@arkecosystem/core", "3.0.0");

        expect(spySync).toHaveBeenCalledWith("yarn info @arkecosystem/core@3.0.0 peerDependencies --json", {
            shell: true,
        });

        expect(spyInstallRangeTop).toHaveBeenCalledWith("pm2", "4.5.0");
        expect(spyInstallRangeTop).toHaveBeenCalledWith("somepkg", "^1.0.0");
    });

    it("should not install peer dependencies when there aren't any", () => {
        const spyInstallRangeTop: jest.SpyInstance = jest
            .spyOn(installer, "installRangeTop")
            .mockReturnValue(undefined);

        const spySync: jest.SpyInstance = jest.spyOn(execa, "sync").mockReturnValue({
            stdout: JSON.stringify(null),
            exitCode: 0,
        });

        installer.installPeerDependencies("@arkecosystem/core", "3.0.0");

        expect(spySync).toHaveBeenCalledWith("yarn info @arkecosystem/core@3.0.0 peerDependencies --json", {
            shell: true,
        });

        expect(spyInstallRangeTop).not.toHaveBeenCalled();
    });

    it("should throw error when yarn command fails", () => {
        const spySync: jest.SpyInstance = jest.spyOn(execa, "sync").mockReturnValue({
            stderr: "stderr",
            exitCode: 1,
        });

        expect(() => installer.installPeerDependencies("@arkecosystem/core")).toThrow("stderr");

        expect(spySync).toHaveBeenCalledWith("yarn info @arkecosystem/core@latest peerDependencies --json", {
            shell: true,
        });
    });
});

describe("Installer.installRangeTop", () => {
    it("should install highest matching version", () => {
        const spyInstall: jest.SpyInstance = jest.spyOn(installer, "install").mockReturnValue(undefined);

        const spySync: jest.SpyInstance = jest.spyOn(execa, "sync").mockReturnValue({
            stdout: JSON.stringify(["3.0.0", "3.0.0-next.9"]),
            exitCode: 0,
        });

        installer.installRangeTop("@arkecosystem/core", "^3.0.0 <3.4.0");

        expect(spySync).toHaveBeenCalledWith("yarn info @arkecosystem/core versions --json", {
            shell: true,
        });

        expect(spyInstall).toHaveBeenCalledWith("@arkecosystem/core", "3.0.0");
    });
});
