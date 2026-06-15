## Avaliação do Exercício 2.1 — Construção e teste do AGENTS.md

### Resumo
O entregável está acima da média. Há boa materialização das ADRs do cenário 1 no AGENTS, iteração real de v1 para v2 e análise honesta dos limites do artefato. O ponto que mais segura a nota não é qualidade técnica do conteúdo, e sim evidência de ferramenta: você mostra os outputs gerados e a melhoria entre rodadas, mas a prova de uso do Copilot ainda está mais indireta do que ideal.

Também conferi o starter repo referenciado: os outputs presentes em `cenario-2/novatech-assistant/src/functions/query/handler.ts`, `cenario-2/novatech-assistant/src/functions/query/validator.ts`, `cenario-2/novatech-assistant/src/functions/query/response-builder.ts` e `cenario-2/novatech-assistant/tests/unit/query-handler.test.ts` compilam e os 3 testes passam. Isso fortalece a credibilidade do relato.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Você demonstra entendimento correto e específico de AGENTS.md como constitution prescritiva, incorpora ADR-0002 com budget numérico e enforcement via Zod, e ADR-0003 com vigência e priorização da versão mais recente. O raciocínio sobre fronteira handler/services também mostra nuance, não só repetição de padrões. |
| D2 — Uso de Ferramentas | 2 | Há evidência forte de iteração real: `AGENTS-v1.md`, `AGENTS-v2.md`, `autochecagem-v2.md` e o código gerado no repo mostram mudança concreta. Ainda assim, falta evidência primária mais explícita do uso do Copilot, como prompts usados, output bruto por rodada ou export da conversa. Do jeito atual, a evidência existe, mas é principalmente reconstruída pelo relatório. |
| D3 — Qualidade do Entregável | 3 | O AGENTS v2 está utilizável por agente, com regras acionáveis, exemplos DO/DON'T e correções diretamente ligadas aos gaps observados. O relatório final em `cenario-2/exercicios/2.1/relatorio-final.md` é claro, específico e consistente com o que aparece no código gerado. |
| D4 — Pensamento Crítico | 3 | Você não trata o AGENTS como solução mágica. Documenta limitações reais, riscos residuais, o que o Copilot ignorou na rodada 1 e por que a redação do v1 era insuficiente. Essa parte está madura e honesta, exatamente o que a rubrica pede. |
| D5 — Aplicabilidade ao Projeto | 3 | O artefato está profundamente conectado ao NovaTech: stack correta, contexto local sem remoto, PR local em markdown, `source_document` obrigatório, vigência, budget de contexto, Zod, pino, Vitest e organização do repo. Não há cheiro de template genérico. |

**Score do exercício: 2.8**

### Verificação de Artefatos Machine-Readable
Sim, o artefato principal é majoritariamente machine-readable, especialmente o v2 em `cenario-2/exercicios/2.1/AGENTS-v2.md`.

O que está bom:
- Regras em formato DEVE e NÃO DEVE, com comportamento observável.
- Limites numéricos claros para budget de contexto.
- Fronteira handler/services descrita com exemplo DO/DON'T.
- Regras de validação e logging com exemplos de código.
- Regras de teste que influenciam diretamente a geração.

O que ainda é narrativo demais ou não ajuda um agente a agir:
- As linhas descritivas de contexto em Project Overview, Stack e Arquitetura funcionam como contexto, mas não como instrução.
- As seções com TODO de outros papéis reduzem a completude operacional do arquivo.
- A parte de CI/CD descreve a existência dos pipelines, mas não converte tudo em comportamento exigível do agente.
- A regra de cobertura mínima está correta como intenção, mas a evidência prática ainda não mostra medição de coverage, só configuração em `cenario-2/novatech-assistant/vitest.config.ts`.

### Pontos Fortes
- A iteração v1 → v2 é real e relevante. Você corrigiu exatamente o tipo de ambiguidade que faz agente errar, em vez de só "endurecer o texto".
- O AGENTS v2 conecta regra a mecanismo de enforcement. Exemplo: budget não fica só em texto; vira Zod e logging.
- O relatório final combina auditoria, risco residual e prontidão de uso sem supervender o resultado.

### Pontos de Melhoria
- Transforme a evidência de uso do Copilot em evidência primária. Hoje o avaliador acredita no relato porque ele é bom e porque os arquivos existem, mas ainda falta o vínculo direto entre prompt, output da rodada 1 e output da rodada 2.
- Elimine ou explicite melhor o status das seções TODO. Para submissão, isso pode ser interpretado como AGENTS incompleto se o avaliador for mais rígido.
- Feche a lacuna entre "coverage mínima 80%" e "comprovação de coverage". A configuração existe, mas o entregável ainda não prova esse gate na prática.

### O que fazer antes de entregar
1. Adicione evidência primária do teste com Copilot: prompt usado, trecho do output da rodada 1, diagnóstico do que falhou, prompt ou contexto da rodada 2 e output melhorado. Isso é o maior ganho com menor esforço para subir D2 com segurança.
2. Acrescente uma tabela curta "regra do AGENTS → evidência no código gerado" usando os arquivos reais do repo. Você já tem isso parcialmente; falta só deixar mais auditável.
3. Troque ou complemente os TODO por uma nota operacional explícita: "seções pendentes de outros papéis; este exercício cobre apenas Overview, Tech Stack & Architecture, Coding Standards e Build & Deploy". Isso reduz risco de leitura como incompleto.
4. Execute e registre coverage de teste de forma verificável, ou ajuste a redação do relatório para não sugerir validação de coverage quando ela ainda não foi demonstrada.
5. Enxugue algumas linhas puramente descritivas nas seções de Stack, Arquitetura e CI/CD, mantendo no AGENTS apenas o que de fato altera comportamento do agente.

### Checklist de prescritividade
Classificação do AGENTS v2 em `cenario-2/exercicios/2.1/AGENTS-v2.md`:

| Trecho / tipo de instrução | Classificação | Observação | Reescrita sugerida quando necessário |
|---|---|---|---|
| Constitution do projeto / frase de abertura | Narrativa | Contexto útil, mas não instrui ação | Manter como contexto |
| Produto / repositório / time / fase atual | Narrativa | Contexto, não regra | Manter como contexto |
| Regras gerais que todo agente DEVE seguir | Prescritiva | Boa, acionável | Sem ajuste |
| Tabela de stack | Narrativa | Informa tecnologia, mas não força comportamento | Se quiser endurecer: "DEVE usar exclusivamente as tecnologias listadas abaixo para novos artefatos deste módulo" |
| tsconfig obrigatório | Prescritiva | Clara e verificável | Sem ajuste |
| Lista dos quatro componentes | Narrativa | Boa como contexto arquitetural | Opcional: "DEVE respeitar os limites de responsabilidade dos componentes abaixo" |
| Budget ADR-0002 com números | Prescritiva | Muito boa | Sem ajuste |
| Exemplo de enforcement Zod do budget | Prescritiva | Excelente, torna a regra executável | Sem ajuste |
| Regra de log do budget | Prescritiva | Excelente | Sem ajuste |
| Regras ADR-0003 de vigência | Prescritiva | Boa e conectada ao domínio | Sem ajuste |
| Campo source_document obrigatório | Prescritiva | Boa e concreta | Sem ajuste |
| Regras de linguagem e tipos | Prescritiva | Boas | Sem ajuste |
| Exceção de casting em helpers de teste | Prescritiva | Boa nuance; evita regra impraticável | Sem ajuste |
| Regras de validação com Zod | Prescritiva | Boas | Sem ajuste |
| Regras de logging com durationMs | Prescritiva | Muito boas | Sem ajuste |
| Regras de erros e mapUnknownError | Prescritiva | Boas | Sem ajuste |
| Árvore de arquivos com comentários APENAS | Mista | A árvore é contextual; os comentários ajudam, mas sozinhos não bastam | Como já há regras logo abaixo, está aceitável |
| Regras prescritivas de fronteira handler/services | Prescritiva | Um dos melhores trechos do artefato | Sem ajuste |
| Exemplo correto / incorreto DO/DON'T | Prescritiva | Muito bom para Copilot | Sem ajuste |
| Commits e branches | Prescritiva | Boa e específica ao cenário local | Sem ajuste |
| Specs e ADRs | Prescritiva | Boa | Sem ajuste |
| Linha "Regras detalhadas: ver seção Testing Standards" | Narrativa | Só referencia outra seção | Reescrever para "DEVE seguir também a seção Testing Standards quando gerar testes" |
| Regras de testes sobre fixtures e serviços reais | Prescritiva | Boas | Sem ajuste |
| Seções TODO de Product, QA e Delivery | Narrativa | Placeholder; não orienta agente | Reescrever para "SEÇÃO PENDENTE. NÃO DEVE assumir regras de produto/QA/gestão além das definidas nas ADRs e specs aprovadas" |
| Comandos locais | Narrativa de apoio | Útil para humanos; pouco útil para agente sem regra associada | Manter junto com as regras logo abaixo |
| Regras de build antes do PR | Prescritiva | Boa | Sem ajuste |
| Linha "Configuração em .mcp/mcp.json" | Narrativa | Contexto apenas | Reescrever para "DEVE ler e respeitar a configuração versionada em .mcp/mcp.json" |
| Regras de MCP locais e read-only | Prescritiva | Boa | Sem ajuste |
| Linhas que nomeiam CI e CD em arquivos .yml | Narrativa | Descrevem pipeline, não comportamento | Reescrever para "DEVE manter lint, build e test na CI e NÃO DEVE introduzir etapa de deploy sem gate de CI verde" |
| Regra de deploy só com CI verde | Prescritiva | Boa | Sem ajuste |
| Regras de variáveis de ambiente | Prescritiva | Boas | Sem ajuste |
| Checklist de aderência | Prescritiva para autor, não para agente | Útil para revisão do artefato | Manter como checklist de qualidade |
| Delta v1 → v2 | Narrativa analítica | Ótimo para avaliação, irrelevante para execução por agente | Pode ficar no entregável, mas eu separaria do AGENTS final de produção |

Leitura geral da prescritividade:
- Núcleo operacional do arquivo: forte.
- Contexto e análise: bons para avaliação humana, mas parte deles deveria sair do AGENTS final de produção e ficar só no relatório.
- Se você separar "AGENTS para o agente" de "análise para o avaliador", o artefato fica ainda mais limpo.

### Classificação
Aprovado com distinção

### Tópicos da Trilha para Reforço
Não há reforço obrigatório pelo score final. Se quiser maximizar nota e robustez de submissão, os dois pontos a lapidar são AGENTS.md como artefato estritamente prescritivo e evidência auditável de teste real com Copilot.