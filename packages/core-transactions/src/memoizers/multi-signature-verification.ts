import { Container, Providers } from "@arkecosystem/core-kernel";
import { Interfaces, Transactions } from "@arkecosystem/crypto";
import cloneDepp from "lodash.clonedeep";
import isEqual from "lodash.isequal";
import LRUCache from "lru-cache";

interface CacheValue {
    multiSignature: Interfaces.IMultiSignatureAsset;
    result: boolean;
}

@Container.injectable()
export class MultiSignatureVerificationMemoizer {
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@arkecosystem/core-transactions")
    private readonly configuration!: Providers.PluginConfiguration;

    private lruCache!: LRUCache<string, CacheValue>;

    @Container.postConstruct()
    public initialize() {
        this.lruCache = new LRUCache({ max: this.configuration.getRequired("memoizerCacheSize") });
    }

    public verifySignatures(
        transaction: Interfaces.ITransactionData,
        multiSignature: Interfaces.IMultiSignatureAsset,
    ): boolean {
        const key = this.getKey(transaction);

        const value = this.lruCache.get(key)!;
        if (value && isEqual(value.multiSignature, multiSignature)) {
            return value.result;
        }

        const result = Transactions.Verifier.verifySignatures(transaction, multiSignature);

        this.lruCache.set(key, { multiSignature: cloneDepp(multiSignature), result });

        return result;
    }

    public clear() {
        this.lruCache.clear();
    }

    private getKey(transaction: Interfaces.ITransactionData): string {
        if (!transaction.id) {
            throw new Error("Missing transaction id");
        }

        return transaction.id;
    }
}
