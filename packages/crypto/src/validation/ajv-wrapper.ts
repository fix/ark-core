import Ajv from "ajv";
import ajvKeywords from "ajv-keywords";

import { TransactionSchemaAlreadyExistsError } from "../errors";
import { ISchemaValidationResult } from "../models";
import { signedSchema, strictSchema, TransactionSchema } from "../transactions/types/schemas";
import { keywords } from "./keywords";
import { schemas } from "./schemas";

class AjvWrapper {
    private ajv: Ajv.Ajv;
    private transactionSchemas = new Set<string>();

    constructor() {
        const ajv = new Ajv({ $data: true, schemas, removeAdditional: true, extendRefs: true });
        ajvKeywords(ajv);

        keywords.forEach(addKeyword => {
            addKeyword(ajv);
        });

        this.ajv = ajv;
    }

    public instance(): Ajv.Ajv {
        return this.ajv;
    }

    public validate<T = any>(schemaName: string, data: T): ISchemaValidationResult<T> {
        const valid = this.ajv.validate(schemaName, data);
        const error = this.ajv.errors !== null ? this.ajv.errorsText() : null;
        return { value: data, error };
    }

    public extendTransaction(schema: TransactionSchema) {
        if (this.transactionSchemas.has(schema.$id)) {
            throw new TransactionSchemaAlreadyExistsError(schema.$id);
        }

        this.transactionSchemas.add(schema.$id);
        this.ajv.addSchema(schema);
        this.ajv.addSchema(signedSchema(schema));
        this.ajv.addSchema(strictSchema(schema));

        this.updateTransactionArray();
    }

    private updateTransactionArray() {
        const items = [...this.transactionSchemas].map(schema => ({ $ref: `${schema}Signed` }));

        const transactionsSchema = {
            $id: "transactions",
            type: "array",
            additionalItems: false,
            items: { oneOf: items },
        };

        this.ajv.removeSchema("block");
        this.ajv.removeSchema("transactions");
        this.ajv.addSchema(transactionsSchema);
        this.ajv.addSchema(schemas.block);
    }
}

export const ajvWrapper = new AjvWrapper();
