// tslint:disable:max-classes-per-file

import { configManager, crypto, ITransactionData, models } from "@arkecosystem/crypto";
import {
    InsufficientBalanceError,
    InvalidSecondSignatureError,
    SenderWalletMismatchError,
    UnexpectedMultiSignatureError,
    UnexpectedSecondSignatureError,
} from "../errors";
import { ITransactionService } from "../interfaces";

export abstract class TransactionService implements ITransactionService {
    public abstract getType(): number;

    /**
     * Wallet logic
     */
    public canBeApplied(data: Readonly<ITransactionData>, wallet: models.Wallet): boolean {
        // NOTE: Checks if it can be applied based on sender wallet
        // could be merged with `apply` so they are coupled together :thinking_face:

        if (wallet.multisignature) {
            throw new UnexpectedMultiSignatureError();
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
            if (!crypto.verifySecondSignature(data, wallet.secondPublicKey)) {
                throw new InvalidSecondSignatureError();
            }
        } else {
            if (data.secondSignature || data.signSignature) {
                // Accept invalid second signature fields prior the applied patch.
                // NOTE: only applies to devnet.
                if (!configManager.getMilestone().ignoreInvalidSecondSignatureField) {
                    throw new UnexpectedSecondSignatureError();
                }
            }
        }

        return true;
    }

    public applyToSender(data: Readonly<ITransactionData>, wallet: models.Wallet): void {
        if (data.senderPublicKey === wallet.publicKey || crypto.getAddress(data.senderPublicKey) === wallet.address) {
            wallet.balance = wallet.balance.minus(data.amount).minus(data.fee);

            this.apply(data, wallet);

            wallet.dirty = true;
        }
    }

    public applyToRecipient(data: Readonly<ITransactionData>, wallet: models.Wallet): void {
        if (data.recipientId === wallet.address) {
            wallet.balance = wallet.balance.plus(data.amount);
            wallet.dirty = true;
        }
    }

    public revertForSender(data: Readonly<ITransactionData>, wallet: models.Wallet): void {
        if (data.senderPublicKey === wallet.publicKey || crypto.getAddress(data.senderPublicKey) === wallet.address) {
            wallet.balance = wallet.balance.plus(data.amount).plus(data.fee);

            this.revert(data, wallet);

            wallet.dirty = true;
        }
    }

    public revertForRecipient(data: Readonly<ITransactionData>, wallet: models.Wallet): void {
        if (data.recipientId === wallet.address) {
            wallet.balance = wallet.balance.minus(data.amount);
            wallet.dirty = true;
        }
    }

    public abstract apply(data: Readonly<ITransactionData>, wallet: models.Wallet): void;
    public abstract revert(data: Readonly<ITransactionData>, wallet: models.Wallet): void;
}
