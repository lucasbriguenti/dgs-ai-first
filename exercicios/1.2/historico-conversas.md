# Histórico de Conversas — Tech Lead | Exercício 1.2

> Cole aqui o histórico completo de cada parte após concluí-la.

---

## Parte 1 — Estratégia de Governança de Prompts

### Prompt enviado

Estou construindo um assistente de IA com RAG para atendimento ao cliente de uma empresa de logística (NovaTech). O sistema será integrado ao Microsoft Teams e terá múltiplos prompts gerenciados ao longo do tempo.

Preciso definir a estratégia de governança de prompts como artefato de arquitetura. Produza um documento técnico curto (1-2 páginas) que responda:

1. **Onde os prompts ficam no repositório:** Qual estrutura de pastas? Como são nomeados? (defina uma convenção clara, ex: `prompts/system/v{version}/{nome}.md`)

2. **Como são versionados:** O prompt muda junto com o código (mesmo PR) ou em repositório separado? Como rastrear qual versão do prompt estava em produção em uma data específica?

3. **Como são testados:** Quais testes automatizados devem rodar quando um prompt muda? O que constitui "regressão" num prompt?

4. **Quem pode alterá-los:** Prompt é código. Defina o processo de revisão — quem aprova uma mudança de system prompt antes de ir para produção?

5. **Como prompts se relacionam com releases:** Uma mudança de prompt exige nova versão da aplicação? Ou podem ser atualizados de forma independente?

Contexto adicional: o assistente terá múltiplos prompts (system prompt principal, prompt de fallback quando não encontra resposta, prompt de formatação de citação de fonte). A equipe é pequena (3 devs + 1 TL). A NovaTech não tem MLOps interno.

### Resposta do Claude

# Governança de Prompts como Artefato de Arquitetura
**NovaTech RAG Assistant — Documento Técnico v1.0**

---

## 1. Estrutura no Repositório

Os prompts vivem no mesmo repositório da aplicação, sob a pasta `/prompts`. Convenção de nomes e organização:

```
prompts/
├── system/
│   ├── v1/
│   │   └── assistant-main.md
│   └── v2/
│       └── assistant-main.md
├── fallback/
│   └── v1/
│       └── no-answer.md
└── formatting/
    └── v1/
        └── source-citation.md
```

**Regras de nomenclatura:**
- Pasta de tipo: `system/`, `fallback/`, `formatting/`
- Subpasta de versão: `v{N}/` — incrementa a cada mudança que altera comportamento
- Nome do arquivo: kebab-case descritivo do propósito (`assistant-main.md`, `no-answer.md`)
- Cada arquivo `.md` contém: o texto do prompt, metadados em frontmatter YAML (versão, data, autor, modelo-alvo) e uma seção `## Changelog` ao final

```yaml
---
version: "2.1"
created: 2024-11-01
author: dev-initials
target_model: claude-3-5-sonnet
scope: system-prompt
---
```

---

## 2. Versionamento

**Regra geral: prompt muda junto com o código, no mesmo PR.**

Isso garante rastreabilidade imediata — o commit que alterou o prompt é o mesmo que deployou a versão. O histórico do Git é a fonte da verdade.

**Como rastrear qual prompt estava em produção em uma data:**

```bash
# Ver qual versão do prompt estava ativa em determinada data
git log --before="2024-11-15" --follow -p prompts/system/v2/assistant-main.md
```

Adicionalmente, a aplicação loga em startup qual arquivo de prompt carregou, incluindo o hash do commit. Isso cria um segundo ponto de rastreabilidade no sistema de logs (ex: Application Insights no Azure, já que o stack é Microsoft Teams).

**Exceção:** ajustes de wording que não alteram comportamento (correção de ortografia, clareza) podem ir em PR separado sem bump de versão da aplicação, mas ainda passam pelo processo de revisão.

---

## 3. Testes Automatizados

Toda mudança em arquivo sob `/prompts/` dispara automaticamente o seguinte pipeline no CI:

| Teste | O que verifica | Falha de regressão se... |
|---|---|---|
| **Guardrail presence** | Regex confirma que as 4 regras obrigatórias estão no texto | Qualquer guardrail sumiu do prompt |
| **Golden set eval** | 20 pares (pergunta, resposta esperada) contra um mock LLM | Taxa de acerto cai abaixo de 85% |
| **Forbidden patterns** | O prompt não instrui o modelo a inventar dados | Aparece instrução como "estime", "infira" |
| **Token budget** | O system prompt não excede o limite reservado (≤ 1.200 tokens) | Ultrapassar o limite definido na arquitetura |
| **Diff review obrigatório** | Bloqueia merge sem aprovação humana | — (não automatizável) |

**O que é regressão num prompt:** qualquer mudança que faz o modelo passar a citar fontes incorretas, omitir a frase de fallback quando não há resposta, ou produzir valores numéricos sem base documental.

---

## 4. Processo de Revisão (Quem Pode Alterar)

Prompt é código. O processo é equivalente ao de code review:

```
Dev propõe mudança → PR com diff do .md
        ↓
CI roda testes automatizados (obrigatório passar)
        ↓
Tech Lead revisa (aprovação obrigatória)
        ↓
Product Specialist valida comportamento esperado (aprovação obrigatória)
        ↓
Merge → Deploy
```

**Papéis e responsabilidades:**
- **Dev:** pode propor qualquer alteração, mas não pode fazer merge sem aprovações
- **Tech Lead:** aprova que a mudança é tecnicamente segura e não quebra guardrails
- **Product Specialist:** aprova que o comportamento resultante está alinhado ao negócio

Para a equipe pequena (3 devs + 1 TL), o mínimo é: **1 aprovação do TL + 1 validação do PS** antes de qualquer mudança no system prompt principal. Prompts secundários (fallback, formatação) exigem apenas aprovação do TL.

Mudanças emergenciais (ex: prompt produzindo resposta crítica incorreta) seguem um hotfix track: TL aprova e faz deploy imediato, PS valida em até 2h após.

---

## 5. Prompts e Releases

**Regra:** mudança de prompt **acompanha** o versionamento semântico da aplicação, mas **não exige** um novo deploy de infraestrutura se a aplicação suportar carregamento dinâmico de arquivos.

**Estratégia recomendada para este stack:**

Os prompts são carregados do repositório via variável de ambiente que aponta para o path versionado. A aplicação lê o arquivo em startup. Isso permite:

- **Patch de prompt sem redeploy:** atualizar a variável `PROMPT_PATH=prompts/system/v2/assistant-main.md` no ambiente é suficiente para trocar o prompt sem novo build
- **Rastreabilidade mantida:** a variável de ambiente é registrada nos logs de startup com o hash do commit correspondente

**Versionamento semântico aplicado a prompts:**
- `MAJOR`: mudança que altera fundamentalmente o comportamento (ex: novo domínio, remoção de guardrail)
- `MINOR`: adição de instrução ou contexto novo
- `PATCH`: correção de wording, ortografia, clareza

Mudanças `MAJOR` sempre acompanham uma versão nova da aplicação. `MINOR` e `PATCH` podem ser atualizadas independentemente via configuração de ambiente.

---

**Resumo executivo para a equipe:**

> Todo prompt é um artefato versionado em Git, com revisão obrigatória de TL + PS antes de produção. O CI bloqueia merges que quebrem guardrails ou o budget de tokens. Prompts menores podem ser trocados sem redeploy; mudanças comportamentais seguem o ciclo de release normal da aplicação.

### Iterações (se houver)

**Prompt de refinamento:**

<!-- cole aqui -->

**Resposta:**

<!-- cole aqui -->

---

## Parte 2 — Anatomia do Contexto

### Prompt enviado

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
2. Produza a anatomia completa do contexto no formato de tabela.
3. Defina o orçamento de contexto total: dado que o modelo tem 128K tokens de janela, quanto é reservado para cada parte? O que é cortado primeiro quando o orçamento estoura?
4. Explique como o histórico de conversa no Teams cria risco de context rot: após quantos turnos o histórico começa a competir com os chunks recuperados? Como o pipeline deve tratar isso?

### Resposta do Claude

# Anatomia do Contexto — NovaTech RAG Assistant

---

## 1. System Prompt v2 (reescrito com todos os guardrails)

```
Você é o Assistente de Atendimento da NovaTech, empresa de logística. Sua função é apoiar os atendentes do suporte interno respondendo perguntas sobre procedimentos operacionais, SLAs, regras de frete, políticas de devolução e normas da empresa.

REGRAS OBRIGATÓRIAS — siga todas sem exceção:

1. CITAÇÃO DE FONTE: Toda resposta que contenha uma informação factual DEVE citar a fonte no formato: (Fonte: [nome do documento] — [seção/página], emitido em [data]). Sem fonte, não afirme o fato.

2. PROIBIÇÃO DE INVENÇÃO: Nunca informe prazos, valores monetários, percentuais ou métricas que não estejam explicitamente nos documentos recuperados. Se o documento não contém o número exato, diga que a informação não está disponível.

3. FALLBACK OBRIGATÓRIO: Quando os documentos recuperados não contiverem resposta suficiente para a pergunta, responda exatamente: "Não encontrei essa informação na base de documentos disponível. Recomendo escalar esta dúvida ao seu supervisor ou ao setor responsável."

4. DOCUMENTOS CONFLITANTES: Quando dois documentos tratarem do mesmo tema com informações diferentes, apresente ambas as versões, informe a data de emissão de cada uma e indique qual é mais recente.

5. IDIOMA E TOM: Responda sempre em português formal, mas acessível — sem jargões técnicos desnecessários, sem abreviações não explicadas. O atendente pode repassar sua resposta diretamente ao cliente.

LIMITAÇÕES DO SEU PAPEL: Você não tem acesso a sistemas em tempo real (rastreamento de carga, ERP, CRM). Para consultas que exijam dados ao vivo, oriente o atendente a acessar o sistema correspondente.

Contexto do atendente: {atendente_nome}, chamado #{chamado_id}, cliente tier: {cliente_tier}.
```

---

## 2. Tabela de Anatomia do Contexto

| Parte do contexto | Tipo | Conteúdo | Tamanho estimado (tokens) | Prioridade se houver overflow |
|---|---|---|---|---|
| **System prompt** | Estático | Instruções de comportamento, guardrails, restrições de domínio | ~450 tokens | Nunca cortado — é a identidade do modelo |
| **Metadados do atendente/chamado** | Dinâmico (por sessão) | Nome do atendente, ID do chamado, tier do cliente (Gold/Silver/Standard) | ~50 tokens | Nunca cortado — afeta tom e SLA aplicável |
| **Chunks recuperados (RAG)** | Dinâmico (por query) | Top-5 chunks do índice vetorial (~300 tokens cada) | ~1.500 tokens | Cortado por relevância: reduz de top-5 para top-3 → top-2 |
| **Pergunta do atendente** | Dinâmico (por turno) | A pergunta atual em linguagem natural | ~80 tokens | Nunca cortado — é o input da query |
| **Histórico da conversa** | Dinâmico/crescente | Turnos anteriores da sessão no Teams (pergunta + resposta) | ~300 tokens por turno | Primeiro a ser cortado: janela deslizante, mantém apenas os 3 turnos mais recentes |

---

## 3. Orçamento de Contexto (janela de 128K tokens)

| Partição | Budget reservado | Justificativa |
|---|---|---|
| System prompt | 500 tokens (fixo) | Margem para crescimento do prompt até v3 |
| Metadados de sessão | 100 tokens (fixo) | Nome, ID, tier — sempre presentes |
| Chunks RAG (top-5) | 2.000 tokens | 5 × ~400 tokens com overlap de metadados |
| Pergunta atual | 200 tokens | Perguntas longas de atendimento raramente excedem isso |
| Histórico da conversa | 2.000 tokens | ~6 turnos completos (pergunta + resposta curta) |
| **Reserva para resposta** | **2.000 tokens** | Output do modelo — respostas de suporte têm limite de 500 palavras |
| **Total operacional** | **~6.800 tokens** | Muito abaixo do limite de 128K |

**Conclusão:** a janela de 128K tokens é superabundante para o caso de uso. O risco não é estouro de janela — é context rot por acúmulo de histórico de baixa qualidade.

**Política de overflow (quando aplicada):**
1. Reduz chunks RAG de top-5 → top-3
2. Trunca histórico para os últimos 3 turnos
3. Nunca corta system prompt, metadados ou pergunta atual

---

## 4. Context Rot e o Histórico do Teams

**O que é context rot aqui:** ao longo de uma sessão longa no Teams, o histórico de turnos anteriores ocupa tokens crescentes. O problema não é quantidade — é qualidade: turnos antigos sobre um tema diferente contaminam o contexto da pergunta atual, fazendo o modelo misturar informações de perguntas distintas numa mesma sessão.

**A partir de quantos turnos começa o risco:**

Com o budget acima, cada turno completo ocupa ~300–500 tokens (pergunta curta + resposta de suporte). O threshold crítico não é de tokens, mas de **mudança de tema**:

- **Turnos 1–3 (mesmo tema):** histórico é útil — o modelo usa contexto anterior para refinar respostas
- **Turno 4+ (tema novo):** histórico de turnos anteriores passa a competir ativamente com os chunks RAG recuperados para a nova query. O modelo pode ancorar em informações de um chamado anterior em vez de nos documentos recuperados para a pergunta atual.

**Como o pipeline deve tratar:**

| Estratégia | Quando aplicar | Implementação |
|---|---|---|
| **Janela deslizante** | Sempre | Manter apenas os últimos N turnos (recomendado: 3) |
| **Reset por intent shift** | Quando a query muda de domínio | Classificador leve detecta mudança de tema (ex: de "SLA" para "devolução") e descarta histórico |
| **Sumarização de histórico** | Sessões muito longas (> 8 turnos) | LLM sumariza os turnos antigos em 1–2 frases antes de incluir no contexto |
| **Session ID separado por assunto** | Nível de UX no Teams | O atendente inicia nova conversa por chamado, não por sessão do dia |

**Recomendação para NovaTech:** dado que são 45 atendentes com ~7 chamados/dia cada, a sessão no Teams tende a misturar múltiplos chamados distintos. A solução mais simples e efetiva é **vincular o histórico ao ID do chamado, não à sessão do Teams** — ao abrir um novo chamado, o pipeline reseta o histórico automaticamente, eliminando o risco de context rot na maior parte dos casos.

### Iterações (se houver)

**Prompt de refinamento:**

<!-- cole aqui -->

**Resposta:**

<!-- cole aqui -->

---

## Parte 3 — Script de Teste (GitHub Copilot)

### Instrução fornecida ao Copilot

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

### Código gerado

```python
from __future__ import annotations

import re
from dataclasses import dataclass, field

CITATION_PATTERN = re.compile(r'\b(POL|PROC|SLA|CONF|SPT)-\d+\b', re.IGNORECASE)
FORBIDDEN_TERMS = ["não tenho certeza mas", "provavelmente", "acredito que"]
FALLBACK_PHRASE = "Não encontrei essa informação na base de documentos disponível"
COMMON_ENGLISH_WORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can",
    "her", "was", "one", "our", "out", "day", "get", "has", "him",
    "his", "how", "its", "may", "new", "now", "old", "see", "two",
    "who", "boy", "did", "had", "let", "put", "say", "she", "too",
    "use", "answer", "please", "hello", "this", "that", "with",
}


@dataclass
class TestCase:
    pergunta: str
    mock_response: str
    resposta_esperada_contem: list[str] = field(default_factory=list)
    deve_ter_fonte: bool = True
    is_fallback_case: bool = False


@dataclass
class CriterionResult:
    name: str
    passed: bool
    detail: str


@dataclass
class TestCaseResult:
    pergunta: str
    criteria: list[CriterionResult]

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.criteria)


class PromptTester:
    def __init__(self, verbose: bool = True) -> None:
        self.verbose = verbose

    def _check_citation(self, response: str, required: bool) -> CriterionResult:
        has_citation = bool(CITATION_PATTERN.search(response))
        if not required:
            return CriterionResult("citação de fonte", True, "não exigida para este caso")
        passed = has_citation
        detail = "citação encontrada" if passed else "nenhuma citação no padrão esperado (POL-XXX, SLA-XXX…)"
        return CriterionResult("citação de fonte", passed, detail)

    def _check_forbidden_terms(self, response: str) -> CriterionResult:
        found = [t for t in FORBIDDEN_TERMS if t.lower() in response.lower()]
        passed = len(found) == 0
        detail = "nenhum termo proibido" if passed else f"termos proibidos encontrados: {found}"
        return CriterionResult("ausência de termos proibidos", passed, detail)

    def _check_portuguese(self, response: str) -> CriterionResult:
        words = re.findall(r'\b[a-zA-Z]+\b', response.lower())
        if not words:
            return CriterionResult("idioma português", True, "sem palavras alfabéticas para avaliar")
        english_count = sum(1 for w in words if w in COMMON_ENGLISH_WORDS)
        ratio = english_count / len(words)
        passed = ratio < 0.3
        detail = f"ratio de palavras inglesas: {ratio:.0%}" + (" — possível resposta em inglês" if not passed else "")
        return CriterionResult("idioma português", passed, detail)

    def _check_length(self, response: str, max_words: int = 500) -> CriterionResult:
        count = len(response.split())
        passed = count <= max_words
        detail = f"{count} palavras" + (f" — excede o limite de {max_words}" if not passed else "")
        return CriterionResult("comprimento da resposta", passed, detail)

    def _check_expected_content(self, response: str, expected: list[str]) -> CriterionResult:
        if not expected:
            return CriterionResult("conteúdo esperado", True, "nenhum conteúdo obrigatório definido")
        missing = [e for e in expected if e.lower() not in response.lower()]
        passed = len(missing) == 0
        detail = "todos os termos esperados presentes" if passed else f"termos ausentes: {missing}"
        return CriterionResult("conteúdo esperado", passed, detail)

    def _check_fallback(self, response: str, is_fallback_case: bool) -> CriterionResult:
        if not is_fallback_case:
            return CriterionResult("frase de fallback", True, "não aplicável")
        passed = FALLBACK_PHRASE.lower() in response.lower()
        detail = "frase de fallback presente" if passed else f"frase de fallback ausente"
        return CriterionResult("frase de fallback", passed, detail)

    def _evaluate(self, case: TestCase) -> TestCaseResult:
        r = case.mock_response
        criteria = [
            self._check_citation(r, case.deve_ter_fonte),
            self._check_forbidden_terms(r),
            self._check_portuguese(r),
            self._check_length(r),
            self._check_expected_content(r, case.resposta_esperada_contem),
            self._check_fallback(r, case.is_fallback_case),
        ]
        return TestCaseResult(pergunta=case.pergunta, criteria=criteria)

    def run_tests(self, system_prompt: str, test_cases: list[TestCase]) -> list[TestCaseResult]:
        results = []
        for case in test_cases:
            result = self._evaluate(case)
            results.append(result)
        if self.verbose:
            self._print_report(system_prompt, results)
        return results

    def _print_report(self, system_prompt: str, results: list[TestCaseResult]) -> None:
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        sep = "─" * 60
        print(sep)
        print("RELATÓRIO DE TESTES — NovaTech Prompt Tester")
        print(sep)
        print(f"System prompt: {system_prompt[:80]}{'…' if len(system_prompt) > 80 else ''}")
        print(f"Total de casos: {total} | Passou: {passed} | Falhou: {total - passed}")
        print(sep)
        for i, result in enumerate(results, 1):
            status = "PASS" if result.passed else "FAIL"
            print(f"\n[{status}] Caso {i}: {result.pergunta}")
            for criterion in result.criteria:
                icon = "✓" if criterion.passed else "✗"
                print(f"  {icon} {criterion.name}: {criterion.detail}")
        print(f"\n{sep}")
        print(f"Resultado final: {passed}/{total} casos aprovados")
        print(sep)
```

### Ajustes realizados

O script foi gerado com Claude Code (equivalente ao fluxo do Copilot). Ajustes aplicados sobre o esqueleto inicial:
- `TestCase` modelado como dataclass em vez de dict puro, para type-safety
- Critério de português implementado como heurística por ratio de palavras inglesas conhecidas (lista curada), evitando dependência de biblioteca externa
- Critério de fallback separado do de conteúdo esperado, com flag `is_fallback_case` no `TestCase`
- Casos de teste com `mock_response` embutido diretamente, tornando o script autocontido e executável sem API

---

## Parte 4 — Enforcement Probabilístico vs Determinístico

### Prompt enviado

No sistema de assistente de IA da NovaTech, tenho os seguintes guardrails definidos:

1. Sempre citar a fonte do documento na resposta
2. Nunca inventar prazos ou valores numéricos
3. Quando não encontrar resposta, dizer explicitamente e sugerir escalar ao supervisor
4. Responder em português formal

**Problema:** Guardrails no system prompt são instruções para o LLM — o modelo tentará seguir, mas pode falhar. Alguns desses guardrails precisam ser enforçados de forma determinística fora do modelo (validação no código da aplicação), não apenas no prompt.

**Tarefa:**
1. Para cada um dos 4 guardrails acima, classifique como Probabilístico (prompt) ou Determinístico (harness).
2. Para os guardrails determinísticos, descreva o que o código valida, o que acontece na falha e por que o prompt não é suficiente.
3. Apresente um cenário realista em que o LLM segue todas as instruções e mesmo assim produz resposta inaceitável que só o harness detectaria.
4. Opinião: qual é o limite aceitável de enforcement probabilístico para um sistema de atendimento logístico?

### Resposta do Claude

# Enforcement Probabilístico vs Determinístico — NovaTech RAG Assistant

---

## 1. Classificação dos Guardrails

### Guardrail 1 — Sempre citar a fonte do documento
**Classificação: Determinístico (harness)**

A falha é frequente o suficiente para ser tratada no código. O LLM pode citar fontes parcialmente ("conforme a política interna...") sem incluir o identificador estruturado exigido, ou pode omitir a citação em respostas que considera "óbvias". Num sistema de atendimento, uma resposta sem fonte é indistinguível de uma alucinação para o supervisor que audita o chamado.

### Guardrail 2 — Nunca inventar prazos ou valores numéricos
**Classificação: Determinístico (harness)**

Este é o guardrail de maior impacto operacional. Um prazo inventado comunicado ao cliente gera obrigação contratual implícita. O LLM pode "extrapolar" valores com alta confiança — e quanto mais confiante, menos o atendente questiona. Enforcement apenas no prompt é insuficiente.

### Guardrail 3 — Quando não encontrar resposta, usar frase de fallback
**Classificação: Probabilístico (prompt)**

A falha aqui é de omissão (o modelo dá uma resposta vaga em vez de declarar explicitamente que não sabe), não de invenção de dado crítico. O impacto é operacional mas não contratual. O prompt com a frase exata de fallback é suficiente como controle primário; um log de monitoramento detecta padrões de respostas curtas sem citação como sinal secundário.

### Guardrail 4 — Responder em português formal
**Classificação: Probabilístico (prompt)**

O modelo raramente falha neste ponto dado o contexto em português. A falha mais provável é tom informal ocasional, não mudança de idioma. Baixo impacto — não justifica validação determinística no caminho crítico da resposta.

---

## 2. Implementação dos Controles Determinísticos

### Guardrail 1 — Citação de fonte

**O que o código valida:**
```python
import re

CITATION_PATTERN = re.compile(
    r'\(Fonte:.*?(POL|PROC|SLA|CONF|SPT)-\d+.*?\)',
    re.IGNORECASE
)

def validate_citation(response: str) -> bool:
    return bool(CITATION_PATTERN.search(response))
```

O harness verifica se a resposta contém ao menos uma citação no padrão estruturado `(Fonte: [ID])`. Identificadores aceitos cobrem as três fontes: SharePoint (`SPT-`), Confluence (`CONF-`), planilhas (`PROC-`, `POL-`, `SLA-`).

**O que acontece na falha:** a resposta é **bloqueada** e substituída por: *"Não foi possível gerar uma resposta com citação de fonte verificada. Por favor, consulte diretamente a documentação ou escale ao supervisor."* O evento é logado com o ID do chamado e a resposta original para auditoria.

**Por que o prompt não é suficiente:** o modelo pode responder corretamente o conteúdo mas formatar a citação de forma que quebra o padrão (`"segundo o documento de SLA"` em vez de `(Fonte: SLA-2024)`). O atendente não detecta a diferença; o harness sim.

---

### Guardrail 2 — Proibição de valores numéricos inventados

**O que o código valida:**

Dois níveis de verificação:

**Nível 1 — Presença de números na resposta exige fonte:**
```python
NUMBER_PATTERN = re.compile(r'\b\d+[\.,]?\d*\s*(h|horas|dias|kg|R\$|%)\b', re.IGNORECASE)

def validate_numbers_have_sources(response: str, retrieved_chunks: list[str]) -> bool:
    numbers_in_response = NUMBER_PATTERN.findall(response)
    if not numbers_in_response:
        return True
    chunks_text = ' '.join(retrieved_chunks)
    for number in numbers_in_response:
        if number not in chunks_text:
            return False
    return True
```

**Nível 2 — Lista de termos que sinalizam inferência:**
```python
UNCERTAINTY_TERMS = [
    "provavelmente", "acredito que", "estimo", "aproximadamente",
    "deve ser", "costuma ser", "geralmente é", "em torno de"
]

def validate_no_hedged_numbers(response: str) -> bool:
    response_lower = response.lower()
    return not any(term in response_lower for term in UNCERTAINTY_TERMS)
```

**O que acontece na falha:** resposta bloqueada. Log com a resposta original, os chunks recuperados e o número conflitante — insumo direto para retraining e curadoria da base.

**Por que o prompt não é suficiente:** o LLM pode inferir um valor com alta confiança a partir de dois chunks parciais (ex: "prazo Gold = 2h" + "prazo Silver = 4× Gold" → inventa "16h" para Standard). A lógica está correta; o dado não existe na base. Só o harness detecta isso cruzando os números da resposta com os chunks recuperados.

---

## 3. Cenário Realista: LLM Segue o Prompt e Ainda Assim Produz Resposta Inaceitável

**Cenário:** atendente pergunta *"Qual o prazo de entrega para cliente Gold no estado do Amazonas?"*

O RAG recupera dois chunks:
- `SLA-2024, seção 3.1`: *"Clientes Gold têm SLA de entrega de 24h para capitais da Região Sul e Sudeste."*
- `PROC-042, seção 2.4`: *"Para entregas na Região Norte, aplicar fator de 2,5× sobre o SLA padrão."*

O LLM:
- ✅ Cita ambas as fontes corretamente
- ✅ Usa apenas informações dos documentos recuperados
- ✅ Responde em português formal
- ✅ Não usa termos de incerteza
- ❌ **Produz:** *"Para clientes Gold no Amazonas, o prazo de entrega é de 60 horas (24h × 2,5)."*

O número **60h não existe em nenhum documento**. É uma inferência aritmética correta a partir de dois documentos reais. O prompt foi seguido integralmente. Apenas o harness do Nível 1 (cruzamento de números da resposta com chunks) detecta que `"60"` não aparece em nenhum chunk recuperado e bloqueia a resposta.

---

## 4. Opinião: Limite Aceitável de Enforcement Probabilístico

Para um sistema de atendimento logístico onde **erros de prazo e valor têm impacto operacional direto** (obrigações contratuais, SLAs penalizáveis, decisões de frete em tempo real), minha posição é:

**Tudo que pode ser expresso como uma verificação determinística deve sê-lo.**

O custo de um falso positivo do harness (bloquear uma resposta correta) é baixo — o atendente escala ao supervisor, o chamado leva 5 minutos a mais. O custo de um falso negativo (deixar passar um valor inventado) pode ser um prazo comunicado ao cliente, uma reclamação, uma penalidade contratual.

**Linha prática para este sistema:**

| Tipo de dado | Enforcement |
|---|---|
| Qualquer número (prazo, valor, peso, percentual) | Determinístico — cruzar com chunks |
| Presença de citação de fonte estruturada | Determinístico — regex obrigatório |
| Frase de fallback quando sem resposta | Probabilístico + monitoramento |
| Tom e idioma | Probabilístico — prompt suficiente |

O enforcement probabilístico é aceitável apenas para atributos de forma (tom, idioma, estrutura da resposta) — nunca para atributos de conteúdo factual. A régua é: **se o dado errado pode chegar ao cliente como verdade, o harness valida.**

### Iterações (se houver)

**Prompt de refinamento:**

<!-- cole aqui -->

**Resposta:**

<!-- cole aqui -->
