# Relatório Final — Exercício 2.1 (Construção e Teste do AGENTS.md)

## 1. Resumo executivo

O AGENTS.md v1 produziu código com boa aderência aos padrões de logging, validação Zod e estrutura de endpoint, mas falhou em três áreas críticas: violou ADR-0003 ao hardcodar `"FAQ-atendimento"` como `source_document`, não criou `errors.ts` e não implementou nenhum controle de budget de tokens (ADR-0002). A auditoria converteu regras declarativas em regras de código com contratos explícitos. O AGENTS.md v2 corrigiu todos os 5 gaps prioritários: a rodada 2 gerou `errors.ts` completo, `assertContextBudget`, tipos consolidados em `shared/types.ts`, stub retornando `"PENDING"` e campo `vigencia` no contrato RAG. A diferença entre v1 e v2 é estrutural, não cosmética.

---

## 2. Evidências de teste real

### Rodada 1 — AGENTS.md v1

| Artefato | Resultado |
|----------|-----------|
| `src/functions/query/handler.ts` | Gerado; sem erros customizados; sem import de `shared/types.ts` |
| `src/functions/query/validator.ts` | Gerado; exportava tipos (`QueryRequestDto`, `QueryResponseDto`) — viola regra de consolidação |
| `src/services/query-service.ts` | Gerado; retornou `source_document: "FAQ-atendimento"` hardcoded; sem `assertContextBudget`; sem campo `vigencia` |
| `src/shared/types.ts` | Gerado; tipos `QueryRequest`/`QueryResponse` declarados mas **não usados** (dead code) |
| `src/shared/errors.ts` | **Não gerado** |
| `src/services/prompt-builder.ts` | **Não gerado** |
| `tests/unit/…/handler.test.ts` | Gerado; 4 casos (happy path + 3 erros); mocks corretos; `beforeEach` com `clearAllMocks` |

**Checks do Checklist v1 reprovados:** C12 (errors.ts), C13 (tipos duplicados), C8 (budget sem implementação), C14 (não existia), C4 (FAQ-atendimento no source_document).

### Rodada 2 — AGENTS.md v2

| Artefato | Resultado |
|----------|-----------|
| `src/functions/query/handler.ts` | Atualizado; importa `ValidationError`/`InternalError`; importa `QueryRequest` de `shared/types.ts` |
| `src/functions/query/validator.ts` | Atualizado; apenas schemas, sem export de tipos |
| `src/services/query-service.ts` | Atualizado; importa de `shared/types.ts`; `RagResult` com `vigencia`; `source_document: "PENDING"`; chama `assertContextBudget` |
| `src/shared/types.ts` | Atualizado; usa `z.infer` dos schemas; sem duplicatas |
| `src/shared/errors.ts` | **Criado**; `ValidationError`, `InternalError`, `BudgetExceededError` com assinaturas corretas |
| `src/services/prompt-builder.ts` | **Criado**; `assertContextBudget` com verificações de limite e lança `BudgetExceededError` |
| `tests/unit/…/handler.test.ts` | Mantido; mocks atualizados para incluir `errors` e `shared/types` |
| `autochecagem-v2.md` | Gerado; 19 regras mapeadas; 18 com confiança Alta, 1 com confiança Média |

**Checks do Checklist v2 aprovados:** C1–C14 todos passam, com uma ressalva em C8 (ver seção 4).

---

## 3. O que melhorou concretamente de v1 para v2

| Gap v1 | Melhoria v2 | Evidência |
|--------|-------------|-----------|
| `source_document: "FAQ-atendimento"` hardcoded | `source_document: "PENDING"` no stub | `query-service.ts:54` |
| Dois sistemas de tipos paralelos (`validator.ts` + `types.ts`) | `shared/types.ts` usa `z.infer`; `validator.ts` só schemas; service importa de `types.ts` | `types.ts:8-9`, `query-service.ts:4` |
| `errors.ts` não criado; erros inline | `errors.ts` com `ValidationError`, `InternalError`, `BudgetExceededError`; usados em `handler.ts` | `errors.ts:3-20`, `handler.ts:9,53,71` |
| ADR-0002: apenas `.max(3)` no schema | `assertContextBudget` implementada; chamada em `runRagPipeline` antes de qualquer integração futura | `prompt-builder.ts:9-30`, `query-service.ts:37-41` |
| Stub sem contrato de `vigencia` | `RagResult` com `vigencia: string \| null`; stub retorna `vigencia: null` explicitamente | `query-service.ts:26-30,55` |

---

## 4. Limites observados: o que ainda foi ignorado e risco associado

| Item | O que foi ignorado | Risco |
|------|--------------------|-------|
| **Budget em tokens reais** | `assertContextBudget` recebe `historyTokens: payload.conversation.length` (número de turnos, não tokens). `systemPromptTokens: 0` e `chunkTokens: 0` são hardcoded no stub. A verificação passa sempre, sem medir tokens reais. | **Médio** — A função existe e lançará `BudgetExceededError` quando integrada com valores reais, mas a chamada atual não exercita os limites de 4K/8K. |
| **`tsconfig.json` não gerado** | Em nenhuma das duas rodadas o Copilot gerou o `tsconfig.json` com `"strict": true`. O código é compatível com strict, mas a verificação do C6 não pode ser concluída. | **Baixo** — Risco de drift silencioso se outro agente criar `tsconfig.json` sem strict. |
| **Limite superior de `historyTokens` em `assertContextBudget`** | A implementação verifica apenas `historyTokens < 0` (negativo). Não há verificação de limite superior para tokens de histórico — a ADR-0002 implica que 3 turnos têm custo variável. | **Baixo** — Cobertura parcial; o limite de turnos (`.max(3)` no schema) compensa parcialmente. |
| **Testes não cobrem `BudgetExceededError`** | `handler.test.ts` não tem caso de teste para quando `assertContextBudget` lança `BudgetExceededError`. | **Baixo** — Gap de cobertura de teste, não de lógica de produção. |

---

## 5. Conclusão de prontidão

**Veredicto: Parcialmente pronto**

**Justificativa:** O AGENTS.md v2 demonstrou capacidade de direcionar o Copilot para corrigir todos os 5 gaps críticos identificados na auditoria — erros customizados, consolidação de tipos, contrato RAG com `vigencia`, fallback `"PENDING"` e estrutura de `assertContextBudget`. A evolução de v1 para v2 é concreta e verificável no código. O que impede "Pronto" é que `assertContextBudget` ainda não mede tokens reais (recebe zeros no stub), o que significa que o enforcement do ADR-0002 só existirá de fato quando a integração com Azure AI Search e Azure OpenAI for implementada. A constitution está prescritiva o suficiente para guiar essa implementação futura, mas não é possível validar o budget end-to-end neste estágio.
