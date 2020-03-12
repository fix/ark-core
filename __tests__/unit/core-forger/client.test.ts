import "jest-extended";

import { Client } from "@packages/core-forger/src/client";
import { Application, Container } from "@packages/core-kernel";
import { codec } from "@packages/core-p2p";
import socketCluster from "socketcluster-client";

jest.mock("socketcluster-client");

let app: Application;
const logger = {
    error: jest.fn(),
    debug: jest.fn(),
};

beforeEach(() => {
    app = new Application(new Container.Container());
    app.bind(Container.Identifiers.LogService).toConstantValue(logger);
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
});

describe("Client", () => {
    let client: Client;

    beforeEach(() => {
        client = app.resolve<Client>(Client);
    });

    describe("register", () => {
        let spySocketOn;
        let spysocketCluster;
        let mockHost;

        beforeEach(() => {
            spySocketOn = jest.fn();
            // @ts-ignore
            spysocketCluster = jest.spyOn(socketCluster, "create").mockImplementation(() => ({
                // @ts-ignore
                on: spySocketOn,
            }));

            mockHost = {
                socket: {},
            };
        });

        it("should register hosts", async () => {
            const expected = {
                ...mockHost,
                autoReconnectOptions: {
                    initialDelay: 1000,
                    maxDelay: 1000,
                },
                codecEngine: codec,
            };

            // @ts-ignore
            client.register([mockHost]);
            expect(spysocketCluster).toHaveBeenCalledWith(expected);
        });

        it("on error the socket should call logger", () => {
            let onErrorCallBack;
            spySocketOn.mockImplementationOnce((...data) => (onErrorCallBack = data[1]));

            // @ts-ignore
            client.register([mockHost]);

            const fakeError = { message: "Fake Error" };
            onErrorCallBack(fakeError);

            expect(logger.error).toHaveBeenCalledWith("Fake Error");
        });

        // TODO: this passes on its own, fails with the rest - probably to do with mock state
        it("should not call logger if the socket hangs up", () => {
            let onErrorCallBack;
            spySocketOn.mockImplementationOnce((...data) => (onErrorCallBack = data[1]));

            // @ts-ignore
            client.register([mockHost]);

            const socketHangupError = { message: "Socket hung up" };
            onErrorCallBack(socketHangupError);

            expect(logger.error).not.toHaveBeenCalled();
        });
    });
});
