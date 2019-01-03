import { app } from "@arkecosystem/core-container";
import { createHash } from "crypto";
import Hapi from "hapi";

export class ServerCache {
    public static make(server: Hapi.Server): ServerCache {
        return new ServerCache(server);
    }

    private constructor(readonly server: Hapi.Server) {}

    public method(name: string, method: any, expiresIn: number, argsCallback?: any): this {
        const cacheDisabled = !this.server.app.config.cache.enabled;

        this.server.method(
            name,
            method,
            cacheDisabled
                ? {}
                : {
                      cache: {
                          expiresIn: expiresIn * 1000,
                          generateTimeout: this.getCacheTimeout(),
                          getDecoratedValue: true,
                      },
                      generateKey: request => this.generateCacheKey(argsCallback(request)),
                  },
        );

        return this;
    }

    public generateCacheKey(value) {
        return createHash("sha256")
            .update(JSON.stringify(value))
            .digest("hex");
    }

    private getCacheTimeout() {
        const { generateTimeout } = app.resolveOptions("api").cache;

        return JSON.parse(generateTimeout);
    }
}
