import type { Logger } from "pino";

import type { QueryRequest, QueryResponse } from "../shared/types";
import { assertContextBudget } from "./prompt-builder";

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
    // TODO: integrar Azure AI Search + Azure OpenAI.
    assertContextBudget({
        systemPromptTokens: 0,
        chunkTokens: 0,
        historyTokens: payload.conversation.length,
    });

    requestLogger.info(
        {
            route: "POST /api/query",
            ragStage: "placeholder",
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
