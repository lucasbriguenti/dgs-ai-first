## Avaliação do Exercício 2.2 — Arquitetura de MCP do projeto (servers locais)

### Resumo
O entregável é forte e, no conjunto, passa com folga. Você tratou MCP como infraestrutura gerenciada de verdade: escopo, permissões, observabilidade, governança e contingência aparecem conectados entre si, não como documentos soltos. O maior diferencial é a evidência executável do health check com estados úteis (`OK`, `DEGRADED`, `DOWN`) e uma limitação técnica importante documentada com honestidade: o `server-filesystem` não garante read-only por pasta sozinho.

O ponto que mais merece ajuste antes da entrega final não é conceitual, e sim de apresentação e rastreabilidade. O conteúdo está bom, mas há alguma redundância entre arquitetura, matriz, política e relatório, e parte da evidência de execução está embutida como transcrição documental, não como artefato bruto anexado. Isso não derruba a aprovação, mas ainda dá para deixar mais auditável.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Você demonstra domínio claro de MCP como infraestrutura, não só configuração. A distinção entre tools/resources/prompts, a aplicação de least privilege, a limitação do filesystem server e a defesa em profundidade com permissões do SO + write-probe mostram nuance técnica real. |
| D2 — Uso de Ferramentas | 3 | Há evidência consistente de uso real do Copilot e de execução local do health check. O entregável inclui o script em `cenario-2/novatech-assistant/scripts/mcp-health-check.ts`, o `.mcp/mcp.json` em `cenario-2/novatech-assistant/.mcp/mcp.json`, saídas reais com `exit 0`, `exit 1` e `exit 2`, além da iteração do endurecimento documentada em `health-check-instrucoes.md` e `health-check-hardening.md`. Isso atende o corte principal da rubrica. |
| D3 — Qualidade do Entregável | 3 | O pacote está completo, coerente e utilizável: arquitetura, diagrama, matriz, política de aprovação, contingência e script funcional. O health check não é conceitual; ele de fato valida escopo, handshake, tools, RO e severidade de falhas. |
| D4 — Pensamento Crítico | 3 | O entregável é honesto sobre limitações e trade-offs. Você reconhece explicitamente que o RO não vem do servidor MCP, mas do SO; distingue liveness de correctness; trata risco de versões não pinadas; e evita a solução simplista de “se cair, para tudo”. |
| D5 — Aplicabilidade ao Projeto | 3 | O material está fortemente conectado ao NovaTech e ao cenário 1: ADR-0003 aparece na fronteira read-only das fontes de negócio, o repositório local é respeitado, o uso dos 4 servers autorizados está alinhado ao starter repo e a governança conversa com a forma de trabalho do time neste cenário. |

**Score do exercício: 3.0**

### Verificação de Artefatos Machine-Readable
Não é um exercício de AGENTS.md ou SKILL.md, então não há exigência central de artefato machine-readable no mesmo sentido. Ainda assim, os documentos prescritivos estão bons para consumo operacional.

O que está bom:
- `arquitetura-mcp.md` usa linguagem prescritiva (`DEVE`, `NÃO DEVE`, `QUANDO FALHAR`) com critérios verificáveis por seção.
- A matriz em `diagrama-e-matriz-permissoes.md` é auditável, com `DENY` explícito e justificativa por escopo.
- A política em `politica-aprovacao-mcp-server.md` é quase policy-as-code de fato, com YAML preenchível.
- O plano em `plano-contingencia.md` define comportamentos claros de degradação, detecção e retorno ao normal.

O que ainda é mais narrativo do que operacional:
- Trechos introdutórios de objetivo, contexto e motivação em `arquitetura-mcp.md` poderiam ser mais enxutos para reduzir ruído antes das regras.
- Há repetição de alguns argumentos de segurança e least privilege entre arquitetura, matriz e relatório final.
- Parte da evidência de execução está em texto corrido no relatório, quando poderia estar mais separada como log anexo ou bloco dedicado por execução.

### Pontos Fortes
- O health check é o ponto mais forte do pacote. Ele valida a arquitetura de forma executável e prova que o entregável não é só teórico.
- A decisão sobre read-only por defesa em profundidade é tecnicamente madura. Você identificou a limitação do reference server e construiu mitigação verificável em vez de fingir que a configuração resolve sozinha.
- A combinação arquitetura + matriz + política + contingência forma um sistema coerente de governança, não apenas documentos independentes.

### Pontos de Melhoria
- Enxugue a duplicação entre `arquitetura-mcp.md`, `diagrama-e-matriz-permissoes.md` e `relatorio-final.md`. Hoje o conteúdo é bom, mas um avaliador pode sentir repetição excessiva em vez de progressão.
- Deixe a evidência de execução ainda mais auditável. Um anexo curto com “comando executado → saída resumida → exit code” por rodada deixaria o pacote mais rápido de verificar.
- Feche a pendência que você mesmo reconhece: pinagem de versões dos servers. Como risco residual tudo bem, mas como entrega final ficaria mais robusto já mostrar o plano concreto de pinagem ou registrar isso como ação imediata de adoção.

### O que fazer antes de entregar
1. Adicione um anexo ou seção curta só com evidências primárias do health check: comando, trecho da saída, status e exit code por execução. Isso aumenta auditabilidade com pouco esforço.
2. Resuma melhor o delta entre os documentos: arquitetura decide, matriz detalha permissões, política governa mudança, contingência opera falha. Hoje isso existe, mas pode ficar mais explícito e menos repetitivo.
3. Acrescente uma nota objetiva sobre como a pinagem de versões será feita no `.mcp/mcp.json` ou no setup local. Isso remove um dos poucos riscos residuais relevantes.
4. Se quiser maximizar clareza, adicione no relatório final uma mini tabela “critério da rubrica → evidência”, como você já fez parcialmente, mas apontando também os arquivos exatos do repo.
5. Considere mover parte da explicação narrativa introdutória para o relatório final e deixar os documentos operacionais mais secos e normativos.

### Checklist de prescritividade
Como este exercício não é AGENTS.md nem skill, o checklist abaixo avalia a prescritividade dos artefatos operacionais principais.

#### `arquitetura-mcp.md`

| Trecho / tipo de instrução | Classificação | Observação | Reescrita sugerida quando necessário |
|---|---|---|---|
| Regra de leitura com `DEVE` / `NÃO DEVE` / `QUANDO FALHAR` | Prescritiva | Boa abertura normativa | Sem ajuste |
| Objetivo e escopo | Narrativa | Dá contexto, não dirige ação | Manter, mas pode ser mais curto |
| “Por que tudo é local e gratuito” | Narrativa | Justifica a arquitetura, mas não instrui comportamento | Opcional: mover parte para o relatório final |
| Lista de servers autorizados | Prescritiva | Delimita escopo fechado de forma clara | Sem ajuste |
| Inventário de tools/resources/prompts | Mista | Parte é descritiva, mas sustenta decisões operacionais | Aceitável |
| Limitação técnica crítica do filesystem | Prescritiva | Muito forte; muda diretamente o desenho de mitigação | Sem ajuste |
| Matriz de consumo por agente/papel | Prescritiva | Define RO/RW de forma clara | Sem ajuste |
| Regras de least privilege por server | Prescritiva | Boas, auditáveis | Sem ajuste |
| Enforcements em camadas para RO | Prescritiva | Excelente; ação concreta e verificável | Sem ajuste |
| Política de aprovação por risco | Prescritiva | Clara, operacional | Sem ajuste |
| Monitoramento com estados e verificações | Prescritiva | Muito bom | Sem ajuste |

#### `diagrama-e-matriz-permissoes.md`

| Trecho / tipo de instrução | Classificação | Observação | Reescrita sugerida quando necessário |
|---|---|---|---|
| Princípio `deny-by-default` | Prescritiva | Forte e verificável | Sem ajuste |
| Diagrama Mermaid | Mista | Visual e operacional, mas não é regra sozinho | Aceitável com a matriz logo abaixo |
| Matriz de permissões por escopo | Prescritiva | Excelente; auditável e específica | Sem ajuste |
| Linhas `DENY` explícitas | Prescritiva | Muito bom; reduz ambiguidade | Sem ajuste |
| Regras de leitura da matriz | Prescritiva | Diretas, claras | Sem ajuste |

#### `plano-contingencia.md`

| Trecho / tipo de instrução | Classificação | Observação | Reescrita sugerida quando necessário |
|---|---|---|---|
| Invariantes I1, I2, I3 | Prescritiva | Muito boas, especialmente “nunca fabricar fonte” | Sem ajuste |
| Sinais de detecção | Prescritiva | Objetivos e ligados ao health check | Sem ajuste |
| Aviso padrão de modo degradado | Prescritiva | Muito útil para padronização | Sem ajuste |
| Cenários C1–C5 com 5 passos | Prescritiva | Operacionais e mensuráveis | Sem ajuste |
| Matriz de escalonamento | Prescritiva | Boa | Sem ajuste |
| Anti-padrões proibidos | Prescritiva | Forte | Sem ajuste |

#### `politica-aprovacao-mcp-server.md`

| Trecho / tipo de instrução | Classificação | Observação | Reescrita sugerida quando necessário |
|---|---|---|---|
| Quando a política se aplica | Prescritiva | Clara | Sem ajuste |
| Checklist mínimo de segurança | Prescritiva | Forte e acionável | Sem ajuste |
| Checklist mínimo de valor | Prescritiva | Boa, evita adição redundante | Sem ajuste |
| Níveis de risco e fluxo de aprovação | Prescritiva | Muito bom; equilibra agilidade e segurança | Sem ajuste |
| Gate de observabilidade | Prescritiva | Excelente; exige evidência executável | Sem ajuste |
| Piloto e promoção | Prescritiva | Objetiva e mensurável | Sem ajuste |
| Critério de desativação | Prescritiva | Bom e pouco comum; agrega maturidade | Sem ajuste |
| YAML policy-as-code | Prescritiva | Muito forte para operacionalização | Sem ajuste |

Leitura geral da prescritividade:
- Os documentos operacionais estão majoritariamente prescritivos.
- O material narrativo existe mais nas introduções e justificativas, não no núcleo das regras.
- Diferente do 2.1, aqui eu não vejo risco de D3 por excesso de narrativa. O principal risco é só volume e alguma repetição.

### Classificação
Aprovado com distinção

### Tópicos da Trilha para Reforço
Não há reforço obrigatório pelo score final. Se quiser elevar ainda mais a maturidade da entrega, os tópicos mais úteis para lapidar são MCP observability e governança de infraestrutura local, especialmente pinagem de versões e evidência auditável de execução.