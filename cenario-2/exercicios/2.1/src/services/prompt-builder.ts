import { BudgetExceededError } from "../shared/errors";

type ContextBudgetInput = {
    systemPromptTokens: number;
    chunkTokens: number;
    historyTokens: number;
};

type BuildBudgetInput = {
    systemPrompt: string;
    chunks: string[];
    history: string[];
};

const APPROX_CHARS_PER_TOKEN = 4;

export function estimateTokenCount(text: string): number {
    const normalizedText = text.trim();

    if (normalizedText.length === 0) {
        return 0;
    }

    return Math.ceil(normalizedText.length / APPROX_CHARS_PER_TOKEN);
}

export function buildContextBudgetSnapshot(input: BuildBudgetInput): ContextBudgetInput & {
    totalTokens: number;
} {
    const systemPromptTokens = estimateTokenCount(input.systemPrompt);
    const chunkTokens = input.chunks.reduce(
        (acc, chunk) => acc + estimateTokenCount(chunk),
        0,
    );
    const historyTokens = input.history.reduce(
        (acc, turn) => acc + estimateTokenCount(turn),
        0,
    );

    return {
        systemPromptTokens,
        chunkTokens,
        historyTokens,
        totalTokens: systemPromptTokens + chunkTokens + historyTokens,
    };
}

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

    if (
        input.systemPromptTokens + input.chunkTokens + input.historyTokens >
        16000
    ) {
        errors.push("total_budget_limit_exceeded");
    }

    if (errors.length > 0) {
        throw new BudgetExceededError({
            ...input,
            errors,
        });
    }
}
