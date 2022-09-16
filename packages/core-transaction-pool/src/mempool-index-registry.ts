import { Container } from "@arkecosystem/core-kernel";

import { MempoolIndex } from "./mempool-index";

@Container.injectable()
export class MempoolIndexRegistry {
    @Container.multiInject(Container.Identifiers.TransactionPoolMempoolIndex)
    private readonly indexNames!: string[];

    private readonly indexes: Map<string, MempoolIndex> = new Map();

    @Container.postConstruct()
    public initialize(): void {
        for (const indexName of this.indexNames) {
            this.indexes.set(indexName, new MempoolIndex());
        }
    }

    public get(indexName: string): MempoolIndex {
        if (this.indexes.has(indexName)) {
            return this.indexes.get(indexName)!;
        }

        throw new Error(`Index ${indexName} does not exists`);
    }
}
