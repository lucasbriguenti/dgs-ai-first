# Prompts — Tech Lead 2.3 (Criação e Teste de Skills Técnicas)

Objetivo: executar a tarefa 2.3 com **teste real com Copilot**, iteração **v1 → v2** e critérios de **maturidade** mensuráveis, demonstrando que skills são artefatos vivos.

> **Starter Repo (Anexo D) — o que já existe:** todos os arquivos em `skills/` estão **vazios** (stubs criados para ocupar o lugar). A tarefa é escrever o conteúdo de `skills/domain/azure-functions-endpoint.md`. Os stubs `src/shared/logger.ts` e `src/shared/errors.ts` também estão vazios — o SKILL.md é a oportunidade para definir o padrão que qualquer endpoint deve importar dessas dependências (ex.: `import { logger } from '../../shared/logger'`). O `tsconfig.json` usa `moduleResolution: Bundler` e `module: ESNext` — os exemplos de código no SKILL.md devem respeitar isso. Árvore de skills proposta pelo Dev (simulada): Foundation (typescript-conventions, error-handling, project-structure) → Domain (**azure-functions-endpoint**, azure-ai-search-integration, react-components, testing-patterns) → Artifact (create-rag-endpoint, create-integration-test, create-react-card).

---

## Prompt 1 — Escrever SKILL.md da `azure-functions-endpoint` (Claude)

```text
Você vai atuar como Tech Lead do projeto NovaTech Assistant e escrever o SKILL.md completo da skill de Domain `azure-functions-endpoint`, salvo em skills/domain/azure-functions-endpoint.md.

Contexto obrigatório do projeto:
- Stack: TypeScript strict + Azure Functions v4 (HTTP trigger), em src/functions/<nome>/.
- tsconfig: `"module": "ESNext"`, `"moduleResolution": "Bundler"` — imports devem seguir esse padrão.
- Validação: Zod para input e output.
- Testes: Vitest (cobertura mínima: 80% linhas, já configurado em vitest.config.ts).
- Logging: pino (NUNCA console.log). Logger exportado de `src/shared/logger.ts` (stub vazio — o padrão de implementação deve constar no SKILL.md).
- Custom errors: `src/shared/errors.ts` (stub vazio — idem).
- Tipos do domínio: `src/shared/types.ts` (stub vazio — idem).
- Toda resposta DEVE incluir o campo `source_document` no JSON de retorno.
- Esta skill é consumida por agentes (Copilot, Claude Code) e referencia as skills Foundation (typescript-conventions, error-handling, project-structure).

Estrutura obrigatória do SKILL.md:
1) Nome e objetivo da skill
2) Frase de ativação (quando usar) / quando NÃO usar
3) Dependências (quais skills Foundation ler antes)
4) Regras prescritivas (DEVE / NÃO DEVE)
5) Fluxo recomendado de implementação (passos)
6) Exemplos DO e DON'T com código TypeScript real (não pseudocódigo)
7) Anti-padrões comuns do Copilot em endpoints e como corrigir
8) Checklist de saída pronta para review
9) Critérios de validação automatizável

Qualidade: sem texto genérico; regras verificáveis; DO/DON'T cobrindo erros que o Copilot realmente comete (any, console.log, faltar validação de output, esquecer source_document, sem tratamento de erro padronizado).
```

---

## Prompt 2 — Tornar a skill agent-friendly (Claude)

```text
Revise o SKILL.md gerado e torne-o mais "agent-friendly".

Ajustes obrigatórios:
- Converter instruções vagas em comandos prescritivos.
- Incluir gatilhos de ativação (frases que sinalizam uso da skill).
- Incluir tabela "Regra -> Evidência esperada no código".
- Incluir uma seção "Falhas comuns de geração" com exemplos curtos.

No final, gere um bloco "Quick Prompt de ativação" para eu colar no Copilot ao testar a skill.
```

---

## Prompt 3 — Teste real com Copilot: gerar endpoint (Copilot Chat)

Com o SKILL.md presente no repositório:

```text
Use a skill skills/domain/azure-functions-endpoint.md deste repositório para gerar um endpoint Azure Functions v4 em TypeScript para POST /api/query, em src/functions/query/.

Requisitos:
- Input com campo question (string não vazia).
- Validação com Zod (request e response).
- Logging estruturado com pino.
- Tratamento de erros com resposta padronizada.
- Resposta incluindo source_document.
- Sem any e sem console.log.

Entregue:
1) o código do endpoint
2) um mapeamento curto "Regra da skill -> trecho do código"
```

---

## Prompt 4 — Teste real com Copilot: gerar testes (Copilot Chat)

```text
Com base na mesma skill azure-functions-endpoint, gere testes em Vitest para o endpoint criado.

Cobertura mínima:
- Caso feliz
- Input inválido
- Falha interna controlada

Regras:
- Assertions específicas (não toBeDefined()/toBeTruthy() isolados)
- Isolamento de dependências externas
- Nomes de teste descritivos em inglês (it('should ... when ...'))

Entregue:
1) o arquivo de teste
2) uma tabela "Regra da skill -> evidência no teste"
```

---

## Prompt 5 — Auditoria de aderência da skill (Claude)

Cole os outputs reais do Copilot:

```text
Vou colar os outputs reais do Copilot (endpoint e testes) gerados usando a skill azure-functions-endpoint.

Sua tarefa:
1) Avaliar aderência à skill em tabela: Regra da skill | Status (Seguido/Parcial/Ignorado) | Evidência concreta | Impacto (Alto/Médio/Baixo).
2) Identificar ambiguidades no SKILL.md que causaram não-aderência.
3) Sugerir reescritas objetivas para aumentar aderência.

Restrição: não invente problemas; use só o que aparece no código colado.

No final entregue:
- "Top 7 ajustes para o SKILL.md v2" em ordem de impacto.
- "Risco se não ajustar" para cada item ignorado crítico.
```

---

## Prompt 6 — Gerar SKILL.md v2 (Claude)

```text
Com base na auditoria de aderência, reescreva a skill azure-functions-endpoint para a versão v2.

Objetivo: melhorar aderência do Copilot sem perder clareza; tornar a skill mais concreta e testável.

Instruções:
1) Entregue o SKILL.md v2 completo.
2) Inclua seção "Delta v1 -> v2": Regra antiga | Regra nova | Gap observado corrigido.
3) Mantenha exemplos DO/DON'T e anti-padrões atualizados (com código real).
```

---

## Prompt 7 — Reteste com Copilot (Copilot Chat)

Com o SKILL.md v2:

```text
Use estritamente a skill azure-functions-endpoint v2 deste repositório e regenere:
1) o endpoint POST /api/query
2) os testes Vitest do endpoint

Depois, gere uma auto-checagem: Regra da skill v2 | Onde aplicou | Nível de confiança (Alto/Médio/Baixo).
Não invente regras fora da skill.
```

---

## Prompt 8 — Critérios de skill madura (Claude)

```text
Defina critérios práticos e mensuráveis para considerar a skill azure-functions-endpoint MADURA para uso do time.

Estruture por dimensão:
- Aderência em gerações reais (ex.: passou em 3+ gerações com Copilot)
- Clareza e prescritividade
- Cobertura de anti-padrões (validados em teste real)
- Estabilidade após iterações
- Aprovação em review técnico

Para cada critério: métrica | limiar de aprovação | evidência necessária.
No final, gere uma checklist go/no-go para promover a skill a "recomendada para o time".
```

---

## Prompt 9 — Relatório final da 2.3 (Claude)

```text
Vou colar os artefatos da tarefa 2.3:
- SKILL.md v1
- outputs do Copilot rodada 1
- SKILL.md v2
- outputs do Copilot rodada 2
- critérios de maturidade

Monte o relatório final com:
1) Resumo executivo
2) Evidências de teste real com Copilot (rodadas 1 e 2)
3) Evolução concreta v1 -> v2
4) O que ainda foi ignorado e risco residual
5) Critérios de maturidade adotados
6) Conclusão (Madura / Em evolução) com justificativa

Formato: direto, técnico, tabelas curtas quando útil, sem texto genérico.
```

---

## Checklist de uso rápido

- Execute os prompts na ordem 1 → 9.
- Guarde a evidência das DUAS rodadas do Copilot (sem teste real, D2 ≤ 1).
- Mostre melhoria real de v1 para v2 (não apenas edição cosmética).
- DO/DON'T com código TypeScript real no SKILL.md (texto abstrato = red flag).
- Feche com critérios de maturidade mensuráveis (não "quando parecer boa").
