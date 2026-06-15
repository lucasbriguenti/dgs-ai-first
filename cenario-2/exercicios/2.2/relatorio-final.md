# Relatório Final — Tech Lead 2.2 (Arquitetura de MCP — servers locais)

**Projeto:** NovaTech Assistant
**Papel:** Tech Lead
**Ferramentas:** Claude (chat) no design · GitHub Copilot no script · execução real local
**Data:** 2026-06-15
**Artefatos:** arquitetura-mcp.md · diagrama-e-matriz-permissoes.md · health-check-instrucoes.md · health-check-hardening.md · plano-contingencia.md · politica-aprovacao-mcp-server.md · `novatech-assistant/.mcp/mcp.json` · `novatech-assistant/scripts/mcp-health-check.ts`

---

## 1. Resumo executivo

A arquitetura de MCP foi definida tratando os 4 servers locais (`filesystem`, `git`, `memory`, `everything`) como **infraestrutura gerenciada**: versionados no `.mcp/mcp.json`, com **least privilege** justificado por server, **observáveis** via health check executável e governados por **política de aprovação** e **plano de contingência**. O health check foi **executado de verdade** contra os 4 servers vivos — handshake MCP, enumeração de tools/resources/prompts e probes de acesso. A decisão técnica central é honesta sobre uma limitação real: o reference `@modelcontextprotocol/server-filesystem` (reporta-se como `secure-filesystem-server 0.2.0`) **não** tem modo read-only por pasta — expõe `write_file` em toda raiz. Por isso o RO de `docs/novatech` e `data/retrieval-corpus` é garantido por **defesa em profundidade** (permissões read-only no SO) e **verificado por write-probe**. A primeira execução comprovou isso: sem o `chmod`, o write-probe teve sucesso e o filesystem foi corretamente marcado `DEGRADED` (exit 1); após aplicar a mitigação prescrita, virou `OK` (exit 0). O script foi então endurecido (Zod, classificação de falha, severidade, flags, pino) e reexecutado com `--full-scan` (tudo `OK`) e com um server quebrado injetado para provar `--fail-fast` + `SPAWN_ERROR` (exit 2).

---

## 2. Evidências de uso das ferramentas

| Ferramenta | Onde foi usada | Artefato |
|---|---|---|
| **Claude (chat)** | Design: arquitetura, diagrama + matriz, contingência, política de aprovação, este relatório | 6 documentos `.md` |
| **GitHub Copilot** | Geração do script de health check (v1) e do hardening (Zod/pino/flags/classificação) | `scripts/mcp-health-check.ts` |
| **Execução real** | Rodar o health check contra os 4 servers locais vivos | saídas em §2.1 / health-check-*.md |

### 2.1 Saída real do health check (servers vivos confirmados pelo handshake)

| Server | serverInfo | tools | resources | prompts |
|---|---|---:|---:|---:|
| filesystem | secure-filesystem-server 0.2.0 | 14 | — | — |
| git | mcp-git 1.27.2 | 12 | — | — |
| memory | memory-server 0.6.3 | 9 | — | — |
| everything | mcp-servers/everything 2.0.0 | 13 | 7 | 4 |

| Execução | Comando | Resultado | Exit |
|---|---|---|---|
| v1 — rodada A | `tsx mcp-health-check.ts` | filesystem `DEGRADED` (write-probe teve sucesso na pasta RO) | **1** |
| v1 — rodada B | idem, após `chmod -R a-w docs/novatech data/retrieval-corpus` | todos `OK` (write-probe bloqueado) | **0** |
| endurecido — A | `... --full-scan` | todos `OK`; escopo confere com least privilege (5 raízes); pino logs | **0** |
| endurecido — B | `... --fail-fast` (server `broken` injetado) | `SPAWN_ERROR`/CRITICAL; retry backoff 1500→3000ms; abort | **2** |

---

## 3. MCP local como infraestrutura gerenciada

| Pilar | Como foi materializado |
|---|---|
| **Escopo** | `filesystem` estreitado de `./docs ./data` (exemplo do starter) para `./docs/novatech ./data/retrieval-corpus` + `./src ./specs ./skills`; raiz `.`, `.env`, `.git`, `node_modules`, `infra` **fora** de qualquer raiz. |
| **Permissões** | Matriz de 7 colunas (server × primitiva × pasta × RO/RW × papel × justificativa × risco) com linhas `DENY` explícitas (deny-by-default auditável). `docs/novatech` e `data/retrieval-corpus` sempre RO. |
| **Versionamento** | `.mcp/mcp.json` no Git; mudança só por PR; matriz é o *contrato* (muda no mesmo PR); procedimento para mudança breaking (estreitar/remover raiz). |
| **Observabilidade** | `mcp-health-check.ts` lê o `mcp.json`, sobe cada server, faz handshake, lista tools/resources, prova RO por write-probe e escopo por `list_allowed_directories`; estados `OK/DEGRADED/DOWN`, exit 0/1/2, tabela + JSON + logs pino; rodável local e no CI. |
| **Governança** | Política de aprovação por nível de risco + plano de contingência "degradar com aviso, nunca alucinar". |

---

## 4. Decisões e trade-offs

| Decisão | Trade-off | Por que vale |
|---|---|---|
| **Least privilege** estreitando escopo do filesystem | Agente perde acesso a `docs/adr`, `docs/runbooks`, `docs/onboarding` | Essas pastas não entram no loop de geração; reduz exposição e ruído de contexto |
| **RO via permissões do SO**, não config do server | Passo extra de setup (`chmod -R a-w`), reversível | O reference server não tem RO por pasta; defesa em profundidade + write-probe é a forma honesta e verificável de garantir |
| **`git` somente leitura** | Agente não comita/branqueia via MCP | Commit é decisão humana revisada (validation gate de PR) — não pode ser burlado pelo agente |
| **Servers locais via `npx`/`uvx`** | Cold start (download) na 1ª execução; versões não pinadas por padrão | Custo zero, sem dependência externa/paga, e health check com retry/backoff absorve o cold start |
| **Evoluir o script no lugar (v1 → endurecido)** | v1 não fica como arquivo separado | Histórico do Git preserva a v1; a saída da v1 está registrada em `health-check-instrucoes.md` |

---

## 5. Riscos abertos e mitigação

| # | Risco | Mitigação |
|---|---|---|
| 1 | RO validado num instante, não continuamente; clone novo não reaplica `chmod` | Rodar o health check no **CI a cada PR** que toque `.mcp/` ou as pastas RO; bootstrap reaplica `chmod`; mount RO em container |
| 2 | Versões dos servers não pinadas — update pode renomear tools e gerar falso-OK | Pinar versões no `.mcp/mcp.json`/lockfile; alertar quando o conjunto de tools mudar |
| 3 | Liveness ≠ correctness — server `OK` pode retornar dado errado | Smoke test de tools críticas no `--full-scan` (ex.: `read_file` de doc conhecido + hash esperado) |
| 4 | `memory`/`everything` com checagem rasa (só handshake + tools) | Para `memory`, checar `read_graph` + tamanho do grafo; `everything` é candidato a remoção (política §7) |
| 5 | Mudança de escopo em PR pode quebrar fluxo silenciosamente | `SCOPE_DIVERGENCE` no health check + matriz-contrato atualizada no mesmo PR + revisão obrigatória |

---

## 6. Checklist de aderência aos critérios da avaliação 2.2

| Critério (rubrica) | Evidência | Status |
|---|---|---|
| MCP como infraestrutura (versionamento, monitoramento, política de aprovação) | arquitetura §1/§5/§6/§7 + política de aprovação + `.mcp/mcp.json` versionado | ✅ |
| Diagrama de conexões (quem consome o quê, com permissões) | Mermaid detalhado + matriz de 7 colunas (RO/RW/DENY por pasta) | ✅ |
| **Script de health check executado** (lê mcp.json, sobe/consulta cada server, reporta status, **saída real**, gerado com Copilot) | `mcp-health-check.ts` + 4 execuções reais com output colado (exit 0/1/2) | ✅ |
| Plano de contingência realista (degradado > quebrado, nunca alucina) | 5 cenários com 5 passos; invariante "nunca fabricar source_document"; proíbe "parar tudo" | ✅ |
| Política de aprovação equilibrada (agilidade + segurança) | 3 níveis de risco (baixo same-day/1 revisor → alto piloto+2 revisores+ADR) + policy-as-code YAML | ✅ |
| Least privilege concreto | escopo estreitado vs. starter; raízes de segredo excluídas; justificativa por linha | ✅ |
| RO nas fontes de negócio | `docs/novatech` e `data/retrieval-corpus` RO em toda a matriz; write-probe prova enforcement | ✅ |

---

## 7. Conclusão de prontidão

**Pronto para uso pelo time (com ressalvas operacionais).**

A arquitetura de MCP local está completa e **comprovada com execução real**: os 4 servers sobem, respondem ao handshake e expõem tools/resources/prompts; o least privilege foi aplicado de forma concreta e verificável; o RO das fontes de negócio é garantido por defesa em profundidade e **provado** pelo write-probe (o ciclo `DEGRADED → mitigação → OK` é a evidência mais forte de que o health check é funcional, não conceitual). Governança (contingência + política de aprovação) cobre operação e evolução.

**Ressalvas para uso pleno:**
1. Integrar o health check ao **CI** (gate de PR para `.mcp/` e pastas RO) — hoje é rodado localmente.
2. **Pinar versões** dos servers no `.mcp/mcp.json`/lockfile antes de uso amplo.
3. Adicionar **bootstrap** que reaplica `chmod -R a-w` nas fontes de negócio em clone/setup novo.
