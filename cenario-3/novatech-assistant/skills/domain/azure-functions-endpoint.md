---
name: azure-functions-endpoint
level: domain
version: 2
description: >-
  Como criar um endpoint HTTP em Azure Functions v4 (TypeScript strict) no NovaTech
  Assistant: estrutura de arquivos handler/validator/response-builder, validação Zod
  de input E output (todos os objetos .strict(), inclusive aninhados), logging com
  pino, erros padronizados, contrato de "sem resultados" e campo source_document
  obrigatório. Use ao criar/alterar qualquer arquivo em src/functions/<nome>/.
consumed_by: [GitHub Copilot, Claude Code]
depends_on:
  - skills/foundation/typescript-conventions.md
  - skills/foundation/error-handling.md
  - skills/foundation/project-structure.md
  - skills/domain/testing-patterns.md  # ao gerar testes do endpoint
authority: AGENTS.md  # esta skill NÃO sobrepõe o AGENTS.md; ela o operacionaliza para endpoints
---

# Skill (Domain): `azure-functions-endpoint` (v2)

> **v2** — refinada após teste real com Copilot (rodada 1) e auditoria de aderência. Mudanças vs v1 na seção **§13 Delta v1 → v2**. Principal adição: **contrato de "sem resultados / não encontrado"** (§4.4) — a v1 não o definia e o Copilot caía em 500.

## 1. Nome e objetivo

**Nome:** `azure-functions-endpoint`

**Objetivo:** padronizar a criação de endpoints HTTP em **Azure Functions v4 + TypeScript strict** no projeto NovaTech Assistant, de modo que qualquer endpoint gerado por agente (Copilot, Claude Code) saia consistente com o `AGENTS.md`: thin handler, validação Zod de **input e output**, logging estruturado com `pino`, erros padronizados via `AppError`, tratamento explícito de **recuperação vazia**, e campo `source_document` presente em toda resposta de domínio.

Esta é uma skill de **Domain**: ela define o *padrão de camada* para endpoints. Para gerar um endpoint RAG completo de ponta a ponta, use a skill de Artifact `skills/artifact/create-rag-endpoint.md`, que consome esta.

---

## 2. Frase de ativação

> **Regra de ativação (para o agente):** se a mensagem do usuário casar com **≥ 1 gatilho** abaixo, o agente DEVE carregar esta skill **e** as dependências de §3 **antes** de gerar qualquer arquivo. Em caso de dúvida entre esta skill e outra, prevalece o gatilho mais específico (ex.: "componente React" → `react-components`, não esta).

### Quando usar (gatilhos — frases que sinalizam uso)
Ative esta skill quando o pedido contiver qualquer uma destas frases/sinais:
- "criar/adicionar um endpoint", "Azure Function HTTP", "HTTP trigger", "rota `POST /api/...`".
- "criar arquivo em `src/functions/<nome>/`".
- "expor X como API", "novo handler", "endpoint de feedback/health/query".
- Qualquer geração que vá criar ou editar `handler.ts`, `validator.ts` ou `response-builder.ts` dentro de `src/functions/`.

### Quando NÃO usar
- Lógica de negócio, I/O externo ou chamada ao LLM → vão em `src/services/` (ver §4). Esta skill cobre a **borda HTTP**, não a regra de negócio.
- Componentes React do painel → `skills/domain/react-components.md`.
- Pipeline de ingestão (`src/pipeline/`) → não é endpoint HTTP.
- Integração de busca (montar query/índice) → `skills/domain/azure-ai-search-integration.md`.
- Geração dos testes em si → `skills/domain/testing-patterns.md` / `skills/artifact/create-integration-test.md` (mas o **mínimo exigido** de testes está em §4.9).

---

## 3. Dependências (ler ANTES de gerar)

Leia, nesta ordem, antes de escrever código:

| Ordem | Artefato | Por quê |
|---|---|---|
| 1 | `AGENTS.md` (raiz) | Constitution do projeto. Regras de `source_document`, context budget (ADR-0002), vigência (ADR-0003), fronteira handler/services. Esta skill **operacionaliza** o AGENTS.md; em conflito, o AGENTS.md vence. |
| 2 | `skills/foundation/typescript-conventions.md` | `strict`, proibição de `any`, ESM, imports. |
| 3 | `skills/foundation/error-handling.md` | Uso de `AppError` e custom errors. |
| 4 | `skills/foundation/project-structure.md` | Onde cada arquivo mora. |
| 5 | `skills/domain/testing-patterns.md` | **Apenas ao gerar testes** do endpoint (ver §4.9). |

**Símbolos compartilhados que o endpoint DEVE reutilizar (não recriar):**
- `logger` — `src/shared/logger.ts` (instância `pino` já configurada com `service: "novatech-assistant"`).
- `AppError`, `ValidationError`, `BadRequestError`, `NotFoundError`, `ExternalServiceError`, `InternalServerError`, `isAppError()` — `src/shared/errors.ts`.
- `QueryRequest`, `QueryResponse`, `SourceDocument`, `ErrorResponse` (e correlatos) — `src/shared/types.ts`.
- Config de ambiente — `src/shared/config.ts` (NUNCA `process.env` direto no handler).

---

## 4. Regras prescritivas (DEVE / NÃO DEVE)

### 4.1 Estrutura de arquivos
- **DEVE** criar o endpoint em `src/functions/<nome>/` com, no mínimo:
  - `handler.ts` — HTTP trigger + registro `app.http(...)`.
  - `validator.ts` — schemas Zod de input **e** output.
  - `response-builder.ts` — serialização da resposta (sucesso, erro e "não encontrado") em `HttpResponseInit`.
- **DEVE** manter o `handler.ts` *thin*: parsear o body, validar, orquestrar `services/`, serializar. Nada além disso.
- **NÃO DEVE** colocar I/O externo, chamada ao LLM, busca de chunks, montagem de prompt ou regra de negócio no `handler.ts` ou no `response-builder.ts` → isso vai em `src/services/`.

### 4.2 TypeScript e imports
- **DEVE** rodar em `strict: true`. **NÃO DEVE** usar `any` (use `unknown` + narrowing) — **inclusive em dados de mock de teste** (use factory tipada, ver §4.9).
- **DEVE** usar ESM com `import`/`export` nomeado. **NÃO DEVE** usar `require()` nem `export default`.
- **DEVE** usar `import type { ... }` para imports apenas de tipo.
- **DEVE** usar a extensão `.js` em imports relativos (o projeto usa `module: ESNext` + `moduleResolution: Bundler` e emite ESM; o código existente importa `"../../shared/logger.js"`). **NÃO DEVE** importar com extensão `.ts` nem sem extensão em imports relativos.

### 4.3 Validação (Zod)
- **DEVE** validar o body de entrada com Zod via `safeParse` e lançar `ValidationError` em falha.
- **DEVE** validar o objeto de resposta com Zod **antes** de retornar e **DEVE retornar o dado parseado (`validated.data`)**, não o objeto pré-validação; falha de output é `InternalServerError`, não erro do cliente.
- **DEVE** aplicar `.strict()` a **todos** os objetos Zod, **inclusive aninhados** (ex.: o turno dentro de `conversation_history`).
- **DEVE** enforçar o context budget (ADR-0002) no schema de input quando aplicável: `top_k: z.number().int().min(1).max(5).optional()` e `conversation_history: z.array(...).max(3).optional()`.
- **NÃO DEVE** usar casting (`as Tipo`) como substituto de validação em código de produção.

### 4.4 `source_document` e contrato de "sem resultados" (guardrail de produto)
- **DEVE** incluir o campo `source_document` no JSON de toda resposta de domínio, **inclusive em baixa confiança e no caminho de "não encontrado"**.
- **DEVE** enforçar `source_document` no schema Zod de **output** (não confiar só no tipo TS).
- **DEVE** incluir `vigencia` em `SourceDocument` quando a fonte tiver versão (ADR-0003).
- **DEVE tratar recuperação vazia** (`chunks.length === 0`): retornar **200** com uma resposta padronizada de "não encontrado" — `answer` com **aviso explícito** de ausência de fonte e sugestão de escalação (guardrail QUANDO EM DÚVIDA) **e** um `source_document` **sentinela** (`id: "none"`, `title: "Sem fonte"`, `content: "Nenhum documento correspondente foi encontrado na base indexada."`). Use `buildNotFoundResponse()` em `response-builder.ts`.
- **NÃO DEVE** retornar 500 nem lançar exceção quando não há match; **NÃO DEVE** chamar `selectSourceDocument` com lista vazia; **NÃO DEVE** inventar fonte.
- **NÃO DEVE** retornar resposta de domínio sem `source_document`, nem em fallback. (`NotFoundError`/404 é reservado a rota/recurso inexistente, **não** a "consulta sem resultado".)

### 4.5 Logging (pino)
- **DEVE** usar `logger` de `src/shared/logger.ts`. **NÃO DEVE** usar `console.log/error/warn/info`.
- **DEVE** logar o recebimento do request com `info` incluindo `invocationId`, `method`, `url`.
- **DEVE** logar erro com nível `error` incluindo o objeto de erro **e o `invocationId`**: `logger.error({ err, invocationId }, "mensagem")` (correlação é obrigatória).
- **DEVE**, para chamadas a serviços externos (search, completion), incluir duração em ms: `logger.info({ durationMs: Date.now() - start }, "...")` — feito dentro do service, não no handler.
- **NÃO DEVE** logar segredos, tokens, ou o body de erro completo de terceiros.

### 4.6 Erros
- **DEVE** usar os custom errors de `src/shared/errors.ts`.
- **DEVE** ter um `mapUnknownError(error: unknown): AppError` que converte desconhecido em `InternalServerError` e preserva `AppError` via `isAppError()`.
- **DEVE** responder erro com corpo JSON padronizado `{ error: string, code: string }` e `statusCode` do `AppError`.
- **NÃO DEVE** lançar `new Error("...")` genérico no handler nem deixar exceção vazar sem `try/catch`.
- **NÃO DEVE** vazar stack trace ou mensagem interna crua de terceiros para o cliente.

### 4.7 Registro da function
- **DEVE** registrar com `app.http("<nome>", { authLevel, handler, methods, route })`.
- **DEVE** definir `methods` explicitamente (ex.: `["POST"]`) e `route` coerente com a rota (`/api/<route>`).
- **DEVE** declarar `authLevel` explicitamente (nesta fase local o projeto usa `"anonymous"`; qualquer endpoint que exponha dados sensíveis DEVE usar `"function"` e justificar a exceção no PR).

### 4.8 Ambiente
- **DEVE** ler configuração via `src/shared/config.ts` (validado com Zod). **NÃO DEVE** ler `process.env` diretamente no handler/service.

### 4.9 Testes do endpoint (mínimo exigido)
> Regras completas de teste: `skills/domain/testing-patterns.md`. Esta seção fixa o **piso** que todo endpoint DEVE entregar.

- **DEVE** importar dados de `tests/fixtures/` (chunks, queries, expected responses). **NÃO DEVE** definir dados de teste inline.
- **DEVE** isolar dependências externas com `vi.mock` dos módulos de `src/services/` (nenhuma chamada real).
- **DEVE** cobrir, no mínimo, estes 5 casos:
  1. **Happy path** → `status 200` e `jsonBody` com `answer` **e** `source_document` (assertion específica, ex.: `toEqual`).
  2. **Input inválido** → `status 400` e corpo `{ code: "VALIDATION_ERROR", error: ... }`.
  3. **Falha interna controlada** → `status 500` e corpo `{ code: "INTERNAL_SERVER_ERROR", ... }` (não só o status).
  4. **Recuperação vazia (VC-04)** → `retrieveTopChunks` retorna `[]`; espera `status 200` com `source_document` sentinela (`id: "none"`).
  5. **Violação de budget** → `top_k: 6` e/ou histórico com 4 turnos são rejeitados (`status 400`).
- **NÃO DEVE** usar `as any` em dados de mock; usar factory tipada. Exceção (AGENTS.md): `as unknown as HttpRequest`/`InvocationContext` apenas nos helpers `createRequest`/`createContext`.

---

## 5. Fluxo recomendado de implementação

1. **Ler dependências** (§3): `AGENTS.md` + 3 skills Foundation (+ `testing-patterns` ao testar).
2. **Criar a pasta** `src/functions/<nome>/`.
3. **`validator.ts`** — definir `<nome>RequestSchema` e `<nome>ResponseSchema` (Zod, `.strict()` em **todos** os objetos, budget enforçado). Reexportar tipos de `src/shared/types.ts`.
4. **`response-builder.ts`** — `toSuccessResponse(...)`, `toErrorResponse(error: AppError)` e `buildNotFoundResponse()` (resposta sentinela de "não encontrado"). Validar o corpo de erro com o schema.
5. **`handler.ts`** —
   1. `logger.info` do request (`invocationId`, `method`, `url`).
   2. `parseRequestBody` (try/catch → `ValidationError` se JSON inválido).
   3. `schema.safeParse` do input → `ValidationError` se falhar.
   4. Orquestrar `src/services/` (busca). **Se `chunks.length === 0` → `return toSuccessResponse(buildNotFoundResponse())`.**
   5. Seguir o fluxo RAG (prompt, completion, seleção de fonte) e montar a resposta **incluindo `source_document`**.
   6. `schema.safeParse` do output → `InternalServerError` se falhar; **retornar `validated.data`**.
   7. `return toSuccessResponse(validated.data)`.
   8. `catch (error: unknown)` → `mapUnknownError` → `logger.error({ err, invocationId })` → `return toErrorResponse(appError)`.
   9. `app.http(...)`.
6. **Testes** (§4.9): cobrir os 5 casos com fixtures e mocks tipados.
7. **Verificar** com o checklist (§8) e os critérios automatizáveis (§9): `npm run lint && npm run build && npm run test`.

---

## 6. Exemplos DO / DON'T (TypeScript real)

### 6.1 DO — `validator.ts` (input + output, `.strict()` em TODOS os objetos, budget enforçado)
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
        }).strict(), // .strict() TAMBÉM no objeto aninhado
      )
      .max(3) // ADR-0002: histórico máx. 3 turnos
      .optional(),
    question: z.string().trim().min(1),
    top_k: z.number().int().min(1).max(5).optional(), // ADR-0002: top-5
  })
  .strict();

export const queryResponseSchema = z
  .object({
    answer: z.string().trim().min(1),
    source_document: z // guardrail: source_document obrigatório
      .object({
        content: z.string().trim().min(1),
        id: z.string().trim().min(1),
        score: z.number().finite().optional(),
        title: z.string().trim().min(1),
        uri: z.string().url().optional(),
        vigencia: z.string().trim().min(1).optional(), // ADR-0003
      })
      .strict(),
  })
  .strict();

export const errorResponseSchema = z
  .object({ code: z.string().trim().min(1), error: z.string().trim().min(1) })
  .strict();

export type { ErrorResponse, QueryRequest, QueryResponse };
```

### 6.2 DO — `response-builder.ts` (serialização pura + resposta sentinela de "não encontrado")
```typescript
import type { HttpResponseInit } from "@azure/functions";
import { InternalServerError, type AppError } from "../../shared/errors.js";
import type { ErrorResponse, QueryResponse, SourceDocument } from "../../shared/types.js";
import { errorResponseSchema } from "./validator.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

// source_document sentinela: satisfaz queryResponseSchema por construção
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

### 6.3 DO — `handler.ts` (thin, guarda de recuperação vazia, valida I/O, loga com correlação)
```typescript
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { logger } from "../../shared/logger.js";
import { AppError, InternalServerError, ValidationError, isAppError } from "../../shared/errors.js";
import type { QueryRequest, QueryResponse } from "../../shared/types.js";
import { queryRequestSchema, queryResponseSchema } from "./validator.js";
import { buildNotFoundResponse, toErrorResponse, toSuccessResponse } from "./response-builder.js";
// I/O e regra de negócio vivem em src/services/ (NÃO no handler):
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
      return toSuccessResponse(buildNotFoundResponse()); // VC-04: 200 com source_document sentinela
    }

    const prompt = buildRagPrompt(body.question, chunks, body.conversation_history ?? []);
    const completion = validateCompletionResult(await completeAnswer(prompt));
    const source = selectSourceDocument(chunks, body.question);

    const response: QueryResponse = {
      answer: completion.answer,
      source_document: source, // SEMPRE presente
    };

    const validated = queryResponseSchema.safeParse(response);
    if (!validated.success) {
      throw new InternalServerError("Response validation failed");
    }

    return toSuccessResponse(validated.data); // retorna o dado PARSEADO
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

### 6.4 DON'T — o que o Copilot costuma gerar sem skill (e por que está errado)
```typescript
import { app } from "@azure/functions";

// ❌ tipos frouxos + sem registro de tipo de retorno
export async function queryHandler(request: any, context: any) {
  // ❌ console.log proibido (use logger pino)
  console.log("query received", request.url);

  // ❌ sem try/catch; ❌ sem validação Zod do input
  const body = await request.json();

  // ❌ I/O e regra de negócio dentro do handler (deveria estar em services/)
  const res = await fetch("https://search...", { /* ... */ });
  const chunks = await res.json();

  // ❌ chama selectSourceDocument sem tratar chunks vazio → 500 quando não há match (VC-04)
  const source = selectSourceDocument(chunks, body.question);

  // ❌ resposta SEM validação de output; ❌ retorna objeto cru
  return { status: 200, jsonBody: { answer: chunks[0].text, source_document: source } };
}

// ❌ rota/método/authLevel implícitos
app.http("query", { handler: queryHandler });
```
**Correção:** aplicar a estrutura de 6.1–6.3: `any` → tipos do Azure + `unknown`; `console.log` → `logger`; `fetch` inline → service em `src/services/`; adicionar Zod input/output com `.strict()`; **guardar `chunks.length === 0` → `buildNotFoundResponse()`**; validar output e retornar `validated.data`; `try/catch` + `mapUnknownError` + `toErrorResponse`; declarar `methods`, `route`, `authLevel`.

---

## 7. Anti-padrões comuns do Copilot em endpoints (e como corrigir)

| # | Anti-padrão gerado | Sintoma no código | Correção prescritiva |
|---|---|---|---|
| A1 | `request: any` / `context: any` | Perde strict typing; `any` proibido | `HttpRequest`, `InvocationContext` de `@azure/functions`; body como `unknown` + `safeParse`. |
| A2 | `console.log`/`console.error` | Log fora do pipeline pino | `import { logger } from "../../shared/logger.js"`. |
| A3 | Sem validação de **output** | Valida input mas retorna objeto cru | `responseSchema.safeParse(response)` → `InternalServerError`; retornar `validated.data`. |
| A4 | Esquece `source_document` | Resposta `{ answer }` sem fonte | Incluir `source_document` e enforçar no schema de output. |
| A5 | `throw new Error("...")` / sem `try/catch` | 500 sem corpo `{ error, code }` | `try/catch` + `mapUnknownError` + custom errors + `toErrorResponse`. |
| A6 | Lógica/I/O no handler | `fetch`, prompt, chunking dentro de `handler.ts` | Mover para `src/services/`; handler só orquestra. |
| A7 | Import sem extensão ou `.ts` | `from "../../shared/logger"` ou `.ts` | Usar `.js` em imports relativos. |
| A8 | `process.env.X` direto | Lê env no handler | Ler via `src/shared/config.ts`. |
| A9 | Ignora context budget | `top_k`/histórico sem limite | `top_k` `.max(5)`, `conversation_history` `.max(3)` no Zod. |
| A10 | `app.http` sem `methods`/`route`/`authLevel` | Rota/método implícitos | Declarar os três explicitamente. |
| A11 | Schema sem `.strict()` (ou só no top-level) | Aceita campos desconhecidos, inclusive em objetos aninhados | `.strict()` em **todos** os objetos, inclusive aninhados. |
| A12 | `as SomeType` no lugar de validação | Casting mascara dados inválidos | Validar com Zod; casting só em helpers de mock de teste (exceção do AGENTS.md). |
| A13 | `selectSourceDocument` em `chunks` vazio / sem fallback | 500 (ou crash) quando não há match | Guardar `chunks.length === 0` → `buildNotFoundResponse()` (200 + sentinela). |
| A14 | `as any` em dados de mock | `mockResolvedValue([...] as any)` | Factory tipada para dados; `as` só para `HttpRequest`/`InvocationContext`. |

---

## 8. Checklist de saída pronta para review

- [ ] Pasta `src/functions/<nome>/` com `handler.ts`, `validator.ts`, `response-builder.ts`.
- [ ] `handler.ts` é thin (parse → valida → orquestra services → serializa); sem I/O/regra de negócio.
- [ ] Nenhum `any` (inclusive em dados de mock); nenhum `@ts-ignore`/`@ts-expect-error` sem justificativa.
- [ ] Imports relativos com extensão `.js`; `import type` para tipos; sem `require`/`export default`.
- [ ] Zod valida **input** (`safeParse` → `ValidationError`) e **output** (`safeParse` → `InternalServerError`); retorna `validated.data`; **todos** os objetos com `.strict()`, inclusive aninhados.
- [ ] Context budget no input: `top_k` `.max(5)`, `conversation_history` `.max(3)` (quando aplicável).
- [ ] `source_document` presente na resposta **e** enforçado no schema de output; `vigencia` quando houver versão.
- [ ] **Recuperação vazia tratada**: `chunks.length === 0` → `buildNotFoundResponse()` (200 + `source_document` sentinela `id: "none"`); nunca 500/exceção/fonte inventada.
- [ ] `logger` (pino) usado; zero `console.*`; request logado com `invocationId/method/url`; erro logado com `{ err, invocationId }`.
- [ ] `try/catch` + `mapUnknownError` + custom errors de `shared/errors.ts`; corpo de erro `{ error, code }` + `statusCode`.
- [ ] `app.http` com `methods`, `route` e `authLevel` explícitos.
- [ ] Config via `src/shared/config.ts` (sem `process.env` direto).
- [ ] Testes (§4.9): 5 casos (happy/inválido/interno/recuperação vazia/budget), com fixtures e mocks tipados.
- [ ] `npm run lint && npm run build && npm run test` passam (cobertura ≥ 80% linhas).

---

## 9. Critérios de validação automatizável

Verificações que podem ser checadas por lint, type-check, testes ou grep — sem julgamento humano:

| ID | Critério | Como verificar (automatizável) | Falha = |
|---|---|---|---|
| V1 | Sem `any` | `tsc --noEmit` em `strict` + lint `@typescript-eslint/no-explicit-any` (cobre `src/` e `tests/`) | Bloqueia merge |
| V2 | Sem `console.*` | `grep -rnE "console\.(log\|error\|warn\|info)" src/functions/<nome>/` retorna vazio | Bloqueia merge |
| V3 | Compila | `npm run build` (`tsc -p .`) exit 0 | Bloqueia merge |
| V4 | Imports relativos com `.js` | nenhum import relativo sem `.js` | Bloqueia merge |
| V5 | Output valida `source_document` | grep do `responseSchema` contém `source_document`; teste de happy path afirma `body.source_document` | Bloqueia merge |
| V6 | Input e output usam `safeParse` | grep por `safeParse` em handler ≥ 2 ocorrências | Review |
| V7 | Erro padronizado | testes de 400 **e** 500 retornam corpo com `error` e `code` corretos | Bloqueia merge |
| V8 | Budget enforçado | schema rejeita `top_k: 6` e histórico com 4 turnos (teste) | Review |
| V9 | `app.http` completo | bloco contém `methods`, `route`, `authLevel` | Review |
| V10 | Cobertura | `vitest run --coverage` ≥ 80% linhas | Bloqueia merge |
| V11 | Recuperação vazia (VC-04) | teste com `retrieveTopChunks` → `[]` espera `200` com `source_document.id === "none"` | Bloqueia merge |
| V12 | Sem `as any` em teste | `grep -rn "as any" tests/` retorna vazio | Review |

> Sugestão de gate: V1–V5, V7, V10 e V11 são **bloqueantes** (CI vermelho impede merge); V6, V8, V9, V12 entram no code review do Tech Lead.

---

## 10. Regra → Evidência esperada no código

| Regra (§4) | Evidência esperada no código |
|---|---|
| Estrutura de arquivos | Existem `src/functions/<nome>/handler.ts`, `validator.ts`, `response-builder.ts`. |
| Handler thin | `handler.ts` só faz `parse → safeParse → chama services → safeParse → toSuccessResponse`; sem `fetch`/SDK/regra de negócio. |
| Sem `any` | Nenhuma ocorrência de `: any`/`<any>`/`as any` (inclusive em testes); body tipado como `unknown` antes do `safeParse`. |
| ESM + import type + `.js` | `import type { ... }` para tipos; imports relativos terminam em `.js`; sem `require`/`export default`. |
| Validação de input | `const parsed = <nome>RequestSchema.safeParse(...)` + `if (!parsed.success) throw new ValidationError(...)`. |
| Validação de output + `validated.data` | `const validated = <nome>ResponseSchema.safeParse(response)` + `throw new InternalServerError(...)` em falha + `return toSuccessResponse(validated.data)`. |
| Schemas `.strict()` (inclusive aninhados) | Todo `z.object({...})` encadeia `.strict()`, **incluindo** o objeto de `conversation_history`. |
| Context budget (ADR-0002) | `top_k: z.number().int().min(1).max(5).optional()` e `conversation_history: z.array(...).max(3).optional()`. |
| `source_document` obrigatório | Objeto de resposta contém `source_document` **e** `responseSchema` o declara não-opcional. |
| Recuperação vazia (VC-04) | `if (chunks.length === 0) return toSuccessResponse(buildNotFoundResponse());` + sentinela `id: "none"`. |
| `vigencia` (ADR-0003) | `source_document` (tipo e schema) inclui `vigencia: z.string()...optional()`. |
| Logging pino | `import { logger } from "../../shared/logger.js"`; `logger.info({ invocationId, method, url }, "...")`; zero `console.*`. |
| Log de erro com correlação | `logger.error({ err, invocationId }, "...")` no `catch`. |
| Duração de chamada externa | Dentro do service: `const start = Date.now()` + `logger.info({ durationMs: Date.now() - start }, "...")`. |
| Erros padronizados | `import { ... } from "../../shared/errors.js"`; `mapUnknownError(...)`; resposta de erro `{ error, code }` + `error.statusCode`. |
| `try/catch` no handler | Bloco `try { ... } catch (error: unknown) { ... return toErrorResponse(mapUnknownError(error)); }`. |
| Registro completo | `app.http("<nome>", { authLevel, handler, methods: [...], route })` com os quatro campos. |
| Config via `config.ts` | Variáveis lidas por import de `../../shared/config.js`; nenhum `process.env.` no handler/services. |
| Testes mínimos (§4.9) | Arquivo de teste cobre os 5 casos; importa de `tests/fixtures/`; `vi.mock` dos services; sem `as any`. |

---

## 11. Falhas comuns de geração (exemplos curtos)

Padrões que o Copilot gera com frequência e a correção mínima. Formato: ❌ gerado → ✅ corrigido.

**F1 — Body sem validação**
```typescript
const { question } = await request.json();        // ❌ sem schema, tipo any implícito
const p = requestSchema.safeParse(await request.json()); // ✅
if (!p.success) throw new ValidationError();
```

**F2 — Resposta sem `source_document`**
```typescript
return { status: 200, jsonBody: { answer } };                 // ❌ guardrail violado
return toSuccessResponse({ answer, source_document });        // ✅
```

**F3 — Output não validado / retorna objeto cru**
```typescript
return toSuccessResponse(response);                           // ❌ confia só no tipo TS
const v = responseSchema.safeParse(response);                 // ✅
if (!v.success) throw new InternalServerError("Response validation failed");
return toSuccessResponse(v.data);                             // ✅ dado parseado
```

**F4 — Log fora do pipeline / sem correlação**
```typescript
console.error("falhou", err);                                // ❌
logger.error({ err, invocationId: context.invocationId }, "query handler failed"); // ✅
```

**F5 — Erro cru vazando**
```typescript
const data = await search(q);                                // ❌ sem try/catch → 500 sem corpo
try { /* ... */ } catch (e: unknown) {                       // ✅
  return toErrorResponse(mapUnknownError(e));
}
```

**F6 — I/O dentro do handler**
```typescript
const r = await fetch(`${process.env.SEARCH_URL}/q`);        // ❌ I/O + env no handler
const chunks = await retrieveTopChunks(question, topK);      // ✅ service (lê env via config.ts)
```

**F7 — Import frágil**
```typescript
import { logger } from "../../shared/logger";                // ❌ sem extensão
import { logger } from "../../shared/logger.js";             // ✅
```

**F8 — Budget sem limite**
```typescript
top_k: z.number().optional(),                                // ❌ aceita 50
top_k: z.number().int().min(1).max(5).optional(),            // ✅ ADR-0002
```

**F9 — Recuperação vazia não tratada**
```typescript
const source = selectSourceDocument(chunks, q);              // ❌ chunks pode ser [] → 500/crash
if (chunks.length === 0) return toSuccessResponse(buildNotFoundResponse()); // ✅ VC-04
```

**F10 — `as any` em dados de mock**
```typescript
retrieveTopChunksMock.mockResolvedValue([chunk] as any);     // ❌
retrieveTopChunksMock.mockResolvedValue(makeChunks(1));      // ✅ factory tipada (tests/fixtures)
```

**F11 — `.strict()` só no top-level**
```typescript
conversation_history: z.array(z.object({ content: z.string(), role: z.enum([...]) })).max(3), // ❌ aninhado aberto
conversation_history: z.array(z.object({ /* ... */ }).strict()).max(3),                       // ✅
```

---

## 12. Quick Prompt de ativação (colar no Copilot ao testar)

Use este bloco no Copilot Chat (com o repositório aberto) para validar a skill **v2** end-to-end:

```text
Leia e siga ESTRITAMENTE a skill skills/domain/azure-functions-endpoint.md (v2) deste repositório
(e as dependências que ela lista: AGENTS.md + skills/foundation/* + skills/domain/testing-patterns.md).
Em seguida, gere um endpoint Azure Functions v4 em TypeScript para POST /api/query, em src/functions/query/,
e os testes Vitest correspondentes.

Requisitos:
- Input: { question: string (não vazio), top_k?: number, conversation_history?: [...] }.
- Validação Zod de INPUT e OUTPUT, com .strict() em TODOS os objetos (inclusive aninhados); retorne validated.data.
- Enforce context budget (top_k máx 5, histórico máx 3).
- Trate recuperação vazia: se retrieveTopChunks retornar [], responda 200 com buildNotFoundResponse()
  (source_document sentinela id "none"); NUNCA 500/exceção/fonte inventada.
- Logging pino (logger de src/shared/logger.ts); erro com { err, invocationId }; zero console.*.
- Erros padronizados: try/catch + mapUnknownError + custom errors; corpo { error, code }.
- source_document SEMPRE presente. I/O e regra de negócio em src/services/. Imports relativos com .js. Sem any.
- Testes: cobrir happy path, input inválido (400 + code), falha interna (500 + code), recuperação vazia (VC-04),
  e violação de budget (top_k:6). Importar dados de tests/fixtures/; vi.mock dos services; sem as any.

Entregue:
1) handler.ts, validator.ts, response-builder.ts em src/functions/query/ + o arquivo de teste;
2) uma auto-checagem "Regra da skill v2 | Onde apliquei | Nível de confiança (Alto/Médio/Baixo)".

Não invente regras fora da skill. Se algo não estiver na skill ou no AGENTS.md, pergunte antes de assumir.
```

---

## 13. Delta v1 → v2

| Regra antiga (v1) | Regra nova (v2) | Gap observado corrigido (rodada 1) |
|---|---|---|
| §4.4 exigia `source_document` "mesmo em baixa confiança", **sem** definir o caso de recuperação vazia. | §4.4 + §6.2/§6.3: **contrato de "não encontrado"** — `chunks.length === 0` → `buildNotFoundResponse()` (200 + sentinela `id: "none"`); proíbe 500/exceção/fonte inventada. + V11 (teste obrigatório). | Endpoint chamava `selectSourceDocument([])` sem guarda → **500** em vez de "não encontrado" (viola VC-04 / incidente 3). |
| §4.3 "usar `.strict()` nos schemas" (escopo não explícito). | §4.3: `.strict()` em **todos** os objetos, **inclusive aninhados**; A11/F11/§10 atualizados. | `conversation_history` (objeto aninhado) ficou **sem `.strict()`** → campos extras aceitos. |
| §4.3 "validar o output" (não dizia o que retornar). | §4.3: "DEVE retornar `validated.data`, não o objeto pré-validação". | Handler validava output mas fazia `return toSuccessResponse(response)` (objeto pré-validação). |
| §4.5 "logar erro incluindo o objeto de erro" (texto só pedia `{ err }`; §10 pedia `invocationId`). | §4.5: `logger.error({ err, invocationId }, ...)` no **texto** da regra (texto e evidência alinhados). | `logger.error({ err }, ...)` **sem `invocationId`** → perda de correlação. |
| Testes delegados a `testing-patterns`, **sem** piso na skill. | Nova §4.9 "Testes do endpoint (mínimo exigido)": 5 casos, fixtures obrigatórias, mocks tipados; V11/V12. | Testes com dados **inline**, sem caso de **budget** nem de **recuperação vazia**; 500 sem assert de `code`. |
| §4.2 "NÃO DEVE usar `any`" (foco em produção). | §4.2 + A14/F10/V12: proíbe `any` **inclusive em dados de mock**; factory tipada. | `mockResolvedValue([...] as any)` nos testes. |
