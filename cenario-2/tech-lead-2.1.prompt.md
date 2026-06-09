# Prompts — Tech Lead 2.1 (Construcao e Teste do AGENTS.md)

Objetivo: executar a tarefa 2.1 com evidencia real de teste, iteracao v1 -> v2 e aderencia aos criterios de avaliacao.

## Prompt 1 — Gerar AGENTS.md v1 (Claude)

Use este prompt no Claude: 

```text
Voce vai atuar como Tech Lead do projeto NovaTech Assistant e escrever o AGENTS.md v1 do repositorio.

Contexto obrigatorio do projeto:
- Stack: TypeScript (strict mode), Azure Functions v4 (HTTP triggers), React no painel, Bicep para IaC.
- Padrões obrigatorios: Zod para validacao de input/output, Vitest para testes, pino para logging (nunca console.log), Conventional Commits, feature branch + PR obrigatorio para main.
- Decisoes da fase anterior:
  - ADR-0002: context budget por query ~4K tokens para system prompt + ~8K para chunks.
  - ADR-0003: documentos contraditorios tratados por metadado de vigencia; priorizar versao mais recente.
- O AGENTS.md deve ser uma constituicao prescritiva para agentes (Copilot e Claude Code), nao um texto descritivo.

Gere AGENTS.md completo com secoes:
1) Project Overview
2) Tech Stack & Architecture
3) Coding Standards
4) Build & Deploy

Regras de formato obrigatorias:
- Escreva em estilo machine-readable, com itens em DEVE / NAO DEVE / QUANDO EM DUVIDA quando fizer sentido.
- Inclua regras objetivas, verificaveis e acionaveis por agente.
- Inclua explicitamente as regras de context budget da ADR-0002 na secao de arquitetura.
- Inclua explicitamente a regra de vigencia da ADR-0003 para conflitos de documentos.
- Evite texto generico.

No final, inclua uma secao curta chamada "Checklist de Aderencia" com 8 a 12 checks objetivos para validar se o arquivo esta prescritivo.
```

## Prompt 2 — Teste real com Copilot: gerar endpoint (Copilot Chat)

Use este prompt no Copilot com AGENTS.md v1 presente no repositorio:

```text
Com base nas regras do AGENTS.md deste repositorio, gere um endpoint Azure Functions v4 em TypeScript para POST /api/query.

Requisitos minimos:
- Validar input e output com Zod.
- Usar pino para logging estruturado.
- Nao usar console.log.
- Preparar ponto de extensao para etapa RAG.
- Retornar JSON com campo source_document.
- Seguir strict typing (evitar any).

Entregue:
1) codigo do endpoint
2) explicacao curta de como o codigo atende cada regra relevante do AGENTS.md
```

## Prompt 3 — Teste real com Copilot: gerar teste (Copilot Chat)

Use este prompt no Copilot apos o endpoint:

```text
Agora gere testes em Vitest para o endpoint criado, seguindo AGENTS.md.

Requisitos minimos:
- Cobrir caso feliz e pelo menos 2 casos de erro de validacao.
- Assertions especificas (nao usar teste vago).
- Isolar dependencias externas.
- Nao depender de ordem de execucao entre testes.

Entregue:
1) arquivo de teste
2) matriz curta "Regra AGENTS.md -> Evidencia no teste"
```

## Prompt 4 — Auditoria de aderencia (Claude)

Use este prompt no Claude com os outputs reais do Copilot colados na conversa:

```text
Vou colar abaixo os outputs reais do Copilot (endpoint e testes) gerados com AGENTS.md v1.

Sua tarefa:
1) Avaliar o que foi SEGUIDO e o que foi IGNORADO do AGENTS.md v1.
2) Produzir uma tabela com colunas:
   - Regra
   - Status (Seguido / Parcial / Ignorado)
   - Evidencia concreta no codigo
   - Severidade do gap (Alta / Media / Baixa)
3) Sugerir reescritas prescritivas para cada item Parcial/Ignorado.

Importante:
- Nao invente problemas.
- So use evidencias que aparecem no codigo.
- Priorize regras que aumentam aderencia de agentes em geracoes futuras.

No final, entregue "Top 5 mudancas para AGENTS.md v2" em ordem de impacto.
```

## Prompt 5 — Gerar AGENTS.md v2 (Claude)

Use este prompt no Claude apos a auditoria:

```text
Com base nos gaps identificados na auditoria de aderencia do Copilot, reescreva o AGENTS.md para versao v2.

Objetivo:
- Manter as decisoes arquiteturais originais.
- Tornar regras mais prescritivas e menos ambiguas.
- Aumentar chance de aderencia do Copilot.

Instrucoes:
1) Entregue o AGENTS.md v2 completo.
2) Inclua uma secao "Delta v1 -> v2" listando:
   - Regra antiga
   - Regra nova
   - Motivo da mudanca
   - Gap observado que ela corrige
3) Preserve obrigatoriamente:
   - context budget ADR-0002
   - vigencia de documentos ADR-0003
   - TypeScript strict, Zod, Vitest, pino, Conventional Commits, PR obrigatorio.
```

## Prompt 6 — Reteste com Copilot (Copilot Chat)

Use este prompt no Copilot com AGENTS.md v2:

```text
Use estritamente as regras do AGENTS.md v2 deste repositorio e regenere:
1) endpoint Azure Functions v4 para POST /api/query
2) testes Vitest do endpoint

Depois, inclua uma auto-checagem em tabela:
- Regra do AGENTS.md v2
- Onde foi aplicada (arquivo/trecho)
- Nivel de confianca (Alto/Medio/Baixo)

Nao use regras fora do AGENTS.md v2.
```

## Prompt 7 — Relatorio final de evidencia da 2.1 (Claude)

Use este prompt para montar seu entregavel final:

```text
Vou colar os artefatos da 2.1:
- AGENTS.md v1
- outputs do Copilot rodada 1
- AGENTS.md v2
- outputs do Copilot rodada 2

Monte um relatorio final objetivo com:
1) Resumo executivo (5-8 linhas)
2) Evidencias de teste real (rodada 1 e 2)
3) O que melhorou concretamente de v1 para v2
4) Limites observados: o que ainda foi ignorado pelo Copilot e risco associado
5) Conclusao de prontidao (Pronto / Parcialmente pronto / Nao pronto) com justificativa

Formato:
- Use tabelas curtas quando ajudar.
- Seja tecnico e direto.
- Nao usar texto generico.

Entrega: relatorio em markdown.
```

## Checklist de uso rapido

- Rode os prompts na ordem 1 -> 7.
- Guarde evidencias das duas rodadas de Copilot (indispensavel para nota).
- Garanta diferenca real entre v1 e v2 (mudanca cosmetica derruba D2).
- Confirme que o AGENTS.md ficou prescritivo (evitar narracao).
