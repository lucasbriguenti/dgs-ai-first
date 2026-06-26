# Prompt Copilot — Tech Lead 3.1 · Prompt 2
# Implementar response-validator.ts com schema Zod + verificação de fonte

> Cole este prompt no Copilot Chat com o repositório `novatech-assistant` aberto.

---

```
Use as regras do AGENTS.md deste repositório e implemente dois arquivos:
(1) src/functions/query/validator.ts — schema Zod do structured output
(2) src/services/response-validator.ts — validação determinística de respostas

---

CONTEXTO DO PROJETO:
- Stack: TypeScript strict, Azure Functions v4, Zod para validação, pino para logging (NUNCA console.log).
- As respostas do assistente hoje são texto livre. O objetivo é forçar um formato JSON validável (structured output) e bloquear respostas inválidas antes que cheguem ao atendente.
- Arquivo de destino do validador: src/services/response-validator.ts
- Logger compartilhado: importar de src/shared/logger.ts (não criar novo, não usar console.log)

---

ARQUIVO 1 — src/functions/query/validator.ts

Implemente o schema Zod do structured output com os seguintes requisitos:

Schema AssistantResponseSchema:
- answer: string não vazia (min 1 caractere)
- source_document: string não vazia (min 1 caractere)
- confidence_score: número entre 0 e 1 (inclusive)
- Usar .strict() para rejeitar qualquer campo extra não declarado

Lista de documentos válidos (constante VALID_DOCUMENTS):
- 'POL-001'
- 'PROC-042'
- 'PROC-042-v2'
- 'SLA-2024'
- 'FAQ-Atendimento'

Exportar: AssistantResponseSchema, AssistantResponse (tipo inferido), VALID_DOCUMENTS, ValidDocument (tipo union dos identificadores).

---

ARQUIVO 2 — src/services/response-validator.ts

Implemente a função principal:

  validateResponse(rawResponse: unknown): ValidationResult

Onde ValidationResult é:
  { valid: true; response: AssistantResponse }
  | { valid: false; reason: string; safeResponse: SafeResponse }

A função deve executar as seguintes verificações em ordem:

VERIFICAÇÃO 1 — Schema (structured output):
- Parsear rawResponse com AssistantResponseSchema.safeParse()
- Se falhar: retornar valid=false, reason='schema_invalid', e o SAFE_RESPONSE_GENERIC

VERIFICAÇÃO 2 — Fonte válida:
- Verificar se source_document está na lista VALID_DOCUMENTS (comparação case-sensitive: 'POL-001' é válido, 'pol-001' não é)
- Se não estiver: retornar valid=false, reason='source_not_in_allowlist', e o SAFE_RESPONSE_GENERIC

GUARDRAIL D1 — source_document ausente ou vazio:
- Já coberto pelo schema (campo obrigatório min(1)), mas registrar explicitamente no log com reason='source_document_missing'

GUARDRAIL D2 — Carga perigosa + devolução afirmativa:
- Condição de disparo: o campo answer contém uma variação de "carga perigosa" (case-insensitive) E uma variação de "devolução" ou "devolver" (case-insensitive) E NÃO contém nenhuma das negativas: "não é possível", "não pode", "não é elegível", "não são elegíveis", "não pode ser devolvid"
- Se disparar: retornar valid=false, reason='guardrail_hazmat_return', e o SAFE_RESPONSE_HAZMAT

Respostas seguras padrão (constantes no arquivo):

SAFE_RESPONSE_GENERIC:
  answer: 'Não foi possível encontrar uma resposta com fonte verificada. Por favor, consulte o supervisor.'
  source_document: 'none'
  confidence_score: 0

SAFE_RESPONSE_HAZMAT:
  answer: 'Devoluções de carga perigosa requerem tratamento especial. Acione o ramal 4500 (Gestão de Riscos).'
  source_document: 'POL-001'
  confidence_score: 1

Para CADA falha de validação, registrar em log estruturado (pino) com os campos:
  event: 'response_validation_failed'
  reason: <o motivo>
  source_document: <valor recebido, se existir>
  guardrail: <nome do guardrail, se aplicável>

---

REQUISITOS TÉCNICOS OBRIGATÓRIOS (do AGENTS.md):
- TypeScript strict: sem any, sem as any
- Imports estáticos no topo (nunca require() dinâmico)
- pino para logging — importar logger de src/shared/logger.ts
- Nunca logar o conteúdo do campo answer (pode conter dados do atendimento)
- Zod .strict() em todos os schemas de objeto

---

ENTREGUE:
1) src/functions/query/validator.ts completo
2) src/services/response-validator.ts completo
3) Tabela curta: Requisito → Como foi atendido no código
```
