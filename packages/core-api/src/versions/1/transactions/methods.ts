import { transactionsRepository } from "../../../repositories";
import { generateCacheKey } from "../../utils";
import { paginate, respondWith, toCollection, toResource } from "../utils";

const index = async (request) => {
  const { count, rows } = await transactionsRepository.findAllLegacy({
    ...request.query,
    ...paginate(request),
  });

  if (!rows) {
    return respondWith("No transactions found", true);
  }

  return respondWith({
    transactions: toCollection(request, rows, "transaction"),
    count,
  });
};

const show = async (request) => {
  const result = await transactionsRepository.findById(request.query.id);

  if (!result) {
    return respondWith("No transactions found", true);
  }

  return respondWith({
    transaction: toResource(request, result, "transaction"),
  });
};

export function registerTransactionMethods(server) {
  const generateTimeout = require("../../utils").getCacheTimeout();

  server.method("v1.transactions.index", index, {
    cache: {
      expiresIn: 8 * 1000,
      generateTimeout,
      getDecoratedValue: true,
    },
    generateKey: (request) =>
      generateCacheKey({
        ...request.query,
        ...paginate(request),
      }),
  });

  server.method("v1.transactions.show", show, {
    cache: {
      expiresIn: 8 * 1000,
      generateTimeout,
      getDecoratedValue: true,
    },
    generateKey: (request) => generateCacheKey({ id: request.query.id }),
  });
}
