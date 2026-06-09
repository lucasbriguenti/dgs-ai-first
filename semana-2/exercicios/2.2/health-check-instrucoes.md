# Health Check MCP - NovaTech

## Arquivos

- `mcp-health-check.ts`: script principal em TypeScript
- `mcp.servers.json`: exemplo de configuracao dos servidores

## Como executar

Opcao 1 (recomendada, sem setup local):

```bash
npx -y -p tsx -p zod tsx semana-2/exercicios/2.2/mcp-health-check.ts semana-2/exercicios/2.2/mcp.servers.json --full-scan
```

Opcao 2 (com TypeScript instalado no projeto):

```bash
npm install --save zod
npx tsc semana-2/exercicios/2.2/mcp-health-check.ts --target es2022 --module nodenext --outDir semana-2/exercicios/2.2/dist
node semana-2/exercicios/2.2/dist/mcp-health-check.js semana-2/exercicios/2.2/mcp.servers.json --full-scan
```

Opcao 3 (scripts npm para CI):

```bash
cd semana-2/exercicios/2.2
npm run health:full
npm run health:fail-fast
```

Modos de execucao:

- `--full-scan` (padrao): verifica todos os servidores mesmo com falhas.
- `--fail-fast`: interrompe no primeiro servidor com status `DOWN`.

Observacao: a ordem dos argumentos pode ser `script <config> <modo>`.

## Hardening para CI

- Validacao de schema com Zod para `mcp.servers.json`.
- Classificacao de falhas: `network`, `auth`, `timeout`, `contract`, `unknown`.
- Resumo por severidade no JSON: `INFO`, `WARN`, `CRITICAL`.
- Recomendacao automatica por tipo de falha em cada servidor.
- Logs estruturados JSON (`run.start`, `attempt.start`, `attempt.failure`, `attempt.retry_scheduled`, `run.end`).

## Regras de status

- `OK`: respondeu no primeiro attempt com status esperado.
- `DEGRADED`: recuperou apos retry por falha transiente.
- `DOWN`: falhou em todos os attempts, timeout, erro de rede ou config invalida.

## Exit code

- `0`: todos os servidores `OK`
- `1`: existe ao menos um servidor `DEGRADED` e nenhum `DOWN`
- `2`: existe ao menos um servidor `DOWN`

## Exemplo de output (resumido)

Tabela no terminal:

```text
MCP Health Check

┌─────────┬──────────────────────────┬───────────┬────────────┬──────────┬───────────┬──────────────────────────────────────────┐
│ (index) │ server                   │ transport │ status     │ attempts │ latencyMs │ detail                                   │
├─────────┼──────────────────────────┼───────────┼────────────┼──────────┼───────────┼──────────────────────────────────────────┤
│ 0       │ 'github-mcp'             │ 'stdio'   │ 'OK'       │ 1        │ 180       │ 'initialize response received'           │
│ 1       │ 'azure-ai-search-mcp'    │ 'http'    │ 'DEGRADED' │ 2        │ 742       │ 'recovered after retries: HTTP 200...'  │
│ 2       │ 'confluence-mcp'         │ 'http'    │ 'DOWN'     │ 3        │ 4000      │ 'timeout after 4000ms'                   │
└─────────┴──────────────────────────┴───────────┴────────────┴──────────┴───────────┴──────────────────────────────────────────┘
```

JSON no terminal:

```json
{
  "generatedAt": "2026-06-09T12:00:00.000Z",
  "summary": {
    "total": 3,
    "ok": 1,
    "degraded": 1,
    "down": 1
  },
  "servers": [
    {
      "name": "github-mcp",
      "transport": "stdio",
      "status": "OK",
      "attempts": 1,
      "latencyMs": 180,
      "detail": "initialize response received"
    }
  ]
}
```
