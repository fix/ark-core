import Joi from "@hapi/joi";
import { address, blockId, orderBy, pagination, publicKey } from "../shared/schemas";

const iteratees = ["timestamp"];

export const index: object = {
    query: {
        ...pagination,
        ...{
            orderBy: orderBy(iteratees),
            id: Joi.string()
                .hex()
                .length(64),
            blockId,
            version: Joi.number()
                .integer()
                .positive(),
            senderPublicKey: publicKey,
            senderId: address,
            recipientId: address,
            timestamp: Joi.number()
                .integer()
                .min(0),
            amount: Joi.number()
                .integer()
                .min(0),
            fee: Joi.number()
                .integer()
                .min(0),
            vendorField: Joi.string().max(255, "utf8"),
            transform: Joi.bool().default(true),
        },
    },
};

export const show: object = {
    params: {
        id: Joi.string()
            .hex()
            .length(64),
    },
    query: {
        transform: Joi.bool().default(true),
    },
};
