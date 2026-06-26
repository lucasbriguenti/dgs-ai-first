## Avaliação do Exercício 3.2 — Revisão Crítica da Arquitetura Gerada com IA

### Resumo

O entregável segue o método correto: autoavaliação própria antes do Claude, co-revisão independente, comparação honesta do delta, priorização com risco residual aceito explicitamente, e parecer de go-live fundamentado. Os dois riscos centrais que a rubrica exige — skills sem refinamento gerando outputs inconsistentes, e system prompt sem changelog impossibilitando rollback informado — foram identificados em ambas as avaliações. A comparação é genuinamente honesta: reconhece que a co-revisão adicionou o ângulo de governança pós-go-live e o problema de diagnóstico de incidentes, que não estavam na análise prévia.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Distingue "prompt drift" (o que acontece) de "impossibilidade de rollback informado" (a consequência operacional). Identifica que o risco das skills sem refinamento não é só qualidade atual — é governança de evolução pós-go-live. O risco residual é explicitamente nomeado e diferenciado de risco bloqueante. |
| D2 — Uso de Ferramentas | 3 | Claude acionado com sequência de 5 prompts progressivos (contextualize → revise → compare → priorize → relate). A comparação humano × Claude não é cosmética — identifica exatamente o que cada parte adicionou e o que tratou de forma diferente, com justificativa. |
| D3 — Qualidade do Entregável | 3 | Tabela consolidada com 5 artefatos, nível de risco e critério de verificação específico. Priorização com estimativa de horas (não "dias"). Três blocos de risco residual com mitigação mínima concreta para cada um. Parecer go-live com condição de aprovação explícita (2 critérios bloqueantes nomeados). |
| D4 — Pensamento Crítico | 3 | Autoavaliação prévia substantiva — tabela com 5 artefatos, risco e verificação concretos, preenchida antes de qualquer ferramenta de IA (Prompt 0 em `tech-lead-3.2.prompt.md`). A comparação reconhece honestamente: "a co-revisão adicionou o ângulo de governança contínua que eu não havia visto". A priorização aceita risco residual explícito (não lista "verificar tudo"). |
| D5 — Aplicabilidade ao Projeto | 3 | Referencia o AGENTS.md do cenário 2 como artefato concreto a revisar. Cita ADR-0002 e ADR-0003 como critérios de verificação. Os 12% de respostas incorretas em staging são usados como motivação da priorização. A skill Foundation com v1→v2 documentada é corretamente diferenciada das skills sem refinamento. |

**Score do exercício: 3.0**

### Verificação de Armadilhas

| Critério da Rubrica | Verificado? |
|---|---|
| Skills sem refinamento = risco de outputs inconsistentes | ✅ Sim — identificado em ambas as avaliações; co-review adicionou o ângulo pós-go-live |
| Prompt sem changelog = risco de governança (rollback impossível) | ✅ Sim — identificado em ambas; co-review aprofundou com o problema de diagnóstico de incidentes |
| Análise própria ANTES do Claude (substantiva, não vazia) | ✅ Sim — tabela com 5 artefatos preenchida no Prompt 0 antes de qualquer prompt ao Claude |
| Priorização pragmática (aceita risco residual) | ✅ Sim — 3 blocos distintos com horas estimadas e mitigações mínimas |
| Comparação com Claude honesta (reconhece o que foi acrescentado) | ✅ Sim — identifica especificamente o que cada lado adicionou e onde houve divergência |

### Pontos Fortes

- A autoavaliação do Prompt 0 já estava no nível correto — os mesmos artefatos com classificação de risco que a rubrica exige foram identificados de forma independente.
- A priorização é genuinamente cirúrgica: "marcar as skills como rascunho em 15 minutos" é a ação de menor esforço para o maior bloqueio de risco — mostra julgamento, não cobertura exaustiva.
- O parecer de go-live "Pronto com ressalvas" com condições específicas é mais útil do que uma resposta binária.

### Pontos de Melhoria

- A autoavaliação poderia ter identificado o ângulo de "diagnóstico pós-incidente" para o system prompt (não apenas drift), reduzindo a dependência da co-revisão nesse ponto.
- O risco das skills Domain e Artifact poderia ter incluído o impacto concreto: quais módulos seriam gerados com essas skills no pós-go-live (ex: painel web, integração com Azure AI Search), tornando o risco mais tangível.

### Classificação

**Aprovado com distinção (3.0)**
