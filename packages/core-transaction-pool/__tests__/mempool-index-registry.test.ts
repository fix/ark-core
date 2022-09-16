import "jest-extended";

import { Application, Container } from "@packages/core-kernel";

import { MempoolIndex } from "../../../packages/core-transaction-pool/src/mempool-index";
import { MempoolIndexRegistry } from "../../../packages/core-transaction-pool/src/mempool-index-registry";

describe("MempoolIndex", () => {
    let app: Application;

    beforeEach(() => {
        app = new Application(new Container.Container());
    });

    it("should initialize indexes", () => {
        const index1 = "index1";
        const index2 = "index2";

        app.bind(Container.Identifiers.TransactionPoolMempoolIndex).toConstantValue(index1);
        app.bind(Container.Identifiers.TransactionPoolMempoolIndex).toConstantValue(index2);

        const mempoolIndexRegistry = app.resolve(MempoolIndexRegistry);

        expect(mempoolIndexRegistry.get(index1)).toBeInstanceOf(MempoolIndex);
        expect(mempoolIndexRegistry.get(index2)).toBeInstanceOf(MempoolIndex);
    });

    it("should throw if index is not registered", () => {
        const index1 = "index1";
        const index2 = "index2";

        app.bind(Container.Identifiers.TransactionPoolMempoolIndex).toConstantValue(index1);

        const mempoolIndexRegistry = app.resolve(MempoolIndexRegistry);

        expect(() => mempoolIndexRegistry.get(index2)).toThrowError(`Index ${index2} does not exists`);
    });
});
