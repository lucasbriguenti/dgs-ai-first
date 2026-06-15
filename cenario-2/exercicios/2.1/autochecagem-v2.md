# Auto-checagem Copilot — AGENTS.md v2 (Rodada 2)

> Documento gerado pelo Copilot após regenerar endpoint e testes usando estritamente o AGENTS.md v2.
> Formato: Regra do AGENTS.md v2 | Onde foi aplicada | Nível de confiança

---

## Endpoint — `src/functions/query/handler.ts`

| Regra do AGENTS.md v2 | Onde foi aplicada | Confiança |
|---|---|---|
| DEVE usar pino via `src/shared/logger.ts` | `import { logger }` no handler; `logger.info(...)` em todos os pontos de log | Alto |
| NÃO DEVE usar `console.log` | Nenhuma ocorrência em nenhum arquivo gerado | Alto |
| DEVE logar com `logger.error({ err }, ...)` | `logger.error({ err: error instanceof Error ? error : undefined, invocationId }, "query handler failed")` | Alto |
| DEVE logar início/fim de chamadas externas com `durationMs` | `src/services/search.ts`: `durationMs: Date.now() - startedAt` em `retrieval completed`; `src/services/completion.ts`: idem em `completion completed` | Alto |
| DEVE usar Zod para validar input | `queryRequestSchema.safeParse(rawBody)` com `.strict()` | Alto |
| DEVE usar Zod para validar output | `queryResponseSchema.safeParse(response)` antes do return | Alto |
| Zod DEVE enforçar budget: `top_k: max(5)`, `history: max(3)` | `validator.ts`: `top_k: z.number().int().min(1).max(5)`, `conversation_history: z.array(...).max(3)` | Alto |
| DEVE logar uso efetivo do budget no início do request | `logger.info({ historyTurns: history.length, topK }, "context budget usage")` no handler | Alto |
| DEVE usar custom errors de `errors.ts` | `ValidationError`, `InternalServerError`, `mapUnknownError` | Alto |
| Erro HTTP: `{ error: string, code: string }` | `toErrorResponse` em `response-builder.ts`; `errorResponseSchema` valida antes de retornar | Alto |
| `source_document` obrigatório em toda resposta | `QueryResponse.source_document` obrigatório no tipo e no `queryResponseSchema` com `.strict()` | Alto |
| `vigencia` no `SourceDocument` (ADR-0003) | Tipo + Zod schema + `selectSourceDocument` prioriza chunk com `vigencia` mais recente | Alto |
| NÃO DEVE usar `export default` | Todos os arquivos usam named exports | Alto |
| **Lógica em `src/services/`; `response-builder.ts` só serializa** | `retrieveTopChunks` → `src/services/search.ts`; `buildRagPrompt` → `src/services/prompt-builder.ts`; `completeAnswer` → `src/services/completion.ts`; `validateCompletionResult` → `src/services/response-validator.ts`. `response-builder.ts` contém apenas `toSuccessResponse` e `toErrorResponse` | Alto |
| NÃO DEVE usar `any` em produção | Nenhuma ocorrência em arquivos de produção; `error: unknown` com narrowing | Alto |
| EXCEÇÃO de teste: `as SomeType` em helpers de mock | `createRequest` retorna `request as HttpRequest`; `createContext` retorna `{} as InvocationContext` — restrito aos helpers | Alto |

---

## Testes — `tests/unit/query-handler.test.ts`

| Regra do AGENTS.md v2 | Onde foi aplicada | Confiança |
|---|---|---|
| Dados NovaTech em `tests/fixtures/`, não inline | Chunks: `happyPathChunks` de `fixtures/chunks.ts`; queries: `happyPathQuery` de `fixtures/queries.ts`; respostas: `happyPathResponse` de `fixtures/expected-responses.ts` | Alto |
| NÃO DEVE fazer chamadas reais a serviços externos | `vi.mock` para `@azure/functions`, `logger`, `services/search.js`, `services/completion.js` | Alto |
| Assertions específicas | `toEqual`, `toHaveBeenCalledWith`, `toHaveBeenCalledTimes`, `not.toHaveBeenCalled()` | Alto |
| `vi.clearAllMocks()` / independência entre testes | `beforeEach(() => vi.clearAllMocks())` + `afterEach(() => vi.restoreAllMocks())` | Alto |
| Dados de domínio NovaTech realistas | Chunks com `PROC-042`, `vigencia`, `uri`; fixture de query com `conversation_history` de 2 turnos; resposta esperada com `doc-new` (vigência mais recente) | Alto |
| Verificação do log de budget | `expect(loggerMock.info).toHaveBeenCalledWith(expect.objectContaining({ historyTurns: 2, topK: 2 }), "context budget usage")` | Alto |

---

## Comparação Rodada 1 vs. Rodada 2

| Gap identificado na rodada 1 | Status na rodada 2 |
|---|---|
| `retrieveTopChunks` em `response-builder.ts` (functions/) | ✅ Movido para `src/services/search.ts` com `durationMs` |
| `buildRagPrompt` em `response-builder.ts` (functions/) | ✅ Movido para `src/services/prompt-builder.ts` |
| Budget ADR-0002 sem log explícito no request | ✅ `logger.info({ historyTurns, topK }, "context budget usage")` no handler |
| `as HttpRequest` sem exceção explícita no AGENTS.md | ✅ Regra de exceção de teste clarificada; uso restrito a helpers |
| Dados de teste inline no arquivo de teste | ✅ Fixtures em `tests/fixtures/` importadas no teste |
| Log sem timing em chamadas externas | ✅ `durationMs` em `retrieval completed` e `completion completed` |

---

## Riscos residuais após rodada 2

| Risco | Severidade | Observação |
|---|---|---|
| `src/shared/config.ts` ainda é stub vazio | Baixa | `process.env` não está sendo lido diretamente ainda (extensão futura) |
| Cobertura de testes não medida (sem `npm test` executado) | Média | Estrutura de mocks e assertions cobre os 3 cenários definidos; cobertura real depende de rodar o Vitest |
| `completeAnswer` retorna stub fixo | Baixa | Esperado nesta fase; ponto de extensão explicitamente marcado no código |
| Seções TODO no AGENTS.md (QA, PS, DM) | Média | O agente trabalha com contexto parcial até as outras seções serem preenchidas |
