# Plano de Contingência — MCP local (NovaTech Assistant)

**Projeto:** NovaTech Assistant
**Papel:** Tech Lead · **Ferramenta de autoria:** Claude (chat)
**Data:** 2026-06-15 · **Escopo:** Exercício 2.2 — Prompt 5
**Base:** [`arquitetura-mcp.md`](./arquitetura-mcp.md) §8 · health check real [`mcp-health-check.ts`](../../novatech-assistant/scripts/mcp-health-check.ts)

> **Modelo: degradar com aviso, NUNCA alucinar.** Um agente com capacidade reduzida que avisa o que perdeu é melhor que um agente que inventa. **Proibido** "se cair, para tudo".

---

## 1. Princípio reitor (3 invariantes — valem em todos os cenários)

- **I1 — NUNCA fabricar fonte.** O agente `NÃO DEVE` emitir resposta com `source_document` inventado (ADR-0003). Sem a fonte real, a resposta sai marcada como *sem fonte recuperada*.
- **I2 — SEMPRE avisar.** Toda resposta em modo degradado `DEVE` começar com o aviso padrão (§3) declarando qual server caiu e o que o agente não fará.
- **I3 — Continuar o que não depende do server caído.** A queda de um server degrada *uma capacidade*, não a sessão inteira. O que não usa aquele server `DEVE` seguir funcionando.

---

## 2. Sinais de detecção (mapeados ao health check)

A detecção é objetiva: vem do `mcp-health-check.ts` (estados/classes/exit codes) ou de erro de tool em runtime.

| Sinal | Significado | Origem |
|-------|-------------|--------|
| Status `DOWN` / exit `2` | server não fez handshake | `SPAWN_ERROR`, `HANDSHAKE_TIMEOUT` |
| Status `DEGRADED` / exit `1` | server sobe, verificação falhou | `FOLDER_INACCESSIBLE`, `SCOPE_DIVERGENCE`, `TOOL_ERROR`, `NO_TOOLS` |
| Erro de tool em runtime | `EACCES`/`ENOENT`/`path not allowed`/timeout numa chamada | o próprio agente, ao usar a tool |

**Regra:** ao primeiro sinal, o agente `DEVE` entrar em modo degradado **antes** de produzir qualquer resposta que dependa do recurso afetado.

---

## 3. Aviso padrão de modo degradado (o agente DEVE emitir)

```
⚠️ MODO DEGRADADO — MCP <server> indisponível (<classe da falha>).
Sem acesso a: <recurso>. NÃO vou inventar <conteúdo dependente>.
Ainda posso: <o que continua funcionando>.
Restaurar: rode `npx tsx scripts/mcp-health-check.ts` e veja a ação sugerida.
```

---

## 4. Cenários (todos locais)

### C1 — `filesystem` perde acesso a `docs/novatech/` (sem fonte de negócio)

| Passo | Conteúdo |
|-------|----------|
| **1. Detecção** | health check `DEGRADED`, classe `FOLDER_INACCESSIBLE` em `docs/novatech` (read-probe falhou) ou `SCOPE_DIVERGENCE` (raiz removida do `mcp.json`); em runtime `read_file`/`list_directory` → `path not allowed`/`ENOENT`. |
| **2. Ação imediata (0–15 min)** | Rodar o health check e ler a classe/ação. Confirmar que a pasta existe e está nas raízes do `filesystem`. Se a falha veio de um PR que mexeu no `.mcp/mcp.json`, **reverter o PR** (ver C5). |
| **3. Modo degradado** | O agente `DEVE` avisar "sem acesso à base de políticas/SLA/FAQ da NovaTech; não vou inventar regra de negócio" e **pedir o trecho ao humano**. `NÃO DEVE` responder política/SLA "de memória" nem fabricar `source_document`. **Continua:** geração de código, leitura de `src`/`specs`/`skills`, `git`. |
| **4. Escalonamento** | Dev → **Tech Lead** (dono da arquitetura MCP). Se origem = mudança de escopo em PR → também autor do PR + **owner do repo**. |
| **5. Retorno ao normal** | read-probe em `docs/novatech` volta a `OK` em **2 execuções consecutivas**; status `filesystem` = `OK`; exit `0`. |

### C2 — `filesystem` perde acesso a `data/retrieval-corpus/` (sem "recuperação" de chunks)

| Passo | Conteúdo |
|-------|----------|
| **1. Detecção** | health check `DEGRADED`, `FOLDER_INACCESSIBLE` em `data/retrieval-corpus`; em runtime a etapa de RAG retorna 0 chunks / erro de path. |
| **2. Ação imediata** | Health check; confirmar pasta/escopo; verificar se o corpus foi movido/renomeado. |
| **3. Modo degradado** | O agente `DEVE` avisar "recuperação (RAG) indisponível" e responder **somente** com o que está no contexto explícito, marcando a resposta como *sem fonte recuperada*. `NÃO DEVE` fabricar `source_document` nem inventar chunk. **Continua:** código, testes, design que não dependem de RAG. |
| **4. Escalonamento** | Dev → **Tech Lead**; se o corpus está corrompido/perdido → responsável pelo pipeline de ingestão. |
| **5. Retorno ao normal** | read-probe do corpus `OK` 2× + smoke: recuperar 1 chunk conhecido. |

### C3 — `git` server não responde (sem histórico/diff)

| Passo | Conteúdo |
|-------|----------|
| **1. Detecção** | health check `DOWN` (`SPAWN_ERROR`: `uvx` fora do PATH; ou `HANDSHAKE_TIMEOUT`) **ou** `DEGRADED` (`TOOL_ERROR` em `git_log`: sem commit). |
| **2. Ação imediata** | Verificar `uvx` no PATH (`pip install uv`); rodar `git log` no terminal; se não houver commit, `git add -A && git commit -m "chore: starter repo"`. |
| **3. Modo degradado** | O agente `DEVE` declarar "sem histórico/diff via MCP; não consigo justificar mudanças por commits". `NÃO DEVE` afirmar "o que mudou" sem poder verificar. **Continua:** todo fluxo que não precisa de histórico; o **`git` local pelo humano no terminal continua funcionando** (o server MCP é só a *leitura do agente*). |
| **4. Escalonamento** | Dev → **Tech Lead**. |
| **5. Retorno ao normal** | `git` `OK` 2×; `git_log` retorna ≥ 1 commit. |

### C4 — `memory` server cai (perda de contexto persistente de decisões / linguagem ubíqua)

| Passo | Conteúdo |
|-------|----------|
| **1. Detecção** | health check `DOWN` (`SPAWN_ERROR`/`HANDSHAKE_TIMEOUT`) ou `DEGRADED` (`TOOL_ERROR` em `read_graph`). |
| **2. Ação imediata** | Health check; reiniciar o processo do server; verificar o arquivo de store do `memory`. |
| **3. Modo degradado** | O agente opera com o **contexto da sessão atual**. `NÃO DEVE` persistir novas decisões enquanto o server estiver fora (evita perda/divergência). `DEVE` avisar "memória de decisões indisponível; posso repetir uma decisão já tomada — confirme convenções comigo". **Continua:** geração/design com contexto explícito. |
| **4. Escalonamento** | Dev → **Tech Lead** (dono das decisões); se o store corrompeu → restaurar de backup (ou do Git, se versionado). |
| **5. Retorno ao normal** | `memory` `OK` 2×; `read_graph` responde; decisões pendentes da janela de queda são **re-registradas** manualmente. |

### C5 — mudança de escopo no `.mcp/mcp.json` quebra um fluxo existente

| Passo | Conteúdo |
|-------|----------|
| **1. Detecção** | health check `SCOPE_DIVERGENCE` (escopo **mais amplo** que o esperado, ou raiz esperada **ausente**) logo após um PR que tocou `.mcp/mcp.json`; exit `1`; em runtime, tool → `path not allowed`. |
| **2. Ação imediata** | Identificar o PR pelo `git diff` do `.mcp/mcp.json`; consultar a **matriz de permissões** ([`diagrama-e-matriz-permissoes.md`](./diagrama-e-matriz-permissoes.md), que é o *contrato*) para saber quem dependia da raiz; **reverter o PR** ou prover caminho alternativo **antes** de seguir. |
| **3. Modo degradado** | Enquanto não resolvido, os agentes que dependiam da raiz operam como C1/C2 (avisam, não inventam); os fluxos não afetados seguem normalmente. |
| **4. Escalonamento** | Autor do PR + **Tech Lead** + **owner do repo** — mudança de escopo é sempre revisão de segurança. |
| **5. Retorno ao normal** | health check sem `SCOPE_DIVERGENCE` (escopo confere com least privilege, sem extras/missing) 2×; matriz e `mcp.json` consistentes; exit `0`. |

---

## 5. Matriz de escalonamento

| Gatilho | Quem detecta | Aciona | Quando subir de nível |
|---------|--------------|--------|------------------------|
| `DEGRADED` em pasta/escopo (C1, C2, C5) | Dev na sessão | Tech Lead | Sem resolução em 1 dia útil → owner do repo |
| `DOWN` de server (C3, C4) | Dev / CI | Tech Lead | Falha recorrente sem dono → marcar server p/ remoção (arquitetura §5.5) |
| `SCOPE_DIVERGENCE` pós-PR (C5) | Dev / CI | Autor do PR + Tech Lead | Toda mudança de escopo → owner do repo (segurança) |
| Store de `memory`/corpus corrompido | Dev | Tech Lead | Perda de dado → responsável por backup/ingestão |

---

## 6. Anti-padrões PROIBIDOS

- **NÃO DEVE** "parar tudo" quando um server cai — degrade a capacidade afetada, mantenha o resto.
- **NÃO DEVE** inventar resposta de negócio, chunk ou `source_document` quando a fonte está indisponível.
- **NÃO DEVE** seguir silenciosamente — sem o aviso padrão (§3), a resposta é inválida.
- **NÃO DEVE** persistir decisões no `memory` enquanto ele está degradado (C4).
- **NÃO DEVE** "consertar" um `SCOPE_DIVERGENCE` ampliando escopo sem revisão (vira brecha de segurança) — reverta o PR.

---

## 7. Critérios verificáveis

- [ ] Os 5 cenários têm os 5 passos (detecção → ação 0–15 min → modo degradado → escalonamento → retorno).
- [ ] Toda detecção referencia um sinal **objetivo** do health check (status/classe/exit) ou erro de tool.
- [ ] Em **todo** cenário o agente avisa e **não** inventa (sem `source_document` fabricado).
- [ ] Nenhum cenário usa "parar tudo"; cada um diz o que **continua** funcionando.
- [ ] Há matriz de escalonamento com papéis de time pequeno (Dev, Tech Lead, owner do repo).
- [ ] Critério de retorno é mensurável (health check `OK` em 2 execuções consecutivas).
