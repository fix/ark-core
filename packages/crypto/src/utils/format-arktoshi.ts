import { ARKTOSHI } from "../constants";
import { configManager } from "../managers/config";

/**
 * Get human readable string from arktoshis
 * @param  {Number|String|Bignum} amount
 * @return {String}
 */
export const formatArktoshi = amount => {
    const localeString = (+amount / ARKTOSHI).toLocaleString("en", {
        minimumFractionDigits: 8,
        maximumFractionDigits: 8,
    });

  return `${configManager.config.client.symbol}${localeString}`;
};
