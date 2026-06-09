import type { ZodFlattenedError } from "zod";

export class ValidationError extends Error {
    constructor(public details: ZodFlattenedError<unknown>) {
        super("validation_error");
    }
}

export class InternalError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InternalError";
    }
}

export class BudgetExceededError extends Error {
    constructor(public budget: object) {
        super("context_budget_exceeded");
    }
}
