import { Transaction, TransactionFactory } from "../..";
import { Slots } from "../../../crypto";
import { MissingTransactionSignatureError } from "../../../errors";
import { Address, Keys } from "../../../identities";
import { IKeyPair, ITransaction, ITransactionData } from "../../../interfaces";
import { configManager } from "../../../managers";
import { NetworkType } from "../../../types";
import { BigNumber, maxVendorFieldLength, numberToHex } from "../../../utils";
import { Verifier } from "../../verifier";

export abstract class TransactionBuilder<TBuilder extends TransactionBuilder<TBuilder>> {
    public data: ITransactionData;

    protected signWithSenderAsRecipient: boolean = false;

    constructor() {
        this.data = {
            id: null,
            timestamp: Slots.getTime(),
            version: 0x01,
        } as ITransactionData;
    }

    public build(data: Partial<ITransactionData> = {}): ITransaction {
        return TransactionFactory.fromData({ ...this.data, ...data }, false);
    }

    public version(version: number): TBuilder {
        this.data.version = version;

        return this.instance();
    }

    public network(network: number): TBuilder {
        this.data.network = network;

        return this.instance();
    }

    public fee(fee: string): TBuilder {
        if (fee !== null) {
            this.data.fee = BigNumber.make(fee);
        }

        return this.instance();
    }

    public amount(amount: string): TBuilder {
        this.data.amount = BigNumber.make(amount);

        return this.instance();
    }

    public recipientId(recipientId: string): TBuilder {
        this.data.recipientId = recipientId;

        return this.instance();
    }

    public senderPublicKey(publicKey: string): TBuilder {
        this.data.senderPublicKey = publicKey;

        return this.instance();
    }

    public vendorField(vendorField: string): TBuilder {
        if (vendorField && Buffer.from(vendorField).length <= maxVendorFieldLength()) {
            this.data.vendorField = vendorField;
        }

        return this.instance();
    }

    public sign(passphrase: string): TBuilder {
        const keys: IKeyPair = Keys.fromPassphrase(passphrase);
        this.data.senderPublicKey = keys.publicKey;

        if (this.signWithSenderAsRecipient) {
            const pubKeyHash = this.data.network || configManager.get("network.pubKeyHash");
            this.data.recipientId = Address.fromPublicKey(Keys.fromPassphrase(passphrase).publicKey, pubKeyHash);
        }

        this.data.signature = Transaction.sign(this.getSigningObject(), keys);

        return this.instance();
    }

    public signWithWif(wif: string, networkWif?: number): TBuilder {
        const keys: IKeyPair = Keys.fromWIF(wif, {
            wif: networkWif || configManager.get("network.wif"),
        } as NetworkType);

        this.data.senderPublicKey = keys.publicKey;

        if (this.signWithSenderAsRecipient) {
            const pubKeyHash = this.data.network || configManager.get("network.pubKeyHash");

            this.data.recipientId = Address.fromPublicKey(keys.publicKey, pubKeyHash);
        }

        this.data.signature = Transaction.sign(this.getSigningObject(), keys);

        return this.instance();
    }

    public secondSign(secondPassphrase: string): TBuilder {
        this.data.secondSignature = Transaction.secondSign(
            this.getSigningObject(),
            Keys.fromPassphrase(secondPassphrase),
        );

        return this.instance();
    }

    public secondSignWithWif(wif: string, networkWif?: number): TBuilder {
        const keys = Keys.fromWIF(wif, {
            wif: networkWif || configManager.get("network.wif"),
        } as NetworkType);

        this.data.secondSignature = Transaction.secondSign(this.getSigningObject(), keys);

        return this.instance();
    }

    public multiSign(passphrase: string, index: number): TBuilder {
        if (!this.data.signatures) {
            this.data.signatures = [];
        }

        this.version(2);

        // TOOD: move to crypto?
        // TOOD: sanity checks (index < 16, etc.)

        const keys: IKeyPair = Keys.fromPassphrase(passphrase);
        const signature = Transaction.sign(this.getSigningObject(), keys, {
            excludeSignature: true,
            excludeSecondSignature: true,
            excludeMultiSignature: true,
        });

        const indexHex = numberToHex(index);
        this.data.signatures.push(`${indexHex}${signature}`);

        return this.instance();
    }

    public verify(): boolean {
        return Verifier.verifyHash(this.data);
    }

    public getStruct(): ITransactionData {
        if (!this.data.senderPublicKey || (!this.data.signature && !this.data.signatures)) {
            throw new MissingTransactionSignatureError();
        }

        const struct: ITransactionData = {
            id: Transaction.getId(this.data).toString(),
            signature: this.data.signature,
            secondSignature: this.data.secondSignature,
            timestamp: this.data.timestamp,
            version: this.data.version,
            type: this.data.type,
            fee: this.data.fee,
            senderPublicKey: this.data.senderPublicKey,
            network: this.data.network,
        } as ITransactionData;

        if (Array.isArray(this.data.signatures)) {
            struct.signatures = this.data.signatures;
        }

        return struct;
    }

    protected abstract instance(): TBuilder;

    private getSigningObject(): ITransactionData {
        const data: ITransactionData = { ...this.data };

        Object.keys(data).forEach(key => {
            if (["model", "network", "id"].includes(key)) {
                delete data[key];
            }
        });

        return data;
    }
}
