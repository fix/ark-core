import { formatTimestamp } from "@arkecosystem/core-utils";
import { expirationCalculator } from "@arkecosystem/core-utils";
import { Interfaces } from "@arkecosystem/crypto";

export const transformLock = (lock: Interfaces.IHtlcLock) => {
    return {
        ...lock,
        amount: lock.amount.toFixed(),
        timestamp: formatTimestamp(lock.timestamp),
        isExpired: expirationCalculator.calculateLockExpirationStatus(lock.expiration),
    };
};
