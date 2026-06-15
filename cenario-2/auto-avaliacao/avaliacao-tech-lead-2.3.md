## Avaliação do Exercício 2.3 — Criação e teste de skills técnicas

### Resumo
O núcleo técnico do entregável está forte. A skill v2 em `cenario-2/exercicios/2.3/SKILL-v2.md` é concreta, prescritiva e melhora de forma real o comportamento esperado do agente, principalmente no contrato de recuperação vazia, nos testes mínimos e no endurecimento de validação. O problema mais sério para submissão oficial não está na qualidade da skill, mas na evidência de uso de ferramenta: os artefatos de rodada estão explicitamente marcados como **execução simulada / role-play do Copilot**, o que entra em choque direto com a exigência de teste real da rubrica.

Em outras palavras: a skill está boa, a auditoria é boa, os critérios de maturidade fazem sentido, mas a evidência de Copilot ainda não está no padrão de prova que um avaliador mais rígido vai aceitar. Se isso não for corrigido antes da entrega, o risco é perder D2 de forma dura mesmo com um conteúdo tecnicamente acima da média.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Você demonstra entendimento correto e específico do que é uma skill de domínio, de como ela se conecta ao AGENTS.md, de como regras prescritivas moldam geração e de como critérios de maturidade precisam incluir teste empírico e anti-padrões observados. A ambiguidade crítica do caso `chunks.length === 0` foi tratada com boa leitura de domínio, não só de código. |
| D2 — Uso de Ferramentas | 1 | Pela rubrica do Tech Lead 2.3, teste real com Copilot é obrigatório. Os arquivos `copilot-rodada-1.md`, `copilot-rodada-1-testes.md` e `copilot-rodada-2.md` se apresentam explicitamente como **execução simulada do GitHub Copilot (role-play)**, o que enfraquece a evidência oficial e ativa o principal corte da skill de avaliação. Há iteração documentada, mas a prova de uso real da ferramenta ainda não está demonstrada de forma aceitável. |
| D3 — Qualidade do Entregável | 3 | A skill v2 está bem escrita, é acionável, traz DO/DON'T com TypeScript real, anti-padrões úteis, checklist, critérios automatizáveis e critérios de maturidade claros em `criterios-maturidade.md`. Outro dev conseguiria usar essa skill para gerar endpoint com muito menos ambiguidade do que na v1. |
| D4 — Pensamento Crítico | 3 | O entregável reconhece limitações reais, documenta gaps da rodada 1, mostra o delta v1 → v2 e trata a skill como artefato vivo. A análise da ambiguidade AMB-1 e a auditoria em `auditoria-aderencia.md` mostram pensamento crítico honesto e orientado a correção comportamental. |
| D5 — Aplicabilidade ao Projeto | 3 | O artefato está bem conectado ao NovaTech: AGENTS.md, ADR-0002, ADR-0003, `source_document`, `vigencia`, `buildNotFoundResponse`, estruturas do repo, padrões de Azure Functions, Zod, pino e Vitest aparecem de forma consistente. Não é uma skill genérica. |

**Score do exercício: 2.6**

### Verificação de Artefatos Machine-Readable
Sim. Para um exercício de skill, o artefato principal está majoritariamente machine-readable, especialmente em `cenario-2/exercicios/2.3/SKILL-v2.md`.

O que está bom:
- Regras em formato `DEVE` e `NÃO DEVE`, com comportamento observável.
- Frase de ativação, dependências e escopo de uso claros.
- DO/DON'T com código TypeScript real, não pseudocódigo.
- Anti-padrões mapeados a sintomas concretos de geração do agente.
- Checklist de saída pronta para review e critérios automatizáveis úteis para CI e revisão técnica.

O que ainda é narrativo demais ou pode ser simplificado:
- As seções introdutórias de objetivo e contextualização poderiam ser mais curtas; ajudam humanos, mas pouco mudam a geração do agente.
- O artefato mistura um pouco “skill operacional” com “análise do experimento” em alguns trechos. Isso é bom para avaliação, mas o arquivo final consumido por agente ficaria mais forte se fosse mais enxuto.
- A seção de maturidade é útil, mas parte dela pertence mais ao relatório final do que à skill em si.

### Pontos Fortes
- O delta v1 → v2 é comportamental, não cosmético. O fechamento do caso de recuperação vazia com `buildNotFoundResponse()` é uma melhoria de projeto real.
- A skill v2 corrige ambiguidade com precisão: `.strict()` aninhado, `validated.data`, correlação de log com `invocationId`, testes mínimos e proibição de `as any` em mocks.
- A auditoria de aderência em `cenario-2/exercicios/2.3/auditoria-aderencia.md` é um dos melhores artefatos do pacote. Ela transforma “achei que melhorou” em gaps verificáveis e reescritas objetivas.

### Pontos de Melhoria
- Substitua a evidência simulada por evidência real do Copilot. Hoje isso é o principal risco da submissão, muito mais do que qualquer detalhe técnico da skill.
- Separe melhor o que é “skill para o agente” do que é “documentação da avaliação”. A skill final pode ficar mais curta e mais prescritiva se parte da contextualização for movida para o relatório.
- Feche o ciclo de maturidade com a terceira rodada real e com um vínculo concreto a `tasks.md` ou ao fluxo de implementação, já que isso aparece como pendência no seu próprio critério D5.

### O que fazer antes de entregar
1. Troque as rodadas simuladas por evidência real do Copilot: prompt usado, output bruto ou exportado, diagnóstico da rodada 1, reescrita da skill, output da rodada 2. Isso é o maior ganho com menor esforço para proteger D2.
2. Mantenha `SKILL-v2.md` como artefato operacional e mova parte da narrativa analítica para o relatório final. Isso melhora a prescritividade percebida sem reescrever a substância.
3. Execute a terceira rodada prometida em `criterios-maturidade.md`, idealmente com outro endpoint como `POST /api/feedback`, e registre o resultado. Isso fortalece tanto a maturidade quanto a credibilidade da skill.
4. Adicione referência concreta da skill em um `tasks.md` ou em um fluxo de implementação do repo, para fechar a dimensão de adoção prática.
5. Se possível, inclua uma tabela curta “regra da skill → evidência no código real gerado” separada da auditoria textual, para facilitar leitura de avaliador.

### Checklist de prescritividade
Classificação da skill v2 em `cenario-2/exercicios/2.3/SKILL-v2.md`:

| Trecho / tipo de instrução | Classificação | Observação | Reescrita sugerida quando necessário |
|---|---|---|---|
| Frontmatter com `name`, `level`, `description`, `depends_on`, `authority` | Prescritiva | Estrutura boa para descoberta e uso da skill | Sem ajuste |
| Nota “v2 — refinada após teste real…” | Narrativa | Útil ao avaliador, pouco útil ao agente | Mover para relatório final ou manter em seção de changelog separada |
| Nome e objetivo | Mista | Parte contextual, parte orientadora | Enxugar para 2-3 linhas se quiser mais foco operacional |
| Regra de ativação | Prescritiva | Muito boa; ajuda o agente a saber quando carregar a skill | Sem ajuste |
| Gatilhos de uso | Prescritiva | Clara e útil | Sem ajuste |
| Quando NÃO usar | Prescritiva | Boa delimitação de fronteira | Sem ajuste |
| Dependências e ordem de leitura | Prescritiva | Forte; reduz geração isolada | Sem ajuste |
| Símbolos compartilhados que DEVE reutilizar | Prescritiva | Muito bom | Sem ajuste |
| Estrutura de arquivos | Prescritiva | Clara e acionável | Sem ajuste |
| TypeScript e imports | Prescritiva | Forte, específica ao projeto | Sem ajuste |
| Validação com Zod | Prescritiva | Muito boa, especialmente `validated.data` e `.strict()` aninhado | Sem ajuste |
| `source_document` e contrato de “sem resultados” | Prescritiva | Um dos trechos mais fortes da skill | Sem ajuste |
| Logging com pino | Prescritiva | Boa e auditável | Sem ajuste |
| Erros | Prescritiva | Boa | Sem ajuste |
| Registro da function | Prescritiva | Boa | Sem ajuste |
| Ambiente | Prescritiva | Boa | Sem ajuste |
| Testes mínimos obrigatórios | Prescritiva | Muito forte; fecha várias lacunas comuns de LLM | Sem ajuste |
| Fluxo recomendado de implementação | Mista | Funciona como runbook; útil, mas parte é mais procedural do que mandatória | Opcional: prefixar cada etapa com “DEVE” se quiser endurecer |
| Exemplos DO | Prescritiva | Excelentes para Copilot | Sem ajuste |
| Exemplo DON'T | Prescritiva | Bom anti-exemplo | Sem ajuste |
| Anti-padrões comuns do Copilot | Prescritiva | Muito útil e específico | Sem ajuste |
| Checklist de saída pronta para review | Prescritiva | Forte | Sem ajuste |
| Critérios de validação automatizável | Prescritiva | Excelente para CI/review | Sem ajuste |

Leitura geral da prescritividade:
- O núcleo operacional da skill está forte e claramente prescritivo.
- O principal excesso de narrativa está nas camadas de contexto, versão e explicação histórica, não nas regras em si.
- Se você separar “skill para geração” de “histórico da iteração”, o artefato final para consumo por agente fica ainda melhor.

### Classificação
Aprovado com distinção

### Tópicos da Trilha para Reforço
Apesar da média alta, há um reforço crítico a fazer antes da submissão: **Skills + teste empírico com Copilot real**. O conteúdo técnico está bom; o que precisa subir de nível é a evidência operacional da ferramenta, não o entendimento conceitual.