# Relatório Final — Tech Lead 3.2: Revisão Crítica da Arquitetura Gerada com IA

**Exercício:** 3.2 — Revisão Crítica de Outputs de IA  
**Papel:** Tech Lead  
**Projeto:** NovaTech Assistant  
**Data:** 2026-06-26  
**Ferramentas usadas:** Análise própria (Prompt 0) + Claude como co-reviewer (Prompts 1–4)  
**Método:** autoavaliação independente → co-revisão → comparação de delta → priorização

---

## 1. Resumo executivo

Cinco artefatos do NovaTech Assistant foram gerados com apoio de IA (AGENTS.md, 3 skills, código do pipeline e endpoint, system prompt) e revisados antes do go-live usando dois pares de olhos independentes: avaliação própria do Tech Lead seguida de co-revisão pelo Claude. Os níveis de risco convergiram em todos os artefatos — dois Altos (skills sem refinamento e system prompt sem changelog), dois Médios (AGENTS.md e código), um Baixo (skill Foundation). O risco mais subestimado antes da co-revisão era o das skills Domain e Artifact: o problema não é apenas a qualidade atual, mas o fato de que o time as usará para gerar código pós-go-live sem que existia validação empírica do padrão que elas prescrevem. O system prompt sem changelog não é apenas risco de drift — é risco de diagnóstico: qualquer incidente em produção começa às cegas. Dado o contexto de 2 semanas, o go-live é viável com ressalvas — desde que 3 ações de alta prioridade sejam executadas antes da demo.

---

## 2. Riscos por artefato — tabela consolidada

| Artefato | Risco principal | Nível | O que verificar antes do go-live |
|---|---|---|---|
| **AGENTS.md** *(15 pág., 4 refinamentos)* | Inconsistência acumulada entre seções por refinamentos isolados — regras de ADR-0002 podem ter derivado do original; fronteiras de camada podem se sobrepor | **Médio** | Comparar regras de context budget com ADR-0002 original. Verificar se responsabilidades de camada não se repetem entre seções |
| **Skill Foundation** *(v1→v2, 2 testes reais)* | Cobertura limitada ao query endpoint — edge cases de outros padrões (ex: feedback handler) não foram testados | **Baixo** | Confirmar que o delta v1→v2 é comportamental, não cosmético |
| **Skills Domain + Artifact** *(sem refinamento, sem teste real)* | Gerarão código inconsistente com o padrão do projeto quando usadas pós-go-live — sem validação empírica do padrão prescrito | **Alto** | Executar 1 geração com Copilot por skill e comparar output contra AGENTS.md. Se não houver tempo: marcar como `rascunho` e bloquear uso em produção |
| **Código pipeline + endpoint** *(~70% Copilot, 75% cobertura)* | Os 25% descobertos provavelmente cobrem caminhos de erro e fallback — exatamente os que falham em produção e demos | **Médio** | Identificar quais caminhos estão nos 25% descobertos. Testar manualmente: retrieval retornando `[]`, timeout de Azure OpenAI, resposta fora do schema |
| **System prompt** *(6 iterações, sem changelog)* | Rollback impossível sem histórico de motivações — se o assistente regredir em produção, não há como diagnosticar qual iteração introduziu o problema | **Alto** | Rodar prompt v6 contra golden dataset (8–10 perguntas fixas). Criar `git tag prompt-v6-baseline`. Manter v5 acessível como fallback etiquetado |

---

## 3. Delta humano vs. Claude — concordâncias e divergências

### Concordâncias

- **Níveis de risco:** todos os 5 artefatos tiveram o mesmo nível em ambas as avaliações (Médio, Baixo, Alto, Médio, Alto). A convergência foi independente — as avaliações foram feitas sem consulta prévia.
- **Skills sem refinamento → Alto:** ambos identificaram que nunca terem sido testadas com Copilot é o risco central. A framing foi diferente (alucinação/funções fantasma vs. padrões inconsistentes pós-go-live) mas o diagnóstico convergiu.
- **System prompt → Alto:** ambos nomearam "prompt drift". A avaliação própria focou em detectar regressão via golden dataset; a co-revisão acrescentou o ângulo de diagnóstico de incidentes em produção.

### O que a co-revisão acrescentou

- **Skills Domain + Artifact — o risco não termina no go-live.** A avaliação própria focou no que está errado agora (APIs fantasma, premissas erradas). A co-revisão identificou que o risco maior é de governança contínua: o time vai usar essas skills para gerar código novo após o go-live, e o output vai parecer correto sem sê-lo. Isso muda a resposta: não basta revisar o que foi gerado — é preciso bloquear o uso das skills até validação.
- **System prompt — o problema é o diagnóstico, não só o drift.** A avaliação própria propôs o golden dataset (correto). A co-revisão acrescentou: sem changelog, qualquer investigação de incidente começa às cegas. O rollback para v5 precisa ser etiquetado agora, não quando o problema aparecer.
- **Código — a pergunta é "onde está o 25%", não "tem Zod?"** A avaliação própria focou em segurança (hardcoded tokens, injeção). A co-revisão focou na cobertura de caminhos de falha. Dado que o projeto já usa Zod e TypeScript strict, o risco de injeção é menor que o risco de um path de erro não testado causando falha silenciosa em produção.

### O que a avaliação própria levantou que a co-revisão tratou como menos central

- **Hardcoded tokens e injeção no código:** risco real, mas mitigado estruturalmente pelo TypeScript strict e Zod. A co-revisão não descartou — priorizou o 25% de cobertura acima. Resolução: um `grep` de 30 minutos cobre o risco de segurança sem competir com as prioridades maiores.
- **Sobreposição de responsabilidades no AGENTS.md:** verificação válida e complementar à checagem de consistência com ADRs. Ambas as verificações cabem na mesma sessão de 2h.

---

## 4. Plano de ação priorizado

### Semana 1 — Pré-demo (estimativa: ~7h)

| Ação | Esforço | Justificativa |
|---|---|---|
| Rodar prompt v6 contra golden dataset de 8–10 perguntas e criar `git tag prompt-v6-baseline` | ~4h | A demo é o momento de maior risco — drift no prompt detectado ao vivo não tem recuperação rápida |
| Identificar quais caminhos estão nos 25% descobertos de cobertura; testar manualmente os caminhos de falha críticos | ~2h | Um HTTP 500 ao vivo para a diretoria é pior do que qualquer risco de arquitetura |
| Adicionar `status: rascunho — não usar para geração em produção` nas skills Domain e Artifact | ~15 min | Bloqueia o risco de geração com skill não testada antes da demo sem custo de tempo |

### Pós-demo / pré-go-live (estimativa: ~12h)

| Ação | Esforço | Justificativa |
|---|---|---|
| Executar 1 geração com Copilot para cada skill (Domain + Artifact) e comparar output contra AGENTS.md | ~4h | Validação mínima para promover as skills de rascunho a utilizável |
| Escrever testes para os caminhos críticos identificados na semana 1 (retrieval vazio, timeout, resposta fora do schema) | ~4–6h | Fechar os gaps de cobertura que podem causar falha silenciosa — não fechar tudo, só os de maior impacto |
| Comparar seções de context budget e fronteiras de camada do AGENTS.md com ADR-0002 e ADR-0003 originais | ~2h | Inconsistências que sobreviveram até aqui não são bloqueantes mas geram dívida técnica pós-go-live |

### Risco residual aceito

| Risco | Mitigação mínima |
|---|---|
| Skills sem validação completa (se P1 não couber na semana 1) | Manter marcadas como `rascunho`; qualquer geração com elas exige code review adicional até serem promovidas |
| AGENTS.md sem auditoria linha a linha das 15 páginas | Se um bug for atribuído ao AGENTS.md pós-go-live, a seção relevante vai direto para revisão — auditoria completa é pós-go-live |
| Auditoria de segurança formal do código Copilot | `grep` de 30 min por hardcoded secrets e `as any` cobre o risco mais óbvio; SAST formal é backlog do próximo sprint |

---

## 5. Parecer de go-live

**Veredicto: Pronto com ressalvas**

O sistema pode ir ao go-live se as 3 ações da semana 1 forem executadas:
1. Golden dataset do prompt v6 documentado e baseline etiquetado.
2. Caminhos críticos dos 25% descobertos testados manualmente.
3. Skills Domain e Artifact bloqueadas para geração em produção até validação.

**O que seria bloqueante e ainda não está fechado:**

- System prompt sem baseline documentado: se o assistente regredir no dia 1 de produção, não há ponto de referência para diagnóstico. Isso é bloqueante — não porque o prompt atual esteja errado, mas porque sem baseline qualquer investigação começa às cegas.
- Caminhos de falha do código sem teste ou verificação manual: um retrieval retornando vazio ou um timeout de Azure OpenAI sem tratamento adequado pode gerar HTTP 500 para os atendentes no primeiro dia de uso real.

**O que é risco residual aceito sem ser bloqueante:**

- AGENTS.md com possíveis inconsistências menores.
- Skills sem validação completa (desde que bloqueadas para uso).
- Cobertura de código nos 75% (aceitável para go-live controlado com 5 atendentes-piloto).

O go-live com 5 atendentes-piloto é o contexto certo para aceitar esses riscos residuais: a escala controlada limita o impacto de qualquer problema não antecipado e permite corrigi-lo antes da expansão.
