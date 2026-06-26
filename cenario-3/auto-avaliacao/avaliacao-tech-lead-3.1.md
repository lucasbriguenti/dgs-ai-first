## Avaliação do Exercício 3.1 — Design do Harness do Projeto

### Resumo

O entregável cobre as 5 camadas do harness com a estrutura exigida (tem / falta / como fechar), implementa a função de verificação de fonte com Copilot, e executa um code review que identifica 4 problemas reais — 2 críticos que tornavam os guardrails ineficazes no fluxo de produção. A distinção entre guardrails determinísticos (código) e probabilísticos (prompt) está explícita e bem fundamentada. O ponto mais forte é o code review: o Problema 2 (allowlist valida um valor que o handler descarta) só aparece lendo `handler.ts` junto com o validator, demonstrando análise genuína além do código isolado.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Explica por que structured output (Zod, .strict(), campo obrigatório) é mais confiável que instrução no prompt. Distingue com precisão: "o prompt reduz a frequência de erros mas não garante ausência — um confidence_score: Alta não garante que a resposta está correta". HITL definido com condição concreta (confidence_score < 0.6 + source_document em {POL-001, FAQ-Atendimento}), responsável e prazo máximo. |
| D2 — Uso de Ferramentas | 3 | Claude usado para o design das 5 camadas. Copilot acionado com prompt específico e detalhado (`tech-lead-3.1-copilot-prompt.md`), com requisitos técnicos explícitos do AGENTS.md. Code review executado sobre código real dos arquivos do repositório (`src/functions/query/validator.ts` e `src/services/response-validator.ts`). Output do Copilot não foi aceito acriticamente — 4 problemas identificados, 2 críticos. |
| D3 — Qualidade do Entregável | 3 | Todas as 5 camadas com tabela has/missing/how-to-close. Schema Zod funcional com .strict(). Função de verificação implementada (validateResponse + guardrails D1 e D2). Correções descritas com código concreto para cada problema do code review. Alertas com thresholds concretos (não "monitorar se piora"). Checklist go/no-go com 10 critérios distinguindo bloqueantes de desejáveis. Não se aplica a regra de corte "só loga" — o código retorna safeResponse. |
| D4 — Pensamento Crítico | 3 | O Problema 2 do code review (allowlist valida `completion.source_document`, que o handler descarta em favor de `selectSourceDocument`) requer leitura cruzada de `handler.ts` e `response-validator.ts` — não é detectável olhando o validator isoladamente. A limitação sobre FAQ-Atendimento no allowlist ser um documento informal é identificada proativamente. O checklist final aponta honestamente que 3 de 7 critérios bloqueantes ainda estão abertos. |
| D5 — Aplicabilidade ao Projeto | 3 | ADR-0002 referenciada explicitamente com os valores concretos (4K system prompt + 8K chunks + 3 turnos). Enforçamento via Zod alinhado ao AGENTS.md do cenário 2 (top_k.max(5), conversation_history.max(3)). ADR-0003 conectada ao filtro de vigência no retrieval. Lista de documentos válidos usa os identificadores curtos do projeto (POL-001, PROC-042-v2, etc.). HITL condicionado a documentos do domínio NovaTech (POL-001, FAQ-Atendimento). |

**Score do exercício: 3.0**

### Verificação de Armadilhas

| Critério da Rubrica | Verificado? |
|---|---|
| 5 camadas cobertas (não apenas guardrails) | ✅ Sim — todas com estrutura has/missing/how-to-close |
| Context & memory conecta à ADR-0002 (não reinventa) | ✅ Sim — referencia valores concretos da ADR-0002 |
| Guardrails mencionam structured outputs + ao menos 1 HITL | ✅ Sim — HITL com condição, responsável e prazo concretos |
| Função de verificação implementada e funcional | ✅ Sim — validateResponse com Zod + 2 guardrails, revisado com code review |
| Concretude — prescreve implementações, não conceitos | ✅ Sim — código real, thresholds concretos, arquivos especificados |

### Pontos Fortes

- Code review identificou Problema 2 (arquitetural, não sintático) — o bug só aparece lendo dois arquivos em conjunto; isso é revisão de verdade.
- A distinção probabilístico × determinístico está ancorada em evidência do projeto (12% de erro em staging), não em argumento teórico.
- O checklist go/no-go é honesto: admite que 3 de 7 critérios bloqueantes estão abertos e estima 3–4 dias para fechá-los.

### Pontos de Melhoria

- As correções do code review estão documentadas no relatório mas não foram aplicadas aos arquivos do repositório. Para uma entrega formal, o `handler.ts` deveria ter o allowlist check após `selectSourceDocument`.
- O ponto de HITL está projetado mas não implementado — o relatório classifica isso como bloqueante (correto), mas poderia incluir o pseudocódigo de como o bot receberia o status `"pending_review"`.

### Classificação

**Aprovado com distinção (3.0)**
