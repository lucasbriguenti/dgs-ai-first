# Relatório Final — Exercício 2.2: Arquitetura de MCP

> **Papel:** Tech Lead  
> **Projeto fictício:** `db1/novatech-assistant`  
> **Data:** 2026-06-09

---

## 1. Resumo Executivo

A tarefa 2.2 definiu a arquitetura completa de MCP do projeto NovaTech Assistant, cobrindo 5 servers autorizados (GitHub, Azure AI Search, Azure OpenAI, Confluence NovaTech, Azure DevOps). O trabalho produziu 5 artefatos independentes gerados com Claude e GitHub Copilot, que juntos tratam MCP como infraestrutura gerenciada — não configuração ad-hoc.

**Decisão central:** nenhum server entra no projeto sem política de aprovação, requisitos de observabilidade, e plano de contingência documentados. O custo operacional de cada server é explícito antes da adoção.

**Estado dos artefatos:**

| Artefato | Arquivo | Ferramenta |
|----------|---------|------------|
| Documento de arquitetura MCP (10 seções + diagrama) | `arquitetura-mcp.md` | Claude |
| Diagrama Mermaid detalhado + Matriz de permissões | `diagrama-e-matriz-permissoes.md` | Claude |
| Script de health check v1 + hardening v2 | `mcp-health-check.ts` | Copilot |
| Exemplo de configuração de servers | `mcp.servers.json` | Copilot |
| Plano de contingência (5 cenários) | `plano-contingencia.md` | Claude |
| Política de aprovação + Policy-as-code YAML | `politica-aprovacao-mcp-server.md` | Claude |

---

## 2. Evidências de Uso das Ferramentas

### Claude (Prompts 1, 2, 5, 6)

**Prompt 1 — Documento de arquitetura MCP:**  
Gerou as 10 seções obrigatórias (`arquitetura-mcp.md`) incluindo inventário de servers, matriz de consumo por agente/papel, permissões mínimas com escopos RBAC específicos, política de aprovação por nível de risco, SLOs, versionamento semver, e diagrama Mermaid com fronteiras de segurança.

**Prompt 2 — Refinamento:**  
A partir do documento gerado no Prompt 1, o Claude produziu dois artefatos adicionais (`diagrama-e-matriz-permissoes.md`): (a) diagrama Mermaid com tools individuais em cada seta — não apenas "RO/RW" genérico — e (b) matriz de permissões de 19 linhas descendo ao nível de tool individual (`search_code`, `get_embeddings`, `create_page`), com 7 negações explícitas categorizadas por tipo (destrutivo, produção, sistema de cliente, fora do escopo, papel inadequado). O Claude aplicou o princípio deny-by-default sem precisar de instrução adicional.

**Prompt 5 — Plano de contingência:**  
Gerou `plano-contingencia.md` com os 5 cenários solicitados, cada um com 6 campos (detecção, ação imediata, modo degradado, escalonamento, critério de retorno, postmortem). O Claude manteve aderência ao princípio "agente degradado > agente quebrado" de forma consistente — o modo degradado de cada cenário detalha o que continua funcionando, não apenas o que para.

**Prompt 6 — Política de aprovação:**  
Gerou `politica-aprovacao-mcp-server.md` com checklists de segurança (11 itens, 4 bloqueantes absolutos) e valor (5 itens, 2 com critério de rejeição direta), fluxo por nível de risco com prazos concretos, requisitos de observabilidade, fase piloto com simulação de falha obrigatória, e critérios de desativação. A entrega extra — Policy-as-code YAML — incluiu schema completo e exemplo preenchido de um server hipotético de risco baixo.

### GitHub Copilot (Prompts 3 e 4)

**Prompt 3 — Health check v1:**  
O Copilot gerou o script TypeScript inicial com leitura de `mcp.servers.json`, suporte a transporte `http` e `stdio`, retry com backoff exponencial, e saída dual (tabela no terminal + JSON). Exit codes definidos: 0 (todos OK), 1 (DEGRADED), 2 (DOWN).

**Prompt 4 — Hardening para CI:**  
Em segunda rodada, o Copilot expandiu o script com: validação de schema de entrada via Zod, classificação de falhas por tipo (`network`, `auth`, `timeout`, `contract`, `unknown`), recomendação automática de ação por tipo de falha, logs estruturados JSON com eventos nomeados (`run.start`, `attempt.failure`, `run.end`), e modos `--fail-fast` / `--full-scan`. O script final (`mcp-health-check.ts`) tem 714 linhas com cobertura de casos-borda (timeout race, SIGTERM no processo filho, stdin/stdout stdio buffering).

**Riscos residuais identificados pelo Copilot no Prompt 4:**
1. Servers stdio que nunca emitem resposta JSON-RPC ficam presos até o timeout — sem sinalização antecipada.
2. Variáveis de ambiente com `${VAR}` não resolvidas resultam em string vazia silenciosamente.
3. O script não valida se o server que respondeu ao `initialize` é realmente o server esperado (sem verificação de identidade).
4. Em ambientes com muitos servers, execução sequencial pode exceder o timeout total do CI.
5. Sem TLS verification configurável — servers HTTP internos com certificados self-signed falhariam.

---

## 3. Decisões Principais e Trade-offs

| Decisão | Alternativa descartada | Razão da escolha |
|---------|----------------------|-----------------|
| **3 níveis de risco com prazos distintos** (1/3/5 dias úteis) | Aprovação única com prazo fixo para todos | Time pequeno — burocratizar servidor de documentação pública da mesma forma que servidor com acesso a dados de clientes é desproporcional |
| **Fase piloto obrigatória para risco médio e alto** | Aprovação imediata com monitoramento retroativo | Detectar problemas de contrato ou permissão antes de todos os membros do time adotarem é mais barato do que corrigir após adoção ampla |
| **Deny-by-default na matriz de permissões** | Listar apenas o que é permitido | Tornar as negações explícitas e categorizadas força revisão consciente de cada tool — não é possível "esquecer" de negar algo |
| **Script de health check em TypeScript (não shell)** | Script bash com `curl` | TypeScript é a linguagem do projeto; o script pode ser importado no pipeline CI sem dependência de ferramentas externas; Zod para validação de schema é consistente com o padrão do projeto |
| **Postmortem obrigatório apenas para Cenário 3 (resposta incorreta)** | Postmortem para qualquer incidente | Cenários de latência ou auth têm causa geralmente óbvia; o Cenário 3 é o único onde artefatos gerados com dado errado podem ter sido commitados — rastreabilidade é crítica |
| **SLOs para ambiente de desenvolvimento** | SLOs apenas para produção | Developers e agentes dependem dos servers em dev durante o sprint — indisponibilidade em dev tem impacto real no velocity, não apenas em produção |

---

## 4. Como a Arquitetura Trata MCP como Infraestrutura Gerenciada

O documento `arquitetura-mcp.md` operacionaliza "infraestrutura gerenciada" em 6 dimensões concretas:

**Inventário controlado:** cada server tem ID único (`MCP-NN`), tipo documentado (público ou customizado), e localização do código em `/infra/mcp-servers/` para servers customizados. Nenhum server existe fora do inventário.

**Versionamento semântico:** servers customizados seguem semver; servers públicos têm versão fixada no `package.json` (sem `^` ou `~`). Breaking change exige período de coexistência de 5 dias úteis. A regra de lint bloqueia versões não-fixadas.

**Observabilidade pré-requisito:** um server não entra em uso sem health check no CI, logging estruturado, alerta no Azure Monitor, e SLO definido. Não é possível adotar um server "e depois configurar o monitoramento".

**Aprovação com rastreabilidade:** cada server em `.mcp/mcp.json` tem um PR correspondente com proposta preenchida no formato YAML definido. A ausência de proposta é detectável em code review.

**Plano de degradação documentado antes da adoção:** antes de qualquer server ser promovido a uso amplo, o modo degradado já está definido e testado (Cenário 1 do plano de contingência + simulação de falha obrigatória no piloto). O time nunca descobre o modo degradado no momento da falha.

**Critérios de desativação pré-definidos:** 6 critérios com prazos concretos (D-01 a D-06). Um server não fica no projeto por inércia — quando o custo supera o valor ou quando há risco de segurança, a saída está documentada.

---

## 5. Riscos Abertos e Plano de Mitigação

Os riscos a seguir não foram completamente resolvidos nos artefatos desta entrega e requerem ação nas próximas sprints:

| # | Risco aberto | Impacto | Mitigação planejada | Sprint alvo |
|---|-------------|---------|--------------------|----|
| RA-01 | **MCP-02 e MCP-03 são servers customizados ainda a construir** — enquanto não existem, a arquitetura é teórica para esses servers | Alto | Incluir construção dos servers em `infra/mcp-servers/` como tasks na sprint de setup; usar stubs para health check até pronto | Sprint 1 |
| RA-02 | **Script de health check não verifica identidade do server** (item 3 dos riscos residuais do Copilot) — server impostor poderia responder ao `initialize` | Médio | Adicionar verificação de `serverInfo.name` na resposta do `initialize` contra o nome esperado na config | Sprint 1 |
| RA-03 | **Execução sequencial do health check pode ultrapassar timeout do CI** com 5+ servers | Baixo | Implementar execução paralela com `Promise.allSettled` — não implementado no hardening para manter o código legível na entrega | Sprint 2 |
| RA-04 | **Confluence da NovaTech** requer integração com equipe de infra da NovaTech (service account, espaço `NOVATECH-DOCS`) — dependência externa fora do controle do time DB1 | Alto | Levantar requisito junto ao Delivery Manager e NovaTech no início do projeto; incluir como risco no ADR de MCP | Sprint 0 (pré-dev) |
| RA-05 | **Revisão trimestral de permissões** (R4 na arquitetura) depende de script de comparação ainda não criado | Baixo | Criar script em `/infra/check-permissions.ts` que compara permissões reais via APIs das plataformas com as documentadas | Sprint 3 |

---

## 6. Checklist de Aderência aos Critérios da Avaliação 2.2

Baseado na rubrica `skills-avaliacao/avaliacao-tech-lead.md`:

| Critério da avaliação | Status | Evidência |
|----------------------|--------|-----------|
| **MCP como infraestrutura gerenciada** (versionamento, monitoramento, política de aprovação) | ✅ Atendido | `arquitetura-mcp.md` seções 5, 6, 7; `politica-aprovacao-mcp-server.md` com fluxo por nível de risco |
| **Diagrama de conexões** (quem consome o quê, com permissões) | ✅ Atendido | `diagrama-e-matriz-permissoes.md` — diagrama com tools individuais por seta + matriz de 19 linhas com deny explícito |
| **Script de health check funcional, gerado com Copilot** | ✅ Atendido | `mcp-health-check.ts` (714 linhas) — lê config, testa conectividade HTTP e stdio, reporta OK/DEGRADED/DOWN; evidência de 2 rodadas com Copilot (v1 + hardening) |
| **Plano de contingência realista** (agente degradado > agente quebrado) | ✅ Atendido | `plano-contingencia.md` — 5 cenários, cada um com tabela de "o que continua / o que para"; modo degradado definido antes da falha, não improvisado |
| **Política de aprovação equilibrada** (agilidade com segurança, sem extremos) | ✅ Atendido | `politica-aprovacao-mcp-server.md` — risco baixo aprovado em 1 dia por TL sozinho; 4 itens bloqueantes absolutos evitam aprovação irresponsável; fase piloto impede burocracia desnecessária para casos simples |
