import { Crypto } from "@arkecosystem/crypto";
import Hapi from "@hapi/hapi";
import NodeCache from "node-cache";

type CachedResponse = {
    code: number;
    headers: Record<string, string>;
    payload: unknown;
};

const generateCacheKey = (request: Hapi.Request): string =>
    Crypto.HashAlgorithms.sha256(
        JSON.stringify({
            pathname: request.url.pathname,
            params: request.params || {},
            payload: request.payload || {},
            query: request.query,
            method: request.method,
        }),
    ).toString("hex");

export = {
    name: "node-cache",
    version: "1.0.0",
    once: true,
    async register(
        server: Hapi.Server,
        options: { enabled: boolean; stdTTL: number; checkperiod: number },
    ): Promise<void> {
        if (options.enabled === false) {
            return;
        }

        const cache: NodeCache = new NodeCache({ stdTTL: options.stdTTL, checkperiod: options.checkperiod });

        // const lastModified = cached ? new Date(cached.stored) : new Date();
        // return h.response(arg).header("Last-modified", lastModified.toUTCString());

        server.ext({
            type: "onPreHandler",
            async method(request: Hapi.Request, h: Hapi.ResponseToolkit) {
                const cacheKey: string = generateCacheKey(request);
                const cachedResponse: CachedResponse | undefined = cache.get(cacheKey);

                if (cachedResponse) {
                    const newResponse = h.response(cachedResponse.payload).code(cachedResponse.code);

                    for (const [headerName, headerValue] of Object.entries(cachedResponse.headers)) {
                        newResponse.header(headerName, headerValue, {
                            append: false,
                            override: false,
                            duplicate: false,
                        });
                    }

                    return newResponse.takeover();
                } else {
                    return h.continue;
                }
            },
        });

        server.ext({
            type: "onPreResponse",
            async method(request: Hapi.Request, h: Hapi.ResponseToolkit) {
                const cacheKey: string = generateCacheKey(request);

                if (request.response.isBoom) {
                    cache.set(cacheKey, {
                        code: request.response.output.statusCode,
                        headers: request.response.output.headers,
                        payload: request.response.output.payload,
                    });
                } else {
                    cache.set(cacheKey, {
                        code: request.response.statusCode,
                        headers: request.response.headers,
                        payload: request.response.source,
                    });
                }

                return h.continue;
            },
        });
    },
};
