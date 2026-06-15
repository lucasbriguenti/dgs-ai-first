# Política de Aprovação de Novo MCP Server Local — NovaTech Assistant

**Projeto:** NovaTech Assistant
**Papel:** Tech Lead · **Ferramenta de autoria:** Claude (chat)
**Data:** 2026-06-15 · **Escopo:** Exercício 2.2 — Prompt 6
**Base:** [`arquitetura-mcp.md`](./arquitetura-mcp.md) §5 · matriz-contrato [`diagrama-e-matriz-permissoes.md`](./diagrama-e-matriz-permissoes.md) · gate [`mcp-health-check.ts`](../../novatech-assistant/scripts/mcp-health-check.ts)

> **Objetivo: equilibrar agilidade e segurança.** Server de **baixo risco** entra no mesmo dia com 1 revisor; server de **alto risco** exige piloto + 2 revisores + ADR. Nem burocracia que trava o time, nem "qualquer um adiciona qualquer server". O nível de revisão **escala com o risco**.

---

## 1. Quando esta política se aplica

`DEVE` ser seguida em **todo PR** que adicione, altere escopo ou remova um server do `.mcp/mcp.json`. Mudança fora de PR no `.mcp/mcp.json` é **proibida** (config é versionada — arquitetura §7).

---

## 2. Checklist mínimo de SEGURANÇA (todo PR)

- [ ] **Escopo de pastas é o mínimo suficiente** — subpasta exata, nunca pasta-pai (`.`, `./docs`, `./data`), com justificativa escrita.
- [ ] **RO vs RW declarado e correto** por pasta.
- [ ] **Fontes de negócio permanecem read-only** — `docs/novatech` e `data/retrieval-corpus` `NÃO DEVEM` receber escrita.
- [ ] **Ausência de caminhos com segredos** — nenhuma raiz inclui `.env`, `*.key`, `*.pem`, `.git/`, `node_modules/`, `./infra`.
- [ ] **Local-only** — `command` é `npx`/`uvx` local; **sem** endpoint de rede externo/pago.
- [ ] **Versão pinada** — pacote do server fixado (sem `latest` implícito).

Qualquer item desmarcado → **deny-by-default** (PR bloqueado).

## 3. Checklist mínimo de VALOR (todo PR)

- [ ] **Necessidade concreta do projeto** descrita (qual fluxo/agente passa a ser possível).
- [ ] **Linkado a uma spec/task/ADR** que justifica o server.
- [ ] **Não redundante** com capacidade de um server já existente.

---

## 4. Níveis de risco e fluxo de aprovação

O nível é **derivado** de: permissão de escrita × amplitude de escopo × acesso a rede. Na dúvida entre dois níveis, vale o **mais alto** (deny-by-default).

| Nível | Definição | Revisores | SLA | Gate obrigatório |
|-------|-----------|-----------|-----|------------------|
| **Baixo** | Read-only, sem segredos, sem rede | 1 dev sênior | mesmo dia | Health check `OK` (exit 0) |
| **Médio** | Escrita em pastas de **código já no escopo** (`src`/`specs`/`skills`), ou leitura de **pasta nova** | Tech Lead | 1 dia útil | Health check + checklist de segurança (§2) |
| **Alto** | Escrita em **pasta nova**, **acesso a rede**, ou qualquer caminho que possa conter **segredos** | Tech Lead + owner do repo (segurança) | revisão dedicada | Checklists completos + **fase piloto** (§6) + **ADR** registrando a decisão |

> Exemplos: `everything`/`git` (read-only) = **Baixo**; `filesystem` ampliando uma raiz de código = **Médio**; um server que toca `.env`/`infra` ou faz chamada externa = **Alto** (e, nesta fase, em geral **rejeitado** por violar a regra local-only).

---

## 5. Gate de observabilidade (pré-requisito de uso)

Nenhum server `DEVE` ser usado pelo time antes de **passar no health check**, com saída anexada ao PR:

```bash
npx tsx scripts/mcp-health-check.ts --full-scan   # exit 0 = liberado
```

- O server novo `DEVE` aparecer no output com status `OK`.
- O run completo `DEVE` terminar com **exit 0** (nenhum `DOWN`/`DEGRADED`) e **sem `SCOPE_DIVERGENCE`**.
- A saída real `DEVE` ser colada no PR (config sem evidência de execução não é aprovável).

---

## 6. Fase piloto e promoção para uso amplo

Obrigatória para nível **Alto** (e recomendada para qualquer padrão novo de server):

- **Piloto:** usado por **1 agente**, **1 desenvolvedor**, por **≥ 3 dias úteis**, com o health check rodando no **CI**.
- **Critério de promoção** para uso amplo (todos os itens):
  - [ ] Zero incidente de escopo no período (nenhum `SCOPE_DIVERGENCE`).
  - [ ] Health check **verde em todas** as execuções do piloto.
  - [ ] Checklists de segurança (§2) e valor (§3) fechados.
  - [ ] ADR de adoção registrado.

---

## 7. Critério de desativação / remoção

Um server `DEVE` ser removido do `.mcp/mcp.json` (via PR) quando ocorrer **qualquer** um:

- **Sem consumidor por 30 dias** (capacidade não utilizada).
- **Falha recorrente no health check sem dono** que resolva.
- **Propósito cumprido** — ex.: `everything`, quando o time já dominar as primitivas de MCP.
- **Risco passou a superar o valor** (ex.: server ampliou escopo e não há justificativa).

A remoção segue o mesmo fluxo de PR; o health check pós-remoção `DEVE` continuar `OK` para os fluxos remanescentes.

---

## 8. Policy-as-code (YAML) — campos obrigatórios de aprovação

Anexar este bloco preenchido ao PR que altera o `.mcp/mcp.json`. Campos `required` ausentes ou inconsistentes = **deny-by-default**.

```yaml
policy: mcp-server-approval
version: 1.0
applies_to: .mcp/mcp.json

request:
  server_name: <string>          # ex.: sqlite-readonly
  command: <npx|uvx>             # local-only
  args: [<string>]
  requested_by: <usuario>
  date: <YYYY-MM-DD>

value:                            # §3
  need: <necessidade concreta do projeto>
  linked_spec_or_adr: <path/#id>
  redundant_with_existing: false  # DEVE ser false

security:                         # §2
  scope:                          # subpastas exatas (sem pasta-pai)
    - path: ./<subpasta>
      access: RO                  # RO | RW
  business_sources_readonly: true # docs/novatech e data/retrieval-corpus = RO
  forbidden_paths_present: false  # .env/*.key/*.pem/.git/node_modules/infra/"."
  network_access: false           # DEVE ser false nesta fase
  version_pinned: true

risk:                             # §4
  level: low                      # low | medium | high  (na dúvida, o maior)
  approvers_required:             # derivado do nível
    - tech-lead                   # +repo-owner se high

observability:                    # §5
  health_check_passed: true       # exit 0 do mcp-health-check.ts
  health_check_output_attached: true

pilot:                            # §6 (obrigatório se high)
  required: false
  duration_days: 3
  consumers_limited_to: []
  promotion_criteria: "zero SCOPE_DIVERGENCE + health check verde + checklists + ADR"

decision:
  status: pending                 # pending | approved | rejected
  approved_by: []
  approved_date: <YYYY-MM-DD>
  review_at: <YYYY-MM-DD>         # reavaliação periódica
  deactivation_rule: "sem consumidor 30d | falha recorrente sem dono | propósito cumprido"
```

---

## 9. Critérios verificáveis (Prompt 6)

- [ ] Há checklist de segurança **e** de valor, ambos acionáveis.
- [ ] 3 níveis de risco com revisores e SLA distintos (não um fluxo único, nem nenhum).
- [ ] Gate de observabilidade exige passar no health check (exit 0) com saída anexada.
- [ ] Há fase piloto com critério objetivo de promoção.
- [ ] Há critério explícito de desativação/remoção.
- [ ] Existe a versão "policy-as-code" em YAML com os campos obrigatórios de aprovação.
- [ ] A política não cai nos extremos: baixo risco é ágil (mesmo dia, 1 revisor); alto risco é controlado (piloto + 2 revisores + ADR).
