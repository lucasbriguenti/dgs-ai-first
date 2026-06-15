# Hardening do health check MCP — entrega do GitHub Copilot (Exercício 2.2 · Prompt 4)

> Endurecimento do script de [Prompt 3](./health-check-instrucoes.md) para uso recorrente pelo time. Registro fiel da resposta do GitHub Copilot Chat + saída de execução **real**.
> Script: [`../../novatech-assistant/scripts/mcp-health-check.ts`](../../novatech-assistant/scripts/mcp-health-check.ts) (evoluído no lugar — a v1 fica preservada no histórico do Git).

---

## 🤖 GitHub Copilot

Endureci o script com tudo que foi pedido. Resumo do que mudou:

| Requisito (Prompt 4) | Implementação |
|----------------------|---------------|
| Validação do `.mcp/mcp.json` com **Zod** | `McpConfigSchema`/`ServerConfigSchema`; config inválida → erro legível + `exit 2` |
| **Classificação da falha** | enum `FailureClass`: `SPAWN_ERROR` (não inicia), `HANDSHAKE_TIMEOUT` (timeout no handshake), `FOLDER_INACCESSIBLE` (pasta inacessível), `SCOPE_DIVERGENCE` (escopo divergente do esperado), `NO_TOOLS`, `TOOL_ERROR` |
| **Resumo por severidade** | `printSeveritySummary` conta CRITICAL/HIGH/MEDIUM/LOW entre todos os servers |
| **Ação sugerida por tipo** | `FAILURE_META[class].action` impresso sob cada falha |
| Flag **`--fail-fast`** | para no 1º server `DOWN` e reporta quantos ficaram sem verificar |
| Flag **`--full-scan`** | checa escopo vs. esperado, sanity de escrita nas pastas RW, e `prompts/list` |
| **Logs estruturados (pino)** | eventos `config.valid`, `server.check.start/result/down`, `run.complete` em JSON no stderr |

### Classificação de falha → severidade → status → ação

| Classe | Severidade | Status | Ação sugerida |
|--------|:---------:|:------:|---------------|
| `SPAWN_ERROR` | CRITICAL | DOWN | Verificar command/args e runtime (npx/uvx) no PATH; rodar o comando manualmente |
| `HANDSHAKE_TIMEOUT` | HIGH | DOWN | Aumentar timeout/retries; checar cold-start de download ou processo travado |
| `SCOPE_DIVERGENCE` | CRITICAL | DEGRADED | Alinhar `.mcp/mcp.json` ao escopo esperado (least privilege) ou aplicar read-only no SO; revisar no PR |
| `FOLDER_INACCESSIBLE` | HIGH | DEGRADED | Confirmar que a pasta existe, está nas raízes do server e tem permissão de leitura |
| `NO_TOOLS` | MEDIUM | DEGRADED | Server subiu sem tools; verificar versão/args do pacote |
| `TOOL_ERROR` | MEDIUM | DEGRADED | Inspecionar o erro da tool; possível incompatibilidade de schema entre versões |

---

## Saída de execução **real**

### Execução A — `npx tsx scripts/mcp-health-check.ts --full-scan` → tudo OK (exit 0)

```text
Verificando 4 MCP server(s) local(is): filesystem, git, memory, everything

→ filesystem ... OK (679ms)
→ git ... OK (670ms)
→ memory ... OK (587ms)
→ everything ... OK (940ms)
  MCP Health Check (hardened) — NovaTech Assistant [full-scan]
  ──────────────────────────────────────────────────────────────────────────
  SERVER        STATUS        TOOLS  RES   TEMPO
  ──────────────────────────────────────────────────────────────────────────
  filesystem    🟢 OK         14     —     679ms
  git           🟢 OK         12     —     670ms
  memory        🟢 OK         9      —     587ms
  everything    🟢 OK         13     7     940ms
  ──────────────────────────────────────────────────────────────────────────

  • filesystem [OK]
      - serverInfo: secure-filesystem-server 0.2.0
      - tools=14, resources=n/d, prompts=n/d
      - escopo confere com least privilege (5 raízes)
      - read OK em docs/novatech
      - read OK em data/retrieval-corpus
      - write-probe corretamente BLOQUEADO em docs/novatech
      - write-probe corretamente BLOQUEADO em data/retrieval-corpus
      - [full-scan] escrita OK em src (RW esperado)
      - [full-scan] escrita OK em specs (RW esperado)
      - [full-scan] escrita OK em skills (RW esperado)
  • git [OK]
      - serverInfo: mcp-git 1.27.2 · tools=12 · git_log OK (>= 1 commit acessível)
  • memory [OK]
      - serverInfo: memory-server 0.6.3 · tools=9
  • everything [OK]
      - serverInfo: mcp-servers/everything 2.0.0 · tools=13 · resources=7 · prompts=4

  Resumo por severidade:
  CRITICAL=0  HIGH=0  MEDIUM=0  LOW=0

=== JSON ===  (overall: "OK", fullScan: true, failFast: false)
EXIT_CODE=0
```

**Logs estruturados pino (stderr) da Execução A:**

```json
{"level":30,"tool":"mcp-health-check","servers":["filesystem","git","memory","everything"],"msg":"config.valid"}
{"level":30,"tool":"mcp-health-check","server":"filesystem","command":"npx","msg":"server.check.start"}
{"level":30,"tool":"mcp-health-check","server":"filesystem","attempt":1,"msg":"handshake.ok"}
{"level":30,"tool":"mcp-health-check","server":"filesystem","status":"OK","toolCount":14,"resourceCount":null,"failures":[],"msg":"server.check.result"}
{"level":30,"tool":"mcp-health-check","server":"git","command":"uvx","msg":"server.check.start"}
{"level":30,"tool":"mcp-health-check","server":"git","attempt":1,"msg":"handshake.ok"}
{"level":30,"tool":"mcp-health-check","server":"git","status":"OK","toolCount":12,"msg":"server.check.result"}
... (memory, everything análogos) ...
{"level":30,"tool":"mcp-health-check","overall":"OK","msg":"run.complete"}
```

### Execução B — `--fail-fast` com server quebrado injetado → DOWN/abort (exit 2)

> Injetei temporariamente um server `broken` (binário inexistente) no `.mcp/mcp.json` para provar a classificação de falha e o `--fail-fast`, e restaurei o arquivo em seguida.

```text
Verificando 5 MCP server(s) local(is): broken, filesystem, git, memory, everything

→ broken ... DOWN (4526ms)

⏹  --fail-fast: server 'broken' DOWN — interrompendo (4 não verificados).

  MCP Health Check (hardened) — NovaTech Assistant [fail-fast]
  ──────────────────────────────────────────────────────────────────────────
  SERVER        STATUS        TOOLS  RES   TEMPO
  ──────────────────────────────────────────────────────────────────────────
  broken        🔴 DOWN       —      —     4526ms
  ──────────────────────────────────────────────────────────────────────────

  • broken [DOWN]
      - tentativa 1 falhou (spawn this-binary-does-not-exist-xyz ENOENT); retry com backoff 1500ms
      - tentativa 2 falhou (spawn this-binary-does-not-exist-xyz ENOENT); retry com backoff 3000ms
      ✗ [CRITICAL] SPAWN_ERROR: spawn this-binary-does-not-exist-xyz ENOENT
        ↳ ação: Verifique command/args e se o runtime (npx/uvx) está no PATH; rode o comando manualmente.

  Resumo por severidade:
  CRITICAL=1  HIGH=0  MEDIUM=0  LOW=0

=== JSON ===  (overall: "DOWN", failFast: true)
EXIT_CODE=2
```

Esta execução prova, com saída real: **(1)** classificação `SPAWN_ERROR` com severidade CRITICAL; **(2)** retry com backoff (2 retries, 1500ms→3000ms) antes de declarar DOWN; **(3)** `--fail-fast` interrompendo e contando os não verificados; **(4)** resumo por severidade e exit code 2.

---

## Riscos residuais (5)

1. **Read-only é validado num instante, não continuamente.** O write-probe confirma o estado *no momento da execução*; entre rodadas alguém pode rodar `chmod u+w` ou reconfigurar o server. → *Mitigação:* rodar o health check no **CI a cada PR** que toque `.mcp/`, `docs/novatech/` ou `data/retrieval-corpus/`, e idealmente montar essas pastas read-only no container de CI.

2. **A garantia RO depende do SO, não do MCP server.** O `secure-filesystem-server` expõe `write_file` em toda raiz; a proteção vem de permissões locais (`chmod -R a-w`). Num clone novo, em outro usuário, ou como root, a proteção desaparece. → *Mitigação:* script de bootstrap que reaplica o `chmod` no setup, documentado no README; bind mount RO onde possível.

3. **Liveness ≠ correctness.** O check confirma que o server responde e lista tools, mas não valida que cada tool retorna *dados corretos*. Um server pode estar `OK` e ainda assim devolver conteúdo errado. → *Mitigação:* smoke test de tools críticas no `--full-scan` (ex.: `read_file` de um doc conhecido e comparar hash/título esperado).

4. **Versões dos servers não estão pinadas.** `npx -y` e `uvx` baixam a última versão; uma atualização pode renomear tools (ex.: `read_file` → `read_text_file`) e quebrar os probes sem que o server fique `DOWN` (vira falso-OK ou `TOOL_ERROR`). → *Mitigação:* pinar versões no `.mcp/mcp.json`/lockfile e alertar quando o conjunto de tools mudar entre execuções.

5. **`memory` e `everything` só têm verificação rasa (handshake + tools).** O grafo do `memory` pode estar corrompido ou crescer demais; o `everything` poderia receber dados indevidos. → *Mitigação:* para `memory`, checar `read_graph` responde e medir o tamanho do grafo; aplicar a política de conteúdo (sem PII/segredo); `everything` é candidato a remoção quando o time dominar MCP (arquitetura §5.5).

---

## Critérios verificáveis (Prompt 4)

- [x] `.mcp/mcp.json` validado com Zod (erro claro + exit 2 em config inválida).
- [x] Falhas classificadas em 6 classes, cada uma com severidade, status e ação.
- [x] Resumo por severidade impresso (CRITICAL/HIGH/MEDIUM/LOW).
- [x] Flags `--fail-fast` e `--full-scan` implementadas e **demonstradas com saída real**.
- [x] Logs estruturados pino (stderr), tabela + JSON no stdout.
- [x] Seção "Riscos residuais" com 5 pontos.
- [x] Saída de **nova execução real** colada (Execução A full-scan + Execução B fail-fast).
