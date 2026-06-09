import { BudgetExceededError } from "../shared/errors";

type ContextBudgetInput = {
    systemPromptTokens: number;
    chunkTokens: number;
    historyTokens: number;
};

export function assertContextBudget(input: ContextBudgetInput): void {
    const errors: string[] = [];

    if (input.systemPromptTokens > 4000) {
        errors.push("system_prompt_limit_exceeded");
    }

    if (input.chunkTokens > 8000) {
        errors.push("chunk_limit_exceeded");
    }

    if (input.historyTokens < 0) {
        errors.push("invalid_history_tokens");
    }

    if (errors.length > 0) {
        throw new BudgetExceededError({
            ...input,
            errors,
        });
    }
}
