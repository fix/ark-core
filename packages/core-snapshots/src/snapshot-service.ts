import { Container, Contracts, Utils } from "@arkecosystem/core-kernel";
import { Identifiers } from "./ioc";
import { SnapshotDatabaseService } from "./database-service";
import { Interfaces } from "@arkecosystem/crypto";
import { Filesystem } from "./filesystem/filesystem";
import { Meta } from "./contracts";

@Container.injectable()
export class SnapshotService implements Contracts.Snapshot.SnapshotService {
    @Container.inject(Identifiers.SnapshotFilesystem)
    private readonly filesystem!: Filesystem;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Identifiers.SnapshotDatabaseService)
    private readonly database!: SnapshotDatabaseService;

    public async dump(options: any): Promise<void> {
        try {
            Utils.assert.defined<string>(options.network);

            this.logger.info(`Running DUMP for network: ${options.network}`);

            this.database.init(options.codec, options.skipCompression);

            await this.database.dump(options);

            this.logger.info(`Snapshot is saved on location: ${this.filesystem.getSnapshotPath()}`);
        } catch (err) {
            this.logger.error(`DUMP failed`);
            this.logger.error(err.toString());
        }

    }

    public async restore(options: any): Promise<void> {
        try {
            Utils.assert.defined<string>(options.network);
            Utils.assert.defined<string>(options.blocks);

            // this.filesystem.setNetwork(options.network);
            this.filesystem.setSnapshot(options.blocks);

            if (! await this.filesystem.snapshotExists()) {
                this.logger.error(`Snapshot ${options.blocks} of network ${options.network} does not exist.`);
                return;
            }

            let meta: Meta.MetaData;
            try {
                meta = await this.filesystem.readMetaData();
            } catch (e) {
                this.logger.error(`Metadata for snapshot ${options.blocks} of network ${options.network} is not valid.`);
                return;
            }

            this.logger.info(`Running RESTORE for network: ${options.network}`);

            this.database.init(meta!.codec, meta!.skipCompression);

            await this.database.restore(meta!, { truncate: !!options.truncate });

            this.logger.info(`Successfully restore  ${meta!.blocks.count} blocks, ${meta!.transactions.count} transactions, ${meta!.rounds.count} rounds`);
        } catch (err) {
            this.logger.error(`RESTORE failed.`);
            this.logger.error(err.toString());
        }
    }

    public async verify(options: any): Promise<void> {
        try {
            this.logger.info("Running VERIFICATION");

            Utils.assert.defined<string>(options.network);
            Utils.assert.defined<string>(options.blocks);

            // this.filesystem.setNetwork(options.network);
            this.filesystem.setSnapshot(options.blocks);

            if (!await this.filesystem.snapshotExists()) {
                this.logger.error(`Snapshot ${options.blocks} of network ${options.network} does not exist.`);
                return;
            }

            let meta: Meta.MetaData;
            try {
                meta = await this.filesystem.readMetaData();
            } catch (e) {
                this.logger.error(`Metadata for snapshot ${options.blocks} of network ${options.network} is not valid.`);
            }

            this.database.init(meta!.codec, meta!.skipCompression);

            await this.database.verify(meta!);
            this.logger.info((`VERIFICATION is successful.`));
        } catch (err) {
            this.logger.error(`VERIFICATION failed.`);
            this.logger.error(err.toString());
        }
    }

    public async rollbackByHeight(height: number, backupTransactions: boolean): Promise<void> {
        try {
            this.logger.info("Running ROLLBACK");

            if (!height || height <= 0) {
                this.logger.error(`Rollback height ${height.toString()} is invalid.`);
                return;
            }

            const lastBlock = await this.database.getLastBlock();

            Utils.assert.defined<Interfaces.IBlock>(lastBlock);

            const currentHeight = lastBlock.data.height;

            if (height >= currentHeight) {
                this.logger.error(`Rollback height ${height.toLocaleString()} is greater than the current height ${currentHeight.toLocaleString()}.`);
                return;
            }

            const roundInfo = Utils.roundCalculator.calculateRound(height);

            let newLastBlock = await this.database.rollbackChain(roundInfo);

            this.logger.info(
                `Rolling back chain to last finished round ${roundInfo.round.toLocaleString()} with last block height ${newLastBlock.data.height.toString()}`,
            );
        } catch (err) {
            this.logger.error("ROLLBACK failed")
            this.logger.error(err.toString())
        }
    }

    public async rollbackByNumber(number: number, backupTransactions: boolean): Promise<void> {
        this.logger.info("Running ROLLBACK by Number method inside SnapshotService");

        const lastBlock = await this.database.getLastBlock();

        return this.rollbackByHeight(lastBlock.data.height - number, backupTransactions);
    }

    public async truncate(): Promise<void> {
        try {
            this.logger.info("Running TRUNCATE");

            await this.database.truncate();
        } catch (err) {
            this.logger.error("TRUNCATE failed")
            this.logger.error(err.toString())
        }
    }

    public async test(options: any): Promise<void> {
        this.filesystem.setSnapshot(options.blocks);
        this.logger.info("Running TEST method inside SnapshotService");
        await this.database.test(options);
    }
}
