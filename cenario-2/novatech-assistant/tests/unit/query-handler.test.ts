import type { HttpRequest, InvocationContext } from "@azure/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { happyPathChunks } from "../fixtures/chunks.js";
import {
  happyPathResponse,
  invalidJsonErrorResponse,
  missingQuestionErrorResponse,
} from "../fixtures/expected-responses.js";
import { happyPathQuery, missingQuestionQuery } from "../fixtures/queries.js";

const {
  appHttpMock,
  completeAnswerMock,
  loggerMock,
  retrieveTopChunksMock,
} = vi.hoisted(() => ({
  appHttpMock: vi.fn(),
  completeAnswerMock: vi.fn(),
  loggerMock: {
    error: vi.fn(),
    info: vi.fn(),
  },
  retrieveTopChunksMock: vi.fn(),
}));

vi.mock("@azure/functions", () => ({
  app: {
    http: appHttpMock,
  },
}));

vi.mock("../../src/shared/logger.js", () => ({
  logger: loggerMock,
}));

vi.mock("../../src/services/search.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/search.js")>(
    "../../src/services/search.js",
  );

  return {
    ...actual,
    retrieveTopChunks: retrieveTopChunksMock,
  };
});

vi.mock("../../src/services/completion.js", () => ({
  completeAnswer: completeAnswerMock,
}));

import { queryHandler } from "../../src/functions/query/handler.js";

function createRequest(body: unknown, invalidJson = false): HttpRequest {
  const request = {
    json: invalidJson
      ? async () => {
          throw new Error("invalid json");
        }
      : async () => body,
    method: "POST",
    url: "http://localhost/api/query",
  };

  return request as HttpRequest;
}

function createContext(): InvocationContext {
  return {
    invocationId: "invocation-test-id",
  } as InvocationContext;
}

function buildExpectedPrompt(): string {
  return [
    "Voce e o assistente NovaTech.",
    "Use apenas o contexto recuperado para responder.",
    [
      "Historico recente:",
      [
        "USER: Preciso entender o frete especial.",
        "ASSISTANT: Claro, vou consultar a base interna.",
      ].join("\n"),
    ].join("\n"),
    "Pergunta:\nComo trato frete especial?",
    [
      "Contexto recuperado:",
      [
        [
          "1. PROC-042 Frete Especial (doc-old)",
          "Vigencia: 2025-01-01",
          "Versao antiga do procedimento de frete especial.",
        ].join("\n"),
        [
          "2. PROC-042 Frete Especial (doc-new)",
          "Vigencia: 2026-01-01",
          "Versao vigente do procedimento de frete especial.",
        ].join("\n"),
      ].join("\n\n"),
    ].join("\n"),
  ].join("\n\n");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("queryHandler", () => {
  it("returns a successful response with source_document", async () => {
    retrieveTopChunksMock.mockResolvedValue(happyPathChunks);
    completeAnswerMock.mockResolvedValue({ answer: happyPathResponse.answer });

    const response = await queryHandler(createRequest(happyPathQuery), createContext());

    expect(response.status).toBe(200);
    expect(response.headers).toEqual(
      expect.objectContaining({
        "content-type": "application/json; charset=utf-8",
      }),
    );
    expect(response.jsonBody).toEqual(happyPathResponse);
    expect(retrieveTopChunksMock).toHaveBeenCalledTimes(1);
    expect(retrieveTopChunksMock).toHaveBeenCalledWith("Como trato frete especial?", 2);
    expect(completeAnswerMock).toHaveBeenCalledTimes(1);
    expect(completeAnswerMock).toHaveBeenCalledWith(buildExpectedPrompt());
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({ historyTurns: 2, topK: 2 }),
      "context budget usage",
    );
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it("returns validation error when the body is not valid JSON", async () => {
    const response = await queryHandler(createRequest(undefined, true), createContext());

    expect(response.status).toBe(400);
    expect(response.jsonBody).toEqual(invalidJsonErrorResponse);
    expect(retrieveTopChunksMock).not.toHaveBeenCalled();
    expect(completeAnswerMock).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "query handler failed",
    );
  });

  it("returns validation error when question is missing", async () => {
    const response = await queryHandler(createRequest(missingQuestionQuery), createContext());

    expect(response.status).toBe(400);
    expect(response.jsonBody).toEqual(missingQuestionErrorResponse);
    expect(retrieveTopChunksMock).not.toHaveBeenCalled();
    expect(completeAnswerMock).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "query handler failed",
    );
  });
});
