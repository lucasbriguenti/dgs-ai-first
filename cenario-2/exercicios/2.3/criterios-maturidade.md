# Critérios de maturidade — skill `azure-functions-endpoint`

> Quando a skill está pronta para uso pelo time. Cada critério tem: métrica | limiar de aprovação | evidência necessária.

---

## Dimensão 1 — Aderência em gerações reais

| Métrica | Limiar de aprovação | Evidência necessária |
|---|---|---|
| Taxa de itens "Seguido" na tabela de aderência (§1 da auditoria) | ≥ 85% dos itens verificáveis por geração | Tabela preenchida para cada rodada de teste |
| Nenhum item "Ignorado" com impacto **Alto** | 0 itens Alto ignorados | Coluna "Status" da tabela de aderência |
| Itens "Parcial" com impacto Alto ou Médio | 0 Alto + ≤ 1 Médio por geração | Idem |
| Número de rodadas testadas com Copilot | ≥ 3 gerações aprovadas (endpoint + testes em cada) | `copilot-rodada-N.md` salvo para cada rodada |

**Estado atual:** 2 rodadas concluídas. Rodada 1: 14 seguidos, 5 parciais, 4 ignorados (1 Alto). Rodada 2: 19 seguidos, 1 parcial (Médio), 0 ignorados, 0 Altos. **Falta 1 rodada adicional aprovada para atingir o limiar.**

---

## Dimensão 2 — Clareza e prescritividade

| Métrica | Limiar de aprovação | Evidência necessária |
|---|---|---|
| % de regras em DEVE / NÃO DEVE / QUANDO EM DÚVIDA (nenhuma descritiva) | 100% | Revisão manual da seção §4; nenhuma regra no tom "é recomendável" ou "pode-se" |
| Exemplos DO/DON'T com código TypeScript **real** do projeto (não pseudocódigo) | ≥ 1 par completo por regra crítica | §6 e §11 da skill |
| Texto e tabela de evidência (§10) alinhados para cada regra | 100% (sem conflito texto vs. evidência) | Conferência cruzada §4 ↔ §10 — ambos descrevem o mesmo trecho |
| Frases de ativação cobrindo todos os contextos de uso do projeto | ≥ 4 gatilhos distintos | §2 da skill |

**Estado atual:** Atingido na v2. Único resíduo: §4.5 (log externo com `durationMs`) ainda delega à leitura de `src/services/` — aceitável, pois o service não é escopo desta skill.

---

## Dimensão 3 — Cobertura de anti-padrões (validados em teste real)

| Métrica | Limiar de aprovação | Evidência necessária |
|---|---|---|
| Anti-padrões listados (§7 da skill) com ocorrência confirmada em ≥ 1 rodada de Copilot | ≥ 80% dos anti-padrões têm "rodada em que apareceu" na auditoria | Cruzamento §7 ↔ auditoria de rodada |
| Anti-padrão crítico de domínio (A13 — recuperação vazia) testado e corrigido | Deve aparecer como "Ignorado" na rodada 1 e "Seguido" na rodada 2 | `auditoria-aderencia.md` + `copilot-rodada-2.md` |
| Falhas comuns (§11) derivadas de código real, não hipotéticas | 100% com origem rastreável à rodada 1 | F1–F11: cada uma tem gap correspondente na auditoria |
| Nenhum anti-padrão **inventado** (não observado em nenhuma rodada) | 0 anti-padrões sem ocorrência real | Auditoria + notas das rodadas |

**Estado atual:** Atingido. A1–A12 existiam na v1 (observados na literatura do projeto ou na rodada 1); A13 (recuperação vazia) e A14 (`as any` em mock) derivam diretamente da rodada 1 e da auditoria.

---

## Dimensão 4 — Estabilidade após iterações

| Métrica | Limiar de aprovação | Evidência necessária |
|---|---|---|
| Nenhuma regra revertida entre v1 e v2 (sem regressão de padrão) | 0 reversões | `§13 Delta v1→v2`: todas as linhas são adições/endurecimentos, não remoções |
| Seção Delta v1→v2 completa (regra antiga / regra nova / gap corrigido) | 1 linha por mudança substantiva | §13 da skill v2 |
| v2 compila e testa com `npm run build && npm run test` no código gerado | exit 0 em ambos | Executar nos arquivos da rodada 2 |
| Número de iterações para estabilizar aderência | ≤ 3 iterações para zerar Altos e Médios | v1 → v2 zerou os Altos em 1 iteração |

**Estado atual:** v1→v2 não reverteu nenhuma regra. Delta documentado em §13 (6 linhas). Build/test da rodada 2 dependem de `src/services/` completos no repo — estrutura presente, mocks cobrem os serviços nos testes.

---

## Dimensão 5 — Aprovação em review técnico

| Métrica | Limiar de aprovação | Evidência necessária |
|---|---|---|
| Review do Tech Lead na skill (conteúdo e aderência ao AGENTS.md) | 1 approval explícito registrado | Comentário no PR ou entrada em `docs/adr/` |
| Review por ao menos 1 desenvolvedor consumidor (que gerou código com a skill) | 1 approval do Dev | Relato de uso real + eventual ajuste pedido |
| Nenhuma contradição com o AGENTS.md v2 | 0 conflitos | Conferência manual §4 ↔ AGENTS.md "Coding Standards" + "source_document" + ADR-0002/0003 |
| Skill referenciada nos `tasks.md` que geram endpoints (o Dev sabe onde encontrá-la) | ≥ 1 task com menção a `skills/domain/azure-functions-endpoint.md` | `specs/query-endpoint/tasks.md` ou equivalente |

**Estado atual:** review técnico é o único limiar ainda pendente (esta fase é local, sem PR real). Sem contradições com AGENTS.md v2 detectadas (conferência feita na escrita da v2).

---

## Checklist go/no-go para promover a skill a "Recomendada para o time"

```
[ ] D1. ≥ 3 gerações Copilot aprovadas (≤ 1 Médio ignorado; 0 Altos).
[ ] D2. 100% das regras em DEVE/NÃO DEVE; texto e §10 alinhados.
[ ] D3. ≥ 80% dos anti-padrões com ocorrência rastreável em rodada real.
[ ] D4. Delta v1→v2 documentado; sem reversões; build + test passando no código da última rodada.
[ ] D5. 1 approval do Tech Lead + 1 approval de Dev consumidor registrados.
[ ] D5. Sem contradição com AGENTS.md v2.
[ ] D5. Skill referenciada em ≥ 1 tasks.md de endpoint.
```

**Resultado atual:** 5 de 7 itens atingidos (✅ D2, D3, D4, e parcialmente D5-contradição).
Pendentes: **D1** (falta 1 rodada aprovada) e **D5** (approvals + referência em tasks.md).

**Veredito:** `Em evolução` — skill funcional e substantivamente melhorada, bloqueada apenas por volume de gerações (D1) e formalização de review (D5). Uma terceira rodada aprovada e a inclusão em `tasks.md` promovem para `Recomendada`.
