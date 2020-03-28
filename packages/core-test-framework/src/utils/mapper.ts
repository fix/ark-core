import { Interfaces, Utils } from "@packages/crypto";
import { Models } from "@packages/core-database";

export const mapTransactionToModel = (transaction: Interfaces.ITransaction, sequence: number = 0): Models.Transaction => {
    return {
        id: transaction.id as string,
        version: transaction.data.version || 1,
        blockId: transaction.data.blockId || "",
        sequence: sequence,
        timestamp: transaction.data.timestamp,
        nonce: transaction.data.nonce || Utils.BigNumber.make(1),
        senderPublicKey: transaction.data.senderPublicKey || "",
        recipientId: transaction.data.recipientId || "",
        type: transaction.data.type,
        typeGroup: transaction.data.typeGroup || 1,
        vendorField: transaction.data.vendorField,
        amount: BigInt(transaction.data.amount),
        fee: BigInt(transaction.data.fee),
        serialized: transaction.serialized,
        asset: transaction.data.asset as Record<string, any>,
    }
};
