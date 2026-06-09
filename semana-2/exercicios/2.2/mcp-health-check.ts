#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { z } from "zod";

type Status = "OK" | "DEGRADED" | "DOWN";
type Transport = "http" | "stdio";
type RunMode = "fail-fast" | "full-scan";
type FailureType = "none" | "network" | "auth" | "timeout" | "contract" | "unknown";
type Severity = "INFO" | "WARN" | "CRITICAL";
type LogLevel = "INFO" | "WARN" | "ERROR";

type EnvMap = Record<string, string>;

type HttpServerConfig = {
  name: string;
  transport: "http";
  url: string;
  timeoutMs?: number;
  retries?: number;
  backoffBaseMs?: number;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: unknown;
  expectStatus?: number[];
};

type StdioServerConfig = {
  name: string;
  transport: "stdio";
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  retries?: number;
  backoffBaseMs?: number;
  env?: EnvMap;
};

type ServerConfig = HttpServerConfig | StdioServerConfig;

type ConfigFile = {
  globalTimeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  servers: ServerConfig[];
};

type AttemptResult = {
  ok: boolean;
  latencyMs: number;
  transient: boolean;
  detail: string;
  failureType: FailureType;
};

type ServerReport = {
  name: string;
  transport: Transport;
  status: Status;
  attempts: number;
  latencyMs: number | null;
  detail: string;
  failureType: FailureType;
  severity: Severity;
  recommendation: string;
};

type FinalReport = {
  generatedAt: string;
  mode: RunMode;
  summary: {
    total: number;
    ok: number;
    degraded: number;
    down: number;
    severities: Record<Severity, number>;
    failureTypes: Record<FailureType, number>;
  };
  servers: ServerReport[];
};

type CliOptions = {
  configPath: string;
  mode: RunMode;
};

type RuntimeDefaults = {
  timeoutMs: number;
  retries: number;
  backoffBaseMs: number;
};

const envMapSchema = z.record(z.string(), z.string());

const httpServerSchema = z.object({
  name: z.string().min(1),
  transport: z.literal("http"),
  url: z.string().url(),
  timeoutMs: z.number().int().positive().optional(),
  retries: z.number().int().min(0).max(10).optional(),
  backoffBaseMs: z.number().int().positive().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  method: z.enum(["GET", "POST"]).optional(),
  body: z.unknown().optional(),
  expectStatus: z.array(z.number().int().min(100).max(599)).min(1).optional(),
});

const stdioServerSchema = z.object({
  name: z.string().min(1),
  transport: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  cwd: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().optional(),
  retries: z.number().int().min(0).max(10).optional(),
  backoffBaseMs: z.number().int().positive().optional(),
  env: envMapSchema.optional(),
});

const configSchema = z.object({
  globalTimeoutMs: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  backoffBaseMs: z.number().int().positive().optional(),
  servers: z.array(z.discriminatedUnion("transport", [httpServerSchema, stdioServerSchema])).min(1),
});

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_BASE_MS = 300;

function log(level: LogLevel, event: string, context: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      ...context,
    }),
  );
}

function parseCliArgs(argv: string[]): CliOptions {
  let mode: RunMode = "full-scan";
  let configPath = "mcp.servers.json";
  let configAssigned = false;

  for (const arg of argv) {
    if (arg === "--fail-fast") {
      mode = "fail-fast";
      continue;
    }
    if (arg === "--full-scan") {
      mode = "full-scan";
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!configAssigned) {
      configPath = arg;
      configAssigned = true;
      continue;
    }
    throw new Error(`Unexpected positional argument: ${arg}`);
  }

  return { configPath, mode };
}

function expandEnv(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => process.env[envVar] ?? "");
}

function expandEnvObject(values?: Record<string, string>): Record<string, string> | undefined {
  if (!values) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = expandEnv(value);
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowMs(): number {
  return Number(process.hrtime.bigint() / BigInt(1000000));
}

function classifyErrorMessage(message: string): FailureType {
  const text = message.toLowerCase();

  if (text.includes("timeout") || text.includes("timed out") || text.includes("aborted")) {
    return "timeout";
  }

  if (text.includes("401") || text.includes("403") || text.includes("unauthorized") || text.includes("forbidden")) {
    return "auth";
  }

  if (
    text.includes("econnrefused") ||
    text.includes("econnreset") ||
    text.includes("enotfound") ||
    text.includes("fetch failed") ||
    text.includes("network") ||
    text.includes("dns")
  ) {
    return "network";
  }

  if (text.includes("json-rpc") || text.includes("protocol") || text.includes("invalid") || text.includes("schema") || text.includes("unexpected")) {
    return "contract";
  }

  return "unknown";
}

function isTransientFailure(failureType: FailureType): boolean {
  return failureType === "timeout" || failureType === "network";
}

function recommendationForFailure(failureType: FailureType): string {
  switch (failureType) {
    case "none":
      return "Nenhuma acao necessaria.";
    case "network":
      return "Verificar DNS, rota, firewall e endpoint; validar disponibilidade do servidor MCP.";
    case "auth":
      return "Revalidar credenciais e escopos; conferir expiracao de token e permissoes.";
    case "timeout":
      return "Investigar latencia e carga, ajustar timeout e analisar performance do MCP.";
    case "contract":
      return "Revisar contrato MCP/JSON-RPC (initialize, protocolo, payload e status esperado).";
    case "unknown":
      return "Coletar logs detalhados do servidor e reproduzir erro localmente com verbose.";
  }
}

function severityFromStatus(status: Status): Severity {
  if (status === "OK") return "INFO";
  if (status === "DEGRADED") return "WARN";
  return "CRITICAL";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkHttpServer(server: HttpServerConfig, timeoutMs: number): Promise<AttemptResult> {
  const start = nowMs();
  const method = server.method ?? "POST";
  const headers = {
    "content-type": "application/json",
    ...expandEnvObject(server.headers),
  };

  let response: Response;
  try {
    response = await withTimeout(
      fetch(expandEnv(server.url), {
        method,
        headers,
        body:
          method === "POST"
            ? JSON.stringify(server.body ?? { jsonrpc: "2.0", id: "health-check", method: "initialize", params: {} })
            : undefined,
      }),
      timeoutMs,
      `timeout after ${timeoutMs}ms`,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const failureType = classifyErrorMessage(detail);
    return {
      ok: false,
      latencyMs: nowMs() - start,
      transient: isTransientFailure(failureType),
      detail,
      failureType,
    };
  }

  const latencyMs = nowMs() - start;
  const expected = server.expectStatus ?? [200];

  if (!expected.includes(response.status)) {
    let failureType: FailureType = "contract";
    if (response.status === 401 || response.status === 403) {
      failureType = "auth";
    } else if (response.status >= 500 || response.status === 429) {
      failureType = "network";
    }

    return {
      ok: false,
      latencyMs,
      transient: isTransientFailure(failureType),
      detail: `unexpected HTTP status ${response.status}`,
      failureType,
    };
  }

  if (method === "GET") {
    return {
      ok: true,
      latencyMs,
      transient: false,
      detail: `HTTP ${response.status}`,
      failureType: "none",
    };
  }

  try {
    const payload = (await response.json()) as Record<string, unknown>;
    if (!payload || typeof payload !== "object") {
      return {
        ok: false,
        latencyMs,
        transient: false,
        detail: "contract violation: non-object JSON-RPC payload",
        failureType: "contract",
      };
    }

    if ("error" in payload) {
      return {
        ok: false,
        latencyMs,
        transient: false,
        detail: `json-rpc error: ${JSON.stringify(payload.error)}`,
        failureType: "contract",
      };
    }

    if (!("result" in payload)) {
      return {
        ok: false,
        latencyMs,
        transient: false,
        detail: "contract violation: missing JSON-RPC result",
        failureType: "contract",
      };
    }

    return {
      ok: true,
      latencyMs,
      transient: false,
      detail: `HTTP ${response.status} JSON-RPC result`,
      failureType: "none",
    };
  } catch {
    return {
      ok: false,
      latencyMs,
      transient: false,
      detail: "contract violation: invalid JSON response for MCP initialize",
      failureType: "contract",
    };
  }
}

async function checkStdioServer(server: StdioServerConfig, timeoutMs: number): Promise<AttemptResult> {
  const start = nowMs();

  let child;
  try {
    child = spawn(server.command, server.args ?? [], {
      cwd: server.cwd ? expandEnv(server.cwd) : process.cwd(),
      env: {
        ...process.env,
        ...expandEnvObject(server.env),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const failureType = classifyErrorMessage(detail);
    return {
      ok: false,
      latencyMs: nowMs() - start,
      transient: isTransientFailure(failureType),
      detail,
      failureType,
    };
  }

  const requestId = `health-${Date.now()}`;
  const initializePayload = JSON.stringify({
    jsonrpc: "2.0",
    id: requestId,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "novatech-mcp-health-check",
        version: "2.0.0",
      },
    },
  });

  const outputPromise = new Promise<AttemptResult>((resolve, reject) => {
    let stderr = "";
    let stdoutBuffer = "";
    const decoder = new TextDecoder();

    child.stderr.on("data", (chunk: Uint8Array) => {
      stderr += decoder.decode(chunk, { stream: true });
    });

    child.stdout.on("data", (chunk: Uint8Array) => {
      stdoutBuffer += decoder.decode(chunk, { stream: true });
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed) as Record<string, unknown>;
          if (msg.id !== requestId) continue;

          if ("result" in msg) {
            resolve({
              ok: true,
              latencyMs: nowMs() - start,
              transient: false,
              detail: "initialize response received",
              failureType: "none",
            });
            child.kill("SIGTERM");
            return;
          }

          resolve({
            ok: false,
            latencyMs: nowMs() - start,
            transient: false,
            detail: "contract violation: initialize returned JSON-RPC error",
            failureType: "contract",
          });
          child.kill("SIGTERM");
          return;
        } catch {
          continue;
        }
      }
    });

    child.once("error", (error: Error) => {
      reject(error);
    });

    child.once("exit", (code: number | null) => {
      if (code === 0) {
        resolve({
          ok: false,
          latencyMs: nowMs() - start,
          transient: false,
          detail: "contract violation: process exited before initialize response",
          failureType: "contract",
        });
        return;
      }

      const detail = stderr.trim() || `process exited with code ${code ?? "unknown"}`;
      const failureType = classifyErrorMessage(detail);
      resolve({
        ok: false,
        latencyMs: nowMs() - start,
        transient: isTransientFailure(failureType),
        detail,
        failureType,
      });
    });
  });

  child.stdin.write(`${initializePayload}\n`);
  child.stdin.end();

  try {
    return await withTimeout(outputPromise, timeoutMs, `timeout after ${timeoutMs}ms`);
  } catch {
    child.kill("SIGTERM");
    return {
      ok: false,
      latencyMs: nowMs() - start,
      transient: true,
      detail: `timeout after ${timeoutMs}ms`,
      failureType: "timeout",
    };
  }
}

async function checkServerAttempt(server: ServerConfig, timeoutMs: number): Promise<AttemptResult> {
  if (server.transport === "http") return checkHttpServer(server, timeoutMs);
  return checkStdioServer(server, timeoutMs);
}

function buildServerReport(server: ServerConfig, status: Status, attempts: number, attemptResult: AttemptResult): ServerReport {
  return {
    name: server.name,
    transport: server.transport,
    status,
    attempts,
    latencyMs: attemptResult.latencyMs,
    detail: attemptResult.detail,
    failureType: attemptResult.failureType,
    severity: severityFromStatus(status),
    recommendation: recommendationForFailure(attemptResult.failureType),
  };
}

async function checkServerWithRetry(server: ServerConfig, defaults: RuntimeDefaults): Promise<ServerReport> {
  const retries = server.retries ?? defaults.retries;
  const timeoutMs = server.timeoutMs ?? defaults.timeoutMs;
  const backoffBaseMs = server.backoffBaseMs ?? defaults.backoffBaseMs;
  const maxAttempts = retries + 1;

  let attempts = 0;
  let recoveredAfterRetry = false;
  let lastAttempt: AttemptResult = {
    ok: false,
    latencyMs: 0,
    transient: false,
    detail: "no attempt",
    failureType: "unknown",
  };

  while (attempts < maxAttempts) {
    attempts += 1;
    log("INFO", "attempt.start", { server: server.name, attempt: attempts, timeoutMs });

    const result = await checkServerAttempt(server, timeoutMs);
    lastAttempt = result;

    if (result.ok) {
      const status: Status = recoveredAfterRetry ? "DEGRADED" : "OK";
      const finalResult = recoveredAfterRetry
        ? {
          ...result,
          detail: `recovered after retries: ${result.detail}`,
          failureType: "network" as FailureType,
        }
        : result;

      log("INFO", "attempt.success", { server: server.name, attempt: attempts, status });
      return buildServerReport(server, status, attempts, finalResult);
    }

    log("WARN", "attempt.failure", {
      server: server.name,
      attempt: attempts,
      detail: result.detail,
      failureType: result.failureType,
      transient: result.transient,
    });

    if (!result.transient || attempts >= maxAttempts) {
      return buildServerReport(server, "DOWN", attempts, result);
    }

    recoveredAfterRetry = true;
    const waitMs = backoffBaseMs * 2 ** (attempts - 1);
    log("INFO", "attempt.retry_scheduled", { server: server.name, waitMs, nextAttempt: attempts + 1 });
    await sleep(waitMs);
  }

  return buildServerReport(server, "DOWN", attempts, lastAttempt);
}

function computeExitCode(reports: ServerReport[]): number {
  if (reports.some((r) => r.status === "DOWN")) return 2;
  if (reports.some((r) => r.status === "DEGRADED")) return 1;
  return 0;
}

function summarizeSeverities(reports: ServerReport[]): Record<Severity, number> {
  return reports.reduce<Record<Severity, number>>(
    (acc, report) => {
      acc[report.severity] += 1;
      return acc;
    },
    { INFO: 0, WARN: 0, CRITICAL: 0 },
  );
}

function summarizeFailureTypes(reports: ServerReport[]): Record<FailureType, number> {
  return reports.reduce<Record<FailureType, number>>(
    (acc, report) => {
      acc[report.failureType] += 1;
      return acc;
    },
    { none: 0, network: 0, auth: 0, timeout: 0, contract: 0, unknown: 0 },
  );
}

function printTable(reports: ServerReport[]): void {
  console.log("\nMCP Health Check");
  console.table(
    reports.map((r) => ({
      server: r.name,
      transport: r.transport,
      status: r.status,
      severity: r.severity,
      failureType: r.failureType,
      attempts: r.attempts,
      latencyMs: r.latencyMs ?? "-",
      recommendation: r.recommendation,
      detail: r.detail,
    })),
  );
}

async function loadConfig(configPathArg: string): Promise<ConfigFile> {
  const absolutePath = path.resolve(process.cwd(), configPathArg);
  const raw = await readFile(absolutePath, "utf8");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${absolutePath}`);
  }

  const validation = configSchema.safeParse(parsedJson);
  if (!validation.success) {
    const issues = validation.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
    throw new Error(`Schema validation failed: ${issues.join(" | ")}`);
  }

  return validation.data;
}

async function runChecks(config: ConfigFile, mode: RunMode): Promise<ServerReport[]> {
  const defaults: RuntimeDefaults = {
    timeoutMs: config.globalTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: config.maxRetries ?? DEFAULT_RETRIES,
    backoffBaseMs: config.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS,
  };

  const reports: ServerReport[] = [];
  for (const server of config.servers) {
    const report = await checkServerWithRetry(server, defaults);
    reports.push(report);

    if (mode === "fail-fast" && report.status === "DOWN") {
      log("ERROR", "run.fail_fast_triggered", {
        server: report.name,
        status: report.status,
        failureType: report.failureType,
      });
      break;
    }
  }

  return reports;
}

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv.slice(2));
  log("INFO", "run.start", { mode: cli.mode, configPath: cli.configPath });

  const config = await loadConfig(cli.configPath);
  const reports = await runChecks(config, cli.mode);

  const summary = {
    total: reports.length,
    ok: reports.filter((r) => r.status === "OK").length,
    degraded: reports.filter((r) => r.status === "DEGRADED").length,
    down: reports.filter((r) => r.status === "DOWN").length,
    severities: summarizeSeverities(reports),
    failureTypes: summarizeFailureTypes(reports),
  };

  const finalReport: FinalReport = {
    generatedAt: new Date().toISOString(),
    mode: cli.mode,
    summary,
    servers: reports,
  };

  printTable(reports);
  console.log("\nJSON Report");
  console.log(JSON.stringify(finalReport, null, 2));

  const exitCode = computeExitCode(reports);
  log("INFO", "run.end", { exitCode, summary });
  process.exitCode = exitCode;
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  log("ERROR", "run.crash", { detail, failureType: classifyErrorMessage(detail) });
  console.error("Health check failed:", detail);
  process.exit(2);
});
