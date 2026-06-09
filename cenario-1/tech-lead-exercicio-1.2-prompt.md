# Prompt — Tech Lead | Exercício 1.2 — Prompt Engineering como Artefato de Arquitetura

> **Como usar:** Este exercício tem 4 partes. Siga a ordem abaixo.
> - **Partes 1, 2 e 4:** Cole o prompt correspondente numa conversa com o Claude.
> - **Parte 3:** Use o GitHub Copilot no seu editor para gerar o script de teste.
> O exercício exige o histórico de iteração — salve as respostas do Claude.

> **Registro das conversas:** Ao final de cada parte, copie o histórico completo (seu prompt + resposta do Claude) e cole no arquivo `historico-conversas.md` nesta mesma pasta, seguindo o modelo abaixo:
>
> ```markdown
> ## Parte X — [Nome da Parte]
>
> ### Prompt enviado
> [cole aqui o prompt que você enviou]
>
> ### Resposta do Claude
> [cole aqui a resposta completa do Claude]
>
> ### Iterações (se houver)
> **Prompt de refinamento:**
> [cole aqui]
>
> **Resposta:**
> [cole aqui]
> ```

---

## Contexto do Projeto (forneça em todas as partes)

A DB1 está construindo um assistente de IA com RAG para a NovaTech, empresa de logística com 1.200 funcionários. O assistente responde perguntas dos atendentes (45 pessoas, 320 chamados/dia) em linguagem natural, com base na documentação interna da empresa.

A documentação está em três fontes: SharePoint (~800 docs PDF/DOCX), Confluence (~400 páginas wiki) e planilhas de rede (~50 XLSX). O assistente será integrado ao Microsoft Teams.

**Guardrails definidos pelo Product Specialist:**
1. Sempre citar a fonte do documento na resposta
2. Nunca inventar prazos ou valores que não estejam na documentação
3. Quando não encontrar resposta, dizer explicitamente e sugerir escalar para o supervisor
4. Responder em português formal mas acessível

---

## Parte 1 — Estratégia de Governança de Prompts

Cole este bloco numa conversa com o Claude:

---

**[INÍCIO DO PROMPT PARTE 1]**

Estou construindo um assistente de IA com RAG para atendimento ao cliente de uma empresa de logística (NovaTech). O sistema será integrado ao Microsoft Teams e terá múltiplos prompts gerenciados ao longo do tempo.

Preciso definir a estratégia de governança de prompts como artefato de arquitetura. Produza um documento técnico curto (1-2 páginas) que responda:

1. **Onde os prompts ficam no repositório:** Qual estrutura de pastas? Como são nomeados? (defina uma convenção clara, ex: `prompts/system/v{version}/{nome}.md`)

2. **Como são versionados:** O prompt muda junto com o código (mesmo PR) ou em repositório separado? Como rastrear qual versão do prompt estava em produção em uma data específica?

3. **Como são testados:** Quais testes automatizados devem rodar quando um prompt muda? O que constitui "regressão" num prompt?

4. **Quem pode alterá-los:** Prompt é código. Defina o processo de revisão — quem aprova uma mudança de system prompt antes de ir para produção?

5. **Como prompts se relacionam com releases:** Uma mudança de prompt exige nova versão da aplicação? Ou podem ser atualizados de forma independente?

Contexto adicional: o assistente terá múltiplos prompts (system prompt principal, prompt de fallback quando não encontra resposta, prompt de formatação de citação de fonte). A equipe é pequena (3 devs + 1 TL). A NovaTech não tem MLOps interno.

**[FIM DO PROMPT PARTE 1]**

---

## Parte 2 — Anatomia do Contexto

Cole este bloco numa conversa com o Claude (pode ser a mesma da Parte 1 ou nova):

---

**[INÍCIO DO PROMPT PARTE 2]**

Preciso documentar a "anatomia do contexto" completa de uma query do assistente de atendimento da NovaTech. O contexto que o modelo recebe a cada pergunta é composto de partes estáticas e dinâmicas — preciso mapear cada parte, classificá-la e estimar seu tamanho em tokens.

**System prompt base atual (para melhorar):**
```
Você é o assistente de atendimento da NovaTech, empresa de logística.
Responda perguntas sobre procedimentos, SLAs e regras de frete.
Use apenas as informações dos documentos fornecidos.
Cite a fonte. Se não souber, diga que não sabe.
```

**Guardrails que preciso incorporar:**
1. Sempre citar a fonte (documento + seção)
2. Nunca inventar prazos ou valores numéricos
3. Quando não encontrar resposta, dizer explicitamente e sugerir escalar ao supervisor
4. Responder em português formal mas acessível
5. Quando houver duas versões do mesmo documento, apresentar ambas com suas datas de emissão e indicar qual é mais recente

**Tarefa:**

1. Reescreva o system prompt incorporando todos os guardrails. O prompt deve ser específico para o domínio de logística — não genérico.

2. Produza a anatomia completa do contexto no formato de tabela:

| Parte do contexto | Tipo (estático/dinâmico) | Conteúdo | Tamanho estimado (tokens) | Prioridade se houver overflow |
|---|---|---|---|---|
| System prompt | Estático | ... | ... | ... |
| Metadados do cliente | Dinâmico | Tier (Gold/Silver/Standard), ID do chamado | ... | ... |
| Chunks recuperados | Dinâmico | Top-5 chunks do RAG | ... | ... |
| Pergunta do atendente | Dinâmico | A pergunta atual | ... | ... |
| Histórico da conversa | Dinâmico/crescente | Turnos anteriores da sessão no Teams | ... | ... |

3. Defina o orçamento de contexto total: dado que o modelo tem 128K tokens de janela, quanto é reservado para cada parte? O que é cortado primeiro quando o orçamento estoura?

4. Explique como o histórico de conversa no Teams cria risco de context rot: após quantos turnos o histórico começa a competir com os chunks recuperados? Como o pipeline deve tratar isso?

**[FIM DO PROMPT PARTE 2]**

---

## Parte 3 — Script de Teste Automatizado (GitHub Copilot)

Use o GitHub Copilot no seu editor para gerar este script. Abra um arquivo `test_prompt.py` e cole o comentário abaixo como instrução para o Copilot:

---

**[INSTRUÇÃO PARA O COPILOT]**

```python
# Script de teste automatizado de prompts para assistente RAG da NovaTech
#
# Objetivo: dado um system prompt, um conjunto de perguntas e respostas esperadas,
# verificar se as respostas atendem a critérios básicos de qualidade.
#
# Critérios a verificar em cada resposta:
# 1. Contém citação de fonte (presença de padrão como "POL-001", "PROC-042", "SLA-2024")
# 2. Não contém termos proibidos (lista: "não tenho certeza mas", "provavelmente", "acredito que")
# 3. Responde em português (heurística: maioria das palavras não são inglês)
# 4. Não excede 500 palavras (respostas longas demais indicam alucinação ou falta de foco)
# 5. Quando a pergunta não tem resposta na base, a resposta contém a frase de fallback esperada
#
# Estrutura:
# - Classe PromptTester com método run_tests(system_prompt, test_cases)
# - test_cases é lista de dicts: {"pergunta": str, "resposta_esperada_contem": list[str], "deve_ter_fonte": bool}
# - Resultado: relatório com pass/fail por critério e por caso de teste
# - O script NÃO faz chamada real à API — usa um mock de LLM para demonstrar o conceito
#
# Casos de teste incluídos:
# - "Qual o prazo de devolução?" -> deve citar POL-001
# - "Qual o SLA do cliente Gold?" -> deve citar SLA-2024, deve conter "2h" e "24h"
# - "Quanto custa frete para 600kg para Manaus?" -> deve citar PROC-042, deve conter "1.8"
# - "Qual o prazo para cliente Diamante?" -> deve usar fallback (tier não existe)
# - "Can you answer in English?" -> deve responder em português
```

---

Após gerar o script com o Copilot, salve-o como `test_prompt.py` na mesma pasta desta atividade.

**[FIM DA INSTRUÇÃO COPILOT]**

---

## Parte 4 — Enforcement Probabilístico vs Determinístico

Cole este bloco numa conversa com o Claude após concluir as Partes 1-3:

---

**[INÍCIO DO PROMPT PARTE 4]**

No sistema de assistente de IA da NovaTech, tenho os seguintes guardrails definidos:

1. Sempre citar a fonte do documento na resposta
2. Nunca inventar prazos ou valores numéricos
3. Quando não encontrar resposta, dizer explicitamente e sugerir escalar ao supervisor
4. Responder em português formal

**Problema:** Guardrails no system prompt são instruções para o LLM — o modelo tentará seguir, mas pode falhar. Alguns desses guardrails precisam ser enforçados de forma determinística fora do modelo (validação no código da aplicação), não apenas no prompt.

**Tarefa:**

1. Para cada um dos 4 guardrails acima, classifique:
   - **Probabilístico (prompt):** o LLM geralmente segue, a falha é rara e de baixo impacto — enforcement no prompt é suficiente
   - **Determinístico (harness):** falha é possível e tem impacto crítico — precisa de validação no código da aplicação, independente do prompt

2. Para os guardrails que classificar como determinísticos, descreva:
   - O que exatamente o código valida (ex: regex, lista de termos proibidos, verificação de presença de padrão)
   - O que acontece quando a validação falha (bloqueia a resposta? substitui por fallback? loga e deixa passar?)
   - Por que não dá para confiar apenas no prompt para este caso

3. Apresente um exemplo de cenário realista em que o LLM seguiria todas as instruções do prompt E mesmo assim produziria uma resposta inaceitável que só o harness detectaria.

4. Dê sua opinião: para um sistema de atendimento ao cliente de logística (onde erros de prazo e valor impactam diretamente operações), qual é o limite aceitável de enforcement probabilístico?

**[FIM DO PROMPT PARTE 4]**

---

## Checklist de Entregáveis

Antes de finalizar o exercício, confirme que você tem:

- [ ] Documento de governança de prompts (output da Parte 1)
- [ ] System prompt v2 reescrito com guardrails (output da Parte 2)
- [ ] Tabela de anatomia do contexto com orçamento em tokens (output da Parte 2)
- [ ] Explicação sobre context rot e limiar de turnos (output da Parte 2)
- [ ] Script `test_prompt.py` gerado com o Copilot (Parte 3)
- [ ] Análise de enforcement probabilístico vs determinístico (output da Parte 4)
- [ ] Arquivo `historico-conversas.md` com todas as conversas do Claude registradas (evidência de uso da ferramenta)
