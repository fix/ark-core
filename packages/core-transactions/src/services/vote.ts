import { constants, ITransactionData, models } from "@arkecosystem/crypto";
import { AlreadyVotedError, NoVoteError, UnvoteMismatchError } from "../errors";
import { TransactionService } from "./transaction";

export class VoteTransactionService extends TransactionService {
    public getType(): number {
        return constants.TransactionTypes.Vote;
    }

    public canBeApplied(data: Readonly<ITransactionData>, wallet: models.Wallet): boolean {
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

        return super.canBeApplied(data, wallet);
    }

    public apply(data: Readonly<ITransactionData>, wallet: models.Wallet): void {
        const vote = data.asset.votes[0];
        if (vote.startsWith("+")) {
            wallet.vote = vote.slice(1);
        } else {
            wallet.vote = null;
        }
    }

    public revert(data: Readonly<ITransactionData>, wallet: models.Wallet): void {
        const vote = data.asset.votes[0];
        if (vote.startsWith("+")) {
            wallet.vote = null;
        } else {
            wallet.vote = vote.slice(1);
        }
    }
}
