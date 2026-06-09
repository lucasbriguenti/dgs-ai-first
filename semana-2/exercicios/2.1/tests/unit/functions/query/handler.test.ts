import type { HttpRequest, InvocationContext } from "@azure/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const executeQueryMock = vi.fn();
    const requestLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    const logger = {
        child: vi.fn(() => requestLogger),
    };
    const appHttp = vi.fn();

    return {
        executeQueryMock,
        requestLogger,
        logger,
        appHttp,
    };
});

vi.mock("@azure/functions", () => ({
    app: {
        http: mocks.appHttp,
    },
}));

vi.mock("../../../../src/services/query-service", () => ({
    executeQuery: mocks.executeQueryMock,
}));

vi.mock("../../../../src/shared/logger", () => ({
    logger: mocks.logger,
}));

vi.mock("../../../../src/functions/query/validator", () => ({
    queryRequestSchema: {
        safeParse: (value: unknown) => {
            const data = value as { question?: unknown; conversation?: unknown };
            const isQuestionValid = typeof data?.question === "string" && data.question.length > 0;
            const isConversationValid =
                data?.conversation === undefined ||
                (Array.isArray(data.conversation) && data.conversation.length <= 3);

            if (isQuestionValid && isConversationValid) {
                return {
                    success: true as const,
                    data: {
                        question: data.question,
                        conversation: Array.isArray(data.conversation) ? data.conversation : [],
                    },
                };
            }

            return {
                success: false as const,
                error: {
                    flatten: () => ({ fieldErrors: { payload: ["invalid"] } }),
                },
            };
        },
    },
    queryResponseSchema: {
        safeParse: (value: unknown) => {
            const data = value as { answer?: unknown; source_document?: unknown };
            const isAnswerValid = typeof data?.answer === "string" && data.answer.length > 0;
            const isSourceValid =
                typeof data?.source_document === "string" && data.source_document.length > 0;

            if (isAnswerValid && isSourceValid) {
                return {
                    success: true as const,
                    data,
                };
            }

            return {
                success: false as const,
                error: {
                    flatten: () => ({ fieldErrors: { payload: ["invalid"] } }),
                },
            };
        },
    },
}));

import { queryHandler } from "../../../../src/functions/query/handler";

function createRequest(body: unknown): HttpRequest {
    return {
        json: vi.fn(async () => body),
    } as unknown as HttpRequest;
}

function createInvalidJsonRequest(): HttpRequest {
    return {
        json: vi.fn(async () => {
            throw new Error("invalid json");
        }),
    } as unknown as HttpRequest;
}

function createContext(invocationId = "req-123"): InvocationContext {
    return {
        invocationId,
    } as unknown as InvocationContext;
}

describe("queryHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 200 with answer and source_document on valid payload", async () => {
        mocks.executeQueryMock.mockResolvedValue({
            answer: "Resposta validada",
            source_document: "POL-001",
        });

        const request = createRequest({
            question: "Qual o prazo de devolucao?",
            conversation: ["turno 1"],
        });

        const response = await queryHandler(request, createContext());

        expect(response.status).toBe(200);
        expect(response.jsonBody).toEqual({
            answer: "Resposta validada",
            source_document: "POL-001",
        });
        expect(mocks.executeQueryMock).toHaveBeenCalledTimes(1);
        expect(mocks.executeQueryMock).toHaveBeenCalledWith(
            {
                question: "Qual o prazo de devolucao?",
                conversation: ["turno 1"],
            },
            mocks.requestLogger,
        );
        expect(mocks.logger.child).toHaveBeenCalledWith({ requestId: "req-123" });
    });

    it("returns 400 when payload has empty question", async () => {
        const request = createRequest({
            question: "",
            conversation: [],
        });

        const response = await queryHandler(request, createContext("req-empty-question"));

        expect(response.status).toBe(400);
        expect(response.jsonBody).toEqual({
            error: "Invalid request payload",
            code: "VALIDATION_ERROR",
        });
        expect(mocks.executeQueryMock).not.toHaveBeenCalled();
        expect(mocks.requestLogger.warn).toHaveBeenCalledTimes(1);
        expect(mocks.requestLogger.warn).toHaveBeenCalledWith(
            {
                requestId: "req-empty-question",
                error: expect.any(Object),
            },
            "validation_failed",
        );
    });

    it("returns 400 when payload exceeds conversation max size", async () => {
        const request = createRequest({
            question: "Pergunta valida",
            conversation: ["1", "2", "3", "4"],
        });

        const response = await queryHandler(request, createContext("req-conv-too-long"));

        expect(response.status).toBe(400);
        expect(response.jsonBody).toEqual({
            error: "Invalid request payload",
            code: "VALIDATION_ERROR",
        });
        expect(mocks.executeQueryMock).not.toHaveBeenCalled();
        expect(mocks.requestLogger.warn).toHaveBeenCalledWith(
            {
                requestId: "req-conv-too-long",
                error: expect.any(Object),
            },
            "validation_failed",
        );
    });

    it("returns 400 when request body is invalid JSON", async () => {
        const request = createInvalidJsonRequest();

        const response = await queryHandler(request, createContext("req-invalid-json"));

        expect(response.status).toBe(400);
        expect(response.jsonBody).toEqual({
            error: "Invalid JSON body",
            code: "VALIDATION_ERROR",
        });
        expect(mocks.executeQueryMock).not.toHaveBeenCalled();
        expect(mocks.requestLogger.warn).toHaveBeenCalledWith(
            { requestId: "req-invalid-json" },
            "invalid_json_body",
        );
    });

    it("returns 500 when service response violates output schema", async () => {
        mocks.executeQueryMock.mockResolvedValue({
            answer: "",
            source_document: "",
        });

        const request = createRequest({
            question: "Pergunta valida",
            conversation: [],
        });

        const response = await queryHandler(request, createContext("req-invalid-output"));

        expect(response.status).toBe(500);
        expect(response.jsonBody).toEqual({
            error: "Internal Server Error",
            code: "INTERNAL_ERROR",
        });
        expect(mocks.requestLogger.error).toHaveBeenCalledTimes(1);
        expect(mocks.requestLogger.error).toHaveBeenCalledWith(
            {
                requestId: "req-invalid-output",
                error: expect.any(Object),
            },
            "output_validation_failed",
        );
    });
});
