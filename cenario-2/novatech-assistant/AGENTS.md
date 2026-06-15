# AGENTS.md — NovaTech Assistant (v2)

> Constitution do projeto. Todo agente de IA (Copilot, Claude Code) lê este arquivo antes de gerar qualquer artefato.
> As seções abaixo são preenchidas por papéis diferentes nos exercícios do Cenário 2.

---

## Project Overview

**Produto:** assistente conversacional para atendentes da NovaTech Logística. Responde perguntas sobre SLAs, frete, devoluções e procedimentos operacionais com base em documentação interna indexada.

**Repositório local:** `novatech-assistant/` (prefixo `db1/` é narrativo; não há remoto, GitHub ou Azure nesta fase).

**Time:** 1 Tech Lead · 2 Desenvolvedores (pleno + sênior) · 1 QA · 1 Product Specialist · 1 Delivery Manager.

**Fase atual:** Estruturação (Cenário 2). Os artefatos produzidos nesta fase (AGENTS.md, specs, skills, `.mcp/mcp.json`) governam o desenvolvimento que vem a seguir.

**Regras gerais que todo agente DEVE seguir:**
- DEVE ler este arquivo inteiro antes de gerar qualquer código, spec ou artefato.
- DEVE respeitar os caminhos de diretório definidos na seção Coding Standards.
- NÃO DEVE inventar decisões arquiteturais ou convenções não presentes neste arquivo ou nas ADRs em `/docs/adr/`.
- QUANDO EM DÚVIDA sobre uma decisão, DEVE perguntar antes de assumir.

---

## Tech Stack & Architecture

### Stack

| Camada | Tecnologia | Versão mínima |
|---|---|---|
| Backend / Endpoints | TypeScript + Azure Functions v4 | TS 5.5, Functions v4 |
| Validação | Zod | 3.x |
| Testes | Vitest | 2.x |
| Logging | pino | qualquer |
| IaC | Bicep | — |
| Frontend (painel web) | React | — |
| Build system | TypeScript compiler (`tsc`) | — |

**tsconfig obrigatório:** `strict: true`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`.

### Arquitetura

Quatro componentes:

1. **Pipeline de ingestão** (`/src/pipeline/`) — extrai, chunka, embeda e indexa documentos.
2. **API do assistente** (`/src/functions/`) — Azure Functions HTTP triggers + Azure AI Search + Azure OpenAI.
3. **Bot do Teams** (`/src/bot/`) — interface conversacional via Bot Framework.
4. **Painel web** (`/src/web/`) — dashboard de métricas e histórico (React).

### Gerenciamento de Contexto — ADR-0002

DEVE respeitar o seguinte context budget por query:

```
System prompt  : ~4.000 tokens  (versionado em /prompts/system-prompt.md)
Chunks         : ~8.000 tokens  (top-5 chunks de ~1.500 tokens cada)
Pergunta       : ~200 tokens    (estimativa máxima)
Histórico      : máximo 3 turnos anteriores
─────────────────────────────────────────────
Total budget   : ~12.200 tokens (margem de segurança para modelos com janela de 128K)
```

**Os limites DEVEM ser enforçados no schema Zod de input:**
```typescript
// DEVE: enforçar budget via Zod — não confiar apenas em lógica de runtime
top_k: z.number().int().min(1).max(5).optional(),
conversation_history: z.array(historyTurnSchema).max(3).optional(),
```

**DEVE logar o uso efetivo do budget no início de cada request:**
```typescript
logger.info({ topK: requestBody.top_k ?? 5, historyTurns: history.length }, "context budget usage");
```

- NÃO DEVE enviar mais de 5 chunks por query.
- NÃO DEVE incluir mais de 3 turnos de histórico no contexto.
- DEVE versionar o system prompt em `/prompts/system-prompt.md`; toda mudança DEVE ser registrada em `/prompts/prompt-changelog.md` com: data, autor, motivo e resultado esperado.

### Documentos Contraditórios — ADR-0003

- DEVE usar metadado de `vigencia` nos documentos indexados para resolver conflitos.
- DEVE priorizar a versão com `vigencia` mais recente quando dois documentos contradizem.
- NÃO DEVE excluir documentos obsoletos — DEVE marcá-los como obsoletos.
- QUANDO duas versões existirem, DEVE informar ao usuário que existe versão anterior e qual é a vigente.
- DEVE incluir `vigencia` no tipo `SourceDocument` e no schema Zod correspondente.

### Campo `source_document` (obrigatório)

- TODA resposta do assistente DEVE incluir o campo `source_document` no JSON de retorno.
- DEVE incluir `source_document` mesmo quando confiança for baixa.
- NÃO DEVE retornar resposta sem `source_document`, nem mesmo em casos de fallback.
- DEVE enforçar com Zod no schema de output (não confiar apenas no tipo TypeScript).

---

## Coding Standards (Tech Lead)

### Linguagem e tipos

- DEVE usar TypeScript com `strict: true` em todos os arquivos em `/src/` e `/tests/`.
- NÃO DEVE usar `any`. Usar `unknown` quando o tipo não for conhecido e fazer narrowing explícito.
- NÃO DEVE usar `@ts-ignore` ou `@ts-expect-error` sem comentário justificando.
- DEVE usar ESM (`import`/`export`). NÃO DEVE usar `require()`.
- **EXCEÇÃO de teste:** em helpers de criação de mocks (ex.: `createRequest`, `createContext`), é permitido usar `as SomeType` para construir mocks parciais de tipos externos (`HttpRequest`, `InvocationContext`). Fora desse contexto específico, casting permanece proibido.

### Validação

- DEVE validar todo input externo (body HTTP, variáveis de ambiente, resposta de APIs) com Zod.
- DEVE validar também o output do endpoint antes de retornar ao cliente.
- NÃO DEVE usar casting (`as SomeType`) como substituto de validação Zod em código de produção.

### Logging

- DEVE usar a instância pino exportada de `src/shared/logger.ts` em todos os módulos.
- NÃO DEVE usar `console.log`, `console.error`, `console.warn` ou `console.info` em nenhum arquivo.
- DEVE logar erros com nível `error` e incluir o objeto de erro: `logger.error({ err }, 'mensagem')`.
- DEVE logar início e fim de operações críticas com nível `info`. **Para chamadas a serviços externos (search, completion), DEVE incluir duração em ms:**
  ```typescript
  const start = Date.now();
  // ... chamada ao serviço
  logger.info({ durationMs: Date.now() - start, chunkCount }, "retrieval completed");
  ```

### Erros

- DEVE usar os custom errors definidos em `src/shared/errors.ts`.
- NÃO DEVE lançar `new Error('mensagem genérica')` diretamente nos handlers.
- DEVE retornar respostas de erro HTTP com corpo JSON padronizado: `{ error: string, code: string }`.
- DEVE usar um `mapUnknownError` (ou equivalente) para converter erros desconhecidos em `AppError` antes de responder.

### Organização de arquivos — fronteira handler vs. services (v2)

```
src/functions/<nome>/
  handler.ts           — HTTP trigger APENAS: parseia request, chama services, serializa response.
                         NÃO DEVE conter lógica de domínio nem I/O além do parse do body.
  validator.ts         — schemas Zod de input e output APENAS.
  response-builder.ts  — serialização/formatação da resposta HTTP APENAS (sem I/O, sem regras de negócio).

src/services/          — TODA a lógica de negócio e I/O externo:
  search.ts            — busca de chunks no índice (retrieveTopChunks e derivados)
  completion.ts        — chamada ao modelo LLM
  prompt-builder.ts    — montagem do prompt RAG (buildRagPrompt e derivados)
  response-validator.ts — validação determinística das respostas do LLM

src/shared/            — logger, errors, types, config (compartilhado por todos)
src/pipeline/          — pipeline de ingestão
src/bot/               — bot do Teams
src/web/               — painel React
```

**Regras prescritivas de fronteira:**

- DEVE colocar em `src/services/` qualquer função que faça I/O (chamadas a APIs externas, leitura de índice, chamada ao LLM).
- DEVE colocar em `src/services/` qualquer função que implemente regra de negócio (construção do prompt RAG, seleção de chunks, validação de resposta do LLM).
- NÃO DEVE colocar em `response-builder.ts` funções que fazem I/O ou que implementam regras de domínio.
- NÃO DEVE duplicar em `response-builder.ts` lógica que pertence a `src/services/`.

**Exemplo correto:**
```typescript
// ✅ handler.ts — orquestra
const chunks = await searchService.retrieveTopChunks(question, topK);      // src/services/search.ts
const prompt = promptBuilderService.buildRagPrompt(question, chunks, history); // src/services/prompt-builder.ts
const answer = await completionService.complete(prompt);                    // src/services/completion.ts
const response = buildQueryResponse(answer, chunks[0]);                    // src/functions/query/response-builder.ts (serialização)

// ❌ NÃO DEVE — lógica de domínio no response-builder.ts do functions/
export async function retrieveTopChunks(question: string, topK: number) { ... }
export function buildRagPrompt(question: string, chunks: Chunk[]) { ... }
```

- DEVE exportar cada função/classe com `export` nomeado. NÃO DEVE usar `export default` em módulos de serviço.

### Commits e branches

- DEVE usar Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- DEVE criar feature branches locais para cada tarefa.
- NÃO há remoto nesta fase. "Abrir PR" significa:
  1. Criar a branch local.
  2. Escrever a descrição do PR em `docs/pull-requests/PR-NNNN.md` com: objetivo, mudanças e checklist dos validation gates.
  3. Revisão é simulada localmente.

### Specs e ADRs

- DEVE registrar toda decisão técnica ou de escopo como ADR em `/docs/adr/`, nomenclatura `NNNN-titulo-da-decisao.md`.
- Specs de cada módulo ficam em `/specs/<modulo>/{requirements,plan,tasks}.md`.
- NÃO DEVE iniciar implementação sem `tasks.md` aprovado pelo Tech Lead.

### Testes

> Regras detalhadas: ver seção **Testing Standards** (QA).

- DEVE ter cobertura mínima de 80% de linhas (configurado em `vitest.config.ts`).
- Testes ficam em `/tests/{unit,integration,e2e}/`. Fixtures compartilhadas em `/tests/fixtures/`.
- **DEVE definir dados de teste de domínio NovaTech (chunks, queries, respostas esperadas) em `tests/fixtures/` e importá-los nos testes. NÃO DEVE duplicar dados inline em múltiplos arquivos de teste.**
- NÃO DEVE fazer chamadas reais a serviços externos em testes `unit/` e `integration/`.

---

## Product Rules & Guardrails (Product Specialist)
<!-- TODO (Product Specialist — Ex. 2.3) -->

---

## Testing Standards (QA)
<!-- TODO (QA — Ex. 2.1) -->

---

## Project Management Rules (Delivery Manager)
<!-- TODO (Delivery Manager — Ex. 2.3) -->

---

## Build & Deploy

### Comandos locais

```bash
npm run build   # tsc -p . -> compila para /dist
npm run test    # vitest run (com cobertura)
npm run lint    # eslint .
```

- DEVE garantir que `npm run build` e `npm run test` passam antes de escrever a descrição do PR.
- NÃO DEVE commitar arquivos em `/dist/`, `node_modules/` ou `.env` (ver `.gitignore`).

### MCP servers (desenvolvimento local)

- Configuração em `.mcp/mcp.json` (versionado no repositório).
- DEVE usar apenas reference servers locais e gratuitos (filesystem, git, memory, everything).
- NÃO DEVE adicionar um MCP server ao `.mcp/mcp.json` sem passar pelo processo de aprovação definido em `/docs/adr/`.
- Fontes de negócio (`docs/novatech/`, `data/retrieval-corpus/`) DEVEM ser acessadas como read-only.

### CI/CD

- Pipeline de CI em `.github/workflows/ci.yml`: lint + build + test.
- Pipeline de CD em `.github/workflows/cd.yml`: deploy para staging/produção.
- NÃO DEVE fazer deploy sem o pipeline de CI verde.
- QUANDO EM DÚVIDA sobre ambiente de destino, DEVE perguntar ao Tech Lead antes de configurar variáveis.

### Variáveis de ambiente

- DEVE usar `src/shared/config.ts` para ler variáveis de ambiente (validado com Zod).
- NÃO DEVE ler `process.env` diretamente nos handlers ou services — sempre via `config.ts`.
- NÃO DEVE commitar `.env` ou qualquer arquivo com credenciais.

---

## Checklist de Aderência

Use este checklist para validar se o AGENTS.md está prescritivo o suficiente antes de testar com Copilot.

- [ ] Todas as regras usam DEVE / NÃO DEVE / QUANDO EM DÚVIDA (nenhuma é descritiva/narrativa).
- [ ] O context budget da ADR-0002 está explícito com valores numéricos (4K / 8K / 5 chunks / 3 turnos) **e com exemplo de Zod enforçando os limites**.
- [ ] A regra de `source_document` aparece na seção de arquitetura **com menção de enforçamento via Zod no output**.
- [ ] A ADR-0003 (vigência de documentos) está materializada em regras acionáveis **incluindo o campo `vigencia` no tipo e no Zod schema**.
- [ ] Caminhos de diretório são reais e consistentes com o repositório (`/src/`, `/tests/`, `/specs/`, `/docs/adr/`).
- [ ] A convenção de PR local (`docs/pull-requests/PR-NNNN.md`) está explícita.
- [ ] O uso de `console.log` está proibido com alternativa clara (`pino` via `src/shared/logger.ts`).
- [ ] O uso de `any` está proibido **com exceção explícita para helpers de mock em testes**.
- [ ] A regra de validação com Zod cobre tanto input quanto output.
- [ ] A fronteira `handler.ts` / `response-builder.ts` / `services/` está prescrita **com exemplo de código DO/DON'T**.
- [ ] Log de chamadas a serviços externos inclui duração em ms.
- [ ] Fixtures de dados NovaTech DEVEM estar em `tests/fixtures/` (não inline).
- [ ] Cobertura mínima de testes está definida (80% de linhas).

---

## Delta v1 → v2

| Regra antiga (v1) | Regra nova (v2) | Motivo | Gap do Copilot corrigido |
|---|---|---|---|
| "O handler orquestra; a lógica fica em `/src/services/`." | Seção completa com fronteira explícita, exemplo DO/DON'T e lista do que vai em cada arquivo | Regra vaga demais — o Copilot não soube que `retrieveTopChunks` e `buildRagPrompt` eram lógica de serviço | `retrieveTopChunks`, `buildRagPrompt`, `buildSourceDocument` foram colocados em `response-builder.ts` (functions/) em vez de `services/` |
| "NÃO DEVE enviar mais de 5 chunks. NÃO DEVE incluir mais de 3 turnos." | Adiciona: "DEVE enforçar via Zod no schema de input" + "DEVE logar uso efetivo do budget" com exemplo de código | O Copilot enforçou o budget no Zod (correto), mas sem regra explícita — foi coincidência, não instrução | Budget estava sendo respeitado acidentalmente; v2 torna prescritivo para que próximas gerações repitam |
| "NÃO DEVE usar casting (`as SomeType`) como substituto de validação Zod." | Adiciona: "EXCEÇÃO de teste: em helpers de mock (`createRequest`, `createContext`) é permitido `as SomeType`." | Regra absoluta é impraticável em testes com tipos externos do Azure Functions | Copilot usou `as HttpRequest` e `as InvocationContext` em helpers de teste — correto na prática, mas violava a letra da regra |
| "DEVE logar início e fim de operações críticas com nível `info`." | Adiciona: "Para chamadas a serviços externos DEVE incluir duração em ms" com exemplo `Date.now()` | Sem detalhe sobre o que logar, o Copilot logou request/response mas não as chamadas externas | `retrieveTopChunks` não teve log de início/fim; sem timing de chamadas externas |
| (ausente) | "DEVE definir dados de teste em `tests/fixtures/` e importar. NÃO DEVE duplicar inline." | Sem regra, o Copilot colocou dados de chunk inline no teste | Chunk de teste (`PROC-042 Frete Especial`) definido inline em `query-handler.test.ts`; `tests/fixtures/chunks.ts` ficou vazio |
