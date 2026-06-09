# Auditoria de Aderência — AGENTS.md v1 × Outputs Copilot (Rodada 1)

## Tabela de auditoria

| # | Regra (AGENTS.md v1) | Status | Evidência concreta no código | Severidade do gap |
|---|----------------------|--------|------------------------------|-------------------|
| 1 | Zod para input do endpoint | **Seguido** | `queryRequestSchema` com `question` + `conversation` em `validator.ts:3-6` | — |
| 2 | Zod para output do endpoint | **Seguido** | `queryResponseSchema` com `source_document` obrigatório em `validator.ts:8-11` | — |
| 3 | Sem `console.log/error/warn` em `src/` | **Seguido** | Nenhuma ocorrência em nenhum dos arquivos gerados | — |
| 4 | Logger singleton de `src/shared/logger.ts` | **Seguido** | `handler.ts:9` importa `logger` de `../../shared/logger` | — |
| 5 | Logging estruturado com `requestId` | **Seguido** | `logger.child({ requestId })` em `handler.ts:31`; todos os logs usam `requestLogger` | — |
| 6 | Sem `any` explícito — usar `unknown` | **Seguido** | `parsedBody: unknown` em `handler.ts:33`; sem nenhum `: any` nos arquivos | — |
| 7 | `logger.warn({ error: zodError.flatten() }, 'validation_failed')` antes do 400 | **Seguido** | `handler.ts:45-51` segue exatamente o padrão prescrito | — |
| 8 | Erro retorna JSON `{ error: string; code: string }` | **Seguido** | `badRequestResponse` e resposta 500 em `handler.ts:17-24` e `70-77` | — |
| 9 | `source_document` em toda resposta de query | **Seguido** | Schema exige campo não-vazio; `handler.ts:82` loga `sourceDocument` | — |
| 10 | `tsconfig.json` com `strict: true` | **Parcial** | Código é compatível com strict (sem `any`, sem inferências largas), mas `tsconfig.json` não foi gerado pelo Copilot para confirmar | Baixa |
| 11 | ADR-0002: limite de 3 turnos de histórico | **Parcial** | `validator.ts:5` usa `.max(3)` — limite de turnos aplicado. Sem controle de tokens de chunks (8K) nem system prompt (4K) no pipeline | Média |
| 12 | Tipos de domínio em `src/shared/types.ts` | **Ignorado** | `QueryRequestDto`/`QueryResponseDto` vivem em `validator.ts`; `types.ts` tem `QueryRequest`/`QueryResponse` duplicadas com nomes diferentes; `query-service.ts` importa de `validator.ts`, ignorando `types.ts` | Baixa |
| 13 | Erros customizados de `src/shared/errors.ts` | **Ignorado** | Nenhum `errors.ts` foi criado; erros tratados inline em `handler.ts` sem classes customizadas | Média |
| 14 | ADR-0003: `source_document` reflete documento com vigência mais recente | **Ignorado** | `query-service.ts:47` retorna hardcoded `"FAQ-atendimento"` como fallback — exatamente o documento que o AGENTS.md proíbe como fonte primária | **Alta** |
| 15 | Ponto de extensão RAG preparado | **Parcial** | `runRagPipeline` existe como placeholder (`query-service.ts:30-48`) com comentário, mas retorna resposta inválida de domínio como default | Média |

---

## Análise das regras Parcial/Ignorado

### [12] Tipos em `shared/types.ts` — Ignorado

A regra no v1 diz "exporte todos os tipos de domínio de `src/shared/types.ts`", mas está formulada de forma ambígua. O Copilot gerou dois sistemas de tipos paralelos: `QueryRequest`/`QueryResponse` em `types.ts` (não usados) e `QueryRequestDto`/`QueryResponseDto` em `validator.ts` (usados de fato).

**Reescrita prescritiva para v2:**
> `NÃO DEVE-SE` declarar tipos Zod-infer em `validator.ts`. `DEVE-SE` usar `export type X = z.infer<typeof xSchema>` em `src/shared/types.ts`. `NÃO DEVE-SE` ter definições de tipo duplicadas entre `validator.ts` e `types.ts`.

### [13] `errors.ts` — Ignorado

A regra existe mas não indica nomes de classe nem o que cada uma deve conter. O Copilot simplesmente não criou o arquivo.

**Reescrita prescritiva para v2:**
> `src/shared/errors.ts` DEVE exportar ao menos `ValidationError` e `InternalError` estendendo `Error`. Todo handler DEVE capturar e relançar usando essas classes. NÃO DEVE usar `throw new Error('...')` genérico em handlers.

### [14] ADR-0003 — Ignorado (Alta severidade)

A regra de vigência aparece apenas na seção de fontes de verdade do projeto, não nas regras de código. O Copilot não teve como conectar a regra ao comportamento do `source_document`. Agravante: usou `"FAQ-atendimento"` como fallback hardcoded — o documento explicitamente marcado como "não validado por Compliance".

**Reescrita prescritiva para v2:**
> O campo `source_document` NUNCA deve conter `"FAQ-atendimento"` em respostas reais de produção. Quando o pipeline RAG não estiver implementado, DEVE retornar `source_document: "PENDING"`. A função `runRagPipeline` DEVE selecionar o chunk do documento com `vigência` mais recente quando houver conflito (ADR-0003).

### [11] ADR-0002 parcial — Média severidade

O limite de 3 turnos foi corretamente aplicado no schema Zod (`.max(3)`), mas o orçamento de tokens (4K system prompt, 8K chunks) não tem nenhuma implementação.

**Reescrita prescritiva para v2:**
> `src/services/prompt-builder.ts` DEVE expor `assertContextBudget({ systemPromptTokens, chunkTokens, historyTokens }): void` que lança `BudgetExceededError` antes de qualquer chamada ao Azure OpenAI se qualquer limite for excedido. NÃO DEVE fazer chamada ao Azure OpenAI sem passar por essa verificação.

### [15] Ponto de extensão RAG — Parcial

O placeholder existe e tem comentário descritivo, mas retorna `"FAQ-atendimento"` como `source_document` padrão, violando ADR-0003 e gerando um contrato de retorno sem validação real.

**Reescrita prescritiva para v2:**
> `runRagPipeline` DEVE retornar `source_document: "PENDING"` enquanto não implementado. NÃO DEVE retornar nomes de documentos reais como fallback hardcoded. O contrato de retorno DEVE incluir campo `vigencia: string | null` para suportar ADR-0003.

---

## Top 5 mudanças para AGENTS.md v2 (por impacto)

| Prioridade | Mudança | Gap que corrige |
|-----------|---------|-----------------|
| **1** | ADR-0003 como regra de código: `NUNCA` usar `FAQ-atendimento` em `source_document`; fallback para `"PENDING"` | Placeholder retornou `FAQ-atendimento` hardcoded — viola Compliance |
| **2** | Consolidar tipos: `z.infer` DEVE ficar em `shared/types.ts`; `NÃO DEVE` haver tipos paralelos em `validator.ts` | Dois sistemas de tipos paralelos e inconsistentes |
| **3** | Tornar `errors.ts` obrigatório com nomes de classe explícitos (`ValidationError`, `InternalError`) | Arquivo nunca criado; tratamento de erro inline |
| **4** | ADR-0002 com função `assertContextBudget` obrigatória antes de toda chamada ao Azure OpenAI | Apenas o limite de turnos foi aplicado; budget de tokens ignorado |
| **5** | Separar responsabilidades do ponto de extensão RAG: `runRagPipeline` como stub com contrato de retorno explícito (`{ answer, source_document, vigencia }`) | Placeholder sem contrato; Copilot preencheu com valores inválidos de domínio |
