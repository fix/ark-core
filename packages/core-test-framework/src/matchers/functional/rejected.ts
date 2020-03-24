import { Interfaces } from "@arkecosystem/crypto";
import got from "got";

export {};

declare global {
    namespace jest {
        // @ts-ignore - All declarations of 'Matchers' must have identical type parameters.
        interface Matchers<R> {
            toBeRejected(): Promise<R>;
            toBeEachRejected(): Promise<R>;
        }
    }
}

expect.extend({
    toBeRejected: async (transaction: Interfaces.ITransactionData) => {
        let pass: boolean = false;
        let response: string;
        try {
            const { body } = await got.post(`http://localhost:4003/api/transactions`, {
                body: JSON.stringify({ transactions: [transaction] }),
            });

            response = body;
            const parsedBody = JSON.parse(body);

            pass = parsedBody.errors !== undefined && parsedBody.data.invalid.includes(transaction.id);
        } catch (e) {} // tslint:disable-line

        return {
            pass,
            // @ts-ignore
            message: /* istanbul ignore next */ () => `expected ${transaction.id} ${this.isNot ? "not" : ""} to be rejected, but: ${response}`,
        };
    },
    toBeEachRejected: async (transactions: Interfaces.ITransactionData[]) => {
        let pass: boolean = false;
        let response: string;

        try {
            for (const transaction of transactions) {
                const { body } = await got.post(`http://localhost:4003/api/transactions`, {
                    body: JSON.stringify({ transactions: [transaction] }),
                });

                response = body;
                const parsedBody = JSON.parse(body);

                pass = parsedBody.errors !== undefined && parsedBody.data.invalid.includes(transaction.id);

                if (!pass) {
                    break;
                }
            }
        } catch (e) {
            pass = false
        } // tslint:disable-line

        return {
            pass,
            // @ts-ignore
            message: /* istanbul ignore next */ () => `expected transactions ${this.isNot ? "not" : ""} to be rejected, but: ${response}`,
        };
    },
});
