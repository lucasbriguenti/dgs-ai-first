# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este repositório

Repositório de exercícios práticos da **Trilha de Certificação AI First — DGS/DB1 Global Software**. Cada `cenario-N/` contém um cenário-âncora completo com enunciados por papel, prompts de execução para o Tech Lead, artefatos produzidos nas entregas e skills de avaliação.

O projeto de referência em todos os cenários é o **NovaTech Assistant**: assistente de IA com RAG para atendentes de uma empresa de logística. Todos os artefatos (ADRs, AGENTS.md, skills, specs, MCP config) são do projeto NovaTech e DEVEM ser consistentes entre si.

## Estrutura e convenções

```
cenario-N/
  exercicio-N-<fase>.md          # enunciado completo por papel
  tech-lead-N.X.prompt.md        # sequência de prompts para o exercício N.X do Tech Lead
  anexo-[a|b|c|d]-*.md           # documentação de apoio (NovaTech docs, chunks, repo structure)
  exercicios/
    N.X/                         # entregáveis do exercício X
      relatorio-final.md         # entrega final obrigatória
      [artefatos específicos]    # AGENTS.md v1/v2, skills, auditoria, copilot-rodada-N, etc.
  novatech-assistant/            # starter repo do projeto NovaTech (presente no cenario-2)
  skills-avaliacao/              # rubricas de avaliação por papel
    prompt-avaliacao.md          # prompt pronto para submeter entregáveis a avaliação por LLM
```

**Regra de nomenclatura:** artefatos iterados levam sufixo `-v1`/`-v2` ou `-rodada-1`/`-rodada-2`. Relatórios finais são sempre `relatorio-final.md`.

## novatech-assistant (cenario-2)

É o repositório TypeScript do projeto NovaTech. Comandos válidos executados **dentro de `cenario-2/novatech-assistant/`**:

```bash
npm run build   # tsc -p . → compila para /dist
npm run test    # vitest run (cobertura mínima: 80% linhas)
npm run lint    # eslint .
```

Stack: TypeScript `strict`, `module: ESNext`, `moduleResolution: Bundler` — imports relativos DEVEM usar extensão `.js`. Azure Functions v4, Zod (validação), pino (logging, nunca `console.*`), Vitest.

Fronteira de camadas:
- `src/functions/<nome>/handler.ts` — thin: parse → validate → orquestra services → serialize.
- `src/functions/<nome>/validator.ts` — schemas Zod de input **e** output (`.strict()` em todos os objetos, inclusive aninhados).
- `src/functions/<nome>/response-builder.ts` — serialização HTTP pura.
- `src/services/` — todo I/O externo e regra de negócio.
- `src/shared/` — `logger`, `errors`, `types`, `config` (compartilhados; nunca recriar).

## Arquitetura de skills (cenario-2/novatech-assistant/skills/)

Hierarquia Foundation → Domain → Artifact:
- **Foundation:** convenções globais (`typescript-conventions`, `error-handling`, `project-structure`).
- **Domain:** padrões por camada (`azure-functions-endpoint` — a única preenchida até agora, em v2).
- **Artifact:** receitas de geração completas (`create-rag-endpoint`, `create-integration-test`, `create-react-card`).

A skill ativa de referência é `skills/domain/azure-functions-endpoint.md` (v2). Ela é a fonte de verdade para padrões de endpoint — **não** o código gerado.

## Decisões arquiteturais (ADRs do cenário 1, vigentes no cenário 2)

- **LLM:** Azure OpenAI GPT-4o (ADR-0001).
- **Context budget** (ADR-0002): ~4K tokens system prompt + ~8K chunks (top-5 de ~1.500 tokens) + pergunta + histórico máx. 3 turnos. Enforçado via Zod: `top_k.max(5)`, `conversation_history.max(3)`.
- **Documentos contraditórios** (ADR-0003): metadado `vigencia`; priorizar mais recente; nunca excluir obsoletos.
- **`source_document` obrigatório em toda resposta de domínio**, inclusive em fallback. Quando `retrieveTopChunks` retorna `[]` → resposta 200 com `buildNotFoundResponse()` (sentinela `id: "none"`), nunca 500.

## Como trabalhar aqui

**Antes de orientar qualquer entregável:** leia o enunciado do exercício (`exercicio-N-*.md`, seção do papel relevante) e a rubrica em `skills-avaliacao/avaliacao-<papel>.md`. Monte o checklist fiel aos critérios de avaliação — não assuma o que o exercício pede.

**Conectar cenários:** artefatos do cenário 2 DEVEM referenciar as ADRs e decisões do cenário 1 (context budget, stack, vigência). Artefatos genéricos que ignoram essas decisões perdem pontos em D5 da rubrica.

**Iteração v1→v2 é obrigatória** nos exercícios que pedem teste com Copilot (TL 2.1, TL 2.3). A diferença entre versões deve ser comportamental, não cosmética. V1 ≈ V2 → D2 ≤ 1 na avaliação.

**Evidência de execução real** é exigida (e verificada na avaliação) em: TL 2.1/2.3 (outputs do Copilot), Dev 2.1 (agente lendo doc/chunk/git via MCP), TL 2.2 (saída do health check).

## Atualizar o README

Ao adicionar novos exercícios, arquivos ou reorganizar pastas de `cenario-N/`:

```bash
python3 .claude/skills/update-readme/driver.py          # aplica
python3 .claude/skills/update-readme/driver.py --dry-run  # preview
```

## Avaliação por LLM

Para avaliar um entregável, use o prompt em `cenario-2/skills-avaliacao/prompt-avaliacao.md` com: skill Foundation + skill do papel + enunciado do exercício + entregável. O avaliador pontua 5 dimensões (D1–D5) de 1 a 3; aprovação ≥ 2.0; artefatos narrativos em vez de prescritivos → D3 ≤ 1.
