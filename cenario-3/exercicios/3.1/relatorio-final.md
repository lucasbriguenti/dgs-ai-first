# Relatório Final — Tech Lead 3.1: Design do Harness do Projeto

**Exercício:** 3.1 — Harness Engineering  
**Papel:** Tech Lead  
**Projeto:** NovaTech Assistant  
**Data:** 2026-06-25  
**Ferramentas usadas:** Claude (design das 5 camadas) + GitHub Copilot (implementação do response-validator.ts)

---

## 1. Resumo executivo

O NovaTech Assistant tinha um pipeline funcional mas sem harness: respostas em texto livre, sem schema enforçado, sem verificação determinística de fonte, sem pontos formais de escalação humana e observabilidade mínima. Este exercício projetou o harness completo em 5 camadas (tool orchestration, verification loops, context & memory, guardrails, observability) e implementou a camada de verification loops via `response-validator.ts` com schema Zod e dois guardrails determinísticos. O code review do código gerado pelo Copilot identificou 4 problemas reais — 2 críticos que tornavam os guardrails ineficazes no fluxo de produção — evidenciando por que revisão humana de código gerado por IA é obrigatória antes do go-live.

---

## 2. As 5 camadas do harness

### Camada 1 — Tool Orchestration

| | |
|---|---|
| **O que existe** | Pipeline de ingestão completo (extractor → chunker → embedder → indexer). Query endpoint POST /api/query recuperando top-5 chunks e chamando GPT-4o. Bot do Teams em staging. |
| **O que falta** | Retry com backoff em chamadas ao Azure AI Search e Azure OpenAI. Fallback explícito quando `retrieveTopChunks` retorna `[]`. Timeouts configurados por serviço. Sem tratamento isolado por etapa — qualquer falha pode resultar em HTTP 500 exposto ao atendente. |
| **Como fechar** | Envolver chamadas externas em try/catch com backoff exponencial (2 tentativas, delay 500ms). Quando retrieval retorna `[]`, retornar `buildNotFoundResponse()` com sentinela `id: "none"`, nunca HTTP 500. Configurar `SEARCH_TIMEOUT_MS=3000` e `COMPLETION_TIMEOUT_MS=10000` em `src/shared/config.ts`. |

### Camada 2 — Verification Loops

| | |
|---|---|
| **O que existe** | Nenhuma verificação de output. Resposta do GPT-4o encaminhada diretamente ao atendente como texto livre. |
| **O que falta** | Schema Zod do structured output. Função que rejeita respostas fora do schema. Verificação de `source_document` contra lista de documentos válidos. Dois guardrails determinísticos. Resposta padrão segura para falhas. |
| **Como fechar** | `src/services/response-validator.ts` implementado neste exercício (ver Seção 3). Chamado obrigatório em `handler.ts` antes de serializar a resposta. |

### Camada 3 — Context & Memory

| | |
|---|---|
| **O que existe** | `top_k = 5` na chamada ao Azure AI Search por convenção (não enforçado em código). Histórico de conversa no bot sem limite definido programaticamente. ADR-0002 documenta o context budget mas não é enforçado via Zod. |
| **O que falta** | Enforçamento do context budget da **ADR-0002** via Zod: `top_k.max(5)` e `conversation_history.max(3)`. Filtro de vigência no retrieval (ADR-0003). Comportamento explícito quando o budget é excedido (rejeitar com HTTP 400, não truncar silenciosamente). |
| **Como fechar** | Em `src/functions/query/validator.ts` (já implementado pelo Copilot): `top_k: z.number().int().min(1).max(5).optional()` e `conversation_history: z.array(historyTurnSchema).max(3).optional()`. Em `src/services/search.ts`: adicionar filtro `vigencia eq 'ativo'` na query ao Azure AI Search, priorizando documentos mais recentes conforme ADR-0003. |

### Camada 4 — Guardrails

| | |
|---|---|
| **O que existe** | System prompt instrui o modelo a incluir `source_document`, responder em português e não inventar informações. Apenas probabilístico — 12% de taxa de erro em staging comprova insuficiência. |
| **O que falta** | Guardrails determinísticos no código (D1 e D2). Ponto formal de Human-in-the-Loop (HITL). |
| **Como fechar** | Ver Seção 3 (guardrails D1 e D2 implementados). HITL: quando `confidence_score < 0.6` e `source_document` é `POL-001` ou `FAQ-Atendimento`, retornar status `"pending_review"` ao bot — resposta não é exibida ao cliente até aprovação do supervisor. |

**Distinção probabilístico × determinístico:**  
O prompt reduz a frequência de erros mas não garante ausência. Um `confidence_score: Alta` no output do modelo não garante que a resposta está correta — o staging confirmou isso. Os guardrails D1 e D2 em código verificam de forma binária, sem margem de falha do modelo.

**Ponto de HITL definido:**

| Campo | Valor |
|---|---|
| Condição de acionamento | `confidence_score < 0.6` **E** `source_document ∈ {POL-001, FAQ-Atendimento}` |
| Quem valida | Supervisor de atendimento (role `supervisor` no Teams) |
| Ação enquanto aguarda | Bot exibe ao atendente: *"Resposta requer validação do supervisor."* Cliente não recebe nada. |
| Prazo máximo | 10 minutos — após isso, bot orienta atendimento manual. |

### Camada 5 — Observability

| | |
|---|---|
| **O que existe** | Logger pino configurado. Logging básico de request/response no handler (invocationId, URL, method). |
| **O que falta** | Log estruturado por resposta com campos rastreáveis. Métricas agregadas. Alertas com thresholds concretos. |
| **Como fechar** | Adicionar evento `query_completed` ao final de cada query com campos: `queryId`, `source_document`, `confidence_score`, `guardrail_triggered`, `hitl_triggered`, `latency_ms`, `validation_passed`. |

**Alertas obrigatórios:**

| Alerta | Threshold | Canal | Responsável |
|--------|-----------|-------|-------------|
| Taxa de guardrail D1 ativado | > 5% das queries em 1h | Teams `#novatech-alertas` | Tech Lead |
| Taxa de HITL acionado | > 10% das queries em 4h | Teams `#novatech-alertas` | Supervisor + TL |
| Latência P95 do query endpoint | > 4.000ms em 15min | PagerDuty | Dev on-call |
| Taxa HTTP 500 | > 1% das requests em 5min | PagerDuty | Dev on-call |

---

## 3. A função de verificação: o que faz, o que detecta, limitações conhecidas

### O que foi implementado

**`src/functions/query/validator.ts`** — schema Zod do structured output:
- `AssistantResponseSchema` com `.strict()`: valida `answer` (string não vazia), `source_document` (string não vazia), `confidence_score` (número 0–1). Rejeita campos extras.
- `VALID_DOCUMENTS`: lista de identificadores válidos — `POL-001`, `PROC-042`, `PROC-042-v2`, `SLA-2024`, `FAQ-Atendimento`.
- `queryRequestSchema` com enforçamento ADR-0002: `top_k.max(5)`, `conversation_history.max(3)`.

**`src/services/response-validator.ts`** — validação determinística:
- `validateResponse(rawResponse)`: executa em ordem — (1) parse Zod, (2) allowlist de fonte, (3) Guardrail D2.
- Guardrail D1: `source_document` ausente ou não no allowlist → retorna `SAFE_RESPONSE_GENERIC`.
- Guardrail D2: `answer` contém variação de "carga perigosa" + "devolução" sem negativa → retorna `SAFE_RESPONSE_HAZMAT`.
- Normalização de acentos (`NFD` + remoção de diacríticos) antes das comparações regex.

### Problemas identificados no code review e correções aplicadas

**Problema 1 — Crítico: `validateCompletionResult` bypassava o Guardrail D2 em respostas legadas.**  
Respostas do modelo com apenas `{ answer }` passavam pelo `LEGACY_COMPLETION_SCHEMA` e eram retornadas sem passar pelo D2. Uma resposta afirmativa de carga perigosa em formato legado não era bloqueada.  
→ **Correção:** aplicar `violatesHazmatReturnGuardrail` também no caminho legado antes de retornar.

**Problema 2 — Crítico: allowlist validava `completion.source_document`, que o `handler.ts` descartava.**  
O handler montava o `source_document` final a partir de `selectSourceDocument(chunks)` — valor que nunca passava pelo allowlist. A verificação de fonte válida não protegia o campo que chegava ao atendente.  
→ **Correção:** mover a checagem de allowlist para o `handler.ts`, após `selectSourceDocument`, antes de montar a resposta.

**Problema 3 — Médio: log duplicado na falha de schema + source ausente.**  
Dois eventos `response_validation_failed` eram emitidos para o mesmo erro.  
→ **Correção:** usar um único log com `reason` priorizado (`source_document_missing` > `schema_invalid`).

**Problema 4 — Médio: `RETURN_PATTERN` não cobria sinônimos de devolução em logística.**  
"retorno", "reversa", "retirada" não disparavam o Guardrail D2.  
→ **Correção:** ampliar o regex com `|\bretorno\b|\brevers[ao]\b|\bretirad\w*\b`.

### Limitações conhecidas (pós-correção)

- **`confidence_score` vem do modelo, não é calculado deterministicamente.** O harness usa o valor que o GPT-4o declara — um modelo com instrução ruim pode sempre declarar `confidence_score: 1`. O threshold de HITL depende da qualidade do calibration do modelo.
- **Guardrail D2 cobre apenas português.** Uma pergunta em inglês respondida em inglês não dispara o regex normalizado. O system prompt instrui resposta em português, mas se isso falhar, o D2 também falha.
- **`FAQ-Atendimento` está na lista de documentos válidos mas é documento informal** (sem controle de versão, sem responsável formal — conforme Anexo A). Respostas com essa fonte passam no allowlist mas têm confiabilidade menor. Considerar rebaixar para acionar HITL automaticamente quando `source_document == "FAQ-Atendimento"`.

---

## 4. Onde structured outputs e HITL entram na arquitetura

| Mecanismo | Camada | Condição de ativação | Implementação |
|-----------|--------|---------------------|---------------|
| **Structured output (Zod)** | Verification Loops | Todo output do modelo antes de chegar ao atendente | `AssistantResponseSchema.safeParse()` em `validateResponse` |
| **Guardrail D1** (fonte inválida) | Guardrails / Verification Loops | `source_document` ausente, vazio ou fora do allowlist | Código determinístico em `response-validator.ts` + `handler.ts` |
| **Guardrail D2** (carga perigosa afirmativa) | Guardrails | Resposta menciona carga perigosa + devolução sem negativa | Regex determinístico em `violatesHazmatReturnGuardrail` |
| **HITL** | Guardrails | `confidence_score < 0.6` E `source_document ∈ {POL-001, FAQ-Atendimento}` | Verificação em `handler.ts` após `validateResponse`; retorna status `"pending_review"` ao bot |

---

## 5. Riscos abertos

| Risco | Camada afetada | Impacto | Mitigação mínima |
|-------|---------------|---------|-----------------|
| `confidence_score` declarado pelo modelo não é calibrado — modelo pode sempre declarar score alto para bypassar HITL | Guardrails | Alto | Adicionar HITL automático para `source_document == "FAQ-Atendimento"` independente do score |
| `selectSourceDocument` pode retornar chunk de documento desatualizado se filtro de vigência não estiver ativo no Azure AI Search | Context & Memory | Alto | Implementar filtro ADR-0003 no `search.ts` antes do go-live |
| Guardrail D2 não cobre resposta em inglês | Guardrails | Médio | Adicionar guardrail de idioma: se `answer` não está em português, retornar safe response |
| `FAQ-Atendimento` no allowlist permite fonte informal com confiança alta | Verification Loops | Médio | Remover do allowlist ou criar allowlist de segundo nível com HITL obrigatório |
| Sem retry/backoff em chamadas externas — falha transiente do Azure AI Search gera HTTP 500 | Tool Orchestration | Médio | Implementar backoff antes do go-live; bloqueante |
| Tool Orchestration e Observability não têm alertas ativos ainda | Observability | Médio | Configurar os 4 alertas definidos na Camada 5 antes do go-live |

---

## 6. Checklist go/no-go para produção

| # | Critério | Status | Bloqueante |
|---|----------|--------|------------|
| 1 | `response-validator.ts` implementado e chamado em `handler.ts` | ✅ Implementado (com correções do code review) | Sim |
| 2 | Guardrail D1 (source inválido) bloqueia antes de chegar ao atendente | ✅ Corrigido — movido para `handler.ts` após `selectSourceDocument` | Sim |
| 3 | Guardrail D2 (carga perigosa afirmativa) cobre caminho legado e structured | ✅ Corrigido | Sim |
| 4 | ADR-0002 enforçada via Zod (`top_k ≤ 5`, `history ≤ 3`) | ✅ Implementado em `queryRequestSchema` | Sim |
| 5 | Retry/backoff em chamadas ao Azure AI Search e Azure OpenAI | ❌ Não implementado | Sim |
| 6 | Filtro de vigência ADR-0003 no retrieval | ❌ Não implementado | Sim |
| 7 | Ponto de HITL definido e implementado no bot | ❌ Projetado, não implementado | Sim |
| 8 | 4 alertas com thresholds concretos configurados | ❌ Não configurados | Desejável |
| 9 | Log estruturado `query_completed` por resposta | ❌ Parcial (campos faltando) | Desejável |
| 10 | `FAQ-Atendimento` reavaliado no allowlist ou com HITL automático | ❌ Pendente decisão | Desejável |

**Conclusão:** 4 de 7 critérios bloqueantes atendidos. Os 3 bloqueantes abertos (retry/backoff, filtro de vigência, HITL no bot) precisam ser fechados antes do go-live — estimativa de 3–4 dias de desenvolvimento.
