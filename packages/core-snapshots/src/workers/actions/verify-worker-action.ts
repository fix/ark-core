import { CryptoSuite } from "@arkecosystem/core-crypto";
import { Container } from "@arkecosystem/core-kernel";

import { AbstractWorkerAction } from "./abstract-worker-action";
import { ReadProcessor } from "./read-processor";

@Container.injectable()
export class VerifyWorkerAction extends AbstractWorkerAction {
    @Container.inject(Container.Identifiers.CryptoManager)
    private readonly cryptoManager!: CryptoSuite.CryptoManager;

    private readProcessor: ReadProcessor | undefined = undefined;

    public sync(data: any): void {
        this.readProcessor?.sync(data);
    }

    public async start() {
        const isBlock = this.table === "blocks";
        const streamReader = this.getStreamReader();
        const verify = this.getVerifyFunction();

        this.readProcessor = new ReadProcessor(
            this.cryptoManager,
            isBlock,
            streamReader,
            async (entity: any, previousEntity: any) => {
                if (isBlock) {
                    this.applyGenesisBlockFix(entity);
                }

                verify(entity, previousEntity);
            },
        );

        await this.readProcessor.start();
    }
}
