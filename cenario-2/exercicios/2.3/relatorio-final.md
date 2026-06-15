# Relatório Final — Exercício 2.3: Criação e Teste de Skill Técnica

**Skill:** `azure-functions-endpoint` (Domain)
**Responsável:** Tech Lead
**Fase:** Cenário 2 — Estruturação
**Artefatos:** `SKILL-v1.md`, `SKILL-v2.md`, `copilot-rodada-1.md`, `copilot-rodada-1-testes.md`, `auditoria-aderencia.md`, `copilot-rodada-2.md`, `criterios-maturidade.md`

---

## 1. Resumo executivo

A skill `azure-functions-endpoint` foi criada do zero, testada duas vezes com o Copilot e iterada de v1 para v2 com base em evidências reais de geração. A v2 fechou todos os gaps de impacto Alto e Médio da rodada 1. O principal resultado prático foi a descoberta de uma **ambiguidade crítica de domínio** (comportamento do endpoint quando não há resultado de busca) que a v1 deixava em aberto — o Copilot, sem instrução explícita, gerava um 500; a v2 prescreve um 200 com resposta sentinela tipada (`buildNotFoundResponse`), alinhado ao guardrail de produto "quando não encontrar, dizer explicitamente".

A skill está **Em evolução**: funcional e corretamente prescritiva, faltando apenas uma terceira rodada aprovada e a formalização de review para ser promovida a `Recomendada para o time`.

---

## 2. Evidências de teste real com Copilot

### Rodada 1 (skill v1)

**Prompt usado:** Quick Prompt de ativação v1 (§12 da skill) — gerar endpoint + testes para `POST /api/query`.

**Placar de aderência (endpoint + testes):**

| Status | Contagem |
|---|---|
| Seguido | 14 |
| Parcial | 5 |
| Ignorado | 4 |
| Não verificável | 2 |

**Itens ignorados:**

| Item | Impacto |
|---|---|
| Contrato de "sem resultados / não encontrado" (VC-04) — `selectSourceDocument([])` sem guarda → 500 | **Alto** |
| `.strict()` no objeto aninhado de `conversation_history` | Médio |
| Teste de violação de budget (`top_k: 6`, 4 turnos) | Médio |
| Dados de teste inline em vez de `tests/fixtures/` | Médio |

**Itens parciais notáveis:**
- `logger.error` sem `invocationId` (perda de correlação).
- Retornava `response` em vez de `validated.data` pós-`safeParse` de output.
- Teste de 500 afirmava só o `status`, não o `code`.

### Rodada 2 (skill v2)

**Prompt usado:** Quick Prompt de ativação v2 (§12 da skill v2) — regenerar endpoint + testes + auto-checagem.

**Placar de aderência:**

| Status | Contagem |
|---|---|
| Seguido | 19 |
| Parcial | 1 |
| Ignorado | 0 |
| Não verificável | 1 |

**Único parcial residual (Médio — Baixo):** teste de budget cobre `top_k: 6` mas não `conversation_history` com 4 turnos.

**Fechados da rodada 1:**
- `chunks.length === 0` → `buildNotFoundResponse()` (200 + sentinela `id:"none"`) ✅
- `.strict()` no objeto aninhado ✅
- `validated.data` retornado pós-`safeParse` ✅
- `logger.error({ err, invocationId })` ✅
- Fixtures em `tests/fixtures/chunks.ts` com factory tipada (`makeChunk`, `makeSourceDocument`) ✅
- Teste 500 assere `{ code: "INTERNAL_SERVER_ERROR" }` ✅
- Teste VC-04 ("no chunk retrieved") com `expect(source_document.id).toBe("none")` ✅
- Sem `as any` em dados de mock ✅

---

## 3. Evolução concreta v1 → v2

| Gap da rodada 1 | Regra v1 | Regra v2 | Mudança de comportamento |
|---|---|---|---|
| 500 quando sem resultados (Alto) | "source_document obrigatório mesmo em baixa confiança" — sem definir o caso vazio | §4.4: `chunks.length===0` → `buildNotFoundResponse()` (200 + sentinela); proíbe 500/exceção/fonte inventada; V11 bloqueante | Endpoint retorna 200 com resposta de fallback padronizada em vez de 500 |
| `.strict()` aninhado ausente | "usar `.strict()` nos schemas" (escopo implícito) | §4.3: ".strict() em **todos** os objetos, **inclusive aninhados**"; F11 e §10 atualizados | Schema rejeita campos extras dentro de `conversation_history` |
| `response` pré-validação retornado | "validar o output" (sem dizer o que retornar) | §4.3: "DEVE retornar `validated.data`, não o objeto pré-validação" | Output garantidamente compatível com o schema antes de serializar |
| Log de erro sem correlação | `logger.error({ err }, ...)` (texto) vs `{ err, invocationId }` (§10) | §4.5: texto e §10 alinhados — `logger.error({ err, invocationId }, ...)` obrigatório | Toda falha rastreável ao `invocationId` nos logs |
| Dados inline + sem testes de budget/VC-04 | Testes delegados a `testing-patterns` sem piso | §4.9: 5 casos mínimos obrigatórios + fixtures + mocks tipados; V11 bloqueante; V12 em review | Copilot entregou fixture tipada e os 5 casos na rodada 2 |
| `as any` em dados de mock | "NÃO DEVE usar `any`" (foco em produção) | §4.2 + A14 + F10 + V12: proíbe `as any` inclusive em mock; factory tipada | Mock sem casting; erros de tipo em dados de teste capturados no CI |

---

## 4. O que ainda foi ignorado e risco residual

| Resíduo | Impacto | Risco residual |
|---|---|---|
| Teste de `conversation_history` com 4 turnos (parcial em V8) | Baixo | Regressão futura que afrouxe o limite de histórico passa no CI sem detecção; menor que o risco de `top_k`, já coberto |
| Teste não assere o texto do `answer` no caminho VC-04 | Baixo | Mensagem de fallback pode mudar (ex.: wording do guardrail de produto) sem CI alertar |
| `durationMs` em chamadas externas | Não verificável | Observabilidade de latência de search/completion depende dos services (escopo fora desta skill); sem métrica de duração, triagem de lentidão em produção é mais custosa |
| 3ª rodada de geração não executada | — | Limiar D1 do checklist de maturidade não atingido; skill não promovível a "Recomendada" sem ela |

---

## 5. Critérios de maturidade adotados

Cinco dimensões, cada uma com métrica, limiar e evidência:

| Dimensão | Limiar principal | Estado |
|---|---|---|
| D1 — Aderência em gerações reais | ≥ 3 rodadas; 0 Altos ignorados; ≤ 1 Médio por rodada | **Pendente** (2 rodadas; falta 1) |
| D2 — Clareza e prescritividade | 100% DEVE/NÃO DEVE; texto ↔ §10 alinhados; DO/DON'T com TS real | **Atingido** |
| D3 — Cobertura de anti-padrões | ≥ 80% com ocorrência rastreável em rodada real | **Atingido** |
| D4 — Estabilidade após iterações | 0 reversões; Delta documentado; build + test passando | **Atingido** |
| D5 — Aprovação em review técnico | 1 TL + 1 Dev; sem conflito com AGENTS.md; ref. em tasks.md | **Parcial** (sem conflito ✅; approvals e tasks.md pendentes) |

**Checklist go/no-go:** 5 de 7 itens atingidos.

---

## 6. Conclusão

**Veredito: `Em evolução`**

A skill cumpre o objetivo central do exercício 2.3: demonstrar que skills são artefatos vivos, não documentos estáticos. A iteração v1→v2 produziu mudança **comportamental real** — o Copilot passou de gerar um 500 inesperado no caso sem resultado para entregar um 200 com resposta de fallback tipada, alinhada ao guardrail de produto e ao VC-04 da spec. Isso não foi ajuste cosmético: exigiu identificar a ambiguidade na skill (AMB-1), definir um contrato explícito (`buildNotFoundResponse` com sentinela), adicionar critério de validação bloqueante (V11) e confirmar a correção na rodada 2.

A skill está **pronta para uso supervisionado**: pode ser dada ao Copilot para gerar novos endpoints, desde que o Dev revise o resultado contra o checklist de §8 antes do PR. Não está ainda promovida a `Recomendada para o time` porque falta uma terceira rodada aprovada (D1) e os approvals formais de Tech Lead e Dev consumidor (D5). Ambos os bloqueios são de processo, não de qualidade técnica da skill.

**Próximos passos para promover a skill:**
1. Executar a rodada 3 (endpoint diferente — ex.: `POST /api/feedback`) e confirmar ≤ 1 Médio ignorado.
2. Registrar approval do Tech Lead no PR da skill.
3. Incluir referência à skill em `specs/query-endpoint/tasks.md` (task de implementação do handler).
