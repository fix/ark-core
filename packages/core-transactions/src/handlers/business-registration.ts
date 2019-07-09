import { ApplicationEvents } from "@arkecosystem/core-event-emitter";
import { Database, EventEmitter, TransactionPool } from "@arkecosystem/core-interfaces";
import { State } from "@arkecosystem/core-interfaces";
import { Interfaces, Transactions } from "@arkecosystem/crypto";
import { BigNumber } from "@arkecosystem/crypto/dist/utils";
import { BusinessRegistrationAssetError, WalletIsAlreadyABusiness } from "../errors";
import { TransactionHandler } from "./transaction";

export class BusinessRegistrationTransactionHandler extends TransactionHandler {
    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.BusinessRegistration;
    }

    public async bootstrap(connection: Database.IConnection, walletManager: State.IWalletManager): Promise<void> {
        const transactions = await connection.transactionsRepository.getAssetsByType(this.getConstructor().type);
        for (const transaction of transactions) {
            const wallet = walletManager.findByPublicKey(transaction.senderPublicKey);
            wallet.business = {
                lastHeight: BigNumber.make(0),
                businessRegistrationAsset: transaction.asset.businessRegistration,
            };
        }
    }

    public emitEvents(transaction: Interfaces.ITransaction, emitter: EventEmitter.EventEmitter): void {
        emitter.emit(ApplicationEvents.BusinessRegistered, transaction.data);
    }

    public throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: State.IWallet,
        databaseWalletManager: State.IWalletManager,
    ): void {
        const { data }: Interfaces.ITransaction = transaction;

        if (!data.asset.businessRegistration.name || !data.asset.businessRegistration.websiteAddress) {
            throw new BusinessRegistrationAssetError();
        }

        if (wallet.business) {
            throw new WalletIsAlreadyABusiness();
        }

        super.throwIfCannotBeApplied(transaction, wallet, databaseWalletManager);
    }

    public canEnterTransactionPool(
        data: Interfaces.ITransactionData,
        pool: TransactionPool.IConnection,
        processor: TransactionPool.IProcessor,
    ): boolean {
        if (this.typeFromSenderAlreadyInPool(data, pool, processor)) {
            return false;
        }

        const { name }: { name: string } = data.asset.businessRegistration;
        const businessRegistrationsSameNameInPayload = processor
            .getTransactions()
            .filter(tx => tx.type === this.getConstructor().type && tx.asset.businessRegistration.name === name);

        if (businessRegistrationsSameNameInPayload.length > 1) {
            processor.pushError(
                data,
                "ERR_CONFLICT",
                `Multiple business registrations for "${name}" in transaction payload`,
            );
            return false;
        }
        // TODO: more specific validation for transactions in pool?
        // currently looks just for name, maybe should for VAT also?
        const businessRegistrationsInPool: Interfaces.ITransactionData[] = Array.from(
            pool.getTransactionsByType(this.getConstructor().type),
        ).map((memTx: Interfaces.ITransaction) => memTx.data);
        const containsBusinessRegistrationForSameNameInPool: boolean = businessRegistrationsInPool.some(
            transaction => transaction.asset.businessRegistration.name === name,
        );
        if (containsBusinessRegistrationForSameNameInPool) {
            processor.pushError(data, "ERR_PENDING", `Business registration for "${name}" already in the pool`);
            return false;
        }

        return true;
    }

    public applyToSender(transaction: Interfaces.ITransaction, walletManager: State.IWalletManager): void {
        super.applyToSender(transaction, walletManager);
        const sender: State.IWallet = walletManager.findByPublicKey(transaction.data.senderPublicKey);
        sender.business = {
            lastHeight: BigNumber.make(0), // just as a placeholder before we decide how to add height
            businessRegistrationAsset: transaction.data.asset.businessRegistration,
        };
        walletManager.reindex(sender);
    }

    public revertForSender(transaction: Interfaces.ITransaction, walletManager: State.IWalletManager): void {
        super.revertForSender(transaction, walletManager);
        const sender: State.IWallet = walletManager.findByPublicKey(transaction.data.senderPublicKey);
        sender.business = undefined;
    }

    public applyToRecipient(transaction: Interfaces.ITransaction, walletManager: State.IWalletManager): void {
        return;
    }

    public revertForRecipient(transaction: Interfaces.ITransaction, walletManager: State.IWalletManager): void {
        return;
    }
}
