# Prompt — Tech Lead | Exercício 1.1 — ADRs Arquiteturais

> **Como usar:** Cole este documento inteiro numa conversa nova com o Claude.
> Após receber os 4 ADRs, siga as instruções de devil's advocate no final.

---

## Contexto do Projeto

Você atua como consultor sênior de arquitetura auxiliando o Tech Lead de um projeto da DB1 para a NovaTech.

A NovaTech é uma empresa de médio porte do setor de logística com 1.200 funcionários. Sua documentação interna está espalhada em três fontes:

| Fonte | Qtde | Formato | Atualização | Responsável |
|-------|------|---------|-------------|-------------|
| SharePoint | ~800 docs | PDF, DOCX | Mensal | Operações, Compliance |
| Confluence | ~400 páginas | HTML/Wiki | Semanal | TI, Comercial |
| Pasta de rede | ~50 planilhas | XLSX | Mensal | Comercial |

**Problema:** A equipe de atendimento (45 pessoas) gasta em média 12 minutos por chamado buscando informações. Volume: 320 chamados/dia, dos quais ~60% envolvem consulta a documentação.

**Solução contratada:** Assistente de IA com RAG integrado ao Microsoft Teams + SharePoint. A NovaTech já possui licenças Microsoft 365 E3 e está disposta a provisionar Azure AI Services.

**Meta da diretoria:** Reduzir o tempo médio de busca de 12 para menos de 2 minutos por chamado. Prazo: 3 meses (discovery + desenvolvimento + go-live).

---

## Insumos Técnicos

### Análise do Desenvolvedor (simulada)

- Base estimada em ~12M tokens totais
- PDFs com tabelas complexas (tabelas de frete com 15+ colunas) são o maior desafio de extração
- ~15% dos documentos são escaneados e precisarão de OCR
- Documentos contraditórios identificados em ao menos 3 procedimentos — o caso mais crítico é o PROC-042 vs PROC-042-v2: mesma numeração, multiplicadores regionais diferentes, sem indicação formal de qual está vigente. Exemplo: multiplicador Norte é 1.6 no v1 e 1.8 no v2
- Recomendação: chunking por seção com overlap de 10%

### Requisitos do Product Specialist (simulados)

1. Respostas devem sempre citar a fonte do documento
2. Documentos contraditórios devem mostrar ambas as versões com indicação de data
3. Atualização máxima de 24h após publicação de novo documento
4. O assistente nunca deve inventar informações — quando não encontrar, deve dizer explicitamente
5. O bot será usado no Teams, onde o atendente pode fazer múltiplas perguntas na mesma sessão

---

## Formato obrigatório de ADR

```
# ADR-NNNN: [Título da Decisão]

## Status
[Proposto / Aceito / Depreciado]

## Contexto
[Qual problema estamos resolvendo? Que forças atuam? Quais são as restrições?]

## Decisão
[O que decidimos fazer? Seja específico.]

## Consequências
### Positivas
- ...
### Negativas / Trade-offs
- ...

## Alternativas consideradas
| Alternativa | Por que descartada |
|-------------|-------------------|
| ... | ... |
```

---

## Tarefa

Produza os 4 ADRs abaixo, um de cada vez, usando o formato acima. Seja específico e fundamentado em trade-offs reais — não em preferência de tecnologia. Considere os insumos técnicos e os requisitos de produto fornecidos acima.

---

### ADR-0001 — Escolha do Modelo de LLM

**Decisão a documentar:** Qual LLM usar para geração de respostas — Azure OpenAI (GPT-4o), Claude via API (Anthropic), ou modelo open-source local via Ollama.

**Considere obrigatoriamente:**
- Custo por token para o volume estimado: 320 chamados/dia × 60% com consulta = ~192 queries/dia. Estime o custo mensal considerando ~2.000 tokens por query (prompt + resposta) para cada opção
- Janela de contexto necessária dado que o system prompt + chunks + histórico de conversa podem somar entre 8K e 32K tokens
- O requisito de não alucinar e o impacto das diferentes arquiteturas de modelo nisso
- Integração com o stack Azure que a NovaTech já possui (Teams, SharePoint, Azure AI Services)
- Soberania de dados: os documentos da NovaTech contêm informações operacionais sensíveis

---

### ADR-0002 — Estratégia de Gerenciamento de Contexto

**Decisão a documentar:** Como o pipeline monta e gerencia o contexto enviado ao LLM a cada query.

**Considere obrigatoriamente:**
- Definir o orçamento de contexto por query: dado que o modelo escolhido tem uma janela de contexto, quanto é reservado para system prompt, metadados do cliente, chunks recuperados, histórico de conversa e a pergunta em si?
- Número de chunks recuperados por query e o critério de corte (top-K fixo, threshold de similaridade, ou combinação)
- Estratégia para perguntas multi-domínio: uma pergunta como "qual o prazo de devolução para um cliente Gold com carga acima de 500kg?" cruza POL-001 (devolução), SLA-2024 (tier do cliente) e PROC-042 (frete especial) — como garantir que os chunks certos de todas as fontes sejam recuperados?
- Context rot no Teams: o bot pode acumular 5-10 turnos de conversa na mesma sessão. Após 4-5 perguntas, o histórico começa a competir com os chunks recuperados pelo orçamento de atenção. Como lidar?

---

### ADR-0003 — Tratamento de Documentos Contraditórios

**Decisão a documentar:** Como o pipeline deve tratar duas versões de um mesmo procedimento sem indicação clara de qual está vigente.

**Caso concreto a endereçar:** PROC-042 (v1, emitido em 03/03/2023) e PROC-042-v2 (emitido em 10/11/2023) coexistem no SharePoint. Os multiplicadores regionais são diferentes (ex: Norte = 1.6 no v1, 1.8 no v2). O v2 tem uma seção de "disposições transitórias" que fala em 01/12/2023, mas não há marcação formal de obsolescência no v1.

**Avalie estas três abordagens:**
1. **Manter apenas o mais recente:** indexar só o PROC-042-v2 e descartar o v1
2. **Manter ambos com metadado de vigência:** indexar os dois, marcando data de emissão, e instruir o modelo a priorizar o mais recente — mas mostrar ambos ao atendente quando houver conflito
3. **Delegar ao LLM:** indexar os dois sem tratamento especial e incluir instrução no system prompt para o modelo identificar e sinalizar contradições na resposta

---

### ADR-0004 — Build vs Buy para o Pipeline de RAG

**Decisão a documentar:** Construir o pipeline com ferramentas open-source (LangChain/LlamaIndex + ChromaDB/FAISS) ou usar a stack managed da Azure (Azure AI Search + Azure OpenAI integrado).

**Considere obrigatoriamente:**
- A NovaTech já tem licenças Microsoft 365 E3 e está disposta a provisionar Azure AI Services — isso muda o TCO de cada opção
- Complexidade operacional: quem vai manter o pipeline em produção após o go-live? A NovaTech tem time de TI interno, mas sem experiência em MLOps
- Flexibilidade de chunking: Azure AI Search tem chunking nativo, mas com customização limitada. O desafio das tabelas complexas e documentos escaneados pode exigir pré-processamento customizado
- Tempo de go-live: o projeto tem 3 meses. Quanto da solução managed já está pronta para uso vs quanto precisaria ser construído no caminho open-source?
- Lock-in: se a NovaTech quiser migrar de provedor no futuro, qual o custo de cada opção?

Escreva um arquivo chamado resolucao1-1.md com a resolução

---

## Devil's Advocate (fazer após receber os 4 ADRs)

Após receber os 4 ADRs, envie este prompt numa mensagem separada:

---

**Prompt de Devil's Advocate:**

> Agora quero que você atue como devil's advocate para as ADR-0002 e ADR-0003.
>
> Para cada uma:
> 1. Argumente **contra** a decisão tomada — assuma que ela está errada e construa o melhor argumento possível para refutá-la
> 2. Identifique o cenário realista em que essa decisão seria um erro grave
> 3. Proponha uma condição ou critério que, se verdadeiro, invalidaria a decisão
>
> Não busque equilíbrio — seja adversarial. O objetivo é encontrar os pontos fracos antes que o projeto encontre em produção.

---

Após receber os contra-argumentos, revise as ADRs que precisarem e documente o que mudou e por quê.
Atualize o arquivo chamado resolucao1-1.md com o que foi pedido