import { Container, Providers } from "@arkecosystem/core-kernel";
import Joi from "joi";
import { getCustomRepository } from "typeorm";

import { SnapshotDatabaseService } from "./database-service";
import { Filesystem } from "./filesystem/filesystem";
import { Identifiers } from "./ioc";
import { ProgressDispatcher } from "./progress-dispatcher";
import { BlockRepository, RoundRepository, TransactionRepository } from "./repositories";
import { SnapshotService } from "./snapshot-service";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        this.app.bind(Identifiers.SnapshotVersion).toConstantValue(this.version());

        this.registerServices();
    }

    public async required(): Promise<boolean> {
        return true;
    }

    public configSchema(): object {
        return Joi.object({
            updateStep: Joi.number().integer().min(1).max(2000).required(),
            connection: Joi.object({
                type: Joi.string().required(),
                host: Joi.string().required(),
                port: Joi.number().integer().min(1).max(65535).required(),
                database: Joi.string().required(),
                username: Joi.string().required(),
                password: Joi.string().required(),
                entityPrefix: Joi.string().required(),
                synchronize: Joi.bool().required(),
                logging: Joi.bool().required(),
            }).required(),
        }).unknown(true);
    }

    private registerServices(): void {
        this.app.bind(Container.Identifiers.SnapshotService).to(SnapshotService).inSingletonScope();

        this.app.bind(Identifiers.SnapshotDatabaseService).to(SnapshotDatabaseService).inSingletonScope();

        this.app.bind(Identifiers.SnapshotFilesystem).to(Filesystem).inSingletonScope();

        this.app.bind(Identifiers.ProgressDispatcher).to(ProgressDispatcher).inTransientScope();

        this.app.bind(Identifiers.SnapshotBlockRepository).toConstantValue(getCustomRepository(BlockRepository));
        this.app
            .bind(Identifiers.SnapshotTransactionRepository)
            .toConstantValue(getCustomRepository(TransactionRepository));
        this.app.bind(Identifiers.SnapshotRoundRepository).toConstantValue(getCustomRepository(RoundRepository));
    }
}
