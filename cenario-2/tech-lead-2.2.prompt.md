# Prompts — Tech Lead 2.2 (Arquitetura de MCP)

Objetivo: executar a tarefa 2.2 com entregavel completo e evidencias de uso real de ferramenta.

## Prompt 1 — Documento de Arquitetura MCP (Claude)

Use este prompt no Claude:

```text
Voce vai atuar como Tech Lead do projeto NovaTech Assistant.

Crie um documento de Arquitetura MCP do projeto, considerando os servidores mapeados:
1) GitHub (read code, create PR)
2) Azure AI Search (read index, query)
3) Azure OpenAI (completion API)
4) Confluence NovaTech (read pages)
5) Azure DevOps (read/write work items)

Contexto e restricoes:
- MCP deve ser tratado como infraestrutura gerenciada (nao ad-hoc).
- Aplicar least privilege por servidor e por papel.
- Equilibrar agilidade com seguranca na aprovacao de novos servidores.
- Considerar risco de indisponibilidade e dados incorretos.

Entregue o documento com estas secoes obrigatorias:
1. Objetivo e escopo
2. Inventario de MCP servers
3. Matriz de consumo por agente/papel (quem consome o que)
4. Permissoes minimas por server
5. Politica de aprovacao para novo MCP server
6. Monitoramento e alertas
7. Versionamento e compatibilidade
8. Plano de contingencia (degradacao)
9. Riscos e mitigacoes (minimo 5)
10. SLOs operacionais sugeridos

Formato obrigatorio:
- Escreva de forma prescritiva: DEVE, NAO DEVE, QUANDO FALHAR.
- Inclua criterios verificaveis em cada secao.
- Inclua um diagrama em Mermaid com agentes e servers.
```

## Prompt 2 — Refinar diagrama e matriz de permissao (Claude)

Use este prompt no Claude apos o Prompt 1:

```text
Refine o documento de arquitetura MCP gerado e produza dois artefatos adicionais:

1) Diagrama Mermaid detalhado com:
- agentes (Copilot, Claude Code, Claude Chat)
- servidores MCP
- tipo de acesso (RO/RW)
- fronteiras de seguranca (dados internos NovaTech)

2) Matriz de permissao em tabela com colunas:
- MCP Server
- Tool/Resource/Prompt exposto
- Papel autorizado
- Escopo minimo
- Justificativa de least privilege
- Risco principal se superprivilegiado

Regra:
- Nao use permissoes amplas sem justificativa explicita.
- Se houver incerteza, prefira deny-by-default.
```

## Prompt 3 — Script de health check MCP (Copilot Chat)

Use este prompt no Copilot para gerar o script:

```text
Gere um script de health check para os MCP servers do projeto NovaTech.

Objetivo:
- Verificar conectividade e resposta basica de cada MCP server configurado.
- Produzir relatorio final com status por server: OK, DEGRADED, DOWN.

Requisitos tecnicos:
- Linguagem: TypeScript (Node.js).
- Ler configuracao de um arquivo local (ex: mcp.servers.json).
- Timeout por servidor.
- Retry com backoff exponencial para falhas transientes.
- Saida em JSON e tambem em tabela no terminal.
- Exit code 0 quando todos OK, 1 quando houver DEGRADED, 2 quando houver DOWN.

Entregue:
1) arquivo do script
2) exemplo de mcp.servers.json
3) instrucoes de execucao
4) exemplo de output
```

## Prompt 4 — Endurecer script para operacao real (Copilot Chat)

Use este prompt no Copilot para uma segunda rodada:

```text
Revise o script de health check MCP e faca hardening para uso real em CI.

Inclua:
- validacao de schema de entrada (Zod)
- classificacao de falhas (rede, auth, timeout, contrato)
- resumo por severidade
- sugestao automatica de acao por tipo de falha
- opcao de modo --fail-fast e --full-scan
- logs estruturados

No final, entregue uma secao "Riscos residuais" com 5 pontos.
```

## Prompt 5 — Plano de contingencia (Claude)

Use este prompt no Claude:

```text
Com base na arquitetura MCP e no health check, escreva um plano de contingencia operacional para indisponibilidade de MCP server.

Estruture por cenario:
- Queda total de um server critico
- Latencia alta persistente
- Resposta incorreta/suspeita
- Falha de autenticacao
- Mudanca de versao quebrando contrato

Para cada cenario, detalhe:
1) Deteccao
2) Acao imediata (0-15 min)
3) Modo degradado (o que continua funcionando)
4) Escalonamento (quem aciona quem)
5) Criterio de retorno ao normal
6) Postmortem minimo

Formato:
- Prescritivo e executavel por time pequeno.
- Sem respostas genericas do tipo "parar tudo".
```

## Prompt 6 — Politica de aprovacao de novo MCP server (Claude)

Use este prompt no Claude:

```text
Crie uma politica de aprovacao de novos MCP servers para o projeto NovaTech, equilibrando seguranca e velocidade.

A politica deve conter:
- checklist minimo de seguranca
- checklist minimo de valor para o time
- niveis de risco (baixo/medio/alto) e fluxo de aprovacao por nivel
- requisitos de observabilidade antes de entrar em uso
- fase piloto e criterio de promocao para uso amplo
- criterio de desativacao de servidor

Entrega extra:
- uma versao curta "Policy-as-code" em YAML com campos obrigatorios para aprovacao.
```

## Prompt 7 — Relatorio final da 2.2 (Claude)

Use este prompt para consolidar o entregavel:

```text
Vou colar os artefatos da tarefa 2.2:
- Documento de arquitetura MCP
- Diagrama e matriz de permissao
- Script de health check (v1 e v2)
- Plano de contingencia
- Politica de aprovacao de novos servers

Monte o relatorio final em formato de entrega com:
1) Resumo executivo
2) Evidencias de uso das ferramentas (Claude e Copilot)
3) Decisoes principais e trade-offs
4) Como a arquitetura trata MCP como infraestrutura gerenciada
5) Riscos abertos e plano de mitigacao
6) Checklist de aderencia aos criterios da avaliacao 2.2

Formato:
- Objetivo, direto e tecnico.
- Tabelas curtas quando util.
- Sem texto generico.
```

## Checklist de uso rapido

- Execute os prompts na ordem 1 -> 7.
- Mantenha evidencia de iteracao do script (rodada inicial e hardening).
- Garanta que o plano de contingencia preve modo degradado.
- Valide que a politica de aprovacao evita extremos (burocracia total ou liberacao total).
