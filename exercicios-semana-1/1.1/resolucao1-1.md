# Resolução — Prática 1.1: ADRs para Assistente RAG NovaTech

---

# ADR-0001: Escolha do Modelo de LLM

## Status
Proposto

## Contexto

O assistente de IA da NovaTech precisará responder ~192 queries/dia (320 chamados × 60%), com janela de contexto variando entre 8K e 32K tokens por query (system prompt + chunks recuperados + histórico de conversa no Teams).

**Estimativa de custo mensal por opção** (192 queries/dia × 30 dias = 5.760 queries/mês; 2.000 tokens médios por query = ~11,5M tokens/mês):

| Modelo | Input ($/1M tokens) | Output ($/1M tokens) | Custo estimado/mês* |
|--------|--------------------|--------------------|-------------------|
| Azure OpenAI GPT-4o | $2,50 | $10,00 | ~$55–$90 |
| Claude 3.5 Sonnet (API) | $3,00 | $15,00 | ~$65–$110 |
| Ollama (Llama 3 70B) | $0 (infra local) | $0 (infra local) | $200–$600 (infra Azure VM) |

*Estimativa com proporção 70% input / 30% output. Valores de referência maio/2026.

Restrições relevantes:
- NovaTech já possui licenças Microsoft 365 E3 e está disposta a provisionar Azure AI Services.
- Os documentos contêm informações operacionais sensíveis (tabelas de frete, multiplicadores regionais, SLAs por cliente).
- O requisito de não alucinação é crítico — o assistente nunca deve inventar informações.
- Sessões multi-turno no Teams podem acumular 5–10 trocas, pressionando a janela de contexto.

## Decisão

Adotar **Azure OpenAI GPT-4o** como modelo de geração de respostas, hospedado dentro da infraestrutura Azure da NovaTech via recurso Azure OpenAI Service.

Especificações:
- Deployment regional: Brazil South ou East US 2 (menor latência para usuários no Brasil).
- Janela de contexto: 128K tokens — suficiente para system prompt (~2K) + metadados (~1K) + até 10 chunks de 800 tokens (~8K) + histórico de 5 turnos (~5K) + pergunta (~500), com folga para crescimento.
- Versão: GPT-4o (2024-11-20 ou mais recente disponível no Azure).

## Consequências

### Positivas
- **Soberania de dados garantida**: com Azure OpenAI, os dados trafegam dentro do tenant Azure da NovaTech — Microsoft garante por contrato que os dados não são usados para treinar modelos globais.
- **Integração nativa com o stack existente**: Azure OpenAI se conecta diretamente ao Azure AI Search, Azure Bot Service (Teams) e Managed Identity, sem necessidade de bridges externas.
- **Custo operacional previsível e baixo**: ~$55–$90/mês para o volume atual é insignificante frente ao custo do time de atendimento. Escala proporcionalmente ao uso.
- **Janela de contexto larga (128K)**: elimina o risco de truncamento mesmo nos casos mais pesados de contexto multi-turno.
- **Qualidade de raciocínio sobre dados tabulares**: GPT-4o demonstra desempenho superior na interpretação de tabelas complexas — relevante para as tabelas de frete com 15+ colunas.
- **SLA e suporte gerenciados pela Microsoft**: compatível com o nível de maturidade operacional da NovaTech.

### Negativas / Trade-offs
- **Lock-in parcial com Azure/Microsoft**: migrar para outro provedor no futuro exige refatoração do cliente de API, mas o impacto é limitado se os prompts e a lógica de RAG forem desacoplados do SDK.
- **Custo pode escalar**: se o volume de chamados crescer 5× ou se chunks maiores forem necessários, o custo pode atingir $400–$500/mês — ainda baixo, mas deve ser monitorado.
- **Latência de resposta**: GPT-4o pode ter latência de 3–8s por resposta com contexto longo, o que é aceitável frente ao baseline de 12 minutos, mas deve ser comunicado aos atendentes.

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| **Claude 3.5 Sonnet (Anthropic API direta)** | Custo ligeiramente maior; dados trafegam fora do ambiente Azure, criando risco de compliance com a política de soberania de dados da NovaTech. A API da Anthropic não possui a mesma cobertura de certificações de residência de dados no Brasil. |
| **Ollama (Llama 3 70B local)** | Requer VM de alta capacidade (A100/H100 ou múltiplas T4) com custo de infra de $200–$600/mês sem garantia de qualidade equivalente. Exige capacidade de MLOps para manutenção do modelo, atualização e monitoramento — que a NovaTech não possui. Risco alto para prazo de 3 meses. |
| **GPT-4o-mini** | Custo menor (~$0,15/1M input tokens), mas desempenho inferior em raciocínio sobre tabelas complexas e em seguir instruções de não-alucinação de forma consistente. O delta de custo não justifica o risco em um domínio com dados financeiros sensíveis. |

---

# ADR-0002: Estratégia de Gerenciamento de Contexto

## Status
Aceito (Revisado — ver Revisão Adversarial abaixo)

## Contexto

Cada query enviada ao LLM é composta por múltiplos blocos que competem pelo orçamento de tokens da janela de contexto:

- **System prompt**: instruções de comportamento, regras de não-alucinação, formato de resposta com citação de fonte.
- **Metadados do atendente**: nome, equipe, turno (relevante para personalização futura).
- **Chunks recuperados**: trechos dos documentos indexados pelo Azure AI Search.
- **Histórico de conversa**: turnos anteriores da sessão no Teams.
- **Pergunta atual**.

A janela do GPT-4o é de 128K tokens, mas isso não significa que todos os tokens têm o mesmo "peso de atenção" na prática — contextos muito longos degradam a qualidade da resposta nos trechos intermediários (fenômeno "lost in the middle").

Dois desafios específicos precisam ser endereçados:

1. **Perguntas multi-domínio**: uma pergunta como *"qual o prazo de devolução para cliente Gold com carga acima de 500kg?"* cruza POL-001 (política de devolução), SLA-2024 (tier do cliente) e PROC-042 (frete especial). Um retrieval simples por similaridade semântica pode retornar apenas chunks de um dos documentos.

2. **Context rot**: após 4–5 turnos de conversa no Teams, o histórico acumulado começa a ocupar espaço que seria melhor usado pelos chunks recuperados. Com 5 turnos de ~1.000 tokens cada, o histórico já consome 5K tokens — equivalente a 6 chunks de 800 tokens.

---

## Revisão Adversarial

### Argumento contra a decisão original

**1. O orçamento fixo de 12K é uma capinha de precisão sobre uma decisão arbitrária.**

O argumento "lost in the middle" que justifica limitar a 12K de uma janela de 128K foi documentado em modelos anteriores ao GPT-4o. A Microsoft documentou melhorias específicas de atenção em contextos longos para o GPT-4o. Ao fixar arbitrariamente em 12K, a arquitetura descarta sistematicamente chunks potencialmente relevantes — não porque o modelo não consegue processá-los, mas por precaução não validada para o modelo escolhido. O efeito prático: uma pergunta que exige 12 chunks para ser respondida corretamente vai receber uma resposta parcialmente errada com aparência de confiança, porque o modelo não sabe o que foi descartado pelo pipeline antes dele.

**2. A compressão progressiva do histórico introduz alucinação por omissão invisível.**

O atendente acredita estar em uma conversa contínua, mas a partir do 4º turno o modelo está respondendo a um resumo lossy do que foi dito. Em logística com valores numéricos precisos, um único qualificador perdido na compressão — "carga temperatura-controlada", "contrato firmado antes de 2022", "cliente com aditivo regional" — gera uma resposta tecnicamente coerente, mas factualmente errada para aquele caso específico. Não existe sinalização visível de que a compressão ocorreu. O atendente não tem como saber que o contexto foi truncado.

**3. A query decomposition como projetada assume classificação perfeita de intenção.**

O pipeline só decompõe se o GPT-4o-mini classifica a query como "multi-domínio". Perguntas ambíguas — "qual o valor máximo para esse tipo de carga?" — podem ou não ser classificadas como multi-domínio dependendo da sessão. Quando a classificação falha para uma query que de fato precisa de múltiplos documentos, o retrieval retorna chunks de apenas uma fonte e o modelo responde com convicção sobre informação incompleta, sem qualquer aviso.

### Cenário realista de erro grave

Um atendente está resolvendo uma disputa de frete. Nos turnos 1–3, estabelece-se que a carga é temperatura-controlada, 800 kg, cliente Platinum, destino Norte. No turno 4, a compressão dispara. O resumo gerado registra "frete região Norte" mas perde "temperatura-controlada" e "cliente Platinum" — qualificadores que ativam tabelas de exceção no PROC-042. No turno 5, o atendente pergunta "qual o multiplicador para esse tipo de carga?" O modelo, sem os qualificadores no contexto, aplica o multiplicador padrão Norte (1.8) em vez do multiplicador de exceção para temperatura-controlada Platinum (2.1). O atendente usa o valor. O cliente é cobrado a menos. O erro não é rastreável no sistema porque a compressão não foi logada com o histórico original.

### Condição que invalida a decisão

Se monitoramento pós-launch demonstrar que mais de 5% das conversas com 5+ turnos têm uma resposta que ignora ou contradiz um detalhe factual estabelecido nos turnos 1–3 (detectável via auditoria amostral com LLM-judge), a compressão está causando erros sistemáticos e o orçamento fixo de histórico deve ser abandonado em favor de uma estratégia de seleção de turnos por relevância semântica.

---

## Decisão (Revisada)

Adotar **orçamento de contexto adaptativo por tipo de query**, com retrieval híbrido, compressão de histórico auditável e indicador de estado de sessão visível ao atendente.

### Orçamento de contexto por camada (adaptativo)

| Camada | Query simples | Query multi-domínio | Observação |
|--------|--------------|--------------------|----|
| System prompt | 2.000 | 2.000 | Fixo |
| Metadados do atendente | 500 | 500 | Fixo |
| Pergunta atual | 500 | 500 | Fixo |
| Chunks recuperados | 6.000 (~7–8 chunks) | 12.000 (~14–15 chunks) | Expande quando multi-domínio detectado |
| Histórico de conversa | 3.000 | 3.000 | Comprimido progressivamente |
| **Total de input** | **~12.000** | **~18.000** | Ambos dentro da janela de 128K |
| Resposta gerada | até 2.000 | até 2.000 | Controlado por `max_tokens` |

A detecção de multi-domínio pela query decomposition, quando positiva, expande automaticamente o orçamento de chunks de 6K para 12K. Isso endereça o principal ponto de falha identificado: queries complexas não serão mais truncadas para o mesmo orçamento de queries simples.

O limite de 18K para queries multi-domínio é conservador frente à janela de 128K, mas validado como ponto ótimo de latência/cobertura — P95 de latência esperado: 5–9s, aceitável frente ao baseline de 12 minutos.

### Retrieval híbrido para perguntas multi-domínio

O Azure AI Search será configurado com **retrieval híbrido** combinando:

- **Busca vetorial** (embeddings text-embedding-3-large): captura semântica da intenção.
- **Busca BM25 (keyword)**: captura termos exatos como "PROC-042", "cliente Gold", "500kg".

O pipeline executará **query decomposition** antes do retrieval via GPT-4o-mini. A classificação multi-domínio aciona tanto a expansão do orçamento de chunks quanto o retrieval paralelo por sub-query.

Critério de corte: **top-K dinâmico com threshold de score**. Recuperar até 15 chunks com score ≥ 0.75, truncar para o orçamento disponível (7–8 para simples, 14–15 para multi-domínio), priorizando maior score.

### Compressão auditável do histórico (context rot)

A partir do 4º turno de conversa, o pipeline aplica **compressão de histórico com auditabilidade obrigatória**:

- Turnos 1–3: mantidos integrais no contexto.
- Turnos 4+: substituídos por resumo gerado via GPT-4o-mini.
- O resumo **preserva obrigatoriamente** todos os valores numéricos, identificadores de documentos e qualificadores de tipo de carga/cliente mencionados nos turnos comprimidos — o prompt de compressão instrui explicitamente a não omitir esses elementos.
- O histórico **completo** é armazenado no Azure Cache for Redis com TTL de 24h, referenciado por session ID — disponível para auditoria pós-incidente.
- Cada compressão gera um log estruturado no Azure Monitor: `{session_id, turn_compressed, hash_before, hash_after, timestamp}`.
- Tamanho máximo do histórico comprimido: 3.000 tokens.

**Visibilidade ao atendente**: quando a compressão estiver ativa, o Teams card exibe um indicador discreto — "Resumo de conversa ativo (X turnos anteriores)" — com link para reiniciar a sessão se necessário. Isso elimina a invisibilidade identificada como risco.

## Consequências

### Positivas
- Queries multi-domínio recebem orçamento adequado (12K de chunks vs 6K), reduzindo respostas parcialmente incorretas por truncamento.
- Compressão auditável: cada incidente pós-launch pode ser investigado com o histórico original, identificando se a compressão causou ou não o erro.
- Visibilidade ao atendente sobre estado da sessão, eliminando a ilusão de continuidade irrestrita.
- Orçamento adaptativo endereça o cenário de falha grave identificado sem adicionar complexidade desnecessária para queries simples.

### Negativas / Trade-offs
- **Latência P95 maior para multi-domínio**: 5–9s vs 3–5s original. Deve ser comunicado ao time de atendimento e monitorado com alertas se P95 > 10s.
- **Complexidade de implementação aumentada**: orçamento adaptativo + prompt de compressão com preservação de numéricos + logging estruturado adicionam ~1 sprint ao estimado anteriormente.
- **Custo marginal do logging**: Azure Monitor + Redis têm custo adicional estimado de ~$15–25/mês. Negligenciável frente ao risco mitigado.
- **Risco residual na classificação multi-domínio**: se GPT-4o-mini falhar em classificar uma query complexa como multi-domínio, o orçamento não expande. Mitigação: logar queries classificadas como simples que retornaram score de chunks < 0.75 para revisão periódica do threshold de classificação.

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| **Top-K fixo sem threshold** | Recupera chunks irrelevantes quando a base tem documentos com baixa similaridade, aumentando ruído no contexto. |
| **Janela deslizante de histórico (manter últimos N turnos)** | Mais simples, mas perde contexto crítico se o usuário referenciar informações de turnos mais antigos ("como falei antes…"). A compressão auditável preserva a semântica com rastreabilidade. |
| **Sem query decomposition (retrieval simples)** | Adequado para MVP, mas o requisito de perguntas multi-domínio é explícito nos casos de uso da NovaTech. |
| **Orçamento fixo de 12K para todos os casos** | Abordagem original — descartada após análise adversarial demonstrar que queries multi-domínio com 3 fontes distintas exigem mais de 7–8 chunks para cobertura adequada. |

---

# ADR-0003: Tratamento de Documentos Contraditórios

## Status
Aceito (Revisado — ver Revisão Adversarial abaixo)

## Contexto

O SharePoint da NovaTech contém ao menos 3 procedimentos com versões conflitantes. O caso mais crítico é o PROC-042:

- **PROC-042 v1** (emitido em 03/03/2023): multiplicador regional Norte = 1.6.
- **PROC-042-v2** (emitido em 10/11/2023): multiplicador regional Norte = 1.8; contém seção de "disposições transitórias" com data 01/12/2023.
- Não há marcação formal de obsolescência no v1 no SharePoint.

As implicações são concretas: se um atendente usar o multiplicador errado em um cálculo de frete para a região Norte, a NovaTech pode cobrar 11% a menos (1.6 vs 1.8) ou gerar litígios com o cliente por valor divergente do contrato.

O requisito do Product Specialist é explícito: **documentos contraditórios devem mostrar ambas as versões com indicação de data**.

As três abordagens avaliadas:

1. **Manter apenas o mais recente**: descartar v1, indexar só v2.
2. **Manter ambos com metadado de vigência**: indexar os dois, marcar data de emissão, instruir o modelo a sinalizar conflito.
3. **Delegar ao LLM**: indexar os dois sem tratamento especial, confiar no system prompt para detecção.

---

## Revisão Adversarial

### Argumento contra a decisão original

**1. A curadoria humana obrigatória é um portão de go-live construído sobre comportamento organizacional que você não controla.**

A decisão original estipula que "o responsável deve formalizar em até 5 dias úteis." Isso não é uma decisão de arquitetura — é uma suposição de gestão de projeto disfarçada de requisito técnico. Operações e Compliance em uma empresa de logística de 1.200 funcionários com 320 chamados/dia não vão tratar curadoria de metadados como prioridade porque um projeto de TI solicitou. Quando os 5 dias passarem sem resposta — o que é o cenário mais provável — o que acontece? A ADR original não responde. O resultado mais provável: o conflito continua com `status: active` em ambas as versões, o alerta aparece em toda query que envolve PROC-042, e após duas semanas de ver o mesmo aviso, os atendentes aprendem a ignorá-lo. O mecanismo de proteção se transforma em ruído.

**2. A detecção de conflitos baseada em `document_id` é sintaticamente estreita e não captura o problema real.**

O caso PROC-042 foi detectado porque o ID tem sufixo de versão. Mas a base de conhecimento tem 1.250 documentos. Conflitos semânticos — onde dois documentos tratam do mesmo tema sob IDs diferentes, como uma política de SLA atualizada em um novo documento sem referenciar o anterior — não serão detectados pelo pipeline. O mecanismo indexará as duas versões sem sinalização, o modelo escolherá a de maior score no retrieval, e não haverá nenhum aviso. O sistema protege contra conflitos de versionamento explícito mas é completamente cego a conflitos de conteúdo entre documentos com IDs distintos — que podem ser a maioria dos conflitos reais na base.

**3. O alerta ⚠️ cria responsabilidade sem trilha de auditoria.**

O formato de resposta para conflito não resolvido diz "Consulte [responsável] antes de usar este valor." Isso delega a decisão ao atendente, mas a decisão do atendente não é registrada em lugar nenhum. Um atendente sob pressão de 7+ tickets/hora vai escolher o valor mais recente e fechar o ticket. Seis meses depois, quando Jurídico precisar provar qual multiplicador foi usado em 80 fretes da região Norte entre janeiro e abril, o sistema não tem resposta. O alerta transferiu o risco para o atendente sem criar a infraestrutura necessária para a NovaTech se defender juridicamente.

### Cenário realista de erro grave

Seis meses após o go-live, um cliente da região Norte contesta 80 cobranças de frete, alegando que o multiplicador 1.8 (PROC-042-v2) foi aplicado a fretes cobertos por contratos firmados antes de 01/12/2023, para os quais o multiplicador correto seria 1.6 (PROC-042-v1). Jurídico solicita: "Para cada um dos 80 tickets, qual versão do PROC-042 foi usada?" O sistema exibiu o alerta em todas as queries — mas a resposta do atendente (qual versão ele escolheu usar) não foi capturada. Não há trilha de auditoria. A NovaTech entra na disputa sem evidência documental da decisão tomada em cada caso.

### Condição que invalida a decisão

Se o sistema não for capaz de registrar, para cada ticket em que um conflito foi exibido, qual versão do documento o atendente decidiu utilizar — a mecanismo de alerta não apenas falha em proteger a NovaTech, como cria exposição legal ao documentar que a empresa sabia do conflito e não garantiu a resolução correta. A ADR é inválida como escrita se não há audit trail da decisão do atendente.

---

## Decisão (Revisada)

Adotar a **Abordagem 2 — Manter ambos com metadado de vigência**, com quatro mudanças substantivas em relação à versão original: (1) bloqueio de indexação para conflitos não curados até a data de go-live, (2) escalada automática com timeout hard, (3) audit trail obrigatório da decisão do atendente, e (4) detecção semântica de conflitos como fase evolutiva obrigatória pós-MVP.

### Implementação Revisada

**Fase 1 — Curadoria com bloqueio de indexação (semanas 1–4):**
- Listar todos os documentos com conflito identificado por ID (mínimo 3 confirmados).
- Para cada conflito, o responsável é notificado com prazo de 5 dias úteis.
- **Se o prazo expirar sem resposta:** escalada automática ao gestor da área via Azure Logic Apps. Se após mais 3 dias úteis não houver resolução, o documento conflitante **não é indexado** — o sistema retorna "documento temporariamente indisponível, consulte [responsável]" para queries relevantes. **Nunca servir dois documentos ativos sem curadoria concluída.**
- Para o PROC-042: a "disposições transitórias" com data 01/12/2023 é evidência de que v2 é vigente — propor ao responsável que formalize no mesmo ato.

**Fase 2 — Indexação com metadados enriquecidos:**
```json
{
  "document_id": "PROC-042",
  "version": "v2",
  "issued_date": "2023-11-10",
  "status": "active",
  "supersedes": "PROC-042-v1",
  "source": "SharePoint/Operacoes",
  "curated_by": "joao.silva@novatech.com.br",
  "curated_at": "2024-01-15"
}
```

**Fase 3 — Lógica de resposta com audit trail:**

Para conflitos **resolvidos** (`status: active` + `status: deprecated`): responder com base na versão ativa, exibir nota informativa — não alerta de emergência — indicando que versão anterior existe.

Para conflitos **não resolvidos em produção** (caso de novo documento que chegou após o go-live e aguarda curadoria): o bot **não serve o dado conflitante**. Exibe:
```
Este dado está temporariamente indisponível enquanto uma atualização
do documento é revisada pela área responsável (prazo: DD/MM/AAAA).
Ticket #XXXX foi aberto automaticamente para o responsável.
```

**Audit trail obrigatório — Cards Teams com confirmação:**
Toda resposta que envolva um chunk com `status: deprecated` (versão anterior informativa) exibe um card de confirmação estruturado no Teams:
```
ℹ️ Versão anterior identificada: PROC-042-v1 (03/03/2023) tinha valor diferente.
Versão utilizada nesta resposta: PROC-042-v2 (10/11/2023) — [VIGENTE]
[✓ Confirmar que usei a versão vigente]  [↗ Escalar para responsável]
```
O clique do atendente é registrado no Azure Monitor: `{ticket_id, session_id, document_id, version_used, action, timestamp}`. Este log é a trilha de auditoria jurídica.

**Fase 4 — Monitoramento contínuo + detecção semântica (pós-MVP, obrigatória em 60 dias após go-live):**
- Webhook SharePoint → Azure Function detecta novos documentos com mesmo `document_id` e dispara curadoria imediata.
- **Detecção semântica**: a cada ingestão de novo documento, um job noturno compara os embeddings do novo documento contra os 50 documentos mais próximos no índice. Se similaridade coseno > 0.92 com documento de ID diferente, aciona flag de "possível conflito semântico" para revisão humana. Isso captura conflitos entre documentos com IDs distintos — a lacuna identificada na revisão adversarial.

## Consequências

### Positivas
- **Bloqueio de indexação elimina o cenário de alerta-ruído**: conflitos não curados nunca chegam ao atendente como opção de escolha — ficam fora do índice até resolução formal.
- **Audit trail garante defesa jurídica**: cada ticket onde um dado histórico foi exibido tem um registro estruturado de qual versão foi usada e por quem.
- **Escalada automática reduz dependência de goodwill organizacional**: o responsável recebe notificação, depois o gestor, depois o documento é bloqueado — há consequência clara para inação.
- **Detecção semântica cobre conflitos entre IDs distintos**: a lacuna mais perigosa do mecanismo original é endereçada como requisito obrigatório pós-MVP.

### Negativas / Trade-offs
- **Documentos bloqueados por inação organizacional criam lacunas de conhecimento**: se Operações demorar a curar, os atendentes ficam sem informação de documentos específicos. Mitigação: dashboard de monitoramento de documentos bloqueados visível ao gestor do projeto.
- **Card de confirmação no Teams adiciona um clique por resposta com versão anterior**: pode gerar resistência dos atendentes. Mitigação: card aparece apenas quando há versão anterior com dados diferentes — não em toda resposta.
- **Detecção semântica com threshold 0.92 pode gerar falsos positivos**: documentos legítimos sobre o mesmo tema (ex: FAQ e Procedimento Formal sobre o mesmo processo) podem ser sinalizados. Mitigação: revisão humana da fila de "possível conflito semântico" é leve — basta confirmar ou descartar, não reescrever documentos.

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| **Manter apenas o mais recente (Abordagem 1)** | "Mais recente no SharePoint" ≠ "formalmente vigente". PROC-042-v1 pode ter validade jurídica para contratos anteriores a 01/12/2023. Descarte sem validação jurídica introduz risco legal maior que o conflito original. |
| **Delegar ao LLM sem metadados (Abordagem 3)** | Só funciona se ambos os chunks conflitantes forem recuperados na mesma query — não garantido por retrieval por similaridade. Com um único chunk recuperado, o modelo responde com convicção sobre informação potencialmente obsoleta sem qualquer sinalização. |
| **Alerta ⚠️ sem audit trail (versão original)** | Identificado na revisão adversarial como criador de exposição legal: documenta que a NovaTech sabia do conflito sem garantir que a resolução foi registrada. Descartado em favor do card de confirmação com log estruturado. |

---

# ADR-0004: Build vs Buy para o Pipeline de RAG

## Status
Proposto

## Contexto

O pipeline de RAG precisa cobrir as seguintes responsabilidades:

1. **Ingestão e pré-processamento**: extrair texto de PDF (incluindo PDFs escaneados com OCR), DOCX, HTML/Wiki, XLSX; tratar tabelas complexas com 15+ colunas; detectar e enriquecer metadados de conflito de versões.
2. **Chunking**: dividir documentos em chunks por seção com overlap de 10% (~800 tokens por chunk, conforme recomendação do desenvolvedor).
3. **Indexação vetorial**: gerar embeddings e armazenar em índice vetorial com suporte a retrieval híbrido (vetorial + BM25).
4. **Orquestração de query**: receber a pergunta do Teams, executar retrieval, montar contexto, chamar o LLM, retornar resposta formatada.
5. **Sincronização incremental**: detectar novos documentos no SharePoint, Confluence e pasta de rede em até 24h e re-indexar.

As duas opções principais são:

- **Build (Open-source)**: LangChain ou LlamaIndex como orquestrador; ChromaDB ou FAISS como vector store; Azure Document Intelligence para OCR; pipeline hospedado em Azure Container Apps ou AKS.
- **Buy (Azure managed)**: Azure AI Search (vector + BM25 nativo, chunking nativo, conectores SharePoint/OneDrive gerenciados) + Azure OpenAI integrado + Azure Document Intelligence (OCR).

**Contexto organizacional crítico**: a NovaTech tem time de TI interno sem experiência em MLOps. Após o go-live, a DB1 não estará mais no projeto. O pipeline precisa ser operável pela equipe interna da NovaTech.

**Restrições**: prazo de 3 meses; licenças M365 E3 já pagas; NovaTech disposta a provisionar Azure AI Services.

## Decisão

Adotar a **stack Azure managed (Azure AI Search + Azure OpenAI + Azure Document Intelligence)** como base, com **pré-processamento customizado** para os casos que o managed não cobre adequadamente.

### Arquitetura resultante

```
SharePoint / Confluence / Rede
         ↓
[Azure Function — Trigger de Ingestão]
         ↓
[Azure Document Intelligence] ← OCR de PDFs escaneados
         ↓
[Pré-processador customizado (Python)] ← extração de tabelas complexas,
         |                               enriquecimento de metadados,
         |                               detecção de conflitos
         ↓
[Azure AI Search]
  - Índice vetorial (text-embedding-3-large)
  - Índice BM25
  - Chunking por seção (skill customizada via Azure AI Search Skillset)
         ↓
[Azure OpenAI GPT-4o] ← orquestração via Azure Bot Service / Teams
         ↓
[Microsoft Teams]
```

O pré-processamento customizado (Python) é o único componente "build" — necessário porque o chunking nativo do Azure AI Search não lida adequadamente com tabelas de 15+ colunas nem com a lógica de detecção de conflitos de versão definida no ADR-0003.

O componente customizado roda como Azure Function, mantendo o mesmo modelo operacional managed do restante da stack.

### TCO estimado (mensal, pós go-live)

| Componente | Custo estimado/mês |
|------------|-------------------|
| Azure AI Search (S1 tier) | ~$250 |
| Azure OpenAI GPT-4o | ~$55–$90 |
| Azure Document Intelligence | ~$30 (reprocessamento incremental) |
| Azure Functions (ingestão) | ~$5 |
| Azure Bot Service | Incluso no M365 E3 |
| **Total** | **~$340–$375/mês** |

Comparativo open-source: LangChain + ChromaDB em Azure Container Apps teria custo de infra similar ($200–$300/mês), mas com custo oculto de ~40h/mês de manutenção de engenharia — que a NovaTech não tem como absorver internamente.

## Consequências

### Positivas
- **Operabilidade pós go-live**: Azure AI Search, Azure Functions e Azure Document Intelligence são serviços gerenciados com SLA da Microsoft — o time de TI da NovaTech pode operar sem conhecimento de MLOps. Alertas, scaling e backups são gerenciados pelo provedor.
- **Tempo de go-live acelerado**: os conectores SharePoint/OneDrive do Azure AI Search já estão prontos, eliminando ~3–4 semanas de desenvolvimento de integração. Estimativa: stack managed reduz o desenvolvimento do pipeline em 40–50% comparado ao caminho open-source.
- **Prazo de 3 meses viável**: com a stack managed, a maior parte do esforço de desenvolvimento pode ser concentrada nas partes de valor — pré-processamento de tabelas, lógica de conflito, bot do Teams — em vez de infraestrutura de pipeline.
- **Compliance e segurança**: toda a stack dentro do tenant Azure da NovaTech, com Managed Identity, Azure Key Vault para segredos e logs no Azure Monitor.
- **M365 E3 já pago**: as licenças existentes cobrem parte dos custos de armazenamento e integração SharePoint, reduzindo o TCO incremental.
- **Retrieval híbrido nativo**: Azure AI Search combina vetorial + BM25 sem configuração adicional, alinhado com a decisão do ADR-0002.

### Negativas / Trade-offs
- **Chunking nativo limitado para tabelas complexas**: o Azure AI Search Skillset tem suporte a chunking por parágrafo/sentença, mas não lida nativamente com tabelas de 15+ colunas em PDF. O pré-processador customizado é obrigatório para esse caso — isso representa um componente "build" dentro da estratégia managed.
- **Lock-in com Azure**: migrar para outro provedor (ex: GCP, AWS) no futuro exigiria reescrever os conectores de ingestão e o cliente de busca. Custo estimado de migração: 3–6 meses de engenharia. Mitigação: abstrair a interface do vector store atrás de uma camada de repositório no código do bot, reduzindo o impacto de uma eventual migração.
- **Customização de ranking limitada**: o ranker do Azure AI Search não é tão flexível quanto ChromaDB/FAISS para implementar algoritmos de reranking customizados (ex: Cohere Rerank). Para o volume atual, o retrieval híbrido nativo é suficiente.
- **Custo fixo do S1 (~$250/mês)**: mesmo com volume baixo, o tier S1 é necessário para suportar o tamanho do índice (~12M tokens = ~1.5GB de vetores). O custo não escala com o uso abaixo desse baseline.

## Alternativas consideradas

| Alternativa | Por que descartada |
|-------------|-------------------|
| **LangChain + ChromaDB (full open-source)** | Maior flexibilidade técnica, mas requer capacidade de MLOps para manter ChromaDB em produção, gerenciar versões do LangChain (que tem histórico de breaking changes) e monitorar o pipeline. A NovaTech não tem esse perfil internamente. Risco alto de o sistema se tornar inoperável após o go-live sem suporte contínuo da DB1. |
| **LlamaIndex + FAISS** | FAISS é uma biblioteca, não um serviço — requer que a NovaTech gerencie persistência, backup e escalabilidade do índice vetorial. Mesmo encapsulado em Docker, aumenta significativamente a carga operacional. |
| **Azure AI Search + LangChain como orquestrador** | Híbrido que mantém o vector store managed mas usa LangChain para orquestração. Adiciona dependência de manutenção do LangChain sem ganho proporcional para o caso de uso da NovaTech. Azure Bot Service + Azure OpenAI integration cobre a orquestração com menor complexidade. |

---

# Histórico de Revisões

## Revisão v2 — ADR-0002 e ADR-0003 (devil's advocate)

**Data:** 2026-05-28
**Motivação:** Análise adversarial para identificar pontos de falha antes da produção.

---

### O que mudou na ADR-0002

**Problema identificado:** O orçamento fixo de 12K tokens para chunks era igual para queries simples e multi-domínio. Uma query que precisa de 3 fontes distintas recebe o mesmo orçamento que uma query sobre um único documento — e os chunks excedentes são descartados silenciosamente, sem que o modelo saiba que informação está faltando.

**Problema identificado:** A compressão de histórico era invisível ao atendente e não auditável. Se um qualificador crítico fosse perdido na compressão (ex: "carga temperatura-controlada"), a resposta subsequente seria errada sem nenhum sinal de alerta. Em caso de disputa, não haveria como rastrear se a compressão causou o erro.

**Mudanças aplicadas:**
1. Orçamento de chunks se torna **adaptativo**: 6K para queries simples, 12K para queries classificadas como multi-domínio pela query decomposition.
2. Compressão agora gera **log estruturado** no Azure Monitor com hash do histórico original antes e depois.
3. O histórico completo (antes da compressão) é mantido no Azure Cache for Redis por 24h, disponível para investigação de incidentes.
4. O Teams exibe um **indicador visível** quando o histórico comprimido está ativo, com opção de reiniciar a sessão.

---

### O que mudou na ADR-0003

**Problema identificado:** A curadoria humana "em até 5 dias úteis" não tinha consequência para inação. Na prática, documentos conflitantes poderiam chegar ao go-live sem curadoria, servindo dois `status: active` ao atendente — exatamente o cenário de alerta-ruído que causa fadiga e leva os atendentes a ignorar avisos.

**Problema identificado:** A detecção de conflitos era baseada apenas em correspondência de `document_id`. Conflitos entre documentos com IDs diferentes mas conteúdo sobreposto (ex: política atualizada com novo número) eram completamente invisíveis ao pipeline.

**Problema identificado:** O alerta ⚠️ original delegava a decisão ao atendente sem registrá-la. Em uma auditoria jurídica, não haveria como provar qual versão foi usada em cada ticket — a NovaTech estaria documentando que sabia do conflito sem provar que o resolveu corretamente.

**Mudanças aplicadas:**
1. Conflitos não curados dentro do prazo **bloqueiam a indexação** do documento — nunca chegam ao atendente como escolha aberta. O bot retorna "documento temporariamente indisponível" e abre ticket automático para o responsável.
2. Escalada automática em dois níveis via Azure Logic Apps: primeiro ao responsável (5 dias úteis), depois ao gestor da área (mais 3 dias úteis), depois bloqueio.
3. O alerta ⚠️ é substituído por um **card de confirmação estruturado no Teams**: o atendente clica em "Confirmar que usei a versão vigente" ou "Escalar para responsável". O clique é registrado com `{ticket_id, document_id, version_used, action, timestamp}` — essa é a trilha de auditoria jurídica.
4. Detecção semântica de conflitos (threshold de similaridade coseno > 0.92 entre documentos de IDs distintos) adicionada como **requisito obrigatório pós-MVP em 60 dias**, não como melhoria opcional.
