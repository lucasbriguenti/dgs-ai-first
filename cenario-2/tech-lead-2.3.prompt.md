# Prompts — Tech Lead 2.3 (Criacao e Teste de Skills Tecnicas)

Objetivo: executar a tarefa 2.3 com evidencias de teste real, iteracao e criterios de maturidade da skill.

## Prompt 1 — Escrever SKILL.md da `azure-functions-endpoint` (Claude)

Use este prompt no Claude:

```text
Voce vai atuar como Tech Lead do projeto NovaTech Assistant.

Sua tarefa e escrever o SKILL.md completo da skill de dominio `azure-functions-endpoint`.

Contexto obrigatorio do projeto:
- Stack: TypeScript strict + Azure Functions v4 (HTTP trigger).
- Validacao: Zod para input/output.
- Testes: Vitest.
- Logging: pino (nunca console.log).
- Regras de contexto: seguir restricoes do projeto para respostas com source_document e guardrails definidos.
- Esta skill deve ser prescritiva e consumivel por agentes (Copilot e Claude Code).

Estrutura obrigatoria do SKILL.md:
1) Nome e objetivo da skill
2) Quando usar / quando NAO usar
3) Dependencias
4) Regras prescritivas (DEVE / NAO DEVE)
5) Fluxo recomendado de implementacao
6) Exemplos DO e DONT com codigo real (TypeScript)
7) Anti-padroes comuns e como corrigir
8) Checklist de saida pronta para review
9) Criterios de validacao automatizavel

Requisitos de qualidade:
- Evite texto generico.
- Regras precisam ser verificaveis.
- DO/DONT devem cobrir erros que o Copilot realmente costuma cometer em endpoint.
```

## Prompt 2 — Fortalecer a skill para aderencia de agente (Claude)

Use este prompt no Claude apos o Prompt 1:

```text
Revise o SKILL.md gerado e torne-o mais "agent-friendly".

Ajustes obrigatorios:
- Converter instrucoes vagas em comandos prescritivos.
- Incluir gatilhos de ativacao (frases que sinalizam uso da skill).
- Incluir tabela "Regra -> Evidencia esperada no codigo".
- Incluir uma secao "Falhas comuns de geracao" com exemplos curtos.

No final, gere um bloco "Quick Prompt de ativacao" para eu usar no Copilot ao testar a skill.
```

## Prompt 3 — Teste real da skill com Copilot (gerar endpoint)

Use este prompt no Copilot com SKILL.md presente no repositorio:

```text
Use a skill `azure-functions-endpoint` deste repositorio para gerar um endpoint Azure Functions v4 em TypeScript para POST /api/query.

Requisitos:
- Input com campo question (string nao vazia).
- Validacao com Zod (request e response).
- Logging estruturado com pino.
- Tratamento de erros com resposta padronizada.
- Resposta incluindo source_document.
- Sem any e sem console.log.

Entregue:
1) codigo do endpoint
2) mapeamento curto "Regra da skill -> trecho do codigo"
```

## Prompt 4 — Teste real da skill com Copilot (gerar testes)

Use este prompt no Copilot apos o endpoint:

```text
Com base na mesma skill `azure-functions-endpoint`, gere testes em Vitest para o endpoint criado.

Cobertura minima:
- Caso feliz
- Input invalido
- Falha interna controlada

Regras:
- Assertions especificas
- Isolamento de dependencias externas
- Nomes de testes descritivos em ingles

Entregue:
1) arquivo de teste
2) tabela "Regra da skill -> evidencias no teste"
```

## Prompt 5 — Auditoria de aderencia da skill (Claude)

Use este prompt no Claude com os outputs reais do Copilot colados:

```text
Vou colar os outputs reais do Copilot (endpoint e testes) usando a skill `azure-functions-endpoint`.

Sua tarefa:
1) Avaliar aderencia a skill com tabela:
   - Regra da skill
   - Status (Seguido / Parcial / Ignorado)
   - Evidencia concreta
   - Impacto (Alto/Medio/Baixo)
2) Identificar ambiguidades no SKILL.md que causaram nao-aderencia.
3) Sugerir reescritas objetivas para aumentar aderencia.

No final, entregue:
- "Top 7 ajustes para SKILL.md v2" em ordem de impacto.
- "Riscos se nao ajustar" para cada item ignorado critico.
```

## Prompt 6 — Gerar SKILL.md v2 (Claude)

Use este prompt no Claude apos a auditoria:

```text
Com base na auditoria de aderencia, reescreva a skill `azure-functions-endpoint` para versao v2.

Objetivo:
- Melhorar aderencia do Copilot sem perder clareza.
- Tornar a skill mais concreta e testavel.

Instrucoes:
1) Entregue o SKILL.md v2 completo.
2) Inclua secao "Delta v1 -> v2" com:
   - Regra antiga
   - Regra nova
   - Gap observado corrigido
3) Mantenha exemplos DO/DONT e anti-padroes atualizados.
```

## Prompt 7 — Reteste com Copilot (rodada 2)

Use este prompt no Copilot com SKILL.md v2:

```text
Use estritamente a skill `azure-functions-endpoint` v2 deste repositorio e regenere:
1) endpoint POST /api/query
2) testes Vitest do endpoint

Depois, gere auto-checagem:
- Regra da skill v2
- Onde aplicou
- Nivel de confianca (Alto/Medio/Baixo)

Nao invente regras fora da skill.
```

## Prompt 8 — Definir criterios de skill madura (Claude)

Use este prompt no Claude:

```text
Defina criterios praticos e mensuraveis para considerar a skill `azure-functions-endpoint` como madura para uso do time.

Estruture por dimensao:
- Aderencia em geracoes reais
- Clareza e prescritividade
- Cobertura de anti-padroes
- Estabilidade apos iteracoes
- Aprovacao em review tecnico

Para cada criterio, inclua:
- metrica
- limiar de aprovacao
- evidencia necessaria

No final, gere uma checklist de go/no-go para promover a skill a "recomendada para producao".
```

## Prompt 9 — Relatorio final da 2.3 (Claude)

Use este prompt para consolidar seu entregavel:

```text
Vou colar os artefatos da tarefa 2.3:
- SKILL.md v1
- outputs do Copilot rodada 1
- SKILL.md v2
- outputs do Copilot rodada 2
- criterios de maturidade

Monte o relatorio final com:
1) Resumo executivo
2) Evidencias de teste real com Copilot
3) Evolucao concreta v1 -> v2
4) O que ainda foi ignorado e risco residual
5) Criterios de maturidade adotados
6) Conclusao (Madura / Em evolucao) com justificativa

Formato:
- Direto e tecnico
- Tabelas curtas quando util
- Sem texto generico
```

## Checklist de uso rapido

- Execute os prompts na ordem 1 -> 9.
- Guarde evidencias das duas rodadas do Copilot.
- Mostre melhoria real de v1 para v2 (nao apenas edicao cosmetica).
- Garanta DO/DONT com codigo real no SKILL.md.
- Feche com criterios de maturidade mensuraveis.
