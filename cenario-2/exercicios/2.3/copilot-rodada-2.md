# Copilot — Rodada 2 (Prompt 7): reteste com a skill v2

> **Evidência de teste — rodada 2.** Endpoint + testes regenerados com a skill `skills/domain/azure-functions-endpoint.md` **v2**, usando o Quick Prompt de ativação v2 (§12).
> Execução **simulada do GitHub Copilot** (role-play). Com a v2, os gaps Alto/Médio da rodada 1 fecham (recuperação vazia, `.strict()` aninhado, `validated.data`, log com `invocationId`, fixtures, mocks tipados, teste 500 com `code`). Restam 2 resíduos menores, registrados ao final e na auto-checagem.

**Prompt usado:** Quick Prompt de ativação v2 (gerar endpoint `POST /api/query` + testes Vitest + auto-checagem).

---

## 1) Código gerado — endpoint

### `src/functions/query/validator.ts`
```typescript
import { z } from "zod";
import type { ErrorResponse, QueryRequest, QueryResponse } from "../../shared/types.js";

export const queryRequestSchema = z
  .object({
    conversation_history: z
      .array(
        z.object({
          content: z.string().trim().min(1),
          role: z.enum(["user", "assistant"]),
        }).strict(), // .strict() também no objeto aninhado (v2 §4.3)
      )
      .max(3) // ADR-0002
      .optional(),
    question: z.string().trim().min(1),
    top_k: z.number().int().min(1).max(5).optional(), // ADR-0002
  })
  .strict();

export const queryResponseSchema = z
  .object({
    answer: z.string().trim().min(1),
    source_document: z
      .object({
        content: z.string().trim().min(1),
        id: z.string().trim().min(1),
        score: z.number().finite().optional(),
        title: z.string().trim().min(1),
        uri: z.string().url().optional(),
        vigencia: z.string().trim().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const errorResponseSchema = z
  .object({ code: z.string().trim().min(1), error: z.string().trim().min(1) })
  .strict();

export type { ErrorResponse, QueryRequest, QueryResponse };
```

### `src/functions/query/response-builder.ts`
```typescript
import type { HttpResponseInit } from "@azure/functions";
import { InternalServerError, type AppError } from "../../shared/errors.js";
import type { ErrorResponse, QueryResponse, SourceDocument } from "../../shared/types.js";
import { errorResponseSchema } from "./validator.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

const NOT_FOUND_SOURCE: SourceDocument = {
  content: "Nenhum documento correspondente foi encontrado na base indexada.",
  id: "none",
  title: "Sem fonte",
};

export function toSuccessResponse(response: QueryResponse): HttpResponseInit {
  return { headers: JSON_HEADERS, jsonBody: response, status: 200 };
}

export function buildNotFoundResponse(): QueryResponse {
  return {
    answer:
      "Não encontrei essa informação na documentação disponível. " +
      "Recomendo escalar ao supervisor para confirmação.",
    source_document: NOT_FOUND_SOURCE,
  };
}

export function toErrorResponse(error: AppError): HttpResponseInit {
  const body: ErrorResponse = { code: error.code, error: error.message };
  const parsed = errorResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new InternalServerError("Failed to build error response");
  }
  return { headers: JSON_HEADERS, jsonBody: body, status: error.statusCode };
}
```

### `src/functions/query/handler.ts`
```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { logger } from "../../shared/logger.js";
import { AppError, InternalServerError, ValidationError, isAppError } from "../../shared/errors.js";
import type { QueryRequest, QueryResponse } from "../../shared/types.js";
import { queryRequestSchema, queryResponseSchema } from "./validator.js";
import { buildNotFoundResponse, toErrorResponse, toSuccessResponse } from "./response-builder.js";
import { retrieveTopChunks, selectSourceDocument } from "../../services/search.js";
import { buildRagPrompt } from "../../services/prompt-builder.js";
import { completeAnswer } from "../../services/completion.js";
import { validateCompletionResult } from "../../services/response-validator.js";

async function parseRequestBody(request: HttpRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

function mapUnknownError(error: unknown): AppError {
  return isAppError(error) ? error : new InternalServerError();
}

export async function queryHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  logger.info(
    { invocationId: context.invocationId, method: request.method, url: request.url },
    "query request received",
  );

  try {
    const parsed = queryRequestSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      throw new ValidationError("Request body must contain a non-empty question");
    }
    const body: QueryRequest = parsed.data;
    const topK = body.top_k ?? 5;

    const chunks = await retrieveTopChunks(body.question, topK);
    if (chunks.length === 0) {
      logger.info({ invocationId: context.invocationId }, "no chunks retrieved; returning not-found response");
      return toSuccessResponse(buildNotFoundResponse()); // VC-04
    }

    const prompt = buildRagPrompt(body.question, chunks, body.conversation_history ?? []);
    const completion = validateCompletionResult(await completeAnswer(prompt));
    const source = selectSourceDocument(chunks, body.question);

    const response: QueryResponse = {
      answer: completion.answer,
      source_document: source,
    };

    const validated = queryResponseSchema.safeParse(response);
    if (!validated.success) {
      throw new InternalServerError("Response validation failed");
    }

    return toSuccessResponse(validated.data); // dado parseado (v2 §4.3)
  } catch (error: unknown) {
    const appError = mapUnknownError(error);
    logger.error(
      { err: error instanceof Error ? error : undefined, invocationId: context.invocationId },
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
```

---

## 2) Código gerado — testes (fixtures + 5 casos)

### `tests/fixtures/chunks.ts`
```typescript
import type { RetrievalChunk } from "../../src/services/search.js";
import type { SourceDocument } from "../../src/shared/types.js";

export function makeChunk(overrides: Partial<RetrievalChunk> = {}): RetrievalChunk {
  return {
    id: "PROC-042",
    title: "Frete Especial",
    content: "Frete especial aplica-se a cargas acima de 500kg.",
    score: 0.91,
    ...overrides,
  };
}

export function makeSourceDocument(overrides: Partial<SourceDocument> = {}): SourceDocument {
  return {
    id: "PROC-042",
    title: "Frete Especial",
    content: "Frete especial aplica-se a cargas acima de 500kg.",
    score: 0.91,
    vigencia: "2024-01-01",
    ...overrides,
  };
}
```

### `tests/unit/functions/query/handler.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpRequest, InvocationContext } from "@azure/functions";
import { makeChunk, makeSourceDocument } from "../../../fixtures/chunks.js";

vi.mock("../../../../src/services/search.js", () => ({
  retrieveTopChunks: vi.fn(),
  selectSourceDocument: vi.fn(),
}));
vi.mock("../../../../src/services/prompt-builder.js", () => ({
  buildRagPrompt: vi.fn(() => "PROMPT"),
}));
vi.mock("../../../../src/services/completion.js", () => ({
  completeAnswer: vi.fn(),
}));
vi.mock("../../../../src/services/response-validator.js", () => ({
  validateCompletionResult: vi.fn((value) => value),
}));

import { queryHandler } from "../../../../src/functions/query/handler.js";
import { retrieveTopChunks, selectSourceDocument } from "../../../../src/services/search.js";
import { completeAnswer } from "../../../../src/services/completion.js";

const retrieveTopChunksMock = vi.mocked(retrieveTopChunks);
const selectSourceDocumentMock = vi.mocked(selectSourceDocument);
const completeAnswerMock = vi.mocked(completeAnswer);

function createRequest(body: unknown): HttpRequest {
  return {
    method: "POST",
    url: "http://localhost/api/query",
    json: async () => body,
  } as unknown as HttpRequest;
}

function createContext(): InvocationContext {
  return { invocationId: "test-invocation" } as unknown as InvocationContext;
}

describe("queryHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with answer and source_document when the question matches a chunk", async () => {
    retrieveTopChunksMock.mockResolvedValue([makeChunk()]);
    const source = makeSourceDocument();
    selectSourceDocumentMock.mockReturnValue(source);
    completeAnswerMock.mockResolvedValue({ answer: "Frete especial é para cargas acima de 500kg." });

    const res = await queryHandler(
      createRequest({ question: "O que é frete especial?" }),
      createContext(),
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({
      answer: "Frete especial é para cargas acima de 500kg.",
      source_document: source,
    });
  });

  it("should return 400 when the question is missing", async () => {
    const res = await queryHandler(createRequest({}), createContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ code: "VALIDATION_ERROR", error: expect.any(String) });
  });

  it("should return 500 with INTERNAL_SERVER_ERROR when the completion service throws", async () => {
    retrieveTopChunksMock.mockResolvedValue([makeChunk()]);
    selectSourceDocumentMock.mockReturnValue(makeSourceDocument());
    completeAnswerMock.mockRejectedValue(new Error("LLM timeout"));

    const res = await queryHandler(createRequest({ question: "qualquer" }), createContext());

    expect(res.status).toBe(500);
    expect(res.jsonBody).toEqual({ code: "INTERNAL_SERVER_ERROR", error: expect.any(String) });
  });

  it("should return 200 with a sentinel source_document when no chunk is retrieved", async () => {
    retrieveTopChunksMock.mockResolvedValue([]);

    const res = await queryHandler(
      createRequest({ question: "pergunta sem correspondência" }),
      createContext(),
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ source_document: { id: "none", title: "Sem fonte" } });
    expect(selectSourceDocumentMock).not.toHaveBeenCalled();
  });

  it("should return 400 when top_k exceeds the budget limit", async () => {
    const res = await queryHandler(
      createRequest({ question: "frete", top_k: 6 }),
      createContext(),
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
```

---

## 3) Auto-checagem (Regra da skill v2 | Onde apliquei | Confiança)

| Regra da skill v2 (§) | Onde apliquei | Confiança |
|---|---|---|
| §4.1 Estrutura handler/validator/response-builder | 3 arquivos em `src/functions/query/` | Alto |
| §4.1 Handler thin | handler só orquestra; I/O em `services/` | Alto |
| §4.2 Sem `any` (inclusive mocks) | tipos do Azure + `unknown`; fixtures tipadas (`makeChunk`/`makeSourceDocument`); zero `as any` | Alto |
| §4.2 ESM + `import type` + `.js` | `import type`; imports relativos `.js` | Alto |
| §4.3 Zod input | `queryRequestSchema.safeParse` → `ValidationError` | Alto |
| §4.3 Zod output + `validated.data` | `safeParse(response)` → `InternalServerError`; `return toSuccessResponse(validated.data)` | Alto |
| §4.3 `.strict()` em todos os objetos (aninhados) | `.strict()` no turno de `conversation_history` | Alto |
| §4.3 Budget (ADR-0002) | `top_k.max(5)`, `conversation_history.max(3)` | Alto |
| §4.4 `source_document` obrigatório | `response.source_document` + schema | Alto |
| §4.4 Contrato "não encontrado" (VC-04) | `if (chunks.length === 0) return toSuccessResponse(buildNotFoundResponse())` + sentinela `id:"none"` | Alto |
| §4.4 `vigencia` (ADR-0003) | campo no schema + `makeSourceDocument` | Alto |
| §4.5 Logging pino, sem `console.*` | `logger.info`/`logger.error`; zero `console` | Alto |
| §4.5 Log de erro com `invocationId` | `logger.error({ err, invocationId }, ...)` | Alto |
| §4.5 `durationMs` em chamadas externas | **N/A** — vive em `src/services/` (não regenerado nesta rodada) | — |
| §4.6 Erros padronizados | `mapUnknownError` + custom errors + `{ error, code }` | Alto |
| §4.7 `app.http` completo | `authLevel`, `handler`, `methods`, `route` | Alto |
| §4.8 Config via `config.ts` | sem `process.env` no handler | Alto |
| §4.9 Testes: fixtures, mocks tipados | importa de `tests/fixtures/chunks.ts`; `vi.mock` dos services | Alto |
| §4.9 Testes: happy / inválido / interno (com `code`) | 3 testes; 500 assere `INTERNAL_SERVER_ERROR` | Alto |
| §4.9 Teste recuperação vazia (VC-04) | teste "no chunk retrieved" (200 + `id:"none"`) | Alto |
| §4.9 Teste violação de budget | teste `top_k: 6` (400) | **Médio** — cobri `top_k`, **não** cobri histórico com 4 turnos |

---

## Notas da execução (Copilot) — resíduos

- **R1 (Baixo):** o teste de budget cobre apenas `top_k: 6`; **não** há caso para `conversation_history` com 4 turnos (V8 parcial).
- **R2 (Baixo):** o teste de recuperação vazia assere `status 200` e `source_document.id === "none"`, mas **não** assere o texto de aviso de baixa confiança em `answer`.
- Fora isso: compila em `strict`, sem `any`/`console.*`, 5 casos de teste com fixtures e mocks tipados; todos os gaps Alto/Médio da rodada 1 foram fechados.
