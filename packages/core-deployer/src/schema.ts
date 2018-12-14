import Joi from "joi";

export const schema = Joi.object().keys({
    network: Joi.string().required(),
    name: Joi.string().required(),
    nodeIp: Joi.string().required(),
    p2pPort: Joi.number().required(),
    apiPort: Joi.number().required(),
    dbHost: Joi.string().required(),
    dbPort: Joi.number().required(),
    dbUsername: Joi.string().required(),
    dbPassword: Joi.string().required(),
    dbDatabase: Joi.string().required(),
    explorerUrl: Joi.string()
        .uri({ scheme: ["http", "https"] })
        .required(),
    activeDelegates: Joi.number().required(),
    feeTransfer: Joi.number().required(),
    feeVote: Joi.number().required(),
    feeSecondSignature: Joi.number().required(),
    feeDelegateRegistration: Joi.number().required(),
    feeMultiSignature: Joi.number().required(),
    epoch: Joi.string()
        .regex(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/)
        .required(),
    rewardHeight: Joi.number()
        .integer()
        .positive()
        .required(),
    rewardPerBlock: Joi.number().required(),
    blocktime: Joi.number().required(),
    token: Joi.string().required(),
    symbol: Joi.string().required(),
    prefixHash: Joi.number().required(),
    transactionsPerBlock: Joi.number().required(),
    wifPrefix: Joi.number()
        .integer()
        .min(1)
        .max(255)
        .required(),
    totalPremine: Joi.number().required(),
    configPath: Joi.string().required(),
});
