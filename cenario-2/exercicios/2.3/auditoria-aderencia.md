# Auditoria de aderência — skill `azure-functions-endpoint` (rodada 1)

> **Entrada:** outputs reais do Copilot — `copilot-rodada-1.md` (endpoint) e `copilot-rodada-1-testes.md` (testes).
> **Restrição aplicada:** avaliação baseada **apenas** no código colado. Itens não observáveis no código (ex.: cobertura %, duração de chamadas externas que vivem em `src/services/`) são marcados como **Não verificável**, não como falha.

---

## 1) Tabela de aderência

| Regra da skill (§) | Status | Evidência concreta (no código colado) | Impacto |
|---|---|---|---|
| §4.1 Estrutura `handler`/`validator`/`response-builder` | Seguido | Os 3 arquivos existem em `src/functions/query/` | — |
| §4.1 Handler thin (sem I/O/regra de negócio) | Seguido | `handler.ts` chama `retrieveTopChunks`/`buildRagPrompt`/`completeAnswer`/`selectSourceDocument` de `services/`; sem `fetch`/SDK no handler | — |
| §4.2 Sem `any` | Parcial | Endpoint: zero `any`. Testes: `mockResolvedValue([...] as any)` | Baixo |
| §4.2 ESM + `import type` + `.js` | Seguido | `import type { QueryRequest, ... }`; imports relativos com `.js`; export nomeado | — |
| §4.3 Validação Zod de **input** | Seguido | `queryRequestSchema.safeParse(...)` → `throw new ValidationError(...)` | — |
| §4.3 Validação Zod de **output** | Parcial | Faz `queryResponseSchema.safeParse(response)` mas `return toSuccessResponse(response)` (usa o objeto pré-validação, não `validated.data`) | Baixo |
| §4.3 `.strict()` em todos os schemas | **Parcial** | Top-level `request`/`response` têm `.strict()`; o objeto **aninhado** de `conversation_history` (`{ content, role }`) **não** tem | Médio |
| §4.3 Budget (ADR-0002) no input | Seguido | `top_k: z.number().int().min(1).max(5).optional()`, `conversation_history: ...max(3)` | — |
| §4.4 `source_document` na resposta | Seguido | `response.source_document = source`; campo obrigatório no `queryResponseSchema` | — |
| §4.4 `source_document` **mesmo em fallback / sem resultados** | **Ignorado** | Não há guarda para `chunks` vazio: `selectSourceDocument(chunks, ...)` assume lista não-vazia; sem caminho "não encontrado". Com `retrieveTopChunks` retornando `[]`, cai no `safeParse` de output → `InternalServerError` (500), em vez de resposta de "não encontrado" | **Alto** |
| §4.4 `vigencia` no schema (ADR-0003) | Seguido | `vigencia: z.string().trim().min(1).optional()` no `source_document` | — |
| §4.5 `logger` pino, zero `console.*` | Seguido | `import { logger } from "../../shared/logger.js"`; nenhum `console.*` | — |
| §4.5 Log do request com `invocationId/method/url` | Seguido | `logger.info({ invocationId, method, url }, "query request received")` | — |
| §4.5 Log de erro com objeto de erro | Parcial | `logger.error({ err }, "query handler failed")` inclui `err`, mas **omite `invocationId`** (a §10 espera `{ err, invocationId }`) → perde correlação | Baixo |
| §4.5 `durationMs` em chamadas externas | Não verificável | Vive em `src/services/` (não colado) | — |
| §4.6 Custom errors + `mapUnknownError` + corpo `{ error, code }` | Seguido | `mapUnknownError`, `ValidationError`/`InternalServerError`, `toErrorResponse` retorna `{ code, error }` | — |
| §4.7 `app.http` com `methods`/`route`/`authLevel` | Seguido | `app.http("query", { authLevel, handler, methods: ["POST"], route: "query" })` | — |
| §4.8 Config via `config.ts` (sem `process.env`) | Seguido | Nenhum `process.env` no handler | — |
| §9/V5 Teste assere `source_document` | Seguido | Happy path: `expect(res.jsonBody).toEqual({ answer, source_document })` | — |
| §9/V7 Teste de erro padronizado | Parcial | 400 assere `{ code: "VALIDATION_ERROR", error }`; 500 assere **só** `status`, não `{ code: "INTERNAL_SERVER_ERROR" }` | Baixo |
| §9/V8 Teste de violação de budget | **Ignorado** | Nenhum teste com `top_k: 6` ou 4 turnos de histórico | Médio |
| Teste do caminho "sem resultados" (VC-04) | **Ignorado** | Nenhum teste com `retrieveTopChunks` retornando `[]` | Médio |
| Dados de teste em `tests/fixtures/` | **Ignorado** | Chunk `PROC-042` definido **inline** no arquivo de teste | Médio |
| §9/V10 Cobertura ≥ 80% | Não verificável | Sem saída de cobertura no material colado | — |

**Resumo:** Seguido 14 · Parcial 5 · Ignorado 4 · Não verificável 2.

---

## 2) Ambiguidades no SKILL.md que causaram não-aderência

| ID | Ambiguidade (na skill v1) | Não-aderência que causou |
|---|---|---|
| AMB-1 | §4.4 exige `source_document` "mesmo em baixa confiança / nem em fallback", mas **não define o contrato quando a recuperação retorna zero chunks** (sem fonte disponível). | Endpoint assume fonte sempre presente; cai em 500 no caso vazio. Testes não cobrem VC-04. (raiz do gap Alto) |
| AMB-2 | §4.3 diz "usar `.strict()` nos schemas" sem explicitar **objetos aninhados**. | `.strict()` aplicado só no top-level; objeto de `conversation_history` ficou aberto. |
| AMB-3 | Conflito interno: §4.5 (texto) manda `logger.error({ err }, ...)`; §10 (tabela de evidência) mostra `{ err, invocationId }`. | Copilot seguiu o texto mais fraco e omitiu `invocationId`. |
| AMB-4 | §4.3 manda validar o output, mas **não diz para retornar o dado parseado** (`validated.data`). | Validou e retornou o objeto pré-validação (`response`). |
| AMB-5 | Geração de testes é delegada (§2 → `testing-patterns`), mas a skill **não cruza referência** para a regra de fixtures (AGENTS.md) nem define um **conjunto mínimo de casos**. | Testes com dados inline; sem casos de budget nem de "sem resultados". |

---

## 3) Reescritas objetivas sugeridas (por ambiguidade)

- **AMB-1 → adicionar regra de contrato de "sem resultados" em §4.4:**
  > DEVE tratar o caso de recuperação vazia (`chunks.length === 0`): retornar uma resposta de domínio padronizada de "não encontrado" — `answer` com aviso explícito de ausência de fonte **e** `source_document` sentinela (`id: "none"`, `title: "Sem fonte"`, `content: "Nenhum documento correspondente"`), OU lançar `NotFoundError` (404). NÃO DEVE retornar 500 nem inventar fonte. DEVE existir teste para este caminho (VC-04).

- **AMB-2 → endurecer §4.3:**
  > DEVE aplicar `.strict()` a **todos** os objetos Zod, **inclusive aninhados** (ex.: o turno dentro de `conversation_history`).

- **AMB-3 → reconciliar §4.5 com §10:**
  > DEVE logar erro com `logger.error({ err, invocationId }, "...")` — `invocationId` é obrigatório para correlação. (alinhar texto e tabela de evidência)

- **AMB-4 → completar §4.3:**
  > DEVE retornar o resultado parseado (`validated.data`), não o objeto pré-validação.

- **AMB-5 → cruzar referência e definir matriz mínima:**
  > Ao gerar testes para o endpoint, DEVE ler `skills/domain/testing-patterns.md`, importar dados de `tests/fixtures/` (NÃO inline) e cobrir, no mínimo: happy path, input inválido (400 com `code`), falha interna (500 com `code`), **recuperação vazia (VC-04)** e **violação de budget (`top_k:6` e 4 turnos)**.

---

## 4) Top 7 ajustes para o SKILL.md v2 (ordem de impacto)

| # | Ajuste | Impacto | Origem |
|---|---|---|---|
| 1 | Definir contrato explícito de **"sem resultados / não encontrado"** (resposta padronizada + `source_document` sentinela ou `NotFoundError`), com exemplo DO e teste obrigatório | Alto | AMB-1 |
| 2 | `.strict()` em **todos** os objetos Zod, incluindo aninhados (regra + linha na tabela §10) | Médio | AMB-2 |
| 3 | Matriz mínima de testes obrigatória + cross-ref a `testing-patterns` e à regra de **fixtures** | Médio | AMB-5 |
| 4 | Tornar o **teste de budget** (`top_k>5`, histórico>3) um item DEVE, não só critério §9 | Médio | AMB-5 |
| 5 | Reconciliar log de erro: `logger.error({ err, invocationId }, ...)` no texto da regra | Baixo→Médio | AMB-3 |
| 6 | "DEVE retornar `validated.data`, não o objeto pré-validação" | Baixo | AMB-4 |
| 7 | Proibir `as any` em dados de mock; oferecer factory tipada (reforçar exceção restrita do AGENTS.md) | Baixo | §4.2 (testes) |

---

## 5) Risco se não ajustar (itens críticos ignorados)

| Item | Risco residual |
|---|---|
| **Sem caminho "não encontrado" (gap Alto / AMB-1)** | Pergunta sem match retorna **500 genérico** (ou quebra), violando o guardrail de produto "quando não encontrar, dizer explicitamente" (incidente 3 do PS) e o **VC-04**. Reincidência do incidente já mapeado; atendente recebe erro em vez de resposta de fallback. |
| **`.strict()` aninhado ausente (Médio)** | Campos extras dentro de `conversation_history` passam sem rejeição → contrato de input frouxo, superfície para payloads inesperados e drift silencioso do schema. |
| **Sem teste de budget (Médio)** | Regressão futura que afrouxe `top_k`/histórico passa no CI sem detecção → estouro do context budget (ADR-0002), aumento de custo e latência por query. |
| **Fixtures inline (Médio)** | Duplicação de dados de teste entre arquivos e divergência de gabarito; manutenção custosa — exatamente o gap já registrado no Delta v1→v2 do AGENTS.md. |
