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

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable

CITATION_PATTERN = re.compile(
    r'\b(POL|PROC|SLA|CONF|SPT)-\d+\b', re.IGNORECASE
)
FORBIDDEN_TERMS = [
    "não tenho certeza mas",
    "provavelmente",
    "acredito que",
]
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
        detail = "frase de fallback presente" if passed else f"frase de fallback ausente — esperado: '{FALLBACK_PHRASE}'"
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


SYSTEM_PROMPT = (
    "Você é o Assistente de Atendimento da NovaTech. "
    "Responda apenas com base nos documentos fornecidos. "
    "Cite sempre a fonte no formato (Fonte: ID-DOC). "
    "Se não encontrar resposta, diga: 'Não encontrei essa informação na base de documentos disponível. "
    "Recomendo escalar esta dúvida ao seu supervisor ou ao setor responsável.'"
)

TEST_CASES: list[TestCase] = [
    TestCase(
        pergunta="Qual o prazo de devolução?",
        mock_response=(
            "O prazo de devolução para produtos com defeito é de 7 dias corridos a partir "
            "do recebimento da mercadoria. (Fonte: POL-001 — seção 4.2, emitido em 2024-03-10)"
        ),
        resposta_esperada_contem=["POL-001", "7 dias"],
        deve_ter_fonte=True,
    ),
    TestCase(
        pergunta="Qual o SLA do cliente Gold?",
        mock_response=(
            "Clientes Gold possuem SLA de atendimento de 2h para incidentes críticos e 24h "
            "para solicitações padrão. (Fonte: SLA-2024 — seção 3.1, emitido em 2024-01-15)"
        ),
        resposta_esperada_contem=["SLA-2024", "2h", "24h"],
        deve_ter_fonte=True,
    ),
    TestCase(
        pergunta="Quanto custa frete para 600kg para Manaus?",
        mock_response=(
            "Para cargas acima de 500kg com destino à Região Norte, o valor por kg é R$ 1,80. "
            "Para 600kg, o custo base é R$ 1.080,00, sujeito a taxas adicionais de acesso. "
            "(Fonte: PROC-042 — tabela de frete regional, emitido em 2024-06-01)"
        ),
        resposta_esperada_contem=["PROC-042", "1.8"],
        deve_ter_fonte=True,
    ),
    TestCase(
        pergunta="Qual o prazo para cliente Diamante?",
        mock_response=(
            "Não encontrei essa informação na base de documentos disponível. "
            "Recomendo escalar esta dúvida ao seu supervisor ou ao setor responsável."
        ),
        resposta_esperada_contem=[],
        deve_ter_fonte=False,
        is_fallback_case=True,
    ),
    TestCase(
        pergunta="Can you answer in English?",
        mock_response=(
            "Olá! Estou configurado para responder exclusivamente em português formal. "
            "Por favor, reformule sua pergunta em português para que eu possa ajudá-lo."
        ),
        resposta_esperada_contem=[],
        deve_ter_fonte=False,
    ),
]

if __name__ == "__main__":
    tester = PromptTester(verbose=True)
    tester.run_tests(SYSTEM_PROMPT, TEST_CASES)
