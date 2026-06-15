# Relatório Final — Tech Lead 2.1 (Construção e Teste do AGENTS.md)

**Projeto:** NovaTech Assistant  
**Papel:** Tech Lead  
**Ferramentas:** Claude (chat) + GitHub Copilot  
**Data:** 2026-06-15  
**Artefatos:** AGENTS-v1.md · AGENTS-v2.md · autochecagem-v2.md

---

## 1. Resumo Executivo

O AGENTS.md v1 foi escrito com estilo prescritivo (DEVE/NÃO DEVE) e materializou as decisões das ADRs do Cenário 1: context budget de ~12.200 tokens por query (ADR-0002), tratamento de documentos contraditórios por metadado de vigência (ADR-0003) e campo `source_document` obrigatório em toda resposta. No teste com Copilot, a rodada 1 atingiu **65% de aderência (13/20 regras seguidas integralmente)** — resultado sólido para um v1. O gap crítico foi estrutural: lógica de negócio (`retrieveTopChunks`, `buildRagPrompt`) foi gerada dentro de `src/functions/query/response-builder.ts` em vez de `src/services/`, pois o v1 não delimitava essa fronteira com clareza suficiente. O AGENTS.md v2 corrigiu esse gap com diagrama de pastas, regras por arquivo e exemplo DO/DON'T, além de tornar o budget executável via Zod e adicionar regras de log com duração e fixtures obrigatórias. Na rodada 2, **todos os 6 gaps da rodada 1 foram corrigidos**, incluindo a migração completa de lógica de negócio para `src/services/`, log de budget por request e fixtures exportadas em `tests/fixtures/`.

---

## 2. Evidências de Teste Real

### Rodada 1 — AGENTS.md v1

**Arquivos gerados pelo Copilot** (em `novatech-assistant/`):

| Arquivo | O que o Copilot gerou |
|---|---|
| `src/shared/logger.ts` | Instância pino com `service`, `level` e `timestamp` configurados |
| `src/shared/errors.ts` | Hierarquia `AppError` base abstrata com `code`+`statusCode`; 5 subclasses |
| `src/shared/types.ts` | `QueryResponse` com `source_document` obrigatório; `SourceDocument` com `vigencia`; `ErrorResponse` com `{ error, code }` |
| `src/functions/query/handler.ts` | Azure Functions v4; `safeParse` input+output; `logger.error({ err })`; `mapUnknownError`; zero `any` em produção |
| `src/functions/query/validator.ts` | Todos os schemas com `.strict()`; `top_k: max(5)`; `history: max(3)` |
| `src/functions/query/response-builder.ts` | `buildRagPrompt`, `retrieveTopChunks`, `buildSourceDocument` — **aqui está o gap** |
| `tests/unit/query-handler.test.ts` | Mocking correto; assertions com `toEqual`/`toHaveBeenCalledWith`; dados NovaTech — **mas inline** |

**Resultado da auditoria da rodada 1:**

| Categoria | Contagem |
|---|---|
| Seguido | 13/20 |
| Parcial | 4/20 |
| Ignorado | 3/20 |

Gap de severidade Alta: lógica de negócio (retrieval + prompt building) em `response-builder.ts` em vez de `src/services/`.

---

### Rodada 2 — AGENTS.md v2

**Arquivos gerados/atualizados pelo Copilot:**

| Arquivo | Mudança em relação à rodada 1 |
|---|---|
| `src/services/search.ts` | `retrieveTopChunks` com `durationMs`; `selectSourceDocument` com sort por `vigencia` (ADR-0003) |
| `src/services/prompt-builder.ts` | `buildRagPrompt` com `slice(0,3)` no histórico e `slice(0,5)` nos chunks |
| `src/services/completion.ts` | `completeAnswer` com `durationMs`; stub extensível |
| `src/services/response-validator.ts` | `validateCompletionResult` com Zod |
| `src/functions/query/handler.ts` | Importa de `services/`; log de budget `{ historyTurns, topK }` adicionado |
| `src/functions/query/response-builder.ts` | Reduzido a `toSuccessResponse` + `toErrorResponse` (serialização pura) |
| `tests/fixtures/chunks.ts` | `happyPathChunks` com 2 chunks NovaTech com vigências distintas (testa ADR-0003) |
| `tests/fixtures/queries.ts` | `happyPathQuery` com `conversation_history` de 2 turnos; `missingQuestionQuery` |
| `tests/fixtures/expected-responses.ts` | `happyPathResponse` com `doc-new` (vigência mais recente); respostas de erro |
| `tests/unit/query-handler.test.ts` | Importa de fixtures; mock de `services/search.js` e `services/completion.js`; valida log de budget |

**Resultado da autochecagem da rodada 2 (ver `autochecagem-v2.md`):**

| Categoria | Contagem |
|---|---|
| Seguido com confiança Alta | 16/16 regras verificáveis |
| Gaps rodada 1 corrigidos | 6/6 |
| Riscos residuais | 4 (todos de baixa/média severidade) |

---

## 3. O que Melhorou de v1 para v2

| Gap (rodada 1) | Mudança no v2 | Resultado na rodada 2 |
|---|---|---|
| `retrieveTopChunks` e `buildRagPrompt` em `functions/query/` | Diagrama de pastas + regras por arquivo + exemplo DO/DON'T explícito | Funções migradas para `src/services/`; `response-builder.ts` virou serialização pura |
| Budget ADR-0002 seguido por coincidência | Exemplo Zod obrigatório + regra de log `{ historyTurns, topK }` | Copilot adicionou `logger.info({ historyTurns, topK }, "context budget usage")` no handler |
| `as HttpRequest` sem exceção no AGENTS.md | EXCEÇÃO de teste explicitada para helpers de mock | Uso correto e documentado; sem violação da regra geral |
| Log sem timing em chamadas externas | Regra + exemplo `Date.now()` antes/depois | `durationMs` em `retrieval completed` (search) e `completion completed` (completion) |
| Dados de chunk inline no teste | Regra: dados NovaTech em `tests/fixtures/`, proibido inline | Três arquivos de fixture criados e importados no teste |
| `selectSourceDocument` sem critério de vigência | Regra ADR-0003 com `vigencia` explícita no tipo e no Zod schema | Lógica de sort por `vigencia` em `src/services/search.ts` |

---

## 4. Limites Observados

| Limite | Risco | Observação |
|---|---|---|
| `npm test` não executado durante a sessão | Cobertura real (80% de linhas) não foi validada | Estrutura de mocks e 3 cenários cobrem os critérios de aceite; execução do Vitest é o próximo passo |
| `src/shared/config.ts` é stub vazio | `process.env` pode ser lido diretamente em extensions futuras | Monitorar na geração das próximas tasks; baixo risco agora pois não há integração real |
| `completeAnswer` retorna stub fixo | A lógica de chamada ao GPT-4o não foi implementada | Esperado nesta fase; ponto de extensão explicitamente marcado |
| Seções TODO no AGENTS.md (QA, PS, DM) | Agentes leem contexto parcial enquanto essas seções estão abertas | Controlar distribuição do AGENTS.md até as seções dos outros papéis serem preenchidas |
| AGENTS.md não substitui code review humano | Copilot pode aderir ao formato e gerar lógica incorreta | Validation gate: PR obrigatório (mesmo que local, em `docs/pull-requests/`) antes de qualquer merge |

---

## 5. Conclusão de Prontidão

**Pronto para uso pelo time (com ressalvas)**

**Justificativa:**

O AGENTS.md v2 demonstrou melhoria concreta e mensurável entre as duas rodadas: todos os 6 gaps identificados na rodada 1 foram corrigidos na rodada 2. O gap crítico de arquitetura (fronteira `services/` vs. `response-builder.ts`) foi resolvido com precisão — o Copilot gerou 4 novos arquivos em `src/services/` com padrões corretos de logging, Zod e tipagem. A qualidade final do código é de nível produção para uma fase de estruturação.

**Ressalvas para uso pleno:**

1. Executar `npm test` e confirmar cobertura ≥ 80% antes de compartilhar o AGENTS.md com o time.
2. Aguardar preenchimento das seções de QA, Product Specialist e Delivery Manager antes de usar o AGENTS.md como referência para geração de outros módulos.
3. Validar o padrão de `config.ts` na próxima task que introduzir variáveis de ambiente.

**O ciclo v1 → teste → auditoria → v2 → reteste demonstrou o valor do AGENTS.md como artefato iterativo**: não é um documento estático escrito uma vez, mas um contrato calibrado empiricamente a partir do comportamento real do agente.
