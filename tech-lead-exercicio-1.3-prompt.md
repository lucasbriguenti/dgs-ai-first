# Prompt — Tech Lead | Exercício 1.3 — Revisão Crítica de Proposta de RAG

> **Como usar:** Este exercício tem 3 etapas. A ordem importa — a Etapa 1 deve ser feita
> por você sem IA antes de abrir o Claude.
>
> **Registro das conversas:** Ao final de cada etapa com o Claude, copie o histórico
> completo e cole no arquivo `historico-conversas.md` nesta mesma pasta.

---

## Contexto do Projeto

A DB1 está construindo um assistente de IA com RAG para a NovaTech, empresa de logística.
A documentação está espalhada em SharePoint (~800 PDFs/DOCX), Confluence (~400 páginas wiki)
e planilhas de rede (~50 XLSX). O assistente responde perguntas de 45 atendentes no Microsoft Teams.

**Fatos relevantes sobre a base de dados:**
- Base total estimada em ~12M tokens
- PDFs incluem tabelas complexas de frete (15+ colunas) e ~15% são documentos escaneados (OCR necessário)
- Dois documentos contraditórios coexistem: PROC-042 v1 (mar/2023) e PROC-042-v2 (nov/2023), com multiplicadores regionais diferentes e sem indicação formal de vigência
- Wiki do Confluence usa macros customizadas e links internos entre páginas
- Planilhas têm fórmulas interdependentes

**Proposta do desenvolvedor júnior a revisar:**
> "Vamos usar Azure AI Search com embeddings do ada-002. Todos os documentos serão indexados
> num único índice. Chunking fixo de 512 tokens sem overlap. O LLM recebe os 3 chunks mais
> similares. Usaremos GPT-4o para geração. O pipeline de ingestão roda manualmente quando
> alguém lembra de atualizar."

---

## Etapa 1 — Sua Revisão (FAZER ANTES DE USAR O CLAUDE)

**Não pule esta etapa.** O exercício exige que você produza sua lista de problemas de forma
independente. Registre no arquivo `historico-conversas.md`, seção "Etapa 1", antes de
continuar.

Analise a proposta acima e identifique **ao menos 4 problemas ou riscos reais**. Para cada um:
- Descreva o problema com precisão técnica
- Explique o impacto concreto no projeto (o que vai falhar e quando)
- Proponha uma alternativa

Use os fatos do contexto acima — a proposta tem problemas específicos para este cenário,
não apenas problemas genéricos de RAG.

---

## Etapa 2 — Segunda Revisão com o Claude

Após registrar sua lista na Etapa 1, cole este prompt numa conversa com o Claude:

---

**[INÍCIO DO PROMPT ETAPA 2]**

Preciso de uma revisão técnica independente de uma proposta de arquitetura de RAG.
Leia a proposta e o contexto, identifique os problemas, e proponha alternativas.

**Contexto do projeto:**
- Empresa: NovaTech, logística, 1.200 funcionários
- Assistente de IA para 45 atendentes via Microsoft Teams
- Base: ~800 PDFs no SharePoint (inclui tabelas complexas de frete com 15+ colunas e ~15% escaneados), ~400 páginas no Confluence (macros customizadas, links internos), ~50 planilhas XLSX (fórmulas interdependentes)
- Base total estimada: ~12M tokens
- Problema crítico de dados: dois documentos contraditórios coexistem (PROC-042 v1 e v2, multiplicadores regionais diferentes, sem marcação de vigência)
- Stack disponível: cliente já tem Microsoft 365 E3 e Azure AI Services provisionado
- Prazo: 3 meses para go-live
- Time de manutenção pós go-live: TI interno da NovaTech sem experiência em MLOps

**Proposta do desenvolvedor júnior:**
> "Vamos usar Azure AI Search com embeddings do ada-002. Todos os documentos serão indexados
> num único índice. Chunking fixo de 512 tokens sem overlap. O LLM recebe os 3 chunks mais
> similares. Usaremos GPT-4o para geração. O pipeline de ingestão roda manualmente quando
> alguém lembra de atualizar."

**Tarefa:**

1. Identifique **todos os problemas e riscos** desta proposta. Seja específico — não quero
   problemas genéricos como "chunking pode ser melhor". Quero problemas concretos para
   este cenário: o que vai falhar, quando, e por quê.

2. Para cada problema, proponha uma alternativa com justificativa.

3. Classifique cada problema por severidade:
   - **Crítico:** vai causar falha em produção ou respostas incorretas para os atendentes
   - **Alto:** vai degradar qualidade ou gerar retrabalho significativo
   - **Médio:** impacta operação ou manutenção, mas não bloqueia o sistema

4. Ao final, indique quais problemas são **específicos a este cenário** (não seriam problemas
   num projeto diferente) e quais são problemas universais de design de RAG.

**[FIM DO PROMPT ETAPA 2]**

---

## Etapa 3 — Comparação e Proposta Reescrita

Após receber a revisão do Claude, cole este prompt numa **segunda mensagem** da mesma conversa:

---

**[INÍCIO DO PROMPT ETAPA 3]**

Agora preciso consolidar as revisões e reescrever a proposta.

**Minha revisão independente (feita antes de consultar você) identificou estes problemas:**

1. **Pipeline de ingestão manual:** o processo de atualização depende de alguém lembrar de rodar — não há automação. Em um ambiente com documentação atualizada mensalmente por 3 áreas diferentes, isso garante que o índice ficará desatualizado regularmente.

2. **LLM recebendo apenas 3 chunks:** para perguntas simples pode ser suficiente, mas perguntas que cruzam múltiplos domínios (ex: prazo de devolução para cliente Gold com carga pesada) exigem chunks de POL-001, SLA-2024 e PROC-042 simultaneamente — com top-3, o retriever provavelmente descarta informação relevante.

3. **Índice único para todos os documentos:** misturar PDFs, wiki e planilhas num único índice sem separação por tipo ou domínio prejudica a precisão do retrieval — um chunk de planilha de frete pode ser recuperado para uma pergunta sobre política de devolução por similaridade superficial.

4. **Chunking fixo de 512 tokens sem overlap:** cortes fixos ignoram a estrutura dos documentos — uma tabela de multiplicadores regionais pode ser cortada no meio, separando cabeçalho dos valores. Sem overlap, contexto que atravessa a fronteira entre chunks é perdido para sempre.

---

Com base nas duas revisões, faça:

1. **Comparação honesta:** Para cada problema da sua lista, diga se eu também identifiquei
   (total, parcial ou não). Para cada problema da minha lista, diga se você também identificou.
   Seja direto sobre onde cada um acertou e errou.

2. **Lista consolidada final:** Todos os problemas únicos das duas listas, sem duplicatas,
   ordenados por severidade.

3. **Proposta reescrita:** Reescreva a proposta do desenvolvedor júnior incorporando todas as
   correções. A proposta reescrita deve:
   - Ter o mesmo formato narrativo da original (não uma lista de bullets)
   - Ser concreta e acionável — não vaga
   - Não adicionar complexidade desnecessária (se o problema não exige solução sofisticada, use a simples)
   - Endereçar explicitamente: estratégia de chunking, número de chunks recuperados, tratamento
     dos documentos contraditórios (PROC-042 v1 e v2), processo de ingestão automatizado, e
     qual LLM usar com justificativa para este cliente específico

**[FIM DO PROMPT ETAPA 3]**

---

## Checklist de Entregáveis

- [ ] Lista de problemas feita por você **antes** de usar o Claude (Etapa 1)
- [ ] Revisão do Claude com problemas, alternativas e severidades (Etapa 2)
- [ ] Comparação honesta entre as duas revisões (Etapa 3)
- [ ] Proposta reescrita e corrigida (Etapa 3)
- [ ] Arquivo `historico-conversas.md` com todo o histórico registrado
