import type { Logger } from "pino";

import type { QueryRequest, QueryResponse } from "../shared/types";
import {
    assertContextBudget,
    buildContextBudgetSnapshot,
} from "./prompt-builder";

const PLACEHOLDER_SYSTEM_PROMPT =
    "Voce e o assistente NovaTech. Responda somente com informacoes da base documental e cite a fonte.";

export async function executeQuery(
    payload: QueryRequest,
    requestLogger: Logger,
): Promise<QueryResponse> {
    requestLogger.info(
        {
            questionLength: payload.question.length,
            historyTurns: payload.conversation.length,
        },
        "query_received",
    );

    const ragResult = await runRagPipeline(payload, requestLogger);

    return {
        answer: ragResult.answer,
        source_document: ragResult.source_document,
    };
}

type RagResult = {
    answer: string;
    source_document: string;
    vigencia: string | null;
};

async function runRagPipeline(
    payload: QueryRequest,
    requestLogger: Logger,
): Promise<RagResult> {
    // Placeholder de RAG para exercicio: mede budget antes da etapa de completion.
    const placeholderChunks = [payload.question];
    const budgetSnapshot = buildContextBudgetSnapshot({
        systemPrompt: PLACEHOLDER_SYSTEM_PROMPT,
        chunks: placeholderChunks,
        history: payload.conversation,
    });

    assertContextBudget(budgetSnapshot);

    requestLogger.info(
        {
            route: "POST /api/query",
            ragStage: "placeholder",
            budget_snapshot: budgetSnapshot,
        },
        "rag_pipeline_invoked",
    );

    return {
        answer:
            "Nao encontrei essa informacao na base de documentos disponivel",
        source_document: "PENDING",
        vigencia: null,
    };
}
