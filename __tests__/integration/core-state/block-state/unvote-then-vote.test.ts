import { Application, Container, Contracts } from "@arkecosystem/core-kernel";
import { Utils, Transactions } from "@arkecosystem/crypto";
import { delegates } from "@arkecosystem/core-test-framework";
import { BIP39 } from "../../../../packages/core-forger/src/methods/bip39";

import { setUp, tearDown } from "../__support__/setup";

let app: Application;

beforeAll(async () => {
    app = await setUp();
});

afterAll(async () => {
    await tearDown();
});

test("BlockState handling unvote, vote transactions", async () => {
    const stateStore = app.get<Contracts.State.StateStore>(Container.Identifiers.StateStore);

    const blockState = app.getTagged<Contracts.State.BlockState>(
        Container.Identifiers.BlockState,
        "state",
        "blockchain",
    );

    const walletRepository = app.getTagged<Contracts.State.WalletRepository>(
        Container.Identifiers.WalletRepository,
        "state",
        "blockchain",
    );

    const unvoteTransaction = Transactions.BuilderFactory.vote()
        .votesAsset([`-${delegates[2].publicKey}`])
        .nonce("3")
        .fee("100")
        .sign(delegates[2].passphrase)
        .build();

    const voteTransaction = Transactions.BuilderFactory.vote()
        .votesAsset([`+${delegates[2].publicKey}`])
        .nonce("4")
        .fee("100")
        .sign(delegates[2].passphrase)
        .build();

    const bip39 = new BIP39(delegates[1].passphrase);

    const block1 = stateStore.getLastBlock();

    const block2 = bip39.forge([unvoteTransaction.data], {
        timestamp: block1.data.timestamp + 60,
        previousBlock: block1.data,
        reward: Utils.BigNumber.make("100"),
    });

    const block3 = bip39.forge([voteTransaction.data], {
        timestamp: block2.data.timestamp + 60,
        previousBlock: block2.data,
        reward: Utils.BigNumber.make("100"),
    });

    const delegate2 = walletRepository.findByPublicKey(delegates[2].publicKey);

    expect(delegate2.getAttribute("delegate.voteBalance").toFixed()).toBe("300000000000000");

    await blockState.applyBlock(block2);

    expect(delegate2.getAttribute("delegate.voteBalance").toFixed()).toBe("0");

    await blockState.applyBlock(block3);

    expect(delegate2.getAttribute("delegate.voteBalance").toFixed()).toBe("299999999999800");

    await blockState.revertBlock(block3);

    expect(delegate2.getAttribute("delegate.voteBalance").toFixed()).toBe("0");

    await blockState.revertBlock(block2);

    expect(delegate2.getAttribute("delegate.voteBalance").toFixed()).toBe("300000000000000");
});
