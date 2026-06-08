# Histórico de Conversas — Tech Lead | Exercício 1.3

---

## Etapa 1 — Minha Revisão Independente (sem IA)

> Preencha antes de abrir o Claude.

### Problemas identificados

| # | Problema | Impacto concreto | Alternativa proposta | Severidade |
|---|----------|-----------------|----------------------|------------|
| 1 | Pipeline de ingestão manual | Índice ficará desatualizado — documentação é atualizada mensalmente por 3 áreas sem processo unificado | Pipeline automatizado com trigger por evento (novo documento publicado) ou schedule diário | |
| 2 | LLM recebendo apenas 3 chunks | Perguntas multi-domínio perdem informação relevante — top-3 não garante cobertura de POL-001 + SLA-2024 + PROC-042 simultaneamente | Aumentar para top-5 ou top-7 com threshold de similaridade mínimo | |
| 3 | Índice único para todos os documentos | Precisão do retrieval cai — chunks de planilhas podem ser recuperados para perguntas sobre políticas por similaridade superficial | Índices separados por tipo/domínio ou metadados de filtro obrigatórios na query | |
| 4 | Chunking fixo de 512 tokens sem overlap | Tabelas e seções longas são cortadas no meio; contexto na fronteira entre chunks é perdido | Chunking por seção estrutural com overlap de 10% (50 tokens) | |

---

## Etapa 2 — Revisão do Claude

### Prompt enviado

Preciso de uma revisão técnica independente de uma proposta de arquitetura de RAG. Leia a proposta e o contexto, identifique os problemas, e proponha alternativas.

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
> "Vamos usar Azure AI Search com embeddings do ada-002. Todos os documentos serão indexados num único índice. Chunking fixo de 512 tokens sem overlap. O LLM recebe os 3 chunks mais similares. Usaremos GPT-4o para geração. O pipeline de ingestão roda manualmente quando alguém lembra de atualizar."

**Tarefa:**
1. Identifique todos os problemas e riscos desta proposta, específicos para este cenário.
2. Para cada problema, proponha uma alternativa com justificativa.
3. Classifique cada problema por severidade (Crítico / Alto / Médio).
4. Indique quais problemas são específicos a este cenário e quais são universais.

### Resposta do Claude

# Revisão Técnica — Proposta de RAG NovaTech

---

## Problemas Identificados, Alternativas e Severidades

---

### Problema 1 — Pipeline de ingestão manual
**Severidade: Crítico**

O pipeline "roda quando alguém lembra" é incompatível com uma base de documentação mantida por três áreas distintas (SharePoint, Confluence, planilhas), cada uma com ciclos de atualização próprios. A base inclui documentos com contradições já conhecidas (PROC-042 v1 e v2) — sem atualização automatizada, o índice pode conter versões desatualizadas indefinidamente sem que ninguém saiba. Com 45 atendentes respondendo 320 chamados/dia com base em informação potencialmente obsoleta, a primeira falha crítica será uma questão de tempo, não de probabilidade.

O problema se agrava no pós go-live: o time de TI da NovaTech não tem experiência em MLOps e dificilmente executará um processo manual com disciplina.

**Alternativa:** Pipeline de ingestão automatizado com gatilhos baseados em eventos. Para o SharePoint e Confluence, configurar webhooks ou polling periódico (ex: Azure Data Factory com trigger de 24h) que detecta documentos criados ou modificados e os reenvia para indexação incremental. Para planilhas, monitorar hash do arquivo. O pipeline deve gerar log de cada execução com status, documento processado e timestamp.

---

### Problema 2 — Chunking fixo de 512 tokens sem overlap em documentos estruturados
**Severidade: Crítico**

Tabelas de frete com 15+ colunas têm cabeçalho de coluna e valores em linhas separadas. Um corte em 512 tokens pode separar os cabeçalhos da primeira metade dos valores. O chunk que contém os valores sem cabeçalho é semanticamente ininteligível — o embedding captura texto numérico sem contexto de qual coluna pertence. Resultado: retrieval recupera um chunk com números, o LLM inventa qual coluna corresponde a qual valor.

Sem overlap: quando uma informação relevante está nos últimos 50 tokens do chunk N e nos primeiros 50 do chunk N+1, essa informação nunca é recuperada inteira.

**Alternativa:** Extração estruturada com Azure Document Intelligence que preserva relação cabeçalho-linha. Serializar tabelas como JSON ou Markdown antes de chunkar. Chunking semântico (por seção/parágrafo) com overlap de 10–15% para todos os tipos de documento.

---

### Problema 3 — Documentos contraditórios sem tratamento (PROC-042 v1 e v2)
**Severidade: Crítico**

Os dois documentos coexistem no índice com multiplicadores regionais diferentes e sem marcação de vigência. Quando um atendente perguntar sobre multiplicador de frete regional, o retriever pode retornar chunks de ambos — e o LLM, sem instrução explícita, escolherá um ou tentará reconciliar inventando uma média. Com 320 chamados/dia, essa situação ocorrerá repetidamente antes de ser detectada.

**Alternativa:** Resolver na ingestão. Documentos com mesmo identificador base recebem metadado `version` e `is_superseded`. A versão mais recente é marcada como canônica; a v1 recebe flag `deprecated`. O sistema prompt instrui o modelo a priorizar canônicos e apresentar ambas as versões com datas quando houver conflito.

---

### Problema 4 — Índice único sem separação por tipo de documento
**Severidade: Alto**

Planilhas serializam como texto tabular — o embedding captura similaridade léxica, não semântica. Uma planilha de tabela de frete para o Amazonas pode ter score alto para a query "política de devolução no Norte" por compartilhar termos geográficos.

O Confluence tem problema adicional: macros customizadas geram texto lixo (`{jira:KEY-123}`, `{children}`) que polui o embedding do chunk.

**Alternativa:** Índices separados por tipo de fonte ou ao menos por domínio. Pipeline de retrieval faz fan-out e reranqueia resultados antes de passar ao LLM. Para Confluence, pré-processamento obrigatório que strip macros antes de chunkar.

---

### Problema 5 — Top-3 chunks insuficiente para perguntas multi-domínio
**Severidade: Alto**

Perguntas de atendentes frequentemente cruzam domínios: "qual o prazo de entrega para cliente Gold com carga de 800kg para Manaus?" exige SLA do tier Gold + tabela de frete por peso + multiplicador regional — três documentos distintos. Com top-3, o retriever provavelmente descarta um dos três.

**Alternativa:** Aumentar para top-5 ou top-7, combinado com reranker (Azure AI Search semantic ranker ou Cohere Rerank). O budget de contexto (128K do GPT-4o) suporta facilmente top-7 para este caso de uso.

---

### Problema 6 — PDFs escaneados sem OCR (~15% da base)
**Severidade: Alto**

Sem OCR, ~120 PDFs são indexados como imagens sem texto — o documento nunca será recuperado por nenhuma query relevante. O time não saberá que esses documentos estão ausentes do índice até que um atendente reporte que "o assistente não sabe nada sobre [procedimento X]".

**Alternativa:** Azure Document Intelligence (Form Recognizer) para OCR obrigatório no pipeline. Validação de qualidade: documentos com confiança OCR abaixo de 80% são sinalizados para revisão manual.

---

### Problema 7 — Ausência de monitoramento e feedback loop
**Severidade: Médio**

Sem logging de queries, chunks recuperados e avaliação de qualidade, o time de TI não tem como detectar respostas incorretas sistematicamente, auditar um chamado específico ou identificar gaps na base de conhecimento.

**Alternativa:** Logging estruturado de cada interação: query, chunks recuperados (IDs e scores), resposta gerada, feedback do atendente (thumbs up/down). Application Insights no Azure já está disponível no stack do cliente.

---

## Classificação Final

| # | Problema | Severidade | Específico deste cenário? |
|---|---|---|---|
| 1 | Pipeline de ingestão manual | Crítico | Específico — base multi-fonte com TI sem MLOps |
| 2 | Chunking fixo sem overlap em documentos estruturados | Crítico | Específico — tabelas 15+ colunas e PDFs escaneados |
| 3 | Documentos contraditórios sem tratamento (PROC-042) | Crítico | Específico — contradição já conhecida e não resolvida |
| 4 | Índice único sem separação por tipo | Alto | Parcialmente específico — macros Confluence e planilhas agravam |
| 5 | Top-3 insuficiente para queries multi-domínio | Alto | Parcialmente específico — domínio logístico gera queries cruzadas |
| 6 | PDFs escaneados sem OCR | Alto | Específico — 15% da base é escaneada |
| 7 | Ausência de logging e feedback loop | Médio | Universal, agravado pelo TI sem MLOps |

---

## Etapa 3 — Comparação e Proposta Reescrita

### Prompt enviado

Agora preciso consolidar as revisões e reescrever a proposta.

**Minha revisão independente (feita antes de consultar você) identificou estes problemas:**

1. **Pipeline de ingestão manual:** o processo de atualização depende de alguém lembrar de rodar — não há automação. Em um ambiente com documentação atualizada mensalmente por 3 áreas diferentes, isso garante que o índice ficará desatualizado regularmente.

2. **LLM recebendo apenas 3 chunks:** para perguntas simples pode ser suficiente, mas perguntas que cruzam múltiplos domínios (ex: prazo de devolução para cliente Gold com carga pesada) exigem chunks de POL-001, SLA-2024 e PROC-042 simultaneamente — com top-3, o retriever provavelmente descarta informação relevante.

3. **Índice único para todos os documentos:** misturar PDFs, wiki e planilhas num único índice sem separação por tipo ou domínio prejudica a precisão do retrieval — um chunk de planilha de frete pode ser recuperado para uma pergunta sobre política de devolução por similaridade superficial.

4. **Chunking fixo de 512 tokens sem overlap:** cortes fixos ignoram a estrutura dos documentos — uma tabela de multiplicadores regionais pode ser cortada no meio, separando cabeçalho dos valores. Sem overlap, contexto que atravessa a fronteira entre chunks é perdido para sempre.

Com base nas duas revisões, faça:
1. Comparação honesta entre as listas.
2. Lista consolidada final ordenada por severidade.
3. Proposta reescrita no mesmo formato narrativo da original, concreta e acionável.

### Resposta do Claude

# Comparação e Proposta Reescrita

---

## 1. Comparação Honesta entre as Revisões

### Da minha lista (Claude) — você também identificou?

| Problema (Claude) | Sua revisão (Etapa 1) | Avaliação |
|---|---|---|
| 1. Pipeline de ingestão manual | Sim — identificou o problema e propôs trigger por evento | **Total** — diagnóstico e solução equivalentes |
| 2. Chunking fixo sem overlap | Sim — mencionou corte de tabelas e overlap de 10% | **Parcial** — você identificou o problema geral; não mencionou especificamente o risco de tabelas 15+ colunas terem cabeçalho separado dos valores, nem o problema de PDFs escaneados que está ligado ao chunking |
| 3. Documentos contraditórios PROC-042 | **Não identificou** | **Ausente** — este é o problema mais específico e perigoso do cenário; estava nos fatos do contexto mas não apareceu na sua lista |
| 4. Índice único sem separação | Sim — mencionou retrieval impreciso com índices separados | **Parcial** — identificou o efeito, mas não mencionou o problema específico das macros do Confluence nem a serialização problemática de planilhas |
| 5. Top-3 insuficiente | Sim — citou o exemplo de POL-001 + SLA-2024 + PROC-042 simultaneamente | **Total** — diagnóstico idêntico, exemplo concreto melhor que o meu |
| 6. PDFs escaneados sem OCR | **Não identificou** | **Ausente** — estava nos fatos do contexto (15% escaneados); impacto direto: ~120 documentos nunca serão recuperados |
| 7. Ausência de logging | **Não identificou** | **Ausente** — problema universal, mas agravado pelo TI sem MLOps |

### Da sua lista (Etapa 1) — eu também identifiquei?

| Problema (sua lista) | Minha revisão | Avaliação |
|---|---|---|
| 1. Pipeline manual | Sim — Problema 1, mesma severidade crítica | **Total** |
| 2. Top-3 insuficiente | Sim — Problema 5 | **Total** |
| 3. Índice único | Sim — Problema 4 | **Parcial** — minha análise foi mais detalhada nas causas |
| 4. Chunking fixo sem overlap | Sim — Problema 2 | **Parcial** — minha análise expandiu para tabelas e OCR |

**Resumo direto:** você acertou os 4 problemas mais visíveis da proposta. Ficaram de fora 3 problemas que estavam explicitamente nos fatos do contexto: a contradição PROC-042 (o mais crítico para respostas incorretas), os PDFs escaneados (15% da base efetivamente ausente do índice), e a ausência de monitoramento.

---

## 2. Lista Consolidada Final

| # | Problema | Severidade | Origem |
|---|---|---|---|
| 1 | Documentos contraditórios PROC-042 v1/v2 sem tratamento | Crítico | Claude |
| 2 | Pipeline de ingestão manual | Crítico | Ambos |
| 3 | Chunking fixo sem overlap + tabelas estruturadas sem parsing | Crítico | Ambos (Claude expandiu) |
| 4 | PDFs escaneados sem OCR (~120 documentos ausentes do índice) | Alto | Claude |
| 5 | Índice único sem separação por tipo/domínio | Alto | Ambos (Claude expandiu) |
| 6 | Top-3 chunks insuficiente para queries multi-domínio | Alto | Ambos |
| 7 | Ausência de logging e feedback loop | Médio | Claude |

---

## 3. Proposta Reescrita

> "Vamos usar Azure AI Search com embeddings do text-embedding-3-large (ada-002 está em processo de descontinuação e o substituto oferece melhor qualidade sem custo adicional relevante para este volume). A base será organizada em três índices separados: procedimentos e políticas (PDFs do SharePoint), wiki operacional (Confluence) e tabelas de referência (planilhas XLSX) — isso evita que chunks de planilhas de frete contaminem queries sobre políticas.
>
> O pipeline de ingestão roda automaticamente via Azure Data Factory: polling de 24 horas no SharePoint e Confluence detecta documentos criados ou modificados e os reenvia para indexação incremental; planilhas são monitoradas por hash de arquivo. Antes da indexação, todos os PDFs passam pelo Azure Document Intelligence — os ~15% escaneados recebem OCR com validação de confiança mínima de 80%; tabelas de frete são extraídas com preservação de cabeçalho e serializadas em Markdown antes de chunkar, para que nenhum valor seja indexado sem o contexto da coluna a que pertence.
>
> O chunking segue estrutura semântica (por seção ou parágrafo) com overlap de 15% (~75 tokens), em vez de corte fixo por token. Documentos com o mesmo identificador base (ex: PROC-042) recebem metadado de versão e flag `is_superseded` — a versão mais recente é marcada como canônica; versões anteriores são mantidas no índice mas sinalizadas como obsoletas. O sistema prompt instrui o modelo a priorizar documentos canônicos e apresentar ambas as versões com datas de emissão quando houver conflito entre chunks recuperados.
>
> O retrieval recupera os top-5 chunks por índice relevante (reranqueados pelo Azure AI Search semantic ranker antes de passar ao modelo), o que garante cobertura de queries que cruzam SLAs, procedimentos e tabelas regionais simultaneamente. Usaremos GPT-4o para geração — já está disponível no Azure AI Services provisionado pelo cliente e a janela de 128K acomoda os chunks recuperados mais o histórico de sessão sem risco de overflow para este caso de uso.
>
> Toda interação é logada no Application Insights (já disponível no stack): query do atendente, IDs e scores dos chunks recuperados, resposta gerada e feedback opcional (positivo/negativo). Isso permite ao TI da NovaTech detectar respostas sem citação de fonte, identificar documentos nunca recuperados e auditar qualquer chamado específico — sem necessidade de MLOps dedicado."
