import { TransactionPool } from "@arkecosystem/core-interfaces";
import { constants, ITransactionData, models, Transaction } from "@arkecosystem/crypto";
import { AlreadyVotedError, NoVoteError, UnvoteMismatchError } from "../errors";
import { TransactionService } from "./transaction";

export class VoteTransactionService extends TransactionService {
    public getType(): number {
        return constants.TransactionTypes.Vote;
    }

    public canBeApplied(transaction: Transaction, wallet: models.Wallet): boolean {
        const { data } = transaction;
        const vote = data.asset.votes[0];
        if (vote.startsWith("+")) {
            if (wallet.vote) {
                throw new AlreadyVotedError();
            }
        } else {
            if (!wallet.vote) {
                throw new NoVoteError();
            } else if (wallet.vote !== vote.slice(1)) {
                throw new UnvoteMismatchError();
            }
        }

        return super.canBeApplied(transaction, wallet);
    }

    public apply(transaction: Transaction, wallet: models.Wallet): void {
        const { data } = transaction;
        const vote = data.asset.votes[0];
        if (vote.startsWith("+")) {
            wallet.vote = vote.slice(1);
        } else {
            wallet.vote = null;
        }
    }

    public revert(transaction: Transaction, wallet: models.Wallet): void {
        const { data } = transaction;
        const vote = data.asset.votes[0];
        if (vote.startsWith("+")) {
            wallet.vote = null;
        } else {
            wallet.vote = vote.slice(1);
        }
    }

    public canEnterTransactionPool(data: ITransactionData, guard: TransactionPool.ITransactionGuard): boolean {
        return !this.typeFromSenderAlreadyInPool(data, guard);
    }
}
