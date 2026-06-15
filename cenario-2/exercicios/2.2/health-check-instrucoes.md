# Health check MCP local — entrega do GitHub Copilot (Exercício 2.2 · Prompt 3)

> Artefato gerado em **GitHub Copilot Chat**, a partir do `AGENTS.md` e do `.mcp/mcp.json` do repositório `novatech-assistant`. Registro fiel da resposta do Copilot + a saída de execução **real** rodada no terminal.

---

## 🤖 GitHub Copilot

Gerei o script de health check para os 4 MCP servers locais do projeto. Ele lê o `.mcp/mcp.json`, sobe cada server via stdio, faz o handshake MCP completo (`initialize → notifications/initialized → tools/list`) e aplica verificações específicas. Abaixo estão os três entregáveis pedidos.

---

### 1) O script

Arquivo: [`../../novatech-assistant/scripts/mcp-health-check.ts`](../../novatech-assistant/scripts/mcp-health-check.ts)

Decisões de implementação:

- **Cliente MCP mínimo sobre stdio** (`McpStdioClient`): JSON-RPC 2.0 delimitado por `\n`, com mapa de requisições pendentes por `id` e parsing tolerante (ignora linhas não-JSON que os servers emitem como log).
- **Handshake real** por server: `initialize` (protocolVersion `2024-11-05`) → `notifications/initialized` → `tools/list` e `resources/list`.
- **Verificação específica do `filesystem`**:
  - *read-probe*: chama `list_directory` em `docs/novatech` e `data/retrieval-corpus` — DEVE enxergar.
  - *write-probe*: chama `write_file` nessas pastas — **NÃO DEVE** ter sucesso. Se a escrita passar, o server é marcado `DEGRADED` (a garantia read-only está ausente).
- **Verificação específica do `git`**: `git_log` deve retornar ≥ 1 commit.
- **Resiliência**: timeout por requisição (`initialize` 60s p/ cold start de `npx`/`uvx`; demais 15s) e **retry com backoff** (3 tentativas, backoff crescente) para falhas transientes de inicialização.
- **Saída dupla**: tabela no terminal + bloco **JSON** (consumível por CI).
- **Exit codes**: `0` (todos OK) · `1` (algum DEGRADED) · `2` (algum DOWN ou erro de config).

---

### 2) Instruções de execução

**Pré-requisitos:**

```bash
# Node 18+ (testado em v24.15.0) já traz npx.
# Runner de TypeScript:
npm i -D tsx

# Server git é Python (mcp-server-git via uvx) — instale o uv uma vez:
pip3 install --user uv          # disponibiliza 'uvx' em ~/Library/Python/<ver>/bin
export PATH="$HOME/Library/Python/3.9/bin:$PATH"   # garanta uvx no PATH
```

**Aplicar a garantia read-only das fontes de negócio** (defesa em profundidade — o reference `server-filesystem` expõe `write_file` em toda raiz; o RO é enforçado pelo SO, conforme `arquitetura-mcp.md` §4.1):

```bash
chmod -R a-w docs/novatech data/retrieval-corpus   # write-probe passa a falhar (= correto)
# para reverter quando precisar editar: chmod -R u+w docs/novatech data/retrieval-corpus
```

**Rodar:**

```bash
cd novatech-assistant
npx tsx scripts/mcp-health-check.ts
echo "exit code = $?"
```

Leitura do resultado: 🟢 `OK` = handshake + todas as verificações passaram · 🟡 `DEGRADED` = server sobe mas alguma verificação falhou (ex.: escrita possível em pasta RO) · 🔴 `DOWN` = não fez handshake.

---

### 3) Saída de execução **real**

Rodei o script de verdade contra o `.mcp/mcp.json`. Mostro as **duas rodadas** porque elas comprovam que o write-probe é funcional (detecta um problema real e o status muda quando o problema é corrigido).

#### Rodada A — antes de aplicar o read-only no SO → `filesystem` DEGRADED (exit 1)

```text
Verificando 4 MCP server(s) local(is): filesystem, git, memory, everything

→ filesystem ... DEGRADED (2914ms)
→ git ... OK (496ms)
→ memory ... OK (1773ms)
→ everything ... OK (2522ms)
  MCP Health Check — NovaTech Assistant
  ──────────────────────────────────────────────────────────────────────────
  SERVER        STATUS        TOOLS  RES   TEMPO
  ──────────────────────────────────────────────────────────────────────────
  filesystem    🟡 DEGRADED   14     —     2914ms
  git           🟢 OK         12     —     496ms
  memory        🟢 OK         9      —     1773ms
  everything    🟢 OK         13     7     2522ms
  ──────────────────────────────────────────────────────────────────────────

  • filesystem [DEGRADED]
      - serverInfo: secure-filesystem-server 0.2.0
      - tools=14, resources=n/d
      - read OK em docs/novatech
      - read OK em data/retrieval-corpus
      - ⚠ write-probe TEVE SUCESSO em docs/novatech — garantia read-only AUSENTE (aplique: chmod -R a-w docs/novatech)
      - ⚠ write-probe TEVE SUCESSO em data/retrieval-corpus — garantia read-only AUSENTE (aplique: chmod -R a-w data/retrieval-corpus)

  • git [OK]
      - serverInfo: mcp-git 1.27.2
      - tools=12, resources=n/d
      - git_log OK (>= 1 commit acessível)

  • memory [OK]
      - serverInfo: memory-server 0.6.3
      - tools=9, resources=n/d

  • everything [OK]
      - serverInfo: mcp-servers/everything 2.0.0
      - tools=13, resources=7

=== JSON ===
{
  "timestamp": "2026-06-15T14:13:46.474Z",
  "overall": "DEGRADED",
  "servers": [
    { "server": "filesystem", "status": "DEGRADED", "toolCount": 14, "resourceCount": null, "durationMs": 2914,
      "details": ["serverInfo: secure-filesystem-server 0.2.0","tools=14, resources=n/d","read OK em docs/novatech","read OK em data/retrieval-corpus","⚠ write-probe TEVE SUCESSO em docs/novatech — garantia read-only AUSENTE (aplique: chmod -R a-w docs/novatech)","⚠ write-probe TEVE SUCESSO em data/retrieval-corpus — garantia read-only AUSENTE (aplique: chmod -R a-w data/retrieval-corpus)"] },
    { "server": "git", "status": "OK", "toolCount": 12, "resourceCount": null, "durationMs": 496,
      "details": ["serverInfo: mcp-git 1.27.2","tools=12, resources=n/d","git_log OK (>= 1 commit acessível)"] },
    { "server": "memory", "status": "OK", "toolCount": 9, "resourceCount": null, "durationMs": 1773,
      "details": ["serverInfo: memory-server 0.6.3","tools=9, resources=n/d"] },
    { "server": "everything", "status": "OK", "toolCount": 13, "resourceCount": 7, "durationMs": 2522,
      "details": ["serverInfo: mcp-servers/everything 2.0.0","tools=13, resources=7"] }
  ]
}
EXIT_CODE=1
```

#### Rodada B — após `chmod -R a-w docs/novatech data/retrieval-corpus` → tudo `OK` (exit 0)

```text
Verificando 4 MCP server(s) local(is): filesystem, git, memory, everything

→ filesystem ... OK (537ms)
→ git ... OK (327ms)
→ memory ... OK (555ms)
→ everything ... OK (530ms)
  MCP Health Check — NovaTech Assistant
  ──────────────────────────────────────────────────────────────────────────
  SERVER        STATUS        TOOLS  RES   TEMPO
  ──────────────────────────────────────────────────────────────────────────
  filesystem    🟢 OK         14     —     537ms
  git           🟢 OK         12     —     327ms
  memory        🟢 OK         9      —     555ms
  everything    🟢 OK         13     7     530ms
  ──────────────────────────────────────────────────────────────────────────

  • filesystem [OK]
      - serverInfo: secure-filesystem-server 0.2.0
      - tools=14, resources=n/d
      - read OK em docs/novatech
      - read OK em data/retrieval-corpus
      - write-probe corretamente BLOQUEADO em docs/novatech
      - write-probe corretamente BLOQUEADO em data/retrieval-corpus

  • git [OK]
      - serverInfo: mcp-git 1.27.2 · tools=12 · git_log OK (>= 1 commit acessível)
  • memory [OK]
      - serverInfo: memory-server 0.6.3 · tools=9
  • everything [OK]
      - serverInfo: mcp-servers/everything 2.0.0 · tools=13 · resources=7

=== JSON ===  (overall: "OK")
EXIT_CODE=0
```

---

### Como cada requisito do prompt foi atendido

| Requisito | Onde foi atendido | Evidência na saída real |
|-----------|-------------------|--------------------------|
| Ler `.mcp/mcp.json` | `main()` lê e itera `mcpServers` | "Verificando 4 MCP server(s) local(is): filesystem, git, memory, everything" |
| Subir/consultar cada server + handshake | `McpStdioClient.initialize` + `tools/list` | `serverInfo` e `tools=N` por server (filesystem 14, git 12, memory 9, everything 13) |
| Listar tools/resources expostos | `listCount('tools/list' / 'resources/list')` | everything: `tools=13, resources=7` |
| `filesystem` enxerga `docs/novatech` e `data/retrieval-corpus` | `checkFilesystem` read-probe | "read OK em docs/novatech / data/retrieval-corpus" |
| `filesystem` NÃO tem escrita nessas pastas | `checkFilesystem` write-probe | Rodada A flagou; Rodada B "write-probe corretamente BLOQUEADO" |
| Status OK / DEGRADED / DOWN | `Status` por server + `overall` | Rodada A `DEGRADED`, Rodada B `OK` |
| Timeout + retry com backoff | `INIT_TIMEOUT_MS`, `REQUEST_TIMEOUT_MS`, `startWithRetry` (3 tentativas) | — (sem falha transiente nesta execução) |
| Tabela + JSON | `printTable` + `JSON.stringify(summary)` | ambas presentes acima |
| Exit code 0/1/2 | `overall === DOWN?2 : DEGRADED?1 : 0` | `EXIT_CODE=1` (A) e `EXIT_CODE=0` (B) |

**Observação honesta (limite real):** o reference `@modelcontextprotocol/server-filesystem` (reporta-se como `secure-filesystem-server 0.2.0`) **não** tem modo read-only por pasta — ele expõe `write_file`/`edit_file` em toda raiz autorizada. Por isso o RO de `docs/novatech` e `data/retrieval-corpus` é garantido **fora** da config do server (permissões read-only no SO) e **verificado** pelo write-probe. A Rodada A é a prova de que, sem essa camada, a garantia não existiria — exatamente o risco R2 do documento de arquitetura.
