import { crypto, HashAlgorithms, slots } from "../crypto";
import { BlockSchemaError } from "../errors";
import { IBlock, IBlockData, IBlockJson, IBlockVerification, ITransaction, ITransactionData } from "../interfaces";
import { configManager } from "../managers/config";
import { BigNumber, isException } from "../utils";
import { validator } from "../validation";
import { deserializer } from "./deserializer";
import { Serializer } from "./serializer";

export class Block implements IBlock {
    public static createFromData(data, keys): IBlock {
        data.generatorPublicKey = keys.publicKey;

        const payloadHash: Buffer = Block.serialize(data, false);
        const hash: Buffer = HashAlgorithms.sha256(payloadHash);

        data.blockSignature = crypto.signHash(hash, keys);
        data.id = Block.getId(data);

        return Block.fromData(data);
    }

    public static deserialize(hexString: string, headerOnly: boolean = false): IBlockData {
        return deserializer.deserialize(hexString, headerOnly).data;
    }

    public static serializeWithTransactions(block: IBlockData) {
        return Serializer.serializeWithTransactions(block);
    }

    public static serialize(block: IBlockData, includeSignature: boolean = true) {
        return Serializer.serialize(block, includeSignature);
    }

    public static getIdHex(data: IBlockData): string {
        const constants = configManager.getMilestone(data.height);
        const payloadHash: Buffer = Block.serialize(data);

        const hash: Buffer = HashAlgorithms.sha256(payloadHash);

        if (constants.block.idFullSha256) {
            return hash.toString("hex");
        }

        const temp: Buffer = Buffer.alloc(8);

        for (let i = 0; i < 8; i++) {
            temp[i] = hash[7 - i];
        }

        return temp.toString("hex");
    }

    public static toBytesHex(data): string {
        const temp: string = data ? BigNumber.make(data).toString(16) : "";

        return "0".repeat(16 - temp.length) + temp;
    }

    public static getId(data: IBlockData): string {
        const constants = configManager.getMilestone(data.height);
        const idHex: string = Block.getIdHex(data);

        return constants.block.idFullSha256 ? idHex : BigNumber.make(idHex, 16).toFixed();
    }

    public static fromHex(hex: string): IBlock {
        return this.fromSerialized(hex);
    }

    public static fromBytes(buffer: Buffer): IBlock {
        return this.fromSerialized(buffer.toString("hex"));
    }

    public static fromJson(json: IBlockJson): IBlock {
        // @ts-ignore
        const data: IBlockData = { ...json };
        data.totalAmount = BigNumber.make(data.totalAmount);
        data.totalFee = BigNumber.make(data.totalFee);
        data.reward = BigNumber.make(data.reward);

        for (const transaction of data.transactions) {
            transaction.amount = BigNumber.make(transaction.amount);
            transaction.fee = BigNumber.make(transaction.fee);
        }

        return this.fromData(data);
    }

    public static fromData(data: IBlockData): IBlock {
        const serialized: string = Block.serializeWithTransactions(data).toString("hex");
        const block: IBlock = new Block({ ...deserializer.deserialize(serialized), id: data.id });
        block.serialized = serialized;

        return block;
    }

    private static fromSerialized(serialized: string): IBlock {
        const block: IBlock = new Block(deserializer.deserialize(serialized));
        block.serialized = serialized;

        return block;
    }

    public serialized: string;
    public data: IBlockData;
    public transactions: ITransaction[];
    public verification: IBlockVerification;

    private constructor({ data, transactions, id }: { data: IBlockData; transactions: ITransaction[]; id?: string }) {
        const { value, error } = validator.validate("block", data);

        if (
            error !== null &&
            !(isException(value) || data.transactions.some((transaction: ITransactionData) => isException(transaction)))
        ) {
            throw new BlockSchemaError(error);
        }

        this.data = value;

        // TODO genesis block calculated id is wrong for some reason
        if (this.data.height === 1) {
            this.applyGenesisBlockFix(id || data.id);
        }

        // fix on real timestamp, this is overloading transaction
        // timestamp with block timestamp for storage only
        // also add sequence to keep database sequence
        this.transactions = transactions.map((transaction, index) => {
            transaction.data.blockId = this.data.id;
            transaction.timestamp = this.data.timestamp;
            transaction.data.sequence = index;
            return transaction;
        });

        delete this.data.transactions;

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

    public getHeader(): IBlockData {
        const header: IBlockData = Object.assign({}, this.data);
        delete header.transactions;

        return header;
    }

    public verifySignature(): boolean {
        const bytes: Buffer = Block.serialize(this.data, false);
        const hash: Buffer = HashAlgorithms.sha256(bytes);

        return crypto.verifyHash(hash, this.data.blockSignature, this.data.generatorPublicKey);
    }

    public toJson(): IBlockJson {
        const data: IBlockJson = JSON.parse(JSON.stringify(this.data));
        data.reward = this.data.reward.toFixed();
        data.totalAmount = this.data.totalAmount.toFixed();
        data.totalFee = this.data.totalFee.toFixed();
        data.transactions = this.transactions.map(transaction => transaction.toJson());

        return data;
    }

    private verify(): IBlockVerification {
        const block: IBlockData = this.data;
        const result: IBlockVerification = {
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

            if (!(block.reward as BigNumber).isEqualTo(constants.reward)) {
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

            let size: number = 0;
            const invalidTransactions: ITransaction[] = this.transactions.filter(tx => !tx.verified);
            if (invalidTransactions.length > 0) {
                result.errors.push("One or more transactions are not verified:");
                invalidTransactions.forEach(tx => result.errors.push(`=> ${tx.serialized.toString("hex")}`));
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
            const appliedTransactions: Record<string, ITransactionData> = {};

            let totalAmount: BigNumber = BigNumber.ZERO;
            let totalFee: BigNumber = BigNumber.ZERO;

            const payloadBuffers: Buffer[] = [];
            this.transactions.forEach(transaction => {
                const bytes: Buffer = Buffer.from(transaction.data.id, "hex");

                if (appliedTransactions[transaction.data.id]) {
                    result.errors.push(`Encountered duplicate transaction: ${transaction.data.id}`);
                }

                appliedTransactions[transaction.data.id] = transaction.data;

                totalAmount = totalAmount.plus(transaction.data.amount);
                totalFee = totalFee.plus(transaction.data.fee);
                size += bytes.length;

                payloadBuffers.push(bytes);
            });

            if (!totalAmount.isEqualTo(block.totalAmount)) {
                result.errors.push("Invalid total amount");
            }

            if (!totalFee.isEqualTo(block.totalFee)) {
                result.errors.push("Invalid total fee");
            }

            if (size > constants.block.maxPayload) {
                result.errors.push("Payload is too large");
            }

            if (HashAlgorithms.sha256(payloadBuffers).toString("hex") !== block.payloadHash) {
                result.errors.push("Invalid payload hash");
            }
        } catch (error) {
            result.errors.push(error);
        }

        result.verified = result.errors.length === 0;

        return result;
    }

    private applyGenesisBlockFix(id: string): void {
        this.data.id = id;
        this.data.idHex = Block.toBytesHex(id);
    }
}
