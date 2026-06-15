# Copilot — Rodada 1 (Prompt 3): geração do endpoint `POST /api/query`

> **Evidência de teste — rodada 1.** Output gerado a partir da skill `skills/domain/azure-functions-endpoint.md` (v1, agent-friendly) usando o "Quick Prompt de ativação" (§12 da skill).
> Esta é uma execução **simulada do GitHub Copilot** (role-play): reproduz o comportamento realista do Copilot quando recebe a skill — segue a maioria das regras, mas mantém alguns desvios típicos que serão auditados no Prompt 5 e corrigidos na v2 (Prompt 6). O output **não** está anotado com os gaps de propósito (a auditoria os descobre).

**Prompt usado:** Quick Prompt de ativação da skill (gerar endpoint Azure Functions v4 para `POST /api/query` em `src/functions/query/`).

---

## 1) Código gerado

### `src/functions/query/validator.ts`
```typescript
import { z } from "zod";
import type { ErrorResponse, QueryRequest, QueryResponse } from "../../shared/types.js";

// Context budget (ADR-0002): top-5 chunks, histórico máx. 3 turnos
export const queryRequestSchema = z
  .object({
    conversation_history: z
      .array(
        z.object({
          content: z.string().trim().min(1),
          role: z.enum(["user", "assistant"]),
        }),
      )
      .max(3)
      .optional(),
    question: z.string().trim().min(1),
    top_k: z.number().int().min(1).max(5).optional(),
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
import type { ErrorResponse, QueryResponse } from "../../shared/types.js";
import { errorResponseSchema } from "./validator.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

export function toSuccessResponse(response: QueryResponse): HttpResponseInit {
  return { headers: JSON_HEADERS, jsonBody: response, status: 200 };
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
import { toErrorResponse, toSuccessResponse } from "./response-builder.js";
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

    return toSuccessResponse(response);
  } catch (error: unknown) {
    logger.error({ err: error }, "query handler failed");
    return toErrorResponse(mapUnknownError(error));
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

## 2) Mapeamento "Regra da skill → trecho do código" (auto-relato do Copilot)

> Auto-relato otimista do agente (como o Copilot tipicamente reporta o que acha que cumpriu). A verificação crítica fica para o Prompt 5.

| Regra da skill (§) | Trecho do código |
|---|---|
| §4.1 Estrutura handler/validator/response-builder | três arquivos criados em `src/functions/query/` |
| §4.1 Handler thin | `handler.ts` só parseia → valida → orquestra `services/` → serializa |
| §4.2 Sem `any` / ESM / `.js` | tipos de `@azure/functions`, body como `unknown`; imports relativos `"../../shared/logger.js"` etc. |
| §4.3 Zod input | `queryRequestSchema.safeParse(...)` + `throw new ValidationError(...)` |
| §4.3 Zod output | `queryResponseSchema.safeParse(response)` + `throw new InternalServerError(...)` |
| §4.3 Budget (ADR-0002) | `top_k: z.number().int().min(1).max(5).optional()` e `conversation_history: ...max(3)` |
| §4.4 `source_document` obrigatório | `response.source_document = source` + campo no `queryResponseSchema` |
| §4.5 Logging pino | `logger.info({ invocationId, method, url }, "query request received")`; `logger.error(...)` no catch; zero `console.*` |
| §4.6 Erros padronizados | `mapUnknownError` + custom errors de `shared/errors.js` + `toErrorResponse` (`{ error, code }`) |
| §4.7 `app.http` completo | `authLevel`, `handler`, `methods`, `route` declarados |
| §4.8 Config | (não aplicável neste handler — leitura de env fica nos services) |

---

## Notas da execução (Copilot)

- Endpoint compila com `strict: true`; sem `any`; sem `console.*`.
- Reaproveitou `logger`, `AppError`/`ValidationError`/`InternalServerError`, e os tipos de `src/shared/`.
- Lógica de I/O e RAG delegada a `src/services/` (`retrieveTopChunks`, `buildRagPrompt`, `completeAnswer`, `selectSourceDocument`).
- Pontos que o agente **não** levantou sozinho (ficam para a auditoria do Prompt 5): tratamento de recuperação vazia / "não encontrado", `.strict()` em objetos aninhados, correlação de log no `catch`, e uso do dado validado pós-`safeParse`.
