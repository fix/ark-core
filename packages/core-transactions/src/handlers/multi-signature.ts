import { Database, TransactionPool } from "@arkecosystem/core-interfaces";
import { Identities, Interfaces, Transactions, Utils } from "@arkecosystem/crypto";
import {
    InvalidMultiSignatureError,
    MultiSignatureAlreadyRegisteredError,
    MultiSignatureKeyCountMismatchError,
    MultiSignatureMinimumKeysError,
} from "../errors";
import { TransactionHandler } from "./transaction";

export class MultiSignatureTransactionHandler extends TransactionHandler {
    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.MultiSignatureRegistrationTransaction;
    }

    // TODO: only pass walletManager and let tx fetch wallet itself
    public canBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Database.IWallet,
        walletManager?: Database.IWalletManager,
    ): boolean {
        const { data } = transaction;
        if (Utils.isException(data)) {
            return true;
        }

        const { publicKeys, min } = data.asset.multiSignature;
        if (min < 1 || min > publicKeys.length) {
            throw new MultiSignatureMinimumKeysError();
        }

        if (publicKeys.length !== data.signatures.length) {
            throw new MultiSignatureKeyCountMismatchError();
        }

        const multiSigAddress = Identities.Address.fromMultiSignatureAsset(data.asset.multiSignature);

        const recipientWallet = walletManager.findByAddress(multiSigAddress);
        if (recipientWallet.multisignature) {
            throw new MultiSignatureAlreadyRegisteredError();
        }

        if (!wallet.verifySignatures(data, data.asset.multiSignature)) {
            throw new InvalidMultiSignatureError();
        }

        return super.canBeApplied(transaction, wallet, walletManager);
    }

    public canEnterTransactionPool(
        data: Interfaces.ITransactionData,
        pool: TransactionPool.IConnection,
        processor: TransactionPool.IProcessor,
    ): boolean {
        return !this.typeFromSenderAlreadyInPool(data, pool, processor);
    }

    protected applyToSender(transaction: Interfaces.ITransaction, walletManager: Database.IWalletManager): void {
        super.applyToSender(transaction, walletManager);

        // Nothing else to do for the sender since the recipient wallet
        // is made into a multi sig wallet.
    }

    protected revertForSender(transaction: Interfaces.ITransaction, walletManager: Database.IWalletManager): void {
        super.revertForSender(transaction, walletManager);
        // Nothing else to do for the sender since the recipient wallet
        // is made into a multi sig wallet.
    }

    protected applyToRecipient(transaction: Interfaces.ITransaction, walletManager: Database.IWalletManager): void {
        const { data } = transaction;
        if (data.version >= 2) {
            const recipientAddress = Identities.Address.fromMultiSignatureAsset(data.asset.multiSignature);
            const recipient = walletManager.findByAddress(recipientAddress);
            recipient.multisignature = transaction.data.asset.multiSignature;
        }
    }

    protected revertForRecipient(transaction: Interfaces.ITransaction, walletManager: Database.IWalletManager): void {
        const { data } = transaction;
        if (data.version >= 2) {
            const recipientAddress = Identities.Address.fromMultiSignatureAsset(data.asset.multiSignature);
            const recipient = walletManager.findByAddress(recipientAddress);
            recipient.multisignature = null;
        }
    }
}
