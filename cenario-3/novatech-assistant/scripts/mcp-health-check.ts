#!/usr/bin/env -S npx tsx
/**
 * mcp-health-check.ts — Health check ENDURECIDO dos MCP servers LOCAIS do NovaTech.
 * Gerado/endurecido com GitHub Copilot (Exercício 2.2 — Prompts 3 e 4).
 *
 * Hardening (Prompt 4):
 *   - Validação do .mcp/mcp.json com Zod (config inválida = exit 2 com erro claro).
 *   - Classificação de falha: SPAWN_ERROR | HANDSHAKE_TIMEOUT | FOLDER_INACCESSIBLE
 *     | SCOPE_DIVERGENCE | NO_TOOLS | TOOL_ERROR — cada uma com severidade e ação sugerida.
 *   - Resumo por severidade (CRITICAL/HIGH/MEDIUM/LOW).
 *   - Flags: --fail-fast (para no 1º DOWN) e --full-scan (checagens profundas).
 *   - Logs estruturados com pino (stderr, JSON); tabela/JSON-resumo no stdout.
 *
 * Status por server: OK | DEGRADED | DOWN.
 * Exit code: 0 (todos OK) | 1 (algum DEGRADED) | 2 (algum DOWN / config inválida).
 *
 * Execução:  npx tsx scripts/mcp-health-check.ts [--fail-fast] [--full-scan]
 * Requer: node, npx, e uvx no PATH (pip install uv) para o server git.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { z } from 'zod';
import pino from 'pino';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const MCP_CONFIG_PATH = join(REPO_ROOT, '.mcp', 'mcp.json');

/** Pastas read-only (fontes de negócio, ADR-0003): legíveis e NÃO graváveis. */
const READONLY_DIRS = ['docs/novatech', 'data/retrieval-corpus'];
/** Pastas com escrita autorizada (least privilege). */
const READWRITE_DIRS = ['src', 'specs', 'skills'];
/** Escopo esperado do filesystem (least privilege) — usado p/ detectar divergência. */
const EXPECTED_FS_SCOPE = [...READWRITE_DIRS, ...READONLY_DIRS].map((d) => resolve(REPO_ROOT, d));

const PROTOCOL_VERSION = '2024-11-05';
const INIT_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1_500;

// ── flags ────────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
const FAIL_FAST = ARGV.includes('--fail-fast');
const FULL_SCAN = ARGV.includes('--full-scan');

// ── logger estruturado (pino -> stderr) ──────────────────────────────────────
const log = pino(
  { level: process.env.LOG_LEVEL ?? 'info', base: { tool: 'mcp-health-check' } },
  pino.destination({ dest: 2, sync: true }),
);

// ── tipos & classificação de falha ───────────────────────────────────────────
type Status = 'OK' | 'DEGRADED' | 'DOWN';
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type FailureClass =
  | 'SPAWN_ERROR'
  | 'HANDSHAKE_TIMEOUT'
  | 'FOLDER_INACCESSIBLE'
  | 'SCOPE_DIVERGENCE'
  | 'NO_TOOLS'
  | 'TOOL_ERROR';

const FAILURE_META: Record<FailureClass, { severity: Severity; status: Status; action: string }> = {
  SPAWN_ERROR:         { severity: 'CRITICAL', status: 'DOWN',     action: 'Verifique command/args e se o runtime (npx/uvx) está no PATH; rode o comando manualmente.' },
  HANDSHAKE_TIMEOUT:   { severity: 'HIGH',     status: 'DOWN',     action: 'Aumente timeout/retries; cheque cold-start de download ou processo travado.' },
  SCOPE_DIVERGENCE:    { severity: 'CRITICAL', status: 'DEGRADED', action: 'Alinhe .mcp/mcp.json ao escopo esperado (least privilege) ou aplique read-only no SO; revise no PR.' },
  FOLDER_INACCESSIBLE: { severity: 'HIGH',     status: 'DEGRADED', action: 'Confirme que a pasta existe, está nas raízes do server e tem permissão de leitura.' },
  NO_TOOLS:            { severity: 'MEDIUM',   status: 'DEGRADED', action: 'Server subiu sem expor tools; verifique versão/args do pacote.' },
  TOOL_ERROR:          { severity: 'MEDIUM',   status: 'DEGRADED', action: 'Inspecione o erro da tool; pode ser incompatibilidade de schema entre versões.' },
};

interface Failure { class: FailureClass; detail: string; }

interface CheckResult {
  server: string;
  status: Status;
  toolCount: number | null;
  resourceCount: number | null;
  failures: Failure[];
  details: string[];
  durationMs: number;
}

// ── schema Zod do .mcp/mcp.json ──────────────────────────────────────────────
const ServerConfigSchema = z.object({
  command: z.string().min(1, 'command não pode ser vazio'),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});
const McpConfigSchema = z.object({
  mcpServers: z.record(ServerConfigSchema).refine((m) => Object.keys(m).length > 0, {
    message: 'mcpServers não pode ser vazio',
  }),
});
type ServerConfig = z.infer<typeof ServerConfigSchema>;

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
  method?: string;
}

// ── cliente MCP stdio (JSON-RPC 2.0 delimitado por newline) ──────────────────
class McpStdioClient {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: JsonRpcMessage) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  public stderr = '';
  public spawnFailed = false;

  constructor(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
    this.proc = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] }) as ChildProcessWithoutNullStreams;
    this.proc.stdout.setEncoding('utf8');
    this.proc.stderr.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk: string) => this.onStdout(chunk));
    this.proc.stderr.on('data', (chunk: string) => { this.stderr += chunk; });
    this.proc.on('error', (err) => { this.spawnFailed = true; this.failAll(err); });
    this.proc.on('exit', (code, signal) => {
      if (this.pending.size > 0) this.failAll(new Error(`processo encerrou (code=${code}, signal=${signal})`));
    });
  }

  private onStdout(chunk: string) {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg: JsonRpcMessage;
      try { msg = JSON.parse(line); } catch { continue; }
      if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        p.resolve(msg);
      }
    }
  }

  private failAll(err: Error) {
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(err); }
    this.pending.clear();
  }

  notify(method: string, params?: unknown) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  request(method: string, params: unknown, timeoutMs: number): Promise<JsonRpcMessage> {
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    return new Promise((resolveReq, rejectReq) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectReq(new Error(`timeout em '${method}' após ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveReq, reject: rejectReq, timer });
      this.proc.stdin.write(payload);
    });
  }

  async initialize(timeoutMs: number): Promise<Record<string, unknown> | undefined> {
    const res = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'mcp-health-check', version: '2.0.0' },
    }, timeoutMs);
    if (res.error) throw new Error(`initialize: ${res.error.message}`);
    this.notify('notifications/initialized');
    return res.result;
  }

  callTool(name: string, args: Record<string, unknown>, timeoutMs: number): Promise<JsonRpcMessage> {
    return this.request('tools/call', { name, arguments: args }, timeoutMs);
  }

  dispose() {
    try { this.proc.stdin.end(); } catch { /* noop */ }
    try { this.proc.kill('SIGTERM'); } catch { /* noop */ }
    setTimeout(() => { try { this.proc.kill('SIGKILL'); } catch { /* noop */ } }, 2000).unref();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resultText(res: JsonRpcMessage): string {
  const content = (res.result as { content?: Array<{ text?: string }> })?.content;
  if (Array.isArray(content)) return content.map((c) => c?.text ?? '').join('\n');
  return JSON.stringify(res.result ?? res.error ?? {});
}

function toolErrored(res: JsonRpcMessage): boolean {
  return !!res.error || (res.result as Record<string, unknown>)?.isError === true;
}

async function startWithRetry(name: string, cfg: ServerConfig, env: NodeJS.ProcessEnv, details: string[]) {
  let lastErr: Error | null = null;
  let spawnFailed = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const client = new McpStdioClient(cfg.command, cfg.args ?? [], REPO_ROOT, env);
    try {
      const result = await client.initialize(INIT_TIMEOUT_MS);
      if (attempt > 1) details.push(`handshake OK na tentativa ${attempt}/${MAX_ATTEMPTS}`);
      log.info({ server: name, attempt }, 'handshake.ok');
      return { client, serverInfo: (result?.serverInfo as Record<string, unknown>) ?? undefined };
    } catch (err) {
      lastErr = err as Error;
      spawnFailed = spawnFailed || client.spawnFailed;
      client.dispose();
      log.warn({ server: name, attempt, err: lastErr.message }, 'handshake.retry');
      if (attempt < MAX_ATTEMPTS) {
        const backoff = BACKOFF_BASE_MS * attempt;
        details.push(`tentativa ${attempt} falhou (${lastErr.message}); retry com backoff ${backoff}ms`);
        await sleep(backoff);
      }
    }
  }
  const klass: FailureClass = spawnFailed ? 'SPAWN_ERROR' : 'HANDSHAKE_TIMEOUT';
  throw Object.assign(lastErr ?? new Error('falha ao iniciar'), { failureClass: klass });
}

async function listCount(client: McpStdioClient, method: 'tools/list' | 'resources/list' | 'prompts/list'): Promise<number | null> {
  try {
    const res = await client.request(method, {}, REQUEST_TIMEOUT_MS);
    if (res.error) return null;
    const key = method.split('/')[0];
    const arr = (res.result as Record<string, unknown>)?.[key];
    return Array.isArray(arr) ? arr.length : null;
  } catch { return null; }
}

async function checkFilesystem(client: McpStdioClient, failures: Failure[], details: string[]) {
  // 1) escopo: list_allowed_directories vs EXPECTED_FS_SCOPE (least privilege)
  try {
    const res = await client.callTool('list_allowed_directories', {}, REQUEST_TIMEOUT_MS);
    const allowed = resultText(res).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('/')).map((p) => resolve(p));
    const expected = new Set(EXPECTED_FS_SCOPE);
    const extras = allowed.filter((p) => !expected.has(p));
    const missing = EXPECTED_FS_SCOPE.filter((p) => !allowed.includes(p));
    if (extras.length) {
      failures.push({ class: 'SCOPE_DIVERGENCE', detail: `raiz(es) além do esperado: ${extras.join(', ')}` });
      details.push(`⚠ escopo MAIS amplo que o esperado: ${extras.join(', ')}`);
    }
    if (missing.length) {
      failures.push({ class: 'SCOPE_DIVERGENCE', detail: `raiz(es) esperada(s) ausente(s): ${missing.join(', ')}` });
      details.push(`⚠ escopo faltando: ${missing.join(', ')}`);
    }
    if (!extras.length && !missing.length) details.push(`escopo confere com least privilege (${allowed.length} raízes)`);
  } catch (e) {
    details.push(`não foi possível listar escopo: ${(e as Error).message}`);
  }

  // 2) read-probe nas pastas read-only
  for (const dir of READONLY_DIRS) {
    const abs = join(REPO_ROOT, dir);
    try {
      const res = await client.callTool('list_directory', { path: abs }, REQUEST_TIMEOUT_MS);
      if (toolErrored(res)) {
        failures.push({ class: 'FOLDER_INACCESSIBLE', detail: `${dir}: ${res.error?.message ?? 'isError'}` });
        details.push(`READ FALHOU em ${dir}`);
      } else { details.push(`read OK em ${dir}`); }
    } catch (e) {
      failures.push({ class: 'FOLDER_INACCESSIBLE', detail: `${dir}: ${(e as Error).message}` });
    }
  }

  // 3) write-probe: NÃO deve ter sucesso nas pastas read-only
  for (const dir of READONLY_DIRS) {
    const abs = join(REPO_ROOT, dir, '.mcp-health-write-probe.tmp');
    try {
      const res = await client.callTool('write_file', { path: abs, content: 'write-probe (deve falhar)' }, REQUEST_TIMEOUT_MS);
      if (toolErrored(res)) {
        details.push(`write-probe corretamente BLOQUEADO em ${dir}`);
      } else {
        failures.push({ class: 'SCOPE_DIVERGENCE', detail: `escrita possível em pasta read-only ${dir}` });
        details.push(`⚠ write-probe TEVE SUCESSO em ${dir} — read-only AUSENTE (chmod -R a-w ${dir})`);
        if (existsSync(abs)) { try { unlinkSync(abs); } catch { /* noop */ } }
      }
    } catch (e) { details.push(`write-probe bloqueado em ${dir} (${(e as Error).message})`); }
  }

  // 4) full-scan: sanity de escrita NAS pastas RW
  if (FULL_SCAN) {
    for (const dir of READWRITE_DIRS) {
      const abs = join(REPO_ROOT, dir, '.mcp-health-write-probe.tmp');
      try {
        const res = await client.callTool('write_file', { path: abs, content: 'rw-sanity' }, REQUEST_TIMEOUT_MS);
        if (toolErrored(res)) {
          failures.push({ class: 'FOLDER_INACCESSIBLE', detail: `escrita esperada falhou em ${dir}` });
          details.push(`⚠ [full-scan] escrita FALHOU em ${dir} (esperava-se RW)`);
        } else {
          details.push(`[full-scan] escrita OK em ${dir} (RW esperado)`);
          if (existsSync(abs)) { try { unlinkSync(abs); } catch { /* noop */ } }
        }
      } catch (e) { details.push(`[full-scan] erro de escrita em ${dir}: ${(e as Error).message}`); }
    }
  }
}

async function checkGit(client: McpStdioClient, failures: Failure[], details: string[]) {
  try {
    const res = await client.callTool('git_log', { repo_path: REPO_ROOT, max_count: 1 }, REQUEST_TIMEOUT_MS);
    if (toolErrored(res)) {
      failures.push({ class: 'TOOL_ERROR', detail: `git_log: ${res.error?.message ?? 'sem histórico'}` });
      details.push('git_log falhou (rode git commit inicial?)');
    } else { details.push('git_log OK (>= 1 commit acessível)'); }
  } catch (e) {
    failures.push({ class: 'TOOL_ERROR', detail: `git_log: ${(e as Error).message}` });
  }
}

/** Deriva status do server a partir das falhas classificadas. */
function deriveStatus(failures: Failure[]): Status {
  if (failures.some((f) => FAILURE_META[f.class].status === 'DOWN')) return 'DOWN';
  if (failures.length > 0) return 'DEGRADED';
  return 'OK';
}

async function checkServer(name: string, cfg: ServerConfig): Promise<CheckResult> {
  const started = Date.now();
  const details: string[] = [];
  const failures: Failure[] = [];
  const env: NodeJS.ProcessEnv = { ...process.env, ...(cfg.env ?? {}) };
  let client: McpStdioClient | null = null;
  log.info({ server: name, command: cfg.command }, 'server.check.start');

  try {
    const { client: c, serverInfo } = await startWithRetry(name, cfg, env, details);
    client = c;
    if (serverInfo?.name) details.push(`serverInfo: ${String(serverInfo.name)} ${String(serverInfo.version ?? '')}`.trim());

    const toolCount = await listCount(client, 'tools/list');
    const resourceCount = await listCount(client, 'resources/list');
    const promptCount = FULL_SCAN ? await listCount(client, 'prompts/list') : null;
    details.push(`tools=${toolCount ?? 'n/d'}, resources=${resourceCount ?? 'n/d'}${FULL_SCAN ? `, prompts=${promptCount ?? 'n/d'}` : ''}`);
    if (!(toolCount && toolCount > 0)) failures.push({ class: 'NO_TOOLS', detail: 'handshake sem tools' });

    if (name === 'filesystem') await checkFilesystem(client, failures, details);
    else if (name === 'git') await checkGit(client, failures, details);

    const status = deriveStatus(failures);
    log.info({ server: name, status, toolCount, resourceCount, failures: failures.map((f) => f.class) }, 'server.check.result');
    return { server: name, status, toolCount, resourceCount, failures, details, durationMs: Date.now() - started };
  } catch (err) {
    const klass = (err as { failureClass?: FailureClass }).failureClass ?? 'SPAWN_ERROR';
    failures.push({ class: klass, detail: (err as Error).message });
    if (client?.stderr) details.push(`stderr: ${client.stderr.split('\n').filter(Boolean).slice(0, 3).join(' | ')}`);
    log.error({ server: name, failureClass: klass, err: (err as Error).message }, 'server.check.down');
    return { server: name, status: 'DOWN', toolCount: null, resourceCount: null, failures, details, durationMs: Date.now() - started };
  } finally {
    client?.dispose();
  }
}

// ── relatório ─────────────────────────────────────────────────────────────────
function printTable(results: CheckResult[]) {
  const icon = (s: Status) => (s === 'OK' ? '🟢' : s === 'DEGRADED' ? '🟡' : '🔴');
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(`\n  MCP Health Check (hardened) — NovaTech Assistant${FULL_SCAN ? ' [full-scan]' : ''}${FAIL_FAST ? ' [fail-fast]' : ''}`);
  console.log('  ' + '─'.repeat(74));
  console.log('  ' + pad('SERVER', 14) + pad('STATUS', 14) + pad('TOOLS', 7) + pad('RES', 6) + 'TEMPO');
  console.log('  ' + '─'.repeat(74));
  for (const r of results) {
    console.log('  ' + pad(r.server, 14) + pad(`${icon(r.status)} ${r.status}`, 14) +
      pad(String(r.toolCount ?? '—'), 7) + pad(String(r.resourceCount ?? '—'), 6) + `${r.durationMs}ms`);
  }
  console.log('  ' + '─'.repeat(74));
  for (const r of results) {
    console.log(`\n  • ${r.server} [${r.status}]`);
    for (const d of r.details) console.log(`      - ${d}`);
    for (const f of r.failures) {
      const m = FAILURE_META[f.class];
      console.log(`      ✗ [${m.severity}] ${f.class}: ${f.detail}`);
      console.log(`        ↳ ação: ${m.action}`);
    }
  }
}

function printSeveritySummary(results: CheckResult[]) {
  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of results) for (const f of r.failures) counts[FAILURE_META[f.class].severity]++;
  console.log('\n  Resumo por severidade:');
  console.log('  ' + order.map((s) => `${s}=${counts[s]}`).join('  '));
  return counts;
}

async function main() {
  // 1) validação Zod do .mcp/mcp.json
  if (!existsSync(MCP_CONFIG_PATH)) {
    log.error({ path: MCP_CONFIG_PATH }, 'config.missing');
    console.error(`Config MCP não encontrada: ${MCP_CONFIG_PATH}`);
    process.exit(2);
  }
  let parsed: z.infer<typeof McpConfigSchema>;
  try {
    const raw = JSON.parse(readFileSync(MCP_CONFIG_PATH, 'utf8'));
    parsed = McpConfigSchema.parse(raw);
    log.info({ servers: Object.keys(parsed.mcpServers) }, 'config.valid');
  } catch (err) {
    log.error({ err: err instanceof z.ZodError ? err.issues : (err as Error).message }, 'config.invalid');
    console.error('❌ .mcp/mcp.json inválido:');
    if (err instanceof z.ZodError) for (const i of err.issues) console.error(`   - ${i.path.join('.') || '(root)'}: ${i.message}`);
    else console.error(`   - ${(err as Error).message}`);
    process.exit(2);
  }

  const servers = parsed.mcpServers;
  const names = Object.keys(servers);
  console.log(`Verificando ${names.length} MCP server(s) local(is): ${names.join(', ')}`);

  const results: CheckResult[] = [];
  for (const name of names) {
    process.stdout.write(`\n→ ${name} ... `);
    const r = await checkServer(name, servers[name]);
    process.stdout.write(`${r.status} (${r.durationMs}ms)`);
    results.push(r);
    if (FAIL_FAST && r.status === 'DOWN') {
      console.log(`\n\n⏹  --fail-fast: server '${name}' DOWN — interrompendo (${names.length - results.length} não verificados).`);
      log.error({ server: name }, 'fail-fast.abort');
      break;
    }
  }

  printTable(results);
  printSeveritySummary(results);

  const overall: Status = results.some((r) => r.status === 'DOWN') ? 'DOWN'
    : results.some((r) => r.status === 'DEGRADED') ? 'DEGRADED' : 'OK';
  const summary = { timestamp: new Date().toISOString(), overall, failFast: FAIL_FAST, fullScan: FULL_SCAN, servers: results };
  console.log('\n=== JSON ===');
  console.log(JSON.stringify(summary, null, 2));
  log.info({ overall }, 'run.complete');

  process.exit(overall === 'DOWN' ? 2 : overall === 'DEGRADED' ? 1 : 0);
}

main().catch((err) => { log.error({ err: (err as Error).message }, 'fatal'); console.error('Erro fatal:', err); process.exit(2); });
