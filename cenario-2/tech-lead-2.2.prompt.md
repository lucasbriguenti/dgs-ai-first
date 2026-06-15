# Prompts — Tech Lead 2.2 (Arquitetura de MCP — servers locais)

Objetivo: executar a tarefa 2.2 tratando MCP como **infraestrutura gerenciada**, com **servers 100% locais e gratuitos** (filesystem, git, memory, everything) e um **health check que roda de verdade** contra o `.mcp/mcp.json` (saída de execução real é obrigatória para a nota).

> **Starter Repo (Anexo D) — o que já existe:**
> - `.mcp/mcp.json` — scaffold **vazio** (`{"mcpServers": {}}`). Você preencherá no Prompt 3.
> - `.mcp/mcp.example.json` — **formato de referência completo** com os 4 servers já escrito; use como base ao preencher o mcp.json real.
> - `docs/novatech/` — 5 documentos de negócio (Anexo A); acesso **read-only** via filesystem.
> - `data/retrieval-corpus/chunks-novatech.md` — chunks do Anexo B; acesso **read-only** via filesystem.
> - `README.md` — instruções de setup: `git init && git add -A && git commit` deve ter sido feito **antes** de ligar o git MCP server (sem commit inicial, o server não tem histórico para ler).
>
> **Não use** GitHub/Azure AI Search/Azure OpenAI/Confluence/Azure DevOps como MCP servers — são serviços externos/pagos e fora do escopo desta fase. Use apenas *reference servers* locais via `npx`/`uvx`.

Mapeamento de servers locais (output simulado do Dev 2.1, fornecido para autossuficiência):

```
(1) filesystem  -> ./src ./specs ./skills (rw) + ./docs/novatech ./data/retrieval-corpus (read-only)
(2) git         -> repositório local (histórico, diff, branches)
(3) memory      -> grafo persistente de decisões e linguagem ubíqua
(4) everything  -> aprendizado das primitivas de MCP (tools/resources/prompts)
```

---

## Prompt 1 — Documento de Arquitetura de MCP (Claude)

```text
Você vai atuar como Tech Lead do projeto NovaTech Assistant.

Crie um documento de Arquitetura de MCP do projeto. Restrição central: TODOS os servers são LOCAIS e GRATUITOS (reference servers rodando via npx/uvx). Nada de Azure, GitHub, Confluence ou serviços pagos.

Servers autorizados e seus escopos:
(1) filesystem -> rw em ./src ./specs ./skills ; read-only em ./docs/novatech e ./data/retrieval-corpus
(2) git        -> repositório local (histórico, diff, branches) — leitura
(3) memory     -> grafo persistente de decisões e linguagem ubíqua do projeto
(4) everything -> exploração das primitivas de MCP (uso de aprendizado, sem dados sensíveis)

Princípios:
- Tratar MCP como infraestrutura gerenciada: versionado (.mcp/mcp.json no Git), escopo/permissões mínimas (least privilege), observável.
- As fontes de negócio (docs/novatech, data/retrieval-corpus) são READ-ONLY — agente não pode alterá-las.
- Equilibrar agilidade e segurança na aprovação de novos servers.

Entregue o documento com estas seções obrigatórias:
1. Objetivo e escopo (e por que tudo é local/gratuito)
2. Inventário dos MCP servers (o que cada um expõe: tools / resources / prompts)
3. Matriz de consumo por agente/papel (Copilot, Claude Code, Claude Chat -> qual server, RO/RW)
4. Permissões mínimas por server, com justificativa de least privilege
5. Política de aprovação para adicionar um novo server local ao .mcp/mcp.json (quem revisa escopo/permissões)
6. Monitoramento: como detectar que um server parou de responder ou perdeu acesso a uma pasta
7. Versionamento e compatibilidade: como mudar o escopo de um server sem quebrar fluxos existentes
8. Plano de contingência (degradação com aviso, nunca alucinação)
9. Riscos e mitigações (mínimo 5) — específicos ao setup LOCAL (ex.: filesystem com escopo amplo expõe .env/segredos; server com escrita altera arquivos sem revisão)

Formato: prescritivo (DEVE / NÃO DEVE / QUANDO FALHAR), critérios verificáveis por seção, e um diagrama em Mermaid com agentes e servers indicando RO/RW.
```

---

## Prompt 2 — Diagrama e matriz de permissões (Claude)

```text
Refine o documento de arquitetura de MCP local e produza dois artefatos:

1) Diagrama Mermaid detalhado com:
- agentes (Copilot, Claude Code, Claude Chat)
- os 4 servers locais (filesystem, git, memory, everything)
- tipo de acesso por pasta (RO/RW)
- fronteira de segurança em volta de docs/novatech e data/retrieval-corpus (read-only) e de qualquer caminho que possa conter segredos (ex.: .env)

2) Matriz de permissões em tabela:
- Server
- Tool/Resource/Prompt exposto
- Pasta/escopo concedido
- Acesso (RO/RW)
- Papel autorizado
- Justificativa de least privilege (por que é o mínimo suficiente)
- Risco principal se superprivilegiado

Regras:
- Nenhum escopo amplo sem justificativa explícita.
- docs/novatech e data/retrieval-corpus SEMPRE read-only.
- Na dúvida, deny-by-default.
```

---

## Prompt 3 — Script de health check MCP local (Copilot Chat)

**Antes de rodar o health check:**
1. Preencha `.mcp/mcp.json` com os 4 servers (use `.mcp/mcp.example.json` como referência de formato; ajuste o escopo do filesystem para aplicar least privilege).
2. Confirme que o setup do repo está feito (`git log` deve mostrar pelo menos 1 commit; se não, rode `git add -A && git commit -m "chore: starter repo"`).
3. Salve o script gerado em `scripts/mcp-health-check.ts` (crie a pasta `scripts/` se não existir).

```text
Gere um script de health check para os MCP servers LOCAIS do projeto NovaTech.

Objetivo:
- Ler o arquivo .mcp/mcp.json do projeto.
- Para cada server configurado, subir/consultar o processo local e verificar que ele responde — por exemplo: fazer o handshake MCP e listar tools/resources expostos.
- Verificação específica do filesystem: confirmar que ele enxerga docs/novatech/ e data/retrieval-corpus/ (read) e que NÃO tem escrita nessas pastas.
- Reportar status por server: OK | DEGRADED | DOWN.

Requisitos técnicos:
- TypeScript (Node.js), executável localmente (ex.: tsx/ts-node).
- Timeout por server e retry com backoff para falhas transientes de inicialização.
- Saída em tabela no terminal e também em JSON.
- Exit code 0 se todos OK, 1 se houver DEGRADED, 2 se houver DOWN.

Entregue:
1) o script
2) instruções de execução
3) a saída de uma execução real contra o .mcp/mcp.json (cole o output do terminal)
```

> Rode o script de fato. A avaliação exige **saída de execução real** — script conceitual sem output = red flag.

---

## Prompt 4 — Endurecer o script (Copilot Chat)

```text
Faça hardening do script de health check MCP local para uso recorrente pelo time.

Inclua:
- validação do schema do .mcp/mcp.json com Zod
- classificação da falha (server não inicia / timeout no handshake / pasta inacessível / escopo divergente do esperado)
- resumo por severidade
- ação sugerida por tipo de falha
- flags --fail-fast e --full-scan
- logs estruturados (pino)

No final, entregue uma seção "Riscos residuais" com 5 pontos e cole a saída de uma nova execução.
```

---

## Prompt 5 — Plano de contingência (Claude)

```text
Com base na arquitetura de MCP local e no health check, escreva o plano de contingência para indisponibilidade de server, no modelo "degradar com aviso, nunca alucinar".

Cenários (todos locais):
- filesystem perde acesso a docs/novatech/ (sem fonte de negócio)
- filesystem perde acesso a data/retrieval-corpus/ (sem "recuperação" de chunks)
- git server não responde (sem histórico/diff)
- memory server cai (perda de contexto persistente de decisões/linguagem ubíqua)
- mudança de escopo no .mcp/mcp.json quebra um fluxo existente

Para cada cenário detalhe:
1) Detecção (como o health check / o agente percebe)
2) Ação imediata (0-15 min)
3) Modo degradado: o que o agente DEVE fazer (ex.: avisar "sem acesso à base; não vou inventar resposta") e o que continua funcionando
4) Escalonamento (quem aciona quem)
5) Critério de retorno ao normal

Formato: prescritivo e executável por time pequeno. Proibido "se cair, para tudo".
```

---

## Prompt 6 — Política de aprovação de novo server local (Claude)

```text
Crie a política de aprovação para adicionar um novo MCP server local ao .mcp/mcp.json, equilibrando segurança e velocidade.

A política deve conter:
- checklist mínimo de segurança (escopo de pastas, RO vs RW, ausência de caminhos com segredos como .env)
- checklist mínimo de valor (qual necessidade do projeto justifica o server)
- níveis de risco (baixo/médio/alto) conforme escopo e permissão de escrita, e fluxo de aprovação por nível (quem revisa)
- requisito de observabilidade antes do uso (passar no health check)
- fase piloto e critério de promoção para uso amplo
- critério de desativação/remoção

Extra: uma versão curta "policy-as-code" em YAML com os campos obrigatórios de aprovação.
```

---

## Prompt 7 — Relatório final da 2.2 (Claude)

```text
Vou colar os artefatos da tarefa 2.2:
- Documento de arquitetura de MCP local
- Diagrama Mermaid e matriz de permissões
- Script de health check (v1 e endurecido) + saídas de execução real
- Plano de contingência
- Política de aprovação de novos servers

Monte o relatório final de entrega com:
1) Resumo executivo
2) Evidências de uso das ferramentas (Claude no design; Copilot no script; saída real do health check)
3) Como a arquitetura trata MCP local como infraestrutura gerenciada (escopo, permissões, versionamento, observabilidade)
4) Decisões e trade-offs (least privilege, RO nas fontes de negócio)
5) Riscos abertos e mitigação
6) Checklist de aderência aos critérios da avaliação 2.2

Formato: objetivo, técnico, tabelas curtas quando útil, sem texto genérico.
```

---

## Checklist de uso rápido

- Execute os prompts na ordem 1 → 7.
- Servers SOMENTE locais e gratuitos (filesystem, git, memory, everything). Sem Azure/GitHub/Confluence.
- docs/novatech e data/retrieval-corpus SEMPRE read-only; least privilege justificado por server.
- **Rode o health check de verdade e cole a saída** (sem execução real = red flag direto).
- Plano de contingência = degradar com aviso, nunca "parar tudo" nem alucinar.
- Política de aprovação evita os dois extremos (burocracia total ou liberação total).
