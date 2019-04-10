import { app } from "@arkecosystem/core-container";
import { Database } from "@arkecosystem/core-interfaces";
import Boom from "boom";
import Hapi from "hapi";
import groupBy from "lodash.groupby";
import math from "mathjs";
import { Controller } from "../shared/controller";

export class NodeController extends Controller {
    public async status(request: Hapi.Request, h: Hapi.ResponseToolkit) {
        try {
            const lastBlock = this.blockchain.getLastBlock();
            const networkHeight = await this.blockchain.p2p.getMonitor().getNetworkHeight();

            return {
                data: {
                    synced: this.blockchain.isSynced(),
                    now: lastBlock ? lastBlock.data.height : 0,
                    blocksCount: networkHeight - lastBlock.data.height || 0,
                },
            };
        } catch (error) {
            return Boom.badImplementation(error);
        }
    }

    public async syncing(request: Hapi.Request, h: Hapi.ResponseToolkit) {
        try {
            const lastBlock = this.blockchain.getLastBlock();
            const networkHeight = await this.blockchain.p2p.getMonitor().getNetworkHeight();

            return {
                data: {
                    syncing: !this.blockchain.isSynced(),
                    blocks: networkHeight - lastBlock.data.height || 0,
                    height: lastBlock.data.height,
                    id: lastBlock.data.id,
                },
            };
        } catch (error) {
            return Boom.badImplementation(error);
        }
    }

    public async configuration(request: Hapi.Request, h: Hapi.ResponseToolkit) {
        try {
            const network = this.config.get("network");
            const dynamicFees = app.resolveOptions("transaction-pool").dynamicFees;

            return {
                data: {
                    nethash: network.nethash,
                    token: network.client.token,
                    symbol: network.client.symbol,
                    explorer: network.client.explorer,
                    version: network.pubKeyHash,
                    ports: super.toResource(request, this.config, "ports"),
                    constants: this.config.getMilestone(this.blockchain.getLastHeight()),
                    transactionPool: {
                        maxTransactionAge: app.resolveOptions("transaction-pool").maxTransactionAge,
                        dynamicFees: dynamicFees.enabled ? dynamicFees : { enabled: false },
                    },
                },
            };
        } catch (error) {
            return Boom.badImplementation(error);
        }
    }

    public async fees(request: Hapi.Request) {
        try {
            const { transactionsBusinessRepository } = app.resolvePlugin<Database.IDatabaseService>("database");

            // @ts-ignore
            const results = await transactionsBusinessRepository.getFeeStatistics(request.query.days);

            const resultsByDays = [];
            for (const [type, transactions] of Object.entries(groupBy(results, "type"))) {
                const fees: number[] = transactions.map(transaction => +transaction.fee);

                resultsByDays.push({
                    type,
                    min: math.min(fees),
                    max: math.max(fees),
                    sum: math.sum(fees),
                    mean: math.mean(fees),
                    median: math.median(fees),
                });
            }

            return { meta: { days: request.query.days }, data: resultsByDays };
        } catch (error) {
            return Boom.badImplementation(error);
        }
    }
}
