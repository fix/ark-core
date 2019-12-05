import Joi from "@hapi/joi";
import { address, genericName, orderBy, pagination, publicKey, walletId } from "../shared/schemas";

const iteratees = ["name"];
const bridgechainIteratees = ["name"];

export const index: object = {
    query: {
        ...pagination,
        ...{
            orderBy: orderBy(iteratees),
            publicKey,
            isResigned: Joi.bool(),
        },
    },
};

export const show: object = {
    params: {
        id: walletId,
    },
};

export const bridgechains: object = {
    params: {
        id: walletId,
    },
    query: {
        ...pagination,
        ...{
            orderBy: orderBy(bridgechainIteratees),
            isResigned: Joi.bool(),
        },
    },
};

export const search: object = {
    query: {
        ...pagination,
        ...{
            orderBy: orderBy(iteratees),
        },
    },
    payload: {
        address,
        publicKey,
        name: genericName,
        website: Joi.string().max(80),
        vat: Joi.string()
            .alphanum()
            .max(15),
        repository: Joi.string().max(80),
        isResigned: Joi.bool(),
    },
};
