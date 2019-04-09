// tslint:disable:member-ordering
import { TransactionRegistry } from "..";
import { crypto } from "../../crypto";
import { TransactionTypes } from "../../enums";
import {
    MalformedTransactionBytesError,
    NotImplementedError,
    TransactionSchemaError,
    TransactionVersionError,
} from "../../errors";
import { ISchemaValidationResult, ITransactionData } from "../../interfaces";
import { Bignum, isException } from "../../utils";
import { AjvWrapper } from "../../validation";
import { deserializer } from "../deserializer";
import { Serializer } from "../serializer";
import { TransactionSchema } from "./schemas";

export abstract class Transaction {
    public static type: TransactionTypes = null;

    public static fromHex(hex: string): Transaction {
        return this.fromSerialized(hex);
    }

    public static fromBytes(buffer: Buffer): Transaction {
        return this.fromSerialized(buffer);
    }

    /**
     * Deserializes a transaction from `buffer` with the given `id`. It is faster
     * than `fromBytes` at the cost of vital safety checks (validation, verification and id calculation).
     *
     * NOTE: Only use this internally when it is safe to assume the buffer has already been
     * verified.
     */
    public static fromBytesUnsafe(buffer: Buffer, id?: string): Transaction {
        try {
            const transaction = deserializer.deserialize(buffer);
            transaction.data.id = id || crypto.getId(transaction.data);
            transaction.isVerified = true;

            return transaction;
        } catch (error) {
            throw new MalformedTransactionBytesError();
        }
    }

    private static fromSerialized(serialized: string | Buffer): Transaction {
        try {
            const transaction = deserializer.deserialize(serialized);
            transaction.data.id = crypto.getId(transaction.data);

            const { value, error } = this.validateSchema(transaction.data, true);
            if (error !== null && !isException(value)) {
                throw new TransactionSchemaError(error);
            }

            transaction.isVerified = transaction.verify();
            return transaction;
        } catch (error) {
            if (error instanceof TransactionVersionError || error instanceof TransactionSchemaError) {
                throw error;
            }

            throw new MalformedTransactionBytesError();
        }
    }

    public static fromData(data: ITransactionData, strict: boolean = true): Transaction {
        const { value, error } = this.validateSchema(data, strict);
        if (error !== null && !isException(value)) {
            throw new TransactionSchemaError(error);
        }

        const transaction = TransactionRegistry.create(value);
        deserializer.applyV1Compatibility(transaction.data); // TODO: generalize this kinda stuff
        Serializer.serialize(transaction);

        data.id = crypto.getId(data);
        transaction.isVerified = transaction.verify();

        return transaction;
    }

    public static toBytes(data: ITransactionData): Buffer {
        const transaction = TransactionRegistry.create(data);
        return Serializer.serialize(transaction);
    }

    public get id(): string {
        return this.data.id;
    }

    public get type(): TransactionTypes {
        return this.data.type;
    }

    private isVerified: boolean;
    public get verified(): boolean {
        return this.isVerified;
    }

    public data: ITransactionData;
    public serialized: Buffer;
    public timestamp: number;

    /**
     * Serde
     */
    public abstract serialize(): ByteBuffer;
    public abstract deserialize(buf: ByteBuffer): void;

    /**
     * Misc
     */
    protected verify(): boolean {
        const { data } = this;
        if (isException(data)) {
            return true;
        }

        if (data.type >= 4 && data.type <= 99) {
            return false;
        }

        return crypto.verify(data);
    }

    public toJson() {
        const data = Object.assign({}, this.data);
        data.amount = +(data.amount as Bignum).toFixed();
        data.fee = +(data.fee as Bignum).toFixed();

        if (data.vendorFieldHex === null) {
            delete data.vendorFieldHex;
        }

        return data;
    }

    public hasVendorField(): boolean {
        return false;
    }

    /**
     * Schema
     */
    public static getSchema(): TransactionSchema {
        throw new NotImplementedError();
    }

    private static validateSchema(data: ITransactionData, strict: boolean): ISchemaValidationResult {
        // FIXME: legacy type 4 need special treatment
        if (data.type === TransactionTypes.MultiSignature) {
            data.amount = new Bignum(data.amount);
            data.fee = new Bignum(data.fee);
            return { value: data, error: null };
        }

        const { $id } = TransactionRegistry.get(data.type).getSchema();
        return AjvWrapper.validate(strict ? `${$id}Strict` : `${$id}`, data);
    }
}
