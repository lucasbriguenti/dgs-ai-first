# Prompts — Tech Lead 2.1 (Construção e Teste do AGENTS.md)

Objetivo: executar a tarefa 2.1 com **evidência real de teste com Copilot**, iteração **v1 → v2** e aderência aos critérios de avaliação (prescritivo, context budget da ADR-0002, limitações reconhecidas).

> **Starter Repo (Anexo D) — o que já existe:** o `AGENTS.md` já está na raiz com esqueleto e seções `<!-- TODO (Tech Lead — Ex. 2.1) -->` — você **preenche** as seções que são sua responsabilidade, não cria o arquivo do zero. `package.json` tem apenas `typescript + vitest + zod`; `pino` e `@azure/functions` **não estão instalados** — adicione-os antes de testar com Copilot (ver Prompt 2). Os stubs em `src/shared/` (logger.ts, errors.ts, config.ts, types.ts) estão **vazios** — o Copilot precisará gerá-los junto com o endpoint. Nesta fase **não há remoto/GitHub**: "abrir PR" = criar branch local + escrever descrição em `docs/pull-requests/PR-NNNN.md`.

---

## Prompt 1 — Gerar AGENTS.md v1 (Claude)

```text
Você vai atuar como Tech Lead do projeto NovaTech Assistant e preencher o AGENTS.md v1 do repositório. O arquivo já existe na raiz com esqueleto e comentários TODO — preencha as seções que são sua responsabilidade: Project Overview, Tech Stack & Architecture, Coding Standards e Build & Deploy. As seções dos outros papéis (Product Rules, Testing Standards, Project Management Rules) ficam com os TODOs intactos.

Contexto obrigatório do projeto (decisões das ADRs do cenário 1):
- Stack: TypeScript (strict: true), Azure Functions v4 (HTTP triggers), React no painel web, Bicep para IaC.
- Padrões obrigatórios:
  - Zod para validação de input/output.
  - Vitest para testes (unit/integration/e2e).
  - pino para logging estruturado — NUNCA console.log.
  - Conventional Commits.
  - Branches de feature LOCAIS. Não há remoto nesta fase: "abrir PR" = criar a branch e escrever a descrição em docs/pull-requests/PR-NNNN.md (objetivo, mudanças, checklist de validation gates); revisão é simulada localmente.
- Engenharia de contexto (ADR-0002): context budget por query ~4K tokens para system prompt + ~8K para chunks (5 chunks de ~1.500 tokens) + pergunta + histórico limitado a 3 turnos.
- Documentos contraditórios (ADR-0003): metadado de vigência; priorizar versão mais recente; obsoletos são marcados, não excluídos.
- Toda resposta do assistente DEVE incluir o campo source_document no JSON de retorno.

Estrutura do repositório (Anexo C) que o AGENTS.md deve referenciar com caminhos corretos:
- specs em /specs/<modulo>/{requirements,plan,tasks}.md
- skills em /skills/{foundation,domain,artifact}/
- system prompt versionado em /prompts/system-prompt.md (+ /prompts/prompt-changelog.md)
- ADRs em /docs/adr/ (nomenclatura NNNN-titulo-da-decisao.md)
- código em /src/{functions,services,pipeline,bot,web,shared}/
- testes em /tests/{unit,integration,e2e,fixtures}/

Preencha as seções do AGENTS.md que são sua responsabilidade:
1) Project Overview
2) Tech Stack & Architecture  -> inclua aqui as regras de context budget da ADR-0002 e a regra de vigência da ADR-0003
3) Coding Standards
4) Build & Deploy

Regras de formato obrigatórias:
- Estilo machine-readable e prescritivo: use DEVE / NÃO DEVE / QUANDO EM DÚVIDA.
- Cada regra deve ser objetiva, verificável e acionável por um agente (Copilot / Claude Code).
- Sem texto narrativo/descritivo ("nós usamos X"); escreva instruções ("DEVE usar X").
- Referencie caminhos reais do Anexo C.

No final, inclua uma seção "Checklist de Aderência" com 8 a 12 checks objetivos para validar se o arquivo está prescritivo o suficiente.
```

---

## Prompt 2 — Teste real com Copilot: gerar endpoint (Copilot Chat)

**Antes de abrir o Copilot:** adicione as dependências que faltam no `package.json` (o starter só tem typescript/vitest/zod):
```bash
npm install pino @azure/functions
npm install --save-dev @types/node
```
Os stubs `src/shared/logger.ts`, `errors.ts`, `config.ts`, `types.ts` estão **vazios** — peça ao Copilot que os gere também (ver prompt abaixo).

Com o AGENTS.md v1 preenchido na raiz:

```text
Com base estritamente nas regras do AGENTS.md deste repositório, gere os seguintes arquivos para o endpoint POST /api/query:

1) src/shared/logger.ts — exportar instância pino configurada (sem console.log em nenhum módulo)
2) src/shared/errors.ts — custom errors do projeto
3) src/shared/types.ts — tipos TypeScript do domínio (QueryRequest, QueryResponse com source_document obrigatório)
4) src/functions/query/handler.ts — endpoint Azure Functions v4 (HTTP trigger), substituindo o stub existente

Requisitos mínimos para o handler:
- Validar input e output com Zod.
- Logging estruturado com pino via src/shared/logger.ts (NÃO usar console.log).
- TypeScript strict (sem any).
- Ponto de extensão para a etapa de RAG (busca top-5 chunks + montagem de prompt).
- Resposta JSON contendo o campo source_document.

Entregue:
1) os 4 arquivos listados acima
2) uma explicação curta de como cada arquivo atende as regras relevantes do AGENTS.md
```

---

## Prompt 3 — Teste real com Copilot: gerar teste (Copilot Chat)

Após o endpoint:

```text
Agora gere testes em Vitest para o endpoint criado, seguindo o AGENTS.md.

Requisitos mínimos:
- Cobrir caso feliz e pelo menos 2 casos de erro de validação.
- Assertions específicas ao comportamento (não usar toBeDefined()/toBeTruthy() isolados).
- Isolar dependências externas (sem chamadas reais a serviços).
- Não depender de ordem de execução entre testes.

Entregue:
1) o arquivo de teste (em tests/unit/ ou ao lado do handler, conforme o AGENTS.md)
2) uma matriz curta "Regra do AGENTS.md -> Evidência no teste"
```

---

## Prompt 4 — Auditoria de aderência (Claude)

Cole os outputs reais do Copilot (endpoint + testes) na conversa:

```text
Vou colar abaixo os outputs reais do Copilot (endpoint e testes) gerados com o AGENTS.md v1.

Sua tarefa:
1) Avaliar o que foi SEGUIDO e o que foi IGNORADO do AGENTS.md v1.
2) Produzir uma tabela com colunas:
   - Regra
   - Status (Seguido / Parcial / Ignorado)
   - Evidência concreta no código
   - Severidade do gap (Alta / Média / Baixa)
3) Sugerir reescritas prescritivas para cada item Parcial/Ignorado.

Restrições:
- NÃO invente problemas. Só use evidências que aparecem no código colado.
- Priorize regras que aumentam aderência de agentes em gerações futuras.

No final, entregue "Top 5 mudanças para o AGENTS.md v2" em ordem de impacto.
```

---

## Prompt 5 — Gerar AGENTS.md v2 (Claude)

```text
Com base nos gaps da auditoria de aderência do Copilot, reescreva o AGENTS.md para a versão v2.

Objetivo:
- Manter as decisões arquiteturais originais.
- Tornar regras mais prescritivas e menos ambíguas, aumentando a chance de aderência do Copilot.

Instruções:
1) Entregue o AGENTS.md v2 completo.
2) Inclua uma seção "Delta v1 -> v2" com colunas: Regra antiga | Regra nova | Motivo | Gap observado que ela corrige.
3) Preserve OBRIGATORIAMENTE:
   - context budget (ADR-0002)
   - vigência de documentos (ADR-0003)
   - source_document em toda resposta
   - TypeScript strict, Zod, Vitest, pino, Conventional Commits
   - convenção de PR local (docs/pull-requests/PR-NNNN.md)
```

---

## Prompt 6 — Reteste com Copilot (Copilot Chat)

Com o AGENTS.md v2:

```text
Use estritamente as regras do AGENTS.md v2 deste repositório e regenere:
1) o endpoint Azure Functions v4 para POST /api/query
2) os testes Vitest do endpoint

Depois, inclua uma auto-checagem em tabela:
- Regra do AGENTS.md v2
- Onde foi aplicada (arquivo/trecho)
- Nível de confiança (Alto/Médio/Baixo)

Não use regras fora do AGENTS.md v2.
```

---

## Prompt 7 — Relatório final de evidência da 2.1 (Claude)

```text
Vou colar os artefatos da 2.1:
- AGENTS.md v1
- outputs do Copilot rodada 1
- AGENTS.md v2
- outputs do Copilot rodada 2

Monte um relatório final objetivo com:
1) Resumo executivo (5-8 linhas)
2) Evidências de teste real (rodada 1 e 2)
3) O que melhorou concretamente de v1 para v2
4) Limites observados: o que ainda foi ignorado pelo Copilot e o risco associado
5) Conclusão de prontidão (Pronto / Parcialmente pronto / Não pronto) com justificativa

Formato: markdown, tabelas curtas quando ajudar, técnico e direto, sem texto genérico.
```

---

## Checklist de uso rápido

- Rode os prompts na ordem 1 → 7.
- Guarde a evidência das DUAS rodadas do Copilot (sem evidência de teste real, D2 ≤ 1).
- Garanta diferença real entre v1 e v2 (mudança cosmética = v1 = v2 derruba o critério de iteração).
- Confirme que o AGENTS.md ficou prescritivo (DEVE/NÃO DEVE), não narrativo.
- Reconheça limitações honestamente no relatório (o AGENTS.md não resolve tudo).
