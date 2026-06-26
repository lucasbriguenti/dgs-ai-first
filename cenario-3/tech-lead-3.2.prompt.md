# Prompts — Tech Lead 3.2 (Revisão Crítica da Arquitetura Gerada com IA)

Objetivo: avaliar os riscos dos artefatos gerados com IA antes do go-live, usando análise própria como baseline e o Claude como co-reviewer, com priorização pragmática para 2 semanas.

> **Artefatos gerados com IA no projeto NovaTech (inputs da revisão):**
> - **AGENTS.md:** gerado pelo Claude e refinado 4 vezes. A última versão tem 15 páginas.
> - **Skills:** 3 skills criadas. A Foundation (`azure-functions-endpoint`) foi refinada após testes reais com Copilot. As outras duas (sem refinamento) foram usadas diretamente.
> - **Código:** pipeline de ingestão e query endpoint foram ~60-70% gerados pelo Copilot.
> - **System prompt:** iterado 6 vezes sem documentar por que cada mudança foi feita.

> **Instrução de sequência:** Execute a autoavaliação (Prompt 0) POR CONTA PRÓPRIA antes de usar o Claude. O critério de avaliação D3 penaliza análise vazia na etapa própria.

---

## Prompt 0 — Autoavaliação (antes do Claude — faça você mesmo)

> **Não use ferramentas de IA nesta etapa.** Preencha a tabela abaixo por conta própria antes de executar qualquer prompt no Claude.

Para cada artefato, responda:
- **Qual o risco de ter sido gerado por IA?** (alucinação? inconsistência? lacuna não detectada? governança?)
- **O que verificar antes do go-live?** (seja concreto — não "revisar o arquivo" mas "verificar se a regra X ainda está presente e não contradiz Y")

| Artefato | Risco identificado | O que verificar antes do go-live | Nível |
| :--- | :--- | :--- | :--- |
| **AGENTS.md** *(15 pág., 4 ref.)* | **Contradição interna:** Regras antigas misturadas com novas devido aos múltiplos refinamentos. | * Se as responsabilidades dos agentes não se sobrepõem e se a versão final anula as anteriores. | **Médio** |
| **Skill Foundation** *(com teste real)* | **Falta de robustez:** Funciona no cenário testado, mas pode falhar em casos extremos (*edge cases*). | * Se há tratamento de erro explícito para timeouts, quedas de rede e inputs vazios. | **Baixo** |
| **Skills Domain e Artifact** *(sem ref.)* | **Alucinação:** Código inventado, APIs inexistentes ou premissas de negócio erradas. | * Mapeamento de dados linha por linha contra o banco/contratos reais para caçar funções "fantasmas". | **Alto** |
| **Pipeline + endpoint** *(~70% Copilot)* | **Brechas de segurança:** Código gerado sem validação de entrada, *hardcoded tokens* ou brechas de injeção. | * Presença de validação estrita de schema (ex: Pydantic/Zod) no payload do endpoint. | **Alto** |
| **System prompt** *(6 iterações, sem log)* | **Regressão (*Prompt Drift*):** A última alteração pode ter quebrado regras validadas no início. | * Rodar o prompt contra uma suíte de testes fixos (*Golden Dataset*) para garantir o formato de saída correto. | **Alto** |

> Guarde esta tabela. Você vai comparar com a análise do Claude no Prompt 2.

---

## Prompt 1 — Contextualizar o Claude para a co-revisão (Claude)

```text
Você vai atuar como co-reviewer de arquitetura do projeto NovaTech Assistant.

O projeto tem os seguintes artefatos gerados com apoio de IA:

1. AGENTS.md — gerado pelo Claude, refinado 4 vezes. Última versão com 15 páginas. Usado como fonte de verdade para Copilot e Claude Code gerarem código.

2. Skills — 3 skills criadas para guiar geração com Copilot:
   - Foundation (azure-functions-endpoint): refinada após 2 rodadas de teste real com Copilot. Iteração v1 → v2 documentada.
   - Domain (azure-ai-search-integration): criada, nunca testada com Copilot em geração real.
   - Artifact (create-rag-endpoint): criada, nunca testada com Copilot em geração real.

3. Código — pipeline de ingestão e query endpoint gerados com ~60-70% de contribuição do Copilot. Cobertura de testes de integração: ~75%.

4. System prompt — iterado 6 vezes. Nenhuma iteração tem registro do motivo da mudança. Não há changelog de prompt no repositório.

Contexto de risco:
- 12% das respostas em staging estavam incorretas.
- Demo para a diretoria em 2 semanas.
- Go-live previsto logo após a demo.

Não produza nenhuma avaliação ainda. Confirme que entendeu o contexto e aguarde a próxima instrução.
```

---

## Prompt 2 — Co-revisão de riscos pelo Claude (Claude)

> **Execute este prompt APÓS ter preenchido sua autoavaliação no Prompt 0.**

```text
Com base no contexto do projeto NovaTech que descrevi, faça uma avaliação de riscos dos artefatos gerados com IA, por artefato.

Para cada artefato, identifique:
- O risco principal de ter sido gerado (ou fortemente influenciado) por IA.
- O que específico verificar antes do go-live.
- O nível de risco (Alto / Médio / Baixo) com justificativa.

Artefatos a avaliar:
1. AGENTS.md (15 páginas, 4 refinamentos, usado por agentes de código)
2. Skill Foundation (refinada com teste real — iteração documentada)
3. Skills Domain e Artifact (sem refinamento, sem teste real com Copilot)
4. Código do pipeline de ingestão + query endpoint (~60-70% Copilot, 75% cobertura de testes)
5. System prompt (6 iterações sem changelog)

Restrições:
- Baseie-se nos fatos apresentados — não invente problemas genéricos de "IA pode alucinar".
- Para as skills sem refinamento, o risco central é que podem gerar outputs inconsistentes com o padrão do projeto — explique por que isso é um risco real aqui.
- Para o system prompt sem changelog, o risco central é de governança (impossibilidade de rollback informado) — conecte isso ao contexto de go-live.

Formato: tabela por artefato + comentário de 2-3 linhas onde o risco merece detalhe.
```

---

## Prompt 3 — Comparação e delta (Claude)

Cole sua autoavaliação (Prompt 0) na conversa:

```text
Vou colar minha autoavaliação de riscos feita antes de usar o Claude.

Compare com a avaliação que você produziu:
1) Quais riscos estavam em ambas as avaliações (concordância)?
2) Quais riscos você levantou que eu não havia identificado?
3) Quais riscos eu havia levantado que você não considerou relevantes (e por quê)?

Seja honesto: o objetivo não é confirmar que fiz tudo certo, mas sim identificar o que o segundo par de olhos acrescenta.

Formato: 3 seções curtas com bullets, sem reformatar minha avaliação original.
```

---

## Prompt 4 — Priorização para 2 semanas (Claude)

```text
Com base nos riscos identificados (minha avaliação + sua co-revisão), faça a priorização para as 2 semanas até o go-live.

Contexto de restrição:
- Time pequeno, 2 semanas, demo com a diretoria no meio do caminho.
- Não é possível verificar tudo. Preciso decidir o que verifico primeiro e o que aceito como risco residual.

Sua tarefa:
1) Prioridade 1 (verificar antes da demo, pré-go-live):
   - Quais verificações têm maior impacto de risco se forem puladas?
   - Estime o esforço de verificação (horas, não "dias" genérico).

2) Prioridade 2 (verificar entre a demo e o go-live):
   - O que pode esperar a demo acontecer?

3) Risco residual aceito:
   - O que não dá para verificar em 2 semanas e aceito como risco gerenciado.
   - Para cada risco residual, qual a mitigação de menor esforço (ex.: monitorar métrica X, ter plano de rollback Y).

Restrições:
- Não liste "verificar tudo" como prioridade 1 — isso não é priorizar.
- A decisão de risco residual é minha como Tech Lead; você pode recomendar mas deve aceitar que eu escolha não verificar algo.

Formato: 3 blocos com bullets. Seja diretivo: diga qual verificar primeiro, não "poderia" ou "considere".
```

---

## Prompt 5 — Relatório final da 3.2 (Claude)

```text
Vou colar os artefatos da tarefa 3.2:
- Minha autoavaliação de riscos
- A co-revisão do Claude
- A comparação com delta
- A priorização para 2 semanas

Monte o relatório final com:
1) Resumo executivo: o que foi revisado, método (própria análise + co-revisão), conclusão em 3-5 linhas.
2) Riscos por artefato: tabela consolidada (artefato | risco | nível | o que verificar).
3) Delta humano vs Claude: o que cada lado acrescentou (honesto sobre concordâncias e divergências).
4) Plano de ação priorizado:
   - Semana 1 (pré-demo): o que fazer.
   - Semana 2 (pós-demo, pré-go-live): o que fazer.
   - Risco residual aceito: lista com mitigação mínima.
5) Parecer de go-live: pronto / pronto com ressalvas / não pronto — com justificativa baseada nos riscos.

Formato: markdown, técnico, tabelas onde ajudar, sem texto genérico sobre IA em geral.
```

---

## Checklist de uso rápido

- Execute o Prompt 0 (autoavaliação) POR CONTA PRÓPRIA antes de qualquer ferramenta de IA — avaliação vazia derruba D3.
- No Prompt 2, o Claude DEVE identificar: skills sem refinamento = risco de outputs inconsistentes; system prompt sem changelog = risco de governança. Se não identificar, corrija no Prompt 3.
- No Prompt 3, seja honesto sobre o que o Claude levantou que você não havia identificado — "já sabia tudo" = red flag de avaliação.
- No Prompt 4, a priorização DEVE aceitar risco residual explícito (tentar verificar tudo em 2 semanas = ausência de priorização).
- Guarde a comparação humano vs Claude: ela é evidência de execução da etapa de revisão crítica.
