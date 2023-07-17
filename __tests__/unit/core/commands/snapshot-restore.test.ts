import { Console, Sandbox } from "@packages/core-test-framework";
import { Command } from "@packages/core/src/commands/snapshot-restore";
import { Container } from "@arkecosystem/core-kernel";
import { Utils } from "@arkecosystem/core-cli";

let cli;
let mockSnapshotService;
let mockEventListener;
let spyOnTerminate;

jest.mock("@packages/core-cli", () => {
    const original = jest.requireActual("@packages/core-cli");
    return {
        __esModule: true,
        ...original,
        Utils: { ...original.Utils, buildApplication: jest.fn() },
    };
});

beforeEach(() => {
    cli = new Console();

    const sandbox = new Sandbox();

    mockSnapshotService = {
        restore: jest.fn(),
    };

    mockEventListener = {
        listen: jest.fn(),
    };

    sandbox.app.bind(Container.Identifiers.SnapshotService).toConstantValue(mockSnapshotService);
    sandbox.app.bind(Container.Identifiers.EventDispatcherService).toConstantValue(mockEventListener);

    jest.spyOn(Utils, "buildApplication").mockResolvedValue(sandbox.app);
    spyOnTerminate = jest.spyOn(sandbox.app, "terminate").mockImplementation(async () => {});
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("RestoreCommand", () => {
    it("should run restore", async () => {
        await expect(cli.withFlags({ blocks: "1-99" }).execute(Command)).toResolve();
        expect(mockSnapshotService.restore).toHaveBeenCalled();
        expect(spyOnTerminate).toHaveBeenCalled();
    });

    it("should not run restore if blocks flag is missing", async () => {
        await expect(cli.execute(Command)).toReject();
    });
});
