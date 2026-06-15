import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { logger } from "../../shared/logger.js";
import { AppError, InternalServerError, ValidationError, isAppError } from "../../shared/errors.js";
import type { QueryRequest, QueryResponse } from "../../shared/types.js";
import { toErrorResponse, toSuccessResponse } from "./response-builder.js";
import { completeAnswer } from "../../services/completion.js";
import { buildRagPrompt as buildServicePrompt } from "../../services/prompt-builder.js";
import {
  retrieveTopChunks,
  selectSourceDocument,
} from "../../services/search.js";
import { validateCompletionResult } from "../../services/response-validator.js";
import { queryRequestSchema, queryResponseSchema } from "./validator.js";

async function parseRequestBody(request: HttpRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

function mapUnknownError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  return new InternalServerError();
}

export async function queryHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  logger.info(
    {
      invocationId: context.invocationId,
      method: request.method,
      url: request.url,
    },
    "query request received",
  );

  try {
    const rawBody: unknown = await parseRequestBody(request);
    const parsedBody = queryRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      throw new ValidationError("Request body must contain a non-empty question");
    }

    const requestBody: QueryRequest = parsedBody.data;
    const history = requestBody.conversation_history ?? [];
    const topK = requestBody.top_k ?? 5;

    logger.info(
      {
        historyTurns: history.length,
        topK,
      },
      "context budget usage",
    );

    const chunks = await retrieveTopChunks(requestBody.question, topK);
    const prompt = buildServicePrompt(
      requestBody.question,
      chunks,
      history,
    );
    const sourceDocument = selectSourceDocument(chunks, requestBody.question);
    const completion = validateCompletionResult(await completeAnswer(prompt));
    const response: QueryResponse = {
      answer: completion.answer,
      source_document: {
        content: sourceDocument.content,
        id: sourceDocument.id,
        score: sourceDocument.score,
        title: sourceDocument.title,
        uri: sourceDocument.uri,
        vigencia: sourceDocument.vigencia,
      },
    };

    const parsedResponse = queryResponseSchema.safeParse(response);
    if (!parsedResponse.success) {
      throw new InternalServerError("Response validation failed");
    }

    logger.info(
      {
        chunkCount: chunks.length,
        invocationId: context.invocationId,
        promptLength: prompt.length,
        sourceDocumentId: response.source_document.id,
      },
      "query response built",
    );

    return toSuccessResponse(response);
  } catch (error: unknown) {
    const appError = mapUnknownError(error);

    logger.error(
      {
        err: error instanceof Error ? error : undefined,
        invocationId: context.invocationId,
      },
      "query handler failed",
    );

    return toErrorResponse(appError);
  }
}

app.http("query", {
  authLevel: "anonymous",
  handler: queryHandler,
  methods: ["POST"],
  route: "query",
});
