import { ByteBuffer } from "../../../byte-buffer";
import { TransactionType, TransactionTypeGroup } from "../../../enums";
import { Address } from "../../../identities";
import { ISerializeOptions } from "../../../interfaces";
import { BigNumber } from "../../../utils/bignum";
import * as schemas from "../schemas";
import { Transaction } from "../transaction";

export abstract class TransferTransaction extends Transaction {
    public static typeGroup: number = TransactionTypeGroup.Core;
    public static type: number = TransactionType.Transfer;
    public static key = "transfer";
    public static version: number = 1;

    protected static defaultStaticFee: BigNumber = BigNumber.make("10000000");

    public static getSchema(): schemas.TransactionSchema {
        return schemas.transfer;
    }

    public hasVendorField(): boolean {
        return true;
    }

    public serialize(options?: ISerializeOptions): ByteBuffer | undefined {
        const { data } = this;
        const buffer: ByteBuffer = new ByteBuffer(Buffer.alloc(33));
        // @ts-ignore
        buffer.writeBigUInt64LE(data.amount.value);
        buffer.writeUInt32LE(data.expiration || 0);

        if (data.recipientId) {
            const { addressBuffer, addressError } = Address.toBuffer(data.recipientId);

            if (options) {
                options.addressError = addressError;
            }

            buffer.writeBuffer(addressBuffer);
        }

        return buffer;
    }

    public deserialize(buf: ByteBuffer): void {
        const { data } = this;
        data.amount = BigNumber.make(buf.readBigUInt64LE().toString());
        data.expiration = buf.readUInt32LE();
        data.recipientId = Address.fromBuffer(buf.readBuffer(21));
    }
}
