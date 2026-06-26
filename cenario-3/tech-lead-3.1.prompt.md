# Prompts — Tech Lead 3.1 (Design do Harness do Projeto)

Objetivo: projetar o harness completo em 5 camadas para o NovaTech Assistant e implementar uma verificação determinística da camada Verification Loops.

> **Estado atual do projeto (o que já existe):**
> - Pipeline de ingestão processa 847 documentos indexados no Azure AI Search.
> - Query endpoint recebe POST, busca chunks (top-5, ~1.500 tokens cada), retorna texto livre — ainda sem structured output.
> - Bot do Teams em staging, 5 atendentes-piloto.
> - AGENTS.md (v2 do cenário 2), skills, specs e guardrails no repositório.
> - ADR-0002 (context budget: ~4K system prompt + ~8K chunks + pergunta + máx. 3 turnos de histórico) e ADR-0003 (vigência de documentos) vigentes.
> - Testes de integração cobrem ~75% do código.
> - Documentos válidos na base (identificadores curtos): `POL-001`, `PROC-042`, `PROC-042-v2`, `SLA-2024`, `FAQ-Atendimento`.
> - **Gap conhecido:** 12% das respostas em staging estavam incorretas; respostas em texto livre sem garantia de `source_document` presente.

---

## Prompt 1 — Design do harness: 5 camadas (Claude)

```text
Você vai atuar como Tech Lead do projeto NovaTech Assistant e projetar o harness de produção do sistema.

Contexto:
- O assistente usa RAG com Azure AI Search. O pipeline busca os 5 chunks mais relevantes (~1.500 tokens cada) e envia ao GPT-4o com system prompt.
- ADR-0002 define o context budget: ~4K tokens de system prompt + ~8K de chunks + pergunta + histórico de máximo 3 turnos. O harness DEVE enforçar esses limites.
- ADR-0003 define vigência: priorizar documento mais recente quando houver conflito; obsoletos são marcados, nunca excluídos.
- Documentos válidos na base (identificadores curtos): POL-001, PROC-042, PROC-042-v2, SLA-2024, FAQ-Atendimento.
- Respostas hoje são texto livre. Em 12% dos casos de staging: fonte ausente, alucinação ou chunk errado.
- Demo para a diretoria em 2 semanas.

Tarefa:
Projete o harness do NovaTech Assistant cobrindo OBRIGATORIAMENTE as 5 camadas abaixo. Para cada camada, especifique:
(a) O que já está implementado.
(b) O que falta implementar.
(c) Como fechar o gap — de forma concreta e prescritiva (não apenas nomear conceitos).

As 5 camadas obrigatórias:

1. Tool orchestration
   Coordenação entre ingestão, retrieval (Azure AI Search) e geração (GPT-4o). Inclua o fluxo de chamadas e onde cada falha deve ser capturada.

2. Verification loops
   Verificações automáticas sobre o output do modelo ANTES de ele chegar ao atendente. Inclua ao menos:
   - Validação do schema structured output (campos obrigatórios: answer, source_document, confidence_score).
   - Verificação de que source_document está na lista de documentos válidos da base.
   - O que fazer quando a verificação falha (mensagem padrão segura, não silêncio).

3. Context & memory
   Conecte EXPLICITAMENTE ao context budget da ADR-0002:
   - Como o límite de top_k ≤ 5 e history ≤ 3 é enforçado (Zod? middleware?).
   - O que acontece quando o budget é excedido (truncar? rejeitar? degradar com aviso?).
   - Como a regra de vigência da ADR-0003 entra no retrieval.

4. Guardrails
   Separe em duas categorias:
   (a) Determinísticos (código): structured output com Zod + verificações de regra fixa.
       - Guardrail 1: source_document ausente → rejeitar, retornar mensagem padrão.
       - Guardrail 2: resposta menciona "carga perigosa" + "devolução" de forma afirmativa → bloquear.
   (b) Probabilísticos (prompt): o que o system prompt instrui o modelo a fazer, e por que isso não é suficiente sozinho.
   (c) Human-in-the-loop: defina AO MENOS 1 ponto de HITL concreto. Especifique:
       - Qual condição aciona o HITL (ex.: confidence_score < limiar, tema sensível).
       - Quem valida (atendente supervisor, compliance?).
       - Qual a ação enquanto aguarda validação (segurar a resposta? aviso ao atendente?).

5. Observability
   O que logar, quais métricas coletar e como detectar anomalias em produção.
   Inclua ao menos 2 alertas com thresholds concretos (não "monitorar se piora").

Formato de saída: tabela por camada (O que tem | O que falta | Como fechar o gap) + texto prescritivo para os itens críticos. Sem texto genérico sobre IA em geral; foco no sistema NovaTech.
```

---

## Prompt 2 — Implementar a função de verificação de fonte (Copilot Chat)

> **Antes de abrir o Copilot:** confirme que está no contexto do repositório `novatech-assistant`. O arquivo deve ser criado em `src/services/response-validator.ts`.

Com o design do harness gerado no Prompt 1:

```text
Use as regras do AGENTS.md deste repositório e implemente a função de verificação de fonte citada em src/services/response-validator.ts.

Contexto:
- O modelo retorna uma resposta com o campo source_document.
- Os identificadores válidos de documentos são: POL-001, PROC-042, PROC-042-v2, SLA-2024, FAQ-Atendimento.
- Se o source_document não estiver nessa lista (ou estiver ausente/vazio), a resposta deve ser marcada como suspeita.

Requisitos da função:
1. Recebe como input a resposta do modelo (que pode ser qualquer objeto — valide com Zod).
2. Verifica se source_document está na lista de documentos válidos.
3. Retorna um objeto com: { valid: boolean; reason?: string } — quando inválido, reason descreve o motivo.
4. Registra o motivo em log estruturado (pino) quando a resposta for inválida.
5. TypeScript strict: sem any, sem as any.
6. Imports estáticos no topo (sem require dinâmico).

Schema Zod da resposta esperada (structured output):
- answer: string não vazia
- source_document: string (pode ser ausente/vazia — a função deve detectar)
- confidence_score: number entre 0 e 1

Entregue:
1) O schema Zod completo do structured output (com .strict() para rejeitar campos extras).
2) A função validateSourceDocument(response: unknown): { valid: boolean; reason?: string }.
3) Uma breve explicação de como cada requisito do AGENTS.md foi atendido.
```

---

## Prompt 3 — Code review da função gerada (Claude)

Cole o código gerado pelo Copilot na conversa:

```text
Vou colar o código da função de verificação de fonte gerado pelo Copilot (response-validator.ts).

Faça um code review crítico identificando AO MENOS 2 problemas reais — não invente problemas. Foque em:
- O schema Zod aceita campos extras? (deveria usar .strict())
- O regex ou comparação para source_document cobre variações de case (POL-001 vs pol-001)?
- O campo source_document ausente/undefined é tratado corretamente (não apenas string vazia)?
- O log inclui dados que não deveriam ser logados (dados do atendente, conteúdo da resposta)?
- A resposta padrão segura é retornada quando a verificação falha, ou apenas loga?
- Há any implícito ou cast inseguro?

Para cada problema identificado, entregue:
- Descrição do problema.
- Classificação (violação do AGENTS.md / problema de segurança / bug).
- Código corrigido (o trecho, não o arquivo inteiro).

No final, entregue o response-validator.ts completo com todas as correções aplicadas.
```

---

## Prompt 4 — Relatório final da 3.1 (Claude)

```text
Vou colar os artefatos da tarefa 3.1:
- Design do harness (5 camadas)
- Código do response-validator.ts (versão final pós code review)

Monte o relatório final com:
1) Resumo executivo do harness projetado (5-8 linhas).
2) As 5 camadas: para cada uma, o que já existe e o que foi projetado.
3) A função de verificação: o que ela faz, o que detecta, limitações conhecidas.
4) Onde structured outputs e HITL entram na arquitetura (explícito, com camada e condição).
5) Riscos abertos: o que o harness ainda não cobre e o risco associado.
6) Checklist go/no-go para produção com base no harness projetado.

Formato: markdown, técnico, tabelas curtas onde ajudar, sem texto genérico.
```

---

## Checklist de uso rápido

- Execute os prompts na ordem 1 → 4.
- O Prompt 1 DEVE resultar em tabela por camada — output apenas conceitual = red flag para a avaliação.
- O Prompt 2 DEVE ser executado no Copilot com o AGENTS.md visível no repositório.
- No Prompt 3, identifique problemas reais do código gerado (não invente).
- Confirme que a camada Context & memory referencia EXPLICITAMENTE a ADR-0002 (não reinventa o context budget).
- Confirme que a camada Guardrails menciona structured outputs + ao menos 1 ponto de HITL com condição e responsável concretos.
