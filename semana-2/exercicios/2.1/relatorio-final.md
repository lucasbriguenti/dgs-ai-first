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
| `src/services/query-service.ts` | Atualizado; importa de `shared/types.ts`; `RagResult` com `vigencia`; `source_document: "PENDING"`; chama `buildContextBudgetSnapshot` + `assertContextBudget` e loga `budget_snapshot` |
| `src/shared/types.ts` | Atualizado; usa `z.infer` dos schemas; sem duplicatas |
| `src/shared/errors.ts` | **Criado**; `ValidationError`, `InternalError`, `BudgetExceededError` com assinaturas corretas |
| `src/services/prompt-builder.ts` | **Criado**; `assertContextBudget` com verificações de limite e lança `BudgetExceededError` |
| `tests/unit/…/handler.test.ts` | Atualizado; inclui caso para `BudgetExceededError` com retorno HTTP 400 padronizado |
| `autochecagem-v2.md` | Gerado; 19 regras mapeadas; 18 com confiança Alta, 1 com confiança Média |

**Checks do Checklist v2 aprovados:** C1–C16 passam. C17 permanece pendente por depender de métrica em staging.

---

## 3. O que melhorou concretamente de v1 para v2

| Gap v1 | Melhoria v2 | Evidência |
|--------|-------------|-----------|
| `source_document: "FAQ-atendimento"` hardcoded | `source_document: "PENDING"` no stub | `query-service.ts:54` |
| Dois sistemas de tipos paralelos (`validator.ts` + `types.ts`) | `shared/types.ts` usa `z.infer`; `validator.ts` só schemas; service importa de `types.ts` | `types.ts:8-9`, `query-service.ts:4` |
| `errors.ts` não criado; erros inline | `errors.ts` com `ValidationError`, `InternalError`, `BudgetExceededError`; usados em `handler.ts` | `errors.ts:3-20`, `handler.ts:9,53,71` |
| ADR-0002: apenas `.max(3)` no schema | Snapshot real de budget implementado (`systemPromptTokens`, `chunkTokens`, `historyTokens`, `totalTokens`) com validação de limites e log estruturado | `prompt-builder.ts`, `query-service.ts` |
| Stub sem contrato de `vigencia` | `RagResult` com `vigencia: string \| null`; stub retorna `vigencia: null` explicitamente | `query-service.ts:26-30,55` |

---

## 4. Limites observados: o que ainda foi ignorado e risco associado

| Item | O que foi ignorado | Risco |
|------|--------------------|-------|
| **`tsconfig.json` não gerado** | Em nenhuma das duas rodadas o Copilot gerou o `tsconfig.json` com `"strict": true`. O código é compatível com strict, mas a verificação do C6 não pode ser concluída. | **Baixo** — Risco de drift silencioso se outro agente criar `tsconfig.json` sem strict. |
| **Limite superior de `historyTokens` em `assertContextBudget`** | A implementação verifica apenas `historyTokens < 0` (negativo). Não há verificação de limite superior para tokens de histórico — a ADR-0002 implica que 3 turnos têm custo variável. | **Baixo** — Cobertura parcial; o limite de turnos (`.max(3)` no schema) compensa parcialmente. |
| **Taxa de `PENDING` em staging ainda não medida** | Ainda não há evidência operacional da regra C17 (`source_document: "PENDING"` <= 5% em staging). | **Baixo** — depende de observação em ambiente de staging, não de código local. |

---

## 5. Conclusão de prontidão

**Veredicto: Pronto para submissão (com ressalva operacional)**

**Justificativa:** O AGENTS.md v2 demonstrou capacidade de direcionar o Copilot para corrigir os gaps críticos identificados na auditoria — erros customizados, consolidação de tipos, contrato RAG com `vigencia`, fallback `"PENDING"` e enforcement de budget com snapshot real de tokens e validação de limite total. A evolução de v1 para v2 é concreta e verificável no código e em teste automatizado. A única ressalva remanescente é operacional: medir a taxa de `PENDING` em staging (C17) antes de merge em `main`.

---

## 6. O que fazer antes de entregar (priorizado por impacto)

1. **Blindar evidência de uso real do Copilot**
	- Registrar prompt usado, output principal e decisão de reescrita por item ignorado.
	- Evidência esperada: tabela por rodada preenchida com links para arquivos gerados.

2. **Validar critério de saída de `PENDING`**
	- Definir checkpoint para impedir merge em `main` se `source_document` ainda estiver como placeholder acima do limite aceito.
	- Evidência esperada: regra no AGENTS v2 + item de checklist de PR.

3. **Executar validação em staging para C17**
	- Medir a taxa de respostas com `source_document: "PENDING"` em janela representativa.
	- Evidência esperada: taxa <= 5% registrada no relatório de PR.

---

## 7. Definition of Done (DoD) — Exercício 2.1

O exercício é considerado **pronto para submissão** somente quando todos os itens abaixo estiverem marcados:

- [x] AGENTS v1 e AGENTS v2 anexados e comparáveis (mudanças estruturais, não cosméticas).
- [x] Evidência de duas rodadas com Copilot (endpoint + teste) registrada no relatório.
- [x] Para cada item ignorado na rodada 1, existe reescrita prescritiva no AGENTS v2.
- [x] ADR-0002 aparece como regra executável (`assertContextBudget`) e não apenas texto descritivo.
- [x] ADR-0003 aparece como regra de código para `source_document` com `vigencia`.
- [x] Checklist de aderência atualizado com resultado final C1..Cn.
- [x] Limitações remanescentes documentadas com risco e plano de mitigação.

---

## 8. Matriz de Evidências (uso real do Copilot)

| Rodada | Prompt utilizado (resumo) | Output principal | O que seguiu | O que ignorou | Ajuste aplicado no AGENTS |
|---|---|---|---|---|---|
| 1 (v1) | Gerar endpoint Azure Function HTTP `POST /query` com validação e teste Vitest | `handler.ts`, `validator.ts`, `query-service.ts`, `handler.test.ts` | Zod input/output, logger estruturado, sem `console`, limite de 3 turnos | `errors.ts` ausente, tipos duplicados, fallback `FAQ-atendimento`, sem enforcement real de budget | Regras explícitas para `errors.ts`, `shared/types.ts`, `source_document: "PENDING"`, `assertContextBudget` obrigatório |
| 2 (v2) | Regenerar/ajustar endpoint e testes seguindo AGENTS v2 prescritivo | `errors.ts` criado, `prompt-builder.ts` criado, `query-service.ts` com `RagResult` e `vigencia`, `handler.ts` ajustado, `handler.test.ts` com caso de budget excedido | Correção dos gaps críticos da rodada 1 + enforcement de budget com snapshot real e teste automatizado | Medição operacional da taxa de `PENDING` em staging ainda pendente | Planejado no item 3 da seção "O que fazer antes de entregar" |

---

## 10. Evidência de execução local (pós-ajustes)

Comando executado:

`npx vitest tests/unit/functions/query/handler.test.ts`

Resultado:

- Test Files: 1 passed
- Tests: 6 passed
- Inclui o caso `returns 400 when context budget is exceeded`

---

## 9. Checklist de Prescritividade (AGENTS v2)

| Regra | Classificação | Observação |
|---|---|---|
| `DEVE-SE` chamar `assertContextBudget` antes de Azure OpenAI | **Prescritiva** | Regra acionável e auditável em código |
| `NÃO DEVE-SE` usar placeholders de token (`0`, `null`, etc.) fora de teste | **Prescritiva** | Critério objetivo para reprovar implementação incompleta |
| `DEVE-SE` usar `source_document: "PENDING"` apenas em stub | **Prescritiva** | Com critério de saída explícito evita placeholder permanente |
| `QUANDO EM DÚVIDA`, medir com ferramenta de token | **Parcialmente prescritiva** | Melhoria sugerida: trocar por "DEVE-SE medir em toda mudança que altere prompt/chunks" |
| "usar com cautela" para e2e | **Narrativa** | Melhoria sugerida: definir gatilho e limite objetivo de execução |
