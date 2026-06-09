# Política de Aprovação de Novos MCP Servers — NovaTech Assistant

> **Artefato:** Prompt 6 — Política de aprovação equilibrando segurança e velocidade  
> **Repositório fictício:** `db1/novatech-assistant`  
> **Dono da política:** Tech Lead  
> **Revisão:** semestral ou após qualquer incidente relacionado a MCP server

**Princípio central:** a política não existe para bloquear — existe para que o time saiba exatamente o que precisa fazer para adicionar um server sem criar risco desnecessário. Aprovação rápida para casos simples; freio real apenas onde o risco justifica.

---

## 1. Checklist Mínimo de Segurança

Todo server candidato DEVE ser avaliado contra os itens abaixo **antes** de qualquer aprovação, independente do nível de risco.

### 1.1 Identidade e procedência

- [ ] **S-01** O server tem mantenedor identificável (organização ou pessoa com histórico público auditável)?
- [ ] **S-02** O código-fonte está disponível para inspeção (open source ou repositório interno DB1)?
- [ ] **S-03** O server não tem histórico de vulnerabilidades críticas abertas sem correção?

### 1.2 Acesso e credenciais

- [ ] **S-04** As credenciais do server serão armazenadas no Azure Key Vault — nunca em `.env` commitado ou hardcoded?
- [ ] **S-05** É possível definir permissões mínimas (least privilege) — o server não exige escopo de admin para funcionar?
- [ ] **S-06** O server suporta rotação de credenciais sem downtime?

### 1.3 Dados e privacidade

- [ ] **S-07** Está claro quais dados o server envia para fora do ambiente local (para APIs externas, logs, telemetria)?
- [ ] **S-08** Dados classificados como internos da NovaTech (documentos, SLAs, contratos) **não** transitam pelo server sem criptografia em trânsito (TLS)?
- [ ] **S-09** O server não persiste dados sensíveis em cache local sem política de expiração?

### 1.4 Superfície de ataque

- [ ] **S-10** O server não expõe tools de escrita em sistemas de produção sem confirmação humana explícita?
- [ ] **S-11** O server tem um scope bem definido — não é um "faz tudo" com acesso irrestrito?

**Critério de bloqueio:** qualquer item `S-04`, `S-07`, `S-08` ou `S-10` marcado como NÃO atendido **bloqueia a aprovação** até resolução. Os demais itens são avaliados no contexto do nível de risco.

---

## 2. Checklist Mínimo de Valor para o Time

Antes de aprovar, o proponente DEVE demonstrar que o server resolve um problema real que os servers existentes não resolvem.

- [ ] **V-01** O server resolve um problema concreto que ocorre com frequência (mais de uma vez por sprint)?
- [ ] **V-02** Não existe workaround aceitável com os 5 servers já autorizados (MCP-01 a MCP-05)?
- [ ] **V-03** Pelo menos 2 membros do time usarão o server regularmente (não é um server para um único desenvolvedor)?
- [ ] **V-04** O custo de manutenção do server (atualizar, monitorar, rotacionar credenciais) é proporcional ao ganho?
- [ ] **V-05** O time consegue operar em modo degradado se o server ficar indisponível (não cria dependência crítica nova)?

**Critério de rejeição por valor:** se `V-01` + `V-02` não forem atendidos simultaneamente, o server é rejeitado independente do nível de risco. Servers que não resolvem um problema real não entram no projeto.

---

## 3. Níveis de Risco e Fluxo de Aprovação

### Classificação de risco

| Nível | Critérios | Exemplos |
|-------|-----------|---------|
| **Baixo** | RO apenas; dados não-sensíveis; servidor público com histórico auditado; sem escrita em nenhum sistema externo | Server de leitura de documentação pública, consulta a APIs de status |
| **Médio** | RW em sistemas internos do projeto; ou dados internos da NovaTech em trânsito; ou server sem histórico público extenso | Server de escrita no repositório, acesso a logs internos, integração com Slack do time |
| **Alto** | Acesso a dados de clientes finais; escrita em sistemas financeiros ou de compliance; acesso a credenciais ou segredos; qualquer server que, comprometido, causaria incidente de segurança reportável | Server com acesso a base de dados de clientes, integração com ERP da NovaTech, acesso ao Key Vault |

### Fluxo por nível

```
BAIXO RISCO
  Proponente preenche proposta (template seção 6)
    → Tech Lead avalia em até 1 dia útil
      → Aprovado: PR com .mcp/mcp.json atualizado + proposta no comentário do PR
      → Rejeitado: Tech Lead documenta razão no PR; proponente pode revisar e resubmeter

MÉDIO RISCO
  Proponente preenche proposta
    → Tech Lead avalia checklist de segurança (S-01 a S-11)
      → Tech Lead + 1 Dev Sênior revisam em até 3 dias úteis
        → Aprovado: PR com proposta + fase piloto obrigatória (ver seção 5)
        → Rejeitado: razão documentada; revisão possível em até 5 dias úteis

ALTO RISCO
  Proponente preenche proposta
    → Tech Lead avalia e marca como Alto Risco
      → Tech Lead + equipe de segurança DB1 revisam em até 5 dias úteis
        → Somente aprovado se todos os itens S-01 a S-11 atendidos
        → Fase piloto obrigatória com duração mínima de 1 sprint (2 semanas)
        → Aprovação final do Tech Lead após piloto com evidências documentadas
```

**Regra de velocidade:** se o Tech Lead não responder dentro do prazo do nível correspondente, o Delivery Manager escalona. O objetivo é nunca bloquear o time por omissão — a falta de resposta não é aprovação tácita.

---

## 4. Requisitos de Observabilidade Antes de Entrar em Uso

Um server **não entra em uso** antes de atender os 4 requisitos abaixo, independente do nível de risco:

| Requisito | O que deve existir |
|-----------|-------------------|
| **O-01 Health check** | O server DEVE estar incluído no `/infra/mcp-healthcheck.ts` com pelo menos uma verificação funcional |
| **O-02 Logging** | O server DEVE emitir logs estruturados (JSON) com campos: `timestamp`, `server`, `tool`, `latency_ms`, `status`, `error` |
| **O-03 Alerta de disponibilidade** | Azure Monitor Alert Rule configurada para alertar `DOWN` após 2 falhas consecutivas no canal `#novatech-alerts` |
| **O-04 SLO definido** | Disponibilidade mínima e latência p95 documentados na seção 10 do `arquitetura-mcp.md` |

**Critério verificável:** o CI do repositório DEVE incluir o novo server no job de health check antes do merge do PR de aprovação. Se o job de health check não incluir o server, o merge é bloqueado.

---

## 5. Fase Piloto e Critério de Promoção para Uso Amplo

### Quando a fase piloto é obrigatória

- Todos os servers de risco **Médio** e **Alto**.
- Servers de risco Baixo que processam dados internos da NovaTech.

### Duração e condições do piloto

| Nível de risco | Duração mínima | Usuários no piloto |
|----------------|---------------|-------------------|
| Médio | 5 dias úteis | Tech Lead + 1 Desenvolvedor |
| Alto | 1 sprint (10 dias úteis) | Tech Lead + Dev Sênior + QA |

Durante o piloto:
- O server DEVE estar marcado como `"pilot": true` no `.mcp/mcp.json`.
- Todos os outros membros do time NÃO DEVEM usar o server até promoção.
- O piloto DEVE incluir ao menos 1 cenário de falha simulada (health check desligado manualmente) para validar o modo degradado.

### Critério de promoção para uso amplo

O server é promovido quando **todos** os critérios abaixo forem atendidos:

- [ ] **P-01** Zero incidentes de segurança durante o piloto
- [ ] **P-02** SLO de disponibilidade atingido durante o piloto (sem `DOWN` não planejado)
- [ ] **P-03** Modo degradado validado na simulação de falha
- [ ] **P-04** Tech Lead e Dev Sênior confirmam por escrito (comentário no PR de promoção) que o server se comportou conforme esperado
- [ ] **P-05** Documentação do server atualizada: runbook, SLO, e entrada na matriz de consumo (`arquitetura-mcp.md`, seção 3)

Promoção ocorre via PR que remove `"pilot": true` do `.mcp/mcp.json` e atualiza este documento com o novo server.

---

## 6. Critério de Desativação de Server

Um server DEVE ser desativado (removido do `.mcp/mcp.json`) quando qualquer um dos critérios abaixo for atingido:

| Critério | Prazo para desativação |
|----------|----------------------|
| **D-01** Server ficou abaixo do SLO de disponibilidade por 3 semanas consecutivas sem melhoria planejada | 5 dias úteis após confirmação |
| **D-02** Vulnerabilidade crítica (CVSS ≥ 9.0) reportada sem patch disponível | Imediato — server desativado antes de qualquer investigação adicional |
| **D-03** Checklist `V-01` ou `V-02` deixou de ser verdadeiro (problema que resolvia foi resolvido de outra forma) | Na próxima sprint |
| **D-04** Credenciais comprometidas e não rotacionadas em 24h | Imediato |
| **D-05** Server não tem mais mantenedor ativo e nenhum membro do time pode assumir a manutenção | 1 sprint após identificação |
| **D-06** Incidente de segurança causado pelo server (dados vazados, acesso não autorizado confirmado) | Imediato |

### Processo de desativação

1. Tech Lead cria PR removendo o server do `.mcp/mcp.json`.
2. PR inclui nota de breaking change para agentes que consomem o server.
3. Para `D-02`, `D-04`, `D-06`: desativação imediata via commit direto na main com aprovação retroativa; PR de cleanup criado em seguida.
4. Membros do time notificados no `#novatech-alerts` com: server desativado, motivo, e alternativa (se houver).

---

## 7. Policy-as-Code — Proposta de Aprovação em YAML

Todo novo MCP server DEVE ser proposto via arquivo YAML seguindo o schema abaixo. O arquivo DEVE ser incluído no PR de adição do server, na pasta `/docs/mcp-proposals/`.

```yaml
# Schema: mcp-server-proposal v1.0
# Campos obrigatórios marcados com [REQUIRED]
# Arquivo: /docs/mcp-proposals/<slug-do-server>.yaml

proposal:
  server_id: ""          # [REQUIRED] formato: MCP-NN (próximo número disponível)
  server_slug: ""        # [REQUIRED] ex: "notion", "linear", "slack"
  proposed_by: ""        # [REQUIRED] nome do proponente
  proposed_at: ""        # [REQUIRED] ISO 8601: "2026-06-09"
  risk_level: ""         # [REQUIRED] enum: "low" | "medium" | "high"

purpose:
  problem_solved: ""     # [REQUIRED] 1-3 frases: qual problema concreto resolve
  existing_workaround: "" # [REQUIRED] por que os servers atuais não resolvem
  frequency_of_use: ""   # [REQUIRED] ex: "multiple times per sprint", "daily"
  roles_consuming: []    # [REQUIRED] lista: ["tech-lead", "developer", "qa", ...]

security:
  source_available: false       # [REQUIRED] código-fonte disponível para inspeção?
  maintainer: ""                # [REQUIRED] organização ou pessoa responsável
  credentials_in_key_vault: false  # [REQUIRED] segredos no Azure Key Vault?
  least_privilege_possible: false  # [REQUIRED] suporta escopo mínimo?
  data_leaving_environment: ""  # [REQUIRED] descrever quais dados saem do ambiente local
  sensitive_data_in_transit: false # [REQUIRED] dados internos NovaTech transitam pelo server?
  write_access_to_external_systems: false # [REQUIRED] server tem acesso de escrita?

access:
  tools_exposed: []    # [REQUIRED] lista de tools que serão habilitadas
  tools_denied: []     # [REQUIRED] lista de tools disponíveis no server mas que NÃO serão habilitadas
  minimum_scope: ""    # [REQUIRED] permissão mínima necessária (ex: RBAC role, OAuth scope)
  environments:        # [REQUIRED] em quais ambientes o server será ativo
    dev: false
    staging: false
    prod: false        # prod=true requer aprovação de risco "high" obrigatoriamente

observability:
  health_check_added: false   # [REQUIRED] server incluído em /infra/mcp-healthcheck.ts?
  logging_structured: false   # [REQUIRED] emite logs JSON com campos padrão?
  alert_configured: false     # [REQUIRED] Azure Monitor Alert Rule criada?
  slo_availability: ""        # [REQUIRED] ex: "99%"
  slo_latency_p95_ms: 0       # [REQUIRED] ex: 2000

pilot:
  required: false      # [REQUIRED] obrigatório para medium/high risk
  duration_days: 0     # [REQUIRED se pilot=true] dias úteis
  pilot_users: []      # [REQUIRED se pilot=true] lista de membros do time no piloto

degraded_mode: ""      # [REQUIRED] o que o time faz se este server ficar indisponível

approval:
  tech_lead_approved: false    # preenchido pelo Tech Lead
  tech_lead_approved_at: ""    # ISO 8601
  senior_dev_approved: false   # obrigatório para medium/high risk
  security_team_approved: false # obrigatório para high risk
  notes: ""                    # observações do aprovador
```

### Exemplo preenchido — server hipotético `linear` (risco baixo)

```yaml
proposal:
  server_id: "MCP-06"
  server_slug: "linear"
  proposed_by: "Dev Sênior"
  proposed_at: "2026-06-09"
  risk_level: "low"

purpose:
  problem_solved: >
    O MCP-05 (Azure DevOps) cobre work items do projeto, mas o time de produto
    usa Linear para roadmap estratégico. Copiar items manualmente entre as duas
    ferramentas consome ~30 min por sprint.
  existing_workaround: >
    Atualmente feito via cópia manual. MCP-05 não acessa o Linear.
  frequency_of_use: "once per sprint (sprint planning)"
  roles_consuming:
    - tech-lead
    - delivery-manager

security:
  source_available: true
  maintainer: "Linear App Inc. (@linearapp on GitHub)"
  credentials_in_key_vault: true
  least_privilege_possible: true
  data_leaving_environment: >
    Títulos e descrições de issues do Linear são enviados ao agente local.
    Nenhum dado da NovaTech transita pelo server Linear.
  sensitive_data_in_transit: false
  write_access_to_external_systems: false

access:
  tools_exposed:
    - list_issues
    - get_issue
  tools_denied:
    - create_issue
    - update_issue
    - delete_issue
  minimum_scope: "read:issues no workspace novatech-assistant"
  environments:
    dev: true
    staging: false
    prod: false

observability:
  health_check_added: true
  logging_structured: true
  alert_configured: true
  slo_availability: "97%"
  slo_latency_p95_ms: 3000

pilot:
  required: false

degraded_mode: >
  Tech Lead consulta o Linear diretamente via browser durante sprint planning.
  Nenhum bloqueio de desenvolvimento.

approval:
  tech_lead_approved: false
  tech_lead_approved_at: ""
  senior_dev_approved: false
  security_team_approved: false
  notes: ""
```
