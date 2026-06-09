# Plano de Contingência Operacional — MCP NovaTech

> **Artefato:** Prompt 5 — Plano de contingência por cenário de falha  
> **Repositório fictício:** `db1/novatech-assistant`  
> **Runbook canônico:** `/docs/runbooks/mcp-degradado.md`  
> **Canal de alerta:** `#novatech-alerts` no Teams

**Premissa:** este plano é executável por um time de 6 pessoas sem gerente de incidentes dedicado. O Tech Lead é o ponto de decisão em todos os cenários. Time pequeno → runbooks curtos, ações diretas.

---

## Referência rápida — criticidade dos servers

| Server | Criticidade | Impacto se cair |
|--------|-------------|-----------------|
| MCP-01 `github` | Alta | Agentes perdem acesso ao repositório — geração de código sem contexto |
| MCP-02 `azure-ai-search` | Alta | Agentes não validam cobertura do índice durante desenvolvimento |
| MCP-03 `azure-openai` | Média | Testes ao vivo param; geração offline continua |
| MCP-04 `confluence-novatech` | Baixa | Agentes usam snapshot do Anexo A como fallback |
| MCP-05 `azure-devops` | Baixa | Tracking manual; desenvolvimento não para |

---

## Cenário 1 — Queda total de server crítico

**Definição:** health check retorna `DOWN` por 2 verificações consecutivas (≥ 10 min). Aplica-se a qualquer um dos 5 servers.

### 1. Detecção

- Alerta automático `MCP-DOWN` dispara no `#novatech-alerts` com: nome do server, horário da primeira falha, número de tentativas.
- O script `/infra/mcp-healthcheck.ts` DEVE registrar o alerta em log estruturado com `severity: "critical"`.
- Se o CI falhar com erro de health check, o build DEVE incluir o server com falha no resumo do job.

### 2. Ação imediata (0–15 min)

1. **Tech Lead** confirma se é falha real ou falso positivo: executar `npx ts-node infra/mcp-healthcheck.ts --server <id> --verbose` manualmente.
2. Se confirmada, **Tech Lead** posta no `#novatech-alerts`: "MCP-01 DOWN confirmado às HH:MM. Modo degradado ativado."
3. **Desenvolvedor** para qualquer sessão de agente que dependa do server afetado — não tenta retentar em loop.
4. **Tech Lead** verifica status da plataforma externa correspondente:
   - MCP-01 → [githubstatus.com](https://githubstatus.com)
   - MCP-02/03 → Azure Status Dashboard do tenant da DB1
   - MCP-04 → Confluence status page da NovaTech (contato: equipe de infra NovaTech)
   - MCP-05 → Azure DevOps status page

### 3. Modo degradado

| Server caído | O que continua | O que para |
|---|---|---|
| MCP-01 `github` | Geração de artefatos com contexto fornecido manualmente no prompt; reviews feitas diretamente no GitHub web | Geração automática de PRs; contexto de código em tempo real |
| MCP-02 `azure-ai-search` | Geração de código contra specs e tipos TypeScript; testes unitários | Validação de cobertura do índice; testes de integração contra o índice |
| MCP-03 `azure-openai` | Geração de código; testes unitários com mocks | Testes ao vivo com completion API; validação de outputs do assistente |
| MCP-04 `confluence-novatech` | Geração baseada no snapshot do Anexo A (`semana-1/anexo-a-documentacao-simulada-novatech.md`) | Consulta a páginas dinâmicas; documentação atualizada após data do snapshot |
| MCP-05 `azure-devops` | Todo o desenvolvimento; apenas tracking é manual | Criação automática de work items a partir de specs; atualizações via agente |

### 4. Escalonamento

```
0–15 min  →  Tech Lead verifica e confirma
15–60 min →  Tech Lead aciona responsável da plataforma externa (ver tabela acima)
> 1h      →  Tech Lead notifica Delivery Manager sobre impacto no sprint
> 4h      →  Delivery Manager reavalia escopo da sprint; Tech Lead escalona para infra DB1
             se o server for customizado (MCP-02, MCP-03, MCP-04)
```

### 5. Critério de retorno ao normal

- Health check retorna `OK` por 3 verificações consecutivas (15 min).
- Tech Lead valida manualmente: executa um caso de uso simples com o agente e confirma resposta correta.
- Tech Lead posta no `#novatech-alerts`: "MCP-XX restabelecido às HH:MM. Modo normal retomado."

### 6. Postmortem mínimo

Dentro de 1 dia útil após resolução, Tech Lead adiciona entrada em `/docs/runbooks/mcp-degradado.md` com:
- Data/hora de início e fim
- Causa raiz (se conhecida)
- Duração do modo degradado
- Uma ação preventiva concreta para evitar recorrência

---

## Cenário 2 — Latência alta persistente

**Definição:** p95 de latência acima do SLO por 5 minutos contínuos (ver SLOs em `arquitetura-mcp.md`, seção 10). O server responde, mas devagar.

### 1. Detecção

- Alerta `MCP-DEGRADED` no `#novatech-alerts` com: server, latência atual p95, SLO configurado, duração.
- O log do server DEVE incluir campo `latency_ms` em toda resposta — o Azure Monitor Alert Rule dispara quando média de 5 min ultrapassa o SLO.
- Sintoma visível ao usuário: agente demora para responder, pode parecer travado.

### 2. Ação imediata (0–15 min)

1. **Desenvolvedor** que estiver em sessão DEVE reduzir a frequência de chamadas: evitar usar o server afetado em loops ou chamadas em sequência rápida.
2. **Tech Lead** verifica se o problema é isolado (apenas este server) ou sistêmico (Azure lento em geral).
3. **Tech Lead** verifica quota e throttling no portal Azure: se a deployment `gpt-4o-dev` atingiu TPM limit, o problema é de quota — não de infraestrutura.
4. Se for throttling de quota: **Tech Lead** decide pausar sessões de agentes que consomem MCP-03 até a janela de quota resetar (normalmente 1 min).

### 3. Modo degradado

- Agentes continuam operando com timeout aumentado: `REQUEST_TIMEOUT_MS=8000` (dobro do normal).
- Sessões que não são urgentes DEVEM ser adiadas até latência normalizar.
- MCP-03 com latência alta: agente usa mock local para testes não-críticos enquanto aguarda.

### 4. Escalonamento

```
0–15 min  →  Desenvolvedor reduz carga; Tech Lead diagnostica
15–30 min →  Tech Lead contata suporte da plataforma se não for throttling interno
> 30 min  →  Tech Lead avisa Delivery Manager; trabalho de agente pausado para o server afetado
```

### 5. Critério de retorno ao normal

- Latência p95 abaixo do SLO por 10 minutos consecutivos.
- Nenhuma ação manual necessária — o alerta `MCP-DEGRADED` deixa de disparar automaticamente.

### 6. Postmortem mínimo

Somente se a latência persistir por mais de 1 hora. Registro em `/docs/runbooks/mcp-degradado.md` com:
- Server afetado e duração
- Causa (throttling, infra, rede)
- Se o SLO atual é realista ou precisa ser ajustado

---

## Cenário 3 — Resposta incorreta ou suspeita

**Definição:** o server responde com `200 OK`, mas o conteúdo está errado — schema violado, dados desatualizados, ou resposta que contradiz a fonte de verdade conhecida.

Exemplos concretos:
- MCP-02 retorna chunks de uma versão desatualizada do documento `PROC-042` (antes da v2)
- MCP-04 retorna conteúdo de uma página do Confluence que foi deletada ou substituída
- MCP-03 retorna resposta em formato diferente do schema esperado (`source_document` ausente)

### 1. Detecção

- Alerta `MCP-SCHEMA-VIOLATION` dispara quando o response validator (`src/shared/response-validator.ts`) encontra resposta fora do schema definido.
- Detecção humana: desenvolvedor ou QA percebe que o agente gerou um artefato com dado incorreto (ex: cita PROC-042 v1 em vez de v2).
- Em testes: asserção falha com dado inesperado vindo de fixture ao vivo.

### 2. Ação imediata (0–15 min)

1. **Desenvolvedor** ou **QA** que detectou DEVE parar imediatamente qualquer sessão de agente que use o server suspeito.
2. **Não descartar** o artefato gerado — preservar como evidência com timestamp.
3. **Tech Lead** executa verificação manual: chama a mesma tool diretamente via `curl` ou cliente MCP e compara com a fonte de verdade esperada.
4. Se confirmada resposta incorreta: **Tech Lead** suspende o server (`"enabled": false` no `.mcp/mcp.json`) e cria work item no Azure DevOps com label `mcp-incident`.

### 3. Modo degradado

- Agentes NÃO DEVEM consumir o server suspeito até resolução confirmada.
- Para MCP-02: desenvolvedores usam dados de fixtures locais (`/tests/fixtures/chunks.ts`) para sessões de desenvolvimento.
- Para MCP-04: usar snapshot do Anexo A; não gerar artefatos que dependam de dados dinâmicos do Confluence.
- Para MCP-03: usar respostas mockadas do MSW para testes; suspender validação ao vivo.

### 4. Escalonamento

```
Imediato  →  Tech Lead suspende o server afetado
0–30 min  →  Tech Lead identifica a causa (dado na fonte, bug no server, cache stale)
30–60 min →  Se a causa for dado incorreto na fonte: Tech Lead aciona Product Specialist
             para acionar equipe da NovaTech (Confluence/Azure AI Search)
> 1h      →  Delivery Manager notificado; sprint reavaliada se o server for crítico
```

### 5. Critério de retorno ao normal

- Tech Lead valida manualmente 3 queries representativas contra a fonte de verdade e confirma respostas corretas.
- Server reabilitado no `.mcp/mcp.json` via PR com a correção documentada.
- QA executa smoke test com casos do `/prompts/eval/golden-queries.json` e confirma zero violações de schema.

### 6. Postmortem mínimo

**Obrigatório** independente da duração. Registrar em `/docs/runbooks/mcp-degradado.md`:
- Qual dado estava incorreto e por quê
- Quantos artefatos foram gerados com o dado incorreto (rastrear via git log do período)
- Se algum artefato gerado precisa ser revisado manualmente
- Ajuste no validator ou nos dados de fixture para detectar este caso no futuro

---

## Cenário 4 — Falha de autenticação

**Definição:** o server retorna `401 Unauthorized` ou `403 Forbidden`. Credenciais expiradas, revogadas, ou permissão removida.

### 1. Detecção

- Log do server registra `status: 401` ou `status: 403` com campo `error: "auth_failure"`.
- Health check retorna `DOWN` com `reason: "authentication"` — distinguível de falha de rede.
- Sintoma visível: agente retorna erro explícito de autenticação na sessão.

### 2. Ação imediata (0–15 min)

1. **Tech Lead** identifica qual credencial falhou: token GitHub, service principal Azure, API key Confluence.
2. **Não rotacionar a credencial diretamente** — verificar primeiro se foi revogação intencional por alguém do time ou pela plataforma.
3. Verificar no Azure Key Vault / GitHub Settings se o segredo foi modificado ou se a service account foi desabilitada.
4. Se expiração natural: **Tech Lead** gera nova credencial na plataforma correspondente, atualiza no Azure Key Vault, reinicia o MCP server afetado.
5. Se revogação não-planejada: **Tech Lead** escalona imediatamente — pode indicar incidente de segurança.

### 3. Modo degradado

- Mesmo modo degradado do Cenário 1 (queda total) para o server afetado.
- Se MCP-01 falhar por auth: PRs criados manualmente no GitHub web até restauração.
- Se MCP-05 falhar por auth: tracking manual no Azure DevOps web.

### 4. Escalonamento

```
0–15 min  →  Tech Lead verifica causa e tenta rotação de credencial
15–30 min →  Se não resolver: Tech Lead aciona administrador do Azure AD / GitHub org da DB1
Se suspeita de comprometimento →  Tech Lead aciona segurança DB1 IMEDIATAMENTE,
                                  antes de qualquer outra ação
```

### 5. Critério de retorno ao normal

- Health check retorna `OK` com `reason: "auth_success"` por 2 verificações.
- Tech Lead confirma que a credencial antiga foi invalidada (não coexistir com a nova).
- Rotação registrada no changelog de segredos do projeto (arquivo `SECRETS-CHANGELOG.md` — não commitado, mantido no Azure Key Vault notes).

### 6. Postmortem mínimo

**Obrigatório** se a falha for de origem não-planejada. Registrar:
- Qual credencial falhou e por quê (expiração programada, revogação manual, comprometimento)
- Se havia alerta de expiração configurado — se não havia, criar
- Se foi comprometimento: seguir processo de segurança DB1 (escopo além deste runbook)

---

## Cenário 5 — Mudança de versão quebrando contrato

**Definição:** uma atualização em um MCP server (público ou customizado) altera a interface — tool removida, parâmetro renomeado, schema de resposta modificado — e agentes param de funcionar ou geram resultados incorretos.

### 1. Detecção

- CI falha com erro de "tool not found" ou "schema validation failed" após atualização de dependência.
- O teste de contrato no CI (que verifica as tools esperadas estão disponíveis) falha — este teste DEVE existir como parte do `ci.yml`.
- Desenvolvedor percebe comportamento diferente do agente após `npm install` ou `npx` buscou versão nova.

### 2. Ação imediata (0–15 min)

1. **Desenvolvedor** executa `git diff package-lock.json` para identificar qual versão de MCP server mudou.
2. Se a mudança foi não-intencional (Dependabot ou `npm install` sem lock): reverter para versão anterior via `npm install <package>@<versão-anterior>` e commitar o `package-lock.json` corrigido.
3. Se a mudança foi intencional (PR de atualização aprovado): verificar o CHANGELOG do server para entender o breaking change.
4. **Tech Lead** decide: reverter a atualização ou adaptar os agentes ao novo contrato. Em dúvida, **reverter primeiro**.

### 3. Modo degradado

- Fixar a versão anterior no `package.json` com `"exact": true` (remover `^` e `~`) e fazer deploy da versão estável.
- Agentes continuam operando com a versão anterior enquanto a migração para a nova versão é preparada.
- **Nunca rodar dois contratos simultaneamente no mesmo ambiente** — escolher um e ser consistente.

### 4. Escalonamento

```
0–15 min  →  Desenvolvedor reverte a versão; Tech Lead é notificado
15–60 min →  Tech Lead avalia o esforço de migração para o novo contrato
> 1h      →  Se o breaking change for custoso: Tech Lead cria task no Azure DevOps
             e agenda para próxima sprint (não resolve na hora)
```

### 5. Critério de retorno ao normal

**Opção A — Reverter (rápido):**
- `package-lock.json` commitado com versão anterior fixada.
- CI verde com a versão revertida.

**Opção B — Migrar para novo contrato:**
- Todos os agentes testados com a nova versão.
- Teste de contrato atualizado para refletir o novo schema.
- CHANGELOG do server documentado em `/docs/adr/` se a mudança impactar convenções do projeto.
- CI verde com a nova versão.

### 6. Postmortem mínimo

Registrar em `/docs/runbooks/mcp-degradado.md`:
- Qual server, versão anterior, versão nova
- Qual breaking change ocorreu
- Quanto tempo levou para detectar e resolver
- Se o teste de contrato no CI teria detectado antes — se não teria, expandir o teste

---

## Checklist de prontidão operacional

Para que este plano seja executável, os seguintes artefatos DEVEM existir no repositório antes do primeiro sprint:

- [ ] `/infra/mcp-healthcheck.ts` — script funcional, testado em dev
- [ ] `/docs/runbooks/mcp-degradado.md` — tabela de modo degradado por server (baseada na seção 8 do `arquitetura-mcp.md`)
- [ ] Canal `#novatech-alerts` no Teams configurado com webhook do Azure Monitor
- [ ] Azure Monitor Alert Rules configuradas para os 5 servers
- [ ] Teste de contrato no `ci.yml` verificando tools esperadas por server
- [ ] `SECRETS-CHANGELOG.md` criado no Azure Key Vault notes (fora do repositório Git)
- [ ] Rotação automática de credenciais configurada no Azure Key Vault (alertas de expiração 30 dias antes)
