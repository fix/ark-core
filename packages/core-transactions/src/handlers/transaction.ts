// tslint:disable:max-classes-per-file

import { Database, EventEmitter, TransactionPool } from "@arkecosystem/core-interfaces";
import { Enums, Identities, Interfaces, Managers, Transactions } from "@arkecosystem/crypto";
import {
    InsufficientBalanceError,
    InvalidMultiSignatureError,
    InvalidSecondSignatureError,
    SenderWalletMismatchError,
    UnexpectedSecondSignatureError,
} from "../errors";
import { ITransactionHandler } from "../interfaces";

export abstract class TransactionHandler implements ITransactionHandler {
    // TODO: merge with canBeApplied ?
    // just a quick hack to get multi sig working
    public verify(transaction: Interfaces.ITransaction, walletManager: Database.IWalletManager): boolean {
        const { data } = transaction;
        const senderWallet = walletManager.findByPublicKey(data.senderPublicKey);
        if (senderWallet.multisignature) {
            transaction.isVerified = senderWallet.verifySignatures(data);
        }

        return transaction.isVerified;
    }

    public abstract getConstructor(): Transactions.TransactionConstructor;

    /**
     * Wallet logic
     */
    public canBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Database.IWallet,
        walletManager?: Database.IWalletManager,
    ): boolean {
        // NOTE: Checks if it can be applied based on sender wallet
        // could be merged with `apply` so they are coupled together :thinking_face:

        const { data } = transaction;
        if (wallet.multisignature) {
            if (!wallet.verifySignatures(data, wallet.multisignature)) {
                throw new InvalidMultiSignatureError();
            }
        }

        if (
            wallet.balance
                .minus(data.amount)
                .minus(data.fee)
                .isLessThan(0)
        ) {
            throw new InsufficientBalanceError();
        }

        if (data.senderPublicKey !== wallet.publicKey) {
            throw new SenderWalletMismatchError();
        }

        if (wallet.secondPublicKey) {
            if (!Transactions.Verifier.verifySecondSignature(data, wallet.secondPublicKey)) {
                throw new InvalidSecondSignatureError();
            }
        } else {
            if (data.secondSignature || data.signSignature) {
                // Accept invalid second signature fields prior the applied patch.
                // NOTE: only applies to devnet.
                if (!Managers.configManager.getMilestone().ignoreInvalidSecondSignatureField) {
                    throw new UnexpectedSecondSignatureError();
                }
            }
        }

        return true;
    }

    public applyToSender(transaction: Interfaces.ITransaction, wallet: Database.IWallet): void {
        const { data } = transaction;
        if (
            data.senderPublicKey === wallet.publicKey ||
            Identities.Address.fromPublicKey(data.senderPublicKey) === wallet.address
        ) {
            wallet.balance = wallet.balance.minus(data.amount).minus(data.fee);

            this.apply(transaction, wallet);
        }
    }

    public applyToRecipient(transaction: Interfaces.ITransaction, wallet: Database.IWallet): void {
        const { data } = transaction;
        if (data.recipientId === wallet.address) {
            wallet.balance = wallet.balance.plus(data.amount);
        }
    }

    public revertForSender(transaction: Interfaces.ITransaction, wallet: Database.IWallet): void {
        const { data } = transaction;
        if (
            data.senderPublicKey === wallet.publicKey ||
            Identities.Address.fromPublicKey(data.senderPublicKey) === wallet.address
        ) {
            wallet.balance = wallet.balance.plus(data.amount).plus(data.fee);

            this.revert(transaction, wallet);
        }
    }

    public revertForRecipient(transaction: Interfaces.ITransaction, wallet: Database.IWallet): void {
        const { data } = transaction;
        if (data.recipientId === wallet.address) {
            wallet.balance = wallet.balance.minus(data.amount);
        }
    }

    public abstract apply(transaction: Interfaces.ITransaction, wallet: Database.IWallet): void;
    public abstract revert(transaction: Interfaces.ITransaction, wallet: Database.IWallet): void;

    /**
     * Database Service
     */
    // tslint:disable-next-line:no-empty
    public emitEvents(transaction: Interfaces.ITransaction, emitter: EventEmitter.EventEmitter): void {}

    /**
     * Transaction Pool logic
     */
    public canEnterTransactionPool(
        data: Interfaces.ITransactionData,
        pool: TransactionPool.IConnection,
        processor: TransactionPool.IProcessor,
    ): boolean {
        processor.pushError(
            data,
            "ERR_UNSUPPORTED",
            `Invalidating transaction of unsupported type '${Enums.TransactionTypes[data.type]}'`,
        );
        return false;
    }

    protected typeFromSenderAlreadyInPool(
        data: Interfaces.ITransactionData,
        pool: TransactionPool.IConnection,
        processor: TransactionPool.IProcessor,
    ): boolean {
        const { senderPublicKey, type } = data;

        if (pool.senderHasTransactionsOfType(senderPublicKey, type)) {
            processor.pushError(
                data,
                "ERR_PENDING",
                `Sender ${senderPublicKey} already has a transaction of type '${
                    Enums.TransactionTypes[type]
                }' in the pool`,
            );

            return true;
        }

        return false;
    }

    protected secondSignatureRegistrationFromSenderAlreadyInPool(
        data: Interfaces.ITransactionData,
        pool: TransactionPool.IConnection,
        processor: TransactionPool.IProcessor,
    ): boolean {
        const { senderPublicKey } = data;
        if (pool.senderHasTransactionsOfType(senderPublicKey, Enums.TransactionTypes.SecondSignature)) {
            processor.pushError(
                data,
                "ERR_PENDING",
                `Cannot accept transaction from sender ${senderPublicKey} while its second signature registration is in the pool`,
            );

            return true;
        }

        return false;
    }
}
