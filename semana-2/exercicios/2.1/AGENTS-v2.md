# AGENTS.md — NovaTech Assistant
> Constitution do projeto para Copilot e Claude Code.
> Versão: v2 | Repositório: `db1/novatech-assistant`

---

## 1. Project Overview

- Este repositório implementa o **NovaTech Assistant**: assistente de IA baseado em RAG integrado ao Microsoft Teams para suporte a operações logísticas.
- Domínio: consultas sobre políticas de devolução, frete especial, SLA por tier de cliente e FAQ de atendimento.
- Audiência: operadores logísticos e equipe de atendimento da NovaTech.

### Fontes de verdade do domínio

| Documento | Descrição | Metadado de vigência |
|-----------|-----------|----------------------|
| `POL-001` | Política de devolução | Sim |
| `PROC-042-v2` | Frete especial (versão vigente) | `vigencia: 2023-12-01` |
| `SLA-2024` | SLA por tier (Gold / Silver / Standard) | Sim |
| `FAQ-atendimento` | FAQ informal — NÃO É fonte primária; NÃO resolve conflitos | Não |

**REGRA ADR-0003 — Conflito de documentos (aplicada no código):**
- **DEVE-SE** selecionar o chunk cujo metadado `vigencia` seja mais recente quando dois documentos apresentarem informações contraditórias.
- **NÃO DEVE-SE** usar `FAQ-atendimento` como `source_document` em respostas de produção.
- **NÃO DEVE-SE** retornar nome de documento real como fallback hardcoded em stubs ou placeholders. Use `"PENDING"`.
- **QUANDO EM DÚVIDA** sobre qual documento prevalece, leia o campo `vigencia` do metadado — não a ordem de aparição nos chunks.

---

## 2. Tech Stack & Architecture

### Stack obrigatória

| Camada | Tecnologia | Versão mínima |
|--------|-----------|---------------|
| Linguagem | TypeScript (strict mode obrigatório) | 5.x |
| Backend / endpoints | Azure Functions v4 (HTTP triggers) | v4 |
| Painel web | React | 18.x |
| IaC | Bicep | — |
| Validação I/O | Zod | 3.x |
| Testes | Vitest | 1.x |
| Logging | pino | 8.x |

### Context Budget por query — ADR-0002

**DEVE-SE** respeitar o seguinte orçamento de tokens por chamada ao Azure OpenAI:

```
System prompt        : ≤ 4.000 tokens
Chunks RAG           : ≤ 8.000 tokens (máx 5 chunks × ~1.500 tokens)
Pergunta do usuário  : variável
Histórico de turnos  : máximo 3 turnos anteriores
─────────────────────────────────────────────
Total recomendado    : < 16.000 tokens por chamada (janela disponível: 128K)
```

**DEVE-SE** chamar `assertContextBudget` em `src/services/prompt-builder.ts` antes de toda chamada ao Azure OpenAI:

```typescript
// src/services/prompt-builder.ts
assertContextBudget({
  systemPromptTokens: number,  // DEVE ser ≤ 4000
  chunkTokens: number,         // DEVE ser ≤ 8000
  historyTokens: number,       // derivado de no máximo 3 turnos
}): void  // lança BudgetExceededError se qualquer limite for excedido
```

- **NÃO DEVE-SE** incluir mais de 5 chunks por query.
- **NÃO DEVE-SE** fazer chamada ao Azure OpenAI sem passar por `assertContextBudget`.
- **NÃO DEVE-SE** expandir o histórico de turnos além de 3 sem ADR explícita.
- **QUANDO EM DÚVIDA** sobre o tamanho do system prompt, meça com `tiktoken` antes de fazer deploy.

### Enforcement obrigatório do budget (critérios de falha)

- **DEVE-SE** calcular tokens reais de `systemPromptTokens`, `chunkTokens` e `historyTokens` antes de chamar Azure OpenAI.
- **NÃO DEVE-SE** passar valores placeholder (`0`, `-1`, `null`, `undefined`) para `assertContextBudget` fora de testes.
- **DEVE-SE** lançar `BudgetExceededError` quando qualquer limite for excedido e retornar erro padronizado `{ error, code }` no handler.
- **DEVE-SE** registrar `budget_snapshot` no log estruturado antes da chamada ao modelo contendo `{ systemPromptTokens, chunkTokens, historyTokens, totalTokens }`.
- **NÃO DEVE-SE** executar completion se `assertContextBudget` falhar.

### Arquitetura de pastas

```
src/functions/      # Azure Functions (um diretório por endpoint)
src/services/       # Lógica de negócio (search, completion, prompt-builder)
src/pipeline/       # Pipeline de ingestão (extractor, chunker, embedder, indexer)
src/bot/            # Bot do Teams
src/web/            # Painel React
src/shared/         # Tipos, config, logger, errors
tests/unit/         # Testes sem chamadas externas (mocks obrigatórios)
tests/integration/  # Testes com mocks para APIs externas via msw
tests/e2e/          # Fluxo completo (usar com cautela — consome tokens)
infra/              # Bicep (main.bicep + módulos)
specs/              # Specs SDD por módulo
```

- **DEVE-SE** colocar cada Azure Function em `src/functions/<nome>/handler.ts`.
- **DEVE-SE** isolar validação Zod em `src/functions/<nome>/validator.ts`.
- **NÃO DEVE-SE** criar lógica de negócio dentro de `handler.ts`; delegue para `src/services/`.

---

## 3. Coding Standards

### TypeScript

- **DEVE-SE** manter `"strict": true` em `tsconfig.json`. NÃO DEVE-SE desabilitar regras de strict.
- **NÃO DEVE-SE** usar `any` explícito. Use `unknown` e faça type narrowing.
- **DEVE-SE** usar `satisfies` ou cast explícito ao atribuir literais a tipos Zod inferidos.

### Tipos de domínio — `src/shared/types.ts`

- **DEVE-SE** exportar todos os tipos de domínio de `src/shared/types.ts` usando `z.infer`:

```typescript
// src/shared/types.ts — padrão obrigatório
export type QueryRequest  = z.infer<typeof queryRequestSchema>;
export type QueryResponse = z.infer<typeof queryResponseSchema>;
```

- **NÃO DEVE-SE** declarar `export type` derivados de Zod diretamente em `validator.ts`. O `validator.ts` DEVE conter apenas os schemas; os tipos DEVEM ser re-exportados de `src/shared/types.ts`.
- **NÃO DEVE-SE** ter definições de tipo duplicadas entre `validator.ts` e `shared/types.ts`.
- Todo arquivo em `src/services/` e `src/functions/` que precisa de tipos de domínio DEVE importar de `src/shared/types.ts`, nunca de `validator.ts`.

### Validação com Zod

- **DEVE-SE** definir um schema Zod para todo input de endpoint HTTP (request body, query params, path params) em `src/functions/<nome>/validator.ts`.
- **DEVE-SE** definir um schema Zod para todo output de endpoint que retorna JSON em `src/functions/<nome>/validator.ts`.
- **NÃO DEVE-SE** fazer parse manual de JSON sem passar pelo schema Zod correspondente.
- **QUANDO EM DÚVIDA** sobre validação de campo opcional, prefira `z.string().optional()` a omitir o campo.
- **DEVE-SE** logar o erro de validação com `logger.warn({ error: zodError.flatten() }, 'validation_failed')` antes de retornar 400.

### Tratamento de erros — `src/shared/errors.ts`

- **DEVE-SE** criar `src/shared/errors.ts` com ao menos as seguintes classes:

```typescript
// src/shared/errors.ts — classes obrigatórias
export class ValidationError extends Error { constructor(public details: ZodFlattenedError) { super('validation_error') } }
export class InternalError    extends Error { constructor(message: string) { super(message) } }
export class BudgetExceededError extends Error { constructor(public budget: object) { super('context_budget_exceeded') } }
```

- **NÃO DEVE-SE** usar `throw new Error('...')` genérico em handlers ou services. Use as classes de `errors.ts`.
- **NÃO DEVE-SE** retornar stack traces ao cliente em ambiente de produção.
- **DEVE-SE** retornar JSON com campos `{ error: string; code: string }` em toda resposta de erro.

### Logging com pino

- **NÃO DEVE-SE** usar `console.log`, `console.error`, `console.warn` em nenhum arquivo sob `src/`.
- **DEVE-SE** usar somente o logger singleton de `src/shared/logger.ts` (instância `pino`).
- **DEVE-SE** usar logging estruturado: `logger.info({ query, sourceDocument }, 'query_completed')`.
- **DEVE-SE** incluir campo `requestId` em todos os logs de endpoint.

### Respostas de endpoint RAG

- **DEVE-SE** incluir campo `source_document` em toda resposta de query com o identificador do documento usado (ex: `"POL-001"`).
- **NÃO DEVE-SE** retornar `"FAQ-atendimento"` como valor de `source_document` em respostas de produção.
- **NÃO DEVE-SE** hardcodar nomes de documentos reais em stubs/placeholders. Use `"PENDING"` como valor de fallback.
- **DEVE-SE** aplicar ADR-0003: quando múltiplos chunks conflitantes, `source_document` DEVE referenciar o documento com `vigencia` mais recente.

### Ponto de extensão RAG — contrato obrigatório

Toda função stub/placeholder do pipeline RAG DEVE seguir este contrato de retorno:

```typescript
type RagResult = {
  answer: string;
  source_document: string;  // "PENDING" enquanto não implementado; NUNCA nome de documento hardcoded
  vigencia: string | null;  // metadado do documento selecionado; null se não disponível
};
```

- **NÃO DEVE-SE** retornar `RagResult` com `source_document` diferente de `"PENDING"` em stubs.
- **DEVE-SE** comentar stubs com `// TODO: integrar Azure AI Search + Azure OpenAI`.

### Critério de saída do estado `PENDING`

- **DEVE-SE** manter `source_document: "PENDING"` somente enquanto o pipeline RAG real não estiver integrado.
- **NÃO DEVE-SE** promover para produção endpoint que retorne `"PENDING"` em mais de 5% das respostas em ambiente de staging.
- **DEVE-SE** substituir `"PENDING"` por documento real antes do merge em `main` quando já existir integração com busca vetorial e seleção por `vigencia`.
- **DEVE-SE** bloquear PR para `main` se houver fallback hardcoded de documento real em stub.

### Commits

- **DEVE-SE** seguir Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- **NÃO DEVE-SE** fazer commit diretamente em `main`. Feature branch obrigatória + PR aprovado.
- **DEVE-SE** nomear branches no padrão: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.

---

## 4. Build & Deploy

### Comandos padrão

| Ação | Comando |
|------|---------|
| Build TypeScript | `npm run build` |
| Lint | `npm run lint` |
| Testes unitários | `npm run test:unit` |
| Testes de integração | `npm run test:integration` |
| Todos os testes | `npm test` |
| Deploy (staging) | CI/CD via GitHub Actions `cd.yml` ao fazer merge em `staging` |
| Deploy (produção) | CI/CD via GitHub Actions `cd.yml` ao fazer merge em `main` com aprovação |

### CI obrigatório

- **DEVE-SE** ter lint + build + testes passando antes de abrir PR.
- **NÃO DEVE-SE** fazer merge com checks de CI falhando.
- **DEVE-SE** configurar proteção de branch em `main` (require PR + review aprovado).

### Infraestrutura (Bicep)

- **DEVE-SE** parametrizar toda configuração de ambiente em `infra/parameters/<env>.bicepparam`.
- **NÃO DEVE-SE** hardcodar connection strings, secrets ou endereços de resource em código TypeScript. Use variáveis de ambiente + `src/shared/config.ts`.
- **DEVE-SE** provisionar todos os recursos (AI Search, OpenAI, Functions, Cosmos) via Bicep antes de deploy de código.

### System Prompt

- **DEVE-SE** versionar o system prompt em `prompts/system-prompt.md`.
- **DEVE-SE** registrar toda mudança em `prompts/prompt-changelog.md` com: data, autor, motivo e resultado esperado.
- **NÃO DEVE-SE** alterar o system prompt diretamente em produção sem atualizar o arquivo versionado.

---

## Checklist de Aderência

Use este checklist para validar se o arquivo está prescritivo antes de aceitar código gerado por agente:

- [ ] **C1** — Cada endpoint em `src/functions/` tem `validator.ts` com schema Zod para input e output.
- [ ] **C2** — Nenhuma ocorrência de `console.log` / `console.error` / `console.warn` em `src/`.
- [ ] **C3** — Nenhuma ocorrência de `: any` explícito em arquivos `.ts` sob `src/`.
- [ ] **C4** — Toda resposta de query endpoint contém campo `source_document` populado e diferente de `"FAQ-atendimento"`.
- [ ] **C5** — Logger importado somente de `src/shared/logger.ts`; sem instâncias locais de `pino()`.
- [ ] **C6** — `tsconfig.json` com `"strict": true` e sem overrides que desabilitem regras.
- [ ] **C7** — Nenhum commit direto em `main`; PR com pelo menos 1 aprovação.
- [ ] **C8** — Context budget respeitado: `assertContextBudget` chamado antes de toda chamada ao Azure OpenAI.
- [ ] **C9** — Documentos contraditórios resolvidos por `vigencia` (ADR-0003); `source_document` reflete o mais recente.
- [ ] **C10** — Erros de validação Zod logados com `logger.warn` e retornam HTTP 400 com JSON `{ error, code }`.
- [ ] **C11** — Secrets e connection strings lidos de variáveis de ambiente via `src/shared/config.ts`; não hardcodados.
- [ ] **C12** — `src/shared/errors.ts` existe e exporta `ValidationError`, `InternalError` e `BudgetExceededError`.
- [ ] **C13** — Tipos de domínio (`QueryRequest`, `QueryResponse`, etc.) exportados de `src/shared/types.ts`; sem duplicatas em `validator.ts`.
- [ ] **C14** — Stubs de pipeline RAG retornam `source_document: "PENDING"` e incluem campo `vigencia: string | null`.
- [ ] **C15** — `assertContextBudget` recebe tokens reais (sem placeholders) antes de toda chamada ao modelo.
- [ ] **C16** — Logs incluem `budget_snapshot` com `systemPromptTokens`, `chunkTokens`, `historyTokens` e `totalTokens`.
- [ ] **C17** — Endpoint em staging tem taxa de `source_document: "PENDING"` ≤ 5% antes de PR para `main`.

---

## Delta v1 → v2

| Regra antiga (v1) | Regra nova (v2) | Motivo da mudança | Gap observado |
|-------------------|-----------------|-------------------|---------------|
| ADR-0003 descrita apenas na seção de fontes de verdade do projeto | ADR-0003 transformada em regra de código: `NÃO DEVE-SE` retornar `"FAQ-atendimento"` como `source_document`; fallback obrigatório é `"PENDING"` | Regra declarativa não foi conectada ao comportamento do código pelo Copilot | Copilot retornou `"FAQ-atendimento"` hardcoded em stub — viola Compliance |
| "DEVE-SE exportar todos os tipos de domínio de `src/shared/types.ts`" (genérico) | Regra explícita: `z.infer` DEVE ficar em `shared/types.ts`; `validator.ts` contém apenas schemas; NÃO DEVE haver duplicatas | Regra ambígua permitiu dois sistemas de tipos paralelos | `QueryRequestDto`/`QueryResponseDto` em `validator.ts` e `QueryRequest`/`QueryResponse` em `types.ts` — inconsistência e dead code |
| "DEVE-SE usar classes de erro customizadas definidas em `src/shared/errors.ts`" (sem nomes) | Classes obrigatórias listadas explicitamente: `ValidationError`, `InternalError`, `BudgetExceededError` com assinaturas de construtor | Sem nomes concretos, o Copilot não criou o arquivo | `errors.ts` nunca gerado; erros inline em `handler.ts` |
| ADR-0002 descrita como tabela de limites numéricos | Adicionada função obrigatória `assertContextBudget` com assinatura TypeScript; `NÃO DEVE-SE` chamar Azure OpenAI sem ela | Limites declarativos não geraram nenhuma implementação de enforcement | Apenas `.max(3)` no schema Zod; zero controle de tokens de chunks ou system prompt |
| Ponto de extensão RAG sem contrato de retorno definido | Tipo `RagResult` obrigatório com campo `vigencia: string \| null`; stubs retornam `source_document: "PENDING"` | Sem contrato, Copilot preencheu placeholder com valores inválidos de domínio | Stub retornou `"FAQ-atendimento"` e sem campo `vigencia`, impossibilitando ADR-0003 |
