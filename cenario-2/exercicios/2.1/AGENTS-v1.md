# AGENTS.md — NovaTech Assistant
> Constitution do projeto para Copilot e Claude Code.
> Versão: v1 | Repositório: `db1/novatech-assistant`

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
| `FAQ-atendimento` | FAQ informal — usar com cautela, não validado por Compliance | Não |

**REGRA ADR-0003:** QUANDO dois documentos apresentarem informações contraditórias, DEVE-SE priorizar o documento com `vigência` mais recente. NÃO DEVE-SE usar `FAQ-atendimento` como fonte primária em conflito com documentos formais.

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

- **NÃO DEVE-SE** incluir mais de 5 chunks por query.
- **NÃO DEVE-SE** expandir o histórico de turnos além de 3 turnos sem justificativa explícita em ADR.
- **QUANDO EM DÚVIDA** sobre o tamanho do system prompt, meça com `tiktoken` antes de fazer deploy.

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
- **DEVE-SE** exportar todos os tipos de domínio de `src/shared/types.ts`.
- **DEVE-SE** usar `satisfies` ou cast explícito ao atribuir literais a tipos Zod inferidos.

### Validação com Zod

- **DEVE-SE** definir um schema Zod para todo input de endpoint HTTP (request body, query params, path params).
- **DEVE-SE** definir um schema Zod para todo output de endpoint que retorna JSON.
- **NÃO DEVE-SE** fazer parse manual de JSON sem passar pelo schema Zod correspondente.
- **QUANDO EM DÚVIDA** sobre validação de campo opcional, prefira `z.string().optional()` a omitir o campo.
- **DEVE-SE** logar o erro de validação com `logger.warn({ error: zodError.flatten() }, 'validation_failed')` antes de retornar 400.

### Logging com pino

- **NÃO DEVE-SE** usar `console.log`, `console.error`, `console.warn` em nenhum arquivo sob `src/`.
- **DEVE-SE** usar somente o logger singleton de `src/shared/logger.ts` (instância `pino`).
- **DEVE-SE** usar logging estruturado: `logger.info({ query, sourceDocument }, 'query_completed')`.
- **DEVE-SE** incluir campo `requestId` em todos os logs de endpoint.

### Tratamento de erros

- **DEVE-SE** usar classes de erro customizadas definidas em `src/shared/errors.ts`.
- **NÃO DEVE-SE** retornar stack traces ao cliente em ambiente de produção.
- **DEVE-SE** retornar JSON com campos `{ error: string; code: string }` em toda resposta de erro.

### Respostas de endpoint RAG

- **DEVE-SE** incluir campo `source_document` em toda resposta de query com o identificador do documento usado (ex: `"POL-001"`).
- **NÃO DEVE-SE** retornar resposta sem `source_document` populado quando um chunk foi utilizado.
- **DEVE-SE** aplicar ADR-0003: se múltiplos chunks conflitantes, indicar o documento com `vigência` mais recente em `source_document`.

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
- [ ] **C4** — Toda resposta de query endpoint contém campo `source_document` populado.
- [ ] **C5** — Logger importado somente de `src/shared/logger.ts`; sem instâncias locais de `pino()`.
- [ ] **C6** — `tsconfig.json` com `"strict": true` e sem overrides que desabilitem regras.
- [ ] **C7** — Nenhum commit direto em `main`; PR com pelo menos 1 aprovação.
- [ ] **C8** — Context budget respeitado: system prompt ≤ 4K tokens, chunks ≤ 8K tokens, histórico ≤ 3 turnos.
- [ ] **C9** — Documentos contraditórios resolvidos por `vigência` (ADR-0003), não por ordem de aparição nos chunks.
- [ ] **C10** — Erros de validação Zod logados com `logger.warn` e retornam HTTP 400 com JSON `{ error, code }`.
- [ ] **C11** — Secrets e connection strings lidos de variáveis de ambiente via `src/shared/config.ts`; não hardcodados.
- [ ] **C12** — Mudanças no system prompt registradas em `prompts/prompt-changelog.md`.
