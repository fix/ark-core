import ByteBuffer from "bytebuffer";
import { createHash } from "crypto";
import cloneDeepWith from "lodash/cloneDeepWith";
import pluralize from "pluralize";
import { crypto, slots } from "../crypto";
import { BlockDeserializer } from "../deserializers";
import { configManager } from "../managers/config";
import { Bignum } from "../utils";
import { ITransactionData, Transaction } from "./transaction";



export interface IBlockData {
    blockSignature: string;
    id: string;
    idHex: string;
    timestamp: number;
    version: number;
    height: number;
    previousBlockHex: string;
    previousBlock: string;
    numberOfTransactions: number;
    totalAmount: Bignum;
    totalFee: Bignum;
    reward: Bignum;
    payloadLength: number;
    payloadHash: string;
    generatorPublicKey: string;

    headerOnly: boolean;
    serialized: any;

    transactions: ITransactionData[];
    transactionIds: any;
    verification: { verified: boolean; errors: any[] };
}

/**
 * TODO copy some parts to ArkDocs
 * @classdesc This model holds the block data, its verification and serialization
 *
 * A Block model stores on the db:
 *   - id
 *   - version (version of the block: could be used for changing how they are forged)
 *   - timestamp (related to the genesis block)
 *   - previousBlock (id of the previous block)
 *   - height
 *   - numberOfTransactions
 *   - totalAmount (in arktoshi)
 *   - totalFee (in arktoshi)
 *   - reward (in arktoshi)
 *   - payloadHash (hash of the transactions)
 *   - payloadLength (total length in bytes of the IDs of the transactions)
 *   - generatorPublicKey (public key of the delegate that forged this block)
 *   - blockSignature
 *
 * The `transactions` are stored too, but in a different table.
 *
 * These data is exposed through the `data` attributed as a plain object and
 * serialized through the `serialized` attribute.
 *
 * In the future the IDs could be changed to use the hexadecimal version of them,
 * which would be more efficient for performance, disk usage and bandwidth reasons.
 * That is why there are some attributes, such as `idHex` and `previousBlockHex`.
 */

export class Block {
    /**
     * Create block from data.
     * @param  {Object} data
     * @param  {Object} keys
     * @return {Block}
     * @static
     */
    public static create(data, keys) {
        data.generatorPublicKey = keys.publicKey;

        const payloadHash: any = Block.serialize(data, false);
        const hash = createHash("sha256")
            .update(payloadHash)
            .digest();

        data.blockSignature = crypto.signHash(hash, keys);
        data.id = Block.getId(data);

        return new Block(data);
    }

    /*
     * Get block id
     * @param  {Object} data
     * @return {String}
     * @static
     */
    public static getIdHex(data) {
        const payloadHash: any = Block.serialize(data, true);
        const hash = createHash("sha256")
            .update(payloadHash)
            .digest();
        const temp = Buffer.alloc(8);

        for (let i = 0; i < 8; i++) {
            temp[i] = hash[7 - i];
        }
        return temp.toString("hex");
    }


    public static toBytesHex(data) {
        const temp = data ? new Bignum(data).toString(16) : "";
        return "0".repeat(16 - temp.length) + temp;
    };

    /**
     * Get block id from already serialized buffer
     * @param  {Buffer} serialized block buffer with block-signature included
     * @return {String}
     * @static
     */
    public static getIdFromSerialized(serializedBuffer) {
        const hash = createHash("sha256")
            .update(serializedBuffer)
            .digest();
        const temp = Buffer.alloc(8);

        for (let i = 0; i < 8; i++) {
            temp[i] = hash[7 - i];
        }
        return new Bignum(temp.toString("hex"), 16).toFixed();
    }

    public static getId(data) {
        const idHex = Block.getIdHex(data);
        return new Bignum(idHex, 16).toFixed();
    }

    /**
     * Deserialize block from hex string.
     * @param  {String} hexString
     * @param  {Boolean} headerOnly - deserialize onlu headers
     * @return {Object}
     * @static
     */
    public static deserialize(hexString, headerOnly = false): IBlockData {
        return BlockDeserializer.deserialize(hexString, headerOnly);
    }

    /**
     * Serialize block.
     * @param  {Object} data
     * @return {Buffer}
     * @static
     */
    public static serializeFull(block) {
        const serializedBlock: any = Block.serialize(block, true);
        const transactions = block.transactions;

        const buf = new ByteBuffer(serializedBlock.length + transactions.length * 4, true)
            .append(serializedBlock)
            .skip(transactions.length * 4);

        for (let i = 0; i < transactions.length; i++) {
            const serialized: any = Transaction.serialize(transactions[i]);
            buf.writeUint32(serialized.length, serializedBlock.length + i * 4);
            buf.append(serialized);
        }

        return buf.flip().toBuffer();
    }

    /**
     * Serialize block
     * TODO split this method between bufferize (as a buffer) and serialize (as hex)
     * @param  {Object} block
     * @param  {(Boolean|undefined)} includeSignature
     * @return {Buffer}
     * @static
     */
    public static serialize(block, includeSignature = true) {
        block.previousBlockHex = this.toBytesHex(block.previousBlock);

        const bb = new ByteBuffer(256, true);
        bb.writeUint32(block.version);
        bb.writeUint32(block.timestamp);
        bb.writeUint32(block.height);
        bb.append(block.previousBlockHex, "hex");
        bb.writeUint32(block.numberOfTransactions);
        bb.writeUint64(+new Bignum(block.totalAmount).toFixed());
        bb.writeUint64(+new Bignum(block.totalFee).toFixed());
        bb.writeUint64(+new Bignum(block.reward).toFixed());
        bb.writeUint32(block.payloadLength);
        bb.append(block.payloadHash, "hex");
        bb.append(block.generatorPublicKey, "hex");

        if (includeSignature && block.blockSignature) {
            bb.append(block.blockSignature, "hex");
        }

        bb.flip();
        return bb.toBuffer();
    }

    public static getBytesV1(block, includeSignature) {
        if (includeSignature === undefined) {
            includeSignature = block.blockSignature !== undefined;
        }

        let size = 4 + 4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 33;
        let blockSignatureBuffer = null;

        if (includeSignature) {
            blockSignatureBuffer = Buffer.from(block.blockSignature, "hex");
            size += blockSignatureBuffer.length;
        }

        let b;

        try {
            const bb = new ByteBuffer(size, true);
            bb.writeInt(block.version);
            bb.writeInt(block.timestamp);
            bb.writeInt(block.height);

            let i;

            if (block.previousBlock) {
                const pb = Buffer.from(new Bignum(block.previousBlock).toString(16), "hex");

                for (i = 0; i < 8; i++) {
                    bb.writeByte(pb[i]);
                }
            } else {
                for (i = 0; i < 8; i++) {
                    bb.writeByte(0);
                }
            }

            bb.writeInt(block.numberOfTransactions);
            bb.writeInt64(+block.totalAmount.toFixed());
            bb.writeInt64(+block.totalFee.toFixed());
            bb.writeInt64(+block.reward.toFixed());

            bb.writeInt(block.payloadLength);

            const payloadHashBuffer = Buffer.from(block.payloadHash, "hex");
            for (i = 0; i < payloadHashBuffer.length; i++) {
                bb.writeByte(payloadHashBuffer[i]);
            }

            const generatorPublicKeyBuffer = Buffer.from(block.generatorPublicKey, "hex");
            for (i = 0; i < generatorPublicKeyBuffer.length; i++) {
                bb.writeByte(generatorPublicKeyBuffer[i]);
            }

            if (includeSignature) {
                for (i = 0; i < blockSignatureBuffer.length; i++) {
                    bb.writeByte(blockSignatureBuffer[i]);
                }
            }

            bb.flip();
            b = bb.toBuffer();
        } catch (e) {
            throw e;
        }

        return b;
    }
    public blockSignature: string;
    public id: string;
    public idHex: string;
    public timestamp: number;
    public version: number;
    public height: number;
    public previousBlockHex: string;
    public previousBlock: string;
    public numberOfTransactions: number;
    public totalAmount: Bignum;
    public totalFee: Bignum;
    public reward: Bignum;
    public payloadLength: number;
    public payloadHash: string;
    public generatorPublicKey: string;

    public headerOnly: boolean;
    public serialized: any;

    public data: IBlockData;
    public genesis: boolean;
    public transactions: any;
    public transactionIds: any;
    public verification: { verified: boolean; errors: any[] };

    /**
     * @constructor
     * @param {Object} data - The data of the block
     */
    constructor(data) {
        if (typeof data === "string") {
            data = Block.deserialize(data);
        }

        if (!data.transactions) {
            data.transactions = [];
        }
        if (data.numberOfTransactions > 0 && data.transactions.length === data.numberOfTransactions) {
            delete data.transactionIds;
        }

        this.headerOnly =
            data.numberOfTransactions > 0 &&
            data.transactionIds &&
            data.transactionIds.length === data.numberOfTransactions;
        if (this.headerOnly) {
            // @ts-ignore
            this.serialized = Block.serialize(data).toString("hex");
        } else {
            // @ts-ignore
            this.serialized = Block.serializeFull(data).toString("hex");
        }
        this.data = Block.deserialize(this.serialized);

        // fix on real timestamp, this is overloading transaction
        // timestamp with block timestamp for storage only
        // also add sequence to keep database sequence
        this.transactions = this.data.transactions.map((transaction, index) => {
            transaction.blockId = this.data.id;
            transaction.timestamp = this.data.timestamp;
            transaction.sequence = index;
            return transaction;
        });

        delete this.data.transactions;
        if (data.transactionIds && data.transactionIds.length > 0) {
            this.transactionIds = data.transactionIds;
        }

        this.verification = this.verify();

        // order of transactions messed up in mainnet V1
        // TODO: move this to network constants exception using block ids
        if (
            this.transactions &&
            this.data.numberOfTransactions === 2 &&
            (this.data.height === 3084276 || this.data.height === 34420)
        ) {
            const temp = this.transactions[0];
            this.transactions[0] = this.transactions[1];
            this.transactions[1] = temp;
        }
    }

    /**
     * Return block as string.
     * @return {String}
     */
    public toString() {
        return `${this.data.id}, height: ${this.data.height.toLocaleString()}, ${pluralize(
            "transaction",
            this.data.numberOfTransactions,
            true,
        )}, verified: ${this.verification.verified}, errors: ${this.verification.errors}`;
    }

    /**
     * Get header from block.
     * @return {Object} The block data, without the transactions
     */
    public getHeader() {
        const header = Object.assign({}, this.data);
        delete header.transactions;
        return header;
    }

    /**
     * Verify signature associated with this block.
     * @return {Boolean}
     */
    public verifySignature() {
        const bytes: any = Block.serialize(this.data, false);
        const hash = createHash("sha256")
            .update(bytes)
            .digest();

        return crypto.verifyHash(hash, this.data.blockSignature, this.data.generatorPublicKey);
    }

    /**
     * Verify this block.
     * @return {Object}
     */
    public verify() {
        const block = this.data;
        const result = {
            verified: false,
            errors: [],
        };

        try {
            const constants = configManager.getMilestone(block.height);

            if (block.height !== 1) {
                if (!block.previousBlock) {
                    result.errors.push("Invalid previous block");
                }
            }

            if (!block.reward.isEqualTo(constants.reward)) {
                result.errors.push(["Invalid block reward:", block.reward, "expected:", constants.reward].join(" "));
            }

            const valid = this.verifySignature();

            if (!valid) {
                result.errors.push("Failed to verify block signature");
            }

            if (block.version !== constants.block.version) {
                result.errors.push("Invalid block version");
            }

            if (slots.getSlotNumber(block.timestamp) > slots.getSlotNumber()) {
                result.errors.push("Invalid block timestamp");
            }

            // Disabling to allow orphanedBlocks?
            // if(previousBlock){
            //   const lastBlockSlotNumber = slots.getSlotNumber(previousBlock.timestamp)
            //   if(blockSlotNumber < lastBlockSlotNumber) {
            //      result.errors.push('block timestamp is smaller than previous block timestamp')
            //   }
            // }

            let size = 0;
            const payloadHash = createHash("sha256");

            if (this.headerOnly) {
                if (this.transactionIds.length !== block.numberOfTransactions) {
                    result.errors.push("Invalid number of transactions");
                }

                if (this.transactionIds.length > constants.block.maxTransactions) {
                    if (block.height > 1) {
                        result.errors.push("Transactions length is too high");
                    }
                }

                // Checking if transactions of the block adds up to block values.
                const appliedTransactions = {};
                this.transactionIds.forEach(id => {
                    const bytes = Buffer.from(id, "hex");

                    if (appliedTransactions[id]) {
                        result.errors.push(`Encountered duplicate transaction: ${id}`);
                    }

                    appliedTransactions[id] = id;
                    size += bytes.length;

                    payloadHash.update(bytes);
                });
            } else {
                const invalidTransactions = this.transactions.filter(tx => !tx.verified);
                if (invalidTransactions.length > 0) {
                    result.errors.push("One or more transactions are not verified:");
                    invalidTransactions.forEach(tx => result.errors.push(`=> ${tx.serialized}`));
                }

                if (this.transactions.length !== block.numberOfTransactions) {
                    result.errors.push("Invalid number of transactions");
                }

                if (this.transactions.length > constants.block.maxTransactions) {
                    if (block.height > 1) {
                        result.errors.push("Transactions length is too high");
                    }
                }

                // Checking if transactions of the block adds up to block values.
                const appliedTransactions = {};
                let totalAmount = Bignum.ZERO;
                let totalFee = Bignum.ZERO;
                this.transactions.forEach(transaction => {
                    const bytes = Buffer.from(transaction.data.id, "hex");

                    if (appliedTransactions[transaction.data.id]) {
                        result.errors.push(`Encountered duplicate transaction: ${transaction.data.id}`);
                    }

                    appliedTransactions[transaction.data.id] = transaction.data;

                    totalAmount = totalAmount.plus(transaction.data.amount);
                    totalFee = totalFee.plus(transaction.data.fee);
                    size += bytes.length;

                    payloadHash.update(bytes);
                });

                if (!totalAmount.isEqualTo(block.totalAmount)) {
                    result.errors.push("Invalid total amount");
                }

                if (!totalFee.isEqualTo(block.totalFee)) {
                    result.errors.push("Invalid total fee");
                }
            }

            if (size > constants.block.maxPayload) {
                result.errors.push("Payload is too large");
            }

            if (payloadHash.digest().toString("hex") !== block.payloadHash) {
                result.errors.push("Invalid payload hash");
            }
        } catch (error) {
            result.errors.push(error);
        }

        result.verified = result.errors.length === 0;

        return result;
    }

    public toJson() {
        // Convert Bignums
        const blockData = cloneDeepWith(this.data, (value, key: string) => {
            if (["reward", "totalAmount", "totalFee"].indexOf(key) !== -1) {
                return +value.toFixed();
            }

            return value;
        });

        return Object.assign(blockData, {
            transactions: this.transactions.map(transaction => transaction.toJson()),
        });
    }
}
